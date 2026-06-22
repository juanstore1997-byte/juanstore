const API = '';
let allProducts = [];
let cart = JSON.parse(localStorage.getItem('cart') || '[]');

// ============================================
// NAVBAR SCROLL
// ============================================
window.addEventListener('scroll', () => {
  const navbar = document.getElementById('navbar');
  if (window.scrollY > 10) {
    navbar.classList.add('scrolled');
  } else {
    navbar.classList.remove('scrolled');
  }
});

function toggleMobileMenu() {
  document.getElementById('navLinks').classList.toggle('active');
}

// ============================================
// CART
// ============================================
function updateCartCount() {
  const badge = document.getElementById('cartCount');
  if (cart.length > 0) {
    badge.style.display = 'flex';
    badge.textContent = cart.length;
  } else {
    badge.style.display = 'none';
  }
}

function addToCart(product) {
  cart.push(product);
  localStorage.setItem('cart', JSON.stringify(cart));
  updateCartCount();

  // Show mini feedback
  const btn = event.target.closest('.btn-comprar');
  if (btn) {
    const original = btn.innerHTML;
    btn.innerHTML = '✓ Agregado';
    btn.style.background = '#059669';
    setTimeout(() => {
      btn.innerHTML = original;
      btn.style.background = '';
    }, 1500);
  }
}

// ============================================
// PRODUCTS
// ============================================
async function cargarProductos() {
  const grid = document.getElementById('productosGrid');

  try {
    const response = await fetch(`${API}/api/products`);
    const productos = await response.json();

    allProducts = productos;

    // Update stat
    const statEl = document.getElementById('statProductos');
    if (statEl) statEl.textContent = productos.length + '+';

    if (productos.length === 0) {
      grid.innerHTML = `
        <div class="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>
          <h3>No hay productos disponibles</h3>
          <p>Pronto agregaremos nuevos productos a nuestro catálogo</p>
        </div>`;
      return;
    }

    renderProducts(productos);
  } catch (err) {
    grid.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        <h3>Error cargando productos</h3>
        <p>Intenta recargar la página</p>
      </div>`;
  }
}

function renderProducts(productos) {
  const grid = document.getElementById('productosGrid');

  grid.innerHTML = productos.map((p, i) => `
    <div class="producto-card animate-in" onclick="verProducto(${p.id})">
      <div class="producto-card-img">
        ${p.foto_url
          ? `<img src="${p.foto_url}" alt="${p.nombre}" loading="lazy">`
          : `<div class="no-image">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
              <span>Sin imagen</span>
            </div>`
        }
        ${p.estado === 'publicado' ? '<span class="producto-card-badge">Nuevo</span>' : ''}
      </div>
      <div class="producto-card-body">
        ${p.marca ? `<div class="producto-card-marca">${p.marca}</div>` : ''}
        <div class="producto-card-nombre">${p.nombre}</div>
        <div class="producto-card-precio">Bs. ${p.precio_venta}</div>
      </div>
      <div class="producto-card-footer">
        <button class="btn-comprar" onclick="event.stopPropagation();addToCart(${JSON.stringify(p).replace(/"/g, '&quot;')})">Comprar</button>
        <button class="btn-view" onclick="event.stopPropagation();verProducto(${p.id})" title="Ver detalle">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
        </button>
      </div>
    </div>
  `).join('');
}

function filterProducts() {
  const query = document.getElementById('searchInput').value.toLowerCase().trim();
  if (!query) {
    renderProducts(allProducts);
    return;
  }
  const filtered = allProducts.filter(p =>
    (p.nombre || '').toLowerCase().includes(query) ||
    (p.marca || '').toLowerCase().includes(query) ||
    (p.categoria || '').toLowerCase().includes(query) ||
    (p.descripcion || '').toLowerCase().includes(query)
  );
  renderProducts(filtered);
}

function verProducto(id) {
  window.location.href = `/producto.html?id=${id}`;
}

// ============================================
// INIT
// ============================================
updateCartCount();
cargarProductos();
