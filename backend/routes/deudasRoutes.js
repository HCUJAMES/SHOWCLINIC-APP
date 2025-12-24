import express from "express";
import sqlite3 from "sqlite3";
import bodyParser from "body-parser";
import jwt from "jsonwebtoken";

const router = express.Router();
const db = new sqlite3.Database("./db/showclinic.db");
router.use(bodyParser.json());

const SECRET = "showclinic_secret";

const authMiddleware = (req, res, next) => {
  const authHeader = req.headers["authorization"] || req.headers["Authorization"];
  if (!authHeader) {
    return res.status(401).json({ message: "Token no proporcionado" });
  }

  const [, token] = authHeader.split(" ");
  try {
    const decoded = jwt.verify(token, SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    console.error("❌ Token inválido en deudas:", err.message);
    return res.status(401).json({ message: "Token inválido" });
  }
};

const requireDoctor = (req, res, next) => {
  if (req.user?.role !== "doctor") {
    return res.status(403).json({ message: "Solo el rol doctor puede modificar deudas" });
  }
  next();
};

router.use(authMiddleware);

const dbAll = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });

const dbRun = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve(this);
    });
  });

const fechaLima = () =>
  new Date().toLocaleString("sv-SE", { timeZone: "America/Lima" }).replace("T", " ").slice(0, 19);

const dbGet = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });

const abonarDeuda = async ({ deudaIdNum, metodoStr, montoNum, fechaLocal }) => {
  const deuda = await dbGet(
    `
      SELECT d.*, tr.pagoMetodo AS metodo_inicial
      FROM deudas_tratamientos d
      LEFT JOIN tratamientos_realizados tr ON tr.id = d.tratamiento_realizado_id
      WHERE d.id = ?
    `,
    [deudaIdNum]
  );

  if (!deuda) {
    return { ok: false, status: 404, message: "Deuda no encontrada" };
  }

  if (String(deuda.estado || "").toLowerCase() !== "pendiente") {
    return { ok: false, status: 400, message: "La deuda ya está cancelada" };
  }

  const montoTotal = parseFloat(deuda.monto_total) || 0;
  if (!(montoTotal > 0)) {
    return { ok: false, status: 400, message: "Monto total inválido" };
  }

  const pagosAgg = await dbGet(
    `
      SELECT COUNT(*) AS cantidad, COALESCE(SUM(monto), 0) AS total
      FROM deudas_pagos
      WHERE deuda_id = ?
    `,
    [deudaIdNum]
  );

  let cantidadPagos = Number(pagosAgg?.cantidad || 0);
  let totalPagado = Number(pagosAgg?.total || 0);

  // Compatibilidad: si es una deuda vieja sin pagos registrados, creamos el pago #1 desde monto_adelanto.
  if (cantidadPagos === 0) {
    const adelantoLegacy = parseFloat(deuda.monto_adelanto) || 0;
    if (adelantoLegacy > 0) {
      const metodoInicial = deuda.metodo_inicial || "Desconocido";
      await dbRun(
        `INSERT INTO deudas_pagos (deuda_id, numero, monto, metodo, creado_en) VALUES (?, 1, ?, ?, ?)`,
        [deudaIdNum, adelantoLegacy, metodoInicial, deuda.creado_en || fechaLocal]
      );
      cantidadPagos = 1;
      totalPagado = adelantoLegacy;
    }
  }

  if (cantidadPagos >= 4) {
    return { ok: false, status: 400, message: "Solo se permiten hasta 4 pagos" };
  }

  const saldoActual = montoTotal - totalPagado;
  if (!(saldoActual > 0)) {
    return { ok: false, status: 400, message: "La deuda no tiene saldo pendiente" };
  }

  if (montoNum > saldoActual) {
    return { ok: false, status: 400, message: "El monto no puede ser mayor al saldo" };
  }

  const numeroPago = cantidadPagos + 1;
  await dbRun(
    `INSERT INTO deudas_pagos (deuda_id, numero, monto, metodo, creado_en) VALUES (?, ?, ?, ?, ?)`,
    [deudaIdNum, numeroPago, montoNum, metodoStr, fechaLocal]
  );

  const nuevoTotalPagado = totalPagado + montoNum;
  const nuevoSaldo = Math.max(0, montoTotal - nuevoTotalPagado);

  if (nuevoSaldo <= 0) {
    await dbRun(
      `
        UPDATE deudas_tratamientos
        SET estado = 'cancelada',
            monto_adelanto = ?,
            monto_saldo = 0,
            cancelado_en = ?,
            cancelado_monto = ?,
            cancelado_metodo = ?
        WHERE id = ?
      `,
      [nuevoTotalPagado, fechaLocal, montoNum, metodoStr, deudaIdNum]
    );

    return { ok: true, status: 200, message: "✅ Deuda cancelada", saldo: 0, pagos: numeroPago };
  }

  await dbRun(
    `
      UPDATE deudas_tratamientos
      SET monto_adelanto = ?,
          monto_saldo = ?
      WHERE id = ?
    `,
    [nuevoTotalPagado, nuevoSaldo, deudaIdNum]
  );

  return { ok: true, status: 200, message: "✅ Pago registrado", saldo: nuevoSaldo, pagos: numeroPago };
};

