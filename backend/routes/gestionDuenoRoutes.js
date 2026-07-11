import express from "express";
import db, { dbAll, dbGet, dbRun } from "../db/database.js";
import { authMiddleware, requireRole } from "../middleware/auth.js";

const router = express.Router();

// Guard: solo master o doctor (dueño)
const requireOwner = requireRole("master", "doctor");

// Helper fecha Lima
function fechaLima() {
  return new Date()
    .toLocaleString("sv-SE", { timeZone: "America/Lima" })
    .replace("T", " ")
    .slice(0, 19);
}

/* ======================================================================
   🔄 MIGRACIÓN EN CÓDIGO: Poblar lineas_presupuesto desde presupuestos existentes
   Se ejecuta al primer request o se puede llamar manualmente.
====================================================================== */
let migrationDone = false;

async function ensureLineasMigration() {
  if (migrationDone) return;
  migrationDone = true;

  try {
    // Verificar si ya hay lineas creadas
    const count = await dbGet("SELECT COUNT(*) as c FROM lineas_presupuesto");
    if (count.c > 0) return; // Ya migrado

    // Obtener todos los presupuestos asignados
    const presupuestos = await dbAll("SELECT id, tratamientos_json, especialista_id FROM presupuestos_asignados");

    for (const pres of presupuestos) {
      let items = [];
      try { items = pres.tratamientos_json ? JSON.parse(pres.tratamientos_json) : []; } catch (e) { continue; }

      for (const item of items) {
        const nombre = item.nombre || "Sin nombre";
        const sesionesTotales = Number(item.sesiones) >= 1 ? Number(item.sesiones) : 1;
        const precio = Number(item.precio) || 0;

        // Contar sesiones realizadas desde presupuestos_sesiones
        const realizadas = await dbGet(
          `SELECT COUNT(*) as c FROM presupuestos_sesiones 
           WHERE presupuesto_asignado_id = ? AND tratamiento_nombre = ? AND estado = 'completada'`,
          [pres.id, nombre]
        );
        const sesionesRealizadas = realizadas?.c || 0;

        // Determinar estado
        let estado = "pendiente";
        if (sesionesRealizadas > 0 && sesionesRealizadas < sesionesTotales) estado = "en_curso";
        else if (sesionesRealizadas >= sesionesTotales) estado = "listo_para_culminar";

        await dbRun(
          `INSERT INTO lineas_presupuesto (
            presupuesto_asignado_id, tratamiento_nombre, tratamiento_id,
            especialista_id, sesiones_totales, sesiones_realizadas,
            precio, estado, creado_en
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            pres.id,
            nombre,
            item.tratamientoId || item.tratamiento_id || null,
            pres.especialista_id || null,
            sesionesTotales,
            sesionesRealizadas,
            precio,
            estado,
            fechaLima()
          ]
        );
      }
    }

    console.log("✅ Migración de lineas_presupuesto completada");
  } catch (err) {
    console.error("❌ Error en migración de lineas_presupuesto:", err.message);
    migrationDone = false; // Reintentar en próximo request
  }
}

/* ======================================================================
   📊 DASHBOARD KPIs DEL DUEÑO
====================================================================== */
router.get("/dashboard", authMiddleware, requireOwner, async (req, res) => {
  await ensureLineasMigration();

  try {
    const { fecha_inicio, fecha_fin } = req.query;

    let condFecha = "";
    let condFechaFin = "";
    let params = [];
    let paramsFin = [];

    if (fecha_inicio) {
      condFecha += " AND DATE(pa.creado_en) >= ?";
      condFechaFin += " AND DATE(f.fecha) >= ?";
      params.push(fecha_inicio);
      paramsFin.push(fecha_inicio);
    }
    if (fecha_fin) {
      condFecha += " AND DATE(pa.creado_en) <= ?";
      condFechaFin += " AND DATE(f.fecha) <= ?";
      params.push(fecha_fin);
      paramsFin.push(fecha_fin);
    }

    // Ingresos totales (desde finanzas tipo ingreso)
    const ingresos = await dbGet(
      `SELECT COALESCE(SUM(monto), 0) as total FROM finanzas f WHERE f.tipo = 'ingreso' ${condFechaFin}`,
      paramsFin
    );

    // Tratamientos realizados (sesiones completadas en presupuestos)
    const tratRealizados = await dbGet(
      `SELECT COUNT(*) as total FROM presupuestos_sesiones ps
       JOIN presupuestos_asignados pa ON ps.presupuesto_asignado_id = pa.id
       WHERE ps.estado = 'completada' ${condFecha}`,
      params
    );

    // Pacientes atendidos (únicos con sesiones completadas)
    const pacientesAtendidos = await dbGet(
      `SELECT COUNT(DISTINCT pa.paciente_id) as total FROM presupuestos_sesiones ps
       JOIN presupuestos_asignados pa ON ps.presupuesto_asignado_id = pa.id
       WHERE ps.estado = 'completada' ${condFecha}`,
      params
    );

    // Ticket promedio
    const ticketPromedio = ingresos.total > 0 && pacientesAtendidos.total > 0
      ? ingresos.total / pacientesAtendidos.total : 0;

    // Ingresos por mes (últimos 12 meses)
    const ingresosPorMes = await dbAll(`
      SELECT strftime('%Y-%m', fecha) as mes, SUM(monto) as total
      FROM finanzas WHERE tipo = 'ingreso'
      GROUP BY mes ORDER BY mes DESC LIMIT 12
    `);

    // Tratamientos más vendidos (por líneas de presupuesto)
    const tratamientosMasVendidos = await dbAll(`
      SELECT tratamiento_nombre, COUNT(*) as cantidad, SUM(precio) as ingresos
      FROM lineas_presupuesto
      GROUP BY tratamiento_nombre
      ORDER BY cantidad DESC LIMIT 10
    `);

    // Pagos pendientes a especialistas (comisiones no liquidadas)
    const pagosPendientes = await dbAll(`
      SELECT e.id, e.nombre, COALESCE(SUM(c.monto), 0) as monto_pendiente
      FROM comisiones_especialistas c
      JOIN especialistas e ON c.especialista_id = e.id
      WHERE c.estado = 'pendiente' AND c.revertido = 0
      GROUP BY e.id
      ORDER BY monto_pendiente DESC
    `);

    // Últimos tratamientos realizados
    const ultimosTratamientos = await dbAll(`
      SELECT ps.tratamiento_nombre, ps.fecha_realizada, ps.precio_sesion,
             pa.paciente_id, p.nombre as paciente_nombre, p.apellido as paciente_apellido,
             ps.especialista
      FROM presupuestos_sesiones ps
      JOIN presupuestos_asignados pa ON ps.presupuesto_asignado_id = pa.id
      JOIN patients p ON pa.paciente_id = p.id
      WHERE ps.estado = 'completada'
      ORDER BY ps.fecha_realizada DESC LIMIT 20
    `);

    // Rendimiento por especialista
    const rendimientoEspecialistas = await dbAll(`
      SELECT e.id, e.nombre, e.comision_porcentaje,
        COUNT(DISTINCT lp.id) as lineas_total,
        SUM(CASE WHEN lp.estado = 'culminado' THEN 1 ELSE 0 END) as lineas_culminadas,
        COALESCE(SUM(lp.precio), 0) as ingresos_generados
      FROM especialistas e
      LEFT JOIN lineas_presupuesto lp ON lp.especialista_id = e.id
      GROUP BY e.id
      ORDER BY ingresos_generados DESC
    `);

    // Presupuestos activos
    const presupuestosActivos = await dbGet(
      `SELECT COUNT(*) as total FROM presupuestos_asignados WHERE estado_gestion = 'activo' OR estado_gestion IS NULL`
    );

    res.json({
      kpis: {
        ingresos_totales: ingresos.total,
        tratamientos_realizados: tratRealizados.total,
        pacientes_atendidos: pacientesAtendidos.total,
        ticket_promedio: ticketPromedio,
        presupuestos_activos: presupuestosActivos.total
      },
      ingresos_por_mes: ingresosPorMes,
      tratamientos_mas_vendidos: tratamientosMasVendidos,
      pagos_pendientes: pagosPendientes,
      ultimos_tratamientos: ultimosTratamientos,
      rendimiento_especialistas: rendimientoEspecialistas
    });
  } catch (err) {
    console.error("❌ Error dashboard dueño:", err.message);
    res.status(500).json({ message: "Error al obtener dashboard", error: err.message });
  }
});

/* ======================================================================
   📋 PRESUPUESTOS — LISTADO CON LÍNEAS
====================================================================== */
router.get("/presupuestos", authMiddleware, requireOwner, async (req, res) => {
  await ensureLineasMigration();

  try {
    const { estado, especialista_id, paciente_id, fecha_inicio, fecha_fin } = req.query;

    let conditions = ["1=1"];
    let params = [];

    if (estado) {
      conditions.push("pa.estado_gestion = ?");
      params.push(estado);
    }
    if (paciente_id) {
      conditions.push("pa.paciente_id = ?");
      params.push(paciente_id);
    }
    if (fecha_inicio) {
      conditions.push("DATE(pa.creado_en) >= ?");
      params.push(fecha_inicio);
    }
    if (fecha_fin) {
      conditions.push("DATE(pa.creado_en) <= ?");
      params.push(fecha_fin);
    }

    const whereClause = conditions.join(" AND ");

    let presupuestos = await dbAll(`
      SELECT pa.id, pa.paciente_id, pa.precio_total, pa.descuento, pa.estado,
             pa.estado_gestion, pa.creado_en, pa.monto_pagado, pa.saldo_pendiente,
             pa.estado_pago,
             p.nombre as paciente_nombre, p.apellido as paciente_apellido,
             p.dni as paciente_dni
      FROM presupuestos_asignados pa
      JOIN patients p ON pa.paciente_id = p.id
      WHERE ${whereClause}
      ORDER BY pa.creado_en DESC
    `, params);

    // Para cada presupuesto, obtener sus líneas y especialistas involucrados
    for (const pres of presupuestos) {
      const lineas = await dbAll(
        `SELECT lp.*, e.nombre as especialista_nombre
         FROM lineas_presupuesto lp
         LEFT JOIN especialistas e ON lp.especialista_id = e.id
         WHERE lp.presupuesto_asignado_id = ?`,
        [pres.id]
      );
      pres.lineas = lineas;
      pres.total_lineas = lineas.length;
      pres.lineas_culminadas = lineas.filter(l => l.estado === "culminado").length;

      // Especialistas involucrados (únicos)
      const especialistas = [...new Set(lineas.filter(l => l.especialista_nombre).map(l => l.especialista_nombre))];
      pres.especialistas_involucrados = especialistas;

      // Filtro por especialista si se pidió
      if (especialista_id) {
        const tieneEspecialista = lineas.some(l => l.especialista_id === parseInt(especialista_id));
        if (!tieneEspecialista) {
          pres._excluir = true;
        }
      }
    }

    // Filtrar si se pidió especialista
    if (especialista_id) {
      presupuestos = presupuestos.filter(p => !p._excluir);
    }

    res.json(presupuestos);
  } catch (err) {
    console.error("❌ Error listando presupuestos:", err.message);
    res.status(500).json({ message: "Error al listar presupuestos", error: err.message });
  }
});

/* ======================================================================
   📋 DETALLE DE PRESUPUESTO
====================================================================== */
router.get("/presupuestos/:id", authMiddleware, requireOwner, async (req, res) => {
  await ensureLineasMigration();

  try {
    const { id } = req.params;

    const presupuesto = await dbGet(`
      SELECT pa.*, p.nombre as paciente_nombre, p.apellido as paciente_apellido,
             p.dni as paciente_dni, p.celular as paciente_celular
      FROM presupuestos_asignados pa
      JOIN patients p ON pa.paciente_id = p.id
      WHERE pa.id = ?
    `, [id]);

    if (!presupuesto) {
      return res.status(404).json({ message: "Presupuesto no encontrado" });
    }

    // Líneas con especialista
    const lineas = await dbAll(`
      SELECT lp.*, e.nombre as especialista_nombre, e.comision_porcentaje as esp_comision_porcentaje
      FROM lineas_presupuesto lp
      LEFT JOIN especialistas e ON lp.especialista_id = e.id
      WHERE lp.presupuesto_asignado_id = ?
      ORDER BY lp.id ASC
    `, [id]);

    // Sesiones por línea
    for (const linea of lineas) {
      const sesiones = await dbAll(
        `SELECT * FROM presupuestos_sesiones
         WHERE presupuesto_asignado_id = ? AND tratamiento_nombre = ?
         ORDER BY sesion_numero ASC`,
        [id, linea.tratamiento_nombre]
      );
      linea.sesiones = sesiones;

      // Comisión asociada
      const comision = await dbGet(
        `SELECT * FROM comisiones_especialistas WHERE linea_presupuesto_id = ? AND revertido = 0`,
        [linea.id]
      );
      linea.comision = comision || null;
    }

    // Recalcular pagos desde finanzas
    const sumaPagos = await dbGet(
      `SELECT COALESCE(SUM(monto), 0) as total_pagado FROM finanzas
       WHERE referencia_id = ? AND referencia_tipo = 'presupuesto_asignado' AND tipo = 'ingreso'`,
      [id]
    );
    presupuesto.monto_pagado_real = parseFloat(sumaPagos?.total_pagado) || 0;

    res.json({ presupuesto, lineas });
  } catch (err) {
    console.error("❌ Error detalle presupuesto:", err.message);
    res.status(500).json({ message: "Error al obtener detalle", error: err.message });
  }
});

/* ======================================================================
   ✏️ ASIGNAR ESPECIALISTA A LÍNEA DE PRESUPUESTO
====================================================================== */
router.put("/lineas/:linea_id/especialista", authMiddleware, requireOwner, async (req, res) => {
  try {
    const { linea_id } = req.params;
    const { especialista_id } = req.body;

    if (!especialista_id) {
      return res.status(400).json({ message: "especialista_id es requerido" });
    }

    // Verificar que el especialista existe
    const esp = await dbGet("SELECT id, comision_porcentaje FROM especialistas WHERE id = ?", [especialista_id]);
    if (!esp) {
      return res.status(404).json({ message: "Especialista no encontrado" });
    }

    await dbRun(
      `UPDATE lineas_presupuesto SET especialista_id = ?, comision_porcentaje = ? WHERE id = ?`,
      [especialista_id, esp.comision_porcentaje || 20, linea_id]
    );

    res.json({ message: "Especialista asignado a la línea" });
  } catch (err) {
    console.error("❌ Error asignando especialista:", err.message);
    res.status(500).json({ message: "Error al asignar especialista", error: err.message });
  }
});

/* ======================================================================
   ✅ CULMINAR LÍNEA DE TRATAMIENTO (check manual + auditoría + comisión)
====================================================================== */
router.post("/lineas/:linea_id/culminar", authMiddleware, requireOwner, async (req, res) => {
  try {
    const { linea_id } = req.params;
    const username = req.user?.username || "sistema";

    const linea = await dbGet(
      `SELECT lp.*, pa.paciente_id FROM lineas_presupuesto lp
       JOIN presupuestos_asignados pa ON lp.presupuesto_asignado_id = pa.id
       WHERE lp.id = ?`,
      [linea_id]
    );

    if (!linea) {
      return res.status(404).json({ message: "Línea no encontrada" });
    }

    if (linea.estado === "culminado") {
      return res.status(400).json({ message: "La línea ya está culminada" });
    }

    if (!linea.especialista_id) {
      return res.status(400).json({ message: "La línea debe tener un especialista asignado para culminar" });
    }

    const ahora = fechaLima();

    // Obtener comisión porcentaje
    const comisionPct = linea.comision_porcentaje || 20;
    const comisionMonto = linea.precio * (comisionPct / 100);

    // Actualizar línea a culminado
    await dbRun(
      `UPDATE lineas_presupuesto SET estado = 'culminado', culminado_en = ?, culminado_por = ?, comision_monto = ? WHERE id = ?`,
      [ahora, username, comisionMonto, linea_id]
    );

    // Crear registro de comisión pendiente
    await dbRun(
      `INSERT INTO comisiones_especialistas (especialista_id, linea_presupuesto_id, presupuesto_asignado_id, paciente_id, monto, estado, creado_en)
       VALUES (?, ?, ?, ?, ?, 'pendiente', ?)`,
      [linea.especialista_id, linea_id, linea.presupuesto_asignado_id, linea.paciente_id, comisionMonto, ahora]
    );

    // Verificar si todas las líneas del presupuesto están culminadas → actualizar estado_gestion
    const pendientes = await dbGet(
      `SELECT COUNT(*) as c FROM lineas_presupuesto WHERE presupuesto_asignado_id = ? AND estado != 'culminado'`,
      [linea.presupuesto_asignado_id]
    );

    if (pendientes.c === 0) {
      await dbRun(
        `UPDATE presupuestos_asignados SET estado_gestion = 'culminado' WHERE id = ?`,
        [linea.presupuesto_asignado_id]
      );
    }

    res.json({
      message: "✅ Línea culminada y comisión registrada",
      comision_monto: comisionMonto,
      estado_presupuesto: pendientes.c === 0 ? "culminado" : "activo"
    });
  } catch (err) {
    console.error("❌ Error culminando línea:", err.message);
    res.status(500).json({ message: "Error al culminar línea", error: err.message });
  }
});

/* ======================================================================
   ↩️ REVERTIR CULMINACIÓN (solo si comisión aún no liquidada)
====================================================================== */
router.post("/lineas/:linea_id/revertir", authMiddleware, requireOwner, async (req, res) => {
  try {
    const { linea_id } = req.params;
    const username = req.user?.username || "sistema";

    const linea = await dbGet("SELECT * FROM lineas_presupuesto WHERE id = ?", [linea_id]);
    if (!linea) {
      return res.status(404).json({ message: "Línea no encontrada" });
    }

    if (linea.estado !== "culminado") {
      return res.status(400).json({ message: "La línea no está culminada" });
    }

    // Verificar que la comisión no esté liquidada
    const comision = await dbGet(
      `SELECT * FROM comisiones_especialistas WHERE linea_presupuesto_id = ? AND revertido = 0`,
      [linea_id]
    );

    if (comision && comision.estado === "liquidado") {
      return res.status(400).json({ message: "No se puede revertir: la comisión ya fue liquidada" });
    }

    const ahora = fechaLima();

    // Revertir la línea
    const nuevoEstado = linea.sesiones_realizadas >= linea.sesiones_totales ? "listo_para_culminar" : "en_curso";
    await dbRun(
      `UPDATE lineas_presupuesto SET estado = ?, culminado_en = NULL, culminado_por = NULL, revertido_en = ?, revertido_por = ?, comision_monto = 0 WHERE id = ?`,
      [nuevoEstado, ahora, username, linea_id]
    );

    // Revertir la comisión
    if (comision) {
      await dbRun(
        `UPDATE comisiones_especialistas SET revertido = 1, revertido_en = ?, revertido_por = ? WHERE id = ?`,
        [ahora, username, comision.id]
      );
    }

    // Revertir estado_gestion del presupuesto a activo
    await dbRun(
      `UPDATE presupuestos_asignados SET estado_gestion = 'activo' WHERE id = ?`,
      [linea.presupuesto_asignado_id]
    );

    res.json({ message: "✅ Culminación revertida", nuevo_estado: nuevoEstado });
  } catch (err) {
    console.error("❌ Error revirtiendo culminación:", err.message);
    res.status(500).json({ message: "Error al revertir", error: err.message });
  }
});

/* ======================================================================
   👤 PERFIL DEL ESPECIALISTA (para el módulo dueño)
====================================================================== */
router.get("/especialistas/:id/perfil", authMiddleware, requireOwner, async (req, res) => {
  await ensureLineasMigration();

  try {
    const { id } = req.params;

    const especialista = await dbGet("SELECT * FROM especialistas WHERE id = ?", [id]);
    if (!especialista) {
      return res.status(404).json({ message: "Especialista no encontrado" });
    }

    // Resumen: líneas asignadas
    const resumen = await dbGet(`
      SELECT
        COUNT(*) as total_lineas,
        SUM(CASE WHEN estado = 'culminado' THEN 1 ELSE 0 END) as culminadas,
        SUM(CASE WHEN estado IN ('pendiente','en_curso','listo_para_culminar') THEN 1 ELSE 0 END) as en_curso,
        COALESCE(SUM(precio), 0) as ingresos_generados
      FROM lineas_presupuesto WHERE especialista_id = ?
    `, [id]);

    // Comisiones
    const comisionPendiente = await dbGet(
      `SELECT COALESCE(SUM(monto), 0) as total FROM comisiones_especialistas WHERE especialista_id = ? AND estado = 'pendiente' AND revertido = 0`,
      [id]
    );
    const comisionLiquidada = await dbGet(
      `SELECT COALESCE(SUM(monto), 0) as total FROM comisiones_especialistas WHERE especialista_id = ? AND estado = 'liquidado' AND revertido = 0`,
      [id]
    );

    // Líneas agrupadas por presupuesto/paciente
    const lineas = await dbAll(`
      SELECT lp.*, pa.paciente_id,
             p.nombre as paciente_nombre, p.apellido as paciente_apellido
      FROM lineas_presupuesto lp
      JOIN presupuestos_asignados pa ON lp.presupuesto_asignado_id = pa.id
      JOIN patients p ON pa.paciente_id = p.id
      WHERE lp.especialista_id = ?
      ORDER BY lp.estado ASC, lp.creado_en DESC
    `, [id]);

    // Ticket promedio
    const ticketPromedio = resumen.total_lineas > 0 ? resumen.ingresos_generados / resumen.total_lineas : 0;

    res.json({
      especialista,
      resumen: {
        total_lineas: resumen.total_lineas,
        culminadas: resumen.culminadas,
        en_curso: resumen.en_curso,
        ingresos_generados: resumen.ingresos_generados,
        ticket_promedio: ticketPromedio,
        comision_pendiente: comisionPendiente.total,
        comision_liquidada: comisionLiquidada.total
      },
      lineas
    });
  } catch (err) {
    console.error("❌ Error perfil especialista:", err.message);
    res.status(500).json({ message: "Error al obtener perfil", error: err.message });
  }
});

/* ======================================================================
   💰 LIQUIDACIÓN DE PAGOS A ESPECIALISTAS
====================================================================== */

// Vista: comisiones pendientes por especialista
router.get("/liquidaciones/pendientes", authMiddleware, requireOwner, async (req, res) => {
  try {
    const pendientes = await dbAll(`
      SELECT e.id as especialista_id, e.nombre as especialista_nombre,
             e.cuenta_bancaria, e.foto_perfil,
             COUNT(c.id) as num_comisiones,
             COALESCE(SUM(c.monto), 0) as monto_total_pendiente
      FROM comisiones_especialistas c
      JOIN especialistas e ON c.especialista_id = e.id
      WHERE c.estado = 'pendiente' AND c.revertido = 0
      GROUP BY e.id
      ORDER BY monto_total_pendiente DESC
    `);

    // Detalle por especialista: de qué líneas proviene
    for (const esp of pendientes) {
      esp.detalle = await dbAll(`
        SELECT c.id as comision_id, c.monto, c.creado_en,
               lp.tratamiento_nombre, lp.precio as precio_linea,
               pa.id as presupuesto_id,
               p.nombre as paciente_nombre, p.apellido as paciente_apellido
        FROM comisiones_especialistas c
        JOIN lineas_presupuesto lp ON c.linea_presupuesto_id = lp.id
        JOIN presupuestos_asignados pa ON c.presupuesto_asignado_id = pa.id
        JOIN patients p ON pa.paciente_id = p.id
        WHERE c.especialista_id = ? AND c.estado = 'pendiente' AND c.revertido = 0
        ORDER BY c.creado_en DESC
      `, [esp.especialista_id]);
    }

    res.json(pendientes);
  } catch (err) {
    console.error("❌ Error obteniendo pendientes:", err.message);
    res.status(500).json({ message: "Error al obtener pendientes", error: err.message });
  }
});

// Ejecutar liquidación: marcar comisiones como liquidadas
router.post("/liquidaciones/ejecutar", authMiddleware, requireOwner, async (req, res) => {
  try {
    const { especialista_id, comision_ids, metodo_pago, notas } = req.body;
    const username = req.user?.username || "sistema";

    if (!especialista_id || !comision_ids || !Array.isArray(comision_ids) || comision_ids.length === 0) {
      return res.status(400).json({ message: "especialista_id y comision_ids son requeridos" });
    }

    const ahora = fechaLima();

    // Calcular monto total
    const placeholders = comision_ids.map(() => "?").join(",");
    const sumaMonto = await dbGet(
      `SELECT COALESCE(SUM(monto), 0) as total FROM comisiones_especialistas
       WHERE id IN (${placeholders}) AND especialista_id = ? AND estado = 'pendiente' AND revertido = 0`,
      [...comision_ids, especialista_id]
    );

    if (sumaMonto.total <= 0) {
      return res.status(400).json({ message: "No hay comisiones válidas para liquidar" });
    }

    // Crear liquidación
    const liquidacion = await dbRun(
      `INSERT INTO liquidaciones_especialistas (especialista_id, monto_total, metodo_pago, fecha, notas, creado_por, creado_en)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [especialista_id, sumaMonto.total, metodo_pago || "transferencia", ahora.split(" ")[0], notas || null, username, ahora]
    );

    // Marcar comisiones como liquidadas
    for (const cId of comision_ids) {
      await dbRun(
        `UPDATE comisiones_especialistas SET estado = 'liquidado', liquidacion_id = ?, liquidado_en = ?, liquidado_por = ? WHERE id = ? AND especialista_id = ?`,
        [liquidacion.lastID, ahora, username, cId, especialista_id]
      );
    }

    res.json({
      message: "✅ Liquidación registrada",
      liquidacion_id: liquidacion.lastID,
      monto: sumaMonto.total
    });
  } catch (err) {
    console.error("❌ Error ejecutando liquidación:", err.message);
    res.status(500).json({ message: "Error al ejecutar liquidación", error: err.message });
  }
});

// Historial de liquidaciones
router.get("/liquidaciones/historial", authMiddleware, requireOwner, async (req, res) => {
  try {
    const { especialista_id } = req.query;

    let cond = "1=1";
    let params = [];
    if (especialista_id) {
      cond = "l.especialista_id = ?";
      params.push(especialista_id);
    }

    const liquidaciones = await dbAll(`
      SELECT l.*, e.nombre as especialista_nombre
      FROM liquidaciones_especialistas l
      JOIN especialistas e ON l.especialista_id = e.id
      WHERE ${cond}
      ORDER BY l.creado_en DESC
    `, params);

    res.json(liquidaciones);
  } catch (err) {
    console.error("❌ Error historial liquidaciones:", err.message);
    res.status(500).json({ message: "Error al obtener historial", error: err.message });
  }
});

/* ======================================================================
   🔄 SINCRONIZAR LÍNEAS — Actualizar sesiones_realizadas desde presupuestos_sesiones
====================================================================== */
router.post("/lineas/sync", authMiddleware, requireOwner, async (req, res) => {
  try {
    const lineas = await dbAll("SELECT id, presupuesto_asignado_id, tratamiento_nombre, sesiones_totales, estado FROM lineas_presupuesto");

    let actualizadas = 0;
    for (const linea of lineas) {
      if (linea.estado === "culminado") continue; // No tocar líneas culminadas

      const realizadas = await dbGet(
        `SELECT COUNT(*) as c FROM presupuestos_sesiones
         WHERE presupuesto_asignado_id = ? AND tratamiento_nombre = ? AND estado = 'completada'`,
        [linea.presupuesto_asignado_id, linea.tratamiento_nombre]
      );

      const sesRealizadas = realizadas?.c || 0;
      let nuevoEstado = linea.estado;

      if (sesRealizadas === 0) nuevoEstado = "pendiente";
      else if (sesRealizadas < linea.sesiones_totales) nuevoEstado = "en_curso";
      else if (sesRealizadas >= linea.sesiones_totales) nuevoEstado = "listo_para_culminar";

      if (sesRealizadas !== linea.sesiones_realizadas || nuevoEstado !== linea.estado) {
        await dbRun(
          `UPDATE lineas_presupuesto SET sesiones_realizadas = ?, estado = ? WHERE id = ?`,
          [sesRealizadas, nuevoEstado, linea.id]
        );
        actualizadas++;
      }
    }

    res.json({ message: `✅ ${actualizadas} líneas actualizadas` });
  } catch (err) {
    console.error("❌ Error sincronizando:", err.message);
    res.status(500).json({ message: "Error al sincronizar", error: err.message });
  }
});

/* ======================================================================
   📋 LISTAR ESPECIALISTAS (resumen para el módulo dueño)
====================================================================== */
router.get("/especialistas", authMiddleware, requireOwner, async (req, res) => {
  await ensureLineasMigration();

  try {
    const especialistas = await dbAll(`
      SELECT e.*,
        (SELECT COUNT(*) FROM lineas_presupuesto lp WHERE lp.especialista_id = e.id) as total_lineas,
        (SELECT COUNT(*) FROM lineas_presupuesto lp WHERE lp.especialista_id = e.id AND lp.estado = 'culminado') as lineas_culminadas,
        (SELECT COALESCE(SUM(lp.precio), 0) FROM lineas_presupuesto lp WHERE lp.especialista_id = e.id) as ingresos_generados,
        (SELECT COALESCE(SUM(c.monto), 0) FROM comisiones_especialistas c WHERE c.especialista_id = e.id AND c.estado = 'pendiente' AND c.revertido = 0) as comision_pendiente,
        (SELECT COALESCE(SUM(c.monto), 0) FROM comisiones_especialistas c WHERE c.especialista_id = e.id AND c.estado = 'liquidado' AND c.revertido = 0) as comision_liquidada
      FROM especialistas e
      ORDER BY e.nombre ASC
    `);

    res.json(especialistas);
  } catch (err) {
    console.error("❌ Error listando especialistas:", err.message);
    res.status(500).json({ message: "Error al listar especialistas", error: err.message });
  }
});

/* ======================================================================
   🔄 CAMBIAR ESTADO DE GESTIÓN DEL PRESUPUESTO
====================================================================== */
router.put("/presupuestos/:id/estado", authMiddleware, requireOwner, async (req, res) => {
  try {
    const { id } = req.params;
    const { estado_gestion } = req.body;

    const estadosValidos = ["borrador", "activo", "culminado", "anulado"];
    if (!estadosValidos.includes(estado_gestion)) {
      return res.status(400).json({ message: `Estado no válido. Opciones: ${estadosValidos.join(", ")}` });
    }

    await dbRun("UPDATE presupuestos_asignados SET estado_gestion = ? WHERE id = ?", [estado_gestion, id]);
    res.json({ message: "Estado actualizado" });
  } catch (err) {
    console.error("❌ Error actualizando estado:", err.message);
    res.status(500).json({ message: "Error al actualizar estado", error: err.message });
  }
});

export default router;
