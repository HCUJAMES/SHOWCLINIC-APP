import express from "express";
import db, { dbAll, dbGet } from "../db/database.js";
import { authMiddleware } from "../middleware/auth.js";

const router = express.Router();

console.log("✅ Módulo de Gestión Clínica cargado");

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
      AND estado = 'completada'
      ORDER BY tratamiento_nombre
    `);

    const tratamientosPresupuestos = await dbAll(`
      SELECT DISTINCT tratamiento_nombre 
      FROM presupuestos_sesiones 
      WHERE tratamiento_nombre IS NOT NULL 
      AND tratamiento_nombre != ''
      AND estado = 'completada'
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

// Función helper para normalizar nombre de especialista en código (sin modificar BD)
// Mapea variantes conocidas al nombre canónico en la tabla especialistas
function normalizarEspecialista(nombre) {
  if (!nombre) return nombre;
  const n = nombre.trim().toLowerCase();
  // Mapeo de variantes conocidas
  const variantes = {
    'doctor': 'dr. erick espetia',
    'dr erick espetia': 'dr. erick espetia',
    'dr. erick espetia': 'dr. erick espetia',
    'dra alicia paez': 'dra. alicia paez',
    'dra edith carpio': 'dra. edith carpio',
    'romina': 'romina carbajal',
    'cost. romina': 'romina carbajal',
    'yuny': 'yunianly rodriguez',
    'yuny rodriguez': 'yunianly rodriguez',
  };
  return variantes[n] || n;
}

