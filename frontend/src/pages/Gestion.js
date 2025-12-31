import React, { useState } from "react";
import { Container, Typography, Button, Paper, Box, IconButton, CircularProgress } from "@mui/material";
import { ArrowBack, Backup } from "@mui/icons-material";
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
          </Box>
        </Paper>
      </Container>
    </Box>
  );
};

export default Gestion;
