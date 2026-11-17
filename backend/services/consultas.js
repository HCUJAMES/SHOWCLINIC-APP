/**
 * CONSULTAS PREPAGADAS COMO SALDO A FAVOR DEL PACIENTE
 * ====================================================
 *
 * Flujo real de la clínica:
 *   1. El paciente llega, paga la consulta (p. ej. S/ 100) y aún no hay presupuesto.
 *   2. Días después se le arma un presupuesto de tratamientos.
 *   3. Esa consulta ya pagada debe descontarse de ese presupuesto.
 *
 * Antes, el pago de la consulta solo se registraba como ingreso suelto en
 * finanzas y no había forma de vincularlo: el monto se perdía.
 *
 * Ahora cada consulta pagada queda como un CRÉDITO del paciente:
 *   - estado 'disponible' → todavía no se aplicó a ningún presupuesto
 *   - estado 'aplicada'   → ya se descontó de un presupuesto concreto
 *
 * ⚠️ Contabilidad: el ingreso se registra en finanzas UNA sola vez, cuando el
 * paciente paga la consulta. Aplicar el crédito a un presupuesto NO genera un
 * ingreso nuevo: solo reduce lo que el paciente todavía debe.
 */

import { dbAll, dbGet, dbRun } from "../db/database.js";

let schemaReady = false;

export async function ensureConsultasSchema() {
  if (schemaReady) return;

  await dbRun(`CREATE TABLE IF NOT EXISTS consultas_paciente (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    paciente_id INTEGER NOT NULL,
    monto REAL NOT NULL,
    metodo_pago TEXT,
    fecha TEXT NOT NULL,
    estado TEXT NOT NULL DEFAULT 'disponible',
    finanza_id INTEGER,
    presupuesto_aplicado_id INTEGER,
    aplicada_en TEXT,
    aplicada_por TEXT,
    notas TEXT,
    creado_en TEXT DEFAULT CURRENT_TIMESTAMP,
    creado_por TEXT,
    FOREIGN KEY(paciente_id) REFERENCES patients(id)
  )`);

  await dbRun(
    `CREATE INDEX IF NOT EXISTS idx_consultas_paciente_estado
     ON consultas_paciente(paciente_id, estado)`
  );

  // Quién atendió la consulta y cuánto se le paga si no termina en tratamiento
  await agregarColumna("consultas_paciente", "especialista_id INTEGER");
  await agregarColumna("especialistas", "tarifa_consulta REAL DEFAULT 0");

  schemaReady = true;
}

const agregarColumna = async (tabla, definicion) => {
  try {
    await dbRun(`ALTER TABLE ${tabla} ADD COLUMN ${definicion}`);
  } catch (e) {
    if (!String(e.message).includes("duplicate column")) throw e;
  }
};

/**
 * Rescata las consultas directas que ya existían en finanzas y todavía no
 * tienen su crédito. Se ejecuta una vez; es idempotente.
 */
export async function migrarConsultasHistoricas() {
  await ensureConsultasSchema();

  const huerfanas = await dbAll(`
    SELECT f.id, f.paciente_id, f.monto, f.fecha, f.metodo_pago, f.creado_por
    FROM finanzas f
    WHERE f.tipo = 'ingreso'
      AND f.referencia_tipo = 'consulta_directa'
      AND f.paciente_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM consultas_paciente c WHERE c.finanza_id = f.id)
  `);

  for (const f of huerfanas) {
    await dbRun(
      `INSERT INTO consultas_paciente
        (paciente_id, monto, metodo_pago, fecha, estado, finanza_id, creado_en, creado_por, notas)
       VALUES (?, ?, ?, ?, 'disponible', ?, ?, ?, 'Recuperada del historial de finanzas')`,
      [f.paciente_id, f.monto, f.metodo_pago, f.fecha, f.id, f.fecha, f.creado_por || "sistema"]
    );
  }

  if (huerfanas.length > 0) {
    console.log(`✅ ${huerfanas.length} consulta(s) previa(s) convertidas en saldo a favor`);
  }
  return huerfanas.length;
}

