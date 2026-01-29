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

// Promisify db.get
const dbGet = (query, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(query, params, (err, row) => {
      if (err) reject(err);
      else resolve(row || null);
    });
  });
};

// ✅ Endpoint de prueba (sin autenticación)
router.get("/test", (req, res) => {
  console.log("🧪 Endpoint de prueba accedido");
  res.json({ message: "Gestión Clínica API funcionando correctamente" });
});

// ✅ Obtener lista de tratamientos únicos
router.get("/tratamientos", authMiddleware, async (req, res) => {
  try {
    const tratamientosPaquetes = await dbAll(`
      SELECT DISTINCT tratamiento_nombre 
      FROM paquetes_sesiones 
      WHERE tratamiento_nombre IS NOT NULL 
      AND tratamiento_nombre != ''
      AND especialista_id IS NOT NULL
      ORDER BY tratamiento_nombre
    `);

    const tratamientosPresupuestos = await dbAll(`
      SELECT DISTINCT tratamiento_nombre 
      FROM presupuestos_sesiones 
      WHERE tratamiento_nombre IS NOT NULL 
      AND tratamiento_nombre != ''
      AND especialista_id IS NOT NULL
      ORDER BY tratamiento_nombre
    `);

    // Combinar y eliminar duplicados
    const tratamientosSet = new Set();
    tratamientosPaquetes.forEach(t => tratamientosSet.add(t.tratamiento_nombre));
    tratamientosPresupuestos.forEach(t => tratamientosSet.add(t.tratamiento_nombre));

    const tratamientos = Array.from(tratamientosSet).sort();

    res.json(tratamientos);
  } catch (err) {
    console.error("❌ Error al obtener tratamientos:", err.message);
    res.status(500).json({ message: "Error al obtener tratamientos", error: err.message });
  }
});

