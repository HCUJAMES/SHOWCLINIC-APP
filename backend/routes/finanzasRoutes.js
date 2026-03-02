import express from "express";
import db from "../db/database.js";
import { authMiddleware, requireRole } from "../middleware/auth.js";

const router = express.Router();

const normalizarMetodo = (metodo) => String(metodo || "").trim().toLowerCase();

const aplicarComisionPOS = (monto, metodo) => {
  const m = parseFloat(monto) || 0;
  if (!(m > 0)) return 0;
  const met = normalizarMetodo(metodo);
  if (met === "tarjeta") return m * 0.96;
  return m;
};

const calcularComisionPOS = (monto, metodo) => {
  const bruto = parseFloat(monto) || 0;
  if (!(bruto > 0)) return 0;
  const neto = aplicarComisionPOS(bruto, metodo);
  return Math.max(0, bruto - neto);
};

// 📊 OBTENER REPORTE FINANCIERO FILTRADO
router.get("/reporte", (req, res) => {
  const { fechaInicio, fechaFin, paciente, metodoPago } = req.query;

  let query = `
    SELECT 
      tr.id,
      p.nombre || ' ' || p.apellido AS paciente,
      t.nombre AS tratamiento,
      tr.fecha,
      tr.precio_total,
      tr.descuento,
      tr.pagoMetodo,
      d.estado AS deuda_estado,
      d.monto_adelanto,
      d.monto_saldo,
      d.cancelado_monto,
      d.cancelado_metodo,
      COALESCE(dp.total_pagado, 0) AS pagos_total_pagado,
      COALESCE(dp.cantidad_pagos, 0) AS pagos_cantidad,
      dpm.metodos AS pagos_metodos,
      dpm2.metodos_montos AS pagos_metodos_montos
    FROM tratamientos_realizados tr
    JOIN patients p ON p.id = tr.paciente_id
    JOIN tratamientos t ON t.id = tr.tratamiento_id
    LEFT JOIN deudas_tratamientos d ON d.tratamiento_realizado_id = tr.id
    LEFT JOIN (
      SELECT deuda_id, SUM(monto) AS total_pagado, COUNT(*) AS cantidad_pagos
      FROM deudas_pagos
      GROUP BY deuda_id
    ) dp ON dp.deuda_id = d.id
    LEFT JOIN (
      SELECT deuda_id, GROUP_CONCAT(metodo, '/') AS metodos
      FROM (
        SELECT deuda_id, metodo
        FROM deudas_pagos
        ORDER BY deuda_id, numero ASC
      )
      GROUP BY deuda_id
    ) dpm ON dpm.deuda_id = d.id
    LEFT JOIN (
      SELECT deuda_id, GROUP_CONCAT(metodo || ':' || monto_total, '|') AS metodos_montos
      FROM (
        SELECT deuda_id, metodo, SUM(monto) AS monto_total
        FROM deudas_pagos
        GROUP BY deuda_id, metodo
      )
      GROUP BY deuda_id
    ) dpm2 ON dpm2.deuda_id = d.id
    WHERE tr.precio_total > 0 
      AND tr.pagoMetodo IS NOT NULL 
      AND tr.pagoMetodo != '' 
      AND LOWER(tr.pagoMetodo) != 'desconocido'
  `;
  const params = [];

  // 🗓️ Filtros dinámicos (la fecha ya está en hora Lima, no necesita conversión)
  if (fechaInicio && fechaFin) {
    query += " AND DATE(tr.fecha) BETWEEN ? AND ?";
    params.push(fechaInicio, fechaFin);
  } else if (fechaInicio) {
    query += " AND DATE(tr.fecha) = ?";
    params.push(fechaInicio);
  }

  if (paciente) {
    query += " AND p.nombre || ' ' || p.apellido LIKE ?";
    params.push(`%${paciente}%`);
  }

  if (metodoPago) {
    query +=
      " AND (tr.pagoMetodo = ? OR d.cancelado_metodo = ? OR EXISTS (SELECT 1 FROM deudas_pagos x WHERE x.deuda_id = d.id AND x.metodo = ?))";
    params.push(metodoPago, metodoPago, metodoPago);
  }

  query += " ORDER BY tr.fecha DESC";

  db.all(query, params, (err, rows) => {
    if (err) {
      console.error("❌ Error al obtener reporte financiero:", err.message);
      return res.status(500).json({ message: "Error al obtener reporte financiero" });
    }

    const resultados = (rows || []).map((r) => {
      const precioTotal = parseFloat(r.precio_total) || 0;
      const saldo = parseFloat(r.monto_saldo) || 0;

      const pagosCantidad = parseInt(r.pagos_cantidad, 10) || 0;
      const pagosTotalPagado = parseFloat(r.pagos_total_pagado) || 0;
      const pagosMetodos = typeof r.pagos_metodos === "string" ? r.pagos_metodos : "";

      const tieneTablaPagos = pagosCantidad > 0;

      const metodoAdelantoLegacy = r.pagoMetodo || "Desconocido";
      const metodoCancelacionLegacy = r.cancelado_metodo || "";

      const tienePagoEnPartesLegacy = (parseFloat(r.monto_adelanto) || 0) > 0 && saldo > 0;

      const montoBruto = (() => {
        if (tieneTablaPagos) {
          const packed = String(r.pagos_metodos_montos || "");
          if (packed) {
            return packed
              .split("|")
              .map((s) => s.trim())
              .filter(Boolean)
              .reduce((acc, item) => {
                const [, montoStr] = item.split(":");
                const montoNum = parseFloat(montoStr);
                if (!(montoNum > 0)) return acc;
                return acc + montoNum;
              }, 0);
          }
          return pagosTotalPagado;
        }

        if (tienePagoEnPartesLegacy) {
          return (parseFloat(r.monto_adelanto) || 0) + (parseFloat(r.cancelado_monto) || 0);
        }

        return precioTotal;
      })();

      const montoCobrado = (() => {
        if (tieneTablaPagos) {
          const packed = String(r.pagos_metodos_montos || "");
          if (packed) {
            return packed
              .split("|")
              .map((s) => s.trim())
              .filter(Boolean)
              .reduce((acc, item) => {
                const [metodo, montoStr] = item.split(":");
                const metodoKey = (metodo || "").trim() || "Desconocido";
                const montoNum = parseFloat(montoStr);
                if (!(montoNum > 0)) return acc;
                return acc + aplicarComisionPOS(montoNum, metodoKey);
              }, 0);
          }

          // Fallback: no hay detalle por método, usamos el total (sin descuento porque no sabemos método).
          return pagosTotalPagado;
        }

        if (tienePagoEnPartesLegacy) {
          const adelanto = parseFloat(r.monto_adelanto) || 0;
          const canceladoMonto = parseFloat(r.cancelado_monto) || 0;
          return (
            aplicarComisionPOS(adelanto, metodoAdelantoLegacy) +
            aplicarComisionPOS(canceladoMonto, metodoCancelacionLegacy)
          );
        }

        return aplicarComisionPOS(precioTotal, metodoAdelantoLegacy);
      })();

      const comisionPOS = (() => {
        if (tieneTablaPagos) {
          const packed = String(r.pagos_metodos_montos || "");
          if (packed) {
            return packed
              .split("|")
              .map((s) => s.trim())
              .filter(Boolean)
              .reduce((acc, item) => {
                const [metodo, montoStr] = item.split(":");
                const metodoKey = (metodo || "").trim() || "Desconocido";
                const montoNum = parseFloat(montoStr);
                if (!(montoNum > 0)) return acc;
                return acc + calcularComisionPOS(montoNum, metodoKey);
              }, 0);
          }
          // Sin detalle: no se puede inferir comisión por método.
          return 0;
        }

        if (tienePagoEnPartesLegacy) {
          const adelanto = parseFloat(r.monto_adelanto) || 0;
          const canceladoMonto = parseFloat(r.cancelado_monto) || 0;
          return (
            calcularComisionPOS(adelanto, metodoAdelantoLegacy) +
            calcularComisionPOS(canceladoMonto, metodoCancelacionLegacy)
          );
        }

        return calcularComisionPOS(precioTotal, metodoAdelantoLegacy);
      })();

      const deudaPendiente =
        String(r.deuda_estado || "").toLowerCase() === "pendiente" ? saldo : 0;

      const pagoMetodoMostrado = tieneTablaPagos
        ? pagosMetodos || metodoAdelantoLegacy
        : tienePagoEnPartesLegacy
          ? (parseFloat(r.cancelado_monto) || 0) > 0 && metodoCancelacionLegacy && metodoCancelacionLegacy !== metodoAdelantoLegacy
            ? `${metodoAdelantoLegacy}/${metodoCancelacionLegacy}`
            : metodoAdelantoLegacy
          : metodoAdelantoLegacy;

      // Determinar estado de pago
      const estadoPago = (() => {
        // Si tiene tabla de pagos, comparar total pagado vs precio total
        if (tieneTablaPagos) {
          const totalPagado = pagosTotalPagado || 0;
          const precioConDescuento = precioTotal - (parseFloat(r.descuento) || 0);
          // Si lo pagado es menor que el precio (con un margen de 0.01 para errores de redondeo)
          if (totalPagado < precioConDescuento - 0.01) {
            return "Deuda";
          }
          return "Pagado";
        }
        
        // Si tiene deuda_estado explícito
        if (String(r.deuda_estado || "").toLowerCase() === "pendiente") {
          return "Deuda";
        }
        
        // Si tiene pago en partes legacy y hay saldo pendiente
        if (tienePagoEnPartesLegacy && saldo > 0) {
          return "Deuda";
        }
        
        // Si no tiene ningún pago registrado pero tiene precio, es deuda
        if (!tieneTablaPagos && !tienePagoEnPartesLegacy && precioTotal > 0) {
          const adelanto = parseFloat(r.monto_adelanto) || 0;
          const cancelado = parseFloat(r.cancelado_monto) || 0;
          const totalPagadoLegacy = adelanto + cancelado;
          const precioConDescuento = precioTotal - (parseFloat(r.descuento) || 0);
          
          if (totalPagadoLegacy < precioConDescuento - 0.01) {
            return "Deuda";
          }
        }
        
        return "Pagado";
      })();

      return {
        ...r,
        monto_bruto: montoBruto,
        comision_pos: comisionPOS,
        monto_cobrado: montoCobrado,
        deuda_pendiente: deudaPendiente,
        pagoMetodo_mostrado: pagoMetodoMostrado,
        estado_pago: estadoPago,
      };
    });

    // Calcular totales SOLO con lo cobrado (la deuda pendiente NO suma)
    const totalGeneral = resultados.reduce((acc, r) => acc + (r.monto_cobrado || 0), 0);

    const totalBruto = resultados.reduce((acc, r) => acc + (r.monto_bruto || 0), 0);
    const totalComision = resultados.reduce((acc, r) => acc + (r.comision_pos || 0), 0);

    const totalesPorMetodo = resultados.reduce((acc, r) => {
      const precioTotal = parseFloat(r.precio_total) || 0;
      const saldo = parseFloat(r.monto_saldo) || 0;

      const pagosCantidad = parseInt(r.pagos_cantidad, 10) || 0;

      if (pagosCantidad > 0) {
        const packed = String(r.pagos_metodos_montos || "");
        if (packed) {
          packed
            .split("|")
            .map((s) => s.trim())
            .filter(Boolean)
            .forEach((item) => {
              const [metodo, montoStr] = item.split(":");
              const metodoKey = (metodo || "").trim() || "Desconocido";
              const montoNum = parseFloat(montoStr);
              if (!(montoNum > 0)) return;
              if (!acc[metodoKey]) acc[metodoKey] = 0;
              acc[metodoKey] += aplicarComisionPOS(montoNum, metodoKey);
            });
          return acc;
        }

        // Fallback (debería ser raro): si no hay detalle, sumar al primer método.
        const metodos = String(r.pagos_metodos || "").split("/").filter(Boolean);
        const metodoFallback = metodos[0] || r.pagoMetodo || "Desconocido";
        if (!acc[metodoFallback]) acc[metodoFallback] = 0;
        acc[metodoFallback] += parseFloat(r.monto_cobrado) || 0;
        return acc;
      }

      const adelanto = parseFloat(r.monto_adelanto) || 0;
      const canceladoMonto = parseFloat(r.cancelado_monto) || 0;
      const tienePagoEnPartes = adelanto > 0 && saldo > 0;

      if (!tienePagoEnPartes) {
        const metodo = r.pagoMetodo || "Desconocido";
        if (!acc[metodo]) acc[metodo] = 0;
        acc[metodo] += aplicarComisionPOS(precioTotal, metodo);
        return acc;
      }

      const metodoAdelanto = r.pagoMetodo || "Desconocido";
      if (!acc[metodoAdelanto]) acc[metodoAdelanto] = 0;
      acc[metodoAdelanto] += aplicarComisionPOS(adelanto, metodoAdelanto);

      if (canceladoMonto > 0) {
        const metodoCancelacion = r.cancelado_metodo || "Desconocido";
        if (!acc[metodoCancelacion]) acc[metodoCancelacion] = 0;
        acc[metodoCancelacion] += aplicarComisionPOS(canceladoMonto, metodoCancelacion);
      }

      return acc;
    }, {});

    // Obtener pagos de la tabla finanzas (incluye adelantos de presupuestos, paquetes y consultas)
    let queryFinanzas = `
      SELECT 
        f.id,
        p.nombre || ' ' || p.apellido AS paciente,
        f.descripcion AS tratamiento,
        f.fecha,
        f.monto AS precio_total,
        0 AS descuento,
        f.metodo_pago AS pagoMetodo,
        f.categoria AS tipo_registro,
        f.referencia_tipo,
        f.referencia_id,
        pa.precio_total AS presupuesto_precio_total,
        pa.descuento AS presupuesto_descuento,
        pa.monto_pagado AS presupuesto_monto_pagado,
        pa.saldo_pendiente AS presupuesto_saldo,
        pa.estado_pago AS presupuesto_estado_pago,
        pp.precio_total AS paquete_precio_total,
        pp.monto_pagado AS paquete_monto_pagado,
        pp.saldo_pendiente AS paquete_saldo,
        pp.estado_pago AS paquete_estado_pago
      FROM finanzas f
      LEFT JOIN patients p ON p.id = f.paciente_id
      LEFT JOIN presupuestos_asignados pa ON f.referencia_tipo = 'presupuesto_asignado' AND pa.id = f.referencia_id
      LEFT JOIN paquetes_pacientes pp ON f.referencia_tipo = 'paquete_paciente' AND pp.id = f.referencia_id
      WHERE f.tipo = 'ingreso'
        AND f.categoria IN ('presupuesto', 'paquete', 'abono_deuda', 'consulta')
    `;
    const paramsFinanzas = [];

    if (fechaInicio && fechaFin) {
      queryFinanzas += " AND DATE(f.fecha) BETWEEN ? AND ?";
      paramsFinanzas.push(fechaInicio, fechaFin);
    } else if (fechaInicio) {
      queryFinanzas += " AND DATE(f.fecha) = ?";
      paramsFinanzas.push(fechaInicio);
    }

    if (paciente) {
      queryFinanzas += " AND p.nombre || ' ' || p.apellido LIKE ?";
      paramsFinanzas.push(`%${paciente}%`);
    }

    if (metodoPago) {
      queryFinanzas += " AND f.metodo_pago = ?";
      paramsFinanzas.push(metodoPago);
    }

    queryFinanzas += " ORDER BY f.creado_en DESC";

    db.all(queryFinanzas, paramsFinanzas, (errFin, rowsFinanzas) => {
      if (errFin) {
        console.error("❌ Error al obtener finanzas:", errFin.message);
      }
      console.log("📋 Registros de finanzas encontrados:", rowsFinanzas?.length || 0);
      console.log("📋 Tratamientos encontrados:", resultados?.length || 0);
      
      const pagosFinanzas = (rowsFinanzas || []).map((r) => {
        const monto = parseFloat(r.precio_total) || 0;
        const metodo = r.pagoMetodo || "efectivo";
        
        // Capitalizar método de pago
        const metodoCapitalizado = metodo.charAt(0).toUpperCase() + metodo.slice(1).toLowerCase();
        
        // Determinar estado de pago y deuda pendiente real
        let estadoPago = "Pagado";
        let deudaPendiente = 0;
        
        if (r.referencia_tipo === 'presupuesto_asignado') {
          const saldo = parseFloat(r.presupuesto_saldo) || 0;
          const estPago = r.presupuesto_estado_pago || '';
          if (estPago === 'adelanto' || estPago === 'pendiente_pago' || saldo > 0.01) {
            estadoPago = "Deuda";
            deudaPendiente = saldo > 0 ? saldo : 0;
          }
        } else if (r.referencia_tipo === 'paquete_paciente') {
          const saldo = parseFloat(r.paquete_saldo) || 0;
          const estPago = r.paquete_estado_pago || '';
          if (estPago === 'adelanto' || estPago === 'pendiente_pago' || saldo > 0.01) {
            estadoPago = "Deuda";
            deudaPendiente = saldo > 0 ? saldo : 0;
          }
        }
        
        return {
          ...r,
          tratamiento: r.tratamiento || 'Pago',
          monto_bruto: monto,
          comision_pos: calcularComisionPOS(monto, metodoCapitalizado),
          monto_cobrado: aplicarComisionPOS(monto, metodoCapitalizado),
          deuda_pendiente: deudaPendiente,
          pagoMetodo: metodoCapitalizado,
          pagoMetodo_mostrado: metodoCapitalizado,
          tipo_registro: r.tipo_registro || 'otro',
          estado_pago: estadoPago
        };
      });

      // Combinar resultados
      const todosResultados = [...resultados.map(r => ({...r, tipo_registro: 'tratamiento'})), ...pagosFinanzas];
      
      // Ordenar por fecha descendente (más reciente primero)
      todosResultados.sort((a, b) => {
        const fechaA = new Date(a.fecha || a.creado_en || 0);
        const fechaB = new Date(b.fecha || b.creado_en || 0);
        return fechaB - fechaA;
      });

      // Recalcular totales incluyendo pagos de finanzas
      const totalGeneralFinal = todosResultados.reduce((acc, r) => acc + (r.monto_cobrado || 0), 0);
      const totalBrutoFinal = todosResultados.reduce((acc, r) => acc + (r.monto_bruto || 0), 0);
      const totalComisionFinal = todosResultados.reduce((acc, r) => acc + (r.comision_pos || 0), 0);

      // Agregar pagos de finanzas a totales por método
      pagosFinanzas.forEach((r) => {
        let metodo = r.pagoMetodo || "efectivo";
        metodo = metodo.charAt(0).toUpperCase() + metodo.slice(1).toLowerCase();
        const monto = parseFloat(r.precio_total) || 0;
        if (!totalesPorMetodo[metodo]) totalesPorMetodo[metodo] = 0;
        totalesPorMetodo[metodo] += aplicarComisionPOS(monto, metodo);
      });

      res.json({
        resultados: todosResultados,
        totalGeneral: totalGeneralFinal,
        totalBruto: totalBrutoFinal,
        totalComision: totalComisionFinal,
        totalesPorMetodo,
      });
    });
  });
});

