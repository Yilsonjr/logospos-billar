# LogosPOS — Agente de Impresión Local

Servidor HTTP que corre en el PC del negocio y recibe comandos de la app web para imprimir en impresoras térmicas (red TCP o USB).

---

## Requisitos antes de empezar

| Requisito | Detalle |
|-----------|---------|
| Windows 10 u 11 | 64-bit |
| Node.js v20+ | Solo si usas el script. Descargar: https://nodejs.org |
| Conexión a Internet | Para descargar NSSM automáticamente la primera vez |
| Impresora térmica | Conectada por red (TCP/IP) o por USB |

> **NSSM** se descarga automáticamente al ejecutar el instalador. No necesitas descargarlo manualmente.

---

## Paso 1 — Copiar archivos al PC del negocio

Copia la carpeta `print-agent` completa al PC donde están las impresoras. Recomendado:

```
C:\LogosPOS\print-agent\
```

La estructura debe quedar así:
```
C:\LogosPOS\print-agent\
  server.js
  package.json
  instalar-servicio.bat
  instalar-servicio.ps1
  desinstalar-servicio.bat
  desinstalar-servicio.ps1
  gen-cert.js
  INSTALACION.md
```

---

## Paso 2 — Instalar como servicio Windows

1. Abre la carpeta `C:\LogosPOS\print-agent\` en el Explorador
2. Haz **clic derecho** en `instalar-servicio.bat`
3. Selecciona **"Ejecutar como administrador"**
4. El script hace automáticamente:
   - Detecta si hay `print-agent.exe` o `server.js`
   - Descarga NSSM si no está presente
   - Registra el servicio `LogosPOS-PrintAgent`
   - Abre el puerto 3000 en el Firewall de Windows
   - Inicia el servicio

5. Al finalizar debe mostrar:
```
  Instalacion completada exitosamente
  Agente activo en:  http://localhost:3000
```

### Verificar que funciona

Abre el navegador en ese mismo PC y ve a:
```
http://localhost:3000/health
```

Debe responder:
```json
{"status":"ok","agent":"LogosPOS Print Agent","version":"1.0.0"}
```

Si no responde, revisa el paso de solución de problemas al final.

---

## Paso 3 — Exponer el agente a internet (Cloudflare Tunnel)

La app web corre en HTTPS. Para que pueda comunicarse con el agente local necesitas un túnel.

### 3.1 Instalar cloudflared

Abre PowerShell como Administrador y ejecuta:
```powershell
winget install --id Cloudflare.cloudflared
```

Cierra y abre PowerShell de nuevo para que reconozca el comando.

### 3.2 Autenticarse en Cloudflare

```powershell
cloudflared tunnel login
```

Se abre el navegador. Inicia sesión en tu cuenta de Cloudflare (gratuita en https://cloudflare.com) y autoriza.

### 3.3 Crear el túnel (una sola vez por local)

```powershell
cloudflared tunnel create print-agent-nombre-del-local
```

Ejemplo:
```powershell
cloudflared tunnel create print-agent-burgos
```

Anota el **UUID** que aparece. Ejemplo: `a1b2c3d4-...`

### 3.4 Crear archivo de configuración

Crea el archivo `C:\Users\TU_USUARIO\.cloudflared\config.yml` con este contenido exacto (reemplaza `<UUID>`):

```yaml
tunnel: <UUID>
credentials-file: C:\Users\TU_USUARIO\.cloudflared\<UUID>.json

ingress:
  - service: http://localhost:3000
```

> **Importante:** reemplaza `TU_USUARIO` con tu nombre de usuario de Windows (el que aparece en `C:\Users\`)

### 3.5 Instalar el túnel como servicio Windows

```powershell
cloudflared service install
net start cloudflared
```

### 3.6 Obtener la URL del túnel

```powershell
cloudflared tunnel info print-agent-nombre-del-local
```

La URL será del tipo:
```
https://a1b2c3d4-xxxx.cfargotunnel.com
```

Esta URL **nunca cambia** aunque reinicies el PC. Guárdala.

### 3.7 Verificar el túnel

Desde cualquier dispositivo con internet:
```
https://TU-URL.cfargotunnel.com/health
```

Debe responder el mismo JSON de antes. Si no responde, el túnel no está activo.

---

## Paso 4 — Configurar en la app LogosPOS

1. Inicia sesión con el usuario del negocio
2. Ve a **Restaurante → Impresoras**
3. En la sección **"Agente de Impresión Local"**, pega la URL del túnel:
   ```
   https://TU-URL.cfargotunnel.com
   ```
4. Clic en **Guardar**
5. Clic en el botón **↺** (actualizar/verificar)
6. Debe aparecer el badge verde **"Agente conectado"**

Si aparece rojo, la URL no está correcta o el servicio no está corriendo.

---

## Paso 5 — Agregar impresoras

Por cada impresora física:

1. Clic en **Nueva Impresora**
2. Completa el formulario:

**Impresora de red (TCP/IP):**
- Tipo de conexión: **Red / TCP-IP**
- Dirección IP: `192.168.x.x` (IP de la impresora en la red local)
- Puerto TCP: `9100` (estándar ESC/POS)

**Impresora USB:**
- Tipo de conexión: **USB (local)**
- Clic en **Detectar** para listar las impresoras instaladas en Windows
- Selecciona la que corresponde

3. Asigna el tipo de estación (Cocina, Caja, Barra, etc.)
4. Clic en **Registrar impresora**
5. Usa el botón **Prueba** para verificar que imprime

---

## Comandos útiles

```powershell
# Ver estado del agente
net start LogosPOS-PrintAgent

