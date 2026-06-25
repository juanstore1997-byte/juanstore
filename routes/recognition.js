const express = require('express');
const multer = require('multer');
const Tesseract = require('tesseract.js');
const { searchProduct } = require('../utils/search');
const { translateProduct } = require('../utils/translate');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten imágenes'), false);
    }
  },
});

async function viClassify(imageBuffer) {
  const HF_TOKEN = process.env.HUGGINGFACE_TOKEN;
  if (!HF_TOKEN) return null;
  try {
    const response = await fetch(
      'https://router.huggingface.co/hf-inference/models/google/vit-base-patch16-224',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${HF_TOKEN}`,
          'Content-Type': 'application/octet-stream',
        },
        body: imageBuffer,
        signal: AbortSignal.timeout(15000),
      }
    );
    if (!response.ok) return null;
    return await response.json();
  } catch (e) {
    console.log('ViT error:', e.message);
    return null;
  }
}

async function ocrRead(imageBuffer) {
  // Try multiple OCR passes with different settings
  const attempts = [];

  // Pass 1: English
  try {
    const { data } = await Tesseract.recognize(imageBuffer, 'eng', {
      signal: AbortSignal.timeout(15000),
    });
    attempts.push(data.text.trim());
  } catch (e) { /* skip */ }

  // Pass 2: Spanish
  try {
    const { data } = await Tesseract.recognize(imageBuffer, 'spa', {
      signal: AbortSignal.timeout(15000),
    });
    attempts.push(data.text.trim());
  } catch (e) { /* skip */ }

  // Pass 3: English with PSM 6 (assume uniform block of text)
  try {
    const { data } = await Tesseract.recognize(imageBuffer, 'eng', {
      tessedit_pageseg_mode: '6',
      signal: AbortSignal.timeout(15000),
    });
    attempts.push(data.text.trim());
  } catch (e) { /* skip */ }

  // Pick the best result (most uppercase words = likely product text)
  let best = '';
  let bestScore = 0;
  for (const text of attempts) {
    if (!text) continue;
    const words = text.split(/\s+/).filter(w => w.length > 1);
    const upperWords = words.filter(w => /^[A-Z]/.test(w));
    const score = upperWords.length * 2 + words.length;
    if (score > bestScore) {
      bestScore = score;
      best = text;
    }
  }

  return best || attempts[0] || '';
}

function extractProductFromOCR(text) {
  if (!text || text.length < 3) return { nombre: '', marca: '', keywords: [] };

  const lineas = text.split('\n').map(l => l.trim()).filter(l => l.length > 1 && l.length < 100);

  const marcas = /Lilicrops|Philco|Oster|Samsung|Apple|Xiaomi|Sony|LG|Bosch|Kenwood|Black.?Decker|Hamilton|Cuisinart|Ninja|Vitamix|KitchenAid|Truper|Stanley|Dewalt|Milwaukee|Craftsman|Anker|Baseus|Logitech|Corsair|Kingston|SanDisk|TP-Link|Huawei|Canon|Nikon|GoPro|DJI|Philips|Braun|Panasonic|Toshiba|Asus|Acer|MSI|Lenovo|Dell|HP|Vinci|Luukonde|LUUKONDE|Luxornon|LUXORNON/i;

  let marca = '';
  let nombre = '';
  const keywords = [];

  // Buscar marca
  for (const linea of lineas) {
    const match = linea.match(marcas);
    if (match) {
      marca = match[0];
      nombre = linea;
      break;
    }
  }

  // Buscar palabras clave útiles (números de modelo, características)
  for (const linea of lineas) {
    // Buscar modelos tipo D-802, S-9058, MX-123, etc.
    const modelMatch = linea.match(/[A-Z]{1,4}-?\d{2,5}/g);
    if (modelMatch) keywords.push(...modelMatch);

    // Buscar palabras en mayúsculas (probablemente nombre de producto)
    const upperWords = linea.match(/[A-Z]{2,}/g);
    if (upperWords && upperWords.length >= 1) {
      // Filtrar palabras que parecen basura OCR (letras repetidas)
      const cleanUpper = upperWords.filter(w => w.length > 2 && !/(.)\1{2,}/.test(w));
      keywords.push(...cleanUpper);
    }

    // Buscar palabras con números (modelos, versiones)
    const alphanumeric = linea.match(/[A-Za-z]+\d+/g);
    if (alphanumeric) keywords.push(...alphanumeric);
  }

  // Limpiar keywords de basura OCR
  const cleanKeywords = keywords.filter(k => {
    // Quitar palabras que parecen basura (muy largas sin vocales, o con muchas letras repetidas)
    if (k.length > 15) return false;
    if (/(.)\1{3,}/.test(k)) return false;
    // Quitar palabras que no tienen vocales
    if (!/[aeiou]/i.test(k)) return false;
    return true;
  });

  // Si no encontramos nombre por marca, buscar la línea más descriptiva
  if (!nombre) {
    for (const linea of lineas) {
      const alpha = linea.replace(/[^a-zA-Z\s]/g, '').trim();
      if (alpha.length > 5 && alpha.split(' ').length >= 2) {
        nombre = alpha;
        break;
      }
    }
  }

  // Si aún no hay nombre, usar la primera línea con texto
  if (!nombre && lineas.length > 0) {
    for (const linea of lineas) {
      const clean = linea.replace(/[^a-zA-Z0-9\s]/g, '').trim();
      if (clean.length > 2) {
        nombre = clean;
        break;
      }
    }
  }

  // Limpiar nombre de basura OCR
  if (nombre) {
    nombre = nombre
      .replace(/\b[A-Z]{5,}\b/g, '')  // Quitar palabras largas en mayúsculas
      .replace(/\b[A-Z]*([A-Z])\1{2,}[A-Z]*\b/g, '')  // Quitar letras repetidas
      .replace(/\s+/g, ' ')
      .trim();
  }

  return {
    nombre: nombre.substring(0, 100),
    marca,
    keywords: [...new Set(cleanKeywords)].slice(0, 10)
  };
}

function viToSearchQuery(viResult) {
  if (!viResult || !Array.isArray(viResult) || viResult.length === 0) return '';

  const categoryMap = {
    'carton': 'box packaging',
    'envelope': 'mail package',
    'crossword puzzle': 'game puzzle toy',
    'bottle': 'bottle container',
    'cup': 'cup mug kitchen',
    'wine bottle': 'wine bottle',
    'beer bottle': 'beer bottle',
    'water bottle': 'water bottle',
    'coffee mug': 'coffee mug',
    'plate': 'plate dish kitchen',
    'bowl': 'bowl dish kitchen',
    'knife': 'knife kitchen tool',
    'spoon': 'spoon utensil',
    'fork': 'fork utensil',
    'scissors': 'scissors cutting tool',
    'hammer': 'hammer tool',
    'screwdriver': 'screwdriver tool',
    'wrench': 'wrench tool',
    'pliers': 'pliers tool',
    'drill': 'drill power tool',
    'saw': 'saw cutting tool',
    'tape measure': 'measuring tape',
    'flashlight': 'flashlight light',
    'battery': 'battery power',
    'remote control': 'remote control',
    'cellular telephone': 'phone smartphone',
    'laptop': 'laptop computer',
    'desktop computer': 'computer desktop',
    'monitor': 'monitor display',
    'keyboard': 'keyboard computer',
    'mouse': 'mouse computer',
    'printer': 'printer office',
    'camera': 'camera photo',
    'sunglasses': 'sunglasses glasses',
    'watch': 'watch wrist',
    'wallet': 'wallet purse',
    'handbag': 'handbag bag',
    'backpack': 'backpack bag',
    'suitcase': 'suitcase luggage',
    'shoe': 'shoe footwear',
    'sandal': 'sandal footwear',
    'boot': 'boot footwear',
    'hat': 'hat cap',
    'chair': 'chair furniture',
    'table': 'table furniture',
    'sofa': 'sofa couch',
    'bed': 'bed furniture',
    'refrigerator': 'refrigerator appliance',
    'microwave': 'microwave oven',
    'toaster': 'toaster appliance',
    'blender': 'blender kitchen',
    'vacuum cleaner': 'vacuum cleaner',
    'washing machine': 'washing machine',
    'lamp': 'lamp light',
  };

  const labels = viResult
    .slice(0, 3)
    .map(r => {
      const label = (r.label || '').toLowerCase();
      return categoryMap[label] || label;
    })
    .filter(Boolean);

  return labels.join(' ');
}

function buildSmartQuery(ocrData, viQuery) {
  const parts = [];

  // Prioridad 1: Modelo (D-802, etc.)
  if (ocrData.keywords && ocrData.keywords.length > 0) {
    const models = ocrData.keywords.filter(k => /[A-Z]-?\d{2,5}/i.test(k));
    if (models.length > 0) {
      parts.push(models[0]);
    }
  }

  // Prioridad 2: Nombre del producto OCR (sin basura)
  if (ocrData.nombre) {
    // Limpiar nombre: quitar palabras basura
    const cleanNombre = ocrData.nombre
      .replace(/\b[A-Z]{5,}\b/g, '')
      .replace(/\b[A-Z]*([A-Z])\1{2,}[A-Z]*\b/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (cleanNombre.length > 3) {
      parts.push(cleanNombre);
    }
  }

  // Prioridad 3: Marca
  if (ocrData.marca) {
    parts.push(ocrData.marca);
  }

  // Si no hay nada útil del OCR, usar ViT
  if (parts.length === 0 && viQuery) {
    const vitSuggestions = {
      'box packaging': 'product box container',
      'printer office': 'office supplies equipment',
      'photocopier': 'office machine copier',
      'projector': 'projector display',
      'citrus juicer': 'citrus juicer electric',
      'juicer': 'electric juicer',
      'blender': 'electric blender',
    };

    const viWords = viQuery.split(' ');
    for (const word of viWords) {
      if (vitSuggestions[word]) {
        parts.push(vitSuggestions[word]);
      } else if (word.length > 3) {
        parts.push(word);
      }
    }
  }

  const query = parts.join(' ').trim();
  if (!query) return '';

  return `${query} product buy price`;
}

router.post('/analyze-photo', authMiddleware, upload.single('foto'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No se proporcionó imagen' });
  }

  try {
    const [textoOCR, viResult] = await Promise.all([
      ocrRead(req.file.buffer),
      viClassify(req.file.buffer),
    ]);

    console.log('OCR:', textoOCR.substring(0, 300));
    console.log('ViT:', JSON.stringify(viResult?.slice(0, 3)));

    const ocrData = extractProductFromOCR(textoOCR);
    const viQuery = viToSearchQuery(viResult);

    console.log('OCR Data:', JSON.stringify(ocrData));
    console.log('ViT Query:', viQuery);

    // Construir query de búsqueda inteligente
    const queryBusqueda = buildSmartQuery(ocrData, viQuery);

    let resultados = [];
    if (queryBusqueda) {
      console.log('Buscando:', queryBusqueda);
      const busqueda = await searchProduct(queryBusqueda);
      resultados = busqueda.results || [];
      console.log('Resultados:', resultados.length);
    }

    // Traducir resultados (SIN imágenes automáticas)
    const translatedResults = [];
    for (const r of resultados.slice(0, 5)) {
      try {
        const translated = await translateProduct(r);
        translatedResults.push({
          ...translated,
          image: '', // sin imágenes — se obtienen a demanda desde la URL del producto
          originalTitle: r.title,
          originalSnippet: r.snippet,
        });
      } catch (e) {
        translatedResults.push(r);
      }
    }

    // Construir sugerencias de búsqueda
    const sugerencias = [];
    if (ocrData.marca) sugerencias.push(ocrData.marca);
    if (ocrData.nombre) sugerencias.push(ocrData.nombre);
    if (viQuery) sugerencias.push(viQuery.split(' ').slice(0, 2).join(' '));

    res.json({
      texto_ocr: textoOCR,
      ocr_nombre: ocrData.nombre,
      ocr_marca: ocrData.marca,
      ocr_keywords: ocrData.keywords,
      vit_categoria: viQuery,
      query_busqueda: queryBusqueda,
      resultados: translatedResults,
      sugerencias: sugerencias.filter(s => s.length > 2),
    });

  } catch (error) {
    console.error('Error en análisis:', error.message);
    res.status(500).json({ error: 'Error procesando imagen' });
  }
});

router.post('/search-product', authMiddleware, async (req, res) => {
  const { query } = req.body;
  if (!query) {
    return res.status(400).json({ error: 'Query requerido' });
  }
  try {
    const results = await searchProduct(query);
    
    // Traducir resultados (SIN imágenes — se obtienen a demanda)
    const translatedResults = [];
    for (const r of (results.results || []).slice(0, 6)) {
      try {
        const translated = await translateProduct(r);
        translatedResults.push({
          ...translated,
          image: '', // sin imágenes automáticas
          originalTitle: r.title,
          originalSnippet: r.snippet,
        });
      } catch (e) {
        translatedResults.push(r);
      }
    }
    
    res.json({ results: translatedResults, total: translatedResults.length });
  } catch (err) {
    console.error('Error en búsqueda:', err);
    res.status(500).json({ error: 'Error realizando búsqueda' });
  }
});

// Endpoint a demanda: obtiene la imagen (og:image) de una página de producto
router.post('/fetch-product-image', authMiddleware, async (req, res) => {
  const { url } = req.body;
  if (!url) {
    return res.status(400).json({ error: 'URL requerida' });
  }
  try {
    const { fetchProductImage } = require('../utils/search');
    const image = await fetchProductImage(url);
    res.json({ image, url });
  } catch (err) {
    console.error('Error obteniendo imagen:', err);
    res.json({ image: '', url, error: err.message });
  }
});

// Endpoint público de búsqueda (sin auth) para debug
router.post('/search-public', async (req, res) => {
  const { query } = req.body;
  if (!query) {
    return res.status(400).json({ error: 'Query requerido' });
  }
  try {
    console.log('Búsqueda pública:', query);
    const results = await searchProduct(query);
    console.log('Resultados:', results.results?.length || 0);
    res.json({ results: results.results || [], total: results.total || 0, query });
  } catch (err) {
    console.error('Error en búsqueda pública:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
