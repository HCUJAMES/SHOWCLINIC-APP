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
            {/* Sección Tratamientos Huérfanos - Diseño Profesional */}
            <Paper
              elevation={4}
              sx={{
                p: 4,
                borderRadius: 4,
                background: "linear-gradient(135deg, rgba(255,255,255,0.98) 0%, rgba(255,250,245,0.98) 100%)",
                border: "2px solid rgba(211,47,47,0.12)",
                boxShadow: "0 8px 32px rgba(211,47,47,0.08)",
              }}
            >
              <Box sx={{ display: "flex", alignItems: "flex-start", gap: 3, mb: 3 }}>
                <Box
                  sx={{
                    p: 2,
                    borderRadius: 3,
                    background: "linear-gradient(135deg, #ff6b6b 0%, #ee5a6f 100%)",
                    boxShadow: "0 4px 20px rgba(238,90,111,0.3)",
                  }}
                >
                  <SearchOff sx={{ fontSize: 36, color: "#fff" }} />
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Typography 
                    variant="h5" 
                    sx={{ 
                      color: "#d32f2f", 
                      fontWeight: 800,
                      mb: 0.5,
                      letterSpacing: "-0.5px"
                    }}
                  >
                    Gestión de Tratamientos Huérfanos
                  </Typography>
                  <Typography 
                    variant="body2" 
                    sx={{ 
                      color: "rgba(46,46,46,0.65)",
                      lineHeight: 1.6,
                      maxWidth: "600px"
                    }}
                  >
                    Identifica y gestiona tratamientos registrados sin paciente asignado. 
                    Los productos se devolverán automáticamente al inventario al eliminar.
                  </Typography>
                </Box>
              </Box>

              <Button
                fullWidth
                variant="contained"
                size="large"
                startIcon={buscandoHuerfanos ? <CircularProgress size={22} sx={{ color: "#fff" }} /> : <SearchOff />}
                onClick={buscarHuerfanos}
                disabled={buscandoHuerfanos}
                sx={{
                  py: 1.8,
                  background: "linear-gradient(135deg, #ff6b6b 0%, #ee5a6f 100%)",
                  fontWeight: 700,
                  fontSize: "1.05rem",
                  borderRadius: 3,
                  textTransform: "none",
                  boxShadow: "0 4px 20px rgba(238,90,111,0.25)",
                  "&:hover": { 
                    background: "linear-gradient(135deg, #ee5a6f 0%, #d32f2f 100%)",
                    boxShadow: "0 6px 28px rgba(238,90,111,0.35)",
                    transform: "translateY(-2px)",
                  },
                  "&:disabled": { 
                    background: "rgba(211,47,47,0.3)",
                    color: "rgba(255,255,255,0.7)"
                  },
                  transition: "all 0.3s ease",
                }}
              >
                {buscandoHuerfanos ? "Buscando tratamientos..." : "🔍 Buscar Tratamientos Huérfanos"}
              </Button>

              {huerfanos.length > 0 && (
                <Box sx={{ mt: 4 }}>
                  <Box 
                    sx={{ 
                      display: "flex", 
                      justifyContent: "space-between", 
                      alignItems: "center", 
                      mb: 3,
                      p: 2.5,
                      borderRadius: 3,
                      background: "linear-gradient(135deg, rgba(255,107,107,0.08) 0%, rgba(238,90,111,0.08) 100%)",
                      border: "1px solid rgba(211,47,47,0.15)"
                    }}
                  >
                    <Box>
                      <Typography variant="h6" sx={{ fontWeight: 700, color: "#d32f2f", mb: 0.5 }}>
                        {huerfanos.length} {huerfanos.length === 1 ? "Tratamiento" : "Tratamientos"} Encontrado{huerfanos.length === 1 ? "" : "s"}
                      </Typography>
                      <Typography variant="caption" sx={{ color: "rgba(46,46,46,0.6)" }}>
                        Selecciona los tratamientos que deseas eliminar
                      </Typography>
                    </Box>
                    <Button
                      variant="contained"
                      color="error"
                      startIcon={eliminandoTodos ? <CircularProgress size={18} sx={{ color: "#fff" }} /> : <DeleteSweep />}
                      onClick={eliminarTodosHuerfanos}
                      disabled={eliminandoTodos}
                      sx={{
                        py: 1.2,
                        px: 3,
                        fontWeight: 700,
                        borderRadius: 2.5,
                        textTransform: "none",
                        boxShadow: "0 4px 16px rgba(211,47,47,0.25)",
                        "&:hover": {
                          boxShadow: "0 6px 24px rgba(211,47,47,0.35)",
                          transform: "translateY(-2px)",
                        },
                        transition: "all 0.3s ease",
                      }}
                    >
                      Eliminar Todos
                    </Button>
                  </Box>

                  <Box 
                    sx={{ 
                      overflowX: "auto",
                      borderRadius: 3,
                      border: "1px solid rgba(211,47,47,0.12)",
                      boxShadow: "0 2px 12px rgba(0,0,0,0.04)"
                    }}
                  >
                    <Table>
                      <TableHead>
                        <TableRow 
                          sx={{ 
                            background: "linear-gradient(135deg, rgba(211,47,47,0.12) 0%, rgba(238,90,111,0.12) 100%)"
                          }}
                        >
                          <TableCell sx={{ fontWeight: 800, color: "#d32f2f", fontSize: "0.85rem" }}>ID</TableCell>
                          <TableCell sx={{ fontWeight: 800, color: "#d32f2f", fontSize: "0.85rem" }}>Fecha</TableCell>
                          <TableCell sx={{ fontWeight: 800, color: "#d32f2f", fontSize: "0.85rem" }}>Tratamiento</TableCell>
                          <TableCell sx={{ fontWeight: 800, color: "#d32f2f", fontSize: "0.85rem" }}>Especialista</TableCell>
                          <TableCell sx={{ fontWeight: 800, color: "#d32f2f", fontSize: "0.85rem" }}>Precio</TableCell>
                          <TableCell sx={{ fontWeight: 800, color: "#d32f2f", fontSize: "0.85rem" }}>Sesión</TableCell>
                          <TableCell sx={{ fontWeight: 800, color: "#d32f2f", fontSize: "0.85rem" }}>Estado</TableCell>
                          <TableCell sx={{ fontWeight: 800, color: "#d32f2f", fontSize: "0.85rem", textAlign: "center" }}>Acción</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {huerfanos.map((h, index) => (
                          <TableRow 
                            key={h.id} 
                            hover
                            sx={{
                              "&:hover": {
                                backgroundColor: "rgba(255,107,107,0.04)",
                              },
                              backgroundColor: index % 2 === 0 ? "rgba(255,255,255,0.5)" : "rgba(255,250,245,0.5)",
                              transition: "all 0.2s ease"
                            }}
                          >
                            <TableCell>
                              <Chip 
                                label={`#${h.id}`} 
                                size="small" 
                                sx={{ 
                                  fontWeight: 700,
                                  backgroundColor: "rgba(211,47,47,0.1)",
                                  color: "#d32f2f"
                                }}
                              />
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2" sx={{ fontSize: "0.85rem", color: "rgba(46,46,46,0.8)" }}>
                                {h.fecha ? new Date(h.fecha).toLocaleDateString("es-PE", { 
                                  day: "2-digit", 
                                  month: "short", 
                                  year: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit"
                                }) : "-"}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Box>
                                <Typography variant="body2" sx={{ fontWeight: 700, color: "#2e2e2e", mb: 0.3 }}>
                                  {h.tratamiento_nombre}
                                </Typography>
                                {h.productos?.length > 0 && (
                                  <Typography 
                                    variant="caption" 
                                    sx={{ 
                                      color: "rgba(46,46,46,0.55)",
                                      display: "block",
                                      fontSize: "0.75rem"
                                    }}
                                  >
                                    {h.productos.map((p) => p.nombre || p.producto).filter(Boolean).join(", ")}
                                  </Typography>
                                )}
                              </Box>
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2" sx={{ fontSize: "0.85rem", color: "rgba(46,46,46,0.75)" }}>
                                {h.especialista || "-"}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2" sx={{ fontWeight: 700, color: "#2e2e2e", fontSize: "0.9rem" }}>
                                S/ {(h.precio_total || 0).toFixed(2)}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Chip 
                                label={h.sesion || "-"} 
                                size="small"
                                sx={{
                                  backgroundColor: "rgba(163,105,32,0.1)",
                                  color: colorPrincipal,
                                  fontWeight: 600
                                }}
                              />
                            </TableCell>
                            <TableCell>
                              <Chip
                                label={h.paciente_id == null ? "Sin Paciente" : h.paciente_id === 0 ? "ID: 0" : `ID: ${h.paciente_id} (Eliminado)`}
                                size="small"
                                sx={{
                                  backgroundColor: "rgba(211,47,47,0.15)",
                                  color: "#d32f2f",
                                  fontWeight: 700,
                                  fontSize: "0.75rem"
                                }}
                              />
                            </TableCell>
                            <TableCell sx={{ textAlign: "center" }}>
                              <IconButton
                                color="error"
                                onClick={() => eliminarHuerfano(h.id)}
                                title="Eliminar este tratamiento y devolver productos al inventario"
                                sx={{
                                  backgroundColor: "rgba(211,47,47,0.08)",
                                  "&:hover": {
                                    backgroundColor: "rgba(211,47,47,0.18)",
                                    transform: "scale(1.1)",
                                  },
                                  transition: "all 0.2s ease"
                                }}
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
