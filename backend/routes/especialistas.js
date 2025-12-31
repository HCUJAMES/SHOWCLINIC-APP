import express from "express";
import db from "../db/database.js";
import { authMiddleware, requireDoctor } from "../middleware/auth.js";

const router = express.Router();

// Listar especialistas no requiere auth (se usa en ComenzarTratamiento)
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

// ✅ Crear especialista (solo doctor)
router.post("/crear", authMiddleware, requireDoctor, (req, res) => {
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

// ✅ Eliminar especialista (solo doctor)
router.delete("/eliminar/:id", authMiddleware, requireDoctor, (req, res) => {
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
