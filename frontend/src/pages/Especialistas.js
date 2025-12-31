import React, { useState, useEffect } from "react";
import {
  Box,
  Typography,
  Button,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
} from "@mui/material";
import { Add, Delete, ArrowBack, Home } from "@mui/icons-material";
import { useNavigate } from "react-router-dom";
import { useToast } from "../components/ToastProvider";
import axios from "axios";

const API_BASE =
  process.env.REACT_APP_API_URL ||
  `${window.location.protocol}//${window.location.hostname}:4000`;

export default function Especialistas() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const token = localStorage.getItem("token");
  const role = localStorage.getItem("role");

  const [especialistas, setEspecialistas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [nuevoEspecialista, setNuevoEspecialista] = useState({
    nombre: "",
    especialidad: "",
    telefono: "",
    correo: "",
  });

  const authHeaders = { Authorization: `Bearer ${token}` };

  // Verificar que solo doctor puede acceder
  useEffect(() => {
    if (role !== "doctor") {
      showToast({ severity: "error", message: "No tienes permisos para acceder a esta sección" });
      navigate("/dashboard");
    }
  }, [role, navigate, showToast]);

  // Cargar especialistas
  const cargarEspecialistas = async () => {
    try {
      const res = await axios.get(`${API_BASE}/api/especialistas/listar`);
      setEspecialistas(res.data);
    } catch (err) {
      console.error("Error cargando especialistas:", err);
      showToast({ severity: "error", message: "Error al cargar especialistas" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarEspecialistas();
  }, []);

  // Crear especialista
  const crearEspecialista = async () => {
    if (!nuevoEspecialista.nombre.trim()) {
      showToast({ severity: "warning", message: "El nombre es obligatorio" });
      return;
    }

    try {
      await axios.post(
        `${API_BASE}/api/especialistas/crear`,
        nuevoEspecialista,
        { headers: authHeaders }
      );
      showToast({ severity: "success", message: "Especialista creado correctamente" });
      setDialogOpen(false);
      setNuevoEspecialista({ nombre: "", especialidad: "", telefono: "", correo: "" });
      cargarEspecialistas();
    } catch (err) {
      console.error("Error creando especialista:", err);
      showToast({ severity: "error", message: "Error al crear especialista" });
    }
  };

  // Eliminar especialista
  const eliminarEspecialista = async (id, nombre) => {
    if (!window.confirm(`¿Eliminar al especialista "${nombre}"?`)) return;

    try {
      await axios.delete(`${API_BASE}/api/especialistas/eliminar/${id}`, {
        headers: authHeaders,
      });
      showToast({ severity: "success", message: "Especialista eliminado" });
      cargarEspecialistas();
    } catch (err) {
      console.error("Error eliminando especialista:", err);
      showToast({ severity: "error", message: "Error al eliminar especialista" });
    }
  };

  if (role !== "doctor") return null;

  return (
    <Box
      sx={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #faf8f5 0%, #f5f0e8 100%)",
        py: 4,
        px: 2,
      }}
    >
      <Box sx={{ maxWidth: 900, mx: "auto" }}>
        {/* Header */}
        <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
          <IconButton onClick={() => navigate("/dashboard")} sx={{ color: "#a36920" }}>
            <ArrowBack />
          </IconButton>
          <Typography
            variant="h5"
            sx={{ color: "#a36920", fontWeight: "bold", flex: 1, textAlign: "center" }}
          >
            Especialistas
          </Typography>
          <IconButton onClick={() => navigate("/dashboard")} sx={{ color: "#a36920" }} title="Inicio">
            <Home />
          </IconButton>
        </Box>

        {/* Botón agregar */}
        <Box sx={{ mb: 3 }}>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => setDialogOpen(true)}
            sx={{
              backgroundColor: "#a36920",
              "&:hover": { backgroundColor: "#8a5a1a" },
              textTransform: "none",
              fontWeight: 600,
            }}
          >
            Agregar Especialista
          </Button>
        </Box>

        {/* Tabla de especialistas */}
        <TableContainer
          component={Paper}
          sx={{
            borderRadius: 3,
            boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
          }}
        >
          <Table>
            <TableHead>
              <TableRow sx={{ backgroundColor: "#a36920" }}>
                <TableCell sx={{ color: "white", fontWeight: 700 }}>Nombre</TableCell>
                <TableCell sx={{ color: "white", fontWeight: 700 }}>Especialidad</TableCell>
                <TableCell sx={{ color: "white", fontWeight: 700 }}>Teléfono</TableCell>
                <TableCell sx={{ color: "white", fontWeight: 700 }}>Correo</TableCell>
                <TableCell sx={{ color: "white", fontWeight: 700 }} align="center">
                  Acciones
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} align="center">
                    Cargando...
                  </TableCell>
                </TableRow>
              ) : especialistas.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center">
                    No hay especialistas registrados
                  </TableCell>
                </TableRow>
              ) : (
                especialistas.map((esp) => (
                  <TableRow key={esp.id} hover>
                    <TableCell sx={{ fontWeight: 600 }}>{esp.nombre}</TableCell>
                    <TableCell>{esp.especialidad || "-"}</TableCell>
                    <TableCell>{esp.telefono || "-"}</TableCell>
                    <TableCell>{esp.correo || "-"}</TableCell>
                    <TableCell align="center">
                      <IconButton
                        color="error"
                        onClick={() => eliminarEspecialista(esp.id, esp.nombre)}
                        size="small"
                      >
                        <Delete />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Dialog para crear especialista */}
        <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle sx={{ fontWeight: 700, color: "#a36920" }}>
            Nuevo Especialista
          </DialogTitle>
          <DialogContent>
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12}>
                <TextField
                  label="Nombre *"
                  fullWidth
                  value={nuevoEspecialista.nombre}
                  onChange={(e) =>
                    setNuevoEspecialista({ ...nuevoEspecialista, nombre: e.target.value })
                  }
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label="Especialidad"
                  fullWidth
                  value={nuevoEspecialista.especialidad}
                  onChange={(e) =>
                    setNuevoEspecialista({ ...nuevoEspecialista, especialidad: e.target.value })
                  }
                  placeholder="Ej: Dermatología, Cirugía Plástica, etc."
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Teléfono"
                  fullWidth
                  value={nuevoEspecialista.telefono}
                  onChange={(e) =>
                    setNuevoEspecialista({ ...nuevoEspecialista, telefono: e.target.value })
                  }
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Correo"
                  fullWidth
                  type="email"
                  value={nuevoEspecialista.correo}
                  onChange={(e) =>
                    setNuevoEspecialista({ ...nuevoEspecialista, correo: e.target.value })
                  }
                />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setDialogOpen(false)} sx={{ textTransform: "none" }}>
              Cancelar
            </Button>
            <Button
              variant="contained"
              onClick={crearEspecialista}
              sx={{
                backgroundColor: "#a36920",
                "&:hover": { backgroundColor: "#8a5a1a" },
                textTransform: "none",
                fontWeight: 600,
              }}
            >
              Guardar
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </Box>
  );
}
