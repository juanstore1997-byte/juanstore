# Tienda de Productos con Reconocimiento IA - Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a web app where an admin uploads product photos, AI identifies them, searches for characteristics online, sets prices, and customers buy via QR payment with receipt verification.

**Architecture:** Node.js + Express backend serving static HTML/CSS/JS frontend. SQLite database. Google Gemini for image analysis, Google Custom Search for product lookup, Telegram Bot for notifications.

**Tech Stack:** Node.js, Express, SQLite3 (better-sqlite3), Google Gemini API, Google Custom Search API, Telegram Bot API, bcrypt, JWT, multer (file uploads), qrcode (QR generation)

---

## Task 1: Project Setup & Dependencies

**Files:**
- Create: `package.json`
- Create: `.env`
- Create: `.env.example`
- Create: `.gitignore`
- Create: `server.js`

- [ ] **Step 1: Initialize project and install dependencies**

Run in `C:\proyecto\PAGINA WEB JUAN`:
```bash
npm init -y
npm install express better-sqlite3 bcryptjs jsonwebtoken multer dotenv cors qrcode
npm install --save-dev nodemon
```

- [ ] **Step 2: Create .env file**

Create `.env`:
```
PORT=3000
JWT_SECRET=cambia_este_secreto_por_algo_largo_y_aleatorio
GEMINI_API_KEY=tu_api_key_de_gemini_aqui
GOOGLE_SEARCH_API_KEY=tu_api_key_de_google_search_aqui
GOOGLE_SEARCH_ID=tu_cx_de_google_search_aqui
TELEGRAM_BOT_TOKEN=tu_token_de_telegram_bot_aqui
TELEGRAM_CHAT_ID=tu_chat_id_aqui
ADMIN_USER=admin
ADMIN_PASS=admin123
```

- [ ] **Step 3: Create .env.example**

Create `.env.example` (same as .env but with placeholder values):
```
PORT=3000
JWT_SECRET=your_secret_here
GEMINI_API_KEY=your_gemini_key
GOOGLE_SEARCH_API_KEY=your_google_key
GOOGLE_SEARCH_ID=your_cx_id
TELEGRAM_BOT_TOKEN=your_telegram_token
TELEGRAM_CHAT_ID=your_chat_id
ADMIN_USER=admin
ADMIN_PASS=changeme
```

- [ ] **Step 4: Create .gitignore**

Create `.gitignore`:
```
node_modules/
.env
*.db
```

- [ ] **Step 5: Create server.js (minimal)**

Create `server.js`:
```javascript
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
```

- [ ] **Step 6: Verify server starts**

Run:
```bash
node server.js
```
Expected: "Servidor corriendo en http://localhost:3000"
Then Ctrl+C to stop.

- [ ] **Step 7: Commit**

```bash
git init
git add .
git commit -m "feat: project setup with dependencies and basic server"
```

---

## Task 2: Database Setup

**Files:**
- Create: `db/database.js`

- [ ] **Step 1: Create database.js**

Create `db/database.js`:
```javascript
const Database = require('better-sqlite3');
const path = require('path');
const bcrypt = require('bcryptjs');

const db = new Database(path.join(__dirname, '..', 'tienda.db'));

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS productos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    descripcion TEXT,
    marca TEXT,
    categoria TEXT,
    color TEXT,
    material TEXT,
    caracteristicas TEXT,
    precio_original REAL,
    precio_venta REAL,
    foto_url TEXT,
    foto_gemini TEXT,
    fuente TEXT,
    link_original TEXT,
    estado TEXT DEFAULT 'borrador',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS ventas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    producto_id INTEGER NOT NULL,
    cliente_nombre TEXT,
    cliente_telefono TEXT,
    cliente_ci TEXT,
    monto REAL NOT NULL,
    comprobante_url TEXT,
    banco TEXT,
    comprobante_verificado BOOLEAN DEFAULT 0,
    comprobante_rechazado BOOLEAN DEFAULT 0,
    motivo_rechazo TEXT,
    estado TEXT DEFAULT 'pendiente',
    notificado_telegram BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (producto_id) REFERENCES productos(id)
  );

  CREATE TABLE IF NOT EXISTS admin (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

function initAdmin() {
  const existing = db.prepare('SELECT id FROM admin LIMIT 1').get();
  if (!existing) {
    const user = process.env.ADMIN_USER || 'admin';
    const pass = process.env.ADMIN_PASS || 'admin123';
    const hash = bcrypt.hashSync(pass, 10);
    db.prepare('INSERT INTO admin (usuario, password_hash) VALUES (?, ?)').run(user, hash);
    console.log(`Admin creado: ${user}`);
  }
}

module.exports = { db, initAdmin };
```