// ✅ Obtener estadísticas de gestión clínica con detalle de tratamientos
router.get("/estadisticas", authMiddleware, async (req, res) => {
  console.log("📊 Solicitud de estadísticas recibida");
  
  try {
    const { fecha_inicio, fecha_fin, especialista_id, tratamiento } = req.query;

    // Construir condiciones WHERE
    let whereConditionsPaquetes = ["ps.estado = 'completada'", "ps.especialista_id IS NOT NULL"];
    let whereConditionsPresupuestos = ["prs.estado = 'completada'", "prs.especialista_id IS NOT NULL"];
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

    if (tratamiento) {
      whereConditionsPaquetes.push("ps.tratamiento_nombre LIKE ?");
      paramsPaquetes.push(`%${tratamiento}%`);
      whereConditionsPresupuestos.push("prs.tratamiento_nombre LIKE ?");
      paramsPresupuestos.push(`%${tratamiento}%`);
    }

    const whereClausePaquetes = `WHERE ${whereConditionsPaquetes.join(" AND ")}`;
    const whereClausePresupuestos = `WHERE ${whereConditionsPresupuestos.join(" AND ")}`;

    // Obtener TODOS los especialistas primero
    const todosEspecialistas = await dbAll(`
      SELECT id as especialista_id, nombre as especialista_nombre
      FROM especialistas
      ORDER BY nombre
    `);

    // Estadísticas por especialista de paquetes
    const statsPaquetes = await dbAll(`
      SELECT 
        e.id as especialista_id,
        e.nombre as especialista_nombre,
        COUNT(ps.id) as atenciones,
        COALESCE(SUM(ps.precio_sesion), 0) as ingresos
      FROM paquetes_sesiones ps
      INNER JOIN especialistas e ON ps.especialista_id = e.id
      ${whereClausePaquetes}
      GROUP BY e.id, e.nombre
    `, paramsPaquetes);

    // Estadísticas por especialista de presupuestos
    const statsPresupuestos = await dbAll(`
      SELECT 
        e.id as especialista_id,
        e.nombre as especialista_nombre,
        COUNT(prs.id) as atenciones,
        COALESCE(SUM(prs.precio_sesion), 0) as ingresos
      FROM presupuestos_sesiones prs
      INNER JOIN especialistas e ON prs.especialista_id = e.id
      ${whereClausePresupuestos}
      GROUP BY e.id, e.nombre
    `, paramsPresupuestos);

    // Detalle por tratamiento de paquetes
    const detalleTratamientosPaquetes = await dbAll(`
      SELECT 
        e.id as especialista_id,
        e.nombre as especialista_nombre,
        ps.tratamiento_nombre,
        COUNT(ps.id) as cantidad_sesiones,
        COALESCE(SUM(ps.precio_sesion), 0) as total_tratamiento
      FROM paquetes_sesiones ps
      INNER JOIN especialistas e ON ps.especialista_id = e.id
      ${whereClausePaquetes}
      GROUP BY e.id, e.nombre, ps.tratamiento_nombre
      ORDER BY e.nombre, ps.tratamiento_nombre
    `, paramsPaquetes);

    // Detalle por tratamiento de presupuestos
    const detalleTratamientosPresupuestos = await dbAll(`
      SELECT 
        e.id as especialista_id,
        e.nombre as especialista_nombre,
        prs.tratamiento_nombre,
        COUNT(prs.id) as cantidad_sesiones,
        COALESCE(SUM(prs.precio_sesion), 0) as total_tratamiento
      FROM presupuestos_sesiones prs
      INNER JOIN especialistas e ON prs.especialista_id = e.id
      ${whereClausePresupuestos}
      GROUP BY e.id, e.nombre, prs.tratamiento_nombre
      ORDER BY e.nombre, prs.tratamiento_nombre
    `, paramsPresupuestos);

    // Inicializar mapa con TODOS los especialistas
    const especialistasMap = new Map();
    
    todosEspecialistas.forEach(esp => {
      especialistasMap.set(esp.especialista_id, {
        especialista_id: esp.especialista_id,
        especialista_nombre: esp.especialista_nombre,
        atenciones_paquetes: 0,
        atenciones_presupuestos: 0,
        ingresos_paquetes: 0,
        ingresos_presupuestos: 0
      });
    });

    // Agregar estadísticas de paquetes
    statsPaquetes.forEach(stat => {
      const key = stat.especialista_id;
      if (especialistasMap.has(key)) {
        const esp = especialistasMap.get(key);
        esp.atenciones_paquetes = stat.atenciones || 0;
        esp.ingresos_paquetes = parseFloat(stat.ingresos) || 0;
      }
    });

    // Agregar estadísticas de presupuestos
    statsPresupuestos.forEach(stat => {
      const key = stat.especialista_id;
      if (especialistasMap.has(key)) {
        const esp = especialistasMap.get(key);
        esp.atenciones_presupuestos = stat.atenciones || 0;
        esp.ingresos_presupuestos = parseFloat(stat.ingresos) || 0;
      }
    });

    // Convertir a array y calcular totales + comisión del 20%
    const estadisticas = Array.from(especialistasMap.values()).map(esp => {
      const totalAtenciones = esp.atenciones_paquetes + esp.atenciones_presupuestos;
      const totalIngresos = esp.ingresos_paquetes + esp.ingresos_presupuestos;
      const comision_20 = totalIngresos * 0.20;
      
      return {
        ...esp,
        total_atenciones: totalAtenciones,
        total_ingresos: totalIngresos,
        promedio_por_sesion: totalAtenciones > 0 ? totalIngresos / totalAtenciones : 0,
        comision_20_porciento: comision_20
      };
    });

    // Ordenar por total de ingresos descendente
    estadisticas.sort((a, b) => b.total_ingresos - a.total_ingresos);

    // Combinar detalle de tratamientos
    const tratamientos = [...detalleTratamientosPaquetes, ...detalleTratamientosPresupuestos];

    // Calcular resumen general
    const resumen = {
      total_atenciones: estadisticas.reduce((sum, e) => sum + e.total_atenciones, 0),
      total_ingresos: estadisticas.reduce((sum, e) => sum + e.total_ingresos, 0),
      total_comision_20: estadisticas.reduce((sum, e) => sum + e.comision_20_porciento, 0),
      promedio_por_sesion: 0
    };

    if (resumen.total_atenciones > 0) {
      resumen.promedio_por_sesion = resumen.total_ingresos / resumen.total_atenciones;
    }

    console.log(`✅ Estadísticas calculadas: ${estadisticas.length} especialistas, ${resumen.total_atenciones} atenciones, S/ ${resumen.total_ingresos.toFixed(2)} ingresos`);

    res.json({
      estadisticas,
      tratamientos,
      resumen
    });

  } catch (err) {
    console.error("❌ Error:", err.message, err.stack);
    res.status(500).json({ message: "Error al obtener estadísticas", error: err.message });
  }
});


