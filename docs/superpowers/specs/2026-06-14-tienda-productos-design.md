# Diseño: Tienda de Productos con Reconocimiento IA

## Resumen

Aplicación web para vender productos (ropa, accesorios, etc.) de Amazon y otras tiendas. El administrador sube fotos de productos, la IA identifica el producto y busca sus características en la web, el admin pone el precio de venta, y los clientes pueden comprarlo pagando con QR (Bolivia). El sistema verifica comprobantes de pago con IA y notifica al admin por Telegram.

## Arquitectura

### Stack Tecnológico
- **Frontend**: HTML5 + CSS3 + JavaScript vanilla
- **Backend**: Node.js + Express.js
- **Base de datos**: SQLite3 (via better-sqlite3)
- **IA**: Google Gemini API (tier gratuito: 60 req/min)
- **Búsqueda web**: Google Custom Search API (100 consultas/día gratis)
- **Notificaciones**: Telegram Bot API
- **Hosting**: Cualquier VPS o servicio gratuito (Render, Railway)

### Estructura de Archivos

```
├── server.js                    # Servidor Express principal
├── package.json
├── .env                         # Variables de entorno (API keys, tokens)
├── public/                      # Archivos estáticos
│   ├── index.html               # Página principal (catálogo público)
│   ├── producto.html            # Detalle de producto individual
│   ├── admin.html               # Panel de administración
│   ├── login.html               # Login del administrador
│   ├── css/
│   │   └── style.css            # Estilos globales
│   └── js/
│       ├── app.js               # Lógica del catálogo público
│       ├── producto.js          # Lógica de detalle de producto
│       ├── admin.js             # Lógica del panel admin
│       └── login.js             # Lógica de autenticación
├── routes/
│   ├── products.js              # CRUD de productos
│   ├── recognition.js           # Reconocimiento IA de fotos
│   ├── payment.js               # Pagos, QR, comprobantes
│   └── auth.js                  # Login/logout admin
├── db/
│   └── database.js              # Configuración SQLite
├── middleware/
│   └── auth.js                  # Middleware de autenticación
└── utils/
    ├── gemini.js                # Cliente Google Gemini
    ├── telegram.js              # Cliente Telegram Bot
    └── search.js                # Búsqueda Google Custom Search
```

## Modelos de Datos

