import React, { useState, useMemo, useRef, useEffect } from "react";
import { Box, Typography } from "@mui/material";

const C = {
  bg: "#FFFDF8",
  border: "#E8DFD0",
  gold: "#B8860B",
  goldLight: "#D4AF37",
  text: "#3B2F1E",
  muted: "#8B7D6B",
  green: "#4caf50",
  orange: "#E8910C",
  blue: "#2196f3",
  purple: "#9575cd",
  white: "#fff",
};

const ST = {
  completed:  { color: C.green,  label: "Completado", dot: "●" },
  in_progress:{ color: C.orange, label: "En Curso",   dot: "●" },
  scheduled:  { color: C.blue,   label: "Agendado",   dot: "●" },
  pending:    { color: C.purple, label: "Pendiente",  dot: "●" },
};

const intensity = (n) => {
  if (!n) return 50;
  const l = n.toLowerCase();
  if (l.includes("consulta") || l.includes("control") || l.includes("limpieza")) return 25;
  if (l.includes("botox") || l.includes("toxina")) return 65;
  if (l.includes("lifting") || l.includes("hialur") || l.includes("láser") || l.includes("laser") || l.includes("hifu") || l.includes("exosoma") || l.includes("rino") || l.includes("modulaci")) return 80;
  if (l.includes("peeling") || l.includes("diseño") || l.includes("labio") || l.includes("proyecci") || l.includes("ment")) return 60;
  return 50;
};

const mapSesion = (s, pres, esps) => {
  const esp = esps.find(e => e.id === s.especialista_id);
  let st = "pending";
  if (s.estado === "completada") st = "completed";
  else if (s.estado === "en_progreso" || s.estado === "in_progress") st = "in_progress";
  else if (s.estado === "programada" || s.estado === "scheduled") st = "scheduled";
  return {
    id: s.id, title: s.tratamiento_nombre || "Tratamiento",
    price: Number(s.precio_sesion || 0),
    session: s.sesion_numero || 1, totalSessions: s.total_sesiones || 1,
    specialist: esp ? esp.nombre : null, status: st,
    intensity: intensity(s.tratamiento_nombre),
    fecha: s.fecha_realizada || null, presId: pres.id, isAuto: false,
  };
};

const build = (pres, esps) => {
  const ses = pres.sesiones || [];
  const nodes = [];
  const hasC = ses.some(s => (s.tratamiento_nombre || "").toLowerCase().includes("consulta"));
  if (!hasC) nodes.push({
    id: `ac-${pres.id}`, title: "Consulta Inicial", price: 0, session: 1, totalSessions: 1,
    specialist: null, status: "completed", intensity: 25, fecha: pres.fecha_inicio || null,
    presId: pres.id, isAuto: true,
  });
  ses.forEach(s => nodes.push(mapSesion(s, pres, esps)));
  const hasCtrl = ses.some(s => (s.tratamiento_nombre || "").toLowerCase().includes("control"));
  if (!hasCtrl) {
    const done = ses.length > 0 && ses.every(s => s.estado === "completada");
    nodes.push({
      id: `af-${pres.id}`, title: "Control Final", price: 0, session: 1, totalSessions: 1,
      specialist: null, status: done ? "completed" : "pending", intensity: 25,
      fecha: null, presId: pres.id, isAuto: true,
    });
  }
  return nodes;
};

const segPath = (a, b) => {
  const cx1 = a.x + (b.x - a.x) * 0.4;
  const cx2 = b.x - (b.x - a.x) * 0.4;
  return `M ${a.x} ${a.y} C ${cx1} ${a.y}, ${cx2} ${b.y}, ${b.x} ${b.y}`;
};

const fillArea = (pts, baseY) => {
  if (pts.length < 2) return "";
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    const cx1 = a.x + (b.x - a.x) * 0.4;
    const cx2 = b.x - (b.x - a.x) * 0.4;
    d += ` C ${cx1} ${a.y}, ${cx2} ${b.y}, ${b.x} ${b.y}`;
  }
  d += ` L ${pts[pts.length - 1].x} ${baseY} L ${pts[0].x} ${baseY} Z`;
  return d;
};

const wrapText = (text, maxChars) => {
  if (text.length <= maxChars) return [text];
  const words = text.split(" ");
  const lines = [];
  let cur = "";
  words.forEach(w => {
    if (cur && (cur + " " + w).length > maxChars) { lines.push(cur); cur = w; }
    else cur = cur ? cur + " " + w : w;
  });
  if (cur) lines.push(cur);
  return lines.slice(0, 2);
};

