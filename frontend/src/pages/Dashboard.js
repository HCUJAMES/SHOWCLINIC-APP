import React, { useState, useEffect } from "react";
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
  IconButton,
  TextField,
  InputAdornment,
  List,
  ListItem,
  ListItemText,
  CircularProgress,
  Collapse,
  Paper,
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
  Search,
  Close,
  CalendarToday,
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
  "Productos Aplicados": CalendarToday,
};

const API_BASE = process.env.REACT_APP_API_URL || `${window.location.protocol}//${window.location.hostname}:4000`;

export default function Dashboard() {
  const role = localStorage.getItem("role");
  const navigate = useNavigate();
  const [openAccessDenied, setOpenAccessDenied] = useState(false);
  const [deniedModule, setDeniedModule] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);

  // Menú según rol
  const menuItemsByRole = {
    doctor: [
      { title: "Pacientes", path: "/pacientes", description: "Gestión de fichas clínicas, historial y seguimiento personalizado", tag: "REGISTROS" },
      { title: "Tratamientos", path: "/tratamientos", description: "Procedimientos estéticos, protocolos clínicos y catálogo de servicios", tag: "CATÁLOGO" },
      { title: "Paquetes", path: "/paquetes", description: "Paquetes promocionales, combos y ofertas especiales", tag: "PROMOS" },
      { title: "Inventario", path: "/inventario", description: "Control de productos, stock disponible y alertas de reposición", tag: "STOCK" },
      { title: "Finanzas", path: "/finanzas", description: "Ingresos, egresos, reportes financieros y flujo de caja", tag: "REPORTES" },
      { title: "Especialistas", path: "/especialistas", description: "Gestión del equipo médico y asignación de especialidades", tag: "EQUIPO" },
      { title: "Gestión Clínica", path: "/gestion-clinica", description: "Gestión de atenciones diarias y control de citas", tag: "ACCEDER" },
      { title: "Estadísticas", path: "/estadisticas", description: "Métricas del negocio, reportes mensuales y análisis de rendimiento", tag: "RESUMEN" },
    ],
    admin: [
      { title: "Pacientes", path: "/pacientes", description: "Gestión de fichas clínicas, historial y seguimiento personalizado", tag: "REGISTROS" },
      { title: "Tratamientos", path: "/tratamientos", description: "Procedimientos estéticos, protocolos clínicos y catálogo de servicios", tag: "CATÁLOGO" },
      { title: "Paquetes", path: "/paquetes", description: "Paquetes promocionales, combos y ofertas especiales", tag: "PROMOS" },
      { title: "Inventario", path: "/inventario", description: "Control de productos, stock disponible y alertas de reposición", tag: "STOCK" },
      { title: "Finanzas", path: "/finanzas", description: "Ingresos, egresos, reportes financieros y flujo de caja", tag: "REPORTES" },
      { title: "Estadísticas", path: "/estadisticas", description: "Métricas del negocio, reportes mensuales y análisis de rendimiento", tag: "RESUMEN" },
    ],
    logistica: [
      { title: "Pacientes", path: "/pacientes", description: "Gestión de fichas clínicas, historial y seguimiento personalizado", tag: "REGISTROS" },
      { title: "Tratamientos", path: "/tratamientos", description: "Procedimientos estéticos, protocolos clínicos y catálogo de servicios", tag: "CATÁLOGO" },
      { title: "Paquetes", path: "/paquetes", description: "Paquetes promocionales, combos y ofertas especiales", tag: "PROMOS" },
      { title: "Inventario", path: "/inventario", description: "Control de productos, stock disponible y alertas de reposición", tag: "STOCK" },
      { title: "Finanzas", path: "/finanzas", description: "Ingresos, egresos, reportes financieros y flujo de caja", tag: "REPORTES" },
    ],
    asistente: [
      { title: "Pacientes", path: "/pacientes", description: "Gestión de fichas clínicas, historial y seguimiento personalizado", tag: "REGISTROS" },
      { title: "Tratamientos", path: "/tratamientos", description: "Procedimientos estéticos, protocolos clínicos y catálogo de servicios", tag: "CATÁLOGO" },
      { title: "Paquetes", path: "/paquetes", description: "Paquetes promocionales, combos y ofertas especiales", tag: "PROMOS" },
      { title: "Inventario", path: "/inventario", description: "Control de productos, stock disponible y alertas de reposición", tag: "STOCK" },
      { title: "Finanzas", path: "/finanzas", description: "Ingresos, egresos, reportes financieros y flujo de caja", tag: "REPORTES" },
    ],
    master: [
      { title: "Pacientes", path: "/pacientes", description: "Gestión de fichas clínicas, historial y seguimiento personalizado", tag: "REGISTROS" },
      { title: "Tratamientos", path: "/tratamientos", description: "Procedimientos estéticos, protocolos clínicos y catálogo de servicios", tag: "CATÁLOGO" },
      { title: "Paquetes", path: "/paquetes", description: "Paquetes promocionales, combos y ofertas especiales", tag: "PROMOS" },
      { title: "Inventario", path: "/inventario", description: "Control de productos, stock disponible y alertas de reposición", tag: "STOCK" },
      { title: "Finanzas", path: "/finanzas", description: "Ingresos, egresos, reportes financieros y flujo de caja", tag: "REPORTES" },
      { title: "Especialistas", path: "/especialistas", description: "Gestión del equipo médico y asignación de especialidades", tag: "EQUIPO" },
      { title: "Gestión Clínica", path: "/gestion-clinica", description: "Gestión de atenciones diarias y control de citas", tag: "ACCEDER" },
      { title: "Productos Aplicados", path: "/productos-aplicados", description: "Reporte de productos usados en tratamientos", tag: "REPORTE" },
      { title: "Estadísticas", path: "/estadisticas", description: "Métricas del negocio, reportes mensuales y análisis de rendimiento", tag: "RESUMEN" },
      { title: "Gestionar", path: "/gestion", description: "Administración del sistema, usuarios y configuración general", tag: "ADMIN" },
    ],
    doctora: [
      { title: "Pacientes", path: "/pacientes", description: "Gestión de fichas clínicas, historial y seguimiento personalizado", tag: "REGISTROS", hasAccess: true },
      { title: "Tratamientos", path: "/tratamientos", description: "Procedimientos estéticos, protocolos clínicos y catálogo de servicios", tag: "CATÁLOGO", hasAccess: true },
      { title: "Paquetes", path: "/paquetes", description: "Paquetes promocionales, combos y ofertas especiales", tag: "PROMOS", hasAccess: false },
      { title: "Inventario", path: "/inventario", description: "Control de productos, stock disponible y alertas de reposición", tag: "STOCK", hasAccess: false },
      { title: "Finanzas", path: "/finanzas", description: "Ingresos, egresos, reportes financieros y flujo de caja", tag: "S/ 18.4K", hasAccess: false },
      { title: "Especialistas", path: "/especialistas", description: "Gestión del equipo médico y asignación de especialidades", tag: "EQUIPO", hasAccess: false },
      { title: "Estadísticas", path: "/estadisticas", description: "Métricas del negocio, reportes mensuales y análisis de rendimiento", tag: "RESUMEN", hasAccess: false },
    ],
  };

  const menuItems = menuItemsByRole[role] || [];

  const username = localStorage.getItem("username") || role;
  const hora = new Date().getHours();
  const saludo = hora < 12 ? "Buenos días" : hora < 18 ? "Buenas tardes" : "Buenas noches";

  useEffect(() => {
    if (searchQuery.trim().length >= 2) {
      const timer = setTimeout(() => {
        buscarPacientes(searchQuery);
      }, 300);
      return () => clearTimeout(timer);
    } else {
      setSearchResults([]);
    }
  }, [searchQuery]);

  const buscarPacientes = async (query) => {
    setSearching(true);
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_BASE}/api/pacientes/listar`, {
        headers: { 
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
      });
      if (response.ok) {
        const data = await response.json();
        
        const filtered = (Array.isArray(data) ? data : []).filter(p => {
          const nombre = (p.nombre || "").toLowerCase();
          const apellido = (p.apellido || "").toLowerCase();
          const nombreCompleto = `${nombre} ${apellido}`.trim();
          const dni = (p.dni || "").toString();
          const queryLower = query.toLowerCase();
          
          return nombre.includes(queryLower) || 
                 apellido.includes(queryLower) || 
                 nombreCompleto.includes(queryLower) ||
                 dni.includes(query);
        }).slice(0, 5);
        
        setSearchResults(filtered);
      }
    } catch (error) {
      console.error("Error buscando pacientes:", error);
    } finally {
      setSearching(false);
    }
  };

  const handleSelectPaciente = (paciente) => {
    navigate("/historial-clinico", { state: { pacienteId: paciente.id } });
    setSearchOpen(false);
    setSearchQuery("");
    setSearchResults([]);
  };

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

      {/* Lupa flotante de búsqueda rápida */}
      <Box
        sx={{
          position: "fixed",
          top: 20,
          left: 20,
          zIndex: 1000,
          display: "flex",
          alignItems: "center",
          gap: 1,
        }}
      >
        <IconButton
          onClick={() => {
            setSearchOpen(!searchOpen);
            if (searchOpen) {
              setSearchQuery("");
              setSearchResults([]);
            }
          }}
          sx={{
            width: 44,
            height: 44,
            background: searchOpen
              ? "rgba(211,47,47,0.75)"
              : "rgba(163,105,32,0.65)",
            backdropFilter: "blur(8px)",
            boxShadow: "0 4px 16px rgba(163,105,32,0.2)",
            transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
            "&:hover": {
              transform: "scale(1.1)",
              background: searchOpen
                ? "rgba(211,47,47,0.85)"
                : "rgba(163,105,32,0.85)",
              boxShadow: "0 6px 20px rgba(163,105,32,0.3)",
            },
          }}
        >
          {searchOpen ? (
            <Close sx={{ fontSize: 22, color: "white" }} />
          ) : (
            <Search sx={{ fontSize: 22, color: "white" }} />
          )}
        </IconButton>

        <Collapse in={searchOpen} orientation="horizontal" timeout={300}>
          <Paper
            elevation={8}
            sx={{
              display: "flex",
              alignItems: "center",
              borderRadius: 50,
              overflow: "hidden",
              backgroundColor: "rgba(255,255,255,0.95)",
              backdropFilter: "blur(10px)",
              border: "1px solid rgba(163,105,32,0.2)",
              boxShadow: "0 6px 24px rgba(163,105,32,0.2)",
            }}
          >
            <TextField
              autoFocus
              placeholder="Buscar paciente..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              size="small"
              sx={{
                width: 260,
                "& .MuiOutlinedInput-root": {
                  borderRadius: 50,
                  "& fieldset": { border: "none" },
                  pl: 2.5,
                  pr: 1,
                },
                "& input": {
                  fontSize: "0.85rem",
                  color: "#2E2E2E",
                  "&::placeholder": { color: "#999", opacity: 1 },
                },
              }}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    {searching && <CircularProgress size={16} sx={{ color: "#a36920" }} />}
                  </InputAdornment>
                ),
              }}
            />
          </Paper>
        </Collapse>
      </Box>

      {/* Resultados de búsqueda */}
      {searchOpen && searchResults.length > 0 && (
        <Paper
          elevation={12}
          sx={{
            position: "fixed",
            top: 76,
            left: 20,
            width: 320,
            maxHeight: 380,
            overflowY: "auto",
            zIndex: 999,
            borderRadius: 3,
            backgroundColor: "rgba(255,255,255,0.96)",
            backdropFilter: "blur(10px)",
            border: "1px solid rgba(163,105,32,0.15)",
            boxShadow: "0 10px 40px rgba(163,105,32,0.18)",
          }}
        >
          <List sx={{ p: 0 }}>
            {searchResults.map((paciente, idx) => (
              <ListItem
                key={paciente.id}
                button
                onClick={() => handleSelectPaciente(paciente)}
                sx={{
                  borderBottom: idx < searchResults.length - 1 ? "1px solid rgba(163,105,32,0.08)" : "none",
                  py: 1.8,
                  px: 2.5,
                  transition: "all 0.2s ease",
                  "&:hover": {
                    backgroundColor: "rgba(163,105,32,0.06)",
                    pl: 3,
                  },
                }}
              >
                <Box
                  sx={{
                    width: 38,
                    height: 38,
                    borderRadius: "50%",
                    background: "linear-gradient(135deg, rgba(163,105,32,0.1) 0%, rgba(212,175,55,0.2) 100%)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    mr: 2,
                  }}
                >
                  <People sx={{ fontSize: 18, color: "#a36920" }} />
                </Box>
                <ListItemText
                  primary={
                    <Typography sx={{ fontSize: "0.9rem", fontWeight: 600, color: "#2E2E2E" }}>
                      {paciente.nombre} {paciente.apellido}
                    </Typography>
                  }
                  secondary={
                    <Typography sx={{ fontSize: "0.75rem", color: "#999" }}>
                      DNI: {paciente.dni || "Sin DNI"}
                    </Typography>
                  }
                />
              </ListItem>
            ))}
          </List>
        </Paper>
      )}

      {searchOpen && searchQuery.trim().length >= 2 && searchResults.length === 0 && !searching && (
        <Paper
          elevation={12}
          sx={{
            position: "fixed",
            top: 76,
            left: 20,
            width: 320,
            zIndex: 999,
            borderRadius: 3,
            backgroundColor: "rgba(255,255,255,0.96)",
            backdropFilter: "blur(10px)",
            border: "1px solid rgba(163,105,32,0.15)",
            boxShadow: "0 10px 40px rgba(163,105,32,0.18)",
            p: 3,
            textAlign: "center",
          }}
        >
          <Typography sx={{ fontSize: "0.85rem", color: "#999" }}>
            No se encontraron pacientes
          </Typography>
        </Paper>
      )}

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
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", md: "1fr 1fr 1fr" },
                gap: 2,
                maxWidth: 850,
                mx: "auto",
                px: 2,
              }}
            >
              {menuItems.map((item, index) => {
                const IconComponent = moduleIcons[item.title];
                const isLocked = item.hasAccess === false;
                return (
                  <Grow in timeout={300 + index * 100} key={index}>
                    <Card
                      onClick={() => {
                        if (isLocked) {
                          setDeniedModule(item.title);
                          setOpenAccessDenied(true);
                        } else {
                          navigate(item.path);
                        }
                      }}
                      sx={{
                        cursor: "pointer",
                        borderRadius: 3,
                        backgroundColor: isLocked ? "rgba(250,248,245,0.5)" : "#fffdf7",
                        border: isLocked ? "1px solid #e8e8e8" : "1px solid rgba(186,154,99,0.15)",
                        boxShadow: "0 2px 12px rgba(0,0,0,0.04)",
                        opacity: isLocked ? 0.6 : 1,
                        transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                        "&:hover": isLocked ? {} : {
                          transform: "translateY(-4px)",
                          boxShadow: "0 8px 24px rgba(163,105,32,0.12)",
                          border: "1px solid rgba(163,105,32,0.3)",
                        },
                        p: 2,
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "space-between",
                        minHeight: 145,
                      }}
                    >
                      {/* Icono */}
                      <Box
                        sx={{
                          width: 38,
                          height: 38,
                          borderRadius: 2,
                          background: "linear-gradient(135deg, rgba(163,105,32,0.08) 0%, rgba(212,175,55,0.12) 100%)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          mb: 1.5,
                          position: "relative",
                        }}
                      >
                        {IconComponent && (
                          <IconComponent sx={{ fontSize: 20, color: "#a36920" }} />
                        )}
                        {isLocked && (
                          <Box
                            sx={{
                              position: "absolute",
                              top: -6,
                              right: -6,
                              backgroundColor: "#d32f2f",
                              borderRadius: "50%",
                              width: 18,
                              height: 18,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              border: "2px solid white",
                            }}
                          >
                            <Lock sx={{ fontSize: 10, color: "white" }} />
                          </Box>
                        )}
                      </Box>

                      {/* Titulo */}
                      <Typography sx={{ fontWeight: 700, color: "#2e2e2e", fontSize: "0.88rem", lineHeight: 1.3, mb: 0.5 }}>
                        {item.title}
                      </Typography>

                      {/* Descripcion */}
                      <Typography sx={{ color: "#999", fontSize: "0.72rem", lineHeight: 1.5, flex: 1 }}>
                        {item.description}
                      </Typography>

                      {/* Tag */}
                      <Box
                        sx={{
                          display: "inline-flex",
                          alignSelf: "flex-start",
                          mt: 1.2,
                          px: 1,
                          py: 0.35,
                          borderRadius: 1.5,
                          border: "1px solid rgba(186,154,99,0.25)",
                          backgroundColor: "rgba(163,105,32,0.04)",
                        }}
                      >
                        <Typography sx={{ color: "#ba9a63", fontSize: "0.6rem", fontWeight: 600, letterSpacing: "0.5px", textTransform: "uppercase" }}>
                          {isLocked ? "BLOQUEADO" : item.tag}
                        </Typography>
                      </Box>
                    </Card>
                  </Grow>
                );
              })}
            </Box>

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

