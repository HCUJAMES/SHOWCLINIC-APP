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

  schemaReady = true;
}

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
export async function registrarConsulta({ paciente_id, monto, metodo_pago, fecha, finanza_id, creado_por, notas }) {
  await ensureConsultasSchema();
  const r = await dbRun(
    `INSERT INTO consultas_paciente
      (paciente_id, monto, metodo_pago, fecha, estado, finanza_id, creado_en, creado_por, notas)
     VALUES (?, ?, ?, ?, 'disponible', ?, ?, ?, ?)`,
    [paciente_id, monto, metodo_pago || "efectivo", fecha, finanza_id || null, fecha, creado_por || "sistema", notas || null]
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
     FROM consultas_paciente c
     LEFT JOIN presupuestos_asignados pa ON pa.id = c.presupuesto_aplicado_id
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
