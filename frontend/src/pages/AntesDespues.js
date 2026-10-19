import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box, Typography, IconButton, Button, TextField, InputAdornment, Chip, CircularProgress,
  Dialog, Tooltip, LinearProgress, useMediaQuery,
} from "@mui/material";
import {
  ArrowBack, Search, VideoLibraryRounded, CloudUploadRounded, DeleteOutlineRounded,
  SwapHorizRounded, PlayArrowRounded, PauseRounded, CloseRounded, CheckCircleRounded,
  ErrorOutlineRounded, PeopleAltRounded, MovieRounded, PendingActionsRounded,
  CalendarMonthRounded, OpenInFullRounded, PersonRounded,
} from "@mui/icons-material";
import { motion, AnimatePresence } from "framer-motion";

/**
 * 🎬 ANTES Y DESPUÉS
 *
 * Videoteca de la evolución de cada paciente. A la izquierda los pacientes
 * con tratamientos en el rango de fechas; al elegir uno se ven sus
 * tratamientos realizados y, en cada uno, los espacios para el video de
 * antes y el de después.
 *
 * El resumen de arriba cuenta a quién le falta algún video; al hacer clic
 * se filtra la lista para completarlos rápido.
 *
 * Los videos se guardan en el servidor, por eso se ven desde cualquier
 * computadora de la clínica.
 */

const API_BASE = process.env.REACT_APP_API_URL || `${window.location.protocol}//${window.location.hostname}:4000`;

const T = {
  pageBg: "#FAF8F5",
  surface: "#FFFFFF",
  surface2: "#F5EDE3",
  text1: "#3E2723",
  text2: "#6B6B6B",
  text3: "#A1958A",
  border: "rgba(163,105,32,0.14)",
  borderHover: "rgba(163,105,32,0.30)",
  gold: "#A36920",
  goldDark: "#8A5A1A",
  goldLight: "#C4944A",
  goldSoft: "#F5EDE3",
  font: "'Poppins', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  fontTitle: "'Playfair Display', 'Poppins', serif",
  shadow: "0 4px 20px rgba(163,105,32,0.10)",
  shadowHover: "0 10px 30px rgba(163,105,32,0.18)",
  green: "#2E7D32",
  greenSoft: "#EDF5E9",
  red: "#C62828",
  redSoft: "#FBEAE7",
  amber: "#B26A00",
  amberSoft: "#FBF0DC",
};

const MotionBox = motion(Box);
const suave = [0.22, 1, 0.36, 1];

/* ─────────────────────────── utilidades ─────────────────────────── */

// Fecha local AAAA-MM-DD (toISOString da UTC y en Perú adelanta un día de noche)
const iso = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const RANGOS = [
  { id: "hoy", texto: "Hoy", calc: () => { const h = new Date(); return [iso(h), iso(h)]; } },
  { id: "7", texto: "7 días", calc: () => { const h = new Date(); const d = new Date(); d.setDate(h.getDate() - 6); return [iso(d), iso(h)]; } },
  { id: "mes", texto: "Este mes", calc: () => { const h = new Date(); return [iso(new Date(h.getFullYear(), h.getMonth(), 1)), iso(h)]; } },
  { id: "30", texto: "30 días", calc: () => { const h = new Date(); const d = new Date(); d.setDate(h.getDate() - 29); return [iso(d), iso(h)]; } },
  { id: "90", texto: "3 meses", calc: () => { const h = new Date(); const d = new Date(); d.setDate(h.getDate() - 89); return [iso(d), iso(h)]; } },
  { id: "anio", texto: "Este año", calc: () => { const h = new Date(); return [iso(new Date(h.getFullYear(), 0, 1)), iso(h)]; } },
  { id: "todo", texto: "Todo", calc: () => ["", ""] },
];

const fechaBonita = (f) => {
  if (!f) return "";
  const d = new Date(String(f).replace(" ", "T"));
  if (isNaN(d)) return String(f).slice(0, 10);
  return d.toLocaleDateString("es-PE", { day: "numeric", month: "short", year: "numeric" });
};

const pesoBonito = (bytes) => {
  const n = Number(bytes) || 0;
  if (n >= 1024 ** 3) return `${(n / 1024 ** 3).toFixed(1)} GB`;
  if (n >= 1024 ** 2) return `${(n / 1024 ** 2).toFixed(0)} MB`;
  return `${Math.max(1, Math.round(n / 1024))} KB`;
};

const nombreCompleto = (p) => `${p?.nombre || ""} ${p?.apellido || ""}`.trim() || "Sin nombre";
const iniciales = (p) => `${(p?.nombre || "").trim()[0] || ""}${(p?.apellido || "").trim()[0] || ""}`.toUpperCase() || "?";

const token = () => localStorage.getItem("token");

/* ─────────────────────────── piezas visuales ─────────────────────────── */

