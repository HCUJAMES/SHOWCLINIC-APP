import express from "express";
import db, { dbAll, dbGet, dbRun } from "../db/database.js";
import { authMiddleware } from "../middleware/auth.js";

const router = express.Router();

console.log("✅ Módulo de Gestión Clínica cargado");

// ✅ Backfill: corregir especialista_id NULL en sesiones completadas que tienen especialista texto
(async () => {
  try {
    // Paquetes sesiones
    await dbRun(`
      UPDATE paquetes_sesiones SET especialista_id = (
        SELECT e.id FROM especialistas e 
        WHERE LOWER(TRIM(e.nombre)) = LOWER(TRIM(paquetes_sesiones.especialista))
      )
      WHERE estado = 'completada' 
      AND especialista_id IS NULL 
      AND especialista IS NOT NULL 
      AND especialista != '' 
      AND especialista != 'No especificado'
      AND EXISTS (
        SELECT 1 FROM especialistas e 
        WHERE LOWER(TRIM(e.nombre)) = LOWER(TRIM(paquetes_sesiones.especialista))
      )
    `);
    
    // Presupuestos sesiones
    await dbRun(`
      UPDATE presupuestos_sesiones SET especialista_id = (
        SELECT e.id FROM especialistas e 
        WHERE LOWER(TRIM(e.nombre)) = LOWER(TRIM(presupuestos_sesiones.especialista))
      )
      WHERE estado = 'completada' 
      AND especialista_id IS NULL 
      AND especialista IS NOT NULL 
      AND especialista != '' 
      AND especialista != 'No especificado'
      AND EXISTS (
        SELECT 1 FROM especialistas e 
        WHERE LOWER(TRIM(e.nombre)) = LOWER(TRIM(presupuestos_sesiones.especialista))
      )
    `);
    
    console.log("✅ Backfill especialista_id completado");
  } catch (err) {
    console.error("⚠️ Error en backfill especialista_id:", err.message);
  }
})();

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

    const tratamientosIndividuales = await dbAll(`
      SELECT DISTINCT t.nombre as tratamiento_nombre
      FROM tratamientos_realizados tr
      INNER JOIN tratamientos t ON tr.tratamiento_id = t.id
      WHERE tr.especialista IS NOT NULL 
      AND tr.especialista != ''
      AND tr.especialista != 'No especificado'
      ORDER BY t.nombre
    `);

    // Combinar y eliminar duplicados
    const tratamientosSet = new Set();
    tratamientosPaquetes.forEach(t => tratamientosSet.add(t.tratamiento_nombre));
    tratamientosPresupuestos.forEach(t => tratamientosSet.add(t.tratamiento_nombre));
    tratamientosIndividuales.forEach(t => { if (t.tratamiento_nombre) tratamientosSet.add(t.tratamiento_nombre); });

    const tratamientos = Array.from(tratamientosSet).sort();

    res.json(tratamientos);
  } catch (err) {
    console.error("❌ Error al obtener tratamientos:", err.message);
    res.status(500).json({ message: "Error al obtener tratamientos", error: err.message });
  }
});

