import React, { useState, useEffect } from "react";
import {
  Container,
  Typography,
  Button,
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Grid,
  Autocomplete,
  Card,
  CardContent,
  Divider,
} from "@mui/material";
import {
  Add,
  Edit,
  Delete,
  Home,
  LocalOffer,
  CheckCircle,
  Cancel,
} from "@mui/icons-material";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { useToast } from "../components/ToastProvider";
import { useAuth } from "../hooks/useAuth";
import { canWritePackages, canDeletePackages } from "../utils/permissions";
import { COLORS } from "../constants";

const API_BASE_URL = `http://${window.location.hostname}:4000`;

const Paquetes = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { token, role } = useAuth();
  
  const canWrite = canWritePackages(role);
  const canDelete = canDeletePackages(role);

  const [paquetes, setPaquetes] = useState([]);
  const [tratamientos, setTratamientos] = useState([]);
  const [loading, setLoading] = useState(false);

  const [openModal, setOpenModal] = useState(false);
  const [modoEdicion, setModoEdicion] = useState(false);
  const [paqueteEditar, setPaqueteEditar] = useState(null);

  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [tratamientosSeleccionados, setTratamientosSeleccionados] = useState([]);
  const [precioRegular, setPrecioRegular] = useState(0);
  const [precioPaquete, setPrecioPaquete] = useState(0);
  const [vigenciaInicio, setVigenciaInicio] = useState("");
  const [vigenciaFin, setVigenciaFin] = useState("");

  const [openConfirmarEliminar, setOpenConfirmarEliminar] = useState(false);
  const [paqueteEliminar, setPaqueteEliminar] = useState(null);

  const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};

  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    setLoading(true);
    try {
      const [paquetesRes, tratamientosRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/api/paquetes`, { headers: authHeaders }),
        axios.get(`${API_BASE_URL}/api/tratamientos/listar`, { headers: authHeaders }),
      ]);

      setPaquetes(paquetesRes.data);
      setTratamientos(tratamientosRes.data);
    } catch (error) {
      console.error("Error al cargar datos:", error);
      showToast({ severity: "error", message: "Error al cargar datos" });
    } finally {
      setLoading(false);
    }
  };

  const abrirModalNuevo = () => {
    limpiarFormulario();
    setModoEdicion(false);
    setOpenModal(true);
  };

  const abrirModalEditar = (paquete) => {
    setPaqueteEditar(paquete);
    setNombre(paquete.nombre);
    setDescripcion(paquete.descripcion || "");
    
    // Cargar tratamientos seleccionados con precios unitarios
    try {
      const tratamientosIds = paquete.tratamientos_json ? JSON.parse(paquete.tratamientos_json) : [];
      const tratamientosData = tratamientosIds.map(item => {
        const t = tratamientos.find(tr => tr.id === item.tratamiento_id);
        return t ? { 
          ...t, 
          sesiones_tratamiento: item.sesiones || 1,
          precio_unitario: item.precio_unitario || 0
        } : null;
      }).filter(Boolean);
      setTratamientosSeleccionados(tratamientosData);
    } catch (e) {
      // Compatibilidad con formato antiguo (tratamiento_id único)
      if (paquete.tratamiento_id) {
        const t = tratamientos.find(tr => tr.id === paquete.tratamiento_id);
        setTratamientosSeleccionados(t ? [{ ...t, sesiones_tratamiento: 1, precio_unitario: 0 }] : []);
      } else {
        setTratamientosSeleccionados([]);
      }
    }

    setPrecioRegular(paquete.precio_regular);
    setPrecioPaquete(paquete.precio_paquete);
    setVigenciaInicio(paquete.vigencia_inicio || "");
    setVigenciaFin(paquete.vigencia_fin || "");

    setModoEdicion(true);
    setOpenModal(true);
  };

  const limpiarFormulario = () => {
    setPaqueteEditar(null);
    setNombre("");
    setDescripcion("");
    setTratamientosSeleccionados([]);
    setPrecioRegular(0);
    setPrecioPaquete(0);
    setVigenciaInicio("");
    setVigenciaFin("");
  };

  const agregarTratamiento = (tratamiento) => {
    if (!tratamiento) return;
    
    const yaExiste = tratamientosSeleccionados.find(t => t.id === tratamiento.id);
    if (yaExiste) {
      showToast({ severity: "warning", message: "Este tratamiento ya está agregado" });
      return;
    }

    setTratamientosSeleccionados([
      ...tratamientosSeleccionados,
      { ...tratamiento, sesiones_tratamiento: 1 },
    ]);
  };

  const actualizarSesionesTratamiento = (tratamiento_id, sesiones) => {
    setTratamientosSeleccionados(
      tratamientosSeleccionados.map(t =>
        t.id === tratamiento_id ? { ...t, sesiones_tratamiento: Number(sesiones) } : t
      )
    );
  };


  const eliminarTratamiento = (tratamiento_id) => {
    setTratamientosSeleccionados(tratamientosSeleccionados.filter(t => t.id !== tratamiento_id));
  };

  // Calcular total de sesiones automáticamente
  const totalSesiones = tratamientosSeleccionados.reduce((sum, t) => sum + (t.sesiones_tratamiento || 1), 0);

  const guardarPaquete = async () => {
    if (!nombre.trim()) {
      showToast({ severity: "error", message: "El nombre es requerido" });
      return;
    }

    if (tratamientosSeleccionados.length === 0) {
      showToast({ severity: "error", message: "Debes agregar al menos un tratamiento" });
      return;
    }

    if (precioRegular <= 0) {
      showToast({ severity: "error", message: "El precio regular debe ser mayor a 0" });
      return;
    }

    if (precioPaquete <= 0) {
      showToast({ severity: "error", message: "El precio del paquete debe ser mayor a 0" });
      return;
    }

    if (precioPaquete >= precioRegular) {
      showToast({ severity: "error", message: "El precio del paquete debe ser menor al precio regular" });
      return;
    }

    if (vigenciaInicio && vigenciaFin) {
      if (new Date(vigenciaInicio) > new Date(vigenciaFin)) {
        showToast({ severity: "error", message: "La fecha de inicio no puede ser posterior a la fecha de fin" });
        return;
      }
    }

    const datos = {
      nombre,
      descripcion,
      tratamientos: tratamientosSeleccionados.map(t => ({
        tratamiento_id: t.id,
        nombre: t.nombre,
        sesiones: t.sesiones_tratamiento || 1,
      })),
      precio_regular: precioRegular,
      precio_paquete: precioPaquete,
      sesiones: totalSesiones,
      vigencia_inicio: vigenciaInicio || null,
      vigencia_fin: vigenciaFin || null,
    };

    try {
      if (modoEdicion) {
        await axios.put(
          `${API_BASE_URL}/api/paquetes/${paqueteEditar.id}`,
          datos,
          { headers: authHeaders }
        );
        showToast({ severity: "success", message: "Paquete actualizado exitosamente" });
      } else {
        await axios.post(
          `${API_BASE_URL}/api/paquetes`,
          datos,
          { headers: authHeaders }
        );
        showToast({ severity: "success", message: "Paquete creado exitosamente" });
      }

      setOpenModal(false);
      cargarDatos();
    } catch (error) {
      console.error("Error al guardar paquete:", error);
      const mensaje = error.response?.data?.message || "Error al guardar paquete";
      showToast({ severity: "error", message: mensaje });
    }
  };

  const abrirConfirmarEliminar = (paquete) => {
    setPaqueteEliminar(paquete);
    setOpenConfirmarEliminar(true);
  };

  const eliminarPaquete = async () => {
    if (!paqueteEliminar) return;

    try {
      await axios.delete(
        `${API_BASE_URL}/api/paquetes/${paqueteEliminar.id}`,
        { headers: authHeaders }
      );

      showToast({ severity: "success", message: "Paquete eliminado exitosamente" });
      setOpenConfirmarEliminar(false);
      cargarDatos();
    } catch (error) {
      console.error("Error al eliminar paquete:", error);
      const mensaje = error.response?.data?.message || "Error al eliminar paquete";
      showToast({ severity: "error", message: mensaje });
    }
  };

  const cambiarEstado = async (paquete) => {
    if (!paquete || !paquete.id) {
      showToast({ severity: "error", message: "Paquete no válido" });
      return;
    }

    const estadoActual = paquete.estado || "activo";
    const nuevoEstado = estadoActual === "activo" ? "inactivo" : "activo";

    try {
      await axios.patch(
        `${API_BASE_URL}/api/paquetes/${paquete.id}/estado`,
        { estado: nuevoEstado },
        { headers: authHeaders }
      );

      showToast({ 
        severity: "success", 
        message: `Paquete ${nuevoEstado === 'activo' ? 'activado' : 'desactivado'} exitosamente` 
      });
      cargarDatos();
    } catch (error) {
      console.error("Error al cambiar estado:", error);
      const mensaje = error.response?.data?.message || "Error al cambiar estado";
      showToast({ severity: "error", message: mensaje });
    }
  };

  const calcularDescuento = () => {
    if (precioRegular > 0 && precioPaquete > 0) {
      return ((precioRegular - precioPaquete) / precioRegular * 100).toFixed(1);
    }
    return 0;
  };

  const estaVigente = (paquete) => {
    const hoy = new Date().toISOString().split("T")[0];
    const inicio = paquete.vigencia_inicio;
    const fin = paquete.vigencia_fin;

    if (!inicio && !fin) return true;
    if (inicio && hoy < inicio) return false;
    if (fin && hoy > fin) return false;
    return true;
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        backgroundColor: "#f5f5f5",
        py: 3,
      }}
    >
      <Container maxWidth="xl">
        {/* Header con navegación */}
        <Paper
          elevation={2}
          sx={{
            p: 3,
            mb: 3,
            borderRadius: 2,
            background: "linear-gradient(135deg, #a36920 0%, #c4842d 100%)",
          }}
        >
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
              <IconButton
                onClick={() => navigate("/dashboard")}
                sx={{
                  color: "white",
                  backgroundColor: "rgba(255,255,255,0.15)",
                  "&:hover": { backgroundColor: "rgba(255,255,255,0.25)" },
                }}
              >
                <Home />
              </IconButton>
              <Box>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                  <LocalOffer sx={{ fontSize: 36, color: "white" }} />
                  <Typography variant="h4" sx={{ fontWeight: "bold", color: "white" }}>
                    Paquetes de Tratamientos
                  </Typography>
                </Box>
                <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.8)", mt: 0.5, ml: 6 }}>
                  Gestiona promociones y paquetes especiales para tus pacientes
                </Typography>
              </Box>
            </Box>
          </Box>
        </Paper>

        {/* Barra de acciones */}
        <Paper
          elevation={1}
          sx={{
            p: 2,
            mb: 3,
            borderRadius: 2,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
            <Chip
              label={`${paquetes.length} paquete${paquetes.length !== 1 ? 's' : ''} registrado${paquetes.length !== 1 ? 's' : ''}`}
              sx={{ backgroundColor: "#e8f5e9", color: "#2e7d32", fontWeight: "bold" }}
            />
          </Box>
          {canWrite && (
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={abrirModalNuevo}
              size="large"
              sx={{
                backgroundColor: "#a36920",
                "&:hover": { backgroundColor: "#8a5a1a" },
              }}
            >
              NUEVO PAQUETE
            </Button>
          )}
        </Paper>

        {/* Tabla de paquetes */}
        <TableContainer component={Paper} elevation={1} sx={{ borderRadius: 2 }}>
          <Table>
            <TableHead>
              <TableRow sx={{ backgroundColor: "#a36920" }}>
                <TableCell sx={{ color: "white", fontWeight: "bold" }}>Nombre</TableCell>
                <TableCell sx={{ color: "white", fontWeight: "bold" }}>Tratamientos</TableCell>
                <TableCell sx={{ color: "white", fontWeight: "bold" }}>Sesiones</TableCell>
                <TableCell sx={{ color: "white", fontWeight: "bold" }}>Precio Regular</TableCell>
                <TableCell sx={{ color: "white", fontWeight: "bold" }}>Precio Paquete</TableCell>
                <TableCell sx={{ color: "white", fontWeight: "bold" }}>Descuento</TableCell>
                <TableCell sx={{ color: "white", fontWeight: "bold" }}>Vigencia</TableCell>
                <TableCell sx={{ color: "white", fontWeight: "bold" }}>Estado</TableCell>
                <TableCell sx={{ color: "white", fontWeight: "bold" }}>Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {paquetes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} align="center" sx={{ py: 4 }}>
                    <Typography color="text.secondary">
                      No hay paquetes registrados
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                paquetes.map((paquete) => (
                  <TableRow key={paquete.id} hover>
                    <TableCell>
                      <Box>
                        <Typography variant="subtitle2" sx={{ fontWeight: "bold" }}>
                          {paquete.nombre}
                        </Typography>
                        {paquete.descripcion && (
                          <Typography variant="caption" color="text.secondary">
                            {paquete.descripcion}
                          </Typography>
                        )}
                      </Box>
                    </TableCell>
                    <TableCell>
                      {paquete.tratamientos?.map((t, index) => (
                        <Chip
                          key={index}
                          label={t.nombre}
                          size="small"
                          sx={{ mr: 0.5, mb: 0.5 }}
                        />
                      ))}
                    </TableCell>
                    <TableCell>{paquete.sesiones}</TableCell>
                    <TableCell>S/ {paquete.precio_regular?.toFixed(2)}</TableCell>
                    <TableCell>
                      <Typography variant="subtitle2" sx={{ fontWeight: "bold", color: "#2e7d32" }}>
                        S/ {paquete.precio_paquete?.toFixed(2)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={`${((paquete.precio_regular - paquete.precio_paquete) / paquete.precio_regular * 100).toFixed(1)}%`}
                        size="small"
                        sx={{ backgroundColor: "#e8f5e9", color: "#2e7d32" }}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption">
                        {paquete.vigencia_inicio && paquete.vigencia_fin
                          ? `${paquete.vigencia_inicio} al ${paquete.vigencia_fin}`
                          : "Sin límite"
                        }
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => cambiarEstado(paquete)}
                        disabled={!paquete || !paquete.id}
                        sx={{
                          backgroundColor: (paquete?.estado || "activo") === "activo" ? "#e8f5e9" : "#ffebee",
                          color: (paquete?.estado || "activo") === "activo" ? "#2e7d32" : "#c62828",
                          borderColor: (paquete?.estado || "activo") === "activo" ? "#4caf50" : "#f44336",
                          "&:hover": {
                            backgroundColor: (paquete?.estado || "activo") === "activo" ? "#c8e6c9" : "#ffcdd2",
                          },
                          "&:disabled": {
                            backgroundColor: "#f5f5f5",
                            color: "#999",
                            borderColor: "#ccc",
                          },
                          textTransform: "none",
                          fontWeight: "bold",
                        }}
                      >
                        {(paquete?.estado || "activo") === "activo" ? "✓ Activo" : "✗ Inactivo"}
                      </Button>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: "flex", gap: 1 }}>
                        {canWrite && (
                          <IconButton
                            size="small"
                            sx={{ color: "#1976d2", mr: 1 }}
                            onClick={() => abrirModalEditar(paquete)}
                            title="Editar paquete"
                          >
                            <Edit />
                          </IconButton>
                        )}
                        {canDelete && (
                          <IconButton
                            size="small"
                            sx={{ color: "#d32f2f" }}
                            onClick={() => abrirConfirmarEliminar(paquete)}
                            title="Eliminar paquete"
                          >
                            <Delete />
                          </IconButton>
                        )}
                      </Box>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>

      {/* Modal para crear/editar paquete */}
      <Dialog 
        open={openModal} 
        onClose={() => setOpenModal(false)} 
        maxWidth="lg" 
        fullWidth
        PaperProps={{
          sx: { borderRadius: 3, minHeight: "80vh" }
        }}
      >
        <DialogTitle 
          sx={{ 
            background: "linear-gradient(135deg, #a36920 0%, #c4842d 100%)",
            color: "white", 
            fontSize: "1.5rem",
            fontWeight: "bold",
            py: 2.5,
            display: "flex",
            alignItems: "center",
            gap: 2,
          }}
        >
          <LocalOffer sx={{ fontSize: 32 }} />
          {modoEdicion ? "Editar Paquete Promocional" : "Crear Nuevo Paquete Promocional"}
        </DialogTitle>
        
        <DialogContent sx={{ p: 0 }}>
          <Grid container>
            {/* Columna izquierda - Información básica */}
            <Grid item xs={12} md={6} sx={{ p: 4, borderRight: { md: "1px solid #e0e0e0" } }}>
              <Typography variant="h6" sx={{ mb: 3, color: "#a36920", fontWeight: "bold", display: "flex", alignItems: "center", gap: 1 }}>
                📋 Información del Paquete
              </Typography>
              
              <TextField
                fullWidth
                label="Nombre del Paquete *"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Ej: Paquete Rejuvenecimiento Facial"
                sx={{ mb: 3 }}
                InputProps={{
                  sx: { borderRadius: 2 }
                }}
              />

              <TextField
                fullWidth
                label="Descripción"
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                multiline
                rows={3}
                placeholder="Describe los beneficios y detalles del paquete..."
                sx={{ mb: 3 }}
                InputProps={{
                  sx: { borderRadius: 2 }
                }}
              />

              {/* Sección de Tratamientos */}
              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: "bold", color: "#333" }}>
                  🏥 Tratamientos Incluidos
                </Typography>
                
                <Autocomplete
                  options={tratamientos || []}
                  getOptionLabel={(option) => option?.nombre || ""}
                  onChange={(e, newValue) => {
                    if (newValue) {
                      agregarTratamiento(newValue);
                    }
                  }}
                  value={null}
                  isOptionEqualToValue={(option, value) => option?.id === value?.id}
                  renderInput={(params) => (
                    <TextField 
                      {...params} 
                      label="Buscar y agregar tratamiento" 
                      placeholder="Ej: Diseño de Labios, Botox..."
                      InputProps={{
                        ...params.InputProps,
                        sx: { borderRadius: 2 }
                      }}
                    />
                  )}
                  sx={{ mb: 2 }}
                />

                {tratamientosSeleccionados.length > 0 && (
                  <Card variant="outlined" sx={{ borderRadius: 2, backgroundColor: "#fafafa" }}>
                    <CardContent sx={{ p: 2 }}>
                      {tratamientosSeleccionados.map((tratamiento, index) => (
                        <Box
                          key={tratamiento.id}
                          sx={{
                            display: "flex",
                            alignItems: "center",
                            gap: 1.5,
                            p: 1.5,
                            mb: index < tratamientosSeleccionados.length - 1 ? 1.5 : 0,
                            backgroundColor: "white",
                            borderRadius: 2,
                            border: "1px solid #e0e0e0",
                          }}
                        >
                          <Box sx={{ 
                            width: 28, 
                            height: 28, 
                            borderRadius: "50%", 
                            backgroundColor: "#a36920",
                            color: "white",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontWeight: "bold",
                            fontSize: "0.8rem",
                            flexShrink: 0
                          }}>
                            {index + 1}
                          </Box>
                          <Typography sx={{ flex: 1, fontWeight: 500, fontSize: "0.9rem" }}>{tratamiento.nombre}</Typography>
                          <TextField
                            type="number"
                            label="Sesiones"
                            value={tratamiento.sesiones_tratamiento}
                            onChange={(e) => actualizarSesionesTratamiento(tratamiento.id, e.target.value)}
                            size="small"
                            sx={{ width: 100 }}
                            inputProps={{ min: 1 }}
                          />
                          <IconButton
                            size="small"
                            sx={{ color: "#d32f2f" }}
                            onClick={() => eliminarTratamiento(tratamiento.id)}
                          >
                            <Delete />
                          </IconButton>
                        </Box>
                      ))}
                      
                    </CardContent>
                  </Card>
                )}

                {tratamientosSeleccionados.length === 0 && (
                  <Box sx={{ 
                    p: 3, 
                    textAlign: "center", 
                    backgroundColor: "#f5f5f5", 
                    borderRadius: 2,
                    border: "2px dashed #ccc"
                  }}>
                    <Typography color="text.secondary">
                      Agrega los tratamientos que incluirá este paquete
                    </Typography>
                  </Box>
                )}
              </Box>

              {/* Nota informativa */}
              {tratamientosSeleccionados.length > 0 && (
                <Box sx={{ 
                  mt: 2, 
                  p: 2, 
                  backgroundColor: "#e3f2fd", 
                  borderRadius: 2,
                  border: "1px solid #90caf9"
                }}>
                  <Typography variant="body2" color="primary">
                    💡 <strong>Nota:</strong> Los productos se descontarán automáticamente del inventario según las recetas configuradas en cada tratamiento.
                  </Typography>
                </Box>
              )}
            </Grid>

            {/* Columna derecha - Precios y vigencia */}
            <Grid item xs={12} md={6} sx={{ p: 4, backgroundColor: "#fafafa" }}>
              <Typography variant="h6" sx={{ mb: 3, color: "#a36920", fontWeight: "bold", display: "flex", alignItems: "center", gap: 1 }}>
                💰 Precios y Promoción
              </Typography>

              <Grid container spacing={3}>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    type="number"
                    label="Precio Regular (S/) - Sin descuento"
                    value={precioRegular}
                    onChange={(e) => setPrecioRegular(Number(e.target.value))}
                    inputProps={{ min: 0, step: 0.01 }}
                    helperText="Precio normal si se compraran los tratamientos por separado"
                    InputProps={{
                      sx: { borderRadius: 2, backgroundColor: "white" }
                    }}
                  />
                </Grid>

                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    type="number"
                    label="Precio Total del Paquete (S/) *"
                    value={precioPaquete}
                    onChange={(e) => setPrecioPaquete(Number(e.target.value))}
                    inputProps={{ min: 0, step: 0.01 }}
                    helperText="Precio promocional del paquete completo"
                    InputProps={{
                      sx: { borderRadius: 2, backgroundColor: "white" }
                    }}
                  />
                </Grid>

                <Grid item xs={12}>
                  <Box sx={{ 
                    p: 3, 
                    borderRadius: 3, 
                    background: precioRegular > 0 && precioPaquete > 0 && precioPaquete < precioRegular
                      ? "linear-gradient(135deg, #4caf50 0%, #66bb6a 100%)"
                      : "#e0e0e0",
                    color: "white",
                    textAlign: "center",
                  }}>
                    <Typography variant="h3" sx={{ fontWeight: "bold" }}>
                      {precioRegular > 0 && precioPaquete > 0 ? ((1 - precioPaquete / precioRegular) * 100).toFixed(0) : 0}% OFF
                    </Typography>
                    <Typography variant="body2" sx={{ opacity: 0.9 }}>
                      Ahorro de S/ {(precioRegular - precioPaquete).toFixed(2)}
                    </Typography>
                  </Box>
                </Grid>

                {/* Total de sesiones calculado automáticamente */}
                <Grid item xs={12}>
                  <Box sx={{ 
                    p: 2, 
                    borderRadius: 2, 
                    backgroundColor: "white",
                    border: "1px solid #e0e0e0",
                    textAlign: "center"
                  }}>
                    <Typography variant="h4" sx={{ fontWeight: "bold", color: "#a36920" }}>
                      {totalSesiones}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Sesiones totales incluidas
                    </Typography>
                  </Box>
                </Grid>
              </Grid>

              <Divider sx={{ my: 4 }} />

              <Typography variant="h6" sx={{ mb: 3, color: "#a36920", fontWeight: "bold", display: "flex", alignItems: "center", gap: 1 }}>
                📅 Vigencia (Opcional)
              </Typography>

              <Grid container spacing={3}>
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    type="date"
                    label="Fecha de Inicio"
                    value={vigenciaInicio}
                    onChange={(e) => setVigenciaInicio(e.target.value)}
                    InputLabelProps={{ shrink: true }}
                    InputProps={{
                      sx: { borderRadius: 2, backgroundColor: "white" }
                    }}
                  />
                </Grid>

                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    type="date"
                    label="Fecha de Fin"
                    value={vigenciaFin}
                    onChange={(e) => setVigenciaFin(e.target.value)}
                    InputLabelProps={{ shrink: true }}
                    InputProps={{
                      sx: { borderRadius: 2, backgroundColor: "white" }
                    }}
                  />
                </Grid>

                <Grid item xs={12}>
                  <Typography variant="caption" color="text.secondary">
                    💡 Deja las fechas vacías si la promoción no tiene límite de tiempo
                  </Typography>
                </Grid>
              </Grid>

              {/* Resumen del paquete */}
              {tratamientosSeleccionados.length > 0 && (
                <Box sx={{ mt: 4 }}>
                  <Typography variant="h6" sx={{ mb: 2, color: "#a36920", fontWeight: "bold" }}>
                    📦 Resumen del Paquete
                  </Typography>
                  <Card sx={{ borderRadius: 2, backgroundColor: "white" }}>
                    <CardContent>
                      <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                        Tratamientos incluidos:
                      </Typography>
                      {tratamientosSeleccionados.map(t => (
                        <Typography key={t.id} variant="body2" sx={{ ml: 1 }}>
                          ✓ {t.nombre} ({t.sesiones_tratamiento} sesión{t.sesiones_tratamiento > 1 ? 'es' : ''})
                        </Typography>
                      ))}
                    </CardContent>
                  </Card>
                </Box>
              )}
            </Grid>
          </Grid>
        </DialogContent>
        
        <DialogActions sx={{ p: 3, borderTop: "1px solid #e0e0e0", backgroundColor: "#fafafa" }}>
          <Button 
            onClick={() => setOpenModal(false)} 
            sx={{ color: "#666", px: 4, py: 1.5, borderRadius: 2 }}
          >
            Cancelar
          </Button>
          <Button
            onClick={guardarPaquete}
            variant="contained"
            size="large"
            disabled={tratamientosSeleccionados.length === 0}
            sx={{
              background: "linear-gradient(135deg, #a36920 0%, #c4842d 100%)",
              "&:hover": { background: "linear-gradient(135deg, #8a5a1a 0%, #a36920 100%)" },
              "&:disabled": { background: "#ccc" },
              px: 5,
              py: 1.5,
              borderRadius: 2,
              fontWeight: "bold",
              boxShadow: "0 4px 12px rgba(163, 105, 32, 0.3)",
            }}
          >
            {modoEdicion ? "💾 Actualizar Paquete" : "✨ Crear Paquete"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Modal de confirmación para eliminar */}
      <Dialog open={openConfirmarEliminar} onClose={() => setOpenConfirmarEliminar(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ backgroundColor: "#d32f2f", color: "white" }}>
          Confirmar Eliminación
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          <Typography>
            ¿Estás seguro de que deseas eliminar este paquete?
          </Typography>
          {paqueteEliminar && (
            <Box sx={{ mt: 2, p: 2, backgroundColor: "#f5f5f5", borderRadius: 1 }}>
              <Typography variant="body2"><strong>Nombre:</strong> {paqueteEliminar.nombre}</Typography>
              <Typography variant="body2"><strong>Precio:</strong> S/ {paqueteEliminar.precio_paquete.toFixed(2)}</Typography>
            </Box>
          )}
          <Typography sx={{ mt: 2, color: "#d32f2f", fontWeight: "bold" }}>
            Esta acción no se puede deshacer.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setOpenConfirmarEliminar(false)} sx={{ color: "#666" }}>
            Cancelar
          </Button>
          <Button
            onClick={eliminarPaquete}
            variant="contained"
            sx={{
              backgroundColor: "#d32f2f",
              "&:hover": { backgroundColor: "#b71c1c" },
            }}
          >
            Eliminar
          </Button>
        </DialogActions>
      </Dialog>

      {/* Modal de confirmación para eliminar */}
      <Dialog open={openConfirmarEliminar} onClose={() => setOpenConfirmarEliminar(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ backgroundColor: "#d32f2f", color: "white" }}>
          Confirmar Eliminación
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          <Typography>
            ¿Estás seguro de que deseas eliminar el paquete "{paqueteEliminar?.nombre}"?
          </Typography>
          <Typography sx={{ mt: 2, color: "#d32f2f", fontWeight: "bold" }}>
            Esta acción no se puede deshacer.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setOpenConfirmarEliminar(false)} sx={{ color: "#666" }}>
            Cancelar
          </Button>
          <Button
            onClick={eliminarPaquete}
            variant="contained"
            color="error"
          >
            Eliminar
          </Button>
        </DialogActions>
      </Dialog>
      </Container>
    </Box>
  );
};

export default Paquetes;