function Avatar({ paciente, tam = 44 }) {
  const [rota, setRota] = useState(false);
  const src = paciente?.fotoPerfil && !rota ? `${API_BASE}${paciente.fotoPerfil}` : null;
  return (
    <Box sx={{
      width: tam, height: tam, borderRadius: "50%", flexShrink: 0, overflow: "hidden",
      display: "flex", alignItems: "center", justifyContent: "center",
      background: `linear-gradient(135deg, ${T.gold} 0%, ${T.goldLight} 100%)`,
      color: "#fff", fontWeight: 700, fontSize: tam * 0.36, fontFamily: T.font,
      boxShadow: "0 3px 10px rgba(163,105,32,0.25)",
    }}>
      {src
        ? <img src={src} alt="" onError={() => setRota(true)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        : iniciales(paciente)}
    </Box>
  );
}

/** Tarjeta del resumen de arriba. Si recibe onClick funciona como filtro. */
function Kpi({ Icono, titulo, valor, detalle, tono, activo, onClick, i }) {
  return (
    <MotionBox
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: suave, delay: 0.05 + i * 0.06 }}
      whileHover={onClick ? { y: -3 } : {}}
      onClick={onClick}
      sx={{
        position: "relative", overflow: "hidden",
        p: 2.2, borderRadius: "18px", cursor: onClick ? "pointer" : "default",
        background: activo ? `linear-gradient(135deg, ${tono.fuerte} 0%, ${tono.oscuro} 100%)` : T.surface,
        border: `1px solid ${activo ? "transparent" : T.border}`,
        boxShadow: activo ? `0 10px 26px ${tono.sombra}` : T.shadow,
        transition: "background .25s ease, box-shadow .25s ease, border-color .25s ease",
        "&:hover": onClick ? { borderColor: activo ? "transparent" : T.borderHover, boxShadow: activo ? `0 12px 30px ${tono.sombra}` : T.shadowHover } : {},
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.4 }}>
        <Box sx={{
          width: 42, height: 42, borderRadius: "12px", flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: activo ? "rgba(255,255,255,0.22)" : tono.suave,
          color: activo ? "#fff" : tono.fuerte,
        }}>
          <Icono sx={{ fontSize: 22 }} />
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontFamily: T.font, fontSize: 11.5, fontWeight: 600, letterSpacing: 0.5, textTransform: "uppercase", color: activo ? "rgba(255,255,255,0.85)" : T.text3 }}>
            {titulo}
          </Typography>
          <Typography sx={{ fontFamily: T.fontTitle, fontSize: 28, fontWeight: 600, lineHeight: 1.1, color: activo ? "#fff" : T.text1 }}>
            {valor}
          </Typography>
        </Box>
      </Box>
      {detalle && (
        <Typography sx={{ fontFamily: T.font, fontSize: 11.5, mt: 1, color: activo ? "rgba(255,255,255,0.9)" : T.text2 }}>
          {detalle}
        </Typography>
      )}
      {onClick && (
        <Typography sx={{ mt: 0.8, fontFamily: T.font, fontSize: 11, fontWeight: 700, color: activo ? "#fff" : tono.fuerte, opacity: 0.95 }}>
          {activo ? "✓ Mostrando en la lista" : "Ver en la lista →"}
        </Typography>
      )}
    </MotionBox>
  );
}

/** Fila de paciente en la lista de la izquierda. */
function FilaPaciente({ p, activo, onClick }) {
  const pct = p.tratamientos ? Math.round((p.completos / p.tratamientos) * 100) : 0;
  const completo = p.pendientes === 0;
  return (
    <Box
      onClick={onClick}
      sx={{
        display: "flex", alignItems: "center", gap: 1.4, p: 1.4, mb: 0.8, borderRadius: "14px", cursor: "pointer",
        background: activo ? T.goldSoft : T.surface,
        border: `1px solid ${activo ? T.gold : T.border}`,
        boxShadow: activo ? "0 6px 18px rgba(163,105,32,0.16)" : "none",
        transition: "background .18s ease, border-color .18s ease, transform .18s ease",
        "&:hover": { borderColor: T.borderHover, transform: "translateX(3px)" },
      }}
    >
      <Avatar paciente={p} tam={42} />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontFamily: T.font, fontSize: 13.5, fontWeight: 700, color: T.text1 }} noWrap>
          {nombreCompleto(p)}
        </Typography>
        <Typography sx={{ fontFamily: T.font, fontSize: 11, color: T.text3 }} noWrap>
          {p.dni ? `DNI ${p.dni} · ` : ""}Último: {fechaBonita(p.ultima_fecha)}
        </Typography>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 0.6 }}>
          <Box sx={{ flex: 1, height: 5, borderRadius: 3, background: "rgba(163,105,32,0.10)", overflow: "hidden" }}>
            <Box sx={{ height: "100%", width: `${pct}%`, borderRadius: 3, background: completo ? T.green : `linear-gradient(90deg, ${T.goldLight}, ${T.gold})`, transition: "width .4s ease" }} />
          </Box>
          <Typography sx={{ fontFamily: T.font, fontSize: 10.5, fontWeight: 700, color: completo ? T.green : T.goldDark, flexShrink: 0 }}>
            {p.completos}/{p.tratamientos}
          </Typography>
        </Box>
      </Box>
      {completo ? (
        <CheckCircleRounded sx={{ color: T.green, fontSize: 22, flexShrink: 0 }} />
      ) : (
        <Box sx={{ px: 0.9, py: 0.25, borderRadius: "999px", background: T.amberSoft, flexShrink: 0 }}>
          <Typography sx={{ fontFamily: T.font, fontSize: 10.5, fontWeight: 800, color: T.amber }}>
            Faltan {p.pendientes}
          </Typography>
        </Box>
      )}
    </Box>
  );
}

/**
 * Un espacio de video (antes o después). Vacío: zona para soltar/elegir.
 * Con video: reproductor con acciones para reemplazar o quitar.
 */
