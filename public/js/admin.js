const API = '';
let token = localStorage.getItem('token');
let currentVentaId = null;

if (!token) { window.location.href = '/login.html'; }

document.getElementById('adminName').textContent = localStorage.getItem('admin') || 'Admin';

function headers() { return { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }; }

function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('admin');
  window.location.href = '/login.html';
}

function showTab(tab) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  event.target.classList.add('active');
  document.getElementById('tab-productos').style.display = tab === 'productos' ? 'block' : 'none';
  document.getElementById('tab-ventas').style.display = tab === 'ventas' ? 'block' : 'none';
  if (tab === 'ventas') loadVentas();
}

function showResult(html) {
  document.getElementById('aiResult').innerHTML = html;
  document.getElementById('aiResult').style.display = 'block';
}

function hideResult() {
  document.getElementById('aiResult').style.display = 'none';
}

// ============================================
// IA: Llama a HuggingFace desde el NAVEGADOR
// ============================================

const HF_TOKEN = '';

async function detectarYBuscar() {
  const foto = document.getElementById('productoFoto').files[0];
  if (!foto) { alert('Sube una foto primero'); return; }

  const btn = document.getElementById('btnDetectar');
  btn.disabled = true;
  btn.textContent = '⏳ Analizando foto...';
  showResult('Analizando foto con IA y buscando productos en tiendas...');

  try {
    const formData = new FormData();
    formData.append('foto', foto);

    const response = await fetch(`${API}/api/recognition/analyze-photo`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData
    });

    if (!response.ok) throw new Error(`Error ${response.status}`);

    const data = await response.json();
    console.log('Resultado:', data);

    if (data.error) throw new Error(data.error);

    const nombre = data.ocr_nombre || '';
    const marca = data.ocr_marca || '';
    const vit = data.vit_categoria || '';
    const keywords = data.ocr_keywords || [];
    const query = data.query_busqueda || '';
    const sugerencias = data.sugerencias || [];

    // Llenar campos si el OCR detectó algo
    if (nombre) document.getElementById('productoNombre').value = nombre;
    if (marca) document.getElementById('productoMarca').value = marca;

    // Mostrar info del reconocimiento
    let infoHtml = '<div style="background:#e8f5e9;padding:10px;border-radius:6px;margin-bottom:10px;border-left:4px solid #4caf50;">';
    infoHtml += '<strong style="color:#2e7d32;">📷 Foto analizada por IA</strong><br>';
    if (nombre) infoHtml += `<span>Texto detectado: <strong>${nombre}</strong></span><br>`;
    if (marca) infoHtml += `<span>Marca: <strong>${marca}</strong></span><br>`;
    if (keywords.length > 0) infoHtml += `<span>Palabras clave: ${keywords.join(', ')}</span><br>`;
    if (vit) infoHtml += `<span>Categoría visual: ${vit}</span><br>`;
    if (query) infoHtml += `<span style="color:#666;font-size:0.85rem;">Buscando: "${query}"</span>`;
    if (!nombre && !vit) {
      infoHtml += `<em style="color:#e65100;">La IA no pudo identificar el producto automáticamente desde esta foto.</em><br>`;
      infoHtml += `<span style="color:#666;font-size:0.85rem;">Escribe el nombre del producto en el campo de búsqueda.</span>`;
    }
    infoHtml += '</div>';

    // Mostrar resultados de búsqueda si hay
    if (data.resultados && data.resultados.length > 0) {
      const cards = data.resultados.map(r => {
        const displayImage = r.image || '';
        return `
        <div class="search-result-card" onclick="seleccionarResultado(this)" 
             data-nombre="${(r.title || '').replace(/"/g, '&quot;')}"
             data-snippet="${(r.snippet || '').replace(/"/g, '&quot;')}"
             data-link="${r.link || ''}"
             data-image="${displayImage}"
             data-store="${r.store || ''}"
             data-original-title="${(r.originalTitle || r.title || '').replace(/"/g, '&quot;')}"
             style="cursor:pointer;padding:10px;border:1px solid #e0e0e0;border-radius:8px;margin-bottom:8px;background:white;display:flex;gap:10px;align-items:center;transition:all 0.2s;"
             onmouseover="this.style.borderColor='#4caf50';this.style.boxShadow='0 2px 8px rgba(76,175,80,0.2)'"
             onmouseout="this.style.borderColor='#e0e0e0';this.style.boxShadow='none'">
          ${displayImage ? `<img src="${displayImage}" style="width:80px;height:80px;object-fit:cover;border-radius:6px;" onerror="this.style.display='none'">` : '<div style="width:80px;height:80px;background:#f5f5f5;border-radius:6px;display:flex;align-items:center;justify-content:center;color:#999;font-size:0.7rem;">Sin foto</div>'}
          <div style="flex:1;min-width:0;">
            <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">
              ${r.store ? `<span style="background:#e3f2fd;color:#1565c0;padding:2px 8px;border-radius:12px;font-size:0.7rem;font-weight:bold;">${r.store}</span>` : ''}
              <strong style="font-size:0.9rem;color:#333;">${r.title}</strong>
            </div>
            <span style="color:#666;font-size:0.8rem;display:block;">${(r.snippet || '').substring(0, 150)}</span>
            <span style="color:#4caf50;font-size:0.75rem;">✅ Clic para auto-completar todos los campos</span>
          </div>
        </div>`;
      }).join('');

      showResult(infoHtml + '<strong style="color:#333;">📦 Productos encontrados en tiendas:</strong><br><small style="color:#666;">Haz clic en un resultado para auto-completar el formulario:</small><br>' + cards);
    } else {
      // No hay resultados - mostrar sugerencias para buscar manualmente
      let suggestHtml = '';
      if (sugerencias.length > 0) {
        suggestHtml = '<div style="margin-top:8px;"><strong>Sugerencias de búsqueda:</strong><br>';
        sugerencias.forEach(s => {
          suggestHtml += `<button onclick="buscarConSugerencia('${s.replace(/'/g, "\\'")}')" style="margin:4px;padding:4px 12px;border:1px solid #2196f3;border-radius:20px;background:white;color:#2196f3;cursor:pointer;font-size:0.85rem;">🔍 ${s}</button>`;
        });
        suggestHtml += '</div>';
      }
      showResult(infoHtml + '<br><em>Escribe el nombre del producto más específico y presiona "Buscar".</em>' + suggestHtml);
    }

    // Mostrar campo de búsqueda manual
    document.getElementById('buscarSection').style.display = 'block';

  } catch (err) {
    console.error('Error:', err);
    showResult(`Error: ${err.message}<br>Escribe el nombre del producto y presiona "Buscar".`);
    document.getElementById('buscarSection').style.display = 'block';
  }

  btn.disabled = false;
  btn.textContent = '🔍 Detectar producto desde foto';
}

