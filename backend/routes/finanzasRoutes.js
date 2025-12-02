import express from "express";
import sqlite3 from "sqlite3";
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

// 📊 OBTENER REPORTE FINANCIERO FILTRADO
router.get("/reporte", (req, res) => {
  const { fechaInicio, fechaFin, paciente, metodoPago } = req.query;

  let query = `
    SELECT 
      tr.id,
      p.nombre || ' ' || p.apellido AS paciente,
      t.nombre AS tratamiento,
      tr.fecha,
      tr.precio_total,
      tr.descuento,
      tr.pagoMetodo
    FROM tratamientos_realizados tr
    JOIN patients p ON p.id = tr.paciente_id
    JOIN tratamientos t ON t.id = tr.tratamiento_id
    WHERE 1 = 1
  `;
  const params = [];

  // 🗓️ Filtros dinámicos
  if (fechaInicio && fechaFin) {
  query += " AND DATE(datetime(fecha, '-5 hours')) BETWEEN ? AND ?";
  params.push(fechaInicio, fechaFin);
}
 else if (fechaInicio) {
    query += " AND date(tr.fecha) = date(?)";
    params.push(fechaInicio);
  }

  if (paciente) {
    query += " AND p.nombre || ' ' || p.apellido LIKE ?";
    params.push(`%${paciente}%`);
  }

  if (metodoPago) {
    query += " AND tr.pagoMetodo = ?";
    params.push(metodoPago);
  }

  query += " ORDER BY tr.fecha DESC";

  db.all(query, params, (err, rows) => {
    if (err) {
      console.error("❌ Error al obtener reporte financiero:", err.message);
      return res.status(500).json({ message: "Error al obtener reporte financiero" });
    }

    // Calcular totales
    const totalGeneral = rows.reduce((acc, r) => acc + (r.precio_total || 0), 0);

    const totalesPorMetodo = rows.reduce((acc, r) => {
      const metodo = r.pagoMetodo || "Desconocido";
      if (!acc[metodo]) acc[metodo] = 0;
      acc[metodo] += r.precio_total || 0;
      return acc;
    }, {});

    res.json({ resultados: rows, totalGeneral, totalesPorMetodo });
  });
});

export default router;