function EspacioVideo({ tipo, video, subiendo, progreso, onElegir, onBorrar, onAmpliar }) {
  const inputRef = useRef(null);
  const [encima, setEncima] = useState(false);
  const [noReproduce, setNoReproduce] = useState(false);
  const etiqueta = tipo === "antes" ? "Antes" : "Después";
  const colorEtiqueta = tipo === "antes" ? "rgba(62,39,35,0.85)" : `linear-gradient(135deg, ${T.gold}, ${T.goldDark})`;

  useEffect(() => { setNoReproduce(false); }, [video?.archivo]);

  const elegir = (archivo) => { if (archivo) onElegir(archivo); };

  return (
    <Box
      onDragOver={(e) => { e.preventDefault(); setEncima(true); }}
      onDragLeave={() => setEncima(false)}
      onDrop={(e) => { e.preventDefault(); setEncima(false); elegir(e.dataTransfer.files?.[0]); }}
      sx={{
        position: "relative", flex: 1, minWidth: 0, aspectRatio: "16 / 10", borderRadius: "14px", overflow: "hidden",
        background: video ? "#1E1612" : encima ? "rgba(163,105,32,0.10)" : "#FDFBF8",
        border: video ? "none" : `2px dashed ${encima ? T.gold : "rgba(163,105,32,0.30)"}`,
        transition: "background .18s ease, border-color .18s ease",
      }}
    >
      {/* Etiqueta */}
      <Box sx={{ position: "absolute", top: 10, left: 10, zIndex: 2, px: 1.1, py: 0.3, borderRadius: "999px", background: colorEtiqueta, pointerEvents: "none" }}>
        <Typography sx={{ fontFamily: T.font, fontSize: 10.5, fontWeight: 800, letterSpacing: 0.8, color: "#fff" }}>
          {etiqueta.toUpperCase()}
        </Typography>
      </Box>

      {video && !subiendo ? (
        <>
          {noReproduce ? (
            <Box sx={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", px: 2.5, color: "#F5EDE3" }}>
              <ErrorOutlineRounded sx={{ fontSize: 30, color: T.goldLight }} />
              <Typography sx={{ fontFamily: T.font, fontSize: 12, mt: 0.8, lineHeight: 1.4 }}>
                Este navegador no puede reproducir este formato (suele pasar con videos HEVC de iPhone).
              </Typography>
              <Box component="a" href={`${API_BASE}${video.archivo}`} target="_blank" rel="noreferrer"
                sx={{ mt: 1, fontFamily: T.font, fontSize: 12, fontWeight: 700, color: T.goldLight }}>
                Abrir / descargar el video
              </Box>
            </Box>
          ) : (
            <video
              src={`${API_BASE}${video.archivo}#t=0.1`}
              controls
              preload="metadata"
              playsInline
              onError={() => setNoReproduce(true)}
              style={{ width: "100%", height: "100%", objectFit: "contain", display: "block", background: "#1E1612" }}
            />
          )}

          {/* Acciones */}
          <Box sx={{ position: "absolute", top: 8, right: 8, zIndex: 2, display: "flex", gap: 0.6 }}>
            {[
              { titulo: "Ver en grande", Icono: OpenInFullRounded, accion: onAmpliar },
              { titulo: "Reemplazar video", Icono: SwapHorizRounded, accion: () => inputRef.current?.click() },
              { titulo: "Quitar video", Icono: DeleteOutlineRounded, accion: onBorrar, peligro: true },
            ].map(({ titulo, Icono, accion, peligro }) => (
              <Tooltip key={titulo} title={titulo} arrow>
                <IconButton size="small" onClick={accion} sx={{
                  width: 30, height: 30, color: "#fff", background: "rgba(0,0,0,0.45)", backdropFilter: "blur(4px)",
                  "&:hover": { background: peligro ? "#C62828" : "rgba(0,0,0,0.7)" },
                }}>
                  <Icono sx={{ fontSize: 17 }} />
                </IconButton>
              </Tooltip>
            ))}
          </Box>
          <Box sx={{ position: "absolute", left: 10, top: 38, zIndex: 1, px: 0.9, py: 0.2, borderRadius: "6px", background: "rgba(0,0,0,0.45)", pointerEvents: "none" }}>
            <Typography sx={{ fontFamily: T.font, fontSize: 10, color: "#fff" }}>
              {pesoBonito(video.tamano)} · {fechaBonita(video.creado_en)}
            </Typography>
          </Box>
        </>
      ) : subiendo ? (
        <Box sx={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", px: 3 }}>
          <Box sx={{ position: "relative", display: "inline-flex" }}>
            <CircularProgress variant="determinate" value={progreso} size={64} thickness={3.5} sx={{ color: T.gold }} />
            <Box sx={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Typography sx={{ fontFamily: T.font, fontSize: 14, fontWeight: 800, color: T.goldDark }}>{progreso}%</Typography>
            </Box>
          </Box>
          <Typography sx={{ fontFamily: T.font, fontSize: 12.5, fontWeight: 600, color: T.text1, mt: 1.2 }}>
            {progreso < 100 ? `Subiendo video de ${etiqueta.toLowerCase()}…` : "Guardando…"}
          </Typography>
          <Typography sx={{ fontFamily: T.font, fontSize: 11, color: T.text3 }}>No cierres esta ventana</Typography>
        </Box>
      ) : (
        <Box
          onClick={() => inputRef.current?.click()}
          sx={{
            position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            cursor: "pointer", textAlign: "center", px: 2, transition: "background .18s ease",
            "&:hover": { background: "rgba(163,105,32,0.05)" },
            "&:hover .icono-subir": { transform: "translateY(-3px)" },
          }}
        >
          <Box className="icono-subir" sx={{
            width: 50, height: 50, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
            background: T.goldSoft, color: T.gold, transition: "transform .2s ease",
          }}>
            <CloudUploadRounded sx={{ fontSize: 26 }} />
          </Box>
          <Typography sx={{ fontFamily: T.font, fontSize: 13, fontWeight: 700, color: T.text1, mt: 1 }}>
            Subir video de {etiqueta.toLowerCase()}
          </Typography>
          <Typography sx={{ fontFamily: T.font, fontSize: 11, color: T.text3 }}>
            Haz clic o arrastra el archivo · MP4, MOV, WEBM
          </Typography>
        </Box>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="video/*,.mov,.mp4,.m4v,.webm"
        hidden
        onChange={(e) => { elegir(e.target.files?.[0]); e.target.value = ""; }}
      />
    </Box>
  );
}

/** Tarjeta de un tratamiento realizado con sus dos videos. */
function TarjetaTratamiento({ t, i, subidas, onSubir, onBorrar, onComparar }) {
  const completo = t.antes && t.despues;
  const ninguno = !t.antes && !t.despues;
  const estado = completo
    ? { texto: "Completo", color: T.green, fondo: T.greenSoft, Icono: CheckCircleRounded }
    : ninguno
      ? { texto: "Sin videos", color: T.red, fondo: T.redSoft, Icono: ErrorOutlineRounded }
      : { texto: t.antes ? "Falta el después" : "Falta el antes", color: T.amber, fondo: T.amberSoft, Icono: PendingActionsRounded };

  return (
    <MotionBox
      layout
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: suave, delay: Math.min(i, 8) * 0.05 }}
      sx={{
        p: 2, mb: 2, borderRadius: "18px", background: T.surface,
        border: `1px solid ${T.border}`, boxShadow: T.shadow,
        borderLeft: `4px solid ${estado.color}`,
      }}
    >
      <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5, mb: 1.6, flexWrap: "wrap" }}>
        <Box sx={{ flex: 1, minWidth: 200 }}>
          <Typography sx={{ fontFamily: T.fontTitle, fontSize: 18, fontWeight: 600, color: T.text1, lineHeight: 1.25 }}>
            {t.tratamiento_nombre}
          </Typography>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 0.5, flexWrap: "wrap" }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.4 }}>
              <CalendarMonthRounded sx={{ fontSize: 14, color: T.text3 }} />
              <Typography sx={{ fontFamily: T.font, fontSize: 12, color: T.text2 }}>{fechaBonita(t.fecha)}</Typography>
            </Box>
            <Chip label={t.tipoAtencion || "Tratamiento"} size="small"
              sx={{ height: 20, fontSize: 10.5, fontWeight: 700, fontFamily: T.font, background: T.goldSoft, color: T.goldDark }} />
            {t.sesion && (
              <Typography sx={{ fontFamily: T.font, fontSize: 12, color: T.text2 }}>Sesión {t.sesion}</Typography>
            )}
            {t.especialista && t.especialista !== "No especificado" && (
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.3 }}>
                <PersonRounded sx={{ fontSize: 14, color: T.text3 }} />
                <Typography sx={{ fontFamily: T.font, fontSize: 12, color: T.text2 }}>{t.especialista}</Typography>
              </Box>
            )}
          </Box>
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          {completo && (
            <Button size="small" onClick={() => onComparar(t)} startIcon={<PlayArrowRounded />}
              sx={{ fontFamily: T.font, textTransform: "none", fontWeight: 700, fontSize: 12, borderRadius: "10px",
                color: "#fff", background: `linear-gradient(135deg, ${T.gold}, ${T.goldDark})`, px: 1.6,
                "&:hover": { boxShadow: "0 6px 16px rgba(163,105,32,0.35)" } }}>
              Comparar
            </Button>
          )}
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, px: 1.1, py: 0.4, borderRadius: "999px", background: estado.fondo }}>
            <estado.Icono sx={{ fontSize: 15, color: estado.color }} />
            <Typography sx={{ fontFamily: T.font, fontSize: 11.5, fontWeight: 700, color: estado.color }}>{estado.texto}</Typography>
          </Box>
        </Box>
      </Box>

      <Box sx={{ display: "flex", gap: 1.5, flexDirection: { xs: "column", sm: "row" } }}>
        {["antes", "despues"].map((tipo) => {
          const clave = `${t.id}-${tipo}`;
          return (
            <EspacioVideo
              key={tipo}
              tipo={tipo}
              video={t[tipo]}
              subiendo={subidas[clave] != null}
              progreso={subidas[clave] || 0}
              onElegir={(archivo) => onSubir(t, tipo, archivo)}
              onBorrar={() => onBorrar(t, tipo)}
              onAmpliar={() => onComparar(t, tipo)}
            />
          );
        })}
      </Box>
    </MotionBox>
  );
}

