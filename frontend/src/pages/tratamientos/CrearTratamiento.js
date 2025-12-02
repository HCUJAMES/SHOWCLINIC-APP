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
} from "@mui/material";
import { API_BASE } from "../../config/api";

export default function CrearTratamiento() {
  const colorPrincipal = "#a36920ff";
  const [tratamientos, setTratamientos] = useState([]);
  const [nuevo, setNuevo] = useState({ nombre: "", descripcion: "" });

  const cargarTratamientos = async () => {
    const res = await fetch(`${API_BASE}/api/tratamientos/listar`);
    const data = await res.json();
    setTratamientos(data);
  };

  const crearTratamiento = async () => {
    if (!nuevo.nombre || !nuevo.descripcion) {
      alert("Por favor, completa todos los campos.");
      return;
    }

    const res = await fetch(`${API_BASE}/api/tratamientos/crear`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(nuevo),
    });

    if (res.ok) {
      alert("✅ Tratamiento creado correctamente");
      setNuevo({ nombre: "", descripcion: "" });
      cargarTratamientos();
    } else {
      alert("❌ Error al crear tratamiento");
    }
  };

  const eliminarTratamiento = async (id) => {
    if (!window.confirm("¿Deseas eliminar este tratamiento?")) return;
    await fetch(`${API_BASE}/api/tratamientos/eliminar/${id}`, {
      method: "DELETE",
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
          backgroundColor: "rgba(255,255,255,0.95)",
          zIndex: 1,
          width: "90%",
          maxWidth: 800,
        }}
      >
        <Typography
          variant="h5"
          sx={{ color: colorPrincipal, fontWeight: "bold", mb: 3 }}
          align="center"
        >
          Crear Tratamientos
        </Typography>

        <Box sx={{ display: "grid", gap: 2, mb: 3 }}>
          <TextField
            label="Nombre del tratamiento"
            value={nuevo.nombre}
            onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })}
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
            onClick={crearTratamiento}
          >
            Guardar Tratamiento
          </Button>
        </Box>

        <Table>
          <TableHead>
            <TableRow sx={{ backgroundColor: colorPrincipal }}>
              <TableCell sx={{ color: "white" }}>Nombre</TableCell>
              <TableCell sx={{ color: "white" }}>Descripción</TableCell>
              <TableCell sx={{ color: "white" }}>Acciones</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {tratamientos.map((t) => (
              <TableRow key={t.id}>
                <TableCell>{t.nombre}</TableCell>
                <TableCell>{t.descripcion}</TableCell>
                <TableCell>
                  <Button
                    size="small"
                    color="error"
                    onClick={() => eliminarTratamiento(t.id)}
                  >
                    Eliminar
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>
    </Box>
  );
}
