// Gestión del Sistema - Incluye tratamientos huérfanos
import React, { useState } from "react";
import { Container, Typography, Button, Paper, Box, IconButton, CircularProgress, Table, TableBody, TableCell, TableHead, TableRow, Chip } from "@mui/material";
import { ArrowBack, Backup, PhotoLibrary, SearchOff, Delete, DeleteSweep } from "@mui/icons-material";
import { useNavigate } from "react-router-dom";
import { useToast } from "../components/ToastProvider";
import { useAuth } from "../hooks/useAuth";
import { COLORS, API_BASE_URL } from "../constants";

const Gestion = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { token, role } = useAuth();
  const colorPrincipal = COLORS.PRIMARY;
  const [generandoBackup, setGenerandoBackup] = useState(false);
  const [generandoBackupImagenes, setGenerandoBackupImagenes] = useState(false);
  const [huerfanos, setHuerfanos] = useState([]);
  const [buscandoHuerfanos, setBuscandoHuerfanos] = useState(false);
  const [eliminandoTodos, setEliminandoTodos] = useState(false);

  // Verificar que el usuario sea master
  if (role !== "master") {
    return (
      <Box
        sx={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundImage: "url('/images/background-showclinic.jpg')",
          backgroundSize: "cover",
        }}
      >
        <Paper sx={{ p: 4, textAlign: "center" }}>
          <Typography variant="h5" color="error">
            Acceso denegado
          </Typography>
          <Typography sx={{ mt: 2 }}>
            Solo el usuario master puede acceder a esta sección.
          </Typography>
          <Button
            variant="contained"
            onClick={() => navigate("/dashboard")}
            sx={{ mt: 3, backgroundColor: colorPrincipal }}
          >
            Volver al Dashboard
          </Button>
        </Paper>
      </Box>
    );
  }

  const buscarHuerfanos = async () => {
    try {
      setBuscandoHuerfanos(true);
      const response = await fetch(`${API_BASE_URL}/api/tratamientos/huerfanos`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error("Error al buscar");
      const data = await response.json();
      setHuerfanos(Array.isArray(data) ? data : []);
      if (Array.isArray(data) && data.length === 0) {
        showToast({ severity: "info", message: "No se encontraron tratamientos huérfanos" });
      }
    } catch (err) {
      console.error(err);
      showToast({ severity: "error", message: "Error al buscar tratamientos huérfanos" });
    } finally {
      setBuscandoHuerfanos(false);
    }
  };

  const eliminarHuerfano = async (id) => {
    if (!window.confirm("¿Estás seguro de eliminar este tratamiento huérfano?")) return;
    try {
      const response = await fetch(`${API_BASE_URL}/api/tratamientos/huerfanos/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "Error al eliminar");
      }
      showToast({ severity: "success", message: "Tratamiento huérfano eliminado" });
      setHuerfanos((prev) => prev.filter((h) => h.id !== id));
    } catch (err) {
      showToast({ severity: "error", message: err.message || "Error al eliminar" });
    }
  };

  const eliminarTodosHuerfanos = async () => {
    if (!window.confirm(`¿Estás seguro de eliminar los ${huerfanos.length} tratamiento(s) huérfano(s)? Esta acción no se puede deshacer.`)) return;
    try {
      setEliminandoTodos(true);
      const response = await fetch(`${API_BASE_URL}/api/tratamientos/huerfanos`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error("Error al eliminar");
      const data = await response.json();
      showToast({ severity: "success", message: data.message });
      setHuerfanos([]);
    } catch (err) {
      showToast({ severity: "error", message: "Error al eliminar tratamientos huérfanos" });
    } finally {
      setEliminandoTodos(false);
    }
  };

  const realizarBackup = async () => {
    try {
      setGenerandoBackup(true);
      
      const response = await fetch(`${API_BASE_URL}/api/backup/generar`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "Error al generar backup");
      }

      // Obtener el blob del archivo
      const blob = await response.blob();
      
      // Obtener el nombre del archivo del header
      const contentDisposition = response.headers.get("Content-Disposition");
      let filename = "showclinic_backup.db";
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="(.+)"/);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }

      // Crear un enlace temporal para descargar el archivo
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      showToast({ severity: "success", message: "Backup generado y descargado exitosamente" });
    } catch (err) {
      console.error("Error al generar backup:", err);
      showToast({ severity: "error", message: err.message || "Error al generar backup" });
    } finally {
      setGenerandoBackup(false);
    }
  };

  const realizarBackupImagenes = async () => {
    try {
      setGenerandoBackupImagenes(true);
      
      const response = await fetch(`${API_BASE_URL}/api/backup/imagenes`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "Error al generar backup de imágenes");
      }

      // Obtener el blob del archivo
      const blob = await response.blob();
      
      // Obtener el nombre del archivo del header
      const contentDisposition = response.headers.get("Content-Disposition");
      let filename = "showclinic_imagenes.zip";
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="(.+)"/);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }

      // Crear un enlace temporal para descargar el archivo
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      showToast({ severity: "success", message: "Backup de imágenes generado y descargado exitosamente" });
    } catch (err) {
      console.error("Error al generar backup de imágenes:", err);
      showToast({ severity: "error", message: err.message || "Error al generar backup de imágenes" });
    } finally {
      setGenerandoBackupImagenes(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        backgroundImage: "url('/images/background-showclinic.jpg')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        position: "relative",
        p: { xs: 2, md: 4 },
        "&::before": {
          content: '""',
          position: "absolute",
          inset: 0,
          background: "linear-gradient(135deg, rgba(255,255,255,0.75), rgba(247,234,193,0.60))",
          zIndex: 0,
        },
        "& > *": { position: "relative", zIndex: 1 },
      }}
    >
      <Container maxWidth="md">
        <Paper
          elevation={6}
          sx={{
            p: { xs: 3, md: 5 },
            borderRadius: 4,
            backgroundColor: "rgba(255,255,255,0.88)",
            border: "1px solid rgba(212,175,55,0.20)",
            backdropFilter: "blur(10px)",
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", mb: 3 }}>
            <IconButton onClick={() => navigate("/dashboard")} sx={{ color: colorPrincipal }}>
              <ArrowBack />
            </IconButton>
            <Typography
              variant="h5"
              sx={{ flex: 1, color: colorPrincipal, fontWeight: "bold", textAlign: "center" }}
            >
              Gestión del Sistema
            </Typography>
          </Box>

          <Typography variant="body1" sx={{ mb: 4, color: "rgba(46,46,46,0.75)", textAlign: "center" }}>
            Herramientas de administración exclusivas para el usuario master
          </Typography>

          <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
            {/* Botón de Backup */}
            <Paper
              elevation={3}
              sx={{
                p: 3,
                borderRadius: 3,
                border: "1px solid rgba(212,175,55,0.25)",
                backgroundColor: "rgba(255,255,255,0.95)",
              }}
            >
              <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 2 }}>
                <Backup sx={{ fontSize: 40, color: colorPrincipal }} />
                <Box sx={{ flex: 1 }}>
                  <Typography variant="h6" sx={{ color: colorPrincipal, fontWeight: 700 }}>
                    Backup de Base de Datos
                  </Typography>
                  <Typography variant="body2" sx={{ color: "rgba(46,46,46,0.70)" }}>
                    Genera una copia de seguridad completa de toda la información del sistema
                  </Typography>
                </Box>
              </Box>
              
              <Typography variant="body2" sx={{ mb: 2, color: "rgba(46,46,46,0.65)" }}>
                El backup incluye:
              </Typography>
              <ul style={{ margin: 0, paddingLeft: 20, color: "rgba(46,46,46,0.65)" }}>
                <li>Datos de pacientes y historial clínico</li>
                <li>Tratamientos realizados y presupuestos</li>
                <li>Inventario y movimientos de stock</li>
                <li>Finanzas, deudas y pagos</li>
                <li>Usuarios y especialistas</li>
                <li>Todas las configuraciones del sistema</li>
              </ul>

              <Button
                fullWidth
                variant="contained"
                startIcon={generandoBackup ? <CircularProgress size={20} color="inherit" /> : <Backup />}
                onClick={realizarBackup}
                disabled={generandoBackup}
                sx={{
                  mt: 3,
                  py: 1.5,
                  backgroundColor: colorPrincipal,
                  fontWeight: 700,
                  fontSize: "1rem",
                  borderRadius: 2,
                  "&:hover": { backgroundColor: "#8a541a" },
                  "&:disabled": { backgroundColor: "rgba(163,105,32,0.5)" },
                }}
              >
                {generandoBackup ? "Generando Backup..." : "Realizar Backup"}
              </Button>
            </Paper>

            {/* Botón de Backup de Imágenes */}
            <Paper
              elevation={3}
              sx={{
                p: 3,
                borderRadius: 3,
                border: "1px solid rgba(212,175,55,0.25)",
                backgroundColor: "rgba(255,255,255,0.95)",
              }}
            >
              <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 2 }}>
                <PhotoLibrary sx={{ fontSize: 40, color: colorPrincipal }} />
                <Box sx={{ flex: 1 }}>
                  <Typography variant="h6" sx={{ color: colorPrincipal, fontWeight: 700 }}>
                    Backup de Imágenes
                  </Typography>
                  <Typography variant="body2" sx={{ color: "rgba(46,46,46,0.70)" }}>
                    Descarga todas las fotos y archivos del sistema en un archivo ZIP
                  </Typography>
                </Box>
              </Box>
              
              <Typography variant="body2" sx={{ mb: 2, color: "rgba(46,46,46,0.65)" }}>
                El backup incluye:
              </Typography>
              <ul style={{ margin: 0, paddingLeft: 20, color: "rgba(46,46,46,0.65)" }}>
                <li>Fotos de perfil de pacientes</li>
                <li>Fotos de tratamientos realizados (antes/después)</li>
                <li>Documentos PDF de inventario</li>
                <li>Todas las imágenes subidas al sistema</li>
              </ul>

              <Button
                fullWidth
                variant="contained"
                startIcon={generandoBackupImagenes ? <CircularProgress size={20} color="inherit" /> : <PhotoLibrary />}
                onClick={realizarBackupImagenes}
                disabled={generandoBackupImagenes}
                sx={{
                  mt: 3,
                  py: 1.5,
                  backgroundColor: "#1976d2",
                  fontWeight: 700,
                  fontSize: "1rem",
                  borderRadius: 2,
                  "&:hover": { backgroundColor: "#115293" },
                  "&:disabled": { backgroundColor: "rgba(25,118,210,0.5)" },
                }}
              >
                {generandoBackupImagenes ? "Generando Backup..." : "Descargar Imágenes"}
              </Button>
            </Paper>
            {/* Sección Tratamientos Huérfanos */}
            <Paper
              elevation={3}
              sx={{
                p: 3,
                borderRadius: 3,
                border: "1px solid rgba(212,175,55,0.25)",
                backgroundColor: "rgba(255,255,255,0.95)",
              }}
            >
              <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 2 }}>
                <SearchOff sx={{ fontSize: 40, color: "#d32f2f" }} />
                <Box sx={{ flex: 1 }}>
                  <Typography variant="h6" sx={{ color: colorPrincipal, fontWeight: 700 }}>
                    Tratamientos Huérfanos
                  </Typography>
                  <Typography variant="body2" sx={{ color: "rgba(46,46,46,0.70)" }}>
                    Busca tratamientos registrados sin paciente asignado (por error al no seleccionar paciente)
                  </Typography>
                </Box>
              </Box>

              <Button
                fullWidth
                variant="contained"
                startIcon={buscandoHuerfanos ? <CircularProgress size={20} color="inherit" /> : <SearchOff />}
                onClick={buscarHuerfanos}
                disabled={buscandoHuerfanos}
                sx={{
                  mt: 1,
                  py: 1.5,
                  backgroundColor: "#ed6c02",
                  fontWeight: 700,
                  fontSize: "1rem",
                  borderRadius: 2,
                  "&:hover": { backgroundColor: "#c55a02" },
                  "&:disabled": { backgroundColor: "rgba(237,108,2,0.5)" },
                }}
              >
                {buscandoHuerfanos ? "Buscando..." : "Buscar Tratamientos Huérfanos"}
              </Button>

              {huerfanos.length > 0 && (
                <Box sx={{ mt: 3 }}>
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700, color: "#d32f2f" }}>
                      {huerfanos.length} tratamiento(s) sin paciente encontrado(s)
                    </Typography>
                    <Button
                      variant="contained"
                      color="error"
                      size="small"
                      startIcon={eliminandoTodos ? <CircularProgress size={16} color="inherit" /> : <DeleteSweep />}
                      onClick={eliminarTodosHuerfanos}
                      disabled={eliminandoTodos}
                    >
                      Eliminar Todos
                    </Button>
                  </Box>
                  <Box sx={{ overflowX: "auto" }}>
                    <Table size="small">
                      <TableHead>
                        <TableRow sx={{ backgroundColor: "rgba(211,47,47,0.08)" }}>
                          <TableCell sx={{ fontWeight: 700 }}>ID</TableCell>
                          <TableCell sx={{ fontWeight: 700 }}>Fecha</TableCell>
                          <TableCell sx={{ fontWeight: 700 }}>Tratamiento</TableCell>
                          <TableCell sx={{ fontWeight: 700 }}>Especialista</TableCell>
                          <TableCell sx={{ fontWeight: 700 }}>Precio</TableCell>
                          <TableCell sx={{ fontWeight: 700 }}>Sesión</TableCell>
                          <TableCell sx={{ fontWeight: 700 }}>Paciente ID</TableCell>
                          <TableCell sx={{ fontWeight: 700 }}>Acción</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {huerfanos.map((h) => (
                          <TableRow key={h.id} hover>
                            <TableCell>{h.id}</TableCell>
                            <TableCell>{h.fecha ? new Date(h.fecha).toLocaleString("es-PE") : "-"}</TableCell>
                            <TableCell>
                              <Box>
                                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                  {h.tratamiento_nombre}
                                </Typography>
                                {h.productos?.length > 0 && (
                                  <Typography variant="caption" color="text.secondary">
                                    {h.productos.map((p) => p.nombre || p.producto).filter(Boolean).join(", ")}
                                  </Typography>
                                )}
                              </Box>
                            </TableCell>
                            <TableCell>{h.especialista || "-"}</TableCell>
                            <TableCell>S/ {(h.precio_total || 0).toFixed(2)}</TableCell>
                            <TableCell>{h.sesion || "-"}</TableCell>
                            <TableCell>
                              <Chip
                                label={h.paciente_id == null ? "NULL" : h.paciente_id === 0 ? "0" : `#${h.paciente_id} (no existe)`}
                                size="small"
                                color="error"
                                variant="outlined"
                              />
                            </TableCell>
                            <TableCell>
                              <IconButton
                                color="error"
                                size="small"
                                onClick={() => eliminarHuerfano(h.id)}
                                title="Eliminar este tratamiento"
                              >
                                <Delete fontSize="small" />
                              </IconButton>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </Box>
                </Box>
              )}
            </Paper>
          </Box>
        </Paper>
      </Container>
    </Box>
  );
};

export default Gestion;