function seleccionarResultado(el) {
  const source = el.dataset.source || '';
  const link = el.dataset.link || '';
  const store = el.dataset.store || '';

  // Enlaces a tiendas: abrir en nueva pestaña
  if (source.includes('-link')) {
    window.open(link, '_blank');
    return;
  }

  const nombre = el.dataset.nombre || '';
  const snippet = el.dataset.snippet || '';

  // Extraer nombre limpio del título
  let nombreLimpio = nombre
    .replace(/\s*[-–|]\s*(Amazon|eBay|Mercado Libre|Linio|Falabella|Ripley|Paris|Walmart|AliExpress|Shopify|Home Depot|Target|Best Buy|Costco|Etsy|Jet).*$/i, '')
    .replace(/\s*[-–|]\s*(com|com\.bo|org\.bo|net).*$/i, '')
    .replace(/\s*[-–|]\s*Best Sellers.*$/i, '')
    .replace(/\b(LUUKMONDE|Elite Gourmet|BLACK\+DECKER|OVENTE|ASTRALSHIP)\s*/gi, '')
    .trim();

  // Llenar TODOS los campos del formulario
  document.getElementById('productoNombre').value = nombreLimpio;
  if (snippet) document.getElementById('productoDescripcion').value = snippet.substring(0, 500);
  if (link) document.getElementById('productoLink').value = link;
  if (store) document.getElementById('productoFuente').value = store;

  // NO cargar imagen automática — el usuario presiona "Obtener" o pega URL manualmente
  showResult(`<strong style="color:green;">✅ Seleccionado:</strong> ${nombreLimpio}<br><small>Presiona <strong>"🔄 Obtener"</strong> para cargar la imagen desde el enlace del producto, o pega la URL manualmente.</small>`);

  // Intentar extraer marca del título
  const marcas = nombre.match(/(Lilicrops|Philco|Oster|Samsung|Apple|Xiaomi|Sony|LG|Bosch|Kenwood|Black.?Decker|Hamilton|Cuisinart|Ninja|KitchenAid|Truper|Stanley|Dewalt|Milwaukee|Craftsman|Anker|Baseus|Logitech|Corsair|Kingston|SanDisk|TP-Link|Huawei|Canon|Nikon|GoPro|DJI|Vinci|Breville|Cuisinart|Luukonde|LUUKMONDE|Elite Gourmet|BLACK\+DECKER|OVENTE|ASTRALSHIP)/i);
  if (marcas) {
    document.getElementById('productoMarca').value = marcas[0];
  }

  // Intentar extraer categoría
  const categorias = nombre.match(/(citrus juicer|juicer|blender|mixer|processor|grinder|toaster|kettle|coffee maker|air fryer|slow cooker|rice cooker|food dehydrator|vacuum sealer|can opener|electric knife|mandoline|spiralizer|colander|strainer|ladle|tongs|spatula|whisk|rolling pin|cutting board|knife set|cookware|bakeware|pan|pot|dish)/i);
  if (categorias) {
    document.getElementById('productoCategoria').value = categorias[0];
  }

  // Intentar extraer precio del snippet
  const precioMatch = snippet.match(/[\$\Bs\.]+\s*(\d+[\.,]?\d*)/);
  if (precioMatch) {
    const precio = parseFloat(precioMatch[1].replace(',', '.'));
    if (precio > 0) {
      document.getElementById('productoPrecioOriginal').value = precio;
    }
  }

  // Traducir categoría al español
  const catEn = document.getElementById('productoCategoria').value;
  const catEs = {
    'citrus juicer': 'Exprimidor de cítricos',
    'juicer': 'Exprimidor',
    'blender': 'Licuadora',
    'mixer': 'Batidora',
    'processor': 'Procesador',
    'toaster': 'Tostadora',
    'kettle': 'Hervidor',
    'coffee maker': 'Cafetera',
    'air fryer': 'Freidora de aire',
  };
  if (catEs[catEn]) {
    document.getElementById('productoCategoria').value = catEs[catEn];
  }

  const storeInfo = store ? ` (de ${store})` : '';
  showResult(`<strong style="color:green;">✅ Seleccionado${storeInfo}:</strong> ${nombreLimpio}<br><small>Foto de referencia guardada. Revisa y ajusta antes de guardar.</small>`);
}

