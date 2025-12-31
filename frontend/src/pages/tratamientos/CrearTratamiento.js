import React, { useState, useEffect } from "react";
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  IconButton,
} from "@mui/material";
import { ArrowBack, Home } from "@mui/icons-material";
import { useNavigate } from "react-router-dom";
import { useToast } from "../../components/ToastProvider";
import { useAuth } from "../../hooks/useAuth";
import { canCreateTreatments, isDoctor as checkIsDoctor } from "../../utils/permissions";
import { COLORS, API_BASE_URL } from "../../constants";

export default function CrearTratamiento() {
  const navigate = useNavigate();
  const colorPrincipal = COLORS.PRIMARY;
  const { showToast } = useToast();
  const { role, token } = useAuth();
  const [tratamientos, setTratamientos] = useState([]);
  const [nuevo, setNuevo] = useState({ nombre: "", descripcion: "", precio: "" });
  const [editId, setEditId] = useState(null);
  const isDoctor = checkIsDoctor(role);
  const canCreate = canCreateTreatments(role);

  const cargarTratamientos = async () => {
    const res = await fetch(`${API_BASE_URL}/api/tratamientos/listar`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    const data = await res.json();
    setTratamientos(data);
  };

  const guardarEdicion = async () => {
    if (!isDoctor) {
      showToast({ severity: "warning", message: "Solo el rol doctor puede modificar tratamientos" });
      return;
    }

    if (!editId) return;

    if (!nuevo.nombre || nuevo.precio === "") {
      showToast({ severity: "warning", message: "Por favor, completa Nombre y Precio." });
      return;
    }

    const res = await fetch(`${API_BASE_URL}/api/tratamientos/${editId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(nuevo),
    });

    if (res.ok) {
      showToast({ severity: "success", message: "Tratamiento actualizado correctamente" });
      setNuevo({ nombre: "", descripcion: "", precio: "" });
      setEditId(null);
      cargarTratamientos();
    } else {
      showToast({ severity: "error", message: "Error al actualizar tratamiento" });
    }
  };

  const editarTratamiento = (t) => {
    setEditId(t.id);
    setNuevo({
      nombre: t.nombre || "",
      descripcion: t.descripcion || "",
      precio: t.precio == null ? "" : String(t.precio),
    });
  };

  const cancelarEdicion = () => {
    setEditId(null);
    setNuevo({ nombre: "", descripcion: "", precio: "" });
  };

  const crearTratamiento = async () => {
    if (!canCreate) {
      showToast({ severity: "warning", message: "No tienes permisos para crear tratamientos" });
      return;
    }

    if (!nuevo.nombre || nuevo.precio === "") {
      showToast({ severity: "warning", message: "Por favor, completa Nombre y Precio." });
      return;
    }

    const res = await fetch(`${API_BASE_URL}/api/tratamientos/crear`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(nuevo),
    });

    if (res.ok) {
      showToast({ severity: "success", message: "Tratamiento creado correctamente" });
      setNuevo({ nombre: "", descripcion: "", precio: "" });
      cargarTratamientos();
    } else {
      showToast({ severity: "error", message: "Error al crear tratamiento" });
    }
  };

  const eliminarTratamiento = async (id) => {
    if (!isDoctor) {
      showToast({ severity: "warning", message: "Solo el rol doctor puede modificar tratamientos" });
      return;
    }
    if (!window.confirm("¿Deseas eliminar este tratamiento?")) return;
    await fetch(`${API_BASE_URL}/api/tratamientos/eliminar/${id}`, {
      method: "DELETE",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    cargarTratamientos();
  };

  useEffect(() => {
    cargarTratamientos();
  }, []);

  return (
    <Box
      sx={{
        minHeight: "100vh",
        backgroundImage: "url('/images/background-showclinic.jpg')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        display: "flex",
        justifyContent: "center",
        alignItems: "flex-start",
        p: 4,
        "&::before": {
          content: '""',
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(135deg, rgba(255,255,255,0.7), rgba(247,234,193,0.55))",
          zIndex: 0,
        },
      }}
    >
      <Paper
        sx={{
          p: 4,
          borderRadius: 4,
          background:
            "linear-gradient(180deg, rgba(255,249,236,0.98) 0%, rgba(255,255,255,0.92) 52%, rgba(247,234,193,0.55) 100%)",
          border: "1px solid rgba(212,175,55,0.22)",
          backdropFilter: "blur(10px)",
          zIndex: 1,
          width: "90%",
          maxWidth: 800,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
          <IconButton onClick={() => navigate("/tratamientos")} sx={{ color: colorPrincipal }}>
            <ArrowBack />
          </IconButton>
          <Typography
            variant="h5"
            sx={{ color: colorPrincipal, fontWeight: "bold", flex: 1, textAlign: "center" }}
          >
            {isDoctor ? "Nuevo Protocolo" : "Protocolos de la clínica"}
          </Typography>
          <IconButton onClick={() => navigate("/dashboard")} sx={{ color: colorPrincipal }} title="Inicio">
            <Home />
          </IconButton>
        </Box>

        {canCreate ? (
          <Box sx={{ display: "grid", gap: 2, mb: 3 }}>
            <TextField
              label="Nombre del tratamiento"
              value={nuevo.nombre}
              onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })}
            />
            <TextField
              label="Precio (S/.)"
              type="number"
              value={nuevo.precio}
              onChange={(e) => setNuevo({ ...nuevo, precio: e.target.value })}
            />
            <TextField
              label="Descripción"
              multiline
              rows={3}
              value={nuevo.descripcion}
              onChange={(e) =>
                setNuevo({ ...nuevo, descripcion: e.target.value })
              }
            />
            <Button
              variant="contained"
              sx={{
                backgroundColor: colorPrincipal,
                "&:hover": { backgroundColor: "#8a541a" },
                color: "white",
                py: 1.2,
                borderRadius: 3,
                fontWeight: "bold",
              }}
              onClick={editId ? guardarEdicion : crearTratamiento}
            >
              {editId ? "Guardar cambios" : "Guardar Tratamiento"}
            </Button>

            {isDoctor && editId ? (
              <Button
                variant="outlined"
                sx={{
                  borderColor: colorPrincipal,
                  color: colorPrincipal,
                  py: 1.2,
                  borderRadius: 3,
                  fontWeight: "bold",
                }}
                onClick={cancelarEdicion}
              >
                Cancelar edición
              </Button>
            ) : null}
          </Box>
        ) : null}

        <Table>
          <TableHead>
            <TableRow sx={{ backgroundColor: colorPrincipal }}>
              <TableCell sx={{ color: "white" }}>Nombre</TableCell>
              <TableCell sx={{ color: "white" }}>Precio</TableCell>
              <TableCell sx={{ color: "white" }}>Descripción</TableCell>
              <TableCell sx={{ color: "white" }}>Acciones</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {tratamientos.map((t) => (
              <TableRow key={t.id}>
                <TableCell>{t.nombre}</TableCell>
                <TableCell>{t.precio != null ? `S/ ${Number(t.precio).toFixed(2)}` : "—"}</TableCell>
                <TableCell>{t.descripcion}</TableCell>
                <TableCell>
                  {isDoctor ? (
                    <>
                      <Button
                        size="small"
                        onClick={() => editarTratamiento(t)}
                        sx={{ mr: 1 }}
                      >
                        Editar
                      </Button>
                      <Button
                        size="small"
                        color="error"
                        onClick={() => eliminarTratamiento(t.id)}
                      >
                        Eliminar
                      </Button>
                    </>
                  ) : (
                    "—"
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>
    </Box>
  );
}
