const http = require('http');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const BASE_URL = 'http://localhost:3000';
let TOKEN = '';
let passed = 0;
let failed = 0;

function request(method, urlPath, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, BASE_URL);
    const bodyStr = body ? (typeof body === 'string' ? body : JSON.stringify(body)) : null;
    const options = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });

    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

function curlCommand(cmd) {
  try {
    const result = execSync(cmd, { encoding: 'utf-8', timeout: 10000 });
    return result.trim();
  } catch (e) {
    return e.stdout ? e.stdout.trim() : '';
  }
}

function test(name, fn) {
  return fn().then(result => {
    if (result) {
      console.log(`  ✓ ${name}`);
      passed++;
    } else {
      console.log(`  ✗ ${name}`);
      failed++;
    }
  }).catch(err => {
    console.log(`  ✗ ${name}: ${err.message}`);
    failed++;
  });
}

async function runTests() {
  console.log('\n=== Integration Tests ===\n');

  // Test 1: Login
  await test('Login with valid credentials', async () => {
    const res = await request('POST', '/api/auth/login', { usuario: 'admin', password: 'admin123' });
    if (res.status !== 200 || !res.body.token) return false;
    TOKEN = res.body.token;
    console.log(`    Token: ${TOKEN.substring(0, 20)}...`);
    return true;
  });

  // Test 2: Login with wrong password
  await test('Login with wrong password fails', async () => {
    const res = await request('POST', '/api/auth/login', { usuario: 'admin', password: 'wrong' });
    return res.status === 401;
  });

  // Test 3: Create product
  await test('Create product', async () => {
    // Use curl for multipart form data since it's simpler
    const curlResult = curlCommand(
      `curl -s -X POST ${BASE_URL}/api/products -H "Authorization: Bearer ${TOKEN}" -F "nombre=Camiseta Nike Dri-FIT" -F "marca=Nike" -F "precio_venta=45" -F "estado=publicado" -F "categoria=Ropa deportiva" -F "color=Negro"`
    );
    try {
      const product = JSON.parse(curlResult);
      if (product.error) {
        console.log(`    Error: ${product.error}`);
        return false;
      }
      console.log(`    Product ID: ${product.id}`);
      return product.nombre === 'Camiseta Nike Dri-FIT';
    } catch (e) {
      console.log(`    Parse error: ${curlResult.substring(0, 100)}`);
      return false;
    }
  });

  // Test 4: Create second product
  await test('Create second product', async () => {
    const curlResult = curlCommand(
      `curl -s -X POST ${BASE_URL}/api/products -H "Authorization: Bearer ${TOKEN}" -F "nombre=Zapatillas Adidas" -F "marca=Adidas" -F "precio_venta=85" -F "estado=publicado" -F "categoria=Calzado" -F "color=Blanco"`
    );
    const product = JSON.parse(curlResult);
    return !product.error && product.nombre === 'Zapatillas Adidas';
  });

  // Test 5: List public products
  await test('List public products', async () => {
    const res = await request('GET', '/api/products');
    return res.status === 200 && Array.isArray(res.body) && res.body.length >= 2;
  });

  // Test 6: Get single product
  await test('Get single product', async () => {
    const res = await request('GET', '/api/products/1');
    return res.status === 200 && res.body.id === 1;
  });

  // Test 7: Admin list all products
  await test('Admin list all products', async () => {
    const curlResult = curlCommand(
      `curl -s ${BASE_URL}/api/products/admin/all -H "Authorization: Bearer ${TOKEN}"`
    );
    const products = JSON.parse(curlResult);
    return Array.isArray(products) && products.length >= 2;
  });

  // Test 8: Buy product
  await test('Buy product (create sale)', async () => {
    const res = await request('POST', '/api/payment/comprar', {
      producto_id: 1,
      cliente_nombre: 'Juan Perez',
      cliente_telefono: '70123456',
      cliente_ci: '1234567'
    });
    if (res.status !== 201) {
      console.log(`    Status: ${res.status}, Body: ${JSON.stringify(res.body)}`);
      return false;
    }
    console.log(`    Sale ID: ${res.body.id}, Estado: ${res.body.estado}`);
    return res.body.estado === 'pendiente';
  });

  // Test 9: Generate QR
  await test('Generate QR for product', async () => {
    const res = await request('GET', '/api/payment/qr/1');
    return res.status === 200 && res.body.qr && res.body.qr.startsWith('data:image');
  });

  // Test 10: Get sales (admin)
  await test('Get sales (admin)', async () => {
    const curlResult = curlCommand(
      `curl -s ${BASE_URL}/api/payment/admin/ventas -H "Authorization: Bearer ${TOKEN}"`
    );
    const ventas = JSON.parse(curlResult);
    return Array.isArray(ventas) && ventas.length >= 1;
  });

  // Test 11: Approve sale
  await test('Approve sale', async () => {
    const curlResult = curlCommand(
      `curl -s -X POST ${BASE_URL}/api/payment/aprobar/1 -H "Authorization: Bearer ${TOKEN}"`
    );
    const venta = JSON.parse(curlResult);
    return venta.estado === 'aprobada';
  });

  // Test 12: Verify pages load
  await test('Pages load (index.html)', async () => {
    const curlResult = curlCommand(`curl -s -o /dev/null -w "%{http_code}" ${BASE_URL}/`);
    return curlResult === '200';
  });

  await test('Pages load (login.html)', async () => {
    const curlResult = curlCommand(`curl -s -o /dev/null -w "%{http_code}" ${BASE_URL}/login.html`);
    return curlResult === '200';
  });

  await test('Pages load (admin.html)', async () => {
    const curlResult = curlCommand(`curl -s -o /dev/null -w "%{http_code}" ${BASE_URL}/admin.html`);
    return curlResult === '200';
  });

  await test('Pages load (producto.html)', async () => {
    const curlResult = curlCommand(`curl -s -o /dev/null -w "%{http_code}" ${BASE_URL}/producto.html`);
    return curlResult === '200';
  });

  // Test 13: Auth verify
  await test('Auth verify endpoint', async () => {
    const curlResult = curlCommand(
      `curl -s ${BASE_URL}/api/auth/verify -H "Authorization: Bearer ${TOKEN}"`
    );
    const result = JSON.parse(curlResult);
    return result.valid === true;
  });

  // Test 14: Unauthorized access
  await test('Unauthorized access rejected', async () => {
    const res = await request('GET', '/api/products/admin/all');
    return res.status === 401;
  });

  // Test 15: Get single product not found
  await test('Get non-existent product returns 404', async () => {
    const res = await request('GET', '/api/products/9999');
    return res.status === 404;
  });

  // Summary
  console.log(`\n=== Results: ${passed} passed, ${failed} failed, ${passed + failed} total ===`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(err => {
  console.error('Test runner error:', err);
  process.exit(1);
});
