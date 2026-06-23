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

  // 2. Amazon mobile scraping
  try {
    const amazonResults = await searchAmazon(cleanQuery);
    for (const r of amazonResults) {
      const key = (r.title || '').toLowerCase().substring(0, 40);
      if (!seen.has(key)) { seen.add(key); results.push(r); }
    }
    console.log('Amazon:', amazonResults.length);
  } catch (e) { console.log('Amazon error:', e.message); }

  // 3. Variaciones si hay pocos resultados
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
      'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
      'Accept': 'text/html',
      'Accept-Language': 'en-US,en;q=0.9',
    },
    signal: AbortSignal.timeout(15000),
    redirect: 'follow',
  });

  if (!response.ok) return [];

  const html = await response.text();
  const $ = cheerio.load(html);
  const results = [];

  $('[data-component-type="s-search-result"]').each((i, el) => {
    if (i >= 6) return false;

    const title = $(el).find('h2 span').text().trim();
    if (!title || title.length < 3) return;

    const price = $(el).find('.a-price .a-offscreen').first().text().trim();

    let link = '';
    let asin = '';
    $(el).find('a').each((j, aEl) => {
      const href = $(aEl).attr('href') || '';
      if (href.includes('/dp/') && !link) {
        link = href.startsWith('http') ? href : `https://www.amazon.com${href}`;
        // Extraer ASIN del link
        const asinMatch = href.match(/\/dp\/([A-Z0-9]{10})/);
        if (asinMatch) asin = asinMatch[1];
      }
    });

    // Construir imagen directamente con el ASIN
    const image = asin ? `https://m.media-amazon.com/images/P/${asin}.01._SCLZZZZZZZ_SX300_.jpg` : '';

    results.push({
      title: title.substring(0, 150),
      link,
      snippet: price ? `Precio: ${price}` : '',
      image,
      source: 'Amazon',
      store: 'Amazon',
      asin,
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
  if (lower.includes('amazon.')) return 'Amazon';
  if (lower.includes('mercadolibre')) return 'MercadoLibre';
  if (lower.includes('ebay.')) return 'eBay';
  if (lower.includes('aliexpress.')) return 'AliExpress';
  if (lower.includes('walmart.')) return 'Walmart';
  if (lower.includes('bestbuy.')) return 'Best Buy';
  if (lower.includes('target.')) return 'Target';
  if (lower.includes('etsy.')) return 'Etsy';
  try {
    const hostname = new URL(url.startsWith('http') ? url : `https://${url}`).hostname;
    return hostname.replace('www.', '').split('.')[0];
  } catch (e) { return ''; }
}

module.exports = { searchProduct };
