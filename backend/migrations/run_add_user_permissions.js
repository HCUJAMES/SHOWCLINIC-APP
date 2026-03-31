import db from "../db/database.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const migrationSQL = fs.readFileSync(
  path.join(__dirname, "add_user_permissions.sql"),
  "utf8"
);

db.serialize(() => {
  const statements = migrationSQL
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  statements.forEach((statement) => {
    db.run(statement, (err) => {
      if (err) {
        console.error("Error ejecutando migración:", err);
      }
    });
  });

  console.log("✅ Migración de permisos de usuario completada");
});

db.close();
