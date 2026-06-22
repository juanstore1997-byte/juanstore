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
      console.log('Google results:', googleResults.length);
    } catch (e) { console.log('Google error:', e.message); }
  }

  // 2. DuckDuckGo lite
  if (results.length < 3) {
    try {
      const ddg = await searchDuckDuckGoLite(cleanQuery);
      for (const r of ddg) {
        const key = (r.title || '').toLowerCase().substring(0, 40);
        if (!seen.has(key)) { seen.add(key); results.push(r); }
      }
      console.log('DDG lite results:', ddg.length);
    } catch (e) { console.log('DDG lite error:', e.message); }
  }

  // 3. Bing scraping
  if (results.length < 3) {
    try {
      const bing = await searchBing(cleanQuery);
      for (const r of bing) {
        const key = (r.title || '').toLowerCase().substring(0, 40);
        if (!seen.has(key)) { seen.add(key); results.push(r); }
      }
      console.log('Bing results:', bing.length);
    } catch (e) { console.log('Bing error:', e.message); }
  }

  // 4. Variaciones del query
  if (results.length < 3) {
    const variations = buildSearchVariations(cleanQuery);
    for (const v of variations) {
      try {
        const extra = await searchDuckDuckGoLite(v);
        for (const r of extra) {
          const key = (r.title || '').toLowerCase().substring(0, 40);
          if (!seen.has(key)) { seen.add(key); results.push(r); }
        }
      } catch (e) { /* skip */ }
      if (results.length >= 6) break;
    }
  }

  console.log('Total resultados:', results.length);
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

  // Modelo directo
  const modelMatch = query.match(/[A-Z]-?\d{2,5}/i);
  if (modelMatch) {
    variations.push(modelMatch[0]);
    variations.push(`${modelMatch[0]} juicer`);
    variations.push(`${modelMatch[0]} product`);
  }

  // Primeras 3 palabras
  if (words.length > 3) {
    variations.push(words.slice(0, 3).join(' '));
  }

  // Con "buy"
  variations.push(`${query} buy online`);

  // Sin palabras stop
  const stopWords = ['product', 'buy', 'price', 'store', 'online', 'shop', 'the', 'a', 'an'];
  const simplified = words.filter(w => !stopWords.includes(w.toLowerCase())).join(' ');
  if (simplified !== query) variations.push(simplified);

  return [...new Set(variations)];
}

async function searchGoogleCustom(query) {
  const apiKey = process.env.GOOGLE_SEARCH_API_KEY;
  const cx = process.env.GOOGLE_SEARCH_ID;
  if (!apiKey || !cx || apiKey.startsWith('tu_')) return [];

  const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cx}&q=${encodeURIComponent(query)}&num=8`;
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

async function searchDuckDuckGoLite(query) {
  // Usar DuckDuckGo lite (más simple, menos bloqueos)
  const url = `https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(query + ' buy')}`;
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'text/html',
    },
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) return [];
  const html = await response.text();
  const $ = cheerio.load(html);
  const results = [];

  // DuckDuckGo lite usa tablas
  $('td a.result-link').each((i, el) => {
    if (i >= 8) return false;
    const title = $(el).text().trim();
    let link = $(el).attr('href') || '';

    if (link.includes('uddg=')) {
      try {
        const u = new URL(link, 'https://duckduckgo.com');
        link = decodeURIComponent(u.searchParams.get('uddg') || link);
      } catch (e) { /* keep */ }
    }

    if (!title || title.length < 3) return;

    const snippet = $(el).closest('tr').next('tr').text().trim().substring(0, 300);
    const store = extractStore(link);

    results.push({ title: title.substring(0, 150), link, snippet, image: '', source: store || 'web', store });
  });

  // Fallback: buscar en enlaces normales
  if (results.length === 0) {
    $('a[href]').each((i, el) => {
      if (results.length >= 8) return false;
      const title = $(el).text().trim();
      const link = $(el).attr('href') || '';
      if (title.length > 5 && link.startsWith('http') && !link.includes('duckduckgo')) {
        const store = extractStore(link);
        results.push({ title: title.substring(0, 150), link, snippet: '', image: '', source: store || 'web', store });
      }
    });
  }

  return results;
}

async function searchBing(query) {
  const url = `https://www.bing.com/search?q=${encodeURIComponent(query + ' buy price')}&setlang=en`;
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
  const results = [];

  $('li.b_algo').each((i, el) => {
    if (i >= 8) return false;
    const titleEl = $(el).find('h2 a');
    const title = titleEl.text().trim();
    const link = titleEl.attr('href') || '';
    const snippet = $(el).find('.b_caption p').text().trim();

    if (!title || !link || link.startsWith('/')) return;

    const store = extractStore(link);
    results.push({ title: title.substring(0, 150), link, snippet: snippet.substring(0, 300), image: '', source: store || 'web', store });
  });

  return results;
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
