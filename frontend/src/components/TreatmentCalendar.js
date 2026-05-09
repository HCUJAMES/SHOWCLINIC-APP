import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";

const API = `${window.location.protocol}//${window.location.hostname}:4000`;

// ─── Paleta ShowClinic ───
const C = {
  gold: "#C8A96E",
  goldDark: "#a36920",
  brown: "#5D4037",
  cream: "#FFF8F0",
  white: "#FFFFFF",
  green: "#4caf50",
  greenDark: "#2e7d32",
  blue: "#42a5f5",
  purple: "#9c63cf",
  muted: "#8B7D6B",
  border: "#E8DFD0",
};

const WEEK_BG = ["#FFFDE7", "#E8F5E9", "#E3F2FD", "#F3E5F5", "#FFF3E0", "#FCE4EC", "#E0F2F1", "#FFF8E1"];
const WEEK_BORDER = ["#f9e68c", "#a5d6a7", "#90caf9", "#ce93d8", "#ffcc80", "#f48fb1", "#80cbc4", "#ffe082"];

const getInitials = (name) => {
  if (!name) return "";
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
};

// Catmull-Rom to Bezier conversion
const catmullRomToBezier = (points) => {
  if (points.length < 2) return "";
  const result = [];
  // Extend with virtual endpoints
  const pts = [points[0], ...points, points[points.length - 1]];
  for (let i = 1; i < pts.length - 2; i++) {
    const p0 = pts[i - 1], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2];
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    result.push(`C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`);
  }
  return `M ${points[0].x},${points[0].y} ` + result.join(" ");
};

