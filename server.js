require('dotenv').config();

if (!process.env.JWT_SECRET) {
  console.error('ERROR: JWT_SECRET no está definido en .env');
  process.exit(1);
}

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const { initAdmin } = require('./db/database');
initAdmin();

const app = express();
const PORT = process.env.PORT || 3000;

// Crear directorio uploads si no existe
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// CORS configurado para producción
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(uploadsDir));

const authRoutes = require('./routes/auth');
app.use('/api/auth', authRoutes);

const productRoutes = require('./routes/products');
app.use('/api/products', productRoutes);
app.use(productRoutes.handleUploadError);

const recognitionRoutes = require('./routes/recognition');
app.use('/api/recognition', recognitionRoutes);

const paymentRoutes = require('./routes/payment');
app.use('/api/payment', paymentRoutes);

// Proxy de imágenes - fetch desde Amazon/externos y servir desde nuestro servidor
app.get('/api/proxy-image', async (req, res) => {
  const { url } = req.query;
  if (!url || !url.startsWith('http')) {
    return res.status(400).json({ error: 'URL requerida' });
  }
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15',
        'Accept': 'image/*',
        'Referer': 'https://www.amazon.com/',
      },
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) return res.status(response.status).send('Image fetch failed');
    const contentType = response.headers.get('content-type') || 'image/jpeg';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    const buffer = await response.arrayBuffer();
    res.send(Buffer.from(buffer));
  } catch (err) {
    console.log('Proxy image error:', err.message);
    res.status(500).send('Proxy error');
  }
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