// 💰 MARCAR COMO PAGADO — registra pago en deuda o actualiza tratamiento
router.post("/pagar", (req, res) => {
  const { tratamiento_realizado_id, finanza_id, monto, metodo_pago, tipo_registro } = req.body;

  if (!monto || !metodo_pago) {
    return res.status(400).json({ message: "Monto y método de pago son obligatorios" });
  }

  const montoNum = parseFloat(monto);
  if (isNaN(montoNum) || montoNum <= 0) {
    return res.status(400).json({ message: "Monto inválido" });
  }

  // Si es un tratamiento realizado con deuda
  if (tratamiento_realizado_id && tipo_registro === "tratamiento") {
    // Buscar si tiene deuda en deudas_tratamientos
    db.get(
      `SELECT * FROM deudas_tratamientos WHERE tratamiento_realizado_id = ? AND estado = 'pendiente'`,
      [tratamiento_realizado_id],
      (err, deuda) => {
        if (err) {
          console.error("❌ Error buscando deuda:", err.message);
          return res.status(500).json({ message: "Error al buscar deuda" });
        }

        if (deuda) {
          // Registrar pago en deudas_pagos
          const numPago = (deuda.pagos_cantidad || 0) + 1;
          db.run(
            `INSERT INTO deudas_pagos (deuda_id, numero, monto, metodo) VALUES (?, ?, ?, ?)`,
            [deuda.id, numPago, montoNum, metodo_pago],
            function (errPago) {
              if (errPago) {
                console.error("❌ Error registrando pago:", errPago.message);
                return res.status(500).json({ message: "Error al registrar pago" });
              }

              // Verificar si la deuda se saldó completamente
              db.get(
                `SELECT COALESCE(SUM(monto), 0) AS total_pagado FROM deudas_pagos WHERE deuda_id = ?`,
                [deuda.id],
                (errSum, sumRow) => {
                  if (errSum) {
                    console.error("❌ Error sumando pagos:", errSum.message);
                    return res.status(500).json({ message: "Error al verificar pagos" });
                  }

                  const totalPagado = sumRow?.total_pagado || 0;
                  const montoTotal = parseFloat(deuda.monto_total) || 0;

                  if (totalPagado >= montoTotal - 0.01) {
                    // Marcar deuda como pagada
                    db.run(
                      `UPDATE deudas_tratamientos SET estado = 'pagado', cancelado_en = datetime('now'), cancelado_monto = ?, cancelado_metodo = ? WHERE id = ?`,
                      [montoNum, metodo_pago, deuda.id],
                      (errUpd) => {
                        if (errUpd) console.error("❌ Error actualizando deuda:", errUpd.message);
                        res.json({ message: "✅ Pago registrado y deuda saldada", saldada: true });
                      }
                    );
                  } else {
                    // Actualizar saldo pendiente
                    const nuevoSaldo = Math.max(0, montoTotal - totalPagado);
                    db.run(
                      `UPDATE deudas_tratamientos SET monto_saldo = ? WHERE id = ?`,
                      [nuevoSaldo, deuda.id],
                      (errUpd) => {
                        if (errUpd) console.error("❌ Error actualizando saldo:", errUpd.message);
                        res.json({ message: "✅ Pago parcial registrado", saldada: false, saldo_pendiente: nuevoSaldo });
                      }
                    );
                  }
                }
              );
            }
          );
        } else {
          // No tiene deuda registrada, crear registro en finanzas como pago directo
          const fechaAhora = new Date().toISOString().slice(0, 19).replace("T", " ");
          db.get(`SELECT paciente_id FROM tratamientos_realizados WHERE id = ?`, [tratamiento_realizado_id], (errTr, tr) => {
            if (errTr || !tr) {
              return res.status(404).json({ message: "Tratamiento no encontrado" });
            }
            db.run(
              `INSERT INTO finanzas (tipo, categoria, monto, descripcion, fecha, metodo_pago, paciente_id, referencia_id, referencia_tipo)
               VALUES ('ingreso', 'abono_deuda', ?, 'Pago de tratamiento', ?, ?, ?, ?, 'tratamiento_realizado')`,
              [montoNum, fechaAhora, metodo_pago, tr.paciente_id, tratamiento_realizado_id],
              function (errIns) {
                if (errIns) {
                  console.error("❌ Error insertando finanza:", errIns.message);
                  return res.status(500).json({ message: "Error al registrar pago" });
                }
                res.json({ message: "✅ Pago registrado en finanzas", saldada: true });
              }
            );
          });
        }
      }
    );
    return;
  }

  // Si es un registro de finanzas (presupuesto, paquete, etc.)
  if (finanza_id) {
    const fechaAhora = new Date().toISOString().slice(0, 19).replace("T", " ");
    db.run(
      `INSERT INTO finanzas (tipo, categoria, monto, descripcion, fecha, metodo_pago, paciente_id, referencia_id, referencia_tipo)
       VALUES ('ingreso', 'abono_deuda', ?, 'Pago adicional', ?, ?, (SELECT paciente_id FROM finanzas WHERE id = ?), ?, 'finanza')`,
      [montoNum, fechaAhora, metodo_pago, finanza_id, finanza_id],
      function (errIns) {
        if (errIns) {
          console.error("❌ Error insertando pago finanza:", errIns.message);
          return res.status(500).json({ message: "Error al registrar pago" });
        }
        res.json({ message: "✅ Pago registrado", saldada: true });
      }
    );
    return;
  }

  res.status(400).json({ message: "Datos insuficientes para registrar pago" });
});