async function buscarProductoWeb() {
  const nombre = document.getElementById('buscarQuery').value || document.getElementById('productoNombre').value;
  if (!nombre) { alert('Escribe el nombre del producto primero'); return; }

  const query = nombre.trim();
  showResult('🔍 Buscando productos en tiendas...');

  try {
    const res = await fetch(`${API}/api/recognition/search-product`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query })
    });
    const data = await res.json();

    if (data.results && data.results.length > 0) {
      const cards = data.results.map(r => {
        const displayImage = r.image || '';
        return `
        <div class="search-result-card" onclick="seleccionarResultado(this)"
             data-nombre="${(r.title || '').replace(/"/g, '&quot;')}"
             data-snippet="${(r.snippet || '').replace(/"/g, '&quot;')}"
             data-link="${r.link || ''}"
             data-image="${displayImage}"
             data-store="${r.store || ''}"
             data-original-title="${(r.originalTitle || r.title || '').replace(/"/g, '&quot;')}"
             style="cursor:pointer;padding:10px;border:1px solid #e0e0e0;border-radius:8px;margin-bottom:8px;background:white;display:flex;gap:10px;align-items:center;transition:all 0.2s;"
             onmouseover="this.style.borderColor='#2196f3';this.style.boxShadow='0 2px 8px rgba(33,150,243,0.2)'"
             onmouseout="this.style.borderColor='#e0e0e0';this.style.boxShadow='none'">
          ${displayImage ? `<img src="${displayImage}" style="width:80px;height:80px;object-fit:cover;border-radius:6px;" onerror="this.style.display='none'">` : '<div style="width:80px;height:80px;background:#f5f5f5;border-radius:6px;display:flex;align-items:center;justify-content:center;color:#999;font-size:0.7rem;">Sin foto</div>'}
          <div style="flex:1;min-width:0;">
            <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">
              ${r.store ? `<span style="background:#e3f2fd;color:#1565c0;padding:2px 8px;border-radius:12px;font-size:0.7rem;font-weight:bold;">${r.store}</span>` : ''}
              <strong style="font-size:0.9rem;color:#333;">${r.title}</strong>
            </div>
            <span style="color:#666;font-size:0.8rem;display:block;">${(r.snippet || '').substring(0, 150)}</span>
            <span style="color:#2196f3;font-size:0.75rem;">✅ Clic para auto-completar</span>
          </div>
        </div>`;
      }).join('');

      showResult(`<strong style="color:#333;">📦 Productos encontrados para "${query}":</strong><br><small style="color:#666;">Haz clic en un resultado:</small><br>${cards}`);
    } else {
      showResult(`<em>Sin resultados para "${query}". Intenta con otro nombre más específico.</em>`);
    }
  } catch (err) {
    showResult('Error en la búsqueda. Intenta de nuevo.');
  }
}

