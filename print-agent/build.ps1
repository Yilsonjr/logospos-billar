# ============================================================
# LogosPOS Print Agent — Build Script
# Genera print-agent.exe usando Node.js SEA (Single Executable)
# Requiere: Node.js 20+ y conexión a internet (para postject)
# Uso: powershell -ExecutionPolicy Bypass -File build.ps1
# ============================================================

$ErrorActionPreference = 'Stop'
$AgentName = 'print-agent'
$DistDir   = Join-Path $PSScriptRoot 'dist'

Write-Host "`n🔨 LogosPOS Print Agent — Build`n" -ForegroundColor Cyan

# 1. Verificar Node.js
try {
    $nodeVer = node --version
    Write-Host "   Node.js: $nodeVer" -ForegroundColor Green
} catch {
    Write-Host "❌ Node.js no encontrado. Instala desde https://nodejs.org" -ForegroundColor Red
    exit 1
}

# 2. Instalar postject si no está disponible
Write-Host "`n[1/5] Verificando postject..."
$postjectOk = $false
try {
    $null = npx postject --version 2>$null
    $postjectOk = $true
} catch {}
if (-not $postjectOk) {
    Write-Host "      Instalando postject..." -ForegroundColor Yellow
    npm install --save-dev postject
}

# 3. Generar blob SEA
Write-Host "[2/5] Generando blob SEA..."
node --experimental-sea-config sea-config.json
if (-not (Test-Path 'sea-prep.blob')) {
    Write-Host "❌ Error generando el blob SEA." -ForegroundColor Red
    exit 1
}

# 4. Crear directorio dist y copiar node.exe
Write-Host "[3/5] Preparando ejecutable base..."
if (-not (Test-Path $DistDir)) { New-Item -ItemType Directory $DistDir | Out-Null }
$exePath = Join-Path $DistDir "$AgentName.exe"
$nodePath = (Get-Command node).Source
Copy-Item $nodePath $exePath -Force

# 5. Quitar firma (necesario en Windows antes de inyectar)
Write-Host "[4/5] Inyectando blob en el ejecutable..."
$signtool = Get-Command signtool -ErrorAction SilentlyContinue
if ($signtool) {
    Write-Host "      Removiendo firma de node.exe..."
    & signtool remove /s $exePath 2>$null
}

npx postject $exePath NODE_SEA_BLOB sea-prep.blob `
    --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2

# 6. Limpiar
Write-Host "[5/5] Limpiando archivos temporales..."
Remove-Item 'sea-prep.blob' -ErrorAction SilentlyContinue

# 7. Resultado
$sizeKB = [math]::Round((Get-Item $exePath).Length / 1KB)
Write-Host "`n✅ Build completado!" -ForegroundColor Green
Write-Host "   Ejecutable: $exePath ($sizeKB KB)"
Write-Host "`n📦 Archivos para distribuir:"
Write-Host "   dist\print-agent.exe         — El agente"
Write-Host "   instalar-servicio.bat         — Instala como servicio Windows"
Write-Host "   INSTALACION.md                — Manual de instalación"
Write-Host "`n🚀 Uso en el PC de destino (sin Node.js):"
Write-Host "   print-agent.exe               — Iniciar el agente"
Write-Host "   print-agent.exe --gen-cert    — Generar certificado HTTPS"
Write-Host ""
