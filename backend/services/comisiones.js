/**
 * MOTOR DE COMISIONES POR SESIÓN REALIZADA
 * ========================================
 *
 * Regla de negocio (ShowClinic):
 *   - Al especialista se le paga un % (por defecto 20%) del precio del tratamiento.
 *   - Ese pago se reparte entre las sesiones del tratamiento y se acredita
 *     únicamente a quien REALIZÓ cada sesión.
 *
 * Ejemplo: presupuesto de 3 tratamientos = S/ 2400, comisión 20% = S/ 480.
 *   Si esos tratamientos suman 4 sesiones de igual valor → S/ 120 por sesión.
 *   Si el especialista A hace 3 sesiones y B hace 1 → A cobra 360 y B cobra 120.
 *
 * El prorrateo se hace POR TRATAMIENTO (precio del tratamiento ÷ sus sesiones),
 * no dividiendo el total del presupuesto entre todas las sesiones. Así un
 * tratamiento caro paga más por sesión que uno barato, y la suma de todas las
 * sesiones sigue siendo exactamente el % del presupuesto.
 *
 * El descuento del presupuesto se prorratea proporcionalmente entre los
 * tratamientos cobrables, de modo que la comisión se calcula sobre lo que el
 * paciente realmente paga.
 */

import { dbAll, dbGet } from "../db/database.js";

export const PCT_COMISION_DEFECTO = 20;

