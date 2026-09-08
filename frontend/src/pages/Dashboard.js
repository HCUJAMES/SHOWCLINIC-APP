import React, { useState, useEffect, useMemo } from "react";
import {
  Typography,
  Box,
  Dialog,
  DialogTitle,
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
  SupervisorAccount,
  QrCode2,
  MonetizationOn,
  ArrowForwardRounded,
} from "@mui/icons-material";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import PanelRecordatorios from "../components/PanelRecordatorios";

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
  "Productos Aplicados": CalendarToday,
  "Usuarios": SupervisorAccount,
  "Códigos de Barras": QrCode2,
  "Gestión CEO": MonetizationOn,
};

/**
 * Agrupación de los módulos para que el menú se lea por áreas de trabajo en
 * vez de como una lista plana. Solo cambia el ORDEN y el encabezado de cada
 * bloque; el título, la descripción y la etiqueta de cada módulo son los
 * mismos de siempre. Un módulo que no esté aquí cae en "Otros".
 */
const GRUPOS = [
  { id: "atencion", label: "Atención", titulos: ["Pacientes", "Tratamientos", "Paquetes", "Gestión Clínica"] },
  { id: "operacion", label: "Operación", titulos: ["Inventario", "Códigos de Barras", "Productos Aplicados", "Especialistas"] },
  { id: "direccion", label: "Dirección", titulos: ["Finanzas", "Gestión CEO", "Estadísticas"] },
  { id: "sistema", label: "Sistema", titulos: ["Gestionar", "Usuarios"] },
];

// Con pocos módulos no vale la pena partir en secciones: se muestran juntos.
const MINIMO_PARA_AGRUPAR = 7;

const ORO = "#a36920";
const ORO_CLARO = "#d4af37";
const ORO_SUAVE = "#ba9a63";

const API_BASE = process.env.REACT_APP_API_URL || `${window.location.protocol}//${window.location.hostname}:4000`;

/* ───────────────────────────── animaciones ───────────────────────────── */

const suave = [0.22, 1, 0.36, 1];

const contenedor = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.15 } },
};

const subir = {
  hidden: { opacity: 0, y: 22 },
  show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: suave } },
};

// Cada tarjeta se anima por su cuenta (no hereda del contenedor) y entra
// escalonada según su posición, que llega por `custom`.
const tarjeta = {
  hidden: { opacity: 0, y: 26, scale: 0.97 },
  show: (i = 0) => ({
    opacity: 1, y: 0, scale: 1,
    transition: { duration: 0.5, ease: suave, delay: 0.35 + Math.min(i, 12) * 0.06 },
  }),
  hover: { y: -6, transition: { type: "spring", stiffness: 320, damping: 22 } },
};

// Los hijos declaran también "hidden": si no, aparecen un instante en su
// estado por defecto antes de que el padre termine de entrar.
const iconoTarjeta = {
  hidden: { rotate: 0, scale: 1 },
  show: { rotate: 0, scale: 1 },
  hover: { rotate: -6, scale: 1.1, transition: { type: "spring", stiffness: 300, damping: 16 } },
};

