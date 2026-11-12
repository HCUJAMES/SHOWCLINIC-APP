/**
 * Utilidades de fecha para la Agenda.
 *
 * Todo se maneja como texto en hora de Lima: "YYYY-MM-DD" para días y
 * "YYYY-MM-DDTHH:mm" para horas. Así no importa en qué zona horaria esté
 * configurado el celular o la PC: la cita de las 10:00 siempre es 10:00.
 * Las cuentas con días se hacen en UTC para evitar saltos de horario.
 */

export const ZONA = "America/Lima";

const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const DIAS_CORTOS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

const pad = (n) => String(n).padStart(2, "0");

const aUTC = (ymd) => new Date(`${ymd}T00:00:00Z`);
const deUTC = (d) => d.toISOString().slice(0, 10);

/** Fecha de hoy en Lima, "YYYY-MM-DD". */
export const hoy = () => new Date().toLocaleDateString("sv-SE", { timeZone: ZONA });

/** Hora actual en Lima, en minutos desde la medianoche. */
export const ahoraMinutos = () => {
  const [h, m] = new Date()
    .toLocaleTimeString("sv-SE", { timeZone: ZONA, hour: "2-digit", minute: "2-digit", hour12: false })
    .split(":")
    .map(Number);
  return (h % 24) * 60 + m;
};

export const sumarDias = (ymd, n) => {
  const d = aUTC(ymd);
  d.setUTCDate(d.getUTCDate() + n);
  return deUTC(d);
};

export const sumarMeses = (ymd, n) => {
  const d = aUTC(ymd);
  const dia = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + n);
  const ultimo = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(dia, ultimo));
  return deUTC(d);
};

/** 0 = domingo … 6 = sábado */
export const diaSemana = (ymd) => aUTC(ymd).getUTCDay();

/** Lunes de la semana del día dado. */
export const inicioSemana = (ymd) => sumarDias(ymd, -((diaSemana(ymd) + 6) % 7));

export const inicioMes = (ymd) => `${ymd.slice(0, 7)}-01`;

/** Las 6 semanas (42 días) que se muestran en la vista de mes, empezando en lunes. */
export const cuadriculaMes = (ymd) => {
  const primero = inicioSemana(inicioMes(ymd));
  return Array.from({ length: 42 }, (_, i) => sumarDias(primero, i));
};

export const diferenciaDias = (a, b) => Math.round((aUTC(b) - aUTC(a)) / 86400000);

/** "HH:mm" → minutos */
export const aMinutos = (hhmm) => {
  const [h, m] = String(hhmm || "0:0").split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};

/** minutos → "HH:mm" */
export const aHora = (min) => {
  const m = Math.max(0, Math.min(24 * 60 - 1, Math.round(min)));
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
};

export const fechaDe = (fechaHora) => String(fechaHora || "").slice(0, 10);
export const horaDe = (fechaHora) => String(fechaHora || "").slice(11, 16);
export const minutosDe = (fechaHora) => aMinutos(horaDe(fechaHora));

/** Suma minutos a "YYYY-MM-DDTHH:mm" (puede pasar al día siguiente). */
export const sumarMinutos = (fechaHora, minutos) => {
  let dia = fechaDe(fechaHora);
  let total = minutosDe(fechaHora) + minutos;
  while (total >= 1440) {
    total -= 1440;
    dia = sumarDias(dia, 1);
  }
  while (total < 0) {
    total += 1440;
    dia = sumarDias(dia, -1);
  }
  return `${dia}T${aHora(total)}`;
};

/** Minutos entre dos "YYYY-MM-DDTHH:mm". */
export const duracionMinutos = (inicio, fin) =>
  diferenciaDias(fechaDe(inicio), fechaDe(fin)) * 1440 + minutosDe(fin) - minutosDe(inicio);

/* ───────── Textos ───────── */

const mayus = (s) => s.charAt(0).toUpperCase() + s.slice(1);

export const nombreDia = (ymd) => DIAS[diaSemana(ymd)];
export const nombreDiaCorto = (ymd) => DIAS_CORTOS[diaSemana(ymd)];
export const nombreMes = (ymd) => MESES[Number(ymd.slice(5, 7)) - 1];
export const numeroDia = (ymd) => Number(ymd.slice(8, 10));