// ✅ Obtener detalle completo de un especialista con TODA la información
router.get("/especialista/:id/detalle", authMiddleware, async (req, res) => {
  console.log("📋 Solicitud de detalle COMPLETO de especialista:", req.params.id);
  
  try {
    const { id } = req.params;
    const { fecha_inicio, fecha_fin, tratamiento } = req.query;

    if (!id || id === 'undefined' || id === 'null') {
      return res.status(400).json({ message: "ID de especialista no válido" });
    }

    // Obtener datos del especialista
    const especialistaData = await dbGet(
      "SELECT id, nombre FROM especialistas WHERE id = ?",
      [parseInt(id)]
    );

    if (!especialistaData) {
      return res.status(404).json({ message: "Especialista no encontrado" });
    }

    const nombreEspecialista = especialistaData.nombre;
    const especialistaId = especialistaData.id;
    console.log("📋 Buscando sesiones DETALLADAS para:", nombreEspecialista, "ID:", especialistaId);

    // Construir condiciones WHERE
    let whereConditionsPaquetes = ["ps.estado = 'completada'", "(ps.especialista = ? OR ps.especialista_id = ?)"];
    let whereConditionsPresupuestos = ["prs.estado = 'completada'", "(prs.especialista = ? OR prs.especialista_id = ?)"];
    let paramsPaquetes = [nombreEspecialista, especialistaId];
    let paramsPresupuestos = [nombreEspecialista, especialistaId];

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

    if (tratamiento) {
      whereConditionsPaquetes.push("ps.tratamiento_nombre LIKE ?");
      paramsPaquetes.push(`%${tratamiento}%`);
      whereConditionsPresupuestos.push("prs.tratamiento_nombre LIKE ?");
      paramsPresupuestos.push(`%${tratamiento}%`);
    }

    const whereClausePaquetes = `WHERE ${whereConditionsPaquetes.join(" AND ")}`;
    const whereClausePresupuestos = `WHERE ${whereConditionsPresupuestos.join(" AND ")}`;

    // Obtener sesiones de paquetes con TODA la información detallada
    console.log("Buscando sesiones DETALLADAS de paquetes para:", nombreEspecialista);
    console.log("WHERE Paquetes:", whereClausePaquetes);
    console.log("Params Paquetes:", paramsPaquetes);
    
    const sesionesPaquetes = await dbAll(`
      SELECT 
        ps.id as sesion_id,
        ps.tratamiento_nombre,
        ps.tratamiento_id,
        ps.fecha_realizada,
        ps.precio_sesion,
        ps.sesion_numero,
        ps.notas as sesion_notas,
        COALESCE(p.nombre, 'Sin nombre') as paciente_nombre,
        COALESCE(p.apellido, '') as paciente_apellido,
        p.dni as paciente_dni,
        pp.id as paquete_paciente_id,
        pp.paquete_nombre,
        pp.precio_total as paquete_precio_total,
        pp.tratamientos_json,
        pt.productos_json as paquete_productos_json,
        pt.precio_regular as paquete_precio_regular,
        pt.precio_paquete,
        pt.descuento_porcentaje,
        pt.sesiones as paquete_total_sesiones,
        tr.productos as productos_usados_json,
        tr.precio_total as tratamiento_precio_total,
        tr.descuento as tratamiento_descuento,
        tr.pagoMetodo as tratamiento_metodo_pago,
        'Paquete' as tipo
      FROM paquetes_sesiones ps
      LEFT JOIN paquetes_pacientes pp ON ps.paquete_paciente_id = pp.id
      LEFT JOIN patients p ON pp.paciente_id = p.id
      LEFT JOIN paquetes_tratamientos pt ON pp.paquete_id = pt.id
      LEFT JOIN tratamientos_realizados tr ON (
        tr.paciente_id = p.id 
        AND tr.tratamiento_id = ps.tratamiento_id 
        AND DATE(tr.fecha) = DATE(ps.fecha_realizada)
        AND LOWER(TRIM(tr.especialista)) = LOWER(TRIM(ps.especialista))
      )
      ${whereClausePaquetes}
      ORDER BY ps.fecha_realizada DESC
    `, paramsPaquetes);

    console.log(`✅ Encontradas ${sesionesPaquetes.length} sesiones de paquetes`);
    if (sesionesPaquetes.length > 0) {
      console.log("Primera sesión paquete (DETALLADA):", JSON.stringify(sesionesPaquetes[0], null, 2));
    }

    // Obtener sesiones de presupuestos con TODA la información detallada
    console.log("Buscando sesiones DETALLADAS de presupuestos para:", nombreEspecialista);
    console.log("WHERE Presupuestos:", whereClausePresupuestos);
    console.log("Params Presupuestos:", paramsPresupuestos);
    
    const sesionesPresupuestos = await dbAll(`
      SELECT 
        prs.id as sesion_id,
        prs.tratamiento_nombre,
        prs.tratamiento_id,
        prs.fecha_realizada,
        prs.precio_sesion,
        prs.sesion_numero,
        prs.notas as sesion_notas,
        COALESCE(p.nombre, 'Sin nombre') as paciente_nombre,
        COALESCE(p.apellido, '') as paciente_apellido,
        p.dni as paciente_dni,
        pa.id as presupuesto_id,
        pa.tratamientos_json,
        pa.precio_total as presupuesto_precio_total,
        pa.descuento,
        tr.productos as productos_usados_json,
        tr.precio_total as tratamiento_precio_total,
        tr.descuento as tratamiento_descuento,
        tr.pagoMetodo as tratamiento_metodo_pago,
        'Presupuesto' as tipo
      FROM presupuestos_sesiones prs
      LEFT JOIN presupuestos_asignados pa ON prs.presupuesto_asignado_id = pa.id
      LEFT JOIN patients p ON pa.paciente_id = p.id
      LEFT JOIN tratamientos_realizados tr ON (
        tr.paciente_id = p.id 
        AND tr.tratamiento_id = prs.tratamiento_id 
        AND DATE(tr.fecha) = DATE(prs.fecha_realizada)
        AND LOWER(TRIM(tr.especialista)) = LOWER(TRIM(prs.especialista))
      )
      ${whereClausePresupuestos}
      ORDER BY prs.fecha_realizada DESC
    `, paramsPresupuestos);

    console.log(`✅ Encontradas ${sesionesPresupuestos.length} sesiones de presupuestos`);
    if (sesionesPresupuestos.length > 0) {
      console.log("Primera sesión presupuesto (DETALLADA):", JSON.stringify(sesionesPresupuestos[0], null, 2));
    }

    // Procesar y enriquecer todas las sesiones con información detallada
    const todasSesiones = [...sesionesPaquetes, ...sesionesPresupuestos].map(sesion => {
      // Parsear JSON de tratamientos
      let tratamientos_detalle = [];
      try {
        if (sesion.tratamientos_json) {
          tratamientos_detalle = JSON.parse(sesion.tratamientos_json);
        }
      } catch (e) {
        console.error("Error parseando tratamientos_json:", e);
      }
      
      // Parsear productos del paquete (si existe)
      let productos_paquete = [];
      try {
        if (sesion.paquete_productos_json) {
          productos_paquete = JSON.parse(sesion.paquete_productos_json);
        }
      } catch (e) {
        console.error("Error parseando paquete_productos_json:", e);
      }

      // Parsear productos USADOS en el tratamiento (lo más importante)
      let productos_usados = [];
      try {
        if (sesion.productos_usados_json) {
          productos_usados = JSON.parse(sesion.productos_usados_json);
        }
      } catch (e) {
        console.error("Error parseando productos_usados_json:", e);
      }

      // Calcular descuento aplicado
      let descuento_aplicado = 0;
      let ahorro = 0;
      let precio_final = sesion.precio_sesion || 0;
      
      if (sesion.tipo === 'Paquete' && sesion.descuento_porcentaje) {
        descuento_aplicado = sesion.descuento_porcentaje;
        ahorro = (sesion.paquete_precio_regular || 0) - (sesion.paquete_precio_total || 0);
      } else if (sesion.tipo === 'Presupuesto' && sesion.descuento) {
        descuento_aplicado = sesion.descuento;
        ahorro = sesion.descuento;
      }

      // Si hay información del tratamiento realizado, usar esos datos
      if (sesion.tratamiento_precio_total) {
        precio_final = sesion.tratamiento_precio_total;
      }
      if (sesion.tratamiento_descuento) {
        descuento_aplicado = sesion.tratamiento_descuento;
        ahorro = sesion.tratamiento_descuento;
      }

      return {
        ...sesion,
        tratamientos_detalle,
        productos_paquete,
        productos_usados, // PRODUCTOS REALMENTE USADOS
        descuento_aplicado,
        ahorro,
        precio_final,
        metodo_pago: sesion.tratamiento_metodo_pago || 'N/A',
        // Información adicional formateada
        paciente_completo: `${sesion.paciente_nombre} ${sesion.paciente_apellido}`.trim(),
        fecha_formateada: sesion.fecha_realizada ? new Date(sesion.fecha_realizada).toLocaleString('es-PE') : 'N/A'
      };
    });

    todasSesiones.sort((a, b) => new Date(b.fecha_realizada) - new Date(a.fecha_realizada));

    console.log(`📊 Total sesiones procesadas: ${todasSesiones.length}`);

    // Agrupar por tratamiento con información detallada
    const tratamientosMap = new Map();
    todasSesiones.forEach(sesion => {
      const key = sesion.tratamiento_nombre;
      if (!tratamientosMap.has(key)) {
        tratamientosMap.set(key, {
          tratamiento_nombre: sesion.tratamiento_nombre,
          sesiones: [],
          total_sesiones: 0,
          total_ingresos: 0,
          total_ahorro: 0
        });
      }
      const trat = tratamientosMap.get(key);
      trat.sesiones.push(sesion);
      trat.total_sesiones++;
      trat.total_ingresos += parseFloat(sesion.precio_sesion || 0);
      trat.total_ahorro += parseFloat(sesion.ahorro || 0);
    });

    const tratamientos = Array.from(tratamientosMap.values());

    // Calcular totales con información detallada
    const totales = {
      total_sesiones: todasSesiones.length,
      total_ingresos: todasSesiones.reduce((sum, s) => sum + parseFloat(s.precio_sesion || 0), 0),
      total_ahorro: todasSesiones.reduce((sum, s) => sum + parseFloat(s.ahorro || 0), 0),
      comision_20: 0
    };
    totales.comision_20 = totales.total_ingresos * 0.20;

    console.log("📊 RESUMEN FINAL:");
    console.log(`   - Total sesiones: ${totales.total_sesiones}`);
    console.log(`   - Total ingresos: S/ ${totales.total_ingresos.toFixed(2)}`);
    console.log(`   - Total ahorro (descuentos): S/ ${totales.total_ahorro.toFixed(2)}`);
    console.log(`   - Comisión 20%: S/ ${totales.comision_20.toFixed(2)}`);

    res.json({
      sesiones: todasSesiones,
      tratamientos,
      totales,
      especialista: {
        id: especialistaId,
        nombre: nombreEspecialista
      }
    });

  } catch (err) {
    console.error("❌ Error al obtener detalle:", err.message, err.stack);
    res.status(500).json({ message: "Error al obtener detalle", error: err.message });
  }
});

export default router;