/**
 * Visor grande. Con los dos videos los muestra lado a lado y un botón para
 * reproducirlos a la vez; con uno solo, lo muestra en grande.
 */
function VisorComparar({ datos, onCerrar }) {
  const refAntes = useRef(null);
  const refDespues = useRef(null);
  const [reproduciendo, setReproduciendo] = useState(false);
  const t = datos?.tratamiento;
  const solo = datos?.solo;
  const tipos = solo ? [solo] : ["antes", "despues"];

  useEffect(() => { setReproduciendo(false); }, [datos]);

  const alternarAmbos = () => {
    const vids = [refAntes.current, refDespues.current].filter(Boolean);
    if (reproduciendo) {
      vids.forEach((v) => v.pause());
      setReproduciendo(false);
    } else {
      vids.forEach((v) => { v.currentTime = 0; v.play().catch(() => {}); });
      setReproduciendo(true);
    }
  };

  return (
    <Dialog open={!!datos} onClose={onCerrar} maxWidth={false}
      PaperProps={{ sx: { width: "min(1400px, 96vw)", maxWidth: "96vw", borderRadius: "22px", overflow: "hidden", background: "#17110D" } }}>
      {t && (
        <Box sx={{ p: { xs: 1.5, sm: 2.5 } }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 2, color: "#F5EDE3" }}>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ fontFamily: T.fontTitle, fontSize: 21, fontWeight: 600, color: "#F5EDE3" }} noWrap>{t.tratamiento_nombre}</Typography>
              <Typography sx={{ fontFamily: T.font, fontSize: 12, opacity: 0.7, color: "#F5EDE3" }}>
                {datos.paciente ? `${nombreCompleto(datos.paciente)} · ` : ""}{fechaBonita(t.fecha)}{t.sesion ? ` · Sesión ${t.sesion}` : ""}
              </Typography>
            </Box>
            {!solo && (
              <Button onClick={alternarAmbos} startIcon={reproduciendo ? <PauseRounded /> : <PlayArrowRounded />}
                sx={{ fontFamily: T.font, textTransform: "none", fontWeight: 700, borderRadius: "12px", color: "#fff", px: 2,
                  background: `linear-gradient(135deg, ${T.gold}, ${T.goldDark})` }}>
                {reproduciendo ? "Pausar ambos" : "Reproducir ambos"}
              </Button>
            )}
            <IconButton onClick={onCerrar} sx={{ color: "#F5EDE3", "&:hover": { background: "rgba(255,255,255,0.1)" } }}>
              <CloseRounded />
            </IconButton>
          </Box>
          <Box sx={{ display: "flex", gap: 1.5, flexDirection: { xs: "column", md: "row" } }}>
            {tipos.map((tipo) => t[tipo] && (
              <Box key={tipo} sx={{ position: "relative", flex: 1, minWidth: 0, borderRadius: "14px", overflow: "hidden", background: "#000" }}>
                <Box sx={{ position: "absolute", top: 12, left: 12, zIndex: 1, px: 1.2, py: 0.35, borderRadius: "999px",
                  background: tipo === "antes" ? "rgba(62,39,35,0.85)" : `linear-gradient(135deg, ${T.gold}, ${T.goldDark})`, pointerEvents: "none" }}>
                  <Typography sx={{ fontFamily: T.font, fontSize: 11, fontWeight: 800, letterSpacing: 0.8, color: "#fff" }}>
                    {tipo === "antes" ? "ANTES" : "DESPUÉS"}
                  </Typography>
                </Box>
                <video
                  ref={tipo === "antes" ? refAntes : refDespues}
                  src={`${API_BASE}${t[tipo].archivo}`}
                  controls
                  playsInline
                  onPause={() => !solo && setReproduciendo(false)}
                  style={{ width: "100%", maxHeight: "74vh", display: "block", objectFit: "contain", background: "#000" }}
                />
              </Box>
            ))}
          </Box>
        </Box>
      )}
    </Dialog>
  );
}

