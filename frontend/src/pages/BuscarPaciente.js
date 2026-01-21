import React, { useState, useEffect, useCallback } from "react";
import {
  Box,
  Typography,
  TextField,
  Paper,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Tabs,
  Tab,
  Chip,
  Collapse,
  LinearProgress,
} from "@mui/material";
import { ArrowBack, Home, ExpandMore, ExpandLess } from "@mui/icons-material";
import { useNavigate } from "react-router-dom";
import { useToast } from "../components/ToastProvider";
import { calcularEdad } from "../utils/dateUtils";
import { useAuth } from "../hooks/useAuth";
import { canWritePatients } from "../utils/permissions";
import { COLORS, API_BASE_URL } from "../constants";

export default function BuscarPaciente() {
  const navigate = useNavigate();
  const [pacientes, setPacientes] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [tratamientosBase, setTratamientosBase] = useState([]);
  const [tratamientoFiltroId, setTratamientoFiltroId] = useState("");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [pacienteTratamientos, setPacienteTratamientos] = useState([]);
  const [pacienteTratamientosOwner, setPacienteTratamientosOwner] = useState(null);
  const [selectedPaciente, setSelectedPaciente] = useState(null);
  const [openModal, setOpenModal] = useState(false);
  const [openTratamientosModal, setOpenTratamientosModal] = useState(false);
  const [tabValue, setTabValue] = useState(0);
  const [pacientesEnTratamiento, setPacientesEnTratamiento] = useState([]);
  const [expandedPaciente, setExpandedPaciente] = useState(null);

  const { showToast } = useToast();
  const { token, role, authHeaders } = useAuth();
  const canWrite = canWritePatients(role);
  const colorPrincipal = COLORS.PRIMARY;

  // Cargar pacientes
  const cargarPacientes = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/pacientes/listar`, { headers: authHeaders });
      const data = await res.json();
      const pacientesOrdenados = Array.isArray(data) ? data.sort((a, b) => {
        const nombreA = `${a.nombre || ''} ${a.apellido || ''}`.trim().toLowerCase();
        const nombreB = `${b.nombre || ''} ${b.apellido || ''}`.trim().toLowerCase();
        return nombreA.localeCompare(nombreB);
      }) : [];
      setPacientes(pacientesOrdenados);
      setPacienteTratamientos([]);
      setPacienteTratamientosOwner(null);
    } catch (error) {
      console.error("Error al cargar pacientes:", error);
      setPacientes([]);
      setPacienteTratamientos([]);
      setPacienteTratamientosOwner(null);
    }
  };

  const cargarTratamientosBase = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/tratamientos/listar`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      const tratamientosOrdenados = Array.isArray(data) ? data.sort((a, b) => {
        return (a.nombre || '').toLowerCase().localeCompare((b.nombre || '').toLowerCase());
      }) : [];
      setTratamientosBase(tratamientosOrdenados);
    } catch (error) {
      console.error("Error al cargar tratamientos base:", error);
      setTratamientosBase([]);
    }
  };

  const cargarPacientesEnTratamiento = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/paquetes/pacientes-en-tratamiento`, {
        headers: authHeaders,
      });
      
      if (!res.ok) {
        console.error("Error en respuesta:", res.status, res.statusText);
        const errorData = await res.text();
        console.error("Detalles del error:", errorData);
        setPacientesEnTratamiento([]);
        return;
      }
      
      const data = await res.json();
      console.log("Pacientes en tratamiento recibidos:", data);
      const pacientesOrdenados = Array.isArray(data) ? data.sort((a, b) => {
        const nombreA = `${a.nombre || ''} ${a.apellido || ''}`.trim().toLowerCase();
        const nombreB = `${b.nombre || ''} ${b.apellido || ''}`.trim().toLowerCase();
        return nombreA.localeCompare(nombreB);
      }) : [];
      setPacientesEnTratamiento(pacientesOrdenados);
    } catch (error) {
      console.error("Error al cargar pacientes en tratamiento:", error);
      setPacientesEnTratamiento([]);
    }
  };

  const cargarTratamientosPaciente = useCallback(async (paciente) => {
    try {
      if (!paciente?.id) return;

      const params = new URLSearchParams();
      if (tratamientoFiltroId) params.set("tratamientoId", tratamientoFiltroId);
      if (fechaDesde) params.set("fechaDesde", fechaDesde);
      if (fechaHasta) params.set("fechaHasta", fechaHasta);

      const qs = params.toString() ? `?${params.toString()}` : "";
      const res = await fetch(
        `${API_BASE_URL}/api/tratamientos/historial/${paciente.id}${qs}`,
        {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        }
      );
      const data = await res.json();
      setPacienteTratamientos(Array.isArray(data) ? data : []);
      setPacienteTratamientosOwner(paciente);
    } catch (error) {
      console.error("Error al cargar tratamientos del paciente:", error);
      setPacienteTratamientos([]);
      setPacienteTratamientosOwner(paciente || null);
    }
  }, [tratamientoFiltroId, fechaDesde, fechaHasta]);

  // Buscar pacientes
  const buscarPacientes = async () => {
    try {
      const params = new URLSearchParams();
      if (searchTerm.trim()) params.set("term", searchTerm.trim());
      if (tratamientoFiltroId) params.set("tratamientoId", tratamientoFiltroId);
      if (fechaDesde) params.set("fechaDesde", fechaDesde);
      if (fechaHasta) params.set("fechaHasta", fechaHasta);

      if (!params.toString()) {
        return cargarPacientes();
      }

      const res = await fetch(`${API_BASE_URL}/api/pacientes/buscar?${params.toString()}`, {
        headers: authHeaders,
      });
      const data = await res.json();
      const rows = Array.isArray(data) ? data : [];
      setPacientes(rows);

      // Si la búsqueda devuelve un único paciente (ej. "Diana"), mostrar automáticamente sus tratamientos
      if (rows.length === 1) {
        await cargarTratamientosPaciente(rows[0]);
      } else {
        setPacienteTratamientos([]);
        setPacienteTratamientosOwner(null);
      }
    } catch (error) {
      console.error("Error al buscar pacientes:", error);
      setPacientes([]);
      setPacienteTratamientos([]);
      setPacienteTratamientosOwner(null);
    }
  };

  // Abrir modal de edición
  const handleEdit = (paciente) => {
    if (!canWrite) {
      showToast({ severity: "warning", message: "No tienes permisos para editar pacientes" });
      return;
    }
    setSelectedPaciente({ ...paciente });
    setOpenModal(true);
  };

  // Guardar cambios (editar paciente)
  const handleSave = async () => {
    if (!canWrite) {
      showToast({ severity: "warning", message: "No tienes permisos para editar pacientes" });
      return;
    }
    try {
      const res = await fetch(
        `${API_BASE_URL}/api/pacientes/editar/${selectedPaciente.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json", ...authHeaders },
          body: JSON.stringify(selectedPaciente),
        }
      );
      if (res.ok) {
        showToast({ severity: "success", message: "Paciente actualizado correctamente" });
        setOpenModal(false);
        cargarPacientes();
      } else {
        showToast({ severity: "error", message: "Error al actualizar paciente" });
      }
    } catch (error) {
      console.error("Error al actualizar paciente:", error);
      showToast({ severity: "error", message: "Error al actualizar paciente" });
    }
  };

  useEffect(() => {
    cargarPacientes();
    cargarTratamientosBase();
    cargarPacientesEnTratamiento();
  }, []);

  useEffect(() => {
    // Si hay un paciente seleccionado para tratamientos, al cambiar filtro se refresca la lista
    if (pacienteTratamientosOwner?.id) {
      cargarTratamientosPaciente(pacienteTratamientosOwner);
    }
  }, [tratamientoFiltroId, fechaDesde, fechaHasta, pacienteTratamientosOwner, cargarTratamientosPaciente]);

  return (
    <Box
      sx={{
        minHeight: "100vh",
        backgroundImage: "url('/images/background-showclinic.jpg')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        position: "relative",
        p: 4,
        display: "flex",
        justifyContent: "center",
        alignItems: "flex-start",
        "&::before": {
          content: '""',
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(135deg, rgba(255,255,255,0.7), rgba(247,234,193,0.55))",
          zIndex: 0,
        },
        "& > *": { position: "relative", zIndex: 1 },
      }}
    >
      <Paper
        elevation={6}
        sx={{
          p: 4,
          width: "90%",
          maxWidth: "1200px",
          borderRadius: 4,
          background:
            "linear-gradient(180deg, rgba(255,249,236,0.98) 0%, rgba(255,255,255,0.92) 52%, rgba(247,234,193,0.55) 100%)",
          border: "1px solid rgba(212,175,55,0.22)",
          backdropFilter: "blur(10px)",
          boxShadow:
            "0 16px 40px rgba(0,0,0,0.10), 0 0 0 1px rgba(212,175,55,0.10)",
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
          <IconButton onClick={() => navigate("/pacientes")} sx={{ color: colorPrincipal }}>
            <ArrowBack />
          </IconButton>
          <Typography
            variant="h5"
            sx={{
              fontWeight: "bold",
              color: colorPrincipal,
              flex: 1,
              textAlign: "center",
            }}
          >
            Gestión de Pacientes
          </Typography>
          <IconButton onClick={() => navigate("/dashboard")} sx={{ color: colorPrincipal }} title="Inicio">
            <Home />
          </IconButton>
        </Box>

        {/* Tabs */}
        <Tabs
          value={tabValue}
          onChange={(e, newValue) => setTabValue(newValue)}
          sx={{
            mb: 3,
            "& .MuiTab-root": { color: "#666", fontWeight: "bold" },
            "& .Mui-selected": { color: colorPrincipal },
            "& .MuiTabs-indicator": { backgroundColor: colorPrincipal },
          }}
        >
          <Tab label="Buscar Pacientes" />
          <Tab 
            label={
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                Pacientes en Tratamiento
                {pacientesEnTratamiento.length > 0 && (
                  <Chip 
                    label={pacientesEnTratamiento.length} 
                    size="small" 
                    sx={{ 
                      backgroundColor: "#4caf50", 
                      color: "white",
                      height: 20,
                      fontSize: "0.7rem"
                    }} 
                  />
                )}
              </Box>
            } 
          />
        </Tabs>

        {/* Tab 0: Buscar Pacientes */}
        {tabValue === 0 && (
          <>
        {/* Barra de búsqueda */}
        <Box
          sx={{
            display: "flex",
            gap: 2,
            justifyContent: "center",
            alignItems: "center",
            mb: 3,
            flexWrap: "wrap",
          }}
        >
          <TextField
            label="Buscar por nombre o DNI"
            variant="outlined"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            sx={{
              width: { xs: "100%", md: "40%" },
              "& .MuiInputBase-root": {
                backgroundColor: "rgba(255,255,255,0.72)",
                borderRadius: 2,
              },
            }}
          />
          <FormControl
            sx={{
              width: { xs: "100%", md: "26%" },
              "& .MuiInputBase-root": {
                backgroundColor: "rgba(255,255,255,0.72)",
                borderRadius: 2,
              },
            }}
          >
            <InputLabel>Filtrar por tratamiento</InputLabel>
            <Select
              label="Filtrar por tratamiento"
              value={tratamientoFiltroId}
              onChange={(e) => setTratamientoFiltroId(e.target.value)}
            >
              <MenuItem value="">Todos</MenuItem>
              {tratamientosBase.map((t) => (
                <MenuItem key={t.id} value={String(t.id)}>
                  {t.nombre}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <TextField
            label="Desde"
            type="date"
            value={fechaDesde}
            onChange={(e) => setFechaDesde(e.target.value)}
            InputLabelProps={{ shrink: true }}
            sx={{
              width: { xs: "100%", md: "14%" },
              "& .MuiInputBase-root": {
                backgroundColor: "rgba(255,255,255,0.72)",
                borderRadius: 2,
              },
            }}
          />

          <TextField
            label="Hasta"
            type="date"
            value={fechaHasta}
            onChange={(e) => setFechaHasta(e.target.value)}
            InputLabelProps={{ shrink: true }}
            sx={{
              width: { xs: "100%", md: "14%" },
              "& .MuiInputBase-root": {
                backgroundColor: "rgba(255,255,255,0.72)",
                borderRadius: 2,
              },
            }}
          />

          <Button
            variant="contained"
            sx={{
              backgroundColor: colorPrincipal,
              "&:hover": { backgroundColor: "#8a541a" },
              color: "white",
              px: 4,
              py: 1.2,
              borderRadius: 3,
              fontWeight: "bold",
              width: { xs: "100%", md: "auto" },
            }}
            onClick={buscarPacientes}
          >
            Buscar
          </Button>
        </Box>

        {/* Tabla */}
        <Box
          sx={{
            maxHeight: "60vh",
            overflowY: "auto",
            borderRadius: 2,
            border: "1px solid rgba(163,105,32,0.2)",
          }}
        >
          <Table>
            <TableHead>
              <TableRow sx={{ backgroundColor: colorPrincipal }}>
                <TableCell sx={{ color: "white", fontWeight: "bold" }}>Documento</TableCell>
                <TableCell sx={{ color: "white", fontWeight: "bold" }}>Nombre</TableCell>
                <TableCell sx={{ color: "white", fontWeight: "bold" }}>Apellido</TableCell>
                <TableCell sx={{ color: "white", fontWeight: "bold" }}>Edad</TableCell>
                <TableCell sx={{ color: "white", fontWeight: "bold" }}>Sexo</TableCell>
                <TableCell sx={{ color: "white", fontWeight: "bold" }}>Ciudad</TableCell>
                <TableCell sx={{ color: "white", fontWeight: "bold" }}>Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {!Array.isArray(pacientes) || pacientes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 3 }}>
                    No se encontraron pacientes
                  </TableCell>
                </TableRow>
              ) : (
                pacientes.map((p) => (
                  <TableRow key={p.id} hover>
                    <TableCell>{p.tipoDocumento || 'DNI'}: {p.dni}</TableCell>
                    <TableCell>{p.nombre}</TableCell>
                    <TableCell>{p.apellido}</TableCell>
                    <TableCell>{calcularEdad(p.fechaNacimiento) || p.edad || 'N/A'}</TableCell>
                    <TableCell>{p.sexo}</TableCell>
                    <TableCell>{p.ciudadResidencia}</TableCell>
                    <TableCell>
                      <Button
                        size="small"
                        sx={{
                          backgroundColor: colorPrincipal,
                          color: "white",
                          mr: 1,
                          "&:hover": { backgroundColor: "#8a541a" },
                        }}
                        onClick={() => handleEdit(p)}
                      >
                        Editar
                      </Button>
                      <Button
                        size="small"
                        variant="outlined"
                        sx={{
                          borderColor: colorPrincipal,
                          color: colorPrincipal,
                          "&:hover": { backgroundColor: "rgba(163,105,32,0.08)" },
                        }}
                        onClick={async () => {
                          await cargarTratamientosPaciente(p);
                          setOpenTratamientosModal(true);
                        }}
                      >
                        Ver tratamientos
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Box>

        {/* Resumen rápido debajo de la tabla (cuando la búsqueda es específica) */}
        {pacienteTratamientosOwner && !openTratamientosModal && (
          <Box sx={{ mt: 3 }}>
            <Typography sx={{ color: colorPrincipal, fontWeight: "bold", mb: 1 }}>
              Tratamientos de {pacienteTratamientosOwner.nombre} {pacienteTratamientosOwner.apellido}
            </Typography>
            {!pacienteTratamientos.length ? (
              <Typography>No hay tratamientos registrados.</Typography>
            ) : (
              <Box
                sx={{
                  maxHeight: 240,
                  overflowY: "auto",
                  borderRadius: 2,
                  border: "1px solid rgba(163,105,32,0.2)",
                }}
              >
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ backgroundColor: "rgba(163,105,32,0.08)" }}>
                      <TableCell sx={{ fontWeight: "bold" }}>Fecha</TableCell>
                      <TableCell sx={{ fontWeight: "bold" }}>Tratamiento</TableCell>
                      <TableCell sx={{ fontWeight: "bold" }}>Sesión</TableCell>
                      <TableCell sx={{ fontWeight: "bold" }}>Pago</TableCell>
                      <TableCell sx={{ fontWeight: "bold" }}>Total</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {pacienteTratamientos.map((tr) => (
                      <TableRow key={tr.id}>
                        <TableCell>{tr.fecha?.split(" ")[0] || tr.fecha}</TableCell>
                        <TableCell>{tr.nombreTratamiento || "—"}</TableCell>
                        <TableCell>{tr.sesion ?? "—"}</TableCell>
                        <TableCell>{tr.pagoMetodo || "—"}</TableCell>
                        <TableCell>
                          S/ {Number(tr.precio_total || 0).toFixed(2)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Box>
            )}
          </Box>
        )}
          </>
        )}

        {/* Tab 1: Pacientes en Tratamiento */}
        {tabValue === 1 && (
          <Box>
            {pacientesEnTratamiento.length === 0 ? (
              <Box sx={{ textAlign: "center", py: 4 }}>
                <Typography color="text.secondary">
                  No hay pacientes con paquetes activos
                </Typography>
              </Box>
            ) : (
              <Box sx={{ display: "grid", gap: 2 }}>
                {pacientesEnTratamiento.map((paciente) => (
                  <Paper
                    key={paciente.id}
                    elevation={2}
                    sx={{
                      p: 2,
                      borderRadius: 2,
                      border: "1px solid rgba(163,105,32,0.2)",
                      backgroundColor: "rgba(255,255,255,0.9)",
                    }}
                  >
                    {/* Cabecera del paciente */}
                    <Box
                      sx={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        cursor: "pointer",
                      }}
                      onClick={() => setExpandedPaciente(expandedPaciente === paciente.id ? null : paciente.id)}
                    >
                      <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                        <Box>
                          <Typography sx={{ fontWeight: "bold", color: colorPrincipal }}>
                            {paciente.nombre} {paciente.apellido}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            DNI: {paciente.dni} | Tel: {paciente.celular || "-"}
                          </Typography>
                        </Box>
                      </Box>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                        <Chip
                          label={`${paciente.paquetes_activos} paquete(s)`}
                          size="small"
                          sx={{ backgroundColor: "#2196f3", color: "white" }}
                        />
                        <Chip
                          label={`${paciente.sesiones_pendientes} sesiones pendientes`}
                          size="small"
                          sx={{ backgroundColor: "#ff9800", color: "white" }}
                        />
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/historial/${paciente.id}`);
                          }}
                          sx={{ borderColor: colorPrincipal, color: colorPrincipal }}
                        >
                          Ver Historial
                        </Button>
                        <IconButton size="small">
                          {expandedPaciente === paciente.id ? <ExpandLess /> : <ExpandMore />}
                        </IconButton>
                      </Box>
                    </Box>

                    {/* Paquetes del paciente (expandible) */}
                    <Collapse in={expandedPaciente === paciente.id}>
                      <Box sx={{ mt: 2, pl: 2 }}>
                        {paciente.paquetes?.map((paquete) => {
                          const progreso = paquete.sesiones_totales > 0
                            ? Math.round((paquete.sesiones_completadas / paquete.sesiones_totales) * 100)
                            : 0;

                          return (
                            <Paper
                              key={paquete.id}
                              elevation={0}
                              sx={{
                                p: 2,
                                mb: 2,
                                borderRadius: 2,
                                backgroundColor: "rgba(33, 150, 243, 0.05)",
                                border: "1px solid rgba(33, 150, 243, 0.2)",
                              }}
                            >
                              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
                                <Typography sx={{ fontWeight: "bold", color: "#1565c0" }}>
                                  {paquete.paquete_nombre}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  Asignado: {paquete.fecha_inicio?.split(' ')[0]}
                                </Typography>
                              </Box>

                              {/* Barra de progreso */}
                              <Box sx={{ mb: 2 }}>
                                <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
                                  <Typography variant="caption" color="text.secondary">
                                    Progreso: {paquete.sesiones_completadas}/{paquete.sesiones_totales} sesiones
                                  </Typography>
                                  <Typography variant="caption" sx={{ fontWeight: "bold", color: "#1565c0" }}>
                                    {progreso}%
                                  </Typography>
                                </Box>
                                <LinearProgress
                                  variant="determinate"
                                  value={progreso}
                                  sx={{
                                    height: 8,
                                    borderRadius: 4,
                                    backgroundColor: "#e0e0e0",
                                    "& .MuiLinearProgress-bar": {
                                      backgroundColor: "#2196f3",
                                      borderRadius: 4,
                                    },
                                  }}
                                />
                              </Box>

                              {/* Sesiones */}
                              <Box sx={{ display: "grid", gap: 0.5 }}>
                                {paquete.sesiones?.map((sesion) => (
                                  <Box
                                    key={sesion.id}
                                    sx={{
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "space-between",
                                      p: 1,
                                      backgroundColor: sesion.estado === 'completada' ? "rgba(76, 175, 80, 0.1)" : "rgba(255,255,255,0.8)",
                                      borderRadius: 1,
                                      border: `1px solid ${sesion.estado === 'completada' ? '#4caf50' : '#e0e0e0'}`,
                                    }}
                                  >
                                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                                      <Box
                                        sx={{
                                          width: 20,
                                          height: 20,
                                          borderRadius: "50%",
                                          backgroundColor: sesion.estado === 'completada' ? '#4caf50' : '#e0e0e0',
                                          display: "flex",
                                          alignItems: "center",
                                          justifyContent: "center",
                                          fontSize: "0.7rem",
                                          color: sesion.estado === 'completada' ? 'white' : '#666',
                                        }}
                                      >
                                        {sesion.estado === 'completada' ? '✓' : sesion.sesion_numero}
                                      </Box>
                                      <Typography variant="body2">
                                        {sesion.tratamiento_nombre} - Sesión {sesion.sesion_numero}
                                      </Typography>
                                    </Box>
                                    <Typography variant="caption" color={sesion.estado === 'completada' ? "success.main" : "text.secondary"}>
                                      {sesion.estado === 'completada' ? sesion.fecha_realizada?.split(' ')[0] : 'Pendiente'}
                                    </Typography>
                                  </Box>
                                ))}
                              </Box>

                              {/* Total */}
                              <Box sx={{ mt: 2, pt: 1, borderTop: "1px dashed #e0e0e0", display: "flex", justifyContent: "flex-end" }}>
                                <Typography sx={{ fontWeight: "bold", color: "#1565c0" }}>
                                  Total: S/ {paquete.precio_total?.toFixed(2)}
                                </Typography>
                              </Box>
                            </Paper>
                          );
                        })}
                      </Box>
                    </Collapse>
                  </Paper>
                ))}
              </Box>
            )}
          </Box>
        )}

        {/* Modal para editar paciente */}
        <Dialog
          open={openModal}
          onClose={() => setOpenModal(false)}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle sx={{ color: colorPrincipal, fontWeight: "bold" }}>
            Editar Paciente
          </DialogTitle>
          <DialogContent dividers>
            {selectedPaciente && (
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 2,
                  mt: 2,
                }}
              >
                {Object.keys(selectedPaciente)
                  .filter(
                    (key) =>
                      !["id", "fechaRegistro"].includes(key) &&
                      typeof selectedPaciente[key] !== "object"
                  )
                  .map((key) => (
                    <TextField
                      key={key}
                      label={key.charAt(0).toUpperCase() + key.slice(1)}
                      value={selectedPaciente[key] || ""}
                      onChange={(e) =>
                        setSelectedPaciente({
                          ...selectedPaciente,
                          [key]: e.target.value,
                        })
                      }
                    />
                  ))}
              </Box>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpenModal(false)}>Cancelar</Button>
            <Button
              onClick={handleSave}
              variant="contained"
              sx={{ backgroundColor: colorPrincipal, color: "white" }}
            >
              Guardar Cambios
            </Button>
          </DialogActions>
        </Dialog>

        {/* Modal para ver tratamientos realizados */}
        <Dialog
          open={openTratamientosModal}
          onClose={() => setOpenTratamientosModal(false)}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle sx={{ color: colorPrincipal, fontWeight: "bold" }}>
            Tratamientos realizados
          </DialogTitle>
          <DialogContent dividers>
            {pacienteTratamientosOwner ? (
              <>
                <Typography sx={{ mb: 2 }}>
                  <strong>Paciente:</strong> {pacienteTratamientosOwner.nombre} {pacienteTratamientosOwner.apellido}
                </Typography>
                {!pacienteTratamientos.length ? (
                  <Typography>No hay tratamientos registrados.</Typography>
                ) : (
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight: "bold" }}>Fecha</TableCell>
                        <TableCell sx={{ fontWeight: "bold" }}>Tratamiento</TableCell>
                        <TableCell sx={{ fontWeight: "bold" }}>Tipo Atención</TableCell>
                        <TableCell sx={{ fontWeight: "bold" }}>Especialista</TableCell>
                        <TableCell sx={{ fontWeight: "bold" }}>Sesión</TableCell>
                        <TableCell sx={{ fontWeight: "bold" }}>Pago</TableCell>
                        <TableCell sx={{ fontWeight: "bold" }}>Total</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {pacienteTratamientos.map((tr) => (
                        <TableRow key={tr.id}>
                          <TableCell>{tr.fecha?.split(" ")[0] || tr.fecha}</TableCell>
                          <TableCell>{tr.nombreTratamiento || "—"}</TableCell>
                          <TableCell>{tr.tipoAtencion || "—"}</TableCell>
                          <TableCell>{tr.especialista || "—"}</TableCell>
                          <TableCell>{tr.sesion ?? "—"}</TableCell>
                          <TableCell>{tr.pagoMetodo || "—"}</TableCell>
                          <TableCell>
                            S/ {Number(tr.precio_total || 0).toFixed(2)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </>
            ) : (
              <Typography>Selecciona un paciente para ver sus tratamientos.</Typography>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpenTratamientosModal(false)}>Cerrar</Button>
          </DialogActions>
        </Dialog>
      </Paper>
    </Box>
  );
}
