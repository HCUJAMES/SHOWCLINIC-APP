/**
 * GOOGLE CALENDAR
 * ===============
 *
 * La clínica usa la cuenta de Google showclinicyanahuara@gmail.com con VARIOS
 * calendarios (uno por especialista: "Dra. Alicia Paez", "Carla Vargas", …),
 * cada uno con su color. ShowClinic lee todos esos calendarios y los muestra
 * juntos, con los mismos colores que se ven en Google.
 *
 * Dos formas de conectarse (se configura una sola vez en Agenda → ⚙️):
 *
 *  - "oauth" (recomendada): se inicia sesión con la cuenta de la clínica desde
 *    la computadora servidor. El sistema ve todos sus calendarios con sus
 *    colores, y los calendarios nuevos aparecen solos.
 *  - "service_account": un usuario-robot de Google al que se le comparte cada
 *    calendario. Se mantiene por compatibilidad con la primera versión.
 *
 * No usa librerías nuevas: tokens con jsonwebtoken/axios y la API REST.
 */

import crypto from "crypto";
import axios from "axios";
import jwt from "jsonwebtoken";
import { dbAll, dbGet, dbRun } from "../db/database.js";

export const ZONA = "America/Lima";
// Perú no tiene horario de verano: el desfase es siempre -05:00.
const OFFSET = "-05:00";

const API_BASE = process.env.GOOGLE_CALENDAR_API_BASE || "https://www.googleapis.com/calendar/v3";
const SCOPE = "https://www.googleapis.com/auth/calendar";
const TIMEOUT = 20000;
const PARALELO = 5; // consultas simultáneas a Google

export const redirectUriOAuth = () =>
  process.env.GOOGLE_OAUTH_REDIRECT || `http://localhost:${process.env.PORT || 4000}/api/calendario/oauth/callback`;

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

const parsear = (texto, porDefecto = null) => {
  try {
    return texto ? JSON.parse(texto) : porDefecto;
  } catch {
    return porDefecto;
  }
};

let cacheConfig = null;