/** Registra una consulta pagada como crédito disponible del paciente. */
export async function registrarConsulta({ paciente_id, monto, metodo_pago, fecha, finanza_id, creado_por, notas, especialista_id }) {
  await ensureConsultasSchema();
  const r = await dbRun(
    `INSERT INTO consultas_paciente
      (paciente_id, monto, metodo_pago, fecha, estado, finanza_id, creado_en, creado_por, notas, especialista_id)
     VALUES (?, ?, ?, ?, 'disponible', ?, ?, ?, ?, ?)`,
    [paciente_id, monto, metodo_pago || "efectivo", fecha, finanza_id || null, fecha, creado_por || "sistema", notas || null, especialista_id || null]
  );
  return r.lastID;
}

/** Consultas del paciente que aún no se han descontado de ningún presupuesto. */
export async function consultasDisponibles(pacienteId) {
  await ensureConsultasSchema();
  return dbAll(
    `SELECT id, monto, metodo_pago, fecha, notas
     FROM consultas_paciente
     WHERE paciente_id = ? AND estado = 'disponible'
     ORDER BY fecha ASC`,
    [pacienteId]
  );
}

/** Historial completo (disponibles + aplicadas) para mostrar contexto. */
export async function consultasDePaciente(pacienteId) {
  await ensureConsultasSchema();
  return dbAll(
    `SELECT c.*, pa.id as presupuesto_id
     , e.nombre as especialista_nombre
     FROM consultas_paciente c
     LEFT JOIN presupuestos_asignados pa ON pa.id = c.presupuesto_aplicado_id
     LEFT JOIN especialistas e ON e.id = c.especialista_id
     WHERE c.paciente_id = ?
     ORDER BY c.fecha DESC`,
    [pacienteId]
  );
}

/** Suma disponible del paciente (para mostrar el aviso "tiene S/X a favor"). */
export async function saldoDisponible(pacienteId) {
  await ensureConsultasSchema();
  const r = await dbGet(
    `SELECT COALESCE(SUM(monto), 0) as total, COUNT(*) as n
     FROM consultas_paciente WHERE paciente_id = ? AND estado = 'disponible'`,
    [pacienteId]
  );
  return { total: Number(r?.total) || 0, cantidad: Number(r?.n) || 0 };
}

/**
 * Recalcula descuento, saldo y estado de pago de un presupuesto tras
 * aplicar o quitar consultas. Devuelve los valores nuevos.
 */
async function recalcularPresupuesto(presupuestoId) {
  const pres = await dbGet(`SELECT * FROM presupuestos_asignados WHERE id = ?`, [presupuestoId]);
  if (!pres) return null;

  const precioTotal = Number(pres.precio_total) || 0;
  const descuento = Number(pres.descuento) || 0;

  // Lo realmente cobrado al paciente por ESTE presupuesto (sin contar la consulta,
  // que se cobró aparte y ya está reflejada en el descuento).
  const pagos = await dbGet(
    `SELECT COALESCE(SUM(monto), 0) as total FROM finanzas
     WHERE referencia_id = ? AND referencia_tipo = 'presupuesto_asignado' AND tipo = 'ingreso'`,
    [presupuestoId]
  );
  const pagado = Number(pagos?.total) || 0;

  const porCobrar = Math.max(0, precioTotal - descuento);
  const saldo = Math.max(0, porCobrar - pagado);

  let estadoPago = "pendiente_pago";
  let pagadoFlag = 0;
  if (porCobrar > 0 && saldo <= 0.01) {
    estadoPago = "pagado";
    pagadoFlag = 1;
  } else if (pagado > 0) {
    estadoPago = "adelanto";
  }

  await dbRun(
    `UPDATE presupuestos_asignados
     SET saldo_pendiente = ?, estado_pago = ?, pagado = ?, monto_pagado = ?
     WHERE id = ?`,
    [saldo, estadoPago, pagadoFlag, pagado, presupuestoId]
  );

  return { precio_total: precioTotal, descuento, pagado, saldo_pendiente: saldo, estado_pago: estadoPago };
}

/**
 * Aplica créditos de consulta a un presupuesto.
 * Suma su importe al descuento del presupuesto y marca los créditos como usados.
 */
