const cheerio = require('cheerio');

async function searchProduct(query) {
  const cleanQuery = cleanOCRQuery(query);

  if (!cleanQuery || cleanQuery.length < 2) {
    return { results: [] };
  }

  console.log('Search query limpio:', cleanQuery);

  const results = [];
  const seen = new Set();

  // 1. Google Custom Search API (si hay API key)
  if (process.env.GOOGLE_SEARCH_API_KEY && process.env.GOOGLE_SEARCH_API_KEY !== 'tu_api_key_de_google_search_aqui') {
    try {
      const googleResults = await searchGoogleCustom(cleanQuery);
      for (const r of googleResults) {
        const key = (r.title || '').toLowerCase().substring(0, 50);
        if (!seen.has(key)) { seen.add(key); results.push(r); }
      }
    } catch (e) { console.log('Google Custom error:', e.message); }
  }

  // 2. DuckDuckGo HTML scraping
  if (results.length < 3) {
    try {
      const ddg = await searchDuckDuckGoHTML(cleanQuery);
      for (const r of ddg) {
        const key = (r.title || '').toLowerCase().substring(0, 50);
        if (!seen.has(key)) { seen.add(key); results.push(r); }
      }
    } catch (e) { console.log('DDG HTML error:', e.message); }
  }

  // 3. Variaciones inteligentes del query
  if (results.length < 3) {
    const variations = buildSearchVariations(cleanQuery);
    for (const variation of variations) {
      console.log('Variación:', variation);
      try {
        const extra = await searchDuckDuckGoHTML(variation);
        for (const r of extra) {
          const key = (r.title || '').toLowerCase().substring(0, 50);
          if (!seen.has(key)) { seen.add(key); results.push(r); }
        }
      } catch (e) { /* skip */ }
      if (results.length >= 6) break;
    }
  }

  // 4. Último recurso: buscar solo el modelo si hay "D-802" o similar
  if (results.length < 2) {
    const modelMatch = cleanQuery.match(/[A-Z]-?\d{3,5}/i);
    if (modelMatch) {
      try {
        const extra = await searchDuckDuckGoHTML(`${modelMatch[0]} product`);
        for (const r of extra) {
          const key = (r.title || '').toLowerCase().substring(0, 50);
          if (!seen.has(key)) { seen.add(key); results.push(r); }
        }
      } catch (e) { /* skip */ }
    }
  }

  return { results: results.slice(0, 8), total: results.length };
}

function cleanOCRQuery(text) {
  if (!text) return '';

  let cleaned = text
    // Quitar caracteres raros del OCR
    .replace(/[^\w\s\-.:\/]/g, ' ')
    // Quitar palabras que parecen basura OCR (4+ letras mayúsculas con patrones raros)
    .replace(/\b[A-Z]{5,}\b/g, '')
    // Quitar palabras tipo "LUUKNONNDE" (letras repetidas raras)
    .replace(/\b[A-Z]*([A-Z])\1{2,}[A-Z]*\b/g, '')
    // Normalizar espacios
    .replace(/\s+/g, ' ')
    .trim();

  // Si el query quedó muy corto, intentar con el original limpio
  if (cleaned.length < 3) {
    cleaned = text.replace(/[^\w\s\-.]/g, ' ').replace(/\s+/g, ' ').trim();
  }

  return cleaned;
}

function buildSearchVariations(query) {
  const variations = [];

  // Quitar preposiciones y palabras comunes
  const stopWords = ['product', 'buy', 'price', 'store', 'online', 'shop', 'the', 'a', 'an', 'with', 'for', 'from'];
  const simplified = query.split(' ').filter(w => !stopWords.includes(w.toLowerCase()) && w.length > 1).join(' ');
  if (simplified !== query && simplified.length > 2) {
    variations.push(simplified);
  }

  // Solo las primeras 3-4 palabras importantes
  const words = query.split(' ').filter(w => w.length > 1);
  if (words.length > 3) {
    variations.push(words.slice(0, 4).join(' '));
  }

  // Con "buy online"
  if (!query.includes('buy')) {
    variations.push(`${simplified || query} buy online`);
  }

  // Con "price"
  if (!query.includes('price')) {
    variations.push(`${simplified || query} price`);
  }

  // Agregar "Bolivia" para resultados locales
  variations.push(`${simplified || query} Bolivia`);

  // Buscar solo modelo si existe
  const modelMatch = query.match(/[A-Z]-?\d{3,5}/i);
  if (modelMatch) {
    variations.push(modelMatch[0]);
    variations.push(`${modelMatch[0]} juicer`);
    variations.push(`${modelMatch[0]} product`);
  }

  return [...new Set(variations)];
}

