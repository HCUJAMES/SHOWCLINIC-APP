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
   ⚙️ CONFIGURACIÓN DEL DUEÑO (clave/valor) — p.ej. meta mensual
====================================================================== */
let configTableReady = false;
async function ensureConfigTable() {
  if (configTableReady) return;
  try {
    await dbRun(`CREATE TABLE IF NOT EXISTS config_dueno (
      clave TEXT PRIMARY KEY,
      valor TEXT
    )`);
    configTableReady = true;
  } catch (err) {
    console.error("❌ Error creando config_dueno:", err.message);
  }
}

/* ======================================================================
   💵 SCHEMA DE COMISIONES (fija por tratamiento + override por línea)
====================================================================== */
let comisionSchemaReady = false;
async function ensureComisionSchema() {
  if (comisionSchemaReady) return;
  const addColumn = async (tabla, columna, definicion) => {
    try {
      await dbRun(`ALTER TABLE ${tabla} ADD COLUMN ${columna} ${definicion}`);
    } catch (err) {
      if (!String(err.message).includes("duplicate column")) {
        console.error(`❌ Error agregando ${tabla}.${columna}:`, err.message);
      }
    }
  };
  // Config global por tratamiento
  await addColumn("tratamientos", "comision_tipo", "TEXT");        // 'porcentaje' | 'fijo'
  await addColumn("tratamientos", "comision_fija", "REAL DEFAULT 0");
  // Override por línea de presupuesto
  await addColumn("lineas_presupuesto", "comision_tipo", "TEXT");  // 'porcentaje' | 'fijo'
  await addColumn("lineas_presupuesto", "comision_fija", "REAL");
  // Override de comisión por presupuesto asignado (porcentaje sobre el precio final)
  await addColumn("presupuestos_asignados", "comision_porcentaje", "REAL");
  comisionSchemaReady = true;
}

// Base de comisión de un presupuesto = precio final (precio_total - descuento), nunca negativo
function baseComisionPresupuesto(pres) {
  const precio = Number(pres.precio_total) || 0;
  const descuento = Number(pres.descuento) || 0;
  return Math.max(0, precio - descuento);
}

// Porcentaje efectivo de comisión de un presupuesto (override del presupuesto > default del especialista > 20)
function pctComisionPresupuesto(pres, pctEspecialista) {
  if (pres.comision_porcentaje != null && pres.comision_porcentaje !== "") {
    return Number(pres.comision_porcentaje);
  }
  if (pctEspecialista != null) return Number(pctEspecialista);
  return 20;
}

// Calcula el monto de comisión de una línea (fijo tiene prioridad si está configurado)
function comisionDeLinea(linea) {
  const tipo = linea.comision_tipo || (linea.comision_fija > 0 ? "fijo" : "porcentaje");
  if (tipo === "fijo") {
    return Number(linea.comision_fija) || 0;
  }
  const pct = linea.comision_porcentaje != null ? Number(linea.comision_porcentaje) : 20;
  return (Number(linea.precio) || 0) * (pct / 100);
}

async function getConfig(clave, porDefecto = null) {
  await ensureConfigTable();
  const row = await dbGet("SELECT valor FROM config_dueno WHERE clave = ?", [clave]);
  return row ? row.valor : porDefecto;
}

