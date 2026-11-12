/**
 * GOOGLE CALENDAR
 * ===============
 *
 * La clínica usa una sola cuenta de Google Calendar que todo el equipo ve en
 * sus celulares. El sistema se conecta a ESE MISMO calendario mediante una
 * "cuenta de servicio" de Google (un usuario-robot):
 *
 *   1. En Google Cloud se crea la cuenta de servicio y se descarga su llave JSON.
 *   2. El calendario de la clínica se comparte con el correo de esa cuenta,
 *      con permiso "Hacer cambios en eventos".
 *   3. En ShowClinic (Agenda → Configurar) se sube el JSON y el ID del calendario.
 *
 * Se eligió cuenta de servicio y no "Iniciar sesión con Google" porque el
 * servidor vive en la red local de la clínica: Google no acepta redirecciones
 * de login a una IP local, y la cuenta de servicio no caduca ni pide volver a
 * iniciar sesión.
 *
 * No usa librerías nuevas: firma el token con jsonwebtoken y llama a la API
 * REST con axios (ambas ya instaladas).
 */

import axios from "axios";
import jwt from "jsonwebtoken";
import { dbAll, dbGet, dbRun } from "../db/database.js";

export const ZONA = "America/Lima";
// Perú no tiene horario de verano: el desfase es siempre -05:00.
const OFFSET = "-05:00";

const API_BASE = process.env.GOOGLE_CALENDAR_API_BASE || "https://www.googleapis.com/calendar/v3";
const SCOPE = "https://www.googleapis.com/auth/calendar";
const TIMEOUT = 20000;

/* ─────────────────────────── Configuración ─────────────────────────── */

