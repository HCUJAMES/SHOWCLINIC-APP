/**
 * AGENDA (Google Calendar)
 * Todas las rutas piden sesión iniciada. Conectar o desconectar el calendario
 * solo lo pueden hacer master y doctor; ver y agendar citas, todo el equipo
 * (igual que hoy en Google Calendar).
 */
import express from "express";
import { authMiddleware } from "../middleware/auth.js";
import gcal, { ErrorGoogle, esFecha } from "../services/googleCalendar.js";

const router = express.Router();
router.use(authMiddleware);

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

const sumarDias = (fecha, dias) => {
  const d = new Date(`${fecha}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
};

const hoyLima = () => new Date().toLocaleDateString("sv-SE", { timeZone: "America/Lima" });

/* ───────────── Estado y conexión ───────────── */

router.get("/estado", async (req, res) => {
  try {
    const cfg = await gcal.leerConfig();
    const configurado = Boolean(cfg.credenciales && cfg.calendarId);
    res.json({
      configurado,
      calendarNombre: cfg.calendarNombre || null,
      calendarId: configurado && puedeConfigurar(req) ? cfg.calendarId : null,
      cuentaServicio: configurado && puedeConfigurar(req) ? cfg.credenciales.client_email : null,
      conectadoEn: cfg.conectadoEn,
      puedeConfigurar: puedeConfigurar(req),
    });
  } catch (err) {
    responderError(res, err, "estado");
  }
});

router.post("/conectar", async (req, res) => {
  if (!puedeConfigurar(req)) {
    return res.status(403).json({ message: "Solo el administrador puede conectar Google Calendar." });
  }
  try {
    let { credenciales, calendarId } = req.body || {};
    if (typeof credenciales === "string") {
      try {
        credenciales = JSON.parse(credenciales);
      } catch {
        return res.status(400).json({ message: "El archivo de la llave no es un JSON válido." });
      }
    }
    // Si no se manda una llave nueva, se reutiliza la guardada (para cambiar solo el calendario).
    if (!credenciales) {
      const actual = await gcal.leerConfig();
      credenciales = actual.credenciales;
    }
    const errorCred = gcal.validarCredenciales(credenciales);
    if (errorCred) return res.status(400).json({ message: errorCred });

    calendarId = String(calendarId || "").trim();
    if (!calendarId) return res.status(400).json({ message: "Escribe el ID del calendario." });

    const info = await gcal.probarConexion({ credenciales, calendarId });
    await gcal.guardarConfig({ credenciales, calendarId, calendarNombre: info.nombre });
    avisarCambio(req);
    res.json({ ok: true, calendarNombre: info.nombre, zonaHoraria: info.zonaHoraria });
  } catch (err) {
    responderError(res, err, "conectar");
  }
});

router.delete("/conectar", async (req, res) => {
  if (!puedeConfigurar(req)) {
    return res.status(403).json({ message: "Solo el administrador puede desconectar Google Calendar." });
  }
  try {
    await gcal.borrarConfig();
    avisarCambio(req);
    res.json({ ok: true });
  } catch (err) {
    responderError(res, err, "desconectar");
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
    const eventos = await gcal.listarEventos({ desde, hasta });
    res.json(eventos);
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
