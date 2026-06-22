document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const usuario = document.getElementById('usuario').value;
  const password = document.getElementById('password').value;
  const errorDiv = document.getElementById('error');

  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usuario, password })
    });

    const data = await response.json();

    if (data.token) {
      localStorage.setItem('token', data.token);
      localStorage.setItem('admin', data.usuario);
      window.location.href = '/admin.html';
    } else {
      errorDiv.textContent = data.error || 'Error de login';
    }
  } catch (err) {
    errorDiv.textContent = 'Error de conexión';
  }
});
