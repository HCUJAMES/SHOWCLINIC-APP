import sqlite3 from "sqlite3";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = path.join(__dirname, "..", "db", "showclinic.db");

// Verificar que se pasó un archivo SQL
const sqlFile = process.argv[2];
if (!sqlFile) {
  console.error("❌ Error: Debes especificar el archivo SQL");
  console.log("\nUso:");
  console.log("  node ejecutar-migracion.js nombre-archivo.sql");
  console.log("\nEjemplo:");
  console.log("  node ejecutar-migracion.js 2025-01-01-agregar-campo.sql");
  process.exit(1);
}

const sqlPath = path.join(__dirname, sqlFile);

// Verificar que existe el archivo SQL
if (!fs.existsSync(sqlPath)) {
  console.error(`❌ Error: Archivo no encontrado: ${sqlFile}`);
  console.log(`\nBuscado en: ${sqlPath}`);
  process.exit(1);
}

// Leer el archivo SQL
const sql = fs.readFileSync(sqlPath, "utf8");

console.log("========================================");
console.log("  EJECUTANDO MIGRACIÓN");
console.log("========================================");
console.log(`Archivo: ${sqlFile}`);
console.log(`Base de datos: ${DB_PATH}`);
console.log("========================================\n");

// Conectar a la base de datos
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error("❌ Error al conectar con la base de datos:", err.message);
    process.exit(1);
  }
});

// Ejecutar el SQL
db.exec(sql, (err) => {
  if (err) {
    console.error("❌ Error al ejecutar migración:", err.message);
    db.close();
    process.exit(1);
  }
  
  console.log("✅ Migración ejecutada exitosamente");
  console.log(`   ${sqlFile}`);
  
  db.close((closeErr) => {
    if (closeErr) {
      console.error("❌ Error al cerrar conexión:", closeErr.message);
    }
  });
});
