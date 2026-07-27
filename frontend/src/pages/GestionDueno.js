import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Box, Typography, Card, CardContent, Grid,
  Button, Chip, Avatar, Divider, IconButton,
  Dialog, DialogTitle, DialogContent, DialogActions,
  Table, TableBody, TableCell, TableHead, TableRow,
  LinearProgress, Select, MenuItem, FormControl,
  InputLabel, Collapse, Alert, Tooltip
} from "@mui/material";
import {
  TrendingUp, TrendingDown, People, AttachMoney,
  CheckCircle, ExpandMore, ExpandLess,
  ArrowBack, Refresh, FilterList,
  OpenInNew, VerifiedUser, Warning, SpaceDashboardRounded,
  ReceiptLongRounded, GroupsRounded, PaymentsRounded,
  LogoutRounded, HomeRounded, InsightsRounded,
  FlagRounded, EditRounded, TuneRounded,
  PercentRounded, PaidRounded, CategoryRounded
} from "@mui/icons-material";

const MotionCard = motion(Card);
const MotionBox = motion(Box);

const API = "/api/gestion-dueno";

function getToken() {
  const t = localStorage.getItem("token");
  return t ? `Bearer ${t}` : "";
}

async function apiFetch(path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    headers: {
      "Content-Type": "application/json",
      Authorization: getToken(),
      ...options.headers
    },
    ...options
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: "Error desconocido" }));
    throw new Error(err.message || `HTTP ${res.status}`);
  }
  return res.json();
}

// Design System ShowClinic — valores EXACTOS
const colors = {
  primary: "#5D4037",
  primaryDark: "#3E2A24",
  gold: "#C8A96E",
  goldSoft: "#E4D4B4",
  cream: "#FFF8F0",
  creamPanel: "#FBF3E9",
  border: "#EADFCF",
  white: "#FFFFFF",
  hover: "#4E342E",
  textBody: "#4A3B33",
  textMuted: "#9A8778",
  successText: "#5B8A6E",
  successBg: "#E8F0EA",
  successBorder: "#CDE0D3",
  amberText: "#C08A3E",
  amberBg: "#F7EEDC",
  error: "#d32f2f",
  // sidebar
  sideBg: "#3E2A24",
  sideBgDeep: "#2C1D18",
  sideActive: "rgba(200,169,110,0.18)",
  sideText: "#E9DDD0",
  sideMuted: "#A88F7E"
};

// gradientes premium (para íconos KPI y detalles)
const grads = {
  gold: "linear-gradient(135deg, #D9BE86 0%, #B98F4E 100%)",
  brown: "linear-gradient(135deg, #7A5140 0%, #4E342E 100%)",
  green: "linear-gradient(135deg, #7FB49A 0%, #4F8069 100%)",
  amber: "linear-gradient(135deg, #E6BE7C 0%, #C08A3E 100%)",
  violet: "linear-gradient(135deg, #A88BC4 0%, #6E4E92 100%)"
};

// paleta para segmentos de gráficos (tonos de marca)
const chartPalette = ["#8B5E3C", "#C8A96E", "#A67C52", "#D9C29A", "#6B4226", "#E4D4B4", "#B98F4E"];

const fonts = {
  title: "'Cormorant Garamond', serif",
  body: "'DM Sans', sans-serif"
};

const cardSx = {
  bgcolor: colors.white,
  border: `1px solid ${colors.border}`,
  borderRadius: "18px",
  boxShadow: "0 2px 10px rgba(93,64,55,0.06)"
};

// variantes de animación reutilizables
const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  show: (i = 0) => ({ opacity: 1, y: 0, transition: { duration: 0.45, delay: i * 0.06, ease: [0.22, 1, 0.36, 1] } })
};