function buscarConSugerencia(sugerencia) {
  document.getElementById('buscarQuery').value = sugerencia;
  buscarProductoWeb();
}

// Obtener imagen desde el enlace del producto (og:image)
async function fetchImageFromLink() {
  const link = document.getElementById('productoLink').value;
  if (!link) { alert('Primero selecciona un producto (debe tener enlace)'); return; }
  
  const btn = event?.target || document.querySelector('.btn-sm.btn-primary[onclick*="fetchImageFromLink"]');
  if (btn) { btn.disabled = true; btn.textContent = '⏳...'; }
  
  try {
    const res = await fetch(`${API}/api/recognition/fetch-product-image`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: link })
    });
    const data = await res.json();
    
    if (data.image) {
      document.getElementById('productoFotoReferencia').value = data.image;
      previewRefUrl(data.image);
      showResult('✅ Imagen de referencia cargada desde la tienda');
    } else {
      alert('No se pudo obtener la imagen automáticamente. Visita el enlace, copia la URL de la imagen y pégala manualmente.');
    }
  } catch (err) {
    alert('Error al obtener imagen: ' + err.message);
  }
  
  if (btn) { btn.disabled = false; btn.textContent = '🔄 Obtener'; }
}

// Previsualizar URL de imagen pegada manualmente
function previewRefUrl(url) {
  const img = document.getElementById('fotoReferencia');
  const placeholder = document.getElementById('refPlaceholder');
  const input = document.getElementById('productoFotoReferencia');
  
  if (!url) {
    img.style.display = 'none';
    placeholder.style.display = 'flex';
    return;
  }
  
  const proxyUrl = `/api/proxy-image?url=${encodeURIComponent(url)}`;
  img.src = proxyUrl;
  img.style.display = 'inline-block';
  placeholder.style.display = 'none';
  input.value = url;
}

// ============================================
// PRODUCTS CRUD
// ============================================

async function loadProductos() {
  try {
    const res = await fetch(`${API}/api/products/admin/all`, { headers: { 'Authorization': `Bearer ${token}` } });
    if (res.status === 401) { logout(); return; }
    const productos = await res.json();
    document.getElementById('statProductos').textContent = productos.length;
    document.getElementById('productosTable').innerHTML = productos.map(p => `
      <tr>
        <td>${p.foto_url ? `<img src="${p.foto_url}" style="width:50px;height:50px;object-fit:cover;border-radius:4px;">` : '—'}</td>
        <td>${p.nombre}</td>
        <td>${p.marca || '—'}</td>
        <td>${p.precio_venta ? 'Bs. ' + p.precio_venta : '—'}</td>
        <td><span class="badge badge-${p.estado === 'publicado' ? 'success' : p.estado === 'vendido' ? 'info' : 'warning'}">${p.estado}</span></td>
        <td>
          <button class="btn-sm btn-primary" onclick="editProduct(${p.id})">Editar</button>
          <button class="btn-sm btn-danger" onclick="deleteProduct(${p.id})">Eliminar</button>
        </td>
      </tr>
    `).join('');
  } catch (err) { console.error(err); }
}

