import express from "express";
import { dbAll, dbGet } from "../db/database.js";
import { authMiddleware, requireRole } from "../middleware/auth.js";

const router = express.Router();

const getMonthRange = ({ year, month }) => {
  const y = Number(year);
  const m = Number(month); // 1-12

  if (!Number.isInteger(y) || !Number.isInteger(m) || m < 1 || m > 12) {
    return null;
  }

  const start = new Date(Date.UTC(y, m - 1, 1));
  const end = new Date(Date.UTC(y, m, 0));

  const pad2 = (n) => String(n).padStart(2, "0");
  const startStr = `${start.getUTCFullYear()}-${pad2(start.getUTCMonth() + 1)}-${pad2(start.getUTCDate())}`;
  const endStr = `${end.getUTCFullYear()}-${pad2(end.getUTCMonth() + 1)}-${pad2(end.getUTCDate())}`;

  return { startStr, endStr };
};

// 📊 Resumen general del mes
// Query params opcionales: ?year=2025&month=12
router.get("/overview", authMiddleware, requireRole("doctor", "admin"), async (req, res) => {
  try {
    const now = new Date();
    const year = req.query.year ?? now.getFullYear();
    const month = req.query.month ?? now.getMonth() + 1;

    const range = getMonthRange({ year, month });
    if (!range) {
      return res.status(400).json({ message: "Parámetros inválidos. Usa year=YYYY&month=1-12" });
    }

    const { startStr, endStr } = range;

    // KPIs del mes
    const kpi = await dbGet(
      `
        SELECT
          COUNT(*) AS sesiones,
          COUNT(DISTINCT paciente_id) AS pacientes_unicos,
          COALESCE(SUM(precio_total), 0) AS ingresos_bruto,
          COALESCE(SUM(CASE WHEN lower(trim(pagoMetodo)) = 'tarjeta' THEN (precio_total * 0.96) ELSE precio_total END), 0) AS ingresos_neto,
          COALESCE(SUM(CASE WHEN lower(trim(pagoMetodo)) = 'tarjeta' THEN (precio_total * 0.04) ELSE 0 END), 0) AS comision_pos,
          COALESCE(AVG(CASE WHEN lower(trim(pagoMetodo)) = 'tarjeta' THEN (precio_total * 0.96) ELSE precio_total END), 0) AS ticket_promedio
        FROM tratamientos_realizados
        WHERE date(fecha) BETWEEN date(?) AND date(?)
      `,
      [startStr, endStr]
    );

    // Top tratamientos
    const topTratamientos = await dbAll(
      `
        SELECT
          t.id AS tratamiento_id,
          t.nombre AS tratamiento,
          COUNT(*) AS cantidad,
          COALESCE(SUM(tr.precio_total), 0) AS ingresos_bruto,
          COALESCE(SUM(CASE WHEN lower(trim(tr.pagoMetodo)) = 'tarjeta' THEN (tr.precio_total * 0.96) ELSE tr.precio_total END), 0) AS ingresos_neto
        FROM tratamientos_realizados tr
        LEFT JOIN tratamientos t ON t.id = tr.tratamiento_id
        WHERE date(tr.fecha) BETWEEN date(?) AND date(?)
        GROUP BY tr.tratamiento_id
        ORDER BY cantidad DESC, ingresos_neto DESC
        LIMIT 8
      `,
      [startStr, endStr]
    );

    // Pacientes frecuentes
    const pacientesFrecuentes = await dbAll(
      `
        SELECT
          p.id AS paciente_id,
          (p.nombre || ' ' || p.apellido) AS paciente,
          COUNT(*) AS sesiones,
          COALESCE(SUM(tr.precio_total), 0) AS ingresos_bruto,
          COALESCE(SUM(CASE WHEN lower(trim(tr.pagoMetodo)) = 'tarjeta' THEN (tr.precio_total * 0.96) ELSE tr.precio_total END), 0) AS ingresos_neto
        FROM tratamientos_realizados tr
        LEFT JOIN patients p ON p.id = tr.paciente_id
        WHERE date(tr.fecha) BETWEEN date(?) AND date(?)
        GROUP BY tr.paciente_id
        ORDER BY sesiones DESC, ingresos_neto DESC
        LIMIT 8
      `,
      [startStr, endStr]
    );

    // Sesiones por día (tendencia simple)
    const sesionesPorDia = await dbAll(
      `
        SELECT
          date(tr.fecha) AS fecha,
          COUNT(*) AS sesiones,
          COALESCE(SUM(tr.precio_total), 0) AS ingresos_bruto,
          COALESCE(SUM(CASE WHEN lower(trim(tr.pagoMetodo)) = 'tarjeta' THEN (tr.precio_total * 0.96) ELSE tr.precio_total END), 0) AS ingresos_neto
        FROM tratamientos_realizados tr
        WHERE date(tr.fecha) BETWEEN date(?) AND date(?)
        GROUP BY date(tr.fecha)
        ORDER BY date(tr.fecha) ASC
      `,
      [startStr, endStr]
    );

    res.json({
      periodo: { year: Number(year), month: Number(month), start: startStr, end: endStr },
      kpi: {
        sesiones: Number(kpi?.sesiones || 0),
        pacientes_unicos: Number(kpi?.pacientes_unicos || 0),
        ingresos_bruto: Number(kpi?.ingresos_bruto || 0),
        ingresos_neto: Number(kpi?.ingresos_neto || 0),
        comision_pos: Number(kpi?.comision_pos || 0),
        ticket_promedio: Number(kpi?.ticket_promedio || 0),
      },
      top_tratamientos: topTratamientos,
      pacientes_frecuentes: pacientesFrecuentes,
      sesiones_por_dia: sesionesPorDia,
    });
  } catch (err) {
    console.error("❌ Error en /api/stats/overview:", err);
    res.status(500).json({ message: "Error interno del servidor" });
  }
});

export default router;
