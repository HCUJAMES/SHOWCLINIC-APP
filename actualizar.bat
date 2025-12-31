@echo off
color 0A
title Actualizar ShowClinic CRM
echo ========================================
echo   ACTUALIZACION SHOWCLINIC CRM
echo ========================================
echo.
echo IMPORTANTE: Este proceso actualizara
echo el sistema. Asegurate de que:
echo - No hay usuarios activos
echo - Es horario de baja actividad
echo.
pause
echo.

cd /d %~dp0

echo ========================================
echo [1/7] CREANDO RESPALDO DE BASE DE DATOS
echo ========================================
cd backend
call npm run backup
if %errorlevel% neq 0 (
    color 0C
    echo.
    echo ERROR: No se pudo crear respaldo
    echo.
    pause
    exit /b 1
)
echo.
pause

echo ========================================
echo [2/7] DESCARGANDO CAMBIOS DESDE GITHUB
echo ========================================
cd ..
git pull
if %errorlevel% neq 0 (
    color 0C
    echo.
    echo ERROR: No se pudo descargar cambios
    echo.
    pause
    exit /b 1
)
echo.

echo ========================================
echo [3/7] ACTUALIZANDO DEPENDENCIAS BACKEND
echo ========================================
cd backend
call npm install
echo.

echo ========================================
echo [4/7] ACTUALIZANDO DEPENDENCIAS FRONTEND
echo ========================================
cd ..\frontend
call npm install
echo.

echo ========================================
echo [5/7] COMPILANDO FRONTEND
echo ========================================
call npm run build
if %errorlevel% neq 0 (
    color 0C
    echo.
    echo ERROR: No se pudo compilar frontend
    echo.
    pause
    exit /b 1
)
echo.

echo ========================================
echo [6/7] VERIFICAR MIGRACIONES
echo ========================================
echo.
echo Si hay archivos .sql nuevos en:
echo backend\migrations\
echo.
echo Ejecutar manualmente:
echo   cd backend\migrations
echo   node ejecutar-migracion.js nombre-archivo.sql
echo.
set /p respuesta="Ya ejecutaste las migraciones? (S/N): "
if /i "%respuesta%" neq "S" (
    echo.
    echo Por favor ejecuta las migraciones primero
    echo.
    pause
    exit /b 0
)
echo.

echo ========================================
echo [7/7] ACTUALIZACION COMPLETADA
echo ========================================
echo.
echo Ahora puedes iniciar el servidor con:
echo   cd backend
echo   npm start
echo.
echo ========================================
set /p iniciar="Iniciar servidor ahora? (S/N): "
if /i "%iniciar%"=="S" (
    cd ..\backend
    echo.
    echo Iniciando servidor...
    echo.
    npm start
) else (
    echo.
    echo Recuerda iniciar el servidor manualmente:
    echo   cd backend
    echo   npm start
    echo.
    pause
)