function openAddProduct() {
  document.getElementById('modalTitle').textContent = 'Agregar Producto';
  document.getElementById('productForm').reset();
  document.getElementById('productoId').value = '';
  document.getElementById('fotoPreview').style.display = 'none';
  document.getElementById('fotoReferencia').style.display = 'none';
  document.getElementById('refPlaceholder').style.display = 'flex';
  document.getElementById('productoFotoReferencia').value = '';
  document.getElementById('aiResult').style.display = 'none';
  document.getElementById('buscarQuery').value = '';
  document.getElementById('buscarQuery').focus();
  document.getElementById('productModal').classList.add('active');
}

async function editProduct(id) {
  const res = await fetch(`${API}/api/products/${id}`);
  const p = await res.json();
  document.getElementById('modalTitle').textContent = 'Editar Producto';
  document.getElementById('productoId').value = p.id;
  document.getElementById('productoNombre').value = p.nombre || '';
  document.getElementById('productoMarca').value = p.marca || '';
  document.getElementById('productoCategoria').value = p.categoria || '';
  document.getElementById('productoColor').value = p.color || '';
  document.getElementById('productoMaterial').value = p.material || '';
  document.getElementById('productoDescripcion').value = p.descripcion || '';
  document.getElementById('productoPrecioOriginal').value = p.precio_original || '';
  document.getElementById('productoPrecioVenta').value = p.precio_venta || '';
  document.getElementById('productoFuente').value = p.fuente || '';
  document.getElementById('productoLink').value = p.link_original || '';
  document.getElementById('productoEstado').value = p.estado || 'borrador';
  // Foto propia
  if (p.foto_url) {
    document.getElementById('fotoPreview').src = p.foto_url;
    document.getElementById('fotoPreview').style.display = 'block';
  } else {
    document.getElementById('fotoPreview').style.display = 'none';
  }
  // Foto de referencia
  if (p.foto_referencia) {
    previewRefUrl(p.foto_referencia);
  } else {
    document.getElementById('fotoReferencia').style.display = 'none';
    document.getElementById('refPlaceholder').style.display = 'flex';
    document.getElementById('productoFotoReferencia').value = '';
  }
  document.getElementById('productModal').classList.add('active');
}

