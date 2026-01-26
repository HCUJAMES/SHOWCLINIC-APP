import React, { useState } from "react";
import {
  Typography,
  Box,
  Grid,
  Card,
  CardActionArea,
  CardContent,
  Fade,
  Grow,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
} from "@mui/material";
import {
  People,
  MedicalServices,
  Inventory2,
  AccountBalance,
  Badge,
  Insights,
  Settings,
  CardGiftcard,
  Lock,
  LocalHospital,
} from "@mui/icons-material";
import { useNavigate } from "react-router-dom";

// Iconos para cada módulo
const moduleIcons = {
  Pacientes: People,
  Tratamientos: MedicalServices,
  Paquetes: CardGiftcard,
  Inventario: Inventory2,
  Finanzas: AccountBalance,
  Especialistas: Badge,
  Estadísticas: Insights,
  Gestionar: Settings,
  "Gestión Clínica": LocalHospital,
};

export default function Dashboard() {
  const role = localStorage.getItem("role");
  const navigate = useNavigate();
  const [openAccessDenied, setOpenAccessDenied] = useState(false);
  const [deniedModule, setDeniedModule] = useState("");

  // Menú según rol
  const menuItemsByRole = {
    doctor: [
      { title: "Pacientes", image: "/images/pacientes.jpeg", path: "/pacientes", description: "Gestión de pacientes" },
      { title: "Tratamientos", image: "/images/tratamientos.jpeg", path: "/tratamientos", description: "Procedimientos estéticos" },
      { title: "Paquetes", image: "/images/paquetes.jpeg", path: "/paquetes", description: "Paquetes promocionales" },
      { title: "Inventario", image: "/images/inventario.jpeg", path: "/inventario", description: "Control de productos" },
      { title: "Finanzas", image: "/images/finanzas.jpeg", path: "/finanzas", description: "Ingresos y gastos" },
      { title: "Especialistas", image: "/images/especialista.png", path: "/especialistas", description: "Equipo médico" },
      { title: "Gestión Clínica", image: "/images/finanzas.jpeg", path: "/gestion-clinica", description: "Gestión de atenciones" },
      { title: "Estadísticas", image: "/images/finanzas.jpeg", path: "/estadisticas", description: "Resumen del mes" },
    ],
    admin: [
      { title: "Pacientes", image: "/images/pacientes.jpeg", path: "/pacientes", description: "Gestión de pacientes" },
      { title: "Tratamientos", image: "/images/tratamientos.jpeg", path: "/tratamientos", description: "Procedimientos estéticos" },
      { title: "Paquetes", image: "/images/paquetes.jpeg", path: "/paquetes", description: "Paquetes promocionales" },
      { title: "Inventario", image: "/images/inventario.jpeg", path: "/inventario", description: "Control de productos" },
      { title: "Finanzas", image: "/images/finanzas.jpeg", path: "/finanzas", description: "Ingresos y gastos" },
      { title: "Estadísticas", image: "/images/finanzas.jpeg", path: "/estadisticas", description: "Resumen del mes" },
    ],
    logistica: [
      { title: "Pacientes", image: "/images/pacientes.jpeg", path: "/pacientes", description: "Gestión de pacientes" },
      { title: "Tratamientos", image: "/images/tratamientos.jpeg", path: "/tratamientos", description: "Procedimientos estéticos" },
      { title: "Paquetes", image: "/images/paquetes.jpeg", path: "/paquetes", description: "Paquetes promocionales" },
      { title: "Inventario", image: "/images/inventario.jpeg", path: "/inventario", description: "Control de productos" },
      { title: "Finanzas", image: "/images/finanzas.jpeg", path: "/finanzas", description: "Ingresos y gastos" },
    ],
    asistente: [
      { title: "Pacientes", image: "/images/pacientes.jpeg", path: "/pacientes", description: "Gestión de pacientes" },
      { title: "Tratamientos", image: "/images/tratamientos.jpeg", path: "/tratamientos", description: "Procedimientos estéticos" },
      { title: "Paquetes", image: "/images/paquetes.jpeg", path: "/paquetes", description: "Paquetes promocionales" },
      { title: "Inventario", image: "/images/inventario.jpeg", path: "/inventario", description: "Control de productos" },
      { title: "Finanzas", image: "/images/finanzas.jpeg", path: "/finanzas", description: "Ingresos y gastos" },
    ],
    master: [
      { title: "Pacientes", image: "/images/pacientes.jpeg", path: "/pacientes", description: "Gestión de pacientes" },
      { title: "Tratamientos", image: "/images/tratamientos.jpeg", path: "/tratamientos", description: "Procedimientos estéticos" },
      { title: "Paquetes", image: "/images/paquetes.jpeg", path: "/paquetes", description: "Paquetes promocionales" },
      { title: "Inventario", image: "/images/inventario.jpeg", path: "/inventario", description: "Control de productos" },
      { title: "Finanzas", image: "/images/finanzas.jpeg", path: "/finanzas", description: "Ingresos y gastos" },
      { title: "Estadísticas", image: "/images/finanzas.jpeg", path: "/estadisticas", description: "Resumen del mes" },
      { title: "Gestionar", image: "/images/inventario.jpeg", path: "/gestion", description: "Administración del sistema" },
    ],
    doctora: [
      { title: "Pacientes", image: "/images/pacientes.jpeg", path: "/pacientes", description: "Gestión de pacientes", hasAccess: true },
      { title: "Tratamientos", image: "/images/tratamientos.jpeg", path: "/tratamientos", description: "Procedimientos estéticos", hasAccess: true },
      { title: "Paquetes", image: "/images/paquetes.jpeg", path: "/paquetes", description: "Paquetes promocionales", hasAccess: false },
      { title: "Inventario", image: "/images/inventario.jpeg", path: "/inventario", description: "Control de productos", hasAccess: false },
      { title: "Finanzas", image: "/images/finanzas.jpeg", path: "/finanzas", description: "Ingresos y gastos", hasAccess: false },
      { title: "Especialistas", image: "/images/especialista.png", path: "/especialistas", description: "Equipo médico", hasAccess: false },
      { title: "Estadísticas", image: "/images/finanzas.jpeg", path: "/estadisticas", description: "Resumen del mes", hasAccess: false },
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
        "&::before": {
          content: '""',
          position: "absolute",
          inset: 0,
          background: "linear-gradient(135deg, rgba(255,255,255,0.75), rgba(250,240,210,0.6))",
          zIndex: 0,
        },
        "& > *": { position: "relative", zIndex: 1 },
      }}
    >
      {/* Main Content */}
      <Box
        sx={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          py: { xs: 4, sm: 6 },
          px: 2,
        }}
      >
        <Fade in timeout={600}>
          <Box
            sx={{
              width: "100%",
              maxWidth: 1100,
              px: { xs: 2, sm: 5 },
              py: { xs: 4, sm: 5 },
              borderRadius: 4,
              border: "1px solid rgba(163,105,32,0.15)",
              backgroundColor: "rgba(255,255,255,0.88)",
              backdropFilter: "blur(12px)",
              boxShadow: "0 20px 60px rgba(0,0,0,0.12)",
            }}
          >
            {/* Header con logo */}
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 2,
                mb: 1,
              }}
            >
              <Box
                component="img"
                src="/logo-showclinic.png"
                alt="ShowClinic"
                sx={{
                  width: 56,
                  height: 56,
                  objectFit: "cover",
                  borderRadius: "50%",
                  backgroundColor: "rgba(255,255,255,0.96)",
                  border: "2px solid rgba(163,105,32,0.4)",
                  boxShadow: "0 8px 24px rgba(163,105,32,0.15)",
                  transition: "transform 0.3s ease",
                  "&:hover": {
                    transform: "scale(1.05)",
                  },
                }}
              />
              <Typography
                variant="h3"
                align="center"
                sx={{
                  fontFamily: "'Playfair Display', serif",
                  fontWeight: 700,
                  color: "#A36920",
                  letterSpacing: 2,
                  textShadow: "0px 2px 4px rgba(0,0,0,0.08)",
                }}
              >
                SHOWCLINIC
              </Typography>
            </Box>

            <Typography
              variant="subtitle1"
              align="center"
              sx={{ 
                color: "#6B6B6B", 
                mb: 4,
                fontWeight: 400,
                letterSpacing: 0.5,
              }}
            >
              Estética Avanzada & Bienestar
            </Typography>

            {/* Grid de módulos */}
            <Grid container spacing={3} justifyContent="center" alignItems="stretch">
              {menuItems.map((item, index) => {
                const IconComponent = moduleIcons[item.title];
                return (
                  <Grow in timeout={400 + index * 150} key={index}>
                    <Grid item xs={12} sm={6} md={4} lg={menuItems.length === 5 ? 2.4 : 3}>
                      <Card
                        sx={{
                          height: "100%",
                          borderRadius: 4,
                          position: "relative",
                          overflow: "hidden",
                          backgroundColor: item.hasAccess === false ? "rgba(200,200,200,0.3)" : "rgba(255,255,255,0.95)",
                          border: item.hasAccess === false ? "1px solid rgba(150,150,150,0.3)" : "1px solid rgba(163,105,32,0.12)",
                          boxShadow: "0 8px 32px rgba(0,0,0,0.08)",
                          opacity: item.hasAccess === false ? 0.6 : 1,
                          transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                          "&:hover": {
                            transform: "translateY(-8px)",
                            boxShadow: "0 20px 40px rgba(163,105,32,0.2)",
                            border: "1px solid rgba(163,105,32,0.3)",
                            "& .module-icon": {
                              transform: "scale(1.1)",
                              backgroundColor: "rgba(163,105,32,0.15)",
                              boxShadow: "0 8px 24px rgba(163,105,32,0.25)",
                            },
                            "& .module-icon svg": {
                              color: "#8A5A1A",
                            },
                            "& .module-title": {
                              color: "#A36920",
                            },
                          },
                        }}
                      >
                        <CardActionArea
                          onClick={() => {
                            if (item.hasAccess === false) {
                              setDeniedModule(item.title);
                              setOpenAccessDenied(true);
                            } else {
                              navigate(item.path);
                            }
                          }}
                          sx={{
                            height: "100%",
                            textAlign: "center",
                            py: 4,
                            px: 3,
                            minHeight: 220,
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          {/* Icono del módulo */}
                          <Box
                            className="module-icon"
                            sx={{
                              width: 110,
                              height: 110,
                              borderRadius: "50%",
                              backgroundColor: "rgba(163,105,32,0.08)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              mb: 2.5,
                              transition: "all 0.3s ease",
                              position: "relative",
                            }}
                          >
                            {IconComponent && (
                              <IconComponent
                                sx={{
                                  fontSize: 52,
                                  color: "#A36920",
                                  transition: "color 0.3s ease",
                                }}
                              />
                            )}
                            {item.hasAccess === false && (
                              <Box
                                sx={{
                                  position: "absolute",
                                  top: -5,
                                  right: -5,
                                  backgroundColor: "#d32f2f",
                                  borderRadius: "50%",
                                  width: 35,
                                  height: 35,
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
                                }}
                              >
                                <Lock sx={{ fontSize: 18, color: "white" }} />
                              </Box>
                            )}
                          </Box>

                          <CardContent sx={{ p: 0 }}>
                            <Typography
                              className="module-title"
                              variant="h6"
                              sx={{
                                fontWeight: 600,
                                color: "#2E2E2E",
                                mb: 0.5,
                                transition: "color 0.3s ease",
                              }}
                            >
                              {item.title}
                            </Typography>
                            <Typography
                              variant="body2"
                              sx={{
                                color: "#6B6B6B",
                                fontSize: "0.85rem",
                              }}
                            >
                              {item.description}
                            </Typography>
                          </CardContent>
                        </CardActionArea>
                      </Card>
                    </Grid>
                  </Grow>
                );
              })}
            </Grid>

            {/* Info del usuario */}
            <Fade in timeout={1000}>
              <Box
                sx={{
                  mt: 4,
                  pt: 3,
                  borderTop: "1px solid rgba(163,105,32,0.1)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 1,
                }}
              >
                <Box
                  sx={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    backgroundColor: "#4CAF50",
                    boxShadow: "0 0 8px rgba(76,175,80,0.5)",
                  }}
                />
                <Typography
                  variant="body2"
                  sx={{ color: "#6B6B6B" }}
                >
                  Sesión activa como <strong style={{ color: "#A36920" }}>{role}</strong>
                </Typography>
              </Box>
            </Fade>
          </Box>
        </Fade>
      </Box>

      {/* Footer elegante */}
      <Box
        component="footer"
        sx={{
          py: 2.5,
          px: 3,
          backgroundColor: "rgba(26,26,26,0.95)",
          backdropFilter: "blur(10px)",
          borderTop: "1px solid rgba(163,105,32,0.3)",
        }}
      >
        <Box
          sx={{
            maxWidth: 1200,
            mx: "auto",
            display: "flex",
            flexDirection: { xs: "column", sm: "row" },
            alignItems: "center",
            justifyContent: "space-between",
            gap: 2,
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <Box
              component="img"
              src="/logo-showclinic.png"
              alt="ShowClinic"
              sx={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                opacity: 0.9,
              }}
            />
            <Typography
              variant="body2"
              sx={{
                color: "rgba(255,255,255,0.7)",
                fontWeight: 500,
                letterSpacing: 0.5,
              }}
            >
              ShowClinic
            </Typography>
          </Box>

          <Typography
            variant="body2"
            sx={{
              color: "rgba(255,255,255,0.5)",
              fontSize: "0.8rem",
              textAlign: "center",
            }}
          >
            Estética Avanzada & Bienestar • Arequipa, Perú
          </Typography>

          <Typography
            variant="body2"
            sx={{
              color: "rgba(255,255,255,0.4)",
              fontSize: "0.75rem",
            }}
          >
            © {new Date().getFullYear()} ShowClinic. Todos los derechos reservados.
          </Typography>
        </Box>
      </Box>

      {/* Modal de Acceso Denegado */}
      <Dialog 
        open={openAccessDenied} 
        onClose={() => setOpenAccessDenied(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ backgroundColor: "#d32f2f", color: "white", textAlign: "center" }}>
          🚫 Acceso Denegado
        </DialogTitle>
        <DialogContent sx={{ mt: 3, textAlign: "center" }}>
          <Typography variant="h6" sx={{ mb: 2, color: "#333", fontWeight: "bold" }}>
            {deniedModule}
          </Typography>
          <Typography variant="body1" sx={{ color: "#666" }}>
            Este usuario no tiene acceso a este módulo.
          </Typography>
          <Typography variant="body2" sx={{ mt: 2, color: "#999" }}>
            Contacta al administrador si necesitas permisos adicionales.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2, justifyContent: "center" }}>
          <Button 
            onClick={() => setOpenAccessDenied(false)}
            variant="contained"
            sx={{
              backgroundColor: "#a36920",
              "&:hover": { backgroundColor: "#8a541a" },
              px: 4,
              py: 1,
              borderRadius: 2,
            }}
          >
            Entendido
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