// � REGISTRAR PAGO DE CONSULTA DIRECTO (sin paquete/presupuesto)
router.post("/consulta-directa", (req, res) => {
  const { paciente_id, monto, metodo_pago } = req.body;

  if (!paciente_id || !monto || !metodo_pago) {
    return res.status(400).json({ message: "Paciente, monto y método de pago son obligatorios" });
  }

  const montoNum = parseFloat(monto);
  if (isNaN(montoNum) || montoNum <= 0) {
    return res.status(400).json({ message: "Monto inválido" });
  }

  const fechaAhora = new Date().toISOString().slice(0, 19).replace("T", " ");

  db.run(
    `INSERT INTO finanzas (tipo, categoria, monto, descripcion, fecha, metodo_pago, paciente_id, referencia_tipo)
     VALUES ('ingreso', 'consulta', ?, 'Pago de consulta', ?, ?, ?, 'consulta_directa')`,
    [montoNum, fechaAhora, metodo_pago, paciente_id],
    function (err) {
      if (err) {
        console.error("❌ Error registrando consulta directa:", err.message);
        return res.status(500).json({ message: "Error al registrar pago de consulta" });
      }
      res.json({ message: "✅ Pago de consulta registrado", id: this.lastID });
    }
  );
});

// 🗑️ ELIMINAR REGISTRO DE FINANZAS
router.delete("/registro/:tipo/:id", (req, res) => {
  const { tipo, id } = req.params;

  if (tipo === "tratamiento") {
    // Eliminar tratamiento realizado, sus deudas asociadas Y los registros de finanzas relacionados
    db.get(`SELECT id FROM deudas_tratamientos WHERE tratamiento_realizado_id = ?`, [id], (err, deuda) => {
      if (err) {
        console.error("❌ Error buscando deuda:", err.message);
        return res.status(500).json({ message: "Error al buscar deuda" });
      }

      db.serialize(() => {
        db.run("BEGIN TRANSACTION");

        // 1) Eliminar registros de finanzas que referencian este tratamiento realizado
        db.run(
          `DELETE FROM finanzas WHERE referencia_id = ? AND referencia_tipo = 'tratamiento_realizado'`,
          [id]
        );

        if (deuda) {
          // 2) Eliminar registros de finanzas que referencian esta deuda
          db.run(
            `DELETE FROM finanzas WHERE referencia_id = ? AND referencia_tipo = 'deuda_tratamiento'`,
            [deuda.id]
          );
          // 3) Eliminar pagos de la deuda y la deuda misma
          db.run(`DELETE FROM deudas_pagos WHERE deuda_id = ?`, [deuda.id]);
          db.run(`DELETE FROM deudas_tratamientos WHERE id = ?`, [deuda.id]);
        }

        // 4) Eliminar el tratamiento realizado
        db.run(`DELETE FROM tratamientos_realizados WHERE id = ?`, [id], function (errDel) {
          if (errDel) {
            db.run("ROLLBACK");
            console.error("❌ Error eliminando tratamiento:", errDel.message);
            return res.status(500).json({ message: "Error al eliminar registro" });
          }
          db.run("COMMIT");
          res.json({ message: "✅ Registro eliminado" });
        });
      });
    });
  } else if (tipo === "finanza") {
    // Obtener datos del registro antes de borrarlo para recalcular saldos
    db.get(`SELECT * FROM finanzas WHERE id = ?`, [id], (errGet, finanza) => {
      if (errGet) {
        console.error("❌ Error buscando finanza:", errGet.message);
        return res.status(500).json({ message: "Error al buscar registro" });
      }
      if (!finanza) {
        return res.status(404).json({ message: "Registro no encontrado" });
      }

      const montoEliminado = parseFloat(finanza.monto) || 0;
      const refTipo = finanza.referencia_tipo;
      const refId = finanza.referencia_id;

      db.serialize(() => {
        db.run("BEGIN TRANSACTION");

        // Eliminar sub-registros que referencian esta finanza (pagos adicionales)
        db.run(
          `DELETE FROM finanzas WHERE referencia_id = ? AND referencia_tipo = 'finanza'`,
          [id]
        );

        // Eliminar el registro principal
        db.run(`DELETE FROM finanzas WHERE id = ?`, [id]);

        // Recalcular saldos en presupuestos/paquetes si aplica
        if (refTipo === "presupuesto_asignado" && refId) {
          db.run(
            `UPDATE presupuestos_asignados 
             SET monto_pagado = MAX(0, COALESCE(monto_pagado, 0) - ?),
                 monto_adelanto = MAX(0, COALESCE(monto_adelanto, 0) - ?),
                 saldo_pendiente = COALESCE(saldo_pendiente, 0) + ?,
                 pagado = CASE WHEN (COALESCE(monto_pagado, 0) - ?) <= 0 THEN 0 ELSE pagado END,
                 estado_pago = CASE 
                   WHEN (COALESCE(monto_pagado, 0) - ?) <= 0 THEN 'pendiente_pago'
                   WHEN (COALESCE(monto_pagado, 0) - ?) < (precio_total - COALESCE(descuento, 0)) THEN 'adelanto'
                   ELSE estado_pago
                 END
             WHERE id = ?`,
            [montoEliminado, montoEliminado, montoEliminado, montoEliminado, montoEliminado, montoEliminado, refId]
          );
        } else if (refTipo === "paquete_paciente" && refId) {
          db.run(
            `UPDATE paquetes_pacientes 
             SET monto_pagado = MAX(0, COALESCE(monto_pagado, 0) - ?),
                 monto_adelanto = MAX(0, COALESCE(monto_adelanto, 0) - ?),
                 saldo_pendiente = COALESCE(saldo_pendiente, 0) + ?,
                 pagado = CASE WHEN (COALESCE(monto_pagado, 0) - ?) <= 0 THEN 0 ELSE pagado END,
                 estado_pago = CASE 
                   WHEN (COALESCE(monto_pagado, 0) - ?) <= 0 THEN 'pendiente_pago'
                   WHEN (COALESCE(monto_pagado, 0) - ?) < precio_total THEN 'adelanto'
                   ELSE estado_pago
                 END
             WHERE id = ?`,
            [montoEliminado, montoEliminado, montoEliminado, montoEliminado, montoEliminado, montoEliminado, refId]
          );
        } else if (refTipo === "deuda_tratamiento" && refId) {
          // Recalcular saldo de la deuda
          db.run(
            `UPDATE deudas_tratamientos 
             SET monto_adelanto = MAX(0, COALESCE(monto_adelanto, 0) - ?),
                 monto_saldo = COALESCE(monto_saldo, 0) + ?,
                 estado = CASE WHEN (COALESCE(monto_adelanto, 0) - ?) < monto_total THEN 'pendiente' ELSE estado END
             WHERE id = ?`,
            [montoEliminado, montoEliminado, montoEliminado, refId]
          );
        }

        db.run("COMMIT", (commitErr) => {
          if (commitErr) {
            db.run("ROLLBACK");
            console.error("❌ Error eliminando finanza:", commitErr.message);
            return res.status(500).json({ message: "Error al eliminar registro" });
          }
          res.json({ message: "✅ Registro eliminado" });
        });
      });
    });
  } else {
    res.status(400).json({ message: "Tipo de registro no válido" });
  }
});

