import React, { useState, useMemo, useCallback, useRef, useEffect } from "react";

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

// ─── Tipografía ───
const FONTS = {
  serif: "'Cormorant Garamond', Georgia, serif",
  sans: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
};

// ─── Constantes de layout ───
const WEEK_WIDTH = 420;
const LANE_HEIGHT = 160;
const FIRST_LANE_Y = 130;
const HEADER_HEIGHT = 80;
const CATEGORY_PANEL_WIDTH = 220;

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
  // ─── Free-position state (persisted) ───
  const [nodePositions, setNodePositions] = useState({});
  const [specialistNames, setSpecialistNames] = useState({});
  const [layoutLoaded, setLayoutLoaded] = useState(false);
  const [draggingNode, setDraggingNode] = useState(null);
  const [editingSpecialist, setEditingSpecialist] = useState(null);
  const [showScrollHint, setShowScrollHint] = useState(false);
  const scrollContainerRef = useRef(null);
  const svgRef = useRef(null);
  const saveTimerRef = useRef(null);

  // ─── Derived values ───
  const svgWidth = weeks.length * WEEK_WIDTH;
  const svgHeight = useMemo(
    () => FIRST_LANE_Y + categories.length * LANE_HEIGHT + 40,
    [categories.length]
  );

  // ─── Load layout from DB ───
  useEffect(() => {
    if (!presupuestoId) { setLayoutLoaded(true); return; }
    const token = localStorage.getItem("token");
    fetch(`${API}/api/tratamientos/calendar-layout/${presupuestoId}`, {
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    })
      .then((r) => r.json())
      .then((data) => {
        if (data && data.matrixPositions) {
          setNodePositions(data.matrixPositions);
        }
        if (data && data.specialistNames) {
          setSpecialistNames(data.specialistNames);
        }
        setLayoutLoaded(true);
      })
      .catch(() => setLayoutLoaded(true));
  }, [presupuestoId]);

  // ─── Init default positions for milestones not yet placed ───
  useEffect(() => {
    if (!layoutLoaded) return;
    setNodePositions((prev) => {
      const needsInit = milestones.some((m) => !prev[m.id]);
      if (!needsInit) return prev;
      const merged = { ...prev };
      milestones.forEach((m, idx) => {
        if (!merged[m.id]) {
          const weekIdx = weeks.findIndex((w) => w.number === m.week);
          const catIdx = categories.findIndex((c) => c.key === m.categoryKey);
          const x = weekIdx >= 0 ? (weekIdx + 0.5) * WEEK_WIDTH : (idx + 0.5) * WEEK_WIDTH;
          const y = catIdx >= 0 ? FIRST_LANE_Y + catIdx * LANE_HEIGHT : FIRST_LANE_Y + idx * 50;
          merged[m.id] = { x, y };
        }
      });
      return merged;
    });
  }, [milestones, weeks, categories, layoutLoaded]);

  // ─── Save layout to DB (debounced) ───
  const saveLayout = useCallback((positions, specialists) => {
    if (!presupuestoId) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      const token = localStorage.getItem("token");
      fetch(`${API}/api/tratamientos/calendar-layout/${presupuestoId}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ matrixPositions: positions, specialistNames: specialists }),
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

  // ─── Milestone positions (using free positions) ───
  const milestonePositions = useMemo(() => {
    return milestones.map((m) => {
      const pos = nodePositions[m.id];
      const weekIdx = weeks.findIndex((w) => w.number === m.week);
      const catIdx = categories.findIndex((c) => c.key === m.categoryKey);
      const defaultX = weekIdx >= 0 ? (weekIdx + 0.5) * WEEK_WIDTH : 110;
      const defaultY = catIdx >= 0 ? FIRST_LANE_Y + catIdx * LANE_HEIGHT : FIRST_LANE_Y;
      return { ...m, x: pos?.x ?? defaultX, y: pos?.y ?? defaultY };
    });
  }, [milestones, nodePositions, weeks, categories]);

  // ─── Sorted milestones for connector path ───
  const sortedMilestones = useMemo(() => {
    return [...milestonePositions].sort((a, b) => a.order - b.order);
  }, [milestonePositions]);

  // ─── Connector path segments ───
  const connectorSegments = useMemo(() => {
    if (sortedMilestones.length < 2) return [];
    const segments = [];
    for (let i = 0; i < sortedMilestones.length - 1; i++) {
      const prev = sortedMilestones[i];
      const curr = sortedMilestones[i + 1];
      const midX = (prev.x + curr.x) / 2;
      const d = `M ${prev.x} ${prev.y} C ${midX} ${prev.y}, ${midX} ${curr.y}, ${curr.x} ${curr.y}`;
      const isPending = prev.status === "pending" || curr.status === "pending";
      segments.push({ d, isPending, key: `seg-${i}` });
    }
    return segments;
  }, [sortedMilestones]);

  // ─── Full connector path (for fill area under the curve) ───
  const fullConnectorPath = useMemo(() => {
    if (sortedMilestones.length < 2) return "";
    let path = `M ${sortedMilestones[0].x} ${sortedMilestones[0].y}`;
    for (let i = 0; i < sortedMilestones.length - 1; i++) {
      const prev = sortedMilestones[i];
      const curr = sortedMilestones[i + 1];
      const midX = (prev.x + curr.x) / 2;
      path += ` C ${midX} ${prev.y}, ${midX} ${curr.y}, ${curr.x} ${curr.y}`;
    }
    return path;
  }, [sortedMilestones]);

  // ─── Category counts ───
  const categoryCounts = useMemo(() => {
    const counts = {};
    categories.forEach((c) => {
      counts[c.key] = milestones.filter((m) => m.categoryKey === c.key).length;
    });
    return counts;
  }, [categories, milestones]);

  // ─── Free drag handlers (mouse-based SVG drag) ───
  const handleMouseDown = useCallback((e, milestoneId) => {
    e.preventDefault();
    e.stopPropagation();
    setDraggingNode(milestoneId);
  }, []);

  useEffect(() => {
    if (!draggingNode) return;
    const handleMouseMove = (e) => {
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const x = Math.max(20, Math.min(svgWidth - 20, e.clientX - rect.left));
      const y = Math.max(20, Math.min(svgHeight - 20, e.clientY - rect.top));
      setNodePositions((prev) => {
        const next = { ...prev, [draggingNode]: { x, y } };
        return next;
      });
    };
    const handleMouseUp = () => {
      setDraggingNode(null);
      // Save after drop
      setNodePositions((prev) => {
        saveLayout(prev, specialistNames);
        return prev;
      });
    };
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [draggingNode, svgWidth, svgHeight, saveLayout, specialistNames]);

  // ─── Specialist edit handlers ───
  const startEditSpecialist = useCallback((milestoneId) => {
    setEditingSpecialist((prev) => prev === milestoneId ? null : milestoneId);
  }, []);

  const selectSpecialist = useCallback((milestoneId, nombre) => {
    const newNames = { ...specialistNames, [milestoneId]: nombre };
    setSpecialistNames(newNames);
    setEditingSpecialist(null);
    saveLayout(nodePositions, newNames);
  }, [specialistNames, nodePositions, saveLayout]);

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
          {categories.map((cat, idx) => (
            <div key={cat.key} style={{ height: LANE_HEIGHT, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 20px" }}>
              <div style={{ width: 180, height: 64, borderRadius: 10, background: COLORS.creamMain, border: `0.8px solid rgba(200,169,110,0.4)`, display: "flex", alignItems: "center", padding: "0 12px", gap: 10, boxShadow: "0 2px 8px rgba(93,64,55,0.04)" }}>
                <div style={{ width: 28, height: 28, minWidth: 28, borderRadius: "50%", background: COLORS.brownMain, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ fontFamily: FONTS.sans, fontSize: 13, fontWeight: 600, color: COLORS.gold }}>{cat.initial}</span>
                </div>
                <div style={{ overflow: "hidden" }}>
                  <div style={{ fontFamily: FONTS.serif, fontSize: 14, fontWeight: 500, letterSpacing: "1px", color: COLORS.brownDark, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{cat.label}</div>
                  <div style={{ fontFamily: FONTS.sans, fontSize: 10, color: COLORS.brownMain, opacity: categoryCounts[cat.key] === 0 ? 0.4 : 0.6, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{cat.subtitle} · {categoryCounts[cat.key]}</div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* ─── Right Panel (Scrollable Matrix) ─── */}
        <div
          ref={scrollContainerRef}
          style={{ flex: 1, overflowX: "auto", overflowY: "hidden", position: "relative", scrollbarWidth: "thin", scrollbarColor: "rgba(200,169,110,0.4) rgba(245,237,223,0.5)" }}
          className="timeline-matrix-scroll"
        >
          <svg
            ref={svgRef}
            width={svgWidth}
            height={svgHeight}
            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
            style={{ display: "block", cursor: draggingNode ? "grabbing" : "default" }}
          >
            <defs>
              {categories.map((_, idx) => (
                <linearGradient key={`lane-grad-${idx}`} id={`lane-grad-${idx}`} x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor={idx % 3 === 0 ? "rgba(240,229,210,0.35)" : idx % 3 === 1 ? "rgba(245,237,223,0.4)" : "rgba(250,243,232,0.5)"} />
                  <stop offset="100%" stopColor={idx % 3 === 0 ? "rgba(240,229,210,0.15)" : idx % 3 === 1 ? "rgba(245,237,223,0.2)" : "rgba(250,243,232,0.25)"} />
                </linearGradient>
              ))}
              {/* Grid pattern - cuadriculado visible */}
              <pattern id="matrixGridPattern" width="28" height="28" patternUnits="userSpaceOnUse">
                <path d="M 28 0 L 0 0 0 28" fill="none" stroke="rgba(163,105,32,0.13)" strokeWidth="0.8" />
              </pattern>
              {/* Gradient for connector lines - vertical shadow effect */}
              <linearGradient id="connectorGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor={COLORS.gold} stopOpacity="0.4" />
                <stop offset="50%" stopColor={COLORS.gold} stopOpacity="1" />
                <stop offset="100%" stopColor={COLORS.brownMedium} stopOpacity="0.8" />
              </linearGradient>
              <linearGradient id="connectorGradientPending" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor={COLORS.brownLight} stopOpacity="0.3" />
                <stop offset="50%" stopColor={COLORS.brownLight} stopOpacity="0.7" />
                <stop offset="100%" stopColor={COLORS.brownMedium} stopOpacity="0.5" />
              </linearGradient>
              {/* Gradient for fill area under curve */}
              <linearGradient id="fillAreaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor={COLORS.gold} stopOpacity="0.15" />
                <stop offset="100%" stopColor={COLORS.gold} stopOpacity="0.02" />
              </linearGradient>
            </defs>

            {/* Fondo cuadriculado */}
            <rect x={0} y={0} width={svgWidth} height={svgHeight} fill="url(#matrixGridPattern)" />

            {/* ─── Week Headers ─── */}
            {weeks.map((week, idx) => {
              const cx = (idx + 0.5) * WEEK_WIDTH;
              return (
                <g key={`week-header-${week.number}`}>
                  <text x={cx} y={30} textAnchor="middle" style={{ fontFamily: FONTS.serif, fontSize: 14, letterSpacing: "3px", fontWeight: 500, fill: COLORS.brownMain }}>
                    SEMANA {String(week.number).padStart(2, "0")}
                  </text>
                  <text x={cx} y={48} textAnchor="middle" style={{ fontFamily: FONTS.sans, fontSize: 9, fill: COLORS.brownMain, opacity: 0.55 }}>
                    {week.dateRange}
                  </text>
                </g>
              );
            })}

            {/* ─── Vertical Dividers (week separators - más notorias) ─── */}
            {weeks.map((_, idx) => {
              if (idx === 0) return null;
              const x = idx * WEEK_WIDTH;
              return <line key={`vdiv-${idx}`} x1={x} y1={0} x2={x} y2={svgHeight} stroke="rgba(163,105,32,0.35)" strokeWidth={1.8} />;
            })}

            {/* ─── Lane Backgrounds + Guide Lines ─── */}
            {categories.map((_, idx) => {
              const laneY = FIRST_LANE_Y + idx * LANE_HEIGHT - LANE_HEIGHT / 2;
              const centerY = FIRST_LANE_Y + idx * LANE_HEIGHT;
              return (
                <g key={`lane-${idx}`}>
                  <rect x={0} y={laneY} width={svgWidth} height={LANE_HEIGHT} fill={`url(#lane-grad-${idx})`} />
                  <line x1={0} y1={centerY} x2={svgWidth} y2={centerY} stroke="rgba(200,169,110,0.18)" strokeDasharray="2,4" strokeWidth={0.5} />
                </g>
              );
            })}

            {/* ─── Starting Line (from category panel edge to first node) ─── */}
            {sortedMilestones.length >= 1 && (() => {
              const first = sortedMilestones[0];
              const startX = 0; // Start from left edge of SVG (which is right after category panel)
              const startY = svgHeight / 2; // Start from middle height
              const midX = first.x / 2; // Control point for curve
              const curvePath = `M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${first.y}, ${first.x} ${first.y}`;
              return (
                <path
                  d={curvePath}
                  fill="none"
                  stroke={first.status === "pending" ? "url(#connectorGradientPending)" : "url(#connectorGradient)"}
                  strokeWidth={first.status === "pending" ? 2.5 : 3}
                  strokeDasharray={first.status === "pending" ? "4,4" : "none"}
                  strokeLinecap="round"
                />
              );
            })()}

            {/* ─── Fill Area Under Curve ─── */}
            {sortedMilestones.length >= 2 && fullConnectorPath && (() => {
              const last = sortedMilestones[sortedMilestones.length - 1];
              const first = sortedMilestones[0];
              const startX = 0;
              const startY = svgHeight / 2; // Same starting point as the line
              const midX = first.x / 2;
              // Create fill path that follows the starting curve, then the connector path, then closes at bottom
              const fillPath = `M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${first.y}, ${fullConnectorPath.substring(2)} L ${last.x},${svgHeight} L ${startX},${svgHeight} Z`;
              return <path d={fillPath} fill="url(#fillAreaGradient)" />;
            })()}

            {/* ─── Connector Path ─── */}
            {connectorSegments.map((seg) => (
              <path
                key={seg.key}
                d={seg.d}
                fill="none"
                stroke={seg.isPending ? "url(#connectorGradientPending)" : "url(#connectorGradient)"}
                strokeWidth={seg.isPending ? 2.5 : 3}
                strokeDasharray={seg.isPending ? "4,4" : "none"}
                strokeLinecap="round"
              />
            ))}

            {/* ─── Milestone Nodes (freely draggable) ─── */}
            {milestonePositions.map((m) => {
              const isDragging = draggingNode === m.id;
              const specialistName = specialistNames[m.id] || (m.specialist ? m.specialist.fullName : "");
              const specialistInitials = specialistName ? specialistName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) : "";
              return (
                <g key={`${m.id}-${m.x}-${m.y}`} style={{ cursor: isDragging ? "grabbing" : "grab", opacity: isDragging ? 0.85 : 1 }}>
                  {/* Halo */}
                  <circle cx={m.x} cy={m.y} r={16} fill={COLORS.creamMain} />

                  {/* Main circle */}
                  {m.status === "completed" && (
                    <>
                      <circle cx={m.x} cy={m.y} r={12} fill={COLORS.brownMedium} />
                      <path d={`M ${m.x - 6} ${m.y} L ${m.x - 2} ${m.y + 4} L ${m.x + 6} ${m.y - 5}`} stroke={COLORS.creamMain} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none" />
                    </>
                  )}
                  {m.status === "assigned" && (
                    <circle cx={m.x} cy={m.y} r={12} fill={COLORS.creamMain} stroke={COLORS.gold} strokeWidth={2} />
                  )}
                  {m.status === "pending" && (
                    <circle cx={m.x} cy={m.y} r={12} fill={COLORS.creamMain} stroke={COLORS.brownLight} strokeWidth={1.8} strokeDasharray="3,2" />
                  )}

                  {/* Invisible drag handle (larger area) */}
                  <circle
                    cx={m.x}
                    cy={m.y}
                    r={18}
                    fill="transparent"
                    style={{ cursor: isDragging ? "grabbing" : "grab" }}
                    onMouseDown={(e) => handleMouseDown(e, m.id)}
                  />

                  {/* Order number badge */}
                  <circle cx={m.x} cy={m.y - 22} r={8} fill={m.status === "completed" ? COLORS.brownMain : COLORS.creamMain} stroke={COLORS.gold} strokeWidth={0.8} strokeDasharray={m.status === "pending" ? "2,2" : "none"} />
                  <text x={m.x} y={m.y - 18} textAnchor="middle" style={{ fontFamily: FONTS.serif, fontSize: 10, fontWeight: 500, fill: m.status === "completed" ? COLORS.gold : COLORS.brownDark, opacity: m.status === "pending" ? 0.6 : 1 }}>
                    {String(m.order).padStart(2, "0")}
                  </text>

                  {/* Floating card below node */}
                  <foreignObject x={m.x - 65} y={m.y + 22} width={130} height={70} style={{ overflow: "visible", pointerEvents: "none" }}>
                    <div style={{ width: 130, minHeight: 38, borderRadius: 6, background: COLORS.creamMain, border: `0.6px ${m.status === "pending" ? "dashed" : "solid"} ${COLORS.gold}`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "4px 6px", boxShadow: "0 2px 8px rgba(93,64,55,0.06)", pointerEvents: "auto", userSelect: "none" }}>
                      {/* Treatment name */}
                      <div style={{ fontFamily: FONTS.serif, fontSize: 11, fontWeight: 500, color: COLORS.brownDark, textAlign: "center", lineHeight: 1.2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%" }}>
                        {m.name}
                      </div>
                      {/* Specialist - click to edit */}
                      <div style={{ marginTop: 2, width: "100%", position: "relative" }}>
                        {editingSpecialist === m.id ? (
                          <select
                            autoFocus
                            value={specialistNames[m.id] || ""}
                            onChange={(e) => selectSpecialist(m.id, e.target.value)}
                            onBlur={() => setEditingSpecialist(null)}
                            style={{
                              width: "100%", fontSize: 9, fontFamily: FONTS.sans,
                              border: `1px solid ${COLORS.gold}`, borderRadius: 3,
                              padding: "2px 3px", outline: "none", background: COLORS.creamSoft,
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
                            onClick={() => startEditSpecialist(m.id)}
                            style={{
                              width: "100%", fontSize: 9, fontFamily: FONTS.sans,
                              border: `1px solid ${COLORS.gold}`, borderRadius: 3,
                              padding: "3px 4px", background: specialistNames[m.id] ? "rgba(200,169,110,0.08)" : COLORS.creamSoft,
                              color: specialistNames[m.id] ? COLORS.brownDark : COLORS.brownLight,
                              cursor: "pointer", fontWeight: 500, textAlign: "center",
                              transition: "all 0.2s", display: "flex", alignItems: "center", justifyContent: "center", gap: 3,
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(200,169,110,0.15)"; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = specialistNames[m.id] ? "rgba(200,169,110,0.08)" : COLORS.creamSoft; }}
                          >
                            {specialistNames[m.id] ? (
                              <>
                                <div style={{ width: 12, height: 12, borderRadius: "50%", background: COLORS.brownMain, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                  <span style={{ fontSize: 6, fontWeight: 700, color: COLORS.gold }}>{specialistInitials}</span>
                                </div>
                                <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontSize: 9 }}>{specialistNames[m.id]}</span>
                              </>
                            ) : (
                              <span style={{ fontStyle: "italic", fontSize: 8 }}>Seleccionar</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </foreignObject>
                </g>
              );
            })}

            {/* ─── Empty state ─── */}
            {milestones.length === 0 && (
              <text x={svgWidth / 2} y={svgHeight / 2} textAnchor="middle" style={{ fontFamily: FONTS.sans, fontSize: 13, fill: COLORS.brownMain, opacity: 0.45, fontStyle: "italic" }}>
                Aún no hay sesiones agendadas
              </text>
            )}
          </svg>

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
