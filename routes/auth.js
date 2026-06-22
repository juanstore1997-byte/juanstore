const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { db } = require('../db/database');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

router.post('/login', async (req, res) => {
  const { usuario, password } = req.body;

  if (!usuario || !password) {
    return res.status(400).json({ error: 'Usuario y contraseña requeridos' });
  }

  const admin = db.prepare('SELECT * FROM admin WHERE usuario = ?').get(usuario);

  if (!admin || !(await bcrypt.compare(password, admin.password_hash))) {
    return res.status(401).json({ error: 'Credenciales incorrectas' });
  }

  const token = jwt.sign(
    { id: admin.id, usuario: admin.usuario },
    process.env.JWT_SECRET,
    { expiresIn: '2h' }
  );

  res.json({ token, usuario: admin.usuario });
});

router.get('/verify', authMiddleware, (req, res) => {
  console.log('req.admin in verify route:', req.admin);
  res.json({ valid: true, admin: req.admin });
});

router.post('/reset-admin', async (req, res) => {
  const { master, newPass } = req.body;
  if (master !== 'juanstore2026') return res.status(403).json({ error: 'Clave maestra incorrecta' });
  const hash = bcrypt.hashSync(newPass, 10);
  db.prepare('UPDATE admin SET password_hash = ? WHERE usuario = ?').run(hash, 'admin');
  res.json({ ok: true, message: 'Contraseña actualizada' });
});

module.exports = router;
