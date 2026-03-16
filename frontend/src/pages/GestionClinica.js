import React, { useState, useEffect } from "react";
import {
  Container,
  Typography,
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  Grid,
  Card,
  CardContent,
  CircularProgress,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Divider,
  Stack,
  Alert,
  TextField,
  Tooltip
} from "@mui/material";
import {
  TrendingUp,
  Person,
  AttachMoney,
  EventNote,
  Assessment,
  Home,
  Visibility,
  Close,
  ExpandMore,
  CalendarToday,
  LocalHospital,
  FilterList,
  Refresh,
  Download,
  Groups,
  MedicalServices,
  Percent,
  BarChart,
  Save,
  Edit,
  AccountBalance,
  MoneyOff
} from "@mui/icons-material";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { useToast } from "../components/ToastProvider";
import { formatearFechaCorta } from "../utils/dateUtils";

const API_BASE_URL = process.env.REACT_APP_API_URL || `${window.location.protocol}//${window.location.hostname}:4000`;

const GestionClinica = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [especialistas, setEspecialistas] = useState([]);
  const [estadisticas, setEstadisticas] = useState([]);
  const [tratamientos, setTratamientos] = useState([]);
  const [tratamientosDisponibles, setTratamientosDisponibles] = useState([]);
  const [resumenGeneral, setResumenGeneral] = useState({
    total_atenciones: 0,
    total_ingresos: 0,
    total_pago_especialistas: 0,
    total_ganancia_clinica: 0,
    total_pacientes_unicos: 0,
    total_especialistas: 0,
    promedio_por_sesion: 0
  });
  const [editandoComision, setEditandoComision] = useState({});
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");
  const [mesFiltro, setMesFiltro] = useState("");
  const [anioFiltro, setAnioFiltro] = useState("");
  const [especialistaFiltro, setEspecialistaFiltro] = useState("");
  const [tipoEspecialistaFiltro, setTipoEspecialistaFiltro] = useState("");
  const [tratamientoFiltro, setTratamientoFiltro] = useState("");
  const [mostrarDetalleTratamientos, setMostrarDetalleTratamientos] = useState(false);
  const [modalDetalle, setModalDetalle] = useState({ abierto: false, especialista: null, datos: null });
  const [loadingDetalle, setLoadingDetalle] = useState(false);

  const token = localStorage.getItem("token");
  const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};

  useEffect(() => {
    cargarEspecialistas();
    cargarTratamientos();
    cargarEstadisticas();
  }, []);

  const cargarEspecialistas = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/especialistas/listar`);
      setEspecialistas(res.data || []);
    } catch (err) {
      console.error("Error al obtener especialistas:", err);
    }
  };

  const cargarTratamientos = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/gestion-clinica/tratamientos`, { headers: authHeaders });
      setTratamientosDisponibles(res.data || []);
    } catch (err) {
      console.error("Error al obtener tratamientos:", err);
    }
  };

  const cargarEstadisticas = async (overrides = {}) => {
    setLoading(true);
    try {
      const fi = overrides.fechaInicio !== undefined ? overrides.fechaInicio : fechaInicio;
      const ff = overrides.fechaFin !== undefined ? overrides.fechaFin : fechaFin;
      const params = new URLSearchParams();
      if (fi) params.append("fecha_inicio", fi);
      if (ff) params.append("fecha_fin", ff);
      if (especialistaFiltro) params.append("especialista_id", especialistaFiltro);
      if (tratamientoFiltro) params.append("tratamiento", tratamientoFiltro);

      const response = await axios.get(
        `${API_BASE_URL}/api/gestion-clinica/estadisticas?${params.toString()}`,
        { headers: authHeaders }
      );

      setEstadisticas(response.data.estadisticas || []);
      setTratamientos(response.data.tratamientos || []);
      setResumenGeneral(response.data.resumen || {
        total_atenciones: 0,
        total_ingresos: 0,
        total_pago_especialistas: 0,
        total_ganancia_clinica: 0,
        total_pacientes_unicos: 0,
        total_especialistas: 0,
        promedio_por_sesion: 0
      });
    } catch (error) {
      console.error("Error al cargar estadísticas:", error);
      showToast({ severity: "error", message: "Error al cargar estadísticas" });
    } finally {
      setLoading(false);
    }
  };

  const limpiarFiltros = () => {
    setFechaInicio("");
    setFechaFin("");
    setMesFiltro("");
    setAnioFiltro("");
    setEspecialistaFiltro("");
    setTipoEspecialistaFiltro("");
    setTratamientoFiltro("");
    cargarEstadisticas();
  };

  const filtrarPorMes = (mes) => {
    const anio = new Date().getFullYear();
    const primerDia = new Date(anio, mes - 1, 1);
    const ultimoDia = new Date(anio, mes, 0);
    
    const formatoISO = (d) => {
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      return `${yyyy}-${mm}-${dd}`;
    };
    
    const fi = formatoISO(primerDia);
    const ff = formatoISO(ultimoDia);
    setFechaInicio(fi);
    setFechaFin(ff);
    setMesFiltro(mes);
    cargarEstadisticas({ fechaInicio: fi, fechaFin: ff });
  };

  const verDetalleEspecialista = async (especialista) => {
    if (!especialista || !especialista.especialista_id) {
      showToast({ severity: "error", message: "Especialista no válido" });
      return;
    }

    setLoadingDetalle(true);
    setModalDetalle({ abierto: true, especialista, datos: null });
    
    try {
      const params = new URLSearchParams();
      if (fechaInicio) params.append("fecha_inicio", fechaInicio);
      if (fechaFin) params.append("fecha_fin", fechaFin);
      if (tratamientoFiltro) params.append("tratamiento", tratamientoFiltro);

      const url = `${API_BASE_URL}/api/gestion-clinica/especialista/${especialista.especialista_id}/detalle${params.toString() ? '?' + params.toString() : ''}`;
      console.log("Cargando detalle desde:", url);

      const response = await axios.get(url, { headers: authHeaders });

      console.log("Datos recibidos:", response.data);
      setModalDetalle({ abierto: true, especialista, datos: response.data });
    } catch (error) {
      console.error("Error al cargar detalle:", error);
      showToast({ severity: "error", message: `Error al cargar detalle: ${error.message}` });
      setModalDetalle({ abierto: false, especialista: null, datos: null });
    } finally {
      setLoadingDetalle(false);
    }
  };

  const cerrarModalDetalle = () => {
    setModalDetalle({ abierto: false, especialista: null, datos: null });
  };

  const iniciarEdicion = (espId, comision, pagoFijo) => {
    setEditandoComision(prev => ({
      ...prev,
      [espId]: { comision_porcentaje: comision, pago_fijo: pagoFijo }
    }));
  };

  const cancelarEdicion = (espId) => {
    setEditandoComision(prev => {
      const nuevo = { ...prev };
      delete nuevo[espId];
      return nuevo;
    });
  };

  const guardarComision = async (espId) => {
    const datos = editandoComision[espId];
    if (!datos) return;

    try {
      await axios.put(
        `${API_BASE_URL}/api/especialistas/comision/${espId}`,
        {
          comision_porcentaje: datos.comision_porcentaje,
          pago_fijo: datos.pago_fijo
        },
        { headers: authHeaders }
      );
      showToast({ severity: "success", message: "Comisión actualizada correctamente" });
      cancelarEdicion(espId);
      cargarEstadisticas();
    } catch (error) {
      console.error("Error al guardar comisión:", error);
      showToast({ severity: "error", message: error.response?.data?.message || "Error al guardar comisión" });
    }
  };

  const exportarCSV = () => {
    if (!estadisticas || estadisticas.length === 0) {
      showToast({ severity: "warning", message: "No hay datos para exportar" });
      return;
    }

    const headers = ["Especialista", "Total Atenciones", "Pacientes Únicos", "Ingresos (S/)", "Comisión %", "Pago Fijo (S/)", "Pago Total Esp. (S/)", "Ganancia Clínica (S/)"];
    const rows = estadisticas.map(stat => [
      stat.especialista_nombre,
      stat.total_atenciones,
      stat.pacientes_unicos || 0,
      Number(stat.total_ingresos).toFixed(2),
      Number(stat.comision_porcentaje).toFixed(0),
      Number(stat.pago_fijo).toFixed(2),
      Number(stat.pago_total_especialista).toFixed(2),
      Number(stat.ganancia_clinica).toFixed(2)
    ]);

    const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const fecha = new Date().toISOString().split("T")[0];
    link.download = `gestion_clinica_${fecha}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    showToast({ severity: "success", message: "Reporte exportado exitosamente" });
  };

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      {/* Header */}
      <Paper 
        elevation={3} 
        sx={{ 
          p: 3, 
          mb: 3, 
          background: "linear-gradient(135deg, #a36920 0%, #c48a3a 100%)",
          color: "white"
        }}
      >
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: "bold", mb: 1, display: "flex", alignItems: "center" }}>
              <Assessment sx={{ mr: 2, fontSize: 40 }} />
              Gestión Clínica
            </Typography>
            <Typography variant="body1">
              Control de atenciones, productividad y liquidación mensual
            </Typography>
          </Box>
          <Button
            variant="contained"
            startIcon={<Home />}
            onClick={() => navigate("/dashboard")}
            sx={{
              backgroundColor: "white",
              color: "#a36920",
              "&:hover": {
                backgroundColor: "#f5f5f5"
              }
            }}
          >
            Cerrar Sesión
          </Button>
        </Box>
      </Paper>

      {/* Filtros */}
      <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
          <FilterList sx={{ mr: 1, color: "#a36920" }} />
          <Typography variant="h6" sx={{ fontWeight: "bold", color: "#a36920" }}>
            Filtros de Búsqueda
          </Typography>
        </Box>
        <Divider sx={{ mb: 2 }} />
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12}>
            <Typography variant="subtitle2" sx={{ fontWeight: "bold", color: "#666", mb: 1 }}>
              Filtrar por Mes (Año {new Date().getFullYear()})
            </Typography>
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
              {[
                { mes: 1, nombre: "Enero" },
                { mes: 2, nombre: "Febrero" },
                { mes: 3, nombre: "Marzo" },
                { mes: 4, nombre: "Abril" },
                { mes: 5, nombre: "Mayo" },
                { mes: 6, nombre: "Junio" },
                { mes: 7, nombre: "Julio" },
                { mes: 8, nombre: "Agosto" },
                { mes: 9, nombre: "Septiembre" },
                { mes: 10, nombre: "Octubre" },
                { mes: 11, nombre: "Noviembre" },
                { mes: 12, nombre: "Diciembre" }
              ].map(({ mes, nombre }) => (
                <Button
                  key={mes}
                  variant={mesFiltro === mes ? "contained" : "outlined"}
                  size="small"
                  onClick={() => filtrarPorMes(mes)}
                  sx={{
                    backgroundColor: mesFiltro === mes ? "#a36920" : "transparent",
                    borderColor: "#a36920",
                    color: mesFiltro === mes ? "white" : "#a36920",
                    "&:hover": {
                      backgroundColor: mesFiltro === mes ? "#8a5a1a" : "rgba(163, 105, 32, 0.1)"
                    },
                    minWidth: 90,
                    fontWeight: "bold",
                    fontSize: "0.75rem"
                  }}
                >
                  {nombre}
                </Button>
              ))}
            </Box>
          </Grid>
          <Grid item xs={12}>
            <Divider sx={{ my: 1 }} />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Especialista</InputLabel>
              <Select
                value={especialistaFiltro}
                onChange={(e) => setEspecialistaFiltro(e.target.value)}
                label="Especialista"
              >
                <MenuItem value="">Todos</MenuItem>
                {especialistas.map((esp) => (
                  <MenuItem key={esp.id} value={esp.id}>
                    {esp.nombre}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6} md={2.5}>
            <FormControl fullWidth size="small">
              <InputLabel>Tipo</InputLabel>
              <Select
                value={tipoEspecialistaFiltro}
                onChange={(e) => setTipoEspecialistaFiltro(e.target.value)}
                label="Tipo"
              >
                <MenuItem value="">Todos</MenuItem>
                <MenuItem value="doctor">Doctor</MenuItem>
                <MenuItem value="cosmiatra">Cosmiatra</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6} md={3.5}>
            <FormControl fullWidth size="small">
              <InputLabel>Tratamiento</InputLabel>
              <Select
                value={tratamientoFiltro}
                onChange={(e) => setTratamientoFiltro(e.target.value)}
                label="Tratamiento"
              >
                <MenuItem value="">Todos</MenuItem>
                {tratamientosDisponibles.map((trat, index) => (
                  <MenuItem key={index} value={trat}>
                    {trat}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Stack direction="row" spacing={1}>
              <Button
                variant="contained"
                onClick={cargarEstadisticas}
                fullWidth
                startIcon={<FilterList />}
                sx={{ backgroundColor: "#a36920", "&:hover": { backgroundColor: "#8a5a1a" } }}
              >
                Aplicar
              </Button>
              <Button
                variant="outlined"
                onClick={limpiarFiltros}
                fullWidth
                startIcon={<Refresh />}
              >
                Limpiar
              </Button>
            </Stack>
          </Grid>
        </Grid>
      </Paper>


      {/* Tarjetas KPI de Resumen General */}
      {!loading && estadisticas.length > 0 && (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6} md={2.4}>
            <Card elevation={2} sx={{ borderTop: "4px solid #a36920" }}>
              <CardContent sx={{ textAlign: "center", py: 2 }}>
                <MedicalServices sx={{ fontSize: 32, color: "#a36920", mb: 0.5 }} />
                <Typography variant="h4" sx={{ fontWeight: "bold", color: "#333" }}>
                  {resumenGeneral.total_atenciones}
                </Typography>
                <Typography variant="caption" sx={{ color: "#666" }}>
                  Total Atenciones
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={2.4}>
            <Card elevation={2} sx={{ borderTop: "4px solid #4caf50" }}>
              <CardContent sx={{ textAlign: "center", py: 2 }}>
                <AttachMoney sx={{ fontSize: 32, color: "#4caf50", mb: 0.5 }} />
                <Typography variant="h4" sx={{ fontWeight: "bold", color: "#333" }}>
                  S/ {Number(resumenGeneral.total_ingresos).toFixed(2)}
                </Typography>
                <Typography variant="caption" sx={{ color: "#666" }}>
                  Ingresos Totales
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={2.4}>
            <Card elevation={2} sx={{ borderTop: "4px solid #ff9800" }}>
              <CardContent sx={{ textAlign: "center", py: 2 }}>
                <MoneyOff sx={{ fontSize: 32, color: "#ff9800", mb: 0.5 }} />
                <Typography variant="h4" sx={{ fontWeight: "bold", color: "#333" }}>
                  S/ {Number(resumenGeneral.total_pago_especialistas).toFixed(2)}
                </Typography>
                <Typography variant="caption" sx={{ color: "#666" }}>
                  Pago Especialistas
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={2.4}>
            <Card elevation={2} sx={{ borderTop: "4px solid #2e7d32" }}>
              <CardContent sx={{ textAlign: "center", py: 2 }}>
                <AccountBalance sx={{ fontSize: 32, color: "#2e7d32", mb: 0.5 }} />
                <Typography variant="h4" sx={{ fontWeight: "bold", color: "#2e7d32" }}>
                  S/ {Number(resumenGeneral.total_ganancia_clinica).toFixed(2)}
                </Typography>
                <Typography variant="caption" sx={{ color: "#666" }}>
                  Ganancia Clínica
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={2.4}>
            <Card elevation={2} sx={{ borderTop: "4px solid #2196f3" }}>
              <CardContent sx={{ textAlign: "center", py: 2 }}>
                <Groups sx={{ fontSize: 32, color: "#2196f3", mb: 0.5 }} />
                <Typography variant="h4" sx={{ fontWeight: "bold", color: "#333" }}>
                  {resumenGeneral.total_pacientes_unicos || 0}
                </Typography>
                <Typography variant="caption" sx={{ color: "#666" }}>
                  Pacientes Atendidos
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Lista de Especialistas */}
      <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2 }}>
          <Box sx={{ display: "flex", alignItems: "center" }}>
            <Person sx={{ mr: 1, color: "#a36920" }} />
            <Typography variant="h6" sx={{ fontWeight: "bold", color: "#a36920" }}>
              Lista de Especialistas
            </Typography>
          </Box>
          {estadisticas.length > 0 && (
            <Button
              variant="outlined"
              size="small"
              startIcon={<Download />}
              onClick={exportarCSV}
              sx={{ borderColor: "#a36920", color: "#a36920", "&:hover": { borderColor: "#8a5a1a", backgroundColor: "#fff8f0" } }}
            >
              Exportar CSV
            </Button>
          )}
        </Box>
        <Divider sx={{ mb: 2 }} />
        
        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", p: 6 }}>
            <CircularProgress size={60} sx={{ color: "#a36920" }} />
          </Box>
        ) : estadisticas.length === 0 ? (
          <Alert severity="info" sx={{ my: 3 }}>
            No hay datos disponibles para el período seleccionado. Selecciona diferentes filtros y haz clic en "Aplicar".
          </Alert>
        ) : (
          <TableContainer sx={{ maxHeight: 600 }}>
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: "bold", bgcolor: "#f5f5f5", minWidth: 180 }}>Nombre Completo</TableCell>
                  <TableCell align="center" sx={{ fontWeight: "bold", bgcolor: "#f5f5f5", minWidth: 100 }}>Tipo</TableCell>
                  <TableCell align="center" sx={{ fontWeight: "bold", bgcolor: "#e3f2fd" }}>Pacientes Atendidos</TableCell>
                  <TableCell align="center" sx={{ fontWeight: "bold", bgcolor: "#e3f2fd" }}>Tratamientos Realizados</TableCell>
                  <TableCell align="right" sx={{ fontWeight: "bold", bgcolor: "#e8f5e9" }}>Monto Generado</TableCell>
                  <TableCell align="center" sx={{ fontWeight: "bold", bgcolor: "#fff8e1", minWidth: 90 }}>% Comisión</TableCell>
                  <TableCell align="right" sx={{ fontWeight: "bold", bgcolor: "#fff8e1" }}>Comisión Calculada</TableCell>
                  <TableCell align="right" sx={{ fontWeight: "bold", bgcolor: "#fff3e0", minWidth: 100 }}>Sueldo Fijo</TableCell>
                  <TableCell align="right" sx={{ fontWeight: "bold", bgcolor: "#ffebee", minWidth: 120 }}>Total a Pagar</TableCell>
                  <TableCell align="center" sx={{ fontWeight: "bold", bgcolor: "#f5f5f5", minWidth: 160 }}>Acciones</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {estadisticas.map((stat, index) => {
                  const editando = editandoComision[stat.especialista_id];
                  return (
                  <TableRow
                    key={index}
                    sx={{
                      "&:hover": { backgroundColor: "#f9f9f9" },
                      borderLeft: stat.total_atenciones > 0 ? "4px solid #a36920" : "4px solid #e0e0e0",
                      opacity: stat.total_atenciones > 0 ? 1 : 0.6
                    }}
                  >
                    <TableCell>
                      <Box sx={{ display: "flex", alignItems: "center" }}>
                        <Person sx={{ mr: 1, color: "#a36920", fontSize: 20 }} />
                        <Typography variant="body2" sx={{ fontWeight: "bold" }}>
                          {stat.especialista_nombre}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell align="center">
                      <Chip
                        label={stat.tipo || "Doctor"}
                        size="small"
                        color={stat.tipo === "Cosmiatra" ? "secondary" : "primary"}
                        sx={{ fontWeight: "bold", fontSize: "0.7rem" }}
                      />
                    </TableCell>
                    <TableCell align="center" sx={{ bgcolor: "#e3f2fd" }}>
                      <Typography variant="body2" sx={{ fontWeight: "bold", color: "#1976d2" }}>
                        {stat.pacientes_unicos || 0}
                      </Typography>
                    </TableCell>
                    <TableCell align="center" sx={{ bgcolor: "#e3f2fd" }}>
                      <Chip
                        label={stat.total_atenciones}
                        size="small"
                        color={stat.total_atenciones > 0 ? "info" : "default"}
                        sx={{ fontWeight: "bold", minWidth: 40 }}
                      />
                    </TableCell>
                    <TableCell align="right" sx={{ bgcolor: "#e8f5e9" }}>
                      <Typography variant="body2" sx={{ fontWeight: "bold", color: "#2e7d32" }}>
                        S/ {Number(stat.total_ingresos).toFixed(2)}
                      </Typography>
                    </TableCell>
                    <TableCell align="center" sx={{ bgcolor: "#fff8e1" }}>
                      {editando ? (
                        <TextField
                          type="number"
                          size="small"
                          value={editando.comision_porcentaje}
                          onChange={(e) => setEditandoComision(prev => ({
                            ...prev,
                            [stat.especialista_id]: { ...prev[stat.especialista_id], comision_porcentaje: e.target.value }
                          }))}
                          inputProps={{ min: 0, max: 100, step: 1 }}
                          sx={{ width: 70, "& input": { textAlign: "center", py: 0.5, fontSize: "0.85rem" } }}
                        />
                      ) : (
                        <Chip
                          label={`${Number(stat.comision_porcentaje).toFixed(0)}%`}
                          size="small"
                          variant="outlined"
                          sx={{ fontWeight: "bold", color: "#ff9800", borderColor: "#ff9800" }}
                        />
                      )}
                    </TableCell>
                    <TableCell align="center" sx={{ bgcolor: "#fff8e1" }}>
                      {editando ? (
                        <TextField
                          type="number"
                          size="small"
                          value={editando.pago_fijo}
                          onChange={(e) => setEditandoComision(prev => ({
                            ...prev,
                            [stat.especialista_id]: { ...prev[stat.especialista_id], pago_fijo: e.target.value }
                          }))}
                          inputProps={{ min: 0, step: 5 }}
                          sx={{ width: 80, "& input": { textAlign: "center", py: 0.5, fontSize: "0.85rem" } }}
                        />
                      ) : (
                        <Typography variant="body2" sx={{ color: stat.pago_fijo > 0 ? "#333" : "#999" }}>
                          S/ {Number(stat.pago_fijo).toFixed(2)}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell align="right" sx={{ bgcolor: "#fff8e1" }}>
                      <Typography variant="body2" sx={{ fontWeight: "bold", color: "#f57c00" }}>
                        S/ {Number(stat.comision_calculada).toFixed(2)}
                      </Typography>
                    </TableCell>
                    <TableCell align="right" sx={{ bgcolor: "#fff3e0" }}>
                      {editando ? (
                        <TextField
                          type="number"
                          size="small"
                          value={editando.pago_fijo}
                          onChange={(e) => setEditandoComision(prev => ({
                            ...prev,
                            [stat.especialista_id]: { ...prev[stat.especialista_id], pago_fijo: e.target.value }
                          }))}
                          inputProps={{ min: 0, step: 5 }}
                          sx={{ width: 90, "& input": { textAlign: "right", py: 0.5, fontSize: "0.85rem" } }}
                        />
                      ) : (
                        <Typography variant="body2" sx={{ fontWeight: "bold", color: stat.pago_fijo > 0 ? "#e65100" : "#999" }}>
                          S/ {Number(stat.pago_fijo).toFixed(2)}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell align="right" sx={{ bgcolor: "#ffebee" }}>
                      <Tooltip title={`Comisión: S/ ${Number(stat.comision_calculada).toFixed(2)} + Sueldo Fijo: S/ ${Number(stat.pago_fijo).toFixed(2)}`}>
                        <Typography variant="body2" sx={{ fontWeight: "bold", color: "#c62828", fontSize: "0.95rem" }}>
                          S/ {Number(stat.pago_total_especialista).toFixed(2)}
                        </Typography>
                      </Tooltip>
                    </TableCell>
                    <TableCell align="center">
                      <Stack direction="row" spacing={0.5} justifyContent="center">
                        {editando ? (
                          <>
                            <Tooltip title="Guardar">
                              <IconButton
                                size="small"
                                onClick={() => guardarComision(stat.especialista_id)}
                                sx={{ color: "#4caf50" }}
                              >
                                <Save fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Cancelar">
                              <IconButton
                                size="small"
                                onClick={() => cancelarEdicion(stat.especialista_id)}
                                sx={{ color: "#d32f2f" }}
                              >
                                <Close fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </>
                        ) : (
                          <Tooltip title="Editar comisión">
                            <IconButton
                              size="small"
                              onClick={() => iniciarEdicion(stat.especialista_id, stat.comision_porcentaje, stat.pago_fijo)}
                              sx={{ color: "#ff9800" }}
                            >
                              <Edit fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                        <Button
                          variant="contained"
                          size="small"
                          startIcon={<Visibility />}
                          onClick={() => verDetalleEspecialista(stat)}
                          sx={{ 
                            backgroundColor: "#a36920", 
                            "&:hover": { backgroundColor: "#8a5a1a" },
                            fontSize: "0.7rem",
                            py: 0.3
                          }}
                        >
                          Detalle
                        </Button>
                      </Stack>
                    </TableCell>
                  </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>


      {/* Modal de Detalle */}
      <Dialog
        open={modalDetalle.abierto}
        onClose={cerrarModalDetalle}
        maxWidth="lg"
        fullWidth
        PaperProps={{
          elevation: 8,
          sx: { borderRadius: 2 }
        }}
      >
        <DialogTitle 
          sx={{ 
            background: "linear-gradient(135deg, #a36920 0%, #c48a3a 100%)",
            color: "white",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center"
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center" }}>
            <Person sx={{ mr: 1, fontSize: 30 }} />
            <Typography variant="h6" component="span">
              Detalle Completo - {modalDetalle.especialista?.especialista_nombre}
            </Typography>
          </Box>
          <IconButton onClick={cerrarModalDetalle} sx={{ color: "white" }}>
            <Close />
          </IconButton>
        </DialogTitle>
        
        <DialogContent sx={{ mt: 3, minHeight: 400 }}>
          {loadingDetalle ? (
            <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: 300 }}>
              <CircularProgress size={60} sx={{ color: "#a36920" }} />
            </Box>
          ) : modalDetalle.datos && modalDetalle.datos.sesiones ? (
            <>
              {/* Resumen del Especialista */}
              {(() => {
                const esp = modalDetalle.especialista;
                const totales = modalDetalle.datos.totales || {};
                const porcentaje = esp?.comision_porcentaje || 20;
                const pagoFijo = esp?.pago_fijo || 0;
                const ingresos = Number(totales.total_ingresos || 0);
                const sesiones = totales.total_sesiones || 0;
                const comisionCalc = ingresos * (porcentaje / 100);
                const pagoTotalEsp = comisionCalc + pagoFijo;
                const ganancia = Math.max(0, ingresos - pagoTotalEsp);
                return (
              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={6} sm={2.4}>
                  <Card variant="outlined" sx={{ textAlign: "center", borderColor: "#a36920" }}>
                    <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
                      <Typography variant="h5" sx={{ fontWeight: "bold", color: "#a36920" }}>
                        {sesiones}
                      </Typography>
                      <Typography variant="caption" sx={{ color: "#666" }}>Total Sesiones</Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={6} sm={2.4}>
                  <Card variant="outlined" sx={{ textAlign: "center", borderColor: "#4caf50" }}>
                    <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
                      <Typography variant="h5" sx={{ fontWeight: "bold", color: "#4caf50" }}>
                        S/ {ingresos.toFixed(2)}
                      </Typography>
                      <Typography variant="caption" sx={{ color: "#666" }}>Ingresos</Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={6} sm={2.4}>
                  <Card variant="outlined" sx={{ textAlign: "center", borderColor: "#ff9800" }}>
                    <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
                      <Typography variant="h5" sx={{ fontWeight: "bold", color: "#ff9800" }}>
                        S/ {pagoTotalEsp.toFixed(2)}
                      </Typography>
                      <Typography variant="caption" sx={{ color: "#666" }}>
                        Pago Esp. ({porcentaje}%{pagoFijo > 0 ? ` + S/ ${Number(pagoFijo).toFixed(2)} fijo` : ""})
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={6} sm={2.4}>
                  <Card variant="outlined" sx={{ textAlign: "center", borderColor: "#2e7d32" }}>
                    <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
                      <Typography variant="h5" sx={{ fontWeight: "bold", color: "#2e7d32" }}>
                        S/ {ganancia.toFixed(2)}
                      </Typography>
                      <Typography variant="caption" sx={{ color: "#666" }}>Ganancia Clínica</Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={6} sm={2.4}>
                  <Card variant="outlined" sx={{ textAlign: "center", borderColor: "#9c27b0" }}>
                    <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
                      <Typography variant="h5" sx={{ fontWeight: "bold", color: "#9c27b0" }}>
                        S/ {sesiones > 0 ? (ingresos / sesiones).toFixed(2) : "0.00"}
                      </Typography>
                      <Typography variant="caption" sx={{ color: "#666" }}>Prom. Sesión</Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
                );
              })()}

              {/* Resumen por Tratamiento */}
              {modalDetalle.datos.tratamientos && modalDetalle.datos.tratamientos.length > 0 && (
                <Box sx={{ mb: 3 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: "bold", color: "#a36920", mb: 1 }}>
                    Resumen por Tratamiento
                  </Typography>
                  <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
                    {modalDetalle.datos.tratamientos.map((trat, idx) => (
                      <Chip
                        key={idx}
                        label={`${trat.tratamiento_nombre} (${trat.total_sesiones} ses. - S/ ${Number(trat.total_ingresos).toFixed(2)})`}
                        variant="outlined"
                        size="small"
                        sx={{ borderColor: "#a36920", color: "#333" }}
                      />
                    ))}
                  </Box>
                  <Divider sx={{ mt: 2 }} />
                </Box>
              )}

              {/* Tabla Detallada Tipo Historial Clínico */}
              <Typography variant="h6" sx={{ mb: 2, fontWeight: "bold", color: "#a36920" }}>
                Historial de Tratamientos Realizados
              </Typography>
              
              {modalDetalle.datos.sesiones.length > 0 ? (
                <TableContainer sx={{ maxHeight: 600 }}>
                  <Table stickyHeader size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight: "bold", bgcolor: "#f5f5f5" }}>Fecha</TableCell>
                        <TableCell sx={{ fontWeight: "bold", bgcolor: "#f5f5f5" }}>Paciente</TableCell>
                        <TableCell sx={{ fontWeight: "bold", bgcolor: "#f5f5f5" }}>Tratamiento</TableCell>
                        <TableCell sx={{ fontWeight: "bold", bgcolor: "#f5f5f5" }}>Tipo</TableCell>
                        <TableCell sx={{ fontWeight: "bold", bgcolor: "#f5f5f5" }}>Paquete</TableCell>
                        <TableCell sx={{ fontWeight: "bold", bgcolor: "#f5f5f5" }}>Productos Usados</TableCell>
                        <TableCell align="right" sx={{ fontWeight: "bold", bgcolor: "#f5f5f5" }}>Precio</TableCell>
                        <TableCell align="right" sx={{ fontWeight: "bold", bgcolor: "#f5f5f5" }}>Descuento</TableCell>
                        <TableCell align="right" sx={{ fontWeight: "bold", bgcolor: "#fff3e0" }}>Total</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {modalDetalle.datos.sesiones.map((sesion, idx) => (
                        <TableRow key={idx} sx={{ "&:hover": { backgroundColor: "#f9f9f9" } }}>
                          <TableCell>
                            <Box sx={{ display: "flex", alignItems: "center" }}>
                              <CalendarToday sx={{ fontSize: 16, mr: 1, color: "#666" }} />
                              <Typography variant="body2" sx={{ whiteSpace: "nowrap" }}>
                                {formatearFechaCorta(sesion.fecha_realizada)}
                              </Typography>
                            </Box>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" sx={{ fontWeight: "bold" }}>
                              {sesion.paciente_completo}
                            </Typography>
                            {sesion.paciente_dni && (
                              <Typography variant="caption" sx={{ color: "#666" }}>
                                DNI: {sesion.paciente_dni}
                              </Typography>
                            )}
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" sx={{ fontWeight: "bold" }}>
                              {sesion.tratamiento_nombre}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Chip 
                              label={sesion.tipo} 
                              size="small"
                              color={sesion.tipo === 'Paquete' ? 'info' : 'success'}
                            />
                          </TableCell>
                          <TableCell>
                            {sesion.paquete_nombre ? (
                              <Box>
                                <Typography variant="body2" sx={{ fontWeight: "bold" }}>
                                  {sesion.paquete_nombre}
                                </Typography>
                                <Typography variant="caption" sx={{ color: "#666" }}>
                                  Sesión {sesion.sesion_numero}
                                </Typography>
                              </Box>
                            ) : (
                              <Typography variant="body2" sx={{ color: "#999" }}>-</Typography>
                            )}
                          </TableCell>
                          <TableCell>
                            {sesion.productos_usados && sesion.productos_usados.length > 0 ? (
                              <Box>
                                {sesion.productos_usados.map((prod, pIdx) => (
                                  <Typography key={pIdx} variant="caption" sx={{ display: "block" }}>
                                    • {prod.nombre || prod.variante_nombre || 'Producto'} 
                                    {prod.cantidad && ` (${prod.cantidad})`}
                                  </Typography>
                                ))}
                              </Box>
                            ) : (
                              <Typography variant="caption" sx={{ color: "#999" }}>Sin productos</Typography>
                            )}
                          </TableCell>
                          <TableCell align="right">
                            <Typography variant="body2">
                              S/ {Number(sesion.precio_sesion || 0).toFixed(2)}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            {sesion.descuento_aplicado > 0 ? (
                              <Chip 
                                label={`-${Number(sesion.descuento_aplicado).toFixed(0)}%`}
                                size="small"
                                color="warning"
                              />
                            ) : (
                              <Typography variant="body2" sx={{ color: "#999" }}>-</Typography>
                            )}
                          </TableCell>
                          <TableCell align="right" sx={{ bgcolor: "#fff3e0" }}>
                            <Typography variant="body2" sx={{ fontWeight: "bold", color: "#4caf50" }}>
                              S/ {Number(sesion.precio_final || sesion.precio_sesion || 0).toFixed(2)}
                            </Typography>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              ) : (
                <Alert severity="info">No hay tratamientos registrados para este especialista.</Alert>
              )}

              {/* Tabla de Productos Usados */}
              {modalDetalle.datos.sesiones && modalDetalle.datos.sesiones.length > 0 && (() => {
                const productosUsados = [];
                modalDetalle.datos.sesiones.forEach(sesion => {
                  if (sesion.productos_usados && sesion.productos_usados.length > 0) {
                    sesion.productos_usados.forEach(prod => {
                      const key = `${prod.nombre || prod.variante_nombre || 'Producto'}_${prod.variante_id || ''}`;
                      const existing = productosUsados.find(p => 
                        `${p.nombre}_${p.variante_id}` === key
                      );
                      if (existing) {
                        existing.cantidad_total += parseFloat(prod.cantidad || 0);
                        existing.veces_usado += 1;
                      } else {
                        productosUsados.push({
                          nombre: prod.nombre || prod.variante_nombre || 'Producto',
                          variante_id: prod.variante_id,
                          cantidad_total: parseFloat(prod.cantidad || 0),
                          veces_usado: 1,
                          precio_unitario: prod.precio || 0
                        });
                      }
                    });
                  }
                });

                return productosUsados.length > 0 ? (
                  <Box sx={{ mt: 4 }}>
                    <Typography variant="h6" sx={{ mb: 2, fontWeight: "bold", color: "#a36920" }}>
                      Productos Usados
                    </Typography>
                    <TableContainer component={Paper} elevation={1}>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell sx={{ fontWeight: "bold", bgcolor: "#f5f5f5" }}>Producto</TableCell>
                            <TableCell align="center" sx={{ fontWeight: "bold", bgcolor: "#f5f5f5" }}>Cantidad Total Usada</TableCell>
                            <TableCell align="center" sx={{ fontWeight: "bold", bgcolor: "#f5f5f5" }}>Veces Usado</TableCell>
                            <TableCell align="right" sx={{ fontWeight: "bold", bgcolor: "#f5f5f5" }}>Costo Unit.</TableCell>
                            <TableCell align="right" sx={{ fontWeight: "bold", bgcolor: "#fff3e0" }}>Subtotal</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {productosUsados.map((prod, idx) => (
                            <TableRow key={idx} sx={{ "&:hover": { backgroundColor: "#f9f9f9" } }}>
                              <TableCell>
                                <Typography variant="body2" sx={{ fontWeight: "bold" }}>
                                  {prod.nombre}
                                </Typography>
                              </TableCell>
                              <TableCell align="center">
                                <Chip 
                                  label={`${prod.cantidad_total.toFixed(2)} ml`}
                                  size="small"
                                  color="info"
                                  sx={{ fontWeight: "bold" }}
                                />
                              </TableCell>
                              <TableCell align="center">
                                <Typography variant="body2" sx={{ color: "#666" }}>
                                  {prod.veces_usado} {prod.veces_usado === 1 ? 'vez' : 'veces'}
                                </Typography>
                              </TableCell>
                              <TableCell align="right">
                                <Typography variant="body2">
                                  S/ {Number(prod.precio_unitario).toFixed(2)}
                                </Typography>
                              </TableCell>
                              <TableCell align="right" sx={{ bgcolor: "#fff3e0" }}>
                                <Typography variant="body2" sx={{ fontWeight: "bold", color: "#f57c00" }}>
                                  S/ {(prod.cantidad_total * prod.precio_unitario).toFixed(2)}
                                </Typography>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Box>
                ) : null;
              })()}
            </>
          ) : (
            <Alert severity="warning">No se pudo cargar la información del especialista.</Alert>
          )}
        </DialogContent>
        
        <DialogActions sx={{ p: 2, bgcolor: "#f5f5f5" }}>
          <Button 
            onClick={cerrarModalDetalle} 
            variant="contained"
            sx={{ 
              backgroundColor: "#a36920",
              "&:hover": { backgroundColor: "#8a5a1a" }
            }}
          >
            Cerrar
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default GestionClinica;