- [ ] **Step 2: Test database creation**

Add to bottom of `server.js` temporarily:
```javascript
const { initAdmin } = require('./db/database');
initAdmin();
```

Run `node server.js`, verify "Admin creado: admin" appears. Remove the test lines after.

- [ ] **Step 3: Commit**

```bash
git add db/
git commit -m "feat: add SQLite database with products, sales, and admin tables"
```

---

## Task 3: Auth Middleware & Login Route

**Files:**
- Create: `middleware/auth.js`
- Create: `routes/auth.js`

- [ ] **Step 1: Create auth middleware**

Create `middleware/auth.js`:
```javascript
const jwt = require('jsonwebtoken');

function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No autorizado' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.admin = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token inválido' });
  }
}

module.exports = authMiddleware;
```

- [ ] **Step 2: Create auth routes**

Create `routes/auth.js`:
```javascript
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { db } = require('../db/database');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

router.post('/login', (req, res) => {
  const { usuario, password } = req.body;

  if (!usuario || !password) {
    return res.status(400).json({ error: 'Usuario y contraseña requeridos' });
  }

  const admin = db.prepare('SELECT * FROM admin WHERE usuario = ?').get(usuario);

  if (!admin || !bcrypt.compareSync(password, admin.password_hash)) {
    return res.status(401).json({ error: 'Credenciales incorrectas' });
  }

  const token = jwt.sign(
    { id: admin.id, usuario: admin.usuario },
    process.env.JWT_SECRET,
    { expiresIn: '24h' }
  );

  res.json({ token, usuario: admin.usuario });
});

router.get('/verify', authMiddleware, (req, res) => {
  res.json({ valid: true, admin: req.admin });
});

module.exports = router;
```

- [ ] **Step 3: Update server.js to use auth routes**

Edit `server.js` to add after the existing middleware lines:
```javascript
const authRoutes = require('./routes/auth');
app.use('/api/auth', authRoutes);
```

- [ ] **Step 4: Test login**

Run server, then:
```bash
curl -X POST http://localhost:3000/api/auth/login -H "Content-Type: application/json" -d "{\"usuario\":\"admin\",\"password\":\"admin123\"}"
```
Expected: JSON with `token` field.

- [ ] **Step 5: Commit**

```bash
git add middleware/ routes/auth.js
git commit -m "feat: add auth middleware and login endpoint"
```

---

## Task 4: Products CRUD API

**Files:**
- Create: `routes/products.js`
- Create: `public/index.html` (placeholder)
- Create: `public/admin.html` (placeholder)
- Create: `public/login.html` (placeholder)

- [ ] **Step 1: Create products routes**

Create `routes/products.js`:
```javascript
const express = require('express');
const { db } = require('../db/database');
const authMiddleware = require('../middleware/auth');
const multer = require('multer');
const path = require('path');

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '..', 'public', 'uploads')),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname.replace(/\s+/g, '-'))
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|webp/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    const mime = allowed.test(file.mimetype);
    cb(null, ext && mime);
  }
});

// Public: get all published products
router.get('/', (req, res) => {
  const products = db.prepare('SELECT * FROM productos WHERE estado = ? ORDER BY created_at DESC').all('publicado');
  res.json(products);
});

// Public: get single product
router.get('/:id', (req, res) => {
  const product = db.prepare('SELECT * FROM productos WHERE id = ?').get(req.params.id);
  if (!product) return res.status(404).json({ error: 'Producto no encontrado' });
  res.json(product);
});

// Admin: get all products (any status)
router.get('/admin/all', authMiddleware, (req, res) => {
  const products = db.prepare('SELECT * FROM productos ORDER BY created_at DESC').all();
  res.json(products);
});

// Admin: create product
router.post('/', authMiddleware, upload.single('foto'), (req, res) => {
  const { nombre, descripcion, marca, categoria, color, material, caracteristicas, precio_original, precio_venta, fuente, link_original, foto_gemini, estado } = req.body;

  if (!nombre) return res.status(400).json({ error: 'Nombre requerido' });

  const foto_url = req.file ? `/uploads/${req.file.filename}` : null;

  const result = db.prepare(`
    INSERT INTO productos (nombre, descripcion, marca, categoria, color, material, caracteristicas, precio_original, precio_venta, foto_url, foto_gemini, fuente, link_original, estado)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(nombre, descripcion, marca, categoria, color, material, caracteristicas, precio_original, precio_venta, foto_url, foto_gemini, fuente, link_original, estado || 'borrador');

  const product = db.prepare('SELECT * FROM productos WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(product);
});

