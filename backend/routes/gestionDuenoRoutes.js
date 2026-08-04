import express from "express";
import db, { dbAll, dbGet, dbRun } from "../db/database.js";
import { authMiddleware, requireRole } from "../middleware/auth.js";
import { getReporteFinanciero } from "./finanzasRoutes.js";
import {
  desglosarPresupuesto,
  cargarPctEspecialistas,
  trabajoDeEspecialista,
  rendimientoEspecialistas as calcularRendimientoEspecialistas,
  sesionesHuerfanas,
  redondear,
} from "../services/comisiones.js";
import PDFDocument from "pdfkit";

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

  // Tabla de overrides para la vista de especialistas (no afecta el presupuesto original)
  await dbRun(`CREATE TABLE IF NOT EXISTS especialista_presupuesto_overrides (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    especialista_id INTEGER NOT NULL,
    presupuesto_id INTEGER NOT NULL,
    pagado_override REAL,
    sesiones_override INTEGER,
    comision_override REAL,
    nota TEXT,
    oculto INTEGER DEFAULT 0,
    creado_en TEXT DEFAULT (datetime('now')),
    UNIQUE(especialista_id, presupuesto_id)
  )`);
  await addColumn("especialista_presupuesto_overrides", "oculto", "INTEGER DEFAULT 0");
  // Overrides de KPIs globales por especialista (pagado total, comision total)
  await dbRun(`CREATE TABLE IF NOT EXISTS especialista_kpi_overrides (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    especialista_id INTEGER NOT NULL,
    periodo_key TEXT NOT NULL,
    pagado_total_override REAL,
    comision_total_override REAL,
    creado_en TEXT DEFAULT (datetime('now')),
    UNIQUE(especialista_id, periodo_key)
  )`);
  comisionSchemaReady = true;
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

    // ⚠️ El periodo de una sesión es la fecha en que SE REALIZÓ, no la fecha
    // en que se creó el presupuesto. Un presupuesto del 28 de julio cuyas
    // sesiones continúan en agosto debe contar cada sesión en su propio mes.
    let condSesion = "";
    const paramsSesion = [];
    if (fecha_inicio) { condSesion += " AND DATE(ps.fecha_realizada) >= ?"; paramsSesion.push(fecha_inicio); }
    if (fecha_fin) { condSesion += " AND DATE(ps.fecha_realizada) <= ?"; paramsSesion.push(fecha_fin); }

    // Tratamientos realizados (sesiones completadas en el periodo)
    const tratRealizados = await dbGet(
      `SELECT COUNT(*) as total FROM presupuestos_sesiones ps
       WHERE ps.estado = 'completada' ${condSesion}`,
      paramsSesion
    );

    // Pacientes atendidos (únicos con sesiones realizadas en el periodo)
    const pacientesAtendidos = await dbGet(
      `SELECT COUNT(DISTINCT pa.paciente_id) as total FROM presupuestos_sesiones ps
       JOIN presupuestos_asignados pa ON ps.presupuesto_asignado_id = pa.id
       WHERE ps.estado = 'completada' ${condSesion}`,
      paramsSesion
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

    // Tratamientos más realizados en el periodo (por sesiones ejecutadas,
    // no por líneas creadas: así respeta el filtro de fechas igual que el KPI).
    // Sin LIMIT: la suma del gráfico debe cuadrar exactamente con el KPI de
    // "tratamientos realizados"; el frontend ya agrupa la cola en "Otros".
    const tratamientosMasVendidos = await dbAll(`
      SELECT ps.tratamiento_nombre, COUNT(*) as cantidad,
             COALESCE(SUM(ps.precio_sesion), 0) as ingresos
      FROM presupuestos_sesiones ps
      WHERE ps.estado = 'completada' ${condSesion}
      GROUP BY ps.tratamiento_nombre
      ORDER BY cantidad DESC
    `, paramsSesion);

    // Pagos pendientes a especialistas (comisiones no liquidadas)
    const pagosPendientes = await dbAll(`
      SELECT e.id, e.nombre, COALESCE(SUM(c.monto), 0) as monto_pendiente
      FROM comisiones_especialistas c
      JOIN especialistas e ON c.especialista_id = e.id
      WHERE c.estado = 'pendiente' AND c.revertido = 0
      GROUP BY e.id
      ORDER BY monto_pendiente DESC
    `);

    // Últimos tratamientos realizados dentro del periodo seleccionado
    const ultimosTratamientos = await dbAll(`
      SELECT ps.tratamiento_nombre, ps.fecha_realizada, ps.precio_sesion,
             pa.paciente_id, p.nombre as paciente_nombre, p.apellido as paciente_apellido,
             COALESCE(e.nombre, ps.especialista) as especialista
      FROM presupuestos_sesiones ps
      JOIN presupuestos_asignados pa ON ps.presupuesto_asignado_id = pa.id
      JOIN patients p ON pa.paciente_id = p.id
      LEFT JOIN especialistas e ON e.id = ps.especialista_id
      WHERE ps.estado = 'completada' ${condSesion}
      ORDER BY ps.fecha_realizada DESC LIMIT 20
    `, paramsSesion);

    // Rendimiento por especialista — calculado sobre las SESIONES realizadas
    // en el periodo (quién hizo el trabajo), no sobre a quién se le asignó el
    // presupuesto. Ver services/comisiones.js.
    const rendimientoEspecialistas = await calcularRendimientoEspecialistas({
      fecha_inicio,
      fecha_fin,
    });

    // Sesiones completadas sin especialista registrado: trabajo que nadie cobra.
    const huerfanas = await sesionesHuerfanas({ fecha_inicio, fecha_fin });

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
      rendimiento_especialistas: rendimientoEspecialistas,
      alertas: {
        sesiones_sin_especialista: huerfanas.length,
        detalle_sin_especialista: huerfanas.slice(0, 20),
      }
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

    // Recalcular pagos desde finanzas (incluye pagos directos + consultas vinculadas)
    const sumaPagos = await dbGet(
      `SELECT COALESCE(SUM(monto), 0) as total_pagado FROM finanzas
       WHERE referencia_id = ? AND referencia_tipo IN ('presupuesto_asignado', 'presupuesto_consulta') AND tipo = 'ingreso'`,
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
      // Una línea culminada puede tener una comisión por cada especialista que
      // realizó sus sesiones: el nuevo monto se reparte en la misma proporción.
      const comisiones = await dbAll(
        "SELECT * FROM comisiones_especialistas WHERE linea_presupuesto_id = ? AND revertido = 0",
        [linea_id]
      );

      if (comisiones.some((c) => c.estado === "liquidado")) {
        return res.json({
          message: "Regla de comisión guardada, pero la comisión actual ya fue liquidada y no se recalcula.",
          comision_monto: comisiones.reduce((a, c) => a + (Number(c.monto) || 0), 0),
          recalculado: false
        });
      }

      const totalPrevio = comisiones.reduce((a, c) => a + (Number(c.monto) || 0), 0);
      for (const c of comisiones) {
        // Sin monto previo (todos en 0) se reparte en partes iguales.
        const proporcion = totalPrevio > 0
          ? (Number(c.monto) || 0) / totalPrevio
          : 1 / comisiones.length;
        await dbRun("UPDATE comisiones_especialistas SET monto = ? WHERE id = ?", [
          redondear(nuevoMonto * proporcion),
          c.id,
        ]);
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

    const ahora = fechaLima();

    // La comisión se reparte entre quienes REALIZARON las sesiones de este
    // tratamiento, no entre quien figura asignado a la línea.
    const presupuesto = await dbGet(
      "SELECT * FROM presupuestos_asignados WHERE id = ?",
      [linea.presupuesto_asignado_id]
    );
    const pctMap = await cargarPctEspecialistas();
    const desglose = await desglosarPresupuesto(presupuesto, pctMap);

    const sesionesDeLinea = desglose.sesiones.filter(
      (s) => s.tratamiento_nombre === linea.tratamiento_nombre && s.estado === "completada"
    );

    if (sesionesDeLinea.length === 0) {
      return res.status(400).json({
        message: "No hay sesiones completadas de este tratamiento. Marca primero quién las realizó.",
      });
    }

    const sinEspecialista = sesionesDeLinea.filter((s) => s.especialista_id == null);
    if (sinEspecialista.length > 0) {
      return res.status(400).json({
        message: `${sinEspecialista.length} sesión(es) de este tratamiento no tienen especialista registrado. Asígnalo antes de culminar.`,
      });
    }

    // Agrupar por especialista
    const porEsp = new Map();
    for (const s of sesionesDeLinea) {
      const acum = porEsp.get(s.especialista_id) || { monto: 0, sesiones: 0 };
      acum.monto += s.comision_sesion;
      acum.sesiones += 1;
      porEsp.set(s.especialista_id, acum);
    }

    const comisionMonto = redondear(
      Array.from(porEsp.values()).reduce((a, v) => a + v.monto, 0)
    );

    // Actualizar línea a culminado
    await dbRun(
      `UPDATE lineas_presupuesto SET estado = 'culminado', culminado_en = ?, culminado_por = ?, comision_monto = ? WHERE id = ?`,
      [ahora, username, comisionMonto, linea_id]
    );

    // Un registro de comisión por especialista que participó
    const repartos = [];
    for (const [espId, v] of porEsp.entries()) {
      const monto = redondear(v.monto);
      await dbRun(
        `INSERT INTO comisiones_especialistas (especialista_id, linea_presupuesto_id, presupuesto_asignado_id, paciente_id, monto, estado, creado_en)
         VALUES (?, ?, ?, ?, ?, 'pendiente', ?)`,
        [espId, linea_id, linea.presupuesto_asignado_id, linea.paciente_id, monto, ahora]
      );
      repartos.push({ especialista_id: espId, sesiones: v.sesiones, monto });
    }

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
      message: repartos.length > 1
        ? `✅ Línea culminada — comisión repartida entre ${repartos.length} especialistas`
        : "✅ Línea culminada y comisión registrada",
      comision_monto: comisionMonto,
      repartos,
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

    // Una línea puede haber generado varias comisiones (una por especialista)
    const comisiones = await dbAll(
      `SELECT * FROM comisiones_especialistas WHERE linea_presupuesto_id = ? AND revertido = 0`,
      [linea_id]
    );

    if (comisiones.some((c) => c.estado === "liquidado")) {
      return res.status(400).json({ message: "No se puede revertir: la comisión ya fue liquidada" });
    }

    const ahora = fechaLima();

    // Revertir la línea
    const nuevoEstado = linea.sesiones_realizadas >= linea.sesiones_totales ? "listo_para_culminar" : "en_curso";
    await dbRun(
      `UPDATE lineas_presupuesto SET estado = ?, culminado_en = NULL, culminado_por = NULL, revertido_en = ?, revertido_por = ?, comision_monto = 0 WHERE id = ?`,
      [nuevoEstado, ahora, username, linea_id]
    );

    // Revertir todas las comisiones generadas por esta línea
    for (const c of comisiones) {
      await dbRun(
        `UPDATE comisiones_especialistas SET revertido = 1, revertido_en = ?, revertido_por = ? WHERE id = ?`,
        [ahora, username, c.id]
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

    // ── Trabajo REALMENTE realizado por este especialista ─────────────────
    // Se agrupa por sesión completada (no por presupuesto), de modo que si un
    // presupuesto lo atienden varios especialistas, cada uno cobra solo lo suyo.
    const trabajo = await trabajoDeEspecialista(id, { fecha_inicio, fecha_fin });

    let baseTotal = 0;        // valor de las sesiones que hizo EN EL PERIODO
    let comisionTotal = 0;    // pago que le corresponde POR ESE TRABAJO
    // Nota: no se acumula "lo pagado por el paciente" como total del periodo.
    // Un presupuesto cobrado en julio cuyas sesiones siguen en agosto metería
    // dinero de otro mes en este. El cobro se ve en Finanzas, por fecha de pago.

    const presupuestos = [];

    for (const t of trabajo.presupuestos) {
      const pres = await dbGet(
        `SELECT pa.*, p.nombre as paciente_nombre, p.apellido as paciente_apellido, p.dni as paciente_dni
         FROM presupuestos_asignados pa JOIN patients p ON pa.paciente_id = p.id
         WHERE pa.id = ?`,
        [t.presupuesto_id]
      );
      if (!pres) continue;

      // Tratamientos (nombres + sesiones) desde el JSON
      let tratamientos = [];
      try {
        const items = pres.tratamientos_json ? JSON.parse(pres.tratamientos_json) : [];
        tratamientos = items
          .filter((it) => it.marca === undefined || it.marca === "gold" || it.marca === "purple")
          .map((it) => ({ nombre: it.nombre, sesiones: Number(it.sesiones) || 1, precio: Number(it.precio) || 0, marca: it.marca || "gold" }));
      } catch (e) {
        tratamientos = [];
      }

      // Pago real desde finanzas (fuente de verdad)
      const sumaPagos = await dbGet(
        `SELECT COALESCE(SUM(monto), 0) as total FROM finanzas
         WHERE referencia_id = ? AND referencia_tipo IN ('presupuesto_asignado', 'presupuesto_consulta') AND tipo = 'ingreso'`,
        [pres.id]
      );
      const montoPagadoReal = parseFloat(sumaPagos?.total) || 0;

      // Recalcular estado_pago basado en precio original (sin desc consulta) vs pagos directos
      const precioOriginal = Number(pres.precio_total) || 0;
      const descSinConsulta = Math.max(0, (Number(pres.descuento) || 0) - (Number(pres.monto_consulta) || 0));
      const baseParaEstado = Math.max(0, precioOriginal - descSinConsulta);
      let estadoPago = pres.estado_pago;
      if (baseParaEstado > 0) {
        if (montoPagadoReal >= baseParaEstado - 0.01) estadoPago = "pagado";
        else if (montoPagadoReal > 0) estadoPago = "adelanto";
        else estadoPago = "pendiente";
      }

      // Leer overrides editables (no afectan el presupuesto real)
      const ov = await dbGet(
        `SELECT pagado_override, sesiones_override, comision_override, nota, oculto FROM especialista_presupuesto_overrides WHERE especialista_id = ? AND presupuesto_id = ?`,
        [id, pres.id]
      );

      const fila = {
        id: pres.id,
        paciente_id: pres.paciente_id,
        paciente_nombre: pres.paciente_nombre,
        paciente_apellido: pres.paciente_apellido,
        paciente_dni: pres.paciente_dni,
        precio_total: Number(pres.precio_total) || 0,
        descuento: Number(pres.descuento) || 0,
        estado: pres.estado,
        estado_pago: estadoPago,
        creado_en: pres.creado_en,
        comision_porcentaje: pres.comision_porcentaje,
        tratamientos,
        monto_pagado_real: montoPagadoReal,

        // Sesiones del presupuesto completo (contexto)
        sesiones_totales: t.sesiones_totales,
        sesiones_completadas: t.sesiones_realizadas,

        // Rango de fechas de SUS sesiones dentro del periodo consultado:
        // deja claro qué trabajo concreto se está pagando en este corte.
        periodo_desde: t.detalle_sesiones.reduce(
          (min, s) => (!min || (s.fecha_realizada || "") < min ? (s.fecha_realizada || "").slice(0, 10) : min), null),
        periodo_hasta: t.detalle_sesiones.reduce(
          (max, s) => (!max || (s.fecha_realizada || "") > max ? (s.fecha_realizada || "").slice(0, 10) : max), null),

        // 👇 Lo que corresponde a ESTE especialista
        mis_sesiones: t.mis_sesiones,
        base_comision: t.mi_valor_generado,      // valor de SUS sesiones
        comision_estimada: t.mi_comision,        // pago por SUS sesiones
        comision_porcentaje_efectivo: t.detalle_sesiones[0]?.comision_porcentaje ?? pctDefault,
        usa_override: pres.comision_porcentaje != null,
        detalle_sesiones: t.detalle_sesiones,
        compartido_con: t.compartido_con,        // otros especialistas del mismo presupuesto
        comision_total_presupuesto: t.comision_total_presupuesto,
        overrides: ov || null,
      };

      presupuestos.push(fila);

      // Si está oculto, no sumar a los totales
      if (ov && ov.oculto) continue;

      baseTotal += fila.base_comision;
      comisionTotal += (ov && ov.comision_override != null) ? Number(ov.comision_override) : fila.comision_estimada;
    }

    baseTotal = redondear(baseTotal);
    comisionTotal = redondear(comisionTotal);

    const ticketPromedio = presupuestos.length > 0 ? redondear(baseTotal / presupuestos.length) : 0;

    // KPI overrides por periodo
    const periodoKey = `${fecha_inicio || "all"}_${fecha_fin || "all"}`;
    const kpiOv = await dbGet(
      `SELECT pagado_total_override, comision_total_override FROM especialista_kpi_overrides WHERE especialista_id = ? AND periodo_key = ?`,
      [id, periodoKey]
    );

    res.json({
      especialista: { ...especialista, comision_porcentaje: pctDefault },
      resumen: {
        num_presupuestos: presupuestos.length,
        base_total: baseTotal,
        comision_total: comisionTotal,
        ticket_promedio: ticketPromedio,
        // Métricas de trabajo realizado
        sesiones_realizadas: trabajo.resumen.sesiones_realizadas,
        num_pacientes: trabajo.resumen.num_pacientes,
        valor_promedio_sesion: trabajo.resumen.valor_promedio_sesion,
        pago_fijo: Number(especialista.pago_fijo) || 0,
        total_a_pagar: redondear(comisionTotal + (Number(especialista.pago_fijo) || 0)),
      },
      kpi_overrides: kpiOv || null,
      presupuestos
    });
  } catch (err) {
    console.error("❌ Error perfil especialista:", err.message);
    res.status(500).json({ message: "Error al obtener perfil", error: err.message });
  }
});

/* ======================================================================
   🧾 DETALLE DE SESIONES REALIZADAS POR UN ESPECIALISTA
   Lista plana, ideal para revisar/exportar antes de pagarle.
====================================================================== */
router.get("/especialistas/:id/sesiones", authMiddleware, requireOwner, async (req, res) => {
  try {
    const { id } = req.params;
    const { fecha_inicio, fecha_fin } = req.query;

    const especialista = await dbGet("SELECT * FROM especialistas WHERE id = ?", [id]);
    if (!especialista) {
      return res.status(404).json({ message: "Especialista no encontrado" });
    }

    const trabajo = await trabajoDeEspecialista(id, { fecha_inicio, fecha_fin });

    // Aplanar todas las sesiones con el contexto de su paciente
    const sesiones = [];
    for (const p of trabajo.presupuestos) {
      for (const s of p.detalle_sesiones) {
        sesiones.push({
          ...s,
          presupuesto_id: p.presupuesto_id,
          paciente_id: p.paciente_id,
          paciente_nombre: `${p.paciente_nombre || ""} ${p.paciente_apellido || ""}`.trim(),
          paciente_dni: p.paciente_dni,
        });
      }
    }
    sesiones.sort((a, b) => String(b.fecha_realizada).localeCompare(String(a.fecha_realizada)));

    res.json({
      especialista: {
        id: especialista.id,
        nombre: especialista.nombre,
        especialidad: especialista.especialidad,
        comision_porcentaje: especialista.comision_porcentaje ?? 20,
        pago_fijo: Number(especialista.pago_fijo) || 0,
      },
      resumen: {
        ...trabajo.resumen,
        pago_fijo: Number(especialista.pago_fijo) || 0,
        total_a_pagar: redondear(trabajo.resumen.comision_total + (Number(especialista.pago_fijo) || 0)),
      },
      sesiones,
    });
  } catch (err) {
    console.error("❌ Error detalle sesiones especialista:", err.message);
    res.status(500).json({ message: "Error al obtener sesiones", error: err.message });
  }
});

/* ======================================================================
   ⚠️ SESIONES REALIZADAS SIN ESPECIALISTA — y corrección
   Trabajo que se hizo pero que nadie puede cobrar porque no se registró
   quién lo realizó. El dueño puede asignarlo aquí.
====================================================================== */
router.get("/sesiones-sin-especialista", authMiddleware, requireOwner, async (req, res) => {
  try {
    const { fecha_inicio, fecha_fin } = req.query;
    const sesiones = await sesionesHuerfanas({ fecha_inicio, fecha_fin });
    res.json({ total: sesiones.length, sesiones });
  } catch (err) {
    console.error("❌ Error sesiones sin especialista:", err.message);
    res.status(500).json({ message: "Error al obtener sesiones", error: err.message });
  }
});

router.put("/sesiones/:sesion_id/especialista", authMiddleware, requireOwner, async (req, res) => {
  try {
    const { sesion_id } = req.params;
    const { especialista_id } = req.body;

    if (!especialista_id) {
      return res.status(400).json({ message: "especialista_id es requerido" });
    }

    const especialista = await dbGet("SELECT id, nombre FROM especialistas WHERE id = ?", [especialista_id]);
    if (!especialista) {
      return res.status(404).json({ message: "Especialista no encontrado" });
    }

    const sesion = await dbGet("SELECT id, estado FROM presupuestos_sesiones WHERE id = ?", [sesion_id]);
    if (!sesion) {
      return res.status(404).json({ message: "Sesión no encontrada" });
    }

    await dbRun(
      `UPDATE presupuestos_sesiones SET especialista_id = ?, especialista = ? WHERE id = ?`,
      [especialista.id, especialista.nombre, sesion_id]
    );

    res.json({
      message: "✅ Especialista asignado a la sesión",
      especialista_id: especialista.id,
      especialista_nombre: especialista.nombre,
    });
  } catch (err) {
    console.error("❌ Error asignando especialista a sesión:", err.message);
    res.status(500).json({ message: "Error al asignar especialista", error: err.message });
  }
});

/* ======================================================================
   ✏️ OVERRIDES EDITABLES POR PRESUPUESTO EN VISTA ESPECIALISTA
====================================================================== */
router.put("/especialistas/:espId/presupuestos/:presId/override", authMiddleware, requireOwner, async (req, res) => {
  await ensureComisionSchema();
  try {
    const { espId, presId } = req.params;
    const { pagado_override, sesiones_override, comision_override, nota, oculto } = req.body;
    await dbRun(
      `INSERT INTO especialista_presupuesto_overrides (especialista_id, presupuesto_id, pagado_override, sesiones_override, comision_override, nota, oculto)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(especialista_id, presupuesto_id) DO UPDATE SET
         pagado_override = excluded.pagado_override,
         sesiones_override = excluded.sesiones_override,
         comision_override = excluded.comision_override,
         nota = excluded.nota,
         oculto = excluded.oculto`,
      [espId, presId, pagado_override ?? null, sesiones_override ?? null, comision_override ?? null, nota ?? null, oculto ? 1 : 0]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error("❌ Error guardando override:", err.message);
    res.status(500).json({ message: "Error al guardar override", error: err.message });
  }
});

// Guardar KPI overrides (pagado total y comisión total) por periodo - solo master
router.put("/especialistas/:espId/kpi-override", authMiddleware, requireRole("master"), async (req, res) => {
  await ensureComisionSchema();
  try {
    const { espId } = req.params;
    const { pagado_total_override, comision_total_override, fecha_inicio, fecha_fin } = req.body;
    const periodoKey = `${fecha_inicio || "all"}_${fecha_fin || "all"}`;
    await dbRun(
      `INSERT INTO especialista_kpi_overrides (especialista_id, periodo_key, pagado_total_override, comision_total_override)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(especialista_id, periodo_key) DO UPDATE SET
         pagado_total_override = excluded.pagado_total_override,
         comision_total_override = excluded.comision_total_override`,
      [espId, periodoKey, pagado_total_override ?? null, comision_total_override ?? null]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error("❌ Error guardando KPI override:", err.message);
    res.status(500).json({ message: "Error al guardar KPI override", error: err.message });
  }
});

/* ======================================================================
   📄 PDF: RESUMEN MENSUAL DE PAGO A ESPECIALISTA (Premium)
====================================================================== */
router.get("/especialistas/:id/pdf-resumen", authMiddleware, requireOwner, async (req, res) => {
  await ensureLineasMigration();
  await ensureComisionSchema();
  try {
    const { id } = req.params;
    const { fecha_inicio, fecha_fin } = req.query;

    const especialista = await dbGet("SELECT * FROM especialistas WHERE id = ?", [id]);
    if (!especialista) return res.status(404).json({ message: "Especialista no encontrado" });
    const pctDefault = especialista.comision_porcentaje != null ? Number(especialista.comision_porcentaje) : 20;

    // Mismo cálculo por sesión realizada que usa la pantalla, para que el PDF
    // y la vista de Gestión Dueño nunca muestren cifras distintas.
    const trabajo = await trabajoDeEspecialista(id, { fecha_inicio, fecha_fin });

    const presupuestos = [];
    for (const t of trabajo.presupuestos) {
      const cab = await dbGet(
        `SELECT pa.id, pa.precio_total, pa.descuento, pa.estado_pago, pa.comision_porcentaje, pa.creado_en
         FROM presupuestos_asignados pa WHERE pa.id = ?`,
        [t.presupuesto_id]
      );
      presupuestos.push({
        ...cab,
        paciente_nombre: t.paciente_nombre,
        paciente_apellido: t.paciente_apellido,
        sesiones_completadas: t.mis_sesiones,
        sesiones_totales: t.sesiones_totales,
        _base: t.mi_valor_generado,
        _comision: t.mi_comision,
        _pct: t.detalle_sesiones[0]?.comision_porcentaje ?? pctDefault,
      });
    }

    let totalComision = 0;
    let totalPagado = 0;
    const rows = [];

    for (const pres of presupuestos) {
      const base = pres._base;
      const pct = pres._pct;
      const comision = pres._comision;

      const sumaPagos = await dbGet(
        `SELECT COALESCE(SUM(monto), 0) as total FROM finanzas WHERE referencia_id = ? AND referencia_tipo IN ('presupuesto_asignado', 'presupuesto_consulta') AND tipo = 'ingreso'`,
        [pres.id]
      );
      const pagado = parseFloat(sumaPagos?.total) || 0;

      const ov = await dbGet(
        `SELECT pagado_override, sesiones_override, comision_override, nota, oculto FROM especialista_presupuesto_overrides WHERE especialista_id = ? AND presupuesto_id = ?`,
        [id, pres.id]
      );

      // Saltar presupuestos ocultos en el PDF
      if (ov && ov.oculto) continue;

      const comisionFinal = (ov && ov.comision_override != null) ? Number(ov.comision_override) : comision;
      const pagadoFinal = (ov && ov.pagado_override != null) ? Number(ov.pagado_override) : pagado;
      const sesionesFinal = (ov && ov.sesiones_override != null) ? `${ov.sesiones_override}/${pres.sesiones_totales}` : `${pres.sesiones_completadas}/${pres.sesiones_totales}`;

      totalComision += comisionFinal;
      totalPagado += pagadoFinal;

      rows.push({
        paciente: `${pres.paciente_nombre || ""} ${pres.paciente_apellido || ""}`.trim(),
        fecha: (pres.creado_en || "").slice(0, 10),
        base,
        pct,
        comision: comisionFinal,
        pagado: pagadoFinal,
        sesiones: sesionesFinal,
        estado: pres.estado_pago,
        nota: (ov && ov.nota) ? ov.nota : null
      });
    }

    // Aplicar KPI overrides globales si existen
    const periodoKey = `${fecha_inicio || "all"}_${fecha_fin || "all"}`;
    const kpiOv = await dbGet(
      `SELECT pagado_total_override, comision_total_override FROM especialista_kpi_overrides WHERE especialista_id = ? AND periodo_key = ?`,
      [id, periodoKey]
    );
    if (kpiOv && kpiOv.comision_total_override != null) totalComision = Number(kpiOv.comision_total_override);
    if (kpiOv && kpiOv.pagado_total_override != null) totalPagado = Number(kpiOv.pagado_total_override);

    // Generar PDF premium
    const doc = new PDFDocument({ size: "A4", margin: 40 });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=resumen_${especialista.nombre.replace(/\s/g, "_")}_${fecha_inicio || "all"}.pdf`);
    doc.pipe(res);

    const pw = doc.page.width;
    const ph = doc.page.height;
    const ml = 40, mr = 40;
    const cw = pw - ml - mr; // content width

    // Colores premium
    const brown = "#3E2A24";
    const brownLight = "#5D4037";
    const gold = "#C8A96E";
    const goldLight = "#E4D4B4";
    const cream = "#FFF8F0";
    const white = "#FFFFFF";

    // Helper: formato moneda
    const fmtMoney = (v) => `S/ ${Number(v).toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    // Helper: línea dorada decorativa
    const drawGoldLine = (yPos, width) => {
      doc.rect(ml, yPos, width || cw, 1.5).fill(gold);
    };

    // Helper: agregar footer a cada página
    const drawPageFooter = () => {
      doc.fontSize(7).font("Helvetica").fillColor("#BBBBBB");
      doc.text("ShowClinic", ml, ph - 30, { width: cw, align: "center" });
    };

    // ═══════════════════════════════════════════
    // HEADER — Banner oscuro con acento dorado
    // ═══════════════════════════════════════════
    doc.rect(0, 0, pw, 110).fill(brown);
    doc.rect(0, 110, pw, 4).fill(gold);

    // Logo/marca
    doc.fontSize(9).font("Helvetica").fillColor(goldLight).text("SHOWCLINIC", ml + 2, 22, { characterSpacing: 4 });

    // Título principal
    doc.fontSize(24).font("Helvetica-Bold").fillColor(white).text("Resumen de Pagos", ml, 46);
    doc.fontSize(10).font("Helvetica").fillColor(goldLight);
    const periodoText = fecha_inicio && fecha_fin ? `${fecha_inicio}  al  ${fecha_fin}` : fecha_inicio ? `Desde ${fecha_inicio}` : "Todo el periodo";
    doc.text(periodoText, ml, 78);

    // Fecha de generación (derecha del header)
    doc.fontSize(8).font("Helvetica").fillColor("#AAAAAA");
    doc.text(`Generado: ${new Date().toLocaleString("es-PE", { timeZone: "America/Lima" })}`, pw - mr - 200, 92, { width: 200, align: "right" });

    // ═══════════════════════════════════════════
    // INFO DEL ESPECIALISTA
    // ═══════════════════════════════════════════
    let y = 130;

    // Nombre del especialista destacado
    doc.fontSize(18).font("Helvetica-Bold").fillColor(brown).text(especialista.nombre, ml, y);
    y += 26;

    // Datos en dos columnas
    doc.fontSize(9).font("Helvetica").fillColor("#888888");
    doc.text("ESPECIALIDAD", ml, y);
    doc.text("COMISIÓN BASE", ml + 170, y);
    if (especialista.cuenta_bancaria) doc.text("CUENTA BANCARIA", ml + 340, y);
    y += 13;
    doc.fontSize(10).font("Helvetica-Bold").fillColor(brownLight);
    doc.text(especialista.especialidad || "General", ml, y);
    doc.text(`${pctDefault}%`, ml + 170, y);
    if (especialista.cuenta_bancaria) doc.text(especialista.cuenta_bancaria, ml + 340, y);
    y += 24;

    drawGoldLine(y);
    y += 16;

    // ═══════════════════════════════════════════
    // KPIs — Tres tarjetas elegantes
    // ═══════════════════════════════════════════
    const kpiGap = 14;
    const kpiW = (cw - kpiGap * 2) / 3;
    const kpiH = 62;

    const drawKpiCard = (x, label, value, accent) => {
      // Fondo con borde redondeado simulado
      doc.roundedRect(x, y, kpiW, kpiH, 6).lineWidth(1.2).strokeColor(accent === "gold" ? gold : "#E0E0E0").fillAndStroke(cream, accent === "gold" ? gold : "#E0E0E0");
      // Barra superior de acento
      doc.rect(x + 1, y + 1, kpiW - 2, 3).fill(accent === "gold" ? gold : brownLight);
      // Label
      doc.fontSize(7.5).font("Helvetica").fillColor("#999999").text(label, x + 14, y + 14, { width: kpiW - 28 });
      // Valor
      doc.fontSize(16).font("Helvetica-Bold").fillColor(brown).text(value, x + 14, y + 30, { width: kpiW - 28 });
    };

    drawKpiCard(ml, "PAGO AL ESPECIALISTA", fmtMoney(totalComision), "gold");
    drawKpiCard(ml + kpiW + kpiGap, "PAGADO POR PACIENTES", fmtMoney(totalPagado), "dark");
    drawKpiCard(ml + (kpiW + kpiGap) * 2, "PRESUPUESTOS ACTIVOS", `${rows.length}`, "dark");
    y += kpiH + 24;

    // ═══════════════════════════════════════════
    // TABLA DE PRESUPUESTOS
    // ═══════════════════════════════════════════

    // Título de sección
    doc.fontSize(12).font("Helvetica-Bold").fillColor(brown).text("Detalle de Presupuestos", ml, y);
    y += 20;

    // Definir columnas con mejor distribución
    const colDefs = [
      { label: "Paciente",  x: ml,       w: 120 },
      { label: "Fecha",     x: ml + 120, w: 70  },
      { label: "Base",      x: ml + 190, w: 70  },
      { label: "%",         x: ml + 260, w: 35  },
      { label: "Comisión",  x: ml + 295, w: 75  },
      { label: "Pagado",    x: ml + 370, w: 75  },
      { label: "Sesiones",  x: ml + 445, w: 70  }
    ];
    const tableW = cw;
    const rowH = 26;
    const headerH = 28;

    // Header de tabla
    doc.roundedRect(ml, y, tableW, headerH, 4).fill(brown);
    doc.fontSize(7.5).font("Helvetica-Bold").fillColor(white);
    colDefs.forEach(c => doc.text(c.label.toUpperCase(), c.x + 8, y + 10, { width: c.w - 12 }));
    y += headerH;

    // Helper: medir altura de texto antes de dibujarlo
    const measureTextHeight = (text, fontSize, fontName, maxWidth) => {
      doc.fontSize(fontSize).font(fontName);
      return doc.heightOfString(text, { width: maxWidth });
    };

    // Filas
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];

      // Calcular altura de nota si existe
      let notaH = 0;
      const notaTextW = tableW - 56;
      if (r.nota) {
        const textH = measureTextHeight(r.nota, 8, "Helvetica-Oblique", notaTextW);
        notaH = textH + 20; // padding arriba (10) + abajo (10)
      }
      const totalRowH = rowH + notaH;

      if (y + totalRowH > ph - 50) {
        drawPageFooter();
        doc.addPage();
        y = 40;
        // Re-dibujar header de tabla en nueva página
        doc.roundedRect(ml, y, tableW, headerH, 4).fill(brown);
        doc.fontSize(7.5).font("Helvetica-Bold").fillColor(white);
        colDefs.forEach(c => doc.text(c.label.toUpperCase(), c.x + 8, y + 10, { width: c.w - 12 }));
        y += headerH;
      }

      const rowBg = i % 2 === 0 ? white : "#FAFAF5";

      // Fondo de fila de datos
      doc.rect(ml, y, tableW, rowH).fill(rowBg);
      doc.rect(ml, y + rowH - 0.5, tableW, 0.5).fill("#EEEEEE");

      // Datos
      doc.fontSize(8.5).font("Helvetica").fillColor(brown);
      const nombre = r.paciente.length > 16 ? r.paciente.slice(0, 16) + "..." : r.paciente;
      doc.font("Helvetica-Bold").text(nombre, colDefs[0].x + 8, y + 9, { width: colDefs[0].w - 12 });
      doc.font("Helvetica").fillColor("#666666");
      doc.text(r.fecha, colDefs[1].x + 8, y + 9, { width: colDefs[1].w - 12 });
      doc.fillColor(brown);
      doc.text(fmtMoney(r.base), colDefs[2].x + 8, y + 9, { width: colDefs[2].w - 12 });
      doc.text(`${r.pct}%`, colDefs[3].x + 8, y + 9, { width: colDefs[3].w - 12 });
      doc.font("Helvetica-Bold").fillColor(brownLight);
      doc.text(fmtMoney(r.comision), colDefs[4].x + 8, y + 9, { width: colDefs[4].w - 12 });
      doc.font("Helvetica").fillColor(brown);
      doc.text(fmtMoney(r.pagado), colDefs[5].x + 8, y + 9, { width: colDefs[5].w - 12 });
      doc.fillColor("#888888");
      doc.text(r.sesiones, colDefs[6].x + 8, y + 9, { width: colDefs[6].w - 12 });
      y += rowH;

      // Nota / descripción — altura dinámica con espacio generoso
      if (r.nota && notaH > 0) {
        doc.rect(ml, y, tableW, notaH).fill("#FFFDF5");
        doc.rect(ml, y + notaH - 0.5, tableW, 0.5).fill("#EDE8DF");
        // Barra vertical dorada decorativa (altura dinámica)
        doc.rect(ml + 16, y + 8, 2.5, notaH - 16).fill(gold);
        doc.fontSize(8).font("Helvetica-Oblique").fillColor("#7A6C5E");
        doc.text(r.nota, ml + 28, y + 10, { width: notaTextW, lineGap: 2 });
        y += notaH;
      }
    }

    // ═══════════════════════════════════════════
    // PIE DE TABLA — Total destacado
    // ═══════════════════════════════════════════
    y += 6;
    doc.roundedRect(ml, y, tableW, 42, 4).lineWidth(1.5).strokeColor(gold).fillAndStroke("#FFFBF2", gold);
    // Barra izquierda dorada
    doc.rect(ml + 1, y + 1, 4, 40).fill(gold);
    doc.fontSize(8).font("Helvetica").fillColor("#999999").text("TOTAL COMISIÓN A PAGAR", ml + 18, y + 10);
    doc.fontSize(18).font("Helvetica-Bold").fillColor(brown).text(fmtMoney(totalComision), ml + 18, y + 22);
    // Pagado por pacientes al lado
    doc.fontSize(8).font("Helvetica").fillColor("#999999").text("TOTAL PAGADO POR PACIENTES", ml + 280, y + 10);
    doc.fontSize(14).font("Helvetica-Bold").fillColor(brownLight).text(fmtMoney(totalPagado), ml + 280, y + 24);
    y += 56;

    // ═══════════════════════════════════════════
    // FOOTER
    // ═══════════════════════════════════════════
    drawGoldLine(y);
    y += 12;
    doc.fontSize(7.5).font("Helvetica").fillColor("#BBBBBB");
    doc.text("Este documento es un resumen generado automáticamente por ShowClinic. Los montos reflejan los datos registrados al momento de su generación.", ml, y, { width: cw, align: "center" });
    y += 16;
    doc.fontSize(7).fillColor("#CCCCCC").text(`ShowClinic  ·  ${new Date().toLocaleString("es-PE", { timeZone: "America/Lima" })}`, ml, y, { width: cw, align: "center" });

    drawPageFooter();
    doc.end();
  } catch (err) {
    console.error("❌ Error generando PDF:", err.message);
    res.status(500).json({ message: "Error generando PDF", error: err.message });
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

    // El pago se calcula sobre las SESIONES que cada especialista realizó,
    // no sobre el presupuesto completo. Ver services/comisiones.js.
    const rendimiento = await calcularRendimientoEspecialistas({ fecha_inicio, fecha_fin });

    const datosBase = await dbAll(
      `SELECT id, nombre, tipo, especialidad, cuenta_bancaria FROM especialistas`
    );
    const infoPorId = new Map(datosBase.map((e) => [e.id, e]));

    const especialistas = [];
    for (const r of rendimiento) {
      const base = infoPorId.get(r.id) || {};
      const pendiente = await dbGet(
        `SELECT COALESCE(SUM(monto), 0) as t FROM comisiones_especialistas
         WHERE especialista_id = ? AND estado = 'pendiente' AND revertido = 0`,
        [r.id]
      );
      const liquidada = await dbGet(
        `SELECT COALESCE(SUM(monto), 0) as t FROM comisiones_especialistas
         WHERE especialista_id = ? AND estado = 'liquidado' AND revertido = 0`,
        [r.id]
      );

      especialistas.push({
        id: r.id,
        nombre: r.nombre,
        tipo: base.tipo,
        especialidad: r.especialidad,
        cuenta_bancaria: base.cuenta_bancaria,
        comision_porcentaje: r.comision_porcentaje,
        // Nombres conservados para compatibilidad con la vista actual
        num_presupuestos: r.pacientes_atendidos,
        base_total: r.ingresos_generados,
        comision_total: r.comision_a_pagar,
        // Métricas nuevas basadas en trabajo realizado
        sesiones_realizadas: r.sesiones_realizadas,
        pacientes_atendidos: r.pacientes_atendidos,
        pago_fijo: r.pago_fijo,
        total_a_pagar: r.total_a_pagar,
        comision_pendiente: Number(pendiente?.t) || 0,
        comision_liquidada: Number(liquidada?.t) || 0,
      });
    }

    especialistas.sort((a, b) => String(a.nombre).localeCompare(String(b.nombre)));
    res.json(especialistas);
  } catch (err) {
    console.error("❌ Error listando especialistas:", err.message);
    res.status(500).json({ message: "Error al listar especialistas", error: err.message });
  }
});

/* ======================================================================
   RECONCILIACIÓN: descompone el total EXACTO de Finanzas
   Reutiliza getReporteFinanciero (misma lógica que la página de Finanzas)
   y reparte su total en buckets, uno de ellos por especialista, para que
   la suma cuadre exactamente con lo que muestra Finanzas.
====================================================================== */
router.get("/reconciliacion", authMiddleware, requireOwner, async (req, res) => {
  await ensureComisionSchema();
  try {
    const { fecha_inicio, fecha_fin } = req.query;

    // Reutilizamos EXACTAMENTE el mismo cálculo que la página de Finanzas.
    // getReporteFinanciero devuelve el array completo (todosResultados) donde cada fila
    // ya trae `monto_cobrado` (con descuento POS de tarjeta aplicado) y `totalGeneral`,
    // que es el número EXACTO que ve el usuario en Finanzas. Descomponemos ese total sol
    // por sol, así el cuadre está garantizado por construcción.
    const rep = await getReporteFinanciero({ fechaInicio: fecha_inicio, fechaFin: fecha_fin });
    const rows = rep.resultados || [];
    const totalFinanzas = Number(rep.totalGeneral) || 0;

    // Mapear cada presupuesto (asignado o consulta) a su especialista
    const presIds = new Set();
    for (const r of rows) {
      if ((r.referencia_tipo === "presupuesto_asignado" || r.referencia_tipo === "presupuesto_consulta") && r.referencia_id) {
        presIds.add(Number(r.referencia_id));
      }
    }
    const espMap = {}; // presupuesto_id -> { especialista_id, nombre }
    if (presIds.size > 0) {
      const ph = [...presIds];
      const placeholders = ph.map(() => "?").join(",");
      const presRows = await dbAll(
        `SELECT pa.id, pa.especialista_id, e.nombre as especialista_nombre
         FROM presupuestos_asignados pa
         LEFT JOIN especialistas e ON e.id = pa.especialista_id
         WHERE pa.id IN (${placeholders})`,
        ph
      );
      presRows.forEach((pr) => { espMap[pr.id] = { especialista_id: pr.especialista_id, nombre: pr.especialista_nombre }; });
    }

    // Buckets que suman EXACTAMENTE el total de Finanzas
    const buckets = {
      presupuestos_con_especialista: 0,
      presupuestos_sin_especialista: 0,
      paquetes: 0,
      consultas_directas: 0,
      deudas_tratamiento: 0,
      tratamientos_antiguos: 0,
      otros: 0
    };
    const porEsp = {}; // especialista_id -> { id, nombre, pagado_total }

    for (const r of rows) {
      const cobrado = Number(r.monto_cobrado) || 0;
      const rt = r.referencia_tipo;

      // Tratamientos del modelo antiguo (tratamientos_realizados): no tienen referencia_tipo
      if (r.tipo_registro === "tratamiento" && !rt) { buckets.tratamientos_antiguos += cobrado; continue; }

      if (rt === "presupuesto_asignado" || rt === "presupuesto_consulta") {
        let espId = (rt === "presupuesto_asignado" && r.presupuesto_especialista_id != null)
          ? r.presupuesto_especialista_id : null;
        const m = espMap[Number(r.referencia_id)];
        let espNombre = m?.nombre || null;
        if (espId == null && m) espId = m.especialista_id;
        if (espId != null) {
          buckets.presupuestos_con_especialista += cobrado;
          if (!porEsp[espId]) porEsp[espId] = { id: espId, nombre: espNombre || "Especialista", pagado_total: 0 };
          porEsp[espId].pagado_total += cobrado;
        } else {
          buckets.presupuestos_sin_especialista += cobrado;
        }
        continue;
      }

      if (rt === "paquete_paciente" || rt === "paquete_consulta") { buckets.paquetes += cobrado; continue; }
      if (rt === "consulta_directa") { buckets.consultas_directas += cobrado; continue; }
      if (rt === "deuda_tratamiento") { buckets.deudas_tratamiento += cobrado; continue; }
      buckets.otros += cobrado;
    }

    const sumaBuckets = Object.values(buckets).reduce((a, b) => a + b, 0);
    const detallePorEspecialista = Object.values(porEsp).sort((a, b) => b.pagado_total - a.pagado_total);

    res.json({
      filtro: {
        fecha_inicio: fecha_inicio || null,
        fecha_fin: fecha_fin || null,
        criterio: "mismo cálculo que Finanzas (fecha de pago + descuento POS tarjeta)"
      },
      total_finanzas: totalFinanzas,
      buckets,
      suma_buckets: sumaBuckets,
      diferencia_total: totalFinanzas - sumaBuckets, // debe ser ~0 (cuadre exacto)
      detalle_por_especialista: detallePorEspecialista
    });
  } catch (err) {
    console.error("❌ Error en reconciliación:", err.message);
    res.status(500).json({ message: "Error en reconciliación", error: err.message });
  }
});

/* ======================================================================
   EDITAR % DE COMISIÓN POR DEFECTO DEL ESPECIALISTA
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
