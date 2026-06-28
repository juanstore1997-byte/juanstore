const express = require('express');
const { db } = require('../db/database');
const authMiddleware = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '..', 'public', 'uploads')),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${crypto.randomUUID()}${ext}`);
  }
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

// Admin: get all products (any status)
router.get('/admin/all', authMiddleware, (req, res) => {
  const products = db.prepare('SELECT * FROM productos ORDER BY created_at DESC').all();
  res.json(products);
});

// Public: get single product
router.get('/:id', (req, res) => {
  const product = db.prepare('SELECT * FROM productos WHERE id = ?').get(req.params.id);
  if (!product) return res.status(404).json({ error: 'Producto no encontrado' });
  res.json(product);
});

// Admin: create product
router.post('/', authMiddleware, upload.single('foto'), (req, res) => {
  try {
    const { nombre, descripcion, marca, categoria, color, material, caracteristicas, precio_original, precio_venta, fuente, link_original, foto_gemini, foto_referencia, estado } = req.body;

    if (!nombre) return res.status(400).json({ error: 'Nombre requerido' });

    if (precio_venta !== undefined && precio_venta !== '' && (isNaN(precio_venta) || Number(precio_venta) < 0)) {
      return res.status(400).json({ error: 'Precio de venta inválido' });
    }

    const foto_url = req.file ? `/uploads/${req.file.filename}` : null;

    const result = db.prepare(`
      INSERT INTO productos (nombre, descripcion, marca, categoria, color, material, caracteristicas, precio_original, precio_venta, foto_url, foto_gemini, foto_referencia, fuente, link_original, estado)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(nombre, descripcion, marca, categoria, color, material, caracteristicas, precio_original, precio_venta, foto_url, foto_gemini, foto_referencia, fuente, link_original, estado || 'borrador');

    const product = db.prepare('SELECT * FROM productos WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(product);
  } catch (err) {
    console.error('Error creando producto:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Admin: update product
router.put('/:id', authMiddleware, upload.single('foto'), (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM productos WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Producto no encontrado' });

    const { nombre, descripcion, marca, categoria, color, material, caracteristicas, precio_original, precio_venta, fuente, link_original, foto_gemini, foto_referencia, estado } = req.body;

    const foto_url = req.file ? `/uploads/${req.file.filename}` : existing.foto_url;

    db.prepare(`
      UPDATE productos SET nombre=?, descripcion=?, marca=?, categoria=?, color=?, material=?, caracteristicas=?, precio_original=?, precio_venta=?, foto_url=?, foto_gemini=?, foto_referencia=?, fuente=?, link_original=?, estado=?, updated_at=CURRENT_TIMESTAMP
      WHERE id=?
    `).run(nombre || existing.nombre, descripcion ?? existing.descripcion, marca ?? existing.marca, categoria ?? existing.categoria, color ?? existing.color, material ?? existing.material, caracteristicas ?? existing.caracteristicas, precio_original ?? existing.precio_original, precio_venta ?? existing.precio_venta, foto_url, foto_gemini ?? existing.foto_gemini, foto_referencia ?? existing.foto_referencia, fuente ?? existing.fuente, link_original ?? existing.link_original, estado || existing.estado, req.params.id);

    const product = db.prepare('SELECT * FROM productos WHERE id = ?').get(req.params.id);
    res.json(product);
  } catch (err) {
    console.error('Error actualizando producto:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Admin: delete product (also deletes associated sales)
router.delete('/:id', authMiddleware, (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM productos WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Producto no encontrado' });

    db.prepare('DELETE FROM ventas WHERE producto_id = ?').run(req.params.id);
    db.prepare('DELETE FROM productos WHERE id = ?').run(req.params.id);
    res.json({ deleted: true });
  } catch (err) {
    console.error('Error eliminando producto:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

function handleUploadError(err, req, res, next) {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: `Error de upload: ${err.message}` });
  }
  console.error('Upload error:', err);
  res.status(500).json({ error: 'Error al procesar archivo' });
}

router.use(handleUploadError);

module.exports = router;