// Admin: update product
router.put('/:id', authMiddleware, upload.single('foto'), (req, res) => {
  const existing = db.prepare('SELECT * FROM productos WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Producto no encontrado' });

  const { nombre, descripcion, marca, categoria, color, material, caracteristicas, precio_original, precio_venta, fuente, link_original, foto_gemini, estado } = req.body;

  const foto_url = req.file ? `/uploads/${req.file.filename}` : existing.foto_url;

  db.prepare(`
    UPDATE productos SET nombre=?, descripcion=?, marca=?, categoria=?, color=?, material=?, caracteristicas=?, precio_original=?, precio_venta=?, foto_url=?, foto_gemini=?, fuente=?, link_original=?, estado=?, updated_at=CURRENT_TIMESTAMP
    WHERE id=?
  `).run(nombre || existing.nombre, descripcion ?? existing.descripcion, marca ?? existing.marca, categoria ?? existing.categoria, color ?? existing.color, material ?? existing.material, caracteristicas ?? existing.caracteristicas, precio_original ?? existing.precio_original, precio_venta ?? existing.precio_venta, foto_url, foto_gemini ?? existing.foto_gemini, fuente ?? existing.fuente, link_original ?? existing.link_original, estado || existing.estado, req.params.id);

  const product = db.prepare('SELECT * FROM productos WHERE id = ?').get(req.params.id);
  res.json(product);
});

// Admin: delete product
router.delete('/:id', authMiddleware, (req, res) => {
  const existing = db.prepare('SELECT * FROM productos WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Producto no encontrado' });

  db.prepare('DELETE FROM productos WHERE id = ?').run(req.params.id);
  res.json({ deleted: true });
});

module.exports = router;
```

- [ ] **Step 2: Create uploads directory**

```bash
mkdir public/uploads
```

- [ ] **Step 3: Create placeholder HTML files**

Create minimal `public/login.html`, `public/admin.html`, `public/index.html` with just a heading each (we'll build the real UI later).

- [ ] **Step 4: Update server.js to use products routes**

Add to `server.js`:
```javascript
const productRoutes = require('./routes/products');
app.use('/api/products', productRoutes);
```

- [ ] **Step 5: Test CRUD**

Run server, test:
```bash
# Create
curl -X POST http://localhost:3000/api/products -H "Authorization: Bearer TOKEN" -F "nombre=Test Product" -F "precio_venta=25"
# List
curl http://localhost:3000/api/products
```

- [ ] **Step 6: Commit**

```bash
git add routes/products.js public/
git commit -m "feat: add products CRUD API with file upload"
```

---

## Task 5: Google Gemini Utility (Image Recognition)

**Files:**
- Create: `utils/gemini.js`
- Create: `routes/recognition.js`

- [ ] **Step 1: Create gemini utility**

Create `utils/gemini.js`:
```javascript
const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function analyzeProductImage(imageBuffer) {
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

  const imagePart = {
    inlineData: {
      data: imageBuffer.toString('base64'),
      mimeType: 'image/jpeg'
    }
  };

  const prompt = `Analiza esta foto de un producto e identifica:
- Marca
- Nombre del producto
- Categoría (ropa, calzado, accesorios, electrónica, etc.)
- Color
- Material (si es visible)
- Características destacadas
- Posible tienda de origen (Amazon, MercadoLibre, etc.)

Responde SOLO con un JSON válido con estos campos: marca, nombre, categoria, color, material, caracteristicas (array), fuente. Sin texto adicional.`;

  const result = await model.generateContent([prompt, imagePart]);
  const response = result.response;
  const text = response.text();

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return { error: 'No se pudo parsear la respuesta', raw: text };
  } catch (e) {
    return { error: 'Error parseando JSON', raw: text };
  }
}

async function verifyPaymentReceipt(imageBuffer, expectedAmount) {
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

  const imagePart = {
    inlineData: {
      data: imageBuffer.toString('base64'),
      mimeType: 'image/jpeg'
    }
  };

  const prompt = `Analiza esta imagen de un comprobante de pago bancario de Bolivia. Verifica:
1. ¿Es de un banco boliviano reconocido? (BCP, Unocero, Fassil, Mercantil, Nacional, Económico, BNB, ProCredit)
2. ¿El monto coincide con ${expectedAmount} USD o su equivalente en bolivianos?
3. ¿La fecha es reciente (últimas 24 horas)?
4. ¿Se lee algún nombre o número de cuenta?

Responde SOLO con un JSON válido: { "banco": "nombre del banco o desconocido", "monto_detectado": número, "fecha": "string", "es_valido": boolean, "observaciones": "string" }. Sin texto adicional.`;

  const result = await model.generateContent([prompt, imagePart]);
  const response = result.response;
  const text = response.text();

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return { error: 'No se pudo parsear la respuesta', raw: text };
  } catch (e) {
    return { error: 'Error parseando JSON', raw: text };
  }
}

