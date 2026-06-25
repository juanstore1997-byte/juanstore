const params = new URLSearchParams(window.location.search);
const productId = params.get('id');
const ventaId = params.get('venta');
const content = document.getElementById('content');

async function init() {
  if (ventaId) {
    await showPurchaseFlow();
  } else if (productId) {
    await showProduct();
  } else {
    content.innerHTML = `
      <div class="empty-state" style="padding:6rem 2rem;">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width:80px;height:80px;color:var(--text-muted);opacity:0.3;margin-bottom:1.5rem;"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        <h3 style="font-family:var(--font-display);font-size:1.25rem;font-weight:700;margin-bottom:0.5rem;">Producto no encontrado</h3>
        <p style="color:var(--text-muted);"><a href="/" style="color:var(--primary);text-decoration:none;font-weight:600;">Volver al catálogo</a></p>
      </div>`;
  }
}

async function showProduct() {
  try {
    const res = await fetch(`/api/products/${productId}`);
    if (!res.ok) {
      content.innerHTML = `
        <div class="empty-state" style="padding:6rem 2rem;">
          <h3 style="font-family:var(--font-display);">Producto no encontrado</h3>
          <p style="color:var(--text-muted);margin-top:0.5rem;"><a href="/" style="color:var(--primary);text-decoration:none;font-weight:600;">Volver al catálogo</a></p>
        </div>`;
      return;
    }
    const p = await res.json();
    document.title = `${p.nombre} - juanstore`;

    const metaTags = [
      p.categoria ? { icon: '📁', text: p.categoria } : null,
      p.color ? { icon: '🎨', text: p.color } : null,
      p.material ? { icon: '🧵', text: p.material } : null,
      p.fuente ? { icon: '🏪', text: p.fuente } : null,
    ].filter(Boolean);

    content.innerHTML = `
      <div class="product-detail">
        <div style="margin-bottom:1.5rem;">
          <a href="/" style="color:var(--primary);text-decoration:none;font-size:0.9rem;font-weight:500;display:inline-flex;align-items:center;gap:0.4rem;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
            Volver al catálogo
          </a>
        </div>
        <div class="product-detail-grid">
          <div class="product-detail-img">
            ${p.foto_url
              ? `<img src="${p.foto_url}" alt="${p.nombre}">`
              : `<div class="no-image">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                  <span style="font-size:0.9rem;">Sin imagen del producto</span>
                </div>`
            }
            ${p.foto_referencia ? `
              <div style="margin-top:0.75rem;padding-top:0.75rem;border-top:1px solid var(--border-light);">
                <div style="font-size:0.7rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:0.4rem;font-weight:600;">Referencia original</div>
                <img src="/api/proxy-image?url=${encodeURIComponent(p.foto_referencia)}" alt="Referencia" style="width:100%;border-radius:var(--radius);border:1px solid var(--border-light);">
              </div>
            ` : ''}
          </div>
          <div class="product-detail-info">
            ${p.marca ? `<div class="product-detail-marca">${p.marca}</div>` : ''}
            <h1 class="product-detail-nombre">${p.nombre}</h1>
            <div class="product-detail-precio">Bs. ${p.precio_venta}</div>

            ${p.descripcion ? `<p class="product-detail-desc">${p.descripcion}</p>` : ''}

            ${metaTags.length > 0 ? `
              <div class="product-detail-meta">
                ${metaTags.map(m => `
                  <span class="meta-tag">
                    <span>${m.icon}</span> ${m.text}
                  </span>
                `).join('')}
              </div>
            ` : ''}

            ${p.link_original ? `
              <a href="${p.link_original}" target="_blank" class="product-detail-link">
                Ver en tienda original
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
              </a>
            ` : ''}

            <div class="product-detail-actions">
              <button class="btn-primary" onclick="startBuy()">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/></svg>
                Comprar Ahora
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  } catch (err) {
    content.innerHTML = `
      <div class="empty-state" style="padding:6rem 2rem;">
        <h3 style="font-family:var(--font-display);">Error cargando producto</h3>
        <p style="color:var(--text-muted);margin-top:0.5rem;"><a href="/" style="color:var(--primary);text-decoration:none;font-weight:600;">Volver al catálogo</a></p>
      </div>`;
  }
}

function startBuy() {
  const nombre = prompt('Tu nombre completo:');
  if (!nombre) return;
  const telefono = prompt('Tu teléfono:');

  fetch('/api/payment/comprar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ producto_id: parseInt(productId), cliente_nombre: nombre, cliente_telefono: telefono })
  })
  .then(r => r.json())
  .then(venta => {
    if (venta.id) {
      window.location.href = `/producto.html?venta=${venta.id}`;
    } else {
      alert('Error: ' + (venta.error || 'Desconocido'));
    }
  })
  .catch(() => alert('Error procesando la compra'));
}

async function showPurchaseFlow() {
  try {
    const res = await fetch(`/api/payment/venta/${ventaId}`);
    if (!res.ok) {
      content.innerHTML = `
        <div class="purchase-container">
          <div class="purchase-card">
            <div class="purchase-header">
              <h2>Compra no encontrada</h2>
            </div>
            <div class="purchase-body" style="text-align:center;padding:3rem;">
              <p style="color:var(--text-secondary);">Esta compra no existe o fue eliminada.</p>
              <a href="/" style="color:var(--primary);text-decoration:none;font-weight:600;margin-top:1rem;display:inline-block;">Volver al catálogo</a>
            </div>
          </div>
        </div>`;
      return;
    }
    const venta = await res.json();

    const productRes = await fetch(`/api/products/${venta.producto_id}`);
    const product = await productRes.json();

    let qrHtml = '';
    if (venta.estado === 'pendiente') {
      const qrRes = await fetch(`/api/payment/qr/${venta.producto_id}`);
      const qrData = await qrRes.json();
      qrHtml = `
        <div class="qr-container">
          <h3 style="font-family:var(--font-display);font-weight:700;margin-bottom:1rem;">Escanea el QR para pagar</h3>
          <img src="${qrData.qr}" alt="QR de pago">
          <div class="qr-info">
            <p>Monto: <strong>Bs. ${venta.monto}</strong></p>
            <p style="margin-top:0.25rem;">Banco: ${qrData.data.banco} | Titular: ${qrData.data.titular}</p>
          </div>
        </div>
      `;
    }

    let uploadHtml = '';
    if (venta.estado === 'pendiente' && !venta.comprobante_url) {
      uploadHtml = `
        <div style="margin-top:1.5rem;">
          <h3 style="font-family:var(--font-display);font-weight:700;margin-bottom:1rem;">Sube tu comprobante de pago</h3>
          <div class="upload-area" onclick="document.getElementById('comprobanteFile').click()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            <p>Haz clic para <span class="highlight">seleccionar tu comprobante</span></p>
            <p style="font-size:0.8rem;color:var(--text-muted);margin-top:0.25rem;">Captura del pago por transferencia</p>
          </div>
          <input type="file" id="comprobanteFile" accept="image/*" style="display:none;" onchange="uploadComprobante()">
        </div>
      `;
    }

    let statusHtml = '';
    if (venta.comprobante_url) {
      const statusClass = venta.estado === 'aprobada' ? 'aprobada' : venta.estado === 'rechazada' ? 'rechazada' : venta.estado === 'verificado' ? 'verificado' : 'pendiente';
      
      let verificacionHtml = '';
      if (venta.banco || venta.monto_detectado) {
        verificacionHtml = `
          <div style="margin-top:0.75rem;padding:0.75rem;background:rgba(0,0,0,0.03);border-radius:var(--radius);font-size:0.85rem;">
            <div style="font-weight:600;margin-bottom:0.5rem;color:var(--text-secondary);">Resultados del análisis:</div>
            ${venta.banco ? `<div>🏦 Banco: <strong>${venta.banco}</strong></div>` : ''}
            ${venta.monto_detectado ? `<div>💰 Monto detectado: <strong>Bs. ${venta.monto_detectado}</strong></div>` : ''}
            ${venta.observaciones_verificacion ? `<div style="margin-top:0.5rem;color:var(--text-muted);font-style:italic;">${venta.observaciones_verificacion}</div>` : ''}
          </div>
        `;
      }

      statusHtml = `
        <div style="margin-top:1.5rem;">
          <h3 style="font-family:var(--font-display);font-weight:700;margin-bottom:1rem;">Estado de tu compra</h3>
          <img src="${venta.comprobante_url}" style="max-width:200px;border-radius:var(--radius);margin:0.5rem 0;box-shadow:var(--shadow);">
          <div class="status-card ${statusClass}">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            <div>
              <strong>Estado: ${venta.estado.toUpperCase()}</strong>
              ${venta.estado === 'rechazada' && venta.motivo_rechazo ? `<p style="margin-top:0.25rem;font-size:0.85rem;">Motivo: ${venta.motivo_rechazo}</p>` : ''}
            </div>
          </div>
          ${verificacionHtml}
        </div>
      `;
    }

    content.innerHTML = `
      <div class="purchase-container">
        <div class="purchase-card">
          <div class="purchase-header">
            <h2>Compra #${venta.id}</h2>
            <p style="color:var(--text-muted);font-size:0.9rem;margin-top:0.25rem;">Cliente: ${venta.cliente_nombre || '—'}</p>
          </div>
          <div class="purchase-body">
            <div style="display:flex;gap:1rem;align-items:center;padding-bottom:1.5rem;border-bottom:1px solid var(--border-light);margin-bottom:1.5rem;">
              ${product.foto_url ? `<img src="${product.foto_url}" style="width:80px;height:80px;border-radius:var(--radius);object-fit:cover;">` : ''}
              <div>
                <div style="font-family:var(--font-display);font-weight:700;">${product.nombre}</div>
                <div style="font-family:var(--font-display);font-weight:800;color:var(--primary);font-size:1.25rem;margin-top:0.25rem;">Bs. ${product.precio_venta}</div>
              </div>
            </div>
            ${qrHtml}
            ${uploadHtml}
            ${statusHtml}
          </div>
        </div>
      </div>
    `;
  } catch (err) {
    content.innerHTML = `
      <div class="purchase-container">
        <div class="purchase-card">
          <div class="purchase-body" style="text-align:center;padding:3rem;">
            <h3 style="font-family:var(--font-display);">Error cargando información</h3>
            <p style="color:var(--text-muted);margin-top:0.5rem;"><a href="/" style="color:var(--primary);text-decoration:none;font-weight:600;">Volver al catálogo</a></p>
          </div>
        </div>
      </div>`;
  }
}

async function uploadComprobante() {
  const file = document.getElementById('comprobanteFile').files[0];
  if (!file) return;

  const formData = new FormData();
  formData.append('comprobante', file);

  try {
    const res = await fetch(`/api/payment/comprobante/${ventaId}`, {
      method: 'POST',
      body: formData
    });
    const data = await res.json();
    if (data.venta) {
      alert('Comprobante subido exitosamente. Espera verificación del administrador.');
      showPurchaseFlow();
    } else {
      alert('Error: ' + (data.error || 'Desconocido'));
    }
  } catch (err) {
    alert('Error subiendo comprobante');
  }
}

init();
