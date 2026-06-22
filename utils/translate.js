const cheerio = require('cheerio');

async function translateToSpanish(text) {
  if (!text || text.length < 3) return text;
  
  // Don't translate if already mostly Spanish
  const spanishChars = (text.match(/[áéíóúñ¿¡]/g) || []).length;
  if (spanishChars > text.length * 0.05) return text;
  
  try {
    const encoded = encodeURIComponent(text);
    const res = await fetch(
      `https://api.mymemory.translated.net/get?q=${encoded}&langpair=en|es`,
      { signal: AbortSignal.timeout(8000) }
    );
    const data = await res.json();
    if (data.responseStatus === 200 && data.responseData?.translatedText) {
      const translated = data.responseData.translatedText;
      // MyMemory sometimes returns the original if it can't translate
      if (translated.toLowerCase() !== text.toLowerCase()) {
        return translated;
      }
    }
  } catch (e) {
    console.log('Translation error:', e.message);
  }
  return text;
}

async function translateProduct(product) {
  const translated = { ...product };
  
  if (product.title) {
    translated.title = await translateToSpanish(product.title);
  }
  if (product.snippet) {
    translated.snippet = await translateToSpanish(product.snippet);
  }
  
  return translated;
}

async function searchProductImages(query) {
  try {
    const encoded = encodeURIComponent(query);
    const res = await fetch(
      `https://www.bing.com/images/search?q=${encoded}&form=HDRSC3&first=1`,
      {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
        signal: AbortSignal.timeout(10000),
      }
    );
    const html = await res.text();
    const $ = cheerio.load(html);
    
    const images = [];
    $('img.mimg').each((i, el) => {
      const src = $(el).attr('src');
      if (src && src.startsWith('http') && !src.includes('bing.com') && !src.includes('microsoft')) {
        images.push(src);
      }
    });
    
    return images.slice(0, 5);
  } catch (e) {
    console.log('Image search error:', e.message);
    return [];
  }
}

module.exports = { translateToSpanish, translateProduct, searchProductImages };
