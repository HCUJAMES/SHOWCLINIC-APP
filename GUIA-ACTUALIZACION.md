# 📖 Guía de Actualización - ShowClinic CRM

Esta guía explica cómo actualizar el sistema cuando estás en una ubicación diferente al servidor.

---

## 🎯 Proceso Completo de Actualización

### **FASE 1: Desarrollo (En tu laptop)**

#### 1. Obtener última versión
```bash
cd d:\showclinic-crm
git pull
```

#### 2. Hacer cambios en el código
- Editar archivos necesarios
- Agregar nuevas funcionalidades
- Corregir bugs

#### 3. Si hay cambios en base de datos, crear migración
```bash
# Crear archivo en: backend/migrations/YYYY-MM-DD-descripcion.sql
# Ejemplo: backend/migrations/2025-01-07-agregar-campo-notas.sql
```

Ejemplo de migración:
```sql
-- Agregar campo notas_adicionales a pacientes
ALTER TABLE pacientes ADD COLUMN notas_adicionales TEXT;
```

#### 4. Probar TODO localmente
```bash
# Probar migración
cd backend\migrations
node ejecutar-migracion.js 2025-01-07-agregar-campo-notas.sql

# Iniciar servidor y verificar
cd ..
npm start
```

#### 5. Subir cambios a GitHub
```bash
git add .
git commit -m "Descripción clara de los cambios"
git push
```

---

### **FASE 2: Actualización en Servidor (Con AnyDesk)**

⚠️ **IMPORTANTE:** Hacer en horario de baja actividad

#### Paso 1: Conectar con AnyDesk
- Conectar a la laptop del servidor

#### Paso 2: Detener el servidor
- Presionar `Ctrl + C` en la terminal donde corre el servidor

#### Paso 3: Ejecutar script de actualización
```bash
cd C:\NOMBRE-DEL-REPO
actualizar.bat
```

El script hará automáticamente:
1. ✅ Respaldo de base de datos
2. ✅ Descargar cambios desde GitHub
3. ✅ Actualizar dependencias
4. ✅ Compilar frontend
5. ⚠️ Solicitar ejecutar migraciones (manual)

#### Paso 4: Ejecutar migraciones (si hay)
```bash
cd backend\migrations
node ejecutar-migracion.js 2025-01-07-agregar-campo-notas.sql
```

#### Paso 5: Iniciar servidor
```bash
cd ..\backend
npm start
```

#### Paso 6: Verificar funcionamiento
- Abrir navegador: `http://localhost:4000`
- Probar login
- Verificar cambios

---

## 🔄 Comandos Rápidos

### Crear respaldo manual
```bash
cd backend
npm run backup
```

### Actualizar código sin script
```bash
git pull
cd backend
npm install
cd ..\frontend
npm install
npm run build
```

### Ejecutar migración
```bash
cd backend\migrations
node ejecutar-migracion.js nombre-archivo.sql
```

---

## ⚠️ Puntos Críticos

### ✅ SIEMPRE hacer respaldo antes de actualizar
```bash
npm run backup
```

### ✅ Detener servidor antes de actualizar
- No actualices con el servidor corriendo

### ✅ Horario recomendado
- Temprano en la mañana
- Después de cerrar
- Evitar horario de atención

### ✅ Probar localmente primero
- Nunca hagas cambios directamente en el servidor

---

## 🆘 Qué Hacer Si Algo Sale Mal

### Si la migración falla:
```bash
# Restaurar respaldo
cd backend
copy backups\showclinic_backup_FECHA.db db\showclinic.db
npm start
```

### Si el servidor no inicia:
- Leer el mensaje de error completo
- Verificar que todas las dependencias estén instaladas
- Verificar que el frontend esté compilado

---

## 📋 Checklist de Actualización

Antes de actualizar en producción:

- [ ] Cambios probados localmente
- [ ] Migración probada localmente (si aplica)
- [ ] Código subido a GitHub
- [ ] Horario de baja actividad
- [ ] Personal avisado
- [ ] AnyDesk conectado
- [ ] **Respaldo creado** ⭐
- [ ] Servidor detenido
- [ ] Script actualizar.bat ejecutado
- [ ] Migraciones ejecutadas (si aplica)
- [ ] Servidor reiniciado
- [ ] Funcionalidad verificada

---

## 📞 Comunicación con el Personal

Cuando hagas cambios importantes, envía mensaje:

```
📢 ACTUALIZACIÓN DISPONIBLE

He subido cambios al sistema:
- [Descripción de cambios]

Por favor ejecutar:
1. Detener servidor (Ctrl+C)
2. Ejecutar: actualizar.bat
3. Seguir instrucciones en pantalla

Tiempo estimado: 5-10 minutos
```

---

## 📂 Estructura de Archivos

```
showclinic-crm/
├── actualizar.bat              ⭐ Script de actualización
├── backend/
│   ├── scripts/
│   │   └── backup.js           ⭐ Script de respaldo
│   ├── migrations/
│   │   ├── ejecutar-migracion.js  ⭐ Ejecutor de migraciones
│   │   ├── README.md           ⭐ Guía de migraciones
│   │   └── *.sql               ⭐ Archivos de migración
│   ├── backups/                ⭐ Respaldos automáticos
│   └── db/
│       └── showclinic.db       ⭐ Base de datos
└── frontend/
    └── build/                  ⭐ Frontend compilado
```

---

## 💡 Mejores Prácticas

### ✅ Hacer:
- Commits frecuentes con mensajes descriptivos
- Probar cambios localmente antes de push
- Hacer respaldos antes de cambios importantes
- Documentar cambios en migraciones
- Avisar al personal sobre actualizaciones

### ❌ Evitar:
- Cambios directos en el servidor
- Actualizar en horario pico
- Push sin probar
- Modificar BD sin migración
- Actualizar sin respaldo

---

Para más información, consulta:
- `backend/migrations/README.md` - Guía de migraciones
- `actualizar.bat` - Script de actualización automática
