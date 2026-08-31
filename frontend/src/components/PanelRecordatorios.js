import React, { useCallback, useEffect, useState } from "react";
import { Box, Typography, IconButton, Badge, Tooltip, CircularProgress } from "@mui/material";
import {
  NotificationsActiveRounded,
  CloseRounded,
  PhoneRounded,
  EventRepeatRounded,
  CheckRounded,
  CakeRounded,
  ChevronLeftRounded,
  ChevronRightRounded,
  ExpandMoreRounded,
  UndoRounded,
  HandshakeRounded,
  CloseRounded as DescartarRounded,
  DescriptionRounded,
} from "@mui/icons-material";
import { motion, AnimatePresence } from "framer-motion";

/**
 * Aviso lateral de retoques pendientes y cumpleaños del mes.
 *
 * Cada tratamiento tiene su ciclo: la toxina (botox / modulaciones) se repite
 * cada 4 meses y el resto cada 10 meses. El backend calcula quién ya venció o
 * está por vencer; aquí solo se presenta.
 *
 * En ambas pestañas el ✓ marca a la persona como ya atendida y la saca de la
 * lista. Las marcadas no se pierden: quedan en la sección de abajo, donde se
 * puede deshacer la marca en cualquier momento (también días después, porque
 * la marca vive en la base de datos, no solo en pantalla).
 *
 * Al hacer clic en un paciente se abre su historial clínico.
 */

const ORO = "#A36920";
const ORO_OSCURO = "#8A5A1A";
const CREMA = "#FAF8F5";
const CAFE = "#3E2723";
const VERDE = "#2E7D32";

const MotionBox = motion(Box);

const MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio",
               "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

const iniciales = (nombre = "", apellido = "") =>
  `${(nombre || "").trim()[0] || ""}${(apellido || "").trim()[0] || ""}`.toUpperCase() || "?";

const nombreCompleto = (r) =>
  `${r?.nombre || ""} ${r?.apellido || ""}`.trim() || "Sin nombre";

// "vencido hace 33 días" / "en 12 días" / "hoy"
const textoPlazo = (dias) => {
  if (dias === 0) return "toca hoy";
  if (dias < 0) {
    const d = Math.abs(dias);
    if (d >= 30) {
      const m = Math.round(d / 30);
      return `venció hace ${m} ${m === 1 ? "mes" : "meses"}`;
    }
    return `venció hace ${d} ${d === 1 ? "día" : "días"}`;
  }
  return `en ${dias} ${dias === 1 ? "día" : "días"}`;
};

const soles = (n) => `S/ ${Math.round(Number(n) || 0).toLocaleString("es-PE")}`;

// "hace 3 meses" cuando ya pasó mucho; en días cuando es reciente
const tiempoDesdeConsulta = (dias) => {
  if (dias == null) return "sin fecha";
  if (dias <= 0) return "vino hoy";
  if (dias === 1) return "vino ayer";
  if (dias < 30) return `hace ${dias} días`;
  const m = Math.round(dias / 30);
  return `hace ${m} ${m === 1 ? "mes" : "meses"}`;
};

// "hoy" / "ayer" / "hace 5 días"
const desdeCuando = (fecha) => {
  if (!fecha) return "";
  const f = new Date(String(fecha).replace(" ", "T"));
  if (isNaN(f)) return "";
  const hoy = new Date();
  const dias = Math.floor((hoy.setHours(0, 0, 0, 0) - f.setHours(0, 0, 0, 0)) / 86400000);
  if (dias <= 0) return "hoy";
  if (dias === 1) return "ayer";
  return `hace ${dias} días`;
};

/**
 * Botón circular de check, igual en las dos pestañas.
 * Va fuera del componente a propósito: si se declarara dentro, React lo
 * remontaría en cada render y se perdería la animación al marcarlo.
 */
