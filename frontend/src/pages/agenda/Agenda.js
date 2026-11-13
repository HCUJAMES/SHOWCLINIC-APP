/**
 * AGENDA — el Google Calendar de la clínica dentro de ShowClinic.
 *
 * Muestra las mismas citas que el equipo ve en su celular, pero cruzadas con
 * los datos del sistema: de quién es la cita, con qué especialista y qué
 * tratamiento. Lo que se agenda aquí aparece al instante en Google, y lo que
 * se agenda en Google aparece aquí (se refresca solo cada minuto).
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  Fab,
  IconButton,
  InputAdornment,
  LinearProgress,
  Menu,
  Paper,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
  useMediaQuery,
} from "@mui/material";
import {
  ArrowBack,
  Add,
  ChevronLeft,
  ChevronRight,
  Refresh,
  Settings,
  Search,
  Close,
  FilterList,
  CalendarMonth,
  ExpandMore,
  ExpandLess,
} from "../../iconos";
import { BRAND, FONTS } from "../../brand";
import { useToast } from "../../components/ToastProvider";
import useSocket from "../../hooks/useSocket";
import agendaApi, { mensajeError } from "./api";
import { colorCita } from "./colores";
import {
  hoy as hoyFn,
  rangoVista,
  tituloPeriodo,
  moverPeriodo,
  inicioSemana,
  sumarDias,
  cuadriculaMes,
  numeroDia,
  sumarMeses,
  nombreMes,
  citaEnDia,
  horaDe,
  textoDiaLargo,
  fechaDe,
} from "./fechas";
import VistaTiempo from "./VistaTiempo";
import VistaMes from "./VistaMes";
import VistaLista from "./VistaLista";
import CitaDialog from "./CitaDialog";
import DetalleCita from "./DetalleCita";
import ConfigurarGoogle from "./ConfigurarGoogle";
import RegistroRapidoPaciente, { sugerirDatosPaciente } from "./RegistroRapidoPaciente";

const VISTAS = [
  { id: "dia", label: "Día" },
  { id: "semana", label: "Semana" },
  { id: "mes", label: "Mes" },
  { id: "lista", label: "Lista" },
];

const guardarLocal = (k, v) => {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {
    /* modo privado: no pasa nada */
  }
};
const leerLocal = (k, porDefecto) => {
  try {
    const v = localStorage.getItem(k);
    return v ? JSON.parse(v) : porDefecto;
  } catch {
    return porDefecto;
  }
};

const normalizar = (s) =>
  String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