module.exports = { analyzeProductImage, verifyPaymentReceipt };
```

- [ ] **Step 2: Install Gemini SDK**

```bash
npm install @google/generative-ai
```

- [ ] **Step 3: Create recognition route**

Create `routes/recognition.js`:
```javascript
const express = require('express');
const multer = require('multer');
const path = require('path');
const { analyzeProductImage } = require('../utils/gemini');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|webp/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    const mime = allowed.test(file.mimetype);
    cb(null, ext && mime);
  }
});

router.post('/analyze', authMiddleware, upload.single('foto'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Imagen requerida' });
  }

  try {
    const result = await analyzeProductImage(req.file.buffer);
    res.json(result);
  } catch (err) {
    console.error('Error en análisis:', err);
    res.status(500).json({ error: 'Error analizando la imagen' });
  }
});

module.exports = router;
```

- [ ] **Step 4: Update server.js**

Add to `server.js`:
```javascript
const recognitionRoutes = require('./routes/recognition');
app.use('/api/recognition', recognitionRoutes);
```

- [ ] **Step 5: Commit**

```bash
git add utils/gemini.js routes/recognition.js
git commit -m "feat: add Gemini AI for product recognition and receipt verification"
```

---

## Task 6: Google Custom Search Utility

**Files:**
- Create: `utils/search.js`

- [ ] **Step 1: Create search utility**

Create `utils/search.js`:
```javascript
async function searchProduct(query) {
  const apiKey = process.env.GOOGLE_SEARCH_API_KEY;
  const cx = process.env.GOOGLE_SEARCH_ID;

  if (!apiKey || !cx) {
    return { error: 'Google Search API no configurada', results: [] };
  }

  const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cx}&q=${encodeURIComponent(query)}&num=5`;

  try {
    const response = await fetch(url);
    const data = await response.json();

    if (!data.items) {
      return { results: [], total: 0 };
    }

    return {
      results: data.items.map(item => ({
        title: item.title,
        link: item.link,
        snippet: item.snippet,
        source: item.displayLink
      })),
      total: data.searchInformation?.totalResults || 0
    };
  } catch (err) {
    console.error('Error en búsqueda:', err);
    return { error: 'Error realizando búsqueda', results: [] };
  }
}

module.exports = { searchProduct };
```

- [ ] **Step 2: Add search endpoint to recognition route**

Edit `routes/recognition.js` to add after the analyze endpoint:
```javascript
const { searchProduct } = require('../utils/search');

router.post('/search', authMiddleware, async (req, res) => {
  const { query } = req.body;

  if (!query) {
    return res.status(400).json({ error: 'Query requerido' });
  }

  try {
    const results = await searchProduct(query);
    res.json(results);
  } catch (err) {
    console.error('Error en búsqueda:', err);
    res.status(500).json({ error: 'Error realizando búsqueda' });
  }
});
```

- [ ] **Step 3: Commit**

```bash
git add utils/search.js
git commit -m "feat: add Google Custom Search for product lookup"
```

---

## Task 7: Telegram Bot Utility

**Files:**
- Create: `utils/telegram.js`

- [ ] **Step 1: Create telegram utility**