// ✅ Obtener estadísticas de gestión clínica
// FUENTE ÚNICA DE VERDAD: tratamientos_realizados (todas las atenciones se registran ahí)
router.get("/estadisticas", authMiddleware, async (req, res) => {
  console.log("📊 Solicitud de estadísticas recibida");
  
  try {
    const { fecha_inicio, fecha_fin, especialista_id, tratamiento } = req.query;

    // Construir condiciones WHERE sobre tratamientos_realizados
    let conditions = ["tr.especialista IS NOT NULL", "tr.especialista != ''", "tr.especialista != 'No especificado'"];
    let params = [];

    if (fecha_inicio) {
      conditions.push("DATE(tr.fecha) >= ?");
      params.push(fecha_inicio);
    }
    if (fecha_fin) {
      conditions.push("DATE(tr.fecha) <= ?");
      params.push(fecha_fin);
    }
    if (especialista_id) {
      conditions.push("e.id = ?");
      params.push(especialista_id);
    }
    if (tratamiento) {
      conditions.push("(t.nombre LIKE ? OR tr.productos LIKE ?)");
      params.push(`%${tratamiento}%`, `%${tratamiento}%`);
    }

    const whereClause = `WHERE ${conditions.join(" AND ")}`;

    // Obtener TODOS los especialistas (con comisión y pago fijo)
    const todosEspecialistas = await dbAll(`
      SELECT id as especialista_id, nombre as especialista_nombre,
        COALESCE(comision_porcentaje, 20) as comision_porcentaje,
        COALESCE(pago_fijo, 0) as pago_fijo
      FROM especialistas
      ORDER BY nombre
    `);
    todosEspecialistas.forEach(esp => { esp.tipo = esp.tipo || 'doctor'; });

    // Estadísticas por especialista (fuente única: tratamientos_realizados)
    const statsEspecialistas = await dbAll(`
      SELECT 
        e.id as especialista_id,
        e.nombre as especialista_nombre,
        COUNT(tr.id) as total_atenciones,
        COALESCE(SUM(tr.precio_total), 0) as total_ingresos,
        COUNT(DISTINCT tr.paciente_id) as pacientes_unicos
      FROM tratamientos_realizados tr
      INNER JOIN especialistas e ON LOWER(TRIM(tr.especialista)) = LOWER(TRIM(e.nombre))
      LEFT JOIN tratamientos t ON tr.tratamiento_id = t.id
      ${whereClause}
      GROUP BY e.id, e.nombre
    `, params);

    // Detalle por tratamiento
    const detalleTratamientos = await dbAll(`
      SELECT 
        e.id as especialista_id,
        e.nombre as especialista_nombre,
        COALESCE(t.nombre, 'Sin tratamiento') as tratamiento_nombre,
        COUNT(tr.id) as cantidad_sesiones,
        COALESCE(SUM(tr.precio_total), 0) as total_tratamiento
      FROM tratamientos_realizados tr
      INNER JOIN especialistas e ON LOWER(TRIM(tr.especialista)) = LOWER(TRIM(e.nombre))
      LEFT JOIN tratamientos t ON tr.tratamiento_id = t.id
      ${whereClause}
      GROUP BY e.id, e.nombre, t.nombre
      ORDER BY e.nombre, t.nombre
    `, params);

    // Inicializar mapa con TODOS los especialistas
    const especialistasMap = new Map();
    todosEspecialistas.forEach(esp => {
      especialistasMap.set(esp.especialista_id, {
        especialista_id: esp.especialista_id,
        especialista_nombre: esp.especialista_nombre,
        tipo: esp.tipo,
        comision_porcentaje: esp.comision_porcentaje,
        pago_fijo: esp.pago_fijo,
        total_atenciones: 0,
        total_ingresos: 0,
        pacientes_unicos: 0
      });
    });

    // Agregar estadísticas reales
    statsEspecialistas.forEach(stat => {
      if (especialistasMap.has(stat.especialista_id)) {
        const esp = especialistasMap.get(stat.especialista_id);
        esp.total_atenciones = stat.total_atenciones || 0;
        esp.total_ingresos = parseFloat(stat.total_ingresos) || 0;
        esp.pacientes_unicos = stat.pacientes_unicos || 0;
      }
    });

    // Calcular comisiones y ganancias
    const estadisticas = Array.from(especialistasMap.values()).map(esp => {
      const porcentaje = esp.comision_porcentaje || 20;
      const pagoFijo = esp.pago_fijo || 0;
      const comision_calculada = esp.total_ingresos * (porcentaje / 100);
      const pago_total_especialista = comision_calculada + pagoFijo;
      const ganancia_clinica = Math.max(0, esp.total_ingresos - pago_total_especialista);
      
      return {
        ...esp,
        promedio_por_sesion: esp.total_atenciones > 0 ? esp.total_ingresos / esp.total_atenciones : 0,
        comision_porcentaje: porcentaje,
        pago_fijo: pagoFijo,
        comision_calculada,
        pago_total_especialista,
        ganancia_clinica
      };
    });

    estadisticas.sort((a, b) => b.total_ingresos - a.total_ingresos);

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

    console.log(`✅ Estadísticas: ${estadisticas.length} especialistas, ${resumen.total_atenciones} atenciones, S/ ${resumen.total_ingresos.toFixed(2)}`);

    res.json({ estadisticas, tratamientos: detalleTratamientos, resumen });

  } catch (err) {
    console.error("❌ Error:", err.message, err.stack);
    res.status(500).json({ message: "Error al obtener estadísticas", error: err.message });
  }
});


