const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const QRCode = require('qrcode');
const { db } = require('../db/database');
const authMiddleware = require('../middleware/auth');
const { verifyPaymentReceipt } = require('../utils/gemini');
const { notifyNewSale, notifySaleApproved, notifySaleRejected } = require('../utils/telegram');

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

// Generate QR for a product
router.get('/qr/:productoId', async (req, res) => {
  const product = db.prepare('SELECT * FROM productos WHERE id = ?').get(req.params.productoId);
  if (!product) return res.status(404).json({ error: 'Producto no encontrado' });

  const paymentData = {
    producto: product.nombre,
    monto: product.precio_venta,
    moneda: 'Bs.',
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
  try {
    const { producto_id, cliente_nombre, cliente_telefono, cliente_ci } = req.body || {};

    if (!producto_id) return res.status(400).json({ error: 'Producto requerido' });

    const product = db.prepare('SELECT * FROM productos WHERE id = ? AND estado = ?').get(producto_id, 'publicado');
    if (!product) return res.status(404).json({ error: 'Producto no encontrado o no disponible' });

    const result = db.prepare(`
      INSERT INTO ventas (producto_id, cliente_nombre, cliente_telefono, cliente_ci, monto, estado)
      VALUES (?, ?, ?, ?, ?, 'pendiente')
    `).run(producto_id, cliente_nombre, cliente_telefono, cliente_ci, product.precio_venta);

    const venta = db.prepare('SELECT * FROM ventas WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(venta);
  } catch (err) {
    console.error('Error en comprar:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Client uploads payment receipt
router.post('/comprobante/:ventaId', upload.single('comprobante'), async (req, res) => {
  const venta = db.prepare('SELECT * FROM ventas WHERE id = ?').get(req.params.ventaId);
  if (!venta) return res.status(404).json({ error: 'Venta no encontrada' });

  if (!req.file) return res.status(400).json({ error: 'Comprobante requerido' });

  const product = db.prepare('SELECT * FROM productos WHERE id = ?').get(venta.producto_id);

  try {
    const verification = await verifyPaymentReceipt(req.file.buffer, product.precio_venta);

    const esValido = verification.es_valido ? 1 : 0;
    const banco = verification.banco || 'No detectado';

    const uploadDir = path.join(__dirname, '..', 'public', 'uploads');
    const filename = 'comprobante-' + Date.now() + '-' + req.file.originalname.replace(/\s+/g, '-');
    fs.writeFileSync(path.join(uploadDir, filename), req.file.buffer);
    const comprobanteUrl = '/uploads/' + filename;

    db.prepare('UPDATE ventas SET comprobante_url = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(comprobanteUrl, req.params.ventaId);

    db.prepare(`
      UPDATE ventas
      SET comprobante_verificado = ?, banco = ?, estado = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(esValido, banco, esValido ? 'verificado' : 'pendiente', req.params.ventaId);

    const updatedVenta = db.prepare('SELECT * FROM ventas WHERE id = ?').get(req.params.ventaId);

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

// Public: get single sale by ID (for customer purchase flow)
router.get('/venta/:ventaId', (req, res) => {
  const venta = db.prepare(`
    SELECT v.*, p.nombre as producto_nombre, p.foto_url as producto_foto, p.precio_venta
    FROM ventas v
    JOIN productos p ON v.producto_id = p.id
    WHERE v.id = ?
  `).get(req.params.ventaId);
  if (!venta) return res.status(404).json({ error: 'Venta no encontrada' });
  res.json(venta);
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
