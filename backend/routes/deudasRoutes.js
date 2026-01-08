import express from "express";
import db, { dbAll, dbRun, dbGet } from "../db/database.js";
import { authMiddleware, requireDoctor } from "../middleware/auth.js";

const router = express.Router();

router.use(authMiddleware);

const fechaLima = () =>
  new Date().toLocaleString("sv-SE", { timeZone: "America/Lima" }).replace("T", " ").slice(0, 19);

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

  // 💰 Registrar abono en finanzas
  const pacienteInfo = await dbGet(`SELECT nombre, apellido FROM patients WHERE id = ?`, [deuda.paciente_id]);
  const nombrePaciente = pacienteInfo ? `${pacienteInfo.nombre} ${pacienteInfo.apellido || ''}`.trim() : `Paciente #${deuda.paciente_id}`;
  const tratamientoInfo = await dbGet(`SELECT nombre FROM tratamientos WHERE id = ?`, [deuda.tratamiento_id]);
  const nombreTratamiento = tratamientoInfo?.nombre || 'Tratamiento';
  
  await dbRun(
    `INSERT INTO finanzas (tipo, categoria, monto, descripcion, fecha, metodo_pago, paciente_id, referencia_id, referencia_tipo, creado_en)
     VALUES ('ingreso', 'abono_deuda', ?, ?, ?, ?, ?, ?, 'deuda_tratamiento', ?)`,
    [
      montoNum,
      `Abono #${numeroPago} - ${nombreTratamiento} - ${nombrePaciente}`,
      fechaLocal.split(' ')[0],
      metodoStr || 'efectivo',
      deuda.paciente_id,
      deudaIdNum,
      fechaLocal
    ]
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
          tr.fecha AS fecha_tratamiento,
          'tratamiento' AS tipo_deuda
        FROM deudas_tratamientos d
        LEFT JOIN patients p ON p.id = d.paciente_id
        LEFT JOIN tratamientos t ON t.id = d.tratamiento_id
        LEFT JOIN tratamientos_realizados tr ON tr.id = d.tratamiento_realizado_id
        WHERE ${where.join(" AND ")}
        ORDER BY tr.fecha DESC, d.id DESC
      `,
      params
    );

    // Obtener saldos pendientes de presupuestos asignados
    const wherePresupuestos = [
      "pa.estado_pago = 'adelanto'",
      "pa.pagado = 0",
      "(pa.saldo_pendiente > 0 OR (pa.precio_total - COALESCE(pa.monto_pagado, 0)) > 0)"
    ];
    const paramsPresupuestos = [];

    if (fechaDesdeSql) {
      wherePresupuestos.push("pa.fecha_inicio >= ?");
      paramsPresupuestos.push(fechaDesdeSql);
    }
    if (fechaHastaSql) {
      wherePresupuestos.push("pa.fecha_inicio <= ?");
      paramsPresupuestos.push(fechaHastaSql);
    }

    const presupuestosPendientes = await dbAll(
      `
        SELECT
          pa.id,
          pa.paciente_id,
          p.nombre AS paciente_nombre,
          p.apellido AS paciente_apellido,
          p.dni AS paciente_dni,
          pa.tratamientos_json,
          pa.precio_total AS monto_total,
          pa.descuento,
          pa.monto_pagado AS monto_adelanto,
          pa.saldo_pendiente AS monto_saldo,
          pa.fecha_inicio AS fecha_tratamiento,
          pa.estado_pago,
          'presupuesto' AS tipo_deuda
        FROM presupuestos_asignados pa
        LEFT JOIN patients p ON p.id = pa.paciente_id
        WHERE ${wherePresupuestos.join(" AND ")}
      `,
      paramsPresupuestos
    );

    // Extraer nombre del tratamiento del JSON para presupuestos
    const presupuestosFormateados = presupuestosPendientes.map(p => {
      let tratamientoNombre = 'Presupuesto';
      try {
        const tratamientos = p.tratamientos_json ? JSON.parse(p.tratamientos_json) : [];
        if (tratamientos.length > 0) {
          tratamientoNombre = tratamientos.map(t => t.nombre).join(', ');
        }
      } catch (e) {}
      // Calcular saldo considerando el descuento
      const precioTotal = parseFloat(p.monto_total) || 0;
      const descuento = parseFloat(p.descuento) || 0;
      const montoPagado = parseFloat(p.monto_adelanto) || 0;
      const saldoCalculado = (precioTotal - descuento) - montoPagado;
      return {
        ...p,
        tratamiento_nombre: tratamientoNombre,
        monto_total: precioTotal - descuento, // Total con descuento
        monto_saldo: saldoCalculado > 0 ? saldoCalculado : 0,
        estado: 'pendiente'
      };
    });

    // Obtener saldos pendientes de paquetes asignados
    const wherePaquetes = [
      "pp.estado_pago = 'adelanto'",
      "pp.pagado = 0",
      "(pp.saldo_pendiente > 0 OR (pp.precio_total - COALESCE(pp.monto_pagado, 0)) > 0)"
    ];
    const paramsPaquetes = [];

    if (fechaDesdeSql) {
      wherePaquetes.push("pp.fecha_inicio >= ?");
      paramsPaquetes.push(fechaDesdeSql);
    }
    if (fechaHastaSql) {
      wherePaquetes.push("pp.fecha_inicio <= ?");
      paramsPaquetes.push(fechaHastaSql);
    }

    const paquetesPendientes = await dbAll(
      `
        SELECT
          pp.id,
          pp.paciente_id,
          p.nombre AS paciente_nombre,
          p.apellido AS paciente_apellido,
          p.dni AS paciente_dni,
          pp.paquete_nombre AS tratamiento_nombre,
          pp.precio_total AS monto_total,
          pp.monto_pagado AS monto_adelanto,
          pp.saldo_pendiente AS monto_saldo,
          pp.fecha_inicio AS fecha_tratamiento,
          pp.estado_pago,
          'paquete' AS tipo_deuda
        FROM paquetes_pacientes pp
        LEFT JOIN patients p ON p.id = pp.paciente_id
        WHERE ${wherePaquetes.join(" AND ")}
      `,
      paramsPaquetes
    );

    // Formatear paquetes
    const paquetesFormateados = paquetesPendientes.map(p => ({
      ...p,
      monto_saldo: p.monto_saldo || (p.monto_total - (p.monto_adelanto || 0)),
      estado: 'pendiente'
    }));

    // Combinar todas las deudas
    const todasDeudas = [...rows, ...presupuestosFormateados, ...paquetesFormateados];
    
    // Ordenar por fecha
    todasDeudas.sort((a, b) => new Date(b.fecha_tratamiento || 0) - new Date(a.fecha_tratamiento || 0));

    res.json(todasDeudas);
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

/* ==============================
   💰 ABONAR DEUDA DE PRESUPUESTO
============================== */
router.post("/presupuesto/:id/abonar", requireDoctor, async (req, res) => {
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

  const presupuestoId = Number(id);
  if (!Number.isFinite(presupuestoId) || presupuestoId <= 0) {
    return res.status(400).json({ message: "Presupuesto inválido" });
  }

  const fechaLocal = fechaLima();

  try {
    const presupuesto = await dbGet(
      `SELECT pa.*, p.nombre as paciente_nombre, p.apellido as paciente_apellido
       FROM presupuestos_asignados pa
       JOIN patients p ON pa.paciente_id = p.id
       WHERE pa.id = ?`,
      [presupuestoId]
    );

    if (!presupuesto) {
      return res.status(404).json({ message: "Presupuesto no encontrado" });
    }

    const precioTotal = parseFloat(presupuesto.precio_total) || 0;
    const montoYaPagado = parseFloat(presupuesto.monto_pagado) || 0;
    const saldoActual = precioTotal - montoYaPagado;

    if (saldoActual <= 0) {
      return res.status(400).json({ message: "El presupuesto no tiene saldo pendiente" });
    }

    if (montoNum > saldoActual) {
      return res.status(400).json({ message: "El monto no puede ser mayor al saldo" });
    }

    const nuevoMontoPagado = montoYaPagado + montoNum;
    const nuevoSaldo = precioTotal - nuevoMontoPagado;
    const estadoPago = nuevoSaldo <= 0 ? 'pagado' : 'adelanto';
    const pagadoFlag = nuevoSaldo <= 0 ? 1 : 0;

    // Actualizar presupuesto
    await dbRun(
      `UPDATE presupuestos_asignados 
       SET pagado = ?, monto_pagado = ?, saldo_pendiente = ?, 
           estado_pago = ?, fecha_pago = ?, metodo_pago = ?
       WHERE id = ?`,
      [pagadoFlag, nuevoMontoPagado, nuevoSaldo, estadoPago, fechaLocal, metodoStr, presupuestoId]
    );

    // Registrar en finanzas
    const nombrePaciente = `${presupuesto.paciente_nombre} ${presupuesto.paciente_apellido || ''}`.trim();
    let tratamientoNombre = 'Presupuesto';
    try {
      const tratamientos = presupuesto.tratamientos_json ? JSON.parse(presupuesto.tratamientos_json) : [];
      if (tratamientos.length > 0) {
        tratamientoNombre = tratamientos.map(t => t.nombre).join(', ');
      }
    } catch (e) {}

    await dbRun(
      `INSERT INTO finanzas (tipo, categoria, monto, descripcion, fecha, metodo_pago, paciente_id, referencia_id, referencia_tipo, creado_en)
       VALUES ('ingreso', 'presupuesto', ?, ?, ?, ?, ?, ?, 'presupuesto_asignado', ?)`,
      [
        montoNum,
        `Abono ${tratamientoNombre} - ${nombrePaciente}`,
        fechaLocal.split(' ')[0],
        metodoStr,
        presupuesto.paciente_id,
        presupuestoId,
        fechaLocal
      ]
    );

    res.json({
      message: nuevoSaldo <= 0 ? "✅ Presupuesto pagado completamente" : "✅ Abono registrado",
      saldo: nuevoSaldo
    });
  } catch (err) {
    console.error("❌ Error al abonar presupuesto:", err.message);
    res.status(500).json({ message: "Error al registrar abono" });
  }
});

/* ==============================
   💰 ABONAR DEUDA DE PAQUETE
============================== */
router.post("/paquete/:id/abonar", requireDoctor, async (req, res) => {
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

  const paqueteId = Number(id);
  if (!Number.isFinite(paqueteId) || paqueteId <= 0) {
    return res.status(400).json({ message: "Paquete inválido" });
  }

  const fechaLocal = fechaLima();

  try {
    const paquete = await dbGet(
      `SELECT pp.*, p.nombre as paciente_nombre, p.apellido as paciente_apellido
       FROM paquetes_pacientes pp
       JOIN patients p ON pp.paciente_id = p.id
       WHERE pp.id = ?`,
      [paqueteId]
    );

    if (!paquete) {
      return res.status(404).json({ message: "Paquete no encontrado" });
    }

    const precioTotal = parseFloat(paquete.precio_total) || 0;
    const montoYaPagado = parseFloat(paquete.monto_pagado) || 0;
    const saldoActual = precioTotal - montoYaPagado;

    if (saldoActual <= 0) {
      return res.status(400).json({ message: "El paquete no tiene saldo pendiente" });
    }

    if (montoNum > saldoActual) {
      return res.status(400).json({ message: "El monto no puede ser mayor al saldo" });
    }

    const nuevoMontoPagado = montoYaPagado + montoNum;
    const nuevoSaldo = precioTotal - nuevoMontoPagado;
    const estadoPago = nuevoSaldo <= 0 ? 'pagado' : 'adelanto';
    const pagadoFlag = nuevoSaldo <= 0 ? 1 : 0;

    // Actualizar paquete
    await dbRun(
      `UPDATE paquetes_pacientes 
       SET pagado = ?, monto_pagado = ?, saldo_pendiente = ?, 
           estado_pago = ?, fecha_pago = ?, metodo_pago = ?
       WHERE id = ?`,
      [pagadoFlag, nuevoMontoPagado, nuevoSaldo, estadoPago, fechaLocal, metodoStr, paqueteId]
    );

    // Registrar en finanzas
    const nombrePaciente = `${paquete.paciente_nombre} ${paquete.paciente_apellido || ''}`.trim();

    await dbRun(
      `INSERT INTO finanzas (tipo, categoria, monto, descripcion, fecha, metodo_pago, paciente_id, referencia_id, referencia_tipo, creado_en)
       VALUES ('ingreso', 'paquete', ?, ?, ?, ?, ?, ?, 'paquete_paciente', ?)`,
      [
        montoNum,
        `Abono paquete ${paquete.paquete_nombre} - ${nombrePaciente}`,
        fechaLocal.split(' ')[0],
        metodoStr,
        paquete.paciente_id,
        paqueteId,
        fechaLocal
      ]
    );

    res.json({
      message: nuevoSaldo <= 0 ? "✅ Paquete pagado completamente" : "✅ Abono registrado",
      saldo: nuevoSaldo
    });
  } catch (err) {
    console.error("❌ Error al abonar paquete:", err.message);
    res.status(500).json({ message: "Error al registrar abono" });
  }
});

export default router;