export async function aplicarConsultas({ presupuesto_id, consulta_ids, usuario }) {
  await ensureConsultasSchema();

  const pres = await dbGet(`SELECT * FROM presupuestos_asignados WHERE id = ?`, [presupuesto_id]);
  if (!pres) throw new Error("Presupuesto no encontrado");

  if (!Array.isArray(consulta_ids) || consulta_ids.length === 0) {
    throw new Error("No se indicaron consultas para aplicar");
  }

  const placeholders = consulta_ids.map(() => "?").join(",");
  const creditos = await dbAll(
    `SELECT * FROM consultas_paciente
     WHERE id IN (${placeholders}) AND paciente_id = ? AND estado = 'disponible'`,
    [...consulta_ids, pres.paciente_id]
  );

  if (creditos.length === 0) {
    throw new Error("Las consultas indicadas no están disponibles para este paciente");
  }

  const montoAplicar = creditos.reduce((a, c) => a + (Number(c.monto) || 0), 0);
  const precioTotal = Number(pres.precio_total) || 0;
  const descuentoActual = Number(pres.descuento) || 0;

  if (descuentoActual + montoAplicar > precioTotal) {
    throw new Error(
      `El saldo a favor (S/ ${montoAplicar.toFixed(2)}) más el descuento actual supera el total del presupuesto`
    );
  }

  const ahora = new Date().toLocaleString("sv-SE", { timeZone: "America/Lima" }).replace("T", " ").slice(0, 19);

  // El monto de consulta se suma al descuento (el paciente ya pagó esa parte)
  await dbRun(
    `UPDATE presupuestos_asignados
     SET descuento = ?, monto_consulta = ?, consulta_pagada = 1,
         fecha_pago_consulta = COALESCE(fecha_pago_consulta, ?),
         metodo_pago_consulta = COALESCE(metodo_pago_consulta, ?)
     WHERE id = ?`,
    [
      descuentoActual + montoAplicar,
      (Number(pres.monto_consulta) || 0) + montoAplicar,
      creditos[0].fecha,
      creditos[0].metodo_pago,
      presupuesto_id,
    ]
  );

  for (const c of creditos) {
    await dbRun(
      `UPDATE consultas_paciente
       SET estado = 'aplicada', presupuesto_aplicado_id = ?, aplicada_en = ?, aplicada_por = ?
       WHERE id = ?`,
      [presupuesto_id, ahora, usuario || "sistema", c.id]
    );
  }

  // Mantener sincronizada la oferta de origen (lo que ve el historial clínico)
  if (pres.oferta_id) {
    await dbRun(`UPDATE patient_ofertas SET descuento = ? WHERE id = ?`, [
      descuentoActual + montoAplicar,
      pres.oferta_id,
    ]);
  }

  const totales = await recalcularPresupuesto(presupuesto_id);

  return {
    monto_aplicado: montoAplicar,
    consultas_aplicadas: creditos.length,
    ...totales,
  };
}

/** Devuelve un crédito ya aplicado al estado disponible. */
export async function revertirConsulta({ consulta_id, usuario }) {
  await ensureConsultasSchema();

  const c = await dbGet(`SELECT * FROM consultas_paciente WHERE id = ?`, [consulta_id]);
  if (!c) throw new Error("Consulta no encontrada");
  if (c.estado !== "aplicada") throw new Error("Esta consulta no está aplicada a ningún presupuesto");

  const presupuestoId = c.presupuesto_aplicado_id;
  const pres = presupuestoId ? await dbGet(`SELECT * FROM presupuestos_asignados WHERE id = ?`, [presupuestoId]) : null;

  if (pres) {
    const monto = Number(c.monto) || 0;
    const nuevoDescuento = Math.max(0, (Number(pres.descuento) || 0) - monto);
    const nuevoMontoConsulta = Math.max(0, (Number(pres.monto_consulta) || 0) - monto);

    await dbRun(
      `UPDATE presupuestos_asignados
       SET descuento = ?, monto_consulta = ?, consulta_pagada = ?
       WHERE id = ?`,
      [nuevoDescuento, nuevoMontoConsulta, nuevoMontoConsulta > 0 ? 1 : 0, presupuestoId]
    );

    if (pres.oferta_id) {
      await dbRun(`UPDATE patient_ofertas SET descuento = ? WHERE id = ?`, [nuevoDescuento, pres.oferta_id]);
    }

    await recalcularPresupuesto(presupuestoId);
  }

  await dbRun(
    `UPDATE consultas_paciente
     SET estado = 'disponible', presupuesto_aplicado_id = NULL, aplicada_en = NULL, aplicada_por = ?
     WHERE id = ?`,
    [usuario || "sistema", consulta_id]
  );

  return { presupuesto_id: presupuestoId, monto: Number(c.monto) || 0 };
}