/** "Jueves 12 de noviembre" */
export const textoDiaLargo = (ymd, { anio = false } = {}) =>
  `${mayus(nombreDia(ymd))} ${numeroDia(ymd)} de ${nombreMes(ymd)}${anio ? ` de ${ymd.slice(0, 4)}` : ""}`;

/** "12 nov" */
export const textoDiaCorto = (ymd) => `${numeroDia(ymd)} ${nombreMes(ymd).slice(0, 3)}`;

/** "10:00 a. m." → se muestra en formato 24 h, como en las clínicas de Perú: "10:00" */
export const textoHora = (fechaHora) => horaDe(fechaHora);

/** Título del periodo visible según la vista. */
export const tituloPeriodo = (vista, fecha) => {
  if (vista === "dia") return textoDiaLargo(fecha, { anio: true });
  if (vista === "mes") return `${mayus(nombreMes(fecha))} ${fecha.slice(0, 4)}`;
  const ini = inicioSemana(fecha);
  const fin = sumarDias(ini, vista === "lista" ? 13 : 6);
  if (ini.slice(0, 7) === fin.slice(0, 7)) {
    return `${numeroDia(ini)} – ${numeroDia(fin)} de ${nombreMes(fin)} ${fin.slice(0, 4)}`;
  }
  if (ini.slice(0, 4) === fin.slice(0, 4)) {
    return `${textoDiaCorto(ini)} – ${textoDiaCorto(fin)} ${fin.slice(0, 4)}`;
  }
  return `${textoDiaCorto(ini)} ${ini.slice(0, 4)} – ${textoDiaCorto(fin)} ${fin.slice(0, 4)}`;
};

/** Rango [desde, hasta) que hay que pedir al servidor para cada vista. */
export const rangoVista = (vista, fecha) => {
  if (vista === "dia") return { desde: fecha, hasta: sumarDias(fecha, 1) };
  if (vista === "semana") {
    const ini = inicioSemana(fecha);
    return { desde: ini, hasta: sumarDias(ini, 7) };
  }
  if (vista === "lista") {
    const ini = inicioSemana(fecha);
    return { desde: ini, hasta: sumarDias(ini, 14) };
  }
  const celdas = cuadriculaMes(fecha);
  return { desde: celdas[0], hasta: sumarDias(celdas[41], 1) };
};

/** Cuánto avanzan las flechas ‹ › en cada vista. */
export const moverPeriodo = (vista, fecha, sentido) => {
  if (vista === "dia") return sumarDias(fecha, sentido);
  if (vista === "semana") return sumarDias(fecha, 7 * sentido);
  if (vista === "lista") return sumarDias(fecha, 14 * sentido);
  return sumarMeses(fecha, sentido);
};

/* ───────── Citas ───────── */

/** ¿La cita ocupa ese día? (sirve también para citas de varios días) */
export const citaEnDia = (cita, ymd) => {
  if (cita.todoElDia) return cita.inicio <= ymd && ymd <= cita.fin;
  const ini = fechaDe(cita.inicio);
  const fin = fechaDe(cita.fin);
  if (ini === ymd) return true;
  // Termina a las 00:00 del día siguiente: no cuenta para ese día.
  if (fin === ymd) return horaDe(cita.fin) !== "00:00" && ini < ymd;
  return ini < ymd && ymd < fin;
};

/** Minuto de inicio y fin de la cita dentro de un día concreto. */
export const tramoEnDia = (cita, ymd) => {
  const ini = fechaDe(cita.inicio) < ymd ? 0 : minutosDe(cita.inicio);
  const fin = fechaDe(cita.fin) > ymd ? 1440 : minutosDe(cita.fin);
  return { ini, fin: Math.max(fin, ini + 15) };
};

export const textoHorario = (cita) => {
  if (cita.todoElDia) {
    return cita.inicio === cita.fin
      ? "Todo el día"
      : `Del ${textoDiaCorto(cita.inicio)} al ${textoDiaCorto(cita.fin)}`;
  }
  if (fechaDe(cita.inicio) !== fechaDe(cita.fin) && horaDe(cita.fin) !== "00:00") {
    return `${textoDiaCorto(fechaDe(cita.inicio))} ${horaDe(cita.inicio)} – ${textoDiaCorto(fechaDe(cita.fin))} ${horaDe(cita.fin)}`;
  }
  return `${horaDe(cita.inicio)} – ${horaDe(cita.fin)}`;
};
