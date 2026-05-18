/**
 * LogosPOS — Generador de certificado TLS autofirmado
 *
 * Genera cert.pem y key.pem en la carpeta ./certs/ sin dependencias externas.
 * Usa OpenSSL (buscado automáticamente) o PowerShell como fallback.
 *
 * Uso:
 *   node gen-cert.js
 *
 * Luego:
 *   1. Reinicia el agente:  node server.js
 *   2. Abre https://localhost:3443 en Chrome → Avanzado → Continuar de todas formas
 *      (solo la primera vez, por el cert autofirmado)
 *   3. En la app → Impresoras → URL del agente:  https://localhost:3443
 */

const { execSync, spawnSync } = require('child_process');
const fs   = require('fs');
const path = require('path');

const CERT_DIR  = path.join(__dirname, 'certs');
const CERT_FILE = path.join(CERT_DIR, 'cert.pem');
const KEY_FILE  = path.join(CERT_DIR, 'key.pem');

if (!fs.existsSync(CERT_DIR)) fs.mkdirSync(CERT_DIR, { recursive: true });

// ── Buscar openssl en rutas comunes de Windows ─────────────────
const OPENSSL_CANDIDATES = [
  'openssl',
  'C:\\Program Files\\Git\\usr\\bin\\openssl.exe',
  'C:\\Program Files\\Git\\mingw64\\bin\\openssl.exe',
  'C:\\Program Files (x86)\\Git\\usr\\bin\\openssl.exe',
  'C:\\Program Files\\OpenSSL-Win64\\bin\\openssl.exe',
  'C:\\OpenSSL-Win64\\bin\\openssl.exe',
];

function findOpenSSL() {
  for (const candidate of OPENSSL_CANDIDATES) {
    try {
      const r = spawnSync(candidate, ['version'], { encoding: 'utf8', windowsHide: true });
      if (r.status === 0 && r.stdout.includes('OpenSSL')) return candidate;
    } catch {}
  }
  return null;
}

// ── Método 1: OpenSSL ──────────────────────────────────────────
function generarConOpenSSL(opensslBin) {
  console.log(`   Usando: ${opensslBin}`);
  const subj = '/CN=localhost/O=LogosPOS/C=DO';
  const san  = 'subjectAltName=IP:127.0.0.1,DNS:localhost';

  execSync(
    `"${opensslBin}" req -x509 -newkey rsa:2048 ` +
    `-keyout "${KEY_FILE}" -out "${CERT_FILE}" ` +
    `-days 825 -nodes -subj "${subj}" -addext "${san}"`,
    { stdio: 'inherit', windowsHide: true }
  );
}

