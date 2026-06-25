const Tesseract = require('tesseract.js');

const BANCOS_BOLIVIA = [
  { nombre: 'BCP', patrones: ['bcp', 'banco de credito', 'credito de bolivia', 'credito'] },
  { nombre: 'BNB', patrones: ['bnb', 'banco nacional de bolivia', 'nacional de bolivia'] },
  { nombre: 'BOA', patrones: ['boa', 'banco de amazonia', 'banco amazonia'] },
  { nombre: 'BUN', patrones: ['bun', 'banco union', 'unión'] },
  { nombre: 'BIS', patrones: ['bis', 'banco industrial', 'industrial'] },
  { nombre: 'FIE', patrones: ['fie', 'fie'] },
  { nombre: 'UNI', patrones: ['uni', 'union', 'unión'] },
  { nombre: 'Mercado Pago', patrones: ['mercado pago', 'mercadopago'] },
  { nombre: 'Tigo Money', patrones: ['tigo', 'tigo money'] },
  { nombre: 'eVo', patrones: ['evo', 'evobo'] },
];

function detectarBanco(textoOcr) {
  const lower = textoOcr.toLowerCase();
  for (const banco of BANCOS_BOLIVIA) {
    for (const patron of banco.patrones) {
      if (lower.includes(patron)) return banco.nombre;
    }
  }
  return 'No detectado';
}

function extraerMonto(textoOcr) {
  const lineas = textoOcr.split('\n');
  const montos = [];

  for (const linea of lineas) {
    const lower = linea.toLowerCase();

    if (lower.includes('pago') || lower.includes('monto') || lower.includes('total') || lower.includes('importe') || lower.includes('bs') || lower.includes('bs.')) {
      const coincidencias = linea.match(/(\d+[\.,]\d{2})/g);
      if (coincidencias) {
        for (const c of coincidencias) {
          const monto = parseFloat(c.replace(',', '.'));
          if (monto > 0 && monto < 100000) montos.push(monto);
        }
      }
    }

    const todosMontos = linea.match(/(\d+[\.,]\d{2})/g);
    if (todosMontos) {
      for (const c of todosMontos) {
        const monto = parseFloat(c.replace(',', '.'));
        if (monto > 0 && monto < 100000) montos.push(monto);
      }
    }
  }

  if (montos.length === 0) return 0;
  return Math.max(...montos);
}

function extraerFecha(textoOcr) {
  const patrones = [
    /(\d{2})[\/\-](\d{2})[\/\-](\d{4})/,
    /(\d{4})[\/\-](\d{2})[\/\-](\d{2})/,
  ];
  for (const patron of patrones) {
    const match = textoOcr.match(patron);
    if (match) {
      if (match[3] && match[3].length === 4) return `${match[1]}/${match[2]}/${match[3]}`;
      if (match[1] && match[1].length === 4) return `${match[3]}/${match[2]}/${match[1]}`;
    }
  }
  return '';
}

async function verifyPaymentReceipt(imageBuffer, expectedAmount) {
  try {
    const { data: { text } } = await Tesseract.recognize(imageBuffer, 'spa+eng', {
      logger: m => {
        if (m.status === 'recognizing text') {
          console.log(`OCR Progress: ${Math.round(m.progress * 100)}%`);
        }
      }
    });

    console.log('=== OCR RESULTADO ===');
    console.log(text);
    console.log('=== FIN OCR ===');

    const banco = detectarBanco(text);
    const montoDetectado = extraerMonto(text);
    const fecha = extraerFecha(text);

    const montoEsValido = montoDetectado > 0 && Math.abs(montoDetectado - expectedAmount) < 1;
    const bancoDetectado = banco !== 'No detectado';
    const esValido = montoEsValido && bancoDetectado;

    let observaciones = '';
    if (!bancoDetectado) observaciones += 'No se detectó banco. ';
    if (montoDetectado === 0) observaciones += 'No se pudo leer el monto. ';
    else if (!montoEsValido) observaciones += `Monto detectado: Bs. ${montoDetectado}, esperado: Bs. ${expectedAmount}. `;
    if (!fecha) observaciones += 'No se pudo leer la fecha. ';

    return {
      banco,
      monto_detectado: montoDetectado,
      fecha,
      monto_esperado: expectedAmount,
      monto_es_valido: montoEsValido,
      es_valido: esValido,
      observaciones: observaciones.trim() || 'Comprobante verificado correctamente',
      texto_ocr: text.substring(0, 500),
    };
  } catch (e) {
    console.error('Error en OCR:', e.message || e);
    return {
      banco: 'Error',
      monto_detectado: 0,
      fecha: '',
      monto_esperado: expectedAmount,
      monto_es_valido: false,
      es_valido: false,
      observaciones: 'Error al procesar imagen: ' + (e.message || 'Desconocido'),
      texto_ocr: '',
    };
  }
}

module.exports = { verifyPaymentReceipt };