// ✏️ EDITAR MÉTODO DE PAGO DE UN REGISTRO
router.put("/editar-metodo-pago", authMiddleware, requireRole("master"), (req, res) => {
  const { id, tipo_registro, nuevo_metodo } = req.body;

  if (!id || !nuevo_metodo) {
    return res.status(400).json({ message: "ID y nuevo método de pago son obligatorios" });
  }

  const metodosValidos = ["Efectivo", "Tarjeta", "Transferencia", "Yape", "Plin"];
  if (!metodosValidos.includes(nuevo_metodo)) {
    return res.status(400).json({ message: "Método de pago no válido" });
  }

  if (tipo_registro === "tratamiento") {
    // Actualizar pagoMetodo en tratamientos_realizados
    db.run(
      `UPDATE tratamientos_realizados SET pagoMetodo = ? WHERE id = ?`,
      [nuevo_metodo, id],
      function (err) {
        if (err) {
          console.error("❌ Error actualizando método de pago en tratamiento:", err.message);
          return res.status(500).json({ message: "Error al actualizar método de pago" });
        }
        if (this.changes === 0) {
          return res.status(404).json({ message: "Tratamiento no encontrado" });
        }

        // También actualizar en deudas_pagos si tiene pagos asociados
        db.get(
          `SELECT id FROM deudas_tratamientos WHERE tratamiento_realizado_id = ?`,
          [id],
          (errDeuda, deuda) => {
            if (errDeuda) {
              console.error("❌ Error buscando deuda:", errDeuda.message);
            }

            if (deuda) {
              // Actualizar todos los pagos de esta deuda al nuevo método
              db.run(
                `UPDATE deudas_pagos SET metodo = ? WHERE deuda_id = ?`,
                [nuevo_metodo, deuda.id],
                (errPagos) => {
                  if (errPagos) {
                    console.error("❌ Error actualizando métodos en deudas_pagos:", errPagos.message);
                  }
                }
              );

              // Actualizar cancelado_metodo si existe
              db.run(
                `UPDATE deudas_tratamientos SET cancelado_metodo = ? WHERE id = ? AND cancelado_metodo IS NOT NULL`,
                [nuevo_metodo, deuda.id],
                (errCancel) => {
                  if (errCancel) {
                    console.error("❌ Error actualizando cancelado_metodo:", errCancel.message);
                  }
                }
              );
            }

            // Actualizar registros de finanzas relacionados a este tratamiento
            db.run(
              `UPDATE finanzas SET metodo_pago = ? WHERE referencia_id = ? AND referencia_tipo = 'tratamiento_realizado'`,
              [nuevo_metodo, id],
              (errFin) => {
                if (errFin) {
                  console.error("❌ Error actualizando finanzas:", errFin.message);
                }
              }
            );

            // También actualizar finanzas relacionadas a la deuda
            if (deuda) {
              db.run(
                `UPDATE finanzas SET metodo_pago = ? WHERE referencia_id = ? AND referencia_tipo = 'deuda_tratamiento'`,
                [nuevo_metodo, deuda.id],
                (errFinDeuda) => {
                  if (errFinDeuda) {
                    console.error("❌ Error actualizando finanzas de deuda:", errFinDeuda.message);
                  }
                }
              );
            }

            res.json({ message: "✅ Método de pago actualizado correctamente" });
          }
        );
      }
    );
  } else {
    // Registro de finanzas (presupuesto, paquete, consulta, abono_deuda, etc.)
    db.run(
      `UPDATE finanzas SET metodo_pago = ? WHERE id = ?`,
      [nuevo_metodo, id],
      function (err) {
        if (err) {
          console.error("❌ Error actualizando método de pago en finanzas:", err.message);
          return res.status(500).json({ message: "Error al actualizar método de pago" });
        }
        if (this.changes === 0) {
          return res.status(404).json({ message: "Registro no encontrado" });
        }
        res.json({ message: "✅ Método de pago actualizado correctamente" });
      }
    );
  }
});

