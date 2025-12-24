import React from "react";
import { Box, Typography, Button, Paper } from "@mui/material";

export default function PacientesMenu() {
  const colorPrincipal = "#a36920ff";
  const role = localStorage.getItem("role");
  const canWritePatients = role === "doctor" || role === "asistente";

  return (
    <Box
      sx={{
        minHeight: "100vh",
        backgroundImage: "url('/images/background-showclinic.jpg')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        position: "relative",
        "&::before": {
          content: '""',
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(135deg, rgba(255,255,255,0.65), rgba(247,234,193,0.55))",
          zIndex: 0,
        },
        "& > *": { position: "relative", zIndex: 1 },
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Paper
        elevation={6}
        sx={{
          p: { xs: 3, sm: 4 },
          borderRadius: 5,
          background:
            "linear-gradient(180deg, rgba(255,249,236,0.98) 0%, rgba(255,255,255,0.92) 52%, rgba(247,234,193,0.55) 100%)",
          border: "1px solid rgba(212,175,55,0.28)",
          backdropFilter: "blur(10px)",
          textAlign: "center",
          width: { xs: "92vw", sm: 460 },
          boxShadow: "0 18px 55px rgba(0,0,0,0.12), 0 0 0 1px rgba(212,175,55,0.10)",
        }}
      >
        <Typography
          variant="h5"
          sx={{
            fontWeight: "bold",
            color: colorPrincipal,
            mb: 0.5,
            letterSpacing: 0.6,
          }}
        >
          PACIENTES
        </Typography>

        <Typography
          variant="body2"
          sx={{ color: "rgba(46,46,46,0.72)", mb: 3.2 }}
        >
          Selecciona una opción
        </Typography>

        <Box sx={{ display: "flex", flexDirection: "column", gap: 1.6 }}>
          <Button
            fullWidth
            variant="contained"
            sx={{
              backgroundColor: colorPrincipal,
              "&:hover": { backgroundColor: "#8a541a", transform: "translateY(-1px)" },
              transition: "transform 120ms ease, box-shadow 120ms ease, background-color 120ms ease",
              boxShadow: "0 8px 18px rgba(0,0,0,0.12)",
              color: "white",
              py: 1.7,
              minHeight: 56,
              borderRadius: 3,
              fontWeight: 800,
              letterSpacing: 0.2,
            }}
            onClick={() => (window.location.href = "/pacientes/buscar")}
          >
            Buscar Paciente
          </Button>

          {canWritePatients ? (
            <Button
              fullWidth
              variant="contained"
              sx={{
                backgroundColor: colorPrincipal,
                "&:hover": { backgroundColor: "#8a541a", transform: "translateY(-1px)" },
                transition: "transform 120ms ease, box-shadow 120ms ease, background-color 120ms ease",
                boxShadow: "0 8px 18px rgba(0,0,0,0.12)",
                color: "white",
                py: 1.7,
                minHeight: 56,
                borderRadius: 3,
                fontWeight: 800,
                letterSpacing: 0.2,
              }}
              onClick={() => (window.location.href = "/pacientes/registrar")}
            >
              Registrar Paciente
            </Button>
          ) : null}

          {canWritePatients ? (
            <Button
              fullWidth
              variant="contained"
              sx={{
                backgroundColor: colorPrincipal,
                "&:hover": { backgroundColor: "#8a541a", transform: "translateY(-1px)" },
                transition: "transform 120ms ease, box-shadow 120ms ease, background-color 120ms ease",
                boxShadow: "0 8px 18px rgba(0,0,0,0.12)",
                color: "white",
                py: 1.7,
                minHeight: 56,
                borderRadius: 3,
                fontWeight: 800,
                letterSpacing: 0.2,
              }}
              onClick={() => (window.location.href = "/historial-clinico")}
            >
              Historial Clínico
            </Button>
          ) : null}

          <Button
            fullWidth
            variant="contained"
            sx={{
              backgroundColor: colorPrincipal,
              "&:hover": { backgroundColor: "#8a541a", transform: "translateY(-1px)" },
              transition: "transform 120ms ease, box-shadow 120ms ease, background-color 120ms ease",
              boxShadow: "0 8px 18px rgba(0,0,0,0.12)",
              color: "white",
              py: 1.7,
              minHeight: 56,
              borderRadius: 3,
              fontWeight: 800,
              letterSpacing: 0.2,
            }}
            onClick={() => (window.location.href = "/pacientes/deudas")}
          >
            Pacientes con deudas
          </Button>
        </Box>
      </Paper>
    </Box>
  );
}
