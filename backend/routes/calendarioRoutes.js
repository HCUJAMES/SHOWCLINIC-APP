/**
 * AGENDA (Google Calendar)
 * Todas las rutas piden sesión iniciada, menos la vuelta del inicio de sesión
 * con Google (la llama el navegador al regresar de Google).
 * Conectar, desconectar y ajustar calendarios: solo master y doctor.
 * Ver y agendar citas: todo el equipo (igual que hoy en Google Calendar).
 */
import express from "express";
import { authMiddleware } from "../middleware/auth.js";
import gcal, { ErrorGoogle, esFecha, redirectUriOAuth } from "../services/googleCalendar.js";

const router = express.Router();

const ROLES_CONFIG = ["master", "doctor"];
const puedeConfigurar = (req) => ROLES_CONFIG.includes(req.user?.role);

const avisarCambio = (req) => {
  const io = req.app.get("io");
  if (io) io.emit("agenda:updated", { timestamp: Date.now() });
};

const responderError = (res, err, contexto) => {
  if (err instanceof ErrorGoogle) {
    return res.status(err.status || 502).json({ message: err.message });
  }
  console.error(`❌ Agenda (${contexto}):`, err);
  return res.status(500).json({ message: "Ocurrió un error inesperado en la agenda." });
};

const soloAdmin = (req, res, next) => {
  if (!puedeConfigurar(req)) {
    return res.status(403).json({ message: "Solo el administrador (master o doctor) puede hacer esto." });
  }
  next();
};

