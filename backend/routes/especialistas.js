import express from "express";
import sqlite3 from "sqlite3";
import bodyParser from "body-parser";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbDir = path.join(__dirname, "../db");
const dbPath = path.join(dbDir, "showclinic.db");
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

const db = new sqlite3.Database(dbPath);
router.use(bodyParser.json());

// ✅ Listar especialistas
router.get("/listar", (req, res) => {
  db.all("SELECT * FROM especialistas ORDER BY nombre ASC", [], (err, rows) => {
    if (err) {
      console.error("❌ Error al listar especialistas:", err.message);
      return res.status(500).json({ message: "Error al listar especialistas" });
    }
    res.json(rows);
  });
});

// ✅ Crear especialista
router.post("/crear", (req, res) => {
  const { nombre, especialidad, telefono, correo } = req.body;

  if (!nombre) {
    return res.status(400).json({ message: "El nombre es obligatorio" });
  }

  const query = `
    INSERT INTO especialistas (nombre, especialidad, telefono, correo)
    VALUES (?, ?, ?, ?)
  `;

  db.run(query, [nombre, especialidad, telefono, correo], function (err) {
    if (err) {
      console.error("❌ Error al crear especialista:", err.message);
      return res.status(500).json({ message: "Error al crear especialista" });
    }

    console.log(`✅ Especialista creado con ID ${this.lastID}`);
    res.json({ id: this.lastID, nombre, especialidad, telefono, correo });
  });
});

// ✅ Eliminar especialista
router.delete("/eliminar/:id", (req, res) => {
  const { id } = req.params;
  db.run("DELETE FROM especialistas WHERE id = ?", [id], function (err) {
    if (err) {
      console.error("❌ Error al eliminar especialista:", err.message);
      return res.status(500).json({ message: "Error al eliminar especialista" });
    }

    if (this.changes === 0) {
      return res.status(404).json({ message: "Especialista no encontrado" });
    }

    console.log(`🗑️ Especialista ID ${id} eliminado`);
    res.json({ message: "Especialista eliminado correctamente" });
  });
});

export default router;
