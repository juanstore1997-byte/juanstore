const HF_TOKEN = process.env.HUGGINGFACE_TOKEN;

const HF_API = 'https://api-inference.huggingface.co/models';

async function queryHF(model, imageBuffer) {
  const response = await fetch(`${HF_API}/${model}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${HF_TOKEN}`,
    },
    body: imageBuffer,
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`HF API error: ${response.status} - ${err}`);
  }

  return await response.json();
}

async function analyzeProductImage(imageBuffer) {
  const base64Image = imageBuffer.toString('base64');

  try {
    // Paso 1: Obtener descripción de la imagen con BLIP
    const captionResult = await queryHF('Salesforce/blip-image-captioning-large', imageBuffer);
    const caption = Array.isArray(captionResult)
      ? captionResult[0]?.generated_text || ''
      : captionResult?.generated_text || '';

    console.log('Caption de imagen:', caption);

    // Paso 2: Extraer información del producto desde el caption
    const result = {
      marca: extraerMarca(caption),
      nombre: caption || 'Producto sin nombre',
      categoria: extraerCategoria(caption),
      color: extraerColor(caption),
      material: '',
      caracteristicas: caption ? [caption] : [],
      fuente: 'Análisis automático',
    };

    return result;
  } catch (e) {
    console.error('Error HuggingFace:', e.message || e);
    throw new Error('Error de IA: ' + (e.message || 'Desconocido'));
  }
}

function extraerMarca(text) {
  const marcas = [
    'nike', 'adidas', 'puma', 'reebok', 'new balance', 'converse', 'vans',
    'zara', 'h&m', 'levi', 'gap', 'under armour', 'fila', 'asics',
    'samsung', 'apple', 'sony', 'lg', 'xiaomi', 'huawei',
    'louis vuitton', 'gucci', 'prada', 'chanel', 'hermes',
    'xiaomi', 'dell', 'hp', 'lenovo', 'asus', 'acer',
  ];
  const lower = text.toLowerCase();
  for (const m of marcas) {
    if (lower.includes(m)) return m.charAt(0).toUpperCase() + m.slice(1);
  }
  return '';
}

function extraerCategoria(text) {
  const lower = text.toLowerCase();
  if (lower.includes('shirt') || lower.includes('camiseta') || lower.includes('t-shirt')) return 'Ropa';
  if (lower.includes('shoe') || lower.includes('zapatilla') || lower.includes('sneaker')) return 'Calzado';
  if (lower.includes('bag') || lower.includes('bolsa') || lower.includes('mochila')) return 'Accesorios';
  if (lower.includes('phone') || lower.includes('celular') || lower.includes('smartphone')) return 'Electrónica';
  if (lower.includes('watch') || lower.includes('reloj')) return 'Accesorios';
  if (lower.includes('pant') || lower.includes('jean') || lower.includes('trouser')) return 'Ropa';
  if (lower.includes('jacket') || lower.includes('coat') || lower.includes('chaqueta')) return 'Ropa';
  if (lower.includes('hat') || lower.includes('gorra') || lower.includes('sombrero')) return 'Accesorios';
  if (lower.includes('sunglasses') || lower.includes('lentes')) return 'Accesorios';
  if (lower.includes('toy') || lower.includes('juguete')) return 'Juguetes';
  if (lower.includes('book') || lower.includes('libro')) return 'Libros';
  if (lower.includes('laptop') || lower.includes('computadora')) return 'Electrónica';
  return 'General';
}

function extraerColor(text) {
  const colores = [
    'rojo', 'red', 'azul', 'blue', 'verde', 'green', 'negro', 'black',
    'blanco', 'white', 'amarillo', 'yellow', 'naranja', 'orange', 'morado', 'purple',
    'rosa', 'pink', 'gris', 'gray', 'grey', 'marrón', 'brown', 'beige', 'crema',
    'dorado', 'gold', 'plateado', 'silver',
  ];
  const lower = text.toLowerCase();
  for (const c of colores) {
    if (lower.includes(c)) {
      const traducciones = {
        red: 'Rojo', blue: 'Azul', green: 'Verde', black: 'Negro',
        white: 'Blanco', yellow: 'Amarillo', orange: 'Naranja', purple: 'Morado',
        pink: 'Rosa', gray: 'Gris', grey: 'Gris', brown: 'Marrón',
        gold: 'Dorado', silver: 'Plateado',
      };
      return traducciones[c] || c.charAt(0).toUpperCase() + c.slice(1);
    }
  }
  return '';
}

async function verifyPaymentReceipt(imageBuffer, expectedAmount) {
  const base64Image = imageBuffer.toString('base64');

  try {
    const captionResult = await queryHF('Salesforce/blip-image-captioning-large', imageBuffer);
    const caption = Array.isArray(captionResult)
      ? captionResult[0]?.generated_text || ''
      : captionResult?.generated_text || '';

    const lower = caption.toLowerCase();
    const esBanco = lower.includes('bank') || lower.includes('banco') || lower.includes('receipt') || lower.includes('comprobante') || lower.includes('payment') || lower.includes('pago');
    const tieneMonto = lower.includes(expectedAmount.toString()) || lower.includes('$');

    return {
      banco: esBanco ? 'Detectado en imagen' : 'No detectado',
      monto_detectado: tieneMonto ? expectedAmount : 0,
      fecha: new Date().toISOString().split('T')[0],
      es_valido: esBanco,
      observaciones: caption,
    };
  } catch (e) {
    console.error('Error verificando comprobante:', e.message || e);
    return { banco: '', monto_detectado: 0, fecha: '', es_valido: false, observaciones: '' };
  }
}

module.exports = { analyzeProductImage, verifyPaymentReceipt };
