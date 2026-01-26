import express from "express";
import db from "../db/database.js";
import { authMiddleware } from "../middleware/auth.js";

const router = express.Router();

console.log("✅ Módulo de Gestión Clínica cargado");

// Promisify db.all
const dbAll = (query, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(query, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
};

// ✅ Endpoint de prueba (sin autenticación)
router.get("/test", (req, res) => {
  console.log("🧪 Endpoint de prueba accedido");
  res.json({ message: "Gestión Clínica API funcionando correctamente" });
});

// ✅ Obtener estadísticas de gestión clínica
router.get("/estadisticas", authMiddleware, async (req, res) => {
  console.log("📊 Solicitud de estadísticas recibida");
  
  try {
    const { fecha_inicio, fecha_fin, especialista_id } = req.query;

    // Construir condiciones WHERE
    let whereConditionsPaquetes = ["ps.estado = 'completada'"];
    let whereConditionsPresupuestos = ["prs.estado = 'completada'"];
    let paramsPaquetes = [];
    let paramsPresupuestos = [];

    if (fecha_inicio) {
      whereConditionsPaquetes.push("DATE(ps.fecha_realizada) >= ?");
      paramsPaquetes.push(fecha_inicio);
      whereConditionsPresupuestos.push("DATE(prs.fecha_realizada) >= ?");
      paramsPresupuestos.push(fecha_inicio);
    }

    if (fecha_fin) {
      whereConditionsPaquetes.push("DATE(ps.fecha_realizada) <= ?");
      paramsPaquetes.push(fecha_fin);
      whereConditionsPresupuestos.push("DATE(prs.fecha_realizada) <= ?");
      paramsPresupuestos.push(fecha_fin);
    }

    if (especialista_id) {
      whereConditionsPaquetes.push("ps.especialista_id = ?");
      paramsPaquetes.push(especialista_id);
      whereConditionsPresupuestos.push("prs.especialista_id = ?");
      paramsPresupuestos.push(especialista_id);
    }

    const whereClausePaquetes = `WHERE ${whereConditionsPaquetes.join(" AND ")}`;
    const whereClausePresupuestos = `WHERE ${whereConditionsPresupuestos.join(" AND ")}`;

    // Estadísticas de paquetes
    const statsPaquetes = await dbAll(`
      SELECT 
        e.id as especialista_id,
        e.nombre as especialista_nombre,
        COUNT(ps.id) as atenciones,
        SUM(ps.precio_sesion) as ingresos
      FROM paquetes_sesiones ps
      LEFT JOIN especialistas e ON ps.especialista_id = e.id
      ${whereClausePaquetes}
      GROUP BY e.id, e.nombre
    `, paramsPaquetes);

    // Estadísticas de presupuestos
    const statsPresupuestos = await dbAll(`
      SELECT 
        e.id as especialista_id,
        e.nombre as especialista_nombre,
        COUNT(prs.id) as atenciones,
        SUM(prs.precio_sesion) as ingresos
      FROM presupuestos_sesiones prs
      LEFT JOIN especialistas e ON prs.especialista_id = e.id
      ${whereClausePresupuestos}
      GROUP BY e.id, e.nombre
    `, paramsPresupuestos);

    // Combinar estadísticas por especialista
    const especialistasMap = new Map();

    // Procesar paquetes
    statsPaquetes.forEach(stat => {
      const key = stat.especialista_id || 'sin_asignar';
      if (!especialistasMap.has(key)) {
        especialistasMap.set(key, {
          especialista_id: stat.especialista_id,
          especialista_nombre: stat.especialista_nombre || 'Sin asignar',
          atenciones_paquetes: 0,
          atenciones_presupuestos: 0,
          ingresos_paquetes: 0,
          ingresos_presupuestos: 0
        });
      }
      const esp = especialistasMap.get(key);
      esp.atenciones_paquetes = stat.atenciones || 0;
      esp.ingresos_paquetes = stat.ingresos || 0;
    });

    // Procesar presupuestos
    statsPresupuestos.forEach(stat => {
      const key = stat.especialista_id || 'sin_asignar';
      if (!especialistasMap.has(key)) {
        especialistasMap.set(key, {
          especialista_id: stat.especialista_id,
          especialista_nombre: stat.especialista_nombre || 'Sin asignar',
          atenciones_paquetes: 0,
          atenciones_presupuestos: 0,
          ingresos_paquetes: 0,
          ingresos_presupuestos: 0
        });
      }
      const esp = especialistasMap.get(key);
      esp.atenciones_presupuestos = stat.atenciones || 0;
      esp.ingresos_presupuestos = stat.ingresos || 0;
    });

    // Convertir a array y calcular totales
    const estadisticas = Array.from(especialistasMap.values()).map(esp => {
      const totalAtenciones = esp.atenciones_paquetes + esp.atenciones_presupuestos;
      const totalIngresos = esp.ingresos_paquetes + esp.ingresos_presupuestos;
      return {
        ...esp,
        promedio_por_sesion: totalAtenciones > 0 ? totalIngresos / totalAtenciones : 0
      };
    });

    // Ordenar por total de ingresos descendente
    estadisticas.sort((a, b) => {
      const totalA = a.ingresos_paquetes + a.ingresos_presupuestos;
      const totalB = b.ingresos_paquetes + b.ingresos_presupuestos;
      return totalB - totalA;
    });

    // Calcular resumen general
    const resumen = {
      total_atenciones: estadisticas.reduce((sum, e) => sum + e.atenciones_paquetes + e.atenciones_presupuestos, 0),
      total_ingresos: estadisticas.reduce((sum, e) => sum + e.ingresos_paquetes + e.ingresos_presupuestos, 0),
      promedio_por_sesion: 0
    };

    if (resumen.total_atenciones > 0) {
      resumen.promedio_por_sesion = resumen.total_ingresos / resumen.total_atenciones;
    }

    console.log(`✅ Estadísticas calculadas: ${estadisticas.length} especialistas, ${resumen.total_atenciones} atenciones`);

    res.json({
      estadisticas,
      resumen
    });

  } catch (err) {
    console.error("❌ Error:", err.message);
    res.status(500).json({ message: "Error al obtener estadísticas", error: err.message });
  }
});


export default router;
