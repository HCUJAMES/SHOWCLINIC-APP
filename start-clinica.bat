@echo off
setlocal

echo ===============================================
echo   SHOWCLINIC - ARRANQUE (MODO CLINICA)
echo ===============================================
echo.

REM Ir a la carpeta del backend
cd /d "%~dp0backend" || goto :err

REM Arrancar el servidor
start "ShowClinic Backend" cmd /k "node index.js"

echo.
echo Abriendo la aplicacion en el navegador...
timeout /t 2 /nobreak >nul
start "" http://localhost:4000

echo.
echo Listo. No cierres la ventana del Backend.
echo Para acceso remoto (doctor): Tailscale debe estar conectado.
echo.
pause
exit /b 0

:err
echo.
echo ERROR: No se encontro la carpeta backend.
echo Ejecuta este archivo dentro de la carpeta showclinic-crm.
echo.
pause
exit /b 1
