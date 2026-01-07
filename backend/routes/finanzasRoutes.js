import express from "express";
import db from "../db/database.js";

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
    WHERE 1 = 1
  `;
  const params = [];

  // 🗓️ Filtros dinámicos
  if (fechaInicio && fechaFin) {
  query += " AND DATE(datetime(fecha, '-5 hours')) BETWEEN ? AND ?";
  params.push(fechaInicio, fechaFin);
}
 else if (fechaInicio) {
    query += " AND date(tr.fecha) = date(?)";
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

      return {
        ...r,
        monto_bruto: montoBruto,
        comision_pos: comisionPOS,
        monto_cobrado: montoCobrado,
        deuda_pendiente: deudaPendiente,
        pagoMetodo_mostrado: pagoMetodoMostrado,
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

    // Obtener también los pagos de presupuestos asignados
    let queryPresupuestos = `
      SELECT 
        pa.id,
        p.nombre || ' ' || p.apellido AS paciente,
        pa.tratamientos_json,
        pa.fecha_pago AS fecha,
        pa.monto_pagado AS precio_total,
        0 AS descuento,
        pa.metodo_pago AS pagoMetodo,
        'presupuesto' AS tipo_registro
      FROM presupuestos_asignados pa
      JOIN patients p ON p.id = pa.paciente_id
      WHERE pa.pagado = 1
    `;
    const paramsPresupuestos = [];

    if (fechaInicio && fechaFin) {
      queryPresupuestos += " AND DATE(datetime(pa.fecha_pago, '-5 hours')) BETWEEN ? AND ?";
      paramsPresupuestos.push(fechaInicio, fechaFin);
    } else if (fechaInicio) {
      queryPresupuestos += " AND DATE(datetime(pa.fecha_pago, '-5 hours')) = ?";
      paramsPresupuestos.push(fechaInicio);
    }

    if (paciente) {
      queryPresupuestos += " AND p.nombre || ' ' || p.apellido LIKE ?";
      paramsPresupuestos.push(`%${paciente}%`);
    }

    if (metodoPago) {
      queryPresupuestos += " AND pa.metodo_pago = ?";
      paramsPresupuestos.push(metodoPago);
    }

    db.all(queryPresupuestos, paramsPresupuestos, (errPres, rowsPresupuestos) => {
      if (errPres) {
        console.error("❌ Error al obtener presupuestos pagados:", errPres.message);
      }
      console.log("📋 Presupuestos pagados encontrados:", rowsPresupuestos?.length || 0);
      console.log("📋 Tratamientos encontrados:", resultados?.length || 0);
      
      const presupuestosPagados = (rowsPresupuestos || []).map((r) => {
        const monto = parseFloat(r.precio_total) || 0;
        const metodo = r.pagoMetodo || "efectivo";
        
        // Extraer nombres de tratamientos del JSON
        let tratamientoNombre = "Presupuesto";
        try {
          const tratamientos = r.tratamientos_json ? JSON.parse(r.tratamientos_json) : [];
          if (tratamientos.length > 0) {
            tratamientoNombre = tratamientos.map(t => t.nombre).join(", ");
          }
        } catch (e) {
          tratamientoNombre = "Presupuesto";
        }
        
        // Capitalizar método de pago
        const metodoCapitalizado = metodo.charAt(0).toUpperCase() + metodo.slice(1).toLowerCase();
        
        return {
          ...r,
          tratamiento: tratamientoNombre,
          monto_bruto: monto,
          comision_pos: calcularComisionPOS(monto, metodoCapitalizado),
          monto_cobrado: aplicarComisionPOS(monto, metodoCapitalizado),
          deuda_pendiente: 0,
          pagoMetodo: metodoCapitalizado,
          pagoMetodo_mostrado: metodoCapitalizado,
          tipo_registro: 'presupuesto'
        };
      });

      // Combinar resultados
      const todosResultados = [...resultados.map(r => ({...r, tipo_registro: 'tratamiento'})), ...presupuestosPagados];
      
      // Ordenar por fecha descendente
      todosResultados.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

      // Recalcular totales incluyendo presupuestos
      const totalGeneralFinal = todosResultados.reduce((acc, r) => acc + (r.monto_cobrado || 0), 0);
      const totalBrutoFinal = todosResultados.reduce((acc, r) => acc + (r.monto_bruto || 0), 0);
      const totalComisionFinal = todosResultados.reduce((acc, r) => acc + (r.comision_pos || 0), 0);

      // Agregar presupuestos a totales por método
      presupuestosPagados.forEach((r) => {
        // Capitalizar primera letra para que coincida con otros métodos (Efectivo, Tarjeta, etc.)
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

export default router;