/* ─────────────────────────── página ─────────────────────────── */

export default function AntesDespues() {
  const navigate = useNavigate();
  const pantallaAncha = useMediaQuery("(min-width:1000px)");

  const [rango, setRango] = useState("30");
  const [[desde, hasta], setFechas] = useState(() => RANGOS.find((r) => r.id === "30").calc());
  const [busqueda, setBusqueda] = useState("");
  const [vista, setVista] = useState("todos"); // todos | pendientes | completos

  const [cargando, setCargando] = useState(true);
  const [datos, setDatos] = useState({ resumen: null, pacientes: [] });

  const [pacienteId, setPacienteId] = useState(null);
  const [detalle, setDetalle] = useState(null);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);

  const [subidas, setSubidas] = useState({});   // "trId-tipo" → % de avance
  const [aviso, setAviso] = useState(null);
  const [visor, setVisor] = useState(null);

  const query = useMemo(() => {
    const q = new URLSearchParams();
    if (desde) q.set("desde", desde);
    if (hasta) q.set("hasta", hasta);
    return q.toString();
  }, [desde, hasta]);

  const cargarPacientes = useCallback(async (silencioso = false) => {
    if (!silencioso) setCargando(true);
    try {
      const res = await fetch(`${API_BASE}/api/videos/pacientes?${query}`, { headers: { Authorization: `Bearer ${token()}` } });
      if (res.ok) setDatos(await res.json());
    } catch { /* se queda con lo que tenía */ }
    finally { setCargando(false); }
  }, [query]);

  const cargarDetalle = useCallback(async (id, silencioso = false) => {
    if (!id) { setDetalle(null); return; }
    if (!silencioso) setCargandoDetalle(true);
    try {
      const res = await fetch(`${API_BASE}/api/videos/paciente/${id}?${query}`, { headers: { Authorization: `Bearer ${token()}` } });
      if (res.ok) setDetalle(await res.json());
    } catch { /* silencio */ }
    finally { setCargandoDetalle(false); }
  }, [query]);

  useEffect(() => { cargarPacientes(); }, [cargarPacientes]);
  useEffect(() => { cargarDetalle(pacienteId); }, [pacienteId, cargarDetalle]);

  // Aviso que se va solo
  useEffect(() => {
    if (!aviso) return undefined;
    const t = setTimeout(() => setAviso(null), 4500);
    return () => clearTimeout(t);
  }, [aviso]);

  const elegirRango = (r) => {
    setRango(r.id);
    setFechas(r.calc());
  };

  const pacientesVisibles = useMemo(() => {
    const term = busqueda.trim().toLowerCase();
    return (datos.pacientes || []).filter((p) => {
      if (vista === "pendientes" && p.pendientes === 0) return false;
      if (vista === "completos" && p.pendientes > 0) return false;
      if (!term) return true;
      return `${p.nombre || ""} ${p.apellido || ""} ${p.dni || ""}`.toLowerCase().includes(term);
    });
  }, [datos.pacientes, busqueda, vista]);

  /* ── subir / borrar ── */

  const actualizarTratamiento = (trId, cambio) => {
    setDetalle((prev) => prev && ({
      ...prev,
      tratamientos: prev.tratamientos.map((t) => (t.id === trId ? { ...t, ...cambio } : t)),
    }));
  };

  const subirVideo = (t, tipo, archivo) => {
    const clave = `${t.id}-${tipo}`;
    if (subidas[clave] != null) return;
    const esVideo = /^video\//.test(archivo.type) || /\.(mp4|mov|m4v|webm|avi|3gp|mkv)$/i.test(archivo.name);
    if (!esVideo) { setAviso({ tipo: "error", texto: "Ese archivo no es un video. Usa MP4, MOV o WEBM." }); return; }
    if (archivo.size > 2 * 1024 ** 3) { setAviso({ tipo: "error", texto: "El video pesa más de 2 GB. Recórtalo o comprímelo antes." }); return; }

    setSubidas((s) => ({ ...s, [clave]: 0 }));
    const form = new FormData();
    form.append("video", archivo);

    // XMLHttpRequest para poder mostrar el porcentaje de subida
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_BASE}/api/videos/tratamiento/${t.id}/${tipo}`);
    xhr.setRequestHeader("Authorization", `Bearer ${token()}`);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) setSubidas((s) => ({ ...s, [clave]: Math.min(100, Math.round((e.loaded / e.total) * 100)) }));
    };
    const terminar = () => setSubidas((s) => { const n = { ...s }; delete n[clave]; return n; });
    xhr.onload = () => {
      let data = {};
      try { data = JSON.parse(xhr.responseText || "{}"); } catch { /* respuesta vacía */ }
      terminar();
      if (xhr.status >= 200 && xhr.status < 300 && data.video) {
        actualizarTratamiento(t.id, { [tipo]: data.video });
        setAviso({ tipo: "ok", texto: `Video de ${tipo === "antes" ? "antes" : "después"} guardado ✓` });
        cargarPacientes(true);
      } else {
        setAviso({ tipo: "error", texto: data.message || "No se pudo subir el video" });
      }
    };
    xhr.onerror = () => { terminar(); setAviso({ tipo: "error", texto: "Se cortó la conexión mientras subía el video" }); };
    xhr.send(form);
  };

  const borrarVideo = async (t, tipo) => {
    const video = t[tipo];
    if (!video) return;
    if (!window.confirm(`¿Quitar el video de ${tipo === "antes" ? "antes" : "después"} de "${t.tratamiento_nombre}"? Se borrará del servidor.`)) return;
    try {
      const res = await fetch(`${API_BASE}/api/videos/${video.id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token()}` } });
      if (!res.ok) throw new Error();
      actualizarTratamiento(t.id, { [tipo]: null });
      setAviso({ tipo: "ok", texto: "Video quitado" });
      cargarPacientes(true);
    } catch {
      setAviso({ tipo: "error", texto: "No se pudo quitar el video" });
    }
  };

  const r = datos.resumen;
  const avanceGlobal = r && r.tratamientos ? Math.round(((r.tratamientos - r.tratamientos_pendientes) / r.tratamientos) * 100) : 0;
  const pacienteSel = detalle?.paciente;
  const mostrarLista = pantallaAncha || !pacienteId;
  const mostrarDetalle = pantallaAncha || !!pacienteId;

  const TONOS = {
    dorado: { fuerte: T.gold, oscuro: T.goldDark, suave: T.goldSoft, sombra: "rgba(163,105,32,0.35)" },
    rojo: { fuerte: "#D9822B", oscuro: "#B5541B", suave: T.amberSoft, sombra: "rgba(181,84,27,0.35)" },
    verde: { fuerte: "#43A047", oscuro: "#2E7D32", suave: T.greenSoft, sombra: "rgba(46,125,50,0.30)" },
  };

  return (
    <Box sx={{ minHeight: "100vh", background: T.pageBg, fontFamily: T.font, p: { xs: 2, md: 3 } }}>
      <Box sx={{ maxWidth: 1440, mx: "auto" }}>

        {/* ── Cabecera ── */}
        <MotionBox initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease: suave }}
          sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 3, flexWrap: "wrap" }}>
          <IconButton onClick={() => navigate("/dashboard")}
            sx={{ color: T.gold, background: T.surface, border: `1px solid ${T.border}`, borderRadius: "12px",
              "&:hover": { background: T.goldSoft, borderColor: T.borderHover, transform: "translateX(-2px)" }, transition: "all .2s ease" }}>
            <ArrowBack />
          </IconButton>
          <Box sx={{
            width: 48, height: 48, borderRadius: "14px", display: "flex", alignItems: "center", justifyContent: "center",
            background: `linear-gradient(135deg, ${T.gold} 0%, ${T.goldLight} 100%)`, boxShadow: "0 4px 14px rgba(163,105,32,0.30)",
          }}>
            <VideoLibraryRounded sx={{ color: "#fff" }} />
          </Box>
          <Box sx={{ flex: 1, minWidth: 220 }}>
            <Typography sx={{ fontFamily: T.fontTitle, fontWeight: 600, color: T.text1, fontSize: 28, lineHeight: 1.15 }}>
              Antes y Después
            </Typography>
            <Typography sx={{ fontFamily: T.font, color: T.text2, fontSize: 12.5, letterSpacing: 0.3 }}>
              Videoteca clínica · la evolución de cada paciente en video
            </Typography>
          </Box>
        </MotionBox>

        {/* ── Filtro de fechas ── */}
        <Box sx={{
          display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap", mb: 2.5, p: 1.5,
          borderRadius: "16px", background: T.surface, border: `1px solid ${T.border}`, boxShadow: T.shadow,
        }}>
          <CalendarMonthRounded sx={{ color: T.gold, ml: 0.5 }} />
          {RANGOS.map((op) => (
            <Chip key={op.id} label={op.texto} onClick={() => elegirRango(op)}
              sx={{
                fontFamily: T.font, fontWeight: 600, fontSize: 12.5, borderRadius: "999px",
                background: rango === op.id ? T.gold : "#fff", color: rango === op.id ? "#fff" : T.text2,
                border: rango === op.id ? "none" : `1px solid ${T.border}`,
                "&:hover": { background: rango === op.id ? T.goldDark : T.goldSoft },
              }} />
          ))}
          <Box sx={{ flex: 1 }} />
          {[
            { etiqueta: "Desde", valor: desde, set: (v) => setFechas([v, hasta]) },
            { etiqueta: "Hasta", valor: hasta, set: (v) => setFechas([desde, v]) },
          ].map((f) => (
            <TextField key={f.etiqueta} type="date" size="small" label={f.etiqueta} value={f.valor}
              onChange={(e) => { setRango("personalizado"); f.set(e.target.value); }}
              InputLabelProps={{ shrink: true }}
              sx={{ width: 160, "& .MuiOutlinedInput-root": { borderRadius: "12px", fontFamily: T.font, fontSize: 13 } }} />
          ))}
        </Box>

        {/* ── Resumen ── */}
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4, 1fr)" }, gap: 2, mb: 1.5 }}>
          <Kpi i={0} Icono={PeopleAltRounded} titulo="Pacientes" valor={r?.pacientes ?? "–"}
            detalle={r ? `${r.tratamientos} tratamientos en el rango` : null}
            tono={TONOS.dorado} activo={vista === "todos"} onClick={() => setVista("todos")} />
          <Kpi i={1} Icono={PendingActionsRounded} titulo="Faltan videos" valor={r?.pacientes_pendientes ?? "–"}
            detalle={r ? `${r.tratamientos_pendientes} tratamientos sin antes y después` : null}
            tono={TONOS.rojo} activo={vista === "pendientes"} onClick={() => setVista("pendientes")} />
          <Kpi i={2} Icono={CheckCircleRounded} titulo="Completos" valor={r?.pacientes_completos ?? "–"}
            detalle="Pacientes con todos sus videos" tono={TONOS.verde}
            activo={vista === "completos"} onClick={() => setVista("completos")} />
          <Kpi i={3} Icono={MovieRounded} titulo="Videos subidos" valor={r?.videos ?? "–"}
            detalle={r ? `Faltan ${r.faltan_antes} de antes · ${r.faltan_despues} de después` : null} tono={TONOS.dorado} />
        </Box>
        {r && r.tratamientos > 0 && (
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 3, px: 0.5 }}>
            <LinearProgress variant="determinate" value={avanceGlobal}
              sx={{ flex: 1, height: 7, borderRadius: 4, background: "rgba(163,105,32,0.10)",
                "& .MuiLinearProgress-bar": { borderRadius: 4, background: `linear-gradient(90deg, ${T.goldLight}, ${T.gold})` } }} />
            <Typography sx={{ fontFamily: T.font, fontSize: 12, fontWeight: 700, color: T.goldDark, whiteSpace: "nowrap" }}>
              {avanceGlobal}% de los tratamientos con su antes y después
            </Typography>
          </Box>
        )}

        {/* ── Lista + detalle ── */}
        <Box sx={{ display: "grid", gridTemplateColumns: pantallaAncha ? "380px 1fr" : "1fr", gap: 2.5, alignItems: "start" }}>

          {/* Lista de pacientes */}
          {mostrarLista && (
            <Box sx={{
              p: 1.5, borderRadius: "20px", background: "rgba(255,255,255,0.65)", border: `1px solid ${T.border}`,
              position: pantallaAncha ? "sticky" : "static", top: 16,
            }}>
              <TextField fullWidth size="small" placeholder="Buscar paciente o DNI…" value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                InputProps={{ startAdornment: <InputAdornment position="start"><Search sx={{ color: T.text3 }} /></InputAdornment> }}
                sx={{ mb: 1.2, "& .MuiOutlinedInput-root": { borderRadius: "12px", background: "#fff", fontFamily: T.font,
                  "& fieldset": { borderColor: T.border }, "&.Mui-focused fieldset": { borderColor: T.gold } } }} />

              <Box sx={{ display: "flex", gap: 0.5, mb: 1.2, p: "3px", borderRadius: "12px", background: T.surface2 }}>
                {[
                  { id: "todos", texto: "Todos" },
                  { id: "pendientes", texto: `Faltan${r ? ` (${r.pacientes_pendientes})` : ""}` },
                  { id: "completos", texto: "Completos" },
                ].map((v) => (
                  <Box key={v.id} onClick={() => setVista(v.id)} sx={{
                    flex: 1, textAlign: "center", py: 0.7, borderRadius: "9px", cursor: "pointer",
                    background: vista === v.id ? "#fff" : "transparent",
                    boxShadow: vista === v.id ? "0 2px 8px rgba(163,105,32,0.15)" : "none",
                    transition: "background .2s ease",
                  }}>
                    <Typography sx={{ fontFamily: T.font, fontSize: 12, fontWeight: vista === v.id ? 700 : 600, color: vista === v.id ? T.goldDark : T.text2 }}>
                      {v.texto}
                    </Typography>
                  </Box>
                ))}
              </Box>

              <Box sx={{
                maxHeight: pantallaAncha ? "calc(100vh - 210px)" : "none", overflowY: "auto", pr: 0.5,
                "&::-webkit-scrollbar": { width: 6 }, "&::-webkit-scrollbar-thumb": { borderRadius: 999, background: "rgba(163,105,32,0.25)" },
              }}>
                {cargando ? (
                  <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}><CircularProgress size={28} sx={{ color: T.gold }} /></Box>
                ) : pacientesVisibles.length === 0 ? (
                  <Box sx={{ textAlign: "center", py: 6, px: 2 }}>
                    <PeopleAltRounded sx={{ fontSize: 40, color: "rgba(163,105,32,0.3)" }} />
                    <Typography sx={{ fontFamily: T.font, fontSize: 13.5, fontWeight: 600, color: T.text1, mt: 1 }}>
                      {vista === "pendientes" ? "¡Nadie pendiente! 🎉" : "No hay pacientes en este rango"}
                    </Typography>
                    <Typography sx={{ fontFamily: T.font, fontSize: 12, color: T.text3 }}>Prueba con otro rango de fechas</Typography>
                  </Box>
                ) : (
                  pacientesVisibles.map((p) => (
                    <FilaPaciente key={p.id} p={p} activo={p.id === pacienteId} onClick={() => setPacienteId(p.id)} />
                  ))
                )}
              </Box>
            </Box>
          )}

          {/* Detalle del paciente */}
          {mostrarDetalle && (
            <Box sx={{ minWidth: 0 }}>
              {!pacienteId ? (
                <Box sx={{
                  textAlign: "center", py: 10, px: 3, borderRadius: "20px",
                  background: "rgba(255,255,255,0.65)", border: `1px dashed ${T.borderHover}`,
                }}>
                  <Box sx={{ width: 74, height: 74, borderRadius: "50%", mx: "auto", display: "flex", alignItems: "center", justifyContent: "center", background: T.goldSoft }}>
                    <VideoLibraryRounded sx={{ fontSize: 36, color: T.gold }} />
                  </Box>
                  <Typography sx={{ fontFamily: T.fontTitle, fontSize: 21, fontWeight: 600, color: T.text1, mt: 2 }}>
                    Elige un paciente
                  </Typography>
                  <Typography sx={{ fontFamily: T.font, fontSize: 13, color: T.text2, mt: 0.5, maxWidth: 420, mx: "auto" }}>
                    Verás sus tratamientos realizados y en cada uno podrás subir el video de antes y el de después.
                    {r?.pacientes_pendientes ? ` Usa "Faltan videos" para ir directo a los ${r.pacientes_pendientes} pendientes.` : ""}
                  </Typography>
                </Box>
              ) : (
                <>
                  {/* Cabecera del paciente */}
                  <Box sx={{
                    display: "flex", alignItems: "center", gap: 1.6, p: 2, mb: 2, borderRadius: "20px",
                    background: `linear-gradient(135deg, ${T.gold} 0%, ${T.goldDark} 100%)`, color: "#fff",
                    boxShadow: "0 10px 26px rgba(163,105,32,0.30)",
                  }}>
                    {!pantallaAncha && (
                      <IconButton onClick={() => setPacienteId(null)} sx={{ color: "#fff", background: "rgba(255,255,255,0.15)" }}>
                        <ArrowBack />
                      </IconButton>
                    )}
                    <Avatar paciente={pacienteSel || datos.pacientes.find((p) => p.id === pacienteId)} tam={54} />
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ fontFamily: T.fontTitle, fontSize: { xs: 19, sm: 23 }, fontWeight: 600, lineHeight: 1.2, color: "#fff" }} noWrap>
                        {nombreCompleto(pacienteSel || datos.pacientes.find((p) => p.id === pacienteId))}
                      </Typography>
                      <Typography sx={{ fontFamily: T.font, fontSize: 12.5, opacity: 0.9, color: "#fff" }}>
                        {pacienteSel?.dni ? `DNI ${pacienteSel.dni} · ` : ""}
                        {detalle ? `${detalle.tratamientos.length} tratamiento${detalle.tratamientos.length === 1 ? "" : "s"} en el rango` : "Cargando…"}
                      </Typography>
                    </Box>
                    {detalle && (() => {
                      const total = detalle.tratamientos.length;
                      const listos = detalle.tratamientos.filter((t) => t.antes && t.despues).length;
                      return (
                        <Box sx={{ textAlign: "right", flexShrink: 0 }}>
                          <Typography sx={{ fontFamily: T.fontTitle, fontSize: 26, fontWeight: 600, lineHeight: 1, color: "#fff" }}>{listos}/{total}</Typography>
                          <Typography sx={{ fontFamily: T.font, fontSize: 11, opacity: 0.85, color: "#fff" }}>completos</Typography>
                        </Box>
                      );
                    })()}
                  </Box>

                  {cargandoDetalle && !detalle ? (
                    <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}><CircularProgress size={30} sx={{ color: T.gold }} /></Box>
                  ) : detalle && detalle.tratamientos.length === 0 ? (
                    <Typography sx={{ fontFamily: T.font, textAlign: "center", color: T.text3, py: 6 }}>
                      Este paciente no tiene tratamientos en el rango elegido.
                    </Typography>
                  ) : (
                    detalle?.tratamientos.map((t, i) => (
                      <TarjetaTratamiento
                        key={t.id}
                        t={t}
                        i={i}
                        subidas={subidas}
                        onSubir={subirVideo}
                        onBorrar={borrarVideo}
                        onComparar={(tr, solo) => setVisor({ tratamiento: tr, solo, paciente: pacienteSel })}
                      />
                    ))
                  )}
                </>
              )}
            </Box>
          )}
        </Box>
      </Box>

      {/* Aviso flotante */}
      <AnimatePresence>
        {aviso && (
          <MotionBox
            key={aviso.texto}
            initial={{ opacity: 0, y: 30, x: "-50%" }}
            animate={{ opacity: 1, y: 0, x: "-50%" }}
            exit={{ opacity: 0, y: 20, x: "-50%" }}
            transition={{ duration: 0.3, ease: suave }}
            sx={{
              position: "fixed", bottom: 24, left: "50%", zIndex: 1500,
              display: "flex", alignItems: "center", gap: 1, px: 2.2, py: 1.2, borderRadius: "14px",
              background: aviso.tipo === "ok" ? "#2E7D32" : "#C62828", color: "#fff",
              boxShadow: "0 12px 30px rgba(0,0,0,0.25)",
            }}
          >
            {aviso.tipo === "ok" ? <CheckCircleRounded sx={{ fontSize: 20 }} /> : <ErrorOutlineRounded sx={{ fontSize: 20 }} />}
            <Typography sx={{ fontFamily: T.font, fontSize: 13.5, fontWeight: 600 }}>{aviso.texto}</Typography>
          </MotionBox>
        )}
      </AnimatePresence>

      <VisorComparar datos={visor} onCerrar={() => setVisor(null)} />
    </Box>
  );
}