let tablaLista = null;
export const asegurarTabla = () => {
  if (!tablaLista) {
    tablaLista = dbRun(`
      CREATE TABLE IF NOT EXISTS google_calendar_config (
        clave TEXT PRIMARY KEY,
        valor TEXT,
        actualizado_en DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).catch((err) => {
      tablaLista = null;
      throw err;
    });
  }
  return tablaLista;
};

let cacheConfig = null;

export const leerConfig = async () => {
  if (cacheConfig) return cacheConfig;
  await asegurarTabla();
  const filas = await dbAll("SELECT clave, valor FROM google_calendar_config");
  const obj = {};
  filas.forEach((f) => (obj[f.clave] = f.valor));
  let credenciales = null;
  try {
    credenciales = obj.service_account ? JSON.parse(obj.service_account) : null;
  } catch {
    credenciales = null;
  }
  cacheConfig = {
    credenciales,
    calendarId: obj.calendar_id || null,
    calendarNombre: obj.calendar_nombre || null,
    conectadoEn: obj.conectado_en || null,
  };
  return cacheConfig;
};

const guardarClave = (clave, valor) =>
  dbRun(
    `INSERT INTO google_calendar_config (clave, valor, actualizado_en) VALUES (?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor, actualizado_en = CURRENT_TIMESTAMP`,
    [clave, valor]
  );

export const guardarConfig = async ({ credenciales, calendarId, calendarNombre }) => {
  await asegurarTabla();
  await guardarClave("service_account", JSON.stringify(credenciales));
  await guardarClave("calendar_id", calendarId);
  await guardarClave("calendar_nombre", calendarNombre || "");
  await guardarClave("conectado_en", fechaHoraLima(new Date()));
  cacheConfig = null;
  tokenCache = null;
};

export const borrarConfig = async () => {
  await asegurarTabla();
  await dbRun("DELETE FROM google_calendar_config");
  cacheConfig = null;
  tokenCache = null;
};

export const estaConfigurado = async () => {
  const c = await leerConfig();
  return Boolean(c.credenciales && c.calendarId);
};

/** Revisa que el JSON subido sea una llave de cuenta de servicio válida. */
export const validarCredenciales = (cred) => {
  if (!cred || typeof cred !== "object") return "El archivo no es un JSON válido.";
  if (cred.type !== "service_account")
    return 'El archivo no es de una "cuenta de servicio". En Google Cloud crea una cuenta de servicio y descarga su llave en formato JSON.';
  if (!cred.client_email || !cred.private_key)
    return "Al archivo le falta el correo o la llave privada. Descárgalo de nuevo desde Google Cloud.";
  if (!String(cred.private_key).includes("PRIVATE KEY"))
    return "La llave privada del archivo no es válida. Descárgalo de nuevo desde Google Cloud.";
  return null;
};

/* ─────────────────────────── Errores legibles ─────────────────────────── */

export class ErrorGoogle extends Error {
  constructor(message, status = 502) {
    super(message);
    this.status = status;
  }
}

const traducirError = (err, email) => {
  if (err instanceof ErrorGoogle) return err;
  const res = err.response;
  if (!res) {
    if (err.code === "ECONNABORTED" || /timeout/i.test(err.message || ""))
      return new ErrorGoogle("Google Calendar tardó demasiado en responder. Intenta de nuevo.", 504);
    return new ErrorGoogle(
      "No hay conexión con Google Calendar. Revisa que el servidor de la clínica tenga internet.",
      503
    );
  }
  const status = res.status;
  const data = res.data || {};
  const razon = data?.error?.errors?.[0]?.reason || data?.error?.status || data?.error || "";
  const msgGoogle = data?.error?.message || data?.error_description || "";

  if (razon === "invalid_grant" || razon === "invalid_client" || status === 401)
    return new ErrorGoogle(
      "Google rechazó las credenciales. Es posible que la llave haya sido eliminada en Google Cloud: vuelve a conectar el calendario con una llave nueva.",
      502
    );
  if (razon === "accessNotConfigured" || /has not been used|is disabled/i.test(msgGoogle))
    return new ErrorGoogle(
      'La "Google Calendar API" no está activada en el proyecto de Google Cloud. Actívala y vuelve a intentar en unos minutos.',
      502
    );
  if (status === 404)
    return new ErrorGoogle(
      `No se encontró el calendario o la cita. Verifica el ID del calendario y que esté compartido con ${email || "la cuenta de servicio"}.`,
      404
    );
  if (status === 410) return new ErrorGoogle("Esa cita ya fue eliminada en Google Calendar.", 410);
  if (status === 403 && /rate|quota/i.test(razon + msgGoogle))
    return new ErrorGoogle("Google está limitando las consultas. Espera un momento y vuelve a intentar.", 429);
  if (status === 403)
    return new ErrorGoogle(
      `El sistema no tiene permiso para modificar el calendario. Compártelo con ${email || "la cuenta de servicio"} con el permiso "Hacer cambios en eventos".`,
      403
    );
  if (status === 400)
    return new ErrorGoogle(`Google rechazó los datos de la cita: ${msgGoogle || "datos inválidos"}.`, 400);
  return new ErrorGoogle(`Error de Google Calendar (${status}). ${msgGoogle}`.trim(), 502);
};

/* ─────────────────────────── Token de acceso ─────────────────────────── */

let tokenCache = null; // { token, vence, email }

const obtenerToken = async (credenciales) => {
  const ahora = Math.floor(Date.now() / 1000);
  if (tokenCache && tokenCache.email === credenciales.client_email && tokenCache.vence - 120 > ahora) {
    return tokenCache.token;
  }
  const tokenUri = credenciales.token_uri || "https://oauth2.googleapis.com/token";
  let firmado;
  try {
    firmado = jwt.sign(
      { iss: credenciales.client_email, scope: SCOPE, aud: tokenUri, iat: ahora, exp: ahora + 3600 },
      credenciales.private_key,
      { algorithm: "RS256" }
    );
  } catch {
    throw new ErrorGoogle("La llave privada del archivo JSON no es válida. Descárgala de nuevo desde Google Cloud.", 400);
  }
  try {
    const { data } = await axios.post(
      tokenUri,
      new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: firmado }).toString(),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" }, timeout: TIMEOUT }
    );
    tokenCache = {
      token: data.access_token,
      vence: ahora + Number(data.expires_in || 3600),
      email: credenciales.client_email,
    };
    return data.access_token;
  } catch (err) {
    throw traducirError(err, credenciales.client_email);
  }
};

/** Llamada genérica a la API con la configuración indicada (o la guardada). */
const llamar = async (metodo, ruta, { params, data, config } = {}) => {
  const cfg = config || (await leerConfig());
  if (!cfg.credenciales || !cfg.calendarId)
    throw new ErrorGoogle("Google Calendar todavía no está conectado.", 409);
  const token = await obtenerToken(cfg.credenciales);
  const intentar = () =>
    axios({
      method: metodo,
      url: `${API_BASE}${ruta}`,
      params,
      data,
      headers: { Authorization: `Bearer ${token}` },
      timeout: TIMEOUT,
    });
  try {
    const res = await intentar();
    return res.data;
  } catch (err) {
    // Un error pasajero de Google (5xx) se reintenta una vez.
    if (err.response && err.response.status >= 500) {
      try {
        const res = await intentar();
        return res.data;
      } catch (err2) {
        throw traducirError(err2, cfg.credenciales.client_email);
      }
    }
    throw traducirError(err, cfg.credenciales.client_email);
  }
};

const enc = encodeURIComponent;

/* ─────────────────────────── Fechas ─────────────────────────── */

const fmtLima = new Intl.DateTimeFormat("sv-SE", {
  timeZone: ZONA,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/** Date → "YYYY-MM-DDTHH:mm" en hora de Lima. */
export const fechaHoraLima = (d) => fmtLima.format(d).replace(" ", "T").slice(0, 16);

const RE_FECHA = /^\d{4}-\d{2}-\d{2}$/;
const RE_FECHA_HORA = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

export const esFecha = (s) => typeof s === "string" && RE_FECHA.test(s) && !isNaN(Date.parse(s));
export const esFechaHora = (s) => typeof s === "string" && RE_FECHA_HORA.test(s) && !isNaN(Date.parse(`${s}:00${OFFSET}`));

/** "YYYY-MM-DD" o "YYYY-MM-DDTHH:mm" (hora Lima) → RFC3339 para Google. */
const aRFC3339 = (s) => (s.length === 10 ? `${s}T00:00:00${OFFSET}` : `${s}:00${OFFSET}`);

/* ─────────────────────────── Vínculo con pacientes ─────────────────────────── */

const normalizar = (s) =>
  String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9ñ\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const soloDigitos = (s) => String(s || "").replace(/\D/g, "");

/**
 * Índice de pacientes para reconocer citas creadas a mano en Google
 * (por ejemplo "María Pérez - Botox" o "Botox 73384766"). Se reconstruye
 * cada minuto como máximo.
 */
let indice = null;
let indiceCreado = 0;

export const invalidarIndicePacientes = () => {
  indice = null;
};

const obtenerIndice = async ({ forzar = false } = {}) => {
  if (!forzar && indice && Date.now() - indiceCreado < 60000) return indice;
  const pacientes = await dbAll("SELECT id, nombre, apellido, dni, celular FROM patients");
  const porId = new Map();
  const porDni = new Map();
  const porCelular = new Map();
  const porNombre = new Map(); // "nombre apellido" (primeras palabras) → [ids]
  const agregar = (mapa, clave, id) => {
    if (!clave) return;
    const lista = mapa.get(clave) || [];
    if (!lista.includes(id)) lista.push(id);
    mapa.set(clave, lista);
  };
  for (const p of pacientes) {
    porId.set(p.id, p);
    const dni = soloDigitos(p.dni);
    if (dni.length >= 7) agregar(porDni, dni, p.id);
    const cel = soloDigitos(p.celular).slice(-9);
    if (cel.length === 9) agregar(porCelular, cel, p.id);
    const nombres = normalizar(p.nombre).split(" ").filter(Boolean);
    const apellidos = normalizar(p.apellido).split(" ").filter(Boolean);
    if (nombres.length && apellidos.length) {
      // "maria perez" y, si tiene segundo nombre, también "maria jose perez"
      agregar(porNombre, `${nombres[0]} ${apellidos[0]}`, p.id);
      if (nombres.length > 1) agregar(porNombre, `${nombres[0]} ${nombres[1]} ${apellidos[0]}`, p.id);
    }
  }
  indice = { porId, porDni, porCelular, porNombre };
  indiceCreado = Date.now();
  return indice;
};

/** Busca a qué paciente corresponde un texto libre. Solo devuelve coincidencias únicas. */
const detectarPaciente = (texto, idx) => {
  if (!texto) return null;
  // 1) DNI (7-8 dígitos) o celular (9 dígitos que empiezan con 9)
  const numeros = String(texto).match(/\d[\d\s-]{5,13}\d/g) || [];
  for (const bruto of numeros) {
    const n = soloDigitos(bruto);
    const porDni = idx.porDni.get(n);
    if (porDni?.length === 1) return porDni[0];
    if (n.length >= 9) {
      const porCel = idx.porCelular.get(n.slice(-9));
      if (porCel?.length === 1) return porCel[0];
    }
  }
  // 2) Nombre + apellido seguidos (con o sin segundo nombre)
  const palabras = normalizar(texto).split(" ").filter(Boolean);
  const candidatos = new Set();
  for (let i = 0; i < palabras.length; i++) {
    for (const largo of [3, 2]) {
      if (i + largo > palabras.length) continue;
      const ids = idx.porNombre.get(palabras.slice(i, i + largo).join(" "));
      if (ids?.length === 1) candidatos.add(ids[0]);
      else if (ids?.length > 1) ids.forEach((id) => candidatos.add(`ambiguo-${id}`));
    }
  }
  const unicos = [...candidatos].filter((c) => typeof c === "number");
  const hayAmbiguos = [...candidatos].some((c) => typeof c === "string");
  if (unicos.length === 1 && !hayAmbiguos) return unicos[0];
  return null;
};

/* ─────────────────────────── Eventos ─────────────────────────── */

const PRIVADO = "showclinic";
const FIRMA = "— Agendado desde ShowClinic";
const MARCA_DATOS = "— Datos de ShowClinic —";

const nombreCompleto = (p) =>
  [p?.nombre, p?.apellido].map((x) => String(x || "").trim()).filter(Boolean).join(" ");

/** Convierte un evento de Google al formato que usa la interfaz. */
const mapearEvento = (ev, idx, especialistasPorId) => {
  const priv = ev.extendedProperties?.private || {};
  const todoElDia = Boolean(ev.start?.date && !ev.start?.dateTime);
  const inicio = todoElDia ? ev.start.date : fechaHoraLima(new Date(ev.start?.dateTime));
  // En Google el fin de un evento de día completo es exclusivo; aquí se
  // devuelve el último día incluido, que es como lo entiende la clínica.
  let fin;
  if (todoElDia) {
    const d = new Date(`${ev.end?.date || ev.start.date}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - 1);
    fin = d.toISOString().slice(0, 10);
    if (fin < inicio) fin = inicio;
  } else {
    fin = fechaHoraLima(new Date(ev.end?.dateTime || ev.start?.dateTime));
  }

  let pacienteId = Number(priv.paciente_id) || null;
  let vinculo = pacienteId ? "manual" : null;
  if (pacienteId && !idx.porId.has(pacienteId)) {
    pacienteId = null; // la paciente fue eliminada del sistema
    vinculo = null;
  }
  if (!pacienteId && priv.sin_paciente !== "1") {
    pacienteId = detectarPaciente(`${ev.summary || ""}\n${ev.description || ""}`, idx);
    if (pacienteId) vinculo = "auto";
  }
  const p = pacienteId ? idx.porId.get(pacienteId) : null;
  const especialistaId = Number(priv.especialista_id) || null;
  const esp = especialistaId ? especialistasPorId.get(especialistaId) : null;

  return {
    id: ev.id,
    titulo: ev.summary || "(Sin título)",
    descripcion: ev.description || "",
    notas: priv.notas ?? null,
    inicio,
    fin,
    todoElDia,
    colorId: ev.colorId || null,
    estado: ev.status, // confirmed | tentative
    ubicacion: ev.location || "",
    enlace: ev.htmlLink || null,
    recurrente: Boolean(ev.recurringEventId),
    creadoDesde: priv.origen === PRIVADO ? "showclinic" : "google",
    creadoPor: priv.creado_por || ev.creator?.email || null,
    tratamiento: priv.tratamiento || null,
    especialistaId,
    especialistaNombre: esp?.nombre || priv.especialista_nombre || null,
    paciente: p
      ? {
          id: p.id,
          nombre: p.nombre,
          apellido: p.apellido,
          dni: p.dni,
          celular: p.celular,
          vinculo, // "manual" (elegida en ShowClinic) | "auto" (reconocida por nombre/DNI)
        }
      : null,
  };
};

const cargarEspecialistas = async () => {
  try {
    const filas = await dbAll("SELECT id, nombre FROM especialistas");
    return new Map(filas.map((e) => [e.id, e]));
  } catch {
    return new Map();
  }
};

/** Lista todas las citas entre dos fechas ("YYYY-MM-DD", fin exclusivo). */
export const listarEventos = async ({ desde, hasta, q, filtroPrivado } = {}) => {
  const cfg = await leerConfig();
  const items = [];
  let pageToken;
  let vueltas = 0;
  do {
    const params = {
      singleEvents: true,
      orderBy: "startTime",
      maxResults: 2500,
      timeZone: ZONA,
      pageToken,
    };
    if (desde) params.timeMin = aRFC3339(desde);
    if (hasta) params.timeMax = aRFC3339(hasta);
    if (q) params.q = q;
    if (filtroPrivado) params.privateExtendedProperty = filtroPrivado;
    const data = await llamar("get", `/calendars/${enc(cfg.calendarId)}/events`, { params });
    items.push(...(data.items || []));
    pageToken = data.nextPageToken;
    vueltas++;
  } while (pageToken && vueltas < 20);

  let [idx, especialistas] = await Promise.all([obtenerIndice(), cargarEspecialistas()]);
  // Una paciente registrada hace instantes todavía no está en el índice: se reconstruye.
  const faltaAlguna = items.some((ev) => {
    const id = Number(ev.extendedProperties?.private?.paciente_id);
    return id && !idx.porId.has(id);
  });
  if (faltaAlguna && Date.now() - indiceCreado > 3000) idx = await obtenerIndice({ forzar: true });
  return items.filter((ev) => ev.status !== "cancelled").map((ev) => mapearEvento(ev, idx, especialistas));
};

/** Citas de una paciente: las vinculadas en ShowClinic y las reconocidas por nombre/DNI. */
export const listarEventosPaciente = async (pacienteId, { desde, hasta }) => {
  const p = await dbGet("SELECT id, nombre, apellido, dni FROM patients WHERE id = ?", [pacienteId]);
  if (!p) throw new ErrorGoogle("Paciente no encontrada.", 404);
  const busquedas = [listarEventos({ desde, hasta, filtroPrivado: `paciente_id=${p.id}` })];
  const dni = soloDigitos(p.dni);
  if (dni.length >= 7) busquedas.push(listarEventos({ desde, hasta, q: dni }));
  const nombre = normalizar(p.nombre).split(" ")[0];
  const apellido = normalizar(p.apellido).split(" ")[0];
  if (nombre && apellido) busquedas.push(listarEventos({ desde, hasta, q: apellido }));

  const resultados = await Promise.all(busquedas);
  const vistos = new Map();
  resultados.flat().forEach((ev) => {
    if (ev.paciente?.id === p.id && !vistos.has(ev.id)) vistos.set(ev.id, ev);
  });
  return [...vistos.values()].sort((a, b) => a.inicio.localeCompare(b.inicio));
};

export const obtenerEvento = async (eventId) => {
  const cfg = await leerConfig();
  const ev = await llamar("get", `/calendars/${enc(cfg.calendarId)}/events/${enc(eventId)}`);
  const [idx, especialistas] = await Promise.all([obtenerIndice(), cargarEspecialistas()]);
  return { crudo: ev, cita: mapearEvento(ev, idx, especialistas) };
};

/**
 * Arma el cuerpo del evento para Google a partir de lo que llena la clínica.
 * El título y la descripción quedan legibles para quien mire Google Calendar
 * desde el celular; los IDs internos viajan en extendedProperties (ocultos).
 */
export const construirEvento = async (datos, { usuario, previo } = {}) => {
  const errores = [];
  const todoElDia = Boolean(datos.todoElDia);
  const { inicio, fin } = datos;
  if (todoElDia) {
    if (!esFecha(inicio)) errores.push("La fecha de la cita no es válida.");
    if (fin && !esFecha(fin)) errores.push("La fecha de fin no es válida.");
  } else {
    if (!esFechaHora(inicio)) errores.push("La fecha u hora de inicio no es válida.");
    if (!esFechaHora(fin)) errores.push("La hora de fin no es válida.");
  }
  if (!errores.length && fin && fin <= inicio && !(todoElDia && fin === inicio))
    errores.push("La hora de fin debe ser posterior a la de inicio.");

  let paciente = null;
  if (datos.pacienteId) {
    paciente = await dbGet("SELECT id, nombre, apellido, dni FROM patients WHERE id = ?", [datos.pacienteId]);
    if (!paciente) errores.push("La paciente seleccionada no existe.");
  }
  let especialista = null;
  if (datos.especialistaId) {
    especialista = await dbGet("SELECT id, nombre FROM especialistas WHERE id = ?", [datos.especialistaId]);
    if (!especialista) errores.push("El especialista seleccionado no existe.");
  }
  const tratamiento = String(datos.tratamiento || "").trim().slice(0, 200);
  const notas = String(datos.notas || "").trim().slice(0, 4000);
  let titulo = String(datos.titulo || "").trim().slice(0, 300);
  if (!titulo && paciente) {
    titulo = `${nombreCompleto(paciente)}${tratamiento ? ` – ${tratamiento}` : ""}`;
  }
  if (!titulo) errores.push("Escribe un título o elige una paciente.");
  if (datos.colorId && !/^(?:[1-9]|1[01])$/.test(String(datos.colorId))) errores.push("Color no válido.");

  if (errores.length) throw new ErrorGoogle(errores.join(" "), 400);

  const lineas = [];
  if (paciente) {
    lineas.push(`Paciente: ${nombreCompleto(paciente)}`);
    if (paciente.dni) lineas.push(`DNI: ${paciente.dni}`);
  }
  if (tratamiento) lineas.push(`Tratamiento: ${tratamiento}`);
  if (especialista) lineas.push(`Especialista: ${especialista.nombre}`);
  if (notas) lineas.push("", notas);

  const privPrevio = previo?.extendedProperties?.private || {};
  const priv = {
    ...privPrevio,
    origen: privPrevio.origen || (previo ? "google" : PRIVADO),
    creado_por: privPrevio.creado_por || usuario || "",
    paciente_id: paciente ? String(paciente.id) : "",
    sin_paciente: paciente ? "" : datos.sinPaciente ? "1" : "",
    especialista_id: especialista ? String(especialista.id) : "",
    especialista_nombre: especialista ? especialista.nombre.slice(0, 200) : "",
    tratamiento,
    notas,
  };

  // La descripción es lo que el equipo lee en Google desde el celular.
  // Si la cita se creó a mano en Google, se respeta lo que escribieron y los
  // datos de ShowClinic se agregan debajo (reemplazando los de una edición anterior).
  let descripcion;
  if (priv.origen === PRIVADO) {
    descripcion = [...lineas, ...(lineas.length ? [""] : []), FIRMA].join("\n");
  } else {
    const original = String(previo?.description || "").split(MARCA_DATOS)[0].trim();
    const bloque = lineas.length ? `${MARCA_DATOS}\n${lineas.join("\n")}` : "";
    descripcion = [original, bloque].filter(Boolean).join("\n\n");
  }

  const finReal = fin || inicio;
  const cuerpo = {
    summary: titulo,
    description: descripcion,
    colorId: datos.colorId ? String(datos.colorId) : null,
    extendedProperties: { private: priv },
  };
  if (todoElDia) {
    // En Google el fin de un evento de día completo es exclusivo (el día siguiente).
    const finExclusivo = new Date(`${finReal}T00:00:00Z`);
    finExclusivo.setUTCDate(finExclusivo.getUTCDate() + 1);
    cuerpo.start = { date: inicio, dateTime: null };
    cuerpo.end = { date: finExclusivo.toISOString().slice(0, 10), dateTime: null };
  } else {
    cuerpo.start = { dateTime: `${inicio}:00`, timeZone: ZONA, date: null };
    cuerpo.end = { dateTime: `${finReal}:00`, timeZone: ZONA, date: null };
  }
  return cuerpo;
};

/** Al crear, los campos en null sobran (en una edición sí sirven: borran el valor anterior). */
const sinNulos = (obj) => {
  if (Array.isArray(obj)) return obj.map(sinNulos);
  if (!obj || typeof obj !== "object") return obj;
  const limpio = {};
  for (const [k, v] of Object.entries(obj)) if (v !== null) limpio[k] = sinNulos(v);
  return limpio;
};

export const crearEvento = async (datos, usuario) => {
  const cfg = await leerConfig();
  const cuerpo = sinNulos(await construirEvento(datos, { usuario }));
  const ev = await llamar("post", `/calendars/${enc(cfg.calendarId)}/events`, { data: cuerpo });
  const [idx, especialistas] = await Promise.all([obtenerIndice({ forzar: true }), cargarEspecialistas()]);
  return mapearEvento(ev, idx, especialistas);
};

export const actualizarEvento = async (eventId, datos, usuario) => {
  const cfg = await leerConfig();
  const { crudo } = await obtenerEvento(eventId);
  const cuerpo = await construirEvento(datos, { usuario, previo: crudo });
  const ev = await llamar("patch", `/calendars/${enc(cfg.calendarId)}/events/${enc(eventId)}`, { data: cuerpo });
  const [idx, especialistas] = await Promise.all([obtenerIndice({ forzar: true }), cargarEspecialistas()]);
  return mapearEvento(ev, idx, especialistas);
};

/** Cambia solo fecha/hora (arrastrar o "reprogramar"), sin tocar el resto. */
export const moverEvento = async (eventId, { inicio, fin, todoElDia }) => {
  const cfg = await leerConfig();
  if (todoElDia) {
    if (!esFecha(inicio) || (fin && !esFecha(fin))) throw new ErrorGoogle("Fecha no válida.", 400);
  } else if (!esFechaHora(inicio) || !esFechaHora(fin) || fin <= inicio) {
    throw new ErrorGoogle("Horario no válido.", 400);
  }
  const datos = {};
  if (todoElDia) {
    const finExclusivo = new Date(`${fin || inicio}T00:00:00Z`);
    finExclusivo.setUTCDate(finExclusivo.getUTCDate() + 1);
    datos.start = { date: inicio, dateTime: null };
    datos.end = { date: finExclusivo.toISOString().slice(0, 10), dateTime: null };
  } else {
    datos.start = { dateTime: `${inicio}:00`, timeZone: ZONA, date: null };
    datos.end = { dateTime: `${fin}:00`, timeZone: ZONA, date: null };
  }
  const ev = await llamar("patch", `/calendars/${enc(cfg.calendarId)}/events/${enc(eventId)}`, { data: datos });
  const [idx, especialistas] = await Promise.all([obtenerIndice({ forzar: true }), cargarEspecialistas()]);
  return mapearEvento(ev, idx, especialistas);
};

export const eliminarEvento = async (eventId) => {
  const cfg = await leerConfig();
  try {
    await llamar("delete", `/calendars/${enc(cfg.calendarId)}/events/${enc(eventId)}`);
  } catch (err) {
    // Si ya no existe, el resultado es el mismo que se buscaba.
    if (err.status === 410 || err.status === 404) return;
    throw err;
  }
};

/* ─────────────────────────── Conexión ─────────────────────────── */

/**
 * Prueba la conexión antes de guardarla: que la llave funcione, que el
 * calendario exista y que la cuenta de servicio tenga permiso de escritura.
 */
export const probarConexion = async ({ credenciales, calendarId }) => {
  const config = { credenciales, calendarId };
  const email = credenciales.client_email;
  // Un calendario compartido no aparece solo en la lista de la cuenta de
  // servicio: se agrega para poder consultar el nivel de permiso.
  try {
    await llamar("post", "/users/me/calendarList", { data: { id: calendarId }, config });
  } catch (err) {
    if (err.status !== 409 && !/already exists|duplicate/i.test(err.message)) {
      if (err.status === 404 || err.status === 403) {
        throw new ErrorGoogle(
          `No se pudo acceder al calendario "${calendarId}". Ábrelo en Google Calendar → Configuración y uso compartido → "Compartir con personas específicas", agrega ${email} y elige "Hacer cambios en eventos".`,
          400
        );
      }
      throw err;
    }
  }
  let entrada;
  try {
    entrada = await llamar("get", `/users/me/calendarList/${enc(calendarId)}`, { config });
  } catch (err) {
    if (err.status === 404) {
      throw new ErrorGoogle(
        `No se pudo acceder al calendario "${calendarId}". Verifica que esté compartido con ${email}.`,
        400
      );
    }
    throw err;
  }
  const rol = entrada.accessRole;
  if (rol !== "owner" && rol !== "writer") {
    throw new ErrorGoogle(
      `El calendario está compartido solo para ver. Cambia el permiso de ${email} a "Hacer cambios en eventos".`,
      400
    );
  }
  return {
    nombre: entrada.summaryOverride || entrada.summary || calendarId,
    zonaHoraria: entrada.timeZone || null,
    rol,
  };
};

export default {
  leerConfig,
  guardarConfig,
  borrarConfig,
  estaConfigurado,
  validarCredenciales,
  probarConexion,
  listarEventos,
  listarEventosPaciente,
  crearEvento,
  actualizarEvento,
  moverEvento,
  eliminarEvento,
};