async function deleteProduct(id) {
  if (!confirm('¿Eliminar este producto?')) return;
  await fetch(`${API}/api/products/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
  loadProductos();
}

document.getElementById('productForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('productoId').value;
  const formData = new FormData();
  formData.append('nombre', document.getElementById('productoNombre').value);
  formData.append('marca', document.getElementById('productoMarca').value);
  formData.append('categoria', document.getElementById('productoCategoria').value);
  formData.append('color', document.getElementById('productoColor').value);
  formData.append('material', document.getElementById('productoMaterial').value);
  formData.append('descripcion', document.getElementById('productoDescripcion').value);
  formData.append('precio_original', document.getElementById('productoPrecioOriginal').value);
  formData.append('precio_venta', document.getElementById('productoPrecioVenta').value);
  formData.append('fuente', document.getElementById('productoFuente').value);
  formData.append('link_original', document.getElementById('productoLink').value);
  formData.append('estado', document.getElementById('productoEstado').value);
  // Foto de referencia de Amazon
  const fotoRef = document.getElementById('productoFotoReferencia').value;
  if (fotoRef) formData.append('foto_referencia', fotoRef);

  const foto = document.getElementById('productoFoto').files[0];
  if (foto) formData.append('foto', foto);

  const url = id ? `${API}/api/products/${id}` : `${API}/api/products`;
  const method = id ? 'PUT' : 'POST';

  try {
    const res = await fetch(url, {
      method,
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData
    });

    let data;
    const text = await res.text();
    try { data = JSON.parse(text); } catch (e) { data = { error: text.substring(0, 200) }; }

    if (!res.ok) {
      alert('Error: ' + (data.error || 'Error al guardar'));
      return;
    }

    closeModal('productModal');
    loadProductos();
  } catch (err) {
    alert('Error: ' + err.message);
  }
});

function previewFoto(input) {
  if (input.files && input.files[0]) {
    const reader = new FileReader();
    reader.onload = (e) => {
      document.getElementById('fotoPreview').src = e.target.result;
      document.getElementById('fotoPreview').style.display = 'block';
    };
    reader.readAsDataURL(input.files[0]);
  }
}

// ============================================
// SALES
// ============================================

async function loadVentas() {
  try {
    const res = await fetch(`${API}/api/payment/admin/ventas`, { headers: { 'Authorization': `Bearer ${token}` } });
    const ventas = await res.json();
    document.getElementById('statVentas').textContent = ventas.length;
    const pendientes = ventas.filter(v => v.estado === 'pendiente' || v.estado === 'verificado');
    document.getElementById('statPendientes').textContent = pendientes.length;
    const ingresos = ventas.filter(v => v.estado === 'aprobada' || v.estado === 'completada').reduce((sum, v) => sum + (v.monto || 0), 0);
    document.getElementById('statIngresos').textContent = `Bs. ${ingresos}`;

    document.getElementById('ventasTable').innerHTML = ventas.map(v => `
      <tr>
        <td>#${v.id}</td>
        <td>${v.producto_nombre || '—'}</td>
        <td>${v.cliente_nombre || '—'}</td>
        <td>Bs. ${v.monto}</td>
        <td>${v.banco || '—'}</td>
        <td><span class="badge badge-${v.estado === 'aprobada' ? 'success' : v.estado === 'rechazada' ? 'danger' : 'warning'}">${v.estado}</span></td>
        <td><button class="btn-sm btn-primary" onclick="viewVenta(${v.id})">Ver</button></td>
      </tr>
    `).join('');
  } catch (err) { console.error(err); }
}

async function viewVenta(id) {
  currentVentaId = id;
  const res = await fetch(`${API}/api/payment/admin/ventas`, { headers: { 'Authorization': `Bearer ${token}` } });
  const ventas = await res.json();
  const v = ventas.find(x => x.id === id);
  if (!v) return;

  document.getElementById('ventaDetail').innerHTML = `
    <p><strong>Producto:</strong> ${v.producto_nombre}</p>
    <p><strong>Cliente:</strong> ${v.cliente_nombre || '—'}</p>
    <p><strong>Teléfono:</strong> ${v.cliente_telefono || '—'}</p>
    <p><strong>CI:</strong> ${v.cliente_ci || '—'}</p>
    <p><strong>Monto:</strong> Bs. ${v.monto}</p>
    <p><strong>Banco:</strong> ${v.banco || 'No detectado'}</p>
    <p><strong>Estado:</strong> ${v.estado}</p>
    ${v.comprobante_url ? `<p><strong>Comprobante:</strong><br><img src="${v.comprobante_url}" class="comprobante-img"></p>` : '<p>Sin comprobante</p>'}
  `;

  document.getElementById('btnAprobar').style.display = (v.estado === 'pendiente' || v.estado === 'verificado') ? 'inline-block' : 'none';
  document.getElementById('btnRechazar').style.display = (v.estado === 'pendiente' || v.estado === 'verificado') ? 'inline-block' : 'none';
  document.getElementById('ventaModal').classList.add('active');
}

async function aprobarVenta() {
  if (!confirm('¿Aprobar esta venta?')) return;
  await fetch(`${API}/api/payment/aprobar/${currentVentaId}`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` } });
  closeModal('ventaModal');
  loadVentas();
  loadProductos();
}

async function rechazarVenta() {
  const motivo = prompt('Motivo del rechazo:');
  if (!motivo) return;
  await fetch(`${API}/api/payment/rechazar/${currentVentaId}`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ motivo })
  });
  closeModal('ventaModal');
  loadVentas();
}

function closeModal(id) {
  document.getElementById(id).classList.remove('active');
}

loadProductos();
