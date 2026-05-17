import React from "react";
import { Box, Typography, Paper, IconButton, Grid, Avatar } from "@mui/material";
import { ArrowBack, Home, Search, PersonAdd, Description, CreditCard, Groups, EventNote } from "@mui/icons-material";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { canWritePatients } from "../utils/permissions";

export default function PacientesMenu() {
  const navigate = useNavigate();
  const { role } = useAuth();
  const canWrite = canWritePatients(role);

  const menuOptions = [
    {
      title: "Buscar paciente",
      description: "Busca por nombre o DNI",
      icon: <Search />,
      iconBg: "#f5f1e4",
      iconColor: "#5a3e1b",
      path: "/pacientes/buscar",
      show: true,
    },
    {
      title: "Registrar paciente",
      description: "Agregar nuevo paciente",
      icon: <PersonAdd />,
      iconBg: "#f5f1e4",
      iconColor: "#a36920",
      path: "/pacientes/registrar",
      show: canWrite,
    },
    {
      title: "Historial clínico",
      description: "Consultas y tratamientos",
      icon: <Description />,
      iconBg: "#f5f1e4",
      iconColor: "#5a3e1b",
      path: "/historial-clinico",
      show: canWrite,
    },
    {
      title: "Seguimiento de pacientes",
      description: "Control de último tratamiento",
      icon: <EventNote />,
      iconBg: "#f5f1e4",
      iconColor: "#a36920",
      path: "/pacientes/seguimiento",
      show: true,
    },
    {
      title: "Pacientes con deudas",
      description: "Pagos pendientes",
      icon: <CreditCard />,
      iconBg: "#f5f1e4",
      iconColor: "#a36920",
      path: "/pacientes/deudas",
      show: true,
    },
  ];

  return (
    <Box
      sx={{
        minHeight: "100vh",
        backgroundColor: "#f5f1e4",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        p: 3,
      }}
    >
      <Box sx={{ maxWidth: 720, width: "100%" }}>
        {/* Botones de navegación */}
        <Box sx={{ display: "flex", justifyContent: "space-between", mb: 5 }}>
          <IconButton
            onClick={() => navigate("/dashboard")}
            sx={{
              backgroundColor: "white",
              boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
              "&:hover": { backgroundColor: "#fff", boxShadow: "0 4px 12px rgba(0,0,0,0.12)" },
            }}
          >
            <ArrowBack sx={{ color: "#5a3e1b" }} />
          </IconButton>
          <IconButton
            onClick={() => navigate("/dashboard")}
            sx={{
              backgroundColor: "white",
              boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
              "&:hover": { backgroundColor: "#fff", boxShadow: "0 4px 12px rgba(0,0,0,0.12)" },
            }}
          >
            <Home sx={{ color: "#5a3e1b" }} />
          </IconButton>
        </Box>

        {/* Ícono y título central */}
        <Box sx={{ textAlign: "center", mb: 6 }}>
          <Avatar
            sx={{
              width: 72,
              height: 72,
              backgroundColor: "#5a3e1b",
              margin: "0 auto",
              mb: 2.5,
              borderRadius: 3.5,
            }}
          >
            <Groups sx={{ fontSize: 40, color: "#ba9a63" }} />
          </Avatar>
          <Typography
            sx={{
              fontSize: "2rem",
              fontWeight: 400,
              color: "#2E2E2E",
              mb: 1,
              fontFamily: "'Playfair Display', serif",
            }}
          >
            Pacientes
          </Typography>
          <Typography
            sx={{
              fontSize: "0.95rem",
              color: "#999",
            }}
          >
            Selecciona una opción para continuar
          </Typography>
        </Box>

        {/* Grid de opciones */}
        <Grid container spacing={2.5} justifyContent="center">
          {menuOptions.filter(opt => opt.show).map((option, index) => (
            <Grid item xs={12} sm={6} key={index}>
              <Paper
                elevation={0}
                onClick={() => navigate(option.path)}
                sx={{
                  p: 3.5,
                  borderRadius: 4,
                  backgroundColor: "white",
                  border: "1px solid rgba(163,105,32,0.08)",
                  cursor: "pointer",
                  transition: "all 0.25s ease",
                  height: "100%",
                  display: "flex",
                  flexDirection: "column",
                  "&:hover": {
                    borderColor: "rgba(163,105,32,0.25)",
                    boxShadow: "0 6px 20px rgba(163,105,32,0.1)",
                    transform: "translateY(-3px)",
                  },
                }}
              >
                <Box
                  sx={{
                    width: 52,
                    height: 52,
                    borderRadius: 2.5,
                    backgroundColor: option.iconBg,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    mb: 2.5,
                  }}
                >
                  {React.cloneElement(option.icon, { sx: { color: option.iconColor, fontSize: 26 } })}
                </Box>
                <Typography
                  sx={{
                    fontSize: "1rem",
                    fontWeight: 600,
                    color: "#2E2E2E",
                    mb: 0.8,
                    lineHeight: 1.3,
                  }}
                >
                  {option.title}
                </Typography>
                <Typography
                  sx={{
                    fontSize: "0.875rem",
                    color: "#999",
                    lineHeight: 1.5,
                  }}
                >
                  {option.description}
                </Typography>
              </Paper>
            </Grid>
          ))}
        </Grid>

        {/* Footer */}
        <Box sx={{ textAlign: "center", mt: 5 }}>
          <Typography sx={{ fontSize: "0.85rem", color: "#999" }}>
            <span style={{ color: "#a36920", fontWeight: 600 }}>ShowClinic</span> · Gestión clínica
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}