const flechaTarjeta = {
  hidden: { opacity: 0, x: -6 },
  show: { opacity: 0, x: -6 },
  hover: { opacity: 1, x: 0, transition: { duration: 0.25, ease: suave } },
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

  const menuItems = menuItemsByRole[role] || permissionMenuItems;

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

  // Cuantos más módulos tenga el rol, antes conviene compactar para que
  // todo siga entrando en una pantalla.
  const mqCompacto = `@media (max-height: ${menuItems.length >= 11 ? 1200 : 950}px)`;

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

  /* ─────────────────────────── una tarjeta ─────────────────────────── */
  const renderTarjeta = (item, index = 0) => {
    const IconComponent = moduleIcons[item.title];
    const isLocked = item.hasAccess === false;

    return (
      <MotionBox
        key={item.title}
        custom={index}
        initial="hidden"
        animate="show"
        variants={tarjeta}
        whileHover={isLocked ? undefined : "hover"}
        whileTap={isLocked ? undefined : { scale: 0.985 }}
        onClick={() => abrirModulo(item)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); abrirModulo(item); } }}
        sx={{
          position: "relative",
          cursor: "pointer",
          borderRadius: "18px",
          px: 2.4,
          py: 2.9,
          [mqCompacto]: { px: 1.9, py: 1.55 },
          display: "flex",
          alignItems: "center",
          gap: 2,
          overflow: "hidden",
          isolation: "isolate",
          // Vidrio cálido: deja pasar el fondo pero mantiene la lectura
          background: isLocked
            ? "rgba(250,248,245,0.55)"
            : "linear-gradient(160deg, rgba(255,253,247,0.92) 0%, rgba(255,251,242,0.80) 100%)",
          backdropFilter: "blur(14px)",
          WebkitBackdropFilter: "blur(14px)",
          border: `1px solid ${isLocked ? "rgba(0,0,0,0.06)" : "rgba(186,154,99,0.22)"}`,
          boxShadow: isLocked
            ? "none"
            : "0 1px 2px rgba(163,105,32,0.06), 0 10px 30px -12px rgba(163,105,32,0.20)",
          filter: isLocked ? "grayscale(0.6)" : "none",
          opacity: isLocked ? 0.62 : 1,
          transition: "box-shadow .35s ease, border-color .35s ease",
          outline: "none",
          "&:focus-visible": { boxShadow: `0 0 0 3px rgba(163,105,32,0.28)` },
          "&:hover": isLocked ? {} : {
            borderColor: "rgba(163,105,32,0.45)",
            boxShadow: "0 2px 4px rgba(163,105,32,0.08), 0 22px 44px -14px rgba(163,105,32,0.32)",
          },
          // Filo dorado lateral que se despliega al pasar el cursor
          "&::before": {
            content: '""',
            position: "absolute",
            left: 0, top: 12, bottom: 12,
            width: 3,
            borderRadius: "0 3px 3px 0",
            background: `linear-gradient(180deg, ${ORO_CLARO}, ${ORO})`,
            transform: "scaleY(0)",
            transformOrigin: "center",
            transition: "transform .45s cubic-bezier(.22,1,.36,1)",
          },
          "&:hover::before": isLocked ? {} : { transform: "scaleY(1)" },
          // Destello que recorre la tarjeta
          "&::after": {
            content: '""',
            position: "absolute",
            top: 0, bottom: 0,
            left: "-60%", width: "50%",
            background: "linear-gradient(105deg, transparent 0%, rgba(255,255,255,0.55) 50%, transparent 100%)",
            transform: "skewX(-18deg)",
            transition: "left .7s cubic-bezier(.22,1,.36,1)",
            pointerEvents: "none",
          },
          "&:hover::after": isLocked ? {} : { left: "120%" },
        }}
      >
        {/* Icono en placa dorada */}
        <MotionBox
          variants={iconoTarjeta}
          sx={{
            width: 52,
            height: 52,
            [mqCompacto]: { width: 44, height: 44 },
            flexShrink: 0,
            borderRadius: "14px",
            position: "relative",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: isLocked
              ? "rgba(0,0,0,0.05)"
              : `linear-gradient(140deg, #e6c465 0%, ${ORO_CLARO} 35%, ${ORO} 100%)`,
            boxShadow: isLocked
              ? "none"
              : "0 8px 18px -8px rgba(163,105,32,0.65), inset 0 1px 0 rgba(255,255,255,0.45), inset 0 -1px 0 rgba(0,0,0,0.08)",
          }}
        >
          {IconComponent && (
            <IconComponent sx={{ fontSize: 25, color: isLocked ? "#9e9e9e" : "#fff" }} />
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
        </MotionBox>

        {/* Nombre del módulo y su etiqueta */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            noWrap
            sx={{
              fontWeight: 700,
              color: "#2e2e2e",
              fontSize: "1rem",
              lineHeight: 1.25,
              letterSpacing: "0.1px",
            }}
          >
            {item.title}
          </Typography>
          <Typography
            noWrap
            sx={{
              mt: 0.35,
              color: isLocked ? "#a89c8c" : ORO_SUAVE,
              fontSize: "0.6rem",
              fontWeight: 700,
              letterSpacing: "1.4px",
              textTransform: "uppercase",
            }}
          >
            {isLocked ? "BLOQUEADO" : item.tag}
          </Typography>
        </Box>

        {/* Flecha que aparece al pasar el cursor */}
        {!isLocked && (
          <MotionBox
            variants={flechaTarjeta}
            sx={{
              flexShrink: 0,
              width: 26, height: 26, borderRadius: "50%",
              display: "flex", alignItems: "center", justifyContent: "center",
              background: "rgba(163,105,32,0.09)",
              border: "1px solid rgba(163,105,32,0.20)",
            }}
          >
            <ArrowForwardRounded sx={{ fontSize: 14, color: ORO }} />
          </MotionBox>
        )}
      </MotionBox>
    );
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        background: "linear-gradient(160deg, #faf8f5 0%, #f0ebe0 40%, #e8dfd0 100%)",
        position: "relative",
        display: "flex",
        flexDirection: "column",
        overflowX: "hidden",
      }}
    >
      {/* Hilo dorado superior con brillo en movimiento */}
      <MotionBox
        animate={{ backgroundPosition: ["0% 50%", "200% 50%"] }}
        transition={{ duration: 9, repeat: Infinity, ease: "linear" }}
        sx={{
          height: 4,
          background: `linear-gradient(90deg, ${ORO} 0%, ${ORO_CLARO} 25%, #f3e2a8 50%, ${ORO_CLARO} 75%, ${ORO} 100%)`,
          backgroundSize: "200% 100%",
          position: "relative",
          zIndex: 2,
        }}
      />

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
              ? "rgba(211,47,47,0.85)"
              : `linear-gradient(135deg, ${ORO_CLARO} 0%, ${ORO} 100%)`,
            boxShadow: "0 6px 18px -4px rgba(163,105,32,0.45)",
            transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
            "&:hover": {
              transform: "scale(1.08)",
              boxShadow: "0 10px 24px -6px rgba(163,105,32,0.55)",
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
            elevation={0}
            sx={{
              display: "flex",
              alignItems: "center",
              borderRadius: 50,
              overflow: "hidden",
              backgroundColor: "rgba(255,255,255,0.92)",
              backdropFilter: "blur(12px)",
              border: "1px solid rgba(163,105,32,0.22)",
              boxShadow: "0 10px 30px -10px rgba(163,105,32,0.35)",
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
                    {searching && <CircularProgress size={16} sx={{ color: ORO }} />}
                  </InputAdornment>
                ),
              }}
            />
          </Paper>
        </Collapse>
      </Box>

      {/* Resultados de búsqueda */}
      <AnimatePresence>
        {searchOpen && searchResults.length > 0 && (
          <MotionBox
            key="resultados"
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.22, ease: suave }}
            sx={{
              position: "fixed",
              top: 76,
              left: 20,
              width: 320,
              maxHeight: 380,
              overflowY: "auto",
              zIndex: 999,
              borderRadius: "18px",
              backgroundColor: "rgba(255,255,255,0.94)",
              backdropFilter: "blur(14px)",
              border: "1px solid rgba(163,105,32,0.16)",
              boxShadow: "0 18px 50px -14px rgba(163,105,32,0.35)",
            }}
          >
            <List sx={{ p: 0.75 }}>
              {searchResults.map((paciente) => (
                <ListItemButton
                  key={paciente.id}
                  onClick={() => handleSelectPaciente(paciente)}
                  sx={{
                    borderRadius: "12px",
                    py: 1.4,
                    px: 1.75,
                    transition: "all 0.2s ease",
                    "&:hover": {
                      backgroundColor: "rgba(163,105,32,0.07)",
                      pl: 2.25,
                    },
                  }}
                >
                  <Box
                    sx={{
                      width: 38,
                      height: 38,
                      borderRadius: "50%",
                      background: "linear-gradient(135deg, rgba(163,105,32,0.12) 0%, rgba(212,175,55,0.24) 100%)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      mr: 2,
                      flexShrink: 0,
                    }}
                  >
                    <People sx={{ fontSize: 18, color: ORO }} />
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
                </ListItemButton>
              ))}
            </List>
          </MotionBox>
        )}
      </AnimatePresence>

      {searchOpen && searchQuery.trim().length >= 2 && searchResults.length === 0 && !searching && (
        <Paper
          elevation={0}
          sx={{
            position: "fixed",
            top: 76,
            left: 20,
            width: 320,
            zIndex: 999,
            borderRadius: "18px",
            backgroundColor: "rgba(255,255,255,0.94)",
            backdropFilter: "blur(14px)",
            border: "1px solid rgba(163,105,32,0.16)",
            boxShadow: "0 18px 50px -14px rgba(163,105,32,0.35)",
            p: 3,
            textAlign: "center",
          }}
        >
          <Typography sx={{ fontSize: "0.85rem", color: "#999" }}>
            No se encontraron pacientes
          </Typography>
        </Paper>
      )}

      {/* Avisos de retoque: pacientes que ya deben volver */}
      <PanelRecordatorios
        apiBase={API_BASE}
        onVerPaciente={(r) => navigate("/historial-clinico", { state: { pacienteId: r.paciente_id } })}
      />

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
          opacity: 0.32,
          pointerEvents: "none",
          zIndex: 0,
          objectFit: "cover",
          objectPosition: "center top",
          filter: "grayscale(25%) saturate(0.9)",
          maskImage: "linear-gradient(to right, rgba(0,0,0,1) 45%, rgba(0,0,0,0))",
          WebkitMaskImage: "linear-gradient(to right, rgba(0,0,0,1) 45%, rgba(0,0,0,0))",
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
          opacity: 0.32,
          pointerEvents: "none",
          zIndex: 0,
          objectFit: "cover",
          objectPosition: "center top",
          filter: "grayscale(25%) saturate(0.9)",
          maskImage: "linear-gradient(to left, rgba(0,0,0,1) 45%, rgba(0,0,0,0))",
          WebkitMaskImage: "linear-gradient(to left, rgba(0,0,0,1) 45%, rgba(0,0,0,0))",
        }}
      />

      {/* Luces doradas que flotan despacio detrás de todo */}
      {[
        { size: 520, top: "-12%", left: "18%", dur: 26, dx: 40, dy: 30, op: 0.28 },
        { size: 420, top: "48%", left: "62%", dur: 32, dx: -50, dy: 40, op: 0.22 },
        { size: 300, top: "70%", left: "8%", dur: 22, dx: 30, dy: -35, op: 0.18 },
      ].map((o, i) => (
        <MotionBox
          key={i}
          aria-hidden
          animate={{ x: [0, o.dx, 0], y: [0, o.dy, 0] }}
          transition={{ duration: o.dur, repeat: Infinity, ease: "easeInOut" }}
          sx={{
            position: "fixed",
            top: o.top, left: o.left,
            width: o.size, height: o.size,
            borderRadius: "50%",
            background: `radial-gradient(circle, rgba(212,175,55,${o.op}) 0%, rgba(212,175,55,0) 70%)`,
            filter: "blur(30px)",
            pointerEvents: "none",
            zIndex: 0,
            willChange: "transform",
          }}
        />
      ))}

      {/* Main Content */}
      <Box
        sx={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          py: { xs: 3, sm: 4 },
          px: 2,
          position: "relative",
          zIndex: 1,
          // En pantallas bajas se recorta el aire para que igual entre todo
          [mqCompacto]: { py: 2 },
        }}
      >
        <MotionBox
          variants={contenedor}
          initial="hidden"
          animate="show"
          sx={{ width: "100%", maxWidth: 1560 }}
        >

          {/* Header */}
          <Box sx={{ textAlign: "center", mb: { xs: 3, sm: 4 }, [mqCompacto]: { mb: 2.25 } }}>
            <MotionBox variants={subir} sx={{ display: "inline-block", position: "relative", mb: 1.5 }}>
              {/* Halo que respira detrás del logo */}
              <MotionBox
                aria-hidden
                animate={{ scale: [1, 1.18, 1], opacity: [0.45, 0.15, 0.45] }}
                transition={{ duration: 3.6, repeat: Infinity, ease: "easeInOut" }}
                sx={{
                  position: "absolute", inset: -10, borderRadius: "50%",
                  border: `1.5px solid ${ORO_CLARO}`,
                  pointerEvents: "none",
                }}
              />
              <Box
                component="img"
                src="/logo-showclinic.png"
                alt="ShowClinic"
                sx={{
                  width: 88,
                  height: 88,
                  [mqCompacto]: { width: 66, height: 66 },
                  objectFit: "cover",
                  borderRadius: "50%",
                  border: "3px solid rgba(255,255,255,0.9)",
                  boxShadow: `0 0 0 2px rgba(163,105,32,0.35), 0 14px 34px -10px rgba(163,105,32,0.45)`,
                  display: "block",
                  position: "relative",
                }}
              />
            </MotionBox>

            <MotionBox variants={subir}>
              <Typography
                variant="h3"
                sx={{
                  fontFamily: "'Playfair Display', serif",
                  fontWeight: 700,
                  letterSpacing: 4,
                  fontSize: { xs: "1.8rem", sm: "2.4rem", md: "2.8rem" },
                  // Oro con relieve: degradado sobre el texto
                  background: `linear-gradient(180deg, #c58a3a 0%, ${ORO} 55%, #7d5017 100%)`,
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                  display: "inline-block",
                }}
              >
                SHOWCLINIC
              </Typography>
            </MotionBox>

            <MotionBox variants={subir} sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 1.5, mt: 0.75 }}>
              <Box sx={{ width: { xs: 22, sm: 40 }, height: 1, background: `linear-gradient(90deg, transparent, ${ORO_SUAVE})` }} />
              <Typography
                sx={{ color: ORO_SUAVE, letterSpacing: 2.5, fontWeight: 500, fontSize: { xs: "0.7rem", sm: "0.85rem" } }}
              >
                ESTÉTICA AVANZADA & BIENESTAR
              </Typography>
              <Box sx={{ width: { xs: 22, sm: 40 }, height: 1, background: `linear-gradient(90deg, ${ORO_SUAVE}, transparent)` }} />
            </MotionBox>

            <MotionBox
              variants={subir}
              sx={{
                mt: 2,
                [mqCompacto]: { mt: 1.25, py: 0.4 },
                display: "inline-flex",
                alignItems: "center",
                gap: 1.1,
                px: 2.75,
                py: 0.8,
                borderRadius: 50,
                backgroundColor: "rgba(255,253,247,0.75)",
                backdropFilter: "blur(10px)",
                border: "1px solid rgba(186,154,99,0.25)",
                boxShadow: "0 8px 24px -12px rgba(163,105,32,0.35)",
              }}
            >
              <Box sx={{ position: "relative", width: 8, height: 8 }}>
                <Box sx={{ position: "absolute", inset: 0, borderRadius: "50%", backgroundColor: "#4CAF50" }} />
                <MotionBox
                  aria-hidden
                  animate={{ scale: [1, 2.2], opacity: [0.6, 0] }}
                  transition={{ duration: 1.8, repeat: Infinity, ease: "easeOut" }}
                  sx={{ position: "absolute", inset: 0, borderRadius: "50%", border: "1.5px solid #4CAF50" }}
                />
              </Box>
              <Typography
                variant="body1"
                sx={{ color: "#6B6B6B", fontWeight: 400, fontSize: { xs: "0.9rem", sm: "1rem" } }}
              >
                {saludo}, <strong style={{ color: ORO }}>{username}</strong>
              </Typography>
            </MotionBox>
          </Box>

          {/* Módulos, por secciones */}
          <Box sx={{ maxWidth: 1400, mx: "auto", px: { xs: 0.5, sm: 2 } }}>
            {secciones.map((sec) => (
              <Box key={sec.id} sx={{ mb: { xs: 3, sm: 4 }, [mqCompacto]: { mb: 1.75 }, "&:last-of-type": { mb: 0 } }}>
                {sec.label && (
                  <MotionBox
                    variants={subir}
                    sx={{ display: "flex", alignItems: "center", gap: 1.4, mb: 1.5, px: 0.5, [mqCompacto]: { mb: 1 } }}
                  >
                    {/* Rombo dorado como marca de sección */}
                    <Box
                      aria-hidden
                      sx={{
                        width: 6, height: 6, flexShrink: 0,
                        transform: "rotate(45deg)",
                        background: `linear-gradient(135deg, ${ORO_CLARO}, ${ORO})`,
                        boxShadow: "0 0 8px rgba(212,175,55,0.5)",
                      }}
                    />
                    <Typography
                      sx={{
                        color: ORO,
                        fontSize: "0.66rem",
                        fontWeight: 700,
                        letterSpacing: "2.2px",
                        textTransform: "uppercase",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {sec.label}
                    </Typography>
                    <Box sx={{ flex: 1, height: 1, background: "linear-gradient(90deg, rgba(186,154,99,0.5), rgba(186,154,99,0))" }} />
                  </MotionBox>
                )}

                <Box
                  sx={{
                    display: "grid",
                    // Se aprovecha el ancho disponible para que todo entre en
                    // una pantalla. El tope son 4 columnas: las secciones
                    // tienen 3 o 4 módulos, así que con 5 quedaría un hueco
                    // visible al final de cada fila.
                    gridTemplateColumns: {
                      xs: "1fr",
                      sm: "repeat(2, 1fr)",
                      md: "repeat(3, 1fr)",
                      lg: "repeat(4, 1fr)",
                    },
                    gap: { xs: 1.75, sm: 2.4 },
                  }}
                >
                  {sec.items.map(renderTarjeta)}
                </Box>
              </Box>
            ))}
          </Box>

          {/* Session info */}
          <MotionBox variants={subir} sx={{ mt: 3, [mqCompacto]: { mt: 1.75 }, textAlign: "center" }}>
            <Typography variant="caption" sx={{ color: "#b9ad98", fontWeight: 400, fontSize: "0.75rem", letterSpacing: "0.3px" }}>
              Panel de administración • Sesión activa
            </Typography>
          </MotionBox>
        </MotionBox>
      </Box>

      {/* Footer */}
      <Box
        component="footer"
        sx={{
          py: 1.75,
          px: 3,
          [mqCompacto]: { py: 1.2 },
          position: "relative",
          zIndex: 1,
          borderTop: "1px solid rgba(186,154,99,0.18)",
          backgroundColor: "rgba(255,253,247,0.72)",
          backdropFilter: "blur(10px)",
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
              sx={{ width: 24, height: 24, borderRadius: "50%", opacity: 0.75, boxShadow: "0 0 0 1px rgba(163,105,32,0.25)" }}
            />
            <Typography variant="caption" sx={{ color: ORO_SUAVE, fontWeight: 600, letterSpacing: 0.5, fontSize: "0.72rem" }}>
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
        PaperProps={{ sx: { borderRadius: "20px", overflow: "hidden" } }}
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
              backgroundColor: ORO,
              "&:hover": { backgroundColor: "#8a5a1a" },
              px: 5,
              py: 1,
              borderRadius: 2,
              fontWeight: 600,
              textTransform: "none",
              fontSize: "0.9rem",
              boxShadow: "none",
            }}
          >
            Entendido
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
