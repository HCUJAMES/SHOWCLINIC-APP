import React, { useState, useEffect } from "react";
import {
  Box,
  Typography,
  TextField,
  Paper,
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
import { API_BASE } from "../config/api";

export default function BuscarPaciente() {
  const [pacientes, setPacientes] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPaciente, setSelectedPaciente] = useState(null);
  const [openModal, setOpenModal] = useState(false);

  const colorPrincipal = "#a36920ff";

  // 🟡 Cargar pacientes
  const cargarPacientes = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/pacientes/listar`);
      const data = await res.json();
      setPacientes(data);
    } catch (error) {
      console.error("Error al cargar pacientes:", error);
    }
  };

  // 🟡 Buscar pacientes
  const buscarPacientes = async () => {
    if (!searchTerm.trim()) return cargarPacientes();
    try {
      const res = await fetch(
        `${API_BASE}/api/pacientes/buscar?term=${searchTerm}`
      );
      const data = await res.json();
      setPacientes(data);
    } catch (error) {
      console.error("Error al buscar pacientes:", error);
    }
  };

  // 🟡 Abrir modal de edición
  const handleEdit = (paciente) => {
    setSelectedPaciente({ ...paciente });
    setOpenModal(true);
  };

  // 🟡 Guardar cambios (editar paciente)
  const handleSave = async () => {
    try {
      const res = await fetch(
        `${API_BASE}/api/pacientes/editar/${selectedPaciente.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(selectedPaciente),
        }
      );
      if (res.ok) {
        alert("✅ Paciente actualizado correctamente");
        setOpenModal(false);
        cargarPacientes();
      } else {
        alert("❌ Error al actualizar paciente");
      }
    } catch (error) {
      console.error("Error al actualizar paciente:", error);
    }
  };

  useEffect(() => {
    cargarPacientes();
  }, []);

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
          backgroundColor: "rgba(255,255,255,0.95)",
          boxShadow: "0 8px 25px rgba(163,105,32,0.4)",
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

        {/* 🟡 Barra de búsqueda */}
        <Box
          sx={{
            display: "flex",
            gap: 2,
            justifyContent: "center",
            alignItems: "center",
            mb: 3,
          }}
        >
          <TextField
            label="Buscar por nombre o DNI"
            variant="outlined"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            sx={{
              width: "60%",
              backgroundColor: "white",
              borderRadius: 1,
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
            }}
            onClick={buscarPacientes}
          >
            Buscar
          </Button>
        </Box>

        {/* 🟡 Tabla */}
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
              {pacientes.length === 0 ? (
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
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Box>

        {/* 🟡 Modal para editar paciente */}
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
      </Paper>
    </Box>
  );
}
