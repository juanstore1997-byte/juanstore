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
      const fs = require('fs');
      const path = require('path');
      const FormData = require('form-data');
      const form = new FormData();
      form.append('chat_id', CHAT_ID);
      form.append('caption', text);
      form.append('photo', fs.createReadStream(path.join(__dirname, '..', 'public', imagePath)));

      const response = await fetch(`${baseUrl}/sendPhoto`, {
        method: 'POST',
        body: form.getBuffer(),
        headers: form.getHeaders()
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