/** Redondeo a 2 decimales evitando errores de coma flotante. */
export function redondear(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

/**
 * Un tratamiento cuenta para comisión solo si se cobra.
 * "purple" = se realiza como cortesía (no se cobra) → no genera comisión.
 */
function esCobrable(item) {
  const marca = item?.marca;
  return marca === undefined || marca === null || marca === "gold";
}

/**
 * Porcentaje de comisión aplicable a un presupuesto.
 * Prioridad: override del presupuesto → % del especialista → 20%.
 */
export function pctComision(presupuesto, pctEspecialista) {
  if (presupuesto?.comision_porcentaje != null && presupuesto.comision_porcentaje !== "") {
    return Number(presupuesto.comision_porcentaje);
  }
  if (pctEspecialista != null && pctEspecialista !== "") {
    return Number(pctEspecialista);
  }
  return PCT_COMISION_DEFECTO;
}

/**
 * Construye el mapa de valor por sesión de cada tratamiento de un presupuesto.
 *
 * Devuelve { porNombre: Map<nombre, {precio, sesiones, valorSesion, cobrable}>, baseCobrable }
 * donde `valorSesion` ya incluye el descuento prorrateado.
 */
export function construirValoresPorTratamiento(presupuesto) {
  let items = [];
  try {
    items = presupuesto.tratamientos_json ? JSON.parse(presupuesto.tratamientos_json) : [];
  } catch (e) {
    items = [];
  }

  // Suma de los tratamientos que sí se cobran (antes de descuento).
  const brutoCobrable = items
    .filter(esCobrable)
    .reduce((acc, it) => acc + (Number(it.precio) || 0), 0);

  const descuento = Number(presupuesto.descuento) || 0;
  // El descuento se reparte proporcionalmente. Nunca deja la base negativa.
  const factorDescuento = brutoCobrable > 0
    ? Math.max(0, (brutoCobrable - descuento) / brutoCobrable)
    : 0;

  const porNombre = new Map();
  for (const it of items) {
    const nombre = it.nombre || "Sin nombre";
    const sesiones = Number(it.sesiones) >= 1 ? Number(it.sesiones) : 1;
    const precioBruto = Number(it.precio) || 0;
    const cobrable = esCobrable(it);
    const precioEfectivo = cobrable ? precioBruto * factorDescuento : 0;

    porNombre.set(nombre, {
      nombre,
      tratamiento_id: it.tratamientoId ?? it.tratamiento_id ?? null,
      precio_bruto: precioBruto,
      precio_efectivo: precioEfectivo,
      sesiones,
      valor_sesion: sesiones > 0 ? precioEfectivo / sesiones : 0,
      cobrable,
    });
  }

  return {
    porNombre,
    base_cobrable: Math.max(0, brutoCobrable - descuento),
    factor_descuento: factorDescuento,
  };
}

/**
 * Desglose completo de un presupuesto: qué sesión hizo cada especialista,
 * cuánto vale cada una y cuánta comisión genera.
 *
 * @param {object} presupuesto  fila de presupuestos_asignados (requiere tratamientos_json y descuento)
 * @param {Map<number,number>} pctPorEspecialista  id → % de comisión propio
 * @returns {{sesiones: Array, porEspecialista: Map, totales: object}}
 */
export async function desglosarPresupuesto(presupuesto, pctPorEspecialista = new Map()) {
  const valores = construirValoresPorTratamiento(presupuesto);

  // El nombre se resuelve desde la tabla especialistas y solo se cae al texto
  // guardado en la sesión si el especialista ya no existe.
  const sesiones = await dbAll(
    `SELECT ps.id, ps.tratamiento_nombre, ps.tratamiento_id, ps.sesion_numero,
            ps.total_sesiones, ps.estado, ps.fecha_realizada,
            ps.especialista_id,
            COALESCE(e.nombre, ps.especialista) as especialista
     FROM presupuestos_sesiones ps
     LEFT JOIN especialistas e ON e.id = ps.especialista_id
     WHERE ps.presupuesto_asignado_id = ?
     ORDER BY ps.tratamiento_nombre, ps.sesion_numero`,
    [presupuesto.id]
  );

  const detalle = [];
  const porEspecialista = new Map();

  let comisionDevengada = 0;   // comisión de sesiones YA realizadas
  let comisionProyectada = 0;  // comisión si se completara todo el presupuesto
  let sesionesRealizadas = 0;
  let sesionesSinEspecialista = 0;

  for (const s of sesiones) {
    const info = valores.porNombre.get(s.tratamiento_nombre);
    // Si el tratamiento ya no está en el JSON (fue editado), su valor es 0.
    const valorSesion = info ? info.valor_sesion : 0;
    const cobrable = info ? info.cobrable : false;

    // El % se resuelve con el especialista que hizo la sesión.
    const pctEsp = s.especialista_id != null ? pctPorEspecialista.get(s.especialista_id) : null;
    const pct = pctComision(presupuesto, pctEsp);
    const comisionSesion = cobrable ? valorSesion * (pct / 100) : 0;

    const realizada = s.estado === "completada";

    detalle.push({
      sesion_id: s.id,
      tratamiento_nombre: s.tratamiento_nombre,
      tratamiento_id: s.tratamiento_id ?? info?.tratamiento_id ?? null,
      sesion_numero: s.sesion_numero,
      total_sesiones: s.total_sesiones || info?.sesiones || 1,
      estado: s.estado,
      fecha_realizada: s.fecha_realizada,
      especialista_id: realizada ? s.especialista_id : null,
      especialista_nombre: realizada ? s.especialista : null,
      valor_sesion: redondear(valorSesion),
      comision_porcentaje: pct,
      comision_sesion: redondear(comisionSesion),
      cobrable,
    });

    comisionProyectada += comisionSesion;

    if (!realizada) continue;

    sesionesRealizadas += 1;
    comisionDevengada += comisionSesion;

    if (s.especialista_id == null) {
      // Sesión hecha pero sin especialista registrado: no se puede pagar a nadie.
      sesionesSinEspecialista += 1;
      continue;
    }

    const acum = porEspecialista.get(s.especialista_id) || {
      especialista_id: s.especialista_id,
      especialista_nombre: s.especialista || null,
      sesiones: 0,
      valor_generado: 0,
      comision: 0,
      tratamientos: new Set(),
    };
    acum.sesiones += 1;
    acum.valor_generado += valorSesion;
    acum.comision += comisionSesion;
    acum.tratamientos.add(s.tratamiento_nombre);
    if (!acum.especialista_nombre && s.especialista) acum.especialista_nombre = s.especialista;
    porEspecialista.set(s.especialista_id, acum);
  }

  // Normalizar acumulados
  for (const acum of porEspecialista.values()) {
    acum.valor_generado = redondear(acum.valor_generado);
    acum.comision = redondear(acum.comision);
    acum.tratamientos = Array.from(acum.tratamientos);
  }

  return {
    sesiones: detalle,
    porEspecialista,
    totales: {
      base_cobrable: redondear(valores.base_cobrable),
      sesiones_totales: sesiones.length,
      sesiones_realizadas: sesionesRealizadas,
      sesiones_sin_especialista: sesionesSinEspecialista,
      comision_devengada: redondear(comisionDevengada),
      comision_proyectada: redondear(comisionProyectada),
    },
  };
}

/** Carga el mapa id → % de comisión de todos los especialistas. */
export async function cargarPctEspecialistas() {
  const filas = await dbAll("SELECT id, comision_porcentaje FROM especialistas");
  const mapa = new Map();
  for (const f of filas) {
    mapa.set(
      f.id,
      f.comision_porcentaje != null ? Number(f.comision_porcentaje) : PCT_COMISION_DEFECTO
    );
  }
  return mapa;
}

/**
 * Trabajo realizado por un especialista en un rango de fechas.
 * Se apoya en la FECHA DE LA SESIÓN (cuándo se hizo el trabajo), no en la
 * fecha de creación del presupuesto: es lo correcto para liquidar un periodo.
 *
 * @returns {{resumen: object, presupuestos: Array, sesiones: Array}}
 */
export async function trabajoDeEspecialista(especialistaId, { fecha_inicio, fecha_fin } = {}) {
  const pctMap = await cargarPctEspecialistas();

  // Presupuestos donde este especialista realizó al menos una sesión.
  let cond = "ps.estado = 'completada' AND ps.especialista_id = ?";
  const params = [especialistaId];
  if (fecha_inicio) {
    cond += " AND DATE(ps.fecha_realizada) >= ?";
    params.push(fecha_inicio);
  }
  if (fecha_fin) {
    cond += " AND DATE(ps.fecha_realizada) <= ?";
    params.push(fecha_fin);
  }

  const presupuestoIds = await dbAll(
    `SELECT DISTINCT ps.presupuesto_asignado_id as id
     FROM presupuestos_sesiones ps
     WHERE ${cond}`,
    params
  );

  const presupuestos = [];
  let comisionTotal = 0;
  let valorGenerado = 0;
  let sesionesTotal = 0;
  const pacientes = new Set();

  for (const { id } of presupuestoIds) {
    const pres = await dbGet(
      `SELECT pa.*, p.nombre as paciente_nombre, p.apellido as paciente_apellido, p.dni as paciente_dni
       FROM presupuestos_asignados pa
       JOIN patients p ON pa.paciente_id = p.id
       WHERE pa.id = ?`,
      [id]
    );
    if (!pres) continue;

    const desglose = await desglosarPresupuesto(pres, pctMap);

    // Sesiones de ESTE especialista dentro del rango
    const misSesiones = desglose.sesiones.filter((s) => {
      if (s.estado !== "completada" || s.especialista_id !== Number(especialistaId)) return false;
      const dia = (s.fecha_realizada || "").slice(0, 10);
      if (fecha_inicio && dia < fecha_inicio) return false;
      if (fecha_fin && dia > fecha_fin) return false;
      return true;
    });

    if (misSesiones.length === 0) continue;

    const comisionPres = misSesiones.reduce((a, s) => a + s.comision_sesion, 0);
    const valorPres = misSesiones.reduce((a, s) => a + s.valor_sesion, 0);

    comisionTotal += comisionPres;
    valorGenerado += valorPres;
    sesionesTotal += misSesiones.length;
    pacientes.add(pres.paciente_id);

    presupuestos.push({
      presupuesto_id: pres.id,
      paciente_id: pres.paciente_id,
      paciente_nombre: pres.paciente_nombre,
      paciente_apellido: pres.paciente_apellido,
      paciente_dni: pres.paciente_dni,
      creado_en: pres.creado_en,
      precio_total: Number(pres.precio_total) || 0,
      descuento: Number(pres.descuento) || 0,
      base_cobrable: desglose.totales.base_cobrable,
      // Lo que corresponde a ESTE especialista
      mis_sesiones: misSesiones.length,
      mi_valor_generado: redondear(valorPres),
      mi_comision: redondear(comisionPres),
      // Contexto del presupuesto completo
      sesiones_totales: desglose.totales.sesiones_totales,
      sesiones_realizadas: desglose.totales.sesiones_realizadas,
      comision_total_presupuesto: desglose.totales.comision_proyectada,
      compartido_con: Array.from(desglose.porEspecialista.values())
        .filter((e) => e.especialista_id !== Number(especialistaId))
        .map((e) => ({
          especialista_id: e.especialista_id,
          especialista_nombre: e.especialista_nombre,
          sesiones: e.sesiones,
          comision: e.comision,
        })),
      detalle_sesiones: misSesiones,
    });
  }

  presupuestos.sort((a, b) => String(b.creado_en).localeCompare(String(a.creado_en)));

  return {
    resumen: {
      num_presupuestos: presupuestos.length,
      num_pacientes: pacientes.size,
      sesiones_realizadas: sesionesTotal,
      valor_generado: redondear(valorGenerado),
      comision_total: redondear(comisionTotal),
      valor_promedio_sesion: sesionesTotal > 0 ? redondear(valorGenerado / sesionesTotal) : 0,
    },
    presupuestos,
  };
}

/**
 * Ranking de todos los especialistas por trabajo realizado en un periodo.
 * Una sola pasada por las sesiones completadas (evita N+1 por especialista).
 */
export async function rendimientoEspecialistas({ fecha_inicio, fecha_fin } = {}) {
  const pctMap = await cargarPctEspecialistas();

  let cond = "ps.estado = 'completada' AND ps.especialista_id IS NOT NULL";
  const params = [];
  if (fecha_inicio) {
    cond += " AND DATE(ps.fecha_realizada) >= ?";
    params.push(fecha_inicio);
  }
  if (fecha_fin) {
    cond += " AND DATE(ps.fecha_realizada) <= ?";
    params.push(fecha_fin);
  }

  // Presupuestos con actividad en el periodo
  const ids = await dbAll(
    `SELECT DISTINCT ps.presupuesto_asignado_id as id
     FROM presupuestos_sesiones ps WHERE ${cond}`,
    params
  );

  const acumulado = new Map();

  for (const { id } of ids) {
    const pres = await dbGet("SELECT * FROM presupuestos_asignados WHERE id = ?", [id]);
    if (!pres) continue;

    const desglose = await desglosarPresupuesto(pres, pctMap);

    for (const s of desglose.sesiones) {
      if (s.estado !== "completada" || s.especialista_id == null) continue;
      const dia = (s.fecha_realizada || "").slice(0, 10);
      if (fecha_inicio && dia < fecha_inicio) continue;
      if (fecha_fin && dia > fecha_fin) continue;

      const acum = acumulado.get(s.especialista_id) || {
        especialista_id: s.especialista_id,
        sesiones: 0,
        valor_generado: 0,
        comision: 0,
        pacientes: new Set(),
      };
      acum.sesiones += 1;
      acum.valor_generado += s.valor_sesion;
      acum.comision += s.comision_sesion;
      acum.pacientes.add(pres.paciente_id);
      acumulado.set(s.especialista_id, acum);
    }
  }

  const especialistas = await dbAll(
    "SELECT id, nombre, especialidad, comision_porcentaje, pago_fijo, foto_perfil FROM especialistas"
  );

  return especialistas
    .map((e) => {
      const a = acumulado.get(e.id);
      return {
        id: e.id,
        nombre: e.nombre,
        especialidad: e.especialidad,
        comision_porcentaje: e.comision_porcentaje != null ? Number(e.comision_porcentaje) : PCT_COMISION_DEFECTO,
        pago_fijo: Number(e.pago_fijo) || 0,
        foto_perfil: e.foto_perfil,
        sesiones_realizadas: a ? a.sesiones : 0,
        pacientes_atendidos: a ? a.pacientes.size : 0,
        ingresos_generados: a ? redondear(a.valor_generado) : 0,
        comision_a_pagar: a ? redondear(a.comision) : 0,
        total_a_pagar: redondear((a ? a.comision : 0) + (Number(e.pago_fijo) || 0)),
      };
    })
    .sort((x, y) => y.ingresos_generados - x.ingresos_generados);
}

/**
 * Sesiones realizadas SIN especialista registrado: trabajo que nadie puede cobrar.
 * Sirve para avisar al dueño que hay datos incompletos.
 */
export async function sesionesHuerfanas({ fecha_inicio, fecha_fin } = {}) {
  let cond = "ps.estado = 'completada' AND ps.especialista_id IS NULL";
  const params = [];
  if (fecha_inicio) {
    cond += " AND DATE(ps.fecha_realizada) >= ?";
    params.push(fecha_inicio);
  }
  if (fecha_fin) {
    cond += " AND DATE(ps.fecha_realizada) <= ?";
    params.push(fecha_fin);
  }

  return dbAll(
    `SELECT ps.id, ps.presupuesto_asignado_id, ps.tratamiento_nombre,
            ps.sesion_numero, ps.fecha_realizada,
            pa.paciente_id, p.nombre as paciente_nombre, p.apellido as paciente_apellido
     FROM presupuestos_sesiones ps
     JOIN presupuestos_asignados pa ON pa.id = ps.presupuesto_asignado_id
     JOIN patients p ON p.id = pa.paciente_id
     WHERE ${cond}
     ORDER BY ps.fecha_realizada DESC`,
    params
  );
}
