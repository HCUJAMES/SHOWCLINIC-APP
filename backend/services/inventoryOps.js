export const reservarStockFEFO = async ({
  dbAll,
  dbRun,
  movimientoId,
  varianteId,
  cantidad,
}) => {
  let restante = cantidad;
  const detalles = [];

  const lotes = await dbAll(
    `
      SELECT *
      FROM stock_lotes
      WHERE variante_id = ?
        AND cantidad_unidades > 0
        AND (estado IS NULL OR estado = 'Disponible')
      ORDER BY (fecha_vencimiento IS NULL) ASC, fecha_vencimiento ASC, id ASC
    `,
    [varianteId]
  );

  const disponibleEfectivoTotal = lotes.reduce(
    (sum, l) =>
      sum +
      Math.max(0, (l.cantidad_unidades || 0) - (l.cantidad_reservada_unidades || 0)),
    0
  );

  if (disponibleEfectivoTotal < cantidad) {
    return {
      ok: false,
      status: 400,
      message: `Stock insuficiente para reservar. Necesario: ${cantidad}, disponible: ${disponibleEfectivoTotal}`,
      detalles: [],
    };
  }

  for (const lote of lotes) {
    if (restante <= 0) break;
    const disponibleEfectivo = Math.max(
      0,
      (lote.cantidad_unidades || 0) - (lote.cantidad_reservada_unidades || 0)
    );
    if (disponibleEfectivo <= 0) continue;

    const usar = Math.min(disponibleEfectivo, restante);

    await dbRun(
      `
        UPDATE stock_lotes
        SET cantidad_reservada_unidades = cantidad_reservada_unidades + ?,
            actualizado_en = datetime('now', '-5 hours')
        WHERE id = ?
      `,
      [usar, lote.id]
    );

    await dbRun(
      `
        INSERT INTO movimientos_detalle
        (movimiento_id, variante_id, stock_lote_id, cantidad_unidades)
        VALUES (?, ?, ?, ?)
      `,
      [movimientoId, varianteId, lote.id, usar]
    );

    detalles.push({ stock_lote_id: lote.id, cantidad: usar });
    restante -= usar;
  }

  return { ok: true, status: 200, message: "Reserva registrada", detalles };
};

export const consumirStockFEFO = async ({
  dbAll,
  dbRun,
  movimientoId,
  varianteId,
  cantidad,
  stockLoteId,
}) => {
  let restante = cantidad;
  const detalles = [];

  if (stockLoteId) {
    const rows = await dbAll(
      `SELECT * FROM stock_lotes WHERE id = ? AND variante_id = ?`,
      [stockLoteId, varianteId]
    );
    const lote = rows[0];
    if (!lote) {
      return { ok: false, status: 404, message: "Lote no encontrado", detalles: [] };
    }

    const disponible = lote.cantidad_unidades || 0;
    if (disponible < restante) {
      return {
        ok: false,
        status: 400,
        message: "Saldo insuficiente en el lote seleccionado",
        detalles: [],
      };
    }

    const liberarReserva = Math.min(
      lote.cantidad_reservada_unidades || 0,
      restante
    );

    await dbRun(
      `
        UPDATE stock_lotes
        SET cantidad_unidades = cantidad_unidades - ?,
            cantidad_reservada_unidades = MAX(0, cantidad_reservada_unidades - ?),
            actualizado_en = datetime('now', '-5 hours')
        WHERE id = ?
      `,
      [restante, liberarReserva, lote.id]
    );

    await dbRun(
      `
        INSERT INTO movimientos_detalle
        (movimiento_id, variante_id, stock_lote_id, cantidad_unidades)
        VALUES (?, ?, ?, ?)
      `,
      [movimientoId, varianteId, lote.id, restante]
    );

    detalles.push({ stock_lote_id: lote.id, cantidad: restante });
    return { ok: true, status: 200, message: "Consumo registrado", detalles };
  }

  const lotes = await dbAll(
    `
      SELECT *
      FROM stock_lotes
      WHERE variante_id = ?
        AND cantidad_unidades > 0
        AND (estado IS NULL OR estado = 'Disponible')
      ORDER BY (fecha_vencimiento IS NULL) ASC, fecha_vencimiento ASC, id ASC
    `,
    [varianteId]
  );

  const disponibleTotal = lotes.reduce((sum, l) => sum + (l.cantidad_unidades || 0), 0);
  if (disponibleTotal < restante) {
    return {
      ok: false,
      status: 400,
      message: `Stock insuficiente. Necesario: ${cantidad}, disponible: ${disponibleTotal}`,
      detalles: [],
    };
  }

  for (const lote of lotes) {
    if (restante <= 0) break;
    const disponible = lote.cantidad_unidades || 0;
    if (disponible <= 0) continue;

    const usar = Math.min(disponible, restante);
    const liberarReserva = Math.min(lote.cantidad_reservada_unidades || 0, usar);

    await dbRun(
      `
        UPDATE stock_lotes
        SET cantidad_unidades = cantidad_unidades - ?,
            cantidad_reservada_unidades = MAX(0, cantidad_reservada_unidades - ?),
            actualizado_en = datetime('now', '-5 hours')
        WHERE id = ?
      `,
      [usar, liberarReserva, lote.id]
    );

    await dbRun(
      `
        INSERT INTO movimientos_detalle
        (movimiento_id, variante_id, stock_lote_id, cantidad_unidades)
        VALUES (?, ?, ?, ?)
      `,
      [movimientoId, varianteId, lote.id, usar]
    );

    detalles.push({ stock_lote_id: lote.id, cantidad: usar });
    restante -= usar;
  }

  return { ok: true, status: 200, message: "Consumo registrado", detalles };
};
