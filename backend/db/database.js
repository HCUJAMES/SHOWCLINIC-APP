import sqlite3 from "sqlite3";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbDir = __dirname;
const dbPath = path.join(dbDir, "showclinic.db");

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error("❌ Error conectando a la base de datos", err.message);
  } else {
    console.log("✅ Base de datos SQLite conectada en", dbPath);
  }
});

export default db;
export { dbPath };
