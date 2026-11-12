/**
 * Vista de Día y de Semana: cuadrícula de horas con las citas encima.
 *
 * - Clic en un espacio vacío → nueva cita a esa hora.
 * - Clic en una cita → ver detalle.
 * - Con mouse se puede arrastrar una cita para cambiarle la hora o el día
 *   (en pantallas táctiles se desactiva para no interferir con el scroll).
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Box, Typography, Tooltip } from "@mui/material";
import { BRAND } from "../../brand";
import { colorCita, suavizar, oscurecer } from "./colores";
import {
  hoy as hoyFn,
  ahoraMinutos,
  aHora,
  citaEnDia,
  tramoEnDia,
  nombreDiaCorto,
  numeroDia,
  sumarDias,
  fechaDe,
  duracionMinutos,
  sumarMinutos,
} from "./fechas";

const HORA_PX = 52;
const PX_MIN = HORA_PX / 60;
const PASO = 15; // minutos a los que se ajustan clics y arrastres
const GUTTER = 56;

/** Reparte en columnas las citas que se cruzan, como hace Google Calendar. */
const distribuir = (tramos) => {
  const orden = [...tramos].sort((a, b) => a.ini - b.ini || b.fin - a.fin);
  const resultado = [];
  let grupo = [];
  let finGrupo = -1;
  const cerrarGrupo = () => {
    const columnas = [];
    grupo.forEach((t) => {
      let col = columnas.findIndex((finCol) => finCol <= t.ini);
      if (col === -1) {
        col = columnas.length;
        columnas.push(t.fin);
      } else columnas[col] = t.fin;
      t.col = col;
    });
    grupo.forEach((t) => resultado.push({ ...t, cols: columnas.length }));
    grupo = [];
  };
  orden.forEach((t) => {
    if (grupo.length && t.ini >= finGrupo) {
      cerrarGrupo();
      finGrupo = -1;
    }
    grupo.push(t);
    finGrupo = Math.max(finGrupo, t.fin);
  });
  if (grupo.length) cerrarGrupo();
  return resultado;
};

const nombreCorto = (cita) => {
  if (!cita.paciente) return cita.titulo;
  return [cita.paciente.nombre, cita.paciente.apellido].filter(Boolean).join(" ").trim();
};

function BloqueCita({ cita, tramo, dia, onAbrir, onIniciarArrastre, arrastrando }) {
  const color = colorCita(cita);
  const alto = Math.max((tramo.fin - tramo.ini) * PX_MIN - 2, 18);
  const ancho = 100 / tramo.cols;
  const compacto = alto < 38;
  const detalle = [cita.tratamiento, cita.especialistaNombre].filter(Boolean).join(" · ");
  const titulo = cita.paciente ? nombreCorto(cita) : cita.titulo;

  return (
    <Box
      role="button"
      tabIndex={0}
      aria-label={`${titulo}, ${aHora(tramo.ini)} a ${aHora(tramo.fin)}`}
      onPointerDown={(e) => onIniciarArrastre(e, cita, dia)}
      onClick={(e) => {
        e.stopPropagation();
        if (!arrastrando) onAbrir(cita);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onAbrir(cita);
        }
      }}
      sx={{
        position: "absolute",
        top: tramo.ini * PX_MIN + 1,
        height: alto,
        left: `calc(${tramo.col * ancho}% + 2px)`,
        width: `calc(${ancho}% - 4px)`,
        bgcolor: suavizar(color, 0.8),
        borderLeft: `3px solid ${color}`,
        borderRadius: "6px",
        px: 0.75,
        py: compacto ? 0.1 : 0.4,
        overflow: "hidden",
        cursor: "pointer",
        color: oscurecer(color, 0.55),
        boxShadow: arrastrando ? "0 6px 18px rgba(0,0,0,0.18)" : "none",
        opacity: arrastrando ? 0.85 : 1,
        zIndex: arrastrando ? 5 : 2,
        transition: "box-shadow .15s ease, filter .15s ease",
        userSelect: "none",
        "&:hover": { filter: "brightness(0.97)", boxShadow: "0 2px 8px rgba(0,0,0,0.10)" },
        "&:focus-visible": { outline: `2px solid ${BRAND.oro}`, outlineOffset: 1 },
      }}
    >
      {compacto ? (
        <Typography noWrap sx={{ fontSize: 11.5, fontWeight: 600, lineHeight: `${alto - 2}px` }}>
          {aHora(tramo.ini)} {titulo}
        </Typography>
      ) : (
        <>
          <Typography noWrap sx={{ fontSize: 12.5, fontWeight: 700, lineHeight: 1.25 }}>
            {titulo}
          </Typography>
          <Typography noWrap sx={{ fontSize: 11.5, opacity: 0.85, lineHeight: 1.3 }}>
            {aHora(tramo.ini)} – {aHora(tramo.fin)}
          </Typography>
          {alto > 56 && detalle && (
            <Typography noWrap sx={{ fontSize: 11.5, opacity: 0.8, lineHeight: 1.3 }}>
              {detalle}
            </Typography>
          )}
        </>
      )}
    </Box>
  );
}