function formatMoney(val) {
  return `S/ ${(Number(val) || 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function isoDate(d) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

// Devuelve {fechaInicio, fechaFin} para un preset dado
function rangoPreset(preset) {
  const hoy = new Date();
  if (preset === "hoy") {
    const s = isoDate(hoy);
    return { fechaInicio: s, fechaFin: s };
  }
  if (preset === "semana") {
    const primer = new Date(hoy); primer.setDate(hoy.getDate() - hoy.getDay());
    const ultimo = new Date(primer); ultimo.setDate(primer.getDate() + 6);
    return { fechaInicio: isoDate(primer), fechaFin: isoDate(ultimo) };
  }
  if (preset === "mes") {
    return { fechaInicio: isoDate(new Date(hoy.getFullYear(), hoy.getMonth(), 1)), fechaFin: isoDate(new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0)) };
  }
  if (preset === "anio") {
    return { fechaInicio: isoDate(new Date(hoy.getFullYear(), 0, 1)), fechaFin: isoDate(new Date(hoy.getFullYear(), 11, 31)) };
  }
  return { fechaInicio: "", fechaFin: "" }; // todo
}

function buildDateQuery(fi, ff) {
  const p = new URLSearchParams();
  if (fi) p.append("fecha_inicio", fi);
  if (ff) p.append("fecha_fin", ff);
  const s = p.toString();
  return s ? `?${s}` : "";
}

/* ======================================================================
   COMPONENTE PRINCIPAL
====================================================================== */
export default function GestionDueno() {
  const navigate = useNavigate();
  const [tab, setTab] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Dashboard
  const [dashboardData, setDashboardData] = useState(null);

  // Filtro de periodo (compartido: dashboard + presupuestos)
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");
  const [periodoPreset, setPeriodoPreset] = useState("todo");

  // Presupuestos
  const [presupuestos, setPresupuestos] = useState([]);
  const [filtroEstado, setFiltroEstado] = useState("");
  const [presupuestoDetalle, setPresupuestoDetalle] = useState(null);

  // Especialistas
  const [especialistas, setEspecialistas] = useState([]);
  const [especialistaDetalle, setEspecialistaDetalle] = useState(null);

  // Liquidaciones
  const [pendientes, setPendientes] = useState([]);
  const [historialLiq, setHistorialLiq] = useState([]);

  // Dialogs
  const [dialogCulminar, setDialogCulminar] = useState(null);
  const [dialogLiquidar, setDialogLiquidar] = useState(null);

  /* ── CARGA DE DATOS ── */
  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch(`/dashboard${buildDateQuery(fechaInicio, fechaFin)}`);
      setDashboardData(data);
    } catch (e) { setError(e.message); }
    setLoading(false);
  }, [fechaInicio, fechaFin]);

  const loadPresupuestos = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const p = new URLSearchParams();
      if (filtroEstado) p.append("estado", filtroEstado);
      if (fechaInicio) p.append("fecha_inicio", fechaInicio);
      if (fechaFin) p.append("fecha_fin", fechaFin);
      const qs = p.toString();
      const data = await apiFetch(`/presupuestos${qs ? `?${qs}` : ""}`);
      setPresupuestos(data);
    } catch (e) { setError(e.message); }
    setLoading(false);
  }, [filtroEstado, fechaInicio, fechaFin]);

  const loadEspecialistas = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch(`/especialistas${buildDateQuery(fechaInicio, fechaFin)}`);
      setEspecialistas(data);
    } catch (e) { setError(e.message); }
    setLoading(false);
  }, [fechaInicio, fechaFin]);

  const loadPendientes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch("/liquidaciones/pendientes");
      setPendientes(data);
      const hist = await apiFetch("/liquidaciones/historial");
      setHistorialLiq(hist);
    } catch (e) { setError(e.message); }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (tab === 0) loadDashboard();
    else if (tab === 1) loadPresupuestos();
    else if (tab === 2) loadEspecialistas();
    else if (tab === 3) loadPendientes();
  }, [tab, loadDashboard, loadPresupuestos, loadEspecialistas, loadPendientes]);

  // Recargar el detalle del especialista al cambiar el periodo
  useEffect(() => {
    if (tab === 2 && especialistaDetalle) {
      loadEspecialistaDetalle(especialistaDetalle.especialista.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fechaInicio, fechaFin]);

  /* ── ACCIONES ── */
  const handleCulminar = async (lineaId) => {
    try {
      await apiFetch(`/lineas/${lineaId}/culminar`, { method: "POST" });
      setDialogCulminar(null);
      if (presupuestoDetalle) loadPresupuestoDetalle(presupuestoDetalle.presupuesto.id);
      if (tab === 2 && especialistaDetalle) loadEspecialistaDetalle(especialistaDetalle.especialista.id);
    } catch (e) { setError(e.message); }
  };

  const handleRevertir = async (lineaId) => {
    try {
      await apiFetch(`/lineas/${lineaId}/revertir`, { method: "POST" });
      if (presupuestoDetalle) loadPresupuestoDetalle(presupuestoDetalle.presupuesto.id);
    } catch (e) { setError(e.message); }
  };

  const handleLiquidar = async (especialistaId, comisionIds, metodo) => {
    try {
      await apiFetch("/liquidaciones/ejecutar", {
        method: "POST",
        body: JSON.stringify({ especialista_id: especialistaId, comision_ids: comisionIds, metodo_pago: metodo })
      });
      setDialogLiquidar(null);
      loadPendientes();
    } catch (e) { setError(e.message); }
  };

  const handleSaveMeta = async (monto) => {
    try {
      await apiFetch("/meta", { method: "PUT", body: JSON.stringify({ meta_mensual: monto }) });
      loadDashboard();
    } catch (e) { setError(e.message); }
  };

  const loadPresupuestoDetalle = async (id) => {
    try {
      const data = await apiFetch(`/presupuestos/${id}`);
      setPresupuestoDetalle(data);
    } catch (e) { setError(e.message); }
  };

  const loadEspecialistaDetalle = async (id) => {
    try {
      const data = await apiFetch(`/especialistas/${id}/perfil${buildDateQuery(fechaInicio, fechaFin)}`);
      setEspecialistaDetalle(data);
    } catch (e) { setError(e.message); }
  };

  const handleSync = async () => {
    try {
      await apiFetch("/lineas/sync", { method: "POST" });
      loadPresupuestos();
    } catch (e) { setError(e.message); }
  };

  const handleEditComision = async (lineaId, payload) => {
    await apiFetch(`/lineas/${lineaId}/comision`, { method: "PUT", body: JSON.stringify(payload) });
    if (presupuestoDetalle) loadPresupuestoDetalle(presupuestoDetalle.presupuesto.id);
    if (especialistaDetalle) loadEspecialistaDetalle(especialistaDetalle.especialista.id);
  };

  // % de comisión por defecto del especialista
  const handleEditEspecialistaComision = async (espId, pct) => {
    await apiFetch(`/especialistas/${espId}/comision`, { method: "PUT", body: JSON.stringify({ comision_porcentaje: pct }) });
    loadEspecialistas();
    if (especialistaDetalle) loadEspecialistaDetalle(especialistaDetalle.especialista.id);
  };

  // % de comisión de un presupuesto (override). pct = null vuelve al % del especialista.
  const handleEditPresupuestoComision = async (presId, pct) => {
    await apiFetch(`/presupuestos/${presId}/comision`, { method: "PUT", body: JSON.stringify({ comision_porcentaje: pct }) });
    if (especialistaDetalle) loadEspecialistaDetalle(especialistaDetalle.especialista.id);
  };

  /* ── HELPERS DE UI ── */
  const username = localStorage.getItem("username") || "Dueño";
  const rol = (localStorage.getItem("role") || "").toLowerCase();
  const rolLabel = rol === "master" ? "Administrador" : rol === "doctor" ? "Doctor" : "Dueño";

  const handleTabChange = (v) => {
    setTab(v);
    setPresupuestoDetalle(null);
    setEspecialistaDetalle(null);
  };

  const reloadCurrent = () => {
    if (tab === 0) loadDashboard();
    else if (tab === 1) loadPresupuestos();
    else if (tab === 2) loadEspecialistas();
    else if (tab === 3) loadPendientes();
  };

  const applyPreset = (preset) => {
    const r = rangoPreset(preset);
    setPeriodoPreset(preset);
    setFechaInicio(r.fechaInicio);
    setFechaFin(r.fechaFin);
  };

  const applyCustomRange = (fi, ff) => {
    setPeriodoPreset("custom");
    setFechaInicio(fi);
    setFechaFin(ff);
  };

  const navMeta = [
    { title: "Dashboard", subtitle: "Resumen general de tu clínica." },
    { title: "Presupuestos", subtitle: "Seguimiento de tratamientos y líneas." },
    { title: "Especialistas", subtitle: "Rendimiento y comisiones del equipo." },
    { title: "Liquidaciones", subtitle: "Pagos y comisiones pendientes." }
  ];

  /* ── RENDER ── */
  return (
    <Box sx={{ display: "flex", minHeight: "100vh", bgcolor: colors.cream, fontFamily: fonts.body, color: colors.textBody }}>
      <SideBar tab={tab} onTab={handleTabChange} navigate={navigate} />

      <Box sx={{ flex: 1, minWidth: 0, ml: { xs: "76px", md: "264px" } }}>
        {/* Top header */}
        <Box sx={{
          position: "sticky", top: 0, zIndex: 5,
          px: { xs: 2, md: "36px" }, py: "18px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          bgcolor: "rgba(255,248,240,0.85)", backdropFilter: "blur(10px)",
          borderBottom: `1px solid ${colors.border}`
        }}>
          <Box>
            <Typography sx={{ fontFamily: fonts.title, fontWeight: 700, fontSize: { xs: "24px", md: "30px" }, color: colors.primaryDark, lineHeight: 1.1 }}>
              {tab === 0 ? `¡Bienvenido, ${username}!` : navMeta[tab].title}
            </Typography>
            <Typography sx={{ fontSize: "13.5px", color: colors.textMuted, fontFamily: fonts.body, mt: "2px" }}>
              {navMeta[tab].subtitle}
            </Typography>
          </Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <Tooltip title="Actualizar datos">
              <IconButton onClick={reloadCurrent} sx={{ bgcolor: colors.white, border: `1px solid ${colors.border}`, borderRadius: "12px", width: 42, height: 42, color: colors.primary, "&:hover": { bgcolor: colors.creamPanel } }}>
                <Refresh sx={{ fontSize: 20 }} />
              </IconButton>
            </Tooltip>
            <Box sx={{ display: "flex", alignItems: "center", gap: "10px", bgcolor: colors.white, border: `1px solid ${colors.border}`, borderRadius: "40px", pl: "6px", pr: { xs: "6px", sm: "16px" }, py: "5px" }}>
              <Avatar sx={{ width: 34, height: 34, background: grads.brown, fontFamily: fonts.title, fontWeight: 700, fontSize: 16 }}>
                {username.charAt(0).toUpperCase()}
              </Avatar>
              <Box sx={{ display: { xs: "none", sm: "block" }, lineHeight: 1.1 }}>
                <Typography sx={{ fontSize: "13px", fontWeight: 700, color: colors.primaryDark, fontFamily: fonts.body }}>{username}</Typography>
                <Typography sx={{ fontSize: "11px", color: colors.textMuted, fontFamily: fonts.body }}>{rolLabel}</Typography>
              </Box>
            </Box>
          </Box>
        </Box>

        {/* Content */}
        <Box sx={{ px: { xs: 2, md: "36px" }, py: { xs: 2, md: "28px" }, maxWidth: 1440, mx: "auto" }}>
          {error && <Alert severity="error" onClose={() => setError(null)} sx={{ mb: "18px", borderRadius: "12px" }}>{error}</Alert>}

          {/* Filtro de periodo (Dashboard, Presupuestos y Especialistas) */}
          {(tab === 0 || (tab === 1 && !presupuestoDetalle) || tab === 2) && (
            <PeriodoFilter
              preset={periodoPreset}
              fechaInicio={fechaInicio}
              fechaFin={fechaFin}
              onPreset={applyPreset}
              onCustom={applyCustomRange}
            />
          )}

          {loading && <LinearProgress sx={{ mb: "18px", borderRadius: 2, bgcolor: colors.border, "& .MuiLinearProgress-bar": { bgcolor: colors.gold } }} />}

          {/* TAB 0: Dashboard */}
          {tab === 0 && dashboardData && <DashboardView data={dashboardData} onSaveMeta={handleSaveMeta} />}

          {/* TAB 1: Presupuestos */}
          {tab === 1 && (
            <PresupuestosView
              presupuestos={presupuestos}
              filtroEstado={filtroEstado}
              setFiltroEstado={setFiltroEstado}
              onLoadPresupuestos={loadPresupuestos}
              onSync={handleSync}
              onSelectPresupuesto={loadPresupuestoDetalle}
              detalle={presupuestoDetalle}
              onBack={() => setPresupuestoDetalle(null)}
              onCulminar={(linea) => setDialogCulminar(linea)}
              onRevertir={handleRevertir}
              onEditComision={handleEditComision}
              navigate={navigate}
            />
          )}

          {/* TAB 2: Especialistas */}
          {tab === 2 && (
            <EspecialistasView
              especialistas={especialistas}
              detalle={especialistaDetalle}
              onSelect={loadEspecialistaDetalle}
              onBack={() => setEspecialistaDetalle(null)}
              onReloadEspecialistas={loadEspecialistas}
              onEditEspecialistaComision={handleEditEspecialistaComision}
              onEditPresupuestoComision={handleEditPresupuestoComision}
              fechaInicio={fechaInicio}
              fechaFin={fechaFin}
            />
          )}

          {/* TAB 3: Liquidaciones */}
          {tab === 3 && (
            <LiquidacionesView
              pendientes={pendientes}
              historial={historialLiq}
              onLiquidar={(esp) => setDialogLiquidar(esp)}
            />
          )}
        </Box>
      </Box>

      {/* Dialog Culminar */}
      <Dialog open={!!dialogCulminar} onClose={() => setDialogCulminar(null)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: "16px" } }}>
        <DialogTitle sx={{ fontFamily: fonts.title, fontWeight: 700, color: colors.primaryDark, fontSize: "22px" }}>
          Confirmar Culminación
        </DialogTitle>
        <DialogContent>
          {dialogCulminar && (
            <Box sx={{ fontFamily: fonts.body }}>
              <Typography variant="body1" sx={{ mb: 1, color: colors.textBody }}>
                <strong>Tratamiento:</strong> {dialogCulminar.tratamiento_nombre}
              </Typography>
              <Typography variant="body1" sx={{ mb: 1, color: colors.textBody }}>
                <strong>Sesiones:</strong> {dialogCulminar.sesiones_realizadas}/{dialogCulminar.sesiones_totales}
              </Typography>
              <Typography variant="body1" sx={{ mb: 1, color: colors.textBody }}>
                <strong>Precio:</strong> {formatMoney(dialogCulminar.precio)}
              </Typography>
              <Typography variant="body1" sx={{ mb: 1, color: colors.textBody }}>
                <strong>Comisión ({dialogCulminar.comision_porcentaje || 20}%):</strong>{" "}
                {formatMoney(dialogCulminar.precio * ((dialogCulminar.comision_porcentaje || 20) / 100))}
              </Typography>
              <Alert severity="warning" sx={{ mt: 2, borderRadius: "12px", bgcolor: colors.amberBg, color: colors.amberText, "& .MuiAlert-icon": { color: colors.amberText } }}>
                Al culminar, se generará un registro de comisión pendiente para el especialista.
                Esta acción puede revertirse mientras la comisión no haya sido liquidada.
              </Alert>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDialogCulminar(null)} sx={{ color: colors.textMuted, fontFamily: fonts.body }}>Cancelar</Button>
          <Button
            variant="contained"
            sx={{ bgcolor: colors.successText, "&:hover": { bgcolor: "#4a7a5e" }, fontFamily: fonts.body, borderRadius: "10px", textTransform: "none" }}
            onClick={() => handleCulminar(dialogCulminar.id)}
          >
            Confirmar Culminación
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog Liquidar */}
      <LiquidarDialog
        open={!!dialogLiquidar}
        espData={dialogLiquidar}
        onClose={() => setDialogLiquidar(null)}
        onConfirm={handleLiquidar}
      />
    </Box>
  );
}

/* ======================================================================
   SIDEBAR
====================================================================== */
function SideBar({ tab, onTab, navigate }) {
  const items = [
    { icon: SpaceDashboardRounded, label: "Dashboard" },
    { icon: ReceiptLongRounded, label: "Presupuestos" },
    { icon: GroupsRounded, label: "Especialistas" },
    { icon: PaymentsRounded, label: "Liquidaciones" }
  ];

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    localStorage.removeItem("username");
    navigate("/login");
  };

  return (
    <Box sx={{
      position: "fixed", top: 0, left: 0, bottom: 0, zIndex: 20,
      width: { xs: 76, md: 264 },
      background: `linear-gradient(180deg, ${colors.sideBg} 0%, ${colors.sideBgDeep} 100%)`,
      display: "flex", flexDirection: "column",
      py: "22px", px: { xs: "10px", md: "18px" },
      overflow: "hidden"
    }}>
      {/* decor */}
      <Box sx={{ position: "absolute", bottom: -40, left: -30, width: 200, height: 200, borderRadius: "50%", background: "radial-gradient(circle, rgba(200,169,110,0.12) 0%, transparent 70%)", pointerEvents: "none" }} />

      {/* Logo */}
      <Box sx={{ display: "flex", alignItems: "center", gap: "12px", mb: "30px", px: { xs: 0, md: "6px" }, justifyContent: { xs: "center", md: "flex-start" } }}>
        <Box sx={{ width: 42, height: 42, borderRadius: "13px", background: grads.gold, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: "0 4px 12px rgba(0,0,0,0.25)" }}>
          <Typography sx={{ fontFamily: fonts.title, fontWeight: 700, color: "#fff", fontSize: 22, lineHeight: 1 }}>S</Typography>
        </Box>
        <Box sx={{ display: { xs: "none", md: "block" }, lineHeight: 1.1 }}>
          <Typography sx={{ fontFamily: fonts.title, fontWeight: 700, color: "#fff", fontSize: 20 }}>ShowClinic</Typography>
          <Typography sx={{ fontFamily: fonts.body, color: colors.sideMuted, fontSize: 11, letterSpacing: "0.5px" }}>Clínica Estética</Typography>
        </Box>
      </Box>

      <Typography sx={{ display: { xs: "none", md: "block" }, color: colors.sideMuted, fontSize: 10.5, fontWeight: 700, letterSpacing: "1.5px", px: "10px", mb: "10px" }}>
        MÓDULO DUEÑO
      </Typography>

      {/* Nav */}
      <Box sx={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        {items.map((it, i) => {
          const active = tab === i;
          const Icon = it.icon;
          return (
            <MotionBox
              key={it.label}
              onClick={() => onTab(i)}
              whileHover={{ x: active ? 0 : 3 }}
              whileTap={{ scale: 0.97 }}
              sx={{
                position: "relative", cursor: "pointer",
                display: "flex", alignItems: "center", gap: "13px",
                justifyContent: { xs: "center", md: "flex-start" },
                px: { xs: 0, md: "14px" }, py: "11px", borderRadius: "12px",
                bgcolor: active ? colors.sideActive : "transparent",
                transition: "background 0.2s",
                "&:hover": { bgcolor: active ? colors.sideActive : "rgba(255,255,255,0.05)" }
              }}
            >
              {active && <Box sx={{ position: "absolute", left: 0, top: "22%", bottom: "22%", width: 3, borderRadius: "0 4px 4px 0", bgcolor: colors.gold, display: { xs: "none", md: "block" } }} />}
              <Icon sx={{ fontSize: 21, color: active ? colors.gold : colors.sideMuted }} />
              <Typography sx={{ display: { xs: "none", md: "block" }, fontFamily: fonts.body, fontSize: 14, fontWeight: active ? 700 : 500, color: active ? "#fff" : colors.sideText }}>
                {it.label}
              </Typography>
            </MotionBox>
          );
        })}
      </Box>

      <Box sx={{ flex: 1 }} />

      {/* Footer */}
      <Box sx={{ display: "flex", flexDirection: "column", gap: "6px", borderTop: "1px solid rgba(255,255,255,0.08)", pt: "12px" }}>
        <SideAction icon={HomeRounded} label="Volver al inicio" onClick={() => navigate("/dashboard")} />
        <SideAction icon={LogoutRounded} label="Cerrar sesión" onClick={handleLogout} danger />
      </Box>
    </Box>
  );
}

function SideAction({ icon: Icon, label, onClick, danger }) {
  return (
    <Box
      onClick={onClick}
      sx={{
        cursor: "pointer", display: "flex", alignItems: "center", gap: "13px",
        justifyContent: { xs: "center", md: "flex-start" },
        px: { xs: 0, md: "14px" }, py: "10px", borderRadius: "12px",
        transition: "background 0.2s",
        "&:hover": { bgcolor: danger ? "rgba(211,47,47,0.15)" : "rgba(255,255,255,0.06)" }
      }}
    >
      <Icon sx={{ fontSize: 20, color: danger ? "#E8907E" : colors.sideMuted }} />
      <Typography sx={{ display: { xs: "none", md: "block" }, fontFamily: fonts.body, fontSize: 13.5, fontWeight: 500, color: danger ? "#E8907E" : colors.sideText }}>
        {label}
      </Typography>
    </Box>
  );
}

/* ======================================================================
   FILTRO DE PERIODO (estilo Finanzas)
====================================================================== */
function PeriodoFilter({ preset, fechaInicio, fechaFin, onPreset, onCustom }) {
  const [fi, setFi] = useState(fechaInicio || "");
  const [ff, setFf] = useState(fechaFin || "");

  useEffect(() => { setFi(fechaInicio || ""); setFf(fechaFin || ""); }, [fechaInicio, fechaFin]);

  const presets = [
    { key: "hoy", label: "Hoy" },
    { key: "semana", label: "Esta semana" },
    { key: "mes", label: "Este mes" },
    { key: "anio", label: "Este año" },
    { key: "todo", label: "Todo" }
  ];

  const inputSx = {
    fontFamily: fonts.body, fontSize: "13px", color: colors.textBody,
    border: `1px solid ${colors.border}`, borderRadius: "10px",
    padding: "8px 10px", background: colors.white, outline: "none"
  };

  return (
    <MotionCard
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      sx={{ ...cardSx, p: 0, mb: "20px" }}
    >
      <CardContent sx={{ p: "16px", "&:last-child": { pb: "16px" }, display: "flex", flexWrap: "wrap", alignItems: "center", gap: "10px" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: "8px", mr: "4px" }}>
          <FilterList sx={{ fontSize: 18, color: colors.gold }} />
          <Typography sx={{ fontFamily: fonts.body, fontWeight: 700, fontSize: "13px", color: colors.primaryDark }}>Periodo</Typography>
        </Box>

        {/* Chips de preset */}
        <Box sx={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
          {presets.map((p) => {
            const active = preset === p.key;
            return (
              <MotionBox key={p.key} whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}>
                <Chip
                  label={p.label}
                  onClick={() => onPreset(p.key)}
                  sx={{
                    cursor: "pointer", fontFamily: fonts.body, fontWeight: 600, fontSize: "12.5px", height: 32, borderRadius: "16px",
                    border: `1px solid ${active ? "transparent" : colors.border}`,
                    ...(active
                      ? { background: grads.gold, color: "#fff" }
                      : { bgcolor: colors.white, color: colors.textBody, "&:hover": { bgcolor: colors.creamPanel } })
                  }}
                />
              </MotionBox>
            );
          })}
        </Box>

        <Box sx={{ flex: 1 }} />

        {/* Rango personalizado */}
        <Box sx={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
          <Box component="input" type="date" value={fi} onChange={(e) => setFi(e.target.value)} sx={inputSx} />
          <Typography sx={{ color: colors.textMuted, fontSize: "13px" }}>—</Typography>
          <Box component="input" type="date" value={ff} onChange={(e) => setFf(e.target.value)} sx={inputSx} />
          <Button
            size="small"
            variant="contained"
            onClick={() => onCustom(fi, ff)}
            disabled={!fi && !ff}
            sx={{ background: grads.brown, color: "#fff", textTransform: "none", borderRadius: "10px", fontFamily: fonts.body, fontWeight: 600, boxShadow: "none", "&:hover": { boxShadow: "none", opacity: 0.92 } }}
          >
            Aplicar
          </Button>
        </Box>
      </CardContent>
    </MotionCard>
  );
}

/* ======================================================================
   META DEL MES (configurable + proyección)
====================================================================== */
function MetaPanel({ meta, onSaveMeta }) {
  const metaMensual = Number(meta?.meta_mensual) || 0;
  const ingresos = Number(meta?.ingresos_mes_actual) || 0;

  const [open, setOpen] = useState(false);
  const [valor, setValor] = useState(String(metaMensual || ""));
  useEffect(() => { setValor(String(metaMensual || "")); }, [metaMensual]);

  // Cálculos de proyección (mes actual, hora local)
  const now = new Date();
  const diasMes = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const diaActual = now.getDate();
  const diasRestantes = Math.max(0, diasMes - diaActual);
  const semanasMes = diasMes / 7;
  const semanasRestantes = Math.max(diasRestantes / 7, 0);

  const pct = metaMensual > 0 ? Math.min(100, (ingresos / metaMensual) * 100) : 0;
  const falta = Math.max(0, metaMensual - ingresos);
  const objetivoSemanal = metaMensual > 0 ? metaMensual / semanasMes : 0;
  const ritmoNecesario = semanasRestantes > 0 ? falta / semanasRestantes : falta;
  const proyeccion = diaActual > 0 ? (ingresos / diaActual) * diasMes : 0;
  const enCamino = metaMensual > 0 && proyeccion >= metaMensual;
  const cumplida = metaMensual > 0 && ingresos >= metaMensual;

  // Anillo SVG
  const R = 52, C = 2 * Math.PI * R;
  const dash = (pct / 100) * C;

  const nombresMes = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
  const mesLabel = `${nombresMes[now.getMonth()]} ${now.getFullYear()}`;

  const guardar = () => {
    const n = parseFloat(valor);
    if (isNaN(n) || n < 0) return;
    onSaveMeta(n);
    setOpen(false);
  };

  const inputSx = {
    width: "100%", fontFamily: fonts.body, fontSize: "18px", fontWeight: 700, color: colors.primaryDark,
    border: `1px solid ${colors.border}`, borderRadius: "10px", padding: "12px 14px", outline: "none", boxSizing: "border-box"
  };

  const statSx = { flex: "1 1 150px", minWidth: 140, bgcolor: colors.cream, border: `1px solid ${colors.border}`, borderRadius: "12px", p: "12px 14px" };

  return (
    <MotionCard custom={3.5} variants={fadeUp} sx={{ ...cardSx, p: 0, mb: "22px", overflow: "hidden" }}>
      {/* borde superior dorado */}
      <Box sx={{ height: 4, background: grads.gold }} />
      <CardContent sx={{ p: { xs: "18px", md: "22px" }, "&:last-child": { pb: { xs: "18px", md: "22px" } } }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: "10px", mb: "18px" }}>
          <Box sx={{ width: 38, height: 38, borderRadius: "10px", background: grads.gold, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <FlagRounded sx={{ color: "#fff", fontSize: 20 }} />
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontFamily: fonts.title, fontWeight: 700, fontSize: "17px", color: colors.primaryDark, lineHeight: 1.1 }}>Meta del mes</Typography>
            <Typography sx={{ fontFamily: fonts.body, fontSize: "12px", color: colors.textMuted }}>{mesLabel}</Typography>
          </Box>
          <Button
            size="small"
            startIcon={<EditRounded sx={{ fontSize: 16 }} />}
            onClick={() => setOpen(true)}
            sx={{ color: colors.primary, fontFamily: fonts.body, textTransform: "none", borderRadius: "10px", border: `1px solid ${colors.border}`, bgcolor: colors.white, "&:hover": { bgcolor: colors.creamPanel } }}
          >
            {metaMensual > 0 ? "Editar meta" : "Definir meta"}
          </Button>
        </Box>

        {metaMensual <= 0 ? (
          <Box sx={{ textAlign: "center", py: "20px" }}>
            <Typography sx={{ fontFamily: fonts.body, fontSize: "14px", color: colors.textMuted }}>
              Aún no has definido una meta mensual. Configúrala para ver tu progreso y proyección.
            </Typography>
          </Box>
        ) : (
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: "24px", alignItems: "center" }}>
            {/* Anillo de progreso */}
            <Box sx={{ position: "relative", width: 132, height: 132, flexShrink: 0, mx: "auto" }}>
              <svg width="132" height="132" viewBox="0 0 132 132">
                <circle cx="66" cy="66" r={R} fill="none" stroke={colors.border} strokeWidth="12" />
                <motion.circle
                  cx="66" cy="66" r={R} fill="none"
                  stroke={cumplida ? colors.successText : colors.gold}
                  strokeWidth="12" strokeLinecap="round"
                  transform="rotate(-90 66 66)"
                  strokeDasharray={C}
                  initial={{ strokeDashoffset: C }}
                  animate={{ strokeDashoffset: C - dash }}
                  transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
                />
              </svg>
              <Box sx={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                <Typography sx={{ fontFamily: fonts.title, fontWeight: 700, fontSize: "26px", color: colors.primaryDark, lineHeight: 1 }}>{pct.toFixed(0)}%</Typography>
                <Typography sx={{ fontFamily: fonts.body, fontSize: "10.5px", color: colors.textMuted }}>de la meta</Typography>
              </Box>
            </Box>

            {/* Estadísticas */}
            <Box sx={{ flex: 1, minWidth: 260 }}>
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: "12px" }}>
                <Box sx={statSx}>
                  <Typography sx={{ fontSize: "11px", color: colors.textMuted, fontFamily: fonts.body }}>Meta mensual</Typography>
                  <Typography sx={{ fontSize: "17px", fontWeight: 700, fontFamily: fonts.title, color: colors.primaryDark }}>{formatMoney(metaMensual)}</Typography>
                </Box>
                <Box sx={statSx}>
                  <Typography sx={{ fontSize: "11px", color: colors.textMuted, fontFamily: fonts.body }}>Logrado este mes</Typography>
                  <Typography sx={{ fontSize: "17px", fontWeight: 700, fontFamily: fonts.title, color: colors.successText }}>{formatMoney(ingresos)}</Typography>
                </Box>
                <Box sx={statSx}>
                  <Typography sx={{ fontSize: "11px", color: colors.textMuted, fontFamily: fonts.body }}>{cumplida ? "Excedente" : "Falta para la meta"}</Typography>
                  <Typography sx={{ fontSize: "17px", fontWeight: 700, fontFamily: fonts.title, color: cumplida ? colors.successText : colors.primary }}>
                    {cumplida ? formatMoney(ingresos - metaMensual) : formatMoney(falta)}
                  </Typography>
                </Box>
                <Box sx={statSx}>
                  <Typography sx={{ fontSize: "11px", color: colors.textMuted, fontFamily: fonts.body }}>Objetivo semanal</Typography>
                  <Typography sx={{ fontSize: "17px", fontWeight: 700, fontFamily: fonts.title, color: colors.primaryDark }}>{formatMoney(objetivoSemanal)}</Typography>
                </Box>
              </Box>

              {/* Barra + proyección */}
              <Box sx={{ mt: "14px" }}>
                <LinearProgress variant="determinate" value={pct} sx={{ height: 8, borderRadius: 4, bgcolor: colors.border, "& .MuiLinearProgress-bar": { bgcolor: cumplida ? colors.successText : colors.gold, borderRadius: 4 } }} />
              </Box>

              <Box sx={{ mt: "12px", display: "flex", flexWrap: "wrap", gap: "10px", alignItems: "center" }}>
                <Chip
                  size="small"
                  icon={enCamino ? <TrendingUp sx={{ fontSize: 15 }} /> : <TrendingDown sx={{ fontSize: 15 }} />}
                  label={cumplida ? "¡Meta cumplida!" : `Proyección: ${formatMoney(proyeccion)}`}
                  sx={{
                    fontFamily: fonts.body, fontWeight: 600, fontSize: "12px",
                    bgcolor: enCamino || cumplida ? colors.successBg : colors.amberBg,
                    color: enCamino || cumplida ? colors.successText : colors.amberText,
                    border: `1px solid ${enCamino || cumplida ? colors.successBorder : colors.gold}`,
                    "& .MuiChip-icon": { color: "inherit" }
                  }}
                />
                {!cumplida && (
                  <Typography sx={{ fontSize: "12px", color: colors.textMuted, fontFamily: fonts.body }}>
                    Necesitas <strong style={{ color: colors.primary }}>{formatMoney(ritmoNecesario)}</strong>/semana los {diasRestantes} días restantes.
                  </Typography>
                )}
              </Box>
            </Box>
          </Box>
        )}
      </CardContent>

      {/* Dialog editar meta */}
      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: "16px" } }}>
        <DialogTitle sx={{ fontFamily: fonts.title, fontWeight: 700, color: colors.primaryDark }}>Meta mensual de ingresos</DialogTitle>
        <DialogContent>
          <Typography sx={{ fontFamily: fonts.body, fontSize: "13px", color: colors.textMuted, mb: "12px" }}>
            Define cuánto dinero deseas facturar este mes. Verás tu progreso, objetivo semanal y proyección.
          </Typography>
          <Box
            component="input"
            type="number"
            min="0"
            step="50"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") guardar(); }}
            placeholder="Ej. 20000"
            autoFocus
            sx={inputSx}
          />
        </DialogContent>
        <DialogActions sx={{ px: "24px", pb: "18px" }}>
          <Button onClick={() => setOpen(false)} sx={{ color: colors.textMuted, textTransform: "none", fontFamily: fonts.body }}>Cancelar</Button>
          <Button onClick={guardar} variant="contained" sx={{ background: grads.brown, textTransform: "none", borderRadius: "10px", fontFamily: fonts.body, fontWeight: 600, boxShadow: "none", "&:hover": { boxShadow: "none", opacity: 0.92 } }}>Guardar meta</Button>
        </DialogActions>
      </Dialog>
    </MotionCard>
  );
}

/* ======================================================================
   VISTA DASHBOARD
====================================================================== */
function DashboardView({ data, onSaveMeta }) {
  const { kpis, meta, ingresos_por_mes, tratamientos_mas_vendidos, pagos_pendientes, ultimos_tratamientos, rendimiento_especialistas } = data;

  const thSx = { fontWeight: 700, fontFamily: fonts.body, fontSize: "11px", textTransform: "uppercase", color: colors.textMuted, letterSpacing: "0.5px", borderBottom: `1px solid ${colors.border}`, py: "10px" };
  const tdSx = { fontFamily: fonts.body, fontSize: "13px", color: colors.textBody, borderBottom: `1px solid ${colors.border}`, py: "12px" };

  // serie ascendente para el gráfico de área
  const serie = useMemo(() => (ingresos_por_mes || []).slice(0, 12).slice().reverse(), [ingresos_por_mes]);

  // tendencia mes vs mes anterior (real)
  const trendIngresos = useMemo(() => {
    if (!ingresos_por_mes || ingresos_por_mes.length < 2) return null;
    const cur = ingresos_por_mes[0]?.total || 0;
    const prev = ingresos_por_mes[1]?.total || 0;
    if (prev === 0) return null;
    return ((cur - prev) / prev) * 100;
  }, [ingresos_por_mes]);

  // segmentos donut: top 5 + otros
  const donutData = useMemo(() => {
    const list = (tratamientos_mas_vendidos || []).slice();
    const top = list.slice(0, 5);
    const otros = list.slice(5).reduce((a, t) => a + (t.cantidad || 0), 0);
    const segs = top.map((t, i) => ({ label: t.tratamiento_nombre, value: t.cantidad || 0, color: chartPalette[i % chartPalette.length] }));
    if (otros > 0) segs.push({ label: "Otros", value: otros, color: chartPalette[5] });
    return segs;
  }, [tratamientos_mas_vendidos]);

  return (
    <MotionBox initial="hidden" animate="show">
      {/* KPIs */}
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", lg: "repeat(4, 1fr)" }, gap: "18px", mb: "22px" }}>
        <KPICard i={0} title="Ingresos totales" value={formatMoney(kpis.ingresos_totales)} icon={<AttachMoney />} grad={grads.green} trend={trendIngresos} trendLabel="vs mes anterior" />
        <KPICard i={1} title="Tratamientos realizados" value={kpis.tratamientos_realizados} icon={<CheckCircle />} grad={grads.brown} caption="sesiones completadas" />
        <KPICard i={2} title="Pacientes atendidos" value={kpis.pacientes_atendidos} icon={<People />} grad={grads.violet} caption="pacientes únicos" />
        <KPICard i={3} title="Ticket promedio" value={formatMoney(kpis.ticket_promedio)} icon={<InsightsRounded />} grad={grads.amber} caption="por paciente" />
      </Box>

      {/* Meta del mes */}
      <MetaPanel meta={meta} onSaveMeta={onSaveMeta} />

      {/* Fila media: Ingresos + Donut + Pagos */}
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "1.55fr 1.15fr 1fr" }, gap: "18px", mb: "22px", alignItems: "stretch" }}>
        <PanelCard i={4} title="Ingresos por mes">
          {serie.length > 0
            ? <AreaChart data={serie} />
            : <Empty text="Sin datos de ingresos" />}
        </PanelCard>

        <PanelCard i={5} title="Tratamientos más vendidos">
          {donutData.length > 0
            ? <DonutChart data={donutData} />
            : <Empty text="Sin datos" />}
        </PanelCard>

        <PanelCard i={6} title="Pagos pendientes" badge={pagos_pendientes.length || null}>
          {pagos_pendientes.length === 0 && <Empty text="Todo al día" />}
          <Box sx={{ display: "flex", flexDirection: "column" }}>
            {pagos_pendientes.slice(0, 6).map((p, i) => (
              <Box key={p.id} sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", py: "10px", borderTop: i > 0 ? `1px solid ${colors.border}` : "none" }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
                  <Avatar sx={{ width: 34, height: 34, background: grads.brown, fontSize: 14, fontFamily: fonts.title, fontWeight: 700 }}>{p.nombre?.charAt(0)}</Avatar>
                  <Typography noWrap sx={{ fontSize: "13px", fontFamily: fonts.body, color: colors.textBody, fontWeight: 600 }}>{p.nombre}</Typography>
                </Box>
                <Typography sx={{ color: colors.error, fontWeight: 700, fontSize: "13px", fontFamily: fonts.body, flexShrink: 0 }}>{formatMoney(p.monto_pendiente)}</Typography>
              </Box>
            ))}
          </Box>
        </PanelCard>
      </Box>

      {/* Fila inferior: Últimos tratamientos + Rendimiento especialistas */}
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "1.4fr 1fr" }, gap: "18px" }}>
        <PanelCard i={7} title="Últimos tratamientos realizados">
          <Table size="small" sx={{ tableLayout: "auto" }}>
            <TableHead>
              <TableRow>
                <TableCell sx={thSx}>Tratamiento</TableCell>
                <TableCell sx={thSx}>Paciente</TableCell>
                <TableCell sx={thSx}>Especialista</TableCell>
                <TableCell align="right" sx={{ ...thSx, width: 100 }}>Precio</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(ultimos_tratamientos || []).slice(0, 8).map((t, i) => (
                <TableRow key={i} hover sx={{ "&:hover": { bgcolor: colors.creamPanel } }}>
                  <TableCell sx={{ ...tdSx, fontWeight: 600, color: colors.primaryDark }}>{t.tratamiento_nombre}</TableCell>
                  <TableCell sx={tdSx}>{t.paciente_nombre} {t.paciente_apellido}</TableCell>
                  <TableCell sx={{ ...tdSx, color: colors.textMuted }}>{t.especialista || "—"}</TableCell>
                  <TableCell align="right" sx={{ ...tdSx, fontWeight: 700, color: colors.primary }}>{formatMoney(t.precio_sesion)}</TableCell>
                </TableRow>
              ))}
              {(!ultimos_tratamientos || ultimos_tratamientos.length === 0) && (
                <TableRow><TableCell colSpan={4} sx={tdSx}><Empty text="Sin tratamientos recientes" /></TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </PanelCard>

        <PanelCard i={8} title="Rendimiento de especialistas">
          <Box sx={{ display: "flex", flexDirection: "column" }}>
            {rendimiento_especialistas.map((esp, i) => {
              const max = Math.max(...rendimiento_especialistas.map(e => e.ingresos_generados || 0), 1);
              const pct = ((esp.ingresos_generados || 0) / max) * 100;
              return (
                <Box key={esp.id} sx={{ py: "11px", borderTop: i > 0 ? `1px solid ${colors.border}` : "none" }}>
                  <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1, mb: "6px" }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
                      <Avatar sx={{ width: 32, height: 32, background: grads.gold, fontSize: 13, fontFamily: fonts.title, fontWeight: 700 }}>{esp.nombre?.charAt(0)?.toUpperCase()}</Avatar>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography noWrap sx={{ fontSize: "13px", fontWeight: 600, color: colors.primaryDark, fontFamily: fonts.body }}>{esp.nombre}</Typography>
                        <Typography sx={{ fontSize: "11px", color: colors.textMuted, fontFamily: fonts.body }}>{esp.lineas_culminadas}/{esp.lineas_total} culminadas</Typography>
                      </Box>
                    </Box>
                    <Typography sx={{ fontSize: "13px", fontWeight: 700, color: colors.primary, fontFamily: fonts.body, flexShrink: 0 }}>{formatMoney(esp.ingresos_generados)}</Typography>
                  </Box>
                  <Box sx={{ height: 6, borderRadius: 3, bgcolor: colors.creamPanel, overflow: "hidden" }}>
                    <MotionBox initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.8, delay: 0.2 + i * 0.05, ease: "easeOut" }} sx={{ height: "100%", borderRadius: 3, background: grads.gold }} />
                  </Box>
                </Box>
              );
            })}
            {rendimiento_especialistas.length === 0 && <Empty text="Sin datos de especialistas" />}
          </Box>
        </PanelCard>
      </Box>
    </MotionBox>
  );
}

function SectionTitle({ children }) {
  return (
    <Typography sx={{ fontFamily: fonts.title, fontSize: "22px", fontWeight: 600, color: colors.primaryDark, mb: "14px" }}>
      {children}
    </Typography>
  );
}

function Empty({ text }) {
  return <Typography sx={{ color: colors.textMuted, fontSize: "13px", fontFamily: fonts.body, py: "10px" }}>{text}</Typography>;
}

/* Contenedor de panel con título, animación de entrada y hover */
function PanelCard({ children, title, badge, i = 0, action }) {
  return (
    <MotionCard
      custom={i}
      variants={fadeUp}
      whileHover={{ y: -3, boxShadow: "0 12px 28px rgba(93,64,55,0.12)" }}
      sx={{ ...cardSx, p: 0, height: "100%", display: "flex", flexDirection: "column" }}
    >
      <CardContent sx={{ p: "22px", flex: 1, "&:last-child": { pb: "22px" } }}>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: "14px" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <Typography sx={{ fontFamily: fonts.title, fontSize: "20px", fontWeight: 600, color: colors.primaryDark }}>{title}</Typography>
            {badge != null && (
              <Box sx={{ minWidth: 22, height: 22, px: "6px", borderRadius: "11px", bgcolor: colors.error, color: "#fff", fontSize: 11, fontWeight: 700, fontFamily: fonts.body, display: "flex", alignItems: "center", justifyContent: "center" }}>{badge}</Box>
            )}
          </Box>
          {action}
        </Box>
        {children}
      </CardContent>
    </MotionCard>
  );
}

/* Tarjeta KPI premium */
function KPICard({ title, value, icon, grad, trend, trendLabel, caption, i = 0 }) {
  const up = trend != null && trend >= 0;
  return (
    <MotionCard
      custom={i}
      variants={fadeUp}
      whileHover={{ y: -4, boxShadow: "0 14px 30px rgba(93,64,55,0.14)" }}
      sx={{ ...cardSx, p: 0, position: "relative", overflow: "hidden" }}
    >
      <Box sx={{ position: "absolute", top: -30, right: -30, width: 110, height: 110, borderRadius: "50%", background: grad, opacity: 0.08 }} />
      <CardContent sx={{ p: "20px", "&:last-child": { pb: "20px" } }}>
        <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", mb: "14px" }}>
          <Box sx={{ width: 52, height: 52, borderRadius: "15px", background: grad, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", boxShadow: "0 6px 14px rgba(93,64,55,0.18)", "& svg": { fontSize: 26 } }}>
            {icon}
          </Box>
          {trend != null && (
            <Box sx={{ display: "flex", alignItems: "center", gap: "3px", px: "8px", py: "3px", borderRadius: "20px", bgcolor: up ? colors.successBg : "#FDECEA" }}>
              {up ? <TrendingUp sx={{ fontSize: 14, color: colors.successText }} /> : <TrendingDown sx={{ fontSize: 14, color: colors.error }} />}
              <Typography sx={{ fontSize: "11.5px", fontWeight: 700, fontFamily: fonts.body, color: up ? colors.successText : colors.error }}>
                {up ? "+" : ""}{trend.toFixed(1)}%
              </Typography>
            </Box>
          )}
        </Box>
        <Typography sx={{ fontSize: "13px", color: colors.textMuted, fontFamily: fonts.body, fontWeight: 500 }}>{title}</Typography>
        <Typography sx={{ fontFamily: fonts.title, fontSize: "28px", fontWeight: 700, color: colors.primaryDark, lineHeight: 1.15, mt: "2px" }}>{value}</Typography>
        <Typography sx={{ fontSize: "11.5px", color: colors.textMuted, fontFamily: fonts.body, mt: "4px" }}>
          {trend != null ? trendLabel : caption}
        </Typography>
      </CardContent>
    </MotionCard>
  );
}

/* ======================================================================
   GRÁFICO DE ÁREA (SVG animado)
====================================================================== */
function AreaChart({ data }) {
  const W = 620, H = 240;
  const padL = 52, padR = 14, padT = 18, padB = 30;
  const n = data.length;
  const max = Math.max(...data.map(d => d.total || 0), 1);
  const niceMax = max * 1.15;

  const pts = data.map((d, i) => ({
    x: padL + (n === 1 ? (W - padL - padR) / 2 : (i / (n - 1)) * (W - padL - padR)),
    y: H - padB - ((d.total || 0) / niceMax) * (H - padT - padB),
    label: d.mes,
    val: d.total || 0
  }));

  const linePath = smoothPath(pts);
  const areaPath = `${linePath} L ${pts[pts.length - 1].x} ${H - padB} L ${pts[0].x} ${H - padB} Z`;

  const gridVals = [0, 0.25, 0.5, 0.75, 1].map(f => f * niceMax);
  const gid = "gd-area-grad";

  return (
    <Box sx={{ width: "100%" }}>
      <Box component="svg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" sx={{ width: "100%", height: { xs: 200, md: 240 }, display: "block", overflow: "visible" }}>
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={colors.gold} stopOpacity="0.35" />
            <stop offset="100%" stopColor={colors.gold} stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {/* grid + labels */}
        {gridVals.map((gv, i) => {
          const y = H - padB - (gv / niceMax) * (H - padT - padB);
          return (
            <g key={i}>
              <line x1={padL} y1={y} x2={W - padR} y2={y} stroke={colors.border} strokeWidth="1" strokeDasharray="3 4" />
              <text x={padL - 8} y={y + 3} textAnchor="end" fontSize="9.5" fill={colors.textMuted} fontFamily="'DM Sans', sans-serif">
                {Math.round(gv / 1000)}k
              </text>
            </g>
          );
        })}

        {/* area */}
        <motion.path d={areaPath} fill={`url(#${gid})`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8, delay: 0.3 }} />
        {/* line */}
        <motion.path d={linePath} fill="none" stroke={colors.primary} strokeWidth="2.5" strokeLinecap="round"
          initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.1, ease: "easeInOut" }} />

        {/* dots */}
        {pts.map((p, i) => (
          <motion.circle key={i} cx={p.x} cy={p.y} r="3.5" fill="#fff" stroke={colors.primary} strokeWidth="2"
            initial={{ opacity: 0, scale: 0 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.6 + i * 0.05 }}>
            <title>{`${p.label}: ${formatMoney(p.val)}`}</title>
          </motion.circle>
        ))}

        {/* x labels */}
        {pts.map((p, i) => (
          <text key={i} x={p.x} y={H - padB + 16} textAnchor="middle" fontSize="9.5" fill={colors.textMuted} fontFamily="'DM Sans', sans-serif">
            {p.label?.slice(5)}
          </text>
        ))}
      </Box>
    </Box>
  );
}

