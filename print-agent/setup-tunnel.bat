@echo off
setlocal EnableDelayedExpansion
title LogosPOS — Configuracion del Tunel de Impresion

echo.
echo  ================================================
echo   LogosPOS - Configuracion Tunel de Impresion
echo  ================================================
echo.

:: Pedir nombre del negocio para identificar el tunel
set /p NOMBRE_LOCAL="Nombre del negocio (ej: restaurante-norte): "
if "%NOMBRE_LOCAL%"=="" set NOMBRE_LOCAL=print-agent-%RANDOM%
set TUNNEL_NAME=logospos-%NOMBRE_LOCAL%

echo.
echo [1/4] Verificando cloudflared...
where cloudflared >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo      cloudflared no encontrado. Instalando...
    winget install --id Cloudflare.cloudflared --accept-source-agreements --accept-package-agreements
    if %ERRORLEVEL% NEQ 0 (
        echo.
        echo ERROR: No se pudo instalar cloudflared automaticamente.
        echo Descargalo manualmente desde: https://github.com/cloudflare/cloudflared/releases
        echo Coloca cloudflared.exe en C:\Windows\System32\ y vuelve a ejecutar este script.
        pause
        exit /b 1
    )
    echo      cloudflared instalado correctamente.
) else (
    echo      cloudflared ya esta instalado.
)

echo.
echo [2/4] Iniciando sesion en Cloudflare...
echo      Se abrira el navegador para autenticarte.
echo      Inicia sesion con tu cuenta de Cloudflare (gratuita).
echo.
pause
cloudflared tunnel login
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: No se pudo autenticar en Cloudflare.
    pause
    exit /b 1
)

echo.
echo [3/4] Creando tunel: %TUNNEL_NAME%
cloudflared tunnel create %TUNNEL_NAME%
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: No se pudo crear el tunel.
    pause
    exit /b 1
)

:: Obtener el UUID del tunel creado
for /f "tokens=*" %%i in ('cloudflared tunnel info %TUNNEL_NAME% ^| findstr /r "[0-9a-f]\{8\}-"') do (
    set TUNNEL_LINE=%%i
)
echo.

:: Crear archivo de configuracion para cloudflared
set CONFIG_DIR=%USERPROFILE%\.cloudflared
if not exist "%CONFIG_DIR%" mkdir "%CONFIG_DIR%"

:: Obtener UUID del archivo de credenciales generado
for /f %%f in ('dir /b "%CONFIG_DIR%\*.json" 2^>nul') do set CRED_FILE=%CONFIG_DIR%\%%f

echo      Creando configuracion...
(
    echo tunnel: %TUNNEL_NAME%
    echo credentials-file: %CRED_FILE%
    echo.
    echo ingress:
    echo   - service: http://localhost:3000
) > "%CONFIG_DIR%\config.yml"

echo.
echo [4/4] Instalando cloudflared como servicio Windows...
cloudflared service install
net start cloudflared

echo.
echo  ================================================
echo   CONFIGURACION COMPLETADA
echo  ================================================
echo.
echo  Tu URL permanente del tunel es:
cloudflared tunnel info %TUNNEL_NAME%
echo.
echo  PASOS FINALES:
echo  1. Copia la URL que aparece arriba (https://...cfargotunnel.com)
echo  2. En LogosPOS: Restaurante ^> Impresoras ^> URL del agente
echo  3. Pega la URL y haz click en Guardar
echo  4. Verifica que el badge aparezca en verde
echo.
pause