# Detener el agente
net stop LogosPOS-PrintAgent

# Reiniciar el agente
net stop LogosPOS-PrintAgent && net start LogosPOS-PrintAgent

# Ver logs del agente
Get-Content "C:\LogosPOS\print-agent\logs\agent.log" -Tail 50

# Ver errores del agente
Get-Content "C:\LogosPOS\print-agent\logs\agent-error.log" -Tail 50

# Ver estado del túnel
net start cloudflared
```

---

## Solución de problemas

### ❌ "Agente desconectado" en la app

Verifica en orden:

1. **¿Está corriendo el agente?**
   ```powershell
   Get-Service LogosPOS-PrintAgent
   ```
   Si no está `Running`: `net start LogosPOS-PrintAgent`

2. **¿Está corriendo el túnel?**
   ```powershell
   Get-Service cloudflared
   ```
   Si no está `Running`: `net start cloudflared`

3. **¿Responde el health localmente?**
   Abre en el PC del agente: `http://localhost:3000/health`

4. **¿Responde el health por el túnel?**
   Desde otro dispositivo: `https://TU-URL.cfargotunnel.com/health`

5. **¿La URL en la app es correcta?**
   Sin `/` al final, con `https://`.

---

### ❌ El instalador falla en "Descargando NSSM"

El PC no tiene internet durante la instalación. Solución manual:

1. Descarga desde otro PC: https://nssm.cc/release/nssm-2.24.zip
2. Extrae el archivo
3. Copia `nssm-2.24\win64\nssm.exe` a `C:\LogosPOS\print-agent\nssm\nssm.exe`
4. Vuelve a ejecutar `instalar-servicio.bat` como Administrador

---

### ❌ La impresora USB no imprime

1. Verifica que Windows reconoce la impresora:
   - Panel de Control → Dispositivos e Impresoras
   - La impresora debe aparecer ahí
2. En la app, usa **Detectar** para ver el nombre exacto de Windows
3. Si cambias el cable USB de puerto, el nombre puede cambiar — vuelve a detectar
4. Prueba imprimiendo una página de prueba desde Windows primero

---

### ❌ La impresora de red no imprime

1. Verifica que el PC del agente y la impresora están en la **misma red WiFi/LAN**
2. Prueba haciendo ping desde PowerShell:
   ```powershell
   ping 192.168.x.x
   ```
3. Verifica que el puerto 9100 está abierto:
   ```powershell
   Test-NetConnection -ComputerName 192.168.x.x -Port 9100
   ```
   Debe decir `TcpTestSucceeded: True`
4. En la app usa el botón **Ping** en la tarjeta de la impresora

---

### ❌ Error "puerto 3000 ocupado"

El agente intenta automáticamente los puertos 3001-3005. Si cambia de puerto:
- Actualiza la URL del agente en la app agregando el puerto: `https://TU-URL.cfargotunnel.com:3001`
- O libera el puerto 3000 cerrando el programa que lo usa

---

## Desinstalar

```powershell
# Desinstalar el agente
cd C:\LogosPOS\print-agent
.\desinstalar-servicio.bat

# Desinstalar el túnel
net stop cloudflared
cloudflared service uninstall
cloudflared tunnel delete print-agent-nombre-del-local
```

---

## Por sucursal

Cada local necesita su propio PC con agente y su propio túnel:

```
Burgos Centro
  Agente: http://localhost:3000 (en el PC de ese local)
  Túnel: https://abc123.cfargotunnel.com
  Configurado en la app bajo el negocio "Burgos Centro"

Burgos Norte
  Agente: http://localhost:3000 (en OTRO PC)
  Túnel: https://xyz789.cfargotunnel.com
  Configurado en la app bajo el negocio "Burgos Norte"
```

Los túneles no interfieren entre sí.

---

*LogosPOS Print Agent v1.0 — Soporte: ing.jimrod@gmail.com*
