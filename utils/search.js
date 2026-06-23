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

  // 2. Amazon mobile scraping (solo títulos, precios, links)
  try {
    const amazonResults = await searchAmazon(cleanQuery);
    for (const r of amazonResults) {
      const key = (r.title || '').toLowerCase().substring(0, 40);
      if (!seen.has(key)) { seen.add(key); results.push(r); }
    }
    console.log('Amazon:', amazonResults.length);
  } catch (e) { console.log('Amazon error:', e.message); }

  // 3. Agregar imágenes reales desde Bing para cada resultado
  for (const r of results.slice(0, 5)) {
    if (!r.image || r.image.includes('grey-pixel')) {
      try {
        const images = await searchBingImages(r.title);
        if (images.length > 0) {
          r.image = images[0];
        }
      } catch (e) { /* skip */ }
    }
  }

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

// ========== AMAZON (solo títulos y links) ==========
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

    // NO buscar imágenes aquí - usaremos Bing Images
    results.push({
      title: title.substring(0, 150),
      link,
      snippet: price ? `Precio: ${price}` : '',
      image: '', // Se llena después con Bing
      source: 'Amazon',
      store: 'Amazon',
    });
  });

  return results;
}

// ========== BING IMAGES ==========
async function searchBingImages(query) {
  try {
    const url = `https://www.bing.com/images/search?q=${encodeURIComponent(query)}&form=HDRSC3&first=1`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) return [];

    const html = await response.text();
    const $ = cheerio.load(html);
    const images = [];

    // Bing images - buscar en scripts JSON
    $('a.iusc').each((i, el) => {
      if (i >= 3) return false;
      try {
        const m = JSON.parse($(el).attr('m') || '{}');
        if (m.murl && m.murl.startsWith('http')) {
          images.push(m.murl);
        }
      } catch (e) { /* skip */ }
    });

    // Fallback: buscar img tags
    if (images.length === 0) {
      $('img.mimg').each((i, el) => {
        if (i >= 3) return false;
        const src = $(el).attr('src') || '';
        if (src.startsWith('http') && !src.includes('bing.com') && !src.includes('microsoft')) {
          images.push(src);
        }
      });
    }

    return images.slice(0, 3);
  } catch (e) {
    console.log('Bing Images error:', e.message);
    return [];
  }
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
  if (lower.includes('linio.')) return 'Linio';
  if (lower.includes('falabella.')) return 'Falabella';
  if (lower.includes('ripley.')) return 'Ripley';
  try {
    const hostname = new URL(url.startsWith('http') ? url : `https://${url}`).hostname;
    return hostname.replace('www.', '').split('.')[0];
  } catch (e) { return ''; }
}

module.exports = { searchProduct };