// ✅ Obtener estadísticas de gestión clínica
// ENFOQUE HÍBRIDO:
//   - Atenciones y pacientes_unicos: desde tratamientos_realizados (fuente única de registros de atención)
//   - Ingresos: desde paquetes_sesiones + presupuestos_sesiones + tratamientos individuales con precio>0
//   - Matching de especialista: por texto normalizado (sin depender de especialista_id que suele ser NULL)
router.get("/estadisticas", authMiddleware, async (req, res) => {
  console.log("📊 Solicitud de estadísticas recibida");
  
  try {
    const { fecha_inicio, fecha_fin, especialista_id, tratamiento } = req.query;

    // ── Obtener TODOS los especialistas con comisión y pago fijo ──
    const todosEspecialistas = await dbAll(`
      SELECT id as especialista_id, nombre as especialista_nombre,
        COALESCE(comision_porcentaje, 20) as comision_porcentaje,
        COALESCE(pago_fijo, 0) as pago_fijo
      FROM especialistas
      ORDER BY nombre
    `);
    todosEspecialistas.forEach(esp => { esp.tipo = esp.tipo || 'doctor'; });

    // Crear mapa nombre_normalizado -> especialista_id para resolver variantes
    const nombreToId = new Map();
    todosEspecialistas.forEach(esp => {
      nombreToId.set(esp.especialista_nombre.trim().toLowerCase(), esp.especialista_id);
    });

    // ── 1) ATENCIONES Y PACIENTES: desde tratamientos_realizados ──
    let condTR = ["tr.especialista IS NOT NULL", "tr.especialista != ''", "tr.especialista != 'No especificado'"];
    let paramsTR = [];
    if (fecha_inicio) { condTR.push("DATE(tr.fecha) >= ?"); paramsTR.push(fecha_inicio); }
    if (fecha_fin) { condTR.push("DATE(tr.fecha) <= ?"); paramsTR.push(fecha_fin); }
    if (tratamiento) { condTR.push("(t.nombre LIKE ?)"); paramsTR.push(`%${tratamiento}%`); }
    // No filtrar por especialista_id aquí, lo hacemos en código después de normalizar
    const whereTR = `WHERE ${condTR.join(" AND ")}`;

    const rawTratamientos = await dbAll(`
      SELECT 
        tr.especialista,
        tr.paciente_id,
        tr.precio_total,
        t.nombre as tratamiento_nombre
      FROM tratamientos_realizados tr
      LEFT JOIN tratamientos t ON tr.tratamiento_id = t.id
      ${whereTR}
    `, paramsTR);

    // Agrupar atenciones por especialista normalizado
    const atencionesMap = new Map(); // especialista_id -> { atenciones, pacientes Set, ingresos_individuales }
    rawTratamientos.forEach(row => {
      const espNorm = normalizarEspecialista(row.especialista);
      const espId = nombreToId.get(espNorm);
      if (!espId) return; // No matchea ningún especialista conocido
      if (especialista_id && espId !== parseInt(especialista_id)) return; // Filtro de especialista

      if (!atencionesMap.has(espId)) {
        atencionesMap.set(espId, { atenciones: 0, pacientes: new Set(), ingresos_ind: 0, tratamientos: new Map() });
      }
      const data = atencionesMap.get(espId);
      data.atenciones++;
      if (row.paciente_id) data.pacientes.add(row.paciente_id);
      // Sumar solo tratamientos individuales con precio > 0
      const precio = parseFloat(row.precio_total) || 0;
      if (precio > 0) data.ingresos_ind += precio;
      // Detalle por tratamiento
      const tratNombre = row.tratamiento_nombre || 'Sin tratamiento';
      if (!data.tratamientos.has(tratNombre)) {
        data.tratamientos.set(tratNombre, { cantidad_sesiones: 0, total_tratamiento: 0 });
      }
      const td = data.tratamientos.get(tratNombre);
      td.cantidad_sesiones++;
      td.total_tratamiento += precio;
    });

    // ── 2) INGRESOS PAQUETES: desde paquetes_sesiones completadas ──
    let condPaq = ["ps.estado = 'completada'", "(ps.especialista IS NOT NULL AND ps.especialista != '' AND ps.especialista != 'No especificado')"];
    let paramsPaq = [];
    if (fecha_inicio) { condPaq.push("DATE(ps.fecha_realizada) >= ?"); paramsPaq.push(fecha_inicio); }
    if (fecha_fin) { condPaq.push("DATE(ps.fecha_realizada) <= ?"); paramsPaq.push(fecha_fin); }
    if (tratamiento) { condPaq.push("ps.tratamiento_nombre LIKE ?"); paramsPaq.push(`%${tratamiento}%`); }
    const wherePaq = `WHERE ${condPaq.join(" AND ")}`;

    const rawPaquetes = await dbAll(`
      SELECT ps.especialista, ps.especialista_id, COALESCE(ps.precio_sesion, 0) as precio_sesion
      FROM paquetes_sesiones ps
      ${wherePaq}
    `, paramsPaq);

    // Agrupar ingresos paquetes por especialista
    const ingresosPaqMap = new Map(); // especialista_id -> total
    rawPaquetes.forEach(row => {
      // Intentar resolver por especialista_id primero, luego por nombre normalizado
      let espId = row.especialista_id;
      if (!espId) {
        const espNorm = normalizarEspecialista(row.especialista);
        espId = nombreToId.get(espNorm);
      }
      if (!espId) return;
      if (especialista_id && espId !== parseInt(especialista_id)) return;
      ingresosPaqMap.set(espId, (ingresosPaqMap.get(espId) || 0) + (parseFloat(row.precio_sesion) || 0));
    });

    // ── 3) INGRESOS PRESUPUESTOS: desde presupuestos_sesiones completadas ──
    let condPres = ["prs.estado = 'completada'", "(prs.especialista IS NOT NULL AND prs.especialista != '' AND prs.especialista != 'No especificado')"];
    let paramsPres = [];
    if (fecha_inicio) { condPres.push("DATE(prs.fecha_realizada) >= ?"); paramsPres.push(fecha_inicio); }
    if (fecha_fin) { condPres.push("DATE(prs.fecha_realizada) <= ?"); paramsPres.push(fecha_fin); }
    if (tratamiento) { condPres.push("prs.tratamiento_nombre LIKE ?"); paramsPres.push(`%${tratamiento}%`); }
    const wherePres = `WHERE ${condPres.join(" AND ")}`;

    const rawPresupuestos = await dbAll(`
      SELECT prs.especialista, prs.especialista_id, COALESCE(prs.precio_sesion, 0) as precio_sesion
      FROM presupuestos_sesiones prs
      ${wherePres}
    `, paramsPres);

    const ingresosPresMap = new Map();
    rawPresupuestos.forEach(row => {
      let espId = row.especialista_id;
      if (!espId) {
        const espNorm = normalizarEspecialista(row.especialista);
        espId = nombreToId.get(espNorm);
      }
      if (!espId) return;
      if (especialista_id && espId !== parseInt(especialista_id)) return;
      ingresosPresMap.set(espId, (ingresosPresMap.get(espId) || 0) + (parseFloat(row.precio_sesion) || 0));
    });

    // ── COMBINAR TODO ──
    const especialistasMap = new Map();
    todosEspecialistas.forEach(esp => {
      const espId = esp.especialista_id;
      if (especialista_id && espId !== parseInt(especialista_id)) return;
      const atenData = atencionesMap.get(espId) || { atenciones: 0, pacientes: new Set(), ingresos_ind: 0 };
      const ingPaq = ingresosPaqMap.get(espId) || 0;
      const ingPres = ingresosPresMap.get(espId) || 0;
      const ingInd = atenData.ingresos_ind || 0;
      const totalIngresos = ingPaq + ingPres + ingInd;

      especialistasMap.set(espId, {
        especialista_id: espId,
        especialista_nombre: esp.especialista_nombre,
        tipo: esp.tipo,
        comision_porcentaje: esp.comision_porcentaje,
        pago_fijo: esp.pago_fijo,
        total_atenciones: atenData.atenciones,
        total_ingresos: totalIngresos,
        ingresos_paquetes: ingPaq,
        ingresos_presupuestos: ingPres,
        ingresos_individuales: ingInd,
        pacientes_unicos: atenData.pacientes.size
      });
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

    // Detalle por tratamiento (para la tabla de desglose)
    const detalleTratamientos = [];
    atencionesMap.forEach((data, espId) => {
      const espInfo = especialistasMap.get(espId);
      if (!espInfo) return;
      data.tratamientos.forEach((tData, tratNombre) => {
        detalleTratamientos.push({
          especialista_id: espId,
          especialista_nombre: espInfo.especialista_nombre,
          tratamiento_nombre: tratNombre,
          cantidad_sesiones: tData.cantidad_sesiones,
          total_tratamiento: tData.total_tratamiento
        });
      });
    });

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

    console.log(`✅ Estadísticas: ${estadisticas.length} esp, ${resumen.total_atenciones} atenciones, S/ ${resumen.total_ingresos.toFixed(2)}`);

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
    // Usamos filtro amplio y luego filtramos en código con normalizarEspecialista()
    let conditions = [
      "tr.especialista IS NOT NULL",
      "tr.especialista != ''",
      "tr.especialista != 'No especificado'"
    ];
    let params = [];

    if (fecha_inicio) {
      conditions.push("DATE(tr.fecha) >= ?");
      params.push(fecha_inicio);
    }
    if (fecha_fin) {
      conditions.push("DATE(tr.fecha) <= ?");
      params.push(fecha_fin);
    }
    if (tratamiento) {
      conditions.push("(t.nombre LIKE ?)");
      params.push(`%${tratamiento}%`);
    }

    const whereClause = `WHERE ${conditions.join(" AND ")}`;

    // Obtener tratamientos y filtrar por especialista normalizado en código
    const allSesiones = await dbAll(`
      SELECT 
        tr.id as sesion_id,
        COALESCE(t.nombre, 'Sin tratamiento') as tratamiento_nombre,
        tr.tratamiento_id,
        tr.fecha as fecha_realizada,
        tr.precio_total as precio_sesion,
        tr.sesion as sesion_numero,
        tr.tipoAtencion,
        tr.especialista as especialista_raw,
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

    // Filtrar por especialista normalizado
    const nombreNorm = nombreEspecialista.trim().toLowerCase();
    const sesiones = allSesiones.filter(s => normalizarEspecialista(s.especialista_raw) === nombreNorm);

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

    // ── INGRESOS HÍBRIDOS: paquetes + presupuestos + individuales (consistente con /estadisticas) ──
    // Ingresos individuales (tratamientos con precio > 0)
    const ingresosIndividuales = todasSesiones.reduce((sum, s) => sum + (parseFloat(s.precio_sesion) > 0 ? parseFloat(s.precio_sesion) : 0), 0);

    // Ingresos de paquetes completados por este especialista
    let condPaqDet = ["ps.estado = 'completada'", "(ps.especialista IS NOT NULL AND ps.especialista != '')"];
    let paramsPaqDet = [];
    if (fecha_inicio) { condPaqDet.push("DATE(ps.fecha_realizada) >= ?"); paramsPaqDet.push(fecha_inicio); }
    if (fecha_fin) { condPaqDet.push("DATE(ps.fecha_realizada) <= ?"); paramsPaqDet.push(fecha_fin); }
    if (tratamiento) { condPaqDet.push("ps.tratamiento_nombre LIKE ?"); paramsPaqDet.push(`%${tratamiento}%`); }

    const rawPaqDet = await dbAll(`
      SELECT ps.especialista, ps.especialista_id, COALESCE(ps.precio_sesion, 0) as precio_sesion
      FROM paquetes_sesiones ps WHERE ${condPaqDet.join(" AND ")}
    `, paramsPaqDet);

    let ingresosPaquetes = 0;
    rawPaqDet.forEach(row => {
      let matchId = row.especialista_id;
      if (!matchId) {
        const norm = normalizarEspecialista(row.especialista);
        if (norm === nombreNorm) matchId = especialistaId;
      }
      if (matchId === especialistaId) ingresosPaquetes += parseFloat(row.precio_sesion) || 0;
    });

    // Ingresos de presupuestos completados por este especialista
    let condPresDet = ["prs.estado = 'completada'", "(prs.especialista IS NOT NULL AND prs.especialista != '')"];
    let paramsPresDet = [];
    if (fecha_inicio) { condPresDet.push("DATE(prs.fecha_realizada) >= ?"); paramsPresDet.push(fecha_inicio); }
    if (fecha_fin) { condPresDet.push("DATE(prs.fecha_realizada) <= ?"); paramsPresDet.push(fecha_fin); }
    if (tratamiento) { condPresDet.push("prs.tratamiento_nombre LIKE ?"); paramsPresDet.push(`%${tratamiento}%`); }

    const rawPresDet = await dbAll(`
      SELECT prs.especialista, prs.especialista_id, COALESCE(prs.precio_sesion, 0) as precio_sesion
      FROM presupuestos_sesiones prs WHERE ${condPresDet.join(" AND ")}
    `, paramsPresDet);

    let ingresosPresupuestos = 0;
    rawPresDet.forEach(row => {
      let matchId = row.especialista_id;
      if (!matchId) {
        const norm = normalizarEspecialista(row.especialista);
        if (norm === nombreNorm) matchId = especialistaId;
      }
      if (matchId === especialistaId) ingresosPresupuestos += parseFloat(row.precio_sesion) || 0;
    });

    const totalIngresos = ingresosPaquetes + ingresosPresupuestos + ingresosIndividuales;
    const comisionCalculada = totalIngresos * (comisionPorcentaje / 100);
    const pagoTotalEspecialista = comisionCalculada + pagoFijo;
    const gananciaClinica = Math.max(0, totalIngresos - pagoTotalEspecialista);

    const totales = {
      total_sesiones: todasSesiones.length,
      total_ingresos: totalIngresos,
      ingresos_paquetes: ingresosPaquetes,
      ingresos_presupuestos: ingresosPresupuestos,
      ingresos_individuales: ingresosIndividuales,
      total_ahorro: todasSesiones.reduce((sum, s) => sum + parseFloat(s.ahorro || 0), 0),
      comision_porcentaje: comisionPorcentaje,
      pago_fijo: pagoFijo,
      comision_calculada: comisionCalculada,
      pago_total_especialista: pagoTotalEspecialista,
      ganancia_clinica: gananciaClinica,
      comision_20: comisionCalculada
    };

    console.log(`📊 Detalle ${nombreEspecialista}: ${totales.total_sesiones} sesiones, S/ ${totales.total_ingresos.toFixed(2)} (paq:${ingresosPaquetes} pres:${ingresosPresupuestos} ind:${ingresosIndividuales})`);

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
