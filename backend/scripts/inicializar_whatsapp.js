import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Script para inicializar las tablas de WhatsApp en la base de datos
 */

async function inicializarWhatsApp() {
  console.log("🔄 Inicializando tablas de WhatsApp...\n");

  try {
    // Conectar a la base de datos
    const dbPath = path.join(__dirname, "../db/showclinic.db");
    const db = new Database(dbPath);

    // Leer el archivo SQL
    const sqlPath = path.join(__dirname, "../db/whatsapp-schema.sql");
    const sql = fs.readFileSync(sqlPath, "utf8");

    // Ejecutar el SQL
    db.exec(sql);

    console.log("✅ Tablas de WhatsApp creadas correctamente");
    console.log("\n📋 Tablas creadas:");
    console.log("  - whatsapp_conversaciones");
    console.log("  - whatsapp_mensajes");
    console.log("  - whatsapp_leads");
    console.log("  - whatsapp_config");
    console.log("  - whatsapp_plantillas");
    console.log("  - whatsapp_estadisticas");

    // Verificar que se crearon correctamente
    const tablas = db
      .prepare(
        `SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'whatsapp_%'`
      )
      .all();

    console.log(`\n✅ Total de tablas creadas: ${tablas.length}`);

    db.close();
    console.log("\n🎉 Inicialización completada exitosamente");
  } catch (error) {
    console.error("❌ Error inicializando WhatsApp:", error);
    process.exit(1);
  }
}

inicializarWhatsApp();