function smoothPath(pts) {
  if (!pts.length) return "";
  if (pts.length < 2) return `M ${pts[0].x} ${pts[0].y}`;
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x} ${p2.y}`;
  }
  return d;
}

/* ======================================================================
   GRÁFICO DONA (SVG animado)
====================================================================== */
function DonutChart({ data }) {
  const total = data.reduce((a, d) => a + (d.value || 0), 0) || 1;
  const size = 160, stroke = 22, r = (size - stroke) / 2, cx = size / 2, cy = size / 2;
  const C = 2 * Math.PI * r;

  let cumulative = 0;
  const segs = data.map((d) => {
    const frac = (d.value || 0) / total;
    const seg = { ...d, frac, offset: cumulative };
    cumulative += frac;
    return seg;
  });

  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: "14px", flexWrap: { xs: "wrap", sm: "nowrap" } }}>
      <Box sx={{ position: "relative", width: size, height: size, flexShrink: 0, mx: "auto" }}>
        <Box component="svg" width={size} height={size} sx={{ transform: "rotate(-90deg)" }}>
          <circle cx={cx} cy={cy} r={r} fill="none" stroke={colors.creamPanel} strokeWidth={stroke} />
          {segs.map((s, i) => (
            <motion.circle
              key={i}
              cx={cx} cy={cy} r={r} fill="none"
              stroke={s.color} strokeWidth={stroke} strokeLinecap="butt"
              strokeDasharray={`${s.frac * C} ${C}`}
              initial={{ strokeDashoffset: C }}
              animate={{ strokeDashoffset: -s.offset * C }}
              transition={{ duration: 0.9, delay: 0.2 + i * 0.12, ease: "easeOut" }}
            />
          ))}
        </Box>
        <Box sx={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          <Typography sx={{ fontFamily: fonts.title, fontSize: 26, fontWeight: 700, color: colors.primaryDark, lineHeight: 1 }}>{total}</Typography>
          <Typography sx={{ fontSize: 10.5, color: colors.textMuted, fontFamily: fonts.body }}>total</Typography>
        </Box>
      </Box>
      <Box sx={{ flex: 1, minWidth: 140, display: "flex", flexDirection: "column", gap: "8px" }}>
        {segs.map((s, i) => (
          <Box key={i} sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
              <Box sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: s.color, flexShrink: 0 }} />
              <Typography noWrap sx={{ fontSize: "12.5px", fontFamily: fonts.body, color: colors.textBody }}>{s.label}</Typography>
            </Box>
            <Typography sx={{ fontSize: "12.5px", fontWeight: 700, fontFamily: fonts.body, color: colors.primaryDark, flexShrink: 0 }}>{Math.round(s.frac * 100)}%</Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

/* ======================================================================
   VISTA PRESUPUESTOS
====================================================================== */
function PresupuestosView({ presupuestos, filtroEstado, setFiltroEstado, onSync, onSelectPresupuesto, detalle, onBack, onCulminar, onRevertir, onEditComision, navigate }) {
  if (detalle) {
    return <PresupuestoDetalleView detalle={detalle} onBack={onBack} onCulminar={onCulminar} onRevertir={onRevertir} onEditComision={onEditComision} navigate={navigate} />;
  }

  // Agrupar presupuestos por especialista involucrado (sin hooks: cálculo directo)
  const map = new Map();
  const sinAsignar = [];
  presupuestos.forEach((p) => {
    const esps = p.especialistas_involucrados || [];
    if (esps.length === 0) { sinAsignar.push(p); return; }
    esps.forEach((nombre) => {
      if (!map.has(nombre)) map.set(nombre, []);
      map.get(nombre).push(p);
    });
  });

  const grupos = [...map.entries()].map(([nombre, lista]) => {
    let total = 0, lineas = 0, culminadas = 0;
    lista.forEach((p) => {
      (p.lineas || []).forEach((l) => {
        if (l.especialista_nombre === nombre) {
          total += Number(l.precio) || 0;
          lineas += 1;
          if (l.estado === "culminado") culminadas += 1;
        }
      });
    });
    return { nombre, lista, total, lineas, culminadas };
  }).sort((a, b) => b.total - a.total);

  return (
    <Box>
      {/* Barra de acciones */}
      <Box sx={{ display: "flex", gap: "12px", mb: "18px", alignItems: "center", flexWrap: "wrap" }}>
        <FormControl size="small" sx={{ minWidth: 160, "& .MuiOutlinedInput-root": { borderRadius: "10px", fontFamily: fonts.body, fontSize: "13px", bgcolor: colors.white, "& fieldset": { borderColor: colors.border } } }}>
          <InputLabel sx={{ fontFamily: fonts.body, fontSize: "13px" }}>Estado</InputLabel>
          <Select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)} label="Estado">
            <MenuItem value="">Todos</MenuItem>
            <MenuItem value="activo">Activo</MenuItem>
            <MenuItem value="culminado">Culminado</MenuItem>
            <MenuItem value="anulado">Anulado</MenuItem>
          </Select>
        </FormControl>
        <Box sx={{ flex: 1 }} />
        <Button size="small" variant="outlined" startIcon={<Refresh />} onClick={onSync} sx={{ color: colors.gold, borderColor: colors.border, fontFamily: fonts.body, textTransform: "none", borderRadius: "10px", "&:hover": { borderColor: colors.gold, bgcolor: colors.creamPanel } }}>Sincronizar líneas</Button>
      </Box>

      {/* Grupos por especialista */}
      <MotionBox initial="hidden" animate="show" sx={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {grupos.map((g, i) => (
          <EspecialistaGrupo key={g.nombre} grupo={g} index={i} onSelectPresupuesto={onSelectPresupuesto} />
        ))}
        {sinAsignar.length > 0 && (
          <EspecialistaGrupo
            key="__sin__"
            index={grupos.length}
            grupo={{ nombre: "Sin especialista asignado", lista: sinAsignar, total: sinAsignar.reduce((a, p) => a + (Number(p.precio_total) || 0), 0), lineas: sinAsignar.reduce((a, p) => a + (p.total_lineas || 0), 0), culminadas: sinAsignar.reduce((a, p) => a + (p.lineas_culminadas || 0), 0) }}
            onSelectPresupuesto={onSelectPresupuesto}
            sinAsignar
          />
        )}
      </MotionBox>

      {presupuestos.length === 0 && (
        <Typography sx={{ mt: "20px", textAlign: "center", color: colors.textMuted, fontSize: "13px", fontFamily: fonts.body }}>No hay presupuestos en este periodo</Typography>
      )}
    </Box>
  );
}

/* Grupo colapsable de un especialista con sus presupuestos */
function EspecialistaGrupo({ grupo, index, onSelectPresupuesto, sinAsignar }) {
  const [open, setOpen] = useState(index === 0 && !sinAsignar);
  const { nombre, lista, total, lineas, culminadas } = grupo;
  const progreso = lineas > 0 ? (culminadas / lineas) * 100 : 0;

  return (
    <MotionCard custom={index} variants={fadeUp} sx={{ ...cardSx, p: 0, overflow: "hidden" }}>
      {/* Cabecera clickeable */}
      <MotionBox
        onClick={() => setOpen((o) => !o)}
        whileHover={{ backgroundColor: colors.creamPanel }}
        sx={{ cursor: "pointer", display: "flex", alignItems: "center", gap: "14px", p: "16px 20px" }}
      >
        <Avatar sx={{ width: 46, height: 46, background: sinAsignar ? "linear-gradient(135deg,#B0A79C,#8A8078)" : grads.gold, fontFamily: fonts.title, fontWeight: 700, fontSize: 20, flexShrink: 0 }}>
          {sinAsignar ? "?" : nombre?.charAt(0)?.toUpperCase()}
        </Avatar>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography noWrap sx={{ fontFamily: fonts.body, fontWeight: 700, fontSize: "15px", color: colors.primaryDark }}>{nombre}</Typography>
          <Box sx={{ display: "flex", gap: "12px", flexWrap: "wrap", mt: "2px" }}>
            <Typography sx={{ fontSize: "12px", color: colors.textMuted, fontFamily: fonts.body }}>
              {lista.length} presupuesto{lista.length !== 1 ? "s" : ""}
            </Typography>
            {!sinAsignar && (
              <Typography sx={{ fontSize: "12px", color: colors.textMuted, fontFamily: fonts.body }}>
                {culminadas}/{lineas} líneas culminadas
              </Typography>
            )}
          </Box>
        </Box>
        <Box sx={{ textAlign: "right", flexShrink: 0, mr: "6px" }}>
          <Typography sx={{ fontSize: "11px", color: colors.textMuted, fontFamily: fonts.body }}>{sinAsignar ? "Total presup." : "Generado"}</Typography>
          <Typography sx={{ fontFamily: fonts.title, fontWeight: 700, fontSize: "18px", color: colors.primary, lineHeight: 1.1 }}>{formatMoney(total)}</Typography>
        </Box>
        <MotionBox animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.25 }}>
          <ExpandMore sx={{ color: colors.textMuted }} />
        </MotionBox>
      </MotionBox>

      {!sinAsignar && (
        <Box sx={{ px: "20px", pb: open ? 0 : "14px" }}>
          <LinearProgress variant="determinate" value={progreso} sx={{ height: 5, borderRadius: 3, bgcolor: colors.border, "& .MuiLinearProgress-bar": { bgcolor: progreso === 100 ? colors.successText : colors.gold, borderRadius: 3 } }} />
        </Box>
      )}

      <Collapse in={open} timeout={300}>
        <Box sx={{ p: "18px 20px 20px", borderTop: `1px solid ${colors.border}`, mt: "14px", bgcolor: colors.cream }}>
          <Grid container spacing="14px">
            {lista.map((p) => (
              <Grid item xs={12} sm={6} lg={4} key={p.id}>
                <MotionCard
                  whileHover={{ y: -4, boxShadow: "0 10px 22px rgba(93,64,55,0.12)" }}
                  onClick={() => onSelectPresupuesto(p.id)}
                  sx={{ ...cardSx, cursor: "pointer", p: 0, "&:hover": { borderColor: colors.gold } }}
                >
                  <CardContent sx={{ p: "16px", "&:last-child": { pb: "16px" } }}>
                    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 1, mb: "6px" }}>
                      <Typography sx={{ fontWeight: 700, fontFamily: fonts.body, fontSize: "13.5px", color: colors.primaryDark, minWidth: 0 }} noWrap>
                        {p.paciente_nombre} {p.paciente_apellido}
                      </Typography>
                      <EstadoChip estado={p.estado_gestion || "activo"} />
                    </Box>
                    <Typography sx={{ fontSize: "11.5px", color: colors.textMuted, fontFamily: fonts.body }}>#{p.id} · {p.creado_en?.split(" ")[0]}</Typography>
                    <Divider sx={{ my: "10px", borderColor: colors.border }} />
                    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <Typography sx={{ fontSize: "13px", fontFamily: fonts.body, color: colors.textBody }}>
                        <strong style={{ color: colors.primary }}>{formatMoney(p.precio_total)}</strong>
                      </Typography>
                      <Typography sx={{ fontSize: "11.5px", fontFamily: fonts.body, color: colors.textMuted }}>
                        {p.lineas_culminadas}/{p.total_lineas} líneas
                      </Typography>
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={p.total_lineas > 0 ? (p.lineas_culminadas / p.total_lineas) * 100 : 0}
                      sx={{ mt: "8px", height: 4, borderRadius: 2, bgcolor: colors.border, "& .MuiLinearProgress-bar": { bgcolor: colors.successText, borderRadius: 2 } }}
                    />
                  </CardContent>
                </MotionCard>
              </Grid>
            ))}
          </Grid>
        </Box>
      </Collapse>
    </MotionCard>
  );
}

function PresupuestoDetalleView({ detalle, onBack, onCulminar, onRevertir, onEditComision, navigate }) {
  const { presupuesto, lineas } = detalle;
  const totalLineas = lineas.length;
  const lineasCulminadas = lineas.filter(l => l.estado === "culminado").length;
  const progresoGeneral = totalLineas > 0 ? (lineasCulminadas / totalLineas) * 100 : 0;

  return (
    <Box>
      <Button startIcon={<ArrowBack />} onClick={onBack} sx={{ mb: "16px", color: colors.primary, fontFamily: fonts.body, textTransform: "none", borderRadius: "10px" }}>Volver</Button>

      {/* Cabecera del presupuesto */}
      <Card sx={{ ...cardSx, mb: "20px", p: 0 }}>
        <CardContent sx={{ p: "24px" }}>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 2 }}>
            <Box>
              <Typography sx={{ fontFamily: fonts.title, color: colors.primaryDark, fontWeight: 700, fontSize: "24px" }}>
                {presupuesto.paciente_nombre} {presupuesto.paciente_apellido}
              </Typography>
              <Typography sx={{ color: colors.textMuted, mt: 0.5, fontSize: "13px", fontFamily: fonts.body }}>
                DNI: {presupuesto.paciente_dni} · Presupuesto #{presupuesto.id} · {presupuesto.creado_en?.split(" ")[0]}
              </Typography>
              <Box sx={{ mt: "12px", display: "flex", gap: 1 }}>
                <Tooltip title="Ver historial clínico del paciente">
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<OpenInNew sx={{ fontSize: 14 }} />}
                    sx={{ borderColor: colors.border, color: colors.primary, fontSize: "12px", textTransform: "none", borderRadius: "10px", fontFamily: fonts.body, "&:hover": { borderColor: colors.gold, bgcolor: colors.creamPanel } }}
                    onClick={() => navigate(`/historial-clinico/${presupuesto.paciente_id}`)}
                  >
                    Historial Clínico
                  </Button>
                </Tooltip>
              </Box>
            </Box>
            <Box sx={{ textAlign: "right", minWidth: 180 }}>
              <Typography sx={{ fontWeight: 700, color: colors.primaryDark, fontFamily: fonts.title, fontSize: "26px" }}>{formatMoney(presupuesto.precio_total)}</Typography>
              <EstadoChip estado={presupuesto.estado_gestion || "activo"} />
              <Typography display="block" sx={{ mt: 1, color: colors.textMuted, fontSize: "12px", fontFamily: fonts.body }}>
                Pagado: {formatMoney(presupuesto.monto_pagado_real || presupuesto.monto_pagado || 0)}
              </Typography>
            </Box>
          </Box>
          {/* Barra de progreso general */}
          <Box sx={{ mt: "16px" }}>
            <Box sx={{ display: "flex", justifyContent: "space-between", mb: "4px" }}>
              <Typography sx={{ fontWeight: 600, color: colors.primaryDark, fontSize: "12px", fontFamily: fonts.body }}>
                Progreso: {lineasCulminadas}/{totalLineas} líneas culminadas
              </Typography>
              <Typography sx={{ fontWeight: 600, color: colors.successText, fontSize: "12px", fontFamily: fonts.body }}>
                {progresoGeneral.toFixed(0)}%
              </Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={progresoGeneral}
              sx={{ height: 7, borderRadius: 4, bgcolor: colors.border, "& .MuiLinearProgress-bar": { bgcolor: progresoGeneral === 100 ? colors.successText : colors.gold, borderRadius: 4 } }}
            />
          </Box>
        </CardContent>
      </Card>

      {/* Líneas de tratamiento */}
      <SectionTitle>Líneas de Tratamiento</SectionTitle>
      {lineas.map((linea) => (
        <LineaCard key={linea.id} linea={linea} onCulminar={onCulminar} onRevertir={onRevertir} onEditComision={onEditComision} />
      ))}
    </Box>
  );
}

const CATEGORIA_STYLES = {
  "Armonización": { bg: "#f3e8ff", text: "#7c3aed", border: "#d8b4fe" },
  "Cosmiatría Facial": { bg: "#e0f2fe", text: "#0369a1", border: "#bae6fd" },
  "Cosmiatría Corporal": { bg: "#dcfce7", text: "#15803d", border: "#bbf7d0" }
};

function CategoriaChip({ categoria }) {
  if (!categoria) return null;
  const s = CATEGORIA_STYLES[categoria] || { bg: colors.creamPanel, text: colors.textMuted, border: colors.border };
  return (
    <Chip
      icon={<CategoryRounded sx={{ fontSize: 13, color: `${s.text} !important` }} />}
      label={categoria}
      size="small"
      sx={{ height: 20, fontSize: "0.65rem", fontFamily: fonts.body, fontWeight: 600, bgcolor: s.bg, color: s.text, border: `1px solid ${s.border}` }}
    />
  );
}

// Diálogo para editar la comisión de una línea (% o monto fijo)
function ComisionEditorDialog({ open, linea, onClose, onSave }) {
  const [tipo, setTipo] = useState("porcentaje");
  const [pct, setPct] = useState("20");
  const [fijo, setFijo] = useState("0");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!linea) return;
    setTipo(linea.comision_tipo === "fijo" ? "fijo" : "porcentaje");
    setPct(String(linea.comision_porcentaje_efectivo ?? linea.comision_porcentaje ?? 20));
    setFijo(String(linea.comision_fija ?? 0));
  }, [linea]);

  if (!linea) return null;

  const preview = tipo === "fijo"
    ? (parseFloat(fijo) || 0)
    : (Number(linea.precio) || 0) * ((parseFloat(pct) || 0) / 100);

  const guardar = async () => {
    let payload;
    if (tipo === "porcentaje") {
      const n = parseFloat(pct);
      if (isNaN(n) || n < 0 || n > 100) return;
      payload = { comision_tipo: "porcentaje", comision_porcentaje: n };
    } else {
      const n = parseFloat(fijo);
      if (isNaN(n) || n < 0) return;
      payload = { comision_tipo: "fijo", comision_fija: n };
    }
    setSaving(true);
    try { await onSave(payload); onClose(); } finally { setSaving(false); }
  };

  const tabSx = (active) => ({
    flex: 1, textAlign: "center", py: "10px", cursor: "pointer", borderRadius: "10px",
    fontFamily: fonts.body, fontWeight: 700, fontSize: "13px",
    border: `1px solid ${active ? colors.gold : colors.border}`,
    bgcolor: active ? colors.goldSoft : colors.white,
    color: active ? colors.primaryDark : colors.textMuted,
    display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", transition: "all .15s"
  });
  const inputSx = {
    width: "100%", fontFamily: fonts.body, fontSize: "18px", fontWeight: 700, color: colors.primaryDark,
    border: `1px solid ${colors.border}`, borderRadius: "10px", padding: "12px 14px", outline: "none", boxSizing: "border-box"
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: "16px" } }}>
      <DialogTitle sx={{ fontFamily: fonts.title, fontWeight: 700, color: colors.primaryDark }}>
        Comisión — {linea.tratamiento_nombre}
      </DialogTitle>
      <DialogContent>
        <Typography sx={{ fontFamily: fonts.body, fontSize: "12px", color: colors.textMuted, mb: "12px" }}>
          Precio del tratamiento: <strong style={{ color: colors.primary }}>{formatMoney(linea.precio)}</strong>
        </Typography>
        <Box sx={{ display: "flex", gap: "10px", mb: "16px" }}>
          <Box sx={tabSx(tipo === "porcentaje")} onClick={() => setTipo("porcentaje")}>
            <PercentRounded sx={{ fontSize: 16 }} /> Porcentaje
          </Box>
          <Box sx={tabSx(tipo === "fijo")} onClick={() => setTipo("fijo")}>
            <PaidRounded sx={{ fontSize: 16 }} /> Monto fijo
          </Box>
        </Box>
        {tipo === "porcentaje" ? (
          <Box>
            <Typography sx={{ fontFamily: fonts.body, fontSize: "12px", color: colors.textMuted, mb: "6px" }}>Porcentaje sobre el precio (%)</Typography>
            <Box component="input" type="number" min="0" max="100" step="1" value={pct}
              onChange={(e) => setPct(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") guardar(); }} autoFocus sx={inputSx} />
          </Box>
        ) : (
          <Box>
            <Typography sx={{ fontFamily: fonts.body, fontSize: "12px", color: colors.textMuted, mb: "6px" }}>Monto fijo a pagar (S/)</Typography>
            <Box component="input" type="number" min="0" step="10" value={fijo}
              onChange={(e) => setFijo(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") guardar(); }} autoFocus sx={inputSx} />
          </Box>
        )}
        <Box sx={{ mt: "16px", p: "12px 14px", bgcolor: colors.cream, borderRadius: "12px", border: `1px solid ${colors.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Typography sx={{ fontFamily: fonts.body, fontSize: "13px", color: colors.textMuted }}>Comisión resultante</Typography>
          <Typography sx={{ fontFamily: fonts.title, fontWeight: 700, fontSize: "18px", color: colors.successText }}>{formatMoney(preview)}</Typography>
        </Box>
        {linea.comision?.estado === "liquidado" && (
          <Alert severity="info" sx={{ mt: "12px", borderRadius: "10px", fontFamily: fonts.body, fontSize: "12px" }}>
            La comisión de esta línea ya fue liquidada; el cambio aplicará solo a cálculos futuros.
          </Alert>
        )}
      </DialogContent>
      <DialogActions sx={{ px: "24px", pb: "18px" }}>
        <Button onClick={onClose} sx={{ color: colors.textMuted, textTransform: "none", fontFamily: fonts.body }}>Cancelar</Button>
        <Button onClick={guardar} disabled={saving} variant="contained" sx={{ background: grads.brown, textTransform: "none", borderRadius: "10px", fontFamily: fonts.body, fontWeight: 600, boxShadow: "none", "&:hover": { boxShadow: "none", opacity: 0.92 } }}>
          {saving ? "Guardando..." : "Guardar"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function LineaCard({ linea, onCulminar, onRevertir, onEditComision }) {
  const [expanded, setExpanded] = useState(false);
  const [comOpen, setComOpen] = useState(false);
  const progreso = linea.sesiones_totales > 0 ? (linea.sesiones_realizadas / linea.sesiones_totales) * 100 : 0;
  const esFijo = linea.comision_tipo === "fijo";
  const comisionPct = linea.comision_porcentaje_efectivo ?? linea.comision_porcentaje ?? 20;
  const comisionEstimada = linea.comision_estimada != null
    ? linea.comision_estimada
    : (esFijo ? (Number(linea.comision_fija) || 0) : linea.precio * (comisionPct / 100));
  const comisionLabel = esFijo ? "fijo" : `${comisionPct}%`;

  const isCulminado = linea.estado === "culminado";
  const isListo = linea.estado === "listo_para_culminar";

  const leftColor = isCulminado ? colors.successText : isListo ? colors.amberText : colors.goldSoft;

  return (
    <Card sx={{
      ...cardSx,
      mb: "10px",
      borderLeft: `4px solid ${leftColor}`,
      "&:hover": { boxShadow: "0 2px 8px rgba(93,64,55,0.08)" },
      transition: "all 0.2s ease",
      p: 0
    }}>
      <CardContent sx={{ py: "14px", px: "20px", "&:last-child": { pb: "14px" } }}>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
              <Typography sx={{ fontWeight: 700, fontFamily: fonts.body, fontSize: "14px", color: colors.primaryDark }}>
                {linea.tratamiento_nombre}
              </Typography>
              <EstadoChip estado={linea.estado} />
              <CategoriaChip categoria={linea.categoria} />
              {isCulminado && <VerifiedUser sx={{ fontSize: 15, color: colors.successText }} />}
              {isListo && <Warning sx={{ fontSize: 15, color: colors.amberText }} />}
            </Box>
            <Box sx={{ display: "flex", gap: "14px", mt: "4px", flexWrap: "wrap" }}>
              <Typography sx={{ fontSize: "12px", fontFamily: fonts.body, color: colors.textMuted }}>
                Sesiones: <strong style={{ color: colors.textBody }}>{linea.sesiones_realizadas}/{linea.sesiones_totales}</strong>
              </Typography>
              <Typography sx={{ fontSize: "12px", fontFamily: fonts.body, color: colors.textMuted }}>
                Precio: <strong style={{ color: colors.primary }}>{formatMoney(linea.precio)}</strong>
              </Typography>
              <Box sx={{ display: "flex", alignItems: "center", gap: "4px" }}>
                <Typography sx={{ fontSize: "12px", fontFamily: fonts.body, color: colors.textMuted }}>
                  Comisión ({comisionLabel}): <strong style={{ color: esFijo ? colors.gold : colors.textBody }}>{formatMoney(comisionEstimada)}</strong>
                </Typography>
                {onEditComision && (
                  <Tooltip title="Editar comisión (% o monto fijo)">
                    <IconButton size="small" onClick={() => setComOpen(true)} sx={{ p: "2px", color: colors.primary }}>
                      <EditRounded sx={{ fontSize: 14 }} />
                    </IconButton>
                  </Tooltip>
                )}
              </Box>
              {linea.especialista_nombre && (
                <Typography sx={{ fontSize: "12px", fontFamily: fonts.body, color: colors.primary, fontWeight: 600 }}>
                  {linea.especialista_nombre}
                </Typography>
              )}
            </Box>
            <LinearProgress
              variant="determinate"
              value={progreso}
              sx={{ mt: "6px", height: 4, borderRadius: 2, bgcolor: colors.border, "& .MuiLinearProgress-bar": { bgcolor: progreso === 100 ? colors.successText : colors.gold, borderRadius: 2 } }}
            />
          </Box>
          <Box sx={{ display: "flex", gap: "8px", ml: "14px", alignItems: "center" }}>
            {(isListo || linea.estado === "en_curso") && linea.especialista_id && (
              <Tooltip title="Marcar como culminado (genera comisión)">
                <Button
                  size="small"
                  variant="contained"
                  startIcon={<CheckCircle sx={{ fontSize: 14 }} />}
                  sx={{ bgcolor: colors.successText, "&:hover": { bgcolor: "#4a7a5e" }, fontSize: "0.7rem", textTransform: "none", borderRadius: "10px", fontFamily: fonts.body, boxShadow: "none" }}
                  onClick={() => onCulminar(linea)}
                >
                  Culminar
                </Button>
              </Tooltip>
            )}
            {isCulminado && linea.comision?.estado !== "liquidado" && (
              <Tooltip title="Revertir culminación (solo si no liquidada)">
                <Button
                  size="small"
                  variant="outlined"
                  sx={{ fontSize: "0.7rem", textTransform: "none", borderRadius: "10px", fontFamily: fonts.body, color: colors.amberText, borderColor: colors.amberText, "&:hover": { bgcolor: colors.amberBg, borderColor: colors.amberText } }}
                  onClick={() => onRevertir(linea.id)}
                >
                  Revertir
                </Button>
              </Tooltip>
            )}
            <IconButton size="small" onClick={() => setExpanded(!expanded)} sx={{ color: colors.textMuted }}>
              {expanded ? <ExpandLess /> : <ExpandMore />}
            </IconButton>
          </Box>
        </Box>
        <Collapse in={expanded}>
          <Box sx={{ mt: "12px", pl: "4px", borderTop: `1px solid ${colors.border}`, pt: "12px" }}>
            {/* Sesiones detalle */}
            {linea.sesiones?.length > 0 && (
              <Box sx={{ mb: "12px" }}>
                <Typography sx={{ fontWeight: 700, fontFamily: fonts.body, fontSize: "12px", color: colors.primaryDark, mb: "4px" }}>
                  Detalle de Sesiones
                </Typography>
                {linea.sesiones.map((s) => (
                  <Box key={s.id} sx={{ display: "flex", gap: "12px", py: "4px", borderBottom: `1px solid ${colors.border}`, alignItems: "center" }}>
                    <Typography sx={{ fontSize: "12px", fontFamily: fonts.body, minWidth: 60, color: colors.textBody }}>Sesión {s.sesion_numero}</Typography>
                    <Chip
                      label={s.estado === "completada" ? "Realizada" : "Pendiente"}
                      size="small"
                      sx={{
                        height: 20, fontSize: "0.65rem", fontFamily: fonts.body,
                        ...(s.estado === "completada"
                          ? { bgcolor: colors.successBg, color: colors.successText, border: `1px solid ${colors.successBorder}` }
                          : { bgcolor: colors.creamPanel, color: colors.textMuted, border: `1px solid ${colors.border}` })
                      }}
                    />
                    {s.fecha_realizada && <Typography sx={{ fontSize: "12px", color: colors.textMuted, fontFamily: fonts.body }}>{s.fecha_realizada.split(" ")[0]}</Typography>}
                    {s.especialista && <Typography sx={{ fontSize: "12px", color: colors.primary, fontFamily: fonts.body }}>{s.especialista}</Typography>}
                  </Box>
                ))}
              </Box>
            )}
            {/* Comisión info */}
            {linea.comision && (
              <Box sx={{ p: "12px", bgcolor: linea.comision.estado === "liquidado" ? colors.successBg : colors.creamPanel, borderRadius: "10px", mb: "8px", border: `1px solid ${linea.comision.estado === "liquidado" ? colors.successBorder : colors.border}` }}>
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <Typography sx={{ fontWeight: 700, fontSize: "12px", fontFamily: fonts.body, color: colors.primaryDark }}>Comisión: {formatMoney(linea.comision.monto)}</Typography>
                  <Chip
                    label={linea.comision.estado === "liquidado" ? "Liquidado" : "Pendiente"}
                    size="small"
                    sx={{
                      height: 20, fontSize: "0.6rem", fontFamily: fonts.body,
                      ...(linea.comision.estado === "liquidado"
                        ? { bgcolor: colors.successBg, color: colors.successText, border: `1px solid ${colors.successBorder}` }
                        : { bgcolor: colors.amberBg, color: colors.amberText, border: "none" })
                    }}
                  />
                </Box>
              </Box>
            )}
            {/* Auditoría */}
            {linea.culminado_en && (
              <Typography sx={{ color: colors.textMuted, fontStyle: "italic", fontSize: "11px", fontFamily: fonts.body }}>
                Culminado el {linea.culminado_en} por {linea.culminado_por}
              </Typography>
            )}
            {linea.revertido_en && (
              <Typography sx={{ color: colors.error, fontStyle: "italic", display: "block", fontSize: "11px", fontFamily: fonts.body }}>
                Revertido el {linea.revertido_en} por {linea.revertido_por}
              </Typography>
            )}
          </Box>
        </Collapse>
      </CardContent>
      {onEditComision && (
        <ComisionEditorDialog
          open={comOpen}
          linea={linea}
          onClose={() => setComOpen(false)}
          onSave={(payload) => onEditComision(linea.id, payload)}
        />
      )}
    </Card>
  );
}

/* ======================================================================
   VISTA ESPECIALISTAS
====================================================================== */
function EspecialistasView({ especialistas, detalle, onSelect, onBack, onReloadEspecialistas, onEditEspecialistaComision, onEditPresupuestoComision, fechaInicio, fechaFin }) {
  const [pctEsp, setPctEsp] = useState(null); // especialista en edición de %
  const [reconOpen, setReconOpen] = useState(false);

  if (detalle) {
    return (
      <EspecialistaDetalleView
        detalle={detalle}
        onBack={onBack}
        onEditEspecialistaComision={onEditEspecialistaComision}
        onEditPresupuestoComision={onEditPresupuestoComision}
      />
    );
  }

  return (
    <Box>
      <Box sx={{ mb: "18px", display: "flex", alignItems: "flex-start", gap: "12px", flexWrap: "wrap" }}>
        <Box sx={{ flex: 1, minWidth: 220 }}>
          <Typography sx={{ fontFamily: fonts.title, fontSize: "22px", fontWeight: 600, color: colors.primaryDark }}>Equipo de Especialistas</Typography>
          <Typography sx={{ fontFamily: fonts.body, fontSize: "13px", color: colors.textMuted }}>
            La comisión se calcula como un porcentaje sobre el <strong>precio final</strong> (con descuento) de cada presupuesto asignado.
          </Typography>
        </Box>
        <Button
          onClick={() => setReconOpen(true)}
          startIcon={<InsightsRounded sx={{ fontSize: 18 }} />}
          sx={{ fontFamily: fonts.body, textTransform: "none", borderRadius: "12px", fontWeight: 700, color: colors.primaryDark, border: `1px solid ${colors.border}`, bgcolor: colors.white, px: "16px", py: "8px", "&:hover": { bgcolor: colors.creamPanel, borderColor: colors.gold } }}
        >
          Verificar cuadre
        </Button>
      </Box>

      <Grid container spacing="16px">
      {especialistas.map((esp) => (
        <Grid item xs={12} sm={6} md={4} key={esp.id}>
          <Card
            sx={{ ...cardSx, cursor: "pointer", "&:hover": { borderColor: colors.gold, boxShadow: "0 4px 12px rgba(93,64,55,0.1)" }, transition: "all 0.2s", p: 0 }}
            onClick={() => onSelect(esp.id)}
          >
            <CardContent sx={{ p: "18px" }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <Avatar sx={{ bgcolor: colors.primary, width: 44, height: 44, fontFamily: fonts.title, fontWeight: 700 }}>
                  {esp.nombre?.charAt(0)?.toUpperCase()}
                </Avatar>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 700, fontFamily: fonts.body, fontSize: "14px", color: colors.primaryDark }}>{esp.nombre}</Typography>
                  <Typography sx={{ fontSize: "12px", color: colors.textMuted, fontFamily: fonts.body }}>{esp.tipo} | {esp.especialidad || "General"}</Typography>
                </Box>
                <Chip
                  onClick={(e) => { e.stopPropagation(); setPctEsp(esp); }}
                  icon={<PercentRounded sx={{ fontSize: 13, color: `${colors.primaryDark} !important` }} />}
                  label={`${Number(esp.comision_porcentaje)}%`}
                  size="small"
                  sx={{ bgcolor: colors.goldSoft, color: colors.primaryDark, fontWeight: 700, fontFamily: fonts.body, height: 24, fontSize: "0.72rem", border: `1px solid ${colors.gold}`, "&:hover": { bgcolor: colors.gold } }}
                />
              </Box>
              <Divider sx={{ my: "12px", borderColor: colors.border }} />
              <Grid container spacing={1}>
                <Grid item xs={6}>
                  <Typography sx={{ fontSize: "11px", color: colors.textMuted, fontFamily: fonts.body }}>Presupuestos</Typography>
                  <Typography sx={{ fontWeight: 700, fontFamily: fonts.title, fontSize: "20px", color: colors.primaryDark }}>{esp.num_presupuestos}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography sx={{ fontSize: "11px", color: colors.textMuted, fontFamily: fonts.body }}>Facturación</Typography>
                  <Typography sx={{ fontWeight: 700, fontFamily: fonts.body, fontSize: "13px", color: colors.primary, mt: "4px" }}>{formatMoney(esp.base_total)}</Typography>
                </Grid>
                <Grid item xs={12}>
                  <Box sx={{ mt: "6px", p: "10px 12px", borderRadius: "12px", bgcolor: colors.creamPanel, border: `1px solid ${colors.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <Typography sx={{ fontSize: "11.5px", color: colors.textMuted, fontFamily: fonts.body }}>Pago estimado</Typography>
                    <Typography sx={{ fontWeight: 700, fontFamily: fonts.title, fontSize: "18px", color: colors.primaryDark }}>{formatMoney(esp.comision_total)}</Typography>
                  </Box>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>
      ))}
      </Grid>

      {especialistas.length === 0 && (
        <Alert severity="info" sx={{ mt: "18px", borderRadius: "12px" }}>No hay especialistas registrados.</Alert>
      )}

      <PorcentajeEspecialistaDialog
        especialista={pctEsp}
        onClose={() => setPctEsp(null)}
        onSave={async (pct) => { await onEditEspecialistaComision(pctEsp.id, pct); setPctEsp(null); }}
      />

      <ReconciliacionDialog open={reconOpen} onClose={() => setReconOpen(false)} fechaInicio={fechaInicio} fechaFin={fechaFin} />
    </Box>
  );
}

/* ======================================================================
   DIALOG: RECONCILIACIÓN — verificar por qué no cuadra especialistas vs finanzas
====================================================================== */
const TIPO_LABELS = {
  presupuesto_asignado: "Presupuestos (pagos directos)",
  presupuesto_consulta: "Presupuestos (consultas)",
  paquete_paciente: "Paquetes",
  paquete_consulta: "Paquetes (consultas)",
  deuda_tratamiento: "Deudas de tratamiento",
  tratamiento_realizado: "Tratamientos (modelo antiguo)",
  consulta_directa: "Consultas directas",
  finanza: "Abonos manuales (finanza)"
};

function ReconciliacionDialog({ open, onClose, fechaInicio, fechaFin }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);

  useEffect(() => {
    if (!open) return;
    let cancel = false;
    (async () => {
      setLoading(true); setErr(null); setData(null);
      try {
        const d = await apiFetch(`/reconciliacion${buildDateQuery(fechaInicio, fechaFin)}`);
        if (!cancel) setData(d);
      } catch (e) {
        if (!cancel) setErr(e.message);
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => { cancel = true; };
  }, [open, fechaInicio, fechaFin]);

  const periodoLabel = (fechaInicio || fechaFin)
    ? `${fechaInicio || "inicio"} → ${fechaFin || "hoy"}`
    : "Todo el histórico";

  const cuadra = data && Math.abs(Number(data.diferencia_finanzas_vs_especialistas) || 0) < 0.5;

  const Row = ({ label, value, bold, color, tint }) => (
    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", py: "10px", px: "12px", borderRadius: "10px", bgcolor: tint || "transparent" }}>
      <Typography sx={{ fontFamily: fonts.body, fontSize: "13px", fontWeight: bold ? 700 : 500, color: color || colors.textBody }}>{label}</Typography>
      <Typography sx={{ fontFamily: fonts.title, fontSize: bold ? "17px" : "15px", fontWeight: 700, color: color || colors.primaryDark }}>{formatMoney(value)}</Typography>
    </Box>
  );

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: "18px" } }}>
      <DialogTitle sx={{ fontFamily: fonts.title, fontWeight: 700, color: colors.primaryDark, fontSize: "22px", pb: "2px" }}>
        Verificación de cuadre
        <Typography sx={{ fontFamily: fonts.body, fontSize: "13px", fontWeight: 500, color: colors.textMuted, mt: "2px" }}>
          Periodo: <strong style={{ color: colors.primary }}>{periodoLabel}</strong> · según fecha de pago
        </Typography>
      </DialogTitle>
      <DialogContent>
        {loading && <LinearProgress sx={{ my: "18px", borderRadius: 2, bgcolor: colors.border, "& .MuiLinearProgress-bar": { bgcolor: colors.gold } }} />}
        {err && <Alert severity="error" sx={{ borderRadius: "12px", my: "12px" }}>{err}</Alert>}
        {data && (
          <Box sx={{ fontFamily: fonts.body }}>
            <Alert
              severity={cuadra ? "success" : "info"}
              sx={{ borderRadius: "12px", mb: "16px", ...(cuadra ? { bgcolor: colors.successBg, color: colors.successText } : { bgcolor: colors.amberBg, color: colors.amberText }) }}
            >
              {cuadra
                ? "Todo cuadra: la suma de los especialistas coincide con los pagos de presupuestos en finanzas."
                : `Diferencia de ${formatMoney(Math.abs(Number(data.diferencia_finanzas_vs_especialistas) || 0))}. Abajo se explica de dónde viene.`}
            </Alert>

            <Typography sx={{ fontFamily: fonts.title, fontWeight: 600, color: colors.primaryDark, fontSize: "16px", mb: "6px" }}>
              Total de ingresos en Finanzas
            </Typography>
            <Row label="Todos los ingresos (lo que ves en Finanzas)" value={data.total_finanzas_ingresos} bold color={colors.primaryDark} tint={colors.creamPanel} />

            <Divider sx={{ my: "14px", borderColor: colors.border }} />

            <Typography sx={{ fontFamily: fonts.title, fontWeight: 600, color: colors.primaryDark, fontSize: "16px", mb: "6px" }}>
              Desglose por origen
            </Typography>
            {(data.desglose_por_referencia_tipo || []).map((t) => (
              <Row
                key={t.referencia_tipo || "sin_tipo"}
                label={`${TIPO_LABELS[t.referencia_tipo] || t.referencia_tipo || "Sin tipo"} (${t.n})`}
                value={t.total}
              />
            ))}

            <Divider sx={{ my: "14px", borderColor: colors.border }} />

            <Typography sx={{ fontFamily: fonts.title, fontWeight: 600, color: colors.primaryDark, fontSize: "16px", mb: "6px" }}>
              Presupuestos: a quién se asignan
            </Typography>
            <Row label="Con especialista asignado (sí se reparte)" value={data.presupuestos_con_especialista} color={colors.successText} tint={colors.successBg} />
            <Row label="Sin especialista asignado (no aparece en nadie)" value={data.presupuestos_sin_especialista} color={colors.amberText} tint={colors.amberBg} />
            {Number(data.pagos_huerfanos_presupuesto_borrado) > 0 && (
              <Row label="Pagos de presupuestos ya borrados" value={data.pagos_huerfanos_presupuesto_borrado} color={colors.error} />
            )}

            <Divider sx={{ my: "14px", borderColor: colors.border }} />

            <Row label="Suma pagada a especialistas (lo que ves sumando todos)" value={data.suma_pagado_por_especialistas} bold color={colors.primaryDark} tint={colors.goldSoft} />

            <Box sx={{ mt: "16px" }}>
              <Typography sx={{ fontFamily: fonts.title, fontWeight: 600, color: colors.primaryDark, fontSize: "15px", mb: "6px" }}>
                Detalle por especialista
              </Typography>
              {(data.detalle_por_especialista || []).map((e) => (
                <Box key={e.id} sx={{ display: "flex", justifyContent: "space-between", py: "6px", borderBottom: `1px solid ${colors.border}` }}>
                  <Typography sx={{ fontFamily: fonts.body, fontSize: "13px", color: colors.textBody }}>{e.nombre}</Typography>
                  <Typography sx={{ fontFamily: fonts.body, fontSize: "13px", fontWeight: 700, color: colors.primaryDark }}>{formatMoney(e.pagado_total)}</Typography>
                </Box>
              ))}
            </Box>

            <Alert severity="info" sx={{ borderRadius: "12px", mt: "16px", bgcolor: colors.creamPanel, color: colors.textBody, "& .MuiAlert-icon": { color: colors.primary } }}>
              La diferencia con el total de Finanzas es normal: Finanzas incluye <strong>paquetes, consultas directas, tratamientos antiguos y presupuestos sin especialista</strong>, que no se reparten entre especialistas.
            </Alert>
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ px: "24px", pb: "18px" }}>
        <Button onClick={onClose} sx={{ color: colors.textMuted, textTransform: "none", fontFamily: fonts.body }}>Cerrar</Button>
      </DialogActions>
    </Dialog>
  );
}

/* ======================================================================
   DIALOG: EDITAR % DE COMISIÓN POR DEFECTO DEL ESPECIALISTA
====================================================================== */
function PorcentajeEspecialistaDialog({ especialista, onClose, onSave }) {
  const [pct, setPct] = useState("20");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (especialista) setPct(String(Number(especialista.comision_porcentaje) ?? 20));
  }, [especialista]);

  if (!especialista) return null;

  const valido = !isNaN(parseFloat(pct)) && parseFloat(pct) >= 0 && parseFloat(pct) <= 100;

  return (
    <Dialog open={!!especialista} onClose={onClose} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: "18px" } }}>
      <DialogTitle sx={{ fontFamily: fonts.title, fontWeight: 700, color: colors.primaryDark, fontSize: "22px" }}>
        Comisión de {especialista.nombre}
      </DialogTitle>
      <DialogContent>
        <Typography sx={{ fontFamily: fonts.body, fontSize: "13px", color: colors.textMuted, mb: "16px" }}>
          Este porcentaje se aplica sobre el precio final de todos los presupuestos del especialista (salvo que un presupuesto tenga un porcentaje propio).
        </Typography>
        <Box sx={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <Box component="input" type="number" min="0" max="100" step="1" value={pct} autoFocus
            onChange={(e) => setPct(e.target.value)}
            sx={{ width: 120, fontFamily: fonts.title, fontSize: "28px", fontWeight: 700, color: colors.primaryDark, textAlign: "center", border: `1px solid ${valido ? colors.border : colors.error}`, borderRadius: "12px", padding: "10px", outline: "none" }} />
          <Typography sx={{ fontFamily: fonts.title, fontSize: "28px", fontWeight: 700, color: colors.gold }}>%</Typography>
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: "24px", pb: "18px" }}>
        <Button onClick={onClose} sx={{ color: colors.textMuted, textTransform: "none", fontFamily: fonts.body }}>Cancelar</Button>
        <Button
          variant="contained" disabled={!valido || saving}
          onClick={async () => { setSaving(true); try { await onSave(parseFloat(pct)); } finally { setSaving(false); } }}
          sx={{ background: grads.brown, color: "#fff", textTransform: "none", borderRadius: "10px", fontFamily: fonts.body, fontWeight: 600, boxShadow: "none", "&:hover": { boxShadow: "none", opacity: 0.92 } }}
        >
          {saving ? "Guardando..." : "Guardar"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/* ======================================================================
   GESTOR: COMISIONES POR TRATAMIENTO (precio fijo global / porcentaje)
====================================================================== */
function TratamientosComisionDialog({ open, onClose, onSaved }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busca, setBusca] = useState("");
  const [savingId, setSavingId] = useState(null);
  const [drafts, setDrafts] = useState({}); // { [id]: { tipo, fijo } }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch("/tratamientos-comision");
      setRows(data);
      const d = {};
      data.forEach((t) => { d[t.id] = { tipo: t.comision_tipo === "fijo" ? "fijo" : "porcentaje", fijo: String(t.comision_fija ?? 0) }; });
      setDrafts(d);
    } catch (e) { /* noop */ }
    setLoading(false);
  }, []);

  useEffect(() => { if (open) load(); }, [open, load]);

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((t) =>
      (t.nombre || "").toLowerCase().includes(q) ||
      (t.procedimiento || "").toLowerCase().includes(q)
    );
  }, [rows, busca]);

  const setDraft = (id, patch) => setDrafts((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));

  const guardar = async (t) => {
    const d = drafts[t.id] || {};
    let payload;
    if (d.tipo === "fijo") {
      const n = parseFloat(d.fijo);
      if (isNaN(n) || n < 0) return;
      payload = { comision_tipo: "fijo", comision_fija: n };
    } else {
      payload = { comision_tipo: "porcentaje" };
    }
    setSavingId(t.id);
    try {
      await apiFetch(`/tratamientos/${t.id}/comision`, { method: "PUT", body: JSON.stringify(payload) });
      setRows((prev) => prev.map((r) => r.id === t.id ? { ...r, comision_tipo: payload.comision_tipo, comision_fija: payload.comision_fija ?? 0 } : r));
      if (onSaved) onSaved();
    } finally { setSavingId(null); }
  };

  const smallInput = {
    width: 110, fontFamily: fonts.body, fontSize: "13px", fontWeight: 700, color: colors.primaryDark,
    border: `1px solid ${colors.border}`, borderRadius: "8px", padding: "7px 10px", outline: "none", boxSizing: "border-box"
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth PaperProps={{ sx: { borderRadius: "18px" } }}>
      <DialogTitle sx={{ fontFamily: fonts.title, fontWeight: 700, color: colors.primaryDark, fontSize: "24px", pb: "4px" }}>
        Comisiones por tratamiento
      </DialogTitle>
      <DialogContent>
        <Typography sx={{ fontFamily: fonts.body, fontSize: "13px", color: colors.textMuted, mb: "14px" }}>
          Define un <strong>precio fijo</strong> de comisión por tratamiento (por ejemplo, un monto plano por procedimiento) o deja el
          <strong> porcentaje</strong> (20% del presupuesto por defecto). El cambio se aplica a las líneas aún no culminadas.
        </Typography>
        <Box component="input" placeholder="Buscar tratamiento..." value={busca} onChange={(e) => setBusca(e.target.value)}
          sx={{ width: "100%", fontFamily: fonts.body, fontSize: "14px", color: colors.textBody, border: `1px solid ${colors.border}`, borderRadius: "10px", padding: "10px 14px", outline: "none", boxSizing: "border-box", mb: "14px" }} />

        {loading && <LinearProgress sx={{ mb: "12px", borderRadius: 2, bgcolor: colors.border, "& .MuiLinearProgress-bar": { bgcolor: colors.gold } }} />}

        <Box sx={{ maxHeight: 420, overflowY: "auto", pr: "4px" }}>
          {filtradas.map((t) => {
            const d = drafts[t.id] || { tipo: "porcentaje", fijo: "0" };
            const dirty = (d.tipo !== (t.comision_tipo === "fijo" ? "fijo" : "porcentaje")) ||
              (d.tipo === "fijo" && parseFloat(d.fijo || 0) !== Number(t.comision_fija || 0));
            return (
              <Box key={t.id} sx={{ display: "flex", alignItems: "center", gap: "12px", py: "10px", borderBottom: `1px solid ${colors.border}`, flexWrap: "wrap" }}>
                <Box sx={{ flex: 1, minWidth: 180 }}>
                  <Typography sx={{ fontFamily: fonts.body, fontWeight: 700, fontSize: "13.5px", color: colors.primaryDark }}>{t.nombre}</Typography>
                  <Box sx={{ display: "flex", alignItems: "center", gap: "8px", mt: "2px" }}>
                    <CategoriaChip categoria={t.procedimiento} />
                    <Typography sx={{ fontFamily: fonts.body, fontSize: "11.5px", color: colors.textMuted }}>
                      Precio ref.: <strong style={{ color: colors.primary }}>{formatMoney(t.precio)}</strong>
                    </Typography>
                  </Box>
                </Box>

                <Box sx={{ display: "flex", gap: "6px" }}>
                  {["porcentaje", "fijo"].map((tp) => (
                    <Box key={tp} onClick={() => setDraft(t.id, { tipo: tp })} sx={{
                      cursor: "pointer", px: "12px", py: "6px", borderRadius: "8px", fontFamily: fonts.body, fontWeight: 700, fontSize: "12px",
                      display: "flex", alignItems: "center", gap: "5px",
                      border: `1px solid ${d.tipo === tp ? colors.gold : colors.border}`,
                      bgcolor: d.tipo === tp ? colors.goldSoft : colors.white,
                      color: d.tipo === tp ? colors.primaryDark : colors.textMuted
                    }}>
                      {tp === "porcentaje" ? <><PercentRounded sx={{ fontSize: 14 }} />20%</> : <><PaidRounded sx={{ fontSize: 14 }} />Fijo</>}
                    </Box>
                  ))}
                </Box>

                {d.tipo === "fijo" ? (
                  <Box component="input" type="number" min="0" step="10" value={d.fijo}
                    onChange={(e) => setDraft(t.id, { fijo: e.target.value })} sx={smallInput} placeholder="S/ 0" />
                ) : (
                  <Typography sx={{ width: 110, fontFamily: fonts.body, fontSize: "12px", color: colors.textMuted, textAlign: "center" }}>
                    {formatMoney(t.precio * 0.2)}
                  </Typography>
                )}

                <Button size="small" disabled={!dirty || savingId === t.id} onClick={() => guardar(t)}
                  variant="contained" sx={{ minWidth: 84, background: dirty ? grads.brown : colors.border, color: dirty ? "#fff" : colors.textMuted, textTransform: "none", borderRadius: "8px", fontFamily: fonts.body, fontWeight: 600, boxShadow: "none", "&:hover": { boxShadow: "none", opacity: 0.92 } }}>
                  {savingId === t.id ? "..." : "Guardar"}
                </Button>
              </Box>
            );
          })}
          {!loading && filtradas.length === 0 && (
            <Typography sx={{ fontFamily: fonts.body, fontSize: "13px", color: colors.textMuted, textAlign: "center", py: "20px" }}>
              No se encontraron tratamientos.
            </Typography>
          )}
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: "24px", pb: "18px" }}>
        <Button onClick={onClose} sx={{ color: colors.textMuted, textTransform: "none", fontFamily: fonts.body }}>Cerrar</Button>
      </DialogActions>
    </Dialog>
  );
}

function EspecialistaDetalleView({ detalle, onBack, onEditEspecialistaComision, onEditPresupuestoComision }) {
  const { especialista, resumen, presupuestos = [] } = detalle;
  const [pctEspOpen, setPctEspOpen] = useState(false);
  const [presEdit, setPresEdit] = useState(null);
  const [filtros, setFiltros] = useState([]); // ["pagado", "pendiente", "sesiones_completas"]

  const toggleFiltro = (f) => setFiltros((prev) => prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]);

  // Filtrar presupuestos según los filtros activos (AND: debe cumplir TODOS los seleccionados)
  const filteredPresupuestos = useMemo(() => {
    if (filtros.length === 0) return presupuestos;
    return presupuestos.filter((p) => {
      if (filtros.includes("pagado") && p.estado_pago !== "pagado") return false;
      if (filtros.includes("pendiente") && p.estado_pago !== "pendiente" && p.estado_pago !== "adelanto" && p.estado_pago !== "pendiente_pago") return false;
      if (filtros.includes("sesiones_completas") && !(Number(p.sesiones_completadas) > 0 && Number(p.sesiones_completadas) >= Number(p.sesiones_totales))) return false;
      return true;
    });
  }, [presupuestos, filtros]);

  // Recalcular KPIs según lo filtrado
  const kpisCalc = useMemo(() => {
    const list = filtros.length === 0 ? presupuestos : filteredPresupuestos;
    let baseTotal = 0, comisionTotal = 0, pagadoTotal = 0;
    for (const p of list) {
      baseTotal += Number(p.base_comision) || 0;
      comisionTotal += Number(p.comision_estimada) || 0;
      pagadoTotal += Number(p.monto_pagado_real) || 0;
    }
    return { num: list.length, baseTotal, comisionTotal, pagadoTotal };
  }, [presupuestos, filteredPresupuestos, filtros]);

  const filtroChipSx = (activo) => ({
    fontFamily: fonts.body, fontWeight: 600, fontSize: "0.75rem", height: 30, borderRadius: "10px", cursor: "pointer", transition: "all 0.2s",
    ...(activo
      ? { bgcolor: colors.primaryDark, color: "#fff", border: `1px solid ${colors.primaryDark}`, "&:hover": { bgcolor: colors.primary } }
      : { bgcolor: colors.white, color: colors.textBody, border: `1px solid ${colors.border}`, "&:hover": { bgcolor: colors.creamPanel } })
  });

  return (
    <Box>
      <Button startIcon={<ArrowBack />} onClick={onBack} sx={{ mb: "16px", color: colors.primary, fontFamily: fonts.body, textTransform: "none", borderRadius: "10px" }}>Volver</Button>

      {/* Header especialista */}
      <Card sx={{ ...cardSx, mb: "20px", p: 0 }}>
        <CardContent sx={{ p: "24px" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: "14px", mb: "20px", flexWrap: "wrap" }}>
            <Avatar sx={{ bgcolor: colors.primary, width: 56, height: 56, fontSize: 24, fontFamily: fonts.title, fontWeight: 700 }}>
              {especialista.nombre?.charAt(0)?.toUpperCase()}
            </Avatar>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ fontFamily: fonts.title, color: colors.primaryDark, fontWeight: 700, fontSize: "24px" }}>
                {especialista.nombre}
              </Typography>
              <Typography sx={{ color: colors.textMuted, fontSize: "13px", fontFamily: fonts.body }}>
                {especialista.tipo || "Especialista"} · {especialista.especialidad || "General"}
              </Typography>
              {especialista.cuenta_bancaria && (
                <Typography sx={{ color: colors.textMuted, fontSize: "12px", fontFamily: fonts.body }}>
                  Cuenta: {especialista.cuenta_bancaria}
                </Typography>
              )}
            </Box>
            <Button
              onClick={() => setPctEspOpen(true)}
              startIcon={<PercentRounded sx={{ fontSize: 16 }} />}
              sx={{ fontFamily: fonts.body, textTransform: "none", borderRadius: "12px", fontWeight: 700, color: colors.primaryDark, border: `1px solid ${colors.gold}`, bgcolor: colors.goldSoft, px: "16px", py: "8px", "&:hover": { bgcolor: colors.gold, color: colors.white } }}
            >
              Comisión: {Number(especialista.comision_porcentaje)}%
            </Button>
          </Box>

          {/* KPIs del especialista (dinámicos según filtro) */}
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", sm: "repeat(4, 1fr)" }, gap: "12px" }}>
            {[
              { label: "Presupuestos", value: kpisCalc.num, color: colors.primaryDark, bg: colors.creamPanel },
              { label: "Facturación (con desc.)", value: formatMoney(kpisCalc.baseTotal), color: colors.primary, bg: colors.creamPanel },
              { label: "Pagado por pacientes", value: formatMoney(kpisCalc.pagadoTotal), color: colors.successText, bg: colors.successBg },
              { label: "Pago al especialista", value: formatMoney(kpisCalc.comisionTotal), color: colors.primaryDark, bg: colors.goldSoft }
            ].map((kpi, i) => (
              <Box key={i} sx={{ textAlign: "center", p: "14px", bgcolor: kpi.bg, borderRadius: "14px" }}>
                <Typography sx={{ color: colors.textMuted, fontWeight: 500, fontSize: "11px", fontFamily: fonts.body, mb: "2px" }}>{kpi.label}</Typography>
                <Typography sx={{ fontWeight: 700, color: kpi.color, fontFamily: fonts.title, fontSize: "20px", lineHeight: 1.2 }}>{kpi.value}</Typography>
              </Box>
            ))}
          </Box>
        </CardContent>
      </Card>

      {/* Filtros + título */}
      <Box sx={{ display: "flex", alignItems: "center", gap: "10px", mb: "14px", flexWrap: "wrap" }}>
        <Typography sx={{ fontFamily: fonts.title, fontSize: "20px", fontWeight: 600, color: colors.primaryDark }}>Presupuestos</Typography>
        <Chip label={filteredPresupuestos.length} size="small" sx={{ bgcolor: colors.goldSoft, color: colors.primaryDark, fontWeight: 700, fontFamily: fonts.body, height: 22, fontSize: "0.7rem" }} />
        <Box sx={{ flex: 1 }} />
        <Box sx={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <Chip label="Pagado" onClick={() => toggleFiltro("pagado")} sx={filtroChipSx(filtros.includes("pagado"))} />
          <Chip label="Pendiente" onClick={() => toggleFiltro("pendiente")} sx={filtroChipSx(filtros.includes("pendiente"))} />
          <Chip label="Sesiones completas" onClick={() => toggleFiltro("sesiones_completas")} sx={filtroChipSx(filtros.includes("sesiones_completas"))} />
        </Box>
      </Box>

      {filtros.length > 0 && (
        <Typography sx={{ fontFamily: fonts.body, fontSize: "12px", color: colors.textMuted, mb: "10px" }}>
          Mostrando {filteredPresupuestos.length} de {presupuestos.length} presupuestos · Pago filtrado: <strong>{formatMoney(kpisCalc.comisionTotal)}</strong>
        </Typography>
      )}

      {filteredPresupuestos.map((pres, i) => (
        <PresupuestoComisionCard
          key={pres.id}
          pres={pres}
          index={i}
          pctDefault={Number(especialista.comision_porcentaje)}
          onEditPct={() => setPresEdit(pres)}
        />
      ))}

      {filteredPresupuestos.length === 0 && (
        <Alert severity="info" sx={{ mt: "8px", borderRadius: "12px" }}>
          {filtros.length > 0
            ? "No hay presupuestos que coincidan con los filtros seleccionados."
            : "Este especialista no tiene presupuestos asignados en el periodo seleccionado."}
        </Alert>
      )}

      <PorcentajeEspecialistaDialog
        especialista={pctEspOpen ? especialista : null}
        onClose={() => setPctEspOpen(false)}
        onSave={async (pct) => { await onEditEspecialistaComision(especialista.id, pct); setPctEspOpen(false); }}
      />

      <PorcentajePresupuestoDialog
        pres={presEdit}
        pctDefault={Number(especialista.comision_porcentaje)}
        onClose={() => setPresEdit(null)}
        onSave={async (pct) => { await onEditPresupuestoComision(presEdit.id, pct); setPresEdit(null); }}
      />
    </Box>
  );
}

/* ======================================================================
   TARJETA: PRESUPUESTO CON COMISIÓN (base = precio final con descuento)
====================================================================== */
function PresupuestoComisionCard({ pres, index, pctDefault, onEditPct }) {
  const [open, setOpen] = useState(false);
  const paciente = `${pres.paciente_nombre || "Paciente"} ${pres.paciente_apellido || ""}`.trim();
  const precioTotal = Number(pres.precio_total) || 0;
  const descuento = Number(pres.descuento) || 0;
  const base = Number(pres.base_comision) || 0;
  const pct = Number(pres.comision_porcentaje_efectivo);
  const comision = Number(pres.comision_estimada) || 0;
  const fecha = (pres.creado_en || "").slice(0, 10);

  const estadoPagoStyle = pres.estado_pago === "pagado"
    ? { bg: colors.successBg, text: colors.successText, label: "Pagado" }
    : pres.estado_pago === "adelanto"
    ? { bg: colors.amberBg, text: colors.amberText, label: "Adelanto" }
    : { bg: colors.creamPanel, text: colors.textMuted, label: "Pendiente" };

  return (
    <MotionBox
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, delay: Math.min(index * 0.04, 0.3) }}
    >
      <Card sx={{ ...cardSx, mb: "12px", p: 0 }}>
        <CardContent sx={{ p: "18px", "&:last-child": { pb: "18px" } }}>
          {/* Encabezado */}
          <Box sx={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
            <Avatar sx={{ width: 38, height: 38, bgcolor: colors.goldSoft, color: colors.primaryDark, fontFamily: fonts.title, fontWeight: 700, fontSize: 15 }}>
              {paciente.charAt(0)?.toUpperCase()}
            </Avatar>
            <Box sx={{ flex: 1, minWidth: 140 }}>
              <Typography sx={{ fontFamily: fonts.body, fontWeight: 700, fontSize: "14.5px", color: colors.primaryDark }}>{paciente}</Typography>
              <Box sx={{ display: "flex", alignItems: "center", gap: "8px", mt: "2px", flexWrap: "wrap" }}>
                <Typography sx={{ fontFamily: fonts.body, fontSize: "11.5px", color: colors.textMuted }}>#{pres.id} · {fecha}</Typography>
                <Chip label={estadoPagoStyle.label} size="small" sx={{ bgcolor: estadoPagoStyle.bg, color: estadoPagoStyle.text, fontWeight: 700, fontFamily: fonts.body, height: 20, fontSize: "0.64rem" }} />
                <Chip label={`${pres.sesiones_completadas || 0}/${pres.sesiones_totales || 0} sesiones`} size="small" sx={{ bgcolor: colors.creamPanel, color: colors.textMuted, border: `1px solid ${colors.border}`, fontWeight: 600, fontFamily: fonts.body, height: 20, fontSize: "0.64rem" }} />
              </Box>
            </Box>
            <Box sx={{ textAlign: "right" }}>
              <Typography sx={{ fontFamily: fonts.body, fontSize: "10.5px", color: colors.textMuted, textTransform: "uppercase", letterSpacing: "0.5px" }}>Comisión</Typography>
              <Typography sx={{ fontFamily: fonts.title, fontWeight: 700, fontSize: "22px", color: colors.primaryDark, lineHeight: 1.1 }}>{formatMoney(comision)}</Typography>
            </Box>
          </Box>

          {/* Cálculo de comisión */}
          <Box sx={{ mt: "14px", p: "12px 14px", borderRadius: "14px", bgcolor: colors.creamPanel, border: `1px solid ${colors.border}` }}>
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", sm: "repeat(4, 1fr)" }, gap: "10px" }}>
              <Box>
                <Typography sx={{ fontSize: "10.5px", color: colors.textMuted, fontFamily: fonts.body }}>Precio total</Typography>
                <Typography sx={{ fontFamily: fonts.body, fontWeight: 600, fontSize: "13.5px", color: colors.textBody }}>{formatMoney(precioTotal)}</Typography>
              </Box>
              <Box>
                <Typography sx={{ fontSize: "10.5px", color: colors.textMuted, fontFamily: fonts.body }}>Descuento</Typography>
                <Typography sx={{ fontFamily: fonts.body, fontWeight: 600, fontSize: "13.5px", color: descuento > 0 ? colors.error : colors.textBody }}>
                  {descuento > 0 ? `- ${formatMoney(descuento)}` : formatMoney(0)}
                </Typography>
              </Box>
              <Box>
                <Typography sx={{ fontSize: "10.5px", color: colors.textMuted, fontFamily: fonts.body }}>Precio final (base)</Typography>
                <Typography sx={{ fontFamily: fonts.body, fontWeight: 700, fontSize: "13.5px", color: colors.primary }}>{formatMoney(base)}</Typography>
              </Box>
              <Box>
                <Typography sx={{ fontSize: "10.5px", color: colors.textMuted, fontFamily: fonts.body }}>Porcentaje</Typography>
                <Box sx={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <Typography sx={{ fontFamily: fonts.body, fontWeight: 700, fontSize: "13.5px", color: colors.primaryDark }}>{pct}%</Typography>
                  {pres.usa_override && (
                    <Chip label="propio" size="small" sx={{ height: 16, fontSize: "0.6rem", fontFamily: fonts.body, bgcolor: colors.goldSoft, color: colors.primaryDark, "& .MuiChip-label": { px: "6px" } }} />
                  )}
                </Box>
              </Box>
            </Box>
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mt: "10px", pt: "10px", borderTop: `1px dashed ${colors.border}` }}>
              <Typography sx={{ fontFamily: fonts.body, fontSize: "12px", color: colors.textMuted }}>
                {formatMoney(base)} × {pct}% = <strong style={{ color: colors.primaryDark }}>{formatMoney(comision)}</strong>
              </Typography>
              <Button
                size="small" onClick={onEditPct} startIcon={<PercentRounded sx={{ fontSize: 14 }} />}
                sx={{ fontFamily: fonts.body, textTransform: "none", fontSize: "12px", fontWeight: 600, color: colors.primary, borderRadius: "8px", "&:hover": { bgcolor: colors.goldSoft } }}
              >
                Editar %
              </Button>
            </Box>
          </Box>

          {/* Tratamientos del presupuesto */}
          {pres.tratamientos && pres.tratamientos.length > 0 && (
            <Box sx={{ mt: "10px" }}>
              <Button
                size="small" onClick={() => setOpen(!open)} endIcon={<ExpandMore sx={{ fontSize: 18, transform: open ? "rotate(180deg)" : "none", transition: "0.2s" }} />}
                sx={{ fontFamily: fonts.body, textTransform: "none", fontSize: "12px", color: colors.textMuted, p: 0, "&:hover": { bgcolor: "transparent", color: colors.primary } }}
              >
                {pres.tratamientos.length} {pres.tratamientos.length === 1 ? "tratamiento" : "tratamientos"}
              </Button>
              <Collapse in={open}>
                <Box sx={{ mt: "8px" }}>
                  {pres.tratamientos.map((t, ti) => (
                    <Box key={ti} sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", py: "6px", borderTop: ti > 0 ? `1px solid ${colors.border}` : "none" }}>
                      <Typography sx={{ fontFamily: fonts.body, fontSize: "12.5px", color: colors.textBody }}>
                        {t.nombre} {t.sesiones > 1 && <span style={{ color: colors.textMuted }}>({t.sesiones} sesiones)</span>}
                      </Typography>
                      <Typography sx={{ fontFamily: fonts.body, fontSize: "12.5px", fontWeight: 600, color: colors.primary }}>{formatMoney(t.precio)}</Typography>
                    </Box>
                  ))}
                </Box>
              </Collapse>
            </Box>
          )}
        </CardContent>
      </Card>
    </MotionBox>
  );
}

/* ======================================================================
   DIALOG: EDITAR % DE COMISIÓN DE UN PRESUPUESTO (override)
====================================================================== */
function PorcentajePresupuestoDialog({ pres, pctDefault, onClose, onSave }) {
  const [pct, setPct] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (pres) setPct(pres.usa_override ? String(Number(pres.comision_porcentaje)) : "");
  }, [pres]);

  if (!pres) return null;

  const usandoDefault = pct === "";
  const valido = usandoDefault || (!isNaN(parseFloat(pct)) && parseFloat(pct) >= 0 && parseFloat(pct) <= 100);
  const base = Number(pres.base_comision) || 0;
  const pctEfectivo = usandoDefault ? pctDefault : parseFloat(pct) || 0;
  const preview = base * (pctEfectivo / 100);

  return (
    <Dialog open={!!pres} onClose={onClose} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: "18px" } }}>
      <DialogTitle sx={{ fontFamily: fonts.title, fontWeight: 700, color: colors.primaryDark, fontSize: "22px", pb: "4px" }}>
        Comisión del presupuesto
      </DialogTitle>
      <DialogContent>
        <Typography sx={{ fontFamily: fonts.body, fontSize: "13px", color: colors.textMuted, mb: "16px" }}>
          Aplica un porcentaje propio para este presupuesto, o déjalo vacío para usar el {pctDefault}% del especialista.
        </Typography>
        <Box sx={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <Box component="input" type="number" min="0" max="100" step="1" value={pct} autoFocus
            placeholder={String(pctDefault)}
            onChange={(e) => setPct(e.target.value)}
            sx={{ width: 130, fontFamily: fonts.title, fontSize: "26px", fontWeight: 700, color: colors.primaryDark, textAlign: "center", border: `1px solid ${valido ? colors.border : colors.error}`, borderRadius: "12px", padding: "10px", outline: "none" }} />
          <Typography sx={{ fontFamily: fonts.title, fontSize: "26px", fontWeight: 700, color: colors.gold }}>%</Typography>
          {!usandoDefault && (
            <Button size="small" onClick={() => setPct("")} sx={{ fontFamily: fonts.body, textTransform: "none", fontSize: "12px", color: colors.textMuted }}>
              Usar {pctDefault}%
            </Button>
          )}
        </Box>
        <Box sx={{ mt: "16px", p: "12px 14px", borderRadius: "12px", bgcolor: colors.creamPanel, border: `1px solid ${colors.border}` }}>
          <Typography sx={{ fontFamily: fonts.body, fontSize: "13px", color: colors.textMuted }}>
            {formatMoney(base)} × {pctEfectivo}% = <strong style={{ color: colors.primaryDark, fontSize: "15px" }}>{formatMoney(preview)}</strong>
          </Typography>
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: "24px", pb: "18px" }}>
        <Button onClick={onClose} sx={{ color: colors.textMuted, textTransform: "none", fontFamily: fonts.body }}>Cancelar</Button>
        <Button
          variant="contained" disabled={!valido || saving}
          onClick={async () => { setSaving(true); try { await onSave(usandoDefault ? null : parseFloat(pct)); } finally { setSaving(false); } }}
          sx={{ background: grads.brown, color: "#fff", textTransform: "none", borderRadius: "10px", fontFamily: fonts.body, fontWeight: 600, boxShadow: "none", "&:hover": { boxShadow: "none", opacity: 0.92 } }}
        >
          {saving ? "Guardando..." : "Guardar"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/* ======================================================================
   VISTA LIQUIDACIONES
====================================================================== */
function LiquidacionesView({ pendientes, historial, onLiquidar }) {
  const thSx = { fontWeight: 600, fontFamily: fonts.body, fontSize: "11px", textTransform: "uppercase", color: colors.textMuted, letterSpacing: "0.5px", borderBottom: `1px solid ${colors.border}`, py: "10px" };
  const tdSx = { fontFamily: fonts.body, fontSize: "13px", color: colors.textBody, borderBottom: `1px solid ${colors.border}`, py: "11px" };

  return (
    <Box>
      <SectionTitle>Comisiones Pendientes de Pago</SectionTitle>

      {pendientes.length === 0 && (
        <Alert severity="info" sx={{ borderRadius: "12px", fontFamily: fonts.body }}>No hay comisiones pendientes de liquidar</Alert>
      )}

      {pendientes.map((esp) => (
        <Card key={esp.especialista_id} sx={{ ...cardSx, mb: "14px", p: 0 }}>
          <CardContent sx={{ p: "20px" }}>
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: "10px" }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <Avatar sx={{ bgcolor: colors.primary, fontFamily: fonts.title, fontWeight: 700 }}>{esp.especialista_nombre?.charAt(0)?.toUpperCase()}</Avatar>
                <Box>
                  <Typography sx={{ fontWeight: 700, fontFamily: fonts.body, fontSize: "14px", color: colors.primaryDark }}>{esp.especialista_nombre}</Typography>
                  <Typography sx={{ fontSize: "12px", color: colors.textMuted, fontFamily: fonts.body }}>{esp.num_comisiones} comisiones pendientes</Typography>
                </Box>
              </Box>
              <Box sx={{ textAlign: "right" }}>
                <Typography sx={{ fontWeight: 700, color: colors.amberText, fontFamily: fonts.title, fontSize: "22px" }}>
                  {formatMoney(esp.monto_total_pendiente)}
                </Typography>
                <Button
                  size="small"
                  variant="contained"
                  sx={{ bgcolor: colors.primary, "&:hover": { bgcolor: colors.hover }, mt: "4px", fontFamily: fonts.body, textTransform: "none", borderRadius: "10px", boxShadow: "none", fontSize: "0.8rem" }}
                  onClick={() => onLiquidar(esp)}
                >
                  Liquidar
                </Button>
              </Box>
            </Box>
            {/* Detalle de comisiones */}
            <Box sx={{ mt: "8px" }}>
              {esp.detalle?.map((d, i) => (
                <Box key={d.comision_id} sx={{ display: "flex", justifyContent: "space-between", py: "5px", borderTop: i > 0 ? `1px solid ${colors.border}` : "none" }}>
                  <Typography sx={{ fontSize: "12px", fontFamily: fonts.body, color: colors.textBody }}>
                    {d.tratamiento_nombre} — {d.paciente_nombre} {d.paciente_apellido}
                  </Typography>
                  <Typography sx={{ fontSize: "12px", fontFamily: fonts.body, fontWeight: 700, color: colors.primary }}>{formatMoney(d.monto)}</Typography>
                </Box>
              ))}
            </Box>
          </CardContent>
        </Card>
      ))}

      {/* Historial */}
      {historial.length > 0 && (
        <Box sx={{ mt: "28px" }}>
          <SectionTitle>Historial de Liquidaciones</SectionTitle>
          <Card sx={{ ...cardSx, p: 0 }}>
            <CardContent sx={{ p: "20px" }}>
              <Table size="small" sx={{ tableLayout: "auto" }}>
                <TableHead>
                  <TableRow>
                    <TableCell sx={thSx}>Especialista</TableCell>
                    <TableCell sx={{ ...thSx, width: 100 }}>Fecha</TableCell>
                    <TableCell sx={{ ...thSx, width: 120 }}>Método</TableCell>
                    <TableCell align="right" sx={{ ...thSx, width: 110 }}>Monto</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {historial.map((l) => (
                    <TableRow key={l.id} hover sx={{ "&:hover": { bgcolor: colors.creamPanel } }}>
                      <TableCell sx={{ ...tdSx, fontWeight: 500 }}>{l.especialista_nombre}</TableCell>
                      <TableCell sx={tdSx}>{l.fecha}</TableCell>
                      <TableCell sx={tdSx}>
                        <Chip label={l.metodo_pago || "—"} size="small" sx={{ height: 22, fontSize: "0.7rem", fontFamily: fonts.body, bgcolor: colors.creamPanel, color: colors.textBody, border: `1px solid ${colors.border}` }} />
                      </TableCell>
                      <TableCell align="right" sx={{ ...tdSx, fontWeight: 700, color: colors.primary }}>{formatMoney(l.monto_total)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </Box>
      )}
    </Box>
  );
}

/* ======================================================================
   DIALOG LIQUIDAR
====================================================================== */
function LiquidarDialog({ open, espData, onClose, onConfirm }) {
  const [metodo, setMetodo] = useState("transferencia");

  if (!espData) return null;

  const comisionIds = espData.detalle?.map(d => d.comision_id) || [];

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: "16px" } }}>
      <DialogTitle sx={{ fontFamily: fonts.title, fontWeight: 700, color: colors.primaryDark, fontSize: "22px" }}>
        Liquidar Comisiones — {espData.especialista_nombre}
      </DialogTitle>
      <DialogContent>
        <Typography sx={{ mb: "12px", fontFamily: fonts.body, fontSize: "14px", color: colors.textBody }}>
          <strong>Monto total:</strong> {formatMoney(espData.monto_total_pendiente)}
        </Typography>
        <Typography sx={{ mb: "14px", fontFamily: fonts.body, fontSize: "13px", color: colors.textMuted }}>
          {espData.num_comisiones} comisiones se marcarán como liquidadas.
        </Typography>
        {espData.cuenta_bancaria && (
          <Alert severity="info" sx={{ mb: "14px", borderRadius: "12px", fontFamily: fonts.body }}>Cuenta bancaria: {espData.cuenta_bancaria}</Alert>
        )}
        <FormControl fullWidth size="small" sx={{ "& .MuiOutlinedInput-root": { borderRadius: "10px", fontFamily: fonts.body, "& fieldset": { borderColor: colors.border } } }}>
          <InputLabel sx={{ fontFamily: fonts.body }}>Método de Pago</InputLabel>
          <Select value={metodo} onChange={(e) => setMetodo(e.target.value)} label="Método de Pago">
            <MenuItem value="transferencia">Transferencia</MenuItem>
            <MenuItem value="efectivo">Efectivo</MenuItem>
            <MenuItem value="yape">Yape/Plin</MenuItem>
          </Select>
        </FormControl>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} sx={{ color: colors.textMuted, fontFamily: fonts.body }}>Cancelar</Button>
        <Button
          variant="contained"
          sx={{ bgcolor: colors.primary, "&:hover": { bgcolor: colors.hover }, fontFamily: fonts.body, borderRadius: "10px", textTransform: "none", boxShadow: "none" }}
          onClick={() => onConfirm(espData.especialista_id, comisionIds, metodo)}
        >
          Confirmar Liquidación
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/* ======================================================================
   HELPERS
====================================================================== */
function EstadoChip({ estado }) {
  const config = {
    pendiente: { label: "Pendiente", sx: { bgcolor: colors.creamPanel, color: colors.textMuted, border: `1px solid ${colors.border}` } },
    en_curso: { label: "En Curso", sx: { bgcolor: colors.amberBg, color: colors.amberText, border: "none" } },
    listo_para_culminar: { label: "Listo", sx: { bgcolor: colors.amberBg, color: colors.amberText, border: "none" } },
    culminado: { label: "Culminado", sx: { bgcolor: colors.successBg, color: colors.successText, border: `1px solid ${colors.successBorder}` } },
    activo: { label: "Activo", sx: { bgcolor: colors.goldSoft + "88", color: colors.primaryDark, border: "none" } },
    anulado: { label: "Anulado", sx: { bgcolor: "#FDECEA", color: colors.error, border: "none" } },
    borrador: { label: "Borrador", sx: { bgcolor: colors.creamPanel, color: colors.textMuted, border: `1px solid ${colors.border}` } }
  };
  const c = config[estado] || { label: estado, sx: { bgcolor: colors.creamPanel, color: colors.textMuted } };
  return <Chip label={c.label} size="small" sx={{ fontSize: "0.7rem", height: 22, fontWeight: 600, fontFamily: fonts.body, ...c.sx }} />;
}
