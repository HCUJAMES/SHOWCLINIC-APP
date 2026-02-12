import express from "express";
import db from "../db/database.js";
import { authMiddleware, requireDoctor } from "../middleware/auth.js";

const router = express.Router();

// Función para formatear nombre de especialista a formato correcto
// Ej: "ERICK SPETIA" -> "Erick Spetia", "dr. erick spetia" -> "Dr. Erick Spetia"
function formatNombreEspecialista(nombre) {
  if (!nombre) return nombre;
  const trimmed = nombre.trim().replace(/\s+/g, ' ');
  
  const palabras = trimmed.split(' ');
  const prefijos = ['dr.', 'dra.', 'dr', 'dra', 'lic.', 'lic', 'ing.', 'ing'];
  
  const formateadas = palabras.map((palabra, index) => {
    const lower = palabra.toLowerCase();
    // Mantener prefijos con formato correcto
    if (index === 0 && prefijos.includes(lower)) {
      // Capitalizar prefijo: dr. -> Dr., dra -> Dra.
      let prefijo = lower.charAt(0).toUpperCase() + lower.slice(1);
      if (!prefijo.endsWith('.')) prefijo += '.';
      return prefijo;
    }
    // Title case: primera letra mayúscula, resto minúscula
    if (palabra.length === 0) return palabra;
    return palabra.charAt(0).toUpperCase() + palabra.slice(1).toLowerCase();
  });
  
  return formateadas.join(' ');
}

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

  const nombreFormateado = formatNombreEspecialista(nombre);

  db.run(query, [nombreFormateado, especialidad, telefono, correo], function (err) {
    if (err) {
      console.error("❌ Error al crear especialista:", err.message);
      return res.status(500).json({ message: "Error al crear especialista" });
    }

    console.log(`✅ Especialista creado con ID ${this.lastID}`);
    res.json({ id: this.lastID, nombre: nombreFormateado, especialidad, telefono, correo });
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

// ✅ Normalizar nombres de todos los especialistas existentes (solo doctor)
router.post("/normalizar", authMiddleware, requireDoctor, (req, res) => {
  db.all("SELECT id, nombre FROM especialistas", [], (err, rows) => {
    if (err) {
      console.error("❌ Error al obtener especialistas para normalizar:", err.message);
      return res.status(500).json({ message: "Error al normalizar especialistas" });
    }

    let actualizados = 0;
    let errores = 0;
    const total = rows.length;

    if (total === 0) {
      return res.json({ message: "No hay especialistas para normalizar", actualizados: 0 });
    }

    let procesados = 0;
    function checkDone() {
      procesados++;
      if (procesados === total) {
        console.log(`📋 Normalización completada: ${actualizados} actualizados, ${errores} errores de ${total} total`);
        res.json({ message: "Normalización completada", actualizados, errores, total });
      }
    }

    rows.forEach((row) => {
      const nombreFormateado = formatNombreEspecialista(row.nombre);
      if (nombreFormateado !== row.nombre) {
        db.run("UPDATE especialistas SET nombre = ? WHERE id = ?", [nombreFormateado, row.id], (updateErr) => {
          if (updateErr) {
            console.error(`❌ Error actualizando especialista ID ${row.id}:`, updateErr.message);
            errores++;
          } else {
            console.log(`✅ Normalizado: "${row.nombre}" -> "${nombreFormateado}"`);
            actualizados++;
          }
          checkDone();
        });
      } else {
        checkDone();
      }
    });
  });
});

export default router;