const PatientJourneyChart = ({ presupuesto, especialistas = [], navigate }) => {
  const [hovered, setHovered] = useState(null);
  const [selected, setSelected] = useState(null);
  const ref = useRef(null);
  const [w, setW] = useState(750);

  useEffect(() => {
    const m = () => { if (ref.current) setW(ref.current.offsetWidth); };
    m(); window.addEventListener("resize", m);
    return () => window.removeEventListener("resize", m);
  }, []);

  const nodes = useMemo(() => build(presupuesto, especialistas), [presupuesto, especialistas]);
  const realNodes = nodes.filter(n => !n.isAuto);
  const completed = realNodes.filter(n => n.status === "completed").length;
  const total = realNodes.length;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  const firstIP = nodes.findIndex(n => n.status === "in_progress");

  const mob = w < 480;
  const padX = mob ? 45 : 70;
  const svgW = Math.max(w - 4, 300);
  const curveBase = 210;
  const maxAmp = 130;
  const svgH = 330;
  const nodeR = mob ? 9 : 12;
  const labelY = curveBase + 18;

  const pts = useMemo(() => {
    const n = nodes.length;
    if (!n) return [];
    const uw = svgW - padX * 2;
    return nodes.map((nd, i) => ({
      ...nd,
      x: n === 1 ? svgW / 2 : padX + (uw * i) / (n - 1),
      y: curveBase - (nd.intensity / 100) * maxAmp,
    }));
  }, [nodes, svgW, padX, curveBase, maxAmp]);

  const gradId = `jg-${presupuesto.id}`;

  const segColor = (i) => {
    const a = pts[i], b = pts[i + 1];
    if (a.status === "completed" && b.status === "completed") return C.green;
    if (a.status === "completed" || b.status === "in_progress") return C.orange;
    if (a.status === "in_progress" || b.status === "scheduled") return C.blue;
    return C.purple;
  };

  return (
    <Box ref={ref} sx={{ 
      mb: 3, 
      backgroundColor: C.bg, 
      border: `1px solid ${C.border}`, 
      borderRadius: 3, 
      overflow: "hidden",
      boxShadow: "0 2px 8px rgba(163,105,32,0.08)",
    }}>
      {/* Header with gradient background */}
      <Box sx={{ 
        background: `linear-gradient(135deg, ${C.bg} 0%, #f5f1e4 100%)`,
        borderBottom: `2px solid ${C.border}`,
        px: 3,
        pt: 2.5,
        pb: 2,
      }}>
        {/* Title with icon */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1.5 }}>
          <Box sx={{
            width: mob ? 32 : 40,
            height: mob ? 32 : 40,
            borderRadius: "50%",
            background: `linear-gradient(135deg, ${C.gold} 0%, ${C.goldLight} 100%)`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 2px 6px rgba(184,134,11,0.25)",
          }}>
            <svg width={mob ? "18" : "22"} height={mob ? "18" : "22"} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
            </svg>
          </Box>
          <Typography sx={{
            fontFamily: "'Cormorant Garamond', serif", 
            fontWeight: 700,
            fontSize: mob ? "1.1rem" : "1.35rem", 
            textTransform: "uppercase",
            letterSpacing: 2.5, 
            color: C.text,
            lineHeight: 1,
          }}>
            Seguimiento del Tratamiento
          </Typography>
        </Box>

        {/* Subtitle + progress */}
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 1.5 }}>
          <Typography sx={{ 
            fontFamily: "'DM Sans', sans-serif", 
            fontSize: "0.82rem", 
            color: C.muted,
            fontWeight: 500,
          }}>
            Presupuesto <Box component="span" sx={{ fontWeight: 700, color: C.text }}>#{presupuesto.oferta_id || presupuesto.id}</Box> · {total} tratamientos · {completed} completados
          </Typography>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <Box sx={{ width: mob ? 70 : 120, height: 8, backgroundColor: "rgba(232,223,208,0.5)", borderRadius: 4, overflow: "hidden", border: `1px solid ${C.border}` }}>
              <Box sx={{ 
                height: "100%", 
                width: `${pct}%`, 
                background: `linear-gradient(90deg, ${C.green} 0%, ${C.goldLight} 100%)`, 
                borderRadius: 4, 
                transition: "width 0.5s cubic-bezier(0.4, 0, 0.2, 1)",
                boxShadow: pct > 0 ? "0 0 8px rgba(76,175,80,0.3)" : "none",
              }} />
            </Box>
            <Typography sx={{ 
              fontFamily: "'DM Sans', sans-serif", 
              fontSize: "0.85rem", 
              fontWeight: 700, 
              color: pct === 100 ? C.green : C.gold,
              minWidth: 38,
              textAlign: "right",
            }}>
              {pct}%
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* SVG */}
      {pts.length > 0 && (
        <Box sx={{ px: 0.5, position: "relative", overflowX: "auto", overflowY: "visible" }}>
          <svg viewBox={`0 0 ${svgW} ${svgH}`} width="100%" style={{ display: "block", minWidth: nodes.length > 6 ? 600 : "auto" }}>
            <defs>
              <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={C.gold} stopOpacity="0.13" />
                <stop offset="100%" stopColor={C.gold} stopOpacity="0.01" />
              </linearGradient>
            </defs>

            {/* Fill */}
            <path d={fillArea(pts, curveBase)} fill={`url(#${gradId})`} />

            {/* Colored curve segments */}
            {pts.map((p, i) => {
              if (i >= pts.length - 1) return null;
              return <path key={`seg-${i}`} d={segPath(p, pts[i + 1])} fill="none" stroke={segColor(i)} strokeWidth={2.5} strokeLinecap="round" />;
            })}

            {/* Vertical dashes */}
            {pts.map(p => (
              <line key={`vl-${p.id}`} x1={p.x} y1={p.y + nodeR + 2} x2={p.x} y2={curveBase} stroke={C.border} strokeWidth={1} strokeDasharray="4,3" opacity={0.45} />
            ))}

            {/* Nodes */}
            {pts.map((p, i) => {
              const meta = ST[p.status] || ST.pending;
              const isH = hovered === p.id;
              const isS = selected === p.id;
              const r = isH || isS ? nodeR + 2 : nodeR;
              const isHere = firstIP >= 0 && i === firstIP;

              return (
                <g key={p.id} style={{ cursor: "pointer" }}
                  onMouseEnter={() => setHovered(p.id)} onMouseLeave={() => setHovered(null)}
                  onClick={() => setSelected(selected === p.id ? null : p.id)}>

                  {/* ESTÁS AQUÍ */}
                  {isHere && (
                    <g>
                      <line x1={p.x} y1={p.y - r - 4} x2={p.x} y2={p.y - r - 20} stroke={C.orange} strokeWidth={1} strokeDasharray="3,2" />
                      <rect x={p.x - 36} y={p.y - r - 38} width={72} height={18} rx={9} fill={C.orange} />
                      <text x={p.x} y={p.y - r - 26} textAnchor="middle" fill={C.white} fontSize={9} fontWeight={700} fontFamily="'DM Sans', sans-serif">
                        ESTÁS AQUÍ
                      </text>
                    </g>
                  )}

                  {/* Glow */}
                  {(isH || isS) && <circle cx={p.x} cy={p.y} r={r + 4} fill="none" stroke={meta.color} strokeWidth={1.5} opacity={0.3} />}

                  {/* Circle */}
                  <circle cx={p.x} cy={p.y} r={r}
                    fill={p.status === "completed" ? meta.color : C.white}
                    stroke={meta.color} strokeWidth={2.5} />

                  {/* Icon */}
                  <text x={p.x} y={p.y + 4} textAnchor="middle"
                    fill={p.status === "completed" ? C.white : meta.color}
                    fontSize={p.status === "completed" ? 11 : 9} fontWeight={700} fontFamily="'DM Sans', sans-serif">
                    {p.status === "completed" ? "✓" : "○"}
                  </text>

                  {/* Tooltip on hover */}
                  {isH && (() => {
                    const tw = 160, th = 42;
                    let tx = p.x - tw / 2;
                    if (tx < 5) tx = 5;
                    if (tx + tw > svgW - 5) tx = svgW - 5 - tw;
                    const ty = p.y - r - (isHere ? 58 : 28) - th;
                    return (
                      <g>
                        <rect x={tx} y={ty} width={tw} height={th} rx={8} fill="white" stroke={meta.color} strokeWidth={1} filter="drop-shadow(0 2px 6px rgba(0,0,0,0.12))" />
                        <circle cx={tx + 14} cy={ty + 15} r={5} fill={meta.color} />
                        <text x={tx + 24} y={ty + 18} fill={C.text} fontSize={10} fontWeight={700} fontFamily="'DM Sans', sans-serif">
                          {meta.label}
                        </text>
                        <text x={tx + 12} y={ty + 34} fill={C.muted} fontSize={9} fontFamily="'DM Sans', sans-serif">
                          S/ {p.price.toFixed(2)} · {p.session} sesión
                        </text>
                      </g>
                    );
                  })()}
                </g>
              );
            })}

            {/* Labels below baseline */}
            {pts.map((p, i) => {
              const lines = wrapText(p.title, mob ? 12 : 18);
              const lfs = mob ? 8.5 : 10.5;
              return (
                <g key={`lb-${p.id}`}>
                  {lines.map((ln, li) => (
                    <text key={li} x={p.x} y={labelY + li * (lfs + 2)} textAnchor="middle"
                      fill={C.text} fontSize={lfs} fontWeight={600} fontFamily="'DM Sans', sans-serif">
                      {ln}
                    </text>
                  ))}
                  {p.specialist && (
                    <text x={p.x} y={labelY + lines.length * (lfs + 2) + 2} textAnchor="middle"
                      fill={C.muted} fontSize={mob ? 7.5 : 9} fontStyle="italic" fontFamily="'DM Sans', sans-serif">
                      {p.specialist}
                    </text>
                  )}
                  {/* Session badge */}
                  {(() => {
                    const badgeY = labelY + lines.length * (lfs + 2) + (p.specialist ? 16 : 6);
                    const badgeText = `Sesión ${p.session}/${p.totalSessions}`;
                    const bw = mob ? 48 : 56;
                    return (
                      <g>
                        <rect x={p.x - bw / 2} y={badgeY - 9} width={bw} height={17} rx={8.5} fill="none" stroke={C.border} strokeWidth={1} />
                        <text x={p.x} y={badgeY + 3} textAnchor="middle" fill={C.muted} fontSize={mob ? 7 : 8} fontWeight={500} fontFamily="'DM Sans', sans-serif">
                          {badgeText}
                        </text>
                      </g>
                    );
                  })()}
                </g>
              );
            })}
          </svg>
        </Box>
      )}

      {/* Legend */}
      <Box sx={{ 
        display: "flex", 
        justifyContent: "center", 
        gap: mob ? 2 : 3.5, 
        py: 2, 
        px: 2,
        borderTop: `1px solid ${C.border}`,
        background: `linear-gradient(180deg, ${C.bg} 0%, #f9f7f0 100%)`,
      }}>
        {Object.entries(ST).map(([k, v]) => (
          <Box key={k} sx={{ display: "flex", alignItems: "center", gap: 0.8 }}>
            <Box sx={{ 
              width: 10, 
              height: 10, 
              borderRadius: "50%", 
              backgroundColor: v.color,
              boxShadow: `0 0 0 2px ${v.color}20`,
            }} />
            <Typography sx={{ 
              fontFamily: "'DM Sans', sans-serif", 
              fontSize: mob ? "0.7rem" : "0.75rem", 
              color: C.text,
              fontWeight: 500,
            }}>
              {v.label}
            </Typography>
          </Box>
        ))}
      </Box>

      {/* Detail panel on click */}
      {selected && (() => {
        const nd = nodes.find(n => n.id === selected);
        if (!nd) return null;
        const meta = ST[nd.status] || ST.pending;
        return (
          <Box sx={{ mx: 2, mb: 2, p: 1.5, backgroundColor: `${meta.color}08`, border: `1px solid ${meta.color}25`, borderRadius: 2 }}>
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 0.5 }}>
              <Typography sx={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: "0.85rem", color: C.text }}>
                {nd.title}
              </Typography>
              <Box sx={{ px: 1, py: 0.2, borderRadius: 2, backgroundColor: `${meta.color}18`, border: `1px solid ${meta.color}35` }}>
                <Typography sx={{ fontFamily: "'DM Sans', sans-serif", fontSize: "0.65rem", fontWeight: 700, color: meta.color }}>
                  {meta.label}
                </Typography>
              </Box>
            </Box>
            <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", mb: 0.5 }}>
              {nd.price > 0 && <Typography sx={{ fontFamily: "'DM Sans', sans-serif", fontSize: "0.75rem", color: C.muted }}><strong>Precio:</strong> S/ {nd.price.toFixed(2)}</Typography>}
              <Typography sx={{ fontFamily: "'DM Sans', sans-serif", fontSize: "0.75rem", color: C.muted }}><strong>Sesión:</strong> {nd.session}/{nd.totalSessions}</Typography>
              {nd.specialist && <Typography sx={{ fontFamily: "'DM Sans', sans-serif", fontSize: "0.75rem", color: C.muted }}><strong>Especialista:</strong> {nd.specialist}</Typography>}
            </Box>
            {nd.fecha && <Typography sx={{ fontFamily: "'DM Sans', sans-serif", fontSize: "0.72rem", color: C.green }}>Realizado: {nd.fecha.split(" ")[0]}</Typography>}
            {nd.status !== "completed" && !nd.isAuto && navigate && (
              <Box component="button" onClick={() => navigate(`/tratamientos/comenzar?paciente=${presupuesto.paciente_id}&presupuesto=${presupuesto.id}`)}
                sx={{ mt: 0.8, fontFamily: "'DM Sans', sans-serif", fontSize: "0.72rem", fontWeight: 600, color: C.white, backgroundColor: C.gold, border: "none", borderRadius: 1.5, px: 1.5, py: 0.5, cursor: "pointer", "&:hover": { backgroundColor: C.goldLight } }}>
                Realizar Tratamiento
              </Box>
            )}
          </Box>
        );
      })()}
    </Box>
  );
};

export default PatientJourneyChart;
