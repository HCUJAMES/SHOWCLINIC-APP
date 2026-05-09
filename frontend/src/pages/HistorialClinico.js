import React, { useEffect, useState, useRef, useCallback } from "react";
import useSocket from "../hooks/useSocket";
import {
  Container,
  Typography,
  TextField,
  Button,
  Grid,
  Paper,
  Avatar,
  Table,
  TableContainer,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Divider,
  Box,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Autocomplete,
  Chip,
  Checkbox,
  Collapse,
  Switch,
  FormControlLabel,
  Tooltip,
} from "@mui/material";
import { ArrowBack, Home, Receipt, Edit, Delete, DeleteForever, Print, Close, Description, ExpandMore, ExpandLess, SortByAlpha, Schedule, ShoppingCart, AddShoppingCart, RemoveShoppingCart, PictureAsPdf, Person, Phone, LocalHospital, Favorite, Check, CardGiftcard, Assignment, Inventory, Inventory2, Face, FitnessCenter, DescriptionOutlined } from "@mui/icons-material";
import { useNavigate, useLocation } from "react-router-dom";
import { calcularEdad, formatearFechaCorta } from "../utils/dateUtils";
import axios from "axios";
import { generarProformaPDF, generarProformaPaquete } from "../utils/generarProformaPDF";
import generarConsentimientoPDF from "../utils/generarConsentimientoPDF";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { useToast } from "../components/ToastProvider";
import ReciboTicket from "../components/ReciboTicket";
import ReciboConsolidado from "../components/ReciboConsolidado";
import FacialMap3D from "../components/FacialMap3D";
import PatientJourneyChart from "../components/PatientJourneyChart";
import TreatmentCalendar from "../components/TreatmentCalendar";

 const API_BASE_URL = `${window.location.protocol}//${window.location.hostname}:4000`;

const loadImage = (src) =>
  new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });

const makeCircularImageDataUrl = (img, sizePx = 256, borderPx = 10) => {
  if (!img) return null;
  const canvas = document.createElement("canvas");
  canvas.width = sizePx;
  canvas.height = sizePx;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const innerSize = sizePx - borderPx * 2;
  const r = innerSize / 2;
  const cx = sizePx / 2;
  const cy = sizePx / 2;

  ctx.clearRect(0, 0, sizePx, sizePx);

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();

  const scale = Math.max(innerSize / img.width, innerSize / img.height);
  const w = img.width * scale;
  const h = img.height * scale;
  const x = cx - w / 2;
  const y = cy - h / 2;
  ctx.drawImage(img, x, y, w, h);
  ctx.restore();

  ctx.beginPath();
  ctx.arc(cx, cy, r + borderPx / 2, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(255,255,255,0.92)";
  ctx.lineWidth = borderPx;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(cx, cy, r + borderPx, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(0,0,0,0.10)";
  ctx.lineWidth = 1;
  ctx.stroke();

  return canvas.toDataURL("image/png");
};

const CAMPOS_FOTOS_ANTES = ["foto_antes1", "foto_antes2", "foto_antes3"];
const CAMPOS_FOTOS_DESPUES = ["foto_despues1", "foto_despues2", "foto_despues3"];
const CAMPOS_FOTOS_LEGACY = [
  "foto_izquierda",
  "foto_frontal",
  "foto_derecha",
  "foto_extra1",
  "foto_extra2",
  "foto_extra3",
];

const HistorialClinico = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { showToast } = useToast();
  const [pacientes, setPacientes] = useState([]);
  const [filtro, setFiltro] = useState("");
  const [ordenPacientes, setOrdenPacientes] = useState("reciente");
  const [pacienteSeleccionado, setPacienteSeleccionado] = useState(null);
  const [tratamientos, setTratamientos] = useState([]);
  const [resumenDeuda, setResumenDeuda] = useState({ cantidad_pendiente: 0, total_pendiente: 0 });
  const [nuevaObservacion, setNuevaObservacion] = useState("");
  const [observaciones, setObservaciones] = useState([]);
  const [guardandoObservaciones, setGuardandoObservaciones] = useState(false);
  const [observacionEditId, setObservacionEditId] = useState(null);
  const [observacionEditTexto, setObservacionEditTexto] = useState("");
  const [guardandoObservacionEdit, setGuardandoObservacionEdit] = useState(false);
  const [showObservaciones, setShowObservaciones] = useState(false);
  const [tratamientosBase, setTratamientosBase] = useState([]);
  const [tratamientosUso, setTratamientosUso] = useState({}); // { tratamiento_id: count }
  const [catalogoOrden, setCatalogoOrden] = useState("popular"); // "popular" | "nombre"
  const [productosInventario, setProductosInventario] = useState([]);
  const [paquetesActivos, setPaquetesActivos] = useState([]);
  const [paquetesPaciente, setPaquetesPaciente] = useState([]);
  const [asignandoPaquete, setAsignandoPaquete] = useState(false);
  const [presupuestosAsignados, setPresupuestosAsignados] = useState([]);
  const [editandoSesiones, setEditandoSesiones] = useState(null); // { ofertaId, itemIdx, sesiones }
  const [asignandoPresupuesto, setAsignandoPresupuesto] = useState(false);
  const [showOferta, setShowOferta] = useState(false);
  const [ofertaItems, setOfertaItems] = useState([]);
  const [guardandoOferta, setGuardandoOferta] = useState(false);
  const [ofertas, setOfertas] = useState([]);
  const [ofertaEditId, setOfertaEditId] = useState(null);
  const [descuentoOferta, setDescuentoOferta] = useState("");
  const [presupuestoCarouselIdx, setPresupuestoCarouselIdx] = useState(0);
  const [catalogoFiltro, setCatalogoFiltro] = useState("");
  const [catalogoCarouselIdx, setCatalogoCarouselIdx] = useState(0);
  const [catalogoImagenIdx, setCatalogoImagenIdx] = useState({}); // { tratamientoId: currentImageIndex }
  const [fotosTratamiento, setFotosTratamiento] = useState([]);
  const [tratamientoSeleccionado, setTratamientoSeleccionado] = useState(null);

  // Estados para galería de fotos del paciente
  const [fotosPaciente, setFotosPaciente] = useState([]);
  const [mostrarTodasFotos, setMostrarTodasFotos] = useState(false);
  const [subiendoFotosPaciente, setSubiendoFotosPaciente] = useState(false);
  const [archivosFotosPaciente, setArchivosFotosPaciente] = useState([]);
  const [nombreTratamientoFoto, setNombreTratamientoFoto] = useState("");
  const [fotoPreview, setFotoPreview] = useState(null);

  // Estado para modal de recibo
  const [openReciboModal, setOpenReciboModal] = useState(false);
  const [datosRecibo, setDatosRecibo] = useState(null);

  // Estado para modal de recibo consolidado
  const [openReciboConsolidado, setOpenReciboConsolidado] = useState(false);
  const [datosReciboConsolidado, setDatosReciboConsolidado] = useState(null);

  // Estados para editar tratamiento
  const [openEditarModal, setOpenEditarModal] = useState(false);
  const [tratamientoEditar, setTratamientoEditar] = useState(null);
  const [editEspecialista, setEditEspecialista] = useState("");
  const [editSesion, setEditSesion] = useState(1);
  const [editPrecio, setEditPrecio] = useState("");
  const [editDescuento, setEditDescuento] = useState("");
  const [editPagoMetodo, setEditPagoMetodo] = useState("Efectivo");
  const [editTipoAtencion, setEditTipoAtencion] = useState("Tratamiento");
  const [editFecha, setEditFecha] = useState("");
  const [editNombreTratamiento, setEditNombreTratamiento] = useState("");
  const [editCantidad, setEditCantidad] = useState("");
  const [editProductoUsado, setEditProductoUsado] = useState("");
  const [modalDescuento, setModalDescuento] = useState(false);
  const [descuentoProforma, setDescuentoProforma] = useState("");
  const [presupuestoParaProforma, setPresupuestoParaProforma] = useState(null);

  // Estados para modal de descuento de presupuesto
  const [modalDescuentoPresupuesto, setModalDescuentoPresupuesto] = useState(false);
  const [presupuestoParaDescuento, setPresupuestoParaDescuento] = useState(null);
  const [nuevoDescuento, setNuevoDescuento] = useState("");

  // Estados para confirmar cancelación
  const [openConfirmarCancelar, setOpenConfirmarCancelar] = useState(false);
  const [tratamientoCancelar, setTratamientoCancelar] = useState(null);

  // Estados para carrusel de imágenes de tratamiento
  const [modalCarrusel, setModalCarrusel] = useState(false);
  const [carruselImagenes, setCarruselImagenes] = useState([]);
  const [carruselIdx, setCarruselIdx] = useState(0);
  const [carruselNombre, setCarruselNombre] = useState("");

  // Cache de primera imagen por tratamiento_id para cards del presupuesto
  const [tratamientoImagenCache, setTratamientoImagenCache] = useState({});
  // Modal para agrandar imagen de tratamiento
  const [imagenAgrandada, setImagenAgrandada] = useState(null);

  // Estados para presupuesto corporal
  const [modalCorporal, setModalCorporal] = useState(false);
  const [corporalRegistros, setCorporalRegistros] = useState([]);
  const [corporalEditId, setCorporalEditId] = useState(null);
  const [corporalTipo, setCorporalTipo] = useState("evaluacion");
  const [corporalTablas, setCorporalTablas] = useState([
    { titulo: "Mediciones", filas: [{ cintura: "", cadera: "", muslos: "", gluteos: "", brazos: "", abdomen_alto: "", abdomen_medio: "", abdomen_bajo: "", sesion: "1ra sesión", datos: "" }] }
  ]);
  const [corporalActividad, setCorporalActividad] = useState("");
  const [corporalObservaciones, setCorporalObservaciones] = useState("");
  const [guardandoCorporal, setGuardandoCorporal] = useState(false);

  // Estados para mapa facial 3D
  const [modalFacial, setModalFacial] = useState(false);
  const [facialRegistros, setFacialRegistros] = useState([]);
  const [guardandoFacial, setGuardandoFacial] = useState(false);

  // Estados para carrito de tratamientos
  const [carritoPaciente, setCarritoPaciente] = useState([]); // lista de carritos
  const [carritoActivo, setCarritoActivo] = useState(null); // carrito activo con items
  const [modalCarrito, setModalCarrito] = useState(false);
  const [carritoAnimacion, setCarritoAnimacion] = useState(null); // para animación al agregar

  // Estados para modal de pago de presupuesto
  const [modalPagoPresupuesto, setModalPagoPresupuesto] = useState(false);
  const [presupuestoParaPago, setPresupuestoParaPago] = useState(null);
  const [montoPago, setMontoPago] = useState("");
  const [metodoPago, setMetodoPago] = useState("efectivo");
  const [tipoPago, setTipoPago] = useState("total"); // 'total', 'adelanto', 'saldo'

  // Estados para modal de pago de paquete
  const [modalPagoPaquete, setModalPagoPaquete] = useState(false);
  const [paqueteParaPago, setPaqueteParaPago] = useState(null);
  
  // Estados para modal de pago de consulta (paquetes)
  const [modalPagoConsulta, setModalPagoConsulta] = useState(false);
  const [paqueteParaConsulta, setPaqueteParaConsulta] = useState(null);
  const [montoConsulta, setMontoConsulta] = useState("");
  const [metodoPagoConsulta, setMetodoPagoConsulta] = useState("efectivo");
  
  // Estados para modal de pago de consulta (presupuestos)
  const [modalPagoConsultaPresupuesto, setModalPagoConsultaPresupuesto] = useState(false);
  const [presupuestoParaConsulta, setPresupuestoParaConsulta] = useState(null);
  const [montoConsultaPresupuesto, setMontoConsultaPresupuesto] = useState("");
  const [metodoPagoConsultaPresupuesto, setMetodoPagoConsultaPresupuesto] = useState("efectivo");
  
  // Estado para controlar qué presupuestos están colapsados
  const [presupuestosColapsados, setPresupuestosColapsados] = useState({});
  
  // Estado para controlar qué paquetes están colapsados
  const [paquetesColapsados, setPaquetesColapsados] = useState({});
  const [presupuestosAsignadosCheck, setPresupuestosAsignadosCheck] = useState({});
  const [paquetesPromoExpanded, setPaquetesPromoExpanded] = useState(false);
  const [tratamientosMarcados, setTratamientosMarcadosRaw] = useState({});
  const marcadosTimerRef = useRef(null);

  // Wrapper que persiste marcas en la base de datos (sincroniza entre dispositivos)
  const setTratamientosMarcados = (valOrFn) => {
    setTratamientosMarcadosRaw(prev => {
      const next = typeof valOrFn === 'function' ? valOrFn(prev) : valOrFn;
      const pacId = pacienteSeleccionado?.id;
      if (pacId) {
        // Debounce: guardar en BD después de 500ms sin cambios
        if (marcadosTimerRef.current) clearTimeout(marcadosTimerRef.current);
        marcadosTimerRef.current = setTimeout(() => {
          axios.put(`${API_BASE_URL}/api/pacientes/${pacId}/marcados`, { marcados: next }, { headers: authHeaders }).catch(() => {});
        }, 500);
      }
      return next;
    });
  };

  // Estados para modal global de pagar consulta (desde barra superior)
  const [modalPagoConsultaGlobal, setModalPagoConsultaGlobal] = useState(false);
  const [consultaGlobalSeleccion, setConsultaGlobalSeleccion] = useState(null); // { tipo: 'paquete'|'presupuesto', item: {...} }
  const [montoConsultaGlobal, setMontoConsultaGlobal] = useState(100);
  const [metodoPagoConsultaGlobal, setMetodoPagoConsultaGlobal] = useState("efectivo");

  // Estados para editar pago de presupuesto/paquete (solo master)
  const [modalEditarPagoPresupuesto, setModalEditarPagoPresupuesto] = useState(false);
  const [presupuestoEditarPago, setPresupuestoEditarPago] = useState(null);
  const [nuevoMontoPagadoPresupuesto, setNuevoMontoPagadoPresupuesto] = useState("");
  const [guardandoEditPago, setGuardandoEditPago] = useState(false);

  const [modalEditarPagoPaquete, setModalEditarPagoPaquete] = useState(false);
  const [paqueteEditarPago, setPaqueteEditarPago] = useState(null);
  const [nuevoMontoPagadoPaquete, setNuevoMontoPagadoPaquete] = useState("");
  const [guardandoEditPagoPaquete, setGuardandoEditPagoPaquete] = useState(false);

  // Estados para especialistas
  const [especialistas, setEspecialistas] = useState([]);
  const [especialistasPorSesion, setEspecialistasPorSesion] = useState({});
  const [especialistaPorPresupuesto, setEspecialistaPorPresupuesto] = useState({});

  const [openConfirmarEliminarPaciente, setOpenConfirmarEliminarPaciente] = useState(false);
  const [pacienteEliminar, setPacienteEliminar] = useState(null);

  const token = localStorage.getItem("token");
  const userRole = localStorage.getItem("role");
  const isMaster = userRole === "master";
  const isAdmin = userRole === "admin";
  const isDoctor = userRole === "doctor";
  const isAsistente = userRole === "asistente";
  const canDoActions = isMaster || isAdmin;
  const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};
  
  // Debug: verificar roles
  console.log("🔍 Debug roles:", { userRole, isMaster, isAdmin, isDoctor, isAsistente });
  
  // Estados para permisos de usuario
  const [userPermissions, setUserPermissions] = useState([]);
  const [canEditHistorial, setCanEditHistorial] = useState(false);

  useEffect(() => {
    // Cargar permisos del usuario
    axios
      .get(`${API_BASE_URL}/api/admin/my-permissions`, { headers: authHeaders })
      .then((res) => {
        setUserPermissions(res.data || []);
        const historialPerm = (res.data || []).find(p => p.module_name === 'historial-clinico');
        setCanEditHistorial(historialPerm ? Boolean(historialPerm.can_edit) : false);
      })
      .catch((err) => {
        console.error("Error al obtener permisos:", err);
        setUserPermissions([]);
        setCanEditHistorial(false);
      });
    
    axios
      .get(`${API_BASE_URL}/api/pacientes/listar`, { headers: authHeaders })
      .then((res) => setPacientes(res.data))
      .catch((err) => console.error("Error al obtener pacientes:", err));

    axios
      .get(`${API_BASE_URL}/api/tratamientos/listar`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      .then((res) => {
        const tratamientosOrdenados = Array.isArray(res.data) ? res.data.sort((a, b) => {
          return (a.nombre || '').toLowerCase().localeCompare((b.nombre || '').toLowerCase());
        }) : [];
        setTratamientosBase(tratamientosOrdenados);
      })
      .catch((err) => {
        console.error("Error al obtener tratamientos base:", err);
        setTratamientosBase([]);
      });

    // Cargar conteo de uso de tratamientos
    axios
      .get(`${API_BASE_URL}/api/tratamientos/uso-conteo`, { headers: authHeaders })
      .then((res) => {
        const usoMap = {};
        (res.data || []).forEach(r => { usoMap[r.tratamiento_id] = r.uso; });
        setTratamientosUso(usoMap);
      })
      .catch(() => setTratamientosUso({}));

    // Cargar especialistas
    axios
      .get(`${API_BASE_URL}/api/especialistas/listar`)
      .then((res) => setEspecialistas(res.data || []))
      .catch((err) => console.error("Error al obtener especialistas:", err));

    // Cargar paquetes activos
    axios
      .get(`${API_BASE_URL}/api/paquetes`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      .then((res) => {
        const activos = (res.data || []).filter(p => p.estado === 'activo');
        const paquetesOrdenados = activos.sort((a, b) => {
          return (a.nombre || '').toLowerCase().localeCompare((b.nombre || '').toLowerCase());
        });
        setPaquetesActivos(paquetesOrdenados);
      })
      .catch((err) => {
        console.error("Error al obtener paquetes:", err);
        setPaquetesActivos([]);
      });

    // Cargar productos del inventario para autocompletar en presupuestos
    const cargarProductosInventario = async () => {
      try {
        const [variantesRes, productosRes] = await Promise.all([
          axios.get(`${API_BASE_URL}/api/inventario/variantes`, { headers: authHeaders }).catch(() => ({ data: [] })),
          axios.get(`${API_BASE_URL}/api/tratamientos/productos`, { headers: authHeaders }).catch(() => ({ data: [] })),
        ]);
        const variantes = (variantesRes.data || []).map(v => ({
          label: `${v.producto_base_nombre || ''} ${v.nombre || ''}`.trim(),
          value: `${v.producto_base_nombre || ''} ${v.nombre || ''}`.trim(),
        }));
        const productosOld = (productosRes.data || []).map(p => ({
          label: `${p.producto || ''} ${p.marca || ''}`.trim(),
          value: `${p.producto || ''} ${p.marca || ''}`.trim(),
        }));
        // Combinar y eliminar duplicados
        const todos = [...variantes, ...productosOld];
        const unicos = [...new Map(todos.map(p => [p.value.toLowerCase(), p])).values()]
          .filter(p => p.value)
          .sort((a, b) => a.label.localeCompare(b.label));
        setProductosInventario(unicos);
      } catch (err) {
        console.error("Error al cargar productos inventario:", err);
      }
    };
    cargarProductosInventario();
  }, []);

  // Seleccionar automáticamente el paciente si viene desde el Dashboard
  useEffect(() => {
    if (location.state?.pacienteId && pacientes.length > 0 && !pacienteSeleccionado) {
      const pacienteId = location.state.pacienteId;
      const paciente = pacientes.find(p => p.id === pacienteId);
      if (paciente) {
        cargarHistorial(pacienteId);
        // Limpiar el state para que no se vuelva a seleccionar al navegar
        window.history.replaceState({}, document.title);
      }
    }
  }, [location.state, pacientes, pacienteSeleccionado]);

  const handleEliminarPaciente = async () => {
    if (!pacienteEliminar) return;
    try {
      await axios.delete(`${API_BASE_URL}/api/pacientes/eliminar/${pacienteEliminar.id}`, {
        headers: authHeaders,
      });
      showToast({ severity: "success", message: `Paciente ${pacienteEliminar.nombre} ${pacienteEliminar.apellido} eliminado correctamente` });
      setPacientes((prev) => prev.filter((p) => p.id !== pacienteEliminar.id));
      setOpenConfirmarEliminarPaciente(false);
      setPacienteEliminar(null);
    } catch (err) {
      console.error("Error al eliminar paciente:", err);
      const msg = err.response?.data?.message || "Error al eliminar paciente";
      showToast({ severity: "error", message: msg });
    }
  };

  const cargarHistorial = async (id) => {
    try {
      const paciente = pacientes.find((p) => p.id === id) || null;
      setPacienteSeleccionado(paciente);
      setTratamientos([]);
      setResumenDeuda({ cantidad_pendiente: 0, total_pendiente: 0 });

      setNuevaObservacion("");
      setShowOferta(false);
      setOfertaItems([]);
      setOfertaEditId(null);
      setDescuentoOferta("");
      setObservacionEditId(null);
      setObservacionEditTexto("");
      // Restaurar marcas desde la base de datos
      axios.get(`${API_BASE_URL}/api/pacientes/${id}/marcados`, { headers: authHeaders })
        .then(res => setTratamientosMarcadosRaw(res.data || {}))
        .catch(() => setTratamientosMarcadosRaw({}));
      setFotosPaciente([]);
      setMostrarTodasFotos(false);
      setArchivosFotosPaciente([]);
      setNombreTratamientoFoto("");
      setFotoPreview(null);
      try {
        const obsRes = await axios.get(`${API_BASE_URL}/api/pacientes/${id}/observaciones`, {
          headers: authHeaders,
        });
        setObservaciones(Array.isArray(obsRes.data) ? obsRes.data : []);
      } catch (e) {
        console.error("Error al obtener observaciones:", e);
        setObservaciones([]);
      }

      try {
        const ofertasRes = await axios.get(`${API_BASE_URL}/api/pacientes/${id}/ofertas`, {
          headers: authHeaders,
        });
        setOfertas(Array.isArray(ofertasRes.data) ? ofertasRes.data : []);
      } catch (e) {
        console.error("Error al obtener ofertas:", e);
        setOfertas([]);
      }

      try {
        const deudaRes = await axios.get(`${API_BASE_URL}/api/deudas/resumen/${id}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        setResumenDeuda({
          cantidad_pendiente: Number(deudaRes?.data?.cantidad_pendiente || 0),
          total_pendiente: Number(deudaRes?.data?.total_pendiente || 0),
        });
      } catch (e) {
        console.error("Error al obtener resumen de deuda:", e);
        setResumenDeuda({ cantidad_pendiente: 0, total_pendiente: 0 });
      }

      try {
        const res = await axios.get(`${API_BASE_URL}/api/tratamientos/historial/${id}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        setTratamientos(Array.isArray(res.data) ? res.data : []);
      } catch (e) {
        console.error("Error al obtener tratamientos del historial:", e);
        setTratamientos([]);
      }

      // Cargar paquetes asignados al paciente
      try {
        const paquetesRes = await axios.get(`${API_BASE_URL}/api/paquetes/paciente/${id}`, {
          headers: authHeaders,
        });
        setPaquetesPaciente(Array.isArray(paquetesRes.data) ? paquetesRes.data : []);
      } catch (e) {
        console.error("Error al obtener paquetes del paciente:", e);
        setPaquetesPaciente([]);
      }

      // Cargar presupuestos asignados al paciente
      try {
        const presupuestosRes = await axios.get(`${API_BASE_URL}/api/paquetes/presupuestos/paciente/${id}`, {
          headers: authHeaders,
        });
        setPresupuestosAsignados(Array.isArray(presupuestosRes.data) ? presupuestosRes.data : []);
      } catch (e) {
        console.error("Error al obtener presupuestos asignados:", e);
        setPresupuestosAsignados([]);
      }

      // Cargar fotos del paciente
      try {
        const fotosRes = await axios.get(`${API_BASE_URL}/api/pacientes/${id}/fotos`, {
          headers: authHeaders,
        });
        setFotosPaciente(Array.isArray(fotosRes.data) ? fotosRes.data : []);
      } catch (e) {
        console.error("Error al obtener fotos del paciente:", e);
        setFotosPaciente([]);
      }

      // Cargar carritos del paciente
      try {
        const carritosRes = await axios.get(`${API_BASE_URL}/api/paquetes/carritos/paciente/${id}`, { headers: authHeaders });
        setCarritoPaciente(Array.isArray(carritosRes.data) ? carritosRes.data : []);
      } catch (e) {
        setCarritoPaciente([]);
      }
    } catch (error) {
      console.error("Error al obtener historial clínico:", error);
    }
  };

  // Refetch silencioso para sincronización en tiempo real (no resetea UI)
  const refetchPacienteActual = useCallback(async () => {
    const id = pacienteSeleccionado?.id;
    if (!id) return;
    try {
      const [ofertasRes, presupuestosRes, tratRes, deudaRes, paquetesRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/api/pacientes/${id}/ofertas`, { headers: authHeaders }).catch(() => ({ data: [] })),
        axios.get(`${API_BASE_URL}/api/paquetes/presupuestos/paciente/${id}`, { headers: authHeaders }).catch(() => ({ data: [] })),
        axios.get(`${API_BASE_URL}/api/tratamientos/historial/${id}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} }).catch(() => ({ data: [] })),
        axios.get(`${API_BASE_URL}/api/deudas/resumen/${id}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} }).catch(() => ({ data: {} })),
        axios.get(`${API_BASE_URL}/api/paquetes/paciente/${id}`, { headers: authHeaders }).catch(() => ({ data: [] })),
      ]);
      setOfertas(Array.isArray(ofertasRes.data) ? ofertasRes.data : []);
      setPresupuestosAsignados(Array.isArray(presupuestosRes.data) ? presupuestosRes.data : []);
      setTratamientos(Array.isArray(tratRes.data) ? tratRes.data : []);
      setResumenDeuda({
        cantidad_pendiente: Number(deudaRes?.data?.cantidad_pendiente || 0),
        total_pendiente: Number(deudaRes?.data?.total_pendiente || 0),
      });
      setPaquetesPaciente(Array.isArray(paquetesRes.data) ? paquetesRes.data : []);
    } catch (_) {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pacienteSeleccionado?.id]);

  // Sincronización en tiempo real: recargar datos del paciente cuando otro dispositivo hace cambios
  useSocket(
    ["pacientes:updated", "paquetes:updated", "finanzas:updated", "deudas:updated", "tratamientos:updated"],
    refetchPacienteActual,
    !!pacienteSeleccionado?.id
  );

  // Asignar paquete al paciente
  const asignarPaquete = async (paquete) => {
    if (!pacienteSeleccionado?.id) return;
    
    setAsignandoPaquete(true);
    try {
      await axios.post(
        `${API_BASE_URL}/api/paquetes/asignar`,
        {
          paciente_id: pacienteSeleccionado.id,
          paquete_id: paquete.id,
        },
        { headers: authHeaders }
      );
      
      showToast({ severity: "success", message: `Paquete "${paquete.nombre}" asignado exitosamente` });
      
      // Recargar paquetes del paciente
      const paquetesRes = await axios.get(`${API_BASE_URL}/api/paquetes/paciente/${pacienteSeleccionado.id}`, {
        headers: authHeaders,
      });
      setPaquetesPaciente(Array.isArray(paquetesRes.data) ? paquetesRes.data : []);
    } catch (error) {
      console.error("Error al asignar paquete:", error);
      showToast({ severity: "error", message: error.response?.data?.message || "Error al asignar paquete" });
    } finally {
      setAsignandoPaquete(false);
    }
  };

  // Marcar sesión como completada
  const completarSesion = async (sesionId) => {
    const especialistaId = especialistasPorSesion[`paquete_${sesionId}`];
    
    if (!especialistaId) {
      showToast({ severity: "warning", message: "Por favor selecciona un especialista" });
      return;
    }

    try {
      await axios.patch(
        `${API_BASE_URL}/api/paquetes/sesion/${sesionId}/completar`,
        { especialista_id: especialistaId },
        { headers: authHeaders }
      );
      
      showToast({ severity: "success", message: "Sesión completada" });
      
      // Limpiar especialista seleccionado
      setEspecialistasPorSesion(prev => {
        const newState = { ...prev };
        delete newState[`paquete_${sesionId}`];
        return newState;
      });
      
      // Recargar paquetes del paciente
      const paquetesRes = await axios.get(`${API_BASE_URL}/api/paquetes/paciente/${pacienteSeleccionado.id}`, {
        headers: authHeaders,
      });
      setPaquetesPaciente(Array.isArray(paquetesRes.data) ? paquetesRes.data : []);
    } catch (error) {
      console.error("Error al completar sesión:", error);
      showToast({ severity: "error", message: error.response?.data?.message || "Error al completar sesión" });
    }
  };

  // Desmarcar sesión (revertir completada)
  const desmarcarSesion = async (sesionId) => {
    try {
      await axios.patch(
        `${API_BASE_URL}/api/paquetes/sesion/${sesionId}/desmarcar`,
        {},
        { headers: authHeaders }
      );
      
      showToast({ severity: "success", message: "Sesión desmarcada" });
      
      // Recargar paquetes del paciente
      const paquetesRes = await axios.get(`${API_BASE_URL}/api/paquetes/paciente/${pacienteSeleccionado.id}`, {
        headers: authHeaders,
      });
      setPaquetesPaciente(Array.isArray(paquetesRes.data) ? paquetesRes.data : []);
    } catch (error) {
      console.error("Error al desmarcar sesión:", error);
      showToast({ severity: "error", message: error.response?.data?.message || "Error al desmarcar sesión" });
    }
  };

  // Eliminar paquete del paciente
  const eliminarPaquetePaciente = async (paquetePacienteId) => {
    if (!window.confirm("¿Estás seguro de eliminar este paquete del paciente? Esta acción no se puede deshacer.")) {
      return;
    }
    
    try {
      await axios.delete(
        `${API_BASE_URL}/api/paquetes/paciente/${paquetePacienteId}`,
        { headers: authHeaders }
      );
      
      showToast({ severity: "success", message: "Paquete eliminado" });
      
      // Recargar paquetes del paciente
      const paquetesRes = await axios.get(`${API_BASE_URL}/api/paquetes/paciente/${pacienteSeleccionado.id}`, {
        headers: authHeaders,
      });
      setPaquetesPaciente(Array.isArray(paquetesRes.data) ? paquetesRes.data : []);
    } catch (error) {
      console.error("Error al eliminar paquete:", error);
      showToast({ severity: "error", message: error.response?.data?.message || "Error al eliminar paquete" });
    }
  };

  // === PRESUPUESTO CORPORAL ===
  const cargarCorporal = async () => {
    if (!pacienteSeleccionado?.id) return;
    try {
      const res = await axios.get(`${API_BASE_URL}/api/pacientes/${pacienteSeleccionado.id}/corporal`, { headers: authHeaders });
      setCorporalRegistros(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Error al cargar corporal:", err);
    }
  };

  const resetCorporalForm = () => {
    setCorporalEditId(null);
    setCorporalTipo("evaluacion");
    setCorporalTablas([{ titulo: "Mediciones", filas: [{ cintura: "", cadera: "", muslos: "", gluteos: "", brazos: "", abdomen_alto: "", abdomen_medio: "", abdomen_bajo: "", sesion: "1ra sesión", datos: "" }] }]);
    setCorporalActividad("");
    setCorporalObservaciones("");
  };

  const abrirModalCorporal = () => {
    resetCorporalForm();
    cargarCorporal();
    setModalCorporal(true);
  };

  const editarCorporal = (registro) => {
    setCorporalEditId(registro.id);
    setCorporalTipo(registro.tipo || "evaluacion");
    // Deep clone para evitar mutaciones por referencia
    const tablasClone = JSON.parse(JSON.stringify(registro.tablas_json || [{ titulo: "Mediciones", filas: [{ cintura: "", cadera: "", muslos: "", gluteos: "", brazos: "", abdomen_alto: "", abdomen_medio: "", abdomen_bajo: "", sesion: "1ra sesión", datos: "" }] }]));
    setCorporalTablas(tablasClone);
    setCorporalActividad(registro.actividad_fisica || "");
    setCorporalObservaciones(registro.observaciones || "");
  };

  const guardarCorporal = async () => {
    if (!pacienteSeleccionado?.id) return;
    setGuardandoCorporal(true);
    try {
      const payload = {
        tipo: corporalTipo,
        tablas_json: JSON.parse(JSON.stringify(corporalTablas)),
        actividad_fisica: corporalActividad,
        observaciones: corporalObservaciones,
      };
      if (corporalEditId) {
        const resp = await axios.put(`${API_BASE_URL}/api/pacientes/corporal/${corporalEditId}`, payload, { headers: authHeaders });
        if (resp.data?.warning) {
          showToast({ severity: "warning", message: resp.data.warning });
        } else {
          showToast({ severity: "success", message: "Registro corporal actualizado" });
        }
      } else {
        await axios.post(`${API_BASE_URL}/api/pacientes/${pacienteSeleccionado.id}/corporal`, payload, { headers: authHeaders });
        showToast({ severity: "success", message: "Registro corporal creado" });
      }
      // Recargar datos ANTES de resetear formulario
      await cargarCorporal();
      resetCorporalForm();
    } catch (err) {
      console.error("Error al guardar corporal:", err);
      showToast({ severity: "error", message: err.response?.data?.message || "Error al guardar registro corporal" });
    } finally {
      setGuardandoCorporal(false);
    }
  };

  const eliminarCorporal = async (corporalId) => {
    try {
      await axios.delete(`${API_BASE_URL}/api/pacientes/corporal/${corporalId}`, { headers: authHeaders });
      showToast({ severity: "success", message: "Registro eliminado" });
      await cargarCorporal();
    } catch (err) {
      console.error("Error al eliminar corporal:", err);
      showToast({ severity: "error", message: "Error al eliminar" });
    }
  };

  // === MAPA FACIAL 3D ===
  const cargarFacial = async () => {
    if (!pacienteSeleccionado?.id) return;
    try {
      const res = await axios.get(`${API_BASE_URL}/api/pacientes/${pacienteSeleccionado.id}/mapa-facial`, { headers: authHeaders });
      setFacialRegistros(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Error al cargar mapa facial:", err);
    }
  };

  const abrirModalFacial = () => {
    cargarFacial();
    setModalFacial(true);
  };

  const guardarFacial = async (payload) => {
    if (!pacienteSeleccionado?.id) return;
    setGuardandoFacial(true);
    try {
      await axios.post(`${API_BASE_URL}/api/pacientes/${pacienteSeleccionado.id}/mapa-facial`, payload, { headers: authHeaders });
      showToast({ severity: "success", message: "Mapa facial guardado" });
      await cargarFacial();
    } catch (err) {
      console.error("Error al guardar mapa facial:", err);
      showToast({ severity: "error", message: "Error al guardar mapa facial" });
    } finally {
      setGuardandoFacial(false);
    }
  };

  const actualizarFacial = async (mapaId, payload) => {
    setGuardandoFacial(true);
    try {
      await axios.put(`${API_BASE_URL}/api/pacientes/mapa-facial/${mapaId}`, payload, { headers: authHeaders });
      showToast({ severity: "success", message: "Mapa facial actualizado" });
      await cargarFacial();
    } catch (err) {
      console.error("Error al actualizar mapa facial:", err);
      showToast({ severity: "error", message: "Error al actualizar mapa facial" });
    } finally {
      setGuardandoFacial(false);
    }
  };

  const eliminarFacial = async (mapaId) => {
    try {
      await axios.delete(`${API_BASE_URL}/api/pacientes/mapa-facial/${mapaId}`, { headers: authHeaders });
      showToast({ severity: "success", message: "Registro facial eliminado" });
      await cargarFacial();
    } catch (err) {
      console.error("Error al eliminar mapa facial:", err);
      showToast({ severity: "error", message: "Error al eliminar" });
    }
  };

  // === CARRITO DE TRATAMIENTOS ===
  const cargarCarritos = useCallback(async (pacienteId) => {
    if (!pacienteId) return;
    try {
      const res = await axios.get(`${API_BASE_URL}/api/paquetes/carritos/paciente/${pacienteId}`, { headers: authHeaders });
      setCarritoPaciente(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Error al cargar carritos:", err);
    }
  }, [authHeaders]);

  const abrirCarritoModal = async () => {
    if (!pacienteSeleccionado?.id) return;
    await cargarCarritos(pacienteSeleccionado.id);
    // Cargar items del primer carrito activo si existe
    const res = await axios.get(`${API_BASE_URL}/api/paquetes/carritos/paciente/${pacienteSeleccionado.id}`, { headers: authHeaders });
    const carritos = Array.isArray(res.data) ? res.data : [];
    if (carritos.length > 0) {
      const carritoRes = await axios.get(`${API_BASE_URL}/api/paquetes/carritos/${carritos[0].id}`, { headers: authHeaders });
      setCarritoActivo(carritoRes.data);
    } else {
      setCarritoActivo(null);
    }
    setModalCarrito(true);
  };

  const agregarAlCarrito = async (item, animKey) => {
    if (!pacienteSeleccionado?.id) return;
    try {
      // Obtener o crear carrito
      let carritoId;
      const resCarritos = await axios.get(`${API_BASE_URL}/api/paquetes/carritos/paciente/${pacienteSeleccionado.id}`, { headers: authHeaders });
      const carritos = Array.isArray(resCarritos.data) ? resCarritos.data : [];
      
      if (carritos.length > 0) {
        carritoId = carritos[0].id;
      } else {
        const crearRes = await axios.post(`${API_BASE_URL}/api/paquetes/carritos/crear`, {
          paciente_id: pacienteSeleccionado.id,
          nombre: `Carrito de ${pacienteSeleccionado.nombre}`
        }, { headers: authHeaders });
        carritoId = crearRes.data.carrito_id;
      }

      // Soportar tanto items de oferta como sesiones de presupuesto
      const nombre = item.nombre || item.tratamiento_nombre;
      const tId = item.tratamientoId || item.tratamiento_id || null;
      const precio = Number(item.precio || item.precio_sesion || 0);
      const sesiones = Number(item.sesiones || item.total_sesiones || 1);

      await axios.post(`${API_BASE_URL}/api/paquetes/carritos/${carritoId}/items`, {
        tratamiento_id: tId,
        tratamiento_nombre: nombre,
        precio,
        sesiones,
      }, { headers: authHeaders });

      // Animación
      setCarritoAnimacion(animKey || item.id);
      setTimeout(() => setCarritoAnimacion(null), 800);

      showToast({ severity: "success", message: `🛒 ${nombre} agregado al carrito` });
      await cargarCarritos(pacienteSeleccionado.id);
    } catch (err) {
      console.error("Error al agregar al carrito:", err);
      showToast({ severity: "error", message: "Error al agregar al carrito" });
    }
  };

  const eliminarItemCarrito = async (itemId) => {
    try {
      await axios.delete(`${API_BASE_URL}/api/paquetes/carritos/items/${itemId}`, { headers: authHeaders });
      showToast({ severity: "success", message: "Item eliminado del carrito" });
      // Recargar carrito activo
      if (carritoActivo?.id) {
        const res = await axios.get(`${API_BASE_URL}/api/paquetes/carritos/${carritoActivo.id}`, { headers: authHeaders });
        setCarritoActivo(res.data);
      }
      await cargarCarritos(pacienteSeleccionado.id);
    } catch (err) {
      console.error("Error al eliminar item:", err);
      showToast({ severity: "error", message: "Error al eliminar" });
    }
  };

  const eliminarCarrito = async (carritoId) => {
    try {
      await axios.delete(`${API_BASE_URL}/api/paquetes/carritos/${carritoId}`, { headers: authHeaders });
      showToast({ severity: "success", message: "Carrito eliminado" });
      setCarritoActivo(null);
      await cargarCarritos(pacienteSeleccionado.id);
    } catch (err) {
      console.error("Error al eliminar carrito:", err);
      showToast({ severity: "error", message: "Error al eliminar carrito" });
    }
  };

  // Abrir carrusel de imágenes del tratamiento
  const abrirCarruselTratamiento = async (tratamientoId, nombreTratamiento) => {
    try {
      const res = await axios.get(
        `${API_BASE_URL}/api/tratamientos/protocolo/${tratamientoId}/imagenes`,
        { headers: authHeaders }
      );
      const imgs = Array.isArray(res.data) ? res.data : [];
      if (imgs.length === 0) {
        showToast({ severity: "info", message: "Este tratamiento no tiene imágenes" });
        return;
      }
      setCarruselImagenes(imgs);
      setCarruselIdx(0);
      setCarruselNombre(nombreTratamiento);
      setModalCarrusel(true);
    } catch (err) {
      console.error("Error al cargar imágenes:", err);
    }
  };

  // Cargar TODAS las imágenes de cada tratamiento para mostrar en cards del presupuesto
  const cargarImagenesPresupuesto = useCallback(async (sesiones) => {
    if (!sesiones || sesiones.length === 0) return;
    const idsUnicos = [...new Set(sesiones.map(s => s.tratamiento_id).filter(Boolean))];
    const faltantes = idsUnicos.filter(id => !(id in tratamientoImagenCache));
    if (faltantes.length === 0) return;
    
    const nuevasImagenes = {};
    await Promise.all(faltantes.map(async (tId) => {
      try {
        const res = await axios.get(
          `${API_BASE_URL}/api/tratamientos/protocolo/${tId}/imagenes`,
          { headers: authHeaders }
        );
        const imgs = Array.isArray(res.data) ? res.data : [];
        // Store array of all image URLs
        nuevasImagenes[tId] = imgs.length > 0 ? imgs.map(img => `${API_BASE_URL}${img.imagen_url}`) : [];
      } catch {
        nuevasImagenes[tId] = [];
      }
    }));
    
    setTratamientoImagenCache(prev => ({ ...prev, ...nuevasImagenes }));
  }, [tratamientoImagenCache, authHeaders]);

  // Asignar presupuesto al paciente
  const asignarPresupuesto = async (oferta, marcas) => {
    if (!pacienteSeleccionado?.id) return;
    
    const espId = especialistaPorPresupuesto[oferta.id];
    if (!espId) {
      showToast({ severity: "warning", message: "Por favor selecciona un especialista para este presupuesto" });
      return;
    }
    
    setAsignandoPresupuesto(true);
    try {
      await axios.post(
        `${API_BASE_URL}/api/paquetes/presupuesto/asignar`,
        {
          paciente_id: pacienteSeleccionado.id,
          oferta_id: oferta.id,
          marcas: marcas || {},
          especialista_id: espId,
        },
        { headers: authHeaders }
      );
      
      showToast({ severity: "success", message: "Presupuesto asignado exitosamente" });
      
      // Recargar presupuestos asignados
      const presupuestosRes = await axios.get(`${API_BASE_URL}/api/paquetes/presupuestos/paciente/${pacienteSeleccionado.id}`, {
        headers: authHeaders,
      });
      setPresupuestosAsignados(Array.isArray(presupuestosRes.data) ? presupuestosRes.data : []);
    } catch (error) {
      console.error("Error al asignar presupuesto:", error);
      showToast({ severity: "error", message: error.response?.data?.message || "Error al asignar presupuesto" });
    } finally {
      setAsignandoPresupuesto(false);
    }
  };

  // Completar sesión de presupuesto
  const completarSesionPresupuesto = async (sesionId) => {
    const especialistaId = especialistasPorSesion[`presupuesto_${sesionId}`];
    
    if (!especialistaId) {
      showToast({ severity: "warning", message: "Por favor selecciona un especialista" });
      return;
    }

    try {
      await axios.patch(
        `${API_BASE_URL}/api/paquetes/presupuesto/sesion/${sesionId}/completar`,
        { especialista_id: especialistaId },
        { headers: authHeaders }
      );
      
      showToast({ severity: "success", message: "Tratamiento completado" });
      
      // Limpiar especialista seleccionado
      setEspecialistasPorSesion(prev => {
        const newState = { ...prev };
        delete newState[`presupuesto_${sesionId}`];
        return newState;
      });
      
      // Recargar presupuestos asignados
      const presupuestosRes = await axios.get(`${API_BASE_URL}/api/paquetes/presupuestos/paciente/${pacienteSeleccionado.id}`, {
        headers: authHeaders,
      });
      setPresupuestosAsignados(Array.isArray(presupuestosRes.data) ? presupuestosRes.data : []);
    } catch (error) {
      console.error("Error al completar tratamiento:", error);
      showToast({ severity: "error", message: error.response?.data?.message || "Error al completar tratamiento" });
    }
  };

  // Desmarcar sesión de presupuesto
  const desmarcarSesionPresupuesto = async (sesionId) => {
    try {
      await axios.patch(
        `${API_BASE_URL}/api/paquetes/presupuesto/sesion/${sesionId}/desmarcar`,
        {},
        { headers: authHeaders }
      );
      
      showToast({ severity: "success", message: "Tratamiento desmarcado" });
      
      // Recargar presupuestos asignados
      const presupuestosRes = await axios.get(`${API_BASE_URL}/api/paquetes/presupuestos/paciente/${pacienteSeleccionado.id}`, {
        headers: authHeaders,
      });
      setPresupuestosAsignados(Array.isArray(presupuestosRes.data) ? presupuestosRes.data : []);
    } catch (error) {
      console.error("Error al desmarcar tratamiento:", error);
      showToast({ severity: "error", message: error.response?.data?.message || "Error al desmarcar tratamiento" });
    }
  };

  // Eliminar presupuesto asignado
  const eliminarPresupuestoAsignado = async (presupuestoAsignadoId) => {
    if (!window.confirm("¿Estás seguro de eliminar este presupuesto asignado?")) return;
    
    try {
      await axios.delete(
        `${API_BASE_URL}/api/paquetes/presupuesto/paciente/${presupuestoAsignadoId}`,
        { headers: authHeaders }
      );
      
      showToast({ severity: "success", message: "Presupuesto eliminado" });
      
      // Recargar presupuestos asignados
      const presupuestosRes = await axios.get(`${API_BASE_URL}/api/paquetes/presupuestos/paciente/${pacienteSeleccionado.id}`, {
        headers: authHeaders,
      });
      setPresupuestosAsignados(Array.isArray(presupuestosRes.data) ? presupuestosRes.data : []);
    } catch (error) {
      console.error("Error al eliminar presupuesto:", error);
      showToast({ severity: "error", message: error.response?.data?.message || "Error al eliminar presupuesto" });
    }
  };

  // Registrar pago de presupuesto (total, adelanto o saldo)
  const registrarPagoPresupuesto = async (presupuestoId, monto, metodoPago, tipoPago = 'total') => {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/api/paquetes/presupuesto/${presupuestoId}/pago`,
        {
          monto: monto,
          metodo_pago: metodoPago,
          tipo_pago: tipoPago, // 'total', 'adelanto', 'saldo'
        },
        { headers: authHeaders }
      );
      
      const tipoMsg = tipoPago === 'adelanto' ? 'Adelanto' : tipoPago === 'saldo' ? 'Saldo' : 'Pago';
      showToast({ severity: "success", message: `${tipoMsg} registrado exitosamente` });
      
      // Recargar presupuestos asignados
      const presupuestosRes = await axios.get(`${API_BASE_URL}/api/paquetes/presupuestos/paciente/${pacienteSeleccionado.id}`, {
        headers: authHeaders,
      });
      setPresupuestosAsignados(Array.isArray(presupuestosRes.data) ? presupuestosRes.data : []);
      
      return response.data;
    } catch (error) {
      console.error("Error al registrar pago:", error);
      showToast({ severity: "error", message: error.response?.data?.message || "Error al registrar pago" });
      throw error;
    }
  };

  // Guardar descuento de presupuesto
  const guardarDescuentoPresupuesto = async () => {
    if (!presupuestoParaDescuento || !pacienteSeleccionado) return;
    
    try {
      await axios.patch(
        `${API_BASE_URL}/api/pacientes/${pacienteSeleccionado.id}/ofertas/${presupuestoParaDescuento.id}/descuento`,
        { descuento: Number(nuevoDescuento) || 0 },
        { headers: authHeaders }
      );
      
      showToast({ severity: "success", message: "Descuento actualizado correctamente" });
      setModalDescuentoPresupuesto(false);
      
      // Recargar ofertas
      const ofertasRes = await axios.get(`${API_BASE_URL}/api/pacientes/${pacienteSeleccionado.id}/ofertas`, {
        headers: authHeaders,
      });
      setOfertas(Array.isArray(ofertasRes.data) ? ofertasRes.data : []);
    } catch (error) {
      console.error("Error al guardar descuento:", error);
      showToast({ severity: "error", message: "Error al guardar descuento" });
    }
  };

  // Editar pago de presupuesto (solo master)
  const guardarEditarPagoPresupuesto = async () => {
    if (!presupuestoEditarPago || !pacienteSeleccionado) return;
    const monto = parseFloat(nuevoMontoPagadoPresupuesto);
    if (isNaN(monto) || monto < 0) {
      showToast({ severity: "warning", message: "Ingresa un monto válido" });
      return;
    }
    try {
      setGuardandoEditPago(true);
      await axios.put(
        `${API_BASE_URL}/api/paquetes/presupuesto/${presupuestoEditarPago.id}/editar-pago`,
        { monto_pagado: monto },
        { headers: authHeaders }
      );
      showToast({ severity: "success", message: "Pago de presupuesto actualizado correctamente" });
      setModalEditarPagoPresupuesto(false);
      // Recargar presupuestos asignados
      const presupuestosRes = await axios.get(`${API_BASE_URL}/api/paquetes/presupuestos/paciente/${pacienteSeleccionado.id}`, {
        headers: authHeaders,
      });
      setPresupuestosAsignados(Array.isArray(presupuestosRes.data) ? presupuestosRes.data : []);
    } catch (error) {
      console.error("Error al editar pago:", error);
      showToast({ severity: "error", message: error.response?.data?.message || "Error al editar pago" });
    } finally {
      setGuardandoEditPago(false);
    }
  };

  // Editar pago de paquete (solo master)
  const guardarEditarPagoPaquete = async () => {
    if (!paqueteEditarPago || !pacienteSeleccionado) return;
    const monto = parseFloat(nuevoMontoPagadoPaquete);
    if (isNaN(monto) || monto < 0) {
      showToast({ severity: "warning", message: "Ingresa un monto válido" });
      return;
    }
    try {
      setGuardandoEditPagoPaquete(true);
      await axios.put(
        `${API_BASE_URL}/api/paquetes/paquete-paciente/${paqueteEditarPago.id}/editar-pago`,
        { monto_pagado: monto },
        { headers: authHeaders }
      );
      showToast({ severity: "success", message: "Pago de paquete actualizado correctamente" });
      setModalEditarPagoPaquete(false);
      // Recargar paquetes del paciente
      const paquetesRes = await axios.get(`${API_BASE_URL}/api/paquetes/paciente/${pacienteSeleccionado.id}`, {
        headers: authHeaders,
      });
      setPaquetesPaciente(Array.isArray(paquetesRes.data) ? paquetesRes.data : []);
    } catch (error) {
      console.error("Error al editar pago de paquete:", error);
      showToast({ severity: "error", message: error.response?.data?.message || "Error al editar pago" });
    } finally {
      setGuardandoEditPagoPaquete(false);
    }
  };

  // Registrar pago de paquete (total, adelanto o saldo)
  const registrarPagoPaquete = async (paqueteId, monto, metodoPagoVal, tipoPagoVal = 'total') => {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/api/paquetes/paquete-paciente/${paqueteId}/pago`,
        {
          monto: monto,
          metodo_pago: metodoPagoVal,
          tipo_pago: tipoPagoVal,
        },
        { headers: authHeaders }
      );
      
      const tipoMsg = tipoPagoVal === 'adelanto' ? 'Adelanto' : tipoPagoVal === 'saldo' ? 'Saldo' : 'Pago';
      showToast({ severity: "success", message: `${tipoMsg} registrado exitosamente` });
      
      // Recargar paquetes del paciente
      const paquetesRes = await axios.get(`${API_BASE_URL}/api/paquetes/paciente/${pacienteSeleccionado.id}`, {
        headers: authHeaders,
      });
      setPaquetesPaciente(Array.isArray(paquetesRes.data) ? paquetesRes.data : []);
      
      return response.data;
    } catch (error) {
      console.error("Error al registrar pago de paquete:", error);
      showToast({ severity: "error", message: error.response?.data?.message || "Error al registrar pago" });
      throw error;
    }
  };

  // Registrar pago de consulta (paquetes)
  const registrarPagoConsulta = async (paqueteId, monto, metodoPagoVal) => {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/api/paquetes/paquete-paciente/${paqueteId}/consulta`,
        {
          monto_consulta: monto,
          metodo_pago: metodoPagoVal,
        },
        { headers: authHeaders }
      );
      
      showToast({ severity: "success", message: "Pago de consulta registrado exitosamente" });
      
      // Recargar paquetes del paciente
      const paquetesRes = await axios.get(`${API_BASE_URL}/api/paquetes/paciente/${pacienteSeleccionado.id}`, {
        headers: authHeaders,
      });
      setPaquetesPaciente(Array.isArray(paquetesRes.data) ? paquetesRes.data : []);
      
      return response.data;
    } catch (error) {
      console.error("Error al registrar pago de consulta:", error);
      showToast({ severity: "error", message: error.response?.data?.message || "Error al registrar pago de consulta" });
      throw error;
    }
  };

  // Registrar pago de consulta (presupuestos)
  const registrarPagoConsultaPresupuesto = async (presupuestoId, monto, metodoPagoVal) => {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/api/paquetes/presupuesto/${presupuestoId}/consulta`,
        {
          monto_consulta: monto,
          metodo_pago: metodoPagoVal,
        },
        { headers: authHeaders }
      );
      
      showToast({ severity: "success", message: "Pago de consulta registrado exitosamente" });
      
      // Recargar presupuestos del paciente
      const presupuestosRes = await axios.get(`${API_BASE_URL}/api/paquetes/presupuestos/paciente/${pacienteSeleccionado.id}`, {
        headers: authHeaders,
      });
      setPresupuestosAsignados(Array.isArray(presupuestosRes.data) ? presupuestosRes.data : []);
      
      return response.data;
    } catch (error) {
      console.error("Error al registrar pago de consulta en presupuesto:", error);
      showToast({ severity: "error", message: error.response?.data?.message || "Error al registrar pago de consulta" });
      throw error;
    }
  };

  const subirFotosPaciente = async () => {
    if (!pacienteSeleccionado?.id || !archivosFotosPaciente.length) return;
    if (!nombreTratamientoFoto.trim()) {
      showToast({ severity: "warning", message: "Escribe el nombre del tratamiento para las fotos" });
      return;
    }
    try {
      setSubiendoFotosPaciente(true);
      const formData = new FormData();
      archivosFotosPaciente.forEach((f) => formData.append("fotos", f));
      formData.append("nombre_tratamiento", nombreTratamientoFoto.trim());

      await axios.post(
        `${API_BASE_URL}/api/pacientes/${pacienteSeleccionado.id}/fotos`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
            ...authHeaders,
          },
        }
      );

      showToast({ severity: "success", message: "Fotos subidas correctamente" });
      setArchivosFotosPaciente([]);
      setNombreTratamientoFoto("");

      const fotosRes = await axios.get(`${API_BASE_URL}/api/pacientes/${pacienteSeleccionado.id}/fotos`, {
        headers: authHeaders,
      });
      setFotosPaciente(Array.isArray(fotosRes.data) ? fotosRes.data : []);
    } catch (e) {
      console.error("Error al subir fotos:", e);
      showToast({ severity: "error", message: "Error al subir fotos" });
    } finally {
      setSubiendoFotosPaciente(false);
    }
  };

  const eliminarFotoPaciente = async (fotoId) => {
    if (!pacienteSeleccionado?.id) return;
    try {
      await axios.delete(`${API_BASE_URL}/api/pacientes/${pacienteSeleccionado.id}/fotos/${fotoId}`, {
        headers: authHeaders,
      });
      setFotosPaciente((prev) => prev.filter((f) => f.id !== fotoId));
      showToast({ severity: "success", message: "Foto eliminada" });
    } catch (e) {
      console.error("Error al eliminar foto:", e);
      showToast({ severity: "error", message: "Error al eliminar foto" });
    }
  };

  const guardarEdicionObservacion = async () => {
    if (!pacienteSeleccionado?.id) return;
    if (!observacionEditId) return;

    try {
      setGuardandoObservacionEdit(true);
      await axios.put(
        `${API_BASE_URL}/api/pacientes/${pacienteSeleccionado.id}/observaciones/${observacionEditId}`,
        { texto: observacionEditTexto },
        { headers: authHeaders }
      );

      const obsRes = await axios.get(
        `${API_BASE_URL}/api/pacientes/${pacienteSeleccionado.id}/observaciones`,
        { headers: authHeaders }
      );
      setObservaciones(Array.isArray(obsRes.data) ? obsRes.data : []);
      setObservacionEditId(null);
      setObservacionEditTexto("");
      showToast({ severity: "success", message: "Observación actualizada" });
    } catch (e) {
      console.error("Error al editar observación:", e);
      showToast({ severity: "error", message: "Error al editar observación" });
    } finally {
      setGuardandoObservacionEdit(false);
    }
  };

  // Generar recibo PDF del paquete
  const generarReciboPaquete = (paquete) => {
    if (!pacienteSeleccionado || !paquete) return;

    const doc = new jsPDF("p", "mm", [80, 250]);
    const pageWidth = 80;
    let y = 5;

    // Color dorado para elementos destacados
    const colorDorado = [163, 105, 32];

    // Logo más grande y centrado
    try {
      const logoImg = new Image();
      logoImg.src = '/logo-showclinic.png';
      doc.addImage(logoImg, 'PNG', pageWidth / 2 - 15, y, 30, 30);
      y += 32;
    } catch (e) {
      y += 2;
    }

    // Encabezado con mejor tipografía
    doc.setTextColor(...colorDorado);
    doc.setFontSize(18);
    doc.setFont("times", "bold");
    doc.text("SHOWCLINIC", pageWidth / 2, y, { align: "center" });
    y += 6;

    doc.setTextColor(0, 0, 0);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text("Centro de Estética Avanzada", pageWidth / 2, y, { align: "center" });
    y += 5;
    
    // Dirección con mejor espaciado
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "bold");
    doc.text("Av. Ejército 616, Centro de Negocios", pageWidth / 2, y, { align: "center" });
    y += 3.5;
    doc.text("Yanahuara, Arequipa - Perú", pageWidth / 2, y, { align: "center" });
    y += 4.5;
    
    // Teléfono destacado y centrado
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    const telText = "Tel: 974 212 114";
    const telWidth = doc.getTextWidth(telText);
    doc.text(telText, (pageWidth - telWidth) / 2, y);
    y += 7;

    // Línea separadora
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.3);
    doc.line(5, y, pageWidth - 5, y);
    y += 5;

    // Datos del paciente con mejor formato
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(8.5);
    doc.setFont("helvetica", "bold");
    const nombrePaciente = `${pacienteSeleccionado.nombre || ""} ${pacienteSeleccionado.apellido || ""}`.trim();
    doc.text("Cliente:", 5, y);
    doc.text(nombrePaciente, 20, y);
    y += 4.5;
    
    doc.text("Documento:", 5, y);
    doc.text(`${pacienteSeleccionado.tipoDocumento || 'DNI'}: ${pacienteSeleccionado.dni || "-"}`, 25, y);
    y += 4.5;
    
    doc.text("Fecha:", 5, y);
    doc.text(new Date().toLocaleDateString("es-PE", { year: 'numeric', month: 'long', day: 'numeric' }), 18, y);
    y += 6;

    // Línea separadora
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.3);
    doc.line(5, y, pageWidth - 5, y);
    y += 5;

    // Nombre del paquete destacado
    doc.setTextColor(...colorDorado);
    doc.setFontSize(10);
    doc.setFont("times", "bold");
    doc.text(paquete.paquete_nombre || "Paquete", pageWidth / 2, y, { align: "center" });
    y += 6;

    // Tratamientos incluidos con mejor diseño
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(8.5);
    doc.setFont("helvetica", "bold");
    doc.text("TRATAMIENTOS INCLUIDOS:", 5, y);
    y += 5;
    
    doc.setFont("helvetica", "bold");
    try {
      const tratamientos = paquete.tratamientos_json ? JSON.parse(paquete.tratamientos_json) : [];
      if (tratamientos.length > 0) {
        tratamientos.forEach((trat) => {
          const nombreTrat = trat.nombre || trat.tratamiento_nombre || 'Tratamiento';
          const sesiones = trat.sesiones || trat.cantidad || 1;
          doc.text(`- ${nombreTrat} (${sesiones} sesión${sesiones > 1 ? 'es' : ''})`, 7, y);
          y += 4;
        });
      }
    } catch (e) {
      doc.text("- Tratamientos del paquete", 7, y);
      y += 3.5;
    }

    y += 2;
    // Línea separadora
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.3);
    doc.line(5, y, pageWidth - 5, y);
    y += 5;

    // Detalles de precio con mejor formato
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(8.5);
    doc.setFont("helvetica", "bold");
    
    const precioOriginal = parseFloat(paquete.precio_total) || 0;
    const montoConsulta = parseFloat(paquete.monto_consulta) || 0;
    const precioFinal = precioOriginal;
    
    doc.text("Precio del paquete:", 5, y);
    doc.text(`S/ ${precioOriginal.toFixed(2)}`, pageWidth - 5, y, { align: "right" });
    y += 4;

    // Mostrar consulta si fue pagada
    if (paquete.consulta_pagada === 1 && montoConsulta > 0) {
      doc.text("Consulta pagada:", 5, y);
      doc.text(`- S/ ${montoConsulta.toFixed(2)}`, pageWidth - 5, y, { align: "right" });
      y += 4;
      
      doc.text("Precio ajustado:", 5, y);
      doc.text(`S/ ${precioFinal.toFixed(2)}`, pageWidth - 5, y, { align: "right" });
      y += 5;
    }

    // Información de pagos
    const montoPagado = parseFloat(paquete.monto_pagado) || 0;
    const saldoPendiente = Math.max(0, precioFinal - montoPagado);

    if (montoPagado > 0) {
      doc.text("Pagado:", 5, y);
      doc.text(`S/ ${montoPagado.toFixed(2)}`, pageWidth - 5, y, { align: "right" });
      y += 4;
    }

    if (saldoPendiente > 0 && paquete.estado_pago !== 'pagado') {
      doc.text("Saldo pendiente:", 5, y);
      doc.text(`S/ ${saldoPendiente.toFixed(2)}`, pageWidth - 5, y, { align: "right" });
      y += 4;
    }

    y += 2;
    // Línea separadora doble
    doc.setDrawColor(...colorDorado);
    doc.setLineWidth(0.5);
    doc.line(5, y, pageWidth - 5, y);
    y += 1;
    doc.setLineWidth(0.2);
    doc.line(5, y, pageWidth - 5, y);
    y += 5;

    // Total destacado con fondo
    doc.setFillColor(250, 245, 230);
    doc.rect(5, y - 3, pageWidth - 10, 7, 'F');
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("TOTAL:", 7, y + 1);
    doc.text(`S/ ${precioFinal.toFixed(2)}`, pageWidth - 7, y + 1, { align: "right" });
    y += 8;

    y += 2;

    // Línea separadora
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.3);
    doc.line(5, y, pageWidth - 5, y);
    y += 5;

    // Mensaje de agradecimiento elegante
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text("¡Gracias por su preferencia!", pageWidth / 2, y, { align: "center" });
    y += 4.5;
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.text("ShowClinic - Tu belleza, nuestra pasión", pageWidth / 2, y, { align: "center" });

    // Abrir en nueva ventana para imprimir
    const pdfBlob = doc.output("blob");
    const pdfUrl = URL.createObjectURL(pdfBlob);
    window.open(pdfUrl, "_blank");
  };

  // Generar recibo EDITABLE del presupuesto (HTML en nueva ventana)
  const generarReciboPresupuesto = (presupuesto) => {
    if (!pacienteSeleccionado || !presupuesto) return;

    // Clasificar tratamientos según marcas de color (gold=pagado, purple=pendiente, gray/sin marca=no se hará)
    const sesiones = presupuesto.sesiones || [];
    let tratamientosJSON = [];
    try { tratamientosJSON = presupuesto.tratamientos_json ? JSON.parse(presupuesto.tratamientos_json) : []; } catch(e) {}

    const tratamientosAgrupados = {};
    let totalGold = 0;
    let totalPurple = 0;

    if (sesiones.length > 0) {
      sesiones.forEach((sesion) => {
        const key = `asig-${presupuesto.id}-${sesion.id}`;
        const estado = tratamientosMarcados[key];
        if (estado === "gold" || estado === "purple") {
          const nombre = sesion.tratamiento_nombre || 'Tratamiento';
          if (!tratamientosAgrupados[nombre]) {
            tratamientosAgrupados[nombre] = { nombre, sesiones: 0, precioTotal: 0, estado };
          }
          tratamientosAgrupados[nombre].sesiones += 1;
          tratamientosAgrupados[nombre].precioTotal += parseFloat(sesion.precio_sesion) || 0;
          if (estado === "gold") tratamientosAgrupados[nombre].estado = "gold";
        }
      });
      Object.values(tratamientosAgrupados).forEach(t => {
        if (t.estado === "gold") totalGold += t.precioTotal;
        else totalPurple += t.precioTotal;
      });
    } else if (tratamientosJSON.length > 0) {
      tratamientosJSON.forEach((trat, idx) => {
        const key = presupuesto.oferta_id ? `${presupuesto.oferta_id}-${idx}` : null;
        const estado = key ? tratamientosMarcados[key] : "gold";
        if (estado === "gold" || estado === "purple" || !key) {
          const precio = parseFloat(trat.precio) || 0;
          const nombre = trat.nombre || trat.tratamiento || 'Tratamiento';
          const numSes = Number(trat.sesiones) || 1;
          tratamientosAgrupados[`${nombre}-${idx}`] = { nombre, sesiones: numSes, precioTotal: precio, estado: estado || "gold" };
          if (estado === "purple") totalPurple += precio;
          else totalGold += precio;
        }
      });
    }

    const itemsBoleta = Object.values(tratamientosAgrupados);
    const totalActivo = totalGold + totalPurple;
    const descuento = parseFloat(presupuesto.descuento) || 0;
    const totalConDescuento = totalActivo - descuento;
    const montoPagadoReal = parseFloat(presupuesto.monto_pagado) || 0;
    const saldoPendienteReal = Math.max(0, totalConDescuento - montoPagadoReal);
    const totalFinal = totalActivo - descuento;
    const montoConsulta = parseFloat(presupuesto.monto_consulta) || 0;
    const nombrePaciente = `${pacienteSeleccionado.nombre || ""} ${pacienteSeleccionado.apellido || ""}`.trim();
    const fechaHoy = new Date().toLocaleDateString("es-PE", { day: '2-digit', month: '2-digit', year: 'numeric' });

    // Generar filas de tratamientos
    const tratamientosHTML = itemsBoleta.length > 0
      ? itemsBoleta.map((item, i) => {
          const sesInfo = item.sesiones > 1 ? ` (${item.sesiones} ses.)` : "";
          const separator = i < itemsBoleta.length - 1 ? '<hr class="s sep-trat"/>' : '';
          return `
            <div class="trat-row r" style="padding:4px 0;position:relative;">
              <span contenteditable="true" style="font-weight:bold;font-size:10px;flex:1;">${item.nombre}${sesInfo}</span>
              <span contenteditable="true" style="font-weight:bold;font-size:10px;white-space:nowrap;">S/ ${item.precioTotal.toFixed(2)}</span>
              <button class="del-btn no-print" onclick="this.closest('.trat-row').remove();var ns=this.closest('.trat-row')?.nextElementSibling;if(ns&&ns.classList.contains('sep-trat'))ns.remove();" title="Eliminar">✕</button>
            </div>${separator}`;
        }).join('')
      : '<div contenteditable="true" style="font-size:10px;color:#000;padding:4px 0;">Sin tratamientos seleccionados</div>';

    const horaHoy = new Date().toLocaleTimeString("es-PE", { hour: '2-digit', minute: '2-digit' });
    const numComprobante = `${String(presupuesto.id).padStart(6, '0')}`;

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Boleta ShowClinic</title>
  <style>
    @media print {
      html,body{margin:0;padding:0;width:80mm;height:auto;}
      .no-print{display:none!important;}
      .receipt{box-shadow:none!important;border:none!important;margin:0;border-radius:0;width:80mm;padding:1mm 2mm 2mm;}
      @page{size:80mm auto;margin:0;}
    }
    *{box-sizing:border-box;margin:0;padding:0;color:#000!important;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
    body{font-family:'Courier New',Courier,monospace;background:#e8e8e8;display:flex;flex-direction:column;align-items:center;padding:20px 10px;}
    .toolbar{position:fixed;top:0;left:0;right:0;background:#1a1a1a;color:white!important;padding:10px 18px;display:flex;justify-content:space-between;align-items:center;z-index:1000;box-shadow:0 2px 8px rgba(0,0,0,0.3);}
    .toolbar *{color:white!important;}
    .toolbar button{background:#a36920;color:white!important;border:none;padding:7px 20px;border-radius:4px;cursor:pointer;font-size:12px;font-weight:bold;letter-spacing:0.5px;}
    .toolbar button:hover{background:#8a5a1a;}
    .receipt{width:302px;background:#fff;padding:10px 8px 12px;margin-top:55px;box-shadow:0 2px 10px rgba(0,0,0,0.15);border-radius:2px;}
    .s{border:none;border-top:1px dashed #000;margin:5px 0;}
    .s2{border:none;border-top:2px solid #000;margin:5px 0;}
    .c{text-align:center;}
    .r{display:flex;justify-content:space-between;align-items:center;margin-bottom:2px;}
    .banda{background:#000;color:#fff!important;padding:5px 8px;margin:6px 0;text-align:center;letter-spacing:2px;}
    .banda *{color:#fff!important;}
    .tb{background:#000;padding:6px 8px;margin:6px 0;display:flex;justify-content:space-between;align-items:center;}
    .tb span{color:#fff!important;}
    .sec-title{font-size:10px;font-weight:bold;text-decoration:underline;margin-bottom:4px;letter-spacing:0.5px;}
    .disclaimer{border:1.5px solid #000;padding:6px 5px;margin-top:8px;text-align:center;}
    .disclaimer span{font-size:9px;font-weight:bold;line-height:1.4;display:block;}
    [contenteditable="true"]:hover{outline:1px dashed #a36920;}
    [contenteditable="true"]:focus{outline:2px solid #a36920;background:#fffde7;}
    .del-btn{position:absolute;right:-18px;top:50%;transform:translateY(-50%);width:16px;height:16px;border-radius:50%;background:#c0392b;color:#fff!important;border:none;font-size:10px;line-height:16px;text-align:center;cursor:pointer;padding:0;display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity 0.15s;}
    .trat-row:hover .del-btn,.total-row:hover .del-btn{opacity:1;}
    .del-btn:hover{background:#e74c3c;}
    .total-row{position:relative;}
    .total-row .del-btn{right:-18px;}
    .hint-bar{background:#a36920;color:#fff!important;text-align:center;padding:5px 8px;font-size:10px;font-weight:bold;letter-spacing:0.3px;margin-top:2px;border-radius:0 0 4px 4px;}
    .hint-bar *{color:#fff!important;}
  </style>
</head>
<body>
  <div class="toolbar no-print">
    <span style="font-weight:bold;font-size:13px;letter-spacing:0.5px;">Comprobante ShowClinic</span>
    <button onclick="window.print()">🖨 Imprimir</button>
  </div>
  <div class="hint-bar no-print" style="width:302px;margin-top:55px;">
    ✏️ Haz clic en cualquier texto para editarlo · Pasa el mouse sobre items para eliminar
  </div>
  <div class="receipt" style="margin-top:0;">
    <!-- LOGO -->
    <div class="c" style="margin-bottom:4px;">
      <div style="width:52px;height:52px;border-radius:50%;border:2.5px solid #000;display:inline-flex;align-items:center;justify-content:center;">
        <span style="font-family:Georgia,serif;font-size:28px;font-weight:bold;color:#000!important;">S</span>
      </div>
    </div>
    <!-- HEADER -->
    <div class="c" style="margin-bottom:4px;">
      <div style="font-size:22px;font-weight:bold;letter-spacing:4px;color:#000!important;">SHOWCLINIC</div>
      <div style="font-size:10px;text-transform:uppercase;letter-spacing:1px;margin-top:2px;">Centro de Estética Avanzada</div>
      <div contenteditable="true" style="font-size:8px;margin-top:3px;line-height:1.4;">Av. Ejército 616, Yanahuara, Arequipa · Perú</div>
      <div contenteditable="true" style="font-size:8px;font-weight:bold;">Tel: 974 212 114</div>
    </div>
    <!-- BANDA COMPROBANTE -->
    <div class="banda">
      <span style="font-size:11px;font-weight:bold;letter-spacing:2px;color:#fff!important;">COMPROBANTE INTERNO</span>
    </div>
    <!-- INFO COMPROBANTE -->
    <hr class="s"/>
    <div style="margin-bottom:2px;">
      <div class="r"><span style="font-size:9px;font-weight:bold;">N° Comprobante:</span><span contenteditable="true" style="font-size:9px;font-weight:bold;">${numComprobante}</span></div>
      <div class="r"><span style="font-size:9px;font-weight:bold;">Fecha:</span><span contenteditable="true" style="font-size:9px;font-weight:bold;">${fechaHoy}</span></div>
      <div class="r"><span style="font-size:9px;font-weight:bold;">Hora:</span><span contenteditable="true" style="font-size:9px;font-weight:bold;">${horaHoy}</span></div>
    </div>
    <hr class="s"/>
    <!-- CLIENTE -->
    <div style="margin-bottom:4px;">
      <div class="sec-title">CLIENTE</div>
      <div class="r"><span style="font-size:9px;">Nombre:</span><span contenteditable="true" style="font-size:9px;font-weight:bold;">${nombrePaciente}</span></div>
      <div class="r"><span style="font-size:9px;">DNI:</span><span contenteditable="true" style="font-size:9px;font-weight:bold;">${pacienteSeleccionado.dni || "-"}</span></div>
    </div>
    <!-- TRATAMIENTOS -->
    <div style="margin-bottom:4px;">
      <div class="sec-title">TRATAMIENTOS</div>
      <hr class="s"/>
      ${tratamientosHTML}
      <hr class="s"/>
    </div>
    <!-- TOTALES -->
    <hr class="s2"/>
    <div style="margin-bottom:4px;">
      <div class="total-row r"><span style="font-size:9px;font-weight:bold;">Subtotal:</span><span contenteditable="true" style="font-size:9px;font-weight:bold;">S/ ${totalActivo.toFixed(2)}</span><button class="del-btn no-print" onclick="this.parentElement.remove()" title="Eliminar fila">✕</button></div>
      ${descuento > 0 ? `<div class="total-row r"><span style="font-size:9px;font-weight:bold;">Descuento:</span><span contenteditable="true" style="font-size:9px;font-weight:bold;">-S/ ${descuento.toFixed(2)}</span><button class="del-btn no-print" onclick="this.parentElement.remove()" title="Eliminar fila">✕</button></div>` : ''}
      ${totalConDescuento !== totalActivo ? `<div class="total-row r"><span style="font-size:9px;font-weight:bold;">Con descuento:</span><span contenteditable="true" style="font-size:9px;font-weight:bold;">S/ ${totalConDescuento.toFixed(2)}</span><button class="del-btn no-print" onclick="this.parentElement.remove()" title="Eliminar fila">✕</button></div>` : ''}
      ${(presupuesto.consulta_pagada === 1 && montoConsulta > 0) ? `<div class="total-row r"><span style="font-size:9px;font-weight:bold;">Consulta:</span><span contenteditable="true" style="font-size:9px;font-weight:bold;">S/ ${montoConsulta.toFixed(2)}</span><button class="del-btn no-print" onclick="this.parentElement.remove()" title="Eliminar fila">✕</button></div>` : ''}
      <div class="total-row r"><span style="font-size:9px;font-weight:bold;">Pagado:</span><span contenteditable="true" style="font-size:9px;font-weight:bold;">S/ ${montoPagadoReal.toFixed(2)}</span><button class="del-btn no-print" onclick="this.parentElement.remove()" title="Eliminar fila">✕</button></div>
      ${saldoPendienteReal > 0 ? `<div class="total-row r"><span style="font-size:9px;font-weight:bold;">Saldo pendiente:</span><span contenteditable="true" style="font-size:9px;font-weight:bold;">S/ ${saldoPendienteReal.toFixed(2)}</span><button class="del-btn no-print" onclick="this.parentElement.remove()" title="Eliminar fila">✕</button></div>` : ''}
    </div>
    <!-- BANDA TOTAL -->
    <div class="tb">
      <span style="font-size:14px;font-weight:bold;color:#fff!important;">TOTAL</span>
      <span contenteditable="true" style="font-size:18px;font-weight:bold;color:#fff!important;">S/ ${totalFinal.toFixed(2)}</span>
    </div>
    <!-- PIE -->
    <hr class="s"/>
    <div class="c" style="padding:4px 0;">
      <div style="font-size:10px;font-weight:bold;">¡GRACIAS POR SU PREFERENCIA!</div>
    </div>
    <hr class="s"/>
    <div class="c" style="margin-top:3px;">
      <div style="font-size:8px;">@showclinic.pe</div>
      <div style="font-size:8px;margin-top:2px;">WhatsApp: wa.me/51974212114</div>
    </div>
    <!-- DISCLAIMER -->
    <div class="disclaimer">
      <span>ESTE DOCUMENTO NO TIENE VALIDEZ TRIBUTARIA / NO ES COMPROBANTE DE PAGO ELECTRÓNICO / SOLO PARA USO INTERNO DEL CLIENTE</span>
    </div>
  </div>
</body>
</html>`;

    const ventana = window.open('', '_blank');
    ventana.document.write(htmlContent);
    ventana.document.close();
  };

  const toggleOfertaItem = (t) => {
    setOfertaItems((prev) => {
      const exists = prev.some((x) => x.tratamientoId === t.id);
      if (exists) return prev.filter((x) => x.tratamientoId !== t.id);
      return [...prev, { tratamientoId: t.id, nombre: t.nombre, precio: t.precio ? String(t.precio) : "", sesiones: "1", producto: "", ml: "" }];
    });
  };

  const addOfertaItem = (t) => {
    setOfertaItems((prev) => [...prev, { tratamientoId: t.id, nombre: t.nombre, precio: t.precio ? String(t.precio) : "", sesiones: "1", producto: "", ml: "" }]);
  };

  const removeOneOfertaItem = (t) => {
    setOfertaItems((prev) => {
      const idx = prev.findLastIndex((x) => x.tratamientoId === t.id);
      if (idx === -1) return prev;
      return [...prev.slice(0, idx), ...prev.slice(idx + 1)];
    });
  };

  const setOfertaPrecio = (tratamientoId, value) => {
    setOfertaItems((prev) =>
      prev.map((x) =>
        x.tratamientoId === tratamientoId ? { ...x, precio: value } : x
      )
    );
  };

  const setOfertaSesiones = (tratamientoId, value) => {
    setOfertaItems((prev) =>
      prev.map((x) =>
        x.tratamientoId === tratamientoId ? { ...x, sesiones: value } : x
      )
    );
  };

  const setOfertaProducto = (tratamientoId, value) => {
    setOfertaItems((prev) =>
      prev.map((x) =>
        x.tratamientoId === tratamientoId ? { ...x, producto: value } : x
      )
    );
  };

  const setOfertaMl = (tratamientoId, value) => {
    setOfertaItems((prev) =>
      prev.map((x) =>
        x.tratamientoId === tratamientoId ? { ...x, ml: value } : x
      )
    );
  };

  const totalOferta = ofertaItems.reduce((sum, it) => {
    const n = Number(it.precio);
    return sum + (Number.isFinite(n) ? n : 0);
  }, 0);

  const guardarOferta = async () => {
    if (!pacienteSeleccionado?.id) return;
    if (!ofertaItems.length) {
      showToast({ severity: "warning", message: "Selecciona al menos un tratamiento" });
      return;
    }
    try {
      setGuardandoOferta(true);
      const payload = {
        items: ofertaItems.map((it) => ({
          tratamientoId: it.tratamientoId,
          nombre: it.nombre,
          precio: it.precio,
          sesiones: Number(it.sesiones) || 1,
          producto: it.producto || "",
          ml: it.ml || "",
        })),
        descuento: Number(descuentoOferta) || 0,
      };

      if (ofertaEditId) {
        await axios.put(
          `${API_BASE_URL}/api/pacientes/${pacienteSeleccionado.id}/ofertas/${ofertaEditId}`,
          payload,
          { headers: authHeaders }
        );
      } else {
        await axios.post(
          `${API_BASE_URL}/api/pacientes/${pacienteSeleccionado.id}/ofertas`,
          payload,
          { headers: authHeaders }
        );
      }

      const ofertasRes = await axios.get(
        `${API_BASE_URL}/api/pacientes/${pacienteSeleccionado.id}/ofertas`,
        { headers: authHeaders }
      );
      setOfertas(Array.isArray(ofertasRes.data) ? ofertasRes.data : []);
      setOfertaItems([]);
      setShowOferta(false);
      setOfertaEditId(null);
      setDescuentoOferta("");
      showToast({ severity: "success", message: ofertaEditId ? "Oferta actualizada" : "Oferta guardada" });
    } catch (e) {
      console.error("Error al guardar oferta:", e);
      showToast({ severity: "error", message: "Error al guardar oferta" });
    } finally {
      setGuardandoOferta(false);
    }
  };

  // Eliminar oferta/presupuesto
  const eliminarOferta = async (ofertaId) => {
    if (!pacienteSeleccionado?.id || !ofertaId) return;
    
    if (!window.confirm("¿Estás seguro de eliminar este presupuesto?")) return;
    
    try {
      await axios.delete(
        `${API_BASE_URL}/api/pacientes/${pacienteSeleccionado.id}/ofertas/${ofertaId}`,
        { headers: authHeaders }
      );
      
      const ofertasRes = await axios.get(
        `${API_BASE_URL}/api/pacientes/${pacienteSeleccionado.id}/ofertas`,
        { headers: authHeaders }
      );
      setOfertas(Array.isArray(ofertasRes.data) ? ofertasRes.data : []);
      showToast({ severity: "success", message: "Presupuesto eliminado" });
    } catch (e) {
      console.error("Error al eliminar oferta:", e);
      showToast({ severity: "error", message: "Error al eliminar presupuesto" });
    }
  };

  // Eliminar un tratamiento individual de un presupuesto ya creado
  const eliminarItemOferta = async (ofertaId, itemIdx) => {
    if (!pacienteSeleccionado?.id) return;
    const oferta = ofertas.find(o => o.id === ofertaId);
    if (!oferta) return;
    const items = oferta.items || [];
    if (items.length <= 1) {
      showToast({ severity: "warning", message: "No puedes eliminar el último tratamiento. Elimina el presupuesto completo." });
      return;
    }
    const nuevoItems = items.filter((_, idx) => idx !== itemIdx);
    try {
      await axios.put(
        `${API_BASE_URL}/api/pacientes/${pacienteSeleccionado.id}/ofertas/${ofertaId}`,
        { items: nuevoItems.map(it => ({
            tratamientoId: it.tratamientoId || it.tratamiento_id || 0,
            nombre: it.nombre,
            precio: it.precio,
            sesiones: Number(it.sesiones) || 1,
            producto: it.producto || "",
            ml: it.ml || "",
          }))
        },
        { headers: authHeaders }
      );
      const ofertasRes = await axios.get(
        `${API_BASE_URL}/api/pacientes/${pacienteSeleccionado.id}/ofertas`,
        { headers: authHeaders }
      );
      setOfertas(Array.isArray(ofertasRes.data) ? ofertasRes.data : []);
      // Recargar presupuestos asignados (se sincronizan en backend)
      try {
        const presupuestosRes = await axios.get(`${API_BASE_URL}/api/paquetes/presupuestos/paciente/${pacienteSeleccionado.id}`, { headers: authHeaders });
        setPresupuestosAsignados(Array.isArray(presupuestosRes.data) ? presupuestosRes.data : []);
      } catch (_) {}
      showToast({ severity: "success", message: "Tratamiento eliminado del presupuesto" });
    } catch (e) {
      console.error("Error al eliminar item de oferta:", e);
      showToast({ severity: "error", message: "Error al eliminar tratamiento" });
    }
  };

  // Editar número de sesiones de un tratamiento en un presupuesto
  const editarSesionesOferta = async (ofertaId, itemIdx, nuevasSesiones) => {
    if (!pacienteSeleccionado?.id) return;
    const oferta = ofertas.find(o => o.id === ofertaId);
    if (!oferta) return;
    const items = oferta.items || [];
    const nuevoItems = items.map((it, idx) => ({
      tratamientoId: it.tratamientoId || it.tratamiento_id || 0,
      nombre: it.nombre,
      precio: it.precio,
      sesiones: idx === itemIdx ? Math.max(1, Number(nuevasSesiones) || 1) : (Number(it.sesiones) || 1),
      producto: it.producto || "",
      ml: it.ml || "",
    }));
    try {
      await axios.put(
        `${API_BASE_URL}/api/pacientes/${pacienteSeleccionado.id}/ofertas/${ofertaId}`,
        { items: nuevoItems },
        { headers: authHeaders }
      );
      const ofertasRes = await axios.get(
        `${API_BASE_URL}/api/pacientes/${pacienteSeleccionado.id}/ofertas`,
        { headers: authHeaders }
      );
      setOfertas(Array.isArray(ofertasRes.data) ? ofertasRes.data : []);
      // Recargar presupuestos asignados (se sincronizan en backend)
      try {
        const presupuestosRes = await axios.get(`${API_BASE_URL}/api/paquetes/presupuestos/paciente/${pacienteSeleccionado.id}`, { headers: authHeaders });
        setPresupuestosAsignados(Array.isArray(presupuestosRes.data) ? presupuestosRes.data : []);
      } catch (_) {}
      setEditandoSesiones(null);
      showToast({ severity: "success", message: "Sesiones actualizadas" });
    } catch (e) {
      console.error("Error al editar sesiones:", e);
      showToast({ severity: "error", message: "Error al editar sesiones" });
    }
  };

  const guardarObservacion = async () => {
    if (!pacienteSeleccionado?.id) return;
    try {
      setGuardandoObservaciones(true);
      await axios.post(
        `${API_BASE_URL}/api/pacientes/${pacienteSeleccionado.id}/observaciones`,
        { texto: nuevaObservacion },
        { headers: authHeaders }
      );

      const obsRes = await axios.get(
        `${API_BASE_URL}/api/pacientes/${pacienteSeleccionado.id}/observaciones`,
        { headers: authHeaders }
      );
      setObservaciones(Array.isArray(obsRes.data) ? obsRes.data : []);
      setNuevaObservacion("");
      showToast({ severity: "success", message: "Observación guardada" });
    } catch (error) {
      console.error("Error al guardar observación:", error);
      showToast({ severity: "error", message: "Error al guardar observación" });
    } finally {
      setGuardandoObservaciones(false);
    }
  };

  const manejarCambioFotos = (e) => {
    const archivos = Array.from(e.target.files || []);
    if (archivos.length > 3) {
      showToast({ severity: "warning", message: "Solo puedes subir hasta 3 fotos por tratamiento" });
    }
    setFotosTratamiento(archivos.slice(0, 3));
  };

  const subirFotos = async (tratamientoId) => {
    if (!fotosTratamiento.length) {
      showToast({ severity: "warning", message: "Selecciona hasta 3 fotos para subir" });
      return;
    }

    const data = new FormData();
    fotosTratamiento.forEach((f) => data.append("fotos", f));

    try {
      await axios.post(
        `${API_BASE_URL}/api/tratamientos/subir-fotos/${tratamientoId}`,
        data,
        {
          headers: {
            "Content-Type": "multipart/form-data",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        }
      );
      showToast({ severity: "success", message: "Fotos agregadas correctamente" });
      setFotosTratamiento([]);
      setTratamientoSeleccionado(null);
      cargarHistorial(pacienteSeleccionado.id);
    } catch (err) {
      console.error("Error al subir fotos:", err);
      const status = err?.response?.status;
      const message = err?.response?.data?.message;
      showToast({
        severity: "error",
        message: message ? `Error al subir fotos${status ? ` (${status})` : ""}: ${message}` : "Error al subir fotos",
      });
    }
  };

  const abrirFotosPaciente = (tratamientoRealizadoId) => {
    if (!pacienteSeleccionado?.id) return;
    const url = `/fotos-paciente?pacienteId=${pacienteSeleccionado.id}&tratamientoRealizadoId=${tratamientoRealizadoId}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const pacientesFiltrados = pacientes
    .filter(
      (p) => {
        if (!filtro.trim()) return true;
        // Normalizar: quitar tildes, minúsculas, trim espacios múltiples
        const normalize = (str) => (str || "")
          .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
          .toLowerCase()
          .replace(/\s+/g, " ")
          .trim();
        
        const filtroNorm = normalize(filtro);
        const nombreNorm = normalize(p.nombre);
        const apellidoNorm = normalize(p.apellido);
        const nombreCompletoNorm = `${nombreNorm} ${apellidoNorm}`.trim();
        const dniNorm = (p.dni || "").toString().trim();
        
        return nombreNorm.includes(filtroNorm) ||
               apellidoNorm.includes(filtroNorm) ||
               nombreCompletoNorm.includes(filtroNorm) ||
               dniNorm.includes(filtroNorm);
      }
    )
    .sort((a, b) => {
      switch (ordenPacientes) {
        case "az":
          return (a.nombre || "").localeCompare(b.nombre || "", "es");
        case "za":
          return (b.nombre || "").localeCompare(a.nombre || "", "es");
        case "antiguo":
          return a.id - b.id;
        case "reciente":
        default:
          return b.id - a.id;
      }
    });

  const totalGeneral = tratamientos.reduce(
    (acc, t) => acc + Number(t.precio_total || t.precioTotal || 0),
    0
  );

  const generarPDF = async () => {
    if (!pacienteSeleccionado) return;

    const doc = new jsPDF("p", "pt", "a4");
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const colorPrincipal = [163, 105, 32];
    const margenX = 40;
    const headerHeight = 92;

    const logo = "/images/logo-showclinic.png";
    const img = await loadImage(logo);
    const logoCircular = makeCircularImageDataUrl(img, 256, 10);

    const p = pacienteSeleccionado;
    const datosPaciente = [
      ["Documento", `${pacienteSeleccionado.tipoDocumento || 'DNI'}: ${pacienteSeleccionado.dni || "-"}`],
      ["Nombre", `${p.nombre || ""} ${p.apellido || ""}`.trim()],
      ["Edad", p.edad ?? "-"],
      ["Sexo", p.sexo || "-"],
      ["Embarazada", p.embarazada || "No especifica"],
      ["Ocupación", p.ocupacion || "-"],
      ["Correo", p.correo || "-"],
      ["Celular", p.celular || "-"],
      ["Dirección", p.direccion || "-"],
      ["Ciudad Nacimiento", p.ciudadNacimiento || "-"],
      ["Ciudad Residencia", p.ciudadResidencia || "-"],
      ["Alergias", p.alergias || "Ninguna"],
      ["Enfermedades", p.enfermedad || "Ninguna"],
      ["Cirugía Estética", p.cirugiaEstetica || "No"],
      ["Tabaco", p.tabaco || "No"],
      ["Alcohol", p.alcohol || "No"],
      ["Drogas", p.drogas || "No"],
      ["Referencia", p.referencia || "No especificada"],
      ["Número de hijos", p.numeroHijos ?? "No registrado"],
    ];

    const tabla = tratamientos.map((t) => {
      let productoUsadoPDF = "-";
      try {
        if (t.productos) {
          const productosArray = typeof t.productos === 'string' ? JSON.parse(t.productos) : t.productos;
          if (Array.isArray(productosArray) && productosArray.length > 0) {
            const prod = productosArray[0];
            if (prod.variante_nombre) {
              productoUsadoPDF = `${prod.nombre || ''} ${prod.variante_nombre}`.trim();
            } else if (prod.nombre) {
              productoUsadoPDF = prod.nombre;
            } else if (prod.producto) {
              productoUsadoPDF = prod.producto;
            }
          }
        }
      } catch (e) { /* ignore */ }
      return [
        t.fecha ? t.fecha.split(" ")[0] : "-",
        t.nombreTratamiento || "—",
        t.cantidad_total || "-",
        productoUsadoPDF,
        t.tipoAtencion || "-",
        t.especialista || "No especificado",
        t.sesion ?? "-",
        `S/ ${(t.precio_total || 0).toFixed(2)}`,
      ];
    });

    const didDrawHeaderFooter = (data) => {
      doc.setFillColor(...colorPrincipal);
      doc.rect(0, 0, pageWidth, headerHeight, "F");

      if (logoCircular) {
        const logoSize = 54;
        doc.addImage(logoCircular, "PNG", margenX, 20, logoSize, logoSize);
      }

      doc.setFont("helvetica", "bold");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(18);
      doc.text("Historial Clínico", margenX + 72, 46);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text(
        `Emitido: ${new Date().toLocaleDateString()}`,
        pageWidth - margenX,
        64,
        { align: "right" }
      );

      doc.setDrawColor(220);
      doc.line(margenX, headerHeight + 6, pageWidth - margenX, headerHeight + 6);

      doc.setTextColor(120);
      doc.setFontSize(9);
      doc.text(`Página ${data.pageNumber}`, pageWidth - margenX, pageHeight - 22, {
        align: "right",
      });
      doc.text("ShowClinic CRM", margenX, pageHeight - 22);
    };

    const startDatosY = headerHeight + 24;
    const gap = 14;
    const tablaW = (pageWidth - margenX * 2 - gap) / 2;
    const labelW = 130;
    const valueW = tablaW - labelW;
    const mitad = Math.ceil(datosPaciente.length / 2);
    const datosIzq = datosPaciente.slice(0, mitad);
    const datosDer = datosPaciente.slice(mitad);

    autoTable(doc, {
      margin: { top: headerHeight + 16, left: margenX, right: margenX },
      startY: startDatosY,
      tableWidth: tablaW,
      theme: "plain",
      styles: { fontSize: 10, cellPadding: 3, textColor: 30 },
      body: datosIzq,
      columnStyles: {
        0: { cellWidth: labelW, fontStyle: "bold", textColor: colorPrincipal },
        1: { cellWidth: valueW },
      },
      didDrawPage: didDrawHeaderFooter,
    });
    const finalYIzq = doc.lastAutoTable.finalY;

    autoTable(doc, {
      margin: {
        top: headerHeight + 16,
        left: margenX + tablaW + gap,
        right: margenX,
      },
      startY: startDatosY,
      tableWidth: tablaW,
      theme: "plain",
      styles: { fontSize: 10, cellPadding: 3, textColor: 30 },
      body: datosDer,
      columnStyles: {
        0: { cellWidth: labelW, fontStyle: "bold", textColor: colorPrincipal },
        1: { cellWidth: valueW },
      },
      didDrawPage: didDrawHeaderFooter,
    });
    const finalYDer = doc.lastAutoTable.finalY;

    const startTabla = Math.max(finalYIzq, finalYDer) + 20;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(...colorPrincipal);
    doc.text("Tratamientos Realizados", margenX, startTabla);

    autoTable(doc, {
      startY: startTabla + 10,
      margin: { left: margenX, right: margenX },
      head: [
        [
          "Fecha",
          "Tratamiento",
          "Cant.",
          "Producto Usado",
          "Tipo Atención",
          "Especialista",
          "Sesión",
          "Total",
        ],
      ],
      body: tabla,
      theme: "striped",
      headStyles: { fillColor: colorPrincipal, textColor: 255, fontStyle: "bold", fontSize: 8 },
      styles: { fontSize: 8, cellPadding: 3, valign: "middle" },
      alternateRowStyles: { fillColor: [247, 242, 234] },
      columnStyles: {
        0: { cellWidth: 55 },
        2: { halign: "center", cellWidth: 32 },
        6: { halign: "center", cellWidth: 36 },
        7: { halign: "right", cellWidth: 52 },
      },
      didDrawPage: didDrawHeaderFooter,
    });

    const startObs = doc.lastAutoTable.finalY + 26;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(...colorPrincipal);
    doc.text("Otras observaciones", margenX, startObs);

    const obsRows = (Array.isArray(observaciones) ? observaciones : []).map((o) => [
      o?.creado_en || "-",
      o?.texto || "",
    ]);

    if (obsRows.length > 0) {
      autoTable(doc, {
        startY: startObs + 10,
        margin: { left: margenX, right: margenX },
        head: [["Fecha", "Observación"]],
        body: obsRows,
        theme: "striped",
        headStyles: { fillColor: colorPrincipal, textColor: 255, fontStyle: "bold" },
        styles: { fontSize: 9, cellPadding: 4, valign: "top" },
        alternateRowStyles: { fillColor: [247, 242, 234] },
        columnStyles: {
          0: { cellWidth: 90 },
          1: { cellWidth: "auto" },
        },
        didDrawPage: didDrawHeaderFooter,
      });
    } else {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(60);
      doc.text("Sin observaciones registradas.", margenX, startObs + 26);
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...colorPrincipal);
    doc.text(
      `Total general: S/ ${totalGeneral.toFixed(2)}`,
      pageWidth - margenX,
      (doc.lastAutoTable?.finalY || startObs + 26) + 22,
      { align: "right" }
    );

    doc.save(`Historial_${p.nombre}_${p.apellido}.pdf`);
  };

  // Función para abrir modal de recibo de un tratamiento específico
  const abrirReciboTratamiento = (tratamiento) => {
    setDatosRecibo({
      paciente: pacienteSeleccionado,
      tratamiento: {
        nombre: tratamiento.nombreTratamiento,
        precio: tratamiento.precio_total,
      },
      especialista: tratamiento.especialista,
      fecha: tratamiento.fecha?.split(" ")[0] || new Date().toLocaleDateString("es-PE"),
      pagoMetodo: tratamiento.pagoMetodo,
      sesion: tratamiento.sesion,
      total: tratamiento.precio_total,
      descuento: tratamiento.descuento || 0,
    });
    setOpenReciboModal(true);
  };

  // Función para abrir modal de recibo consolidado por fecha
  const abrirReciboConsolidadoPorFecha = (fecha) => {
    // Filtrar tratamientos de la misma fecha
    const tratamientosMismaFecha = tratamientos.filter(t => {
      const fechaTratamiento = t.fecha?.split(" ")[0];
      return fechaTratamiento === fecha;
    });

    if (tratamientosMismaFecha.length === 0) return;

    // Preparar datos para el recibo consolidado
    const tratamientosRecibo = tratamientosMismaFecha.map(t => ({
      nombre: t.nombreTratamiento,
      especialista: t.especialista,
      sesion: t.sesion,
      precio: t.precio_total,
      descuento: t.descuento || 0,
      total: t.precio_total,
      pagoMetodo: t.pagoMetodo,
    }));

    const totalGeneral = tratamientosMismaFecha.reduce((sum, t) => sum + (t.precio_total || 0), 0);

    setDatosReciboConsolidado({
      paciente: pacienteSeleccionado,
      tratamientos: tratamientosRecibo,
      fecha: fecha,
      totalGeneral: totalGeneral,
    });
    setOpenReciboConsolidado(true);
  };

  // Agrupar tratamientos por fecha
  const tratamientosPorFecha = tratamientos.reduce((acc, t) => {
    const fecha = t.fecha?.split(" ")[0];
    if (!acc[fecha]) {
      acc[fecha] = [];
    }
    acc[fecha].push(t);
    return acc;
  }, {});

  // Función para abrir modal de edición
  const abrirEditarTratamiento = (tratamiento) => {
    setTratamientoEditar(tratamiento);
    setEditEspecialista(tratamiento.especialista || "");
    setEditSesion(tratamiento.sesion || 1);
    setEditPrecio(tratamiento.precio_total || "");
    setEditDescuento(tratamiento.descuento || "");
    setEditPagoMetodo(tratamiento.pagoMetodo || "Efectivo");
    setEditTipoAtencion(tratamiento.tipoAtencion || "Tratamiento");
    setEditNombreTratamiento(tratamiento.nombreTratamiento || "");
    setEditCantidad(tratamiento.cantidad_total || "");
    
    // Extraer producto usado
    let productoUsado = "";
    try {
      if (tratamiento.productos) {
        const productosArray = typeof tratamiento.productos === 'string' ? JSON.parse(tratamiento.productos) : tratamiento.productos;
        if (Array.isArray(productosArray) && productosArray.length > 0) {
          const prod = productosArray[0];
          if (prod.variante_nombre) {
            productoUsado = `${prod.nombre || ''} ${prod.variante_nombre}`.trim();
          } else if (prod.nombre) {
            productoUsado = prod.nombre;
          } else if (prod.producto) {
            productoUsado = prod.producto;
          }
        }
      }
    } catch (e) {
      console.error('Error parseando productos:', e);
    }
    setEditProductoUsado(productoUsado);
    
    // Extraer solo la fecha (YYYY-MM-DD) del timestamp
    const fechaSolo = tratamiento.fecha ? tratamiento.fecha.split(" ")[0] : "";
    setEditFecha(fechaSolo);
    setOpenEditarModal(true);
  };

  // Función para guardar cambios del tratamiento
  const guardarEditarTratamiento = async () => {
    if (!tratamientoEditar) return;

    try {
      await axios.put(
        `${API_BASE_URL}/api/tratamientos/realizado/${tratamientoEditar.id}`,
        {
          especialista: editEspecialista,
          sesion: editSesion,
          precio_total: Number(editPrecio) || 0,
          descuento: Number(editDescuento) || 0,
          pagoMetodo: editPagoMetodo,
          tipoAtencion: editTipoAtencion,
          fecha: editFecha,
          nombreTratamiento: editNombreTratamiento,
          cantidad_total: editCantidad,
          producto_usado: editProductoUsado,
        },
        { headers: authHeaders }
      );

      showToast({ severity: "success", message: "Tratamiento actualizado correctamente" });
      setOpenEditarModal(false);
      cargarHistorial(pacienteSeleccionado.id);
    } catch (error) {
      console.error("Error al editar tratamiento:", error);
      const mensaje = error.response?.data?.message || "Error al editar tratamiento";
      showToast({ severity: "error", message: mensaje });
    }
  };

  // Función para abrir confirmación de cancelación
  const abrirConfirmacionCancelar = (tratamiento) => {
    setTratamientoCancelar(tratamiento);
    setOpenConfirmarCancelar(true);
  };

  // Función para cancelar tratamiento
  const cancelarTratamiento = async () => {
    if (!tratamientoCancelar) return;

    try {
      await axios.delete(
        `${API_BASE_URL}/api/tratamientos/realizado/${tratamientoCancelar.id}`,
        { headers: authHeaders }
      );

      showToast({ severity: "success", message: "Tratamiento cancelado correctamente" });
      setOpenConfirmarCancelar(false);
      cargarHistorial(pacienteSeleccionado.id);
    } catch (error) {
      console.error("Error al cancelar tratamiento:", error);
      const mensaje = error.response?.data?.message || "Error al cancelar tratamiento";
      showToast({ severity: "error", message: mensaje });
    }
  };

  return (
    <div
      style={{
        backgroundImage:
          "linear-gradient(rgba(255,255,255,0.85), rgba(232,211,57,0.85)), url('/images/background-showclinic.jpg')",
        backgroundSize: "cover",
        minHeight: "100vh",
        padding: "40px 30px",
      }}
    >
      <Container maxWidth={false} sx={{ maxWidth: "1800px", mx: "auto" }}>
        <Paper
          sx={{
            p: 6,
            borderRadius: "15px",
            background:
              "linear-gradient(180deg, rgba(255,249,236,0.98) 0%, rgba(255,255,255,0.92) 52%, rgba(247,234,193,0.55) 100%)",
            border: "1px solid rgba(212,175,55,0.22)",
            backdropFilter: "blur(10px)",
            boxShadow:
              "0 18px 46px rgba(0,0,0,0.14), 0 0 0 1px rgba(212,175,55,0.10)",
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", mb: 3 }}>
            <IconButton onClick={() => navigate("/pacientes")} sx={{ color: "#a36920" }}>
              <ArrowBack />
            </IconButton>
            <Typography
              variant="h5"
              sx={{ 
                flex: 1, 
                color: "#a36920", 
                fontWeight: 700, 
                textAlign: "center",
                fontFamily: "'Playfair Display', serif",
                letterSpacing: 4,
                textTransform: "uppercase"
              }}
            >
              Historial Clínico de Pacientes
            </Typography>
            <IconButton onClick={() => navigate("/dashboard")} sx={{ color: "#a36920" }} title="Inicio">
              <Home />
            </IconButton>
          </Box>

          {!pacienteSeleccionado ? (
            <>
              {/* Header con título y estadísticas */}
              <Box sx={{ mb: 4 }}>
                <Box sx={{ mb: 3 }}>
                  <Typography
                    sx={{
                      fontSize: "1.75rem",
                      fontWeight: 400,
                      color: "#2E2E2E",
                      lineHeight: 1.2,
                      mb: 0.5,
                    }}
                  >
                    Directorio de pacientes
                  </Typography>
                  <Typography
                    sx={{
                      fontSize: "0.9rem",
                      color: "#999",
                      textTransform: "uppercase",
                      letterSpacing: 2,
                    }}
                  >
                    SHOWCLINIC · AREQUIPA
                  </Typography>
                </Box>

                {/* Tarjetas de estadísticas */}
                <Grid container spacing={2} sx={{ mb: 3 }}>
                  <Grid item xs={12} md={6}>
                    <Paper
                      elevation={0}
                      sx={{
                        p: 3,
                        borderRadius: 4,
                        backgroundColor: "#f5f1e4",
                        border: "1px solid rgba(163,105,32,0.15)",
                        height: "100%",
                      }}
                    >
                      <Typography
                        sx={{
                          fontSize: "2.5rem",
                          fontWeight: 300,
                          lineHeight: 1,
                          mb: 0.5,
                          color: "#5a3e1b",
                        }}
                      >
                        {pacientes.length}
                      </Typography>
                      <Typography
                        sx={{
                          fontSize: "0.85rem",
                          textTransform: "uppercase",
                          letterSpacing: 1.5,
                          color: "#8b6914",
                        }}
                      >
                        TOTAL PACIENTES
                      </Typography>
                    </Paper>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Paper
                      elevation={0}
                      sx={{
                        p: 3,
                        borderRadius: 4,
                        backgroundColor: "white",
                        border: "1px solid rgba(163,105,32,0.15)",
                        height: "100%",
                      }}
                    >
                      <Typography
                        sx={{
                          fontSize: "2.5rem",
                          fontWeight: 300,
                          lineHeight: 1,
                          mb: 0.5,
                          color: "#2E2E2E",
                        }}
                      >
                        {(() => {
                          const hoy = new Date();
                          const mesActual = hoy.getMonth();
                          const añoActual = hoy.getFullYear();
                          return pacientes.filter(p => {
                            if (!p.fechaRegistro) return false;
                            const fecha = new Date(p.fechaRegistro);
                            return fecha.getMonth() === mesActual && fecha.getFullYear() === añoActual;
                          }).length;
                        })()}
                      </Typography>
                      <Typography
                        sx={{
                          fontSize: "0.85rem",
                          textTransform: "uppercase",
                          letterSpacing: 1.5,
                          color: "#999",
                        }}
                      >
                        NUEVOS ESTE MES
                      </Typography>
                    </Paper>
                  </Grid>
                </Grid>
              </Box>

              {/* Barra de búsqueda */}
              <Paper
                elevation={0}
                sx={{
                  mb: 3,
                  p: 2,
                  borderRadius: 3,
                  backgroundColor: "white",
                  border: "1px solid rgba(186,154,99,0.15)",
                }}
              >
                <TextField
                  placeholder="Buscar por nombre o DNI..."
                  fullWidth
                  value={filtro}
                  onChange={(e) => setFiltro(e.target.value)}
                  size="small"
                  InputProps={{
                    startAdornment: <Typography sx={{ mr: 1, color: "#999" }}>🔍</Typography>,
                  }}
                  sx={{
                    "& .MuiInputBase-root": { 
                      backgroundColor: "transparent",
                      borderRadius: 2,
                      fontSize: "0.95rem",
                    },
                    "& .MuiOutlinedInput-root": {
                      "& fieldset": { borderColor: "transparent" },
                      "&:hover fieldset": { borderColor: "transparent" },
                      "&.Mui-focused fieldset": { borderColor: "transparent" },
                    },
                  }}
                />
              </Paper>

              {/* Filtros de orden */}
              <Box sx={{ display: "flex", gap: 1.5, mb: 3, flexWrap: "wrap", alignItems: "center" }}>
                <Typography variant="caption" sx={{ color: "#999", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", mr: 0.5 }}>
                  ORDENAR
                </Typography>
                {[
                  { key: "reciente", label: "Más reciente" },
                  { key: "az", label: "A → Z" },
                  { key: "za", label: "Z → A" },
                  { key: "antiguo", label: "Más antiguo" },
                ].map((opt) => (
                  <Chip
                    key={opt.key}
                    label={opt.label}
                    size="small"
                    clickable
                    onClick={() => setOrdenPacientes(opt.key)}
                    sx={{
                      fontWeight: 500,
                      fontSize: "0.8rem",
                      backgroundColor: ordenPacientes === opt.key ? "#5a3e1b" : "white",
                      color: ordenPacientes === opt.key ? "white" : "#5a3e1b",
                      border: "1px solid rgba(163,105,32,0.2)",
                      borderRadius: 8,
                      px: 1,
                      "&:hover": {
                        backgroundColor: ordenPacientes === opt.key ? "#4a2e0b" : "rgba(163,105,32,0.08)",
                      },
                      transition: "all 0.2s ease",
                    }}
                  />
                ))}
              </Box>

              {/* Lista de pacientes */}
              <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
                {pacientesFiltrados.map((pac) => {
                  const iniciales = `${pac.nombre?.charAt(0) || ""}${pac.apellido?.charAt(0) || ""}`.toUpperCase();
                  const coloresAvatar = ["#5a3e1b", "#a36920", "#ba9a63", "#8b6914", "#6b4e1f"];
                  const colorAvatar = coloresAvatar[pac.id % coloresAvatar.length];
                  
                  return (
                    <Paper
                      key={pac.id}
                      elevation={0}
                      sx={{
                        p: 2.5,
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        borderRadius: 3,
                        border: "1px solid rgba(163,105,32,0.1)",
                        backgroundColor: "white",
                        transition: "all 0.2s ease",
                        cursor: "pointer",
                        "&:hover": {
                          borderColor: "rgba(163,105,32,0.3)",
                          boxShadow: "0 2px 12px rgba(163,105,32,0.08)",
                        },
                      }}
                      onClick={() => cargarHistorial(pac.id)}
                    >
                      <Box sx={{ display: "flex", alignItems: "center", gap: 2, flex: 1, minWidth: 0 }}>
                        <Avatar
                          src={pac.fotoPerfil ? `${API_BASE_URL}${pac.fotoPerfil}` : undefined}
                          sx={{
                            width: 52,
                            height: 52,
                            bgcolor: colorAvatar,
                            color: "white",
                            fontWeight: 600,
                            fontSize: "1.1rem",
                            borderRadius: 2.5,
                          }}
                        >
                          {iniciales}
                        </Avatar>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography
                            sx={{ 
                              fontWeight: 600, 
                              color: "#2E2E2E", 
                              lineHeight: 1.3, 
                              fontSize: "1rem",
                              mb: 0.3,
                            }}
                          >
                            {pac.nombre} {pac.apellido}
                          </Typography>
                          <Typography
                            variant="caption"
                            sx={{ color: "#999", fontSize: "0.85rem" }}
                          >
                            {pac.tipoDocumento || "DNI"} {pac.dni}
                          </Typography>
                        </Box>
                      </Box>
                      <Box sx={{ display: "flex", gap: 1.5, alignItems: "center", flexShrink: 0 }}>
                        <Button
                          variant="outlined"
                          size="small"
                          endIcon={<Typography sx={{ fontSize: "1rem" }}>→</Typography>}
                          sx={{
                            borderColor: "rgba(163,105,32,0.2)",
                            color: "#5a3e1b",
                            borderRadius: 8,
                            px: 2.5,
                            py: 0.8,
                            fontWeight: 500,
                            textTransform: "none",
                            fontSize: "0.85rem",
                            "&:hover": { 
                              borderColor: "#5a3e1b",
                              backgroundColor: "rgba(163,105,32,0.05)",
                            },
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            cargarHistorial(pac.id);
                          }}
                        >
                          Ver historial
                        </Button>
                        {isMaster && (
                          <IconButton
                            size="small"
                            title="Eliminar paciente completo"
                            onClick={(e) => {
                              e.stopPropagation();
                              setPacienteEliminar(pac);
                              setOpenConfirmarEliminarPaciente(true);
                            }}
                            sx={{
                              color: "#d32f2f",
                              "&:hover": { backgroundColor: "rgba(211,47,47,0.08)" },
                            }}
                          >
                            <DeleteForever fontSize="small" />
                          </IconButton>
                        )}
                      </Box>
                    </Paper>
                  );
                })}
              </Box>
            </>
          ) : (
            <>
              <Box
                sx={{
                  display: "flex",
                  flexDirection: { xs: "column", sm: "row" },
                  alignItems: { xs: "stretch", sm: "center" },
                  justifyContent: "space-between",
                  gap: 1.5,
                  mb: 3,
                }}
              >
                <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", alignItems: "center" }}>
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={() => setPacienteSeleccionado(null)}
                    sx={{
                      borderColor: "#a36920",
                      color: "#a36920",
                      borderRadius: 3,
                      "&:hover": { backgroundColor: "#f7f2ea" },
                      fontWeight: "bold",
                      textTransform: "none",
                      minWidth: "auto",
                      px: 2,
                    }}
                  >
                    Volver
                  </Button>

                  <Tooltip title="Exportar PDF" arrow>
                    <IconButton
                      onClick={generarPDF}
                      sx={{
                        backgroundColor: "#a36920",
                        color: "white",
                        width: 38,
                        height: 38,
                        "&:hover": { backgroundColor: "#8a5a1a" },
                      }}
                    >
                      <PictureAsPdf sx={{ fontSize: 20 }} />
                    </IconButton>
                  </Tooltip>

                  <Tooltip title="Consentimiento Informado" arrow>
                    <IconButton
                      onClick={() => generarConsentimientoPDF(pacienteSeleccionado)}
                      sx={{
                        backgroundColor: "white",
                        border: "1.5px solid #ba9a63",
                        color: "#a36920",
                        width: 38,
                        height: 38,
                        "&:hover": { backgroundColor: "#f5f1e4", borderColor: "#a36920" },
                      }}
                    >
                      <Description sx={{ fontSize: 20 }} />
                    </IconButton>
                  </Tooltip>

                  <Button
                    variant="outlined"
                    size="small"
                    sx={{
                      borderColor: "#9c27b0",
                      color: "#9c27b0",
                      "&:hover": { 
                        borderColor: "#7b1fa2",
                        backgroundColor: "rgba(156, 39, 176, 0.04)"
                      },
                      borderRadius: 3,
                      fontWeight: "bold",
                      textTransform: "none",
                      px: 2,
                    }}
                    onClick={() => {
                      setMontoConsultaGlobal(100);
                      setMetodoPagoConsultaGlobal("efectivo");
                      const presPendientes = presupuestosAsignados.filter(p => p.consulta_pagada !== 1 && p.estado_pago !== 'pagado' && p.pagado !== 1);
                      const paqPendientes = paquetesPaciente.filter(p => p.consulta_pagada !== 1 && p.estado_pago !== 'pagado' && p.pagado !== 1);
                      const todosItems = [
                        ...presPendientes.map(p => ({ tipo: 'presupuesto', item: p })),
                        ...paqPendientes.map(p => ({ tipo: 'paquete', item: p })),
                      ];
                      if (todosItems.length === 1) {
                        setConsultaGlobalSeleccion(todosItems[0]);
                      } else if (todosItems.length > 1) {
                        setConsultaGlobalSeleccion(todosItems[0]);
                      } else {
                        setConsultaGlobalSeleccion({ tipo: 'directo', item: null });
                      }
                      setModalPagoConsultaGlobal(true);
                    }}
                  >
                    💊 Pagar Consulta
                  </Button>

                  <Tooltip title="Carrito de tratamientos" arrow>
                    <IconButton
                      onClick={abrirCarritoModal}
                      sx={{
                        backgroundColor: "white",
                        border: "1.5px solid #ba9a63",
                        color: "#a36920",
                        width: 38,
                        height: 38,
                        position: "relative",
                        "&:hover": { backgroundColor: "#f5f1e4", borderColor: "#a36920" },
                      }}
                    >
                      <ShoppingCart sx={{ fontSize: 20 }} />
                      {carritoPaciente.length > 0 && carritoPaciente.reduce((s, c) => s + (c.total_items || 0), 0) > 0 && (
                        <Box sx={{
                          position: "absolute",
                          top: -4,
                          right: -4,
                          backgroundColor: "#e65100",
                          color: "white",
                          borderRadius: "50%",
                          width: 18,
                          height: 18,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "0.6rem",
                          fontWeight: "bold",
                        }}>
                          {carritoPaciente.reduce((s, c) => s + (c.total_items || 0), 0)}
                        </Box>
                      )}
                    </IconButton>
                  </Tooltip>
                </Box>

                <Box sx={{ textAlign: { xs: "left", sm: "right" } }}>
                  <Typography
                    variant="body2"
                    sx={{ color: "rgba(0,0,0,0.62)", lineHeight: 1.4 }}
                  >
                    {pacienteSeleccionado.nombre} {pacienteSeleccionado.apellido}
                  </Typography>
                  <Typography variant="caption" sx={{ color: "rgba(0,0,0,0.52)" }}>
                    Documento: {pacienteSeleccionado.tipoDocumento || 'DNI'}: {pacienteSeleccionado.dni}
                  </Typography>

                  {Number(resumenDeuda?.total_pendiente || 0) > 0 ? (
                    <Typography
                      variant="caption"
                      sx={{
                        display: "inline-block",
                        mt: 0.5,
                        px: 1,
                        py: 0.25,
                        borderRadius: 1.5,
                        backgroundColor: "rgba(183,28,28,0.10)",
                        color: "#b71c1c",
                        fontWeight: 800,
                      }}
                    >
                      Deuda pendiente: S/ {Number(resumenDeuda.total_pendiente || 0).toFixed(2)}
                    </Typography>
                  ) : null}
                </Box>
              </Box>

              {/* Información completa del paciente */}
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2.5 }}>
                <Typography
                  variant="h6"
                  sx={{ 
                    color: "#a36920", 
                    fontWeight: "bold",
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                    fontSize: "0.95rem"
                  }}
                >
                  Información completa del paciente
                </Typography>
                <FormControlLabel
                  control={
                    <Switch
                      checked={Boolean(pacienteSeleccionado.especial)}
                      onChange={async (e) => {
                        const nuevoValor = e.target.checked;
                        try {
                          await axios.patch(
                            `${API_BASE_URL}/api/pacientes/${pacienteSeleccionado.id}/especial`,
                            { especial: nuevoValor },
                            { headers: authHeaders }
                          );
                          setPacienteSeleccionado(prev => ({ ...prev, especial: nuevoValor ? 1 : 0 }));
                          showToast({ severity: "success", message: nuevoValor ? "⭐ Marcado como cliente especial" : "Cliente normal" });
                        } catch (err) {
                          console.error("Error actualizando especial:", err);
                          showToast({ severity: "error", message: "Error al actualizar" });
                        }
                      }}
                      sx={{
                        "& .MuiSwitch-switchBase.Mui-checked": { color: "#d32f2f" },
                        "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": { backgroundColor: "#d32f2f" },
                      }}
                    />
                  }
                  label={
                    <Typography sx={{ fontWeight: pacienteSeleccionado.especial ? "bold" : "normal", color: pacienteSeleccionado.especial ? "#d32f2f" : "#888", fontSize: "0.85rem" }}>
                      {pacienteSeleccionado.especial ? "⭐ Cliente Especial" : "Cliente Normal"}
                    </Typography>
                  }
                />
              </Box>

              <Grid container spacing={3} sx={{ mb: 5 }}>
                {/* DATOS PERSONALES */}
                <Grid item xs={12} md={6}>
                  <Paper
                    elevation={0}
                    sx={{
                      p: 3,
                      borderRadius: 2.5,
                      backgroundColor: "#fff",
                      border: "1px solid #e0e0e0",
                      height: "100%"
                    }}
                  >
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 3, pb: 2, borderBottom: "2px solid #f5f5f5" }}>
                      <Person sx={{ color: "#666", fontSize: 22 }} />
                      <Typography sx={{ fontWeight: 600, color: "#555", fontSize: "0.85rem", textTransform: "uppercase", letterSpacing: "0.8px" }}>
                        Datos Personales
                      </Typography>
                    </Box>
                    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
                      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                        <Box sx={{ flex: 1 }}>
                          <Typography variant="caption" sx={{ color: "#999", fontSize: "0.68rem", textTransform: "uppercase", display: "block", mb: 0.5, letterSpacing: "0.5px" }}>Documento</Typography>
                          <Typography sx={{ fontWeight: 600, color: "#222", fontSize: "0.95rem" }}>DNI: {pacienteSeleccionado.dni || "—"}</Typography>
                        </Box>
                        <Box sx={{ flex: 1 }}>
                          <Typography variant="caption" sx={{ color: "#999", fontSize: "0.68rem", textTransform: "uppercase", display: "block", mb: 0.5, letterSpacing: "0.5px" }}>Edad</Typography>
                          <Typography sx={{ fontWeight: 600, color: "#222", fontSize: "0.95rem" }}>{calcularEdad(pacienteSeleccionado.fechaNacimiento) || pacienteSeleccionado.edad || "—"}</Typography>
                        </Box>
                      </Box>
                      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                        <Box sx={{ flex: 1 }}>
                          <Typography variant="caption" sx={{ color: "#999", fontSize: "0.68rem", textTransform: "uppercase", display: "block", mb: 0.5, letterSpacing: "0.5px" }}>Nombre</Typography>
                          <Typography sx={{ fontWeight: 600, color: "#222", fontSize: "0.95rem" }}>{pacienteSeleccionado.nombre || "—"}</Typography>
                        </Box>
                        <Box sx={{ flex: 1 }}>
                          <Typography variant="caption" sx={{ color: "#999", fontSize: "0.68rem", textTransform: "uppercase", display: "block", mb: 0.5, letterSpacing: "0.5px" }}>Apellido</Typography>
                          <Typography sx={{ fontWeight: 600, color: "#222", fontSize: "0.95rem" }}>{pacienteSeleccionado.apellido || "—"}</Typography>
                        </Box>
                      </Box>
                      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                        <Box sx={{ flex: 1 }}>
                          <Typography variant="caption" sx={{ color: "#999", fontSize: "0.68rem", textTransform: "uppercase", display: "block", mb: 0.5, letterSpacing: "0.5px" }}>Sexo</Typography>
                          <Typography sx={{ fontWeight: 600, color: "#222", fontSize: "0.95rem" }}>{pacienteSeleccionado.sexo || "—"}</Typography>
                        </Box>
                        <Box sx={{ flex: 1 }}>
                          <Typography variant="caption" sx={{ color: "#999", fontSize: "0.68rem", textTransform: "uppercase", display: "block", mb: 0.5, letterSpacing: "0.5px" }}>Fecha Nac.</Typography>
                          <Typography sx={{ fontWeight: 600, color: "#222", fontSize: "0.95rem" }}>{pacienteSeleccionado.fechaNacimiento || "—"}</Typography>
                        </Box>
                      </Box>
                      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                        <Box sx={{ flex: 1 }}>
                          <Typography variant="caption" sx={{ color: "#999", fontSize: "0.68rem", textTransform: "uppercase", display: "block", mb: 0.5, letterSpacing: "0.5px" }}>Ocupación</Typography>
                          <Typography sx={{ fontWeight: 600, color: "#222", fontSize: "0.95rem" }}>{pacienteSeleccionado.ocupacion || "—"}</Typography>
                        </Box>
                        <Box sx={{ flex: 1 }}>
                          <Typography variant="caption" sx={{ color: "#999", fontSize: "0.68rem", textTransform: "uppercase", display: "block", mb: 0.5, letterSpacing: "0.5px" }}>Embarazada</Typography>
                          <Typography sx={{ fontWeight: 600, color: "#222", fontSize: "0.95rem" }}>{pacienteSeleccionado.embarazada || "No especifica"}</Typography>
                        </Box>
                      </Box>
                    </Box>
                  </Paper>
                </Grid>

                {/* CONTACTO */}
                <Grid item xs={12} md={6}>
                  <Paper
                    elevation={0}
                    sx={{
                      p: 3,
                      borderRadius: 2.5,
                      backgroundColor: "#fff",
                      border: "1px solid #e0e0e0",
                      height: "100%"
                    }}
                  >
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 3, pb: 2, borderBottom: "2px solid #f5f5f5" }}>
                      <Phone sx={{ color: "#666", fontSize: 22 }} />
                      <Typography sx={{ fontWeight: 600, color: "#555", fontSize: "0.85rem", textTransform: "uppercase", letterSpacing: "0.8px" }}>
                        Contacto
                      </Typography>
                    </Box>
                    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
                      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                        <Box sx={{ flex: 1 }}>
                          <Typography variant="caption" sx={{ color: "#999", fontSize: "0.68rem", textTransform: "uppercase", display: "block", mb: 0.5, letterSpacing: "0.5px" }}>Celular</Typography>
                          <Typography sx={{ fontWeight: 600, color: "#222", fontSize: "0.95rem" }}>{pacienteSeleccionado.celular || "—"}</Typography>
                        </Box>
                        <Box sx={{ flex: 1 }}>
                          <Typography variant="caption" sx={{ color: "#999", fontSize: "0.68rem", textTransform: "uppercase", display: "block", mb: 0.5, letterSpacing: "0.5px" }}>Correo</Typography>
                          <Typography sx={{ fontWeight: 600, color: "#222", fontSize: "0.95rem", wordBreak: "break-word" }}>{pacienteSeleccionado.correo || "—"}</Typography>
                        </Box>
                      </Box>
                      <Box>
                        <Typography variant="caption" sx={{ color: "#999", fontSize: "0.68rem", textTransform: "uppercase", display: "block", mb: 0.5, letterSpacing: "0.5px" }}>Dirección</Typography>
                        <Typography sx={{ fontWeight: 600, color: "#222", fontSize: "0.95rem" }}>{pacienteSeleccionado.direccion || "—"}</Typography>
                      </Box>
                      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                        <Box sx={{ flex: 1 }}>
                          <Typography variant="caption" sx={{ color: "#999", fontSize: "0.68rem", textTransform: "uppercase", display: "block", mb: 0.5, letterSpacing: "0.5px" }}>Ciudad Res.</Typography>
                          <Typography sx={{ fontWeight: 600, color: "#222", fontSize: "0.95rem" }}>{pacienteSeleccionado.ciudadResidencia || "—"}</Typography>
                        </Box>
                        <Box sx={{ flex: 1 }}>
                          <Typography variant="caption" sx={{ color: "#999", fontSize: "0.68rem", textTransform: "uppercase", display: "block", mb: 0.5, letterSpacing: "0.5px" }}>N° Hijos</Typography>
                          <Typography sx={{ fontWeight: 600, color: "#222", fontSize: "0.95rem" }}>{pacienteSeleccionado.numeroHijos ?? "—"}</Typography>
                        </Box>
                      </Box>
                      <Box>
                        <Typography variant="caption" sx={{ color: "#999", fontSize: "0.68rem", textTransform: "uppercase", display: "block", mb: 0.5, letterSpacing: "0.5px" }}>Referencia</Typography>
                        <Typography sx={{ fontWeight: 600, color: "#222", fontSize: "0.95rem" }}>{pacienteSeleccionado.referencia || "No especificada"}</Typography>
                      </Box>
                    </Box>
                  </Paper>
                </Grid>

                {/* HISTORIAL MÉDICO */}
                <Grid item xs={12} md={6}>
                  <Paper
                    elevation={0}
                    sx={{
                      p: 3,
                      borderRadius: 2.5,
                      backgroundColor: "#fff",
                      border: "1px solid #e0e0e0",
                      height: "100%"
                    }}
                  >
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 3, pb: 2, borderBottom: "2px solid #f5f5f5" }}>
                      <LocalHospital sx={{ color: "#666", fontSize: 22 }} />
                      <Typography sx={{ fontWeight: 600, color: "#555", fontSize: "0.85rem", textTransform: "uppercase", letterSpacing: "0.8px" }}>
                        Historial Médico
                      </Typography>
                    </Box>
                    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
                      <Chip 
                        icon={pacienteSeleccionado.alergias && pacienteSeleccionado.alergias !== "Ninguna" ? <Close sx={{ fontSize: 16 }} /> : <Check sx={{ fontSize: 16 }} />}
                        label={pacienteSeleccionado.alergias && pacienteSeleccionado.alergias !== "Ninguna" ? `Alergias: ${pacienteSeleccionado.alergias}` : "Sin alergias"}
                        sx={{ 
                          backgroundColor: pacienteSeleccionado.alergias && pacienteSeleccionado.alergias !== "Ninguna" ? "#fff3e0" : "#e8f5e9",
                          color: pacienteSeleccionado.alergias && pacienteSeleccionado.alergias !== "Ninguna" ? "#e65100" : "#2e7d32",
                          fontWeight: 600,
                          fontSize: "0.8rem",
                          height: "36px",
                          justifyContent: "flex-start",
                          px: 2
                        }}
                      />
                      <Chip 
                        icon={pacienteSeleccionado.enfermedad && pacienteSeleccionado.enfermedad !== "Ninguna" ? <Close sx={{ fontSize: 16 }} /> : <Check sx={{ fontSize: 16 }} />}
                        label={pacienteSeleccionado.enfermedad && pacienteSeleccionado.enfermedad !== "Ninguna" ? `Enfermedades: ${pacienteSeleccionado.enfermedad}` : "Sin enfermedades"}
                        sx={{ 
                          backgroundColor: pacienteSeleccionado.enfermedad && pacienteSeleccionado.enfermedad !== "Ninguna" ? "#fff3e0" : "#e8f5e9",
                          color: pacienteSeleccionado.enfermedad && pacienteSeleccionado.enfermedad !== "Ninguna" ? "#e65100" : "#2e7d32",
                          fontWeight: 600,
                          fontSize: "0.8rem",
                          height: "36px",
                          justifyContent: "flex-start",
                          px: 2
                        }}
                      />
                      <Chip 
                        label={pacienteSeleccionado.cirugiaEstetica && pacienteSeleccionado.cirugiaEstetica.trim() !== "" ? `Cirugía: ${pacienteSeleccionado.cirugiaEstetica}` : "Sin cirugía estética"}
                        sx={{ 
                          backgroundColor: "#f3e5f5",
                          color: "#6a1b9a",
                          fontWeight: 600,
                          fontSize: "0.8rem",
                          height: "36px",
                          justifyContent: "flex-start",
                          px: 2
                        }}
                      />
                    </Box>
                  </Paper>
                </Grid>

                {/* HÁBITOS */}
                <Grid item xs={12} md={6}>
                  <Paper
                    elevation={0}
                    sx={{
                      p: 3,
                      borderRadius: 2.5,
                      backgroundColor: "#fff",
                      border: "1px solid #e0e0e0",
                      height: "100%"
                    }}
                  >
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 3, pb: 2, borderBottom: "2px solid #f5f5f5" }}>
                      <Favorite sx={{ color: "#666", fontSize: 22 }} />
                      <Typography sx={{ fontWeight: 600, color: "#555", fontSize: "0.85rem", textTransform: "uppercase", letterSpacing: "0.8px" }}>
                        Hábitos
                      </Typography>
                    </Box>
                    <Box sx={{ display: "flex", justifyContent: "space-around", gap: 3 }}>
                      <Box sx={{ textAlign: "center", flex: 1 }}>
                        <Typography variant="caption" sx={{ color: "#999", fontSize: "0.68rem", textTransform: "uppercase", display: "block", mb: 1, letterSpacing: "0.5px" }}>Tabaco</Typography>
                        <Typography sx={{ 
                          fontWeight: 700, 
                          color: pacienteSeleccionado.tabaco === "Sí" ? "#d32f2f" : "#2e7d32",
                          fontSize: "1.1rem"
                        }}>
                          {pacienteSeleccionado.tabaco === "Sí" ? "Sí" : "No"}
                        </Typography>
                      </Box>
                      <Box sx={{ textAlign: "center", flex: 1 }}>
                        <Typography variant="caption" sx={{ color: "#999", fontSize: "0.68rem", textTransform: "uppercase", display: "block", mb: 1, letterSpacing: "0.5px" }}>Alcohol</Typography>
                        <Typography sx={{ 
                          fontWeight: 700, 
                          color: pacienteSeleccionado.alcohol === "Sí" ? "#d32f2f" : "#2e7d32",
                          fontSize: "1.1rem"
                        }}>
                          {pacienteSeleccionado.alcohol === "Sí" ? "Sí" : "No"}
                        </Typography>
                      </Box>
                      <Box sx={{ textAlign: "center", flex: 1 }}>
                        <Typography variant="caption" sx={{ color: "#999", fontSize: "0.68rem", textTransform: "uppercase", display: "block", mb: 1, letterSpacing: "0.5px" }}>Drogas</Typography>
                        <Typography sx={{ 
                          fontWeight: 700, 
                          color: pacienteSeleccionado.drogas === "Sí" ? "#d32f2f" : "#2e7d32",
                          fontSize: "1.1rem"
                        }}>
                          {pacienteSeleccionado.drogas === "Sí" ? "Sí" : "No"}
                        </Typography>
                      </Box>
                    </Box>
                  </Paper>
                </Grid>

                {/* OTRAS OBSERVACIONES */}
                <Grid item xs={12}>
                  <Paper
                    elevation={0}
                    sx={{
                      p: 3,
                      borderRadius: 2.5,
                      backgroundColor: "#fff",
                      border: "1px solid #e0e0e0",
                    }}
                  >
                    <Box 
                      onClick={() => setShowObservaciones(prev => !prev)}
                      sx={{ 
                        display: "flex", 
                        alignItems: "center", 
                        justifyContent: "space-between",
                        cursor: "pointer",
                        mb: showObservaciones ? 3 : 0,
                        pb: showObservaciones ? 2 : 0,
                        borderBottom: showObservaciones ? "2px solid #f5f5f5" : "none",
                        transition: "all 0.3s ease"
                      }}
                    >
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                        <DescriptionOutlined sx={{ color: "#666", fontSize: 22 }} />
                        <Typography sx={{ fontWeight: 600, color: "#555", fontSize: "0.85rem", textTransform: "uppercase", letterSpacing: "0.8px" }}>
                          Otras observaciones
                        </Typography>
                        {Array.isArray(observaciones) && observaciones.length > 0 && (
                          <Chip 
                            label={observaciones.length} 
                            size="small" 
                            sx={{ 
                              backgroundColor: "#f5f5f5", 
                              color: "#666", 
                              fontWeight: 600,
                              height: "24px",
                              fontSize: "0.75rem"
                            }} 
                          />
                        )}
                      </Box>
                      <IconButton size="small" sx={{ color: "#666" }}>
                        {showObservaciones ? <ExpandLess /> : <ExpandMore />}
                      </IconButton>
                    </Box>

                    <Collapse in={showObservaciones} timeout="auto" unmountOnExit>
                      <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
                        {/* Nueva observación */}
                        <Box sx={{ 
                          p: 2.5, 
                          backgroundColor: "#fafafa", 
                          borderRadius: 2,
                          border: "1px solid #e8e8e8"
                        }}>
                          <Typography variant="subtitle2" sx={{ color: "#555", mb: 1.5, fontWeight: 600, fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                            Nueva observación
                          </Typography>
                          <TextField
                            fullWidth
                            multiline
                            minRows={3}
                            placeholder="Escribe aquí cualquier observación adicional..."
                            value={nuevaObservacion}
                            onChange={(e) => setNuevaObservacion(e.target.value)}
                            sx={{
                              "& .MuiInputBase-root": {
                                backgroundColor: "#fff",
                                borderRadius: 2,
                              },
                              "& .MuiOutlinedInput-root": {
                                "&:hover fieldset": { borderColor: "#a36920" },
                                "&.Mui-focused fieldset": { borderColor: "#a36920" },
                              },
                            }}
                          />
                          <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 1.5 }}>
                            <Button
                              variant="contained"
                              size="medium"
                              sx={{
                                backgroundColor: "#a36920",
                                "&:hover": { backgroundColor: "#8b581b" },
                                borderRadius: 2,
                                fontWeight: 600,
                                textTransform: "none",
                                px: 3,
                                boxShadow: "0 2px 8px rgba(163,105,32,0.2)"
                              }}
                              disabled={guardandoObservaciones || !nuevaObservacion.trim()}
                              onClick={guardarObservacion}
                            >
                              {guardandoObservaciones ? "Guardando..." : "Guardar observación"}
                            </Button>
                          </Box>
                        </Box>

                        {/* Historial de observaciones */}
                        {Array.isArray(observaciones) && observaciones.length > 0 && (
                          <Box>
                            <Typography
                              variant="subtitle2"
                              sx={{ color: "#555", mb: 2, fontWeight: 600, fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.5px" }}
                            >
                              Historial ({observaciones.length})
                            </Typography>
                    <Box
                      sx={{
                        display: "grid",
                        gap: 1.2,
                        maxHeight: 220,
                        overflowY: "auto",
                        pr: 0.5,
                      }}
                    >
                      {observaciones.map((o) => (
                        <Paper
                          key={o.id}
                          elevation={0}
                          sx={{
                            p: 2,
                            borderRadius: 2,
                            backgroundColor: "#fff",
                            border: "1px solid #e8e8e8",
                            transition: "all 0.2s ease",
                            "&:hover": {
                              borderColor: "#d0d0d0",
                              boxShadow: "0 2px 8px rgba(0,0,0,0.05)"
                            }
                          }}
                        >
                          <Box
                            sx={{
                              display: "flex",
                              alignItems: "flex-start",
                              justifyContent: "space-between",
                              gap: 2,
                            }}
                          >
                            <Box sx={{ flex: 1 }}>
                              <Typography
                                variant="caption"
                                sx={{
                                  display: "block",
                                  color: "#999",
                                  mb: 1,
                                  fontSize: "0.7rem",
                                  fontWeight: 500
                                }}
                              >
                                {o.creado_en}
                              </Typography>

                              {observacionEditId === o.id ? (
                                <TextField
                                  fullWidth
                                  multiline
                                  minRows={3}
                                  value={observacionEditTexto}
                                  onChange={(e) =>
                                    setObservacionEditTexto(e.target.value)
                                  }
                                  sx={{
                                    "& .MuiInputBase-root": {
                                      backgroundColor: "rgba(212, 175, 55, 0.10)",
                                      borderRadius: 2,
                                    },
                                    "& .MuiOutlinedInput-root": {
                                      "&:hover fieldset": { borderColor: "#a36920" },
                                      "&.Mui-focused fieldset": { borderColor: "#a36920" },
                                    },
                                  }}
                                />
                              ) : (
                                <Typography sx={{ whiteSpace: "pre-wrap" }}>
                                  {o.texto}
                                </Typography>
                              )}
                            </Box>

                            <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                              {observacionEditId === o.id ? (
                                <>
                                  <Button
                                    size="small"
                                    variant="contained"
                                    sx={{
                                      backgroundColor: "#a36920",
                                      "&:hover": { backgroundColor: "#8b581b" },
                                      borderRadius: 3,
                                      fontWeight: "bold",
                                    }}
                                    disabled={guardandoObservacionEdit}
                                    onClick={guardarEdicionObservacion}
                                  >
                                    Guardar
                                  </Button>
                                  <Button
                                    size="small"
                                    variant="outlined"
                                    sx={{
                                      borderColor: "#a36920",
                                      color: "#a36920",
                                      borderRadius: 3,
                                      fontWeight: "bold",
                                    }}
                                    onClick={() => {
                                      setObservacionEditId(null);
                                      setObservacionEditTexto("");
                                    }}
                                  >
                                    Cancelar
                                  </Button>
                                </>
                              ) : (
                                <Button
                                  size="small"
                                  variant="outlined"
                                  sx={{
                                    borderColor: "#a36920",
                                    color: "#a36920",
                                    borderRadius: 3,
                                    fontWeight: "bold",
                                    "&:hover": { backgroundColor: "rgba(163,105,32,0.08)" },
                                  }}
                                  onClick={() => {
                                    setObservacionEditId(o.id);
                                    setObservacionEditTexto(o.texto || "");
                                  }}
                                >
                                  Editar
                                </Button>
                              )}
                            </Box>
                          </Box>
                        </Paper>
                      ))}
                    </Box>
                  </Box>
                )}
                      </Box>
                    </Collapse>
                  </Paper>
                </Grid>
              </Grid>

              <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 2, mt: 6, flexWrap: "wrap" }}>
                <Typography
                  variant="h6"
                  sx={{ color: "#a36920", fontWeight: "bold" }}
                >
                  Presupuesto inicial
                </Typography>
                <IconButton
                  sx={{
                    width: 42,
                    height: 42,
                    backgroundColor: showOferta ? "#e0e0e0" : "#4caf50",
                    color: "white",
                    boxShadow: showOferta ? "none" : "0 2px 8px rgba(76,175,80,0.3)",
                    transition: "all 0.2s ease",
                    "&:hover": { 
                      backgroundColor: showOferta ? "#d0d0d0" : "#45a049",
                      transform: showOferta ? "none" : "scale(1.05)",
                      boxShadow: showOferta ? "none" : "0 4px 12px rgba(76,175,80,0.4)",
                    },
                    "&.Mui-disabled": {
                      backgroundColor: "#f5f5f5",
                      color: "#ccc",
                    },
                  }}
                  onClick={() => {
                    setShowOferta((v) => {
                      if (!v) {
                        // Recargar tratamientos al abrir para que aparezcan nuevos protocolos
                        axios.get(`${API_BASE_URL}/api/tratamientos/listar`, {
                          headers: authHeaders,
                        }).then((res) => {
                          const tratamientosOrdenados = Array.isArray(res.data) ? res.data.sort((a, b) => {
                            return (a.nombre || '').toLowerCase().localeCompare((b.nombre || '').toLowerCase());
                          }) : [];
                          setTratamientosBase(tratamientosOrdenados);
                        }).catch(() => {});
                        setCatalogoCarouselIdx(0);
                        setCatalogoFiltro("");
                      }
                      return !v;
                    });
                  }}
                  disabled={!pacienteSeleccionado}
                >
                  <Typography sx={{ fontSize: 24, fontWeight: "bold", lineHeight: 1 }}>
                    {showOferta ? "×" : "+"}
                  </Typography>
                </IconButton>
                <Button
                  variant="contained"
                  sx={{
                    backgroundColor: "#ba9a63",
                    color: "white",
                    fontWeight: 700,
                    borderRadius: 3,
                    px: 2.5,
                    py: 1,
                    textTransform: "none",
                    fontSize: "0.9rem",
                    boxShadow: "0 2px 8px rgba(186,154,99,0.25)",
                    transition: "all 0.2s ease",
                    "&:hover": { 
                      backgroundColor: "#a36920",
                      boxShadow: "0 4px 12px rgba(163,105,32,0.3)",
                      transform: "translateY(-1px)",
                    },
                    "&.Mui-disabled": {
                      backgroundColor: "#e0e0e0",
                      color: "#999",
                    },
                  }}
                  onClick={() => {
                    const paquetesSection = document.getElementById("paquetes-promocionales");
                    if (paquetesSection) {
                      paquetesSection.scrollIntoView({ behavior: "smooth" });
                    }
                  }}
                  disabled={!pacienteSeleccionado}
                  startIcon={<Inventory2 />}
                >
                  Paquete
                </Button>
                <Button
                  variant="outlined"
                  sx={{
                    borderColor: "#757575",
                    color: "#757575",
                    fontWeight: 700,
                    borderRadius: 3,
                    px: 2.5,
                    py: 1,
                    textTransform: "none",
                    fontSize: "0.9rem",
                    borderWidth: 2,
                    transition: "all 0.2s ease",
                    "&:hover": { 
                      backgroundColor: "rgba(117,117,117,0.08)",
                      borderColor: "#616161",
                      borderWidth: 2,
                      transform: "translateY(-1px)",
                    },
                    "&.Mui-disabled": {
                      borderColor: "#e0e0e0",
                      color: "#999",
                    },
                  }}
                  onClick={abrirModalFacial}
                  disabled={!pacienteSeleccionado}
                  startIcon={<Face />}
                >
                  Mapa Facial 3D
                </Button>
                <Button
                  variant="outlined"
                  sx={{
                    borderColor: "#757575",
                    color: "#757575",
                    fontWeight: 700,
                    borderRadius: 3,
                    px: 2.5,
                    py: 1,
                    textTransform: "none",
                    fontSize: "0.9rem",
                    borderWidth: 2,
                    transition: "all 0.2s ease",
                    "&:hover": { 
                      backgroundColor: "rgba(117,117,117,0.08)",
                      borderColor: "#616161",
                      borderWidth: 2,
                      transform: "translateY(-1px)",
                    },
                    "&.Mui-disabled": {
                      borderColor: "#e0e0e0",
                      color: "#999",
                    },
                  }}
                  onClick={abrirModalCorporal}
                  disabled={!pacienteSeleccionado}
                  startIcon={<FitnessCenter />}
                >
                  Corporal
                </Button>
              </Box>

              {showOferta && (
                <Paper
                  elevation={0}
                  sx={{
                    mb: 4,
                    p: 3,
                    borderRadius: 4,
                    backgroundColor: "white",
                    border: "1px solid rgba(163,105,32,0.15)",
                    boxShadow: "0 4px 20px rgba(0,0,0,0.06)",
                  }}
                >
                  <Typography sx={{ mb: 0.5, fontWeight: 800, fontSize: "1.15rem", color: "#1a1a1a" }}>
                    {ofertaEditId ? "Editando presupuesto" : "Nuevo presupuesto"}
                  </Typography>
                  <Typography variant="body2" sx={{ color: "#999", mb: 2 }}>
                    Selecciona tratamientos para agregar al presupuesto
                  </Typography>

                  {/* Layout dividido: catálogo izquierda + resumen derecha */}
                  <Box sx={{ display: "flex", gap: 2.5, flexDirection: { xs: "column", md: ofertaItems.length > 0 ? "row" : "column" } }}>

                  {/* Catálogo de tratamientos */}
                  <Box sx={{ flex: 1, minWidth: 0 }}>

                  {/* Buscador de tratamientos */}
                  <TextField
                    fullWidth
                    size="small"
                    placeholder="🔍 Buscar tratamiento..."
                    value={catalogoFiltro}
                    onChange={(e) => { setCatalogoFiltro(e.target.value); setCatalogoCarouselIdx(0); }}
                    sx={{ 
                      mb: 2,
                      "& .MuiInputBase-root": {
                        backgroundColor: "#f5f1e4",
                        borderRadius: 3,
                        fontSize: "0.95rem",
                      },
                      "& .MuiOutlinedInput-root": {
                        "& fieldset": { borderColor: "transparent" },
                        "&:hover fieldset": { borderColor: "#ba9a63" },
                        "&.Mui-focused fieldset": { borderColor: "#a36920" },
                      },
                    }}
                  />

                  {/* Catálogo de TODOS los tratamientos */}
                  {(() => {
                    const filteredTrats = (tratamientosBase || []).filter(t =>
                      !catalogoFiltro || t.nombre.toLowerCase().includes(catalogoFiltro.toLowerCase())
                    );
                    // Ordenar según el modo seleccionado
                    const catVisible = [...filteredTrats].sort((a, b) => {
                      if (catalogoOrden === "popular") {
                        const usoA = tratamientosUso[a.id] || 0;
                        const usoB = tratamientosUso[b.id] || 0;
                        if (usoB !== usoA) return usoB - usoA;
                        return (a.nombre || '').localeCompare(b.nombre || '');
                      }
                      return (a.nombre || '').toLowerCase().localeCompare((b.nombre || '').toLowerCase());
                    });
                    // Cargar imágenes faltantes del catálogo
                    const catMissing = catVisible.map(t => t.id).filter(id => id && !(id in tratamientoImagenCache));
                    if (catMissing.length > 0) {
                      setTimeout(() => cargarImagenesPresupuesto(catMissing.map(id => ({ tratamiento_id: id }))), 0);
                    }
                    return (
                    <Box sx={{ mb: 3 }}>
                      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 700, color: "#888" }}>
                          {filteredTrats.length} tratamiento{filteredTrats.length !== 1 ? "s" : ""} disponible{filteredTrats.length !== 1 ? "s" : ""}
                        </Typography>
                        <Box sx={{ display: "flex", gap: 0.5 }}>
                          <Chip
                            label="Populares"
                            size="small"
                            onClick={() => setCatalogoOrden("popular")}
                            sx={{
                              fontSize: "0.7rem",
                              fontWeight: 700,
                              backgroundColor: catalogoOrden === "popular" ? "#a36920" : "#f5f1e4",
                              color: catalogoOrden === "popular" ? "white" : "#666",
                              cursor: "pointer",
                              "&:hover": { backgroundColor: catalogoOrden === "popular" ? "#8a5a1a" : "#ece5d0" },
                            }}
                          />
                          <Chip
                            label="A-Z"
                            size="small"
                            onClick={() => setCatalogoOrden("nombre")}
                            sx={{
                              fontSize: "0.7rem",
                              fontWeight: 700,
                              backgroundColor: catalogoOrden === "nombre" ? "#a36920" : "#f5f1e4",
                              color: catalogoOrden === "nombre" ? "white" : "#666",
                              cursor: "pointer",
                              "&:hover": { backgroundColor: catalogoOrden === "nombre" ? "#8a5a1a" : "#ece5d0" },
                            }}
                          />
                        </Box>
                      </Box>

                      <Box 
                        sx={{ 
                          display: "grid", 
                          gridTemplateColumns: { xs: "1fr 1fr 1fr", sm: "1fr 1fr 1fr 1fr", md: "1fr 1fr 1fr 1fr 1fr", lg: "1fr 1fr 1fr 1fr 1fr 1fr" }, 
                          gap: 1.2,
                        }}
                      >
                        {catVisible.map((t) => {
                          const isSelected = ofertaItems.some(x => x.tratamientoId === t.id);
                          const count = ofertaItems.filter(x => x.tratamientoId === t.id).length;
                          const imgArray = tratamientoImagenCache[t.id];
                          const imgUrl = Array.isArray(imgArray) && imgArray.length > 0 ? imgArray[0] : null;
                          return (
                            <Box
                              key={t.id}
                              sx={{
                                borderRadius: 2,
                                border: `1.5px solid ${isSelected ? '#a36920' : 'rgba(163,105,32,0.15)'}`,
                                backgroundColor: isSelected ? "rgba(163,105,32,0.04)" : "white",
                                transition: "all 0.2s ease",
                                display: "flex",
                                flexDirection: "column",
                                overflow: "hidden",
                                position: "relative",
                                "&:hover": { 
                                  borderColor: "#ba9a63",
                                  boxShadow: "0 2px 8px rgba(163,105,32,0.12)",
                                },
                              }}
                            >
                              {/* Imagen del tratamiento */}
                              <Box sx={{
                                width: "100%",
                                aspectRatio: "1 / 1",
                                backgroundColor: "#f5f1e4",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                overflow: "hidden",
                              }}>
                                {imgUrl ? (
                                  <img src={imgUrl} alt={t.nombre} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                ) : (
                                  <Typography sx={{ fontSize: "1.5rem", opacity: 0.3 }}>💉</Typography>
                                )}
                              </Box>
                              {/* Info */}
                              <Box sx={{ p: 0.8 }}>
                                <Typography sx={{ 
                                  fontWeight: 700, 
                                  fontSize: "0.68rem", 
                                  color: isSelected ? "#a36920" : "#333",
                                  lineHeight: 1.2,
                                  display: "-webkit-box",
                                  WebkitLineClamp: 2,
                                  WebkitBoxOrient: "vertical",
                                  overflow: "hidden",
                                  minHeight: "1.7em",
                                }}>
                                  {t.nombre}
                                </Typography>
                                <Typography sx={{ fontWeight: 800, fontSize: "0.72rem", color: isSelected ? "#a36920" : "#666", mt: 0.3 }}>
                                  {t.precio ? `S/ ${Number(t.precio).toFixed(2)}` : "Sin precio"}
                                </Typography>
                              </Box>
                              {/* Botones + / - */}
                              <Box sx={{
                                position: "absolute",
                                bottom: 4,
                                right: 4,
                                display: "flex",
                                alignItems: "center",
                                gap: 0.3,
                                backgroundColor: "rgba(255,255,255,0.92)",
                                borderRadius: 2,
                                padding: "2px 4px",
                                boxShadow: "0 1px 4px rgba(0,0,0,0.15)",
                              }}>
                                <Box
                                  onClick={(e) => { e.stopPropagation(); removeOneOfertaItem(t); }}
                                  sx={{
                                    width: 20, height: 20,
                                    borderRadius: "50%",
                                    backgroundColor: count > 0 ? "#e57373" : "#eee",
                                    color: count > 0 ? "white" : "#bbb",
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                    cursor: count > 0 ? "pointer" : "default",
                                    fontSize: "0.85rem", fontWeight: 700, lineHeight: 1,
                                    "&:hover": count > 0 ? { backgroundColor: "#d32f2f" } : {},
                                  }}
                                >−</Box>
                                <Typography sx={{ fontSize: "0.7rem", fontWeight: 800, color: count > 0 ? "#a36920" : "#999", minWidth: 14, textAlign: "center" }}>
                                  {count}
                                </Typography>
                                <Box
                                  onClick={(e) => { e.stopPropagation(); addOfertaItem(t); }}
                                  sx={{
                                    width: 20, height: 20,
                                    borderRadius: "50%",
                                    backgroundColor: "#a36920",
                                    color: "white",
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                    cursor: "pointer",
                                    fontSize: "0.85rem", fontWeight: 700, lineHeight: 1,
                                    "&:hover": { backgroundColor: "#8a5a1a" },
                                  }}
                                >+</Box>
                              </Box>
                            </Box>
                          );
                        })}
                      </Box>

                      {filteredTrats.length === 0 && (
                        <Box sx={{ textAlign: "center", py: 4, color: "#ccc" }}>
                          <Typography>No se encontraron tratamientos</Typography>
                        </Box>
                      )}
                    </Box>
                    );
                  })()}

                  </Box>
                  {/* FIN LADO IZQUIERDO */}

                  {/* Resumen de seleccionados (panel lateral) */}
                  {ofertaItems.length > 0 && (
                    <Box sx={{ 
                      width: { md: 340 },
                      minWidth: { md: 340 },
                      backgroundColor: "#faf8f4",
                      borderRadius: 3,
                      border: "1px solid rgba(163,105,32,0.15)",
                      p: 2,
                      display: "flex",
                      flexDirection: "column",
                      alignSelf: "flex-start",
                    }}>
                      <Typography sx={{ fontWeight: 800, fontSize: "0.95rem", color: "#1a1a1a", mb: 1.5 }}>
                        Resumen ({ofertaItems.length})
                      </Typography>

                      {/* Lista de items editables */}
                      <Box>
                        {ofertaItems.map((item, idx) => {
                          const t = tratamientosBase.find(x => x.id === item.tratamientoId);
                          if (!t) return null;
                          return (
                            <Box
                              key={`${item.tratamientoId}-${idx}`}
                              sx={{
                                display: "flex",
                                flexDirection: "column",
                                gap: 0.8,
                                p: 1.2,
                                mb: 1,
                                backgroundColor: "white",
                                borderRadius: 2,
                                border: "1px solid rgba(163,105,32,0.1)",
                              }}
                            >
                              {/* Header: nombre + botón eliminar */}
                              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                <Typography sx={{ fontWeight: 700, fontSize: "0.78rem", color: "#1a1a1a", flex: 1, lineHeight: 1.3 }}>
                                  {t.nombre}
                                </Typography>
                                <IconButton
                                  size="small"
                                  onClick={() => removeOneOfertaItem(t)}
                                  sx={{ width: 22, height: 22, color: "#e57373", "&:hover": { color: "#d32f2f" } }}
                                >
                                  <Close sx={{ fontSize: 14 }} />
                                </IconButton>
                              </Box>

                              {/* Precio + Sesiones */}
                              <Box sx={{ display: "flex", gap: 0.5 }}>
                                <TextField
                                  size="small"
                                  label="S/ Precio"
                                  type="number"
                                  value={item?.precio ?? ""}
                                  onChange={(e) => setOfertaPrecio(t.id, e.target.value)}
                                  sx={{
                                    flex: 1,
                                    "& .MuiInputBase-root": { backgroundColor: "#fffdf7", borderRadius: 1.5, fontSize: "0.78rem", fontWeight: 700, height: 34 },
                                    "& .MuiOutlinedInput-root": {
                                      "& fieldset": { borderColor: "rgba(163,105,32,0.2)" },
                                      "&:hover fieldset": { borderColor: "#ba9a63" },
                                      "&.Mui-focused fieldset": { borderColor: "#a36920" },
                                    },
                                    "& .MuiInputLabel-root": { fontSize: "0.7rem" },
                                    "& .MuiInputLabel-root.Mui-focused": { color: "#a36920" },
                                  }}
                                />
                                <TextField
                                  size="small"
                                  label="Sesiones"
                                  type="number"
                                  value={item?.sesiones ?? "1"}
                                  onChange={(e) => setOfertaSesiones(t.id, e.target.value)}
                                  inputProps={{ min: 1, step: 1 }}
                                  sx={{
                                    width: 70,
                                    "& .MuiInputBase-root": { backgroundColor: "#fffdf7", borderRadius: 1.5, fontSize: "0.78rem", height: 34 },
                                    "& .MuiOutlinedInput-root": {
                                      "& fieldset": { borderColor: "rgba(163,105,32,0.2)" },
                                      "&:hover fieldset": { borderColor: "#ba9a63" },
                                      "&.Mui-focused fieldset": { borderColor: "#a36920" },
                                    },
                                    "& .MuiInputLabel-root": { fontSize: "0.7rem" },
                                    "& .MuiInputLabel-root.Mui-focused": { color: "#a36920" },
                                  }}
                                />
                              </Box>

                              {/* Producto + ML */}
                              <Box sx={{ display: "flex", gap: 0.5 }}>
                                <Autocomplete
                                  freeSolo
                                  size="small"
                                  options={productosInventario}
                                  getOptionLabel={(option) => typeof option === "string" ? option : option?.label || ""}
                                  value={item?.producto || ""}
                                  onChange={(e, newValue) => {
                                    const val = typeof newValue === "string" ? newValue : newValue?.value || "";
                                    setOfertaProducto(t.id, val);
                                  }}
                                  onInputChange={(e, newInputValue, reason) => {
                                    if (reason === "input") setOfertaProducto(t.id, newInputValue);
                                  }}
                                  filterOptions={(options, { inputValue }) => {
                                    const term = (inputValue || "").toLowerCase();
                                    if (!term) return options.slice(0, 20);
                                    return options.filter(o => o.label.toLowerCase().includes(term)).slice(0, 20);
                                  }}
                                  sx={{ flex: 1 }}
                                  renderInput={(params) => (
                                    <TextField
                                      {...params}
                                      label="Producto"
                                      sx={{
                                        "& .MuiInputBase-root": { backgroundColor: "#fffdf7", borderRadius: 1.5, fontSize: "0.75rem", height: 34 },
                                        "& .MuiOutlinedInput-root": {
                                          "& fieldset": { borderColor: "rgba(163,105,32,0.2)" },
                                          "&:hover fieldset": { borderColor: "#ba9a63" },
                                          "&.Mui-focused fieldset": { borderColor: "#a36920" },
                                        },
                                        "& .MuiInputLabel-root": { fontSize: "0.7rem" },
                                        "& .MuiInputLabel-root.Mui-focused": { color: "#a36920" },
                                      }}
                                    />
                                  )}
                                />
                                <TextField
                                  size="small"
                                  label="ML"
                                  type="number"
                                  value={item?.ml ?? ""}
                                  onChange={(e) => setOfertaMl(t.id, e.target.value)}
                                  inputProps={{ min: 0, step: 0.1 }}
                                  sx={{
                                    width: 55,
                                    "& .MuiInputBase-root": { backgroundColor: "#fffdf7", borderRadius: 1.5, fontSize: "0.75rem", height: 34 },
                                    "& .MuiOutlinedInput-root": {
                                      "& fieldset": { borderColor: "rgba(163,105,32,0.2)" },
                                      "&:hover fieldset": { borderColor: "#ba9a63" },
                                      "&.Mui-focused fieldset": { borderColor: "#a36920" },
                                    },
                                    "& .MuiInputLabel-root": { fontSize: "0.7rem" },
                                    "& .MuiInputLabel-root.Mui-focused": { color: "#a36920" },
                                  }}
                                />
                              </Box>
                            </Box>
                          );
                        })}
                      </Box>

                      {/* Total + descuento + botones */}
                      <Box sx={{ pt: 1.5, mt: 1, borderTop: "1px solid rgba(163,105,32,0.15)" }}>
                        <Typography sx={{ fontWeight: 800, fontSize: "1.05rem", color: "#a36920", mb: 0.5 }}>
                          Subtotal: S/ {totalOferta.toFixed(2)}
                        </Typography>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
                          <Typography sx={{ fontSize: "0.85rem", color: "#666", whiteSpace: "nowrap" }}>
                            Descuento S/:
                          </Typography>
                          <TextField
                            size="small"
                            type="number"
                            placeholder="0.00"
                            value={descuentoOferta}
                            onChange={(e) => setDescuentoOferta(e.target.value)}
                            inputProps={{ min: 0, step: 0.01 }}
                            sx={{
                              width: 100,
                              "& .MuiInputBase-root": { backgroundColor: "#fffdf7", borderRadius: 1.5, fontSize: "0.8rem", height: 32 },
                              "& .MuiOutlinedInput-root": {
                                "& fieldset": { borderColor: "rgba(163,105,32,0.25)" },
                                "&:hover fieldset": { borderColor: "#ba9a63" },
                                "&.Mui-focused fieldset": { borderColor: "#a36920" },
                              },
                            }}
                          />
                        </Box>
                        {Number(descuentoOferta) > 0 && (
                          <Typography sx={{ fontWeight: 800, fontSize: "1.1rem", color: "#a36920", mb: 1.5 }}>
                            Total: S/ {(totalOferta - Number(descuentoOferta)).toFixed(2)}
                          </Typography>
                        )}
                        {!(Number(descuentoOferta) > 0) && <Box sx={{ mb: 1 }} />}
                        <Box sx={{ display: "flex", gap: 1 }}>
                          {ofertaEditId && (
                            <Button
                              variant="outlined"
                              size="small"
                              sx={{
                                borderColor: "#e0e0e0",
                                color: "#888",
                                borderRadius: 3,
                                textTransform: "none",
                                fontSize: "0.8rem",
                                "&:hover": { backgroundColor: "#f5f5f5", borderColor: "#ccc" },
                              }}
                              onClick={() => {
                                setOfertaEditId(null);
                                setOfertaItems([]);
                                setDescuentoOferta("");
                                setShowOferta(false);
                              }}
                            >
                              Cancelar
                            </Button>
                          )}
                          <Button
                            variant="contained"
                            size="small"
                            sx={{
                              backgroundColor: "#a36920",
                              borderRadius: 3,
                              fontWeight: 700,
                              textTransform: "none",
                              fontSize: "0.8rem",
                              px: 2.5,
                              boxShadow: "none",
                              "&:hover": { backgroundColor: "#8a5a1a", boxShadow: "none" },
                            }}
                            disabled={guardandoOferta || ofertaItems.length === 0}
                            onClick={guardarOferta}
                          >
                            {ofertaEditId ? "Guardar cambios" : "Guardar presupuesto"}
                          </Button>
                        </Box>
                      </Box>
                    </Box>
                  )}

                  </Box>
                  {/* FIN Layout dividido */}

                </Paper>
              )}

              {Array.isArray(ofertas) && ofertas.length > 0 && (
                <Paper
                  elevation={0}
                  sx={{
                    mb: 4,
                    p: 2.5,
                    borderRadius: 3,
                    backgroundColor: "rgba(163, 105, 32, 0.08)",
                    border: "1px solid rgba(163, 105, 32, 0.3)",
                  }}
                >
                  <Typography
                    variant="h6"
                    sx={{ color: "#a36920", fontWeight: "bold", mb: 2, display: "flex", alignItems: "center", gap: 1 }}
                  >
                    📋 Presupuestos del Paciente
                  </Typography>

                  {/* Leyenda de estados */}
                  <Box sx={{ display: "flex", gap: 2, mb: 2, flexWrap: "wrap", alignItems: "center" }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                      <Box sx={{ width: 14, height: 14, borderRadius: "50%", backgroundColor: "#d4af37" }} />
                      <Typography variant="caption" sx={{ color: "#b8860b", fontWeight: 600 }}>Se hará y se cobrará</Typography>
                    </Box>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                      <Box sx={{ width: 14, height: 14, borderRadius: "50%", backgroundColor: "#7b1fa2" }} />
                      <Typography variant="caption" sx={{ color: "#7b1fa2", fontWeight: 600 }}>Se hará pero aún no paga</Typography>
                    </Box>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                      <Box sx={{ width: 14, height: 14, borderRadius: "50%", backgroundColor: "#bdbdbd" }} />
                      <Typography variant="caption" sx={{ color: "#888", fontWeight: 600 }}>Pendiente (no suma al total)</Typography>
                    </Box>
                  </Box>

                  <Box sx={{ display: "grid", gap: 2 }}>
                    {ofertas.map((o) => {
                      const items = o.items || [];
                      const totalItems = items.length;
                      const yaAsignado = presupuestosAsignados.some(p => p.oferta_id === o.id);
                      // Total activo: solo suman los marcados como gold o purple
                      const totalActivo = items.reduce((sum, it, idx) => {
                        const estado = tratamientosMarcados[`${o.id}-${idx}`];
                        if (estado === "gold" || estado === "purple") return sum + Number(it.precio || 0);
                        return sum;
                      }, 0);
                      const hayMarcados = items.some((_, idx) => tratamientosMarcados[`${o.id}-${idx}`] === "gold" || tratamientosMarcados[`${o.id}-${idx}`] === "purple");
                      
                      return (
                        <Paper
                          key={o.id}
                          elevation={0}
                          sx={{
                            p: 2,
                            borderRadius: 2,
                            backgroundColor: yaAsignado ? "rgba(76, 175, 80, 0.08)" : "white",
                            border: yaAsignado ? "1px solid rgba(76, 175, 80, 0.4)" : "1px solid rgba(163, 105, 32, 0.2)",
                            transition: "all 0.3s ease",
                          }}
                        >
                          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 1 }}>
                            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                              <Checkbox
                                checked={yaAsignado}
                                onChange={async () => {
                                  if (!yaAsignado) {
                                    // Capturar marcas por nombre de tratamiento (gold/purple/false)
                                    const marcasPorNombre = {};
                                    (o.items || []).forEach((it, idx) => {
                                      const estado = tratamientosMarcados[`${o.id}-${idx}`];
                                      if (estado === "gold" || estado === "purple") {
                                        marcasPorNombre[it.nombre] = estado;
                                      }
                                    });
                                    await asignarPresupuesto(o, marcasPorNombre);
                                    // Transferir marcas al presupuesto asignado
                                    // Mapear por nombre de tratamiento ya que las sesiones se expanden
                                    setTimeout(() => {
                                      setPresupuestosAsignados(prev => {
                                        const nuevo = prev.find(p => p.oferta_id === o.id);
                                        if (nuevo && nuevo.sesiones) {
                                          const newMarcados = { ...tratamientosMarcados };
                                          nuevo.sesiones.forEach((sesion) => {
                                            const estado = marcasPorNombre[sesion.tratamiento_nombre];
                                            if (estado) {
                                              newMarcados[`asig-${nuevo.id}-${sesion.id}`] = estado;
                                            }
                                          });
                                          setTratamientosMarcados(newMarcados);
                                        }
                                        return prev;
                                      });
                                    }, 500);
                                  }
                                }}
                                disabled={yaAsignado || asignandoPresupuesto}
                                sx={{
                                  color: "#a36920",
                                  "&.Mui-checked": { color: "#4caf50" },
                                  p: 0,
                                }}
                              />
                              <Box>
                                <Typography sx={{ fontWeight: "bold", color: yaAsignado ? "#2e7d32" : "#333" }}>
                                  {yaAsignado ? "Presupuesto Asignado" : "Presupuesto"}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  Creado: {o.creado_en?.split(' ')[0] || o.creado_en}
                                </Typography>
                              </Box>
                            </Box>
                            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                              <Box sx={{ 
                                backgroundColor: "#a36920",
                                color: "white", 
                                px: 1.5, 
                                py: 0.5, 
                                borderRadius: 2,
                                fontWeight: "bold",
                                fontSize: "0.75rem",
                                textTransform: "uppercase"
                              }}>
                                {totalItems} tratamiento{totalItems !== 1 ? 's' : ''}
                              </Box>
                              <IconButton
                                size="small"
                                onClick={() => eliminarOferta(o.id)}
                                sx={{
                                  color: "#f44336",
                                  "&:hover": { backgroundColor: "rgba(244, 67, 54, 0.1)" }
                                }}
                              >
                                <Close fontSize="small" />
                              </IconButton>
                            </Box>
                          </Box>
                          
                          {/* Selector de Especialista */}
                          {!yaAsignado && (
                            <Box sx={{ mt: 1, mb: 1 }}>
                              <FormControl size="small" sx={{ minWidth: 220 }}>
                                <InputLabel sx={{ fontSize: "0.8rem" }}>Especialista asignado</InputLabel>
                                <Select
                                  value={especialistaPorPresupuesto[o.id] || ''}
                                  onChange={(e) => setEspecialistaPorPresupuesto(prev => ({
                                    ...prev,
                                    [o.id]: e.target.value
                                  }))}
                                  label="Especialista asignado"
                                  sx={{ 
                                    fontSize: "0.8rem",
                                    '& .MuiOutlinedInput-notchedOutline': { borderColor: '#ba9a63' },
                                    '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#a36920' },
                                  }}
                                >
                                  {especialistas.map((esp) => (
                                    <MenuItem key={esp.id} value={esp.id} sx={{ fontSize: "0.85rem" }}>
                                      {esp.nombre}
                                    </MenuItem>
                                  ))}
                                </Select>
                              </FormControl>
                              {!especialistaPorPresupuesto[o.id] && (
                                <Typography variant="caption" sx={{ color: "#ff9800", display: "block", mt: 0.5 }}>
                                  Selecciona un especialista antes de asignar
                                </Typography>
                              )}
                            </Box>
                          )}
                          {yaAsignado && (() => {
                            const presAsig = presupuestosAsignados.find(p => p.oferta_id === o.id);
                            return presAsig?.especialista_nombre ? (
                              <Box sx={{ mt: 0.5, mb: 1 }}>
                                <Chip
                                  icon={<Person sx={{ fontSize: 16 }} />}
                                  label={`Especialista: ${presAsig.especialista_nombre}`}
                                  size="small"
                                  sx={{ 
                                    backgroundColor: "rgba(76,175,80,0.15)", 
                                    color: "#2e7d32",
                                    fontWeight: 600,
                                    fontSize: "0.75rem",
                                    '& .MuiChip-icon': { color: '#2e7d32' }
                                  }}
                                />
                              </Box>
                            ) : null;
                          })()}

                          {/* Carrusel de tratamientos del presupuesto */}
                          {(() => {
                            // Cargar imágenes de tratamientos si faltan
                            const tIds = items.map(it => it.tratamientoId || it.tratamiento_id).filter(Boolean);
                            const faltanImg = tIds.some(id => !(id in tratamientoImagenCache));
                            if (faltanImg) {
                              setTimeout(() => cargarImagenesPresupuesto(items.map(it => ({ tratamiento_id: it.tratamientoId || it.tratamiento_id }))), 0);
                            }
                            return (
                          <Box sx={{ mt: 1, width: "100%", overflow: "hidden" }}>
                            <Typography variant="caption" sx={{ fontWeight: "bold", color: "#666", mb: 1, display: "block" }}>
                              Tratamientos:
                            </Typography>
                            {/* Carrusel horizontal con flechas */}
                            <Box sx={{ position: "relative", width: "100%", overflow: "hidden" }}>
                              {/* Flecha izquierda */}
                              <IconButton
                                onClick={() => {
                                  const el = document.getElementById(`carousel-${o.id}`);
                                  if (el) el.scrollBy({ left: -212, behavior: "smooth" });
                                }}
                                sx={{
                                  position: "absolute",
                                  left: 4,
                                  top: "50%",
                                  transform: "translateY(-50%)",
                                  zIndex: 3,
                                  backgroundColor: "rgba(163,105,32,0.9)",
                                  color: "white",
                                  width: 32,
                                  height: 32,
                                  "&:hover": { backgroundColor: "#a36920" },
                                  boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
                                }}
                              >
                                <Typography sx={{ fontSize: 18, fontWeight: "bold", lineHeight: 1 }}>‹</Typography>
                              </IconButton>
                              {/* Flecha derecha */}
                              <IconButton
                                onClick={() => {
                                  const el = document.getElementById(`carousel-${o.id}`);
                                  if (el) el.scrollBy({ left: 212, behavior: "smooth" });
                                }}
                                sx={{
                                  position: "absolute",
                                  right: 4,
                                  top: "50%",
                                  transform: "translateY(-50%)",
                                  zIndex: 3,
                                  backgroundColor: "rgba(163,105,32,0.9)",
                                  color: "white",
                                  width: 32,
                                  height: 32,
                                  "&:hover": { backgroundColor: "#a36920" },
                                  boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
                                }}
                              >
                                <Typography sx={{ fontSize: 18, fontWeight: "bold", lineHeight: 1 }}>›</Typography>
                              </IconButton>
                            <Box 
                              id={`carousel-${o.id}`}
                              sx={{ 
                              display: "flex", 
                              flexWrap: "wrap",
                              gap: 1.5, 
                              overflowX: "auto", 
                              pb: 1,
                              px: 0.5,
                              scrollSnapType: "x mandatory",
                              scrollBehavior: "smooth",
                              width: "100%",
                              "&::-webkit-scrollbar": { display: "none" },
                              msOverflowStyle: "none",
                              scrollbarWidth: "none",
                            }}>
                              {items.map((it, idx) => {
                                const tId = it.tratamientoId || it.tratamiento_id;
                                const imgArray = tId ? tratamientoImagenCache[tId] : null;
                                const imgUrl = Array.isArray(imgArray) && imgArray.length > 0 ? imgArray[0] : null;
                                const marcaKey = `${o.id}-${idx}`;
                                const marca = tratamientosMarcados[marcaKey];
                                return (
                                <Box
                                  key={`${o.id}-${idx}`}
                                  sx={{
                                    minWidth: 155,
                                    maxWidth: 200,
                                    flex: "1 1 155px",
                                    scrollSnapAlign: "start",
                                    borderRadius: 2.5,
                                    border: `2px solid ${marca === "gold" ? '#d4af37' : marca === "purple" ? '#7b1fa2' : 'rgba(163, 105, 32, 0.2)'}`,
                                    backgroundColor: "#fff",
                                    overflow: "hidden",
                                    display: "flex",
                                    flexDirection: "column",
                                    flexShrink: 0,
                                    transition: "border-color 0.2s, box-shadow 0.2s",
                                    boxShadow: marca === "gold" 
                                      ? "0 0 0 2px rgba(212,175,55,0.25)" 
                                      : marca === "purple" 
                                        ? "0 0 0 2px rgba(123,31,162,0.25)" 
                                        : "0 1px 4px rgba(0,0,0,0.08)",
                                  }}
                                >
                                  {/* Imagen del tratamiento */}
                                  <Box 
                                    onClick={() => {
                                      if (imgUrl) {
                                        setImagenAgrandada({ url: imgUrl, nombre: it.nombre });
                                      } else if (tId) {
                                        abrirCarruselTratamiento(tId, it.nombre);
                                      }
                                    }}
                                    sx={{ 
                                      width: "100%", 
                                      height: 160, 
                                      backgroundColor: "#f5f1e4", 
                                      display: "flex", 
                                      alignItems: "center", 
                                      justifyContent: "center",
                                      cursor: imgUrl || tId ? "pointer" : "default",
                                      position: "relative",
                                      overflow: "hidden",
                                      "&:hover .zoom-icon": { opacity: 1 },
                                    }}
                                  >
                                    {imgUrl ? (
                                      <>
                                        <img 
                                          src={imgUrl} 
                                          alt={it.nombre} 
                                          style={{ width: "100%", height: "100%", objectFit: "cover" }} 
                                        />
                                        <Box className="zoom-icon" sx={{
                                          position: "absolute",
                                          top: 0, left: 0, right: 0, bottom: 0,
                                          backgroundColor: "rgba(0,0,0,0.3)",
                                          display: "flex",
                                          alignItems: "center",
                                          justifyContent: "center",
                                          opacity: 0,
                                          transition: "opacity 0.2s",
                                          color: "white",
                                          fontSize: "1.5rem",
                                        }}>
                                          🔍
                                        </Box>
                                      </>
                                    ) : (
                                      <Box sx={{ textAlign: "center", color: "#ba9a63" }}>
                                        <Box sx={{ fontSize: "2.5rem", mb: 0.5 }}>💉</Box>
                                        <Typography variant="caption" sx={{ color: "#ba9a63", fontSize: "0.65rem" }}>
                                          Sin imagen
                                        </Typography>
                                      </Box>
                                    )}
                                    {/* Badge de marca (gold/purple/gray) */}
                                    <Box 
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        const current = tratamientosMarcados[marcaKey];
                                        const next = !current ? "gold" : current === "gold" ? "purple" : false;
                                        const newMarcados = { ...tratamientosMarcados, [marcaKey]: next };
                                        const asignado = presupuestosAsignados.find(p => p.oferta_id === o.id);
                                        if (asignado && asignado.sesiones && asignado.sesiones[idx]) {
                                          newMarcados[`asig-${asignado.id}-${asignado.sesiones[idx].id}`] = next;
                                        }
                                        setTratamientosMarcados(newMarcados);
                                      }}
                                      sx={{
                                        position: "absolute",
                                        top: 8,
                                        right: 8,
                                        width: 26,
                                        height: 26,
                                        borderRadius: "50%",
                                        backgroundColor: marca === "gold" ? '#d4af37' : marca === "purple" ? '#7b1fa2' : 'rgba(255,255,255,0.9)',
                                        border: `2px solid ${marca === "gold" ? '#d4af37' : marca === "purple" ? '#7b1fa2' : '#bdbdbd'}`,
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        fontSize: "0.75rem",
                                        color: marca === "purple" ? 'white' : marca === "gold" ? '#3e2c0a' : '#bdbdbd',
                                        fontWeight: "bold",
                                        cursor: "pointer",
                                        transition: "all 0.2s ease",
                                        zIndex: 2,
                                        boxShadow: "0 1px 4px rgba(0,0,0,0.3)",
                                        "&:hover": { transform: "scale(1.2)" },
                                      }}
                                    >
                                      {idx + 1}
                                    </Box>
                                    {/* Botón eliminar */}
                                    {(isDoctor || isMaster) && items.length > 1 && (
                                      <IconButton
                                        size="small"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          eliminarItemOferta(o.id, idx);
                                        }}
                                        sx={{
                                          position: "absolute",
                                          top: 6,
                                          left: 6,
                                          backgroundColor: "rgba(255,255,255,0.85)",
                                          color: "#d32f2f",
                                          p: 0.3,
                                          zIndex: 2,
                                          "&:hover": { backgroundColor: "rgba(211,47,47,0.15)" },
                                        }}
                                        title="Eliminar tratamiento"
                                      >
                                        <Close sx={{ fontSize: 15 }} />
                                      </IconButton>
                                    )}
                                  </Box>
                                  {/* Nombre, sesiones y precio */}
                                  <Box sx={{ p: 1.2, flexGrow: 1, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                                    <Typography variant="body2" sx={{ 
                                      fontWeight: "600", 
                                      fontSize: "0.85rem", 
                                      lineHeight: 1.3,
                                      color: marca === "gold" ? "#b8860b" : marca === "purple" ? "#7b1fa2" : "#333",
                                      mb: 0.5,
                                      display: "-webkit-box",
                                      WebkitLineClamp: 2,
                                      WebkitBoxOrient: "vertical",
                                      overflow: "hidden",
                                    }}>
                                      {it.nombre}
                                    </Typography>
                                    {/* Sesiones editable */}
                                    <Box sx={{ mb: 0.5 }}>
                                      {editandoSesiones?.ofertaId === o.id && editandoSesiones?.itemIdx === idx ? (
                                        <Box sx={{ display: "flex", alignItems: "center", gap: 0.3 }}>
                                          <input
                                            type="number"
                                            min="1"
                                            value={editandoSesiones.sesiones}
                                            onChange={(e) => setEditandoSesiones({ ...editandoSesiones, sesiones: e.target.value })}
                                            onKeyDown={(e) => {
                                              if (e.key === 'Enter') editarSesionesOferta(o.id, idx, editandoSesiones.sesiones);
                                              if (e.key === 'Escape') setEditandoSesiones(null);
                                            }}
                                            autoFocus
                                            style={{ width: 36, fontSize: "0.7rem", textAlign: "center", borderRadius: 4, border: "1px solid #a36920", padding: "1px 2px" }}
                                          />
                                          <Typography 
                                            component="span" variant="caption" 
                                            sx={{ color: "#4caf50", cursor: "pointer", fontWeight: "bold", "&:hover": { color: "#2e7d32" } }}
                                            onClick={(e) => { e.stopPropagation(); editarSesionesOferta(o.id, idx, editandoSesiones.sesiones); }}
                                          >✓</Typography>
                                          <Typography 
                                            component="span" variant="caption" 
                                            sx={{ color: "#f44336", cursor: "pointer", fontWeight: "bold", "&:hover": { color: "#c62828" } }}
                                            onClick={(e) => { e.stopPropagation(); setEditandoSesiones(null); }}
                                          >✕</Typography>
                                        </Box>
                                      ) : (
                                        <Typography 
                                          variant="caption" 
                                          sx={{ 
                                            color: "#888", fontWeight: 600, fontSize: "0.7rem",
                                            ...(isDoctor || isMaster ? { cursor: "pointer", "&:hover": { color: "#a36920", textDecoration: "underline" } } : {})
                                          }}
                                          onClick={(isDoctor || isMaster) ? (e) => {
                                            e.stopPropagation();
                                            setEditandoSesiones({ ofertaId: o.id, itemIdx: idx, sesiones: Number(it.sesiones) || 1 });
                                          } : undefined}
                                        >
                                          {Number(it.sesiones) || 1} {Number(it.sesiones) === 1 ? 'sesión' : 'sesiones'}
                                          {(isDoctor || isMaster) && <Edit sx={{ fontSize: 10, ml: 0.3, verticalAlign: "middle", color: "#aaa" }} />}
                                        </Typography>
                                      )}
                                    </Box>
                                    {(it.producto || it.ml) && (
                                      <Typography variant="caption" sx={{ color: "#777", display: "block", fontSize: "0.65rem", mb: 0.3 }}>
                                        {it.producto && `${it.producto}`}
                                        {it.producto && it.ml ? " — " : ""}
                                        {it.ml && `${it.ml} ml`}
                                      </Typography>
                                    )}
                                    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                      <Typography variant="body2" sx={{ fontWeight: "bold", color: "#a36920", fontSize: "1rem" }}>
                                        S/ {Number(it.precio || 0).toFixed(2)}
                                      </Typography>
                                      <IconButton
                                        size="small"
                                        onClick={(e) => { e.stopPropagation(); agregarAlCarrito(it, `card-${o.id}-${idx}`); }}
                                        sx={{
                                          color: carritoAnimacion === `card-${o.id}-${idx}` ? "#4caf50" : "#ba9a63",
                                          p: 0.4,
                                          transition: "all 0.3s ease",
                                          transform: carritoAnimacion === `card-${o.id}-${idx}` ? "scale(1.4)" : "scale(1)",
                                          backgroundColor: carritoAnimacion === `card-${o.id}-${idx}` ? "rgba(76,175,80,0.1)" : "transparent",
                                          "&:hover": { color: "#a36920", backgroundColor: "rgba(163,105,32,0.1)" },
                                        }}
                                        title="Agregar al carrito (para después)"
                                      >
                                        <AddShoppingCart sx={{ fontSize: 18 }} />
                                      </IconButton>
                                    </Box>
                                  </Box>
                                </Box>
                                );
                              })}
                            </Box>
                            </Box>
                          </Box>
                            );
                          })()}

                          {/* Total del presupuesto y botones */}
                          <Box sx={{ mt: 2, pt: 1, borderTop: "1px dashed #e0e0e0", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 1 }}>
                            <Box>
                              {hayMarcados ? (
                                <>
                                  <Typography variant="body2" color="text.secondary">
                                    Total todos: S/ {Number(o.total || 0).toFixed(2)}
                                  </Typography>
                                  {Number(o.descuento || 0) > 0 && (
                                    <Typography variant="body2" color="error" sx={{ fontSize: "0.85rem" }}>
                                      Descuento: -S/ {Number(o.descuento).toFixed(2)}
                                    </Typography>
                                  )}
                                  <Typography sx={{ fontWeight: "bold", color: "#a36920", fontSize: "1.1rem" }}>
                                    Total seleccionado: S/ {(totalActivo - Number(o.descuento || 0) > 0 ? totalActivo - Number(o.descuento || 0) : totalActivo).toFixed(2)}
                                  </Typography>
                                </>
                              ) : (
                                <>
                                  <Typography variant="body2" color="text.secondary">
                                    Subtotal: S/ {Number(o.total || 0).toFixed(2)}
                                  </Typography>
                                  {Number(o.descuento || 0) > 0 && (
                                    <Typography variant="body2" color="error" sx={{ fontSize: "0.85rem" }}>
                                      Descuento: -S/ {Number(o.descuento).toFixed(2)}
                                    </Typography>
                                  )}
                                  {Number(o.descuento || 0) > 0 ? (
                                    <Typography sx={{ fontWeight: "bold", color: "#a36920", fontSize: "1.05rem" }}>
                                      Total: S/ {(Number(o.total || 0) - Number(o.descuento || 0)).toFixed(2)}
                                    </Typography>
                                  ) : (
                                    <Typography sx={{ fontWeight: "bold", color: "#888", fontSize: "0.95rem" }}>
                                      S/ {Number(o.total || 0).toFixed(2)}
                                    </Typography>
                                  )}
                                  <Typography variant="caption" sx={{ color: "#999", fontStyle: "italic" }}>
                                    Selecciona tratamientos para calcular total
                                  </Typography>
                                </>
                              )}
                            </Box>
                            <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                              <Button
                                size="small"
                                variant="outlined"
                                onClick={() => {
                                  setPresupuestoParaDescuento(o);
                                  setNuevoDescuento(Number(o.descuento || 0));
                                  setModalDescuentoPresupuesto(true);
                                }}
                                sx={{
                                  fontSize: "0.7rem",
                                  py: 0.5,
                                  borderRadius: 2,
                                  borderColor: "#ff9800",
                                  color: "#ff9800",
                                  "&:hover": { backgroundColor: "rgba(255, 152, 0, 0.1)" }
                                }}
                              >
                                {Number(o.descuento || 0) > 0 ? "✏️ Editar Dcto" : "➕ Agregar Dcto"}
                              </Button>
                              <Button
                                size="small"
                                variant="contained"
                                startIcon={<Print />}
                                onClick={() => {
                                  setPresupuestoParaProforma(o);
                                  setDescuentoProforma(Number(o.descuento || 0));
                                  setModalDescuento(true);
                                }}
                                sx={{
                                  fontSize: "0.7rem",
                                  py: 0.5,
                                  borderRadius: 2,
                                  backgroundColor: "#a36920",
                                  "&:hover": { backgroundColor: "#8a5619" }
                                }}
                              >
                                Proforma
                              </Button>
                              <Button
                                size="small"
                                variant="outlined"
                                onClick={() => {
                                  setOfertaEditId(o.id);
                                  setDescuentoOferta(Number(o.descuento) > 0 ? String(o.descuento) : "");
                                  setOfertaItems(
                                    (o.items || []).map((it) => ({
                                      tratamientoId: it.tratamientoId ?? it.tratamiento_id ?? null,
                                      nombre: it.nombre,
                                      precio: String(it.precio ?? ""),
                                      sesiones: String(it.sesiones ?? "1"),
                                      producto: it.producto || "",
                                      ml: it.ml || "",
                                    }))
                                  );
                                  // Recargar tratamientos para que aparezcan nuevos protocolos
                                  axios.get(`${API_BASE_URL}/api/tratamientos/listar`, { headers: authHeaders })
                                    .then((res) => {
                                      const sorted = Array.isArray(res.data) ? res.data.sort((a, b) =>
                                        (a.nombre || '').toLowerCase().localeCompare((b.nombre || '').toLowerCase())
                                      ) : [];
                                      setTratamientosBase(sorted);
                                    }).catch(() => {});
                                  setShowOferta(true);
                                }}
                                sx={{
                                  fontSize: "0.7rem",
                                  py: 0.5,
                                  borderRadius: 2,
                                  borderColor: "#a36920",
                                  color: "#a36920",
                                  "&:hover": { backgroundColor: "rgba(163, 105, 32, 0.1)" }
                                }}
                              >
                                Editar
                              </Button>
                            </Box>
                          </Box>
                        </Paper>
                      );
                    })}
                  </Box>
                </Paper>
              )}

              <Divider sx={{ mb: 3 }} />

              {/* Calendario de Tratamientos */}
              {presupuestosAsignados.map(presupuesto => (
                <TreatmentCalendar
                  key={`calendar-${presupuesto.id}`}
                  presupuesto={presupuesto}
                  especialistas={especialistas}
                  onCompletarSesion={completarSesionPresupuesto}
                  onDesmarcarSesion={desmarcarSesionPresupuesto}
                  especialistasPorSesion={especialistasPorSesion}
                  setEspecialistasPorSesion={setEspecialistasPorSesion}
                />
              ))}

              {/* Paquetes Promocionales Activos */}
              {paquetesActivos.length > 0 && (
                <Paper
                  id="paquetes-promocionales"
                  elevation={0}
                  sx={{
                    mb: 3,
                    p: 2.5,
                    borderRadius: 3,
                    backgroundColor: "rgba(76, 175, 80, 0.08)",
                    border: "1px solid rgba(76, 175, 80, 0.3)",
                  }}
                >
                  <Box
                    onClick={() => setPaquetesPromoExpanded(prev => !prev)}
                    sx={{ 
                      display: "flex", 
                      alignItems: "center", 
                      justifyContent: "space-between",
                      cursor: "pointer",
                      mb: paquetesPromoExpanded ? 2 : 0,
                      "&:hover": { opacity: 0.85 },
                    }}
                  >
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                      <CardGiftcard sx={{ color: "#2e7d32", fontSize: 24 }} />
                      <Typography
                        variant="h6"
                        sx={{ color: "#2e7d32", fontWeight: "bold", display: "flex", alignItems: "center", gap: 1 }}
                      >
                        Paquetes Promocionales Disponibles
                        <Chip label={`${paquetesActivos.length}`} size="small" sx={{ backgroundColor: "#e8f5e9", color: "#2e7d32", fontWeight: "bold", ml: 1 }} />
                      </Typography>
                    </Box>
                    <IconButton size="small" sx={{ color: "#2e7d32" }}>
                      {paquetesPromoExpanded ? <ExpandLess /> : <ExpandMore />}
                    </IconButton>
                  </Box>
                  <Collapse in={paquetesPromoExpanded} timeout="auto" unmountOnExit>
                  <Box
                    sx={{
                      display: "grid",
                      gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
                      gap: 2,
                    }}
                  >
                    {paquetesActivos.map((paquete) => {
                      let tratamientosIncluidos = [];
                      try {
                        tratamientosIncluidos = paquete.tratamientos_json ? JSON.parse(paquete.tratamientos_json) : [];
                      } catch (e) {
                        tratamientosIncluidos = [];
                      }
                      
                      return (
                        <Paper
                          key={paquete.id}
                          elevation={0}
                          sx={{
                            p: 2,
                            borderRadius: 2,
                            backgroundColor: "white",
                            border: "1px solid rgba(76, 175, 80, 0.2)",
                          }}
                        >
                          {/* Imagen Promocional */}
                          {paquete.imagen_promocional && (
                            <Box sx={{ mb: 2, borderRadius: 2, overflow: "hidden", backgroundColor: "#f5f5f5" }}>
                              <img
                                src={paquete.imagen_promocional}
                                alt={paquete.nombre}
                                style={{
                                  width: "100%",
                                  height: "200px",
                                  objectFit: "contain",
                                  display: "block"
                                }}
                              />
                            </Box>
                          )}

                          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 1 }}>
                            <Typography sx={{ fontWeight: "bold", color: "#333" }}>
                              {paquete.nombre}
                            </Typography>
                            <Box sx={{ 
                              backgroundColor: "#ff9800", 
                              color: "white", 
                              px: 1.5, 
                              py: 0.5, 
                              borderRadius: 2,
                              fontWeight: "bold",
                              fontSize: "0.85rem"
                            }}>
                              {paquete.descuento_porcentaje?.toFixed(0)}% OFF
                            </Box>
                          </Box>
                          
                          {paquete.descripcion && (
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                              {paquete.descripcion}
                            </Typography>
                          )}
                          
                          {tratamientosIncluidos.length > 0 && (
                            <Box sx={{ mb: 1.5 }}>
                              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: "bold" }}>
                                Incluye:
                              </Typography>
                              {tratamientosIncluidos.map((t, idx) => (
                                <Typography key={idx} variant="body2" sx={{ ml: 1 }}>
                                  ✓ {t.nombre} ({t.sesiones} sesión{t.sesiones > 1 ? 'es' : ''})
                                </Typography>
                              ))}
                            </Box>
                          )}
                          
                          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mt: 1 }}>
                            <Box>
                              <Typography variant="caption" sx={{ textDecoration: "line-through", color: "#999" }}>
                                S/ {paquete.precio_regular?.toFixed(2)}
                              </Typography>
                              <Typography sx={{ fontWeight: "bold", color: "#2e7d32", fontSize: "1.1rem" }}>
                                S/ {paquete.precio_paquete?.toFixed(2)}
                              </Typography>
                            </Box>
                            <Box sx={{ display: "flex", gap: 1 }}>
                              <Button
                                variant="outlined"
                                size="small"
                                startIcon={<Print />}
                                disabled={!pacienteSeleccionado}
                                onClick={async () => {
                                  if (pacienteSeleccionado) {
                                    await generarProformaPaquete(paquete, pacienteSeleccionado, 0);
                                    showToast({ severity: "success", message: "Proforma de paquete generada" });
                                  }
                                }}
                                sx={{
                                  borderColor: "#a36920",
                                  color: "#a36920",
                                  "&:hover": { backgroundColor: "rgba(163,105,32,0.08)" },
                                  fontWeight: "bold",
                                  borderRadius: 2,
                                }}
                              >
                                Proforma
                              </Button>
                              <Button
                                variant="contained"
                                size="small"
                                disabled={asignandoPaquete || !pacienteSeleccionado}
                                onClick={() => asignarPaquete(paquete)}
                                sx={{
                                  backgroundColor: "#4caf50",
                                  "&:hover": { backgroundColor: "#388e3c" },
                                  fontWeight: "bold",
                                  borderRadius: 2,
                                }}
                              >
                                {asignandoPaquete ? "Asignando..." : "Asignar"}
                              </Button>
                            </Box>
                          </Box>
                        </Paper>
                      );
                    })}
                  </Box>
                  </Collapse>
                </Paper>
              )}

              {/* Presupuestos Asignados al Paciente */}
              {presupuestosAsignados.length > 0 && (
                <Paper
                  elevation={0}
                  sx={{
                    mb: 3,
                    p: 2.5,
                    borderRadius: 3,
                    backgroundColor: "rgba(163, 105, 32, 0.08)",
                    border: "1px solid rgba(163, 105, 32, 0.3)",
                  }}
                >
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 2 }}>
                    <Assignment sx={{ color: "#a36920", fontSize: 24 }} />
                    <Typography
                      variant="h6"
                      sx={{ color: "#a36920", fontWeight: "bold", display: "flex", alignItems: "center", gap: 1 }}
                    >
                      Presupuestos Asignados
                    </Typography>
                  </Box>
                  <Box sx={{ display: "grid", gap: 2 }}>
                    {presupuestosAsignados.map((presupuesto) => {
                      const progreso = presupuesto.sesiones_totales > 0 
                        ? Math.round((presupuesto.sesiones_completadas / presupuesto.sesiones_totales) * 100) 
                        : 0;
                      
                      return (
                        <Paper
                          key={presupuesto.id}
                          elevation={0}
                          sx={{
                            p: 2,
                            borderRadius: 2,
                            backgroundColor: "white",
                            border: `1px solid ${presupuesto.estado === 'completado' ? '#4caf50' : presupuesto.estado === 'cancelado' ? '#f44336' : '#a36920'}`,
                          }}
                        >
                          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 1 }}>
                            <Box>
                              <Typography sx={{ fontWeight: "bold", color: "#333" }}>
                                Presupuesto #{presupuesto.oferta_id}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                Asignado: {presupuesto.fecha_inicio?.split(' ')[0]}
                              </Typography>
                            </Box>
                            <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
                              <Box sx={{ 
                                backgroundColor: presupuesto.estado === 'completado' ? '#4caf50' : presupuesto.estado === 'cancelado' ? '#f44336' : '#a36920',
                                color: "white", 
                                px: 1.5, 
                                py: 0.5, 
                                borderRadius: 2,
                                fontWeight: "bold",
                                fontSize: "0.75rem",
                                textTransform: "uppercase"
                              }}>
                                {presupuesto.estado}
                              </Box>
                              <IconButton
                                size="small"
                                onClick={() => generarReciboPresupuesto(presupuesto)}
                                sx={{
                                  color: "#d4af37",
                                  "&:hover": { backgroundColor: "rgba(212,175,55,0.1)" }
                                }}
                                title="Imprimir recibo"
                              >
                                <Receipt />
                              </IconButton>
                              <Button
                                size="small"
                                variant="outlined"
                                onClick={() => {
                                  setPresupuestosColapsados(prev => ({
                                    ...prev,
                                    [presupuesto.id]: !prev[presupuesto.id]
                                  }));
                                }}
                                sx={{
                                  fontSize: "0.7rem",
                                  py: 0.25,
                                  px: 1,
                                  minWidth: "auto",
                                  borderColor: "#a36920",
                                  color: "#a36920",
                                  "&:hover": { 
                                    backgroundColor: "rgba(163, 105, 32, 0.08)",
                                    borderColor: "#8a541a"
                                  }
                                }}
                              >
                                {presupuestosColapsados[presupuesto.id] ? "Abrir" : "Guardar"}
                              </Button>
                            </Box>
                          </Box>
                          
                          {/* Contenido colapsable del presupuesto */}
                          {!presupuestosColapsados[presupuesto.id] && (
                          <>
                          {/* Barra de progreso */}
                          <Box sx={{ mb: 2 }}>
                            <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
                              <Typography variant="caption" color="text.secondary">
                                Progreso: {presupuesto.sesiones_completadas}/{presupuesto.sesiones_totales} tratamientos
                              </Typography>
                              <Typography variant="caption" sx={{ fontWeight: "bold", color: "#a36920" }}>
                                {progreso}%
                              </Typography>
                            </Box>
                            <Box sx={{ 
                              height: 8, 
                              backgroundColor: "#e0e0e0", 
                              borderRadius: 4,
                              overflow: "hidden"
                            }}>
                              <Box sx={{ 
                                height: "100%", 
                                width: `${progreso}%`,
                                backgroundColor: presupuesto.estado === 'completado' ? '#4caf50' : '#a36920',
                                borderRadius: 4,
                                transition: "width 0.3s ease"
                              }} />
                            </Box>
                          </Box>

                          {/* Tratamientos del presupuesto */}
                          {presupuesto.sesiones && presupuesto.sesiones.length > 0 && (
                            <Box sx={{ mt: 1 }}>
                              <Typography variant="caption" sx={{ fontWeight: "bold", color: "#666", mb: 1, display: "block" }}>
                                Tratamientos:
                              </Typography>
                              <Box sx={{ display: "grid", gap: 0.5 }}>
                                {presupuesto.sesiones.map((sesion) => (
                                  <Box
                                    key={sesion.id}
                                    sx={{
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "space-between",
                                      p: 1,
                                      backgroundColor: sesion.estado === 'completada' ? "rgba(76, 175, 80, 0.1)" : "rgba(0,0,0,0.02)",
                                      borderRadius: 1,
                                      border: `1px solid ${sesion.estado === 'completada' ? '#4caf50' : '#e0e0e0'}`,
                                    }}
                                  >
                                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                                      <Box 
                                        onClick={(e) => {
                                          if (sesion.estado !== 'completada') {
                                            e.stopPropagation();
                                            const key = `asig-${presupuesto.id}-${sesion.id}`;
                                            const current = tratamientosMarcados[key];
                                            const next = !current ? "gold" : current === "gold" ? "purple" : false;
                                            const newMarcados = { ...tratamientosMarcados, [key]: next };
                                            if (presupuesto.oferta_id) {
                                              const oferta = ofertas.find(of => of.id === presupuesto.oferta_id);
                                              if (oferta) {
                                                const sesionIdx = presupuesto.sesiones.indexOf(sesion);
                                                if (sesionIdx >= 0) {
                                                  newMarcados[`${oferta.id}-${sesionIdx}`] = next;
                                                }
                                              }
                                            }
                                            setTratamientosMarcados(newMarcados);
                                          }
                                        }}
                                        sx={{
                                          width: 22,
                                          height: 22,
                                          borderRadius: "50%",
                                          backgroundColor: sesion.estado === 'completada' 
                                            ? '#4caf50' 
                                            : tratamientosMarcados[`asig-${presupuesto.id}-${sesion.id}`] === "gold" 
                                              ? '#d4af37' 
                                              : tratamientosMarcados[`asig-${presupuesto.id}-${sesion.id}`] === "purple"
                                                ? '#7b1fa2'
                                                : '#bdbdbd',
                                          display: "flex",
                                          alignItems: "center",
                                          justifyContent: "center",
                                          fontSize: "0.7rem",
                                          color: sesion.estado === 'completada' 
                                            ? 'white' 
                                            : tratamientosMarcados[`asig-${presupuesto.id}-${sesion.id}`] === "gold" 
                                              ? '#3e2c0a' 
                                              : tratamientosMarcados[`asig-${presupuesto.id}-${sesion.id}`] === "purple"
                                                ? 'white'
                                                : 'white',
                                          fontWeight: tratamientosMarcados[`asig-${presupuesto.id}-${sesion.id}`] && sesion.estado !== 'completada' ? "bold" : "normal",
                                          cursor: sesion.estado !== 'completada' ? "pointer" : "default",
                                          transition: "all 0.2s ease",
                                          boxShadow: sesion.estado !== 'completada' && tratamientosMarcados[`asig-${presupuesto.id}-${sesion.id}`] === "gold"
                                            ? "0 0 0 2px #d4af37, 0 0 0 4px rgba(212,175,55,0.35)" 
                                            : sesion.estado !== 'completada' && tratamientosMarcados[`asig-${presupuesto.id}-${sesion.id}`] === "purple"
                                              ? "0 0 0 2px #7b1fa2, 0 0 0 4px rgba(123,31,162,0.35)"
                                              : "none",
                                          "&:hover": sesion.estado !== 'completada' ? { 
                                            transform: "scale(1.15)",
                                            backgroundColor: tratamientosMarcados[`asig-${presupuesto.id}-${sesion.id}`] === "gold" ? "#c9a230" 
                                              : tratamientosMarcados[`asig-${presupuesto.id}-${sesion.id}`] === "purple" ? "#6a1b9a"
                                              : "#9e9e9e",
                                          } : {}
                                        }}
                                      >
                                        {sesion.estado === 'completada' ? '✓' : sesion.sesion_numero}
                                      </Box>
                                      <Typography variant="body2" sx={{
                                        fontWeight: tratamientosMarcados[`asig-${presupuesto.id}-${sesion.id}`] && sesion.estado !== 'completada' ? "bold" : "normal",
                                        color: sesion.estado !== 'completada' && tratamientosMarcados[`asig-${presupuesto.id}-${sesion.id}`] === "gold" ? "#b8860b" 
                                          : sesion.estado !== 'completada' && tratamientosMarcados[`asig-${presupuesto.id}-${sesion.id}`] === "purple" ? "#7b1fa2"
                                          : "inherit",
                                      }}>
                                        {sesion.tratamiento_nombre}
                                        {(sesion.total_sesiones || 1) > 1 && (
                                          <Typography component="span" variant="caption" sx={{ ml: 0.5, color: "#888", fontWeight: 600 }}>
                                            (Sesión {sesion.sesion_numero}/{sesion.total_sesiones})
                                          </Typography>
                                        )}
                                      </Typography>
                                      {Number(sesion.precio_sesion || 0) > 0 && (
                                        <Typography variant="caption" color="text.secondary">
                                          (S/ {Number(sesion.precio_sesion).toFixed(2)})
                                        </Typography>
                                      )}
                                    </Box>
                                    {sesion.estado === 'pendiente' && presupuesto.estado === 'activo' && (
                                      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                                        <Select
                                          size="small"
                                          value={especialistasPorSesion[`presupuesto_${sesion.id}`] || ''}
                                          onChange={(e) => setEspecialistasPorSesion(prev => ({
                                            ...prev,
                                            [`presupuesto_${sesion.id}`]: e.target.value
                                          }))}
                                          displayEmpty
                                          sx={{
                                            fontSize: "0.7rem",
                                            minWidth: 120,
                                            height: 28
                                          }}
                                        >
                                          <MenuItem value="" disabled>
                                            <em>Especialista</em>
                                          </MenuItem>
                                          {especialistas.map((esp) => (
                                            <MenuItem key={esp.id} value={esp.id}>
                                              {esp.nombre}
                                            </MenuItem>
                                          ))}
                                        </Select>
                                        <Button
                                          size="small"
                                          variant="outlined"
                                          onClick={() => completarSesionPresupuesto(sesion.id)}
                                          sx={{
                                            fontSize: "0.7rem",
                                            py: 0.25,
                                            px: 1,
                                            borderColor: "#4caf50",
                                            color: "#4caf50",
                                            "&:hover": { backgroundColor: "rgba(76, 175, 80, 0.1)" }
                                          }}
                                        >
                                          Completar
                                        </Button>
                                      </Box>
                                    )}
                                    {sesion.estado === 'completada' && (
                                      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                                        <Typography variant="caption" color="success.main">
                                          {sesion.fecha_realizada?.split(' ')[0]}
                                        </Typography>
                                        <Button
                                          size="small"
                                          variant="text"
                                          onClick={() => desmarcarSesionPresupuesto(sesion.id)}
                                          sx={{
                                            fontSize: "0.65rem",
                                            py: 0,
                                            px: 0.5,
                                            minWidth: "auto",
                                            color: "#f44336",
                                            "&:hover": { backgroundColor: "rgba(244, 67, 54, 0.1)" }
                                          }}
                                        >
                                          Deshacer
                                        </Button>
                                      </Box>
                                    )}
                                  </Box>
                                ))}
                              </Box>
                            </Box>
                          )}

                          {/* Total del presupuesto y estado de pago */}
                          {(() => {
                            // Calcular total basado en marcas de color (gold+purple)
                            const sesionesP = presupuesto.sesiones || [];
                            const hayMarcas = sesionesP.some(s => {
                              const mk = tratamientosMarcados[`asig-${presupuesto.id}-${s.id}`];
                              return mk === "gold" || mk === "purple";
                            });
                            let totalMarcado = 0;
                            let totalGoldP = 0;
                            let totalPurpleP = 0;
                            if (hayMarcas) {
                              sesionesP.forEach(s => {
                                const mk = tratamientosMarcados[`asig-${presupuesto.id}-${s.id}`];
                                const precio = Number(s.precio_sesion || 0);
                                if (mk === "gold") { totalGoldP += precio; totalMarcado += precio; }
                                else if (mk === "purple") { totalPurpleP += precio; totalMarcado += precio; }
                              });
                            } else {
                              totalMarcado = Number(presupuesto.precio_total || 0);
                            }
                            const descuentoP = Number(presupuesto.descuento || 0);
                            const totalFinalP = totalMarcado - descuentoP;
                            return (
                          <Box sx={{ mt: 2, pt: 1, borderTop: "1px dashed #e0e0e0" }}>
                            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 1 }}>
                              <Box>
                                {hayMarcas && totalGoldP > 0 && (
                                  <Typography variant="body2" sx={{ color: "#b8860b", fontSize: "0.85rem" }}>
                                    Pagado (dorado): S/ {totalGoldP.toFixed(2)}
                                  </Typography>
                                )}
                                {hayMarcas && totalPurpleP > 0 && (
                                  <Typography variant="body2" sx={{ color: "#7b1fa2", fontSize: "0.85rem" }}>
                                    Pendiente (morado): S/ {totalPurpleP.toFixed(2)}
                                  </Typography>
                                )}
                                <Typography variant="body2" color="text.secondary">
                                  Subtotal{hayMarcas ? " seleccionado" : ""}:
                                </Typography>
                                <Typography sx={{ fontWeight: "bold", color: "#666", fontSize: "0.95rem" }}>
                                  S/ {totalMarcado.toFixed(2)}
                                </Typography>
                                {descuentoP > 0 && (
                                  <Typography variant="body2" color="error" sx={{ fontSize: "0.85rem" }}>
                                    Descuento: -S/ {descuentoP.toFixed(2)}
                                  </Typography>
                                )}
                                <Typography sx={{ fontWeight: "bold", color: "#a36920", fontSize: "1.1rem" }}>
                                  Total: S/ {totalFinalP.toFixed(2)}
                                </Typography>
                              </Box>
                              
                              {/* Estado de pago con colores */}
                              <Box sx={{ 
                                px: 1.5, 
                                py: 0.5, 
                                borderRadius: 2,
                                backgroundColor: presupuesto.estado_pago === 'pagado' || presupuesto.pagado === 1 
                                  ? '#e8f5e9' 
                                  : presupuesto.estado_pago === 'adelanto' 
                                    ? '#fff3e0' 
                                    : '#ffebee',
                                border: `1px solid ${presupuesto.estado_pago === 'pagado' || presupuesto.pagado === 1 
                                  ? '#4caf50' 
                                  : presupuesto.estado_pago === 'adelanto' 
                                    ? '#ff9800' 
                                    : '#f44336'}`
                              }}>
                                <Typography variant="caption" sx={{ 
                                  fontWeight: "bold", 
                                  color: presupuesto.estado_pago === 'pagado' || presupuesto.pagado === 1 
                                    ? '#2e7d32' 
                                    : presupuesto.estado_pago === 'adelanto' 
                                      ? '#e65100' 
                                      : '#c62828',
                                  textTransform: "uppercase"
                                }}>
                                  {presupuesto.estado_pago === 'pagado' || presupuesto.pagado === 1 
                                    ? '✓ PAGADO' 
                                    : presupuesto.estado_pago === 'adelanto' 
                                      ? '📝 ADELANTO' 
                                      : '⏳ PENDIENTE PAGO'}
                                </Typography>
                              </Box>
                            </Box>
                            
                            {/* Información de Consulta Pagada */}
                            {presupuesto.consulta_pagada === 1 && (
                              <Box sx={{ mt: 1, p: 1, backgroundColor: "rgba(156, 39, 176, 0.1)", borderRadius: 1, border: "1px solid rgba(156, 39, 176, 0.3)" }}>
                                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                  <Typography variant="caption" sx={{ color: "#7b1fa2", fontWeight: "bold" }}>
                                    💊 Consulta Pagada
                                  </Typography>
                                  <Typography variant="caption" sx={{ color: "#7b1fa2", fontWeight: "bold" }}>
                                    S/ {(presupuesto.monto_consulta || 0).toFixed(2)}
                                  </Typography>
                                </Box>
                                {presupuesto.metodo_pago_consulta && (
                                  <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
                                    Método: {presupuesto.metodo_pago_consulta} | {presupuesto.fecha_pago_consulta?.split(' ')[0]}
                                  </Typography>
                                )}
                              </Box>
                            )}

                            {/* Detalles de pago */}
                            {(presupuesto.monto_pagado > 0 || presupuesto.estado_pago === 'adelanto') && (
                              <Box sx={{ mt: 1, p: 1, backgroundColor: "rgba(0,0,0,0.02)", borderRadius: 1 }}>
                                <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                                  <Typography variant="caption" color="text.secondary">Pagado:</Typography>
                                  <Typography variant="caption" sx={{ color: "#4caf50", fontWeight: "bold" }}>
                                    S/ {(presupuesto.monto_pagado || 0).toFixed(2)}
                                  </Typography>
                                </Box>
                                {presupuesto.estado_pago !== 'pagado' && presupuesto.pagado !== 1 && (
                                  <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                                    <Typography variant="caption" color="text.secondary">Saldo pendiente:</Typography>
                                    <Typography variant="caption" sx={{ color: "#f57c00", fontWeight: "bold" }}>
                                      S/ {Math.max(0, (Number(presupuesto.precio_total) || 0) - (Number(presupuesto.descuento) || 0) - (Number(presupuesto.monto_pagado) || 0)).toFixed(2)}
                                    </Typography>
                                  </Box>
                                )}
                                {presupuesto.metodo_pago && (
                                  <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
                                    Método: {presupuesto.metodo_pago} | {presupuesto.fecha_pago?.split(' ')[0]}
                                  </Typography>
                                )}
                              </Box>
                            )}
                            
                            {/* Botones de acción */}
                            <Box sx={{ display: "flex", gap: 1, mt: 1.5, justifyContent: "flex-end", flexWrap: "wrap" }}>
                              {/* Botón de Pago de Consulta */}
                              {presupuesto.consulta_pagada !== 1 && presupuesto.estado_pago !== 'pagado' && presupuesto.pagado !== 1 && (
                                <Button
                                  size="small"
                                  variant="outlined"
                                  onClick={() => {
                                    setConsultaGlobalSeleccion({ tipo: 'presupuesto', item: presupuesto });
                                    setMontoConsultaGlobal(100);
                                    setMetodoPagoConsultaGlobal("efectivo");
                                    setModalPagoConsultaGlobal(true);
                                  }}
                                  sx={{
                                    fontSize: "0.75rem",
                                    py: 0.5,
                                    borderRadius: 2,
                                    borderColor: "#9c27b0",
                                    color: "#9c27b0",
                                    "&:hover": { 
                                      backgroundColor: "rgba(156, 39, 176, 0.08)",
                                      borderColor: "#7b1fa2"
                                    }
                                  }}
                                >
                                  💊 Pagar Consulta
                                </Button>
                              )}
                              {presupuesto.estado_pago !== 'pagado' && presupuesto.pagado !== 1 && (
                                <Button
                                  size="small"
                                  variant="contained"
                                  onClick={() => {
                                    setPresupuestoParaPago(presupuesto);
                                    // Calcular precio con descuento
                                    const precioConDescuento = (presupuesto.precio_total || 0) - (presupuesto.descuento || 0);
                                    const saldoPendiente = Math.max(0, precioConDescuento - (Number(presupuesto.monto_pagado) || 0));
                                    setMontoPago(saldoPendiente > 0 ? saldoPendiente : precioConDescuento);
                                    setMetodoPago("efectivo");
                                    setTipoPago(presupuesto.estado_pago === 'adelanto' ? 'saldo' : 'total');
                                    setModalPagoPresupuesto(true);
                                  }}
                                  sx={{
                                    fontSize: "0.75rem",
                                    py: 0.5,
                                    borderRadius: 2,
                                    backgroundColor: presupuesto.estado_pago === 'adelanto' ? "#ff9800" : "#4caf50",
                                    "&:hover": { backgroundColor: presupuesto.estado_pago === 'adelanto' ? "#f57c00" : "#388e3c" }
                                  }}
                                >
                                  {presupuesto.estado_pago === 'adelanto' ? '💰 Pagar Saldo' : '💰 Registrar Pago'}
                                </Button>
                              )}
                              {isMaster && presupuesto.monto_pagado > 0 && (
                                <Button
                                  size="small"
                                  variant="outlined"
                                  onClick={() => {
                                    setPresupuestoEditarPago(presupuesto);
                                    setNuevoMontoPagadoPresupuesto(String(presupuesto.monto_pagado || 0));
                                    setModalEditarPagoPresupuesto(true);
                                  }}
                                  sx={{
                                    fontSize: "0.75rem",
                                    py: 0.5,
                                    borderRadius: 2,
                                    borderColor: "#1565c0",
                                    color: "#1565c0",
                                    "&:hover": { 
                                      backgroundColor: "rgba(21, 101, 192, 0.08)",
                                      borderColor: "#0d47a1"
                                    }
                                  }}
                                >
                                  ✏️ Editar Pago
                                </Button>
                              )}
                              {presupuesto.estado !== 'completado' && (
                                <Button
                                  size="small"
                                  variant="contained"
                                  onClick={() => navigate(`/tratamientos/comenzar?paciente=${pacienteSeleccionado.id}&presupuesto=${presupuesto.id}`)}
                                  sx={{
                                    fontSize: "0.75rem",
                                    py: 0.5,
                                    borderRadius: 2,
                                    backgroundColor: "#7b1fa2",
                                    "&:hover": { backgroundColor: "#6a1b9a" }
                                  }}
                                >
                                  💉 Realizar Tratamiento
                                </Button>
                              )}
                              <Button
                                size="small"
                                variant="outlined"
                                color="error"
                                onClick={() => eliminarPresupuestoAsignado(presupuesto.id)}
                                sx={{
                                  fontSize: "0.7rem",
                                  py: 0.5,
                                  borderRadius: 2,
                                }}
                              >
                                Eliminar
                              </Button>
                            </Box>
                          </Box>
                            );
                          })()}
                          </>
                          )}
                        </Paper>
                      );
                    })}
                  </Box>
                </Paper>
              )}

              {/* Paquetes Asignados al Paciente */}
              {paquetesPaciente.length > 0 && (
                <Paper
                  elevation={0}
                  sx={{
                    mb: 3,
                    p: 2.5,
                    borderRadius: 3,
                    backgroundColor: "rgba(33, 150, 243, 0.08)",
                    border: "1px solid rgba(33, 150, 243, 0.3)",
                  }}
                >
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 2 }}>
                    <Inventory sx={{ color: "#1565c0", fontSize: 24 }} />
                    <Typography
                      variant="h6"
                      sx={{ color: "#1565c0", fontWeight: "bold", display: "flex", alignItems: "center", gap: 1 }}
                    >
                      Paquetes del Paciente
                    </Typography>
                  </Box>
                  <Box sx={{ display: "grid", gap: 2 }}>
                    {paquetesPaciente.map((paquete) => {
                      const progreso = paquete.sesiones_totales > 0 
                        ? Math.round((paquete.sesiones_completadas / paquete.sesiones_totales) * 100) 
                        : 0;
                      
                      return (
                        <Paper
                          key={paquete.id}
                          elevation={0}
                          sx={{
                            p: 2,
                            borderRadius: 2,
                            backgroundColor: "white",
                            border: `1px solid ${paquete.estado === 'completado' ? '#4caf50' : paquete.estado === 'cancelado' ? '#f44336' : '#2196f3'}`,
                          }}
                        >
                          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 1 }}>
                            <Box>
                              <Typography sx={{ fontWeight: "bold", color: "#333" }}>
                                {paquete.paquete_nombre}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                Asignado: {paquete.fecha_inicio?.split(' ')[0]}
                              </Typography>
                            </Box>
                            <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
                              <Box sx={{ 
                                backgroundColor: paquete.estado === 'completado' ? '#4caf50' : paquete.estado === 'cancelado' ? '#f44336' : '#2196f3',
                                color: "white", 
                                px: 1.5, 
                                py: 0.5, 
                                borderRadius: 2,
                                fontWeight: "bold",
                                fontSize: "0.75rem",
                                textTransform: "uppercase"
                              }}>
                                {paquete.estado}
                              </Box>
                              <IconButton
                                size="small"
                                onClick={() => generarReciboPaquete(paquete)}
                                sx={{
                                  color: "#d4af37",
                                  "&:hover": { backgroundColor: "rgba(212,175,55,0.1)" }
                                }}
                                title="Imprimir recibo"
                              >
                                <Receipt />
                              </IconButton>
                              <Button
                                size="small"
                                variant="outlined"
                                onClick={() => {
                                  setPaquetesColapsados(prev => ({
                                    ...prev,
                                    [paquete.id]: !prev[paquete.id]
                                  }));
                                }}
                                sx={{
                                  fontSize: "0.7rem",
                                  py: 0.25,
                                  px: 1,
                                  minWidth: "auto",
                                  borderColor: "#2196f3",
                                  color: "#2196f3",
                                  "&:hover": { 
                                    backgroundColor: "rgba(33, 150, 243, 0.08)",
                                    borderColor: "#1565c0"
                                  }
                                }}
                              >
                                {paquetesColapsados[paquete.id] ? "Abrir" : "Guardar"}
                              </Button>
                            </Box>
                          </Box>
                          
                          {/* Contenido colapsable del paquete */}
                          {!paquetesColapsados[paquete.id] && (
                          <>
                          {/* Barra de progreso */}
                          <Box sx={{ mb: 2 }}>
                            <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
                              <Typography variant="caption" color="text.secondary">
                                Progreso: {paquete.sesiones_completadas}/{paquete.sesiones_totales} sesiones
                              </Typography>
                              <Typography variant="caption" sx={{ fontWeight: "bold", color: "#1565c0" }}>
                                {progreso}%
                              </Typography>
                            </Box>
                            <Box sx={{ 
                              height: 8, 
                              backgroundColor: "#e0e0e0", 
                              borderRadius: 4,
                              overflow: "hidden"
                            }}>
                              <Box sx={{ 
                                height: "100%", 
                                width: `${progreso}%`,
                                backgroundColor: paquete.estado === 'completado' ? '#4caf50' : '#2196f3',
                                borderRadius: 4,
                                transition: "width 0.3s ease"
                              }} />
                            </Box>
                          </Box>

                          {/* Sesiones del paquete */}
                          {paquete.sesiones && paquete.sesiones.length > 0 && (
                            <Box sx={{ mt: 1 }}>
                              <Typography variant="caption" sx={{ fontWeight: "bold", color: "#666", mb: 1, display: "block" }}>
                                Sesiones:
                              </Typography>
                              <Box sx={{ display: "grid", gap: 0.5 }}>
                                {paquete.sesiones.map((sesion) => (
                                  <Box
                                    key={sesion.id}
                                    sx={{
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "space-between",
                                      p: 1,
                                      backgroundColor: sesion.estado === 'completada' ? "rgba(76, 175, 80, 0.1)" : "rgba(0,0,0,0.02)",
                                      borderRadius: 1,
                                      border: `1px solid ${sesion.estado === 'completada' ? '#4caf50' : '#e0e0e0'}`,
                                    }}
                                  >
                                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                                      <Box sx={{
                                        width: 20,
                                        height: 20,
                                        borderRadius: "50%",
                                        backgroundColor: sesion.estado === 'completada' ? '#4caf50' : '#e0e0e0',
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        fontSize: "0.7rem",
                                        color: sesion.estado === 'completada' ? 'white' : '#666'
                                      }}>
                                        {sesion.estado === 'completada' ? '✓' : sesion.sesion_numero}
                                      </Box>
                                      <Typography variant="body2">
                                        {sesion.tratamiento_nombre} - Sesión {sesion.sesion_numero}
                                      </Typography>
                                      <Typography variant="caption" color="text.secondary">
                                        (S/ {sesion.precio_sesion?.toFixed(2)})
                                      </Typography>
                                    </Box>
                                    {sesion.estado === 'pendiente' && paquete.estado === 'activo' && (
                                      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                                        <Select
                                          size="small"
                                          value={especialistasPorSesion[`paquete_${sesion.id}`] || ''}
                                          onChange={(e) => setEspecialistasPorSesion(prev => ({
                                            ...prev,
                                            [`paquete_${sesion.id}`]: e.target.value
                                          }))}
                                          displayEmpty
                                          sx={{
                                            fontSize: "0.7rem",
                                            minWidth: 120,
                                            height: 28
                                          }}
                                        >
                                          <MenuItem value="" disabled>
                                            <em>Especialista</em>
                                          </MenuItem>
                                          {especialistas.map((esp) => (
                                            <MenuItem key={esp.id} value={esp.id}>
                                              {esp.nombre}
                                            </MenuItem>
                                          ))}
                                        </Select>
                                        <Button
                                          size="small"
                                          variant="outlined"
                                          onClick={() => completarSesion(sesion.id)}
                                          sx={{
                                            fontSize: "0.7rem",
                                            py: 0.25,
                                            px: 1,
                                            borderColor: "#4caf50",
                                            color: "#4caf50",
                                            "&:hover": { backgroundColor: "rgba(76, 175, 80, 0.1)" }
                                          }}
                                        >
                                          Completar
                                        </Button>
                                      </Box>
                                    )}
                                    {sesion.estado === 'completada' && (
                                      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                                        <Typography variant="caption" color="success.main">
                                          {sesion.fecha_realizada?.split(' ')[0]}
                                        </Typography>
                                        <Button
                                          size="small"
                                          variant="text"
                                          onClick={() => desmarcarSesion(sesion.id)}
                                          sx={{
                                            fontSize: "0.65rem",
                                            py: 0,
                                            px: 0.5,
                                            minWidth: "auto",
                                            color: "#f44336",
                                            "&:hover": { backgroundColor: "rgba(244, 67, 54, 0.1)" }
                                          }}
                                        >
                                          Deshacer
                                        </Button>
                                      </Box>
                                    )}
                                  </Box>
                                ))}
                              </Box>
                            </Box>
                          )}

                          {/* Total del paquete y estado de pago */}
                          <Box sx={{ mt: 2, pt: 1, borderTop: "1px dashed #e0e0e0" }}>
                            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 1 }}>
                              <Box>
                                <Typography variant="body2" color="text.secondary">
                                  Total del paquete:
                                </Typography>
                                <Typography sx={{ fontWeight: "bold", color: "#1565c0", fontSize: "1.1rem" }}>
                                  S/ {paquete.precio_total?.toFixed(2)}
                                </Typography>
                              </Box>
                              
                              {/* Estado de pago con colores */}
                              <Box sx={{ 
                                px: 1.5, 
                                py: 0.5, 
                                borderRadius: 2,
                                backgroundColor: paquete.estado_pago === 'pagado' || paquete.pagado === 1 
                                  ? '#e8f5e9' 
                                  : paquete.estado_pago === 'adelanto' 
                                    ? '#fff3e0' 
                                    : '#ffebee',
                                border: `1px solid ${paquete.estado_pago === 'pagado' || paquete.pagado === 1 
                                  ? '#4caf50' 
                                  : paquete.estado_pago === 'adelanto' 
                                    ? '#ff9800' 
                                    : '#f44336'}`
                              }}>
                                <Typography variant="caption" sx={{ 
                                  fontWeight: "bold", 
                                  color: paquete.estado_pago === 'pagado' || paquete.pagado === 1 
                                    ? '#2e7d32' 
                                    : paquete.estado_pago === 'adelanto' 
                                      ? '#e65100' 
                                      : '#c62828',
                                  textTransform: "uppercase"
                                }}>
                                  {paquete.estado_pago === 'pagado' || paquete.pagado === 1 
                                    ? '✓ PAGADO' 
                                    : paquete.estado_pago === 'adelanto' 
                                      ? '📝 ADELANTO' 
                                      : '⏳ PENDIENTE PAGO'}
                                </Typography>
                              </Box>
                            </Box>
                            
                            {/* Información de Consulta Pagada */}
                            {paquete.consulta_pagada === 1 && (
                              <Box sx={{ mt: 1, p: 1, backgroundColor: "rgba(156, 39, 176, 0.1)", borderRadius: 1, border: "1px solid rgba(156, 39, 176, 0.3)" }}>
                                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                  <Typography variant="caption" sx={{ color: "#7b1fa2", fontWeight: "bold" }}>
                                    💊 Consulta Pagada
                                  </Typography>
                                  <Typography variant="caption" sx={{ color: "#7b1fa2", fontWeight: "bold" }}>
                                    S/ {(paquete.monto_consulta || 0).toFixed(2)}
                                  </Typography>
                                </Box>
                                {paquete.metodo_pago_consulta && (
                                  <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
                                    Método: {paquete.metodo_pago_consulta} | {paquete.fecha_pago_consulta?.split(' ')[0]}
                                  </Typography>
                                )}
                              </Box>
                            )}

                            {/* Detalles de pago */}
                            {(paquete.monto_pagado > 0 || paquete.estado_pago === 'adelanto') && (
                              <Box sx={{ mt: 1, p: 1, backgroundColor: "rgba(0,0,0,0.02)", borderRadius: 1 }}>
                                <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                                  <Typography variant="caption" color="text.secondary">Pagado:</Typography>
                                  <Typography variant="caption" sx={{ color: "#4caf50", fontWeight: "bold" }}>
                                    S/ {(paquete.monto_pagado || 0).toFixed(2)}
                                  </Typography>
                                </Box>
                                {paquete.estado_pago !== 'pagado' && paquete.pagado !== 1 && (
                                  <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                                    <Typography variant="caption" color="text.secondary">Saldo pendiente:</Typography>
                                    <Typography variant="caption" sx={{ color: "#f57c00", fontWeight: "bold" }}>
                                      S/ {Math.max(0, (Number(paquete.precio_total) || 0) - (Number(paquete.monto_pagado) || 0)).toFixed(2)}
                                    </Typography>
                                  </Box>
                                )}
                                {paquete.metodo_pago && (
                                  <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
                                    Método: {paquete.metodo_pago} | {paquete.fecha_pago?.split(' ')[0]}
                                  </Typography>
                                )}
                              </Box>
                            )}
                            
                            {/* Botones de acción */}
                            <Box sx={{ display: "flex", gap: 1, mt: 1.5, justifyContent: "flex-end", flexWrap: "wrap" }}>
                              {/* Botón de Pago de Consulta */}
                              {paquete.consulta_pagada !== 1 && paquete.estado_pago !== 'pagado' && paquete.pagado !== 1 && (
                                <Button
                                  size="small"
                                  variant="outlined"
                                  onClick={() => {
                                    setConsultaGlobalSeleccion({ tipo: 'paquete', item: paquete });
                                    setMontoConsultaGlobal(100);
                                    setMetodoPagoConsultaGlobal("efectivo");
                                    setModalPagoConsultaGlobal(true);
                                  }}
                                  sx={{
                                    fontSize: "0.75rem",
                                    py: 0.5,
                                    borderRadius: 2,
                                    borderColor: "#9c27b0",
                                    color: "#9c27b0",
                                    "&:hover": { 
                                      backgroundColor: "rgba(156, 39, 176, 0.08)",
                                      borderColor: "#7b1fa2"
                                    }
                                  }}
                                >
                                  💊 Pagar Consulta
                                </Button>
                              )}
                              {paquete.estado_pago !== 'pagado' && paquete.pagado !== 1 && (
                                <Button
                                  size="small"
                                  variant="contained"
                                  onClick={() => {
                                    setPaqueteParaPago(paquete);
                                    const saldoPendiente = Math.max(0, (Number(paquete.precio_total) || 0) - (Number(paquete.monto_pagado) || 0));
                                    setMontoPago(saldoPendiente > 0 ? saldoPendiente : paquete.precio_total);
                                    setMetodoPago("efectivo");
                                    setTipoPago(paquete.estado_pago === 'adelanto' ? 'saldo' : 'total');
                                    setModalPagoPaquete(true);
                                  }}
                                  sx={{
                                    fontSize: "0.75rem",
                                    py: 0.5,
                                    borderRadius: 2,
                                    backgroundColor: paquete.estado_pago === 'adelanto' ? "#ff9800" : "#4caf50",
                                    "&:hover": { backgroundColor: paquete.estado_pago === 'adelanto' ? "#f57c00" : "#388e3c" }
                                  }}
                                >
                                  {paquete.estado_pago === 'adelanto' ? '💰 Pagar Saldo' : '💰 Registrar Pago'}
                                </Button>
                              )}
                              {isMaster && paquete.monto_pagado > 0 && (
                                <Button
                                  size="small"
                                  variant="outlined"
                                  onClick={() => {
                                    setPaqueteEditarPago(paquete);
                                    setNuevoMontoPagadoPaquete(String(paquete.monto_pagado || 0));
                                    setModalEditarPagoPaquete(true);
                                  }}
                                  sx={{
                                    fontSize: "0.75rem",
                                    py: 0.5,
                                    borderRadius: 2,
                                    borderColor: "#1565c0",
                                    color: "#1565c0",
                                    "&:hover": { 
                                      backgroundColor: "rgba(21, 101, 192, 0.08)",
                                      borderColor: "#0d47a1"
                                    }
                                  }}
                                >
                                  ✏️ Editar Pago
                                </Button>
                              )}
                              {paquete.estado === 'activo' && (
                                <Button
                                  size="small"
                                  variant="contained"
                                  onClick={() => navigate(`/tratamientos/comenzar?paciente=${pacienteSeleccionado.id}&paquete=${paquete.id}`)}
                                  sx={{
                                    fontSize: "0.75rem",
                                    py: 0.5,
                                    borderRadius: 2,
                                    backgroundColor: "#7b1fa2",
                                    "&:hover": { backgroundColor: "#6a1b9a" }
                                  }}
                                >
                                  💉 Realizar Tratamiento
                                </Button>
                              )}
                              {paquete.estado === 'completado' && (
                                <Button
                                  size="small"
                                  variant="contained"
                                  onClick={() => generarReciboPaquete(paquete)}
                                  sx={{
                                    fontSize: "0.7rem",
                                    py: 0.5,
                                    borderRadius: 2,
                                    backgroundColor: "#1565c0",
                                    "&:hover": { backgroundColor: "#0d47a1" }
                                  }}
                                >
                                  🧾 Recibo
                                </Button>
                              )}
                              <Button
                                size="small"
                                variant="outlined"
                                color="error"
                                onClick={() => eliminarPaquetePaciente(paquete.id)}
                                sx={{
                                  fontSize: "0.7rem",
                                  py: 0.5,
                                  borderRadius: 2,
                                }}
                              >
                                Eliminar
                              </Button>
                            </Box>
                          </Box>
                          </>
                          )}
                        </Paper>
                      );
                    })}
                  </Box>
                </Paper>
              )}

              {/* Tratamientos realizados */}
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2 }}>
                <Typography
                  variant="h6"
                  sx={{ color: "#a36920", fontWeight: "bold" }}
                >
                  Tratamientos realizados
                </Typography>
                
                {/* Mostrar botón de recibo consolidado si hay fechas con múltiples tratamientos */}
                {Object.keys(tratamientosPorFecha).some(fecha => tratamientosPorFecha[fecha].length > 1) && (
                  <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                    {Object.keys(tratamientosPorFecha)
                      .filter(fecha => tratamientosPorFecha[fecha].length > 1)
                      .map(fecha => (
                        <Button
                          key={fecha}
                          variant="outlined"
                          size="small"
                          startIcon={<Receipt />}
                          sx={{
                            borderColor: "#D4AF37",
                            color: "#D4AF37",
                            fontWeight: 600,
                            borderRadius: 2,
                            "&:hover": {
                              backgroundColor: "rgba(212,175,55,0.1)",
                              borderColor: "#B8941F",
                            },
                          }}
                          onClick={() => abrirReciboConsolidadoPorFecha(fecha)}
                        >
                          Recibo {fecha} ({tratamientosPorFecha[fecha].length} servicios)
                        </Button>
                      ))}
                  </Box>
                )}
              </Box>

              {tratamientos.length === 0 ? (
                <Typography>No hay tratamientos registrados.</Typography>
              ) : (
                <>
                  <TableContainer
                    component={Paper}
                    elevation={0}
                    sx={{
                      borderRadius: 3,
                      overflow: "auto",
                      border: "1px solid rgba(212,175,55,0.18)",
                      backgroundColor: "rgba(255,255,255,0.68)",
                    }}
                  >
                    <Table stickyHeader size="small">
                      <TableHead>
                        <TableRow>
                          {["Fecha", "Tratamiento", "Cant.", "Producto", "Tipo", "Especialista", "Ses.", "Fotos", "Recibo", "Acciones"].map((header) => (
                            <TableCell
                              key={header}
                              sx={{
                                fontWeight: 700,
                                fontSize: "0.7rem",
                                color: "white",
                                backgroundColor: "#a36920",
                                borderBottom: "2px solid #8a5a1a",
                                whiteSpace: "nowrap",
                                letterSpacing: "0.02em",
                                py: 1,
                                px: 1,
                              }}
                            >
                              {header}
                            </TableCell>
                          ))}
                        </TableRow>
                      </TableHead>
                      <TableBody>
                      {tratamientos.map((t) => {
                        const tieneFotosAntes = CAMPOS_FOTOS_ANTES.some((key) => t[key]);
                        const tieneFotosDespues = CAMPOS_FOTOS_DESPUES.some((key) => t[key]);
                        const tieneFotosLegacy = CAMPOS_FOTOS_LEGACY.some((key) => t[key]);
                        const tieneFotos = tieneFotosAntes || tieneFotosDespues || tieneFotosLegacy;

                        let productoUsado = "-";
                        try {
                          if (t.productos) {
                            const productosArray = typeof t.productos === 'string' ? JSON.parse(t.productos) : t.productos;
                            if (Array.isArray(productosArray) && productosArray.length > 0) {
                              const prod = productosArray[0];
                              if (prod.variante_nombre) {
                                productoUsado = `${prod.nombre || ''} ${prod.variante_nombre}`.trim();
                              } else if (prod.nombre) {
                                productoUsado = prod.nombre;
                              } else if (prod.producto) {
                                productoUsado = prod.producto;
                              }
                            }
                          }
                        } catch (e) {
                          console.error('Error parseando productos:', e);
                        }

                        return (
                          <TableRow 
                            key={t.id}
                            sx={{
                              "&:nth-of-type(odd)": { backgroundColor: "#fffdf7" },
                              "&:nth-of-type(even)": { backgroundColor: "#f5f1e4" },
                              "&:hover": { backgroundColor: "rgba(163,105,32,0.10)" },
                              transition: "background-color 0.15s ease",
                            }}
                          >
                            <TableCell sx={{ whiteSpace: "nowrap", fontWeight: 600, color: "#5a3e1b", fontSize: "0.75rem", px: 1 }}>{formatearFechaCorta(t.fecha)}</TableCell>
                            <TableCell sx={{ fontWeight: 600, color: "#333", fontSize: "0.75rem", maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis", px: 1 }}>{t.nombreTratamiento}</TableCell>
                            <TableCell sx={{ color: "#666", fontSize: "0.75rem", px: 1, textAlign: "center" }}>{t.cantidad_total || "-"}</TableCell>
                            <TableCell sx={{ color: "#666", fontSize: "0.72rem", maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", px: 1 }}>{productoUsado}</TableCell>
                            <TableCell sx={{ color: "#555", fontSize: "0.75rem", px: 1 }}>{t.tipoAtencion}</TableCell>
                            <TableCell sx={{ color: "#555", fontSize: "0.75rem", maxWidth: 100, overflow: "hidden", textOverflow: "ellipsis", px: 1 }}>{t.especialista}</TableCell>
                            <TableCell sx={{ fontWeight: 600, color: "#a36920", fontSize: "0.75rem", px: 1, textAlign: "center" }}>{t.sesion}</TableCell>

                            <TableCell sx={{ px: 0.5 }}>
                              {tratamientoSeleccionado === t.id ? (
                                <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5, minWidth: 100 }}>
                                  <Box>
                                    <Typography variant="caption" fontWeight="bold" color="#a36920" sx={{ mb: 0.3, fontSize: "0.65rem" }}>
                                      Subir fotos
                                    </Typography>
                                    <input
                                      type="file"
                                      multiple
                                      accept="image/*"
                                      onClick={(e) => (e.target.value = null)}
                                      onChange={manejarCambioFotos}
                                      style={{ fontSize: "0.7rem" }}
                                    />
                                  </Box>
                                  <Box sx={{ display: "flex", gap: 0.5, alignItems: "center" }}>
                                    <Button
                                      variant="outlined"
                                      size="small"
                                      sx={{
                                        color: "#a36920",
                                        borderColor: "#a36920",
                                        fontSize: "0.65rem",
                                        py: 0.3,
                                        px: 0.8,
                                      }}
                                      onClick={() => subirFotos(t.id)}
                                    >
                                      Guardar
                                    </Button>
                                    <Button
                                      variant="text"
                                      size="small"
                                      sx={{
                                        color: "#a36920",
                                        textTransform: "none",
                                        fontSize: "0.65rem",
                                        py: 0.3,
                                        px: 0.8,
                                      }}
                                      onClick={() => abrirFotosPaciente(t.id)}
                                    >
                                      Ver
                                    </Button>
                                  </Box>
                                </Box>
                              ) : (
                                <Box sx={{ display: "flex", flexDirection: "column", gap: 0.3 }}>
                                  <Button
                                    variant="text"
                                    size="small"
                                    sx={{
                                      color: "#a36920",
                                      textTransform: "none",
                                      fontSize: "0.65rem",
                                      py: 0.3,
                                      px: 0.5,
                                      minWidth: "auto",
                                    }}
                                    onClick={() => setTratamientoSeleccionado(t.id)}
                                  >
                                    {tieneFotos ? "Actualizar" : "Agregar"}
                                  </Button>
                                  <Button
                                    variant="text"
                                    size="small"
                                    sx={{
                                      color: "#a36920",
                                      textTransform: "none",
                                      fontSize: "0.65rem",
                                      py: 0.3,
                                      px: 0.5,
                                      minWidth: "auto",
                                    }}
                                    onClick={() => abrirFotosPaciente(t.id)}
                                  >
                                    Ver
                                  </Button>
                                </Box>
                              )}
                            </TableCell>

                            {/* Columna de Recibo */}
                            <TableCell sx={{ px: 0.5, textAlign: "center" }}>
                              <IconButton
                                size="small"
                                sx={{
                                  color: "#D4AF37",
                                  "&:hover": {
                                    backgroundColor: "rgba(212,175,55,0.1)",
                                  },
                                  p: 0.5,
                                }}
                                onClick={() => abrirReciboTratamiento(t)}
                                title="Imprimir recibo"
                              >
                                <Receipt sx={{ fontSize: "1.2rem" }} />
                              </IconButton>
                            </TableCell>

                            {/* Columna de Acciones */}
                            <TableCell sx={{ px: 0.5 }}>
                              {(isMaster || isAdmin || isDoctor || isAsistente || canEditHistorial) ? (
                                <Box sx={{ display: "flex", gap: 0.3 }}>
                                  <IconButton
                                    size="small"
                                    sx={{
                                      color: "#1976d2",
                                      "&:hover": {
                                        backgroundColor: "rgba(25,118,210,0.1)",
                                      },
                                      p: 0.5,
                                    }}
                                    onClick={() => abrirEditarTratamiento(t)}
                                    title="Editar tratamiento"
                                  >
                                    <Edit sx={{ fontSize: "1.2rem" }} />
                                  </IconButton>
                                  <IconButton
                                    size="small"
                                    sx={{
                                      color: "#d32f2f",
                                      "&:hover": {
                                        backgroundColor: "rgba(211,47,47,0.1)",
                                      },
                                      p: 0.5,
                                    }}
                                    onClick={() => abrirConfirmacionCancelar(t)}
                                    title="Cancelar tratamiento"
                                  >
                                    <Delete sx={{ fontSize: "1.2rem" }} />
                                  </IconButton>
                                </Box>
                              ) : (
                                <Typography variant="caption" sx={{ color: "#999", fontStyle: "italic", fontSize: "0.65rem" }}>
                                  Sin permisos
                                </Typography>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      </TableBody>
                    </Table>
                  </TableContainer>

                </>
              )}

              {/* ========== GALERÍA DE FOTOS DEL PACIENTE ========== */}
              <Typography
                variant="h6"
                sx={{ color: "#a36920", fontWeight: "bold", mb: 2, mt: 4 }}
              >
                Galería de fotos
              </Typography>

              <Paper
                elevation={0}
                sx={{
                  mb: 4,
                  p: 2.5,
                  borderRadius: 3,
                  backgroundColor: "rgba(255,255,255,0.68)",
                  border: "1px solid rgba(212,175,55,0.18)",
                }}
              >
                {/* Subir fotos */}
                <Box sx={{ mb: 2.5 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: "bold", color: "rgba(0,0,0,0.70)", mb: 1.5 }}>
                    Subir fotos (máx. 15 por lote)
                  </Typography>
                  <TextField
                    fullWidth
                    size="small"
                    label="Nombre del tratamiento"
                    placeholder="Ej: Botox, Limpieza facial, Peeling..."
                    value={nombreTratamientoFoto}
                    onChange={(e) => setNombreTratamientoFoto(e.target.value)}
                    sx={{
                      mb: 1.5,
                      "& .MuiInputBase-root": {
                        backgroundColor: "rgba(212, 175, 55, 0.10)",
                        borderRadius: 2,
                      },
                      "& .MuiOutlinedInput-root": {
                        "&:hover fieldset": { borderColor: "#a36920" },
                        "&.Mui-focused fieldset": { borderColor: "#a36920" },
                      },
                      "& .MuiInputLabel-root.Mui-focused": { color: "#a36920" },
                    }}
                  />
                  <Box sx={{ display: "flex", gap: 1.5, alignItems: "center", flexWrap: "wrap" }}>
                    <Button
                      variant="outlined"
                      component="label"
                      size="small"
                      sx={{
                        borderColor: "#a36920",
                        color: "#a36920",
                        fontWeight: "bold",
                        borderRadius: 2,
                        textTransform: "none",
                        "&:hover": { backgroundColor: "rgba(163,105,32,0.08)" },
                      }}
                    >
                      Seleccionar fotos
                      <input
                        hidden
                        type="file"
                        multiple
                        accept="image/*"
                        onChange={(e) => {
                          const archivos = Array.from(e.target.files || []);
                          if (archivos.length > 15) {
                            showToast({ severity: "warning", message: "Solo puedes subir hasta 15 fotos por lote" });
                          }
                          setArchivosFotosPaciente(archivos.slice(0, 15));
                          e.target.value = "";
                        }}
                      />
                    </Button>
                    {archivosFotosPaciente.length > 0 && (
                      <Typography variant="body2" sx={{ color: "rgba(0,0,0,0.60)" }}>
                        {archivosFotosPaciente.length} foto(s) seleccionada(s)
                      </Typography>
                    )}
                    <Button
                      variant="contained"
                      size="small"
                      disabled={!archivosFotosPaciente.length || !nombreTratamientoFoto.trim() || subiendoFotosPaciente}
                      onClick={subirFotosPaciente}
                      sx={{
                        backgroundColor: "#a36920",
                        "&:hover": { backgroundColor: "#8b581b" },
                        borderRadius: 2,
                        fontWeight: "bold",
                        textTransform: "none",
                      }}
                    >
                      {subiendoFotosPaciente ? "Subiendo..." : "Subir fotos"}
                    </Button>
                  </Box>

                  {/* Preview de archivos seleccionados */}
                  {archivosFotosPaciente.length > 0 && (
                    <Box sx={{ display: "flex", gap: 1, mt: 1.5, flexWrap: "wrap" }}>
                      {archivosFotosPaciente.map((file, idx) => (
                        <Box
                          key={idx}
                          sx={{
                            width: 64,
                            height: 64,
                            borderRadius: 1.5,
                            overflow: "hidden",
                            border: "1px solid rgba(163,105,32,0.25)",
                          }}
                        >
                          <img
                            src={URL.createObjectURL(file)}
                            alt={`preview-${idx}`}
                            style={{ width: "100%", height: "100%", objectFit: "cover" }}
                          />
                        </Box>
                      ))}
                    </Box>
                  )}
                </Box>

                <Divider sx={{ mb: 2.5 }} />

                {/* Galería de fotos subidas */}
                {fotosPaciente.length === 0 ? (
                  <Typography variant="body2" sx={{ color: "rgba(0,0,0,0.50)", fontStyle: "italic" }}>
                    No hay fotos registradas para este paciente.
                  </Typography>
                ) : (
                  <>
                    <Typography variant="subtitle2" sx={{ fontWeight: "bold", color: "rgba(0,0,0,0.70)", mb: 1.5 }}>
                      Últimas fotos ({fotosPaciente.length} en total)
                    </Typography>
                    <Grid container spacing={1.5}>
                      {(mostrarTodasFotos ? fotosPaciente : fotosPaciente.slice(0, 5)).map((foto) => (
                        <Grid item xs={6} sm={4} md={3} key={foto.id}>
                          <Paper
                            elevation={0}
                            sx={{
                              borderRadius: 2,
                              overflow: "hidden",
                              border: "1px solid rgba(163,105,32,0.18)",
                              backgroundColor: "rgba(255,255,255,0.80)",
                              transition: "box-shadow 0.2s, transform 0.2s",
                              "&:hover": {
                                boxShadow: "0 6px 20px rgba(0,0,0,0.12)",
                                transform: "translateY(-2px)",
                              },
                            }}
                          >
                            <Box
                              sx={{ position: "relative", cursor: "pointer" }}
                              onClick={() => setFotoPreview(foto)}
                            >
                              <img
                                src={`${API_BASE_URL}${foto.archivo}`}
                                alt={foto.nombre_tratamiento}
                                style={{
                                  width: "100%",
                                  height: 200,
                                  objectFit: "cover",
                                  display: "block",
                                }}
                              />
                            </Box>
                            <Box sx={{ p: 1 }}>
                              <Typography
                                variant="caption"
                                sx={{
                                  display: "block",
                                  fontWeight: 700,
                                  color: "#a36920",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {foto.nombre_tratamiento}
                              </Typography>
                              <Typography variant="caption" sx={{ display: "block", color: "rgba(0,0,0,0.50)", fontSize: "0.68rem" }}>
                                {foto.creado_en ? foto.creado_en.split(" ")[0] : ""}
                              </Typography>
                              <IconButton
                                size="small"
                                onClick={() => eliminarFotoPaciente(foto.id)}
                                sx={{
                                  mt: 0.3,
                                  color: "#d32f2f",
                                  padding: "2px",
                                  "&:hover": { backgroundColor: "rgba(211,47,47,0.08)" },
                                }}
                              >
                                <Delete sx={{ fontSize: 16 }} />
                              </IconButton>
                            </Box>
                          </Paper>
                        </Grid>
                      ))}
                    </Grid>

                    {fotosPaciente.length > 5 && (
                      <Box sx={{ display: "flex", justifyContent: "center", mt: 2 }}>
                        <Button
                          variant="outlined"
                          size="small"
                          onClick={() => setMostrarTodasFotos((v) => !v)}
                          sx={{
                            borderColor: "#a36920",
                            color: "#a36920",
                            fontWeight: "bold",
                            borderRadius: 3,
                            textTransform: "none",
                            "&:hover": { backgroundColor: "rgba(163,105,32,0.08)" },
                          }}
                        >
                          {mostrarTodasFotos ? "Mostrar menos" : `Mostrar más (${fotosPaciente.length - 5} fotos más)`}
                        </Button>
                      </Box>
                    )}
                  </>
                )}
              </Paper>

              {/* Modal de previsualización de foto */}
              <Dialog
                open={Boolean(fotoPreview)}
                onClose={() => setFotoPreview(null)}
                maxWidth="md"
                fullWidth
                PaperProps={{
                  sx: {
                    borderRadius: 3,
                    overflow: "hidden",
                    background: "linear-gradient(180deg, rgba(255,249,236,0.98) 0%, rgba(255,255,255,0.95) 100%)",
                  },
                }}
              >
                {fotoPreview && (
                  <>
                    <DialogTitle sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", pb: 1 }}>
                      <Box>
                        <Typography variant="h6" sx={{ color: "#a36920", fontWeight: "bold" }}>
                          {fotoPreview.nombre_tratamiento}
                        </Typography>
                        <Typography variant="caption" sx={{ color: "rgba(0,0,0,0.50)" }}>
                          {fotoPreview.creado_en}
                        </Typography>
                      </Box>
                      <IconButton onClick={() => setFotoPreview(null)}>
                        <Close />
                      </IconButton>
                    </DialogTitle>
                    <DialogContent sx={{ display: "flex", justifyContent: "center", p: 2 }}>
                      <img
                        src={`${API_BASE_URL}${fotoPreview.archivo}`}
                        alt={fotoPreview.nombre_tratamiento}
                        style={{
                          maxWidth: "100%",
                          maxHeight: "70vh",
                          objectFit: "contain",
                          borderRadius: 8,
                        }}
                      />
                    </DialogContent>
                  </>
                )}
              </Dialog>

            </>
          )}
        </Paper>
      </Container>

      {/* Modal de Recibo para Ticketera */}
      <ReciboTicket
        open={openReciboModal}
        onClose={() => setOpenReciboModal(false)}
        datos={datosRecibo}
      />

      {/* Modal de Recibo Consolidado */}
      <ReciboConsolidado
        open={openReciboConsolidado}
        onClose={() => setOpenReciboConsolidado(false)}
        datos={datosReciboConsolidado}
      />

      {/* Modal para Editar Tratamiento */}
      <Dialog open={openEditarModal} onClose={() => setOpenEditarModal(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ backgroundColor: "#a36920", color: "white" }}>
          Editar Tratamiento
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Fecha del Tratamiento"
                type="date"
                value={editFecha}
                onChange={(e) => setEditFecha(e.target.value)}
                InputLabelProps={{ shrink: true }}
                helperText="Puedes cambiar la fecha para registrar tratamientos históricos"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Nombre del Tratamiento"
                value={editNombreTratamiento}
                onChange={(e) => setEditNombreTratamiento(e.target.value)}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Cantidad (ml/unidades)"
                value={editCantidad}
                onChange={(e) => setEditCantidad(e.target.value)}
              />
            </Grid>
            <Grid item xs={6}>
              <Autocomplete
                freeSolo
                options={productosInventario}
                value={editProductoUsado}
                onChange={(event, newValue) => {
                  setEditProductoUsado(typeof newValue === 'string' ? newValue : newValue?.value || '');
                }}
                onInputChange={(event, newInputValue) => {
                  setEditProductoUsado(newInputValue);
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Producto Usado"
                    placeholder="Buscar o escribir producto"
                  />
                )}
              />
            </Grid>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Especialista</InputLabel>
                <Select
                  value={editEspecialista}
                  onChange={(e) => setEditEspecialista(e.target.value)}
                  label="Especialista"
                >
                  {especialistas.map((esp) => (
                    <MenuItem key={esp.id} value={esp.nombre}>
                      {esp.nombre}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Sesión"
                type="number"
                value={editSesion}
                onChange={(e) => setEditSesion(Number(e.target.value))}
                inputProps={{ min: 1 }}
              />
            </Grid>
            <Grid item xs={6}>
              <FormControl fullWidth>
                <InputLabel>Tipo de Atención</InputLabel>
                <Select
                  value={editTipoAtencion}
                  onChange={(e) => setEditTipoAtencion(e.target.value)}
                  label="Tipo de Atención"
                >
                  <MenuItem value="Tratamiento">Tratamiento</MenuItem>
                  <MenuItem value="Consulta">Consulta</MenuItem>
                  <MenuItem value="Seguimiento">Seguimiento</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Precio Total (S/)"
                type="number"
                value={editPrecio}
                onChange={(e) => setEditPrecio(e.target.value)}
                inputProps={{ min: 0, step: 0.01 }}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Descuento (%)"
                type="number"
                value={editDescuento}
                onChange={(e) => setEditDescuento(e.target.value)}
                inputProps={{ min: 0, max: 100 }}
              />
            </Grid>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Método de Pago</InputLabel>
                <Select
                  value={editPagoMetodo}
                  onChange={(e) => setEditPagoMetodo(e.target.value)}
                  label="Método de Pago"
                >
                  <MenuItem value="Efectivo">Efectivo</MenuItem>
                  <MenuItem value="Tarjeta">Tarjeta</MenuItem>
                  <MenuItem value="Transferencia">Transferencia</MenuItem>
                  <MenuItem value="Yape">Yape</MenuItem>
                  <MenuItem value="Plin">Plin</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setOpenEditarModal(false)} sx={{ color: "#666" }}>
            Cancelar
          </Button>
          <Button
            onClick={guardarEditarTratamiento}
            variant="contained"
            sx={{
              backgroundColor: "#a36920",
              "&:hover": { backgroundColor: "#8a5a1a" },
            }}
          >
            Guardar Cambios
          </Button>
        </DialogActions>
      </Dialog>

      {/* Modal de Confirmación para Cancelar Tratamiento */}
      <Dialog open={openConfirmarCancelar} onClose={() => setOpenConfirmarCancelar(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ backgroundColor: "#d32f2f", color: "white" }}>
          Confirmar Cancelación
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          <Typography>
            ¿Estás seguro de que deseas cancelar este tratamiento?
          </Typography>
          {tratamientoCancelar && (
            <Box sx={{ mt: 2, p: 2, backgroundColor: "#f5f5f5", borderRadius: 1 }}>
              <Typography variant="body2"><strong>Tratamiento:</strong> {tratamientoCancelar.nombreTratamiento}</Typography>
              <Typography variant="body2"><strong>Fecha:</strong> {tratamientoCancelar.fecha?.split(" ")[0]}</Typography>
              <Typography variant="body2"><strong>Especialista:</strong> {tratamientoCancelar.especialista}</Typography>
              <Typography variant="body2"><strong>Total:</strong> S/ {tratamientoCancelar.precio_total?.toFixed(2)}</Typography>
            </Box>
          )}
          <Typography sx={{ mt: 2, color: "#d32f2f", fontWeight: "bold" }}>
            Esta acción no se puede deshacer.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setOpenConfirmarCancelar(false)} sx={{ color: "#666" }}>
            No, mantener
          </Button>
          <Button
            onClick={cancelarTratamiento}
            variant="contained"
            sx={{
              backgroundColor: "#d32f2f",
              "&:hover": { backgroundColor: "#b71c1c" },
            }}
          >
            Sí, cancelar tratamiento
          </Button>
        </DialogActions>
      </Dialog>

      {/* Modal para Configurar Descuento en Proforma */}
      <Dialog open={modalDescuento} onClose={() => setModalDescuento(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ backgroundColor: "#a36920", color: "white" }}>
          Generar Proforma
        </DialogTitle>
        <DialogContent sx={{ mt: 3 }}>
          {presupuestoParaProforma && (
            <>
              <Typography variant="h6" sx={{ mb: 2, fontWeight: "bold" }}>
                Presupuesto Seleccionado
              </Typography>
              <Box sx={{ mb: 3, p: 2, backgroundColor: "#f5f5f5", borderRadius: 2 }}>
                {(() => {
                  const allItems = presupuestoParaProforma.items || [];
                  const ofertaId = presupuestoParaProforma.id;
                  // Filtrar: solo gold y purple aparecen en proforma
                  const itemsFiltrados = allItems.filter((_, idx) => {
                    const estado = tratamientosMarcados[`${ofertaId}-${idx}`];
                    return estado === "gold" || estado === "purple";
                  });
                  // Si no hay ninguno marcado, mostrar todos como fallback
                  const itemsAMostrar = itemsFiltrados.length > 0 ? itemsFiltrados : allItems;
                  return (
                    <>
                      {itemsAMostrar.map((item, idx) => {
                        const originalIdx = allItems.indexOf(item);
                        const estado = tratamientosMarcados[`${ofertaId}-${originalIdx}`];
                        return (
                          <Box
                            key={idx}
                            sx={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              mb: 1,
                            }}
                          >
                            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                              {estado && (
                                <Box sx={{
                                  width: 10, height: 10, borderRadius: "50%",
                                  backgroundColor: estado === "gold" ? "#d4af37" : "#7b1fa2",
                                }} />
                              )}
                              <Typography sx={{ color: estado === "purple" ? "#7b1fa2" : "inherit" }}>
                                {item.nombre}
                              </Typography>
                            </Box>
                            <Typography sx={{ fontWeight: "bold" }}>
                              S/ {Number(item.precio || 0).toFixed(2)}
                            </Typography>
                          </Box>
                        );
                      })}
                      <Divider sx={{ my: 1.5 }} />
                      <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                        <Typography sx={{ fontWeight: "bold" }}>Subtotal:</Typography>
                        <Typography sx={{ fontWeight: "bold" }}>
                          S/ {itemsAMostrar.reduce((sum, item) => sum + Number(item.precio || 0), 0).toFixed(2)}
                        </Typography>
                      </Box>
                    </>
                  );
                })()}
              </Box>

              <TextField
                fullWidth
                label="Descuento (S/)"
                type="number"
                value={descuentoProforma}
                onChange={(e) => setDescuentoProforma(e.target.value)}
                inputProps={{ min: 0, step: 0.01 }}
                helperText="Ingresa el monto de descuento a aplicar (opcional)"
                sx={{ mb: 2 }}
              />

              <Box sx={{ p: 2, backgroundColor: "#e8f5e9", borderRadius: 2 }}>
                {(() => {
                  const allItems = presupuestoParaProforma.items || [];
                  const ofertaId = presupuestoParaProforma.id;
                  const filtrados = allItems.filter((_, idx) => {
                    const est = tratamientosMarcados[`${ofertaId}-${idx}`];
                    return est === "gold" || est === "purple";
                  });
                  const items = filtrados.length > 0 ? filtrados : allItems;
                  const totalFinal = items.reduce((s, it) => s + Number(it.precio || 0), 0) - Number(descuentoProforma || 0);
                  return (
                    <>
                      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <Typography variant="h6" sx={{ fontWeight: "bold", color: "#2e7d32" }}>
                          Total Final:
                        </Typography>
                        <Typography variant="h5" sx={{ fontWeight: "bold", color: "#2e7d32" }}>
                          S/ {totalFinal.toFixed(2)}
                        </Typography>
                      </Box>
                      {Number(descuentoProforma) > 0 && (
                        <Typography variant="caption" sx={{ color: "#666", mt: 1, display: "block" }}>
                          Ahorro: S/ {Number(descuentoProforma).toFixed(2)}
                        </Typography>
                      )}
                    </>
                  );
                })()}
              </Box>
            </>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setModalDescuento(false)} sx={{ color: "#666" }}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            startIcon={<Print />}
            onClick={async () => {
              if (presupuestoParaProforma && pacienteSeleccionado) {
                const allItems = presupuestoParaProforma.items || [];
                const ofertaId = presupuestoParaProforma.id;
                const filtrados = allItems.filter((_, idx) => {
                  const est = tratamientosMarcados[`${ofertaId}-${idx}`];
                  return est === "gold" || est === "purple";
                });
                const itemsParaPDF = filtrados.length > 0 ? filtrados : allItems;
                await generarProformaPDF(
                  { ...presupuestoParaProforma, items: itemsParaPDF, descuento: Number(descuentoProforma) || 0 },
                  pacienteSeleccionado
                );
                setModalDescuento(false);
                showToast({ severity: "success", message: "Proforma generada correctamente" });
              }
            }}
            sx={{
              backgroundColor: "#a36920",
              "&:hover": { backgroundColor: "#8a5619" },
            }}
          >
            Generar PDF
          </Button>
        </DialogActions>
      </Dialog>

      {/* Modal para Agregar/Editar Descuento de Presupuesto */}
      <Dialog open={modalDescuentoPresupuesto} onClose={() => setModalDescuentoPresupuesto(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ backgroundColor: "#ff9800", color: "white" }}>
          💰 {Number(nuevoDescuento) > 0 ? "Editar" : "Agregar"} Descuento
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          {presupuestoParaDescuento && (
            <>
              <Typography variant="body2" sx={{ mb: 2, color: "#666" }}>
                Presupuesto #{presupuestoParaDescuento.id} - Subtotal: S/ {Number(presupuestoParaDescuento.total || 0).toFixed(2)}
              </Typography>
              
              <TextField
                fullWidth
                label="Monto de Descuento (S/)"
                type="number"
                value={nuevoDescuento}
                onChange={(e) => setNuevoDescuento(e.target.value)}
                inputProps={{ min: 0, step: 0.01, max: presupuestoParaDescuento.total }}
                sx={{ mb: 2 }}
                helperText={`Máximo: S/ ${Number(presupuestoParaDescuento.total || 0).toFixed(2)}`}
              />
              
              <Box sx={{ p: 2, backgroundColor: "#fff3e0", borderRadius: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  Total con descuento:
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: "bold", color: "#ff9800" }}>
                  S/ {(Number(presupuestoParaDescuento.total || 0) - Number(nuevoDescuento || 0)).toFixed(2)}
                </Typography>
              </Box>
            </>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setModalDescuentoPresupuesto(false)} sx={{ color: "#666" }}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            onClick={guardarDescuentoPresupuesto}
            disabled={Number(nuevoDescuento) < 0 || Number(nuevoDescuento) > (presupuestoParaDescuento?.total || 0)}
            sx={{
              backgroundColor: "#ff9800",
              "&:hover": { backgroundColor: "#f57c00" },
            }}
          >
            Guardar Descuento
          </Button>
        </DialogActions>
      </Dialog>

      {/* Modal para Registrar Pago de Presupuesto */}
      <Dialog open={modalPagoPresupuesto} onClose={() => setModalPagoPresupuesto(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ backgroundColor: "#4caf50", color: "white" }}>
          💰 Registrar Pago
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          {presupuestoParaPago && (
            <>
              <Typography variant="body2" sx={{ mb: 2, color: "#666" }}>
                Presupuesto #{presupuestoParaPago.oferta_id}
              </Typography>
              
              {/* Tipo de Pago */}
              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel>Tipo de Pago</InputLabel>
                <Select
                  value={tipoPago}
                  onChange={(e) => {
                    setTipoPago(e.target.value);
                    // Ajustar monto según tipo (considerando descuento)
                    const precioConDescuento = (presupuestoParaPago.precio_total || 0) - (presupuestoParaPago.descuento || 0);
                    if (e.target.value === 'total') {
                      const saldo = Math.max(0, precioConDescuento - (Number(presupuestoParaPago.monto_pagado) || 0));
                      setMontoPago(saldo > 0 ? saldo : precioConDescuento);
                    } else if (e.target.value === 'saldo') {
                      const saldoPendiente = Math.max(0, precioConDescuento - (Number(presupuestoParaPago.monto_pagado) || 0));
                      setMontoPago(saldoPendiente);
                    }
                  }}
                  label="Tipo de Pago"
                >
                  <MenuItem value="total">💵 Pago Total</MenuItem>
                  <MenuItem value="adelanto">📝 Adelanto</MenuItem>
                  {(Math.max(0, (Number(presupuestoParaPago.precio_total) || 0) - (Number(presupuestoParaPago.descuento) || 0) - (Number(presupuestoParaPago.monto_pagado) || 0)) > 0 || presupuestoParaPago.estado_pago === 'adelanto') && (
                    <MenuItem value="saldo">✅ Pagar Saldo Restante</MenuItem>
                  )}
                </Select>
              </FormControl>

              <TextField
                fullWidth
                label="Monto a pagar (S/)"
                type="number"
                value={montoPago}
                onChange={(e) => setMontoPago(e.target.value)}
                inputProps={{ min: 0, step: 0.01 }}
                sx={{ mb: 2 }}
              />
              
              <FormControl fullWidth>
                <InputLabel>Método de Pago</InputLabel>
                <Select
                  value={metodoPago}
                  onChange={(e) => setMetodoPago(e.target.value)}
                  label="Método de Pago"
                >
                  <MenuItem value="efectivo">Efectivo</MenuItem>
                  <MenuItem value="tarjeta">Tarjeta</MenuItem>
                  <MenuItem value="transferencia">Transferencia</MenuItem>
                  <MenuItem value="yape">Yape</MenuItem>
                  <MenuItem value="plin">Plin</MenuItem>
                </Select>
              </FormControl>
              
              {/* Resumen de pago */}
              <Box sx={{ mt: 2, p: 1.5, backgroundColor: "rgba(76, 175, 80, 0.1)", borderRadius: 2 }}>
                <Box sx={{ display: "flex", justifyContent: "space-between", mb: 1 }}>
                  <Typography variant="body2" color="text.secondary">Subtotal:</Typography>
                  <Typography sx={{ fontWeight: "bold" }}>S/ {Number(presupuestoParaPago.precio_total || 0).toFixed(2)}</Typography>
                </Box>
                {Number(presupuestoParaPago.descuento || 0) > 0 && (
                  <Box sx={{ display: "flex", justifyContent: "space-between", mb: 1 }}>
                    <Typography variant="body2" color="error">Descuento:</Typography>
                    <Typography sx={{ color: "#f44336", fontWeight: "bold" }}>-S/ {Number(presupuestoParaPago.descuento).toFixed(2)}</Typography>
                  </Box>
                )}
                <Box sx={{ display: "flex", justifyContent: "space-between", mb: 1, pt: 1, borderTop: "1px dashed #ccc" }}>
                  <Typography variant="body2" color="text.secondary" sx={{ fontWeight: "bold" }}>Total a pagar:</Typography>
                  <Typography sx={{ fontWeight: "bold", color: "#a36920" }}>
                    S/ {((presupuestoParaPago.precio_total || 0) - (presupuestoParaPago.descuento || 0)).toFixed(2)}
                  </Typography>
                </Box>
                {(presupuestoParaPago.monto_pagado > 0) && (
                  <Box sx={{ display: "flex", justifyContent: "space-between", mb: 1 }}>
                    <Typography variant="body2" color="text.secondary">Ya pagado:</Typography>
                    <Typography sx={{ color: "#4caf50", fontWeight: "bold" }}>S/ {(presupuestoParaPago.monto_pagado || 0).toFixed(2)}</Typography>
                  </Box>
                )}
                {(() => {
                  const precioConDescuento = (Number(presupuestoParaPago.precio_total) || 0) - (Number(presupuestoParaPago.descuento) || 0);
                  const saldoPendiente = Math.max(0, precioConDescuento - (Number(presupuestoParaPago.monto_pagado) || 0));
                  return saldoPendiente > 0 && (
                    <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                      <Typography variant="body2" color="text.secondary">Saldo pendiente:</Typography>
                      <Typography sx={{ color: "#f57c00", fontWeight: "bold" }}>
                        S/ {saldoPendiente.toFixed(2)}
                      </Typography>
                    </Box>
                  );
                })()}
              </Box>
            </>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setModalPagoPresupuesto(false)} sx={{ color: "#666" }}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            disabled={Number(montoPago) <= 0}
            onClick={async () => {
              if (presupuestoParaPago && Number(montoPago) > 0) {
                await registrarPagoPresupuesto(presupuestoParaPago.id, Number(montoPago), metodoPago, tipoPago);
                setModalPagoPresupuesto(false);
              }
            }}
            sx={{
              backgroundColor: "#4caf50",
              "&:hover": { backgroundColor: "#388e3c" },
            }}
          >
            {tipoPago === 'adelanto' ? 'Registrar Adelanto' : tipoPago === 'saldo' ? 'Pagar Saldo' : 'Confirmar Pago'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Modal para Registrar Pago de Paquete */}
      <Dialog open={modalPagoPaquete} onClose={() => setModalPagoPaquete(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ backgroundColor: "#1565c0", color: "white" }}>
          💰 Registrar Pago de Paquete
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          {paqueteParaPago && (
            <>
              <Typography variant="body2" sx={{ mb: 2, color: "#666" }}>
                {paqueteParaPago.paquete_nombre}
              </Typography>
              
              {/* Tipo de Pago */}
              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel>Tipo de Pago</InputLabel>
                <Select
                  value={tipoPago}
                  onChange={(e) => {
                    setTipoPago(e.target.value);
                    if (e.target.value === 'total') {
                      const saldo = (paqueteParaPago.precio_total || 0) - (paqueteParaPago.monto_pagado || 0);
                      setMontoPago(saldo > 0 ? saldo : paqueteParaPago.precio_total);
                    } else if (e.target.value === 'saldo') {
                      setMontoPago(Math.max(0, (Number(paqueteParaPago.precio_total) || 0) - (Number(paqueteParaPago.monto_pagado) || 0)));
                    }
                  }}
                  label="Tipo de Pago"
                >
                  <MenuItem value="total">💵 Pago Total</MenuItem>
                  <MenuItem value="adelanto">📝 Adelanto</MenuItem>
                  {(Math.max(0, (Number(paqueteParaPago.precio_total) || 0) - (Number(paqueteParaPago.monto_pagado) || 0)) > 0 || paqueteParaPago.estado_pago === 'adelanto') && (
                    <MenuItem value="saldo">✅ Pagar Saldo Restante</MenuItem>
                  )}
                </Select>
              </FormControl>

              <TextField
                fullWidth
                label="Monto a pagar (S/)"
                type="number"
                value={montoPago}
                onChange={(e) => setMontoPago(e.target.value)}
                inputProps={{ min: 0, step: 0.01 }}
                sx={{ mb: 2 }}
              />
              
              <FormControl fullWidth>
                <InputLabel>Método de Pago</InputLabel>
                <Select
                  value={metodoPago}
                  onChange={(e) => setMetodoPago(e.target.value)}
                  label="Método de Pago"
                >
                  <MenuItem value="efectivo">Efectivo</MenuItem>
                  <MenuItem value="tarjeta">Tarjeta</MenuItem>
                  <MenuItem value="transferencia">Transferencia</MenuItem>
                  <MenuItem value="yape">Yape</MenuItem>
                  <MenuItem value="plin">Plin</MenuItem>
                </Select>
              </FormControl>
              
              {/* Resumen de pago */}
              <Box sx={{ mt: 2, p: 1.5, backgroundColor: "rgba(33, 150, 243, 0.1)", borderRadius: 2 }}>
                <Box sx={{ display: "flex", justifyContent: "space-between", mb: 1 }}>
                  <Typography variant="body2" color="text.secondary">Total del paquete:</Typography>
                  <Typography sx={{ fontWeight: "bold" }}>S/ {paqueteParaPago.precio_total?.toFixed(2)}</Typography>
                </Box>
                {(paqueteParaPago.monto_pagado > 0) && (
                  <Box sx={{ display: "flex", justifyContent: "space-between", mb: 1 }}>
                    <Typography variant="body2" color="text.secondary">Ya pagado:</Typography>
                    <Typography sx={{ color: "#4caf50", fontWeight: "bold" }}>S/ {(paqueteParaPago.monto_pagado || 0).toFixed(2)}</Typography>
                  </Box>
                )}
                {(Math.max(0, (Number(paqueteParaPago.precio_total) || 0) - (Number(paqueteParaPago.monto_pagado) || 0)) > 0) && (
                  <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                    <Typography variant="body2" color="text.secondary">Saldo pendiente:</Typography>
                    <Typography sx={{ color: "#f57c00", fontWeight: "bold" }}>
                      S/ {Math.max(0, (Number(paqueteParaPago.precio_total) || 0) - (Number(paqueteParaPago.monto_pagado) || 0)).toFixed(2)}
                    </Typography>
                  </Box>
                )}
              </Box>
            </>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setModalPagoPaquete(false)} sx={{ color: "#666" }}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            disabled={Number(montoPago) <= 0}
            onClick={async () => {
              if (paqueteParaPago && Number(montoPago) > 0) {
                await registrarPagoPaquete(paqueteParaPago.id, Number(montoPago), metodoPago, tipoPago);
                setModalPagoPaquete(false);
              }
            }}
            sx={{
              backgroundColor: "#1565c0",
              "&:hover": { backgroundColor: "#0d47a1" },
            }}
          >
            {tipoPago === 'adelanto' ? 'Registrar Adelanto' : tipoPago === 'saldo' ? 'Pagar Saldo' : 'Confirmar Pago'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Modal para Registrar Pago de Consulta */}
      <Dialog open={modalPagoConsulta} onClose={() => setModalPagoConsulta(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ backgroundColor: "#9c27b0", color: "white" }}>
          💊 Pagar Consulta
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          {paqueteParaConsulta && (
            <>
              <Typography variant="body2" sx={{ mb: 2, color: "#666" }}>
                {paqueteParaConsulta.paquete_nombre}
              </Typography>
              
              <Typography variant="body2" sx={{ mb: 2, p: 1.5, backgroundColor: "rgba(156, 39, 176, 0.1)", borderRadius: 2, color: "#7b1fa2" }}>
                ℹ️ El monto de la consulta se descontará automáticamente del precio total del paquete.
              </Typography>

              <TextField
                fullWidth
                label="Monto de Consulta (S/)"
                type="number"
                value={montoConsulta}
                onChange={(e) => setMontoConsulta(e.target.value)}
                inputProps={{ min: 0, step: 0.01 }}
                sx={{ mb: 2 }}
                helperText="Ingrese el monto que el paciente pagó por la consulta"
              />
              
              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel>Método de Pago</InputLabel>
                <Select
                  value={metodoPagoConsulta}
                  onChange={(e) => setMetodoPagoConsulta(e.target.value)}
                  label="Método de Pago"
                >
                  <MenuItem value="efectivo">Efectivo</MenuItem>
                  <MenuItem value="tarjeta">Tarjeta</MenuItem>
                  <MenuItem value="transferencia">Transferencia</MenuItem>
                  <MenuItem value="yape">Yape</MenuItem>
                  <MenuItem value="plin">Plin</MenuItem>
                </Select>
              </FormControl>
              
              {/* Resumen de descuento */}
              <Box sx={{ p: 1.5, backgroundColor: "rgba(156, 39, 176, 0.1)", borderRadius: 2 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: "bold", color: "#7b1fa2", mb: 1 }}>
                  📊 Resumen del Descuento
                </Typography>
                <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
                  <Typography variant="body2" color="text.secondary">Precio original del paquete:</Typography>
                  <Typography sx={{ fontWeight: "bold" }}>S/ {paqueteParaConsulta.precio_total?.toFixed(2)}</Typography>
                </Box>
                <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
                  <Typography variant="body2" color="text.secondary">Monto de consulta:</Typography>
                  <Typography sx={{ color: "#9c27b0", fontWeight: "bold" }}>- S/ {Number(montoConsulta).toFixed(2)}</Typography>
                </Box>
                <Divider sx={{ my: 1 }} />
                <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                  <Typography variant="body2" sx={{ fontWeight: "bold" }}>Nuevo precio del paquete:</Typography>
                  <Typography sx={{ color: "#4caf50", fontWeight: "bold", fontSize: "1.1rem" }}>
                    S/ {(paqueteParaConsulta.precio_total - Number(montoConsulta)).toFixed(2)}
                  </Typography>
                </Box>
              </Box>
            </>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setModalPagoConsulta(false)} sx={{ color: "#666" }}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            disabled={Number(montoConsulta) <= 0 || (paqueteParaConsulta && Number(montoConsulta) > paqueteParaConsulta.precio_total)}
            onClick={async () => {
              if (paqueteParaConsulta && Number(montoConsulta) > 0) {
                await registrarPagoConsulta(paqueteParaConsulta.id, Number(montoConsulta), metodoPagoConsulta);
                setModalPagoConsulta(false);
              }
            }}
            sx={{
              backgroundColor: "#9c27b0",
              "&:hover": { backgroundColor: "#7b1fa2" },
            }}
          >
            Confirmar Pago de Consulta
          </Button>
        </DialogActions>
      </Dialog>

      {/* Modal para Registrar Pago de Consulta en Presupuesto */}
      <Dialog open={modalPagoConsultaPresupuesto} onClose={() => setModalPagoConsultaPresupuesto(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ backgroundColor: "#9c27b0", color: "white" }}>
          💊 Pagar Consulta
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          {presupuestoParaConsulta && (
            <>
              <Typography variant="body2" sx={{ mb: 2, color: "#666" }}>
                Presupuesto del paciente
              </Typography>
              
              <Typography variant="body2" sx={{ mb: 2, p: 1.5, backgroundColor: "rgba(156, 39, 176, 0.1)", borderRadius: 2, color: "#7b1fa2" }}>
                ℹ️ El monto de la consulta se sumará al descuento del presupuesto.
              </Typography>

              <TextField
                fullWidth
                label="Monto de Consulta (S/)"
                type="number"
                value={montoConsultaPresupuesto}
                onChange={(e) => setMontoConsultaPresupuesto(e.target.value)}
                inputProps={{ min: 0, step: 0.01 }}
                sx={{ mb: 2 }}
                helperText="Ingrese el monto que el paciente pagó por la consulta"
              />
              
              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel>Método de Pago</InputLabel>
                <Select
                  value={metodoPagoConsultaPresupuesto}
                  onChange={(e) => setMetodoPagoConsultaPresupuesto(e.target.value)}
                  label="Método de Pago"
                >
                  <MenuItem value="efectivo">Efectivo</MenuItem>
                  <MenuItem value="tarjeta">Tarjeta</MenuItem>
                  <MenuItem value="transferencia">Transferencia</MenuItem>
                  <MenuItem value="yape">Yape</MenuItem>
                  <MenuItem value="plin">Plin</MenuItem>
                </Select>
              </FormControl>
              
              {/* Resumen de descuento */}
              <Box sx={{ p: 1.5, backgroundColor: "rgba(156, 39, 176, 0.1)", borderRadius: 2 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: "bold", color: "#7b1fa2", mb: 1 }}>
                  📊 Resumen del Descuento
                </Typography>
                <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
                  <Typography variant="body2" color="text.secondary">Subtotal:</Typography>
                  <Typography sx={{ fontWeight: "bold" }}>S/ {presupuestoParaConsulta.precio_total?.toFixed(2)}</Typography>
                </Box>
                <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
                  <Typography variant="body2" color="text.secondary">Descuento anterior:</Typography>
                  <Typography sx={{ color: "#f57c00", fontWeight: "bold" }}>- S/ {(presupuestoParaConsulta.descuento || 0).toFixed(2)}</Typography>
                </Box>
                <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
                  <Typography variant="body2" color="text.secondary">Consulta:</Typography>
                  <Typography sx={{ color: "#9c27b0", fontWeight: "bold" }}>- S/ {Number(montoConsultaPresupuesto).toFixed(2)}</Typography>
                </Box>
                <Divider sx={{ my: 1 }} />
                <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                  <Typography variant="body2" sx={{ fontWeight: "bold" }}>Total a pagar:</Typography>
                  <Typography sx={{ color: "#4caf50", fontWeight: "bold", fontSize: "1.1rem" }}>
                    S/ {(presupuestoParaConsulta.precio_total - (presupuestoParaConsulta.descuento || 0) - Number(montoConsultaPresupuesto)).toFixed(2)}
                  </Typography>
                </Box>
              </Box>
            </>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setModalPagoConsultaPresupuesto(false)} sx={{ color: "#666" }}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            disabled={Number(montoConsultaPresupuesto) <= 0 || (presupuestoParaConsulta && (Number(montoConsultaPresupuesto) + (presupuestoParaConsulta.descuento || 0)) > presupuestoParaConsulta.precio_total)}
            onClick={async () => {
              if (presupuestoParaConsulta && Number(montoConsultaPresupuesto) > 0) {
                await registrarPagoConsultaPresupuesto(presupuestoParaConsulta.id, Number(montoConsultaPresupuesto), metodoPagoConsultaPresupuesto);
                setModalPagoConsultaPresupuesto(false);
              }
            }}
            sx={{
              backgroundColor: "#9c27b0",
              "&:hover": { backgroundColor: "#7b1fa2" },
            }}
          >
            Confirmar Pago de Consulta
          </Button>
        </DialogActions>
      </Dialog>

      {/* Modal Global de Pagar Consulta (desde barra superior) */}
      <Dialog open={modalPagoConsultaGlobal} onClose={() => setModalPagoConsultaGlobal(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ backgroundColor: "#9c27b0", color: "white" }}>
          💊 Pagar Consulta
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          {pacienteSeleccionado && (
            <>
              <Typography variant="body2" sx={{ mb: 2, color: "#666" }}>
                Paciente: <strong>{pacienteSeleccionado.nombre} {pacienteSeleccionado.apellido}</strong>
              </Typography>

              {/* Info automática: dónde se aplicará */}
              {consultaGlobalSeleccion && consultaGlobalSeleccion.tipo !== 'directo' && (
                <Box sx={{ p: 1.5, mb: 2, borderRadius: 2, backgroundColor: "rgba(76, 175, 80, 0.08)", border: "1px solid rgba(76, 175, 80, 0.3)" }}>
                  <Typography variant="body2" sx={{ fontWeight: "bold", color: "#2e7d32", mb: 0.5 }}>
                    ✓ Se descontará automáticamente de:
                  </Typography>
                  <Typography variant="body2" sx={{ color: "#2e7d32" }}>
                    {consultaGlobalSeleccion.tipo === 'paquete' 
                      ? `📦 Paquete: ${consultaGlobalSeleccion.item?.paquete_nombre || 'Paquete'}`
                      : `📋 Presupuesto #${consultaGlobalSeleccion.item?.id}`
                    }
                    {' — '}S/ {(consultaGlobalSeleccion.item?.precio_total || 0).toFixed(2)}
                    {consultaGlobalSeleccion.tipo === 'presupuesto' && (consultaGlobalSeleccion.item?.descuento || 0) > 0 
                      ? ` (Desc: S/ ${(consultaGlobalSeleccion.item.descuento || 0).toFixed(2)})` 
                      : ''}
                  </Typography>
                </Box>
              )}

              {consultaGlobalSeleccion?.tipo === 'directo' && (
                <Box sx={{ p: 1.5, mb: 2, borderRadius: 2, backgroundColor: "rgba(156, 39, 176, 0.08)", border: "1px solid rgba(156, 39, 176, 0.3)" }}>
                  <Typography variant="body2" sx={{ color: "#7b1fa2" }}>
                    💰 No hay presupuestos ni paquetes pendientes. Se registrará como ingreso directo en caja.
                  </Typography>
                </Box>
              )}

              {/* Si hay múltiples opciones, mostrar selector compacto */}
              {(() => {
                const presPend = presupuestosAsignados.filter(p => p.consulta_pagada !== 1 && p.estado_pago !== 'pagado' && p.pagado !== 1);
                const paqPend = paquetesPaciente.filter(p => p.consulta_pagada !== 1 && p.estado_pago !== 'pagado' && p.pagado !== 1);
                const totalOpciones = presPend.length + paqPend.length;
                if (totalOpciones <= 1) return null;
                return (
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="caption" sx={{ color: "#666", mb: 1, display: "block" }}>
                      Hay {totalOpciones} opciones disponibles. Selecciona dónde descontar:
                    </Typography>
                    {paqPend.map(paq => (
                      <Box
                        key={`paq-${paq.id}`}
                        onClick={() => setConsultaGlobalSeleccion({ tipo: 'paquete', item: paq })}
                        sx={{
                          p: 1, mb: 0.5, borderRadius: 1.5, cursor: "pointer",
                          border: consultaGlobalSeleccion?.tipo === 'paquete' && consultaGlobalSeleccion?.item?.id === paq.id
                            ? "2px solid #9c27b0" : "1px solid #e0e0e0",
                          backgroundColor: consultaGlobalSeleccion?.tipo === 'paquete' && consultaGlobalSeleccion?.item?.id === paq.id
                            ? "rgba(156, 39, 176, 0.08)" : "transparent",
                          "&:hover": { backgroundColor: "rgba(156, 39, 176, 0.04)" },
                        }}
                      >
                        <Typography variant="body2" sx={{ fontWeight: "bold", fontSize: "0.85rem" }}>
                          📦 {paq.paquete_nombre} — S/ {(paq.precio_total || 0).toFixed(2)}
                        </Typography>
                      </Box>
                    ))}
                    {presPend.map(pres => (
                      <Box
                        key={`pres-${pres.id}`}
                        onClick={() => setConsultaGlobalSeleccion({ tipo: 'presupuesto', item: pres })}
                        sx={{
                          p: 1, mb: 0.5, borderRadius: 1.5, cursor: "pointer",
                          border: consultaGlobalSeleccion?.tipo === 'presupuesto' && consultaGlobalSeleccion?.item?.id === pres.id
                            ? "2px solid #9c27b0" : "1px solid #e0e0e0",
                          backgroundColor: consultaGlobalSeleccion?.tipo === 'presupuesto' && consultaGlobalSeleccion?.item?.id === pres.id
                            ? "rgba(156, 39, 176, 0.08)" : "transparent",
                          "&:hover": { backgroundColor: "rgba(156, 39, 176, 0.04)" },
                        }}
                      >
                        <Typography variant="body2" sx={{ fontWeight: "bold", fontSize: "0.85rem" }}>
                          📋 Presupuesto #{pres.id} — S/ {(pres.precio_total || 0).toFixed(2)}
                        </Typography>
                      </Box>
                    ))}
                    <Box
                      onClick={() => setConsultaGlobalSeleccion({ tipo: 'directo', item: null })}
                      sx={{
                        p: 1, mb: 0.5, borderRadius: 1.5, cursor: "pointer",
                        border: consultaGlobalSeleccion?.tipo === 'directo'
                          ? "2px solid #9c27b0" : "1px solid #e0e0e0",
                        backgroundColor: consultaGlobalSeleccion?.tipo === 'directo'
                          ? "rgba(156, 39, 176, 0.08)" : "transparent",
                        "&:hover": { backgroundColor: "rgba(156, 39, 176, 0.04)" },
                      }}
                    >
                      <Typography variant="body2" sx={{ fontWeight: "bold", fontSize: "0.85rem" }}>
                        💰 Pago directo (sin descontar)
                      </Typography>
                    </Box>
                  </Box>
                );
              })()}

              <TextField
                fullWidth
                label="Monto de Consulta (S/)"
                type="number"
                value={montoConsultaGlobal}
                onChange={(e) => setMontoConsultaGlobal(e.target.value)}
                inputProps={{ min: 0, step: 0.01 }}
                sx={{ mb: 2 }}
              />

              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel>Método de Pago</InputLabel>
                <Select
                  value={metodoPagoConsultaGlobal}
                  onChange={(e) => setMetodoPagoConsultaGlobal(e.target.value)}
                  label="Método de Pago"
                >
                  <MenuItem value="efectivo">Efectivo</MenuItem>
                  <MenuItem value="tarjeta">Tarjeta</MenuItem>
                  <MenuItem value="transferencia">Transferencia</MenuItem>
                  <MenuItem value="yape">Yape</MenuItem>
                  <MenuItem value="plin">Plin</MenuItem>
                </Select>
              </FormControl>

              {/* Resumen visual */}
              {consultaGlobalSeleccion && consultaGlobalSeleccion.tipo !== 'directo' && (
                <Box sx={{ p: 1.5, backgroundColor: "rgba(156, 39, 176, 0.08)", borderRadius: 2 }}>
                  <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
                    <Typography variant="body2" color="text.secondary">Precio actual:</Typography>
                    <Typography sx={{ fontWeight: "bold" }}>
                      S/ {(
                        (consultaGlobalSeleccion.item?.precio_total || 0)
                        - (consultaGlobalSeleccion.tipo === 'presupuesto' ? (consultaGlobalSeleccion.item?.descuento || 0) : 0)
                      ).toFixed(2)}
                    </Typography>
                  </Box>
                  <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
                    <Typography variant="body2" color="text.secondary">Consulta:</Typography>
                    <Typography sx={{ color: "#9c27b0", fontWeight: "bold" }}>- S/ {Number(montoConsultaGlobal || 0).toFixed(2)}</Typography>
                  </Box>
                  <Divider sx={{ my: 0.5 }} />
                  <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                    <Typography variant="body2" sx={{ fontWeight: "bold" }}>Nuevo saldo a pagar:</Typography>
                    <Typography sx={{ color: "#4caf50", fontWeight: "bold", fontSize: "1.1rem" }}>
                      S/ {Math.max(0,
                        (consultaGlobalSeleccion.item?.precio_total || 0)
                        - (consultaGlobalSeleccion.tipo === 'presupuesto' ? (consultaGlobalSeleccion.item?.descuento || 0) : 0)
                        - (consultaGlobalSeleccion.item?.monto_pagado || 0)
                        - Number(montoConsultaGlobal || 0)
                      ).toFixed(2)}
                    </Typography>
                  </Box>
                </Box>
              )}
            </>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setModalPagoConsultaGlobal(false)} sx={{ color: "#666" }}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            disabled={!consultaGlobalSeleccion || Number(montoConsultaGlobal) <= 0}
            onClick={async () => {
              if (!consultaGlobalSeleccion || Number(montoConsultaGlobal) <= 0) return;
              try {
                if (consultaGlobalSeleccion.tipo === 'directo') {
                  await axios.post(`${API_BASE_URL}/api/finanzas/consulta-directa`, {
                    paciente_id: pacienteSeleccionado.id,
                    monto: Number(montoConsultaGlobal),
                    metodo_pago: metodoPagoConsultaGlobal,
                  }, { headers: authHeaders });
                  showToast({ severity: "success", message: "Pago de consulta registrado en caja" });
                } else if (consultaGlobalSeleccion.tipo === 'paquete') {
                  await registrarPagoConsulta(consultaGlobalSeleccion.item.id, Number(montoConsultaGlobal), metodoPagoConsultaGlobal);
                } else {
                  await registrarPagoConsultaPresupuesto(consultaGlobalSeleccion.item.id, Number(montoConsultaGlobal), metodoPagoConsultaGlobal);
                }
                setModalPagoConsultaGlobal(false);
              } catch (e) {
                if (consultaGlobalSeleccion.tipo === 'directo') {
                  console.error(e);
                  showToast({ severity: "error", message: "Error al registrar pago de consulta" });
                }
              }
            }}
            sx={{
              backgroundColor: "#9c27b0",
              "&:hover": { backgroundColor: "#7b1fa2" },
            }}
          >
            Confirmar Pago
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog confirmar eliminar paciente completo (solo master) */}
      <Dialog
        open={openConfirmarEliminarPaciente}
        onClose={() => {
          setOpenConfirmarEliminarPaciente(false);
          setPacienteEliminar(null);
        }}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ color: "#d32f2f", fontWeight: 700 }}>
          Eliminar Paciente Completo
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: 1 }}>
            ¿Estás seguro de que deseas eliminar permanentemente al paciente{" "}
            <strong>{pacienteEliminar?.nombre} {pacienteEliminar?.apellido}</strong>?
          </Typography>
          <Typography variant="body2" sx={{ color: "#d32f2f", fontWeight: 600 }}>
            Esta acción eliminará todos sus datos: tratamientos, deudas, pagos, observaciones, ofertas, paquetes y presupuestos. No se puede deshacer.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button
            onClick={() => {
              setOpenConfirmarEliminarPaciente(false);
              setPacienteEliminar(null);
            }}
            sx={{ color: "#666" }}
          >
            Cancelar
          </Button>
          <Button
            variant="contained"
            onClick={handleEliminarPaciente}
            sx={{
              backgroundColor: "#d32f2f",
              "&:hover": { backgroundColor: "#b71c1c" },
            }}
          >
            Eliminar Permanentemente
          </Button>
        </DialogActions>
      </Dialog>

      {/* Modal para Editar Pago de Presupuesto (solo master) */}
      <Dialog open={modalEditarPagoPresupuesto} onClose={() => setModalEditarPagoPresupuesto(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ color: "#1565c0", fontWeight: "bold" }}>
          ✏️ Editar Pago de Presupuesto
        </DialogTitle>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: "16px !important" }}>
          {presupuestoEditarPago && (
            <Box>
              <Typography variant="body2" sx={{ color: "#555", mb: 1 }}>
                <strong>Precio total:</strong> S/ {Number(presupuestoEditarPago.precio_total || 0).toFixed(2)}
                {presupuestoEditarPago.descuento > 0 && (
                  <> (Descuento: S/ {Number(presupuestoEditarPago.descuento || 0).toFixed(2)})</>
                )}
              </Typography>
              <Typography variant="body2" sx={{ color: "#555", mb: 1 }}>
                <strong>Monto pagado actual:</strong> S/ {Number(presupuestoEditarPago.monto_pagado || 0).toFixed(2)}
              </Typography>
              <Typography variant="body2" sx={{ color: "#f57c00", mb: 1 }}>
                <strong>Saldo pendiente:</strong> S/ {Math.max(0, (Number(presupuestoEditarPago.precio_total) || 0) - (Number(presupuestoEditarPago.descuento) || 0) - (Number(presupuestoEditarPago.monto_pagado) || 0)).toFixed(2)}
              </Typography>
            </Box>
          )}
          <TextField
            label="Nuevo monto pagado (S/)"
            type="number"
            fullWidth
            value={nuevoMontoPagadoPresupuesto}
            onChange={(e) => setNuevoMontoPagadoPresupuesto(e.target.value)}
            inputProps={{ min: 0, step: 0.01 }}
            helperText="Ingresa el monto total que el paciente ha pagado realmente"
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setModalEditarPagoPresupuesto(false)} sx={{ color: "#666" }}>Cancelar</Button>
          <Button
            variant="contained"
            onClick={guardarEditarPagoPresupuesto}
            disabled={guardandoEditPago}
            sx={{ backgroundColor: "#1565c0", "&:hover": { backgroundColor: "#0d47a1" } }}
          >
            {guardandoEditPago ? "Guardando..." : "Guardar Cambio"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Modal para Editar Pago de Paquete (solo master) */}
      <Dialog open={modalEditarPagoPaquete} onClose={() => setModalEditarPagoPaquete(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ color: "#1565c0", fontWeight: "bold" }}>
          ✏️ Editar Pago de Paquete
        </DialogTitle>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: "16px !important" }}>
          {paqueteEditarPago && (
            <Box>
              <Typography variant="body2" sx={{ color: "#555", mb: 1 }}>
                <strong>Precio total:</strong> S/ {Number(paqueteEditarPago.precio_total || 0).toFixed(2)}
              </Typography>
              <Typography variant="body2" sx={{ color: "#555", mb: 1 }}>
                <strong>Monto pagado actual:</strong> S/ {Number(paqueteEditarPago.monto_pagado || 0).toFixed(2)}
              </Typography>
              <Typography variant="body2" sx={{ color: "#f57c00", mb: 1 }}>
                <strong>Saldo pendiente:</strong> S/ {((paqueteEditarPago.precio_total || 0) - (paqueteEditarPago.monto_pagado || 0)).toFixed(2)}
              </Typography>
            </Box>
          )}
          <TextField
            label="Nuevo monto pagado (S/)"
            type="number"
            fullWidth
            value={nuevoMontoPagadoPaquete}
            onChange={(e) => setNuevoMontoPagadoPaquete(e.target.value)}
            inputProps={{ min: 0, step: 0.01 }}
            helperText="Ingresa el monto total que el paciente ha pagado realmente"
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setModalEditarPagoPaquete(false)} sx={{ color: "#666" }}>Cancelar</Button>
          <Button
            variant="contained"
            onClick={guardarEditarPagoPaquete}
            disabled={guardandoEditPagoPaquete}
            sx={{ backgroundColor: "#1565c0", "&:hover": { backgroundColor: "#0d47a1" } }}
          >
            {guardandoEditPagoPaquete ? "Guardando..." : "Guardar Cambio"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Modal Presupuesto Corporal */}
      <Dialog
        open={modalCorporal}
        onClose={() => setModalCorporal(false)}
        maxWidth="lg"
        fullWidth
        PaperProps={{ sx: { borderRadius: 4, minHeight: "70vh" } }}
      >
        <DialogTitle sx={{
          backgroundColor: "#a36920",
          color: "white",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          py: 1.5,
        }}>
          <Typography variant="h6" sx={{ fontWeight: "bold" }}>
            🏋️ Presupuesto Corporal — {pacienteSeleccionado?.nombre} {pacienteSeleccionado?.apellido}
          </Typography>
          <IconButton onClick={() => setModalCorporal(false)} sx={{ color: "white" }}>
            <Close />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ p: 3, backgroundColor: "#fffdf7" }}>
          {/* Tabs Evaluación / Tratamiento */}
          <Box sx={{ display: "flex", gap: 1, mb: 3, mt: 1 }}>
            <Button
              variant={corporalTipo === "evaluacion" ? "contained" : "outlined"}
              onClick={() => setCorporalTipo("evaluacion")}
              sx={{
                backgroundColor: corporalTipo === "evaluacion" ? "#a36920" : "transparent",
                color: corporalTipo === "evaluacion" ? "white" : "#a36920",
                borderColor: "#a36920",
                fontWeight: "bold",
                borderRadius: 3,
                px: 4,
                "&:hover": {
                  backgroundColor: corporalTipo === "evaluacion" ? "#8a5a1a" : "rgba(163,105,32,0.08)",
                  borderColor: "#a36920",
                },
              }}
            >
              📋 Evaluación
            </Button>
            <Button
              variant={corporalTipo === "tratamiento" ? "contained" : "outlined"}
              onClick={() => setCorporalTipo("tratamiento")}
              sx={{
                backgroundColor: corporalTipo === "tratamiento" ? "#ba9a63" : "transparent",
                color: corporalTipo === "tratamiento" ? "white" : "#ba9a63",
                borderColor: "#ba9a63",
                fontWeight: "bold",
                borderRadius: 3,
                px: 4,
                "&:hover": {
                  backgroundColor: corporalTipo === "tratamiento" ? "#a36920" : "rgba(186,154,99,0.08)",
                  borderColor: "#ba9a63",
                },
              }}
            >
              💉 Tratamiento
            </Button>
          </Box>

          {/* Tablas de mediciones */}
          {corporalTablas.map((tabla, tIdx) => (
            <Paper key={tIdx} elevation={1} sx={{ mb: 3, borderRadius: 3, overflow: "hidden", border: "1px solid #e0e0e0" }}>
              <Box sx={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                px: 2, py: 1.5,
                backgroundColor: corporalTipo === "evaluacion" ? "#f5f1e4" : "#f5f1e4",
                borderBottom: "1px solid #ba9a63",
              }}>
                <TextField
                  variant="standard"
                  value={tabla.titulo}
                  onChange={(e) => {
                    const nuevo = JSON.parse(JSON.stringify(corporalTablas));
                    nuevo[tIdx].titulo = e.target.value;
                    setCorporalTablas(nuevo);
                  }}
                  InputProps={{ disableUnderline: true, sx: { fontWeight: "bold", fontSize: "1rem", color: "#a36920" } }}
                  placeholder="Título de la tabla"
                />
                <Box sx={{ display: "flex", gap: 0.5 }}>
                  {corporalTablas.length > 1 && (
                    <IconButton
                      size="small"
                      onClick={() => setCorporalTablas(prev => prev.filter((_, i) => i !== tIdx))}
                      sx={{ color: "#f44336" }}
                    >
                      <Delete fontSize="small" />
                    </IconButton>
                  )}
                </Box>
              </Box>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ backgroundColor: "#f5f5f5" }}>
                      <TableCell sx={{ fontWeight: "bold", color: "#a36920", fontSize: "0.8rem", minWidth: 80 }}>Cintura</TableCell>
                      <TableCell sx={{ fontWeight: "bold", color: "#a36920", fontSize: "0.8rem", minWidth: 80 }}>Cadera</TableCell>
                      <TableCell sx={{ fontWeight: "bold", color: "#a36920", fontSize: "0.8rem", minWidth: 80 }}>Muslos</TableCell>
                      <TableCell sx={{ fontWeight: "bold", color: "#a36920", fontSize: "0.8rem", minWidth: 80 }}>Glúteos</TableCell>
                      <TableCell sx={{ fontWeight: "bold", color: "#a36920", fontSize: "0.8rem", minWidth: 80 }}>Brazos</TableCell>
                      <TableCell sx={{ fontWeight: "bold", color: "#a36920", fontSize: "0.8rem", minWidth: 80 }}>Abd. Alto</TableCell>
                      <TableCell sx={{ fontWeight: "bold", color: "#a36920", fontSize: "0.8rem", minWidth: 80 }}>Abd. Medio</TableCell>
                      <TableCell sx={{ fontWeight: "bold", color: "#a36920", fontSize: "0.8rem", minWidth: 80 }}>Abd. Bajo</TableCell>
                      <TableCell sx={{ fontWeight: "bold", color: "#a36920", fontSize: "0.8rem", minWidth: 100 }}>Sesión</TableCell>
                      <TableCell sx={{ fontWeight: "bold", color: "#a36920", fontSize: "0.8rem", minWidth: 120 }}>Datos</TableCell>
                      <TableCell sx={{ width: 40 }}></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {tabla.filas.map((fila, fIdx) => (
                      <TableRow key={fIdx} sx={{ "&:hover": { backgroundColor: "rgba(163,105,32,0.04)" } }}>
                        {["cintura", "cadera", "muslos", "gluteos", "brazos", "abdomen_alto", "abdomen_medio", "abdomen_bajo"].map((campo) => (
                          <TableCell key={campo} sx={{ p: 0.5 }}>
                            <TextField
                              variant="outlined"
                              size="small"
                              value={fila[campo] || ""}
                              onChange={(e) => {
                                const nuevo = JSON.parse(JSON.stringify(corporalTablas));
                                nuevo[tIdx].filas[fIdx][campo] = e.target.value;
                                setCorporalTablas(nuevo);
                              }}
                              placeholder="cm"
                              sx={{
                                "& .MuiOutlinedInput-root": {
                                  borderRadius: 2,
                                  backgroundColor: "white",
                                  fontSize: "0.85rem",
                                },
                              }}
                              inputProps={{ style: { padding: "6px 8px", textAlign: "center" } }}
                            />
                          </TableCell>
                        ))}
                        <TableCell sx={{ p: 0.5 }}>
                          <TextField
                            variant="outlined"
                            size="small"
                            value={fila.sesion || ""}
                            onChange={(e) => {
                              const nuevo = JSON.parse(JSON.stringify(corporalTablas));
                              nuevo[tIdx].filas[fIdx].sesion = e.target.value;
                              setCorporalTablas(nuevo);
                            }}
                            placeholder="Ej: 1ra sesión"
                            sx={{
                              "& .MuiOutlinedInput-root": {
                                borderRadius: 2,
                                backgroundColor: "white",
                                fontSize: "0.85rem",
                              },
                            }}
                            inputProps={{ style: { padding: "6px 8px" } }}
                          />
                        </TableCell>
                        <TableCell sx={{ p: 0.5 }}>
                          <TextField
                            variant="outlined"
                            size="small"
                            value={fila.datos || ""}
                            onChange={(e) => {
                              const nuevo = JSON.parse(JSON.stringify(corporalTablas));
                              nuevo[tIdx].filas[fIdx].datos = e.target.value;
                              setCorporalTablas(nuevo);
                            }}
                            placeholder="Datos adicionales"
                            sx={{
                              "& .MuiOutlinedInput-root": {
                                borderRadius: 2,
                                backgroundColor: "white",
                                fontSize: "0.85rem",
                              },
                            }}
                            inputProps={{ style: { padding: "6px 8px" } }}
                          />
                        </TableCell>
                        <TableCell sx={{ p: 0.5 }}>
                          {tabla.filas.length > 1 && (
                            <IconButton
                              size="small"
                              onClick={() => {
                                const nuevo = JSON.parse(JSON.stringify(corporalTablas));
                                nuevo[tIdx].filas = nuevo[tIdx].filas.filter((_, i) => i !== fIdx);
                                setCorporalTablas(nuevo);
                              }}
                              sx={{ color: "#bbb", "&:hover": { color: "#f44336" } }}
                            >
                              <Close fontSize="small" />
                            </IconButton>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
              <Box sx={{ p: 1, display: "flex", justifyContent: "center" }}>
                <Button
                  size="small"
                  onClick={() => {
                    const nuevo = JSON.parse(JSON.stringify(corporalTablas));
                    const numFila = nuevo[tIdx].filas.length + 1;
                    const sesionLabel = numFila === 1 ? "1ra sesión" : numFila === 2 ? "2da sesión" : numFila === 3 ? "3ra sesión" : `${numFila}ta sesión`;
                    nuevo[tIdx].filas.push({ cintura: "", cadera: "", muslos: "", gluteos: "", brazos: "", abdomen_alto: "", abdomen_medio: "", abdomen_bajo: "", sesion: sesionLabel, datos: "" });
                    setCorporalTablas(nuevo);
                  }}
                  sx={{ color: "#a36920", fontWeight: "bold", fontSize: "0.8rem" }}
                >
                  + Agregar fila
                </Button>
              </Box>
            </Paper>
          ))}

          <Button
            variant="outlined"
            onClick={() => {
              setCorporalTablas(prev => [...prev, {
                titulo: `Tabla ${prev.length + 1}`,
                filas: [{ cintura: "", cadera: "", muslos: "", gluteos: "", brazos: "", abdomen_alto: "", abdomen_medio: "", abdomen_bajo: "", sesion: "1ra sesión", datos: "" }]
              }]);
            }}
            sx={{
              borderColor: "#ba9a63",
              color: "#a36920",
              fontWeight: "bold",
              borderRadius: 3,
              mb: 3,
              "&:hover": { backgroundColor: "rgba(163,105,32,0.08)", borderColor: "#a36920" },
            }}
          >
            + Agregar nueva tabla
          </Button>

          {/* Actividad Física */}
          <Paper elevation={1} sx={{ p: 2.5, mb: 3, borderRadius: 3, border: "1px solid #e0e0e0" }}>
            <Typography variant="subtitle1" sx={{ fontWeight: "bold", color: "#a36920", mb: 1.5 }}>
              🏃 Actividad Física
            </Typography>
            <TextField
              fullWidth
              multiline
              rows={2}
              value={corporalActividad}
              onChange={(e) => setCorporalActividad(e.target.value)}
              placeholder="Describe la actividad física del paciente: tipo, frecuencia, duración..."
              sx={{
                "& .MuiOutlinedInput-root": {
                  borderRadius: 2,
                  backgroundColor: "white",
                },
              }}
            />
          </Paper>

          {/* Observaciones */}
          <Paper elevation={1} sx={{ p: 2.5, mb: 3, borderRadius: 3, border: "1px solid #e0e0e0" }}>
            <Typography variant="subtitle1" sx={{ fontWeight: "bold", color: "#a36920", mb: 1.5 }}>
              📝 Observaciones
            </Typography>
            <TextField
              fullWidth
              multiline
              rows={3}
              value={corporalObservaciones}
              onChange={(e) => setCorporalObservaciones(e.target.value)}
              placeholder="Observaciones generales sobre el estado corporal del paciente..."
              sx={{
                "& .MuiOutlinedInput-root": {
                  borderRadius: 2,
                  backgroundColor: "white",
                },
              }}
            />
          </Paper>

          {/* Botón Guardar */}
          <Box sx={{ display: "flex", justifyContent: "center", gap: 2, mb: 4 }}>
            {corporalEditId && (
              <Button
                variant="outlined"
                onClick={resetCorporalForm}
                sx={{ borderColor: "#999", color: "#666", borderRadius: 3, px: 4 }}
              >
                Cancelar edición
              </Button>
            )}
            <Button
              variant="contained"
              onClick={guardarCorporal}
              disabled={guardandoCorporal}
              sx={{
                backgroundColor: "#a36920",
                fontWeight: "bold",
                borderRadius: 3,
                px: 5,
                py: 1.2,
                fontSize: "1rem",
                "&:hover": { backgroundColor: "#8a5a1a" },
              }}
            >
              {guardandoCorporal ? "Guardando..." : corporalEditId ? "Actualizar Registro" : "Guardar Registro"}
            </Button>
          </Box>

          <Divider sx={{ mb: 3 }} />

          {/* Historial de registros corporales */}
          <Typography variant="h6" sx={{ fontWeight: "bold", color: "#555", mb: 2 }}>
            📄 Registros guardados
          </Typography>
          {corporalRegistros.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center", py: 3 }}>
              No hay registros corporales para este paciente
            </Typography>
          ) : (
            corporalRegistros.map((reg) => (
              <Paper
                key={reg.id}
                elevation={0}
                sx={{
                  mb: 2, p: 2, borderRadius: 3,
                  border: `1px solid ${reg.tipo === "evaluacion" ? "#ba9a63" : "#d4c5a0"}`,
                  backgroundColor: reg.tipo === "evaluacion" ? "#fffdf7" : "#f5f1e4",
                  cursor: "pointer",
                  transition: "all 0.2s",
                  "&:hover": { transform: "translateY(-1px)", boxShadow: "0 2px 8px rgba(0,0,0,0.1)" },
                }}
              >
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <Chip
                      label={reg.tipo === "evaluacion" ? "Evaluación" : "Tratamiento"}
                      size="small"
                      sx={{
                        backgroundColor: reg.tipo === "evaluacion" ? "#a36920" : "#ba9a63",
                        color: "white",
                        fontWeight: "bold",
                        fontSize: "0.75rem",
                      }}
                    />
                    <Typography variant="caption" color="text.secondary">
                      {reg.creado_en?.split(" ")[0]} | por {reg.creado_por || "sistema"}
                    </Typography>
                  </Box>
                  <Box sx={{ display: "flex", gap: 0.5 }}>
                    <IconButton size="small" onClick={() => editarCorporal(reg)} sx={{ color: "#a36920" }}>
                      <Edit fontSize="small" />
                    </IconButton>
                    <IconButton size="small" onClick={() => eliminarCorporal(reg.id)} sx={{ color: "#f44336" }}>
                      <Delete fontSize="small" />
                    </IconButton>
                  </Box>
                </Box>

                {/* Preview de tablas */}
                {(reg.tablas_json || []).map((t, ti) => (
                  <Box key={ti} sx={{ mb: 1 }}>
                    <Typography variant="caption" sx={{ fontWeight: "bold", color: "#777" }}>{t.titulo}:</Typography>
                    <TableContainer sx={{ mt: 0.5 }}>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell sx={{ fontWeight: "bold", fontSize: "0.7rem", p: 0.5, color: "#a36920" }}>Cintura</TableCell>
                            <TableCell sx={{ fontWeight: "bold", fontSize: "0.7rem", p: 0.5, color: "#a36920" }}>Cadera</TableCell>
                            <TableCell sx={{ fontWeight: "bold", fontSize: "0.7rem", p: 0.5, color: "#a36920" }}>Muslos</TableCell>
                            <TableCell sx={{ fontWeight: "bold", fontSize: "0.7rem", p: 0.5, color: "#a36920" }}>Glúteos</TableCell>
                            <TableCell sx={{ fontWeight: "bold", fontSize: "0.7rem", p: 0.5, color: "#a36920" }}>Brazos</TableCell>
                            <TableCell sx={{ fontWeight: "bold", fontSize: "0.7rem", p: 0.5, color: "#a36920" }}>Abd. Alto</TableCell>
                            <TableCell sx={{ fontWeight: "bold", fontSize: "0.7rem", p: 0.5, color: "#a36920" }}>Abd. Medio</TableCell>
                            <TableCell sx={{ fontWeight: "bold", fontSize: "0.7rem", p: 0.5, color: "#a36920" }}>Abd. Bajo</TableCell>
                            <TableCell sx={{ fontWeight: "bold", fontSize: "0.7rem", p: 0.5, color: "#a36920" }}>Sesión</TableCell>
                            <TableCell sx={{ fontWeight: "bold", fontSize: "0.7rem", p: 0.5, color: "#a36920" }}>Datos</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {(t.filas || []).map((f, fi) => (
                            <TableRow key={fi}>
                              <TableCell sx={{ fontSize: "0.75rem", p: 0.5 }}>{f.cintura || "-"}</TableCell>
                              <TableCell sx={{ fontSize: "0.75rem", p: 0.5 }}>{f.cadera || "-"}</TableCell>
                              <TableCell sx={{ fontSize: "0.75rem", p: 0.5 }}>{f.muslos || "-"}</TableCell>
                              <TableCell sx={{ fontSize: "0.75rem", p: 0.5 }}>{f.gluteos || "-"}</TableCell>
                              <TableCell sx={{ fontSize: "0.75rem", p: 0.5 }}>{f.brazos || "-"}</TableCell>
                              <TableCell sx={{ fontSize: "0.75rem", p: 0.5 }}>{f.abdomen_alto || "-"}</TableCell>
                              <TableCell sx={{ fontSize: "0.75rem", p: 0.5 }}>{f.abdomen_medio || "-"}</TableCell>
                              <TableCell sx={{ fontSize: "0.75rem", p: 0.5 }}>{f.abdomen_bajo || "-"}</TableCell>
                              <TableCell sx={{ fontSize: "0.75rem", p: 0.5 }}>{f.sesion || "-"}</TableCell>
                              <TableCell sx={{ fontSize: "0.75rem", p: 0.5 }}>{f.datos || "-"}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Box>
                ))}

                {reg.actividad_fisica && (
                  <Typography variant="caption" sx={{ display: "block", mt: 1, color: "#555" }}>
                    <strong>🏃 Actividad:</strong> {reg.actividad_fisica}
                  </Typography>
                )}
                {reg.observaciones && (
                  <Typography variant="caption" sx={{ display: "block", mt: 0.5, color: "#555" }}>
                    <strong>📝 Observaciones:</strong> {reg.observaciones}
                  </Typography>
                )}
              </Paper>
            ))
          )}
        </DialogContent>
      </Dialog>

      {/* Modal Carrusel de Imágenes del Tratamiento */}
      <Dialog
        open={modalCarrusel}
        onClose={() => setModalCarrusel(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 4,
            overflow: "hidden",
            backgroundColor: "#1a1a1a",
          },
        }}
      >
        <DialogTitle
          sx={{
            backgroundColor: "#a36920",
            color: "white",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            py: 1.5,
          }}
        >
          <Typography variant="h6" sx={{ fontWeight: "bold" }}>
            📸 {carruselNombre}
          </Typography>
          <IconButton onClick={() => setModalCarrusel(false)} sx={{ color: "white" }}>
            <Close />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ p: 0, position: "relative", backgroundColor: "#1a1a1a" }}>
          {carruselImagenes.length > 0 && (
            <Box sx={{ position: "relative", width: "100%", display: "flex", alignItems: "center", justifyContent: "center", minHeight: 400 }}>
              {/* Flecha izquierda */}
              {carruselImagenes.length > 1 && (
                <IconButton
                  onClick={() => setCarruselIdx((prev) => (prev - 1 + carruselImagenes.length) % carruselImagenes.length)}
                  sx={{
                    position: "absolute",
                    left: 8,
                    zIndex: 2,
                    backgroundColor: "rgba(255,255,255,0.15)",
                    color: "white",
                    "&:hover": { backgroundColor: "rgba(255,255,255,0.3)" },
                    width: 44,
                    height: 44,
                  }}
                >
                  <Typography sx={{ fontSize: 24, fontWeight: "bold" }}>‹</Typography>
                </IconButton>
              )}

              {/* Imagen */}
              <Box
                sx={{
                  width: "100%",
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  py: 2,
                  px: 6,
                }}
              >
                <img
                  src={`${API_BASE_URL}${carruselImagenes[carruselIdx]?.imagen_url}`}
                  alt={`${carruselNombre} ${carruselIdx + 1}`}
                  style={{
                    maxWidth: "100%",
                    maxHeight: "60vh",
                    objectFit: "contain",
                    borderRadius: 8,
                    boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
                  }}
                />
              </Box>

              {/* Flecha derecha */}
              {carruselImagenes.length > 1 && (
                <IconButton
                  onClick={() => setCarruselIdx((prev) => (prev + 1) % carruselImagenes.length)}
                  sx={{
                    position: "absolute",
                    right: 8,
                    zIndex: 2,
                    backgroundColor: "rgba(255,255,255,0.15)",
                    color: "white",
                    "&:hover": { backgroundColor: "rgba(255,255,255,0.3)" },
                    width: 44,
                    height: 44,
                  }}
                >
                  <Typography sx={{ fontSize: 24, fontWeight: "bold" }}>›</Typography>
                </IconButton>
              )}
            </Box>
          )}

          {/* Indicadores de puntos */}
          {carruselImagenes.length > 1 && (
            <Box sx={{ display: "flex", justifyContent: "center", gap: 1, pb: 2 }}>
              {carruselImagenes.map((_, i) => (
                <Box
                  key={i}
                  onClick={() => setCarruselIdx(i)}
                  sx={{
                    width: i === carruselIdx ? 24 : 10,
                    height: 10,
                    borderRadius: 5,
                    backgroundColor: i === carruselIdx ? "#a36920" : "rgba(255,255,255,0.3)",
                    cursor: "pointer",
                    transition: "all 0.3s ease",
                    "&:hover": { backgroundColor: i === carruselIdx ? "#a36920" : "rgba(255,255,255,0.5)" },
                  }}
                />
              ))}
            </Box>
          )}

          {/* Contador */}
          <Typography sx={{ textAlign: "center", color: "rgba(255,255,255,0.5)", fontSize: "0.8rem", pb: 2 }}>
            {carruselIdx + 1} / {carruselImagenes.length}
          </Typography>
        </DialogContent>
      </Dialog>

      {/* Modal para agrandar imagen de tratamiento */}
      <Dialog
        open={!!imagenAgrandada}
        onClose={() => setImagenAgrandada(null)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 4,
            overflow: "hidden",
            backgroundColor: "#1a1a1a",
          },
        }}
      >
        <DialogTitle
          sx={{
            backgroundColor: "#a36920",
            color: "white",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            py: 1.5,
          }}
        >
          <Typography variant="h6" sx={{ fontWeight: "bold" }}>
            📸 {imagenAgrandada?.nombre || "Tratamiento"}
          </Typography>
          <IconButton onClick={() => setImagenAgrandada(null)} sx={{ color: "white" }}>
            <Close />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ p: 0, backgroundColor: "#1a1a1a", display: "flex", justifyContent: "center", alignItems: "center", minHeight: 400 }}>
          {imagenAgrandada && (
            <Box sx={{ width: "100%", display: "flex", justifyContent: "center", py: 3, px: 3 }}>
              <img
                src={imagenAgrandada.url}
                alt={imagenAgrandada.nombre}
                style={{
                  maxWidth: "100%",
                  maxHeight: "70vh",
                  objectFit: "contain",
                  borderRadius: 8,
                  boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
                }}
              />
            </Box>
          )}
        </DialogContent>
      </Dialog>

      {/* 🛒 Modal Carrito — diseño limpio estilo app */}
      <Dialog
        open={modalCarrito}
        onClose={() => setModalCarrito(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 6,
            overflow: "hidden",
            maxHeight: "90vh",
            boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
          },
        }}
      >
        {/* Header limpio */}
        <Box sx={{ px: 3, pt: 3, pb: 1, backgroundColor: "white" }}>
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 0.5 }}>
            <IconButton 
              onClick={() => setModalCarrito(false)} 
              sx={{ 
                backgroundColor: "#f5f5f5", 
                width: 38, 
                height: 38,
                "&:hover": { backgroundColor: "#eeeeee" } 
              }}
            >
              <ArrowBack sx={{ fontSize: 20, color: "#333" }} />
            </IconButton>
            {carritoActivo && carritoActivo.items && carritoActivo.items.length > 0 && (
              <Typography 
                onClick={() => {
                  if (window.confirm("¿Vaciar todo el carrito?")) {
                    eliminarCarrito(carritoActivo.id);
                    setModalCarrito(false);
                  }
                }}
                sx={{ 
                  fontSize: "0.8rem", 
                  color: "#e57373", 
                  cursor: "pointer",
                  fontWeight: 500,
                  "&:hover": { color: "#d32f2f" },
                }}
              >
                Vaciar todo
              </Typography>
            )}
          </Box>
          <Typography sx={{ fontWeight: 800, fontSize: "1.6rem", color: "#1a1a1a", mt: 1 }}>
            Tratamiento oferta
          </Typography>
          <Typography sx={{ color: "#999", fontSize: "0.85rem", mb: 1 }}>
            {carritoActivo && carritoActivo.items ? `${carritoActivo.items.length} tratamiento${carritoActivo.items.length !== 1 ? 's' : ''}` : "Sin items"}
          </Typography>
        </Box>

        <DialogContent sx={{ p: 0, backgroundColor: "white" }}>
          {carritoActivo && carritoActivo.items && carritoActivo.items.length > 0 ? (
            <Box sx={{ px: 3, pt: 1, pb: 2 }}>
              {carritoActivo.items.map((item, idx) => {
                const imgArray = item.tratamiento_id ? tratamientoImagenCache[item.tratamiento_id] : null;
                const imgUrl = Array.isArray(imgArray) && imgArray.length > 0 ? imgArray[0] : null;
                return (
                <Box key={item.id}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 2, py: 2 }}>
                    {/* Thumbnail grande redondeado */}
                    <Box sx={{
                      width: 80,
                      height: 80,
                      borderRadius: 4,
                      backgroundColor: "#f5f1e4",
                      overflow: "hidden",
                      flexShrink: 0,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}>
                      {imgUrl ? (
                        <img src={imgUrl} alt={item.tratamiento_nombre} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      ) : (
                        <Typography sx={{ fontSize: "2rem" }}>💉</Typography>
                      )}
                    </Box>
                    {/* Info */}
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ 
                        fontWeight: 700, 
                        fontSize: "1rem", 
                        color: "#1a1a1a",
                        lineHeight: 1.3,
                        mb: 0.3,
                      }}>
                        {item.tratamiento_nombre}
                      </Typography>
                      <Typography sx={{ color: "#999", fontSize: "0.82rem" }}>
                        {item.sesiones > 1 ? `${item.sesiones} sesiones` : "Tratamiento"}
                      </Typography>
                      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mt: 1 }}>
                        <Typography sx={{ fontWeight: 800, fontSize: "1.1rem", color: "#1a1a1a" }}>
                          S/{Number(item.precio || 0).toFixed(0)}
                        </Typography>
                        <IconButton
                          size="small"
                          onClick={() => eliminarItemCarrito(item.id)}
                          sx={{
                            color: "#ccc",
                            p: 0.5,
                            "&:hover": { color: "#e57373" },
                          }}
                        >
                          <Delete sx={{ fontSize: 20 }} />
                        </IconButton>
                      </Box>
                    </Box>
                  </Box>
                  {idx < carritoActivo.items.length - 1 && (
                    <Divider sx={{ borderColor: "rgba(0,0,0,0.06)" }} />
                  )}
                </Box>
                );
              })}
            </Box>
          ) : (
            <Box sx={{ textAlign: "center", py: 10, px: 4 }}>
              <ShoppingCart sx={{ fontSize: 64, color: "#e0e0e0", mb: 2 }} />
              <Typography sx={{ fontWeight: 700, fontSize: "1.2rem", color: "#bbb", mb: 0.5 }}>
                Carrito vacío
              </Typography>
              <Typography sx={{ color: "#ccc", fontSize: "0.9rem", maxWidth: 240, mx: "auto" }}>
                Agrega tratamientos desde el presupuesto del paciente
              </Typography>
            </Box>
          )}
        </DialogContent>

        {/* Footer con total y botón */}
        {carritoActivo && carritoActivo.items && carritoActivo.items.length > 0 && (
          <Box sx={{ px: 3, pb: 3, pt: 1, backgroundColor: "white" }}>
            <Divider sx={{ mb: 2, borderColor: "rgba(0,0,0,0.08)" }} />
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2.5 }}>
              <Typography sx={{ fontWeight: 600, fontSize: "1.1rem", color: "#666" }}>
                Total
              </Typography>
              <Typography sx={{ fontWeight: 900, fontSize: "1.5rem", color: "#1a1a1a" }}>
                S/{carritoActivo.items.reduce((sum, it) => sum + Number(it.precio || 0), 0).toFixed(0)}
              </Typography>
            </Box>
            <Button
              fullWidth
              variant="contained"
              onClick={() => setModalCarrito(false)}
              sx={{
                backgroundColor: "#1a1a1a",
                color: "white",
                borderRadius: 4,
                py: 1.8,
                fontWeight: 700,
                fontSize: "1rem",
                textTransform: "none",
                boxShadow: "none",
                "&:hover": { backgroundColor: "#333", boxShadow: "none" },
              }}
            >
              Listo
            </Button>
          </Box>
        )}
      </Dialog>

      {/* Modal Mapa Facial 3D */}
      <Dialog
        open={modalFacial}
        onClose={() => setModalFacial(false)}
        maxWidth={false}
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            overflow: "hidden",
            maxWidth: "95vw",
            width: "95vw",
            height: "90vh",
            maxHeight: "90vh",
            m: 1,
            backgroundColor: "#0F0F14",
          },
        }}
      >
        <DialogTitle sx={{
          backgroundColor: "#a36920",
          color: "white",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          py: 1.2,
          px: 2.5,
          borderBottom: "1px solid rgba(255,255,255,0.1)",
          background: "linear-gradient(135deg, #a36920 0%, #ba9a63 100%)",
          position: "relative",
        }}>
          <Box
            component="img"
            src="/images/ISOLOGO SHOWCLINIC-05.png"
            alt="ShowClinic"
            sx={{
              width: 70,
              height: 70,
              objectFit: "contain",
            }}
          />
          <IconButton 
            onClick={() => setModalFacial(false)} 
            sx={{ 
              position: "absolute",
              right: 16,
              color: "white", 
              "&:hover": { backgroundColor: "rgba(255,255,255,0.1)" } 
            }}
          >
            <Close />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ p: 0, overflow: "hidden", height: "100%" }}>
          <FacialMap3D
            paciente={pacienteSeleccionado}
            registros={facialRegistros}
            onGuardar={guardarFacial}
            onActualizar={actualizarFacial}
            onEliminar={eliminarFacial}
            onCargar={cargarFacial}
            guardando={guardandoFacial}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default HistorialClinico;