/* ======================================================================
   PAGO DE CONSULTAS A LA DOCTORA
   ----------------------------------------------------------------------
   Regla de la clínica:
     - Si la paciente se hace tratamiento, la doctora cobra su comisión del
       tratamiento (20 % o la que tenga) y la consulta NO se paga aparte.
     - Si hasta el CIERRE DEL MES de la consulta no hubo tratamiento, a la
       doctora se le paga la consulta con su tarifa fija (especialistas.
       tarifa_consulta). Tarifa 0 = a esa persona no se le pagan consultas.
     - Si la paciente vuelve después del cierre y se hace el tratamiento, la
       doctora cobra además su comisión completa (la consulta ya pagada se
       queda como está).
   "Hizo tratamiento" = la consulta se descontó de un presupuesto, o la
   paciente pagó algo que no es consulta, o tiene un tratamiento registrado,
   entre el día de la consulta y el fin de ese mes.
====================================================================== */

const hoyLima = () => new Date().toLocaleDateString("sv-SE", { timeZone: "America/Lima" });

/** "2026-11-14" → "2026-11-30" */
export const finDeMes = (ymd) => {
  const [y, m] = String(ymd).slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
};

/** ¿La paciente "cerró la venta" entre la consulta y el fin de ese mes? */
async function seConvirtio(c, hasta) {
  const desde = String(c.fecha).slice(0, 10);
  if (c.estado === "aplicada" && c.aplicada_en && String(c.aplicada_en).slice(0, 10) <= hasta) return "presupuesto";
  const pago = await dbGet(
    `SELECT 1 FROM finanzas
     WHERE paciente_id = ? AND tipo = 'ingreso'
       AND COALESCE(categoria, '') != 'consulta'
       AND COALESCE(referencia_tipo, '') != 'consulta_directa'
       AND DATE(fecha) BETWEEN ? AND ?
     LIMIT 1`,
    [c.paciente_id, desde, hasta]
  );
  if (pago) return "pago";
  const trat = await dbGet(
    `SELECT 1 FROM tratamientos_realizados
     WHERE paciente_id = ? AND DATE(fecha) BETWEEN ? AND ? LIMIT 1`,
    [c.paciente_id, desde, hasta]
  ).catch(() => null);
  if (trat) return "tratamiento";
  return null;
}

/**
 * Consultas atendidas por cada especialista en el periodo (por fecha de la
 * consulta), con su estado para el pago:
 *   convertida → hizo tratamiento: no se paga la consulta
 *   a_pagar    → el mes ya cerró sin tratamiento: se paga la tarifa
 *   en_espera  → el mes sigue abierto: todavía puede cerrar la venta
 * Devuelve Map(especialista_id → { consultas, a_pagar, en_espera, convertidas, pago_consultas, tarifa }).
 */
