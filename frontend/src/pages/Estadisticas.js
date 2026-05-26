import React, { useEffect, useMemo, useState } from "react";
import useSocket from "../hooks/useSocket";
import {
  Box,
  Typography,
  Paper,
  Grid,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Divider,
  FormControl,
  Select,
  MenuItem,
  Button,
  CircularProgress,
  Container,
  Chip,
} from "@mui/material";
import {
  ArrowBack,
  TrendingUp,
  People,
  MedicalServices,
  Paid,
  Refresh,
  AccountBalanceWallet,
  CreditCard,
  Home,
  CalendarMonth,
  EmojiEvents,
  PersonOutline,
} from "@mui/icons-material";
import { useNavigate } from "react-router-dom";
import { useToast } from "../components/ToastProvider";
import api from "../api/axios";
import useUserPermissions from "../hooks/useUserPermissions";

const money = (n) => {
  const value = Number(n) || 0;
  return `S/ ${value.toFixed(2)}`;
};

const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

const rankColors = ["#D4AF37", "#A0A0A0", "#CD7F32"];

export default function Estadisticas() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { hasAccess, loaded: permsLoaded } = useUserPermissions();
  const role = localStorage.getItem("role");

  const canViewStats = role === "doctor" || role === "admin" || role === "master" || hasAccess("estadisticas");

  const today = useMemo(() => new Date(), []);
  const currentYear = today.getFullYear();
  const [year, setYear] = useState(currentYear);
  const [month, setMonth] = useState(today.getMonth() + 1);

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);

  useEffect(() => {
    if (permsLoaded && !canViewStats) {
      showToast({ severity: "error", message: "No tienes permisos para acceder a Estadísticas" });
      navigate("/dashboard");
    }
  }, [canViewStats, permsLoaded, navigate, showToast]);

  const cargar = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/api/stats/overview?year=${year}&month=${month}`);
      setData(res.data);
    } catch (err) {
      console.error("Error cargando estadísticas:", err);
      const msg = err?.response?.data?.message;
      showToast({ severity: "error", message: msg || "Error al cargar estadísticas" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (canViewStats) cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month, canViewStats]);

  // Sincronización en tiempo real
  useSocket(["finanzas:updated", "pacientes:updated", "tratamientos:updated", "paquetes:updated"], () => {
    if (canViewStats) cargar();
  });

  if (!permsLoaded || !canViewStats) return null;

  const kpi = data?.kpi;
  const ingresosBruto = kpi?.ingresos_bruto ?? 0;
  const comisionPos = kpi?.comision_pos ?? 0;

  const yearOptions = [];
  for (let y = currentYear; y >= currentYear - 5; y--) yearOptions.push(y);

  const colorPrincipal = "#A36920";
  const numFont = "'DM Sans', 'Inter', -apple-system, sans-serif";

  const kpiCardStyle = {
    p: { xs: 2, sm: 2.5 },
    borderRadius: 3,
    border: "1px solid rgba(163,105,32,0.10)",
    background: "rgba(255,255,255,0.95)",
    height: "100%",
    transition: "transform 0.2s, box-shadow 0.2s",
    "&:hover": {
      transform: "translateY(-2px)",
      boxShadow: "0 8px 24px rgba(163,105,32,0.12)",
    },
  };

  const kpiIconBox = (bgColor) => ({
    width: 44,
    height: 44,
    borderRadius: 2.5,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: bgColor,
    flexShrink: 0,
  });

  return (
    <Box
      sx={{
        minHeight: "100vh",
        backgroundImage:
          "radial-gradient(circle at top, rgba(255,255,255,0.92), rgba(247,234,193,0.55), rgba(0,0,0,0.05)), url('/images/background-showclinic.jpg')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        position: "relative",
        px: { xs: 1.5, sm: 3, md: 4 },
        py: { xs: 3, sm: 4 },
        "&::before": {
          content: '""',
          position: "absolute",
          inset: 0,
          background: "linear-gradient(135deg, rgba(255,255,255,0.55), rgba(250,240,210,0.35))",
          pointerEvents: "none",
        },
        "& > *": { position: "relative", zIndex: 1 },
      }}
    >
      <Box sx={{ maxWidth: 1100, mx: "auto" }}>

        {/* ========== HEADER ========== */}
        <Paper
          elevation={0}
          sx={{
            p: { xs: 2, sm: 2.5 },
            mb: 3,
            borderRadius: 4,
            background: "linear-gradient(135deg, rgba(163,105,32,0.95), rgba(139,84,10,0.95))",
            border: "1px solid rgba(212,175,55,0.25)",
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 2,
            boxShadow: "0 8px 32px rgba(163,105,32,0.20)",
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <IconButton onClick={() => navigate("/dashboard")} sx={{ color: "rgba(255,255,255,0.85)", "&:hover": { color: "#fff" } }}>
              <ArrowBack />
            </IconButton>
            <IconButton onClick={() => navigate("/dashboard")} sx={{ color: "rgba(255,255,255,0.85)", "&:hover": { color: "#fff" } }} title="Inicio">
              <Home />
            </IconButton>
          </Box>

          <Box sx={{ flex: 1, minWidth: 160 }}>
            <Typography
              variant="h5"
              sx={{
                fontFamily: "'Playfair Display', serif",
                fontWeight: 700,
                color: "#fff",
                letterSpacing: 0.5,
              }}
            >
              Estadísticas
            </Typography>
            <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.70)", mt: 0.25 }}>
              Resumen mensual de la clínica
            </Typography>
          </Box>

          <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap", alignItems: "center" }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
              <CalendarMonth sx={{ color: "rgba(255,255,255,0.70)", fontSize: 20 }} />
              <FormControl size="small" sx={{ minWidth: 120 }}>
                <Select
                  value={month}
                  onChange={(e) => setMonth(Number(e.target.value))}
                  sx={{
                    backgroundColor: "rgba(255,255,255,0.15)",
                    borderRadius: 2,
                    fontWeight: 600,
                    color: "#fff",
                    fontSize: 14,
                    "& .MuiOutlinedInput-notchedOutline": { borderColor: "rgba(255,255,255,0.25)" },
                    "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: "rgba(255,255,255,0.45)" },
                    "& .MuiSvgIcon-root": { color: "rgba(255,255,255,0.70)" },
                  }}
                >
                  {MONTH_NAMES.map((name, idx) => (
                    <MenuItem key={idx + 1} value={idx + 1}>{name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>

            <FormControl size="small" sx={{ minWidth: 85 }}>
              <Select
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                sx={{
                  backgroundColor: "rgba(255,255,255,0.15)",
                  borderRadius: 2,
                  fontWeight: 600,
                  color: "#fff",
                  fontSize: 14,
                  "& .MuiOutlinedInput-notchedOutline": { borderColor: "rgba(255,255,255,0.25)" },
                  "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: "rgba(255,255,255,0.45)" },
                  "& .MuiSvgIcon-root": { color: "rgba(255,255,255,0.70)" },
                }}
              >
                {yearOptions.map((y) => (
                  <MenuItem key={y} value={y}>{y}</MenuItem>
                ))}
              </Select>
            </FormControl>

            <Button
              variant="contained"
              size="small"
              startIcon={loading ? <CircularProgress size={14} sx={{ color: colorPrincipal }} /> : <Refresh />}
              onClick={cargar}
              disabled={loading}
              sx={{
                backgroundColor: "#fff",
                color: colorPrincipal,
                fontWeight: 700,
                borderRadius: 2,
                px: 2,
                fontSize: 13,
                textTransform: "none",
                boxShadow: "none",
                "&:hover": { backgroundColor: "rgba(255,255,255,0.90)", boxShadow: "none" },
                "&.Mui-disabled": { backgroundColor: "rgba(255,255,255,0.50)", color: "rgba(163,105,32,0.50)" },
              }}
            >
              Actualizar
            </Button>
          </Box>
        </Paper>

        {/* ========== KPIs ========== */}
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={6} md={3}>
            <Paper elevation={1} sx={kpiCardStyle}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1.5 }}>
                <Box sx={kpiIconBox("rgba(163,105,32,0.10)")}>
                  <TrendingUp sx={{ color: colorPrincipal, fontSize: 22 }} />
                </Box>
                <Typography sx={{ fontWeight: 700, color: "rgba(46,46,46,0.65)", fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5 }}>
                  Sesiones
                </Typography>
              </Box>
              <Typography variant="h4" sx={{ fontFamily: numFont, fontWeight: 900, color: "#2E2E2E", lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
                {loading ? "—" : Number(kpi?.sesiones || 0)}
              </Typography>
              <Typography variant="caption" sx={{ color: "rgba(46,46,46,0.50)", mt: 0.5, display: "block" }}>
                Tratamientos realizados
              </Typography>
            </Paper>
          </Grid>

          <Grid item xs={6} md={3}>
            <Paper elevation={1} sx={kpiCardStyle}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1.5 }}>
                <Box sx={kpiIconBox("rgba(52,152,219,0.10)")}>
                  <People sx={{ color: "#3498db", fontSize: 22 }} />
                </Box>
                <Typography sx={{ fontWeight: 700, color: "rgba(46,46,46,0.65)", fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5 }}>
                  Pacientes
                </Typography>
              </Box>
              <Typography variant="h4" sx={{ fontFamily: numFont, fontWeight: 900, color: "#2E2E2E", lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
                {loading ? "—" : Number(kpi?.pacientes_unicos || 0)}
              </Typography>
              <Typography variant="caption" sx={{ color: "rgba(46,46,46,0.50)", mt: 0.5, display: "block" }}>
                Pacientes atendidos
              </Typography>
            </Paper>
          </Grid>

          <Grid item xs={6} md={3}>
            <Paper elevation={1} sx={kpiCardStyle}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1.5 }}>
                <Box sx={kpiIconBox("rgba(39,174,96,0.10)")}>
                  <AccountBalanceWallet sx={{ color: "#27ae60", fontSize: 22 }} />
                </Box>
                <Typography sx={{ fontWeight: 700, color: "rgba(46,46,46,0.65)", fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5 }}>
                  Ingresos
                </Typography>
              </Box>
              <Typography variant="h5" sx={{ fontFamily: numFont, fontWeight: 900, color: "#27ae60", lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
                {loading ? "—" : money(ingresosBruto)}
              </Typography>
              <Typography variant="caption" sx={{ color: "rgba(46,46,46,0.50)", mt: 0.5, display: "block" }}>
                Total facturado
              </Typography>
            </Paper>
          </Grid>

          <Grid item xs={6} md={3}>
            <Paper elevation={1} sx={kpiCardStyle}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1.5 }}>
                <Box sx={kpiIconBox("rgba(192,57,43,0.08)")}>
                  <CreditCard sx={{ color: "#c0392b", fontSize: 22 }} />
                </Box>
                <Typography sx={{ fontWeight: 700, color: "rgba(46,46,46,0.65)", fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5 }}>
                  Comisión POS
                </Typography>
              </Box>
              <Typography variant="h5" sx={{ fontFamily: numFont, fontWeight: 900, color: "#c0392b", lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
                {loading ? "—" : money(comisionPos)}
              </Typography>
              <Typography variant="caption" sx={{ color: "rgba(46,46,46,0.50)", mt: 0.5, display: "block" }}>
                4% en pagos con tarjeta
              </Typography>
            </Paper>
          </Grid>
        </Grid>

        {/* ========== TICKET PROMEDIO (barra destacada) ========== */}
        <Paper
          elevation={1}
          sx={{
            p: { xs: 2, sm: 2.5 },
            mb: 3,
            borderRadius: 3,
            background: "linear-gradient(135deg, rgba(163,105,32,0.06), rgba(255,255,255,0.95))",
            border: "1px solid rgba(163,105,32,0.12)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 2,
            flexWrap: "wrap",
          }}
        >
          <MedicalServices sx={{ color: colorPrincipal, fontSize: 28 }} />
          <Box sx={{ textAlign: "center" }}>
            <Typography variant="caption" sx={{ color: "rgba(46,46,46,0.60)", fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>
              Ticket Promedio por Sesión
            </Typography>
            <Typography variant="h5" sx={{ fontFamily: numFont, fontWeight: 900, color: colorPrincipal, lineHeight: 1.2, fontVariantNumeric: "tabular-nums" }}>
              {loading ? "—" : money(kpi?.ticket_promedio)}
            </Typography>
          </Box>
        </Paper>

        {/* ========== TABLAS ========== */}
        <Grid container spacing={2.5}>
          {/* Top tratamientos */}
          <Grid item xs={12} md={6}>
            <Paper
              elevation={1}
              sx={{
                borderRadius: 3,
                backgroundColor: "rgba(255,255,255,0.96)",
                border: "1px solid rgba(163,105,32,0.10)",
                overflow: "hidden",
              }}
            >
              <Box sx={{ px: { xs: 2, sm: 3 }, pt: 2.5, pb: 1.5, display: "flex", alignItems: "center", gap: 1 }}>
                <EmojiEvents sx={{ color: "#D4AF37", fontSize: 22 }} />
                <Typography sx={{ fontWeight: 800, color: "#2E2E2E", fontSize: 15 }}>
                  Top Tratamientos
                </Typography>
              </Box>
              <Divider sx={{ borderColor: "rgba(163,105,32,0.08)" }} />
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ backgroundColor: "rgba(163,105,32,0.04)" }}>
                      <TableCell sx={{ fontWeight: 700, color: "rgba(46,46,46,0.55)", fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5, py: 1.2 }}>#</TableCell>
                      <TableCell sx={{ fontWeight: 700, color: "rgba(46,46,46,0.55)", fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5, py: 1.2 }}>Tratamiento</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 700, color: "rgba(46,46,46,0.55)", fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5, py: 1.2 }}>Sesiones</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(data?.top_tratamientos || []).length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} align="center" sx={{ py: 4, color: "rgba(46,46,46,0.45)" }}>
                          {loading ? "Cargando..." : "Sin datos en este periodo"}
                        </TableCell>
                      </TableRow>
                    ) : (
                      (data?.top_tratamientos || []).map((r, idx) => (
                        <TableRow
                          key={String(r.tratamiento_id || idx)}
                          sx={{
                            "&:hover": { backgroundColor: "rgba(163,105,32,0.03)" },
                            "&:last-child td": { borderBottom: 0 },
                          }}
                        >
                          <TableCell sx={{ width: 40, py: 1.5 }}>
                            <Box
                              sx={{
                                width: 26,
                                height: 26,
                                borderRadius: "50%",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                backgroundColor: idx < 3 ? `${rankColors[idx]}18` : "rgba(0,0,0,0.04)",
                                color: idx < 3 ? rankColors[idx] : "rgba(46,46,46,0.50)",
                                fontWeight: 800,
                                fontSize: 12,
                              }}
                            >
                              {idx + 1}
                            </Box>
                          </TableCell>
                          <TableCell sx={{ fontWeight: idx < 3 ? 700 : 500, color: "#2E2E2E", py: 1.5 }}>
                            {r.tratamiento || "(No especificado)"}
                          </TableCell>
                          <TableCell align="center" sx={{ py: 1.5 }}>
                            <Chip
                              label={Number(r.cantidad || 0)}
                              size="small"
                              sx={{
                                fontWeight: 700,
                                fontSize: 13,
                                backgroundColor: "rgba(163,105,32,0.08)",
                                color: colorPrincipal,
                                minWidth: 40,
                              }}
                            />
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          </Grid>

          {/* Pacientes frecuentes */}
          <Grid item xs={12} md={6}>
            <Paper
              elevation={1}
              sx={{
                borderRadius: 3,
                backgroundColor: "rgba(255,255,255,0.96)",
                border: "1px solid rgba(163,105,32,0.10)",
                overflow: "hidden",
              }}
            >
              <Box sx={{ px: { xs: 2, sm: 3 }, pt: 2.5, pb: 1.5, display: "flex", alignItems: "center", gap: 1 }}>
                <PersonOutline sx={{ color: "#3498db", fontSize: 22 }} />
                <Typography sx={{ fontWeight: 800, color: "#2E2E2E", fontSize: 15 }}>
                  Pacientes Frecuentes
                </Typography>
              </Box>
              <Divider sx={{ borderColor: "rgba(163,105,32,0.08)" }} />
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ backgroundColor: "rgba(163,105,32,0.04)" }}>
                      <TableCell sx={{ fontWeight: 700, color: "rgba(46,46,46,0.55)", fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5, py: 1.2 }}>#</TableCell>
                      <TableCell sx={{ fontWeight: 700, color: "rgba(46,46,46,0.55)", fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5, py: 1.2 }}>Paciente</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 700, color: "rgba(46,46,46,0.55)", fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5, py: 1.2 }}>Sesiones</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(data?.pacientes_frecuentes || []).length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} align="center" sx={{ py: 4, color: "rgba(46,46,46,0.45)" }}>
                          {loading ? "Cargando..." : "Sin datos en este periodo"}
                        </TableCell>
                      </TableRow>
                    ) : (
                      (data?.pacientes_frecuentes || []).map((r, idx) => (
                        <TableRow
                          key={String(r.paciente_id || idx)}
                          sx={{
                            "&:hover": { backgroundColor: "rgba(52,152,219,0.03)" },
                            "&:last-child td": { borderBottom: 0 },
                          }}
                        >
                          <TableCell sx={{ width: 40, py: 1.5 }}>
                            <Box
                              sx={{
                                width: 26,
                                height: 26,
                                borderRadius: "50%",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                backgroundColor: idx < 3 ? `${rankColors[idx]}18` : "rgba(0,0,0,0.04)",
                                color: idx < 3 ? rankColors[idx] : "rgba(46,46,46,0.50)",
                                fontWeight: 800,
                                fontSize: 12,
                              }}
                            >
                              {idx + 1}
                            </Box>
                          </TableCell>
                          <TableCell sx={{ fontWeight: idx < 3 ? 700 : 500, color: "#2E2E2E", py: 1.5 }}>
                            {r.paciente || "(No especificado)"}
                          </TableCell>
                          <TableCell align="center" sx={{ py: 1.5 }}>
                            <Chip
                              label={Number(r.sesiones || 0)}
                              size="small"
                              sx={{
                                fontWeight: 700,
                                fontSize: 13,
                                backgroundColor: "rgba(52,152,219,0.08)",
                                color: "#3498db",
                                minWidth: 40,
                              }}
                            />
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          </Grid>
        </Grid>

      </Box>
    </Box>
  );
}