const sumarDias = (fecha, dias) => {
  const d = new Date(`${fecha}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
};

const hoyLima = () => new Date().toLocaleDateString("sv-SE", { timeZone: "America/Lima" });

/* ───────────── Vuelta del inicio de sesión con Google (sin token) ───────────── */

const urlVuelta = (volverA, resultado, mensaje) => {
  const base = /^https?:\/\/[^/\s]+$/i.test(volverA || "") ? volverA : "";
  const q = new URLSearchParams({ google: resultado });
  if (mensaje) q.set("mensaje", mensaje);
  return `${base}/agenda?${q.toString()}`;
};

router.get("/oauth/callback", async (req, res) => {
  const { code, state, error } = req.query;
  const volverA = gcal.volverADe(state);
  if (error) {
    const mensaje =
      error === "access_denied"
        ? "Se canceló el inicio de sesión con Google."
        : `Google respondió: ${String(error).slice(0, 120)}`;
    return res.redirect(urlVuelta(volverA, "error", mensaje));
  }
  if (!code || !state) return res.redirect(urlVuelta(volverA, "error", "Respuesta de Google incompleta."));
  try {
    const { cuenta } = await gcal.completarOAuth({ code: String(code), state: String(state) });
    const io = req.app.get("io");
    if (io) io.emit("agenda:updated", { timestamp: Date.now() });
    return res.redirect(urlVuelta(volverA, "ok", cuenta));
  } catch (err) {
    if (!(err instanceof ErrorGoogle)) console.error("❌ Agenda (oauth):", err);
    return res.redirect(urlVuelta(volverA, "error", err.message || "No se pudo completar la conexión."));
  }
});

router.use(authMiddleware);

/* ───────────── Estado y conexión ───────────── */

router.get("/estado", async (req, res) => {
  try {
    const cfg = await gcal.leerConfig();
    const configurado = await gcal.estaConfigurado();
    const admin = puedeConfigurar(req);
    res.json({
      configurado,
      modo: configurado ? cfg.modo : null,
      cuenta: configurado ? cfg.cuenta : null,
      conectadoEn: cfg.conectadoEn,
      puedeConfigurar: admin,
      redirectUri: admin ? redirectUriOAuth() : null,
    });
  } catch (err) {
    responderError(res, err, "estado");
  }
});

// Paso 1 del inicio de sesión: devuelve la dirección de Google a la que hay que ir
router.post("/oauth/iniciar", soloAdmin, async (req, res) => {
  try {
    let { cliente, volverA } = req.body || {};
    if (typeof cliente === "string") {
      try {
        cliente = JSON.parse(cliente);
      } catch {
        return res.status(400).json({ message: "El archivo del cliente de OAuth no es un JSON válido." });
      }
    }
    // Sin archivo nuevo se reutiliza el cliente ya guardado (para volver a iniciar sesión)
    let datos;
    if (cliente) {
      const r = gcal.leerClienteOAuth(cliente);
      if (r.error) return res.status(400).json({ message: r.error });
      datos = r.cliente;
    } else {
      const cfg = await gcal.leerConfig();
      if (!cfg.cliente) return res.status(400).json({ message: "Primero sube el archivo del cliente de OAuth." });
      datos = cfg.cliente;
    }
    const url = gcal.iniciarOAuth({ cliente: datos, volverA: String(volverA || "") });
    res.json({ url });
  } catch (err) {
    responderError(res, err, "oauth iniciar");
  }
});

// Conexión con cuenta de servicio (alternativa)
router.post("/conectar", soloAdmin, async (req, res) => {
  try {
    let { credenciales, calendarId } = req.body || {};
    if (typeof credenciales === "string") {
      try {
        credenciales = JSON.parse(credenciales);
      } catch {
        return res.status(400).json({ message: "El archivo de la llave no es un JSON válido." });
      }
    }
    if (!credenciales) {
      const actual = await gcal.leerConfig();
      credenciales = actual.credenciales;
    }
    const errorCred = gcal.validarCredenciales(credenciales);
    if (errorCred) return res.status(400).json({ message: errorCred });
    calendarId = String(calendarId || "").trim();
    if (!calendarId) return res.status(400).json({ message: "Escribe el ID del calendario." });

    const info = await gcal.conectarCuentaServicio({ credenciales, calendarId });
    avisarCambio(req);
    res.json({ ok: true, calendarNombre: info.nombre });
  } catch (err) {
    responderError(res, err, "conectar");
  }
});

router.delete("/conectar", soloAdmin, async (req, res) => {
  try {
    await gcal.borrarConfig();
    avisarCambio(req);
    res.json({ ok: true });
  } catch (err) {
    responderError(res, err, "desconectar");
  }
});

/* ───────────── Calendarios ───────────── */

router.get("/calendarios", async (req, res) => {
  try {
    if (!(await gcal.estaConfigurado())) return res.json({ calendarios: [], predeterminado: null });
    const forzar = req.query.forzar === "1";
    const todos = await gcal.listarCalendarios({ forzar });
    const cfg = await gcal.leerConfig();
    const admin = puedeConfigurar(req) && req.query.todos === "1";
    res.json({
      calendarios: admin ? todos : todos.filter((c) => c.visible),
      predeterminado: cfg.calendarId,
    });
  } catch (err) {
    responderError(res, err, "calendarios");
  }
});

router.put("/calendarios", soloAdmin, async (req, res) => {
  try {
    const { preferencias, predeterminado } = req.body || {};
    const calendarios = await gcal.guardarPreferencias({ preferencias, predeterminado });
    avisarCambio(req);
    res.json({ calendarios });
  } catch (err) {
    responderError(res, err, "guardar calendarios");
  }
});

router.post("/calendarios/agregar", soloAdmin, async (req, res) => {
  try {
    const id = String(req.body?.calendarId || "").trim();
    if (!id) return res.status(400).json({ message: "Escribe el ID del calendario." });
    const calendarios = await gcal.agregarCalendarioCompartido(id);
    avisarCambio(req);
    res.json({ calendarios });
  } catch (err) {
    responderError(res, err, "agregar calendario");
  }
});

/* ───────────── Citas ───────────── */

router.get("/eventos", async (req, res) => {
  try {
    const { desde, hasta } = req.query;
    if (!esFecha(desde) || !esFecha(hasta) || hasta <= desde) {
      return res.status(400).json({ message: "Rango de fechas no válido." });
    }
    if (hasta > sumarDias(desde, 120)) {
      return res.status(400).json({ message: "El rango máximo es de 120 días." });
    }
    if (!(await gcal.estaConfigurado())) {
      return res.status(409).json({ message: "Google Calendar todavía no está conectado." });
    }
    res.json(await gcal.listarEventos({ desde, hasta }));
  } catch (err) {
    responderError(res, err, "listar");
  }
});

router.get("/paciente/:id/eventos", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ message: "Paciente no válida." });
    if (!(await gcal.estaConfigurado())) return res.json({ configurado: false, eventos: [] });
    const hoy = hoyLima();
    const desde = esFecha(req.query.desde) ? req.query.desde : sumarDias(hoy, -365);
    const hasta = esFecha(req.query.hasta) ? req.query.hasta : sumarDias(hoy, 365);
    const eventos = await gcal.listarEventosPaciente(id, { desde, hasta });
    res.json({ configurado: true, eventos });
  } catch (err) {
    responderError(res, err, "citas paciente");
  }
});

const leerDatosCita = (body = {}) => ({
  titulo: body.titulo,
  calendarId: body.calendarId ? String(body.calendarId) : null,
  pacienteId: body.pacienteId ? Number(body.pacienteId) : null,
  sinPaciente: Boolean(body.sinPaciente),
  especialistaId: body.especialistaId ? Number(body.especialistaId) : null,
  tratamiento: body.tratamiento,
  notas: body.notas,
  inicio: body.inicio,
  fin: body.fin,
  todoElDia: Boolean(body.todoElDia),
  colorId: body.colorId || null,
});

router.post("/eventos", async (req, res) => {
  try {
    const cita = await gcal.crearEvento(leerDatosCita(req.body), req.user?.username);
    avisarCambio(req);
    res.status(201).json(cita);
  } catch (err) {
    responderError(res, err, "crear");
  }
});

router.put("/eventos/:id", async (req, res) => {
  try {
    const cita = await gcal.actualizarEvento(req.params.id, leerDatosCita(req.body), req.user?.username);
    avisarCambio(req);
    res.json(cita);
  } catch (err) {
    responderError(res, err, "editar");
  }
});

router.patch("/eventos/:id/mover", async (req, res) => {
  try {
    const { inicio, fin, todoElDia } = req.body || {};
    const cita = await gcal.moverEvento(req.params.id, { inicio, fin, todoElDia: Boolean(todoElDia) });
    avisarCambio(req);
    res.json(cita);
  } catch (err) {
    responderError(res, err, "mover");
  }
});

router.delete("/eventos/:id", async (req, res) => {
  try {
    await gcal.eliminarEvento(req.params.id);
    avisarCambio(req);
    res.json({ ok: true });
  } catch (err) {
    responderError(res, err, "eliminar");
  }
});

export default router;
