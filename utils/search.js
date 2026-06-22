const cheerio = require('cheerio');

async function searchProduct(query) {
  const cleanQuery = cleanOCRQuery(query);
  if (!cleanQuery || cleanQuery.length < 2) {
    return { results: [] };
  }

  console.log('Buscando:', cleanQuery);
  const results = [];
  const seen = new Set();

  // 1. Google Custom Search (si hay API key)
  if (process.env.GOOGLE_SEARCH_API_KEY && !process.env.GOOGLE_SEARCH_API_KEY.startsWith('tu_')) {
    try {
      const googleResults = await searchGoogleCustom(cleanQuery);
      for (const r of googleResults) {
        const key = (r.title || '').toLowerCase().substring(0, 40);
        if (!seen.has(key)) { seen.add(key); results.push(r); }
      }
      console.log('Google:', googleResults.length);
    } catch (e) { console.log('Google error:', e.message); }
  }

  // 2. Amazon search (funciona desde servidores)
  try {
    const amazonResults = await searchAmazon(cleanQuery);
    for (const r of amazonResults) {
      const key = (r.title || '').toLowerCase().substring(0, 40);
      if (!seen.has(key)) { seen.add(key); results.push(r); }
    }
    console.log('Amazon:', amazonResults.length);
  } catch (e) { console.log('Amazon error:', e.message); }

  // 3. MercadoLibre search
  try {
    const mlResults = await searchMercadoLibre(cleanQuery);
    for (const r of mlResults) {
      const key = (r.title || '').toLowerCase().substring(0, 40);
      if (!seen.has(key)) { seen.add(key); results.push(r); }
    }
    console.log('MercadoLibre:', mlResults.length);
  } catch (e) { console.log('ML error:', e.message); }

  // 4. Variaciones si hay pocos resultados
  if (results.length < 3) {
    const variations = buildSearchVariations(cleanQuery);
    for (const v of variations) {
      try {
        const extra = await searchAmazon(v);
        for (const r of extra) {
          const key = (r.title || '').toLowerCase().substring(0, 40);
          if (!seen.has(key)) { seen.add(key); results.push(r); }
        }
      } catch (e) { /* skip */ }
      if (results.length >= 6) break;
    }
  }

  console.log('Total:', results.length);
  return { results: results.slice(0, 8), total: results.length };
}

function cleanOCRQuery(text) {
  if (!text) return '';
  return text
    .replace(/[^\w\s\-.:\/]/g, ' ')
    .replace(/\b[A-Z]{5,}\b/g, '')
    .replace(/\b[A-Z]*([A-Z])\1{2,}[A-Z]*\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildSearchVariations(query) {
  const variations = [];
  const words = query.split(' ').filter(w => w.length > 1);

  const modelMatch = query.match(/[A-Z]-?\d{2,5}/i);
  if (modelMatch) {
    variations.push(modelMatch[0]);
    variations.push(`${modelMatch[0]} juicer`);
  }

  if (words.length > 3) {
    variations.push(words.slice(0, 3).join(' '));
  }

  const stopWords = ['product', 'buy', 'price', 'store', 'online', 'shop', 'the', 'a', 'an'];
  const simplified = words.filter(w => !stopWords.includes(w.toLowerCase())).join(' ');
  if (simplified !== query) variations.push(simplified);

  return [...new Set(variations)];
}

// ========== AMAZON ==========
async function searchAmazon(query) {
  const url = `https://www.amazon.com/s?k=${encodeURIComponent(query)}&language=en_US`;
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate',
    },
    signal: AbortSignal.timeout(15000),
    redirect: 'follow',
  });

  if (!response.ok) {
    console.log('Amazon status:', response.status);
    return [];
  }

  const html = await response.text();
  const $ = cheerio.load(html);
  const results = [];

  // Amazon search results
  $('[data-component-type="s-search-result"]').each((i, el) => {
    if (i >= 6) return false;

    const titleEl = $(el).find('h2 a span, h2 span');
    const title = titleEl.text().trim();
    const linkEl = $(el).find('h2 a');
    const link = linkEl.attr('href') || '';
    const priceWhole = $(el).find('.a-price-whole').first().text().trim();
    const priceFraction = $(el).find('.a-price-fraction').first().text().trim();
    const imgEl = $(el).find('img.s-image');
    const image = imgEl.attr('src') || '';

    if (!title || title.length < 3) return;

    const fullLink = link.startsWith('http') ? link : `https://www.amazon.com${link}`;
    const price = priceWhole ? `$${priceWhole}${priceFraction ? '.' + priceFraction : ''}` : '';

    results.push({
      title: title.substring(0, 150),
      link: fullLink,
      snippet: price ? `Precio: ${price}` : '',
      image,
      source: 'Amazon',
      store: 'Amazon',
    });
  });

  return results;
}

// ========== MERCADOLIBRE ==========
async function searchMercadoLibre(query) {
  const url = `https://listado.mercadolibre.com.bo/${encodeURIComponent(query.replace(/\s+/g, '-'))}`;
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'text/html',
      'Accept-Language': 'es-BO,es;q=0.9',
    },
    signal: AbortSignal.timeout(15000),
    redirect: 'follow',
  });

  if (!response.ok) return [];

  const html = await response.text();
  const $ = cheerio.load(html);
  const results = [];

  $('.ui-search-layout__item').each((i, el) => {
    if (i >= 6) return false;

    const titleEl = $(el).find('.ui-search-item__title, .poly-component__title');
    const title = titleEl.text().trim();
    const linkEl = $(el).find('a');
    const link = linkEl.attr('href') || '';
    const priceEl = $(el).find('.andes-money-amount__fraction, .poly-price__current .andes-money-amount__fraction');
    const price = priceEl.text().trim();
    const imgEl = $(el).find('img').first();
    const image = imgEl.attr('src') || '';

    if (!title || !link || title.length < 3) return;

    results.push({
      title: title.substring(0, 150),
      link: link.startsWith('http') ? link : `https://www.mercadolibre.com.bo${link}`,
      snippet: price ? `Precio: Bs. ${price}` : '',
      image,
      source: 'MercadoLibre',
      store: 'MercadoLibre',
    });
  });

  return results;
}

// ========== GOOGLE CUSTOM SEARCH ==========
async function searchGoogleCustom(query) {
  const apiKey = process.env.GOOGLE_SEARCH_API_KEY;
  const cx = process.env.GOOGLE_SEARCH_ID;
  if (!apiKey || !cx || apiKey.startsWith('tu_')) return [];

  const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cx}&q=${encodeURIComponent(query + ' buy')}&num=8`;
  const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
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

function extractStore(url) {
  if (!url) return '';
  const lower = url.toLowerCase();
  const stores = {
    'amazon.': 'Amazon', 'walmart.': 'Walmart', 'ebay.': 'eBay',
    'mercadolibre': 'MercadoLibre', 'aliexpress.': 'AliExpress',
    'homedepot.': 'Home Depot', 'target.': 'Target', 'bestbuy.': 'Best Buy',
    'costco.': 'Costco', 'etsy.': 'Etsy', 'linio.': 'Linio',
    'falabella.': 'Falabella', 'ripley.': 'Ripley', 'paris.': 'Paris',
    'banggood.': 'Banggood',
  };
  for (const [domain, name] of Object.entries(stores)) {
    if (lower.includes(domain)) return name;
  }
  try {
    const hostname = new URL(url.startsWith('http') ? url : `https://${url}`).hostname;
    return hostname.replace('www.', '').split('.')[0];
  } catch (e) { return ''; }
}

module.exports = { searchProduct };
