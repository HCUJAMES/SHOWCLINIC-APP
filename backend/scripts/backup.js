import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, "..", "db", "showclinic.db");
const backupsDir = path.join(__dirname, "..", "backups");

// Verificar que existe la base de datos
if (!fs.existsSync(dbPath)) {
  console.error("❌ Error: Base de datos no encontrada en:", dbPath);
  process.exit(1);
}

// Crear carpeta backups si no existe
if (!fs.existsSync(backupsDir)) {
  fs.mkdirSync(backupsDir, { recursive: true });
  console.log("✅ Carpeta backups creada");
}

// Generar nombre con fecha y hora
const now = new Date();
const timestamp = now.toISOString().replace(/[:.]/g, "-").slice(0, 19);
const filename = `showclinic_backup_${timestamp}.db`;
const backupPath = path.join(backupsDir, filename);

// Copiar archivo
try {
  fs.copyFileSync(dbPath, backupPath);
  console.log("✅ Backup creado exitosamente:");
  console.log(`   ${filename}`);
  console.log(`   Ubicación: ${backupPath}`);
  
  // Mostrar tamaño del archivo
  const stats = fs.statSync(backupPath);
  const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
  console.log(`   Tamaño: ${sizeMB} MB`);
} catch (err) {
  console.error("❌ Error al crear backup:", err.message);
  process.exit(1);
}