Create `utils/telegram.js`:
```javascript
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

async function sendTelegramMessage(text, imagePath = null) {
  if (!BOT_TOKEN || !CHAT_ID) {
    console.log('Telegram no configurado, mensaje:', text);
    return { ok: false, reason: 'not_configured' };
  }

  const baseUrl = `https://api.telegram.org/bot${BOT_TOKEN}`;

  try {
    if (imagePath) {
      const FormData = (await import('formdata-node')).FormData;
      const fs = require('fs');
      const form = new FormData();
      form.append('chat_id', CHAT_ID);
      form.append('caption', text);
      form.append('photo', fs.createReadStream(imagePath));

      const response = await fetch(`${baseUrl}/sendPhoto`, {
        method: 'POST',
        body: form
      });
      return await response.json();
    } else {
      const response = await fetch(`${baseUrl}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: CHAT_ID, text })
      });
      return await response.json();
    }
  } catch (err) {
    console.error('Error enviando Telegram:', err);
    return { ok: false, error: err.message };
  }
}

async function notifyNewSale(product, venta, verificationResult) {
  const text = `🔔 ¡NUEVA VENTA!

Producto: ${product.nombre}
Precio: $${product.precio_venta} USD
Cliente: ${venta.cliente_nombre || 'No especificado'}
Teléfono: ${venta.cliente_telefono || 'No especificado'}
CI: ${venta.cliente_ci || 'No especificado'}

Banco: ${verificationResult?.banco || 'No detectado'}
Monto: ${verificationResult?.monto_detectado || 'No detectado'}
Válido: ${verificationResult?.es_valido ? '✅' : '❌'}

Estado: Pendiente aprobación
ID Venta: #${venta.id}`;

  return await sendTelegramMessage(text, venta.comprobante_url);
}

async function notifySaleApproved(venta, product) {
  const text = `✅ VENTA APROBADA

Producto: ${product.nombre}
Cliente: ${venta.cliente_nombre}
Monto: $${venta.monto} USD
ID: #${venta.id}`;

  return await sendTelegramMessage(text);
}

async function notifySaleRejected(venta, product, motivo) {
  const text = `❌ VENTA RECHAZADA

Producto: ${product.nombre}
Cliente: ${venta.cliente_nombre}
Motivo: ${motivo}
ID: #${venta.id}`;

  return await sendTelegramMessage(text);
}

module.exports = { sendTelegramMessage, notifyNewSale, notifySaleApproved, notifySaleRejected };
```

- [ ] **Step 2: Commit**

```bash
git add utils/telegram.js
git commit -m "feat: add Telegram bot notifications for sales"
```

---

## Task 8: Payment & Sales API

**Files:**
- Create: `routes/payment.js`

- [ ] **Step 1: Create payment routes**

Create `routes/payment.js`:
```javascript
const express = require('express');
const multer = require('multer');
const path = require('path');
const QRCode = require('qrcode');
const { db } = require('../db/database');
const authMiddleware = require('../middleware/auth');
const { verifyPaymentReceipt } = require('../utils/gemini');
const { notifyNewSale, notifySaleApproved, notifySaleRejected } = require('../utils/telegram');

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '..', 'public', 'uploads')),
  filename: (req, file, cb) => cb(null, 'comprobante-' + Date.now() + '-' + file.originalname.replace(/\s+/g, '-'))
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|webp/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    const mime = allowed.test(file.mimetype);
    cb(null, ext && mime);
  }
});

// Generate QR for a product
router.get('/qr/:productoId', async (req, res) => {
  const product = db.prepare('SELECT * FROM productos WHERE id = ?').get(req.params.productoId);
  if (!product) return res.status(404).json({ error: 'Producto no encontrado' });

  const paymentData = {
    producto: product.nombre,
    monto: product.precio_venta,
    moneda: 'USD',
    titular: 'Tu Nombre',
    ci: 'Tu CI',
    banco: 'BCP'
  };

  try {
    const qr = await QRCode.toDataURL(JSON.stringify(paymentData), { width: 300 });
    res.json({ qr, data: paymentData });
  } catch (err) {
    res.status(500).json({ error: 'Error generando QR' });
  }
});

