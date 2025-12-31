import React, { useEffect, useMemo, useState } from "react";
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
  Container
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
  Home
} from "@mui/icons-material";
import { useNavigate } from "react-router-dom";
import { useToast } from "../components/ToastProvider";
import api from "../api/axios";

const money = (n) => {
  const value = Number(n) || 0;
  return `S/ ${value.toFixed(2)}`;
};

const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

export default function Estadisticas() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const role = localStorage.getItem("role");

  const canViewStats = role === "doctor" || role === "admin" || role === "master";

  const today = useMemo(() => new Date(), []);
  const currentYear = today.getFullYear();
  const [year, setYear] = useState(currentYear);
  const [month, setMonth] = useState(today.getMonth() + 1);

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);

  useEffect(() => {
    if (!canViewStats) {
      showToast({ severity: "error", message: "No tienes permisos para acceder a Estadísticas" });
      navigate("/dashboard");
    }
  }, [canViewStats, navigate, showToast]);

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

  if (!canViewStats) return null;

  const kpi = data?.kpi;
  const ingresosNeto = kpi?.ingresos_neto ?? 0;
  const ingresosBruto = kpi?.ingresos_bruto ?? 0;
  const comisionPos = kpi?.comision_pos ?? 0;

  const yearOptions = [];
  for (let y = currentYear; y >= currentYear - 5; y--) yearOptions.push(y);

  const colorPrincipal = "#A36920";

  return (
    <Box
      sx={{
        minHeight: "100vh",
        backgroundImage:
          "radial-gradient(circle at top, rgba(255,255,255,0.92), rgba(247,234,193,0.55), rgba(0,0,0,0.05)), url('/images/background-showclinic.jpg')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        position: "relative",
        px: { xs: 2, sm: 4 },
        py: { xs: 3, sm: 5 },
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
          elevation={4}
          sx={{
            p: { xs: 2, sm: 3 },
            mb: 3,
            borderRadius: 4,
            backgroundColor: "rgba(255,255,255,0.92)",
            border: "1px solid rgba(163,105,32,0.15)",
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
            <IconButton onClick={() => navigate("/dashboard")} sx={{ color: colorPrincipal }}>
              <ArrowBack />
            </IconButton>
            <Typography
              variant="h5"
              sx={{ color: colorPrincipal, fontWeight: "bold", flex: 1, textAlign: "center" }}
            >
              Estadísticas del Mes
            </Typography>
            <IconButton onClick={() => navigate("/dashboard")} sx={{ color: colorPrincipal }} title="Inicio">
              <Home />
            </IconButton>
          </Box>

          <Box sx={{ flex: 1, minWidth: 180 }}>
            <Typography
              variant="h5"
              sx={{
                fontFamily: "'Playfair Display', serif",
                fontWeight: 700,
                color: colorPrincipal,
              }}
            >
              Estadísticas
            </Typography>
            <Typography variant="body2" sx={{ color: "rgba(46,46,46,0.70)" }}>
              Resumen mensual de la clínica
            </Typography>
          </Box>

          {/* Selectores de Mes y Año */}
          <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap", alignItems: "center" }}>
            <FormControl size="small" sx={{ minWidth: 130 }}>
              <Select
                value={month}
                onChange={(e) => setMonth(Number(e.target.value))}
                sx={{
                  backgroundColor: "rgba(255,255,255,0.95)",
                  borderRadius: 2,
                  fontWeight: 700,
                  color: colorPrincipal,
                  "& .MuiOutlinedInput-notchedOutline": {
                    borderColor: "rgba(163,105,32,0.3)",
                  },
                }}
              >
                {MONTH_NAMES.map((name, idx) => (
                  <MenuItem key={idx + 1} value={idx + 1}>
                    {name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: 100 }}>
              <Select
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                sx={{
                  backgroundColor: "rgba(255,255,255,0.95)",
                  borderRadius: 2,
                  fontWeight: 700,
                  color: colorPrincipal,
                  "& .MuiOutlinedInput-notchedOutline": {
                    borderColor: "rgba(163,105,32,0.3)",
                  },
                }}
              >
                {yearOptions.map((y) => (
                  <MenuItem key={y} value={y}>
                    {y}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <Button
              variant="contained"
              size="small"
              startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <Refresh />}
              onClick={cargar}
              disabled={loading}
              sx={{
                backgroundColor: colorPrincipal,
                fontWeight: 700,
                borderRadius: 2,
                px: 2,
                "&:hover": { backgroundColor: "#8a541a" },
              }}
            >
              Actualizar
            </Button>
          </Box>
        </Paper>

        {/* ========== KPIs ========== */}
        <Grid container spacing={2.5} sx={{ mb: 3 }}>
          {/* Sesiones */}
          <Grid item xs={6} sm={6} md={3}>
            <Paper
              elevation={2}
              sx={{
                p: 2.5,
                borderRadius: 4,
                border: "1px solid rgba(163,105,32,0.12)",
                background: "linear-gradient(135deg, rgba(255,246,234,0.95), rgba(255,255,255,0.90))",
                height: "100%",
              }}
            >
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
                <TrendingUp sx={{ color: colorPrincipal, fontSize: 28 }} />
                <Typography sx={{ fontWeight: 800, color: "#2E2E2E", fontSize: 14 }}>Sesiones</Typography>
              </Box>
              <Typography variant="h4" sx={{ fontWeight: 900, color: colorPrincipal }}>
                {loading ? "—" : Number(kpi?.sesiones || 0)}
              </Typography>
              <Typography variant="caption" sx={{ color: "rgba(46,46,46,0.65)" }}>
                Tratamientos realizados
              </Typography>
            </Paper>
          </Grid>

          {/* Pacientes */}
          <Grid item xs={6} sm={6} md={3}>
            <Paper
              elevation={2}
              sx={{
                p: 2.5,
                borderRadius: 4,
                border: "1px solid rgba(163,105,32,0.12)",
                background: "linear-gradient(135deg, rgba(255,246,234,0.95), rgba(255,255,255,0.90))",
                height: "100%",
              }}
            >
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
                <People sx={{ color: colorPrincipal, fontSize: 28 }} />
                <Typography sx={{ fontWeight: 800, color: "#2E2E2E", fontSize: 14 }}>Pacientes</Typography>
              </Box>
              <Typography variant="h4" sx={{ fontWeight: 900, color: colorPrincipal }}>
                {loading ? "—" : Number(kpi?.pacientes_unicos || 0)}
              </Typography>
              <Typography variant="caption" sx={{ color: "rgba(46,46,46,0.65)" }}>
                Pacientes únicos
              </Typography>
            </Paper>
          </Grid>

          {/* Ticket promedio */}
          <Grid item xs={6} sm={6} md={3}>
            <Paper
              elevation={2}
              sx={{
                p: 2.5,
                borderRadius: 4,
                border: "1px solid rgba(163,105,32,0.12)",
                background: "linear-gradient(135deg, rgba(255,246,234,0.95), rgba(255,255,255,0.90))",
                height: "100%",
              }}
            >
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
                <MedicalServices sx={{ color: colorPrincipal, fontSize: 28 }} />
                <Typography sx={{ fontWeight: 800, color: "#2E2E2E", fontSize: 14 }}>Ticket</Typography>
              </Box>
              <Typography variant="h5" sx={{ fontWeight: 900, color: colorPrincipal }}>
                {loading ? "—" : money(kpi?.ticket_promedio)}
              </Typography>
              <Typography variant="caption" sx={{ color: "rgba(46,46,46,0.65)" }}>
                Promedio por sesión (neto)
              </Typography>
            </Paper>
          </Grid>

          {/* Comisión POS */}
          <Grid item xs={6} sm={6} md={3}>
            <Paper
              elevation={2}
              sx={{
                p: 2.5,
                borderRadius: 4,
                border: "1px solid rgba(163,105,32,0.12)",
                background: "linear-gradient(135deg, rgba(255,246,234,0.95), rgba(255,255,255,0.90))",
                height: "100%",
              }}
            >
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
                <CreditCard sx={{ color: colorPrincipal, fontSize: 28 }} />
                <Typography sx={{ fontWeight: 800, color: "#2E2E2E", fontSize: 14 }}>Comisión POS</Typography>
              </Box>
              <Typography variant="h5" sx={{ fontWeight: 900, color: "#c0392b" }}>
                {loading ? "—" : money(comisionPos)}
              </Typography>
              <Typography variant="caption" sx={{ color: "rgba(46,46,46,0.65)" }}>
                4% en pagos con tarjeta
              </Typography>
            </Paper>
          </Grid>
        </Grid>

        {/* ========== INGRESOS (Bruto / Neto) ========== */}
        <Paper
          elevation={4}
          sx={{
            p: { xs: 2.5, sm: 3.5 },
            mb: 3,
            borderRadius: 4,
            backgroundColor: "rgba(255,255,255,0.92)",
            border: "1px solid rgba(163,105,32,0.15)",
          }}
        >
          <Typography sx={{ fontWeight: 900, color: "#2E2E2E", mb: 2, fontSize: 16 }}>
            Ingresos del mes
          </Typography>

          <Grid container spacing={3}>
            <Grid item xs={12} sm={4}>
              <Box
                sx={{
                  p: 2.5,
                  borderRadius: 3,
                  backgroundColor: "rgba(163,105,32,0.06)",
                  border: "1px solid rgba(163,105,32,0.15)",
                  textAlign: "center",
                }}
              >
                <AccountBalanceWallet sx={{ color: colorPrincipal, fontSize: 32, mb: 0.5 }} />
                <Typography variant="caption" sx={{ display: "block", color: "rgba(46,46,46,0.70)", fontWeight: 600 }}>
                  BRUTO
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 900, color: "#2E2E2E" }}>
                  {loading ? "—" : money(ingresosBruto)}
                </Typography>
              </Box>
            </Grid>

            <Grid item xs={12} sm={4}>
              <Box
                sx={{
                  p: 2.5,
                  borderRadius: 3,
                  backgroundColor: "rgba(39,174,96,0.08)",
                  border: "1px solid rgba(39,174,96,0.25)",
                  textAlign: "center",
                }}
              >
                <Paid sx={{ color: "#27ae60", fontSize: 32, mb: 0.5 }} />
                <Typography variant="caption" sx={{ display: "block", color: "rgba(46,46,46,0.70)", fontWeight: 600 }}>
                  NETO (lo que recibes)
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 900, color: "#27ae60" }}>
                  {loading ? "—" : money(ingresosNeto)}
                </Typography>
              </Box>
            </Grid>

            <Grid item xs={12} sm={4}>
              <Box
                sx={{
                  p: 2.5,
                  borderRadius: 3,
                  backgroundColor: "rgba(192,57,43,0.06)",
                  border: "1px solid rgba(192,57,43,0.20)",
                  textAlign: "center",
                }}
              >
                <CreditCard sx={{ color: "#c0392b", fontSize: 32, mb: 0.5 }} />
                <Typography variant="caption" sx={{ display: "block", color: "rgba(46,46,46,0.70)", fontWeight: 600 }}>
                  COMISIÓN POS (4%)
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 900, color: "#c0392b" }}>
                  {loading ? "—" : money(comisionPos)}
                </Typography>
              </Box>
            </Grid>
          </Grid>
        </Paper>

        {/* ========== TABLAS ========== */}
        <Grid container spacing={3}>
          {/* Top tratamientos */}
          <Grid item xs={12} md={6}>
            <Paper
              elevation={3}
              sx={{
                p: { xs: 2, sm: 3 },
                borderRadius: 4,
                backgroundColor: "rgba(255,255,255,0.92)",
                border: "1px solid rgba(163,105,32,0.12)",
              }}
            >
              <Typography sx={{ fontWeight: 900, color: "#2E2E2E", mb: 2 }}>
                Top tratamientos del mes
              </Typography>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ backgroundColor: "rgba(163,105,32,0.08)" }}>
                      <TableCell sx={{ fontWeight: 700 }}>Tratamiento</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700 }}>Sesiones</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700 }}>Ingresos (Neto)</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(data?.top_tratamientos || []).length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} align="center" sx={{ py: 3, color: "rgba(46,46,46,0.60)" }}>
                          {loading ? "Cargando..." : "Sin datos en este periodo"}
                        </TableCell>
                      </TableRow>
                    ) : (
                      (data?.top_tratamientos || []).map((r, idx) => (
                        <TableRow key={String(r.tratamiento_id || idx)} hover>
                          <TableCell>{r.tratamiento || "(No especificado)"}</TableCell>
                          <TableCell align="right">{Number(r.cantidad || 0)}</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 600, color: "#27ae60" }}>
                            {money(r.ingresos_neto)}
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
              elevation={3}
              sx={{
                p: { xs: 2, sm: 3 },
                borderRadius: 4,
                backgroundColor: "rgba(255,255,255,0.92)",
                border: "1px solid rgba(163,105,32,0.12)",
              }}
            >
              <Typography sx={{ fontWeight: 900, color: "#2E2E2E", mb: 2 }}>
                Pacientes frecuentes
              </Typography>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ backgroundColor: "rgba(163,105,32,0.08)" }}>
                      <TableCell sx={{ fontWeight: 700 }}>Paciente</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700 }}>Sesiones</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700 }}>Ingresos (Neto)</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(data?.pacientes_frecuentes || []).length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} align="center" sx={{ py: 3, color: "rgba(46,46,46,0.60)" }}>
                          {loading ? "Cargando..." : "Sin datos en este periodo"}
                        </TableCell>
                      </TableRow>
                    ) : (
                      (data?.pacientes_frecuentes || []).map((r, idx) => (
                        <TableRow key={String(r.paciente_id || idx)} hover>
                          <TableCell>{r.paciente || "(No especificado)"}</TableCell>
                          <TableCell align="right">{Number(r.sesiones || 0)}</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 600, color: "#27ae60" }}>
                            {money(r.ingresos_neto)}
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