function BotonCheck({ hecho, onClick, titulo }) {
  return (
    <Tooltip title={titulo} arrow placement="left">
      <MotionBox
        component="button"
        aria-label={titulo}
        onClick={onClick}
        whileTap={{ scale: 0.85 }}
        animate={hecho ? { scale: [1, 1.25, 1] } : { scale: 1 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        sx={{
          flexShrink: 0, width: 30, height: 30, p: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          borderRadius: "50%", cursor: "pointer",
          border: `1.5px solid ${hecho ? VERDE : "rgba(163,105,32,0.30)"}`,
          background: hecho ? VERDE : "transparent",
          color: hecho ? "#fff" : "rgba(163,105,32,0.55)",
          transition: "background .2s ease, border-color .2s ease, color .2s ease",
          "&:hover": {
            background: hecho ? VERDE : "rgba(46,125,50,0.12)",
            borderColor: VERDE,
            color: hecho ? "#fff" : VERDE,
          },
        }}
      >
        <CheckRounded sx={{ fontSize: 17 }} />
      </MotionBox>
    </Tooltip>
  );
}

/**
 * Bloque plegable con los ya marcados y su botón de deshacer.
 * También se declara fuera para que no se remonte y el desplegable conserve
 * su animación de apertura.
 */
function SeccionMarcados({ marcados, esCumples, esSeguimiento, abiertaLista, onAlternar, deshaciendo, onDeshacer }) {
  if (!marcados.length) return null;

  const etiqueta = esCumples
    ? `${marcados.length} ${marcados.length === 1 ? "saludada" : "saludadas"}`
    : esSeguimiento
      ? `${marcados.length} ${marcados.length === 1 ? "gestionado" : "gestionados"}`
      : `${marcados.length} ${marcados.length === 1 ? "contactado" : "contactados"}`;

  return (
    <MotionBox layout>
      <MotionBox
        layout
        onClick={onAlternar}
        whileTap={{ scale: 0.985 }}
        sx={{
          display: "flex", alignItems: "center", gap: 0.7,
          px: 1.2, py: 0.85, borderRadius: "12px", cursor: "pointer",
          background: abiertaLista ? "rgba(46,125,50,0.10)" : "transparent",
          border: "1px dashed rgba(46,125,50,0.35)",
          transition: "background .2s ease",
          "&:hover": { background: "rgba(46,125,50,0.10)" },
        }}
      >
        <CheckRounded sx={{ fontSize: 15, color: VERDE }} />
        <Typography sx={{ flex: 1, fontSize: 11.8, fontWeight: 700, color: VERDE }}>
          {etiqueta}
        </Typography>
        <Typography sx={{ fontSize: 10.8, color: "#7A8E7C", fontWeight: 600 }}>
          {abiertaLista ? "ocultar" : "deshacer"}
        </Typography>
        <ExpandMoreRounded
          sx={{
            fontSize: 17, color: VERDE,
            transform: abiertaLista ? "rotate(180deg)" : "none",
            transition: "transform .25s ease",
          }}
        />
      </MotionBox>

      <AnimatePresence initial={false}>
        {abiertaLista && (
          <MotionBox
            key="marcados"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            sx={{ overflow: "hidden" }}
          >
            <Box sx={{ pt: 0.8 }}>
              {marcados.map((m) => {
                const clave = esCumples ? `cumple-${m.paciente_id}`
                  : esSeguimiento ? `seg-${m.paciente_id}`
                  : `${m.paciente_id}-${m.tratamiento}`;
                const ocupado = deshaciendo === clave;
                return (
                  <Box
                    key={clave}
                    sx={{
                      display: "flex", alignItems: "center", gap: 1,
                      p: 1, mb: 0.6, borderRadius: "12px",
                      background: "rgba(46,125,50,0.06)",
                      border: "1px solid rgba(46,125,50,0.16)",
                      opacity: ocupado ? 0.5 : 1,
                      transition: "opacity .2s ease",
                    }}
                  >
                    <Box sx={{
                      width: 26, height: 26, borderRadius: "50%", flexShrink: 0,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      background: "rgba(46,125,50,0.16)", color: VERDE,
                      fontSize: 10.5, fontWeight: 700, fontFamily: "'Poppins', sans-serif",
                    }}>
                      {iniciales(m.nombre, m.apellido)}
                    </Box>

                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ fontSize: 12, fontWeight: 700, color: CAFE }} noWrap>
                        {nombreCompleto(m)}
                      </Typography>
                      <Typography sx={{ fontSize: 10.5, color: "#7A8E7C" }} noWrap>
                        {esCumples
                          ? `Saludada ${desdeCuando(m.saludado_en)}`
                          : esSeguimiento
                            ? `${m.estado === "descartado" ? "Descartado" : "Contactado"} ${desdeCuando(m.actualizado_en)}`
                            : `Contactado ${desdeCuando(m.contactado_en)}`}
                      </Typography>
                    </Box>

                    <Tooltip title="Deshacer" arrow placement="left">
                      <span>
                        <IconButton
                          size="small"
                          disabled={ocupado}
                          onClick={() => onDeshacer(m)}
                          sx={{
                            width: 28, height: 28, color: ORO_OSCURO,
                            border: "1px solid rgba(163,105,32,0.25)",
                            "&:hover": { background: "rgba(163,105,32,0.12)", borderColor: ORO },
                          }}
                        >
                          {ocupado
                            ? <CircularProgress size={13} sx={{ color: ORO }} />
                            : <UndoRounded sx={{ fontSize: 15 }} />}
                        </IconButton>
                      </span>
                    </Tooltip>
                  </Box>
                );
              })}
            </Box>
          </MotionBox>
        )}
      </AnimatePresence>
    </MotionBox>
  );
}

