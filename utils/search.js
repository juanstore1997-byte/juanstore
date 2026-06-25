const cheerio = require('cheerio');

async function searchProduct(query) {
  const cleanQuery = cleanOCRQuery(query);
  if (!cleanQuery || cleanQuery.length < 2) return { results: [] };

  console.log('Buscando:', cleanQuery);
  const results = [];
  const seen = new Set();

  // 1. Google Custom Search
  if (process.env.GOOGLE_SEARCH_API_KEY && !process.env.GOOGLE_SEARCH_API_KEY.startsWith('tu_')) {
    try {
      const googleResults = await searchGoogleCustom(cleanQuery);
      for (const r of googleResults) {
        const key = (r.title || '').toLowerCase().substring(0, 40);
        if (!seen.has(key)) { seen.add(key); results.push(r); }
      }
    } catch (e) { console.log('Google error:', e.message); }
  }

  // 2. Amazon search (solo títulos y links)
  try {
    const amazonResults = await searchAmazon(cleanQuery);
    for (const r of amazonResults) {
      const key = (r.title || '').toLowerCase().substring(0, 40);
      if (!seen.has(key)) { seen.add(key); results.push(r); }
    }
  } catch (e) { console.log('Amazon error:', e.message); }

  // 3. Obtener imagen REAL de cada producto (top 4)
  const toFetch = results.filter(r => r.link && !r.image).slice(0, 4);
  await Promise.all(toFetch.map(async (r) => {
    try {
      r.image = await getProductImage(r.link);
    } catch (e) { /* skip */ }
  }));

  // 4. Variaciones
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

async function getProductImage(productUrl) {
  const response = await fetch(productUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15',
      'Accept': 'text/html',
      'Accept-Language': 'en-US,en;q=0.9',
    },
    signal: AbortSignal.timeout(10000),
    redirect: 'follow',
  });
  if (!response.ok) return '';
  const html = await response.text();
  const $ = cheerio.load(html);

  // 1. og:image
  const og = $('meta[property="og:image"]').attr('content');
  if (og && og.startsWith('http') && !og.includes('grey-pixel')) return og;

  // 2. landingImage
  const landing = $('#landingImage').attr('src');
  if (landing && landing.startsWith('http') && !landing.includes('grey-pixel')) return landing;

  // 3. data-old-hires
  const hires = $('#landingImage').attr('data-old-hires');
  if (hires && hires.startsWith('http')) return hires;

  // 4. data-dynamic-image (JSON con URLs)
  const dynamic = $('#landingImage').attr('data-dynamic-image');
  if (dynamic) {
    try {
      const imgs = JSON.parse(dynamic);
      const urls = Object.keys(imgs);
      if (urls.length > 0) return urls[urls.length - 1]; // la más grande
    } catch (e) { /* skip */ }
  }

  return '';
}

function cleanOCRQuery(text) {
  if (!text) return '';
  return text.replace(/[^\w\s\-.:\/]/g, ' ').replace(/\b[A-Z]{5,}\b/g, '').replace(/\b[A-Z]*([A-Z])\1{2,}[A-Z]*\b/g, '').replace(/\s+/g, ' ').trim();
}

function buildSearchVariations(query) {
  const variations = [];
  const words = query.split(' ').filter(w => w.length > 1);
  const modelMatch = query.match(/[A-Z]-?\d{2,5}/i);
  if (modelMatch) { variations.push(modelMatch[0]); variations.push(`${modelMatch[0]} juicer`); }
  if (words.length > 3) variations.push(words.slice(0, 3).join(' '));
  const stopWords = ['product', 'buy', 'price', 'store', 'online', 'shop', 'the', 'a', 'an'];
  const simplified = words.filter(w => !stopWords.includes(w.toLowerCase())).join(' ');
  if (simplified !== query) variations.push(simplified);
  return [...new Set(variations)];
}

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
    $(el).find('a').each((j, aEl) => {
      const href = $(aEl).attr('href') || '';
      if (href.includes('/dp/') && !link) {
        link = href.startsWith('http') ? href : `https://www.amazon.com${href}`;
      }
    });
    results.push({ title: title.substring(0, 150), link, snippet: price ? `Precio: ${price}` : '', image: '', source: 'Amazon', store: 'Amazon' });
  });
  return results;
}

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
    title: item.title || '', link: item.link || '', snippet: item.snippet || '',
    image: item.pagemap?.cse_thumbnail?.[0]?.src || item.pagemap?.cse_image?.[0]?.src || '',
    source: extractStore(item.link), store: extractStore(item.link),
  }));
}

function extractStore(url) {
  if (!url) return '';
  const lower = url.toLowerCase();
  const stores = { 'amazon.': 'Amazon', 'ebay.': 'eBay', 'mercadolibre': 'MercadoLibre', 'aliexpress.': 'AliExpress', 'walmart.': 'Walmart' };
  for (const [d, n] of Object.entries(stores)) { if (lower.includes(d)) return n; }
  try { return new URL(url.startsWith('http') ? url : `https://${url}`).hostname.replace('www.', '').split('.')[0]; } catch (e) { return ''; }
}

module.exports = { searchProduct };
