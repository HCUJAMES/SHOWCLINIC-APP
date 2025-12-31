import React from "react";
import { Box, Paper, Button, Typography, IconButton } from "@mui/material";
import { ArrowBack, Home } from "@mui/icons-material";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { canCreateTreatments } from "../../utils/permissions";
import { COLORS } from "../../constants";

export default function TratamientosMenu() {
  const navigate = useNavigate();
  const { role } = useAuth();
  const colorPrincipal = COLORS.PRIMARY;
  const canCreateTratamiento = canCreateTreatments(role);

  return (
    <Box
      sx={{
        minHeight: "100vh",
        backgroundImage: "url('/images/background-showclinic.jpg')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        position: "relative",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        "&::before": {
          content: '""',
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(135deg, rgba(255,255,255,0.6), rgba(247,234,193,0.55))",
          zIndex: 0,
        },
      }}
    >
      <Paper
        elevation={6}
        sx={{
          p: 5,
          borderRadius: 5,
          background:
            "linear-gradient(180deg, rgba(255,249,236,0.98) 0%, rgba(255,255,255,0.92) 52%, rgba(247,234,193,0.55) 100%)",
          border: "1px solid rgba(212,175,55,0.28)",
          backdropFilter: "blur(10px)",
          zIndex: 1,
          width: "90%",
          maxWidth: 600,
          textAlign: "center",
          boxShadow: "0 16px 40px rgba(0,0,0,0.10), 0 0 0 1px rgba(212,175,55,0.10)",
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
          <IconButton onClick={() => navigate("/dashboard")} sx={{ color: colorPrincipal }}>
            <ArrowBack />
          </IconButton>
          <Typography
            variant="h5"
            sx={{
              fontWeight: "bold",
              color: colorPrincipal,
              flex: 1,
              letterSpacing: 0.6,
            }}
          >
            TRATAMIENTOS
          </Typography>
          <IconButton onClick={() => navigate("/dashboard")} sx={{ color: colorPrincipal }} title="Inicio">
            <Home />
          </IconButton>
        </Box>

        {/* Botón visible solo para DOCTOR o ASISTENTE */}
        {canCreateTratamiento && (
          <Button
            fullWidth
            variant="contained"
            sx={{
              backgroundColor: colorPrincipal,
              mb: 2,
              py: 1.5,
              borderRadius: 3,
              fontWeight: "bold",
              "&:hover": { backgroundColor: "#8a541a" },
            }}
            onClick={() => navigate("/tratamientos/crear")}
          >
            NUEVO PROTOCOLO
          </Button>
        )}

        {/* Botón visible para ADMIN (solo lectura) */}
        {role === "admin" && (
          <Button
            fullWidth
            variant="contained"
            sx={{
              backgroundColor: colorPrincipal,
              mb: 2,
              py: 1.5,
              borderRadius: 3,
              fontWeight: "bold",
              "&:hover": { backgroundColor: "#8a541a" },
            }}
            onClick={() => navigate("/tratamientos/crear")}
          >
            VER TRATAMIENTOS
          </Button>
        )}

        {/* Botón visible para ambos (doctor y admin) */}
        <Button
          fullWidth
          variant="contained"
          sx={{
            backgroundColor: colorPrincipal,
            py: 1.5,
            borderRadius: 3,
            fontWeight: "bold",
            "&:hover": { backgroundColor: "#8a541a" },
          }}
          onClick={() => navigate("/tratamientos/comenzar")}
        >
          NUEVA SESIÓN
        </Button>
      </Paper>
    </Box>
  );
}