const TreatmentCalendar = ({
  presupuesto,
  especialistas = [],
  onCompletarSesion,
  onDesmarcarSesion,
  especialistasPorSesion = {},
  setEspecialistasPorSesion,
}) => {
  const sesiones = presupuesto?.sesiones || [];
  const presupuestoId = presupuesto?.id;
  const [numWeeks, setNumWeeks] = useState(4);
  const [nodePositionsMap, setNodePositionsMap] = useState({});
  const [modalSesion, setModalSesion] = useState(null);
  const [draggingNode, setDraggingNode] = useState(null);
  const [connectMode, setConnectMode] = useState(false);
  const [connectionOrder, setConnectionOrder] = useState([]);
  const [editMode, setEditMode] = useState(false);
  const [layoutLoaded, setLayoutLoaded] = useState(false);
  const svgRef = useRef(null);
  const containerRef = useRef(null);
  const saveTimerRef = useRef(null);

  // Load layout from DB on mount
  useEffect(() => {
    if (!presupuestoId) return;
    const token = localStorage.getItem("token");
    fetch(`${API}/api/tratamientos/calendar-layout/${presupuestoId}`, {
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    })
      .then((r) => r.json())
      .then((data) => {
        if (data && data.nodePositions) {
          setNodePositionsMap(data.nodePositions);
          setConnectionOrder(data.connectionOrder || []);
          setNumWeeks(data.numWeeks || 4);
        }
        setLayoutLoaded(true);
      })
      .catch(() => setLayoutLoaded(true));
  }, [presupuestoId]);

  // Init positions for any sesiones not yet in the map (only after load attempt)
  useEffect(() => {
    if (!layoutLoaded) return;
    setNodePositionsMap((prev) => {
      const needsInit = sesiones.some((s) => !prev[s.id]);
      if (!needsInit) return prev;
      const merged = { ...prev };
      const spacing = (Math.max(800, numWeeks * 220) - 120) / Math.max(sesiones.length - 1, 1);
      sesiones.forEach((s, i) => {
        if (!merged[s.id]) {
          merged[s.id] = { x: 60 + i * spacing, y: 120 };
        }
      });
      return merged;
    });
  }, [sesiones, numWeeks, layoutLoaded]);

  // Init connection order from sesiones order if empty after load
  useEffect(() => {
    if (!layoutLoaded) return;
    if (connectionOrder.length === 0 && sesiones.length > 0) {
      setConnectionOrder(sesiones.map((s) => s.id));
    }
  }, [sesiones, layoutLoaded]);

  // Save layout to DB (debounced)
  const saveLayout = useCallback((positions, order, weeks) => {
    if (!presupuestoId) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      const token = localStorage.getItem("token");
      fetch(`${API}/api/tratamientos/calendar-layout/${presupuestoId}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ nodePositions: positions, connectionOrder: order, numWeeks: weeks }),
      }).catch((err) => console.error("Error guardando layout:", err));
    }, 500);
  }, [presupuestoId]);

  const completados = sesiones.filter((s) => s.estado === "completada").length;
  const totalSesiones = sesiones.length;
  const pct = totalSesiones > 0 ? Math.round((completados / totalSesiones) * 100) : 0;

  // SVG dimensions
  const SVG_W = Math.max(800, numWeeks * 220);
  const SVG_H = 280;
  const NODE_R = 13;

  // Compute node render positions from absolute map
  const nodePositions = useMemo(() => {
    return sesiones.map((s) => {
      const pos = nodePositionsMap[s.id] || { x: 60, y: 120 };
      return { x: pos.x, y: pos.y, sesion: s };
    });
  }, [sesiones, nodePositionsMap]);

  // Connected path positions (only nodes in connectionOrder)
  const connectedPositions = useMemo(() => {
    return connectionOrder
      .filter((id) => nodePositionsMap[id])
      .map((id) => ({ x: nodePositionsMap[id].x, y: nodePositionsMap[id].y }));
  }, [connectionOrder, nodePositionsMap]);

  // Week boundaries for background rects
  const weekBounds = useMemo(() => {
    const wWidth = SVG_W / numWeeks;
    return Array.from({ length: numWeeks }, (_, i) => ({
      x: i * wWidth,
      w: wWidth,
      bg: WEEK_BG[i % WEEK_BG.length],
      border: WEEK_BORDER[i % WEEK_BORDER.length],
    }));
  }, [numWeeks, SVG_W]);

  // Get node status & color
  const getStatus = (s) => {
    if (s.estado === "completada") return "done";
    const espKey = `presupuesto_${s.id}`;
    if (especialistasPorSesion[espKey]) return "active";
    return "pend";
  };

  const getNodeColor = (status) => {
    switch (status) {
      case "done": return C.green;
      case "active": return C.gold;
      default: return C.purple;
    }
  };

  // Convert screen coords to SVG viewBox coords
  const screenToSVG = useCallback((clientX, clientY) => {
    if (!svgRef.current) return { x: clientX, y: clientY };
    const rect = svgRef.current.getBoundingClientRect();
    const scaleX = SVG_W / rect.width;
    const scaleY = (SVG_H + 80) / rect.height;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  }, [SVG_W, SVG_H]);

  // Click handler for nodes
  const handleNodeClick = (sesion) => {
    if (connectMode) {
      // In connect mode: toggle node in connection order
      setConnectionOrder((prev) => {
        if (prev.includes(sesion.id)) {
          return prev.filter((id) => id !== sesion.id);
        }
        return [...prev, sesion.id];
      });
    } else {
      // Normal mode: open modal
      openModal(sesion);
    }
  };

  // Native drag handlers for nodes — truly free movement (only in edit mode)
  const handleMouseDown = (e, sesion) => {
    e.preventDefault();
    e.stopPropagation();

    // If not in edit mode and not in connect mode, just handle click
    if (!editMode && !connectMode) {
      openModal(sesion);
      return;
    }

    // In connect mode, just handle click for connection
    if (connectMode) {
      handleNodeClick(sesion);
      return;
    }

    // Edit mode: drag freely
    const startX = e.clientX;
    const startY = e.clientY;
    let totalDist = 0;

    setDraggingNode(sesion.id);

    const onMove = (me) => {
      const dx = me.clientX - startX;
      const dy = me.clientY - startY;
      totalDist = Math.sqrt(dx * dx + dy * dy);

      const svgPos = screenToSVG(me.clientX, me.clientY);
      const clampedX = Math.max(NODE_R, Math.min(SVG_W - NODE_R, svgPos.x));
      const clampedY = Math.max(NODE_R + 30, Math.min(SVG_H + 30, svgPos.y));

      setNodePositionsMap((prev) => ({
        ...prev,
        [sesion.id]: { x: clampedX, y: clampedY },
      }));
    };

    const onUp = () => {
      setDraggingNode(null);
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      // Save after drag
      if (totalDist >= 5) {
        setNodePositionsMap((latest) => {
          saveLayout(latest, connectionOrder, numWeeks);
          return latest;
        });
      } else {
        openModal(sesion);
      }
    };

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };

  // Build curve path from connection order
  const curvePath = useMemo(() => {
    if (connectedPositions.length < 2) return "";
    return catmullRomToBezier(connectedPositions);
  }, [connectedPositions]);

  // Fill area path
  const fillPath = useMemo(() => {
    if (!curvePath || connectedPositions.length < 2) return "";
    const last = connectedPositions[connectedPositions.length - 1];
    const first = connectedPositions[0];
    return `${curvePath} L ${last.x},${SVG_H} L ${first.x},${SVG_H} Z`;
  }, [curvePath, connectedPositions, SVG_H]);

  const addWeek = () => {
    setNumWeeks((p) => {
      const nw = p + 1;
      saveLayout(nodePositionsMap, connectionOrder, nw);
      return nw;
    });
  };
  const removeWeek = () => {
    if (numWeeks <= 1) return;
    setNumWeeks((p) => {
      const nw = p - 1;
      saveLayout(nodePositionsMap, connectionOrder, nw);
      return nw;
    });
  };

  const toggleConnectMode = () => {
    if (connectMode) {
      // Exiting connect mode — save connections
      setConnectMode(false);
      saveLayout(nodePositionsMap, connectionOrder, numWeeks);
    } else {
      // Entering connect mode — clear previous order so user clicks fresh
      setConnectionOrder([]);
      setConnectMode(true);
    }
  };

  const toggleEditMode = () => {
    if (editMode) {
      // Exiting edit mode — save all positions
      saveLayout(nodePositionsMap, connectionOrder, numWeeks);
    }
    setEditMode((p) => !p);
  };

  // Modal handlers
  const openModal = (sesion) => setModalSesion(sesion);
  const closeModal = () => setModalSesion(null);

  const handleSetEsp = (sesionId, espId) => {
    if (setEspecialistasPorSesion) {
      setEspecialistasPorSesion((prev) => ({ ...prev, [`presupuesto_${sesionId}`]: espId }));
    }
  };

  const handleComplete = (sesionId) => {
    if (onCompletarSesion) onCompletarSesion(sesionId);
    closeModal();
  };

  const handleUnmark = (sesionId) => {
    if (onDesmarcarSesion) onDesmarcarSesion(sesionId);
    closeModal();
  };

  return (
    <div style={{ marginBottom: 24, background: C.cream, border: `1px solid ${C.border}`, borderRadius: 14, overflow: "hidden", boxShadow: "0 2px 12px rgba(163,105,32,0.08)" }} ref={containerRef}>
      {/* Header */}
      <div style={{ padding: "18px 24px 14px", borderBottom: `2px solid ${C.border}`, background: "linear-gradient(135deg, #FFF8F0 0%, #f5f1e4 100%)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: C.gold }} />
              <span style={{ fontWeight: 800, fontSize: 13, color: C.brown, textTransform: "uppercase", letterSpacing: 1.5 }}>
                SEGUIMIENTO DEL TRATAMIENTO
              </span>
            </div>
            <span style={{ fontSize: 12, color: C.muted, fontWeight: 500 }}>
              Presupuesto #{presupuesto.oferta_id || presupuesto.id} · {completados}/{totalSesiones} sesiones
            </span>
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <button onClick={toggleEditMode} style={{ background: editMode ? "#e65100" : "transparent", color: editMode ? "#fff" : C.muted, border: `1px solid ${editMode ? "#e65100" : C.border}`, borderRadius: 8, padding: "6px 12px", fontWeight: 600, fontSize: 11, cursor: "pointer", transition: "all 0.2s" }}>
              {editMode ? "✓ Guardar" : "✏ Editar"}
            </button>
            {editMode && (
              <button onClick={toggleConnectMode} style={{ background: connectMode ? C.gold : "transparent", color: connectMode ? "#fff" : C.muted, border: `1px solid ${connectMode ? C.gold : C.border}`, borderRadius: 8, padding: "6px 12px", fontWeight: 600, fontSize: 11, cursor: "pointer", transition: "all 0.2s" }}>
                {connectMode ? "✓ Listo" : "⟡ Conectar"}
              </button>
            )}
            {editMode && (
              <>
                <button onClick={addWeek} style={{ background: C.gold, color: "#fff", border: "none", borderRadius: 8, padding: "6px 14px", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>+ Semana</button>
                <button onClick={removeWeek} disabled={numWeeks <= 1} style={{ background: "transparent", color: C.muted, border: `1px solid ${C.border}`, borderRadius: 8, padding: "6px 12px", fontWeight: 600, fontSize: 12, cursor: "pointer", opacity: numWeeks <= 1 ? 0.4 : 1 }}>Quitar</button>
              </>
            )}
          </div>
        </div>
        {/* Progress */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10 }}>
          <div style={{ flex: 1, height: 5, background: "rgba(232,223,208,0.5)", borderRadius: 3, overflow: "hidden", border: `1px solid ${C.border}` }}>
            <div style={{ height: "100%", width: `${pct}%`, background: `linear-gradient(90deg, ${C.gold} 0%, ${C.green} 100%)`, borderRadius: 3, transition: "width 0.4s ease" }} />
          </div>
          <span style={{ fontSize: 12, fontWeight: 700, color: pct === 100 ? C.green : C.gold }}>{pct}%</span>
        </div>
      </div>

      {/* Connect mode instructions */}
      {connectMode && (
        <div style={{ padding: "8px 24px", background: "rgba(200,169,110,0.08)", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 14 }}>⟡</span>
          <span style={{ fontSize: 11, color: C.gold, fontWeight: 600 }}>Haz clic en los nodos en el orden que deseas conectarlos. Clic de nuevo para quitar. Presiona "✓ Listo" al terminar.</span>
        </div>
      )}

      {/* SVG Timeline */}
      <div style={{ overflowX: "auto", padding: "0" }}>
        <svg ref={svgRef} viewBox={`0 0 ${SVG_W} ${SVG_H + 80}`} preserveAspectRatio="xMidYMid meet" style={{ display: "block", width: "100%", height: "auto", minHeight: 280 }}>
          <defs>
            <linearGradient id="curveGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={C.gold} />
              <stop offset="100%" stopColor={C.purple} />
            </linearGradient>
            <linearGradient id="fillGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor={C.gold} stopOpacity="0.12" />
              <stop offset="100%" stopColor={C.purple} stopOpacity="0.03" />
            </linearGradient>
          </defs>

          {/* Week background sections */}
          {weekBounds.map((wb, i) => (
            <g key={`wbg-${i}`}>
              <rect x={wb.x} y={0} width={wb.w} height={SVG_H + 80} fill={wb.bg} opacity={0.5} />
              {i > 0 && <line x1={wb.x} y1={0} x2={wb.x} y2={SVG_H + 80} stroke={wb.border} strokeWidth={1} strokeDasharray="4,4" opacity={0.6} />}
              <text x={wb.x + wb.w / 2} y={20} textAnchor="middle" fontSize={10} fontWeight={700} fill={C.muted} letterSpacing={1}>
                SEMANA {String(i + 1).padStart(2, "0")}
              </text>
            </g>
          ))}

          {/* Fill under curve — only when has connections */}
          {!connectMode && connectionOrder.length >= 2 && fillPath && <path d={fillPath} fill="url(#fillGrad)" />}

          {/* Curve line — only when has connections */}
          {!connectMode && connectionOrder.length >= 2 && curvePath && <path d={curvePath} fill="none" stroke="url(#curveGrad)" strokeWidth={3} strokeLinecap="round" />}

          {/* Show connection order lines while in connect mode */}
          {connectMode && connectedPositions.length > 1 && connectedPositions.map((p, i) => {
            if (i === 0) return null;
            const prev = connectedPositions[i - 1];
            return <line key={`cline-${i}`} x1={prev.x} y1={prev.y} x2={p.x} y2={p.y} stroke={C.gold} strokeWidth={2} strokeDasharray="6,4" opacity={0.7} />;
          })}

          {/* Connection order numbers in connect mode */}
          {connectMode && connectionOrder.map((id, idx) => {
            const pos = nodePositionsMap[id];
            if (!pos) return null;
            return (
              <text key={`cnum-${id}`} x={pos.x} y={pos.y - NODE_R - 6} textAnchor="middle" fontSize={10} fontWeight={800} fill={C.gold}>
                {idx + 1}
              </text>
            );
          })}

          {/* Nodes */}
          {nodePositions.map((np, idx) => {
            const s = np.sesion;
            const status = getStatus(s);
            const color = getNodeColor(status);
            const isDone = status === "done";
            const isDrag = draggingNode === s.id;
            const espKey = `presupuesto_${s.id}`;
            const espId = especialistasPorSesion[espKey];
            const esp = especialistas.find((e) => e.id === espId);
            const completedEsp = especialistas.find((e) => e.id === s.especialista_id);
            const displayEsp = isDone ? completedEsp : esp;

            return (
              <g key={s.id} style={{ cursor: isDone ? "pointer" : "grab" }}>
                {/* Node circle */}
                <circle
                  cx={np.x} cy={np.y} r={NODE_R}
                  fill={isDone ? color : C.white}
                  stroke={connectMode && connectionOrder.includes(s.id) ? C.gold : color}
                  strokeWidth={connectMode && connectionOrder.includes(s.id) ? 3.5 : (isDone ? 0 : 2.5)}
                  style={{ filter: isDrag ? "drop-shadow(0 3px 8px rgba(0,0,0,0.2))" : "drop-shadow(0 1px 3px rgba(0,0,0,0.1))", transition: "all 0.15s", cursor: connectMode ? "crosshair" : editMode ? "grab" : "pointer" }}
                  onMouseDown={(e) => handleMouseDown(e, s)}
                />
                {/* Check icon for done */}
                {isDone && (
                  <text x={np.x} y={np.y + 4} textAnchor="middle" fontSize={12} fill="#fff" fontWeight={700} style={{ pointerEvents: "none" }}>✓</text>
                )}
                {/* Treatment name below */}
                <text x={np.x} y={np.y + NODE_R + 14} textAnchor="middle" fontSize={9.5} fontWeight={600} fill={C.brown} style={{ pointerEvents: "none" }}>
                  {(s.tratamiento_nombre || "").length > 14 ? (s.tratamiento_nombre || "").slice(0, 13) + "…" : (s.tratamiento_nombre || "Trat.")}
                </text>
                {/* Specialist chip */}
                <foreignObject x={np.x - 50} y={np.y + NODE_R + 20} width={100} height={28}>
                  <div style={{ display: "flex", justifyContent: "center" }}>
                    <div
                      onClick={(e) => { e.stopPropagation(); openModal(s); }}
                      style={{
                        display: "inline-flex", alignItems: "center", gap: 3,
                        background: displayEsp ? "rgba(200,169,110,0.12)" : "rgba(0,0,0,0.04)",
                        border: `1px solid ${displayEsp ? C.gold : "rgba(0,0,0,0.08)"}`,
                        borderRadius: 10, padding: "2px 8px 2px 3px", cursor: "pointer",
                        maxWidth: 95, overflow: "hidden",
                      }}
                    >
                      <div style={{
                        width: 16, height: 16, borderRadius: "50%",
                        background: displayEsp ? C.gold : "#ddd",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 7, fontWeight: 800, color: "#fff", flexShrink: 0,
                      }}>
                        {displayEsp ? getInitials(displayEsp.nombre) : "+"}
                      </div>
                      <span style={{ fontSize: 8.5, fontWeight: 600, color: displayEsp ? C.brown : C.muted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {displayEsp ? displayEsp.nombre : "Especialista"}
                      </span>
                    </div>
                  </div>
                </foreignObject>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Legend */}
      <div style={{ display: "flex", justifyContent: "center", gap: 20, padding: "10px 16px", borderTop: `1px solid ${C.border}`, background: "rgba(250,246,237,0.6)" }}>
        {[
          { color: C.green, label: "Completado", fill: true },
          { color: C.gold, label: "Asignado", fill: false },
          { color: C.purple, label: "Pendiente", fill: false },
        ].map((l) => (
          <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: l.fill ? l.color : C.white, border: `2px solid ${l.color}` }} />
            <span style={{ fontSize: 11, color: C.brown, fontWeight: 500 }}>{l.label}</span>
          </div>
        ))}
      </div>

      {/* Modal overlay */}
      {modalSesion && (
        <div
          onClick={closeModal}
          style={{
            position: "fixed", inset: 0, zIndex: 9999,
            background: "rgba(93,64,55,0.3)", backdropFilter: "blur(4px)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: C.white, borderRadius: 16, padding: 24,
              width: "90%", maxWidth: 380, boxShadow: "0 12px 40px rgba(0,0,0,0.15)",
            }}
          >
            {/* Modal header */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontWeight: 800, fontSize: 16, color: C.brown }}>{modalSesion.tratamiento_nombre}</div>
              <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>Sesión {modalSesion.sesion_numero || 1}</div>
            </div>

            {/* Status indicator */}
            {modalSesion.estado === "completada" ? (
              <div style={{ background: "#e8f5e9", border: "1px solid rgba(76,175,80,0.3)", borderRadius: 10, padding: "10px 14px", marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 16 }}>✓</span>
                <span style={{ fontWeight: 700, color: C.greenDark, fontSize: 13 }}>Completado</span>
              </div>
            ) : (
              <div style={{ background: "rgba(200,169,110,0.08)", border: `1px solid ${C.gold}30`, borderRadius: 10, padding: "8px 14px", marginBottom: 14 }}>
                <span style={{ fontSize: 12, color: C.gold, fontWeight: 600 }}>
                  {especialistasPorSesion[`presupuesto_${modalSesion.id}`] ? "Especialista asignado" : "Selecciona un especialista"}
                </span>
              </div>
            )}

            {/* Specialist grid */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>Especialistas</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: 8 }}>
                {especialistas.map((esp) => {
                  const isSelected = especialistasPorSesion[`presupuesto_${modalSesion.id}`] === esp.id;
                  const isDoneEsp = modalSesion.estado === "completada" && modalSesion.especialista_id === esp.id;
                  return (
                    <div
                      key={esp.id}
                      onClick={() => { if (modalSesion.estado !== "completada") handleSetEsp(modalSesion.id, esp.id); }}
                      style={{
                        display: "flex", alignItems: "center", gap: 8,
                        padding: "8px 10px", borderRadius: 10, cursor: modalSesion.estado === "completada" ? "default" : "pointer",
                        background: isSelected || isDoneEsp ? "rgba(200,169,110,0.15)" : "rgba(0,0,0,0.02)",
                        border: `2px solid ${isSelected || isDoneEsp ? C.gold : "transparent"}`,
                        transition: "all 0.15s",
                      }}
                    >
                      <div style={{
                        width: 28, height: 28, borderRadius: "50%",
                        background: isSelected || isDoneEsp ? C.gold : "#e8e4dc",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 10, fontWeight: 800, color: isSelected || isDoneEsp ? "#fff" : C.muted, flexShrink: 0,
                      }}>
                        {getInitials(esp.nombre)}
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 600, color: C.brown, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {esp.nombre}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: "flex", gap: 8 }}>
              {modalSesion.estado !== "completada" && (
                <button
                  onClick={() => handleComplete(modalSesion.id)}
                  disabled={!especialistasPorSesion[`presupuesto_${modalSesion.id}`]}
                  style={{
                    flex: 1, padding: "10px 0", border: "none", borderRadius: 10,
                    background: especialistasPorSesion[`presupuesto_${modalSesion.id}`] ? C.green : "#e0e0e0",
                    color: "#fff", fontWeight: 700, fontSize: 12, cursor: especialistasPorSesion[`presupuesto_${modalSesion.id}`] ? "pointer" : "not-allowed",
                  }}
                >
                  Marcar Completado ✓
                </button>
              )}
              {modalSesion.estado === "completada" && (
                <button
                  onClick={() => handleUnmark(modalSesion.id)}
                  style={{ flex: 1, padding: "10px 0", border: `1px solid ${C.border}`, borderRadius: 10, background: "transparent", color: C.muted, fontWeight: 600, fontSize: 12, cursor: "pointer" }}
                >
                  Desmarcar completado
                </button>
              )}
              <button onClick={closeModal} style={{ padding: "10px 16px", border: `1px solid ${C.border}`, borderRadius: 10, background: "transparent", color: C.muted, fontWeight: 600, fontSize: 12, cursor: "pointer" }}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TreatmentCalendar;
