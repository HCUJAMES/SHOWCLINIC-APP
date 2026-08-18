import React, { useEffect, useState } from "react";
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
} from "@mui/icons-material";
import { motion, AnimatePresence } from "framer-motion";

/**
 * Aviso lateral de retoques pendientes.
 *
 * Cada tratamiento tiene su ciclo: la toxina (botox / modulaciones) se repite
 * cada 6 meses y el resto una vez al año. El backend calcula quién ya venció o
 * está por vencer; aquí solo se presenta.
 *
 * Al hacer clic en un paciente se abre su historial clínico.
 */

const ORO = "#A36920";
const ORO_OSCURO = "#8A5A1A";
const CREMA = "#FAF8F5";
const CAFE = "#3E2723";

const MotionBox = motion(Box);

const MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio",
               "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

const iniciales = (nombre = "", apellido = "") =>
  `${(nombre || "").trim()[0] || ""}${(apellido || "").trim()[0] || ""}`.toUpperCase() || "?";

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

export default function PanelRecordatorios({ apiBase, onVerPaciente }) {
  const [abierto, setAbierto] = useState(false);
  const [pestana, setPestana] = useState("retoques");   // "retoques" | "cumples"
  const [cargando, setCargando] = useState(true);
  const [datos, setDatos] = useState({ total: 0, vencidos: 0, proximos: 0, recordatorios: [] });

  // Cumpleaños del mes que se esté viendo
  const [mesVer, setMesVer] = useState(null);           // null = mes actual
  const [cumples, setCumples] = useState(null);
  const [cargandoCumples, setCargandoCumples] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) { setCargando(false); return; }
    fetch(`${apiBase}/api/pacientes/recordatorios?dias=45&limite=25`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d) setDatos(d); })
      .catch(() => {})
      .finally(() => setCargando(false));
  }, [apiBase]);

  useEffect(() => {
    if (pestana !== "cumples") return;
    const token = localStorage.getItem("token");
    if (!token) return;
    setCargandoCumples(true);
    const q = mesVer ? `?mes=${mesVer}` : "";
    fetch(`${apiBase}/api/pacientes/cumpleanos${q}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d) { setCumples(d); if (mesVer == null) setMesVer(d.mes); } })
      .catch(() => {})
      .finally(() => setCargandoCumples(false));
  }, [pestana, mesVer, apiBase]);

  // Marca "ya lo contacté": la fila sale y las de abajo suben solas
  const [marcando, setMarcando] = useState(null);

  const marcarContactado = async (r, e) => {
    if (e) e.stopPropagation();
    if (marcando) return;
    setMarcando(`${r.paciente_id}-${r.tratamiento}`);

    const token = localStorage.getItem("token");
    try {
      await fetch(`${apiBase}/api/pacientes/recordatorios/contactado`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          paciente_id: r.paciente_id,
          tratamiento: r.tratamiento,
          proxima_fecha: r.proxima_fecha,
        }),
      });
    } catch { /* si falla la red igual se quita en pantalla */ }

    // Deja ver el check un instante antes de que la fila salga
    setTimeout(() => {
      setDatos((prev) => {
        const quedan = prev.recordatorios.filter(
          (x) => !(x.paciente_id === r.paciente_id && x.tratamiento === r.tratamiento)
        );
        return {
          ...prev,
          recordatorios: quedan,
          total: quedan.length,
          vencidos: quedan.filter((x) => x.vencido).length,
          proximos: quedan.filter((x) => !x.vencido).length,
        };
      });
      setMarcando(null);
    }, 620);
  };

  const total = datos.total || 0;
  const esCumples = pestana === "cumples";

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
                      {MESES[(mesVer || 1) - 1]}
                    </Typography>
                    <IconButton size="small" onClick={() => setMesVer((m) => ((m || 1) === 12 ? 1 : (m || 1) + 1))}
                      sx={{ color: "#fff", p: 0.3, "&:hover": { background: "rgba(255,255,255,0.18)" } }}>
                      <ChevronRightRounded sx={{ fontSize: 18 }} />
                    </IconButton>
                  </Box>

                  <Box sx={{ display: "flex", gap: 0.8, mt: 1 }}>
                    <Box sx={{ px: 1.1, py: 0.35, borderRadius: "999px", background: "rgba(255,255,255,0.20)" }}>
                      <Typography sx={{ fontSize: 11, fontWeight: 700 }}>
                        {cumples?.total || 0} en el mes
                      </Typography>
                    </Box>
                    {(cumples?.hoy || 0) > 0 && (
                      <Box sx={{ px: 1.1, py: 0.35, borderRadius: "999px", background: "rgba(0,0,0,0.25)" }}>
                        <Typography sx={{ fontSize: 11, fontWeight: 700 }}>🎉 {cumples.hoy} hoy</Typography>
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
                    Toxina cada 6 meses · demás tratamientos cada año
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
                ) : !cumples || cumples.total === 0 ? (
                  <Box sx={{ textAlign: "center", py: 5, px: 2 }}>
                    <CakeRounded sx={{ fontSize: 40, color: "rgba(163,105,32,0.35)" }} />
                    <Typography sx={{ mt: 1, fontSize: 13.5, fontWeight: 600, color: CAFE }}>
                      Sin cumpleaños
                    </Typography>
                    <Typography sx={{ fontSize: 12, color: "#8D7B70", mt: 0.5 }}>
                      Ninguna paciente cumple años en {MESES[(mesVer || 1) - 1]}.
                    </Typography>
                  </Box>
                ) : (
                  cumples.cumpleanos.map((c, i) => (
                    <MotionBox
                      key={c.paciente_id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(0.04 + i * 0.03, 0.5), duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                      whileHover={{ x: 3 }}
                      onClick={() => onVerPaciente && onVerPaciente({ paciente_id: c.paciente_id })}
                      sx={{
                        display: "flex", alignItems: "center", gap: 1.2,
                        p: 1.2, mb: 0.9, borderRadius: "14px", cursor: "pointer",
                        background: c.es_hoy ? "#FFF8E7" : "#fff",
                        border: `1px solid ${c.es_hoy ? "rgba(212,175,55,0.55)" : "rgba(163,105,32,0.14)"}`,
                        borderLeft: `3px solid ${c.es_hoy ? "#D4AF37" : c.ya_paso ? "#DDD3C4" : ORO}`,
                        opacity: c.ya_paso ? 0.6 : 1,
                        transition: "box-shadow .2s ease, opacity .2s ease",
                        "&:hover": { boxShadow: "0 6px 18px rgba(163,105,32,0.16)", opacity: 1 },
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
                          {MESES[(mesVer || 1) - 1].slice(0, 3)}
                        </Typography>
                      </Box>

                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 0.6 }}>
                          <Typography sx={{ fontSize: 13.2, fontWeight: 700, color: CAFE, lineHeight: 1.25, minWidth: 0 }} noWrap>
                            {`${c.nombre || ""} ${c.apellido || ""}`.trim() || "Sin nombre"}
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
                            {c.es_hoy ? "¡Es hoy!" : c.ya_paso ? "ya pasó" : c.dias_faltan != null ? `en ${c.dias_faltan} ${c.dias_faltan === 1 ? "día" : "días"}` : `${c.dia} de ${MESES[(mesVer || 1) - 1]}`}
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
                    </MotionBox>
                  ))
                )
              ) : cargando ? (
                <Box sx={{ display: "flex", justifyContent: "center", py: 5 }}>
                  <CircularProgress size={26} sx={{ color: ORO }} />
                </Box>
              ) : total === 0 ? (
                <Box sx={{ textAlign: "center", py: 5, px: 2 }}>
                  <EventRepeatRounded sx={{ fontSize: 40, color: "rgba(163,105,32,0.35)" }} />
                  <Typography sx={{ mt: 1, fontSize: 13.5, fontWeight: 600, color: CAFE }}>
                    Todo al día
                  </Typography>
                  <Typography sx={{ fontSize: 12, color: "#8D7B70", mt: 0.5 }}>
                    Ningún paciente tiene un retoque próximo en los siguientes 45 días.
                  </Typography>
                </Box>
              ) : (
                <>
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
                      borderLeft: `3px solid ${hecho ? "#2E7D32" : r.vencido ? "#D32F2F" : ORO}`,
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
                        {`${r.nombre || ""} ${r.apellido || ""}`.trim() || "Sin nombre"}
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
                    <Tooltip title={hecho ? "Contactado" : "Marcar como contactado"} arrow placement="left">
                      <MotionBox
                        component="button"
                        aria-label="Marcar como contactado"
                        onClick={(e) => marcarContactado(r, e)}
                        whileTap={{ scale: 0.85 }}
                        animate={hecho ? { scale: [1, 1.25, 1] } : { scale: 1 }}
                        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                        sx={{
                          flexShrink: 0, width: 30, height: 30, p: 0,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          borderRadius: "50%", cursor: "pointer",
                          border: `1.5px solid ${hecho ? "#2E7D32" : "rgba(163,105,32,0.30)"}`,
                          background: hecho ? "#2E7D32" : "transparent",
                          color: hecho ? "#fff" : "rgba(163,105,32,0.55)",
                          transition: "background .2s ease, border-color .2s ease, color .2s ease",
                          "&:hover": {
                            background: hecho ? "#2E7D32" : "rgba(46,125,50,0.12)",
                            borderColor: "#2E7D32",
                            color: hecho ? "#fff" : "#2E7D32",
                          },
                        }}
                      >
                        <CheckRounded sx={{ fontSize: 17 }} />
                      </MotionBox>
                    </Tooltip>
                  </MotionBox>
                  );
                })}
                </>
              )}
            </Box>

            {(esCumples ? (cumples?.total || 0) > 0 : total > 0) && (
              <Box sx={{ px: 2, py: 1.1, borderTop: "1px solid rgba(163,105,32,0.14)", background: "#fff" }}>
                <Typography sx={{ fontSize: 10.8, color: "#8D7B70", textAlign: "center" }}>
                  {esCumples
                    ? "Toca una paciente para abrir su historial"
                    : "Toca el nombre para abrir su historial · el ✓ marca que ya lo contactaste"}
                </Typography>
              </Box>
            )}
          </MotionBox>
        )}
      </AnimatePresence>
    </>
  );
}