// Client submits purchase intent
router.post('/comprar', (req, res) => {
  const { producto_id, cliente_nombre, cliente_telefono, cliente_ci } = req.body;

  if (!producto_id) return res.status(400).json({ error: 'Producto requerido' });

  const product = db.prepare('SELECT * FROM productos WHERE id = ? AND estado = ?').get(producto_id, 'publicado');
  if (!product) return res.status(404).json({ error: 'Producto no encontrado o no disponible' });

  const result = db.prepare(`
    INSERT INTO ventas (producto_id, cliente_nombre, cliente_telefono, cliente_ci, monto, estado)
    VALUES (?, ?, ?, ?, ?, 'pendiente')
  `).run(producto_id, cliente_nombre, cliente_telefono, cliente_ci, product.precio_venta);

  const venta = db.prepare('SELECT * FROM ventas WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(venta);
});

// Client uploads payment receipt
router.post('/comprobante/:ventaId', upload.single('comprobante'), async (req, res) => {
  const venta = db.prepare('SELECT * FROM ventas WHERE id = ?').get(req.params.ventaId);
  if (!venta) return res.status(404).json({ error: 'Venta no encontrada' });

  if (!req.file) return res.status(400).json({ error: 'Comprobante requerido' });

  const comprobanteUrl = `/uploads/${req.file.filename}`;

  db.prepare('UPDATE ventas SET comprobante_url = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run(comprobanteUrl, req.params.ventaId);

  const product = db.prepare('SELECT * FROM productos WHERE id = ?').get(venta.producto_id);

  // Verify with AI
  try {
    const verification = await verifyPaymentReceipt(req.file.buffer, product.precio_venta);

    const esValido = verification.es_valido ? 1 : 0;
    const banco = verification.banco || 'No detectado';

    db.prepare(`
      UPDATE ventas
      SET comprobante_verificado = ?, banco = ?, estado = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(esValido, banco, esValido ? 'verificado' : 'pendiente', req.params.ventaId);

    const updatedVenta = db.prepare('SELECT * FROM ventas WHERE id = ?').get(req.params.ventaId);

    // Notify Telegram
    await notifyNewSale(product, updatedVenta, verification);

    res.json({ venta: updatedVenta, verification });
  } catch (err) {
    console.error('Error verificando comprobante:', err);
    res.status(500).json({ error: 'Error verificando comprobante' });
  }
});

// Admin: approve sale
router.post('/aprobar/:ventaId', authMiddleware, async (req, res) => {
  const venta = db.prepare('SELECT * FROM ventas WHERE id = ?').get(req.params.ventaId);
  if (!venta) return res.status(404).json({ error: 'Venta no encontrada' });

  db.prepare(`
    UPDATE ventas SET estado = 'aprobada', updated_at = CURRENT_TIMESTAMP WHERE id = ?
  `).run(req.params.ventaId);

  db.prepare(`
    UPDATE productos SET estado = 'vendido', updated_at = CURRENT_TIMESTAMP WHERE id = ?
  `).run(venta.producto_id);

  const product = db.prepare('SELECT * FROM productos WHERE id = ?').get(venta.producto_id);
  const updatedVenta = db.prepare('SELECT * FROM ventas WHERE id = ?').get(req.params.ventaId);

  await notifySaleApproved(updatedVenta, product);

  res.json(updatedVenta);
});

// Admin: reject sale
router.post('/rechazar/:ventaId', authMiddleware, async (req, res) => {
  const { motivo } = req.body;
  const venta = db.prepare('SELECT * FROM ventas WHERE id = ?').get(req.params.ventaId);
  if (!venta) return res.status(404).json({ error: 'Venta no encontrada' });

  db.prepare(`
    UPDATE ventas SET estado = 'rechazada', motivo_rechazo = ?, comprobante_rechazado = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?
  `).run(motivo || 'No especificado', req.params.ventaId);

  const product = db.prepare('SELECT * FROM productos WHERE id = ?').get(venta.producto_id);
  await notifySaleRejected(venta, product, motivo);

  const updatedVenta = db.prepare('SELECT * FROM ventas WHERE id = ?').get(req.params.ventaId);
  res.json(updatedVenta);
});

// Admin: get all sales
router.get('/admin/ventas', authMiddleware, (req, res) => {
  const ventas = db.prepare(`
    SELECT v.*, p.nombre as producto_nombre, p.foto_url as producto_foto, p.precio_venta
    FROM ventas v
    JOIN productos p ON v.producto_id = p.id
    ORDER BY v.created_at DESC
  `).all();
  res.json(ventas);
});

module.exports = router;
```

- [ ] **Step 2: Update server.js**

Add to `server.js`:
```javascript
const paymentRoutes = require('./routes/payment');
app.use('/api/payment', paymentRoutes);
```

- [ ] **Step 3: Commit**

```bash
git add routes/payment.js
git commit -m "feat: add payment API with QR generation, receipt upload, and AI verification"
```

---

## Task 9: Public Catalog UI (index.html)

**Files:**
- Create: `public/index.html`
- Create: `public/css/style.css`
- Create: `public/js/app.js`

- [ ] **Step 1: Create style.css**

Create `public/css/style.css` with a clean, mobile-first design for a product catalog. Include:
- Responsive grid layout
- Product cards with images
- Mobile-friendly typography
- WhatsApp green color accent (#25D366)
- Buy button styling

```css
* { margin: 0; padding: 0; box-sizing: border-box; }

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: #f5f5f5;
  color: #333;
}

.header {
  background: #25D366;
  color: white;
  padding: 1rem;
  text-align: center;
  position: sticky;
  top: 0;
  z-index: 100;
}

.header h1 { font-size: 1.5rem; }

.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 1rem;
}

.productos-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1rem;
}

.producto-card {
  background: white;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  transition: transform 0.2s;
  cursor: pointer;
}

.producto-card:hover { transform: translateY(-4px); }

.producto-card img {
  width: 100%;
  height: 250px;
  object-fit: cover;
}

.producto-info {
  padding: 1rem;
}

.producto-marca {
  color: #25D366;
  font-size: 0.85rem;
  font-weight: 600;
  text-transform: uppercase;
}

.producto-nombre {
  font-size: 1.1rem;
  margin: 0.3rem 0;
}

.producto-precio {
  font-size: 1.3rem;
  font-weight: 700;
  color: #25D366;
}

.btn-comprar {
  display: block;
  width: 100%;
  padding: 0.8rem;
  background: #25D366;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  margin-top: 0.5rem;
}

.btn-comprar:hover { background: #1da851; }

.loading {
  text-align: center;
  padding: 3rem;
  color: #666;
}

.no-productos {
  text-align: center;
  padding: 3rem;
  color: #999;
}

@media (max-width: 600px) {
  .productos-grid { grid-template-columns: 1fr; }
}
```

- [ ] **Step 2: Create index.html**

Create `public/index.html`:
```html
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Tienda de Productos</title>
  <link rel="stylesheet" href="/css/style.css">
</head>
<body>
  <div class="header">
    <h1> Tienda de Productos</h1>
    <p>Productos de calidad al mejor precio</p>
  </div>

  <div class="container">
    <div id="productos" class="productos-grid">
      <div class="loading">Cargando productos...</div>
    </div>
  </div>

  <script src="/js/app.js"></script>
</body>
</html>
```

- [ ] **Step 3: Create app.js**

Create `public/js/app.js`:
```javascript
const API = '';

async function cargarProductos() {
  const container = document.getElementById('productos');

  try {
    const response = await fetch(`${API}/api/products`);
    const productos = await response.json();

    if (productos.length === 0) {
      container.innerHTML = '<div class="no-productos">No hay productos disponibles</div>';
      return;
    }

    container.innerHTML = productos.map(p => `
      <div class="producto-card" onclick="verProducto(${p.id})">
        ${p.foto_url ? `<img src="${p.foto_url}" alt="${p.nombre}">` : '<div style="height:250px;background:#eee;display:flex;align-items:center;justify-content:center;color:#999;">Sin imagen</div>'}
        <div class="producto-info">
          <div class="producto-marca">${p.marca || ''}</div>
          <div class="producto-nombre">${p.nombre}</div>
          <div class="producto-precio">$${p.precio_venta} USD</div>
          <button class="btn-comprar" onclick="event.stopPropagation();comprar(${p.id})">Comprar</button>
        </div>
      </div>
    `).join('');
  } catch (err) {
    container.innerHTML = '<div class="no-productos">Error cargando productos</div>';
  }
}

function verProducto(id) {
  window.location.href = `/producto.html?id=${id}`;
}

async function comprar(id) {
  const nombre = prompt('Tu nombre:');
  if (!nombre) return;
  const telefono = prompt('Tu teléfono:');
  const ci = prompt('Tu CI:');

  try {
    const response = await fetch(`${API}/api/payment/comprar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ producto_id: id, cliente_nombre: nombre, cliente_telefono: telefono, cliente_ci: ci })
    });

    const venta = await response.json();
    if (venta.id) {
      window.location.href = `/producto.html?venta=${venta.id}`;
    } else {
      alert('Error: ' + (venta.error || 'Desconocido'));
    }
  } catch (err) {
    alert('Error procesando la compra');
  }
}

cargarProductos();
```

- [ ] **Step 4: Test the catalog**

Run server, open `http://localhost:3000`. Should show empty catalog message.

- [ ] **Step 5: Commit**

```bash
git add public/
git commit -m "feat: add public catalog UI with product grid and buy flow"
```

---

## Task 10: Login Page UI

**Files:**
- Create: `public/login.html`
- Create: `public/js/login.js`

- [ ] **Step 1: Create login.html**

Create `public/login.html`:
```html
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Login - Admin</title>
  <link rel="stylesheet" href="/css/style.css">
  <style>
    .login-container {
      max-width: 400px;
      margin: 5rem auto;
      padding: 2rem;
      background: white;
      border-radius: 12px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
    }
    .login-container h2 { text-align: center; margin-bottom: 1.5rem; }
    .form-group { margin-bottom: 1rem; }
    .form-group label { display: block; margin-bottom: 0.3rem; font-weight: 600; }
    .form-group input {
      width: 100%;
      padding: 0.8rem;
      border: 1px solid #ddd;
      border-radius: 8px;
      font-size: 1rem;
    }
    .btn-login {
      width: 100%;
      padding: 0.8rem;
      background: #25D366;
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
    }
    .error { color: red; text-align: center; margin-top: 1rem; }
  </style>
</head>
<body>
  <div class="login-container">
    <h2>🔐 Admin Login</h2>
    <form id="loginForm">
      <div class="form-group">
        <label>Usuario</label>
        <input type="text" id="usuario" required>
      </div>
      <div class="form-group">
        <label>Contraseña</label>
        <input type="password" id="password" required>
      </div>
      <button type="submit" class="btn-login">Ingresar</button>
    </form>
    <div id="error" class="error"></div>
  </div>
  <script src="/js/login.js"></script>
</body>
</html>
```

- [ ] **Step 2: Create login.js**

Create `public/js/login.js`:
```javascript
document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const usuario = document.getElementById('usuario').value;
  const password = document.getElementById('password').value;
  const errorDiv = document.getElementById('error');

  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usuario, password })
    });

    const data = await response.json();

    if (data.token) {
      localStorage.setItem('token', data.token);
      localStorage.setItem('admin', data.usuario);
      window.location.href = '/admin.html';
    } else {
      errorDiv.textContent = data.error || 'Error de login';
    }
  } catch (err) {
    errorDiv.textContent = 'Error de conexión';
  }
});
```

- [ ] **Step 3: Commit**

```bash
git add public/login.html public/js/login.js
git commit -m "feat: add admin login page"
```

---

## Task 11: Admin Panel UI

**Files:**
- Create: `public/admin.html`
- Create: `public/js/admin.js`

- [ ] **Step 1: Create admin.html**

Create `public/admin.html` with a full admin dashboard including:
- Header with logout button
- Stats bar (total products, total sales, pending sales)
- Products table with edit/delete buttons
- Sales table with approve/reject buttons
- Modal for adding/editing products
- File upload for product photos
- AI recognition trigger button

Keep it functional with clear sections. Use the same style.css.

- [ ] **Step 2: Create admin.js**

Create `public/js/admin.js` with:
- Token verification on load
- Fetch and display products
- Fetch and display sales
- Add/edit/delete products
- Trigger AI recognition on photo upload
- Approve/reject sales
- QR generation for sales
- Logout function

- [ ] **Step 3: Test admin flow**

1. Login at `/login.html`
2. Verify redirect to `/admin.html`
3. Add a product manually
4. Upload a photo and trigger AI recognition
5. Edit the recognized product
6. Publish the product

- [ ] **Step 4: Commit**

```bash
git add public/admin.html public/js/admin.js
git commit -m "feat: add admin panel with product management and sales dashboard"
```

---

## Task 12: Product Detail Page

**Files:**
- Create: `public/producto.html`
- Create: `public/js/producto.js`

- [ ] **Step 1: Create producto.html**

Create `public/producto.html` with:
- Product photo and details
- Price display
- Buy button
- QR payment display (after purchase)
- Receipt upload form
- Purchase status tracker

- [ ] **Step 2: Create producto.js**

Create `public/js/producto.js` with:
- Load product by ID from URL params
- Display product details
- Handle buy flow
- Generate and display QR
- Handle receipt upload
- Show purchase status

- [ ] **Step 3: Commit**

```bash
git add public/producto.html public/js/producto.js
git commit -m "feat: add product detail page with buy flow and QR payment"
```

---

## Task 13: Full Integration Test

- [ ] **Step 1: Test complete flow**

1. Start server: `node server.js`
2. Open `http://localhost:3000` — verify catalog loads
3. Go to `/login.html` — login as admin
4. In admin panel, add a product with photo
5. Trigger AI recognition — verify it identifies the product
6. Edit and publish the product
7. Open public catalog — verify product appears
8. Click buy — fill in details
9. View QR code
10. Upload a test receipt
11. Verify AI verification runs
12. Check Telegram notification
13. Approve the sale in admin
14. Verify product marked as sold

- [ ] **Step 2: Fix any issues found**

- [ ] **Step 3: Final commit**

```bash
git add .
git commit -m "feat: complete integration of all features"
```

---

## Environment Setup Guide (for user)

After implementation, the user needs to:

1. **Get Gemini API Key**: Go to https://aistudio.google.com/app/apikey (free)
2. **Get Google Search API Key**: Go to https://console.cloud.google.com (free, 100 queries/day)
3. **Create Custom Search Engine**: Go to https://cse.google.com/cse/all (free)
4. **Create Telegram Bot**: Message @BotFather on Telegram, /newbot, get token
5. **Get Telegram Chat ID**: Message @userinfobot on Telegram, get your ID
6. **Update .env** with all the keys
7. **Run**: `node server.js`
8. **Deploy** to Render.com or similar
