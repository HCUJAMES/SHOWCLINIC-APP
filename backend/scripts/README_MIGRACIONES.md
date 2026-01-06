# 📋 Guía de Migraciones de Datos

## 🎯 Propósito

Estos scripts permiten **agregar datos nuevos** desde tu computadora de desarrollo a la computadora de producción (clínica) **SIN PERDER DATOS EXISTENTES**.

---

## ⚠️ IMPORTANTE

**NUNCA copies y reemplaces la base de datos completa** porque:
- ❌ Se pierden todos los pacientes registrados en la clínica
- ❌ Se pierden todos los tratamientos realizados
- ❌ Se pierde el historial de ventas
- ❌ Se pierde el inventario actualizado

**En su lugar, usa estos scripts de migración inteligente.**

---

## 📦 Scripts Disponibles

### 1. `migrar_inventario_produccion.js`
**Propósito:** Agregar productos nuevos al inventario

**Qué hace:**
- ✅ Agrega productos que NO existen
- ✅ Ignora productos que YA existen
- ✅ No modifica stock existente
- ✅ Agrega 20 unidades de stock solo a productos nuevos

**Cuándo usar:**
- Cuando agregues nuevos productos en desarrollo
- Primera vez que configures el inventario en producción

**Cómo usar:**
```bash
cd C:\showclinic-crm\backend
node scripts/migrar_inventario_produccion.js
```

---

### 2. `migrar_tratamientos_base.js`
**Propósito:** Agregar nuevos tratamientos base

**Qué hace:**
- ✅ Agrega tratamientos que NO existen
- ✅ Ignora tratamientos que YA existen
- ✅ No modifica tratamientos existentes

**Cuándo usar:**
- Cuando crees nuevos tipos de tratamientos en desarrollo

**Cómo usar:**
1. Edita el archivo y agrega los tratamientos al array
2. Ejecuta:
```bash
cd C:\showclinic-crm\backend
node scripts/migrar_tratamientos_base.js
```

---

## 🔄 Flujo de Trabajo Completo

### En tu Computadora de Desarrollo:

1. **Haces cambios** (código + datos)
2. **Subes SOLO el código a Git:**
   ```bash
   cd d:\showclinic-crm
   git add .
   git commit -m "Descripción de cambios"
   git push origin main
   ```

### En la Computadora de la Clínica:

1. **Hacer BACKUP de la base de datos:**
   ```bash
   cd C:\showclinic-crm\backend\db
   copy showclinic.db showclinic_backup_%date:~-4,4%%date:~-10,2%%date:~-7,2%.db
   ```

2. **Descargar cambios de código:**
   ```bash
   cd C:\showclinic-crm
   git pull origin main
   ```

3. **Ejecutar scripts de migración (si hay datos nuevos):**
   ```bash
   cd backend
   node scripts/migrar_inventario_produccion.js
   # o cualquier otro script necesario
   ```

4. **Actualizar dependencias:**
   ```bash
   npm install
   ```

5. **Rebuild del frontend:**
   ```bash
   cd ..\frontend
   npm install
   npx react-scripts build
   ```

6. **Reiniciar servidor:**
   ```bash
   cd ..\backend
   node index.js
   ```

---

## 🆕 Crear Nuevos Scripts de Migración

Si necesitas migrar otros tipos de datos, sigue este patrón:

```javascript
import { dbRun, dbGet, dbAll } from "../db/database.js";

const datosNuevos = [
  // Tus datos aquí
];

async function migrar() {
  console.log("🔄 Iniciando migración...\n");
  
  let agregados = 0;
  let existentes = 0;

  for (const dato of datosNuevos) {
    try {
      // 1. Verificar si YA existe
      const existe = await dbGet(
        `SELECT * FROM tabla WHERE campo = ?`,
        [dato.valor]
      );

      if (existe) {
        console.log(`  ⏭️  Ya existe: ${dato.nombre}`);
        existentes++;
        continue;
      }

      // 2. Insertar SOLO si NO existe
      await dbRun(
        `INSERT INTO tabla (campo1, campo2) VALUES (?, ?)`,
        [dato.valor1, dato.valor2]
      );
      console.log(`  ✅ Agregado: ${dato.nombre}`);
      agregados++;

    } catch (err) {
      console.error(`  ❌ Error:`, err.message);
    }
  }

  console.log(`\n✅ Completado: ${agregados} nuevos, ${existentes} existentes`);
}

migrar()
  .then(() => process.exit(0))
  .catch(err => {
    console.error("❌ Error fatal:", err);
    process.exit(1);
  });
```

---

## 🛡️ Seguridad

### Antes de ejecutar cualquier script:

1. ✅ **SIEMPRE hacer backup** de la base de datos
2. ✅ Verificar que el script tenga la lógica de "verificar si existe"
3. ✅ Probar primero en desarrollo
4. ✅ Leer el código del script antes de ejecutarlo

### Si algo sale mal:

```bash
# Restaurar backup
cd C:\showclinic-crm\backend\db
copy showclinic_backup_FECHA.db showclinic.db
```

---

## 📊 Ejemplo de Salida

```
🔄 Iniciando migración de inventario...

  ✅ Producto base creado: Juvederm
  ✅ Variante creada: Volift (Allergan)
  📦 Stock agregado: 20 unidades

  ⏭️  Ya existe: Opera - Opera
  ⏭️  Ya existe: Perfectha - Derm

==================================================
✅ Migración completada
   - Productos nuevos agregados: 1
   - Productos ya existentes: 2
==================================================
```

---

## ❓ Preguntas Frecuentes

**P: ¿Puedo ejecutar el mismo script varias veces?**
R: Sí, es seguro. Solo agregará lo que no existe.

**P: ¿Qué pasa si ejecuto el script y ya existen los datos?**
R: El script detectará que ya existen y los ignorará. No se duplicarán.

**P: ¿Necesito detener el servidor para ejecutar los scripts?**
R: Sí, es recomendable detener el servidor backend antes de ejecutar scripts de migración.

**P: ¿Los scripts modifican datos existentes?**
R: No, solo AGREGAN datos nuevos. Nunca modifican ni eliminan datos existentes.

---

## 📝 Checklist de Actualización

```
[ ] Backup de base de datos en producción
[ ] git pull en producción
[ ] Ejecutar scripts de migración necesarios
[ ] npm install en backend
[ ] npm install en frontend
[ ] npx react-scripts build en frontend
[ ] Reiniciar servidor backend
[ ] Verificar que todo funcione correctamente
[ ] Si hay problemas, restaurar backup
```

---

**Última actualización:** Enero 2026