export default function PanelRecordatorios({ apiBase, onVerPaciente }) {
  const [abierto, setAbierto] = useState(false);
  const [pestana, setPestana] = useState("retoques");   // "retoques" | "cumples" | "seguimiento"
  const [cargando, setCargando] = useState(true);
  const [datos, setDatos] = useState({ total: 0, vencidos: 0, proximos: 0, recordatorios: [], contactados: [] });

  // Cumpleaños del mes que se esté viendo
  const [mesVer, setMesVer] = useState(null);           // null = mes actual
  const [cumples, setCumples] = useState(null);
  const [cargandoCumples, setCargandoCumples] = useState(false);

  // Seguimiento de proformas que no arrancaron
  const [seguimiento, setSeguimiento] = useState(null);
  const [cargandoSeguimiento, setCargandoSeguimiento] = useState(false);

  // Fila que se está marcando (para la animación de salida)
  const [marcando, setMarcando] = useState(null);
  // Sección de "ya marcados" desplegada
  const [verMarcados, setVerMarcados] = useState(false);
  const [deshaciendo, setDeshaciendo] = useState(null);

  const token = () => localStorage.getItem("token");

  const cargarRetoques = useCallback(async (silencioso = false) => {
    if (!token()) { setCargando(false); return; }
    if (!silencioso) setCargando(true);
    try {
      const res = await fetch(`${apiBase}/api/pacientes/recordatorios?dias=45&limite=25`, {
        headers: { Authorization: `Bearer ${token()}` },
      });
      if (res.ok) setDatos(await res.json());
    } catch { /* se queda con lo que ya tenía */ }
    finally { setCargando(false); }
  }, [apiBase]);

  useEffect(() => { cargarRetoques(); }, [cargarRetoques]);

  useEffect(() => {
    if (pestana !== "cumples") return;
    if (!token()) return;
    setCargandoCumples(true);
    const q = mesVer ? `?mes=${mesVer}` : "";
    fetch(`${apiBase}/api/pacientes/cumpleanos${q}`, { headers: { Authorization: `Bearer ${token()}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d) { setCumples(d); if (mesVer == null) setMesVer(d.mes); } })
      .catch(() => {})
      .finally(() => setCargandoCumples(false));
  }, [pestana, mesVer, apiBase]);

  const cargarSeguimiento = useCallback(async (silencioso = false) => {
    if (!token()) return;
    if (!silencioso) setCargandoSeguimiento(true);
    try {
      const res = await fetch(`${apiBase}/api/pacientes/seguimiento-proformas`, {
        headers: { Authorization: `Bearer ${token()}` },
      });
      if (res.ok) setSeguimiento(await res.json());
    } catch { /* se queda con lo que tenía */ }
    finally { setCargandoSeguimiento(false); }
  }, [apiBase]);

  useEffect(() => {
    if (pestana === "seguimiento") cargarSeguimiento();
  }, [pestana, cargarSeguimiento]);

  // Al cambiar de pestaña se recoge la sección de marcados
  useEffect(() => { setVerMarcados(false); }, [pestana]);

  /* ─────────── Marcar: "ya lo contacté" / "ya la saludé" ─────────── */

  const marcarContactado = async (r, e) => {
    if (e) e.stopPropagation();
    if (marcando) return;
    const clave = `${r.paciente_id}-${r.tratamiento}`;
    setMarcando(clave);

    let idMarca = null;
    try {
      const res = await fetch(`${apiBase}/api/pacientes/recordatorios/contactado`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify({
          paciente_id: r.paciente_id,
          tratamiento: r.tratamiento,
          proxima_fecha: r.proxima_fecha,
        }),
      });
      const data = await res.json().catch(() => ({}));
      idMarca = data.id || null;
    } catch { /* si falla la red igual se quita en pantalla */ }

    // Deja ver el check un instante antes de que la fila salga
    setTimeout(() => {
      setDatos((prev) => {
        const quedan = prev.recordatorios.filter(
          (x) => !(x.paciente_id === r.paciente_id && x.tratamiento === r.tratamiento)
        );
        // Pasa a la lista de marcados, para poder deshacerlo enseguida
        const yaEsta = (prev.contactados || []).some(
          (c) => c.paciente_id === r.paciente_id && c.tratamiento === r.tratamiento
        );
        const contactados = yaEsta ? prev.contactados : [
          {
            id: idMarca,
            paciente_id: r.paciente_id,
            tratamiento: r.tratamiento,
            proxima_fecha: r.proxima_fecha,
            contactado_en: new Date().toISOString(),
            nombre: r.nombre, apellido: r.apellido, celular: r.celular,
          },
          ...(prev.contactados || []),
        ];
        return {
          ...prev,
          recordatorios: quedan,
          contactados,
          total: quedan.length,
          vencidos: quedan.filter((x) => x.vencido).length,
          proximos: quedan.filter((x) => !x.vencido).length,
        };
      });
      setMarcando(null);
    }, 620);
  };

  const marcarSaludado = async (c, e) => {
    if (e) e.stopPropagation();
    if (marcando) return;
    const clave = `cumple-${c.paciente_id}`;
    setMarcando(clave);

    let idMarca = null;
    try {
      const res = await fetch(`${apiBase}/api/pacientes/cumpleanos/saludado`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ paciente_id: c.paciente_id, anio: cumples?.anio }),
      });
      const data = await res.json().catch(() => ({}));
      idMarca = data.id || null;
    } catch { /* la fila sale igual */ }

    setTimeout(() => {
      setCumples((prev) => {
        if (!prev) return prev;
        const lista = prev.cumpleanos.map((x) =>
          x.paciente_id === c.paciente_id
            ? { ...x, saludado: true, saludado_id: idMarca, saludado_en: new Date().toISOString() }
            : x
        );
        const pendientes = lista.filter((x) => !x.saludado);
        return {
          ...prev,
          cumpleanos: lista,
          total: pendientes.length,
          saludados: lista.length - pendientes.length,
          hoy: pendientes.filter((x) => x.es_hoy).length,
          proximos: pendientes.filter((x) => !x.es_hoy && !x.ya_paso).length,
        };
      });
      setMarcando(null);
    }, 620);
  };

  /**
   * Seguimiento: dos salidas distintas a propósito.
   *   contactado → vuelve en 30 días si sigue sin empezar
   *   descartado → dijo que no; no vuelve
   */
  const marcarSeguimiento = async (s, estado, e) => {
    if (e) e.stopPropagation();
    if (marcando) return;
    const clave = `seg-${s.paciente_id}`;
    setMarcando(clave);

    try {
      await fetch(`${apiBase}/api/pacientes/seguimiento-proformas/${s.paciente_id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ estado }),
      });
    } catch { /* la fila sale igual */ }

    setTimeout(async () => {
      await cargarSeguimiento(true);
      setMarcando(null);
    }, 620);
  };

  const deshacerSeguimiento = async (s) => {
    if (deshaciendo) return;
    setDeshaciendo(`seg-${s.paciente_id}`);
    try {
      await fetch(`${apiBase}/api/pacientes/seguimiento-proformas/${s.paciente_id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token()}` },
      });
      await cargarSeguimiento(true);
    } catch { /* silencio */ }
    finally { setDeshaciendo(null); }
  };

  /* ─────────────────────── Deshacer la marca ─────────────────────── */

  const deshacerContacto = async (m) => {
    if (deshaciendo) return;
    setDeshaciendo(`${m.paciente_id}-${m.tratamiento}`);
    try {
      const url = m.id
        ? `${apiBase}/api/pacientes/recordatorios/contactado/${m.id}`
        : `${apiBase}/api/pacientes/recordatorios/contactado`;
      await fetch(url, {
        method: "DELETE",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: m.id ? undefined : JSON.stringify({
          paciente_id: m.paciente_id, tratamiento: m.tratamiento, proxima_fecha: m.proxima_fecha,
        }),
      });
      // Se recarga del servidor: así el aviso vuelve con sus días exactos
      await cargarRetoques(true);
    } catch { /* silencio: se reintenta al reabrir */ }
    finally { setDeshaciendo(null); }
  };

  const deshacerSaludo = async (c) => {
    if (deshaciendo) return;
    setDeshaciendo(`cumple-${c.paciente_id}`);
    try {
      const url = c.saludado_id
        ? `${apiBase}/api/pacientes/cumpleanos/saludado/${c.saludado_id}`
        : `${apiBase}/api/pacientes/cumpleanos/saludado`;
      await fetch(url, {
        method: "DELETE",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: c.saludado_id ? undefined : JSON.stringify({ paciente_id: c.paciente_id, anio: cumples?.anio }),
      });
      setCumples((prev) => {
        if (!prev) return prev;
        const lista = prev.cumpleanos.map((x) =>
          x.paciente_id === c.paciente_id ? { ...x, saludado: false, saludado_id: null } : x
        );
        const pendientes = lista.filter((x) => !x.saludado);
        return {
          ...prev,
          cumpleanos: lista,
          total: pendientes.length,
          saludados: lista.length - pendientes.length,
          hoy: pendientes.filter((x) => x.es_hoy).length,
          proximos: pendientes.filter((x) => !x.es_hoy && !x.ya_paso).length,
        };
      });
    } catch { /* silencio */ }
    finally { setDeshaciendo(null); }
  };

  /* ─────────────────────────── Derivados ─────────────────────────── */

  const total = datos.total || 0;
  const esCumples = pestana === "cumples";
  const esSeguimiento = pestana === "seguimiento";
  const mesNombre = MESES[(mesVer || 1) - 1];

  const pendientesCumples = (cumples?.cumpleanos || []).filter((c) => !c.saludado);
  const marcados = esCumples
    ? (cumples?.cumpleanos || []).filter((c) => c.saludado)
    : esSeguimiento
      ? (seguimiento?.atendidos || [])
      : (datos.contactados || []);

  // Props comunes del bloque de marcados, para no repetirlas en cada pestaña
  const propsMarcados = {
    marcados,
    esCumples,
    esSeguimiento,
    abiertaLista: verMarcados,
    onAlternar: () => setVerMarcados((v) => !v),
    deshaciendo,
    onDeshacer: esCumples ? deshacerSaludo : esSeguimiento ? deshacerSeguimiento : deshacerContacto,
  };

  return (
    <>
      {/* Botón flotante */}
      <MotionBox
        initial={{ opacity: 0, scale: 0.6 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.4, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        sx={{ position: "fixed", top: 78, right: 22, zIndex: 1200 }}
      >
        <Tooltip title="Retoques pendientes" arrow placement="left">
          <Badge
            badgeContent={total}
            max={99}
            invisible={total === 0 || abierto}
            sx={{
              "& .MuiBadge-badge": {
                bgcolor: "#D32F2F", color: "#fff", fontWeight: 700, fontSize: 11,
                boxShadow: "0 0 0 2px #fff",
              },
            }}
          >
            <IconButton
              onClick={() => setAbierto((v) => !v)}
              sx={{
                width: 48, height: 48,
                background: abierto
                  ? "rgba(211,47,47,0.92)"
                  : `linear-gradient(135deg, ${ORO} 0%, ${ORO_OSCURO} 100%)`,
                color: "#fff",
                boxShadow: "0 6px 20px rgba(163,105,32,0.35)",
                transition: "transform .25s cubic-bezier(.4,0,.2,1), background .25s ease",
                "&:hover": { transform: "scale(1.08)", boxShadow: "0 8px 26px rgba(163,105,32,0.45)" },
              }}
            >
              {abierto ? <CloseRounded /> : <NotificationsActiveRounded />}
            </IconButton>
          </Badge>
        </Tooltip>

        {/* Pulso suave cuando hay avisos y el panel está cerrado */}
        {total > 0 && !abierto && (
          <MotionBox
            aria-hidden
            animate={{ scale: [1, 1.5], opacity: [0.5, 0] }}
            transition={{ duration: 1.9, repeat: Infinity, ease: "easeOut" }}
            sx={{
              position: "absolute", inset: 0, borderRadius: "50%",
              border: `2px solid ${ORO}`, pointerEvents: "none",
            }}
          />
        )}
      </MotionBox>

      {/* Panel */}
      <AnimatePresence>
        {abierto && (
          <MotionBox
            key="panel"
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.94 }}
            transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
            sx={{
              position: "fixed", top: 136, right: 22, zIndex: 1200,
              width: { xs: "calc(100vw - 40px)", sm: 370 },
              maxHeight: "calc(100vh - 168px)",
              display: "flex", flexDirection: "column",
              borderRadius: "20px", overflow: "hidden", transformOrigin: "top right",
              background: CREMA,
              border: "1px solid rgba(163,105,32,0.20)",
              boxShadow: "0 20px 50px rgba(62,39,35,0.22)",
            }}
          >
            {/* Cabecera */}
            <Box sx={{
              px: 2.2, pt: 1.8, pb: 0,
              background: `linear-gradient(135deg, ${ORO} 0%, ${ORO_OSCURO} 100%)`,
              color: "#fff",
            }}>
              {esCumples ? (
                <>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <CakeRounded sx={{ fontSize: 20 }} />
                    <Typography sx={{ fontFamily: "'Playfair Display', serif", fontWeight: 600, fontSize: 18, flex: 1 }}>
                      Cumpleaños
                    </Typography>
                  </Box>

                  {/* Selector de mes */}
                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mt: 0.6 }}>
                    <IconButton size="small" onClick={() => setMesVer((m) => (m === 1 ? 12 : (m || 1) - 1))}
                      sx={{ color: "#fff", p: 0.3, "&:hover": { background: "rgba(255,255,255,0.18)" } }}>
                      <ChevronLeftRounded sx={{ fontSize: 18 }} />
                    </IconButton>
                    <Typography sx={{ fontSize: 13, fontWeight: 700, flex: 1, textAlign: "center", letterSpacing: 0.3 }}>
                      {mesNombre}
                    </Typography>
                    <IconButton size="small" onClick={() => setMesVer((m) => ((m || 1) === 12 ? 1 : (m || 1) + 1))}
                      sx={{ color: "#fff", p: 0.3, "&:hover": { background: "rgba(255,255,255,0.18)" } }}>
                      <ChevronRightRounded sx={{ fontSize: 18 }} />
                    </IconButton>
                  </Box>

                  <Box sx={{ display: "flex", gap: 0.8, mt: 1 }}>
                    <Box sx={{ px: 1.1, py: 0.35, borderRadius: "999px", background: "rgba(255,255,255,0.20)" }}>
                      <Typography sx={{ fontSize: 11, fontWeight: 700 }}>
                        {cumples?.total || 0} por saludar
                      </Typography>
                    </Box>
                    {(cumples?.hoy || 0) > 0 && (
                      <Box sx={{ px: 1.1, py: 0.35, borderRadius: "999px", background: "rgba(0,0,0,0.25)" }}>
                        <Typography sx={{ fontSize: 11, fontWeight: 700 }}>🎉 {cumples.hoy} hoy</Typography>
                      </Box>
                    )}
                  </Box>
                </>
              ) : esSeguimiento ? (
                <>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <HandshakeRounded sx={{ fontSize: 20 }} />
                    <Typography sx={{ fontFamily: "'Playfair Display', serif", fontWeight: 600, fontSize: 18, flex: 1 }}>
                      Seguimiento
                    </Typography>
                  </Box>
                  <Typography sx={{ fontSize: 11.5, opacity: 0.9, mt: 0.3 }}>
                    Vinieron a consulta y aún no empiezan
                  </Typography>

                  <Box sx={{ display: "flex", gap: 0.8, mt: 1.2, flexWrap: "wrap" }}>
                    <Box sx={{ px: 1.1, py: 0.35, borderRadius: "999px", background: "rgba(255,255,255,0.20)" }}>
                      <Typography sx={{ fontSize: 11, fontWeight: 700 }}>
                        {seguimiento?.total || 0} por contactar
                      </Typography>
                    </Box>
                    {(seguimiento?.monto_en_juego || 0) > 0 && (
                      <Box sx={{ px: 1.1, py: 0.35, borderRadius: "999px", background: "rgba(0,0,0,0.25)" }}>
                        <Typography sx={{ fontSize: 11, fontWeight: 700 }}>
                          {soles(seguimiento.monto_en_juego)} en juego
                        </Typography>
                      </Box>
                    )}
                  </Box>
                </>
              ) : (
                <>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <EventRepeatRounded sx={{ fontSize: 20 }} />
                    <Typography sx={{ fontFamily: "'Playfair Display', serif", fontWeight: 600, fontSize: 18, flex: 1 }}>
                      Retoques pendientes
                    </Typography>
                  </Box>
                  <Typography sx={{ fontSize: 11.5, opacity: 0.9, mt: 0.3 }}>
                    Toxina cada 4 meses · demás tratamientos cada 10 meses
                  </Typography>

                  {total > 0 && (
                    <Box sx={{ display: "flex", gap: 0.8, mt: 1.2 }}>
                      {datos.vencidos > 0 && (
                        <Box sx={{ px: 1.1, py: 0.35, borderRadius: "999px", background: "rgba(0,0,0,0.22)" }}>
                          <Typography sx={{ fontSize: 11, fontWeight: 700 }}>
                            {datos.vencidos} vencido{datos.vencidos === 1 ? "" : "s"}
                          </Typography>
                        </Box>
                      )}
                      {datos.proximos > 0 && (
                        <Box sx={{ px: 1.1, py: 0.35, borderRadius: "999px", background: "rgba(255,255,255,0.20)" }}>
                          <Typography sx={{ fontSize: 11, fontWeight: 700 }}>
                            {datos.proximos} por vencer
                          </Typography>
                        </Box>
                      )}
                    </Box>
                  )}
                </>
              )}

              {/* Pestañas */}
              <Box sx={{ display: "flex", gap: 0.5, mt: 1.4 }}>
                {[
                  { id: "retoques", texto: "Retoques", Icono: EventRepeatRounded, n: total },
                  { id: "cumples", texto: "Cumpleaños", Icono: CakeRounded, n: cumples?.hoy || 0 },
                  { id: "seguimiento", texto: "Seguimiento", Icono: HandshakeRounded, n: seguimiento?.total || 0 },
                ].map((t) => {
                  const activa = pestana === t.id;
                  return (
                    <Box
                      key={t.id}
                      onClick={() => setPestana(t.id)}
                      sx={{
                        flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 0.5,
                        py: 0.9, cursor: "pointer", position: "relative",
                        opacity: activa ? 1 : 0.7,
                        transition: "opacity .2s ease",
                        "&:hover": { opacity: 1 },
                      }}
                    >
                      <t.Icono sx={{ fontSize: 15 }} />
                      <Typography sx={{ fontSize: 12.5, fontWeight: activa ? 700 : 600 }}>{t.texto}</Typography>
                      {t.n > 0 && (
                        <Box sx={{
                          minWidth: 16, height: 16, px: 0.4, borderRadius: "999px",
                          background: activa ? "#fff" : "rgba(255,255,255,0.30)",
                          color: activa ? ORO_OSCURO : "#fff",
                          fontSize: 10, fontWeight: 800,
                          display: "flex", alignItems: "center", justifyContent: "center",
                        }}>
                          {t.n}
                        </Box>
                      )}
                      {activa && (
                        <MotionBox
                          layoutId="pestanaActiva"
                          sx={{ position: "absolute", left: 8, right: 8, bottom: 0, height: 3, borderRadius: "3px 3px 0 0", background: "#fff" }}
                        />
                      )}
                    </Box>
                  );
                })}
              </Box>
            </Box>

            {/* Lista */}
            <Box sx={{
              flex: 1, overflowY: "auto", p: 1.2,
              "&::-webkit-scrollbar": { width: 6 },
              "&::-webkit-scrollbar-thumb": { borderRadius: 999, background: "rgba(163,105,32,0.30)" },
            }}>
              {esCumples ? (
                cargandoCumples ? (
                  <Box sx={{ display: "flex", justifyContent: "center", py: 5 }}>
                    <CircularProgress size={26} sx={{ color: ORO }} />
                  </Box>
                ) : (
                  <>
                    {pendientesCumples.length === 0 && (
                      <Box sx={{ textAlign: "center", py: 4.5, px: 2 }}>
                        <CakeRounded sx={{ fontSize: 40, color: "rgba(163,105,32,0.35)" }} />
                        <Typography sx={{ mt: 1, fontSize: 13.5, fontWeight: 600, color: CAFE }}>
                          {(cumples?.saludados || 0) > 0 ? "Ya saludaste a todas" : "Sin cumpleaños"}
                        </Typography>
                        <Typography sx={{ fontSize: 12, color: "#8D7B70", mt: 0.5 }}>
                          {(cumples?.saludados || 0) > 0
                            ? `No queda nadie por saludar en ${mesNombre}.`
                            : `Ninguna paciente cumple años en ${mesNombre}.`}
                        </Typography>
                      </Box>
                    )}

                    {pendientesCumples.map((c, i) => {
                      const clave = `cumple-${c.paciente_id}`;
                      const hecho = marcando === clave;
                      return (
                        <MotionBox
                          key={c.paciente_id}
                          layout
                          initial={{ opacity: 0, y: 10 }}
                          animate={hecho
                            ? { opacity: 0, x: 70, scale: 0.92 }
                            : { opacity: 1, x: 0, y: 0, scale: 1 }}
                          transition={{
                            layout: { duration: 0.34, ease: [0.22, 1, 0.36, 1] },
                            delay: hecho ? 0.16 : Math.min(0.04 + i * 0.03, 0.5),
                            duration: hecho ? 0.26 : 0.28,
                            ease: hecho ? "easeIn" : [0.22, 1, 0.36, 1],
                          }}
                          whileHover={hecho ? {} : { x: 3 }}
                          onClick={() => !hecho && onVerPaciente && onVerPaciente({ paciente_id: c.paciente_id })}
                          sx={{
                            display: "flex", alignItems: "center", gap: 1.2,
                            p: 1.2, mb: 0.9, borderRadius: "14px", cursor: "pointer",
                            background: hecho ? "#EDF7EE" : c.es_hoy ? "#FFF8E7" : "#fff",
                            border: `1px solid ${hecho ? "rgba(46,125,50,0.35)" : c.es_hoy ? "rgba(212,175,55,0.55)" : "rgba(163,105,32,0.14)"}`,
                            borderLeft: `3px solid ${hecho ? VERDE : c.es_hoy ? "#D4AF37" : c.ya_paso ? "#DDD3C4" : ORO}`,
                            opacity: c.ya_paso && !hecho ? 0.72 : 1,
                            transition: "background .25s ease, border-color .25s ease, box-shadow .2s ease, opacity .2s ease",
                            "&:hover": { boxShadow: hecho ? "none" : "0 6px 18px rgba(163,105,32,0.16)", opacity: 1 },
                          }}
                        >
                          {/* Día del mes */}
                          <Box sx={{
                            width: 42, height: 42, borderRadius: "12px", flexShrink: 0,
                            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                            background: c.es_hoy
                              ? "linear-gradient(135deg,#D4AF37,#A36920)"
                              : c.ya_paso ? "#EFE9E0" : `linear-gradient(135deg, ${ORO}, ${ORO_OSCURO})`,
                            color: c.ya_paso ? "#9C8B7D" : "#fff",
                          }}>
                            <Typography sx={{ fontSize: 16, fontWeight: 800, lineHeight: 1 }}>{c.dia}</Typography>
                            <Typography sx={{ fontSize: 8.5, opacity: 0.9, textTransform: "uppercase", letterSpacing: 0.3 }}>
                              {mesNombre.slice(0, 3)}
                            </Typography>
                          </Box>

                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Box sx={{ display: "flex", alignItems: "center", gap: 0.6 }}>
                              <Typography sx={{ fontSize: 13.2, fontWeight: 700, color: CAFE, lineHeight: 1.25, minWidth: 0 }} noWrap>
                                {nombreCompleto(c)}
                              </Typography>
                              {c.es_hoy && <Typography sx={{ fontSize: 13 }}>🎉</Typography>}
                            </Box>
                            <Typography sx={{ fontSize: 11.5, color: "#7A6A60" }}>
                              {c.edad ? `Cumple ${c.edad} años` : "Cumpleaños"}
                            </Typography>
                            <Box sx={{ display: "flex", alignItems: "center", gap: 0.9, mt: 0.35, flexWrap: "wrap" }}>
                              <Typography sx={{
                                fontSize: 10.5, fontWeight: 700,
                                color: c.es_hoy ? "#8A6D1B" : c.ya_paso ? "#9C8B7D" : ORO_OSCURO,
                                background: c.es_hoy ? "rgba(212,175,55,0.20)" : c.ya_paso ? "rgba(0,0,0,0.04)" : "rgba(163,105,32,0.10)",
                                px: 0.8, py: 0.15, borderRadius: "6px",
                              }}>
                                {c.es_hoy ? "¡Es hoy!" : c.ya_paso ? "ya pasó" : c.dias_faltan != null ? `en ${c.dias_faltan} ${c.dias_faltan === 1 ? "día" : "días"}` : `${c.dia} de ${mesNombre}`}
                              </Typography>
                              {c.celular && (
                                <Box
                                  component="a"
                                  href={`tel:${c.celular}`}
                                  onClick={(e) => e.stopPropagation()}
                                  sx={{
                                    display: "inline-flex", alignItems: "center", gap: 0.3,
                                    fontSize: 10.5, color: "#7A6A60", textDecoration: "none",
                                    "&:hover": { color: ORO, textDecoration: "underline" },
                                  }}
                                >
                                  <PhoneRounded sx={{ fontSize: 12 }} />
                                  {c.celular}
                                </Box>
                              )}
                            </Box>
                          </Box>

                          {/* Check: ya se saludó a esta paciente */}
                          <BotonCheck
                            hecho={hecho}
                            titulo={hecho ? "Saludada" : "Marcar como saludada"}
                            onClick={(e) => marcarSaludado(c, e)}
                          />
                        </MotionBox>
                      );
                    })}

                    <SeccionMarcados {...propsMarcados} />
                  </>
                )
              ) : esSeguimiento ? (
                cargandoSeguimiento ? (
                  <Box sx={{ display: "flex", justifyContent: "center", py: 5 }}>
                    <CircularProgress size={26} sx={{ color: ORO }} />
                  </Box>
                ) : (
                  <>
                    {(seguimiento?.total || 0) === 0 && (
                      <Box sx={{ textAlign: "center", py: 4.5, px: 2 }}>
                        <HandshakeRounded sx={{ fontSize: 40, color: "rgba(163,105,32,0.35)" }} />
                        <Typography sx={{ mt: 1, fontSize: 13.5, fontWeight: 600, color: CAFE }}>
                          Nada pendiente
                        </Typography>
                        <Typography sx={{ fontSize: 12, color: "#8D7B70", mt: 0.5 }}>
                          Todas las proformas están en marcha o ya gestionadas.
                        </Typography>
                      </Box>
                    )}

                    {(seguimiento?.seguimientos || []).map((s, i) => {
                      const clave = `seg-${s.paciente_id}`;
                      const hecho = marcando === clave;
                      // Más de 3 meses esperando: se marca en rojo
                      const frio = (s.dias_desde_consulta || 0) >= 90;
                      return (
                        <MotionBox
                          key={clave}
                          layout
                          initial={{ opacity: 0, y: 12 }}
                          animate={hecho
                            ? { opacity: 0, x: 70, scale: 0.92 }
                            : { opacity: 1, x: 0, y: 0, scale: 1 }}
                          transition={{
                            layout: { duration: 0.34, ease: [0.22, 1, 0.36, 1] },
                            delay: hecho ? 0.16 : 0.05 + i * 0.045,
                            duration: hecho ? 0.26 : 0.3,
                            ease: hecho ? "easeIn" : [0.22, 1, 0.36, 1],
                          }}
                          whileHover={hecho ? {} : { x: 3 }}
                          onClick={() => !hecho && onVerPaciente && onVerPaciente(s)}
                          sx={{
                            display: "flex", alignItems: "center", gap: 1.2,
                            p: 1.3, mb: 0.9, borderRadius: "14px", cursor: "pointer",
                            background: hecho ? "#EDF7EE" : "#fff",
                            border: `1px solid ${hecho ? "rgba(46,125,50,0.35)" : frio ? "rgba(211,47,47,0.22)" : "rgba(163,105,32,0.14)"}`,
                            borderLeft: `3px solid ${hecho ? VERDE : frio ? "#D32F2F" : ORO}`,
                            transition: "background .25s ease, border-color .25s ease, box-shadow .2s ease",
                            "&:hover": { boxShadow: hecho ? "none" : "0 6px 18px rgba(163,105,32,0.16)" },
                          }}
                        >
                          <Box sx={{
                            width: 38, height: 38, borderRadius: "50%", flexShrink: 0,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            background: frio
                              ? "linear-gradient(135deg,#D32F2F,#B71C1C)"
                              : `linear-gradient(135deg, ${ORO}, ${ORO_OSCURO})`,
                            color: "#fff", fontWeight: 700, fontSize: 13.5,
                            fontFamily: "'Poppins', sans-serif",
                          }}>
                            {iniciales(s.nombre, s.apellido)}
                          </Box>

                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Box sx={{ display: "flex", alignItems: "center", gap: 0.6 }}>
                              <Typography sx={{ fontSize: 13.2, fontWeight: 700, color: CAFE, lineHeight: 1.25, minWidth: 0 }} noWrap>
                                {nombreCompleto(s)}
                              </Typography>
                              {s.reaparecio && (
                                <Typography sx={{ fontSize: 9.5, fontWeight: 800, color: "#C62828", background: "rgba(211,47,47,0.10)", px: 0.5, borderRadius: "5px" }}
                                  title="Ya se le contactó antes y sigue sin empezar">
                                  2ª vez
                                </Typography>
                              )}
                            </Box>

                            <Box sx={{ display: "flex", alignItems: "center", gap: 0.6, mt: 0.15 }}>
                              {s.motivo === "proforma" ? (
                                <>
                                  <DescriptionRounded sx={{ fontSize: 12, color: ORO_OSCURO }} />
                                  <Typography sx={{ fontSize: 11.5, fontWeight: 700, color: ORO_OSCURO }}>
                                    {soles(s.monto_total)}
                                  </Typography>
                                  {s.proformas > 1 && (
                                    <Typography sx={{ fontSize: 10.5, color: "#8D7B70" }}>
                                      · {s.proformas} proformas
                                    </Typography>
                                  )}
                                </>
                              ) : (
                                <Typography sx={{ fontSize: 11.5, color: "#7A6A60" }} noWrap>
                                  {s.nota || "Marcada para seguimiento"}
                                </Typography>
                              )}
                            </Box>

                            <Box sx={{ display: "flex", alignItems: "center", gap: 0.9, mt: 0.35, flexWrap: "wrap" }}>
                              <Typography sx={{
                                fontSize: 10.5, fontWeight: 700,
                                color: frio ? "#C62828" : ORO_OSCURO,
                                background: frio ? "rgba(211,47,47,0.10)" : "rgba(163,105,32,0.10)",
                                px: 0.8, py: 0.15, borderRadius: "6px",
                              }}>
                                {tiempoDesdeConsulta(s.dias_desde_consulta)}
                              </Typography>
                              {s.celular && (
                                <Box
                                  component="a"
                                  href={`tel:${s.celular}`}
                                  onClick={(e) => e.stopPropagation()}
                                  sx={{
                                    display: "inline-flex", alignItems: "center", gap: 0.3,
                                    fontSize: 10.5, color: "#7A6A60", textDecoration: "none",
                                    "&:hover": { color: ORO, textDecoration: "underline" },
                                  }}
                                >
                                  <PhoneRounded sx={{ fontSize: 12 }} />
                                  {s.celular}
                                </Box>
                              )}
                            </Box>
                          </Box>

                          {/* Dos salidas: ya lo contacté · no le interesa */}
                          <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5, flexShrink: 0 }}>
                            <BotonCheck
                              hecho={hecho}
                              titulo={hecho ? "Contactado" : "Ya lo contacté (vuelve en 30 días)"}
                              onClick={(e) => marcarSeguimiento(s, "contactado", e)}
                            />
                            <Tooltip title="No le interesa · no vuelve a aparecer" arrow placement="left">
                              <MotionBox
                                component="button"
                                aria-label="No le interesa"
                                onClick={(e) => marcarSeguimiento(s, "descartado", e)}
                                whileTap={{ scale: 0.85 }}
                                sx={{
                                  width: 30, height: 22, p: 0, cursor: "pointer",
                                  display: "flex", alignItems: "center", justifyContent: "center",
                                  borderRadius: "999px", background: "transparent",
                                  border: "1.5px solid rgba(163,105,32,0.25)", color: "#B08A8A",
                                  transition: "background .2s ease, border-color .2s ease, color .2s ease",
                                  "&:hover": { background: "rgba(211,47,47,0.10)", borderColor: "#D32F2F", color: "#C62828" },
                                }}
                              >
                                <DescartarRounded sx={{ fontSize: 14 }} />
                              </MotionBox>
                            </Tooltip>
                          </Box>
                        </MotionBox>
                      );
                    })}

                    <SeccionMarcados {...propsMarcados} />
                  </>
                )
              ) : cargando ? (
                <Box sx={{ display: "flex", justifyContent: "center", py: 5 }}>
                  <CircularProgress size={26} sx={{ color: ORO }} />
                </Box>
              ) : (
                <>
                  {total === 0 && (
                    <Box sx={{ textAlign: "center", py: 4.5, px: 2 }}>
                      <EventRepeatRounded sx={{ fontSize: 40, color: "rgba(163,105,32,0.35)" }} />
                      <Typography sx={{ mt: 1, fontSize: 13.5, fontWeight: 600, color: CAFE }}>
                        Todo al día
                      </Typography>
                      <Typography sx={{ fontSize: 12, color: "#8D7B70", mt: 0.5 }}>
                        Ningún paciente tiene un retoque próximo en los siguientes 45 días.
                      </Typography>
                    </Box>
                  )}

                  {datos.recordatorios.map((r, i) => {
                    const clave = `${r.paciente_id}-${r.tratamiento}`;
                    const hecho = marcando === clave;
                    return (
                      <MotionBox
                        key={clave}
                        layout
                        initial={{ opacity: 0, y: 12 }}
                        // Al marcarla, la fila se desvanece hacia la derecha; cuando
                        // termina se quita del estado y `layout` sube a las demás.
                        animate={hecho
                          ? { opacity: 0, x: 70, scale: 0.92 }
                          : { opacity: 1, x: 0, y: 0, scale: 1 }}
                        transition={{
                          layout: { duration: 0.34, ease: [0.22, 1, 0.36, 1] },
                          delay: hecho ? 0.16 : 0.05 + i * 0.045,
                          duration: hecho ? 0.26 : 0.3,
                          ease: hecho ? "easeIn" : [0.22, 1, 0.36, 1],
                        }}
                        whileHover={hecho ? {} : { x: 3 }}
                        onClick={() => !hecho && onVerPaciente && onVerPaciente(r)}
                        sx={{
                          display: "flex", alignItems: "center", gap: 1.2,
                          p: 1.3, mb: 0.9, borderRadius: "14px", cursor: "pointer",
                          background: hecho ? "#EDF7EE" : "#fff",
                          border: `1px solid ${hecho ? "rgba(46,125,50,0.35)" : r.vencido ? "rgba(211,47,47,0.22)" : "rgba(163,105,32,0.14)"}`,
                          borderLeft: `3px solid ${hecho ? VERDE : r.vencido ? "#D32F2F" : ORO}`,
                          transition: "background .25s ease, border-color .25s ease, box-shadow .2s ease",
                          "&:hover": { boxShadow: hecho ? "none" : "0 6px 18px rgba(163,105,32,0.16)" },
                        }}
                      >
                        {/* Avatar */}
                        <Box sx={{
                          width: 38, height: 38, borderRadius: "50%", flexShrink: 0,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          background: r.vencido
                            ? "linear-gradient(135deg,#D32F2F,#B71C1C)"
                            : `linear-gradient(135deg, ${ORO}, ${ORO_OSCURO})`,
                          color: "#fff", fontWeight: 700, fontSize: 13.5,
                          fontFamily: "'Poppins', sans-serif",
                        }}>
                          {iniciales(r.nombre, r.apellido)}
                        </Box>

                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography sx={{ fontSize: 13.2, fontWeight: 700, color: CAFE, lineHeight: 1.25 }} noWrap>
                            {nombreCompleto(r)}
                          </Typography>
                          <Typography sx={{ fontSize: 11.5, color: "#7A6A60" }} noWrap title={r.tratamiento}>
                            {r.tratamiento}
                          </Typography>
                          <Box sx={{ display: "flex", alignItems: "center", gap: 0.9, mt: 0.35, flexWrap: "wrap" }}>
                            <Typography sx={{
                              fontSize: 10.5, fontWeight: 700,
                              color: r.vencido ? "#C62828" : ORO_OSCURO,
                              background: r.vencido ? "rgba(211,47,47,0.10)" : "rgba(163,105,32,0.10)",
                              px: 0.8, py: 0.15, borderRadius: "6px",
                            }}>
                              {textoPlazo(r.dias_restantes)}
                            </Typography>
                            {r.celular && (
                              <Box
                                component="a"
                                href={`tel:${r.celular}`}
                                onClick={(e) => e.stopPropagation()}
                                sx={{
                                  display: "inline-flex", alignItems: "center", gap: 0.3,
                                  fontSize: 10.5, color: "#7A6A60", textDecoration: "none",
                                  "&:hover": { color: ORO, textDecoration: "underline" },
                                }}
                              >
                                <PhoneRounded sx={{ fontSize: 12 }} />
                                {r.celular}
                              </Box>
                            )}
                          </Box>
                        </Box>

                        {/* Check: ya se contactó a esta persona */}
                        <BotonCheck
                          hecho={hecho}
                          titulo={hecho ? "Contactado" : "Marcar como contactado"}
                          onClick={(e) => marcarContactado(r, e)}
                        />
                      </MotionBox>
                    );
                  })}

                  <SeccionMarcados {...propsMarcados} />
                </>
              )}
            </Box>

            <Box sx={{ px: 2, py: 1.1, borderTop: "1px solid rgba(163,105,32,0.14)", background: "#fff" }}>
              <Typography sx={{ fontSize: 10.8, color: "#8D7B70", textAlign: "center" }}>
                {esCumples
                  ? "El ✓ marca que ya la saludaste · abajo puedes deshacerlo"
                  : esSeguimiento
                    ? "✓ ya lo contacté (vuelve en 30 días) · ✕ no le interesa"
                    : "El ✓ marca que ya lo contactaste · abajo puedes deshacerlo"}
              </Typography>
            </Box>
          </MotionBox>
        )}
      </AnimatePresence>
    </>
  );
}
