import sqlite3 from 'sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ruta a la base de datos
const DB_PATH = path.join(__dirname, '..', 'db', 'showclinic.db');

// Leer el archivo SQL de migración
const migrationSQL = fs.readFileSync(
  path.join(__dirname, 'add_tipo_to_especialistas.sql'),
  'utf8'
);

// Conectar a la base de datos
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('❌ Error al conectar a la base de datos:', err.message);
    process.exit(1);
  }
  console.log('✅ Conectado a la base de datos');
});

// Ejecutar la migración
db.exec(migrationSQL, (err) => {
  if (err) {
    console.error('❌ Error al ejecutar la migración:', err.message);
    db.close();
    process.exit(1);
  }
  
  console.log('✅ Migración ejecutada exitosamente');
  console.log('📋 Se agregó la columna "tipo" a la tabla especialistas');
  
  // Cerrar la conexión
  db.close((err) => {
    if (err) {
      console.error('❌ Error al cerrar la base de datos:', err.message);
    } else {
      console.log('✅ Conexión cerrada');
    }
  });
});
