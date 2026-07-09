import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box, Typography, Card, CardContent, Grid,
  Button, Chip, Avatar, Divider, IconButton,
  Dialog, DialogTitle, DialogContent, DialogActions,
  Table, TableBody, TableCell, TableHead, TableRow,
  Tabs, Tab, LinearProgress, Select, MenuItem, FormControl,
  InputLabel, Collapse, Alert, Tooltip
} from "@mui/material";
import {
  TrendingUp, People, Receipt, AttachMoney,
  CheckCircle, ExpandMore, ExpandLess,
  AccountBalance, ArrowBack, Refresh, FilterList,
  OpenInNew, VerifiedUser, Warning
} from "@mui/icons-material";

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
  error: "#d32f2f"
};

const fonts = {
  title: "'Cormorant Garamond', serif",
  body: "'DM Sans', sans-serif"
};

const cardSx = {
  bgcolor: colors.white,
  border: `1px solid ${colors.border}`,
  borderRadius: "16px",
  boxShadow: "0 1px 3px rgba(93,64,55,0.05)"
};

function formatMoney(val) {
  return `S/ ${(Number(val) || 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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
      const data = await apiFetch("/dashboard");
      setDashboardData(data);
    } catch (e) { setError(e.message); }
    setLoading(false);
  }, []);

  const loadPresupuestos = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const query = filtroEstado ? `?estado=${filtroEstado}` : "";
      const data = await apiFetch(`/presupuestos${query}`);
      setPresupuestos(data);
    } catch (e) { setError(e.message); }
    setLoading(false);
  }, [filtroEstado]);

  const loadEspecialistas = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch("/especialistas");
      setEspecialistas(data);
    } catch (e) { setError(e.message); }
    setLoading(false);
  }, []);

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

  const loadPresupuestoDetalle = async (id) => {
    try {
      const data = await apiFetch(`/presupuestos/${id}`);
      setPresupuestoDetalle(data);
    } catch (e) { setError(e.message); }
  };

  const loadEspecialistaDetalle = async (id) => {
    try {
      const data = await apiFetch(`/especialistas/${id}/perfil`);
      setEspecialistaDetalle(data);
    } catch (e) { setError(e.message); }
  };

  const handleSync = async () => {
    try {
      await apiFetch("/lineas/sync", { method: "POST" });
      loadPresupuestos();
    } catch (e) { setError(e.message); }
  };

  /* ── RENDER ── */
  return (
    <Box sx={{ minHeight: "100vh", bgcolor: colors.cream, fontFamily: fonts.body, color: colors.textBody }}>
      <Box sx={{ maxWidth: 1280, mx: "auto", px: { xs: 2, md: "28px" }, py: { xs: 2, md: 3 } }}>
      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "center", mb: "20px", gap: 1.5 }}>
        <Typography sx={{ fontFamily: fonts.title, fontWeight: 700, fontSize: "30px", color: colors.primaryDark, lineHeight: 1.2 }}>
          Gestión Clínica
        </Typography>
        <Chip label="Dueño" size="small" sx={{ bgcolor: colors.goldSoft, color: colors.primaryDark, fontWeight: 600, fontFamily: fonts.body, fontSize: "0.75rem", height: 26, borderRadius: "13px" }} />
      </Box>

      {error && <Alert severity="error" onClose={() => setError(null)} sx={{ mb: "18px", borderRadius: "12px" }}>{error}</Alert>}

      {/* Tabs */}
      <Tabs
        value={tab}
        onChange={(e, v) => { setTab(v); setPresupuestoDetalle(null); setEspecialistaDetalle(null); }}
        sx={{
          mb: "20px",
          "& .MuiTab-root": { fontWeight: 600, fontFamily: fonts.body, color: colors.textMuted, textTransform: "none", fontSize: "0.9rem", minHeight: 44 },
          "& .Mui-selected": { color: `${colors.primary} !important` },
          "& .MuiTabs-indicator": { bgcolor: colors.primary, height: 3, borderRadius: "3px 3px 0 0" }
        }}
      >
        <Tab label="Dashboard" icon={<TrendingUp sx={{ fontSize: 18 }} />} iconPosition="start" />
        <Tab label="Presupuestos" icon={<Receipt sx={{ fontSize: 18 }} />} iconPosition="start" />
        <Tab label="Especialistas" icon={<People sx={{ fontSize: 18 }} />} iconPosition="start" />
        <Tab label="Liquidaciones" icon={<AccountBalance sx={{ fontSize: 18 }} />} iconPosition="start" />
      </Tabs>

      {loading && <LinearProgress sx={{ mb: "18px", borderRadius: 2, "& .MuiLinearProgress-bar": { bgcolor: colors.primary } }} />}

      {/* TAB 0: Dashboard */}
      {tab === 0 && dashboardData && <DashboardView data={dashboardData} />}

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
          onCulminar={(linea) => setDialogCulminar(linea)}
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
    </Box>
  );
}

/* ======================================================================
   VISTA DASHBOARD
====================================================================== */
function DashboardView({ data }) {
  const { kpis, ingresos_por_mes, tratamientos_mas_vendidos, pagos_pendientes, ultimos_tratamientos, rendimiento_especialistas } = data;

  const thSx = { fontWeight: 600, fontFamily: fonts.body, fontSize: "11px", textTransform: "uppercase", color: colors.textMuted, letterSpacing: "0.5px", borderBottom: `1px solid ${colors.border}`, py: "10px" };
  const tdSx = { fontFamily: fonts.body, fontSize: "13px", color: colors.textBody, borderBottom: `1px solid ${colors.border}`, py: "11px" };

  return (
    <Box>
      {/* KPIs */}
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(5, 1fr)" }, gap: "16px", mb: "20px" }}>
        <KPICard title="Ingresos Totales" value={formatMoney(kpis.ingresos_totales)} icon={<AttachMoney />} tint="#E8F0EA" iconColor={colors.successText} />
        <KPICard title="Tratamientos" value={kpis.tratamientos_realizados} icon={<CheckCircle />} tint={colors.creamPanel} iconColor={colors.primary} />
        <KPICard title="Pacientes" value={kpis.pacientes_atendidos} icon={<People />} tint="#EDE7F6" iconColor="#5E35B1" />
        <KPICard title="Ticket Promedio" value={formatMoney(kpis.ticket_promedio)} icon={<TrendingUp />} tint={colors.amberBg} iconColor={colors.amberText} />
        <KPICard title="Presup. Activos" value={kpis.presupuestos_activos} icon={<Receipt />} tint={colors.goldSoft + "66"} iconColor={colors.gold} />
      </Box>

      {/* Ingresos por mes */}
      {ingresos_por_mes && ingresos_por_mes.length > 0 && (
        <Card sx={{ ...cardSx, mb: "20px", p: 0 }}>
          <CardContent sx={{ p: "20px" }}>
            <SectionTitle>Ingresos por Mes</SectionTitle>
            <Box sx={{ display: "flex", gap: "6px", alignItems: "flex-end", height: 130 }}>
              {ingresos_por_mes.slice(0, 8).reverse().map((m, i) => {
                const max = Math.max(...ingresos_por_mes.slice(0, 8).map(x => x.total || 0), 1);
                const pct = ((m.total || 0) / max) * 100;
                return (
                  <Tooltip key={i} title={`${m.mes}: ${formatMoney(m.total)}`}>
                    <Box sx={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "4px" }}>
                      <Typography sx={{ fontSize: "10px", fontWeight: 600, color: colors.primaryDark, fontFamily: fonts.body }}>
                        {formatMoney(m.total).replace("S/ ", "")}
                      </Typography>
                      <Box sx={{
                        width: "100%", maxWidth: 48,
                        height: `${Math.max(pct, 6)}%`,
                        bgcolor: colors.gold,
                        borderRadius: "6px 6px 0 0",
                        minHeight: 6,
                        transition: "height 0.3s ease"
                      }} />
                      <Typography sx={{ fontSize: "10px", color: colors.textMuted, fontFamily: fonts.body }}>
                        {m.mes?.slice(5)}
                      </Typography>
                    </Box>
                  </Tooltip>
                );
              })}
            </Box>
          </CardContent>
        </Card>
      )}

      {/* Rendimiento especialistas */}
      <Card sx={{ ...cardSx, mb: "20px", p: 0 }}>
        <CardContent sx={{ p: "20px" }}>
          <SectionTitle>Rendimiento por Especialista</SectionTitle>
          <Table size="small" sx={{ tableLayout: "auto" }}>
            <TableHead>
              <TableRow>
                <TableCell sx={thSx}>Especialista</TableCell>
                <TableCell align="center" sx={{ ...thSx, width: 80 }}>Líneas</TableCell>
                <TableCell align="center" sx={{ ...thSx, width: 100 }}>Culminadas</TableCell>
                <TableCell align="right" sx={{ ...thSx, width: 120 }}>Ingresos</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rendimiento_especialistas.map((esp) => (
                <TableRow key={esp.id} hover sx={{ "&:hover": { bgcolor: colors.creamPanel } }}>
                  <TableCell sx={{ ...tdSx, fontWeight: 500 }}>{esp.nombre}</TableCell>
                  <TableCell align="center" sx={tdSx}>{esp.lineas_total}</TableCell>
                  <TableCell align="center" sx={tdSx}>
                    <Chip label={esp.lineas_culminadas} size="small" sx={{ bgcolor: colors.successBg, color: colors.successText, border: `1px solid ${colors.successBorder}`, fontWeight: 600, height: 22, fontSize: "0.7rem" }} />
                  </TableCell>
                  <TableCell align="right" sx={{ ...tdSx, fontWeight: 700, color: colors.primary }}>{formatMoney(esp.ingresos_generados)}</TableCell>
                </TableRow>
              ))}
              {rendimiento_especialistas.length === 0 && (
                <TableRow><TableCell colSpan={4} align="center" sx={tdSx}><Typography sx={{ color: colors.textMuted, fontSize: "13px" }}>Sin datos de especialistas</Typography></TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Tratamientos más vendidos + Pagos pendientes */}
      <Grid container spacing="16px" sx={{ mb: "20px" }}>
        <Grid item xs={12} md={6}>
          <Card sx={{ ...cardSx, height: "100%", p: 0 }}>
            <CardContent sx={{ p: "20px" }}>
              <SectionTitle>Tratamientos Más Vendidos</SectionTitle>
              {tratamientos_mas_vendidos.length === 0 && <Typography sx={{ color: colors.textMuted, fontSize: "13px" }}>Sin datos</Typography>}
              {tratamientos_mas_vendidos.slice(0, 8).map((t, i) => (
                <Box key={i} sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", py: "8px", borderTop: i > 0 ? `1px solid ${colors.border}` : "none" }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <Box sx={{ bgcolor: colors.goldSoft, color: colors.primaryDark, borderRadius: "50%", width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: 700, fontFamily: fonts.body, flexShrink: 0 }}>
                      {i + 1}
                    </Box>
                    <Typography sx={{ fontSize: "13px", fontFamily: fonts.body, color: colors.textBody }}>{t.tratamiento_nombre}</Typography>
                  </Box>
                  <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexShrink: 0 }}>
                    <Chip label={`${t.cantidad}x`} size="small" sx={{ height: 22, fontSize: "0.7rem", fontWeight: 600, bgcolor: colors.creamPanel, color: colors.textBody, border: `1px solid ${colors.border}` }} />
                    <Typography sx={{ fontWeight: 700, color: colors.primary, fontSize: "13px", fontFamily: fonts.body, minWidth: 80, textAlign: "right" }}>{formatMoney(t.ingresos)}</Typography>
                  </Box>
                </Box>
              ))}
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={6}>
          <Card sx={{ ...cardSx, height: "100%", p: 0 }}>
            <CardContent sx={{ p: "20px" }}>
              <SectionTitle>Pagos Pendientes a Especialistas</SectionTitle>
              {pagos_pendientes.length === 0 && <Typography sx={{ color: colors.textMuted, fontSize: "13px" }}>Sin pagos pendientes — todo al día</Typography>}
              {pagos_pendientes.map((p, i) => (
                <Box key={p.id} sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", py: "8px", borderTop: i > 0 ? `1px solid ${colors.border}` : "none" }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <Avatar sx={{ width: 30, height: 30, bgcolor: colors.primary, fontSize: 13, fontFamily: fonts.body }}>{p.nombre?.charAt(0)}</Avatar>
                    <Typography sx={{ fontSize: "13px", fontFamily: fonts.body, color: colors.textBody }}>{p.nombre}</Typography>
                  </Box>
                  <Chip label={formatMoney(p.monto_pendiente)} size="small" sx={{ bgcolor: colors.amberBg, color: colors.amberText, fontWeight: 700, fontSize: "0.75rem", height: 24, border: "none" }} />
                </Box>
              ))}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Últimos tratamientos realizados */}
      {ultimos_tratamientos && ultimos_tratamientos.length > 0 && (
        <Card sx={{ ...cardSx, p: 0 }}>
          <CardContent sx={{ p: "20px" }}>
            <SectionTitle>Últimos Tratamientos Realizados</SectionTitle>
            <Table size="small" sx={{ tableLayout: "auto" }}>
              <TableHead>
                <TableRow>
                  <TableCell sx={thSx}>Tratamiento</TableCell>
                  <TableCell sx={thSx}>Paciente</TableCell>
                  <TableCell sx={thSx}>Especialista</TableCell>
                  <TableCell sx={{ ...thSx, width: 90 }}>Fecha</TableCell>
                  <TableCell align="right" sx={{ ...thSx, width: 100 }}>Precio</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {ultimos_tratamientos.slice(0, 10).map((t, i) => (
                  <TableRow key={i} hover sx={{ "&:hover": { bgcolor: colors.creamPanel } }}>
                    <TableCell sx={{ ...tdSx, fontWeight: 500 }}>{t.tratamiento_nombre}</TableCell>
                    <TableCell sx={tdSx}>{t.paciente_nombre} {t.paciente_apellido}</TableCell>
                    <TableCell sx={{ ...tdSx, color: colors.textMuted }}>{t.especialista || "—"}</TableCell>
                    <TableCell sx={{ ...tdSx, color: colors.textMuted }}>{t.fecha_realizada?.split(" ")[0]}</TableCell>
                    <TableCell align="right" sx={{ ...tdSx, fontWeight: 700, color: colors.primary }}>{formatMoney(t.precio_sesion)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </Box>
  );
}

function SectionTitle({ children }) {
  return (
    <Typography sx={{ fontFamily: fonts.title, fontSize: "22px", fontWeight: 600, color: colors.primaryDark, mb: "14px" }}>
      {children}
    </Typography>
  );
}

function KPICard({ title, value, icon, tint, iconColor }) {
  return (
    <Card sx={{ ...cardSx, p: 0 }}>
      <CardContent sx={{ display: "flex", alignItems: "center", gap: "14px", p: "20px", "&:last-child": { pb: "20px" } }}>
        <Box sx={{ width: 54, height: 54, borderRadius: "14px", bgcolor: tint, display: "flex", alignItems: "center", justifyContent: "center", color: iconColor, flexShrink: 0 }}>
          {icon}
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontSize: "13px", color: colors.textMuted, fontFamily: fonts.body, fontWeight: 500, lineHeight: 1.3 }}>{title}</Typography>
          <Typography sx={{ fontFamily: fonts.title, fontSize: "26px", fontWeight: 700, color: colors.primaryDark, lineHeight: 1.2 }}>{value}</Typography>
        </Box>
      </CardContent>
    </Card>
  );
}

/* ======================================================================
   VISTA PRESUPUESTOS
====================================================================== */
function PresupuestosView({ presupuestos, filtroEstado, setFiltroEstado, onLoadPresupuestos, onSync, onSelectPresupuesto, detalle, onBack, onCulminar, onRevertir, navigate }) {
  if (detalle) {
    return <PresupuestoDetalleView detalle={detalle} onBack={onBack} onCulminar={onCulminar} onRevertir={onRevertir} navigate={navigate} />;
  }

  return (
    <Box>
      {/* Filtros */}
      <Box sx={{ display: "flex", gap: "12px", mb: "18px", alignItems: "center", flexWrap: "wrap" }}>
        <FormControl size="small" sx={{ minWidth: 150, "& .MuiOutlinedInput-root": { borderRadius: "10px", fontFamily: fonts.body, fontSize: "13px", "& fieldset": { borderColor: colors.border } } }}>
          <InputLabel sx={{ fontFamily: fonts.body, fontSize: "13px" }}>Estado</InputLabel>
          <Select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)} label="Estado">
            <MenuItem value="">Todos</MenuItem>
            <MenuItem value="activo">Activo</MenuItem>
            <MenuItem value="culminado">Culminado</MenuItem>
            <MenuItem value="anulado">Anulado</MenuItem>
          </Select>
        </FormControl>
        <Button size="small" startIcon={<FilterList />} onClick={onLoadPresupuestos} sx={{ color: colors.primary, fontFamily: fonts.body, textTransform: "none", borderRadius: "10px" }}>Filtrar</Button>
        <Button size="small" startIcon={<Refresh />} onClick={onSync} sx={{ color: colors.gold, fontFamily: fonts.body, textTransform: "none", borderRadius: "10px" }}>Sincronizar Líneas</Button>
      </Box>

      {/* Lista */}
      <Grid container spacing="16px">
        {presupuestos.map((p) => (
          <Grid item xs={12} md={6} lg={4} key={p.id}>
            <Card
              sx={{ ...cardSx, cursor: "pointer", "&:hover": { borderColor: colors.gold, boxShadow: "0 4px 12px rgba(93,64,55,0.1)" }, transition: "all 0.2s", p: 0 }}
              onClick={() => onSelectPresupuesto(p.id)}
            >
              <CardContent sx={{ p: "18px" }}>
                <Box sx={{ display: "flex", justifyContent: "space-between", mb: 1 }}>
                  <Typography sx={{ fontWeight: 700, fontFamily: fonts.body, fontSize: "14px", color: colors.primaryDark }}>
                    {p.paciente_nombre} {p.paciente_apellido}
                  </Typography>
                  <EstadoChip estado={p.estado_gestion || "activo"} />
                </Box>
                <Typography sx={{ fontSize: "12px", color: colors.textMuted, fontFamily: fonts.body }}>#{p.id} — {p.creado_en?.split(" ")[0]}</Typography>
                <Divider sx={{ my: 1, borderColor: colors.border }} />
                <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                  <Typography sx={{ fontSize: "13px", fontFamily: fonts.body, color: colors.textBody }}>Total: <strong style={{ color: colors.primary }}>{formatMoney(p.precio_total)}</strong></Typography>
                  <Typography sx={{ fontSize: "13px", fontFamily: fonts.body, color: colors.textMuted }}>
                    Líneas: {p.lineas_culminadas}/{p.total_lineas}
                  </Typography>
                </Box>
                <Box sx={{ mt: 1 }}>
                  <LinearProgress
                    variant="determinate"
                    value={p.total_lineas > 0 ? (p.lineas_culminadas / p.total_lineas) * 100 : 0}
                    sx={{ height: 5, borderRadius: 3, bgcolor: colors.border, "& .MuiLinearProgress-bar": { bgcolor: colors.successText, borderRadius: 3 } }}
                  />
                </Box>
                {p.especialistas_involucrados?.length > 0 && (
                  <Box sx={{ mt: 1, display: "flex", gap: 0.5, flexWrap: "wrap" }}>
                    {p.especialistas_involucrados.map((e, i) => (
                      <Chip key={i} label={e} size="small" sx={{ fontSize: "0.65rem", height: 20, bgcolor: colors.creamPanel, color: colors.textBody, border: `1px solid ${colors.border}` }} />
                    ))}
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
      {presupuestos.length === 0 && !filtroEstado && (
        <Typography sx={{ mt: "20px", textAlign: "center", color: colors.textMuted, fontSize: "13px", fontFamily: fonts.body }}>No hay presupuestos registrados</Typography>
      )}
    </Box>
  );
}

function PresupuestoDetalleView({ detalle, onBack, onCulminar, onRevertir, navigate }) {
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
        <LineaCard key={linea.id} linea={linea} onCulminar={onCulminar} onRevertir={onRevertir} />
      ))}
    </Box>
  );
}

function LineaCard({ linea, onCulminar, onRevertir }) {
  const [expanded, setExpanded] = useState(false);
  const progreso = linea.sesiones_totales > 0 ? (linea.sesiones_realizadas / linea.sesiones_totales) * 100 : 0;
  const comisionPct = linea.comision_porcentaje || linea.esp_comision_porcentaje || 20;
  const comisionEstimada = linea.precio * (comisionPct / 100);

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
              <Typography sx={{ fontSize: "12px", fontFamily: fonts.body, color: colors.textMuted }}>
                Comisión ({comisionPct}%): <strong style={{ color: colors.textBody }}>{formatMoney(comisionEstimada)}</strong>
              </Typography>
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
    </Card>
  );
}

/* ======================================================================
   VISTA ESPECIALISTAS
====================================================================== */
function EspecialistasView({ especialistas, detalle, onSelect, onBack, onCulminar }) {
  if (detalle) {
    return <EspecialistaDetalleView detalle={detalle} onBack={onBack} onCulminar={onCulminar} />;
  }

  return (
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
              </Box>
              <Divider sx={{ my: "12px", borderColor: colors.border }} />
              <Grid container spacing={1}>
                <Grid item xs={6}>
                  <Typography sx={{ fontSize: "11px", color: colors.textMuted, fontFamily: fonts.body }}>Líneas</Typography>
                  <Typography sx={{ fontWeight: 700, fontFamily: fonts.title, fontSize: "20px", color: colors.primaryDark }}>{esp.total_lineas}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography sx={{ fontSize: "11px", color: colors.textMuted, fontFamily: fonts.body }}>Culminadas</Typography>
                  <Typography sx={{ fontWeight: 700, fontFamily: fonts.title, fontSize: "20px", color: colors.successText }}>{esp.lineas_culminadas}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography sx={{ fontSize: "11px", color: colors.textMuted, fontFamily: fonts.body }}>Ingresos</Typography>
                  <Typography sx={{ fontWeight: 700, fontFamily: fonts.body, fontSize: "13px", color: colors.primary }}>{formatMoney(esp.ingresos_generados)}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography sx={{ fontSize: "11px", color: colors.textMuted, fontFamily: fonts.body }}>Pendiente</Typography>
                  <Chip label={formatMoney(esp.comision_pendiente)} size="small" sx={{ bgcolor: colors.amberBg, color: colors.amberText, fontWeight: 700, fontSize: "0.7rem", height: 22, border: "none", mt: "2px" }} />
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>
      ))}
    </Grid>
  );
}

function EspecialistaDetalleView({ detalle, onBack, onCulminar }) {
  const { especialista, resumen, lineas } = detalle;

  const lineasEnCurso = lineas.filter(l => ["pendiente", "en_curso", "listo_para_culminar"].includes(l.estado));
  const lineasCulminadas = lineas.filter(l => l.estado === "culminado");

  return (
    <Box>
      <Button startIcon={<ArrowBack />} onClick={onBack} sx={{ mb: "16px", color: colors.primary, fontFamily: fonts.body, textTransform: "none", borderRadius: "10px" }}>Volver</Button>

      {/* Header especialista */}
      <Card sx={{ ...cardSx, mb: "20px", p: 0 }}>
        <CardContent sx={{ p: "24px" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: "14px", mb: "20px" }}>
            <Avatar sx={{ bgcolor: colors.primary, width: 56, height: 56, fontSize: 24, fontFamily: fonts.title, fontWeight: 700 }}>
              {especialista.nombre?.charAt(0)?.toUpperCase()}
            </Avatar>
            <Box>
              <Typography sx={{ fontFamily: fonts.title, color: colors.primaryDark, fontWeight: 700, fontSize: "24px" }}>
                {especialista.nombre}
              </Typography>
              <Typography sx={{ color: colors.textMuted, fontSize: "13px", fontFamily: fonts.body }}>
                {especialista.tipo || "Especialista"} · {especialista.especialidad || "General"} · Comisión: {especialista.comision_porcentaje || 20}%
              </Typography>
              {especialista.cuenta_bancaria && (
                <Typography sx={{ color: colors.textMuted, fontSize: "12px", fontFamily: fonts.body }}>
                  Cuenta: {especialista.cuenta_bancaria}
                </Typography>
              )}
            </Box>
          </Box>

          {/* KPIs del especialista */}
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", sm: "repeat(5, 1fr)" }, gap: "12px" }}>
            {[
              { label: "Líneas Total", value: resumen.total_lineas, color: colors.primaryDark, bg: colors.creamPanel },
              { label: "Culminadas", value: resumen.culminadas, color: colors.successText, bg: colors.successBg },
              { label: "Comisión Pend.", value: formatMoney(resumen.comision_pendiente), color: colors.amberText, bg: colors.amberBg },
              { label: "Liquidado", value: formatMoney(resumen.comision_liquidada), color: colors.successText, bg: colors.successBg },
              { label: "Ticket Promedio", value: formatMoney(resumen.ticket_promedio), color: colors.primary, bg: colors.creamPanel }
            ].map((kpi, i) => (
              <Box key={i} sx={{ textAlign: "center", p: "14px", bgcolor: kpi.bg, borderRadius: "14px" }}>
                <Typography sx={{ color: colors.textMuted, fontWeight: 500, fontSize: "11px", fontFamily: fonts.body, mb: "2px" }}>{kpi.label}</Typography>
                <Typography sx={{ fontWeight: 700, color: kpi.color, fontFamily: fonts.title, fontSize: "22px", lineHeight: 1.2 }}>{kpi.value}</Typography>
              </Box>
            ))}
          </Box>
        </CardContent>
      </Card>

      {/* Líneas EN CURSO */}
      {lineasEnCurso.length > 0 && (
        <Box sx={{ mb: "20px" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: "8px", mb: "12px" }}>
            <Typography sx={{ fontFamily: fonts.title, fontSize: "22px", fontWeight: 600, color: colors.primaryDark }}>En Curso</Typography>
            <Chip label={lineasEnCurso.length} size="small" sx={{ bgcolor: colors.goldSoft, color: colors.primaryDark, fontWeight: 700, fontFamily: fonts.body, height: 22, fontSize: "0.7rem" }} />
          </Box>
          {lineasEnCurso.map((linea) => (
            <LineaCard key={linea.id} linea={{ ...linea, sesiones: [] }} onCulminar={onCulminar} onRevertir={() => {}} />
          ))}
        </Box>
      )}

      {/* Líneas CULMINADAS */}
      {lineasCulminadas.length > 0 && (
        <Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: "8px", mb: "12px" }}>
            <Typography sx={{ fontFamily: fonts.title, fontSize: "22px", fontWeight: 600, color: colors.successText }}>Culminados</Typography>
            <Chip label={lineasCulminadas.length} size="small" sx={{ bgcolor: colors.successBg, color: colors.successText, border: `1px solid ${colors.successBorder}`, fontWeight: 700, fontFamily: fonts.body, height: 22, fontSize: "0.7rem" }} />
          </Box>
          {lineasCulminadas.map((linea) => (
            <LineaCard key={linea.id} linea={{ ...linea, sesiones: [] }} onCulminar={onCulminar} onRevertir={() => {}} />
          ))}
        </Box>
      )}

      {lineas.length === 0 && (
        <Alert severity="info" sx={{ mt: "18px", borderRadius: "12px" }}>Este especialista no tiene líneas de tratamiento asignadas</Alert>
      )}
    </Box>
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