export const leerConfig = async () => {
  if (cacheConfig) return cacheConfig;
  await asegurarTabla();
  const filas = await dbAll("SELECT clave, valor FROM google_calendar_config");
  const obj = {};
  filas.forEach((f) => (obj[f.clave] = f.valor));
  const credenciales = parsear(obj.service_account);
  const cliente = parsear(obj.oauth_cliente);
  const modo = obj.modo || (credenciales ? "service_account" : null);
  cacheConfig = {
    modo,
    credenciales,
    cliente,
    refreshToken: obj.oauth_refresh || null,
    cuenta: obj.cuenta || credenciales?.client_email || null,
    calendarId: obj.calendar_id || null, // calendario predeterminado para citas nuevas
    preferencias: parsear(obj.calendarios_pref, {}) || {},
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

const borrarClave = (clave) => dbRun("DELETE FROM google_calendar_config WHERE clave = ?", [clave]);

const olvidarCaches = () => {
  cacheConfig = null;
  tokenCache = null;
  cacheCalendarios = null;
};

export const borrarConfig = async () => {
  await asegurarTabla();
  // Las preferencias de calendarios (colores, especialistas) se conservan
  // por si se vuelve a conectar la misma cuenta.
  await dbRun("DELETE FROM google_calendar_config WHERE clave <> 'calendarios_pref'");
  olvidarCaches();
};

export const estaConfigurado = async () => {
  const c = await leerConfig();
  if (c.modo === "oauth") return Boolean(c.cliente && c.refreshToken);
  if (c.modo === "service_account") return Boolean(c.credenciales);
  return false;
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

/** Acepta el JSON del "ID de cliente de OAuth" tal como lo descarga Google. */
export const leerClienteOAuth = (json) => {
  const c = json?.web || json?.installed || json;
  if (!c || typeof c !== "object" || !c.client_id || !c.client_secret) {
    return {
      error:
        'Ese archivo no es un "ID de cliente de OAuth". En Google Cloud → Credenciales → Crear credenciales → ID de cliente de OAuth → Aplicación web, y descarga el JSON.',
    };
  }
  if (json?.installed) {
    return {
      error:
        'El cliente de OAuth es de tipo "Aplicación de escritorio". Crea uno de tipo "Aplicación web" con el URI de redirección indicado en la guía.',
    };
  }
  return {
    cliente: {
      client_id: c.client_id,
      client_secret: c.client_secret,
      auth_uri: c.auth_uri || "https://accounts.google.com/o/oauth2/auth",
      token_uri: c.token_uri || "https://oauth2.googleapis.com/token",
    },
  };
};

/* ─────────────────────────── Errores legibles ─────────────────────────── */

export class ErrorGoogle extends Error {
  constructor(message, status = 502) {
    super(message);
    this.status = status;
  }
}

const traducirError = (err, cfg) => {
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
  const oauth = cfg?.modo === "oauth";

  if (razon === "invalid_grant" || razon === "invalid_client" || status === 401)
    return new ErrorGoogle(
      oauth
        ? "La sesión de Google se cerró o fue revocada. Un administrador debe entrar a Agenda → ⚙️ y volver a iniciar sesión con Google."
        : "Google rechazó las credenciales. Es posible que la llave haya sido eliminada en Google Cloud: vuelve a conectar con una llave nueva.",
      502
    );
  if (razon === "accessNotConfigured" || /has not been used|is disabled/i.test(msgGoogle))
    return new ErrorGoogle(
      'La "Google Calendar API" no está activada en el proyecto de Google Cloud. Actívala y vuelve a intentar en unos minutos.',
      502
    );
  if (status === 404)
    return new ErrorGoogle(
      oauth
        ? "No se encontró el calendario o la cita en Google Calendar."
        : `No se encontró el calendario o la cita. Verifica que el calendario esté compartido con ${cfg?.cuenta || "la cuenta de servicio"}.`,
      404
    );
  if (status === 410) return new ErrorGoogle("Esa cita ya fue eliminada en Google Calendar.", 410);
  if (status === 403 && /rate|quota/i.test(razon + msgGoogle))
    return new ErrorGoogle("Google está limitando las consultas. Espera un momento y vuelve a intentar.", 429);
  if (status === 403)
    return new ErrorGoogle(
      oauth
        ? "La cuenta de Google conectada no tiene permiso para modificar ese calendario."
        : `El sistema no tiene permiso para modificar el calendario. Compártelo con ${cfg?.cuenta || "la cuenta de servicio"} con el permiso "Hacer cambios en eventos".`,
      403
    );
  if (status === 400)
    return new ErrorGoogle(`Google rechazó los datos de la cita: ${msgGoogle || "datos inválidos"}.`, 400);
  return new ErrorGoogle(`Error de Google Calendar (${status}). ${msgGoogle}`.trim(), 502);
};

/* ─────────────────────────── Token de acceso ─────────────────────────── */

let tokenCache = null; // { token, vence, clave }

const postFormulario = (url, campos) =>
  axios.post(url, new URLSearchParams(campos).toString(), {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    timeout: TIMEOUT,
  });

const obtenerToken = async (cfg) => {
  const ahora = Math.floor(Date.now() / 1000);
  const clave = cfg.modo === "oauth" ? `oauth:${cfg.refreshToken}` : `sa:${cfg.credenciales?.client_email}`;
  if (tokenCache && tokenCache.clave === clave && tokenCache.vence - 120 > ahora) return tokenCache.token;

  let data;
  try {
    if (cfg.modo === "oauth") {
      ({ data } = await postFormulario(cfg.cliente.token_uri, {
        grant_type: "refresh_token",
        refresh_token: cfg.refreshToken,
        client_id: cfg.cliente.client_id,
        client_secret: cfg.cliente.client_secret,
      }));
    } else {
      const cred = cfg.credenciales;
      const tokenUri = cred.token_uri || "https://oauth2.googleapis.com/token";
      let firmado;
      try {
        firmado = jwt.sign(
          { iss: cred.client_email, scope: SCOPE, aud: tokenUri, iat: ahora, exp: ahora + 3600 },
          cred.private_key,
          { algorithm: "RS256" }
        );
      } catch {
        throw new ErrorGoogle("La llave privada del archivo JSON no es válida. Descárgala de nuevo desde Google Cloud.", 400);
      }
      ({ data } = await postFormulario(tokenUri, {
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: firmado,
      }));
    }
  } catch (err) {
    throw traducirError(err, cfg);
  }
  tokenCache = { token: data.access_token, vence: ahora + Number(data.expires_in || 3600), clave };
  return data.access_token;
};

/** Llamada genérica a la API con la configuración indicada (o la guardada). */
const llamar = async (metodo, ruta, { params, data, config } = {}) => {
  const cfg = config || (await leerConfig());
  const listo = cfg.modo === "oauth" ? cfg.cliente && cfg.refreshToken : cfg.credenciales;
  if (!listo) throw new ErrorGoogle("Google Calendar todavía no está conectado.", 409);
  const token = await obtenerToken(cfg);
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
    return (await intentar()).data;
  } catch (err) {
    // Un error pasajero de Google (5xx) se reintenta una vez.
    if (err.response && err.response.status >= 500) {
      try {
        return (await intentar()).data;
      } catch (err2) {
        throw traducirError(err2, cfg);
      }
    }
    throw traducirError(err, cfg);
  }
};

const enc = encodeURIComponent;

/** Ejecuta tareas con un máximo de N a la vez. */
const enParalelo = async (items, fn, n = PARALELO) => {
  const resultados = new Array(items.length);
  let i = 0;
  const trabajador = async () => {
    while (i < items.length) {
      const k = i++;
      try {
        resultados[k] = { ok: true, valor: await fn(items[k], k) };
      } catch (error) {
        resultados[k] = { ok: false, error };
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, trabajador));
  return resultados;
};

/* ─────────────────────────── Inicio de sesión con Google ─────────────────────────── */

const solicitudesOAuth = new Map(); // state → { cliente, volverA, vence }

export const iniciarOAuth = ({ cliente, volverA }) => {
  const ahora = Date.now();
  for (const [k, v] of solicitudesOAuth) if (v.vence < ahora) solicitudesOAuth.delete(k);
  const state = crypto.randomBytes(24).toString("hex");
  solicitudesOAuth.set(state, { cliente, volverA, vence: ahora + 15 * 60 * 1000 });
  const params = new URLSearchParams({
    client_id: cliente.client_id,
    redirect_uri: redirectUriOAuth(),
    response_type: "code",
    scope: SCOPE,
    access_type: "offline",
    prompt: "consent", // asegura que Google entregue el permiso permanente
    include_granted_scopes: "true",
    state,
  });
  return `${cliente.auth_uri}?${params.toString()}`;
};

export const volverADe = (state) => solicitudesOAuth.get(state)?.volverA || null;

export const completarOAuth = async ({ code, state }) => {
  const solicitud = solicitudesOAuth.get(state);
  if (!solicitud || solicitud.vence < Date.now()) {
    throw new ErrorGoogle("El inicio de sesión con Google expiró. Vuelve a intentarlo desde la Agenda.", 400);
  }
  solicitudesOAuth.delete(state);
  const { cliente } = solicitud;
  let tokens;
  try {
    ({ data: tokens } = await postFormulario(cliente.token_uri, {
      grant_type: "authorization_code",
      code,
      client_id: cliente.client_id,
      client_secret: cliente.client_secret,
      redirect_uri: redirectUriOAuth(),
    }));
  } catch (err) {
    const msg = err.response?.data?.error_description || err.response?.data?.error || "";
    if (/redirect_uri/i.test(msg)) {
      throw new ErrorGoogle(
        `Google no reconoce el URI de redirección. En el cliente de OAuth agrega exactamente: ${redirectUriOAuth()}`,
        400
      );
    }
    throw traducirError(err, { modo: "oauth" });
  }
  if (!tokens.refresh_token) {
    throw new ErrorGoogle(
      "Google no entregó el permiso permanente. Entra a myaccount.google.com/permissions, quita el acceso de la app ShowClinic y vuelve a iniciar sesión.",
      400
    );
  }
  const config = { modo: "oauth", cliente, refreshToken: tokens.refresh_token };
  tokenCache = null;
  // El calendario principal tiene como ID el correo de la cuenta.
  const principal = await llamar("get", "/calendars/primary", { config });

  await asegurarTabla();
  const actual = await leerConfig();
  await guardarClave("modo", "oauth");
  await guardarClave("oauth_cliente", JSON.stringify(cliente));
  await guardarClave("oauth_refresh", tokens.refresh_token);
  await guardarClave("cuenta", principal.id);
  if (!actual.calendarId || actual.modo !== "oauth") await guardarClave("calendar_id", principal.id);
  await guardarClave("conectado_en", fechaHoraLima(new Date()));
  await borrarClave("service_account");
  olvidarCaches();
  return { cuenta: principal.id };
};

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

const finExclusivo = (ymd) => {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
};

/* ─────────────────────────── Colores (iguales a Google) ─────────────────────────── */

/**
 * La API devuelve el color de cada calendario con la paleta ANTIGUA de Google
 * (por ejemplo "#9fe1e7"), pero la web de Google Calendar los dibuja con la
 * paleta actual ("Pavo real" #039be5). Se traduce para que se vean idénticos.
 * Un color personalizado (que no está en la tabla) se usa tal cual.
 */
const PALETA_CALENDARIO = {
  "#ac725e": "#795548", // Cacao
  "#d06b64": "#e67c73", // Flamenco
  "#f83a22": "#d50000", // Tomate
  "#fa573c": "#f4511e", // Mandarina
  "#ff7537": "#ef6c00", // Calabaza
  "#ffad46": "#f09300", // Mango
  "#42d692": "#009688", // Eucalipto
  "#16a765": "#0b8043", // Albahaca
  "#7bd148": "#7cb342", // Pistacho
  "#b3dc6c": "#c0ca33", // Aguacate
  "#fbe983": "#e4c441", // Citrón
  "#fad165": "#f6bf26", // Plátano
  "#92e1c0": "#33b679", // Salvia
  "#9fe1e7": "#039be5", // Pavo real
  "#9fc6e7": "#4285f4", // Cobalto
  "#4986e7": "#3f51b5", // Arándano
  "#9a9cff": "#7986cb", // Lavanda
  "#b99aff": "#b39ddb", // Glicina
  "#c2c2c2": "#616161", // Grafito
  "#cabdbf": "#a79b8e", // Abedul
  "#cca6ac": "#ad1457", // Radicchio
  "#f691b2": "#d81b60", // Flor de cerezo
  "#cd74e6": "#8e24aa", // Uva
  "#a47ae2": "#9e69af", // Amatista
};

/** Colores propios de una cita (cuando en Google le eligen un color distinto al del calendario). */
const PALETA_EVENTO = {
  1: "#7986cb", // Lavanda
  2: "#33b679", // Salvia
  3: "#8e24aa", // Uva
  4: "#e67c73", // Flamenco
  5: "#f6bf26", // Plátano
  6: "#f4511e", // Mandarina
  7: "#039be5", // Pavo real
  8: "#616161", // Grafito
  9: "#3f51b5", // Arándano
  10: "#0b8043", // Albahaca
  11: "#d50000", // Tomate
};

const ORO = "#a36920";
const colorActual = (hex) => {
  const h = String(hex || "").toLowerCase();
  return PALETA_CALENDARIO[h] || (/^#[0-9a-f]{6}$/.test(h) ? h : null);
};

/* ─────────────────────────── Texto y especialistas ─────────────────────────── */

const normalizar = (s) =>
  String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9ñ\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const soloDigitos = (s) => String(s || "").replace(/\D/g, "");

const TITULOS = new Set(["dr", "dra", "doctor", "doctora", "lic", "licenciada", "licenciado", "de", "del", "la", "y"]);
const palabrasNombre = (s) => normalizar(s).split(" ").filter((p) => p.length > 1 && !TITULOS.has(p));

/**
 * ¿Este calendario es de este especialista? Compara las palabras del nombre:
 * "Dr. Erickson Espetia" ↔ "Dr. Erick Espetia", "DRA edith Carpio" ↔ "Dra. Edith Carpio".
 */
const puntaje = (nombreCal, nombreEsp) => {
  const a = palabrasNombre(nombreCal);
  const b = palabrasNombre(nombreEsp);
  if (!a.length || !b.length) return 0;
  const usadas = new Set();
  let coinciden = 0;
  for (const x of a) {
    const j = b.findIndex(
      (y, k) => !usadas.has(k) && (x === y || (Math.min(x.length, y.length) >= 4 && (x.startsWith(y) || y.startsWith(x))))
    );
    if (j >= 0) {
      usadas.add(j);
      coinciden++;
    }
  }
  if (coinciden >= 2 || (coinciden === 1 && a.length === 1 && b.length === 1)) return coinciden / Math.max(a.length, b.length);
  return 0;
};

const cargarEspecialistas = async () => {
  try {
    return await dbAll("SELECT id, nombre FROM especialistas");
  } catch {
    return [];
  }
};

/* ─────────────────────────── Calendarios ─────────────────────────── */

let cacheCalendarios = null; // { lista, creado }

// El calendario de cumpleaños aparece en "Mis calendarios" aunque sea de solo lectura
const esCumpleanos = (id) => /#contacts@group\.v\.calendar\.google\.com$/.test(id);

/**
 * Todos los calendarios de la cuenta, con el color de Google, el especialista
 * al que pertenecen y si se muestran en ShowClinic.
 */
export const listarCalendarios = async ({ forzar = false } = {}) => {
  if (!forzar && cacheCalendarios && Date.now() - cacheCalendarios.creado < 2 * 60 * 1000) {
    return cacheCalendarios.lista;
  }
  const cfg = await leerConfig();
  const items = [];
  let pageToken;
  let vueltas = 0;
  do {
    const data = await llamar("get", "/users/me/calendarList", {
      params: { maxResults: 250, showHidden: true, pageToken },
    });
    items.push(...(data.items || []));
    pageToken = data.nextPageToken;
    vueltas++;
  } while (pageToken && vueltas < 10);

  const especialistas = await cargarEspecialistas();
  const prefs = cfg.preferencias || {};

  const lista = items
    .filter((c) => !c.deleted)
    .map((c) => {
      const pref = prefs[c.id] || {};
      const nombre = c.summaryOverride || c.summary || c.id;
      const colorGoogle = colorActual(c.backgroundColor) || ORO;
      // Especialista: el elegido a mano o, si no, el que coincide por nombre
      let especialistaId = pref.especialistaId === undefined ? undefined : pref.especialistaId;
      let especialistaAuto = false;
      if (especialistaId === undefined) {
        let mejor = null;
        let mejorPuntaje = 0;
        let empate = false;
        for (const e of especialistas) {
          const p = puntaje(nombre, e.nombre);
          if (p > mejorPuntaje) {
            mejor = e;
            mejorPuntaje = p;
            empate = false;
          } else if (p > 0 && p === mejorPuntaje) empate = true;
        }
        especialistaId = mejor && !empate ? mejor.id : null;
        especialistaAuto = Boolean(especialistaId);
      }
      const esp = especialistas.find((e) => e.id === especialistaId);
      const escribible = c.accessRole === "owner" || c.accessRole === "writer";
      return {
        id: c.id,
        nombre,
        color: pref.color || colorGoogle,
        colorGoogle,
        colorPropio: Boolean(pref.color),
        rol: c.accessRole,
        escribible,
        principal: Boolean(c.primary),
        // Igual que en Google: todos los calendarios de la lista están disponibles
        // (salvo los que se ocultaron de la lista en Google o el administrador quite)…
        visible: pref.visible === undefined ? !c.hidden : Boolean(pref.visible),
        // …y cada uno empieza marcado o desmarcado tal como está en Google
        marcadoEnGoogle: Boolean(c.selected),
        grupo: c.accessRole === "owner" || esCumpleanos(c.id) ? "mios" : "otros",
        especialistaId: especialistaId || null,
        especialistaNombre: esp?.nombre || null,
        especialistaAuto,
      };
    })
    .sort((a, b) => Number(b.principal) - Number(a.principal) || a.nombre.localeCompare(b.nombre, "es"));

  cacheCalendarios = { lista, creado: Date.now() };
  return lista;
};

export const guardarPreferencias = async ({ preferencias, predeterminado }) => {
  await asegurarTabla();
  const calendarios = await listarCalendarios({ forzar: true });
  const ids = new Set(calendarios.map((c) => c.id));
  const limpias = {};
  for (const [id, p] of Object.entries(preferencias || {})) {
    if (!ids.has(id) || !p || typeof p !== "object") continue;
    const r = {};
    if (typeof p.visible === "boolean") r.visible = p.visible;
    if (p.especialistaId === null || Number.isInteger(p.especialistaId)) r.especialistaId = p.especialistaId;
    if (typeof p.color === "string" && /^#[0-9a-f]{6}$/i.test(p.color)) r.color = p.color.toLowerCase();
    limpias[id] = r;
  }
  await guardarClave("calendarios_pref", JSON.stringify(limpias));
  if (predeterminado) {
    const cal = calendarios.find((c) => c.id === predeterminado);
    if (!cal) throw new ErrorGoogle("El calendario predeterminado no existe.", 400);
    if (!cal.escribible) throw new ErrorGoogle("El calendario predeterminado debe permitir agregar citas.", 400);
    await guardarClave("calendar_id", predeterminado);
  }
  olvidarCaches();
  return listarCalendarios({ forzar: true });
};

/** Solo en modo cuenta de servicio: agrega un calendario que ya fue compartido. */
export const agregarCalendarioCompartido = async (calendarId) => {
  const cfg = await leerConfig();
  try {
    await llamar("post", "/users/me/calendarList", { data: { id: calendarId } });
  } catch (err) {
    if (err.status !== 409) {
      if (err.status === 404 || err.status === 403) {
        throw new ErrorGoogle(
          `No se pudo acceder al calendario "${calendarId}". Compártelo con ${cfg.cuenta} con el permiso "Hacer cambios en eventos".`,
          400
        );
      }
      throw err;
    }
  }
  if (!cfg.calendarId) await guardarClave("calendar_id", calendarId);
  olvidarCaches();
  return listarCalendarios({ forzar: true });
};

const calendarioPredeterminado = (cfg, calendarios) => {
  const escribibles = calendarios.filter((c) => c.escribible);
  return (
    escribibles.find((c) => c.id === cfg.calendarId) ||
    escribibles.find((c) => c.principal) ||
    escribibles[0] ||
    null
  );
};

/** Calendario donde se guarda una cita: el elegido, el del especialista o el predeterminado. */
const elegirCalendario = async ({ calendarId, especialistaId }) => {
  const cfg = await leerConfig();
  const calendarios = await listarCalendarios();
  if (calendarId) {
    const cal = calendarios.find((c) => c.id === calendarId);
    if (!cal) throw new ErrorGoogle("Ese calendario ya no existe en la cuenta de Google.", 400);
    if (!cal.escribible) throw new ErrorGoogle(`El calendario "${cal.nombre}" es de solo lectura.`, 403);
    return cal;
  }
  if (especialistaId) {
    const delEsp = calendarios.filter((c) => c.escribible && c.especialistaId === especialistaId);
    const cal = delEsp.find((c) => c.visible) || delEsp[0];
    if (cal) return cal;
  }
  const cal = calendarioPredeterminado(cfg, calendarios);
  if (!cal) throw new ErrorGoogle("No hay ningún calendario donde se puedan agregar citas.", 409);
  return cal;
};

/* ─────────────────────────── Vínculo con pacientes ─────────────────────────── */

/**
 * Índice de pacientes para reconocer citas creadas a mano en Google
 * (por ejemplo "María Pérez - Botox" o "Botox 73384766"). Se reconstruye
 * cada minuto como máximo.
 */
let indice = null;
let indiceCreado = 0;

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
  // 1) DNI (7-8 dígitos) o celular (9 dígitos)
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
const SEP = "::"; // id de cita = "<calendario>::<evento>" (los IDs se repiten entre calendarios)

const nombreCompleto = (p) =>
  [p?.nombre, p?.apellido].map((x) => String(x || "").trim()).filter(Boolean).join(" ");

/** Separa el id compuesto. Un id viejo (sin calendario) es del calendario predeterminado. */
const separarId = async (idCompuesto) => {
  const s = String(idCompuesto || "");
  const k = s.indexOf(SEP);
  if (k > 0) return { calendarId: s.slice(0, k), eventId: s.slice(k + SEP.length) };
  const cfg = await leerConfig();
  const cal = calendarioPredeterminado(cfg, await listarCalendarios());
  return { calendarId: cal?.id || cfg.calendarId, eventId: s };
};

/** Convierte un evento de Google al formato que usa la interfaz. */
const mapearEvento = (ev, cal, idx, especialistas) => {
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
  // Especialista: el elegido en ShowClinic o, si no, el dueño del calendario
  const especialistaId = Number(priv.especialista_id) || cal.especialistaId || null;
  const esp = especialistaId ? especialistas.find((e) => e.id === especialistaId) : null;

  return {
    id: `${cal.id}${SEP}${ev.id}`,
    calendarId: cal.id,
    calendarioNombre: cal.nombre,
    escribible: cal.escribible,
    titulo: ev.summary || "(Sin título)",
    descripcion: ev.description || "",
    notas: priv.notas ?? null,
    inicio,
    fin,
    todoElDia,
    colorId: ev.colorId || null,
    // Igual que en Google: el color propio de la cita o, si no tiene, el del calendario
    color: PALETA_EVENTO[ev.colorId] || cal.color,
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

const traerEventosCalendario = async (calendarId, { desde, hasta, q, filtroPrivado }) => {
  const items = [];
  let pageToken;
  let vueltas = 0;
  do {
    const params = { singleEvents: true, orderBy: "startTime", maxResults: 2500, timeZone: ZONA, pageToken };
    if (desde) params.timeMin = aRFC3339(desde);
    if (hasta) params.timeMax = aRFC3339(hasta);
    if (q) params.q = q;
    if (filtroPrivado) params.privateExtendedProperty = filtroPrivado;
    const data = await llamar("get", `/calendars/${enc(calendarId)}/events`, { params });
    items.push(...(data.items || []));
    pageToken = data.nextPageToken;
    vueltas++;
  } while (pageToken && vueltas < 20);
  return items.filter((ev) => ev.status !== "cancelled");
};

const mapearTodos = async (pares) => {
  let [idx, especialistas] = await Promise.all([obtenerIndice(), cargarEspecialistas()]);
  // Una paciente registrada hace instantes todavía no está en el índice: se reconstruye.
  const faltaAlguna = pares.some(({ ev }) => {
    const id = Number(ev.extendedProperties?.private?.paciente_id);
    return id && !idx.porId.has(id);
  });
  if (faltaAlguna && Date.now() - indiceCreado > 3000) idx = await obtenerIndice({ forzar: true });
  return pares.map(({ ev, cal }) => mapearEvento(ev, cal, idx, especialistas));
};

/**
 * Citas entre dos fechas ("YYYY-MM-DD", fin exclusivo) de todos los
 * calendarios visibles. Si un calendario falla, se informa sin perder el resto.
 */
export const listarEventos = async ({ desde, hasta, q, filtroPrivado, calendarios: soloEstos } = {}) => {
  const calendarios = soloEstos || (await listarCalendarios()).filter((c) => c.visible);
  const resultados = await enParalelo(calendarios, (cal) =>
    traerEventosCalendario(cal.id, { desde, hasta, q, filtroPrivado })
  );
  const pares = [];
  const avisos = [];
  resultados.forEach((r, i) => {
    const cal = calendarios[i];
    if (r.ok) r.valor.forEach((ev) => pares.push({ ev, cal }));
    else avisos.push(`No se pudo leer el calendario "${cal.nombre}": ${r.error.message}`);
  });
  // Si fallaron todos, es un problema general (sin internet, sesión cerrada…)
  if (calendarios.length && avisos.length === calendarios.length) {
    const primero = resultados.find((r) => !r.ok);
    throw primero.error instanceof ErrorGoogle ? primero.error : traducirError(primero.error, await leerConfig());
  }
  const eventos = (await mapearTodos(pares)).sort((a, b) => a.inicio.localeCompare(b.inicio));
  return { eventos, avisos };
};

/** Citas de una paciente: las vinculadas en ShowClinic y las reconocidas por nombre/DNI. */
export const listarEventosPaciente = async (pacienteId, { desde, hasta }) => {
  const p = await dbGet("SELECT id, nombre, apellido, dni FROM patients WHERE id = ?", [pacienteId]);
  if (!p) throw new ErrorGoogle("Paciente no encontrada.", 404);
  const calendarios = (await listarCalendarios()).filter((c) => c.visible);
  const busquedas = [listarEventos({ desde, hasta, filtroPrivado: `paciente_id=${p.id}`, calendarios })];
  const dni = soloDigitos(p.dni);
  if (dni.length >= 7) busquedas.push(listarEventos({ desde, hasta, q: dni, calendarios }));
  const apellido = normalizar(p.apellido).split(" ")[0];
  if (apellido) busquedas.push(listarEventos({ desde, hasta, q: apellido, calendarios }));

  const resultados = await Promise.all(busquedas);
  const vistos = new Map();
  resultados
    .flatMap((r) => r.eventos)
    .forEach((ev) => {
      if (ev.paciente?.id === p.id && !vistos.has(ev.id)) vistos.set(ev.id, ev);
    });
  return [...vistos.values()].sort((a, b) => a.inicio.localeCompare(b.inicio));
};

const buscarCalendario = async (calendarId) => {
  const calendarios = await listarCalendarios();
  return (
    calendarios.find((c) => c.id === calendarId) || {
      id: calendarId,
      nombre: calendarId,
      color: ORO,
      escribible: true,
      especialistaId: null,
    }
  );
};

const obtenerCrudo = (calendarId, eventId) =>
  llamar("get", `/calendars/${enc(calendarId)}/events/${enc(eventId)}`);

const mapearUno = async (ev, calendarId) => {
  const cal = await buscarCalendario(calendarId);
  const [idx, especialistas] = await Promise.all([obtenerIndice({ forzar: true }), cargarEspecialistas()]);
  return mapearEvento(ev, cal, idx, especialistas);
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
    // Sin color propio la cita toma el color del calendario, igual que en Google
    colorId: datos.colorId ? String(datos.colorId) : null,
    extendedProperties: { private: priv },
  };
  if (todoElDia) {
    cuerpo.start = { date: inicio, dateTime: null };
    cuerpo.end = { date: finExclusivo(finReal), dateTime: null };
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
  const cuerpo = sinNulos(await construirEvento(datos, { usuario }));
  const cal = await elegirCalendario(datos);
  const ev = await llamar("post", `/calendars/${enc(cal.id)}/events`, { data: cuerpo });
  return mapearUno(ev, cal.id);
};

export const actualizarEvento = async (idCompuesto, datos, usuario) => {
  const { calendarId, eventId } = await separarId(idCompuesto);
  const origen = await buscarCalendario(calendarId);
  if (!origen.escribible) throw new ErrorGoogle(`El calendario "${origen.nombre}" es de solo lectura.`, 403);
  const crudo = await obtenerCrudo(calendarId, eventId);
  const cuerpo = await construirEvento(datos, { usuario, previo: crudo });

  // ¿Cambió de calendario? (por ejemplo, se pasó la cita a otra especialista)
  let destino = calendarId;
  if (datos.calendarId && datos.calendarId !== calendarId) {
    const cal = await elegirCalendario({ calendarId: datos.calendarId });
    await llamar("post", `/calendars/${enc(calendarId)}/events/${enc(eventId)}/move`, {
      params: { destination: cal.id },
    });
    destino = cal.id;
  }
  const ev = await llamar("patch", `/calendars/${enc(destino)}/events/${enc(eventId)}`, { data: cuerpo });
  return mapearUno(ev, destino);
};

/** Cambia solo fecha/hora (arrastrar o "reprogramar"), sin tocar el resto. */
export const moverEvento = async (idCompuesto, { inicio, fin, todoElDia }) => {
  if (todoElDia) {
    if (!esFecha(inicio) || (fin && !esFecha(fin))) throw new ErrorGoogle("Fecha no válida.", 400);
  } else if (!esFechaHora(inicio) || !esFechaHora(fin) || fin <= inicio) {
    throw new ErrorGoogle("Horario no válido.", 400);
  }
  const { calendarId, eventId } = await separarId(idCompuesto);
  const cal = await buscarCalendario(calendarId);
  if (!cal.escribible) throw new ErrorGoogle(`El calendario "${cal.nombre}" es de solo lectura.`, 403);
  const datos = todoElDia
    ? { start: { date: inicio, dateTime: null }, end: { date: finExclusivo(fin || inicio), dateTime: null } }
    : {
        start: { dateTime: `${inicio}:00`, timeZone: ZONA, date: null },
        end: { dateTime: `${fin}:00`, timeZone: ZONA, date: null },
      };
  const ev = await llamar("patch", `/calendars/${enc(calendarId)}/events/${enc(eventId)}`, { data: datos });
  return mapearUno(ev, calendarId);
};

export const eliminarEvento = async (idCompuesto) => {
  const { calendarId, eventId } = await separarId(idCompuesto);
  const cal = await buscarCalendario(calendarId);
  if (!cal.escribible) throw new ErrorGoogle(`El calendario "${cal.nombre}" es de solo lectura.`, 403);
  try {
    await llamar("delete", `/calendars/${enc(calendarId)}/events/${enc(eventId)}`);
  } catch (err) {
    // Si ya no existe, el resultado es el mismo que se buscaba.
    if (err.status === 410 || err.status === 404) return;
    throw err;
  }
};

/* ─────────────────────────── Conexión con cuenta de servicio ─────────────────────────── */

/**
 * Prueba la conexión antes de guardarla: que la llave funcione, que el
 * calendario exista y que la cuenta de servicio tenga permiso de escritura.
 */
export const conectarCuentaServicio = async ({ credenciales, calendarId }) => {
  const config = { modo: "service_account", credenciales, cuenta: credenciales.client_email };
  const email = credenciales.client_email;
  tokenCache = null;
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
      throw new ErrorGoogle(`No se pudo acceder al calendario "${calendarId}". Verifica que esté compartido con ${email}.`, 400);
    }
    throw err;
  }
  if (entrada.accessRole !== "owner" && entrada.accessRole !== "writer") {
    throw new ErrorGoogle(
      `El calendario está compartido solo para ver. Cambia el permiso de ${email} a "Hacer cambios en eventos".`,
      400
    );
  }
  await asegurarTabla();
  await guardarClave("modo", "service_account");
  await guardarClave("service_account", JSON.stringify(credenciales));
  await guardarClave("cuenta", email);
  await guardarClave("calendar_id", calendarId);
  await guardarClave("conectado_en", fechaHoraLima(new Date()));
  await borrarClave("oauth_refresh");
  olvidarCaches();
  return { nombre: entrada.summaryOverride || entrada.summary || calendarId };
};

export default {
  leerConfig,
  borrarConfig,
  estaConfigurado,
  validarCredenciales,
  leerClienteOAuth,
  iniciarOAuth,
  completarOAuth,
  volverADe,
  conectarCuentaServicio,
  listarCalendarios,
  guardarPreferencias,
  agregarCalendarioCompartido,
  listarEventos,
  listarEventosPaciente,
  crearEvento,
  actualizarEvento,
  moverEvento,
  eliminarEvento,
};