export default function VistaTiempo({ dias, citas, onCrear, onAbrir, onMover, onIrADia, alto }) {
  const hoy = hoyFn();
  const scrollRef = useRef(null);
  const columnasRef = useRef(null);
  const [ahora, setAhora] = useState(ahoraMinutos());
  const [arrastre, setArrastre] = useState(null); // { cita, deltaMin, deltaDia, movido }
  const arrastreRef = useRef(null);

  // La línea de "ahora" avanza cada minuto
  useEffect(() => {
    const t = setInterval(() => setAhora(ahoraMinutos()), 60000);
    return () => clearInterval(t);
  }, []);

  // Al abrir, se muestra desde la hora actual (si hoy está visible) o desde las 7:30
  const claveDias = dias.join(",");
  const ajustadoACitas = useRef(false);
  useEffect(() => {
    if (!scrollRef.current) return;
    const desde = dias.includes(hoy) ? Math.max(ahoraMinutos() - 90, 0) : 7.5 * 60;
    scrollRef.current.scrollTop = desde * PX_MIN;
    ajustadoACitas.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claveDias]);

  const todoElDia = useMemo(
    () => dias.map((d) => citas.filter((c) => c.todoElDia && citaEnDia(c, d))),
    [dias, citas]
  );
  const hayTodoElDia = todoElDia.some((l) => l.length);

  const porDia = useMemo(
    () =>
      dias.map((d) =>
        distribuir(
          citas
            .filter((c) => !c.todoElDia && citaEnDia(c, d))
            .map((c) => ({ cita: c, ...tramoEnDia(c, d) }))
        )
      ),
    [dias, citas]
  );

  // Cuando llegan las citas, si la primera queda arriba de lo visible, se sube hasta ella
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || ajustadoACitas.current) return;
    const inicios = porDia.flat().map((t) => t.ini);
    if (!inicios.length) return;
    ajustadoACitas.current = true;
    const primera = Math.min(...inicios);
    if (primera * PX_MIN < el.scrollTop) el.scrollTop = Math.max(primera - 30, 0) * PX_MIN;
  }, [porDia]);

  /* ───── Arrastrar para reprogramar (solo mouse) ───── */
  const iniciarArrastre = (e, cita, dia) => {
    if (e.pointerType !== "mouse" || e.button !== 0 || !onMover) return;
    if (fechaDe(cita.inicio) !== fechaDe(cita.fin) && cita.fin.slice(11) !== "00:00") return; // varias fechas: solo desde el formulario
    const estado = { cita, dia, x0: e.clientX, y0: e.clientY, deltaMin: 0, deltaDia: 0, movido: false };
    arrastreRef.current = estado;

    const mover = (ev) => {
      const a = arrastreRef.current;
      if (!a) return;
      const dx = ev.clientX - a.x0;
      const dy = ev.clientY - a.y0;
      if (!a.movido && Math.hypot(dx, dy) < 6) return;
      a.movido = true;
      a.deltaMin = Math.round(dy / PX_MIN / PASO) * PASO;
      const rect = columnasRef.current?.getBoundingClientRect();
      if (rect && dias.length > 1) {
        const anchoCol = rect.width / dias.length;
        const colOrigen = dias.indexOf(a.dia);
        const colActual = Math.min(dias.length - 1, Math.max(0, Math.floor((ev.clientX - rect.left) / anchoCol)));
        a.deltaDia = colActual - colOrigen;
      }
      setArrastre({ ...a });
    };
    const soltar = () => {
      window.removeEventListener("pointermove", mover);
      window.removeEventListener("pointerup", soltar);
      const a = arrastreRef.current;
      arrastreRef.current = null;
      if (a?.movido && (a.deltaMin || a.deltaDia)) {
        const dur = duracionMinutos(a.cita.inicio, a.cita.fin);
        const nuevoInicio = sumarMinutos(
          `${sumarDias(fechaDe(a.cita.inicio), a.deltaDia)}T${a.cita.inicio.slice(11, 16)}`,
          a.deltaMin
        );
        onMover(a.cita, nuevoInicio, sumarMinutos(nuevoInicio, dur));
      }
      // Se limpia después del click que dispara el navegador al soltar
      setTimeout(() => setArrastre(null), 0);
    };
    window.addEventListener("pointermove", mover);
    window.addEventListener("pointerup", soltar);
  };

  const clicEnColumna = (e, dia) => {
    if (arrastre) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const min = Math.floor((e.clientY - rect.top) / PX_MIN / PASO) * PASO;
    onCrear(`${dia}T${aHora(Math.min(min, 1440 - PASO))}`);
  };

  // Vista previa de la cita mientras se arrastra
  const vistaPrevia = useMemo(() => {
    if (!arrastre?.movido) return null;
    const { cita, deltaMin, deltaDia } = arrastre;
    const dur = duracionMinutos(cita.inicio, cita.fin);
    const inicio = sumarMinutos(`${sumarDias(fechaDe(cita.inicio), deltaDia)}T${cita.inicio.slice(11, 16)}`, deltaMin);
    const fin = sumarMinutos(inicio, dur);
    const dia = fechaDe(inicio);
    if (!dias.includes(dia)) return null;
    return { dia, cita: { ...cita, inicio, fin }, tramo: { ...tramoEnDia({ inicio, fin }, dia), col: 0, cols: 1 } };
  }, [arrastre, dias]);

  const hoyVisible = dias.includes(hoy);

  // La barra de scroll de la cuadrícula ocupa ancho: los encabezados dejan
  // ese mismo espacio para que las columnas queden alineadas.
  const [barra, setBarra] = useState(0);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const medir = () => setBarra(el.offsetWidth - el.clientWidth);
    medir();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(medir) : null;
    ro?.observe(el);
    return () => ro?.disconnect();
  }, []);

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: alto, minHeight: 360, bgcolor: "#fff" }}>
      {/* Encabezado de días */}
      <Box sx={{ display: "flex", borderBottom: `1px solid ${BRAND.borde}`, pr: `${barra}px` }}>
        <Box sx={{ width: GUTTER, flexShrink: 0 }} />
        {dias.map((d) => {
          const esHoy = d === hoy;
          return (
            <Box
              key={d}
              onClick={() => dias.length > 1 && onIrADia?.(d)}
              sx={{
                flex: 1,
                minWidth: 0,
                textAlign: "center",
                py: 1,
                cursor: dias.length > 1 ? "pointer" : "default",
                borderLeft: `1px solid ${BRAND.borde}`,
                "&:hover": dias.length > 1 ? { bgcolor: "rgba(163,105,32,0.04)" } : {},
              }}
            >
              <Typography
                sx={{
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: esHoy ? BRAND.oro : BRAND.textoTenue,
                }}
              >
                {nombreDiaCorto(d)}
              </Typography>
              <Box
                sx={{
                  mx: "auto",
                  mt: 0.25,
                  width: 34,
                  height: 34,
                  borderRadius: "50%",
                  display: "grid",
                  placeItems: "center",
                  bgcolor: esHoy ? BRAND.oro : "transparent",
                  color: esHoy ? "#fff" : BRAND.texto,
                  fontSize: 18,
                  fontWeight: esHoy ? 700 : 500,
                }}
              >
                {numeroDia(d)}
              </Box>
            </Box>
          );
        })}
      </Box>

      {/* Citas de todo el día */}
      {hayTodoElDia && (
        <Box sx={{ display: "flex", borderBottom: `1px solid ${BRAND.borde}`, bgcolor: BRAND.cremaClara, pr: `${barra}px` }}>
          <Box sx={{ width: GUTTER, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "flex-end", pr: 1 }}>
            <Typography sx={{ fontSize: 10, color: BRAND.textoTenue, textAlign: "right", lineHeight: 1.1 }}>
              Todo
              <br />
              el día
            </Typography>
          </Box>
          {todoElDia.map((lista, i) => (
            <Box key={dias[i]} sx={{ flex: 1, minWidth: 0, p: 0.5, borderLeft: `1px solid ${BRAND.borde}`, display: "flex", flexDirection: "column", gap: 0.4 }}>
              {lista.map((c) => {
                const color = colorCita(c);
                return (
                  <Tooltip key={c.id} title={c.titulo} disableInteractive>
                    <Box
                      role="button"
                      tabIndex={0}
                      onClick={() => onAbrir(c)}
                      onKeyDown={(e) => e.key === "Enter" && onAbrir(c)}
                      sx={{
                        bgcolor: color,
                        color: "#fff",
                        borderRadius: "5px",
                        px: 0.75,
                        py: 0.2,
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {c.paciente ? nombreCorto(c) : c.titulo}
                    </Box>
                  </Tooltip>
                );
              })}
            </Box>
          ))}
        </Box>
      )}

      {/* Cuadrícula de horas */}
      <Box ref={scrollRef} sx={{ flex: 1, overflowY: "auto", overflowX: "hidden", position: "relative" }}>
        <Box sx={{ display: "flex", position: "relative", height: 24 * HORA_PX }}>
          {/* Horas */}
          <Box sx={{ width: GUTTER, flexShrink: 0, position: "relative" }}>
            {Array.from({ length: 23 }, (_, i) => i + 1).map((h) => (
              <Typography
                key={h}
                sx={{
                  position: "absolute",
                  top: h * HORA_PX - 7,
                  right: 8,
                  fontSize: 11,
                  color: BRAND.textoTenue,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {String(h).padStart(2, "0")}:00
              </Typography>
            ))}
          </Box>

          {/* Columnas de días */}
          <Box ref={columnasRef} sx={{ flex: 1, display: "flex", position: "relative" }}>
            {dias.map((d, i) => (
              <Box
                key={d}
                onClick={(e) => clicEnColumna(e, d)}
                sx={{
                  flex: 1,
                  minWidth: 0,
                  position: "relative",
                  borderLeft: `1px solid ${BRAND.borde}`,
                  cursor: "cell",
                  backgroundImage: `repeating-linear-gradient(to bottom, transparent 0, transparent ${HORA_PX - 1}px, rgba(163,105,32,0.12) ${HORA_PX - 1}px, rgba(163,105,32,0.12) ${HORA_PX}px)`,
                  bgcolor: d === hoy ? "rgba(186,154,99,0.05)" : "transparent",
                }}
              >
                {porDia[i].map((t) => (
                  <BloqueCita
                    key={t.cita.id}
                    cita={t.cita}
                    tramo={t}
                    dia={d}
                    onAbrir={onAbrir}
                    onIniciarArrastre={iniciarArrastre}
                    arrastrando={arrastre?.movido && arrastre.cita.id === t.cita.id}
                  />
                ))}

                {vistaPrevia?.dia === d && (
                  <Box
                    sx={{
                      position: "absolute",
                      top: vistaPrevia.tramo.ini * PX_MIN + 1,
                      height: Math.max((vistaPrevia.tramo.fin - vistaPrevia.tramo.ini) * PX_MIN - 2, 18),
                      left: 2,
                      right: 2,
                      border: `2px dashed ${colorCita(vistaPrevia.cita)}`,
                      borderRadius: "6px",
                      bgcolor: "rgba(255,255,255,0.7)",
                      zIndex: 6,
                      pointerEvents: "none",
                      px: 0.75,
                      py: 0.3,
                    }}
                  >
                    <Typography sx={{ fontSize: 12, fontWeight: 700, color: BRAND.texto }}>
                      {aHora(vistaPrevia.tramo.ini)} – {aHora(vistaPrevia.tramo.fin)}
                    </Typography>
                  </Box>
                )}

                {d === hoy && hoyVisible && (
                  <Box
                    sx={{
                      position: "absolute",
                      left: 0,
                      right: 0,
                      top: ahora * PX_MIN,
                      height: 0,
                      borderTop: `2px solid ${BRAND.error}`,
                      zIndex: 4,
                      pointerEvents: "none",
                      "&::before": {
                        content: '""',
                        position: "absolute",
                        left: -5,
                        top: -6,
                        width: 10,
                        height: 10,
                        borderRadius: "50%",
                        bgcolor: BRAND.error,
                      },
                    }}
                  />
                )}
              </Box>
            ))}
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
