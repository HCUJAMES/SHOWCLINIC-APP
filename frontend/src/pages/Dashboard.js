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
      { title: "Especialistas", image: "/images/especialista.png", path: "/especialistas", description: "Equipo médico" },
      { title: "Gestión Clínica", image: "/images/finanzas.jpeg", path: "/gestion-clinica", description: "Gestión de atenciones" },
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

  const username = localStorage.getItem("username") || role;
  const hora = new Date().getHours();
  const saludo = hora < 12 ? "Buenos días" : hora < 18 ? "Buenas tardes" : "Buenas noches";

  return (
    <Box
      sx={{
        minHeight: "100vh",
        background: "linear-gradient(160deg, #faf8f5 0%, #f0ebe0 40%, #e8dfd0 100%)",
        position: "relative",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Decorative top bar */}
      <Box sx={{ height: 4, background: "linear-gradient(90deg, #a36920 0%, #d4af37 50%, #a36920 100%)" }} />

      {/* Decorative model images */}
      <Box
        component="img"
        src="/images/modeloladoizquierdo.jpg"
        alt=""
        sx={{
          position: "fixed",
          left: 0,
          top: 0,
          height: "100vh",
          width: "50vw",
          opacity: 0.35,
          pointerEvents: "none",
          zIndex: 0,
          objectFit: "cover",
          objectPosition: "center top",
          filter: "grayscale(20%)",
          maskImage: "linear-gradient(to right, rgba(0,0,0,1) 60%, rgba(0,0,0,0))",
          WebkitMaskImage: "linear-gradient(to right, rgba(0,0,0,1) 60%, rgba(0,0,0,0))",
        }}
      />
      <Box
        component="img"
        src="/images/modelomodulosderecha.jpg"
        alt=""
        sx={{
          position: "fixed",
          right: 0,
          top: "-10%",
          height: "110vh",
          width: "50vw",
          opacity: 0.35,
          pointerEvents: "none",
          zIndex: 0,
          objectFit: "cover",
          objectPosition: "center top",
          filter: "grayscale(20%)",
          maskImage: "linear-gradient(to left, rgba(0,0,0,1) 60%, rgba(0,0,0,0))",
          WebkitMaskImage: "linear-gradient(to left, rgba(0,0,0,1) 60%, rgba(0,0,0,0))",
        }}
      />

      {/* Main Content */}
      <Box
        sx={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          py: { xs: 3, sm: 5 },
          px: 2,
          position: "relative",
          zIndex: 1,
        }}
      >
        <Fade in timeout={500}>
          <Box sx={{ width: "100%", maxWidth: 1200 }}>

            {/* Header */}
            <Box sx={{ textAlign: "center", mb: { xs: 3, sm: 4 } }}>
              <Box
                component="img"
                src="/logo-showclinic.png"
                alt="ShowClinic"
                sx={{
                  width: 80,
                  height: 80,
                  objectFit: "cover",
                  borderRadius: "50%",
                  border: "3px solid rgba(163,105,32,0.25)",
                  boxShadow: "0 8px 28px rgba(163,105,32,0.18)",
                  mb: 2,
                }}
              />
              <Typography
                variant="h3"
                sx={{
                  fontFamily: "'Playfair Display', serif",
                  fontWeight: 700,
                  color: "#a36920",
                  letterSpacing: 4,
                  fontSize: { xs: "1.8rem", sm: "2.4rem", md: "2.8rem" },
                }}
              >
                SHOWCLINIC
              </Typography>
              <Typography
                sx={{ color: "#ba9a63", letterSpacing: 2.5, fontWeight: 500, fontSize: { xs: "0.7rem", sm: "0.85rem" }, mt: 0.5 }}
              >
                ESTÉTICA AVANZADA & BIENESTAR
              </Typography>
              <Box sx={{ mt: 2.5, display: "inline-flex", alignItems: "center", gap: 1, px: 3, py: 1, borderRadius: 50, backgroundColor: "rgba(163,105,32,0.06)", border: "1px solid rgba(186,154,99,0.15)" }}>
                <Box sx={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: "#4CAF50", boxShadow: "0 0 8px rgba(76,175,80,0.5)" }} />
                <Typography
                  variant="body1"
                  sx={{ color: "#6B6B6B", fontWeight: 400, fontSize: { xs: "0.9rem", sm: "1rem" } }}
                >
                  {saludo}, <strong style={{ color: "#a36920" }}>{username}</strong>
                </Typography>
              </Box>
            </Box>

            {/* Grid de módulos */}
            <Grid container spacing={3} justifyContent="center">
              {menuItems.map((item, index) => {
                const IconComponent = moduleIcons[item.title];
                const isLocked = item.hasAccess === false;
                return (
                  <Grow in timeout={300 + index * 100} key={index}>
                    <Grid item xs={6} sm={4} md={4}>
                      <Card
                        sx={{
                          height: "100%",
                          borderRadius: 4,
                          position: "relative",
                          overflow: "hidden",
                          backgroundColor: isLocked ? "rgba(240,238,234,0.6)" : "#fffdf7",
                          border: isLocked ? "1px solid #e0dcd5" : "1px solid rgba(186,154,99,0.18)",
                          boxShadow: "0 4px 20px rgba(0,0,0,0.05)",
                          opacity: isLocked ? 0.55 : 1,
                          transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                          "&:hover": isLocked ? {} : {
                            transform: "translateY(-8px)",
                            boxShadow: "0 16px 48px rgba(163,105,32,0.2)",
                            border: "1px solid rgba(163,105,32,0.4)",
                            "& .mod-icon-wrap": {
                              background: "linear-gradient(135deg, #a36920 0%, #d4af37 100%)",
                              boxShadow: "0 6px 16px rgba(163,105,32,0.3)",
                            },
                            "& .mod-icon-wrap svg": {
                              color: "white",
                            },
                            "& .mod-title": {
                              color: "#a36920",
                            },
                          },
                        }}
                      >
                        <CardActionArea
                          onClick={() => {
                            if (isLocked) {
                              setDeniedModule(item.title);
                              setOpenAccessDenied(true);
                            } else {
                              navigate(item.path);
                            }
                          }}
                          sx={{
                            height: "100%",
                            textAlign: "center",
                            py: { xs: 3.5, sm: 4.5 },
                            px: 2.5,
                            minHeight: { xs: 180, sm: 220 },
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 1.5,
                          }}
                        >
                          <Box
                            className="mod-icon-wrap"
                            sx={{
                              width: 80,
                              height: 80,
                              borderRadius: "50%",
                              background: "linear-gradient(135deg, rgba(163,105,32,0.07) 0%, rgba(212,175,55,0.14) 100%)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              transition: "all 0.3s ease",
                              position: "relative",
                            }}
                          >
                            {IconComponent && (
                              <IconComponent
                                sx={{
                                  fontSize: 38,
                                  color: "#a36920",
                                  transition: "color 0.3s ease",
                                }}
                              />
                            )}
                            {isLocked && (
                              <Box
                                sx={{
                                  position: "absolute",
                                  top: -6,
                                  right: -6,
                                  backgroundColor: "#b71c1c",
                                  borderRadius: "50%",
                                  width: 26,
                                  height: 26,
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  border: "2px solid white",
                                }}
                              >
                                <Lock sx={{ fontSize: 14, color: "white" }} />
                              </Box>
                            )}
                          </Box>

                          <CardContent sx={{ p: "0 !important" }}>
                            <Typography
                              className="mod-title"
                              sx={{
                                fontFamily: "'Playfair Display', serif",
                                fontWeight: 700,
                                color: "#2e2e2e",
                                fontSize: { xs: "0.95rem", sm: "1.1rem" },
                                lineHeight: 1.3,
                                letterSpacing: 4,
                                transition: "color 0.3s ease",
                                mb: 0.5,
                                textTransform: "uppercase",
                              }}
                            >
                              {item.title}
                            </Typography>
                            <Typography
                              variant="caption"
                              sx={{
                                color: "#9a9a9a",
                                fontSize: "0.8rem",
                                display: "block",
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

            {/* Session info */}
            <Fade in timeout={800}>
              <Box sx={{ mt: 5, textAlign: "center" }}>
                <Typography variant="caption" sx={{ color: "#bbb", fontWeight: 400, fontSize: "0.75rem" }}>
                  Panel de administración • Sesión activa
                </Typography>
              </Box>
            </Fade>
          </Box>
        </Fade>
      </Box>

      {/* Footer */}
      <Box
        component="footer"
        sx={{
          py: 2,
          px: 3,
          borderTop: "1px solid rgba(186,154,99,0.15)",
          backgroundColor: "rgba(255,253,247,0.8)",
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
            gap: 1,
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Box
              component="img"
              src="/logo-showclinic.png"
              alt="ShowClinic"
              sx={{ width: 24, height: 24, borderRadius: "50%", opacity: 0.7 }}
            />
            <Typography variant="caption" sx={{ color: "#ba9a63", fontWeight: 600, letterSpacing: 0.5, fontSize: "0.72rem" }}>
              ShowClinic
            </Typography>
          </Box>
          <Typography variant="caption" sx={{ color: "#c4b89a", fontSize: "0.7rem" }}>
            Estética Avanzada & Bienestar • Arequipa, Perú
          </Typography>
          <Typography variant="caption" sx={{ color: "#d0c8b8", fontSize: "0.68rem" }}>
            © {new Date().getFullYear()} Todos los derechos reservados
          </Typography>
        </Box>
      </Box>

      {/* Modal de Acceso Denegado */}
      <Dialog 
        open={openAccessDenied} 
        onClose={() => setOpenAccessDenied(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3, overflow: "hidden" } }}
      >
        <DialogTitle sx={{ background: "linear-gradient(135deg, #b71c1c 0%, #d32f2f 100%)", color: "white", textAlign: "center", py: 2 }}>
          Acceso Restringido
        </DialogTitle>
        <DialogContent sx={{ mt: 3, textAlign: "center", pb: 1 }}>
          <Lock sx={{ fontSize: 48, color: "#d32f2f", mb: 1, opacity: 0.6 }} />
          <Typography variant="h6" sx={{ mb: 1, color: "#333", fontWeight: 700 }}>
            {deniedModule}
          </Typography>
          <Typography variant="body2" sx={{ color: "#888" }}>
            No tienes permisos para acceder a este módulo. Contacta al administrador.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2.5, justifyContent: "center" }}>
          <Button 
            onClick={() => setOpenAccessDenied(false)}
            variant="contained"
            sx={{
              backgroundColor: "#a36920",
              "&:hover": { backgroundColor: "#8a5a1a" },
              px: 5,
              py: 1,
              borderRadius: 2,
              fontWeight: 600,
              textTransform: "none",
              fontSize: "0.9rem",
            }}
          >
            Entendido
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

