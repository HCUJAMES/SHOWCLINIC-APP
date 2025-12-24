import React from "react";
import { Box, Paper, Button, Typography } from "@mui/material";
import { useNavigate } from "react-router-dom";

export default function TratamientosMenu() {
  const navigate = useNavigate();
  const colorPrincipal = "#a36920ff";
  const role = localStorage.getItem("role"); // Obtiene el rol del usuario logueado
  const canCreateTratamiento = role === "doctor" || role === "asistente";

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
        <Typography
          variant="h5"
          sx={{
            color: colorPrincipal,
            fontWeight: "bold",
            mb: 4,
            textShadow: "0 1px 2px rgba(0,0,0,0.1)",
          }}
        >
          Módulo de Tratamientos
        </Typography>

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
            CREAR TRATAMIENTO
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
          COMENZAR TRATAMIENTO
        </Button>
      </Paper>
    </Box>
  );
}