/* ─────────── Mini calendario lateral ─────────── */
function MiniCalendario({ fecha, vista, onElegir }) {
  const [mes, setMes] = useState(fecha.slice(0, 7) + "-01");
  useEffect(() => setMes(fecha.slice(0, 7) + "-01"), [fecha]);
  const hoy = hoyFn();
  const celdas = useMemo(() => cuadriculaMes(mes), [mes]);
  const { desde, hasta } = rangoVista(vista === "mes" ? "dia" : vista, fecha);

  return (
    <Box>
      <Box sx={{ display: "flex", alignItems: "center", mb: 0.5 }}>
        <Typography sx={{ flex: 1, fontWeight: 700, fontSize: 14, textTransform: "capitalize", pl: 0.5 }}>
          {nombreMes(mes)} {mes.slice(0, 4)}
        </Typography>
        <IconButton size="small" onClick={() => setMes(sumarMeses(mes, -1))} aria-label="Mes anterior">
          <ChevronLeft fontSize="small" />
        </IconButton>
        <IconButton size="small" onClick={() => setMes(sumarMeses(mes, 1))} aria-label="Mes siguiente">
          <ChevronRight fontSize="small" />
        </IconButton>
      </Box>
      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", textAlign: "center", rowGap: "2px" }}>
        {["L", "M", "M", "J", "V", "S", "D"].map((d, i) => (
          <Typography key={i} sx={{ fontSize: 10.5, color: BRAND.textoTenue, fontWeight: 600, py: 0.5 }}>
            {d}
          </Typography>
        ))}
        {celdas.map((d) => {
          const enRango = d >= desde && d < hasta;
          const esHoy = d === hoy;
          const fuera = d.slice(0, 7) !== mes.slice(0, 7);
          return (
            <Box
              key={d}
              role="button"
              tabIndex={0}
              onClick={() => onElegir(d)}
              onKeyDown={(e) => e.key === "Enter" && onElegir(d)}
              sx={{
                mx: "auto",
                width: 28,
                height: 28,
                borderRadius: "50%",
                display: "grid",
                placeItems: "center",
                fontSize: 12,
                cursor: "pointer",
                fontWeight: esHoy ? 700 : 500,
                bgcolor: esHoy ? BRAND.oro : enRango ? "rgba(186,154,99,0.22)" : "transparent",
                color: esHoy ? "#fff" : fuera ? BRAND.textoTenue : BRAND.texto,
                "&:hover": { bgcolor: esHoy ? BRAND.oroOscuro : "rgba(163,105,32,0.12)" },
              }}
            >
              {numeroDia(d)}
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}

/* ─────────── Calendarios (igual que "Mis calendarios" y "Otros calendarios" en Google) ─────────── */
function GrupoCalendarios({ titulo, lista, marcado, onAlternar, conteos }) {
  const [abierto, setAbierto] = useState(true);
  if (!lista.length) return null;
  return (
    <Box sx={{ mb: 1 }}>
      <Box
        role="button"
        tabIndex={0}
        onClick={() => setAbierto((v) => !v)}
        onKeyDown={(e) => e.key === "Enter" && setAbierto((v) => !v)}
        sx={{ display: "flex", alignItems: "center", cursor: "pointer", py: 0.5, pl: 0.5, borderRadius: 1.5, "&:hover": { bgcolor: "rgba(163,105,32,0.05)" } }}
      >
        <Typography sx={{ flex: 1, fontWeight: 700, fontSize: 13.5, color: BRAND.texto }}>{titulo}</Typography>
        {abierto ? <ExpandLess fontSize="small" sx={{ color: BRAND.textoSuave }} /> : <ExpandMore fontSize="small" sx={{ color: BRAND.textoSuave }} />}
      </Box>
      {abierto &&
        lista.map((c) => (
          <Box
            key={c.id}
            component="label"
            title={c.especialistaNombre ? `${c.nombre} · ${c.especialistaNombre}` : c.nombre}
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 0.5,
              borderRadius: 1.5,
              pr: 1,
              cursor: "pointer",
              "&:hover": { bgcolor: "rgba(163,105,32,0.05)" },
            }}
          >
            <Checkbox
              size="small"
              checked={marcado(c)}
              onChange={() => onAlternar(c)}
              sx={{ color: c.color, "&.Mui-checked": { color: c.color }, p: 0.75 }}
            />
            <Typography sx={{ fontSize: 13, flex: 1, minWidth: 0 }} noWrap>
              {c.nombre}
            </Typography>
            {conteos[c.id] > 0 && marcado(c) && (
              <Typography sx={{ fontSize: 11.5, color: BRAND.textoTenue }}>{conteos[c.id]}</Typography>
            )}
          </Box>
        ))}
    </Box>
  );
}

function FiltroCalendarios({ calendarios, marcado, onAlternar, onRestablecer, cambiado, conteos }) {
  return (
    <Box>
      {calendarios.length === 0 && (
        <Typography sx={{ fontSize: 12.5, color: BRAND.textoTenue, px: 0.5 }}>Cargando calendarios…</Typography>
      )}
      <GrupoCalendarios
        titulo="Mis calendarios"
        lista={calendarios.filter((c) => c.grupo !== "otros")}
        marcado={marcado}
        onAlternar={onAlternar}
        conteos={conteos}
      />
      <GrupoCalendarios
        titulo="Otros calendarios"
        lista={calendarios.filter((c) => c.grupo === "otros")}
        marcado={marcado}
        onAlternar={onAlternar}
        conteos={conteos}
      />
      {cambiado && (
        <Button size="small" onClick={onRestablecer} sx={{ fontSize: 12, mt: 0.5 }}>
          Marcar como en Google
        </Button>
      )}
    </Box>
  );
}

/* ─────────── Página ─────────── */
export default function Agenda() {
  const navigate = useNavigate();
  const location = useLocation();
  const { showToast } = useToast();
  const movil = useMediaQuery("(max-width:700px)");
  const ancho = useMediaQuery("(min-width:1100px)");

  const [estado, setEstado] = useState(null);
  const [errorEstado, setErrorEstado] = useState("");
  const [vista, setVista] = useState(() => leerLocal("agenda.vista", movil ? "dia" : "semana"));
  const [fecha, setFecha] = useState(hoyFn());
  const [citas, setCitas] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [errorCitas, setErrorCitas] = useState("");
  const [ultimaSync, setUltimaSync] = useState(null);
  const [especialistas, setEspecialistas] = useState([]);
  const [tratamientos, setTratamientos] = useState([]);
  const [calendarios, setCalendarios] = useState([]);
  const [predeterminado, setPredeterminado] = useState(null);
  const [avisos, setAvisos] = useState([]);
  // Casillas de calendarios: empiezan como están en Google; cada persona puede
  // cambiarlas en su pantalla (se recuerda solo en su navegador)
  const [marcas, setMarcas] = useState(() => leerLocal("agenda.calMarcas", {}));
  const [busqueda, setBusqueda] = useState("");
  const [detalle, setDetalle] = useState(null);
  const [formulario, setFormulario] = useState(null); // { cita } | { inicial }
  const [configAbierta, setConfigAbierta] = useState(false);
  const [registro, setRegistro] = useState(null); // cita para la que se registra una paciente nueva
  // Se calcula una sola vez por cita: así el formulario no se reinicia cuando la agenda se refresca
  const registroInicial = useMemo(
    () => (registro ? sugerirDatosPaciente(registro.titulo, registro.descripcion) : null),
    [registro]
  );
  const [menuFiltro, setMenuFiltro] = useState(null);

  const rango = useMemo(() => rangoVista(vista, fecha), [vista, fecha]);
  const pedido = useRef(0);

  useEffect(() => guardarLocal("agenda.vista", vista), [vista]);
  useEffect(() => guardarLocal("agenda.calMarcas", marcas), [marcas]);

  /* ───── Estado de la conexión ───── */
  const cargarEstado = useCallback(async () => {
    setErrorEstado("");
    try {
      setEstado(await agendaApi.estado());
    } catch (err) {
      setErrorEstado(mensajeError(err, "No se pudo consultar la agenda."));
    }
  }, []);
  useEffect(() => {
    cargarEstado();
  }, [cargarEstado]);

  // Calendarios de la cuenta de Google (nombres y colores)
  const cargarCalendarios = useCallback(async () => {
    try {
      const r = await agendaApi.calendarios();
      setCalendarios(r.calendarios || []);
      setPredeterminado(r.predeterminado || null);
    } catch {
      /* el error se muestra al cargar las citas */
    }
  }, []);
  useEffect(() => {
    if (estado?.configurado) cargarCalendarios();
  }, [estado?.configurado, cargarCalendarios]);

  // Vuelta del inicio de sesión con Google (?google=ok | error)
  useEffect(() => {
    const q = new URLSearchParams(location.search);
    const resultado = q.get("google");
    if (!resultado) return;
    const mensaje = q.get("mensaje") || "";
    if (resultado === "ok") {
      showToast({ severity: "success", message: `Google Calendar conectado${mensaje ? ` con ${mensaje}` : ""}` });
    } else {
      showToast({ severity: "error", message: mensaje || "No se pudo conectar con Google." });
    }
    navigate(location.pathname, { replace: true });
    cargarEstado();
  }, [location.search, location.pathname, navigate, showToast, cargarEstado]);

  // Especialistas y tratamientos para el formulario
  useEffect(() => {
    if (!estado?.configurado) return;
    agendaApi.especialistas().then(setEspecialistas).catch(() => setEspecialistas([]));
    agendaApi.tratamientos().then(setTratamientos).catch(() => setTratamientos([]));
  }, [estado?.configurado]);

  /* ───── Citas ───── */
  const cargarCitas = useCallback(
    async ({ silencioso = false } = {}) => {
      if (!estado?.configurado) return;
      const n = ++pedido.current;
      if (!silencioso) setCargando(true);
      try {
        const r = await agendaApi.listar(rango.desde, rango.hasta);
        if (n !== pedido.current) return;
        setCitas(r.eventos || []);
        setAvisos(r.avisos || []);
        setErrorCitas("");
        setUltimaSync(new Date());
      } catch (err) {
        if (n !== pedido.current) return;
        // 409 = el calendario se desconectó desde otro equipo: se vuelve a la pantalla de conexión
        if (err?.response?.status === 409) {
          cargarEstado();
          return;
        }
        setErrorCitas(mensajeError(err, "No se pudieron cargar las citas de Google Calendar."));
      } finally {
        if (n === pedido.current) setCargando(false);
      }
    },
    [estado?.configurado, rango.desde, rango.hasta, cargarEstado]
  );

  useEffect(() => {
    cargarCitas();
  }, [cargarCitas]);

  // Otro dispositivo agendó algo en ShowClinic → refrescar
  useSocket("agenda:updated", () => {
    cargarEstado();
    cargarCalendarios();
    cargarCitas({ silencioso: true });
  });

  // Lo agendado directamente en Google se trae cada minuto y al volver a la pestaña
  useEffect(() => {
    if (!estado?.configurado) return undefined;
    const tick = () => document.visibilityState === "visible" && cargarCitas({ silencioso: true });
    const t = setInterval(tick, 60000);
    document.addEventListener("visibilitychange", tick);
    window.addEventListener("focus", tick);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", tick);
      window.removeEventListener("focus", tick);
    };
  }, [estado?.configurado, cargarCitas]);

  // Llegar desde la ficha de una paciente: "Agendar cita" o clic en una de sus citas
  const [citaPendiente, setCitaPendiente] = useState(null);
  useEffect(() => {
    const st = location.state;
    if (!st || !estado?.configurado) return;
    if (st.nuevaCita) {
      setFormulario({ inicial: { inicio: `${hoyFn()}T09:00`, ...st.nuevaCita } });
    }
    if (st.irA && /^\d{4}-\d{2}-\d{2}$/.test(st.irA)) {
      setFecha(st.irA);
      setVista("dia");
      setCitaPendiente(st.citaId || null);
    }
    if (st.nuevaCita || st.irA) navigate(location.pathname, { replace: true, state: {} });
  }, [location.state, location.pathname, estado?.configurado, navigate]);

  useEffect(() => {
    if (!citaPendiente || cargando) return;
    const c = citas.find((x) => x.id === citaPendiente);
    if (c) setDetalle(c);
    if (c || ultimaSync) setCitaPendiente(null);
  }, [citas, citaPendiente, cargando, ultimaSync]);

  /* ───── Filtros ───── */
  const marcado = useCallback(
    (c) => (typeof marcas[c.id] === "boolean" ? marcas[c.id] : c.marcadoEnGoogle !== false),
    [marcas]
  );
  const ocultos = useMemo(() => calendarios.filter((c) => !marcado(c)).map((c) => c.id), [calendarios, marcado]);
  const alternarCalendario = (c) => setMarcas((m) => ({ ...m, [c.id]: !marcado(c) }));
  const marcasCambiadas = calendarios.some((c) => typeof marcas[c.id] === "boolean" && marcas[c.id] !== (c.marcadoEnGoogle !== false));

  const citasVisibles = useMemo(() => {
    const q = normalizar(busqueda.trim());
    return citas.filter((c) => {
      if (ocultos.includes(c.calendarId)) return false;
      if (!q) return true;
      const texto = normalizar(
        [c.titulo, c.tratamiento, c.especialistaNombre, c.calendarioNombre, c.paciente?.nombre, c.paciente?.apellido, c.paciente?.dni].join(" ")
      );
      return q.split(/\s+/).every((p) => texto.includes(p));
    });
  }, [citas, ocultos, busqueda]);

  const conteos = useMemo(() => {
    const m = {};
    citas.forEach((c) => {
      m[c.calendarId] = (m[c.calendarId] || 0) + 1;
    });
    return m;
  }, [citas]);

  const hoy = hoyFn();
  const citasHoy = useMemo(
    () =>
      citas
        .filter((c) => !ocultos.includes(c.calendarId) && citaEnDia(c, hoy))
        .sort((a, b) => a.inicio.localeCompare(b.inicio)),
    [citas, hoy, ocultos]
  );
  const hoyEnRango = hoy >= rango.desde && hoy < rango.hasta;

  /* ───── Acciones ───── */
  const irADia = (d) => {
    setFecha(d);
    setVista("dia");
  };

  const abrirNueva = (inicio) => setFormulario({ inicial: { inicio: inicio || `${fecha}T09:00` } });

  const alGuardar = (cita, accion) => {
    setFormulario(null);
    setDetalle(null);
    setCitas((prev) => [...prev.filter((c) => c.id !== cita.id), cita]);
    showToast({ severity: "success", message: accion === "creada" ? "Cita agendada en Google Calendar" : "Cita actualizada" });
    cargarCitas({ silencioso: true });
  };

  const alEliminar = (cita) => {
    setFormulario(null);
    setDetalle(null);
    setCitas((prev) => prev.filter((c) => c.id !== cita.id));
    showToast({ severity: "success", message: "Cita eliminada" });
    cargarCitas({ silencioso: true });
  };

  const moverCita = async (cita, inicio, fin) => {
    const anterior = cita;
    setCitas((prev) => prev.map((c) => (c.id === cita.id ? { ...c, inicio, fin } : c)));
    try {
      const actualizada = await agendaApi.mover(cita.id, { inicio, fin, todoElDia: false });
      setCitas((prev) => prev.map((c) => (c.id === cita.id ? actualizada : c)));
      showToast({
        severity: "success",
        message: `Cita movida al ${textoDiaLargo(fechaDe(inicio)).toLowerCase()} a las ${horaDe(inicio)}`,
      });
    } catch (err) {
      setCitas((prev) => prev.map((c) => (c.id === cita.id ? anterior : c)));
      showToast({ severity: "error", message: mensajeError(err, "No se pudo mover la cita.") });
    }
  };

  // Registrar a la persona de una cita como paciente nueva y dejarla vinculada
  const vincularPacienteNueva = async (paciente, origen) => {
    const cita = registro;
    setRegistro(null);
    try {
      const actualizada = await agendaApi.actualizar(cita.id, {
        titulo: cita.titulo,
        calendarId: cita.calendarId,
        pacienteId: paciente.id,
        sinPaciente: false,
        especialistaId: cita.especialistaId || null,
        tratamiento: cita.tratamiento || "",
        notas: cita.notas || "",
        inicio: cita.inicio,
        fin: cita.fin,
        todoElDia: cita.todoElDia,
        colorId: cita.colorId || null,
      });
      setCitas((prev) => prev.map((c) => (c.id === cita.id ? actualizada : c)));
      setDetalle(actualizada);
      showToast({
        severity: "success",
        message: origen === "nueva" ? "Paciente registrada y vinculada a la cita" : "Cita vinculada a la ficha de la paciente",
      });
      cargarCitas({ silencioso: true });
    } catch (err) {
      showToast({
        severity: "error",
        message: `${origen === "nueva" ? "La paciente se registró, pero no" : "No"} se pudo vincular a la cita: ${mensajeError(err, "error")}`,
      });
    }
  };

  const verPaciente = (p) => navigate("/historial-clinico", { state: { pacienteId: p.id } });

  /* ───── Pantallas especiales ───── */
  const Encabezado = (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: { xs: 1, sm: 1.5 },
        px: { xs: 1.5, sm: 3 },
        py: 1.5,
        borderBottom: `1px solid ${BRAND.borde}`,
        bgcolor: "rgba(255,255,255,0.85)",
        backdropFilter: "blur(8px)",
      }}
    >
      <IconButton onClick={() => navigate("/dashboard")} aria-label="Volver al inicio">
        <ArrowBack />
      </IconButton>
      <CalendarMonth sx={{ color: BRAND.oro, display: { xs: "none", sm: "inline-block" } }} />
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography sx={{ fontFamily: FONTS.titulo, fontSize: { xs: 22, sm: 26 }, color: BRAND.oro, lineHeight: 1.1, letterSpacing: "0.04em" }}>
          Agenda
        </Typography>
        {estado?.configurado && (
          <Typography noWrap sx={{ fontSize: 12, color: BRAND.textoTenue }}>
            <Box component="span" sx={{ display: "inline-block", width: 7, height: 7, borderRadius: "50%", bgcolor: errorCitas ? BRAND.error : BRAND.exito, mr: 0.75, verticalAlign: "middle" }} />
            Google Calendar · {estado.cuenta || "conectado"}
            {ultimaSync && !movil && ` · actualizado ${ultimaSync.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" })}`}
          </Typography>
        )}
      </Box>
      {estado?.configurado && (
        <>
          <Tooltip title="Actualizar">
            <span>
              <IconButton onClick={() => cargarCitas()} disabled={cargando} aria-label="Actualizar">
                <Refresh />
              </IconButton>
            </span>
          </Tooltip>
          {estado.puedeConfigurar && (
            <Tooltip title="Conexión con Google">
              <IconButton onClick={() => setConfigAbierta(true)} aria-label="Configurar conexión">
                <Settings />
              </IconButton>
            </Tooltip>
          )}
          {!movil && (
            <Button variant="contained" startIcon={<Add />} onClick={() => abrirNueva()}>
              Nueva cita
            </Button>
          )}
        </>
      )}
    </Box>
  );

  if (!estado) {
    return (
      <Box sx={{ minHeight: "100vh", bgcolor: BRAND.cremaClara }}>
        {Encabezado}
        <Box sx={{ display: "grid", placeItems: "center", py: 10, px: 2 }}>
          {errorEstado ? (
            <Alert severity="error" action={<Button onClick={cargarEstado}>Reintentar</Button>}>
              {errorEstado}
            </Alert>
          ) : (
            <CircularProgress sx={{ color: BRAND.oro }} />
          )}
        </Box>
      </Box>
    );
  }

  if (!estado.configurado) {
    return (
      <Box sx={{ minHeight: "100vh", bgcolor: BRAND.cremaClara }}>
        {Encabezado}
        <Box sx={{ maxWidth: 820, mx: "auto", p: { xs: 2, sm: 4 } }}>
          <Paper sx={{ p: { xs: 2.5, sm: 4 }, borderRadius: 3, border: `1px solid ${BRAND.borde}` }} elevation={0}>
            <Typography sx={{ fontFamily: FONTS.titulo, fontSize: 26, color: BRAND.oro, mb: 1 }}>
              Conecta el Google Calendar de la clínica
            </Typography>
            <Typography sx={{ color: BRAND.textoSuave, mb: 2, lineHeight: 1.7 }}>
              La agenda de ShowClinic muestra el mismo calendario que el equipo ya usa en sus celulares, con los datos de cada
              paciente. Las citas que se agenden aquí aparecen en Google al instante, y las de Google aparecen aquí.
            </Typography>
            {estado.puedeConfigurar ? (
              <ConfigurarGoogle
                estado={estado}
                onConectado={(r) => {
                  showToast({ severity: "success", message: `¡Listo! Conectado a ${r.calendarNombre}` });
                  cargarEstado();
                }}
              />
            ) : (
              <Alert severity="info">
                Google Calendar todavía no está conectado. Pide al administrador (usuario master o doctor) que lo conecte desde esta
                misma pantalla.
              </Alert>
            )}
          </Paper>
        </Box>
      </Box>
    );
  }

  /* ───── Agenda conectada ───── */
  const diasVista =
    vista === "dia" ? [fecha] : vista === "semana" ? Array.from({ length: 7 }, (_, i) => sumarDias(inicioSemana(fecha), i)) : [];
  const busquedaActiva = busqueda.trim().length > 0;

  return (
    <Box sx={{ height: "100dvh", display: "flex", flexDirection: "column", bgcolor: BRAND.cremaClara, overflow: "hidden" }}>
      {Encabezado}

      {/* Barra de navegación */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          px: { xs: 1.5, sm: 3 },
          py: 1.25,
          flexWrap: "wrap",
        }}
      >
        <Button variant="outlined" size="small" onClick={() => setFecha(hoyFn())}>
          Hoy
        </Button>
        <IconButton size="small" onClick={() => setFecha(moverPeriodo(vista, fecha, -1))} aria-label="Anterior">
          <ChevronLeft />
        </IconButton>
        <IconButton size="small" onClick={() => setFecha(moverPeriodo(vista, fecha, 1))} aria-label="Siguiente">
          <ChevronRight />
        </IconButton>
        <Typography sx={{ fontWeight: 700, fontSize: { xs: 15, sm: 18 }, color: BRAND.texto, mr: 1, textTransform: "none" }}>
          {tituloPeriodo(vista, fecha)}
        </Typography>
        {cargando && <CircularProgress size={16} sx={{ color: BRAND.arena }} />}

        <Box sx={{ flex: 1 }} />

        {!movil && (
          <TextField
            size="small"
            placeholder="Buscar paciente o tratamiento"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            sx={{ width: 250, bgcolor: "#fff", borderRadius: 1.5 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search fontSize="small" sx={{ color: BRAND.textoTenue }} />
                </InputAdornment>
              ),
              endAdornment: busqueda && (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={() => setBusqueda("")} aria-label="Limpiar búsqueda">
                    <Close fontSize="small" />
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />
        )}
        {!ancho && (
          <Tooltip title="Calendarios">
            <IconButton
              onClick={(e) => setMenuFiltro(e.currentTarget)}
              sx={{ color: marcasCambiadas ? BRAND.oro : undefined }}
              aria-label="Elegir calendarios"
            >
              <FilterList />
            </IconButton>
          </Tooltip>
        )}
        <ToggleButtonGroup
          size="small"
          exclusive
          value={vista}
          onChange={(_, v) => v && setVista(v)}
          sx={{
            bgcolor: "#fff",
            width: { xs: "100%", sm: "auto" },
            "& .MuiToggleButton-root": { px: { xs: 1, sm: 1.75 }, flex: { xs: 1, sm: "none" }, textTransform: "none", fontWeight: 600, border: `1px solid ${BRAND.borde}` },
            "& .Mui-selected": { bgcolor: "rgba(163,105,32,0.12) !important", color: `${BRAND.oro} !important` },
          }}
        >
          {VISTAS.map((v) => (
            <ToggleButton key={v.id} value={v.id}>
              {v.label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Box>

      {movil && (
        <Box sx={{ px: 1.5, pb: 1 }}>
          <TextField
            size="small"
            fullWidth
            placeholder="Buscar paciente o tratamiento"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            sx={{ bgcolor: "#fff" }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search fontSize="small" sx={{ color: BRAND.textoTenue }} />
                </InputAdornment>
              ),
            }}
          />
        </Box>
      )}

      {errorCitas && (
        <Alert
          severity="error"
          sx={{ mx: { xs: 1.5, sm: 3 }, mb: 1 }}
          action={
            <Button color="inherit" size="small" onClick={() => cargarCitas()}>
              Reintentar
            </Button>
          }
        >
          {errorCitas}
        </Alert>
      )}
      {avisos.length > 0 && !errorCitas && (
        <Alert severity="warning" sx={{ mx: { xs: 1.5, sm: 3 }, mb: 1 }}>
          {avisos.join(" · ")}
        </Alert>
      )}
      {busquedaActiva && (
        <Typography sx={{ px: { xs: 1.5, sm: 3 }, pb: 0.75, fontSize: 12.5, color: BRAND.textoSuave }}>
          {citasVisibles.length} {citasVisibles.length === 1 ? "cita coincide" : "citas coinciden"} con “{busqueda.trim()}” en este periodo
        </Typography>
      )}

      {/* Cuerpo */}
      <Box sx={{ flex: 1, minHeight: 0, display: "flex", gap: 2, px: { xs: 0, sm: 3 }, pb: { xs: 0, sm: 2 } }}>
        {ancho && (
          <Box sx={{ width: 250, flexShrink: 0, overflowY: "auto", display: "flex", flexDirection: "column", gap: 2.5, pr: 0.5 }}>
            <MiniCalendario fecha={fecha} vista={vista} onElegir={(d) => setFecha(d)} />
            <FiltroCalendarios
              calendarios={calendarios}
              marcado={marcado}
              onAlternar={alternarCalendario}
              onRestablecer={() => setMarcas({})}
              cambiado={marcasCambiadas}
              conteos={conteos}
            />
            {hoyEnRango && (
              <Box>
                <Typography sx={{ fontWeight: 700, fontSize: 13, letterSpacing: "0.04em", color: BRAND.textoSuave, mb: 0.75 }}>
                  HOY · {citasHoy.length} {citasHoy.length === 1 ? "CITA" : "CITAS"}
                </Typography>
                {citasHoy.length === 0 && <Typography sx={{ fontSize: 13, color: BRAND.textoTenue }}>No hay citas para hoy.</Typography>}
                {citasHoy.slice(0, 12).map((c) => (
                  <Box
                    key={c.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setDetalle(c)}
                    onKeyDown={(e) => e.key === "Enter" && setDetalle(c)}
                    sx={{ display: "flex", gap: 1, alignItems: "center", py: 0.5, px: 0.5, borderRadius: 1.5, cursor: "pointer", "&:hover": { bgcolor: "rgba(163,105,32,0.06)" } }}
                  >
                    <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: colorCita(c), flexShrink: 0 }} />
                    <Typography sx={{ fontSize: 12, color: BRAND.textoSuave, width: 40, flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>
                      {c.todoElDia ? "Día" : horaDe(c.inicio)}
                    </Typography>
                    <Typography noWrap sx={{ fontSize: 13 }}>
                      {c.paciente ? [c.paciente.nombre, c.paciente.apellido].filter(Boolean).join(" ") : c.titulo}
                    </Typography>
                  </Box>
                ))}
              </Box>
            )}
          </Box>
        )}

        <Paper
          elevation={0}
          sx={{
            flex: 1,
            minWidth: 0,
            minHeight: 0,
            position: "relative",
            borderRadius: { xs: 0, sm: 3 },
            overflow: "hidden",
            border: { xs: "none", sm: `1px solid ${BRAND.borde}` },
            borderTop: `1px solid ${BRAND.borde}`,
          }}
        >
          {cargando && <LinearProgress sx={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 10, height: 2 }} />}
          {(vista === "dia" || vista === "semana") && (
            <VistaTiempo
              dias={diasVista}
              citas={citasVisibles}
              alto="100%"
              onCrear={abrirNueva}
              onAbrir={setDetalle}
              onMover={moverCita}
              onIrADia={irADia}
            />
          )}
          {vista === "mes" && (
            <VistaMes
              fecha={fecha}
              citas={citasVisibles}
              alto="100%"
              onAbrir={setDetalle}
              onIrADia={irADia}
              onCrearDia={(d) => abrirNueva(`${d}T09:00`)}
            />
          )}
          {vista === "lista" && (
            <VistaLista desde={rango.desde} hasta={rango.hasta} citas={citasVisibles} alto="100%" onAbrir={setDetalle} />
          )}
        </Paper>
      </Box>

      {movil && (
        <Fab
          color="primary"
          onClick={() => abrirNueva()}
          aria-label="Nueva cita"
          sx={{ position: "fixed", right: 18, bottom: 22, boxShadow: "0 8px 22px rgba(163,105,32,0.35)" }}
        >
          <Add />
        </Fab>
      )}

      <Menu anchorEl={menuFiltro} open={Boolean(menuFiltro)} onClose={() => setMenuFiltro(null)} PaperProps={{ sx: { p: 1.5, width: 280 } }}>
        <FiltroCalendarios
              calendarios={calendarios}
              marcado={marcado}
              onAlternar={alternarCalendario}
              onRestablecer={() => setMarcas({})}
              cambiado={marcasCambiadas}
              conteos={conteos}
            />
      </Menu>

      <DetalleCita
        cita={detalle}
        onClose={() => setDetalle(null)}
        onEditar={(c) => {
          setDetalle(null);
          setFormulario({ cita: c });
        }}
        onVerPaciente={verPaciente}
        onRegistrarPaciente={(c) => {
          setDetalle(null);
          setRegistro(c);
        }}
      />

      <RegistroRapidoPaciente
        open={Boolean(registro)}
        inicial={registroInicial}
        onClose={() => setRegistro(null)}
        onCreada={vincularPacienteNueva}
      />

      <CitaDialog
        open={Boolean(formulario)}
        cita={formulario?.cita || null}
        inicial={formulario?.inicial || null}
        especialistas={especialistas}
        calendarios={calendarios}
        predeterminado={predeterminado}
        tratamientos={tratamientos}
        citasCargadas={citas}
        onClose={() => setFormulario(null)}
        onGuardado={alGuardar}
        onEliminado={alEliminar}
      />

      <Dialog open={configAbierta} onClose={() => setConfigAbierta(false)} maxWidth="lg" fullWidth fullScreen={movil}>
        <DialogTitle sx={{ display: "flex", alignItems: "center" }}>
          <Typography component="span" sx={{ flex: 1, fontWeight: 700, fontSize: 18 }}>
            Google Calendar
          </Typography>
          <IconButton onClick={() => setConfigAbierta(false)} aria-label="Cerrar">
            <Close />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          <ConfigurarGoogle
            estado={estado}
            onConectado={(r) => {
              setConfigAbierta(false);
              showToast({ severity: "success", message: `Conectado a ${r.calendarNombre}` });
              cargarEstado().then(() => {
                cargarCalendarios();
                cargarCitas();
              });
            }}
            onCalendariosGuardados={(lista) => {
              setCalendarios(lista.filter((c) => c.visible));
              cargarCalendarios();
              cargarCitas({ silencioso: true });
              showToast({ severity: "success", message: "Calendarios actualizados" });
            }}
            onDesconectado={() => {
              setConfigAbierta(false);
              setCitas([]);
              setCalendarios([]);
              showToast({ severity: "info", message: "Google Calendar desconectado" });
              cargarEstado();
            }}
          />
        </DialogContent>
      </Dialog>
    </Box>
  );
}
