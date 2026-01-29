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
  Alert
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
  Refresh
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
  const [tratamientos, setTratamientos] = useState([]);
  const [tratamientosDisponibles, setTratamientosDisponibles] = useState([]);
  const [resumenGeneral, setResumenGeneral] = useState({
    total_atenciones: 0,
    total_ingresos: 0,
    total_comision_20: 0,
    promedio_por_sesion: 0
  });
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");
  const [especialistaFiltro, setEspecialistaFiltro] = useState("");
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

  const cargarEstadisticas = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (fechaInicio) params.append("fecha_inicio", fechaInicio);
      if (fechaFin) params.append("fecha_fin", fechaFin);
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
        total_comision_20: 0,
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
    setEspecialistaFiltro("");
    setTratamientoFiltro("");
    cargarEstadisticas();
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
              Sistema de control y comisiones de especialistas
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
          <Grid item xs={12} sm={6} md={2.5}>
            <Box>
              <Typography variant="caption" sx={{ display: "block", mb: 0.5, color: "#666" }}>
                Fecha Inicio
              </Typography>
              <input
                type="date"
                value={fechaInicio}
                onChange={(e) => setFechaInicio(e.target.value)}
                style={{
                  padding: "10px 12px",
                  fontSize: "14px",
                  border: "1px solid #ccc",
                  borderRadius: "4px",
                  width: "100%",
                  fontFamily: "inherit"
                }}
              />
            </Box>
          </Grid>
          <Grid item xs={12} sm={6} md={2.5}>
            <Box>
              <Typography variant="caption" sx={{ display: "block", mb: 0.5, color: "#666" }}>
                Fecha Fin
              </Typography>
              <input
                type="date"
                value={fechaFin}
                onChange={(e) => setFechaFin(e.target.value)}
                style={{
                  padding: "10px 12px",
                  fontSize: "14px",
                  border: "1px solid #ccc",
                  borderRadius: "4px",
                  width: "100%",
                  fontFamily: "inherit"
                }}
              />
            </Box>
          </Grid>
          <Grid item xs={12} sm={6} md={2.5}>
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
          <Grid item xs={12} sm={12} md={2}>
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


      {/* Lista de Especialistas */}
      <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
          <Person sx={{ mr: 1, color: "#a36920" }} />
          <Typography variant="h6" sx={{ fontWeight: "bold", color: "#a36920" }}>
            Lista de Especialistas
          </Typography>
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
            <Table stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: "bold", bgcolor: "#f5f5f5" }}>Especialista</TableCell>
                  <TableCell align="center" sx={{ fontWeight: "bold", bgcolor: "#f5f5f5" }}>Acciones</TableCell>
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
                        <Person sx={{ mr: 1, color: "#a36920" }} />
                        <Typography variant="h6" sx={{ fontWeight: "bold" }}>
                          {stat.especialista_nombre}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell align="center">
                      <Button
                        variant="contained"
                        size="small"
                        startIcon={<Visibility />}
                        onClick={() => verDetalleEspecialista(stat)}
                        sx={{ 
                          backgroundColor: "#a36920", 
                          "&:hover": { backgroundColor: "#8a5a1a" }
                        }}
                      >
                        Ver Detalle
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
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
                              <Typography variant="body2">
                                {new Date(sesion.fecha_realizada).toLocaleDateString('es-PE')}
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
