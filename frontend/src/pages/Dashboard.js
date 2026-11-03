import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Typography,
  Box,
  Dialog,
  DialogContent,
  DialogActions,
  Button,
  IconButton,
  TextField,
  InputAdornment,
  List,
  ListItemButton,
  ListItemText,
  CircularProgress,
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
  SupervisorAccount,
  QrCodeScanner,
  ScienceRounded,
  Crown,
  VideoLibrary,
  LogoutRounded,
  ChevronRight,
} from "../iconos";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import PanelRecordatorios from "../components/PanelRecordatorios";
import { BRAND, FONTS, LOGOS } from "../brand";

const MotionBox = motion(Box);

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
  "Productos Aplicados": ScienceRounded,
  "Usuarios": SupervisorAccount,
  "Códigos de Barras": QrCodeScanner,
  "Gestión CEO": Crown,
  "Antes y Después": VideoLibrary,
};

/**
 * Agrupación de los módulos para que el menú se lea por áreas de trabajo en
 * vez de como una lista plana. Solo cambia el ORDEN y el encabezado de cada
 * bloque; el título, la descripción y la etiqueta de cada módulo son los
 * mismos de siempre. Un módulo que no esté aquí cae en "Otros".
 */
const GRUPOS = [
  { id: "atencion", label: "Atención", titulos: ["Pacientes", "Tratamientos", "Paquetes", "Gestión Clínica", "Antes y Después"] },
  { id: "operacion", label: "Operación", titulos: ["Inventario", "Códigos de Barras", "Productos Aplicados", "Especialistas"] },
  { id: "direccion", label: "Dirección", titulos: ["Finanzas", "Gestión CEO", "Estadísticas"] },
  { id: "sistema", label: "Sistema", titulos: ["Gestionar", "Usuarios"] },
];

// Módulo de videos antes/después: visible y con todos los permisos para
// cualquier rol.
const MODULO_VIDEOS = {
  title: "Antes y Después",
  path: "/antes-despues",
  description: "Videos de antes y después de cada tratamiento realizado",
  tag: "VIDEOS",
  hasAccess: true,
};

// Con pocos módulos no vale la pena partir en secciones: se muestran juntos.
const MINIMO_PARA_AGRUPAR = 7;

const ORO = BRAND.oro;

const API_BASE = process.env.REACT_APP_API_URL || `${window.location.protocol}//${window.location.hostname}:4000`;

/* --animaciones-- */

const suave = [0.22, 1, 0.36, 1];

const subir = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: suave } },
};

