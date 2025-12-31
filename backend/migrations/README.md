# Migraciones de Base de Datos

Esta carpeta contiene las migraciones SQL para actualizar la estructura de la base de datos.

## Cómo crear una migración

1. Crear archivo con formato: `YYYY-MM-DD-descripcion.sql`
   Ejemplo: `2025-01-07-agregar-campo-notas.sql`

2. Escribir el SQL necesario:
```sql
-- Descripción de la migración
ALTER TABLE pacientes ADD COLUMN notas_adicionales TEXT;
```

3. Probar localmente:
```bash
node ejecutar-migracion.js 2025-01-07-agregar-campo-notas.sql
```

4. Si funciona, subir a GitHub:
```bash
git add .
git commit -m "Agregar migración: campo notas_adicionales"
git push
```

## Cómo ejecutar en el servidor

1. Conectar con AnyDesk
2. Hacer respaldo: `npm run backup`
3. Actualizar código: `git pull`
4. Ejecutar migración:
```bash
cd backend\migrations
node ejecutar-migracion.js 2025-01-07-agregar-campo-notas.sql
```

## Buenas prácticas

- ✅ Siempre hacer respaldo antes de ejecutar
- ✅ Probar localmente primero
- ✅ Nombrar con fecha y descripción clara
- ✅ Documentar cambios en comentarios SQL
- ❌ No modificar migraciones ya ejecutadas

## Ejemplos de migraciones

### Agregar columna
```sql
-- Agregar campo fecha_nacimiento a pacientes
ALTER TABLE pacientes ADD COLUMN fecha_nacimiento TEXT;
```

### Agregar tabla nueva
```sql
-- Crear tabla de recordatorios
CREATE TABLE IF NOT EXISTS recordatorios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  paciente_id INTEGER,
  fecha TEXT,
  mensaje TEXT,
  completado INTEGER DEFAULT 0,
  FOREIGN KEY (paciente_id) REFERENCES pacientes(id)
);
```

### Insertar datos
```sql
-- Agregar nuevos tratamientos base
INSERT INTO tratamientos_base (nombre, descripcion, precio_base) 
VALUES 
  ('Limpieza Facial Profunda', 'Limpieza facial con extracción', 150.00),
  ('Peeling Químico', 'Peeling para renovación celular', 300.00);
```