### Productos
```sql
CREATE TABLE productos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  marca TEXT,
  categoria TEXT,
  color TEXT,
  material TEXT,
  caracteristicas TEXT,  -- JSON con lista de características
  precio_original REAL,  -- Precio en la tienda original (USD)
  precio_venta REAL,     -- Precio de venta (USD)
  foto_url TEXT,         -- URL o base64 de la foto
  foto_gemini TEXT,      -- Análisis de la foto por Gemini
  fuente TEXT,           -- Tienda de origen (Amazon, MercadoLibre, etc.)
  link_original TEXT,    -- Link al producto original
  estado TEXT DEFAULT 'borrador',  -- borrador, publicado, vendido
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Ventas
```sql
CREATE TABLE ventas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  producto_id INTEGER NOT NULL,
  cliente_nombre TEXT,
  cliente_telefono TEXT,
  cliente_ci TEXT,  -- Cédula de identidad
  monto REAL NOT NULL,
  comprobante_url TEXT,  -- Foto del comprobante
  banco TEXT,            -- Banco detectado por IA
  comprobante_verificado BOOLEAN DEFAULT FALSE,
  comprobante_rechazado BOOLEAN DEFAULT FALSE,
  motivo_rechazo TEXT,
  estado TEXT DEFAULT 'pendiente',  -- pendiente, verificado, aprobada, rechazada, completada
  notificado_telegram BOOLEAN DEFAULT FALSE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (producto_id) REFERENCES productos(id)
);
```

### Admin (opcional, para login)
```sql
CREATE TABLE admin (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## Flujo de Reconocimiento de Producto

1. **El admin sube una foto** del producto
2. **La foto se envía a Google Gemini** con el prompt:
   ```
   Analiza esta foto de un producto e identifica:
   - Marca
   - Nombre del producto
   - Categoría (ropa, calzado, accesorios, etc.)
   - Color
   - Material (si es visible)
   - Características destacadas
   Responde en formato JSON con estos campos.
   ```
3. **Gemini devuelve** un JSON con la información del producto
4. **Se busca automáticamente en Google** para encontrar:
   - Precio original en la tienda
   - Descripción completa
   - Links de compra
5. **El admin revisa la información**, la edita si es necesario, pone el precio de venta y publica

## Flujo de Pago y Verificación

1. **El cliente hace clic en "Comprar"**
2. **Se genera un QR** con datos de transferencia bancaria boliviana
3. **El cliente escanea y paga**
4. **El cliente sube el comprobante** (captura de pantalla)
5. **La IA (Gemini) analiza el comprobante** y verifica:
   - Que sea de un banco boliviano (BCP, Unocero, Fassil, Mercantil, Nacional, Económico)
   - Que el monto coincida con el precio
   - Que la fecha sea reciente (últimas 24 horas)
6. **Se notifica al admin por Telegram** con:
   - Datos del producto
   - Datos del cliente
   - Foto del comprobante
   - Resultado de la verificación IA
7. **El admin aprueba o rechaza** la venta
8. **Si se aprueba**, el producto se marca como "vendido" y desaparece del catálogo

## Estados de una Venta

```
pendiente → verificado_ia → aprobada_admin → completada
    ↓              ↓                ↓
rechazada_ia  rechazada_ia   rechazada_admin
```

## Notificaciones Telegram

El bot envía mensajes al admin cuando:
- Se sube un nuevo comprobante de pago
- Se verifica un comprobante con IA
- Se aprueba/rechaza una venta
- Hay errores en el sistema

Formato del mensaje:
```
🔔 ¡NUEVA VENTA!

Producto: [nombre]
Precio: [precio] USD
Cliente: [nombre]
Teléfono: [teléfono]

Comprobante: [foto]
Banco: [banco detectado]
Monto verificado: [monto] [✅/❌]

Estado: Pendiente aprobación
```

## APIs y Servicios Externos

### Google Gemini (IA gratuita)
- **Endpoint**: `generativelanguage.googleapis.com`
- **Tier gratuito**: 60 requests/minuto
- **Uso**: Análisis de fotos de productos y verificación de comprobantes

### Google Custom Search (búsqueda gratuita)
- **Endpoint**: `customsearch.googleapis.com`
- **Tier gratuito**: 100 consultas/día
- **Uso**: Buscar información y precios de productos

### Telegram Bot API
- **Endpoint**: `api.telegram.org`
- **Costo**: Gratuito
- **Uso**: Notificar al admin sobre ventas

## Seguridad

- Login del admin con contraseña hasheada (bcrypt)
- JWT para sesiones
- Validación de archivos subidos (solo imágenes)
- Rate limiting para prevenir abuso
- Variables de entorno para API keys (nunca en código)

## Hosting Recomendado

- **Render.com** (gratuito, ideal para empezar)
- **Railway.app** (tier gratuito generoso)
- **VPS simple** (DigitalOcean, $5/mes)

## Sistema de Pago QR (Bolivia)

Para Bolivia, el QR contiene los datos de transferencia bancaria:
- **Nombre del titular**
- **Número de cuenta / CI**
- **Banco destino**
- **Monto a pagar**

El QR se genera dinámicamente con el monto del producto. El cliente:
1. Escanea el QR con su app bancaria
2. Realiza la transferencia
3. Sube la captura del comprobante

**Nota**: En Bolivia "Pago Móvil" es una transferencia por teléfono (no QR). Se puede implementar como alternativa: mostrar los datos de transferencia para que el cliente los copie y haga el pago manualmente, o generar un QR con esos datos.

## Limitaciones Conocidas

- Google Custom Search: 100 consultas/día (suficiente para empezar)
- Google Gemini: 60 req/min (más que suficiente)
- Verificación de comprobantes: No 100% precisa, el admin siempre debe confirmar
- QR estático: Se genera con monto fijo por producto. Si el cliente cambia monto, hay que regenerar
- No hay pasarela de pago automática: todo es manual (transferencia + verificación)

## Fases de Implementación

**Fase 1 (MVP)**: Catálogo básico + subir fotos + reconocimiento IA + admin simple
**Fase 2**: Sistema de pago QR + comprobantes + verificación IA
**Fase 3**: Notificaciones Telegram + dashboard completo
