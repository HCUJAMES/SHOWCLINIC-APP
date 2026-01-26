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
  TextField,
  Button,
  Grid,
  Card,
  CardContent,
  CircularProgress,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip
} from "@mui/material";
import {
  TrendingUp,
  Person,
  AttachMoney,
  EventNote,
  Assessment,
  Home
} from "@mui/icons-material";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { useToast } from "../components/ToastProvider";

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "http://localhost:4000";

const GestionClinica = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [especialistas, setEspecialistas] = useState([]);
  const [estadisticas, setEstadisticas] = useState([]);
  const [resumenGeneral, setResumenGeneral] = useState({
    total_atenciones: 0,
    total_ingresos: 0,
    promedio_por_sesion: 0
  });
  
  // Filtros
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");
  const [especialistaFiltro, setEspecialistaFiltro] = useState("");

  const token = localStorage.getItem("token");
  const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};

  // Cargar especialistas
  useEffect(() => {
    axios
      .get(`${API_BASE_URL}/api/especialistas/listar`)
      .then((res) => setEspecialistas(res.data || []))
      .catch((err) => console.error("Error al obtener especialistas:", err));
  }, []);

  // Cargar estadísticas
  const cargarEstadisticas = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (fechaInicio) params.append("fecha_inicio", fechaInicio);
      if (fechaFin) params.append("fecha_fin", fechaFin);
      if (especialistaFiltro) params.append("especialista_id", especialistaFiltro);

      const response = await axios.get(
        `${API_BASE_URL}/api/gestion-clinica/estadisticas?${params.toString()}`,
        { headers: authHeaders }
      );

      setEstadisticas(response.data.estadisticas || []);
      setResumenGeneral(response.data.resumen || {
        total_atenciones: 0,
        total_ingresos: 0,
        promedio_por_sesion: 0
      });
    } catch (error) {
      console.error("Error al cargar estadísticas:", error);
      showToast({ severity: "error", message: "Error al cargar estadísticas" });
    } finally {
      setLoading(false);
    }
  };

  // Cargar estadísticas al montar el componente
  useEffect(() => {
    cargarEstadisticas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const limpiarFiltros = () => {
    setFechaInicio("");
    setFechaFin("");
    setEspecialistaFiltro("");
  };

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      <Box sx={{ mb: 4, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: "bold", color: "#a36920", mb: 1 }}>
            <Assessment sx={{ mr: 1, verticalAlign: "middle" }} />
            Gestión Clínica
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Estadísticas y gestión de atenciones por especialista
          </Typography>
        </Box>
        <Button
          variant="outlined"
          startIcon={<Home />}
          onClick={() => navigate("/dashboard")}
          sx={{
            borderColor: "#a36920",
            color: "#a36920",
            "&:hover": {
              borderColor: "#8a5a1a",
              backgroundColor: "rgba(163, 105, 32, 0.1)"
            }
          }}
        >
          Inicio
        </Button>
      </Box>

      {/* Filtros */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" sx={{ mb: 2, fontWeight: "bold" }}>
          Filtros
        </Typography>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              fullWidth
              label="Fecha Inicio"
              type="date"
              value={fechaInicio}
              onChange={(e) => setFechaInicio(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              fullWidth
              label="Fecha Fin"
              type="date"
              value={fechaFin}
              onChange={(e) => setFechaFin(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <FormControl fullWidth>
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
          <Grid item xs={12} sm={6} md={3}>
            <Box sx={{ display: "flex", gap: 1 }}>
              <Button
                variant="contained"
                onClick={cargarEstadisticas}
                fullWidth
                sx={{ backgroundColor: "#a36920", "&:hover": { backgroundColor: "#8a5a1a" } }}
              >
                Aplicar
              </Button>
              <Button
                variant="outlined"
                onClick={limpiarFiltros}
                fullWidth
              >
                Limpiar
              </Button>
            </Box>
          </Grid>
        </Grid>
      </Paper>

      {/* Resumen General */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={4}>
          <Card sx={{ background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)" }}>
            <CardContent>
              <Box sx={{ display: "flex", alignItems: "center", color: "white" }}>
                <EventNote sx={{ fontSize: 40, mr: 2 }} />
                <Box>
                  <Typography variant="h4" sx={{ fontWeight: "bold" }}>
                    {resumenGeneral.total_atenciones}
                  </Typography>
                  <Typography variant="body2">Total Atenciones</Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card sx={{ background: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)" }}>
            <CardContent>
              <Box sx={{ display: "flex", alignItems: "center", color: "white" }}>
                <AttachMoney sx={{ fontSize: 40, mr: 2 }} />
                <Box>
                  <Typography variant="h4" sx={{ fontWeight: "bold" }}>
                    S/ {Number(resumenGeneral.total_ingresos || 0).toFixed(2)}
                  </Typography>
                  <Typography variant="body2">Total Ingresos</Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card sx={{ background: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)" }}>
            <CardContent>
              <Box sx={{ display: "flex", alignItems: "center", color: "white" }}>
                <TrendingUp sx={{ fontSize: 40, mr: 2 }} />
                <Box>
                  <Typography variant="h4" sx={{ fontWeight: "bold" }}>
                    S/ {Number(resumenGeneral.promedio_por_sesion || 0).toFixed(2)}
                  </Typography>
                  <Typography variant="body2">Promedio por Sesión</Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Tabla de Estadísticas por Especialista */}
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" sx={{ mb: 2, fontWeight: "bold" }}>
          Estadísticas por Especialista
        </Typography>
        
        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
            <CircularProgress />
          </Box>
        ) : estadisticas.length === 0 ? (
          <Box sx={{ textAlign: "center", p: 4 }}>
            <Typography color="text.secondary">
              No hay datos disponibles para el período seleccionado
            </Typography>
          </Box>
        ) : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow sx={{ backgroundColor: "#f5f5f5" }}>
                  <TableCell sx={{ fontWeight: "bold" }}>
                    <Person sx={{ verticalAlign: "middle", mr: 1 }} />
                    Especialista
                  </TableCell>
                  <TableCell align="center" sx={{ fontWeight: "bold" }}>
                    Atenciones Paquetes
                  </TableCell>
                  <TableCell align="center" sx={{ fontWeight: "bold" }}>
                    Atenciones Presupuestos
                  </TableCell>
                  <TableCell align="center" sx={{ fontWeight: "bold" }}>
                    Total Atenciones
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: "bold" }}>
                    Ingresos Paquetes
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: "bold" }}>
                    Ingresos Presupuestos
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: "bold" }}>
                    Total Ingresos
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: "bold" }}>
                    Promedio/Sesión
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {estadisticas.map((stat, index) => (
                  <TableRow
                    key={index}
                    sx={{
                      "&:hover": { backgroundColor: "#f9f9f9" },
                      borderLeft: "4px solid #a36920"
                    }}
                  >
                    <TableCell>
                      <Box sx={{ display: "flex", alignItems: "center" }}>
                        <Chip
                          label={stat.especialista_nombre || "Sin asignar"}
                          color="primary"
                          size="small"
                          sx={{ mr: 1 }}
                        />
                      </Box>
                    </TableCell>
                    <TableCell align="center">
                      <Chip label={stat.atenciones_paquetes || 0} color="info" size="small" />
                    </TableCell>
                    <TableCell align="center">
                      <Chip label={stat.atenciones_presupuestos || 0} color="success" size="small" />
                    </TableCell>
                    <TableCell align="center">
                      <Typography sx={{ fontWeight: "bold", color: "#a36920" }}>
                        {(stat.atenciones_paquetes || 0) + (stat.atenciones_presupuestos || 0)}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      S/ {Number(stat.ingresos_paquetes || 0).toFixed(2)}
                    </TableCell>
                    <TableCell align="right">
                      S/ {Number(stat.ingresos_presupuestos || 0).toFixed(2)}
                    </TableCell>
                    <TableCell align="right">
                      <Typography sx={{ fontWeight: "bold", color: "#4caf50" }}>
                        S/ {Number((stat.ingresos_paquetes || 0) + (stat.ingresos_presupuestos || 0)).toFixed(2)}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography sx={{ fontWeight: "bold" }}>
                        S/ {Number(stat.promedio_por_sesion || 0).toFixed(2)}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>
    </Container>
  );
};

export default GestionClinica;