export async function consultasDeEspecialistas({ fecha_inicio, fecha_fin, especialista_id } = {}) {
  await ensureConsultasSchema();
  const cond = ["c.especialista_id IS NOT NULL"];
  const params = [];
  if (fecha_inicio) { cond.push("DATE(c.fecha) >= ?"); params.push(fecha_inicio); }
  if (fecha_fin) { cond.push("DATE(c.fecha) <= ?"); params.push(fecha_fin); }
  if (especialista_id) { cond.push("c.especialista_id = ?"); params.push(Number(especialista_id)); }

  const filas = await dbAll(
    `SELECT c.id, c.paciente_id, c.monto, c.metodo_pago, c.fecha, c.estado, c.aplicada_en,
            c.presupuesto_aplicado_id, c.especialista_id, c.creado_por,
            p.nombre as paciente_nombre, p.apellido as paciente_apellido, p.dni as paciente_dni,
            COALESCE(e.tarifa_consulta, 0) as tarifa
     FROM consultas_paciente c
     JOIN especialistas e ON e.id = c.especialista_id
     LEFT JOIN patients p ON p.id = c.paciente_id
     WHERE ${cond.join(" AND ")}
     ORDER BY c.fecha DESC`,
    params
  );

  const hoy = hoyLima();
  const porEsp = new Map();
  for (const c of filas) {
    const cierre = finDeMes(c.fecha);
    const como = await seConvirtio(c, cierre);
    const estado_pago = como ? "convertida" : hoy > cierre ? "a_pagar" : "en_espera";
    const tarifa = Number(c.tarifa) || 0;
    const item = {
      ...c,
      fecha: String(c.fecha).slice(0, 10),
      cierre,
      estado_pago,
      convertida_por: como,
      pago: estado_pago === "a_pagar" ? tarifa : 0,
    };
    const acc = porEsp.get(c.especialista_id) || {
      consultas: [], a_pagar: 0, en_espera: 0, convertidas: 0, pago_consultas: 0, pago_en_espera: 0, tarifa,
    };
    acc.consultas.push(item);
    if (estado_pago === "a_pagar") { acc.a_pagar += 1; acc.pago_consultas += tarifa; }
    else if (estado_pago === "en_espera") { acc.en_espera += 1; acc.pago_en_espera += tarifa; }
    else acc.convertidas += 1;
    porEsp.set(c.especialista_id, acc);
  }
  return porEsp;
}

/** Resumen vacío para quien no tuvo consultas. */
export const SIN_CONSULTAS = Object.freeze({
  consultas: [], a_pagar: 0, en_espera: 0, convertidas: 0, pago_consultas: 0, pago_en_espera: 0, tarifa: 0,
});

/** Campos que se agregan a cada especialista en los reportes de pago. */
export const camposConsultas = (r = SIN_CONSULTAS) => ({
  consultas_atendidas: r.consultas.length,
  consultas_convertidas: r.convertidas,
  consultas_a_pagar: r.a_pagar,
  consultas_en_espera: r.en_espera,
  pago_consultas: Math.round(r.pago_consultas * 100) / 100,
  pago_consultas_en_espera: Math.round(r.pago_en_espera * 100) / 100,
});

/** Consultas directas (saldo a favor) sin doctora asignada, para completarlas. */
export async function consultasSinEspecialista({ fecha_inicio, fecha_fin } = {}) {
  await ensureConsultasSchema();
  const cond = ["c.especialista_id IS NULL"];
  const params = [];
  if (fecha_inicio) { cond.push("DATE(c.fecha) >= ?"); params.push(fecha_inicio); }
  if (fecha_fin) { cond.push("DATE(c.fecha) <= ?"); params.push(fecha_fin); }
  return dbAll(
    `SELECT c.id, c.paciente_id, c.monto, c.fecha, c.estado, c.creado_por,
            p.nombre as paciente_nombre, p.apellido as paciente_apellido, p.dni as paciente_dni
     FROM consultas_paciente c
     LEFT JOIN patients p ON p.id = c.paciente_id
     WHERE ${cond.join(" AND ")}
     ORDER BY c.fecha DESC`,
    params
  );
}

/** Asigna (o cambia, o quita con null) la especialista que atendió la consulta. */
export async function asignarEspecialistaConsulta({ consulta_id, especialista_id }) {
  await ensureConsultasSchema();
  const c = await dbGet("SELECT id FROM consultas_paciente WHERE id = ?", [consulta_id]);
  if (!c) throw new Error("Consulta no encontrada");
  if (especialista_id != null) {
    const e = await dbGet("SELECT id FROM especialistas WHERE id = ?", [especialista_id]);
    if (!e) throw new Error("Especialista no encontrado");
  }
  await dbRun("UPDATE consultas_paciente SET especialista_id = ? WHERE id = ?", [especialista_id ?? null, consulta_id]);
  return { id: Number(consulta_id), especialista_id: especialista_id ?? null };
}
