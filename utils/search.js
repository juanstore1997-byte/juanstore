const cheerio = require('cheerio');

async function searchProduct(query) {
  const cleanQuery = query
    .replace(/[^\w\s\-.:]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleanQuery || cleanQuery.length < 2) {
    return { results: [] };
  }

  const results = [];
  const seen = new Set();

  // 1. DuckDuckGo HTML scraping (resultados reales de tiendas)
  try {
    const ddg = await searchDuckDuckGoHTML(cleanQuery);
    for (const r of ddg) {
      const key = r.title.toLowerCase();
      if (!seen.has(key)) { seen.add(key); results.push(r); }
    }
  } catch (e) { console.log('DDG HTML error:', e.message); }

  // 2. Si hay pocos resultados, intentar con variaciones del query
  if (results.length < 3) {
    const variations = buildSearchVariations(cleanQuery);
    for (const variation of variations) {
      try {
        const extra = await searchDuckDuckGoHTML(variation);
        for (const r of extra) {
          const key = r.title.toLowerCase();
          if (!seen.has(key)) { seen.add(key); results.push(r); }
        }
      } catch (e) { /* skip */ }
      if (results.length >= 6) break;
    }
  }

  return { results: results.slice(0, 8), total: results.length };
}

function buildSearchVariations(query) {
  const variations = [];
  
  // Quitar palabras comunes y buscar de nuevo
  const stopWords = ['product', 'buy', 'price', 'store', 'online', 'shop', 'the', 'a', 'an'];
  const simplified = query.split(' ').filter(w => !stopWords.includes(w.toLowerCase())).join(' ');
  if (simplified !== query && simplified.length > 2) {
    variations.push(simplified);
  }
  
  // Agregar "price" y "buy"
  if (!query.includes('price')) {
    variations.push(`${query} price`);
  }
  if (!query.includes('buy')) {
    variations.push(`${query} buy online`);
  }
  
  return variations;
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

  // Parsear resultados de DuckDuckGo HTML
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

    // DuckDuckGo sometimes wraps URLs in redirect
    if (link.includes('uddg=')) {
      try {
        const url = new URL(link, 'https://duckduckgo.com');
        link = decodeURIComponent(url.searchParams.get('uddg') || link);
      } catch (e) { /* keep original */ }
    }

    if (!title || title.length < 3) return;

    // Filtrar resultados de basura
    const linkLower = (link || '').toLowerCase();
    const titleLower = title.toLowerCase();
    const junkDomains = ['youtube', 'facebook', 'twitter', 'instagram', 'tiktok', 'reddit', 'pinterest', 'wikipedia'];
    if (junkDomains.some(d => linkLower.includes(d))) return;

    // Extraer tienda del URL
    const store = extractStore(link);

    // Extraer imagen del snippet (a veces viene)
    const image = '';

    results.push({
      title: title.substring(0, 150),
      link: link.startsWith('//') ? `https:${link}` : link,
      snippet: snippet.substring(0, 300),
      image,
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
  if (lower.includes('mercadolibre.') || lower.includes('mercadolibre.')) return 'MercadoLibre';
  if (lower.includes('aliexpress.')) return 'AliExpress';
  if (lower.includes('homedepot.')) return 'Home Depot';
  if (lower.includes('target.')) return 'Target';
  if (lower.includes('bestbuy.')) return 'Best Buy';
  if (lower.includes('costco.')) return 'Costco';
  if (lower.includes('etsy.')) return 'Etsy';
  if (lower.includes('shopify.')) return 'Shopify';
  if (lower.includes('linio.')) return 'Linio';
  if (lower.includes('falabella.')) return 'Falabella';
  if (lower.includes('ripley.')) return 'Ripley';
  if (lower.includes('Paris.')) return 'Paris';
  
  // Intentar extraer dominio
  try {
    const hostname = new URL(url.startsWith('http') ? url : `https://${url}`).hostname;
    const parts = hostname.replace('www.', '').split('.');
    return parts[0];
  } catch (e) {
    return '';
  }
}

module.exports = { searchProduct };
