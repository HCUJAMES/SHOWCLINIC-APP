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
} from "@mui/material";
import { useToast } from "../components/ToastProvider";

const API_BASE_URL = `${window.location.protocol}//${window.location.hostname}:4000`;

export default function BuscarPaciente() {
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

  const { showToast } = useToast();

  const token = localStorage.getItem("token");
  const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};
  const role = localStorage.getItem("role");
  const canWritePatients = role === "doctor" || role === "asistente";

  const colorPrincipal = "#a36920ff";

  // Cargar pacientes
  const cargarPacientes = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/pacientes/listar`, { headers: authHeaders });
      const data = await res.json();
      setPacientes(Array.isArray(data) ? data : []);
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
      setTratamientosBase(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error al cargar tratamientos base:", error);
      setTratamientosBase([]);
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
    if (!canWritePatients) {
      showToast({ severity: "warning", message: "No tienes permisos para editar pacientes" });
      return;
    }
    setSelectedPaciente({ ...paciente });
    setOpenModal(true);
  };

  // Guardar cambios (editar paciente)
  const handleSave = async () => {
    if (!canWritePatients) {
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
        <Typography
          variant="h5"
          align="center"
          sx={{
            fontWeight: "bold",
            color: colorPrincipal,
            mb: 3,
          }}
        >
          Buscar y Editar Pacientes
        </Typography>

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
                <TableCell sx={{ color: "white", fontWeight: "bold" }}>DNI</TableCell>
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
                    <TableCell>{p.dni}</TableCell>
                    <TableCell>{p.nombre}</TableCell>
                    <TableCell>{p.apellido}</TableCell>
                    <TableCell>{p.edad}</TableCell>
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