router.get("/listar", async (req, res) => {
  try {
    const { term, tratamientoId, fechaDesde, fechaHasta } = req.query;

    const where = ["d.estado = 'pendiente'", "p.id = d.paciente_id", "tr.id = d.tratamiento_realizado_id"];
    const params = [];

    const trimmed = typeof term === "string" ? term.trim() : "";
    if (trimmed) {
      const like = `%${trimmed}%`;
      where.push("(p.nombre LIKE ? OR p.apellido LIKE ? OR p.dni LIKE ?)");
      params.push(like, like, like);
    }

    const tratamientoIdNumRaw =
      tratamientoId !== undefined && tratamientoId !== null && String(tratamientoId).trim() !== ""
        ? Number(tratamientoId)
        : null;
    const tratamientoIdNum = Number.isFinite(tratamientoIdNumRaw) ? tratamientoIdNumRaw : null;
    if (tratamientoIdNum) {
      where.push("d.tratamiento_id = ?");
      params.push(tratamientoIdNum);
    }

    const fechaDesdeStr = typeof fechaDesde === "string" ? fechaDesde.trim() : "";
    const fechaHastaStr = typeof fechaHasta === "string" ? fechaHasta.trim() : "";
    const fechaDesdeSql = fechaDesdeStr ? `${fechaDesdeStr} 00:00:00` : "";
    const fechaHastaSql = fechaHastaStr ? `${fechaHastaStr} 23:59:59` : "";

    if (fechaDesdeSql) {
      where.push("tr.fecha >= ?");
      params.push(fechaDesdeSql);
    }

    if (fechaHastaSql) {
      where.push("tr.fecha <= ?");
      params.push(fechaHastaSql);
    }

    const rows = await dbAll(
      `
        SELECT
          d.*, 
          p.nombre AS paciente_nombre,
          p.apellido AS paciente_apellido,
          p.dni AS paciente_dni,
          t.nombre AS tratamiento_nombre,
          tr.fecha AS fecha_tratamiento
        FROM deudas_tratamientos d
        LEFT JOIN patients p ON p.id = d.paciente_id
        LEFT JOIN tratamientos t ON t.id = d.tratamiento_id
        LEFT JOIN tratamientos_realizados tr ON tr.id = d.tratamiento_realizado_id
        WHERE ${where.join(" AND ")}
        ORDER BY tr.fecha DESC, d.id DESC
      `,
      params
    );

    res.json(rows);
  } catch (err) {
    console.error("❌ Error al listar deudas:", err.message);
    res.status(500).json({ message: "Error al listar deudas" });
  }
});

router.get("/resumen/:pacienteId", async (req, res) => {
  try {
    const pacienteIdNum = Number(req.params.pacienteId);
    if (!Number.isFinite(pacienteIdNum) || pacienteIdNum <= 0) {
      return res.status(400).json({ message: "Paciente inválido" });
    }

    const rows = await dbAll(
      `
        SELECT
          COUNT(*) AS cantidad_pendiente,
          COALESCE(SUM(monto_saldo), 0) AS total_pendiente
        FROM deudas_tratamientos
        WHERE paciente_id = ? AND estado = 'pendiente'
      `,
      [pacienteIdNum]
    );

    const r = rows?.[0] || {};
    res.json({
      paciente_id: pacienteIdNum,
      cantidad_pendiente: Number(r.cantidad_pendiente || 0),
      total_pendiente: Number(r.total_pendiente || 0),
    });
  } catch (err) {
    console.error("❌ Error al obtener resumen de deuda:", err.message);
    res.status(500).json({ message: "Error al obtener resumen de deuda" });
  }
});

router.post("/:id/cancelar", requireDoctor, async (req, res) => {
  const { id } = req.params;
  const { metodo, monto } = req.body;

  const metodoStr = typeof metodo === "string" ? metodo.trim() : "";
  const montoNum = parseFloat(monto);

  if (!metodoStr) {
    return res.status(400).json({ message: "El método de pago es obligatorio" });
  }

  if (!(montoNum > 0)) {
    return res.status(400).json({ message: "El monto debe ser mayor a 0" });
  }

  const fechaLocal = fechaLima();

  try {
    const deudaIdNum = Number(id);
    if (!Number.isFinite(deudaIdNum) || deudaIdNum <= 0) {
      return res.status(400).json({ message: "Deuda inválida" });
    }

    const result = await abonarDeuda({ deudaIdNum, metodoStr, montoNum, fechaLocal });
    return res.status(result.status).json({ message: result.message, saldo: result.saldo });
  } catch (err) {
    console.error("❌ Error al cancelar deuda:", err.message);
    res.status(500).json({ message: "Error al cancelar deuda" });
  }
});

router.post("/:id/abonar", requireDoctor, async (req, res) => {
  const { id } = req.params;
  const { metodo, monto } = req.body;

  const metodoStr = typeof metodo === "string" ? metodo.trim() : "";
  const montoNum = parseFloat(monto);

  if (!metodoStr) {
    return res.status(400).json({ message: "El método de pago es obligatorio" });
  }

  if (!(montoNum > 0)) {
    return res.status(400).json({ message: "El monto debe ser mayor a 0" });
  }

  const deudaIdNum = Number(id);
  if (!Number.isFinite(deudaIdNum) || deudaIdNum <= 0) {
    return res.status(400).json({ message: "Deuda inválida" });
  }

  const fechaLocal = fechaLima();

  try {
    const result = await abonarDeuda({ deudaIdNum, metodoStr, montoNum, fechaLocal });
    return res.status(result.status).json({
      message: result.message,
      saldo: result.saldo,
      pagos: result.pagos,
    });
  } catch (err) {
    console.error("❌ Error al registrar abono:", err.message);
    res.status(500).json({ message: "Error al registrar abono" });
  }
});

export default router;