async function setConfig(clave, valor) {
  await ensureConfigTable();
  await dbRun(
    `INSERT INTO config_dueno (clave, valor) VALUES (?, ?)
     ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor`,
    [clave, String(valor)]
  );
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
    let condFechaPres = ""; // sobre presupuestos_asignados.creado_en (sin alias, para subquery)
    let params = [];
    let paramsFin = [];
    let paramsPres = [];

    if (fecha_inicio) {
      condFecha += " AND DATE(pa.creado_en) >= ?";
      condFechaFin += " AND DATE(f.fecha) >= ?";
      condFechaPres += " AND DATE(creado_en) >= ?";
      params.push(fecha_inicio);
      paramsFin.push(fecha_inicio);
      paramsPres.push(fecha_inicio);
    }
    if (fecha_fin) {
      condFecha += " AND DATE(pa.creado_en) <= ?";
      condFechaFin += " AND DATE(f.fecha) <= ?";
      condFechaPres += " AND DATE(creado_en) <= ?";
      params.push(fecha_fin);
      paramsFin.push(fecha_fin);
      paramsPres.push(fecha_fin);
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

    // Rendimiento por especialista (respeta el filtro de periodo por fecha del presupuesto)
    const rendimientoEspecialistas = await dbAll(`
      SELECT e.id, e.nombre, e.comision_porcentaje,
        COUNT(DISTINCT lp.id) as lineas_total,
        SUM(CASE WHEN lp.estado = 'culminado' THEN 1 ELSE 0 END) as lineas_culminadas,
        COALESCE(SUM(lp.precio), 0) as ingresos_generados
      FROM especialistas e
      LEFT JOIN lineas_presupuesto lp
        ON lp.especialista_id = e.id
        AND lp.presupuesto_asignado_id IN (SELECT id FROM presupuestos_asignados WHERE 1=1 ${condFechaPres})
      GROUP BY e.id
      ORDER BY ingresos_generados DESC
    `, paramsPres);

    // Presupuestos activos
    const presupuestosActivos = await dbGet(
      `SELECT COUNT(*) as total FROM presupuestos_asignados WHERE estado_gestion = 'activo' OR estado_gestion IS NULL`
    );

    // Meta mensual (configurable) + ingresos del MES ACTUAL (para proyección)
    const metaMensual = Number(await getConfig("meta_mensual", 0)) || 0;
    const mesActual = fechaLima().slice(0, 7); // YYYY-MM (hora Lima)
    const ingresosMes = await dbGet(
      `SELECT COALESCE(SUM(monto), 0) as total FROM finanzas
       WHERE tipo = 'ingreso' AND strftime('%Y-%m', fecha) = ?`,
      [mesActual]
    );

    res.json({
      kpis: {
        ingresos_totales: ingresos.total,
        tratamientos_realizados: tratRealizados.total,
        pacientes_atendidos: pacientesAtendidos.total,
        ticket_promedio: ticketPromedio,
        presupuestos_activos: presupuestosActivos.total
      },
      meta: {
        meta_mensual: metaMensual,
        ingresos_mes_actual: Number(ingresosMes?.total || 0),
        mes: mesActual
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
    await ensureComisionSchema();
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

    // Buscar regla de comisión del tratamiento (fijo global) si existe
    const linea = await dbGet("SELECT tratamiento_id FROM lineas_presupuesto WHERE id = ?", [linea_id]);
    let regla = null;
    if (linea?.tratamiento_id) {
      regla = await dbGet(
        "SELECT comision_tipo, comision_fija FROM tratamientos WHERE id = ?",
        [linea.tratamiento_id]
      );
    }

    if (regla && regla.comision_tipo === "fijo" && Number(regla.comision_fija) > 0) {
      await dbRun(
        `UPDATE lineas_presupuesto SET especialista_id = ?, comision_porcentaje = ?, comision_tipo = 'fijo', comision_fija = ? WHERE id = ?`,
        [especialista_id, esp.comision_porcentaje || 20, Number(regla.comision_fija), linea_id]
      );
    } else {
      await dbRun(
        `UPDATE lineas_presupuesto SET especialista_id = ?, comision_porcentaje = ?, comision_tipo = 'porcentaje' WHERE id = ?`,
        [especialista_id, esp.comision_porcentaje || 20, linea_id]
      );
    }

    res.json({ message: "Especialista asignado a la línea" });
  } catch (err) {
    console.error("❌ Error asignando especialista:", err.message);
    res.status(500).json({ message: "Error al asignar especialista", error: err.message });
  }
});

/* ======================================================================
   💵 EDITAR COMISIÓN DE UNA LÍNEA (% o monto fijo) — recalcula si aplica
====================================================================== */
router.put("/lineas/:linea_id/comision", authMiddleware, requireOwner, async (req, res) => {
  try {
    await ensureComisionSchema();
    const { linea_id } = req.params;
    let { comision_tipo, comision_porcentaje, comision_fija } = req.body;

    const linea = await dbGet("SELECT * FROM lineas_presupuesto WHERE id = ?", [linea_id]);
    if (!linea) return res.status(404).json({ message: "Línea no encontrada" });

    comision_tipo = comision_tipo === "fijo" ? "fijo" : "porcentaje";

    if (comision_tipo === "porcentaje") {
      const pct = Number(comision_porcentaje);
      if (isNaN(pct) || pct < 0 || pct > 100) {
        return res.status(400).json({ message: "Porcentaje inválido (0-100)" });
      }
      await dbRun(
        "UPDATE lineas_presupuesto SET comision_tipo = 'porcentaje', comision_porcentaje = ?, comision_fija = 0 WHERE id = ?",
        [pct, linea_id]
      );
    } else {
      const fijo = Number(comision_fija);
      if (isNaN(fijo) || fijo < 0) {
        return res.status(400).json({ message: "Monto fijo inválido" });
      }
      await dbRun(
        "UPDATE lineas_presupuesto SET comision_tipo = 'fijo', comision_fija = ? WHERE id = ?",
        [fijo, linea_id]
      );
    }

    // Recalcular monto si la línea ya está culminada
    const actualizada = await dbGet("SELECT * FROM lineas_presupuesto WHERE id = ?", [linea_id]);
    const nuevoMonto = comisionDeLinea(actualizada);

    if (actualizada.estado === "culminado") {
      const comision = await dbGet(
        "SELECT * FROM comisiones_especialistas WHERE linea_presupuesto_id = ? AND revertido = 0",
        [linea_id]
      );
      if (comision && comision.estado === "liquidado") {
        return res.json({
          message: "Regla de comisión guardada, pero la comisión actual ya fue liquidada y no se recalcula.",
          comision_monto: comision.monto,
          recalculado: false
        });
      }
      if (comision) {
        await dbRun("UPDATE comisiones_especialistas SET monto = ? WHERE id = ?", [nuevoMonto, comision.id]);
      }
      await dbRun("UPDATE lineas_presupuesto SET comision_monto = ? WHERE id = ?", [nuevoMonto, linea_id]);
    }

    res.json({ message: "Comisión de la línea actualizada", comision_monto: nuevoMonto, comision_tipo, recalculado: true });
  } catch (err) {
    console.error("❌ Error actualizando comisión de línea:", err.message);
    res.status(500).json({ message: "Error al actualizar comisión", error: err.message });
  }
});

/* ======================================================================
   ✅ CULMINAR LÍNEA DE TRATAMIENTO (check manual + auditoría + comisión)
====================================================================== */
router.post("/lineas/:linea_id/culminar", authMiddleware, requireOwner, async (req, res) => {
  try {
    await ensureComisionSchema();
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

    // Calcular comisión (fijo por tratamiento o % del precio)
    const comisionMonto = comisionDeLinea(linea);

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
  await ensureComisionSchema();

  try {
    const { id } = req.params;
    const { fecha_inicio, fecha_fin } = req.query;

    const especialista = await dbGet("SELECT * FROM especialistas WHERE id = ?", [id]);
    if (!especialista) {
      return res.status(404).json({ message: "Especialista no encontrado" });
    }
    const pctDefault = especialista.comision_porcentaje != null ? Number(especialista.comision_porcentaje) : 20;

    // Presupuestos asignados a este especialista (con filtro de fechas opcional)
    let cond = "pa.especialista_id = ?";
    const params = [id];
    if (fecha_inicio) { cond += " AND DATE(pa.creado_en) >= ?"; params.push(fecha_inicio); }
    if (fecha_fin) { cond += " AND DATE(pa.creado_en) <= ?"; params.push(fecha_fin); }

    const presupuestos = await dbAll(`
      SELECT pa.id, pa.paciente_id, pa.precio_total, pa.descuento, pa.estado,
             pa.estado_pago, pa.monto_pagado, pa.saldo_pendiente,
             pa.comision_porcentaje, pa.creado_en, pa.tratamientos_json,
             p.nombre as paciente_nombre, p.apellido as paciente_apellido, p.dni as paciente_dni,
             (SELECT COUNT(*) FROM presupuestos_sesiones ps WHERE ps.presupuesto_asignado_id = pa.id AND ps.estado = 'completada') as sesiones_completadas,
             (SELECT COUNT(*) FROM presupuestos_sesiones ps WHERE ps.presupuesto_asignado_id = pa.id) as sesiones_totales
      FROM presupuestos_asignados pa
      JOIN patients p ON pa.paciente_id = p.id
      WHERE ${cond}
      ORDER BY pa.creado_en DESC
    `, params);

    let baseTotal = 0;        // facturación con descuento
    let comisionTotal = 0;    // pago estimado al especialista
    let pagadoTotal = 0;      // lo que el paciente ya pagó

    for (const pres of presupuestos) {
      // Tratamientos (nombres + sesiones) desde el JSON
      try {
        const items = pres.tratamientos_json ? JSON.parse(pres.tratamientos_json) : [];
        pres.tratamientos = items
          .filter((it) => it.marca === undefined || it.marca === "gold" || it.marca === "purple")
          .map((it) => ({ nombre: it.nombre, sesiones: Number(it.sesiones) || 1, precio: Number(it.precio) || 0, marca: it.marca || "gold" }));
      } catch (e) {
        pres.tratamientos = [];
      }
      delete pres.tratamientos_json;

      // Pago real desde finanzas (fuente de verdad)
      const sumaPagos = await dbGet(
        `SELECT COALESCE(SUM(monto), 0) as total FROM finanzas
         WHERE referencia_id = ? AND referencia_tipo = 'presupuesto_asignado' AND tipo = 'ingreso'`,
        [pres.id]
      );
      pres.monto_pagado_real = parseFloat(sumaPagos?.total) || 0;

      const base = baseComisionPresupuesto(pres);
      const pct = pctComisionPresupuesto(pres, pctDefault);
      const comision = base * (pct / 100);

      pres.base_comision = base;              // precio final (precio_total - descuento)
      pres.comision_porcentaje_efectivo = pct;
      pres.comision_estimada = comision;
      pres.usa_override = pres.comision_porcentaje != null;

      baseTotal += base;
      comisionTotal += comision;
      pagadoTotal += pres.monto_pagado_real;
    }

    const ticketPromedio = presupuestos.length > 0 ? baseTotal / presupuestos.length : 0;

    res.json({
      especialista: { ...especialista, comision_porcentaje: pctDefault },
      resumen: {
        num_presupuestos: presupuestos.length,
        base_total: baseTotal,
        comision_total: comisionTotal,
        pagado_total: pagadoTotal,
        ticket_promedio: ticketPromedio
      },
      presupuestos
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
  await ensureComisionSchema();

  try {
    const { fecha_inicio, fecha_fin } = req.query;

    // Filtro de fechas sobre la fecha de creación del presupuesto
    let joinCond = "pa.especialista_id = e.id";
    const params = [];
    if (fecha_inicio) { joinCond += " AND DATE(pa.creado_en) >= ?"; params.push(fecha_inicio); }
    if (fecha_fin) { joinCond += " AND DATE(pa.creado_en) <= ?"; params.push(fecha_fin); }

    // Comisión = % efectivo (override del presupuesto o default del especialista) sobre el precio final (precio_total - descuento)
    const especialistas = await dbAll(`
      SELECT e.id, e.nombre, e.tipo, e.especialidad, e.cuenta_bancaria,
        COALESCE(e.comision_porcentaje, 20) as comision_porcentaje,
        COUNT(pa.id) as num_presupuestos,
        COALESCE(SUM(MAX(pa.precio_total - COALESCE(pa.descuento, 0), 0)), 0) as base_total,
        COALESCE(SUM(
          MAX(pa.precio_total - COALESCE(pa.descuento, 0), 0)
          * (COALESCE(pa.comision_porcentaje, e.comision_porcentaje, 20) / 100.0)
        ), 0) as comision_total,
        (SELECT COALESCE(SUM(c.monto), 0) FROM comisiones_especialistas c WHERE c.especialista_id = e.id AND c.estado = 'pendiente' AND c.revertido = 0) as comision_pendiente,
        (SELECT COALESCE(SUM(c.monto), 0) FROM comisiones_especialistas c WHERE c.especialista_id = e.id AND c.estado = 'liquidado' AND c.revertido = 0) as comision_liquidada
      FROM especialistas e
      LEFT JOIN presupuestos_asignados pa ON ${joinCond}
      GROUP BY e.id
      ORDER BY e.nombre ASC
    `, params);

    res.json(especialistas);
  } catch (err) {
    console.error("❌ Error listando especialistas:", err.message);
    res.status(500).json({ message: "Error al listar especialistas", error: err.message });
  }
});

/* ======================================================================
   💵 EDITAR % DE COMISIÓN POR DEFECTO DEL ESPECIALISTA
====================================================================== */
router.put("/especialistas/:id/comision", authMiddleware, requireOwner, async (req, res) => {
  try {
    const { id } = req.params;
    const pct = Number(req.body?.comision_porcentaje);
    if (isNaN(pct) || pct < 0 || pct > 100) {
      return res.status(400).json({ message: "Porcentaje inválido (0-100)" });
    }
    const esp = await dbGet("SELECT id FROM especialistas WHERE id = ?", [id]);
    if (!esp) return res.status(404).json({ message: "Especialista no encontrado" });

    await dbRun("UPDATE especialistas SET comision_porcentaje = ? WHERE id = ?", [pct, id]);
    res.json({ message: "Comisión del especialista actualizada", comision_porcentaje: pct });
  } catch (err) {
    console.error("❌ Error actualizando comisión del especialista:", err.message);
    res.status(500).json({ message: "Error al actualizar comisión", error: err.message });
  }
});

/* ======================================================================
   💵 EDITAR % DE COMISIÓN DE UN PRESUPUESTO ASIGNADO (override)
   Enviar comision_porcentaje = null para volver al % del especialista.
====================================================================== */
router.put("/presupuestos/:id/comision", authMiddleware, requireOwner, async (req, res) => {
  try {
    await ensureComisionSchema();
    const { id } = req.params;
    let { comision_porcentaje } = req.body;

    const pres = await dbGet("SELECT id FROM presupuestos_asignados WHERE id = ?", [id]);
    if (!pres) return res.status(404).json({ message: "Presupuesto no encontrado" });

    if (comision_porcentaje === null || comision_porcentaje === "" || comision_porcentaje === undefined) {
      await dbRun("UPDATE presupuestos_asignados SET comision_porcentaje = NULL WHERE id = ?", [id]);
      return res.json({ message: "Comisión del presupuesto restablecida al % del especialista" });
    }

    const pct = Number(comision_porcentaje);
    if (isNaN(pct) || pct < 0 || pct > 100) {
      return res.status(400).json({ message: "Porcentaje inválido (0-100)" });
    }
    await dbRun("UPDATE presupuestos_asignados SET comision_porcentaje = ? WHERE id = ?", [pct, id]);
    res.json({ message: "Comisión del presupuesto actualizada", comision_porcentaje: pct });
  } catch (err) {
    console.error("❌ Error actualizando comisión del presupuesto:", err.message);
    res.status(500).json({ message: "Error al actualizar comisión del presupuesto", error: err.message });
  }
});

/* ======================================================================
   � CONFIGURACIÓN DE COMISIÓN POR TRATAMIENTO (precio fijo global)
====================================================================== */
router.get("/tratamientos-comision", authMiddleware, requireOwner, async (req, res) => {
  try {
    await ensureComisionSchema();
    const rows = await dbAll(`
      SELECT id, nombre, procedimiento, precio,
        COALESCE(comision_tipo, 'porcentaje') as comision_tipo,
        COALESCE(comision_fija, 0) as comision_fija
      FROM tratamientos
      ORDER BY (procedimiento IS NULL), procedimiento ASC, nombre ASC
    `);
    res.json(rows);
  } catch (err) {
    console.error("❌ Error listando comisiones de tratamientos:", err.message);
    res.status(500).json({ message: "Error al listar comisiones de tratamientos", error: err.message });
  }
});

router.put("/tratamientos/:id/comision", authMiddleware, requireOwner, async (req, res) => {
  try {
    await ensureComisionSchema();
    const { id } = req.params;
    let { comision_tipo, comision_fija } = req.body;

    const trat = await dbGet("SELECT id FROM tratamientos WHERE id = ?", [id]);
    if (!trat) return res.status(404).json({ message: "Tratamiento no encontrado" });

    comision_tipo = comision_tipo === "fijo" ? "fijo" : "porcentaje";

    if (comision_tipo === "fijo") {
      const fijo = Number(comision_fija);
      if (isNaN(fijo) || fijo < 0) {
        return res.status(400).json({ message: "Monto fijo inválido" });
      }
      await dbRun("UPDATE tratamientos SET comision_tipo = 'fijo', comision_fija = ? WHERE id = ?", [fijo, id]);
      // Propagar a líneas NO culminadas de este tratamiento
      await dbRun(
        "UPDATE lineas_presupuesto SET comision_tipo = 'fijo', comision_fija = ? WHERE tratamiento_id = ? AND estado != 'culminado'",
        [fijo, id]
      );
    } else {
      await dbRun("UPDATE tratamientos SET comision_tipo = 'porcentaje', comision_fija = 0 WHERE id = ?", [id]);
      await dbRun(
        "UPDATE lineas_presupuesto SET comision_tipo = 'porcentaje', comision_fija = 0 WHERE tratamiento_id = ? AND estado != 'culminado'",
        [id]
      );
    }

    res.json({ message: "Comisión del tratamiento actualizada", comision_tipo });
  } catch (err) {
    console.error("❌ Error actualizando comisión de tratamiento:", err.message);
    res.status(500).json({ message: "Error al actualizar comisión del tratamiento", error: err.message });
  }
});

/* ======================================================================
   �� CAMBIAR ESTADO DE GESTIÓN DEL PRESUPUESTO
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

/* ======================================================================
   🎯 META MENSUAL (configurable)
====================================================================== */
router.get("/meta", authMiddleware, requireOwner, async (req, res) => {
  try {
    const meta = Number(await getConfig("meta_mensual", 0)) || 0;
    res.json({ meta_mensual: meta });
  } catch (err) {
    console.error("❌ Error obteniendo meta:", err.message);
    res.status(500).json({ message: "Error al obtener meta", error: err.message });
  }
});

router.put("/meta", authMiddleware, requireOwner, async (req, res) => {
  try {
    const monto = Number(req.body?.meta_mensual);
    if (isNaN(monto) || monto < 0) {
      return res.status(400).json({ message: "meta_mensual debe ser un número mayor o igual a 0" });
    }
    await setConfig("meta_mensual", monto);
    res.json({ message: "Meta actualizada", meta_mensual: monto });
  } catch (err) {
    console.error("❌ Error guardando meta:", err.message);
    res.status(500).json({ message: "Error al guardar meta", error: err.message });
  }
});

export default router;