// ✏️ EDITAR MONTO PAGADO DE UN REGISTRO
router.put("/editar-monto-pago", authMiddleware, requireRole("master"), (req, res) => {
  const { id, tipo_registro, nuevo_monto } = req.body;

  if (!id || nuevo_monto === undefined || nuevo_monto === null) {
    return res.status(400).json({ message: "ID y nuevo monto son obligatorios" });
  }

  const monto = parseFloat(nuevo_monto);
  if (isNaN(monto) || monto < 0) {
    return res.status(400).json({ message: "Monto inválido" });
  }

  if (tipo_registro === "tratamiento") {
    // 1) Obtener datos del tratamiento actual
    db.get(
      `SELECT tr.*, d.id as deuda_id, d.monto_total as deuda_monto_total, d.monto_adelanto as deuda_adelanto, d.monto_saldo as deuda_saldo, d.estado as deuda_estado
       FROM tratamientos_realizados tr
       LEFT JOIN deudas_tratamientos d ON d.tratamiento_realizado_id = tr.id
       WHERE tr.id = ?`,
      [id],
      (err, trat) => {
        if (err) {
          console.error("❌ Error obteniendo tratamiento:", err.message);
          return res.status(500).json({ message: "Error al obtener tratamiento" });
        }
        if (!trat) {
          return res.status(404).json({ message: "Tratamiento no encontrado" });
        }

        const montoAnterior = parseFloat(trat.precio_total) || 0;
        const descuento = parseFloat(trat.descuento) || 0;

        // Actualizar precio_total en tratamientos_realizados
        db.run(
          `UPDATE tratamientos_realizados SET precio_total = ? WHERE id = ?`,
          [monto, id],
          function (errUpd) {
            if (errUpd) {
              console.error("❌ Error actualizando monto en tratamiento:", errUpd.message);
              return res.status(500).json({ message: "Error al actualizar monto" });
            }

            // Si tiene deuda asociada, recalcular
            if (trat.deuda_id) {
              const precioConDescuento = monto - (monto * descuento / 100);
              const adelanto = parseFloat(trat.deuda_adelanto) || 0;
              const nuevoSaldo = Math.max(0, precioConDescuento - adelanto);
              const nuevoEstado = nuevoSaldo <= 0.01 ? 'pagado' : 'pendiente';

              db.run(
                `UPDATE deudas_tratamientos SET monto_total = ?, monto_saldo = ?, estado = ? WHERE id = ?`,
                [precioConDescuento, nuevoSaldo, nuevoEstado, trat.deuda_id],
                (errDeuda) => {
                  if (errDeuda) {
                    console.error("❌ Error actualizando deuda:", errDeuda.message);
                  }
                }
              );
            }

            // Actualizar monto en finanzas relacionadas al tratamiento
            db.run(
              `UPDATE finanzas SET monto = ? WHERE referencia_id = ? AND referencia_tipo = 'tratamiento_realizado'`,
              [monto, id],
              (errFin) => {
                if (errFin) {
                  console.error("❌ Error actualizando finanzas:", errFin.message);
                }
              }
            );

            res.json({ message: "✅ Monto actualizado correctamente" });
          }
        );
      }
    );
  } else {
    // Registro de finanzas (presupuesto, paquete, consulta, abono_deuda, etc.)
    // 1) Obtener el registro de finanzas actual
    db.get(
      `SELECT * FROM finanzas WHERE id = ?`,
      [id],
      (err, finanza) => {
        if (err) {
          console.error("❌ Error obteniendo finanza:", err.message);
          return res.status(500).json({ message: "Error al obtener registro" });
        }
        if (!finanza) {
          return res.status(404).json({ message: "Registro no encontrado" });
        }

        const montoAnterior = parseFloat(finanza.monto) || 0;
        const diferencia = monto - montoAnterior;

        // Actualizar monto en finanzas
        db.run(
          `UPDATE finanzas SET monto = ? WHERE id = ?`,
          [monto, id],
          function (errUpd) {
            if (errUpd) {
              console.error("❌ Error actualizando monto en finanzas:", errUpd.message);
              return res.status(500).json({ message: "Error al actualizar monto" });
            }
            if (this.changes === 0) {
              return res.status(404).json({ message: "Registro no encontrado" });
            }

            // Si está vinculado a un presupuesto, recalcular presupuestos_asignados
            if (finanza.referencia_tipo === 'presupuesto_asignado' && finanza.referencia_id) {
              // Sumar TODOS los pagos de finanzas para este presupuesto
              db.get(
                `SELECT COALESCE(SUM(f.monto), 0) as total_pagado
                 FROM finanzas f
                 WHERE f.referencia_id = ? AND f.referencia_tipo = 'presupuesto_asignado' AND f.tipo = 'ingreso'`,
                [finanza.referencia_id],
                (errSum, sumRow) => {
                  if (errSum) {
                    console.error("❌ Error sumando pagos de presupuesto:", errSum.message);
                    return res.json({ message: "✅ Monto actualizado en finanzas (sin actualizar presupuesto)" });
                  }

                  const totalPagado = parseFloat(sumRow?.total_pagado) || 0;

                  db.get(
                    `SELECT precio_total, descuento FROM presupuestos_asignados WHERE id = ?`,
                    [finanza.referencia_id],
                    (errPres, pres) => {
                      if (errPres || !pres) {
                        console.error("❌ Error obteniendo presupuesto:", errPres?.message);
                        return res.json({ message: "✅ Monto actualizado en finanzas" });
                      }

                      const precioTotal = parseFloat(pres.precio_total) || 0;
                      const descuento = parseFloat(pres.descuento) || 0;
                      const precioConDescuento = precioTotal - descuento;
                      const nuevoSaldo = Math.max(0, precioConDescuento - totalPagado);
                      let estadoPago = 'pendiente_pago';
                      let pagadoFlag = 0;

                      if (totalPagado >= precioConDescuento - 0.01) {
                        estadoPago = 'pagado';
                        pagadoFlag = 1;
                      } else if (totalPagado > 0) {
                        estadoPago = 'adelanto';
                        pagadoFlag = 0;
                      }

                      db.run(
                        `UPDATE presupuestos_asignados 
                         SET monto_pagado = ?, monto_adelanto = ?, saldo_pendiente = ?, 
                             estado_pago = ?, pagado = ?
                         WHERE id = ?`,
                        [totalPagado, totalPagado, nuevoSaldo, estadoPago, pagadoFlag, finanza.referencia_id],
                        (errUpdPres) => {
                          if (errUpdPres) {
                            console.error("❌ Error actualizando presupuesto:", errUpdPres.message);
                          }
                          res.json({ message: "✅ Monto actualizado correctamente" });
                        }
                      );
                    }
                  );
                }
              );
            }
            // Si está vinculado a un paquete, recalcular paquetes_pacientes
            else if (finanza.referencia_tipo === 'paquete_paciente' && finanza.referencia_id) {
              // Sumar TODOS los pagos de finanzas para este paquete
              db.get(
                `SELECT COALESCE(SUM(f.monto), 0) as total_pagado
                 FROM finanzas f
                 WHERE f.referencia_id = ? AND f.referencia_tipo = 'paquete_paciente' AND f.tipo = 'ingreso'`,
                [finanza.referencia_id],
                (errSum, sumRow) => {
                  if (errSum) {
                    console.error("❌ Error sumando pagos de paquete:", errSum.message);
                    return res.json({ message: "✅ Monto actualizado en finanzas (sin actualizar paquete)" });
                  }

                  const totalPagado = parseFloat(sumRow?.total_pagado) || 0;

                  db.get(
                    `SELECT precio_total FROM paquetes_pacientes WHERE id = ?`,
                    [finanza.referencia_id],
                    (errPaq, paq) => {
                      if (errPaq || !paq) {
                        console.error("❌ Error obteniendo paquete:", errPaq?.message);
                        return res.json({ message: "✅ Monto actualizado en finanzas" });
                      }

                      const precioTotal = parseFloat(paq.precio_total) || 0;
                      const nuevoSaldo = Math.max(0, precioTotal - totalPagado);
                      let estadoPago = 'pendiente_pago';
                      let pagadoFlag = 0;

                      if (totalPagado >= precioTotal - 0.01) {
                        estadoPago = 'pagado';
                        pagadoFlag = 1;
                      } else if (totalPagado > 0) {
                        estadoPago = 'adelanto';
                        pagadoFlag = 0;
                      }

                      db.run(
                        `UPDATE paquetes_pacientes 
                         SET monto_pagado = ?, monto_adelanto = ?, saldo_pendiente = ?, 
                             estado_pago = ?, pagado = ?
                         WHERE id = ?`,
                        [totalPagado, totalPagado, nuevoSaldo, estadoPago, pagadoFlag, finanza.referencia_id],
                        (errUpdPaq) => {
                          if (errUpdPaq) {
                            console.error("❌ Error actualizando paquete:", errUpdPaq.message);
                          }
                          res.json({ message: "✅ Monto actualizado correctamente" });
                        }
                      );
                    }
                  );
                }
              );
            }
            else {
              // Registro genérico de finanzas (consulta, abono_deuda, etc.)
              res.json({ message: "✅ Monto actualizado correctamente" });
            }
          }
        );
      }
    );
  }
});

export default router;
