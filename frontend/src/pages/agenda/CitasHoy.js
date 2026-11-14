/**
 * Panel "Citas de hoy" del menú principal.
 *
 * Una agenda de un solo día pensada para recepción: quién está en atención,
 * quién viene después y cuánto falta. Usa los mismos calendarios, colores y
 * casillas marcadas que la Agenda (y que Google Calendar). Al hacer clic en
 * una cita se abre en la Agenda con su detalle.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Box, Button, ButtonBase, CircularProgress, IconButton, Tooltip, Typography } from "@mui/material";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { CalendarMonth, ChevronRight, Refresh } from "../../iconos";
import { BRAND, FONTS } from "../../brand";
import useSocket from "../../hooks/useSocket";
import agendaApi, { mensajeError } from "./api";
import { colorCita } from "./colores";
import { ahoraMinutos, citaEnDia, hoy as hoyFn, horaDe, sumarDias, textoDiaLargo, tramoEnDia } from "./fechas";

const MotionBox = motion(Box);

const leerMarcas = () => {
  try {
    return JSON.parse(localStorage.getItem("agenda.calMarcas") || "{}") || {};
  } catch {
    return {};
  }
};

const nombrePaciente = (c) =>
  c.paciente
    ? [c.paciente.nombre, c.paciente.apellido].map((x) => String(x || "").trim()).filter(Boolean).join(" ")
    : c.titulo || "(Sin título)";

/** "en 25 min", "en 1 h 10 min" */
const textoFalta = (min) => {
  if (min < 1) return "ahora";
  if (min < 60) return `en ${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `en ${h} h ${m} min` : `en ${h} h`;
};

const ETIQUETA = { pasada: "Ya pasó", curso: "En atención", proxima: "Por venir" };

export default function CitasHoy({ compacto = false }) {
  const navigate = useNavigate();
  const [dia, setDia] = useState(hoyFn());
  const [ahora, setAhora] = useState(ahoraMinutos());
  const [estado, setEstado] = useState(null); // { configurado, ... }
  const [citas, setCitas] = useState([]);
  const [calendarios, setCalendarios] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [oculto, setOculto] = useState(false); // sin permiso para ver la agenda
  const [filtro, setFiltro] = useState(null); // calendarId
  const [verPasadas, setVerPasadas] = useState(false);
  const pedido = useRef(0);

  /* ───── Datos ───── */
  const cargar = useCallback(
    async ({ silencioso = false } = {}) => {
      const n = ++pedido.current;
      if (!silencioso) setCargando(true);
      try {
        const est = await agendaApi.estado();
        if (n !== pedido.current) return;
        setEstado(est);
        if (!est?.configurado) {
          setCitas([]);
          return;
        }
        const hoy = hoyFn();
        const [r, cals] = await Promise.all([
          agendaApi.listar(hoy, sumarDias(hoy, 1)),
          agendaApi.calendarios().catch(() => null),
        ]);
        if (n !== pedido.current) return;
        setDia(hoy);
        setCitas(r?.eventos || []);
        if (cals) setCalendarios(Array.isArray(cals) ? cals : cals.calendarios || []);
        setError("");
      } catch (err) {
        if (n !== pedido.current) return;
        const st = err?.response?.status;
        if (st === 401 || st === 403) setOculto(true);
        else if (st === 409) setEstado({ configurado: false });
        else setError(mensajeError(err, "No se pudieron cargar las citas de hoy."));
      } finally {
        if (n === pedido.current) setCargando(false);
      }
    },
    []
  );

  useEffect(() => {
    cargar();
  }, [cargar]);

  useSocket("agenda:updated", () => cargar({ silencioso: true }));

  // Cada minuto: reloj (para "en curso"/"en 10 min") y, cada 2 min, recarga
  useEffect(() => {
    let vueltas = 0;
    const t = setInterval(() => {
      setAhora(ahoraMinutos());
      vueltas += 1;
      if (hoyFn() !== dia) cargar({ silencioso: true }); // pasó la medianoche
      else if (vueltas % 2 === 0 && document.visibilityState === "visible") cargar({ silencioso: true });
    }, 60000);
    const alVolver = () => {
      setAhora(ahoraMinutos());
      if (document.visibilityState === "visible") cargar({ silencioso: true });
    };
    window.addEventListener("focus", alVolver);
    return () => {
      clearInterval(t);
      window.removeEventListener("focus", alVolver);
    };
  }, [cargar, dia]);

  /* ───── Lo que se muestra ───── */
  // Mismas casillas que en la Agenda: lo que esta persona desmarcó no aparece aquí
  const visibles = useMemo(() => {
    const marcas = leerMarcas();
    const porId = Object.fromEntries(calendarios.map((c) => [c.id, c]));
    return citas.filter((c) => {
      if (!citaEnDia(c, dia)) return false;
      if (typeof marcas[c.calendarId] === "boolean") return marcas[c.calendarId];
      const cal = porId[c.calendarId];
      return cal ? cal.marcadoEnGoogle !== false : true;
    });
  }, [citas, calendarios, dia]);

  const especialistas = useMemo(() => {
    const m = new Map();
    visibles.forEach((c) => {
      if (!c.calendarId || m.has(c.calendarId)) return;
      const cal = calendarios.find((x) => x.id === c.calendarId);
      m.set(c.calendarId, {
        id: c.calendarId,
        nombre: cal?.nombre || c.calendarioNombre || "Calendario",
        color: cal?.color || colorCita(c),
        total: 0,
      });
    });
    visibles.forEach((c) => m.get(c.calendarId) && (m.get(c.calendarId).total += 1));
    return [...m.values()].sort((a, b) => b.total - a.total);
  }, [visibles, calendarios]);

  useEffect(() => {
    if (filtro && !especialistas.some((e) => e.id === filtro)) setFiltro(null);
  }, [filtro, especialistas]);

  const { todoElDia, conHora } = useMemo(() => {
    const lista = filtro ? visibles.filter((c) => c.calendarId === filtro) : visibles;
    const conHora = lista
      .filter((c) => !c.todoElDia)
      .map((c) => {
        const { ini, fin } = tramoEnDia(c, dia);
        const fase = fin <= ahora ? "pasada" : ini <= ahora ? "curso" : "proxima";
        return { cita: c, ini, fin, fase };
      })
      .sort((a, b) => a.ini - b.ini || a.fin - b.fin);
    return { todoElDia: lista.filter((c) => c.todoElDia), conHora };
  }, [visibles, filtro, dia, ahora]);

  const pasadas = conHora.filter((x) => x.fase === "pasada");
  const enCurso = conHora.filter((x) => x.fase === "curso");
  const proximas = conHora.filter((x) => x.fase === "proxima");
  const siguiente = proximas[0];

  const abrirCita = (c) => navigate("/agenda", { state: { irA: dia, citaId: c.id, vista: "dia" } });
  const abrirAgenda = () => navigate("/agenda", { state: { irA: dia, vista: "dia" } });

  if (oculto) return null;

  /* ───── Piezas ───── */
  const Encabezado = (
    <Box sx={{ px: 2.25, pt: 2.25, pb: 1.75, borderBottom: `1px solid ${BRAND.borde}` }}>
      <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            sx={{ fontSize: "0.68rem", fontWeight: 600, letterSpacing: "0.22em", textTransform: "uppercase", color: BRAND.oroOscuro }}
          >
            Citas de hoy
          </Typography>
          <Typography sx={{ fontFamily: FONTS.titulo, fontSize: "1.2rem", letterSpacing: "0.04em", color: BRAND.texto, mt: 0.25 }}>
            {textoDiaLargo(dia)}
          </Typography>
        </Box>
        <Tooltip title="Actualizar">
          <span>
            <IconButton size="small" onClick={() => cargar()} disabled={cargando} aria-label="Actualizar citas de hoy">
              {cargando ? <CircularProgress size={16} sx={{ color: BRAND.oro }} /> : <Refresh sx={{ fontSize: 18, color: BRAND.arena }} />}
            </IconButton>
          </span>
        </Tooltip>
      </Box>

      {estado?.configurado && (
        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 0.75, mt: 1.5 }}>
          {[
            { n: conHora.length + todoElDia.length, t: "Total", c: BRAND.texto },
            { n: enCurso.length, t: "En atención", c: BRAND.exito },
            { n: proximas.length, t: "Por venir", c: BRAND.oro },
          ].map((k) => (
            <Box key={k.t} sx={{ textAlign: "center", py: 0.9, borderRadius: "12px", backgroundColor: BRAND.cremaClara, border: `1px solid ${BRAND.borde}` }}>
              <Typography sx={{ fontSize: "1.15rem", fontWeight: 700, lineHeight: 1.1, color: k.c }}>{k.n}</Typography>
              <Typography sx={{ fontSize: "0.64rem", color: BRAND.textoTenue, letterSpacing: "0.04em" }}>{k.t}</Typography>
            </Box>
          ))}
        </Box>
      )}

      {especialistas.length > 1 && (
        <Box
          sx={{
            display: "flex",
            gap: 0.6,
            mt: 1.5,
            // En el lateral caben en varias filas; en celular, una fila que se desliza
            flexWrap: compacto ? "nowrap" : "wrap",
            overflowX: compacto ? "auto" : "visible",
            scrollbarWidth: "none",
            "&::-webkit-scrollbar": { display: "none" },
          }}
        >
          <Filtro activo={!filtro} onClick={() => setFiltro(null)} etiqueta="Todas" />
          {especialistas.map((e) => (
            <Filtro
              key={e.id}
              activo={filtro === e.id}
              onClick={() => setFiltro(filtro === e.id ? null : e.id)}
              etiqueta={e.nombre}
              color={e.color}
              total={e.total}
            />
          ))}
        </Box>
      )}
    </Box>
  );

  let cuerpo;
  if (cargando && !estado) {
    cuerpo = (
      <Box sx={{ p: 2.25, display: "flex", flexDirection: "column", gap: 1.25 }}>
        {[0, 1, 2, 3].map((i) => (
          <Box
            key={i}
            sx={{
              height: 58,
              borderRadius: "14px",
              background: `linear-gradient(90deg, ${BRAND.crema} 0%, ${BRAND.cremaClara} 50%, ${BRAND.crema} 100%)`,
              backgroundSize: "200% 100%",
              animation: "citasHoyBrillo 1.4s ease-in-out infinite",
              "@keyframes citasHoyBrillo": { "0%": { backgroundPosition: "100% 0" }, "100%": { backgroundPosition: "-100% 0" } },
            }}
          />
        ))}
      </Box>
    );
  } else if (estado && !estado.configurado) {
    cuerpo = (
      <Vacio
        titulo="Agenda sin conectar"
        texto="Conecta Google Calendar en la Agenda para ver aquí las citas del día."
        accion="Ir a la Agenda"
        onAccion={abrirAgenda}
      />
    );
  } else if (error && citas.length === 0) {
    cuerpo = <Vacio titulo="No se pudo cargar" texto={error} accion="Reintentar" onAccion={() => cargar()} />;
  } else if (conHora.length === 0 && todoElDia.length === 0) {
    cuerpo = (
      <Vacio
        titulo={filtro ? "Sin citas para este calendario" : "No hay citas hoy"}
        texto={filtro ? "Elige “Todas” para ver el resto del día." : "Cuando se agende algo para hoy aparecerá aquí."}
        accion={filtro ? undefined : "Agendar una cita"}
        onAccion={() => navigate("/agenda", { state: { nuevaCita: {} } })}
      />
    );
  } else {
    const visiblesPasadas = verPasadas ? pasadas : [];
    cuerpo = (
      <Box sx={{ px: 1.5, py: 1.5 }}>
        {todoElDia.length > 0 && (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 0.6, mb: 1.5, px: 0.5 }}>
            {todoElDia.map((c) => (
              <ButtonBase
                key={c.id}
                onClick={() => abrirCita(c)}
                sx={{
                  justifyContent: "flex-start",
                  gap: 1,
                  px: 1.25,
                  py: 0.75,
                  borderRadius: "10px",
                  backgroundColor: `${colorCita(c)}1f`,
                  borderLeft: `3px solid ${colorCita(c)}`,
                  textAlign: "left",
                }}
              >
                <Typography sx={{ fontSize: "0.66rem", fontWeight: 700, color: BRAND.textoSuave, letterSpacing: "0.06em", flexShrink: 0 }}>
                  TODO EL DÍA
                </Typography>
                <Typography noWrap sx={{ fontSize: "0.8rem", fontWeight: 600, color: BRAND.texto }}>
                  {nombrePaciente(c)}
                </Typography>
              </ButtonBase>
            ))}
          </Box>
        )}

        {pasadas.length > 0 && (
          <ButtonBase
            onClick={() => setVerPasadas((v) => !v)}
            sx={{
              width: "100%",
              justifyContent: "flex-start",
              gap: 0.75,
              px: 1,
              py: 0.75,
              mb: 0.5,
              borderRadius: "10px",
              color: BRAND.textoTenue,
              fontSize: "0.74rem",
              "&:hover": { backgroundColor: "rgba(163,105,32,0.05)" },
            }}
          >
            <ChevronRight sx={{ fontSize: 16, transform: verPasadas ? "rotate(90deg)" : "none", transition: "transform .2s" }} />
            {verPasadas ? "Ocultar" : "Ver"} {pasadas.length} {pasadas.length === 1 ? "cita que ya pasó" : "citas que ya pasaron"}
          </ButtonBase>
        )}

        <Box sx={{ position: "relative" }}>
          {/* Línea de tiempo */}
          <Box sx={{ position: "absolute", left: 57, top: 10, bottom: 10, width: "2px", backgroundColor: BRAND.crema, borderRadius: 2 }} />
          {[...visiblesPasadas, ...enCurso, ...proximas].map((x, i) => (
            <Fila
              key={x.cita.id}
              item={x}
              indice={i}
              esSiguiente={siguiente?.cita.id === x.cita.id}
              falta={x.fase === "proxima" ? x.ini - ahora : null}
              onClick={() => abrirCita(x.cita)}
            />
          ))}
          {enCurso.length === 0 && proximas.length === 0 && (
            <Typography sx={{ textAlign: "center", fontSize: "0.82rem", color: BRAND.textoSuave, py: 3 }}>
              ✨ Ya se atendieron todas las citas de hoy
            </Typography>
          )}
        </Box>
      </Box>
    );
  }

  return (
    <MotionBox
      initial={{ opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      component="aside"
      aria-label="Citas de hoy"
      sx={{
        display: "flex",
        flexDirection: "column",
        backgroundColor: "rgba(255,255,255,0.92)",
        backdropFilter: "blur(8px)",
        border: `1px solid ${BRAND.borde}`,
        borderRadius: "22px",
        boxShadow: "0 24px 48px -32px rgba(92,60,18,0.45)",
        overflow: "hidden",
        maxHeight: compacto ? 560 : "100%",
      }}
    >
      {Encabezado}
      <Box sx={{ flex: 1, minHeight: 0, overflowY: "auto" }}>{cuerpo}</Box>
      {estado?.configurado && (
        <Box sx={{ p: 1.5, borderTop: `1px solid ${BRAND.borde}` }}>
          <Button
            fullWidth
            variant="contained"
            onClick={abrirAgenda}
            startIcon={<CalendarMonth sx={{ fontSize: 18 }} />}
            sx={{ borderRadius: "999px", py: 1 }}
          >
            Abrir agenda del día
          </Button>
        </Box>
      )}
    </MotionBox>
  );
}

/* ───────── Piezas pequeñas ───────── */

function Filtro({ activo, onClick, etiqueta, color, total }) {
  return (
    <ButtonBase
      onClick={onClick}
      title={etiqueta}
      sx={{
        flexShrink: 0,
        gap: 0.6,
        px: 1.1,
        py: 0.45,
        borderRadius: "999px",
        fontSize: "0.72rem",
        fontWeight: activo ? 600 : 500,
        color: activo ? BRAND.blanco : BRAND.textoSuave,
        backgroundColor: activo ? BRAND.oro : BRAND.cremaClara,
        border: `1px solid ${activo ? BRAND.oro : BRAND.borde}`,
        transition: "all .15s",
        maxWidth: 170,
      }}
    >
      {color && <Box component="span" sx={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: color, flexShrink: 0, boxShadow: activo ? "0 0 0 1.5px #fff" : "none" }} />}
      <Box component="span" sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {etiqueta}
      </Box>
      {total != null && (
        <Box component="span" sx={{ opacity: 0.75 }}>
          {total}
        </Box>
      )}
    </ButtonBase>
  );
}

function Fila({ item, indice, esSiguiente, falta, onClick }) {
  const { cita, fase } = item;
  const color = colorCita(cita);
  const pasada = fase === "pasada";
  const curso = fase === "curso";
  const detalle = [cita.tratamiento, cita.especialistaNombre || cita.calendarioNombre].filter(Boolean).join(" · ");

  return (
    <MotionBox
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: Math.min(indice, 10) * 0.03 }}
      sx={{ display: "flex", alignItems: "stretch", gap: 1.25, position: "relative", mb: 0.75 }}
    >
      {/* Hora */}
      <Box sx={{ width: 44, flexShrink: 0, textAlign: "right", pt: 1.1 }}>
        <Typography sx={{ fontSize: "0.82rem", fontWeight: 700, color: pasada ? BRAND.textoTenue : BRAND.texto, lineHeight: 1.1 }}>
          {horaDe(cita.inicio)}
        </Typography>
        <Typography sx={{ fontSize: "0.66rem", color: BRAND.textoTenue }}>{horaDe(cita.fin)}</Typography>
      </Box>

      {/* Punto en la línea */}
      <Box sx={{ width: 12, flexShrink: 0, display: "flex", justifyContent: "center", pt: 1.4, zIndex: 1 }}>
        <Box
          sx={{
            width: curso ? 12 : 10,
            height: curso ? 12 : 10,
            borderRadius: "50%",
            backgroundColor: pasada ? BRAND.arenaClara : color,
            border: "2px solid #fff",
            boxShadow: curso ? `0 0 0 4px ${color}33` : `0 0 0 1px ${BRAND.borde}`,
            animation: curso ? "citasHoyLatido 1.8s ease-in-out infinite" : "none",
            "@keyframes citasHoyLatido": {
              "0%, 100%": { boxShadow: `0 0 0 3px ${color}40` },
              "50%": { boxShadow: `0 0 0 7px ${color}14` },
            },
          }}
        />
      </Box>

      {/* Tarjeta */}
      <ButtonBase
        onClick={onClick}
        sx={{
          flex: 1,
          minWidth: 0,
          display: "block",
          textAlign: "left",
          px: 1.4,
          py: 1,
          borderRadius: "14px",
          border: `1px solid ${curso || esSiguiente ? `${color}66` : BRAND.borde}`,
          borderLeft: `4px solid ${pasada ? BRAND.arenaClara : color}`,
          backgroundColor: curso ? `${color}14` : pasada ? "transparent" : BRAND.blanco,
          opacity: pasada ? 0.62 : 1,
          boxShadow: esSiguiente ? `0 10px 22px -16px ${color}` : "none",
          transition: "transform .15s ease, box-shadow .15s ease, background-color .15s",
          "&:hover": {
            transform: "translateX(2px)",
            backgroundColor: curso ? `${color}1f` : "rgba(163,105,32,0.04)",
            opacity: 1,
          },
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
          <Typography
            noWrap
            sx={{
              flex: 1,
              minWidth: 0,
              fontSize: "0.86rem",
              fontWeight: 600,
              color: BRAND.texto,
              textDecoration: pasada ? "line-through" : "none",
              textDecorationColor: BRAND.arenaClara,
            }}
          >
            {nombrePaciente(cita)}
          </Typography>
          {(curso || esSiguiente) && (
            <Box
              component="span"
              sx={{
                flexShrink: 0,
                px: 0.8,
                py: "1px",
                borderRadius: "999px",
                fontSize: "0.62rem",
                fontWeight: 700,
                letterSpacing: "0.03em",
                color: curso ? BRAND.exito : BRAND.oroOscuro,
                backgroundColor: curso ? "rgba(79,122,74,0.12)" : "rgba(163,105,32,0.1)",
              }}
            >
              {curso ? ETIQUETA.curso : textoFalta(falta)}
            </Box>
          )}
        </Box>
        {detalle && (
          <Typography noWrap sx={{ fontSize: "0.72rem", color: BRAND.textoSuave, mt: 0.2 }}>
            {detalle}
          </Typography>
        )}
        {!cita.paciente && !pasada && (
          <Typography sx={{ fontSize: "0.64rem", color: BRAND.aviso, mt: 0.3, fontWeight: 600 }}>
            Sin ficha en el historial
          </Typography>
        )}
      </ButtonBase>
    </MotionBox>
  );
}

function Vacio({ titulo, texto, accion, onAccion }) {
  return (
    <Box sx={{ textAlign: "center", px: 3, py: 5 }}>
      <Box
        sx={{
          width: 56,
          height: 56,
          mx: "auto",
          mb: 1.5,
          borderRadius: "50%",
          display: "grid",
          placeItems: "center",
          backgroundColor: BRAND.crema,
          color: BRAND.oro,
        }}
      >
        <CalendarMonth sx={{ fontSize: 26 }} />
      </Box>
      <Typography sx={{ fontWeight: 600, fontSize: "0.92rem", color: BRAND.texto }}>{titulo}</Typography>
      <Typography sx={{ fontSize: "0.78rem", color: BRAND.textoSuave, mt: 0.5, mb: accion ? 2 : 0 }}>{texto}</Typography>
      {accion && (
        <Button size="small" variant="outlined" onClick={onAccion} sx={{ borderRadius: "999px" }}>
          {accion}
        </Button>
      )}
    </Box>
  );
}
