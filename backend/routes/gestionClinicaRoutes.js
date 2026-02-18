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
    let whereConditionsTratamientos = ["tr.especialista IS NOT NULL", "tr.especialista != ''", "tr.especialista != 'No especificado'"];
    let paramsPaquetes = [];
    let paramsPresupuestos = [];
    let paramsTratamientos = [];

    if (fecha_inicio) {
      whereConditionsPaquetes.push("DATE(ps.fecha_realizada) >= ?");
      paramsPaquetes.push(fecha_inicio);
      whereConditionsPresupuestos.push("DATE(prs.fecha_realizada) >= ?");
      paramsPresupuestos.push(fecha_inicio);
      whereConditionsTratamientos.push("DATE(tr.fecha) >= ?");
      paramsTratamientos.push(fecha_inicio);
    }

    if (fecha_fin) {
      whereConditionsPaquetes.push("DATE(ps.fecha_realizada) <= ?");
      paramsPaquetes.push(fecha_fin);
      whereConditionsPresupuestos.push("DATE(prs.fecha_realizada) <= ?");
      paramsPresupuestos.push(fecha_fin);
      whereConditionsTratamientos.push("DATE(tr.fecha) <= ?");
      paramsTratamientos.push(fecha_fin);
    }

    if (especialista_id) {
      whereConditionsPaquetes.push("ps.especialista_id = ?");
      paramsPaquetes.push(especialista_id);
      whereConditionsPresupuestos.push("prs.especialista_id = ?");
      paramsPresupuestos.push(especialista_id);
      whereConditionsTratamientos.push("e.id = ?");
      paramsTratamientos.push(especialista_id);
    }

    if (tratamiento) {
      whereConditionsPaquetes.push("ps.tratamiento_nombre LIKE ?");
      paramsPaquetes.push(`%${tratamiento}%`);
      whereConditionsPresupuestos.push("prs.tratamiento_nombre LIKE ?");
      paramsPresupuestos.push(`%${tratamiento}%`);
      whereConditionsTratamientos.push("(t.nombre LIKE ? OR tr.productos LIKE ?)");
      paramsTratamientos.push(`%${tratamiento}%`, `%${tratamiento}%`);
    }

    const whereClausePaquetes = `WHERE ${whereConditionsPaquetes.join(" AND ")}`;
    const whereClausePresupuestos = `WHERE ${whereConditionsPresupuestos.join(" AND ")}`;
    const whereClauseTratamientos = `WHERE ${whereConditionsTratamientos.join(" AND ")}`;

    // Obtener TODOS los especialistas primero (con comisión y pago fijo)
    const todosEspecialistas = await dbAll(`
      SELECT id as especialista_id, nombre as especialista_nombre,
        COALESCE(comision_porcentaje, 20) as comision_porcentaje,
        COALESCE(pago_fijo, 0) as pago_fijo
      FROM especialistas
      ORDER BY nombre
    `);

    // Estadísticas por especialista de paquetes
    const statsPaquetes = await dbAll(`
      SELECT 
        e.id as especialista_id,
        e.nombre as especialista_nombre,
        COUNT(ps.id) as atenciones,
        COALESCE(SUM(CASE WHEN ps.precio_sesion > 0 THEN ps.precio_sesion ELSE 0 END), 0) as ingresos
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
        COALESCE(SUM(CASE WHEN prs.precio_sesion > 0 THEN prs.precio_sesion ELSE 0 END), 0) as ingresos
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

    // Estadísticas por especialista de tratamientos individuales (vinculados por nombre)
    const statsTratamientos = await dbAll(`
      SELECT 
        e.id as especialista_id,
        e.nombre as especialista_nombre,
        COUNT(tr.id) as atenciones,
        COALESCE(SUM(CASE WHEN tr.precio_total > 0 THEN tr.precio_total ELSE 0 END), 0) as ingresos
      FROM tratamientos_realizados tr
      INNER JOIN especialistas e ON LOWER(TRIM(tr.especialista)) = LOWER(TRIM(e.nombre))
      ${whereClauseTratamientos}
      GROUP BY e.id, e.nombre
    `, paramsTratamientos);

    // Detalle por tratamiento de tratamientos individuales
    const detalleTratamientosIndividuales = await dbAll(`
      SELECT 
        e.id as especialista_id,
        e.nombre as especialista_nombre,
        COALESCE(t.nombre, 'Sin tratamiento') as tratamiento_nombre,
        COUNT(tr.id) as cantidad_sesiones,
        COALESCE(SUM(tr.precio_total), 0) as total_tratamiento
      FROM tratamientos_realizados tr
      INNER JOIN especialistas e ON LOWER(TRIM(tr.especialista)) = LOWER(TRIM(e.nombre))
      LEFT JOIN tratamientos t ON tr.tratamiento_id = t.id
      ${whereClauseTratamientos}
      GROUP BY e.id, e.nombre, t.nombre
      ORDER BY e.nombre, t.nombre
    `, paramsTratamientos);

    // Pacientes únicos por especialista (tratamientos individuales)
    const pacientesUnicosTratamientos = await dbAll(`
      SELECT 
        e.id as especialista_id,
        COUNT(DISTINCT tr.paciente_id) as pacientes_unicos
      FROM tratamientos_realizados tr
      INNER JOIN especialistas e ON LOWER(TRIM(tr.especialista)) = LOWER(TRIM(e.nombre))
      ${whereClauseTratamientos}
      GROUP BY e.id
    `, paramsTratamientos);

    // Pacientes únicos por especialista (paquetes)
    const pacientesUnicosPaquetes = await dbAll(`
      SELECT 
        e.id as especialista_id,
        COUNT(DISTINCT pp.paciente_id) as pacientes_unicos
      FROM paquetes_sesiones ps
      INNER JOIN especialistas e ON ps.especialista_id = e.id
      LEFT JOIN paquetes_pacientes pp ON ps.paquete_paciente_id = pp.id
      ${whereClausePaquetes}
      GROUP BY e.id
    `, paramsPaquetes);

    // Pacientes únicos por especialista (presupuestos)
    const pacientesUnicosPresupuestos = await dbAll(`
      SELECT 
        e.id as especialista_id,
        COUNT(DISTINCT pa.paciente_id) as pacientes_unicos
      FROM presupuestos_sesiones prs
      INNER JOIN especialistas e ON prs.especialista_id = e.id
      LEFT JOIN presupuestos_asignados pa ON prs.presupuesto_asignado_id = pa.id
      ${whereClausePresupuestos}
      GROUP BY e.id
    `, paramsPresupuestos);

    // Inicializar mapa con TODOS los especialistas
    const especialistasMap = new Map();
    
    todosEspecialistas.forEach(esp => {
      especialistasMap.set(esp.especialista_id, {
        especialista_id: esp.especialista_id,
        especialista_nombre: esp.especialista_nombre,
        comision_porcentaje: esp.comision_porcentaje,
        pago_fijo: esp.pago_fijo,
        atenciones_paquetes: 0,
        atenciones_presupuestos: 0,
        atenciones_tratamientos: 0,
        ingresos_paquetes: 0,
        ingresos_presupuestos: 0,
        ingresos_tratamientos: 0,
        pacientes_unicos: 0
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

    // Agregar estadísticas de tratamientos individuales
    statsTratamientos.forEach(stat => {
      const key = stat.especialista_id;
      if (especialistasMap.has(key)) {
        const esp = especialistasMap.get(key);
        esp.atenciones_tratamientos = stat.atenciones || 0;
        esp.ingresos_tratamientos = parseFloat(stat.ingresos) || 0;
      }
    });

    // Agregar pacientes únicos
    const pacientesMap = new Map();
    pacientesUnicosPaquetes.forEach(p => {
      pacientesMap.set(p.especialista_id, (pacientesMap.get(p.especialista_id) || 0) + (p.pacientes_unicos || 0));
    });
    pacientesUnicosPresupuestos.forEach(p => {
      pacientesMap.set(p.especialista_id, (pacientesMap.get(p.especialista_id) || 0) + (p.pacientes_unicos || 0));
    });
    pacientesUnicosTratamientos.forEach(p => {
      pacientesMap.set(p.especialista_id, (pacientesMap.get(p.especialista_id) || 0) + (p.pacientes_unicos || 0));
    });
    pacientesMap.forEach((count, espId) => {
      if (especialistasMap.has(espId)) {
        especialistasMap.get(espId).pacientes_unicos = count;
      }
    });

    // Convertir a array y calcular totales + comisión personalizada + pago fijo
    const estadisticas = Array.from(especialistasMap.values()).map(esp => {
      const totalAtenciones = esp.atenciones_paquetes + esp.atenciones_presupuestos + esp.atenciones_tratamientos;
      const totalIngresos = esp.ingresos_paquetes + esp.ingresos_presupuestos + esp.ingresos_tratamientos;
      const porcentaje = esp.comision_porcentaje || 20;
      const pagoFijo = esp.pago_fijo || 0;
      const comision_calculada = totalIngresos * (porcentaje / 100);
      const pago_total_especialista = comision_calculada + pagoFijo;
      const ganancia_clinica = Math.max(0, totalIngresos - pago_total_especialista);
      
      return {
        ...esp,
        total_atenciones: totalAtenciones,
        total_ingresos: totalIngresos,
        promedio_por_sesion: totalAtenciones > 0 ? totalIngresos / totalAtenciones : 0,
        comision_porcentaje: porcentaje,
        pago_fijo: pagoFijo,
        comision_calculada,
        pago_total_especialista,
        ganancia_clinica
      };
    });

    // Ordenar por total de ingresos descendente
    estadisticas.sort((a, b) => b.total_ingresos - a.total_ingresos);

    // Combinar detalle de tratamientos
    const tratamientos = [...detalleTratamientosPaquetes, ...detalleTratamientosPresupuestos, ...detalleTratamientosIndividuales];

    // Calcular resumen general
    const resumen = {
      total_atenciones: estadisticas.reduce((sum, e) => sum + e.total_atenciones, 0),
      total_ingresos: estadisticas.reduce((sum, e) => sum + e.total_ingresos, 0),
      total_pago_especialistas: estadisticas.reduce((sum, e) => sum + e.pago_total_especialista, 0),
      total_ganancia_clinica: Math.max(0, estadisticas.reduce((sum, e) => sum + e.ganancia_clinica, 0)),
      total_pacientes_unicos: estadisticas.reduce((sum, e) => sum + (e.pacientes_unicos || 0), 0),
      total_especialistas: estadisticas.filter(e => e.total_atenciones > 0).length,
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

    // Obtener tratamientos individuales (no paquetes ni presupuestos) vinculados por nombre
    let whereConditionsTratInd = [
      "LOWER(TRIM(tr.especialista)) = LOWER(TRIM(?))",
      "tr.especialista != 'No especificado'"
    ];
    let paramsTratInd = [nombreEspecialista];

    if (fecha_inicio) {
      whereConditionsTratInd.push("DATE(tr.fecha) >= ?");
      paramsTratInd.push(fecha_inicio);
    }
    if (fecha_fin) {
      whereConditionsTratInd.push("DATE(tr.fecha) <= ?");
      paramsTratInd.push(fecha_fin);
    }
    if (tratamiento) {
      whereConditionsTratInd.push("(t.nombre LIKE ? OR tr.productos LIKE ?)");
      paramsTratInd.push(`%${tratamiento}%`, `%${tratamiento}%`);
    }

    const whereClauseTratInd = `WHERE ${whereConditionsTratInd.join(" AND ")}`;

    const sesionesTratIndividuales = await dbAll(`
      SELECT 
        tr.id as sesion_id,
        COALESCE(t.nombre, 'Tratamiento Individual') as tratamiento_nombre,
        tr.tratamiento_id,
        tr.fecha as fecha_realizada,
        tr.precio_total as precio_sesion,
        tr.sesion as sesion_numero,
        NULL as sesion_notas,
        COALESCE(p.nombre, 'Sin nombre') as paciente_nombre,
        COALESCE(p.apellido, '') as paciente_apellido,
        p.dni as paciente_dni,
        NULL as paquete_paciente_id,
        NULL as paquete_nombre,
        NULL as paquete_precio_total,
        NULL as tratamientos_json,
        NULL as paquete_productos_json,
        NULL as paquete_precio_regular,
        NULL as paquete_precio,
        NULL as descuento_porcentaje,
        NULL as paquete_total_sesiones,
        tr.productos as productos_usados_json,
        tr.precio_total as tratamiento_precio_total,
        tr.descuento as tratamiento_descuento,
        tr.pagoMetodo as tratamiento_metodo_pago,
        'Individual' as tipo
      FROM tratamientos_realizados tr
      LEFT JOIN patients p ON tr.paciente_id = p.id
      LEFT JOIN tratamientos t ON tr.tratamiento_id = t.id
      ${whereClauseTratInd}
      ORDER BY tr.fecha DESC
    `, paramsTratInd);

    console.log(`✅ Encontrados ${sesionesTratIndividuales.length} tratamientos individuales`);

    // Procesar y enriquecer todas las sesiones con información detallada
    const todasSesiones = [...sesionesPaquetes, ...sesionesPresupuestos, ...sesionesTratIndividuales].map(sesion => {
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