export default function Dashboard() {
  const role = localStorage.getItem("role");
  const navigate = useNavigate();
  const [openAccessDenied, setOpenAccessDenied] = useState(false);
  const [deniedModule, setDeniedModule] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const fechaHoy = useMemo(
    () => new Date().toLocaleDateString("es-PE", { weekday: "long", day: "numeric", month: "long" }),
    []
  );

  // Menú según rol
  const menuItemsByRole = {
    doctor: [
      { title: "Pacientes", path: "/pacientes", description: "Gestión de fichas clínicas, historial y seguimiento personalizado", tag: "REGISTROS" },
      { title: "Tratamientos", path: "/tratamientos", description: "Procedimientos estéticos, protocolos clínicos y catálogo de servicios", tag: "CATÁLOGO" },
      { title: "Paquetes", path: "/paquetes", description: "Paquetes promocionales, combos y ofertas especiales", tag: "PROMOS" },
      { title: "Inventario", path: "/inventario", description: "Control de productos, stock disponible y alertas de reposición", tag: "STOCK" },
      { title: "Códigos de Barras", path: "/codigos-barras", description: "Generación e impresión de códigos de barras para lotes de inventario", tag: "STICKERS" },
      { title: "Finanzas", path: "/finanzas", description: "Ingresos, egresos, reportes financieros y flujo de caja", tag: "REPORTES" },
      { title: "Especialistas", path: "/especialistas", description: "Gestión del equipo médico y asignación de especialidades", tag: "EQUIPO" },
      { title: "Gestión Clínica", path: "/gestion-clinica", description: "Gestión de atenciones diarias y control de citas", tag: "ACCEDER" },
      { title: "Gestión CEO", path: "/gestion-dueno", description: "Panel del CEO: presupuestos, comisiones, liquidaciones, control y rendimiento", tag: "CEO" },
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
      { title: "Códigos de Barras", path: "/codigos-barras", description: "Generación e impresión de códigos de barras para lotes de inventario", tag: "STICKERS" },
      { title: "Finanzas", path: "/finanzas", description: "Ingresos, egresos, reportes financieros y flujo de caja", tag: "REPORTES" },
      { title: "Especialistas", path: "/especialistas", description: "Gestión del equipo médico y asignación de especialidades", tag: "EQUIPO" },
      { title: "Gestión Clínica", path: "/gestion-clinica", description: "Gestión de atenciones diarias y control de citas", tag: "ACCEDER" },
      { title: "Gestión CEO", path: "/gestion-dueno", description: "Panel del CEO: presupuestos, comisiones, liquidaciones, control y rendimiento", tag: "CEO" },
      { title: "Productos Aplicados", path: "/productos-aplicados", description: "Reporte de productos usados en tratamientos", tag: "REPORTE" },
      { title: "Estadísticas", path: "/estadisticas", description: "Métricas del negocio, reportes mensuales y análisis de rendimiento", tag: "RESUMEN" },
      { title: "Gestionar", path: "/gestion", description: "Administración del sistema, usuarios y configuración general", tag: "ADMIN" },
      { title: "Usuarios", path: "/gestion-usuarios", description: "Crear usuarios, asignar roles y gestionar permisos de acceso", tag: "USUARIOS" },
    ],
    doctora: [
      { title: "Pacientes", path: "/pacientes", description: "Gestión de fichas clínicas, historial y seguimiento personalizado", tag: "REGISTROS", hasAccess: true },
      { title: "Tratamientos", path: "/tratamientos", description: "Procedimientos estéticos, protocolos clínicos y catálogo de servicios", tag: "CATÁLOGO", hasAccess: true },
      { title: "Paquetes", path: "/paquetes", description: "Paquetes promocionales, combos y ofertas especiales", tag: "PROMOS", hasAccess: false },
      { title: "Inventario", path: "/inventario", description: "Control de productos, stock disponible y alertas de reposición", tag: "STOCK", hasAccess: false },
      { title: "Finanzas", path: "/finanzas", description: "Ingresos, egresos, reportes financieros y flujo de caja", tag: "REPORTES", hasAccess: false },
      { title: "Especialistas", path: "/especialistas", description: "Gestión del equipo médico y asignación de especialidades", tag: "EQUIPO", hasAccess: false },
      { title: "Estadísticas", path: "/estadisticas", description: "Métricas del negocio, reportes mensuales y análisis de rendimiento", tag: "RESUMEN", hasAccess: false },
    ],
  };

  const [permissionMenuItems, setPermissionMenuItems] = useState([]);

  // Map de module_name en user_permissions → config del módulo en el dashboard
  const moduleMap = {
    pacientes: { title: "Pacientes", path: "/pacientes", description: "Gestión de fichas clínicas, historial y seguimiento personalizado", tag: "REGISTROS" },
    tratamientos: { title: "Tratamientos", path: "/tratamientos", description: "Procedimientos estéticos, protocolos clínicos y catálogo de servicios", tag: "CATÁLOGO" },
    paquetes: { title: "Paquetes", path: "/paquetes", description: "Paquetes promocionales, combos y ofertas especiales", tag: "PROMOS" },
    inventario: { title: "Inventario", path: "/inventario", description: "Control de productos, stock disponible y alertas de reposición", tag: "STOCK" },
    finanzas: { title: "Finanzas", path: "/finanzas", description: "Ingresos, egresos, reportes financieros y flujo de caja", tag: "REPORTES" },
    especialistas: { title: "Especialistas", path: "/especialistas", description: "Gestión del equipo médico y asignación de especialidades", tag: "EQUIPO" },
    "gestion-clinica": { title: "Gestión Clínica", path: "/gestion-clinica", description: "Gestión de atenciones diarias y control de citas", tag: "ACCEDER" },
    estadisticas: { title: "Estadísticas", path: "/estadisticas", description: "Métricas del negocio, reportes mensuales y análisis de rendimiento", tag: "RESUMEN" },
  };

  // Si el rol no está en menuItemsByRole, cargar permisos del usuario
  useEffect(() => {
    if (!menuItemsByRole[role] && role !== "master") {
      const token = localStorage.getItem("token");
      if (!token) return;
      fetch(`${API_BASE}/api/admin/my-permissions`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then(res => res.json())
        .then(perms => {
          const items = (perms || []).filter(p => p.can_access).map(p => moduleMap[p.module_name]).filter(Boolean);
          setPermissionMenuItems(items);
        })
        .catch(err => console.error("Error cargando permisos:", err));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);

  // "Antes y Después" es para todos: se agrega a cualquier rol, también a los
  // usuarios cuyo menú sale de sus permisos.
  const menuItems = useMemo(() => {
    const base = menuItemsByRole[role] || permissionMenuItems;
    if (base.some((m) => m.path === MODULO_VIDEOS.path)) return base;
    return [...base, MODULO_VIDEOS];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, permissionMenuItems]);

  // Reparte los módulos del rol en sus secciones, respetando el orden de GRUPOS.
  const secciones = useMemo(() => {
    if (menuItems.length < MINIMO_PARA_AGRUPAR) {
      return [{ id: "todos", label: null, items: menuItems }];
    }
    const usados = new Set();
    const lista = GRUPOS.map((g) => {
      const items = g.titulos
        .map((t) => menuItems.find((m) => m.title === t))
        .filter(Boolean);
      items.forEach((m) => usados.add(m.title));
      return { id: g.id, label: g.label, items };
    }).filter((g) => g.items.length > 0);

    const sueltos = menuItems.filter((m) => !usados.has(m.title));
    if (sueltos.length) lista.push({ id: "otros", label: "Otros", items: sueltos });
    return lista;
  }, [menuItems]);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);

  // La lista de pacientes se guarda un minuto: así escribir en el buscador no
  // descarga todos los pacientes otra vez con cada letra.
  const pacientesCacheRef = useRef({ datos: null, hora: 0 });
  const obtenerPacientes = async () => {
    const cache = pacientesCacheRef.current;
    if (cache.datos && Date.now() - cache.hora < 60000) return cache.datos;
    const token = localStorage.getItem("token");
    const response = await fetch(`${API_BASE}/api/pacientes/listar`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
    });
    if (!response.ok) return null;
    const datos = await response.json();
    pacientesCacheRef.current = { datos, hora: Date.now() };
    return datos;
  };

  const buscarPacientes = async (query) => {
    setSearching(true);
    try {
      const data = await obtenerPacientes();
      if (data) {

        // Normalizar texto: quitar tildes, minúsculas, trim espacios múltiples
        const normalize = (str) => (str || "")
          .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
          .toLowerCase()
          .replace(/\s+/g, " ")
          .trim();

        const queryNorm = normalize(query);

        const filtered = (Array.isArray(data) ? data : []).filter(p => {
          const nombreNorm = normalize(p.nombre);
          const apellidoNorm = normalize(p.apellido);
          const nombreCompletoNorm = `${nombreNorm} ${apellidoNorm}`.trim();
          const dniNorm = (p.dni || "").toString().trim();

          return nombreNorm.includes(queryNorm) ||
                 apellidoNorm.includes(queryNorm) ||
                 nombreCompletoNorm.includes(queryNorm) ||
                 dniNorm.includes(queryNorm);
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

  const abrirModulo = (item) => {
    if (item.hasAccess === false) {
      setDeniedModule(item.title);
      setOpenAccessDenied(true);
    } else {
      navigate(item.path);
    }
  };

  const cerrarSesion = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    navigate("/", { replace: true });
  };

  const cerrarBusqueda = () => {
    setSearchOpen(false);
    setSearchQuery("");
    setSearchResults([]);
  };

  /* ─────────────────────────── una tarjeta ─────────────────────────── */
  const renderTarjeta = (item, index = 0) => {
    const IconComponent = moduleIcons[item.title];
    const isLocked = item.hasAccess === false;

    return (
      <MotionBox
        key={item.title}
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: suave, delay: 0.1 + Math.min(index, 12) * 0.04 }}
        onClick={() => abrirModulo(item)}
        role="button"
        tabIndex={0}
        aria-disabled={isLocked || undefined}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); abrirModulo(item); } }}
        sx={{
          position: "relative",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: 2,
          p: { xs: 2, sm: 2.25 },
          minHeight: { xs: 84, sm: 104 },
          borderRadius: "16px",
          backgroundColor: isLocked ? "#f1ece1" : BRAND.blanco,
          border: `1px solid ${isLocked ? "rgba(107,93,77,0.14)" : BRAND.borde}`,
          boxShadow: isLocked ? "none" : "0 1px 2px rgba(92,60,18,0.04)",
          opacity: isLocked ? 0.75 : 1,
          transition: "border-color .2s ease, box-shadow .2s ease, transform .2s ease",
          outline: "none",
          "&:hover": isLocked ? {} : {
            borderColor: BRAND.arena,
            boxShadow: "0 12px 28px -18px rgba(92,60,18,0.45)",
            transform: "translateY(-2px)",
          },
          "&:hover .flecha": isLocked ? {} : { opacity: 1, transform: "translateX(0)" },
          "&:hover .icono": isLocked ? {} : { backgroundColor: BRAND.oro, color: BRAND.crema },
          "&:focus-visible": { boxShadow: `0 0 0 3px rgba(163,105,32,0.35)` },
        }}
      >
        {/* Icono en círculo, como el isotipo */}
        <Box
          className="icono"
          sx={{
            width: { xs: 46, sm: 52 },
            height: { xs: 46, sm: 52 },
            flexShrink: 0,
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
            backgroundColor: isLocked ? "#e4ddcf" : BRAND.crema,
            color: isLocked ? BRAND.textoTenue : BRAND.oro,
            border: `1px solid ${isLocked ? "transparent" : "rgba(186,154,99,0.45)"}`,
            transition: "background-color .2s ease, color .2s ease",
          }}
        >
          {IconComponent && <IconComponent sx={{ fontSize: { xs: 22, sm: 25 } }} />}
          {isLocked && (
            <Box
              sx={{
                position: "absolute", bottom: -2, right: -2,
                width: 20, height: 20, borderRadius: "50%",
                backgroundColor: BRAND.textoSuave, border: "2px solid #fff",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >
              <Lock sx={{ fontSize: 11, color: "white" }} />
            </Box>
          )}
        </Box>

        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            component="div"
            sx={{
              fontFamily: FONTS.titulo,
              fontSize: { xs: "0.98rem", sm: "1rem" },
              letterSpacing: "0.04em",
              color: isLocked ? BRAND.textoTenue : BRAND.texto,
              lineHeight: 1.25,
            }}
          >
            {item.title}
          </Typography>
          <Typography
            component="div"
            sx={{
              mt: 0.5,
              fontSize: "0.76rem",
              lineHeight: 1.45,
              color: BRAND.textoSuave,
              display: { xs: "none", sm: "-webkit-box" },
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {isLocked ? "Sin acceso para tu usuario" : item.description}
          </Typography>
        </Box>

        <ChevronRight
          className="flecha"
          sx={{
            color: BRAND.arena,
            flexShrink: 0,
            opacity: { xs: 1, sm: 0 },
            transform: { xs: "none", sm: "translateX(-4px)" },
            transition: "opacity .2s ease, transform .2s ease",
          }}
        />
      </MotionBox>
    );
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        backgroundColor: BRAND.cremaClara,
        position: "relative",
        display: "flex",
        flexDirection: "column",
        overflowX: "hidden",
      }}
    >
      {/* Isotipo de fondo, muy tenue, como en las piezas del manual */}
      <Box
        aria-hidden
        component="img"
        src={LOGOS.isotipoLinea}
        alt=""
        sx={{
          position: "fixed",
          right: { xs: "-45vw", md: "-12vw" },
          bottom: { xs: "-10vh", md: "-22vh" },
          width: { xs: "110vw", md: "62vw" },
          maxWidth: 900,
          opacity: 0.07,
          pointerEvents: "none",
          zIndex: 0,
        }}
      />

      {/* ───── Barra superior ───── */}
      <Box
        component="header"
        sx={{
          position: "sticky",
          top: 0,
          zIndex: 1100,
          height: 72,
          display: "flex",
          alignItems: "center",
          gap: { xs: 1, sm: 2 },
          pl: { xs: 2, sm: 3 },
          // Reserva el sitio de la campana de avisos, que es fija
          pr: { xs: 8, sm: 10 },
          backgroundColor: "rgba(250,248,241,0.88)",
          backdropFilter: "blur(12px)",
          borderBottom: `1px solid ${BRAND.borde}`,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, flexShrink: 0 }}>
          <Box component="img" src={LOGOS.isotipo} alt="" sx={{ width: { xs: 32, sm: 38 }, height: { xs: 32, sm: 38 } }} />
          <Typography
            sx={{
              fontFamily: FONTS.titulo,
              fontSize: { xs: "0.95rem", sm: "1.2rem" },
              letterSpacing: { xs: "0.1em", sm: "0.14em" },
              color: BRAND.oro,
              display: { xs: searchOpen ? "none" : "block", sm: "block" },
            }}
          >
            SHOWCLINIC
          </Typography>
        </Box>

        {/* Búsqueda rápida de pacientes */}
        <Box sx={{ flex: 1, display: "flex", justifyContent: "center", minWidth: 0 }}>
          <Box sx={{ position: "relative", width: "100%", maxWidth: 440, display: { xs: searchOpen ? "block" : "none", sm: "block" } }}>
            <TextField
              fullWidth
              size="small"
              placeholder="Buscar paciente por nombre o DNI"
              value={searchQuery}
              onFocus={() => setSearchOpen(true)}
              onChange={(e) => { setSearchQuery(e.target.value); setSearchOpen(true); }}
              onKeyDown={(e) => { if (e.key === "Escape") cerrarBusqueda(); }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search sx={{ color: BRAND.arena, fontSize: 20 }} />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    {searching ? (
                      <CircularProgress size={16} sx={{ color: ORO }} />
                    ) : searchQuery ? (
                      <IconButton size="small" aria-label="Limpiar búsqueda" onClick={cerrarBusqueda}>
                        <Close sx={{ fontSize: 18 }} />
                      </IconButton>
                    ) : null}
                  </InputAdornment>
                ),
              }}
              sx={{
                "& .MuiOutlinedInput-root": { borderRadius: "999px", backgroundColor: BRAND.blanco },
                "& input": { fontSize: "0.85rem" },
              }}
            />

            <AnimatePresence>
              {searchOpen && searchQuery.trim().length >= 2 && !searching && (
                <MotionBox
                  key="resultados"
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.18 }}
                  sx={{
                    position: "absolute",
                    top: "calc(100% + 8px)",
                    left: 0,
                    right: 0,
                    maxHeight: 380,
                    overflowY: "auto",
                    borderRadius: "16px",
                    backgroundColor: BRAND.blanco,
                    border: `1px solid ${BRAND.borde}`,
                    boxShadow: "0 18px 40px -16px rgba(92,60,18,0.35)",
                  }}
                >
                  {searchResults.length === 0 ? (
                    <Typography sx={{ p: 3, textAlign: "center", fontSize: "0.85rem", color: BRAND.textoSuave }}>
                      No se encontraron pacientes
                    </Typography>
                  ) : (
                    <List sx={{ p: 0.75 }}>
                      {searchResults.map((paciente) => (
                        <ListItemButton
                          key={paciente.id}
                          onClick={() => handleSelectPaciente(paciente)}
                          sx={{ borderRadius: "12px", py: 1.1, px: 1.5, "&:hover": { backgroundColor: "rgba(163,105,32,0.06)" } }}
                        >
                          <Box
                            sx={{
                              width: 36, height: 36, borderRadius: "50%", mr: 1.5, flexShrink: 0,
                              backgroundColor: BRAND.crema, color: ORO,
                              display: "flex", alignItems: "center", justifyContent: "center",
                              fontSize: "0.8rem", fontWeight: 600,
                            }}
                          >
                            {`${(paciente.nombre || "?")[0]}${(paciente.apellido || "")[0] || ""}`.toUpperCase()}
                          </Box>
                          <ListItemText
                            primary={`${paciente.nombre} ${paciente.apellido}`}
                            secondary={`DNI: ${paciente.dni || "Sin DNI"}`}
                            primaryTypographyProps={{ fontSize: "0.88rem", fontWeight: 600, color: BRAND.texto }}
                            secondaryTypographyProps={{ fontSize: "0.74rem", color: BRAND.textoTenue }}
                          />
                        </ListItemButton>
                      ))}
                    </List>
                  )}
                </MotionBox>
              )}
            </AnimatePresence>
          </Box>
        </Box>

        {/* En móvil la búsqueda se abre con la lupa */}
        <IconButton
          aria-label={searchOpen ? "Cerrar búsqueda" : "Buscar paciente"}
          onClick={() => (searchOpen ? cerrarBusqueda() : setSearchOpen(true))}
          sx={{ display: { xs: "inline-flex", sm: "none" }, color: ORO }}
        >
          {searchOpen ? <Close /> : <Search />}
        </IconButton>

        <Button
          variant="outlined"
          size="small"
          onClick={cerrarSesion}
          startIcon={<LogoutRounded sx={{ fontSize: 18 }} />}
          sx={{
            flexShrink: 0,
            borderRadius: "999px",
            display: { xs: searchOpen ? "none" : "inline-flex", sm: "inline-flex" },
            "& .MuiButton-startIcon": { mr: { xs: 0, md: 1 } },
            minWidth: 0,
          }}
        >
          <Box component="span" sx={{ display: { xs: "none", md: "inline" } }}>Cerrar sesión</Box>
        </Button>
      </Box>

      {/* Fondo que cierra la búsqueda al hacer clic fuera */}
      {searchOpen && searchQuery.trim().length >= 2 && (
        <Box onClick={cerrarBusqueda} sx={{ position: "fixed", inset: 0, zIndex: 1050 }} />
      )}

      {/* Avisos de retoque: pacientes que ya deben volver */}
      <PanelRecordatorios
        apiBase={API_BASE}
        onVerPaciente={(r) => navigate("/historial-clinico", { state: { pacienteId: r.paciente_id } })}
        onVerInventario={() => navigate("/inventario")}
      />

      {/* ───── Contenido ───── */}
      <Box
        component="main"
        sx={{
          flex: 1,
          position: "relative",
          zIndex: 1,
          width: "100%",
          maxWidth: 1240,
          mx: "auto",
          px: { xs: 2, sm: 3, md: 4 },
          pt: { xs: 3.5, sm: 5 },
          pb: 5,
        }}
      >
        <MotionBox variants={subir} initial="hidden" animate="show" sx={{ mb: { xs: 3.5, sm: 5 } }}>
          <Typography
            sx={{
              fontSize: "0.78rem",
              fontStyle: "italic",
              color: BRAND.oro,
              mb: 1,
              textTransform: "capitalize",
            }}
          >
            | {fechaHoy}
          </Typography>
          <Typography
            component="h1"
            sx={{
              fontFamily: FONTS.titulo,
              fontSize: { xs: "1.6rem", sm: "2.1rem", md: "2.4rem" },
              letterSpacing: "0.06em",
              lineHeight: 1.2,
              color: BRAND.texto,
            }}
          >
            {saludo}, <Box component="span" sx={{ color: ORO }}>{username}</Box>
          </Typography>
          <Typography sx={{ mt: 1, color: BRAND.textoSuave, fontSize: { xs: "0.85rem", sm: "0.92rem" } }}>
            ¿Con qué módulo quieres trabajar hoy?
          </Typography>
        </MotionBox>

        {secciones.map((sec, si) => (
          <Box key={sec.id} sx={{ mb: { xs: 3, sm: 4 }, "&:last-of-type": { mb: 0 } }}>
            {sec.label && (
              <MotionBox
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.4, delay: 0.05 + si * 0.05 }}
                sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1.5 }}
              >
                <Typography
                  component="h2"
                  sx={{
                    fontSize: "0.72rem",
                    fontWeight: 600,
                    color: BRAND.oroOscuro,
                    letterSpacing: "0.22em",
                    textTransform: "uppercase",
                    whiteSpace: "nowrap",
                  }}
                >
                  {sec.label}
                </Typography>
                <Box sx={{ flex: 1, height: "1px", backgroundColor: "rgba(186,154,99,0.35)" }} />
              </MotionBox>
            )}

            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: {
                  xs: "1fr",
                  sm: "repeat(2, minmax(0, 1fr))",
                  md: "repeat(3, minmax(0, 1fr))",
                  lg: "repeat(4, minmax(0, 1fr))",
                },
                gap: { xs: 1.25, sm: 2 },
              }}
            >
              {sec.items.map((item, i) => renderTarjeta(item, si * 4 + i))}
            </Box>
          </Box>
        ))}
      </Box>

      {/* Footer */}
      <Box
        component="footer"
        sx={{
          position: "relative",
          zIndex: 1,
          py: 2,
          px: 3,
          borderTop: `1px solid ${BRAND.borde}`,
        }}
      >
        <Box
          sx={{
            maxWidth: 1240,
            mx: "auto",
            display: "flex",
            flexDirection: { xs: "column", sm: "row" },
            alignItems: "center",
            justifyContent: "space-between",
            gap: 0.5,
          }}
        >
          <Typography sx={{ fontFamily: FONTS.titulo, color: BRAND.arena, letterSpacing: "0.14em", fontSize: "0.8rem" }}>
            SHOWCLINIC
          </Typography>
          <Typography sx={{ color: BRAND.textoTenue, fontSize: "0.72rem", fontStyle: "italic" }}>
            Seguridad que se siente, belleza que se nota.
          </Typography>
          <Typography sx={{ color: BRAND.textoTenue, fontSize: "0.7rem" }}>
            © {new Date().getFullYear()} · Arequipa, Perú
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
        <DialogContent sx={{ pt: 4, textAlign: "center" }}>
          <Box
            sx={{
              width: 64, height: 64, mx: "auto", mb: 2, borderRadius: "50%",
              backgroundColor: BRAND.crema, color: ORO,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            <Lock sx={{ fontSize: 30 }} />
          </Box>
          <Typography sx={{ fontFamily: FONTS.titulo, fontSize: "1.25rem", letterSpacing: "0.06em", mb: 1 }}>
            {deniedModule}
          </Typography>
          <Typography variant="body2" sx={{ color: BRAND.textoSuave }}>
            No tienes permisos para acceder a este módulo. Pide acceso al administrador.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2.5, justifyContent: "center" }}>
          <Button onClick={() => setOpenAccessDenied(false)} variant="contained" sx={{ px: 5 }}>
            Entendido
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
