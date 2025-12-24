import React from "react";
import {
  Typography,
  Box,
  Grid,
  Card,
  CardActionArea,
  CardMedia,
  CardContent,
} from "@mui/material";
import { useNavigate } from "react-router-dom";

export default function Dashboard() {
  const role = localStorage.getItem("role");
  const navigate = useNavigate();

  // Menú según rol
  const menuItemsByRole = {
    doctor: [
      { title: "Pacientes", image: "/images/pacientes.jpeg", path: "/pacientes" },
      { title: "Tratamientos", image: "/images/tratamientos.jpeg", path: "/tratamientos" },
      { title: "Inventario", image: "/images/inventario.jpeg", path: "/inventario" },
      { title: "Finanzas", image: "/images/finanzas.jpeg", path: "/finanzas" },
    ],
    admin: [
      { title: "Pacientes", image: "/images/pacientes.jpeg", path: "/pacientes" },
      { title: "Tratamientos", image: "/images/tratamientos.jpeg", path: "/tratamientos" },
      { title: "Inventario", image: "/images/inventario.jpeg", path: "/inventario" },
      { title: "Finanzas", image: "/images/finanzas.jpeg", path: "/finanzas" },
    ],
    logistica: [
      { title: "Pacientes", image: "/images/pacientes.jpeg", path: "/pacientes" },
      { title: "Tratamientos", image: "/images/tratamientos.jpeg", path: "/tratamientos" },
      { title: "Inventario", image: "/images/inventario.jpeg", path: "/inventario" },
      { title: "Finanzas", image: "/images/finanzas.jpeg", path: "/finanzas" },
    ],
    asistente: [
      { title: "Pacientes", image: "/images/pacientes.jpeg", path: "/pacientes" },
      { title: "Tratamientos", image: "/images/tratamientos.jpeg", path: "/tratamientos" },
      { title: "Inventario", image: "/images/inventario.jpeg", path: "/inventario" },
      { title: "Finanzas", image: "/images/finanzas.jpeg", path: "/finanzas" },
    ],
  };

  const menuItems = menuItemsByRole[role] || [];

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
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        "&::before": {
          content: '""',
          position: "absolute",
          inset: 0,
          background: "linear-gradient(135deg, rgba(255,255,255,0.6), rgba(250,240,210,0.5))",
          zIndex: 0,
        },
        "& > *": { position: "relative", zIndex: 1 },
      }}
    >
      <Box
        sx={{
          width: "100%",
          maxWidth: 980,
          px: { xs: 2, sm: 4 },
          py: { xs: 3, sm: 4 },
          borderRadius: 6,
          border: "1px solid rgba(212,175,55,0.25)",
          backgroundColor: "rgba(255,255,255,0.72)",
          backdropFilter: "blur(10px)",
          boxShadow: "0 16px 40px rgba(0,0,0,0.10)",
        }}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 1.5,
            mb: 1,
          }}
        >
          <Box
            component="img"
            src="/logo-showclinic.png"
            alt="ShowClinic"
            sx={{
              width: 44,
              height: 44,
              objectFit: "cover",
              borderRadius: "50%",
              backgroundColor: "rgba(255,255,255,0.96)",
              border: "2px solid rgba(212,175,55,0.55)",
              boxShadow: "0 8px 18px rgba(0,0,0,0.10)",
            }}
          />
          <Typography
            variant="h4"
            align="center"
            sx={{
              fontWeight: 700,
              color: "#a36920ff",
              letterSpacing: 1,
              textShadow: "0px 1px 2px rgba(0,0,0,0.12)",
            }}
          >
            SHOWCLINIC
          </Typography>
        </Box>

        <Typography
          variant="subtitle1"
          align="center"
          sx={{ color: "rgba(46,46,46,0.85)", mb: 3 }}
        >
          Selecciona un módulo para continuar
        </Typography>

        <Grid container spacing={2} justifyContent="center" alignItems="stretch">
        {menuItems.map((item, index) => (
          <Grid item xs={12} sm={6} md={3} key={index}>
            <Card
              sx={{
                height: "100%",
                borderRadius: 5,
                position: "relative",
                overflow: "hidden",
                backgroundColor: "rgba(255,255,255,0.86)",
                backdropFilter: "blur(8px)",
                border: "1px solid rgba(212,175,55,0.22)",
                boxShadow: "0 10px 26px rgba(0,0,0,0.10)",
                transition: "transform 180ms ease, box-shadow 180ms ease",
                "&:hover": {
                  transform: "translateY(-4px)",
                  boxShadow: "0 16px 34px rgba(163,105,32,0.22)",
                },
                "&::before": {
                  content: '""',
                  position: "absolute",
                  inset: 0,
                  background:
                    "radial-gradient(circle at top, rgba(212,175,55,0.16), transparent 55%)",
                  pointerEvents: "none",
                },
              }}
            >
              <CardActionArea
                onClick={() => navigate(item.path)}
                sx={{
                  height: "100%",
                  textAlign: "center",
                  py: 4,
                  px: 3,
                  minHeight: 250,
                }}
              >
                <CardMedia
                  component="img"
                  image={item.image}
                  alt={item.title}
                  sx={{
                    width: 106,
                    height: 106,
                    mx: "auto",
                    borderRadius: "50%",
                    objectFit: "cover",
                    backgroundColor: "rgba(255,255,255,0.96)",
                    border: "2px solid rgba(212,175,55,0.35)",
                    boxShadow: "0 10px 18px rgba(0,0,0,0.08)",
                  }}
                />
                <CardContent sx={{ p: 0, mt: 2.0 }}>
                  <Typography
                    variant="h6"
                    sx={{
                      fontWeight: 700,
                      color: "#2E2E2E",
                      display: "block",
                    }}
                  >
                    {item.title}
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{
                      mt: 1.0,
                      color: "rgba(46,46,46,0.72)",
                    }}
                  >
                    Ingresar
                  </Typography>
                </CardContent>
              </CardActionArea>
            </Card>
          </Grid>
        ))}
        </Grid>

        <Typography
          variant="body2"
          align="center"
          sx={{ mt: 3, color: "rgba(46,46,46,0.70)" }}
        >
          Bienvenido, rol: <strong>{role}</strong>
        </Typography>
      </Box>
    </Box>
  );
}

