import React, { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { motion } from "framer-motion";

const API = `${window.location.protocol}//${window.location.hostname}:4000`;

// ─── Paleta de colores ShowClinic Premium ───
const COLORS = {
  brownMain: "#5D4037",
  brownDark: "#3E2723",
  brownMedium: "#7A5A2E",
  brownLight: "#A68869",
  gold: "#C8A96E",
  creamMain: "#FFF8F0",
  creamSoft: "#FAF3E8",
  creamMedium: "#F5EDDF",
  creamDeep: "#F0E5D2",
  alertSoft: "#B47A3A",
};

// ─── Color por categoría (carriles) ───
const CATEGORY_COLORS = {
  corporal: "#5F938A",
  facial: "#C0846D",
  armonizacion: "#C8A96E",
};
const laneColor = (key) => CATEGORY_COLORS[key] || COLORS.gold;

// hex (#rrggbb) → rgba(r,g,b,a)
const hexToRgba = (hex, alpha) => {
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

// ─── Tipografía ───
const FONTS = {
  serif: "'Cormorant Garamond', Georgia, serif",
  sans: "'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
};

// ─── Constantes de layout ───
const WEEK_WIDTH = 360;  // Aumentado de 280 a 360 para más espacio entre semanas
const LANE_HEIGHT = 200; // Aumentado de 168 a 200 para más espacio entre carriles
const HEADER_HEIGHT = 56;
const CATEGORY_PANEL_WIDTH = 220;
const NODE_R = 13;

const TreatmentTimelineMatrix = ({
  budget = {},
  categories = [],
  weeks = [],
  milestones = [],
  onMilestoneMove,
  onMilestoneClick,
  onEdit,
  onAssignSpecialist,
  onAddWeek,
  onRemoveWeek,
  onDelete,
  className = "",
  presupuestoId,
  especialistas = [],
}) => {
  // ─── State ───
  const [specialistNames, setSpecialistNames] = useState({});
  const [editingSpecialist, setEditingSpecialist] = useState(null);
  const [showScrollHint, setShowScrollHint] = useState(false);
  const [nodePositions, setNodePositions] = useState({}); // { [milestoneId]: { x, y } }
  const [draggingNode, setDraggingNode] = useState(null);
  const scrollContainerRef = useRef(null);
  const matrixContainerRef = useRef(null);
  const saveTimerRef = useRef(null);

  // ─── Derived dimensions ───
  const totalWeeks = Math.max(weeks.length, 1);
  const contentWidth = totalWeeks * WEEK_WIDTH;
  const lanesHeight = Math.max(categories.length, 1) * LANE_HEIGHT;
  const contentHeight = HEADER_HEIGHT + lanesHeight;

  // ─── Load specialist names and positions from DB ───
  useEffect(() => {
    if (!presupuestoId) return;
    const token = localStorage.getItem("token");
    fetch(`${API}/api/tratamientos/calendar-layout/${presupuestoId}`, {
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    })
      .then((r) => r.json())
      .then((data) => {
        if (data && data.specialistNames) setSpecialistNames(data.specialistNames);
        if (data && data.matrixPositions) setNodePositions(data.matrixPositions);
      })
      .catch(() => {});
  }, [presupuestoId]);

  // ─── Save specialist names and positions to DB (debounced) ───
  const saveLayout = useCallback((names, positions) => {
    if (!presupuestoId) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      const token = localStorage.getItem("token");
      fetch(`${API}/api/tratamientos/calendar-layout/${presupuestoId}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ specialistNames: names, matrixPositions: positions }),
      }).catch((err) => console.error("Error guardando layout:", err));
    }, 500);
  }, [presupuestoId]);

  // Check if scroll hint should show
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const check = () => {
      setShowScrollHint(el.scrollWidth > el.clientWidth && el.scrollLeft < el.scrollWidth - el.clientWidth - 20);
    };
    check();
    el.addEventListener("scroll", check);
    window.addEventListener("resize", check);
    return () => {
      el.removeEventListener("scroll", check);
      window.removeEventListener("resize", check);
    };
  }, [weeks.length]);

  // ─── Lanes: one per category, nodes positioned by xFrac or manual position ───
  // xFrac = ((week-1) + slot) / totalWeeks ; slot = (idx+1)/(count+1)
  // para varios tratamientos en la misma semana+categoría.
  const lanes = useMemo(() => {
    return categories.map((cat, laneIdx) => {
      const catMilestones = milestones.filter((m) => m.categoryKey === cat.key);
      const byWeek = {};
      catMilestones.forEach((m) => {
        (byWeek[m.week] = byWeek[m.week] || []).push(m);
      });
      const nodes = [];
      Object.keys(byWeek).forEach((wk) => {
        const group = byWeek[wk].slice().sort((a, b) => a.order - b.order);
        const count = group.length;
        group.forEach((m, idx) => {
          const slot = (idx + 1) / (count + 1);
          const week = Math.max(1, Number(m.week) || 1);
          const xFrac = ((week - 1) + slot) / totalWeeks;
          const defaultX = xFrac * contentWidth;
          const defaultY = HEADER_HEIGHT + laneIdx * LANE_HEIGHT + LANE_HEIGHT / 2;
          // Use manual position if exists, otherwise use calculated position
          const pos = nodePositions[m.id] || { x: defaultX, y: defaultY };
          nodes.push({ ...m, xFrac, x: pos.x, y: pos.y, laneIdx });
        });
      });
      nodes.sort((a, b) => a.x - b.x);
      return { cat, color: laneColor(cat.key), nodes, laneIdx };
    });
  }, [categories, milestones, totalWeeks, contentWidth, nodePositions]);

  // ─── Cross-category connectors ───
  // Enlaza cada nodo con el más cercano (cronológicamente) que pertenece a OTRA
  // categoría, formando el recorrido completo del paciente (p.ej. armonización →
  // cosmeatría/corporal). Los enlaces dentro de la misma categoría ya se dibujan
  // como conectores de carril, así que aquí solo se añaden los saltos entre carriles.
  const crossLinks = useMemo(() => {
    const allNodes = lanes.flatMap((lane) =>
      lane.nodes.map((n) => ({ id: n.id, x: n.x, y: n.y, categoryKey: n.categoryKey, status: n.status }))
    );
    if (allNodes.length < 2) return [];
    const sorted = allNodes.slice().sort((a, b) => (a.x - b.x) || (a.y - b.y));
    const links = [];
    for (let i = 0; i < sorted.length - 1; i++) {
      const a = sorted[i];
      const b = sorted[i + 1];
      if (a.categoryKey === b.categoryKey) continue; // mismo carril → ya conectado
      links.push({ a, b, key: `cross-${a.id}-${b.id}` });
    }
    return links;
  }, [lanes]);

  // ─── Discharge line (Alta): posición X al final del último tratamiento ───
  const dischargeX = useMemo(() => {
    let maxX = -Infinity;
    lanes.forEach((lane) => {
      lane.nodes.forEach((n) => {
        if (n.x > maxX) maxX = n.x;
      });
    });
    if (maxX === -Infinity) return null;
    // Ubicar la línea un poco después del último nodo, sin salir del lienzo
    return Math.min(contentWidth - 6, maxX + 70);
  }, [lanes, contentWidth]);

  // ─── Category counts ───
  const categoryCounts = useMemo(() => {
    const counts = {};
    categories.forEach((c) => {
      counts[c.key] = milestones.filter((m) => m.categoryKey === c.key).length;
    });
    return counts;
  }, [categories, milestones]);

  // ─── Specialist edit handlers ───
  const startEditSpecialist = useCallback((milestoneId) => {
    setEditingSpecialist((prev) => prev === milestoneId ? null : milestoneId);
  }, []);

  const selectSpecialist = useCallback((milestoneId, nombre) => {
    setSpecialistNames((prev) => {
      const next = { ...prev, [milestoneId]: nombre };
      saveLayout(next, nodePositions);
      return next;
    });
    setEditingSpecialist(null);
  }, [saveLayout, nodePositions]);

  // ─── Drag handlers ───
  const handleMouseDown = useCallback((e, node) => {
    e.preventDefault();
    e.stopPropagation();
    const container = matrixContainerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const startX = e.clientX;
    const nodeStartX = node.x;
    // Mantener Y fijo en el centro del carril
    const laneY = HEADER_HEIGHT + node.laneIdx * LANE_HEIGHT + LANE_HEIGHT / 2;

    const handleMouseMove = (moveEvent) => {
      const dx = moveEvent.clientX - startX;
      const newX = Math.max(NODE_R, Math.min(contentWidth - NODE_R, nodeStartX + dx));
      
      setNodePositions((prev) => ({
        ...prev,
        [node.id]: { x: newX, y: laneY }, // Y siempre fijo en el centro del carril
      }));
    };

    const handleMouseUp = () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      setDraggingNode(null);
      // Save to DB
      setNodePositions((prev) => {
        saveLayout(specialistNames, prev);
        return prev;
      });
    };

    setDraggingNode(node.id);
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  }, [contentWidth, saveLayout, specialistNames]);

  return (
    <div
      className={className}
      style={{
        background: COLORS.creamMain,
        borderRadius: 16,
        border: `1px solid rgba(200,169,110,0.3)`,
        overflow: "hidden",
        fontFamily: FONTS.sans,
      }}
    >
      {/* ═══ HEADER ═══ */}
      <div
        style={{
          padding: "20px 24px 16px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <div
              style={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                background: COLORS.gold,
              }}
            />
            <span
              style={{
                fontFamily: FONTS.sans,
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: "2.5px",
                color: COLORS.brownDark,
                textTransform: "uppercase",
              }}
            >
              SEGUIMIENTO DEL TRATAMIENTO
            </span>
          </div>
          <span
            style={{
              fontFamily: FONTS.sans,
              fontSize: 12,
              color: COLORS.brownMain,
              opacity: 0.7,
            }}
          >
            Presupuesto {budget.id} · {budget.patientName} · {budget.completedSessions} de{" "}
            {budget.totalSessions} sesiones
          </span>
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          {onRemoveWeek && weeks.length > 1 && (
            <button
              onClick={onRemoveWeek}
              style={{ background: "transparent", border: `0.5px solid ${COLORS.brownLight}`, borderRadius: 6, padding: "6px 10px", fontSize: 11, fontFamily: FONTS.sans, fontWeight: 500, color: COLORS.brownLight, cursor: "pointer", transition: "all 0.2s" }}
              onMouseEnter={(e) => { e.target.style.background = COLORS.creamSoft; }}
              onMouseLeave={(e) => { e.target.style.background = "transparent"; }}
              title="Quitar semana"
            >
              − Semana
            </button>
          )}
          {onAddWeek && (
            <button
              onClick={onAddWeek}
              style={{ background: "transparent", border: `0.5px solid ${COLORS.gold}`, borderRadius: 6, padding: "6px 10px", fontSize: 11, fontFamily: FONTS.sans, fontWeight: 600, color: COLORS.gold, cursor: "pointer", transition: "all 0.2s" }}
              onMouseEnter={(e) => { e.target.style.background = COLORS.creamSoft; }}
              onMouseLeave={(e) => { e.target.style.background = "transparent"; }}
              title="Agregar semana"
            >
              + Semana
            </button>
          )}
          <button
            onClick={onEdit}
            style={{ background: "transparent", border: `0.5px solid ${COLORS.brownMain}`, borderRadius: 6, padding: "6px 14px", fontSize: 11, fontFamily: FONTS.sans, fontWeight: 500, color: COLORS.brownMain, cursor: "pointer", transition: "all 0.2s" }}
            onMouseEnter={(e) => { e.target.style.background = COLORS.creamSoft; }}
            onMouseLeave={(e) => { e.target.style.background = "transparent"; }}
          >
            ✎ Editar
          </button>
          {onDelete && (
            <button
              onClick={onDelete}
              style={{ background: "transparent", border: `0.5px solid #d32f2f`, borderRadius: 6, width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontFamily: FONTS.sans, fontWeight: 700, color: "#d32f2f", cursor: "pointer", transition: "all 0.2s", lineHeight: 1 }}
              onMouseEnter={(e) => { e.target.style.background = "rgba(211,47,47,0.08)"; }}
              onMouseLeave={(e) => { e.target.style.background = "transparent"; }}
              title="Eliminar gráfico"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* ═══ PROGRESS BAR ═══ */}
      <div style={{ padding: "0 24px 16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <span style={{ fontFamily: FONTS.sans, fontSize: 10, opacity: 0.55, letterSpacing: "1px", textTransform: "uppercase", color: COLORS.brownMain }}>AVANCE</span>
          <span style={{ fontFamily: FONTS.serif, fontSize: 16, fontWeight: 500, color: COLORS.gold }}>{budget.progress || 0}%</span>
        </div>
        <div style={{ height: 4, borderRadius: 2, background: "rgba(93, 64, 55, 0.08)", overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${budget.progress || 0}%`, background: "linear-gradient(90deg, #8D6E63 0%, #C8A96E 100%)", borderRadius: 2, transition: "width 0.4s ease" }} />
        </div>
      </div>

      {/* ═══ MATRIX AREA ═══ */}
      <div style={{ display: "flex", position: "relative" }}>
        {/* ─── Left Panel (Categories) ─── */}
        <div
          style={{
            width: CATEGORY_PANEL_WIDTH,
            minWidth: CATEGORY_PANEL_WIDTH,
            position: "sticky",
            left: 0,
            zIndex: 2,
            background: COLORS.creamMain,
            paddingTop: HEADER_HEIGHT,
            borderRight: `1px solid rgba(200,169,110,0.15)`,
          }}
        >
          {categories.map((cat) => {
            const cColor = laneColor(cat.key);
            return (
              <div key={cat.key} style={{ height: LANE_HEIGHT, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 20px" }}>
                <div style={{ width: 180, height: 64, borderRadius: 10, background: COLORS.creamMain, border: `0.8px solid rgba(200,169,110,0.4)`, borderLeft: `4px solid ${cColor}`, display: "flex", alignItems: "center", padding: "0 12px", gap: 10, boxShadow: "0 2px 8px rgba(93,64,55,0.04)" }}>
                  <div style={{ width: 28, height: 28, minWidth: 28, borderRadius: "50%", background: cColor, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <span style={{ fontFamily: FONTS.sans, fontSize: 13, fontWeight: 700, color: COLORS.creamMain }}>{cat.initial}</span>
                  </div>
                  <div style={{ overflow: "hidden" }}>
                    <div style={{ fontFamily: FONTS.serif, fontSize: 14, fontWeight: 500, letterSpacing: "1px", color: COLORS.brownDark, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{cat.label}</div>
                    <div style={{ fontFamily: FONTS.sans, fontSize: 10, color: COLORS.brownMain, opacity: categoryCounts[cat.key] === 0 ? 0.4 : 0.6, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{cat.subtitle} · {categoryCounts[cat.key]}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* ─── Right Panel (Scrollable Matrix) ─── */}
        <div
          ref={scrollContainerRef}
          style={{ flex: 1, overflowX: "auto", overflowY: "hidden", position: "relative", scrollbarWidth: "thin", scrollbarColor: "rgba(200,169,110,0.4) rgba(245,237,223,0.5)" }}
          className="timeline-matrix-scroll"
        >
          <div ref={matrixContainerRef} style={{ width: contentWidth, minWidth: "100%", height: contentHeight + 28, position: "relative", paddingBottom: 28 }}>
            {/* ─── Grid background cuadriculado tenue ─── */}
            <div
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                top: HEADER_HEIGHT,
                height: lanesHeight,
                backgroundImage: `
                  linear-gradient(to right, rgba(163,105,32,0.05) 1px, transparent 1px),
                  linear-gradient(to bottom, rgba(163,105,32,0.05) 1px, transparent 1px)
                `,
                backgroundSize: `${WEEK_WIDTH / 4}px 40px`,
                zIndex: 0,
                pointerEvents: "none",
              }}
            />

            {/* ─── Week Headers ─── */}
            <div style={{ position: "relative", height: HEADER_HEIGHT, zIndex: 2 }}>
              {weeks.map((week, idx) => {
                const cx = (idx + 0.5) * WEEK_WIDTH;
                return (
                  <div key={`week-header-${week.number}`} style={{ position: "absolute", left: cx, top: 10, transform: "translateX(-50%)", textAlign: "center", width: WEEK_WIDTH - 20 }}>
                    <div style={{ fontFamily: FONTS.serif, fontSize: 14, letterSpacing: "3px", fontWeight: 500, color: COLORS.brownMain }}>
                      SEMANA {String(week.number).padStart(2, "0")}
                    </div>
                    <div style={{ fontFamily: FONTS.sans, fontSize: 9, color: COLORS.brownMain, opacity: 0.55, marginTop: 2 }}>
                      {week.dateRange}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* ─── Week column bands (alternating subtle tint) ─── */}
            {weeks.map((_, idx) => (
              <div
                key={`wband-${idx}`}
                style={{
                  position: "absolute",
                  left: idx * WEEK_WIDTH,
                  top: HEADER_HEIGHT,
                  width: WEEK_WIDTH,
                  height: lanesHeight,
                  background: idx % 2 === 1 ? "rgba(163,105,32,0.025)" : "transparent",
                  zIndex: 0,
                  pointerEvents: "none",
                }}
              />
            ))}

            {/* ─── Vertical week dividers (span lanes) — más visibles ─── */}
            {weeks.map((week, idx) => {
              if (idx === 0) return null;
              return (
                <div
                  key={`vdiv-${idx}`}
                  style={{ position: "absolute", left: idx * WEEK_WIDTH, top: HEADER_HEIGHT - 8, height: lanesHeight + 8, width: 0, borderLeft: "2px solid rgba(163,105,32,0.35)", zIndex: 1 }}
                />
              );
            })}
            {/* Borde derecho final */}
            <div style={{ position: "absolute", left: contentWidth, top: HEADER_HEIGHT - 8, height: lanesHeight + 8, width: 0, borderLeft: "2px solid rgba(163,105,32,0.35)", zIndex: 1 }} />
            {/* Borde izquierdo inicial */}
            <div style={{ position: "absolute", left: 0, top: HEADER_HEIGHT - 8, height: lanesHeight + 8, width: 0, borderLeft: "2px solid rgba(163,105,32,0.35)", zIndex: 1 }} />

            {/* ─── Lanes (one per category) ─── */}
            {lanes.map((lane, laneIdx) => {
              const color = lane.color;
              const laneY = HEADER_HEIGHT + laneIdx * LANE_HEIGHT;

              return (
                <div key={lane.cat.key} style={{ position: "absolute", left: 0, right: 0, top: laneY, height: LANE_HEIGHT }}>
                  {/* Lane band: tinted ~7% of category color */}
                  <div style={{ position: "absolute", left: 8, right: 8, top: 12, bottom: 12, background: hexToRgba(color, 0.07), borderRadius: 16, border: `1px solid ${hexToRgba(color, 0.18)}` }} />

                  {/* Lane central horizontal guide line */}
                  <div style={{ position: "absolute", left: 8, right: 8, top: "50%", height: 0, borderTop: `1px dashed ${hexToRgba(color, 0.3)}`, zIndex: 0 }} />
                </div>
              );
            })}

            {/* ─── Discharge line (ALTA) al final del último tratamiento ─── */}
            {dischargeX !== null && milestones.length > 0 && (
              <motion.div
                initial={{ opacity: 0, scaleY: 0 }}
                animate={{ opacity: 1, scaleY: 1 }}
                transition={{ duration: 0.6, delay: 0.5, ease: "easeOut" }}
                style={{
                  position: "absolute",
                  left: dischargeX,
                  top: HEADER_HEIGHT - 8,
                  height: lanesHeight + 8,
                  width: 0,
                  borderLeft: "3px solid #4CAF50",
                  transformOrigin: "top center",
                  zIndex: 5,
                  pointerEvents: "none",
                }}
              >
                {/* Etiqueta ALTA */}
                <div
                  style={{
                    position: "absolute",
                    left: 0,
                    top: -14,
                    transform: "translateX(-50%)",
                    background: "#4CAF50",
                    color: "#FFFFFF",
                    fontFamily: FONTS.sans,
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: "1.5px",
                    textTransform: "uppercase",
                    padding: "3px 12px",
                    borderRadius: 12,
                    boxShadow: "0 2px 8px rgba(76,175,80,0.35)",
                    whiteSpace: "nowrap",
                  }}
                >
                  Alta
                </div>
                {/* Punto inferior decorativo */}
                <div
                  style={{
                    position: "absolute",
                    left: 0,
                    bottom: -5,
                    transform: "translateX(-50%)",
                    width: 9,
                    height: 9,
                    borderRadius: "50%",
                    background: "#4CAF50",
                    boxShadow: "0 0 0 3px rgba(76,175,80,0.18)",
                  }}
                />
              </motion.div>
            )}

            {/* ─── Connector Lines between nodes in each lane ─── */}
            {lanes.map((lane) => {
              const color = lane.color;
              const nodes = lane.nodes;
              if (nodes.length < 2) return null;

              return nodes.slice(0, -1).map((n, idx) => {
                const nextNode = nodes[idx + 1];
                const x1 = n.x;
                const y1 = n.y;
                const x2 = nextNode.x;
                const y2 = nextNode.y;
                const dx = x2 - x1;
                const dy = y2 - y1;
                const length = Math.sqrt(dx * dx + dy * dy);
                const angle = Math.atan2(dy, dx) * (180 / Math.PI);
                
                // Determinar si es sólida o punteada según el estado
                const isSolid = n.status === "completed" && nextNode.status === "completed";
                const lineStyle = isSolid 
                  ? `3px solid ${color}` 
                  : `2.5px dashed ${hexToRgba(color, 0.7)}`;

                return (
                  <motion.div
                    key={`line-${n.id}-${nextNode.id}`}
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{ duration: 0.6, delay: 0.2 + idx * 0.1, ease: "easeOut" }}
                    style={{
                      position: "absolute",
                      left: x1,
                      top: y1,
                      width: length,
                      height: 0,
                      borderTop: lineStyle,
                      transformOrigin: "left center",
                      transform: `rotate(${angle}deg)`,
                      zIndex: 1,
                    }}
                  />
                );
              });
            })}

            {/* ─── Cross-category connectors (recorrido del paciente) ─── */}
            {crossLinks.length > 0 && (
              <svg
                width={contentWidth}
                height={contentHeight + 28}
                style={{
                  position: "absolute",
                  left: 0,
                  top: 0,
                  zIndex: 2,
                  pointerEvents: "none",
                  overflow: "visible",
                }}
              >
                <defs>
                  <linearGradient id="crossLinkGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#B07BD9" />
                    <stop offset="45%" stopColor="#8E44C4" />
                    <stop offset="100%" stopColor="#6A2C9A" />
                  </linearGradient>
                  <radialGradient id="crossLinkDot" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="#F3E4FB" />
                    <stop offset="55%" stopColor="#B07BD9" />
                    <stop offset="100%" stopColor="rgba(142,68,196,0)" />
                  </radialGradient>
                </defs>
                {crossLinks.map((link, idx) => {
                  const { a, b } = link;
                  const dx = b.x - a.x;
                  const cx1 = a.x + dx * 0.45;
                  const cx2 = b.x - dx * 0.45;
                  const d = `M ${a.x} ${a.y} C ${cx1} ${a.y}, ${cx2} ${b.y}, ${b.x} ${b.y}`;
                  const pathId = `crosspath-${a.id}-${b.id}`;
                  return (
                    <g key={link.key}>
                      {/* halo suave para profundidad */}
                      <path
                        id={pathId}
                        d={d}
                        fill="none"
                        stroke="rgba(142,68,196,0.16)"
                        strokeWidth={7}
                        strokeLinecap="round"
                      />
                      {/* trazo base que se dibuja al aparecer */}
                      <motion.path
                        d={d}
                        fill="none"
                        stroke="url(#crossLinkGrad)"
                        strokeWidth={2.4}
                        strokeLinecap="round"
                        initial={{ pathLength: 0, opacity: 0 }}
                        animate={{ pathLength: 1, opacity: 0.9 }}
                        transition={{ duration: 0.7, delay: 0.3 + idx * 0.08, ease: "easeInOut" }}
                      />
                      {/* flujo animado (marcha continua) sobre el trazo */}
                      <motion.path
                        d={d}
                        fill="none"
                        stroke="#EBD3FA"
                        strokeWidth={2.4}
                        strokeLinecap="round"
                        strokeDasharray="3 17"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 0.9, strokeDashoffset: [0, -40] }}
                        transition={{
                          opacity: { duration: 0.6, delay: 0.6 + idx * 0.08 },
                          strokeDashoffset: { duration: 1.6, repeat: Infinity, ease: "linear" },
                        }}
                      />
                      {/* punto luminoso que viaja por la curva */}
                      <circle r={4} fill="url(#crossLinkDot)">
                        <animateMotion
                          dur="2.4s"
                          repeatCount="indefinite"
                          keyPoints="0;1"
                          keyTimes="0;1"
                          calcMode="linear"
                        >
                          <mpath href={`#${pathId}`} />
                        </animateMotion>
                      </circle>
                      {/* punto de salida en la categoría origen */}
                      <circle cx={a.x} cy={a.y} r={3.2} fill="rgba(142,68,196,0.95)" />
                    </g>
                  );
                })}
              </svg>
            )}

            {/* ─── All Nodes (positioned absolutely) ─── */}
            {lanes.flatMap((lane) => {
              const color = lane.color;
              return lane.nodes.map((n, nIdx) => {
                const labelAbove = nIdx % 2 === 0;
                const specialistName = specialistNames[n.id] || (n.specialist ? n.specialist.fullName : "");
                const specialistInitials = specialistName ? specialistName.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2) : "";
                const isDragging = draggingNode === n.id;
                
                return (
                  <motion.div
                    key={n.id}
                    initial={{ opacity: 0, scale: 0.4 }}
                    animate={{ opacity: 1, scale: isDragging ? 1.1 : 1 }}
                    transition={{ duration: 0.35, delay: 0.15 + nIdx * 0.09, ease: "easeOut" }}
                    style={{ 
                      position: "absolute", 
                      left: n.x, 
                      top: n.y, 
                      transform: "translate(-50%, -50%)", 
                      zIndex: isDragging ? 100 : 10,
                      cursor: isDragging ? "grabbing" : "ew-resize"
                    }}
                    onMouseDown={(e) => handleMouseDown(e, n)}
                  >
                        {/* Order badge */}
                        <div style={{ position: "absolute", top: -(NODE_R + 20), left: "50%", transform: "translateX(-50%)", width: 19, height: 19, borderRadius: "50%", background: n.status === "completed" ? color : COLORS.creamMain, border: `1px ${n.status === "pending" ? "dashed" : "solid"} ${color}`, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 3 }}>
                          <span style={{ fontFamily: FONTS.serif, fontSize: 11, fontWeight: 600, color: n.status === "completed" ? COLORS.creamMain : COLORS.brownDark }}>
                            {String(n.order).padStart(2, "0")}
                          </span>
                        </div>

                        {/* Node circle */}
                        <div
                          style={{
                            width: NODE_R * 2,
                            height: NODE_R * 2,
                            borderRadius: "50%",
                            background: n.status === "completed" ? color : COLORS.creamMain,
                            border:
                              n.status === "completed"
                                ? "none"
                                : n.status === "assigned"
                                ? `2.5px solid ${color}`
                                : `2px dashed ${hexToRgba(color, 0.75)}`,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            boxShadow: "0 2px 6px rgba(93,64,55,0.12)",
                          }}
                        >
                          {n.status === "completed" && (
                            <span style={{ color: COLORS.creamMain, fontSize: 14, fontWeight: 700, lineHeight: 1 }}>✓</span>
                          )}
                        </div>

                        {/* Label card alternating above/below */}
                        <div
                          style={{
                            position: "absolute",
                            left: "50%",
                            transform: "translateX(-50%)",
                            ...(labelAbove ? { bottom: NODE_R * 2 + 16 } : { top: NODE_R * 2 + 16 }),
                            width: 154,
                          }}
                        >
                          <div style={{ width: "100%", minHeight: 44, borderRadius: 8, background: COLORS.creamMain, border: `1px ${n.status === "pending" ? "dashed" : "solid"} ${hexToRgba(color, 0.55)}`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "6px 7px", boxShadow: "0 2px 8px rgba(93,64,55,0.08)" }}>
                            {/* Treatment name */}
                            <div style={{ fontFamily: FONTS.serif, fontSize: 13.5, fontWeight: 600, color: COLORS.brownDark, textAlign: "center", lineHeight: 1.25, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%" }}>
                              {n.name}
                            </div>
                            {/* Specialist - click to edit */}
                            <div style={{ marginTop: 3, width: "100%", position: "relative" }}>
                              {editingSpecialist === n.id ? (
                                <select
                                  autoFocus
                                  value={specialistNames[n.id] || ""}
                                  onChange={(e) => selectSpecialist(n.id, e.target.value)}
                                  onBlur={() => setEditingSpecialist(null)}
                                  style={{
                                    width: "100%", fontSize: 11, fontFamily: FONTS.sans,
                                    border: `1px solid ${color}`, borderRadius: 4,
                                    padding: "3px 4px", outline: "none", background: COLORS.creamSoft,
                                    color: COLORS.brownDark, cursor: "pointer", appearance: "auto", fontWeight: 500,
                                  }}
                                >
                                  <option value="">-- Seleccionar --</option>
                                  {especialistas.map((esp) => (
                                    <option key={esp.id} value={esp.nombre}>{esp.nombre}</option>
                                  ))}
                                </select>
                              ) : (
                                <div
                                  onClick={() => startEditSpecialist(n.id)}
                                  style={{
                                    width: "100%", fontSize: 11, fontFamily: FONTS.sans,
                                    border: `1px solid ${hexToRgba(color, 0.6)}`, borderRadius: 4,
                                    padding: "4px 5px", background: specialistNames[n.id] ? hexToRgba(color, 0.1) : COLORS.creamSoft,
                                    color: specialistNames[n.id] ? COLORS.brownDark : COLORS.brownLight,
                                    cursor: "pointer", fontWeight: 500, textAlign: "center",
                                    transition: "all 0.2s", display: "flex", alignItems: "center", justifyContent: "center", gap: 3,
                                  }}
                                  onMouseEnter={(e) => { e.currentTarget.style.background = hexToRgba(color, 0.18); }}
                                  onMouseLeave={(e) => { e.currentTarget.style.background = specialistNames[n.id] ? hexToRgba(color, 0.1) : COLORS.creamSoft; }}
                                >
                                  {specialistNames[n.id] ? (
                                    <>
                                      <div style={{ width: 15, height: 15, borderRadius: "50%", background: color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                        <span style={{ fontSize: 7.5, fontWeight: 700, color: COLORS.creamMain }}>{specialistInitials}</span>
                                      </div>
                                      <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontSize: 11 }}>{specialistNames[n.id]}</span>
                                    </>
                                  ) : (
                                    <span style={{ fontStyle: "italic", fontSize: 10 }}>Seleccionar</span>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    );
              });
            })}

            {/* ─── Empty state ─── */}
            {milestones.length === 0 && (
              <div style={{ position: "absolute", left: 0, right: 0, top: HEADER_HEIGHT, bottom: 0, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONTS.sans, fontSize: 13, color: COLORS.brownMain, opacity: 0.45, fontStyle: "italic" }}>
                Aún no hay sesiones agendadas
              </div>
            )}
          </div>

          {/* Scroll hint */}
          {showScrollHint && weeks.length > 4 && (
            <div style={{ position: "absolute", right: 0, top: "50%", transform: "translateY(-50%)", width: 32, height: 60, background: "linear-gradient(90deg, transparent, rgba(200,169,110,0.15))", display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
              <span style={{ fontSize: 18, color: COLORS.gold, opacity: 0.7 }}>›</span>
            </div>
          )}
        </div>
      </div>

      {/* ═══ LEGEND ═══ */}
      <div style={{ padding: "14px 24px", borderTop: `0.5px solid rgba(200,169,110,0.3)`, display: "flex", justifyContent: "center", gap: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 12, height: 12, borderRadius: "50%", background: COLORS.brownMedium }} />
          <span style={{ fontFamily: FONTS.sans, fontSize: 11, letterSpacing: "0.8px", color: COLORS.brownMain, opacity: 0.85 }}>Completado</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 12, height: 12, borderRadius: "50%", background: COLORS.creamMain, border: `2px solid ${COLORS.gold}`, boxSizing: "border-box" }} />
          <span style={{ fontFamily: FONTS.sans, fontSize: 11, letterSpacing: "0.8px", color: COLORS.brownMain, opacity: 0.85 }}>Asignado</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 12, height: 12, borderRadius: "50%", background: COLORS.creamMain, border: `2px dashed ${COLORS.brownLight}`, boxSizing: "border-box" }} />
          <span style={{ fontFamily: FONTS.sans, fontSize: 11, letterSpacing: "0.8px", color: COLORS.brownMain, opacity: 0.85 }}>Pendiente</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 4, height: 14, borderRadius: 2, background: "#4CAF50" }} />
          <span style={{ fontFamily: FONTS.sans, fontSize: 11, letterSpacing: "0.8px", color: COLORS.brownMain, opacity: 0.85 }}>Alta</span>
        </div>
      </div>

      {/* Scrollbar styles */}
      <style>{`
        .timeline-matrix-scroll::-webkit-scrollbar { height: 6px; }
        .timeline-matrix-scroll::-webkit-scrollbar-track { background: rgba(245,237,223,0.5); border-radius: 3px; }
        .timeline-matrix-scroll::-webkit-scrollbar-thumb { background: rgba(200,169,110,0.4); border-radius: 3px; }
        .timeline-matrix-scroll::-webkit-scrollbar-thumb:hover { background: rgba(200,169,110,0.6); }
      `}</style>
    </div>
  );
};

export default TreatmentTimelineMatrix;

/*
 * ═══════════════════════════════════════════════════════
 * EJEMPLO DE USO / TESTING DATA
 * ═══════════════════════════════════════════════════════
 *
 * import TreatmentTimelineMatrix from './TreatmentTimelineMatrix';
 *
 * const exampleBudget = {
 *   id: "PRE-2026-118",
 *   patientName: "María Romero",
 *   progress: 40,
 *   completedSessions: 2,
 *   totalSessions: 5,
 * };
 *
 * const exampleCategories = [
 *   { key: "armonizacion", label: "Armonización", initial: "A", subtitle: "Inyectables y rellenos" },
 *   { key: "facial", label: "Facial", initial: "F", subtitle: "Aparatología y limpieza" },
 *   { key: "corporal", label: "Corporal", initial: "C", subtitle: "Lipoescultura y modelado" },
 * ];
 *
 * const exampleWeeks = [
 *   { number: 1, dateRange: "12 — 18 mar" },
 *   { number: 2, dateRange: "19 — 25 mar" },
 *   { number: 3, dateRange: "26 mar — 01 abr" },
 *   { number: 4, dateRange: "02 — 08 abr" },
 *   { number: 5, dateRange: "09 — 15 abr" },
 *   { number: 6, dateRange: "16 — 22 abr" },
 * ];
 *
 * const exampleMilestones = [
 *   { id: "m1", order: 1, categoryKey: "corporal", week: 1, name: "Lipopapada", status: "completed", specialist: { initials: "EE", fullName: "Dr. Erick Espinoza" } },
 *   { id: "m2", order: 2, categoryKey: "facial", week: 2, name: "HIFU facial", status: "completed", specialist: { initials: "RC", fullName: "Romina Carbajal" } },
 *   { id: "m3", order: 3, categoryKey: "armonizacion", week: 2, name: "Exosomas", status: "assigned", specialist: { initials: "VR", fullName: "Dra. Valeria Ríos" } },
 *   { id: "m4", order: 4, categoryKey: "facial", week: 3, name: "Radiofrecuencia", status: "pending", specialist: null },
 *   { id: "m5", order: 5, categoryKey: "corporal", week: 4, name: "Masajes reductivos", status: "pending", specialist: null },
 * ];
 *
 * function App() {
 *   const [milestones, setMilestones] = useState(exampleMilestones);
 *
 *   const handleMilestoneMove = (milestoneId, newWeek, newCategoryKey) => {
 *     setMilestones(prev => prev.map(m =>
 *       m.id === milestoneId ? { ...m, week: newWeek, categoryKey: newCategoryKey } : m
 *     ));
 *   };
 *
 *   return (
 *     <TreatmentTimelineMatrix
 *       budget={exampleBudget}
 *       categories={exampleCategories}
 *       weeks={exampleWeeks}
 *       milestones={milestones}
 *       onMilestoneMove={handleMilestoneMove}
 *       onMilestoneClick={(id) => console.log("Clicked:", id)}
 *       onEdit={() => console.log("Edit clicked")}
 *       onAssignSpecialist={(id) => console.log("Assign specialist for:", id)}
 *     />
 *   );
 * }
 */