async function searchGoogleCustom(query) {
  const apiKey = process.env.GOOGLE_SEARCH_API_KEY;
  const cx = process.env.GOOGLE_SEARCH_ID;
  if (!apiKey || !cx || apiKey.startsWith('tu_')) return [];

  const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cx}&q=${encodeURIComponent(query)}&num=8`;

  const response = await fetch(url, {
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) return [];

  const data = await response.json();
  if (!data.items) return [];

  return data.items.map(item => ({
    title: item.title || '',
    link: item.link || '',
    snippet: item.snippet || '',
    image: item.pagemap?.cse_thumbnail?.[0]?.src || item.pagemap?.cse_image?.[0]?.src || '',
    source: extractStore(item.link),
    store: extractStore(item.link),
  }));
}

async function searchDuckDuckGoHTML(query) {
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
    },
    signal: AbortSignal.timeout(12000),
  });

  if (!response.ok) return [];

  const html = await response.text();
  const $ = cheerio.load(html);
  const results = [];

  $('.result').each((i, el) => {
    if (i >= 8) return false;

    const titleEl = $(el).find('.result__title');
    const snippetEl = $(el).find('.result__snippet');
    const urlEl = $(el).find('.result__url');
    const aEl = $(el).find('.result__a');

    const title = titleEl.text().trim();
    const snippet = snippetEl.text().trim();
    let displayUrl = urlEl.text().trim();
    let link = aEl.attr('href') || '';

    if (link.includes('uddg=')) {
      try {
        const u = new URL(link, 'https://duckduckgo.com');
        link = decodeURIComponent(u.searchParams.get('uddg') || link);
      } catch (e) { /* keep original */ }
    }

    if (!title || title.length < 3) return;

    const linkLower = (link || '').toLowerCase();
    const junkDomains = ['youtube', 'facebook', 'twitter', 'instagram', 'tiktok', 'reddit', 'pinterest', 'wikipedia'];
    if (junkDomains.some(d => linkLower.includes(d))) return;

    const store = extractStore(link);

    results.push({
      title: title.substring(0, 150),
      link: link.startsWith('//') ? `https:${link}` : link,
      snippet: snippet.substring(0, 300),
      image: '',
      source: store || 'web',
      store
    });
  });

  return results;
}

function extractStore(url) {
  if (!url) return '';
  const lower = url.toLowerCase();

  if (lower.includes('amazon.')) return 'Amazon';
  if (lower.includes('walmart.')) return 'Walmart';
  if (lower.includes('ebay.')) return 'eBay';
  if (lower.includes('mercadolibre')) return 'MercadoLibre';
  if (lower.includes('aliexpress.')) return 'AliExpress';
  if (lower.includes('homedepot.')) return 'Home Depot';
  if (lower.includes('target.')) return 'Target';
  if (lower.includes('bestbuy.')) return 'Best Buy';
  if (lower.includes('costco.')) return 'Costco';
  if (lower.includes('etsy.')) return 'Etsy';
  if (lower.includes('linio.')) return 'Linio';
  if (lower.includes('falabella.')) return 'Falabella';
  if (lower.includes('ripley.')) return 'Ripley';
  if (lower.includes('paris.')) return 'Paris';
  if (lower.includes('banggood.')) return 'Banggood';
  if (lower.includes('wish.')) return 'Wish';

  try {
    const hostname = new URL(url.startsWith('http') ? url : `https://${url}`).hostname;
    const parts = hostname.replace('www.', '').split('.');
    return parts[0];
  } catch (e) {
    return '';
  }
}

module.exports = { searchProduct };
