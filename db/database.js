const Database = require('better-sqlite3');
const path = require('path');
const bcrypt = require('bcryptjs');

const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '..', 'tienda.db');
const db = new Database(dbPath);

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
  const user = process.env.ADMIN_USER || 'admin';
  const pass = process.env.ADMIN_PASS || 'admin123';
  const hash = bcrypt.hashSync(pass, 10);
  
  const existing = db.prepare('SELECT id FROM admin WHERE usuario = ?').get(user);
  if (existing) {
    db.prepare('UPDATE admin SET password_hash = ? WHERE usuario = ?').run(hash, user);
    console.log(`Admin actualizado: ${user}`);
  } else {
    db.prepare('INSERT INTO admin (usuario, password_hash) VALUES (?, ?)').run(user, hash);
    console.log(`Admin creado: ${user}`);
  }
}

module.exports = { db, initAdmin };