// ── Método 2: PowerShell New-SelfSignedCertificate ────────────
function generarConPowerShell() {
  console.log('   Usando: PowerShell New-SelfSignedCertificate');

  const tmpPfx = path.join(CERT_DIR, '_tmp.pfx');
  const tmpPwd = 'logos_tmp_' + Date.now();

  // Crear certificado en el store del usuario y exportarlo a PFX
  const psScript = `
    $cert = New-SelfSignedCertificate \`
      -Subject "CN=localhost" \`
      -DnsName "localhost" \`
      -KeyAlgorithm RSA -KeyLength 2048 \`
      -CertStoreLocation "Cert:\\CurrentUser\\My" \`
      -NotAfter (Get-Date).AddDays(825) \`
      -KeyUsage DigitalSignature,KeyEncipherment \`
      -TextExtension @("2.5.29.17={text}IP Address=127.0.0.1&DNS Name=localhost")

    $pwd = ConvertTo-SecureString -String "${tmpPwd}" -Force -AsPlainText
    Export-PfxCertificate -Cert $cert -FilePath "${tmpPfx.replace(/\\/g, '\\\\')}" -Password $pwd | Out-Null

    # Limpiar del store
    Remove-Item -Path "Cert:\\CurrentUser\\My\\$($cert.Thumbprint)" -Force
    Write-Output "OK"
  `.trim();

  const r = spawnSync('powershell', ['-NoProfile', '-Command', psScript], {
    encoding: 'utf8', windowsHide: true
  });

  if (!r.stdout.includes('OK') || r.status !== 0) {
    throw new Error(r.stderr || 'PowerShell falló al crear el certificado');
  }

  // Convertir PFX → PEM usando openssl de Git si está disponible para este paso
  // Alternativa: usar el módulo crypto de Node (requiere Node 22+)
  const opensslForConvert = findOpenSSL();
  if (opensslForConvert) {
    execSync(
      `"${opensslForConvert}" pkcs12 -in "${tmpPfx}" -nocerts -nodes -out "${KEY_FILE}" -password pass:${tmpPwd}`,
      { windowsHide: true }
    );
    execSync(
      `"${opensslForConvert}" pkcs12 -in "${tmpPfx}" -nokeys -clcerts -out "${CERT_FILE}" -password pass:${tmpPwd}`,
      { windowsHide: true }
    );
  } else {
    // Extraer PEM del PFX con PowerShell puro
    const psExtract = `
      $pwd = ConvertTo-SecureString -String "${tmpPwd}" -Force -AsPlainText
      $pfx = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2(
        "${tmpPfx.replace(/\\/g, '\\\\')}",
        $pwd,
        [System.Security.Cryptography.X509Certificates.X509KeyStorageFlags]::Exportable
      )
      # Exportar cert
      $certBytes = $pfx.Export([System.Security.Cryptography.X509Certificates.X509ContentType]::Cert)
      $certB64   = [Convert]::ToBase64String($certBytes, [System.Base64FormattingOptions]::InsertLineBreaks)
      Set-Content -Path "${CERT_FILE.replace(/\\/g, '\\\\')}" -Value "-----BEGIN CERTIFICATE-----\`n$certB64\`n-----END CERTIFICATE-----"
      # Exportar llave privada
      $rsa     = [System.Security.Cryptography.X509Certificates.RSACertificateExtensions]::GetRSAPrivateKey($pfx)
      $keyBytes = $rsa.ExportRSAPrivateKey()
      $keyB64   = [Convert]::ToBase64String($keyBytes, [System.Base64FormattingOptions]::InsertLineBreaks)
      Set-Content -Path "${KEY_FILE.replace(/\\/g, '\\\\')}" -Value "-----BEGIN RSA PRIVATE KEY-----\`n$keyB64\`n-----END RSA PRIVATE KEY-----"
      Write-Output "DONE"
    `.trim();

    const r2 = spawnSync('powershell', ['-NoProfile', '-Command', psExtract], {
      encoding: 'utf8', windowsHide: true
    });
    if (!r2.stdout.includes('DONE')) {
      throw new Error(r2.stderr || 'Error exportando PEM desde PFX');
    }
  }

  // Limpiar archivo temporal
  try { fs.unlinkSync(tmpPfx); } catch {}
}

// ── Main ───────────────────────────────────────────────────────
console.log('🔐 Generando certificado TLS autofirmado para LogosPOS Print Agent...\n');

try {
  const opensslBin = findOpenSSL();

  if (opensslBin) {
    generarConOpenSSL(opensslBin);
  } else {
    console.log('   OpenSSL no encontrado, usando PowerShell...');
    generarConPowerShell();
  }

  if (!fs.existsSync(CERT_FILE) || !fs.existsSync(KEY_FILE)) {
    throw new Error('Los archivos PEM no fueron creados correctamente.');
  }

  console.log('\n✅ Certificado generado correctamente:');
  console.log(`   Cert: ${CERT_FILE}`);
  console.log(`   Key:  ${KEY_FILE}`);
  console.log('\n📋 Próximos pasos:');
  console.log('   1. Reinicia el agente (PowerShell Admin):');
  console.log('      net stop LogosPOS-PrintAgent && net start LogosPOS-PrintAgent');
  console.log('      — o manualmente:  node server.js');
  console.log('   2. Abre en Chrome:  https://localhost:3443');
  console.log('      → Haz click en "Avanzado" → "Continuar de todas formas" (solo una vez)');
  console.log('   3. En la app → Impresoras → URL del agente:  https://localhost:3443');
  console.log('   4. Haz click en ↺ para verificar el estado del agente\n');

} catch (e) {
  console.error('\n❌ Error generando certificado:', e.message);
  console.error('\n   Alternativas manuales:');
  console.error('   A) Instala Git for Windows (https://git-scm.com) y vuelve a ejecutar.');
  console.error('   B) Usa la URL http://localhost:3000 (solo funciona desde este mismo PC).\n');
  process.exit(1);
}