// ✅ Obtener detalle completo de un especialista
// FUENTE ÚNICA DE VERDAD: tratamientos_realizados (consistente con /estadisticas)
router.get("/especialista/:id/detalle", authMiddleware, async (req, res) => {
  console.log("📋 Solicitud de detalle de especialista:", req.params.id);
  
  try {
    const { id } = req.params;
    const { fecha_inicio, fecha_fin, tratamiento } = req.query;

    if (!id || id === 'undefined' || id === 'null') {
      return res.status(400).json({ message: "ID de especialista no válido" });
    }

    // Obtener datos del especialista (incluyendo comisión y pago fijo)
    const especialistaData = await dbGet(
      "SELECT id, nombre, COALESCE(comision_porcentaje, 20) as comision_porcentaje, COALESCE(pago_fijo, 0) as pago_fijo FROM especialistas WHERE id = ?",
      [parseInt(id)]
    );

    if (!especialistaData) {
      return res.status(404).json({ message: "Especialista no encontrado" });
    }

    const nombreEspecialista = especialistaData.nombre;
    const especialistaId = especialistaData.id;
    const comisionPorcentaje = parseFloat(especialistaData.comision_porcentaje) || 20;
    const pagoFijo = parseFloat(especialistaData.pago_fijo) || 0;

    // Construir condiciones WHERE sobre tratamientos_realizados
    let conditions = [
      "LOWER(TRIM(tr.especialista)) = LOWER(TRIM(?))",
      "tr.especialista != 'No especificado'"
    ];
    let params = [nombreEspecialista];

    if (fecha_inicio) {
      conditions.push("DATE(tr.fecha) >= ?");
      params.push(fecha_inicio);
    }
    if (fecha_fin) {
      conditions.push("DATE(tr.fecha) <= ?");
      params.push(fecha_fin);
    }
    if (tratamiento) {
      conditions.push("(t.nombre LIKE ? OR tr.productos LIKE ?)");
      params.push(`%${tratamiento}%`, `%${tratamiento}%`);
    }

    const whereClause = `WHERE ${conditions.join(" AND ")}`;

    // Obtener TODOS los tratamientos realizados por este especialista
    const sesiones = await dbAll(`
      SELECT 
        tr.id as sesion_id,
        COALESCE(t.nombre, 'Sin tratamiento') as tratamiento_nombre,
        tr.tratamiento_id,
        tr.fecha as fecha_realizada,
        tr.precio_total as precio_sesion,
        tr.sesion as sesion_numero,
        tr.tipoAtencion,
        tr.productos as productos_usados_json,
        tr.descuento as tratamiento_descuento,
        tr.pagoMetodo as metodo_pago,
        COALESCE(p.nombre, 'Sin nombre') as paciente_nombre,
        COALESCE(p.apellido, '') as paciente_apellido,
        p.dni as paciente_dni
      FROM tratamientos_realizados tr
      LEFT JOIN patients p ON tr.paciente_id = p.id
      LEFT JOIN tratamientos t ON tr.tratamiento_id = t.id
      ${whereClause}
      ORDER BY tr.fecha DESC
    `, params);

    console.log(`✅ Encontrados ${sesiones.length} tratamientos para ${nombreEspecialista}`);

    // Procesar sesiones
    const todasSesiones = sesiones.map(sesion => {
      let productos_usados = [];
      try {
        if (sesion.productos_usados_json) {
          productos_usados = JSON.parse(sesion.productos_usados_json);
        }
      } catch (e) { /* ignorar error de parse */ }

      return {
        ...sesion,
        productos_usados,
        descuento_aplicado: sesion.tratamiento_descuento || 0,
        ahorro: sesion.tratamiento_descuento || 0,
        precio_final: sesion.precio_sesion || 0,
        paciente_completo: `${sesion.paciente_nombre} ${sesion.paciente_apellido}`.trim(),
        fecha_formateada: sesion.fecha_realizada ? new Date(sesion.fecha_realizada).toLocaleString('es-PE') : 'N/A',
        tipo: sesion.tipoAtencion || 'Tratamiento'
      };
    });

    // Agrupar por tratamiento
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

    // Calcular totales con comisión real del especialista
    const totalIngresos = todasSesiones.reduce((sum, s) => sum + parseFloat(s.precio_sesion || 0), 0);
    const comisionCalculada = totalIngresos * (comisionPorcentaje / 100);
    const pagoTotalEspecialista = comisionCalculada + pagoFijo;
    const gananciaClinica = Math.max(0, totalIngresos - pagoTotalEspecialista);

    const totales = {
      total_sesiones: todasSesiones.length,
      total_ingresos: totalIngresos,
      total_ahorro: todasSesiones.reduce((sum, s) => sum + parseFloat(s.ahorro || 0), 0),
      comision_porcentaje: comisionPorcentaje,
      pago_fijo: pagoFijo,
      comision_calculada: comisionCalculada,
      pago_total_especialista: pagoTotalEspecialista,
      ganancia_clinica: gananciaClinica,
      comision_20: comisionCalculada
    };

    console.log(`📊 Detalle ${nombreEspecialista}: ${totales.total_sesiones} sesiones, S/ ${totales.total_ingresos.toFixed(2)}`);

    res.json({
      sesiones: todasSesiones,
      tratamientos,
      totales,
      especialista: {
        id: especialistaId,
        nombre: nombreEspecialista,
        comision_porcentaje: comisionPorcentaje,
        pago_fijo: pagoFijo
      }
    });

  } catch (err) {
    console.error("❌ Error al obtener detalle:", err.message, err.stack);
    res.status(500).json({ message: "Error al obtener detalle", error: err.message });
  }
});

export default router;
