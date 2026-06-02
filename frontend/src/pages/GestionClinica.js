import React, { useState, useEffect } from "react";
import useSocket from "../hooks/useSocket";
import {
  Container,
  Typography,
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  Grid,
  Card,
  CardContent,
  CircularProgress,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Divider,
  Stack,
  Alert,
  TextField,
  Tooltip,
  DialogContentText,
  Autocomplete,
  Tabs,
  Tab,
  Avatar,
  InputAdornment,
  Collapse,
  Badge
} from "@mui/material";
import {
  TrendingUp,
  Person,
  AttachMoney,
  EventNote,
  Assessment,
  Home,
  Visibility,
  Close,
  ExpandMore,
  ExpandLess,
  CalendarToday,
  LocalHospital,
  FilterList,
  Refresh,
  Download,
  Groups,
  MedicalServices,
  Percent,
  BarChart,
  Save,
  Edit,
  AccountBalance,
  MoneyOff,
  VpnKey,
  VisibilityOff,
  PersonAdd,
  Delete,
  CheckCircle,
  Cancel,
  Lock,
  LockOpen,
  Search,
  Payment,
  History,
  Settings,
  FileDownload
} from "@mui/icons-material";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { useToast } from "../components/ToastProvider";
import { formatearFechaCorta } from "../utils/dateUtils";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import GestionUsuarios from "../components/GestionUsuarios";

const API_BASE_URL = process.env.REACT_APP_API_URL || `${window.location.protocol}//${window.location.hostname}:4000`;

const BRAND_COLORS = {
  primary: '#854F0B',
  secondary: '#FAEEDA',
  primaryDark: '#6B3F08',
  secondaryLight: '#FDF8F0',
  success: '#4CAF50',
  warning: '#FF9800',
  error: '#D32F2F',
  info: '#2196F3'
};

const GestionClinica = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [especialistas, setEspecialistas] = useState([]);
  const [estadisticas, setEstadisticas] = useState([]);
  const [tratamientos, setTratamientos] = useState([]);
  const [tratamientosDisponibles, setTratamientosDisponibles] = useState([]);
  const [resumenGeneral, setResumenGeneral] = useState({
    total_atenciones: 0,
    total_ingresos: 0,
    total_pago_especialistas: 0,
    total_ganancia_clinica: 0,
    total_pacientes_unicos: 0,
    total_especialistas: 0,
    promedio_por_sesion: 0
  });
  const [editandoComision, setEditandoComision] = useState({});
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");
  const [mesFiltro, setMesFiltro] = useState("");
  const [anioFiltro, setAnioFiltro] = useState("");
  const [especialistaFiltro, setEspecialistaFiltro] = useState("");
  const [tipoEspecialistaFiltro, setTipoEspecialistaFiltro] = useState("");
  const [tratamientoFiltro, setTratamientoFiltro] = useState("");
  const [mostrarDetalleTratamientos, setMostrarDetalleTratamientos] = useState(false);
  const [modalDetalle, setModalDetalle] = useState({ abierto: false, especialista: null, datos: null });
  const [loadingDetalle, setLoadingDetalle] = useState(false);
  const [tabActual, setTabActual] = useState(0);
  const [busquedaPersonal, setBusquedaPersonal] = useState("");
  const [personalExpandido, setPersonalExpandido] = useState(null);
  const [detallePersonalData, setDetallePersonalData] = useState(null);
  const [presupuestosEspecialista, setPresupuestosEspecialista] = useState([]);
  const [historialPagos, setHistorialPagos] = useState([]);
  const [loadingDetallePersonal, setLoadingDetallePersonal] = useState(false);
  const [tabDetalleModal, setTabDetalleModal] = useState(0);
  const [mesSeleccionado, setMesSeleccionado] = useState(new Date().getMonth() + 1);
  const [anioSeleccionado, setAnioSeleccionado] = useState(new Date().getFullYear());
  const [rolFiltro, setRolFiltro] = useState("");
  const [tipoPagoFiltro, setTipoPagoFiltro] = useState("");
  
  // Modales
  const [modalRegistrarPago, setModalRegistrarPago] = useState({ abierto: false, trabajador: null });
  const [modalEditarDatos, setModalEditarDatos] = useState({ abierto: false, trabajador: null });
  const [modalHistorial, setModalHistorial] = useState({ abierto: false, trabajador: null });
  
  // Datos de pago
  const [datoPago, setDatoPago] = useState({
    monto: 0,
    fecha: new Date().toISOString().split('T')[0],
    metodo: 'transferencia',
    referencia: ''
  });
  
  // Datos de edición
  const [datoEdicion, setDatoEdicion] = useState({
    dni: '',
    especialidad: '',
    fecha_ingreso: '',
    tipo_contrato: '',
    metodo_pago: '',
    sueldo_fijo: 0,
    comision_porcentaje: 20,
    cuenta_bancaria: ''
  });

  // Estados para gestión de contraseñas
  const [usuarios, setUsuarios] = useState([]);
  const [passwordEditing, setPasswordEditing] = useState(null); // userId
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  
  // Estados para crear usuario
  const [openCreateUser, setOpenCreateUser] = useState(false);
  const [newUser, setNewUser] = useState({
    username: "",
    password: "",
    role: "asistente",
    permissions: []
  });
  const [creatingUser, setCreatingUser] = useState(false);
  
  // Estados para editar permisos
  const [editingPermissions, setEditingPermissions] = useState(null);
  const [openPermissionsDialog, setOpenPermissionsDialog] = useState(false);
  const [tempPermissions, setTempPermissions] = useState([]);
  
  // Módulos disponibles
  const availableModules = [
    { name: "Pacientes", key: "pacientes" },
    { name: "Tratamientos", key: "tratamientos" },
    { name: "Paquetes", key: "paquetes" },
    { name: "Inventario", key: "inventario" },
    { name: "Finanzas", key: "finanzas" },
    { name: "Especialistas", key: "especialistas" },
    { name: "Gestión Clínica", key: "gestion-clinica" },
    { name: "Estadísticas", key: "estadisticas" },
    { name: "Historial Clínico", key: "historial-clinico" }
  ];

  const token = localStorage.getItem("token");
  const userRole = localStorage.getItem("role");
  const isMaster = userRole === "master";
  const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};

  useEffect(() => {
    cargarEspecialistas();
    cargarTratamientos();
    if (isMaster) cargarUsuarios();
  }, []);

  useEffect(() => {
    aplicarFiltrosAutomaticos();
  }, [mesSeleccionado, anioSeleccionado, rolFiltro, tipoPagoFiltro]);

  const aplicarFiltrosAutomaticos = () => {
    const primerDia = new Date(anioSeleccionado, mesSeleccionado - 1, 1);
    const ultimoDia = new Date(anioSeleccionado, mesSeleccionado, 0);
    
    const formatoISO = (d) => {
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      return `${yyyy}-${mm}-${dd}`;
    };
    
    const fi = formatoISO(primerDia);
    const ff = formatoISO(ultimoDia);
    setFechaInicio(fi);
    setFechaFin(ff);
    cargarEstadisticas({ fechaInicio: fi, fechaFin: ff });
  };

  // Sincronización en tiempo real
  useSocket(["gestion:updated", "especialistas:updated", "tratamientos:updated"], () => {
    cargarEspecialistas();
    cargarTratamientos();
    cargarEstadisticas();
  });

  const cargarUsuarios = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/admin/users-with-permissions`, { headers: authHeaders });
      setUsuarios(res.data || []);
    } catch (err) {
      console.error("Error al cargar usuarios:", err);
    }
  };
  
  const crearUsuario = async () => {
    if (!newUser.username || !newUser.password || !newUser.role) {
      showToast({ severity: "warning", message: "Completa todos los campos requeridos" });
      return;
    }
    
    try {
      setCreatingUser(true);
      await axios.post(`${API_BASE_URL}/api/admin/users`, newUser, { headers: authHeaders });
      showToast({ severity: "success", message: "Usuario creado exitosamente" });
      setOpenCreateUser(false);
      setNewUser({ username: "", password: "", role: "asistente", permissions: [] });
      cargarUsuarios();
    } catch (err) {
      showToast({ severity: "error", message: err.response?.data?.message || "Error al crear usuario" });
    } finally {
      setCreatingUser(false);
    }
  };
  
  const eliminarUsuario = async (userId, username) => {
    if (!window.confirm(`¿Estás seguro de eliminar al usuario "${username}"?`)) return;
    
    try {
      await axios.delete(`${API_BASE_URL}/api/admin/users/${userId}`, { headers: authHeaders });
      showToast({ severity: "success", message: "Usuario eliminado exitosamente" });
      cargarUsuarios();
    } catch (err) {
      showToast({ severity: "error", message: err.response?.data?.message || "Error al eliminar usuario" });
    }
  };
  
  const abrirEditarPermisos = (user) => {
    setEditingPermissions(user.id);
    const userPerms = user.permissions || [];
    const perms = availableModules.map(mod => {
      const existing = userPerms.find(p => p.module_name === mod.key);
      return {
        module_name: mod.key,
        module_label: mod.name,
        can_access: existing ? Boolean(existing.can_access) : false,
        can_edit: existing ? Boolean(existing.can_edit) : false
      };
    });
    setTempPermissions(perms);
    setOpenPermissionsDialog(true);
  };
  
  const guardarPermisos = async () => {
    try {
      await axios.put(
        `${API_BASE_URL}/api/admin/users/${editingPermissions}/permissions`,
        { permissions: tempPermissions },
        { headers: authHeaders }
      );
      showToast({ severity: "success", message: "Permisos actualizados exitosamente" });
      setOpenPermissionsDialog(false);
      setEditingPermissions(null);
      cargarUsuarios();
    } catch (err) {
      showToast({ severity: "error", message: err.response?.data?.message || "Error al actualizar permisos" });
    }
  };
  
  const togglePermission = (moduleKey, field) => {
    setTempPermissions(prev => 
      prev.map(p => 
        p.module_name === moduleKey 
          ? { ...p, [field]: !p[field] }
          : p
      )
    );
  };
  
  const toggleNewUserPermission = (moduleKey, field) => {
    setNewUser(prev => {
      const perms = prev.permissions || [];
      const existing = perms.find(p => p.module_name === moduleKey);
      
      if (existing) {
        return {
          ...prev,
          permissions: perms.map(p => 
            p.module_name === moduleKey 
              ? { ...p, [field]: !p[field] }
              : p
          )
        };
      } else {
        return {
          ...prev,
          permissions: [...perms, { module_name: moduleKey, can_access: field === 'can_access', can_edit: field === 'can_edit' }]
        };
      }
    });
  };
  
  const getNewUserPermission = (moduleKey, field) => {
    const perm = newUser.permissions.find(p => p.module_name === moduleKey);
    return perm ? Boolean(perm[field]) : false;
  };

  const cambiarPassword = async (userId) => {
    if (!newPassword || newPassword.length < 4) {
      showToast({ severity: "warning", message: "La contraseña debe tener al menos 4 caracteres" });
      return;
    }
    try {
      setSavingPassword(true);
      const res = await axios.put(`${API_BASE_URL}/api/admin/users/${userId}/password`, { newPassword }, { headers: authHeaders });
      showToast({ severity: "success", message: res.data.message || "Contraseña actualizada" });
      setPasswordEditing(null);
      setNewPassword("");
      setShowPassword(false);
    } catch (err) {
      showToast({ severity: "error", message: err.response?.data?.message || "Error al cambiar contraseña" });
    } finally {
      setSavingPassword(false);
    }
  };

  const cargarEspecialistas = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/especialistas/listar`);
      setEspecialistas(res.data || []);
    } catch (err) {
      console.error("Error al obtener especialistas:", err);
    }
  };

  const cargarTratamientos = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/gestion-clinica/tratamientos`, { headers: authHeaders });
      setTratamientosDisponibles(res.data || []);
    } catch (err) {
      console.error("Error al obtener tratamientos:", err);
    }
  };

  const cargarEstadisticas = async (overrides = {}) => {
    setLoading(true);
    try {
      const fi = overrides.fechaInicio !== undefined ? overrides.fechaInicio : fechaInicio;
      const ff = overrides.fechaFin !== undefined ? overrides.fechaFin : fechaFin;
      const params = new URLSearchParams();
      if (fi) params.append("fecha_inicio", fi);
      if (ff) params.append("fecha_fin", ff);
      if (especialistaFiltro) params.append("especialista_id", especialistaFiltro);
      if (tratamientoFiltro) params.append("tratamiento", tratamientoFiltro);

      const response = await axios.get(
        `${API_BASE_URL}/api/gestion-clinica/estadisticas?${params.toString()}`,
        { headers: authHeaders }
      );

      setEstadisticas(response.data.estadisticas || []);
      setTratamientos(response.data.tratamientos || []);
      setResumenGeneral(response.data.resumen || {
        total_atenciones: 0,
        total_ingresos: 0,
        total_pago_especialistas: 0,
        total_ganancia_clinica: 0,
        total_pacientes_unicos: 0,
        total_especialistas: 0,
        promedio_por_sesion: 0
      });
    } catch (error) {
      console.error("Error al cargar estadísticas:", error);
      showToast({ severity: "error", message: "Error al cargar estadísticas" });
    } finally {
      setLoading(false);
    }
  };

  const limpiarFiltros = () => {
    setFechaInicio("");
    setFechaFin("");
    setMesFiltro("");
    setAnioFiltro("");
    setEspecialistaFiltro("");
    setTipoEspecialistaFiltro("");
    setTratamientoFiltro("");
    cargarEstadisticas();
  };

  const filtrarPorMes = (mes) => {
    const anio = new Date().getFullYear();
    const primerDia = new Date(anio, mes - 1, 1);
    const ultimoDia = new Date(anio, mes, 0);
    
    const formatoISO = (d) => {
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      return `${yyyy}-${mm}-${dd}`;
    };
    
    const fi = formatoISO(primerDia);
    const ff = formatoISO(ultimoDia);
    setFechaInicio(fi);
    setFechaFin(ff);
    setMesFiltro(mes);
    cargarEstadisticas({ fechaInicio: fi, fechaFin: ff });
  };

  const verDetalleEspecialista = async (especialista) => {
    if (!especialista || !especialista.especialista_id) {
      showToast({ severity: "error", message: "Especialista no válido" });
      return;
    }

    setLoadingDetalle(true);
    setModalDetalle({ abierto: true, especialista, datos: null });
    
    try {
      const params = new URLSearchParams();
      if (fechaInicio) params.append("fecha_inicio", fechaInicio);
      if (fechaFin) params.append("fecha_fin", fechaFin);
      if (tratamientoFiltro) params.append("tratamiento", tratamientoFiltro);

      const url = `${API_BASE_URL}/api/gestion-clinica/especialista/${especialista.especialista_id}/detalle${params.toString() ? '?' + params.toString() : ''}`;
      console.log("Cargando detalle desde:", url);

      const response = await axios.get(url, { headers: authHeaders });

      console.log("Datos recibidos:", response.data);
      setModalDetalle({ abierto: true, especialista, datos: response.data });
    } catch (error) {
      console.error("Error al cargar detalle:", error);
      showToast({ severity: "error", message: `Error al cargar detalle: ${error.message}` });
      setModalDetalle({ abierto: false, especialista: null, datos: null });
    } finally {
      setLoadingDetalle(false);
    }
  };

  const cerrarModalDetalle = () => {
    setModalDetalle({ abierto: false, especialista: null, datos: null });
  };

  const iniciarEdicion = (espId, comision, pagoFijo) => {
    setEditandoComision(prev => ({
      ...prev,
      [espId]: { comision_porcentaje: comision, pago_fijo: pagoFijo }
    }));
  };

  const cancelarEdicion = (espId) => {
    setEditandoComision(prev => {
      const nuevo = { ...prev };
      delete nuevo[espId];
      return nuevo;
    });
  };

  const guardarComision = async (espId) => {
    const datos = editandoComision[espId];
    if (!datos) return;

    try {
      await axios.put(
        `${API_BASE_URL}/api/especialistas/comision/${espId}`,
        {
          comision_porcentaje: datos.comision_porcentaje,
          pago_fijo: datos.pago_fijo
        },
        { headers: authHeaders }
      );
      showToast({ severity: "success", message: "Comisión actualizada correctamente" });
      cancelarEdicion(espId);
      cargarEstadisticas();
    } catch (error) {
      console.error("Error al guardar comisión:", error);
      showToast({ severity: "error", message: error.response?.data?.message || "Error al guardar comisión" });
    }
  };

  const exportarCSV = () => {
    if (!estadisticas || estadisticas.length === 0) {
      showToast({ severity: "warning", message: "No hay datos para exportar" });
      return;
    }

    const headers = ["Especialista", "Total Atenciones", "Pacientes Únicos", "Ingresos (S/)", "Comisión %", "Pago Fijo (S/)", "Pago Total Esp. (S/)", "Ganancia Clínica (S/)"];
    const rows = estadisticas.map(stat => [
      stat.especialista_nombre,
      stat.total_atenciones,
      stat.pacientes_unicos || 0,
      Number(stat.total_ingresos).toFixed(2),
      Number(stat.comision_porcentaje).toFixed(0),
      Number(stat.pago_fijo).toFixed(2),
      Number(stat.pago_total_especialista).toFixed(2),
      Number(stat.ganancia_clinica).toFixed(2)
    ]);

    const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const fecha = new Date().toISOString().split("T")[0];
    link.download = `gestion_clinica_${fecha}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    showToast({ severity: "success", message: "Reporte exportado exitosamente" });
  };

  const personalFiltrado = estadisticas.filter(esp => {
    const nombreCompleto = esp.especialista_nombre.toLowerCase();
    const busqueda = busquedaPersonal.toLowerCase();
    let cumpleFiltros = nombreCompleto.includes(busqueda);
    
    if (rolFiltro) {
      cumpleFiltros = cumpleFiltros && esp.tipo === rolFiltro;
    }
    
    if (tipoPagoFiltro) {
      if (tipoPagoFiltro === 'fijo') {
        cumpleFiltros = cumpleFiltros && esp.pago_fijo > 0 && esp.comision_porcentaje === 0;
      } else if (tipoPagoFiltro === 'comision') {
        cumpleFiltros = cumpleFiltros && esp.comision_porcentaje > 0 && esp.pago_fijo === 0;
      } else if (tipoPagoFiltro === 'mixto') {
        cumpleFiltros = cumpleFiltros && esp.pago_fijo > 0 && esp.comision_porcentaje > 0;
      }
    }
    
    return cumpleFiltros;
  });

  const toggleExpandir = (espId) => {
    setPersonalExpandido(personalExpandido === espId ? null : espId);
  };

  const abrirModalRegistrarPago = (trabajador) => {
    setDatoPago({
      monto: trabajador.pago_total_especialista,
      fecha: new Date().toISOString().split('T')[0],
      metodo: 'transferencia',
      referencia: ''
    });
    setModalRegistrarPago({ abierto: true, trabajador });
  };

  const abrirModalEditarDatos = async (trabajador) => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/especialistas/${trabajador.especialista_id}`, { headers: authHeaders });
      const datos = res.data;
      setDatoEdicion({
        dni: datos.dni || '',
        especialidad: datos.especialidad || '',
        fecha_ingreso: datos.fecha_ingreso || '',
        tipo_contrato: datos.tipo_contrato || '',
        metodo_pago: datos.metodo_pago || '',
        sueldo_fijo: datos.pago_fijo || 0,
        comision_porcentaje: datos.comision_porcentaje || 20,
        cuenta_bancaria: datos.cuenta_bancaria || ''
      });
      setModalEditarDatos({ abierto: true, trabajador });
    } catch (error) {
      console.error('Error al cargar datos:', error);
      setModalEditarDatos({ abierto: true, trabajador });
    }
  };

  const abrirModalHistorial = async (trabajador) => {
    setModalHistorial({ abierto: true, trabajador });
    try {
      const res = await axios.get(
        `${API_BASE_URL}/api/gestion-clinica/historial-pagos/${trabajador.especialista_id}`,
        { headers: authHeaders }
      );
      setHistorialPagos(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      console.error("Error al cargar historial de pagos:", error);
      setHistorialPagos([]);
    }
  };

  const cargarDetallePersonalExpandido = async (espId) => {
    setLoadingDetallePersonal(true);
    setTabDetalleModal(0);
    try {
      const params = new URLSearchParams();
      if (fechaInicio) params.append("fecha_inicio", fechaInicio);
      if (fechaFin) params.append("fecha_fin", fechaFin);
      const qs = params.toString() ? '?' + params.toString() : '';

      const [detalleRes, presupuestosRes, historialRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/api/gestion-clinica/especialista/${espId}/detalle${qs}`, { headers: authHeaders }),
        axios.get(`${API_BASE_URL}/api/gestion-clinica/especialista/${espId}/presupuestos${qs}`, { headers: authHeaders }),
        axios.get(`${API_BASE_URL}/api/gestion-clinica/historial-pagos/${espId}`, { headers: authHeaders })
      ]);

      setDetallePersonalData(detalleRes.data);
      setPresupuestosEspecialista(Array.isArray(presupuestosRes.data) ? presupuestosRes.data : []);
      setHistorialPagos(Array.isArray(historialRes.data) ? historialRes.data : []);
    } catch (error) {
      console.error("Error al cargar detalle del especialista:", error);
      setDetallePersonalData(null);
      setPresupuestosEspecialista([]);
      setHistorialPagos([]);
    } finally {
      setLoadingDetallePersonal(false);
    }
  };

  const registrarPago = async () => {
    try {
      await axios.post(
        `${API_BASE_URL}/api/gestion-clinica/registrar-pago`,
        {
          especialista_id: modalRegistrarPago.trabajador.especialista_id,
          monto: datoPago.monto,
          fecha: datoPago.fecha,
          metodo: datoPago.metodo,
          referencia: datoPago.referencia,
          mes: mesSeleccionado,
          anio: anioSeleccionado
        },
        { headers: authHeaders }
      );
      showToast({ severity: "success", message: "Pago registrado exitosamente" });
      setModalRegistrarPago({ abierto: false, trabajador: null });
      aplicarFiltrosAutomaticos();
    } catch (error) {
      showToast({ severity: "error", message: error.response?.data?.message || "Error al registrar pago" });
    }
  };

  const guardarEdicionDatos = async () => {
    try {
      await axios.put(
        `${API_BASE_URL}/api/especialistas/${modalEditarDatos.trabajador.especialista_id}`,
        datoEdicion,
        { headers: authHeaders }
      );
      showToast({ severity: "success", message: "Datos actualizados exitosamente" });
      setModalEditarDatos({ abierto: false, trabajador: null });
      aplicarFiltrosAutomaticos();
    } catch (error) {
      showToast({ severity: "error", message: error.response?.data?.message || "Error al actualizar datos" });
    }
  };

  const exportarExcel = () => {
    if (!estadisticas || estadisticas.length === 0) {
      showToast({ severity: "warning", message: "No hay datos para exportar" });
      return;
    }

    const datos = estadisticas.map(stat => ({
      'Nombre': stat.especialista_nombre,
      'Rol': stat.tipo || 'Doctor',
      'Tipo de Pago': stat.pago_fijo > 0 && stat.comision_porcentaje > 0 ? 'Mixto' : stat.pago_fijo > 0 ? 'Fijo' : 'Comisión',
      'Ingresos Generados': Number(stat.total_ingresos).toFixed(2),
      'Comisión %': Number(stat.comision_porcentaje).toFixed(0),
      'Comisión Calculada': Number(stat.comision_calculada).toFixed(2),
      'Sueldo Fijo': Number(stat.pago_fijo).toFixed(2),
      'Total a Pagar': Number(stat.pago_total_especialista).toFixed(2),
      'Estado': 'Pendiente'
    }));

    const ws = XLSX.utils.json_to_sheet(datos);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Personal");
    const mesNombre = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'][mesSeleccionado - 1];
    XLSX.writeFile(wb, `gestion_personal_${mesNombre}_${anioSeleccionado}.xlsx`);
    showToast({ severity: "success", message: "Exportado exitosamente" });
  };

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      {/* Header Moderno */}
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 1 }}>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: "bold", color: BRAND_COLORS.primary, mb: 0.5 }}>
              Gestión de personal
            </Typography>
            <Typography variant="body2" sx={{ color: "#666" }}>
              Control financiero y operativo del equipo
            </Typography>
          </Box>
          <Stack direction="row" spacing={2}>
            <Button
              variant="outlined"
              startIcon={<Home />}
              onClick={() => navigate("/dashboard")}
              sx={{
                borderColor: BRAND_COLORS.primary,
                color: BRAND_COLORS.primary,
                "&:hover": {
                  borderColor: BRAND_COLORS.primaryDark,
                  backgroundColor: BRAND_COLORS.secondaryLight
                }
              }}
            >
              Volver
            </Button>
            <Button
              variant="contained"
              startIcon={<PersonAdd />}
              sx={{
                backgroundColor: BRAND_COLORS.primary,
                "&:hover": {
                  backgroundColor: BRAND_COLORS.primaryDark
                }
              }}
            >
              + Agregar personal
            </Button>
          </Stack>
        </Box>
      </Box>

      {/* Resumen del Mes */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="body2" sx={{ color: "#999", textTransform: "uppercase", mb: 2, letterSpacing: 1 }}>
          RESUMEN DEL MES — {new Date().toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }).toUpperCase()}
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ backgroundColor: BRAND_COLORS.secondaryLight, border: `1px solid ${BRAND_COLORS.secondary}`, borderRadius: 2 }}>
              <CardContent sx={{ py: 2 }}>
                <Typography variant="body2" sx={{ color: "#666", mb: 1 }}>
                  Ingresos totales
                </Typography>
                <Typography variant="h4" sx={{ fontWeight: "bold", color: BRAND_COLORS.primary }}>
                  S/ {Number(resumenGeneral.total_ingresos || 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </Typography>
                <Typography variant="caption" sx={{ color: BRAND_COLORS.success }}>
                  +12% vs. marzo
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ backgroundColor: BRAND_COLORS.secondaryLight, border: `1px solid ${BRAND_COLORS.secondary}`, borderRadius: 2 }}>
              <CardContent sx={{ py: 2 }}>
                <Typography variant="body2" sx={{ color: "#666", mb: 1 }}>
                  Comisiones a pagar
                </Typography>
                <Typography variant="h4" sx={{ fontWeight: "bold", color: BRAND_COLORS.primary }}>
                  S/ {Number(resumenGeneral.total_pago_especialistas - estadisticas.reduce((sum, e) => sum + (e.pago_fijo || 0), 0) || 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </Typography>
                <Typography variant="caption" sx={{ color: "#666" }}>
                  {estadisticas.filter(e => e.comision_porcentaje > 0).length} doctores con comisión
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ backgroundColor: BRAND_COLORS.secondaryLight, border: `1px solid ${BRAND_COLORS.secondary}`, borderRadius: 2 }}>
              <CardContent sx={{ py: 2 }}>
                <Typography variant="body2" sx={{ color: "#666", mb: 1 }}>
                  Sueldos fijos
                </Typography>
                <Typography variant="h4" sx={{ fontWeight: "bold", color: BRAND_COLORS.primary }}>
                  S/ {Number(estadisticas.reduce((sum, e) => sum + (e.pago_fijo || 0), 0) || 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </Typography>
                <Typography variant="caption" sx={{ color: "#666" }}>
                  {estadisticas.filter(e => e.pago_fijo > 0).length} trabajadores
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ backgroundColor: BRAND_COLORS.secondaryLight, border: `1px solid ${BRAND_COLORS.secondary}`, borderRadius: 2 }}>
              <CardContent sx={{ py: 2 }}>
                <Typography variant="body2" sx={{ color: "#666", mb: 1 }}>
                  Personal activo
                </Typography>
                <Typography variant="h4" sx={{ fontWeight: "bold", color: BRAND_COLORS.primary }}>
                  {estadisticas.filter(e => e.total_atenciones > 0).length}
                </Typography>
                <Typography variant="caption" sx={{ color: "#666" }}>
                  {estadisticas.filter(e => e.tipo === 'doctor' || !e.tipo).length} doctores · {estadisticas.filter(e => e.tipo === 'asistente').length} asist. · {estadisticas.filter(e => e.tipo === 'admin').length} admin
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Box>

      {/* Pestañas de Navegación */}
      <Paper sx={{ mb: 3, borderRadius: 2 }}>
        <Tabs 
          value={tabActual} 
          onChange={(e, newValue) => setTabActual(newValue)}
          sx={{
            borderBottom: `2px solid ${BRAND_COLORS.secondary}`,
            '& .MuiTab-root': {
              textTransform: 'none',
              fontWeight: 600,
              fontSize: '0.95rem',
              color: '#666',
              '&.Mui-selected': {
                color: BRAND_COLORS.primary
              }
            },
            '& .MuiTabs-indicator': {
              backgroundColor: BRAND_COLORS.primary,
              height: 3
            }
          }}
        >
          <Tab label="Personal" />
          <Tab label="Pagos del mes" />
          <Tab label="Historial" />
          <Tab label="Configuración" />
          {isMaster && <Tab label="Usuarios del Sistema" />}
        </Tabs>
      </Paper>

      {/* Contenido de Pestañas */}
      {tabActual === 0 && (
        <>
          {/* Filtros Compactos */}
          <Paper elevation={0} sx={{ p: 2, mb: 3, backgroundColor: "white", borderRadius: 2, border: `1px solid ${BRAND_COLORS.secondary}` }}>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} sm={6} md={2.5}>
                <FormControl fullWidth size="small">
                  <InputLabel>Mes</InputLabel>
                  <Select
                    value={mesSeleccionado}
                    onChange={(e) => setMesSeleccionado(e.target.value)}
                    label="Mes"
                  >
                    <MenuItem value={1}>Enero</MenuItem>
                    <MenuItem value={2}>Febrero</MenuItem>
                    <MenuItem value={3}>Marzo</MenuItem>
                    <MenuItem value={4}>Abril</MenuItem>
                    <MenuItem value={5}>Mayo</MenuItem>
                    <MenuItem value={6}>Junio</MenuItem>
                    <MenuItem value={7}>Julio</MenuItem>
                    <MenuItem value={8}>Agosto</MenuItem>
                    <MenuItem value={9}>Septiembre</MenuItem>
                    <MenuItem value={10}>Octubre</MenuItem>
                    <MenuItem value={11}>Noviembre</MenuItem>
                    <MenuItem value={12}>Diciembre</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6} md={2}>
                <FormControl fullWidth size="small">
                  <InputLabel>Año</InputLabel>
                  <Select
                    value={anioSeleccionado}
                    onChange={(e) => setAnioSeleccionado(e.target.value)}
                    label="Año"
                  >
                    <MenuItem value={2024}>2024</MenuItem>
                    <MenuItem value={2025}>2025</MenuItem>
                    <MenuItem value={2026}>2026</MenuItem>
                    <MenuItem value={2027}>2027</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6} md={2.5}>
                <FormControl fullWidth size="small">
                  <InputLabel>Rol</InputLabel>
                  <Select
                    value={rolFiltro}
                    onChange={(e) => setRolFiltro(e.target.value)}
                    label="Rol"
                  >
                    <MenuItem value="">Todos</MenuItem>
                    <MenuItem value="doctor">Doctor</MenuItem>
                    <MenuItem value="asistente">Asistente</MenuItem>
                    <MenuItem value="admin">Admin</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6} md={2.5}>
                <FormControl fullWidth size="small">
                  <InputLabel>Tipo pago</InputLabel>
                  <Select
                    value={tipoPagoFiltro}
                    onChange={(e) => setTipoPagoFiltro(e.target.value)}
                    label="Tipo pago"
                  >
                    <MenuItem value="">Todos</MenuItem>
                    <MenuItem value="fijo">Fijo</MenuItem>
                    <MenuItem value="comision">Comisión</MenuItem>
                    <MenuItem value="mixto">Mixto</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6} md={2.5}>
                <Button
                  variant="outlined"
                  fullWidth
                  startIcon={<FileDownload />}
                  onClick={exportarExcel}
                  sx={{ 
                    borderColor: BRAND_COLORS.primary, 
                    color: BRAND_COLORS.primary,
                    "&:hover": {
                      borderColor: BRAND_COLORS.primaryDark,
                      backgroundColor: BRAND_COLORS.secondaryLight
                    }
                  }}
                >
                  Exportar
                </Button>
              </Grid>
            </Grid>
          </Paper>


      {/* Vista de Cards Circulares */}
      <Box sx={{ mb: 3 }}>
        
        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", p: 6 }}>
            <CircularProgress size={60} sx={{ color: BRAND_COLORS.primary }} />
          </Box>
        ) : personalFiltrado.length === 0 ? (
          <Alert severity="info" sx={{ my: 3 }}>
            No se encontraron resultados.
          </Alert>
        ) : (
          <Grid container spacing={3}>
            {personalFiltrado.map((stat) => {
              const coloresAvatar = ['#F4C430', '#9B7EBD', '#7FB3D5', '#F8B4B4', '#B4E7CE'];
              const colorIndex = stat.especialista_id % coloresAvatar.length;
              const iniciales = stat.especialista_nombre.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
              
              return (
                <Grid item xs={12} sm={6} md={4} lg={3} key={stat.especialista_id}>
                  <Card
                    onClick={() => {
                      setPersonalExpandido(stat.especialista_id);
                      cargarDetallePersonalExpandido(stat.especialista_id);
                    }}
                    sx={{
                      cursor: 'pointer',
                      backgroundColor: '#2D2D2D',
                      borderRadius: 3,
                      p: 3,
                      textAlign: 'center',
                      transition: 'all 0.3s',
                      '&:hover': {
                        transform: 'translateY(-4px)',
                        boxShadow: '0 8px 24px rgba(133, 79, 11, 0.3)'
                      }
                    }}
                  >
                    <Avatar
                      sx={{
                        width: 100,
                        height: 100,
                        margin: '0 auto 16px',
                        backgroundColor: coloresAvatar[colorIndex],
                        fontSize: '2rem',
                        fontWeight: 'bold',
                        color: '#2D2D2D'
                      }}
                    >
                      {iniciales}
                    </Avatar>
                    
                    <Typography variant="h6" sx={{ color: 'white', fontWeight: 600, mb: 0.5 }}>
                      {stat.especialista_nombre}
                    </Typography>
                    
                    <Typography variant="body2" sx={{ color: '#999', mb: 2 }}>
                      {stat.tipo === 'doctor' ? 'Medicina estética' : stat.tipo === 'asistente' ? 'Asistente clínica' : 'Recepción'}
                    </Typography>
                    
                    <Typography variant="h5" sx={{ color: BRAND_COLORS.warning, fontWeight: 'bold', mb: 0.5 }}>
                      S/ {Number(stat.pago_total_especialista || 0).toLocaleString('es-PE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </Typography>
                    
                    <Typography variant="caption" sx={{ color: '#aaa', display: 'block', mb: 0.5 }}>
                      Pago mensual
                    </Typography>

                    <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1, mt: 0.5 }}>
                      <Chip
                        label={`${stat.total_atenciones} tratamiento${stat.total_atenciones !== 1 ? 's' : ''}`}
                        size="small"
                        sx={{ 
                          backgroundColor: 'rgba(76,175,80,0.2)', 
                          color: '#81c784', 
                          fontWeight: 600,
                          fontSize: '0.65rem',
                          height: 22
                        }}
                      />
                    </Box>
                  </Card>
                </Grid>
              );
            })}
          </Grid>
        )}
      </Box>
      
      {/* Modal de Detalle del Trabajador */}
      <Dialog 
        open={personalExpandido !== null} 
        onClose={() => setPersonalExpandido(null)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            backgroundColor: '#2D2D2D',
            borderRadius: 3
          }
        }}
      >
        {personalExpandido && (() => {
          const trabajador = estadisticas.find(e => e.especialista_id === personalExpandido);
          if (!trabajador) return null;
          
          const coloresAvatar = ['#F4C430', '#9B7EBD', '#7FB3D5', '#F8B4B4', '#B4E7CE'];
          const colorIndex = trabajador.especialista_id % coloresAvatar.length;
          const iniciales = trabajador.especialista_nombre.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
          const tipoPago = trabajador.pago_fijo > 0 && trabajador.comision_porcentaje > 0 ? 'Fijo + Comisión' : trabajador.pago_fijo > 0 ? 'Sueldo Fijo' : 'Comisión';
          
          return (
            <>
              <DialogTitle sx={{ pb: 1 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Button
                    startIcon={<Close />}
                    onClick={() => setPersonalExpandido(null)}
                    sx={{ color: '#999' }}
                  >
                    Volver al equipo
                  </Button>
                  <IconButton onClick={() => setPersonalExpandido(null)} sx={{ color: '#999' }}>
                    <Close />
                  </IconButton>
                </Box>
              </DialogTitle>
              
              <DialogContent>
                {/* Header con Avatar y Nombre */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                  <Avatar
                    sx={{
                      width: 80,
                      height: 80,
                      backgroundColor: coloresAvatar[colorIndex],
                      fontSize: '1.8rem',
                      fontWeight: 'bold',
                      color: '#2D2D2D'
                    }}
                  >
                    {iniciales}
                  </Avatar>
                  <Box>
                    <Typography variant="h5" sx={{ color: 'white', fontWeight: 600 }}>
                      {trabajador.especialista_nombre}
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#999' }}>
                      {trabajador.tipo === 'doctor' ? 'Medicina estética' : trabajador.tipo === 'asistente' ? 'Asistente clínica' : 'Recepción'}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                      <Chip label={trabajador.tipo || 'Doctor'} size="small" sx={{ backgroundColor: '#4A4A4A', color: 'white', textTransform: 'capitalize' }} />
                      <Chip label={tipoPago} size="small" sx={{ backgroundColor: '#4A4A4A', color: 'white' }} />
                    </Box>
                  </Box>
                </Box>
                
                {/* Resumen Financiero */}
                <Grid container spacing={2} sx={{ mb: 3 }}>
                  <Grid item xs={3}>
                    <Paper sx={{ p: 2, backgroundColor: '#3A3A3A', textAlign: 'center', borderRadius: 2 }}>
                      <Typography variant="caption" sx={{ color: '#999' }}>Sueldo fijo</Typography>
                      <Typography variant="h6" sx={{ color: 'white', fontWeight: 600 }}>
                        S/ {Number(trabajador.pago_fijo).toLocaleString('es-PE', { minimumFractionDigits: 0 })}
                      </Typography>
                    </Paper>
                  </Grid>
                  <Grid item xs={3}>
                    <Paper sx={{ p: 2, backgroundColor: '#3A3A3A', textAlign: 'center', borderRadius: 2 }}>
                      <Typography variant="caption" sx={{ color: '#999' }}>Comisión ({Number(trabajador.comision_porcentaje).toFixed(0)}%)</Typography>
                      <Typography variant="h6" sx={{ color: BRAND_COLORS.warning, fontWeight: 600 }}>
                        S/ {Number(trabajador.comision_calculada).toLocaleString('es-PE', { minimumFractionDigits: 0 })}
                      </Typography>
                    </Paper>
                  </Grid>
                  <Grid item xs={3}>
                    <Paper sx={{ p: 2, backgroundColor: '#3A3A3A', textAlign: 'center', borderRadius: 2 }}>
                      <Typography variant="caption" sx={{ color: '#999' }}>Total a pagar</Typography>
                      <Typography variant="h6" sx={{ color: '#4CAF50', fontWeight: 600 }}>
                        S/ {Number(trabajador.pago_total_especialista).toLocaleString('es-PE', { minimumFractionDigits: 0 })}
                      </Typography>
                    </Paper>
                  </Grid>
                  <Grid item xs={3}>
                    <Paper sx={{ p: 2, backgroundColor: '#3A3A3A', textAlign: 'center', borderRadius: 2 }}>
                      <Typography variant="caption" sx={{ color: '#999' }}>Tratamientos</Typography>
                      <Typography variant="h6" sx={{ color: '#81c784', fontWeight: 600 }}>
                        {trabajador.total_atenciones}
                      </Typography>
                    </Paper>
                  </Grid>
                </Grid>

                {/* Botones de Acción rápida */}
                <Stack direction="row" spacing={2} sx={{ mb: 3 }}>
                  <Button 
                    variant="contained" 
                    fullWidth
                    startIcon={<Payment />}
                    onClick={() => abrirModalRegistrarPago(trabajador)}
                    sx={{ backgroundColor: BRAND_COLORS.primary, '&:hover': { backgroundColor: BRAND_COLORS.primaryDark } }}
                  >
                    Registrar pago
                  </Button>
                  <Button 
                    variant="outlined" 
                    fullWidth
                    startIcon={<Visibility />}
                    onClick={() => verDetalleEspecialista(trabajador)}
                    sx={{ borderColor: BRAND_COLORS.primary, color: BRAND_COLORS.primary }}
                  >
                    Ver tratamientos
                  </Button>
                  <Button 
                    variant="outlined" 
                    fullWidth
                    startIcon={<FileDownload />}
                    onClick={() => {
                      const datos = [{
                        'Nombre': trabajador.especialista_nombre,
                        'Tratamientos': trabajador.total_atenciones,
                        'Ingresos': Number(trabajador.total_ingresos).toFixed(2),
                        'Comisión': Number(trabajador.comision_calculada).toFixed(2),
                        'Sueldo Fijo': Number(trabajador.pago_fijo).toFixed(2),
                        'Total a Pagar': Number(trabajador.pago_total_especialista).toFixed(2),
                      }];
                      const ws = XLSX.utils.json_to_sheet(datos);
                      const wb = XLSX.utils.book_new();
                      XLSX.utils.book_append_sheet(wb, ws, "Detalle");
                      XLSX.writeFile(wb, `detalle_${trabajador.especialista_nombre.replace(/\s/g,'_')}.xlsx`);
                      showToast({ severity: "success", message: "Exportado exitosamente" });
                    }}
                    sx={{ borderColor: '#4A4A4A', color: 'white' }}
                  >
                    Exportar
                  </Button>
                </Stack>
                
                {/* Tabs de contenido */}
                <Box sx={{ borderBottom: 1, borderColor: '#4A4A4A', mb: 2 }}>
                  <Tabs 
                    value={tabDetalleModal} 
                    onChange={(_, v) => setTabDetalleModal(v)}
                    sx={{ 
                      '& .MuiTab-root': { color: '#999', fontSize: '0.8rem', minWidth: 'auto', px: 2 }, 
                      '& .Mui-selected': { color: 'white' },
                      '& .MuiTabs-indicator': { backgroundColor: BRAND_COLORS.primary }
                    }}
                  >
                    <Tab label="Presupuestos asignados" />
                    <Tab label="Tratamientos realizados" />
                    <Tab label="Historial de pagos" />
                  </Tabs>
                </Box>

                {loadingDetallePersonal ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                    <CircularProgress size={40} sx={{ color: BRAND_COLORS.primary }} />
                  </Box>
                ) : (
                  <>
                    {/* Tab 0: Presupuestos asignados */}
                    {tabDetalleModal === 0 && (
                      <Box>
                        {presupuestosEspecialista.length === 0 ? (
                          <Alert severity="info" sx={{ backgroundColor: '#3A3A3A', color: '#ccc', '& .MuiAlert-icon': { color: '#81c784' } }}>
                            No hay presupuestos asignados a este especialista en el período seleccionado.
                          </Alert>
                        ) : (
                          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            {presupuestosEspecialista.map((pres) => {
                              const tratamientos = pres.tratamientos || [];
                              const precioTotal = Number(pres.precio_total || 0);
                              const descuento = Number(pres.descuento || 0);
                              const pagado = Number(pres.monto_pagado || 0);
                              const saldo = pres.saldo_pendiente != null ? Number(pres.saldo_pendiente) : Math.max(0, precioTotal - descuento - pagado);
                              const estadoColor = pres.estado === 'completado' ? '#4CAF50' : pres.estado === 'activo' ? BRAND_COLORS.warning : '#999';
                              const estadoPago = pres.estado_pago || (saldo <= 0.01 && (precioTotal - descuento) > 0 ? 'pagado' : pagado > 0 ? 'adelanto' : 'pendiente_pago');
                              const pagoLabel = estadoPago === 'pagado' ? 'Pagado' : estadoPago === 'adelanto' ? 'Adelanto' : 'Pendiente';
                              const pagoColor = estadoPago === 'pagado' ? '#4CAF50' : estadoPago === 'adelanto' ? '#ff9800' : '#f44336';
                              
                              return (
                                <Paper key={pres.id} sx={{ p: 2, backgroundColor: '#3A3A3A', borderRadius: 2, border: `1px solid ${estadoColor}40` }}>
                                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                                    <Box>
                                      <Typography variant="subtitle2" sx={{ color: 'white', fontWeight: 600 }}>
                                        {pres.paciente_nombre} {pres.paciente_apellido || ''}
                                      </Typography>
                                      <Typography variant="caption" sx={{ color: '#999' }}>
                                        {pres.paciente_dni ? `DNI: ${pres.paciente_dni} · ` : ''} Creado: {pres.creado_en?.split(' ')[0] || '-'}
                                      </Typography>
                                    </Box>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                      <Chip 
                                        label={`${pres.sesiones_completadas || 0}/${pres.sesiones_totales || 0} sesiones`}
                                        size="small"
                                        sx={{ backgroundColor: '#4A4A4A', color: 'white', fontSize: '0.7rem' }}
                                      />
                                      <Chip 
                                        label={pres.estado === 'completado' ? 'Completado' : pres.estado === 'activo' ? 'Activo' : pres.estado}
                                        size="small"
                                        sx={{ backgroundColor: `${estadoColor}30`, color: estadoColor, fontWeight: 600, fontSize: '0.7rem' }}
                                      />
                                      <Chip 
                                        label={pagoLabel}
                                        size="small"
                                        sx={{ backgroundColor: `${pagoColor}30`, color: pagoColor, fontWeight: 600, fontSize: '0.7rem' }}
                                      />
                                    </Box>
                                  </Box>
                                  
                                  {/* Tratamientos del presupuesto */}
                                  <Box sx={{ mb: 1.5 }}>
                                    {tratamientos.map((trat, idx) => (
                                      <Box key={idx} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5, borderBottom: idx < tratamientos.length - 1 ? '1px solid #4A4A4A' : 'none' }}>
                                        <Typography variant="body2" sx={{ color: '#ddd', fontSize: '0.8rem' }}>
                                          {trat.nombre || trat.tratamiento || 'Tratamiento'}
                                          {trat.sesiones > 1 ? ` (${trat.sesiones} ses.)` : ''}
                                        </Typography>
                                        <Typography variant="body2" sx={{ color: BRAND_COLORS.warning, fontWeight: 600, fontSize: '0.8rem' }}>
                                          S/ {Number(trat.precio || 0).toFixed(2)}
                                        </Typography>
                                      </Box>
                                    ))}
                                  </Box>

                                  {/* Resumen financiero del presupuesto */}
                                  <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                                    <Box sx={{ flex: 1, textAlign: 'center', backgroundColor: '#2D2D2D', p: 1, borderRadius: 1 }}>
                                      <Typography variant="caption" sx={{ color: '#999' }}>Total</Typography>
                                      <Typography variant="body2" sx={{ color: 'white', fontWeight: 600 }}>S/ {precioTotal.toFixed(2)}</Typography>
                                    </Box>
                                    {descuento > 0 && (
                                      <Box sx={{ flex: 1, textAlign: 'center', backgroundColor: '#2D2D2D', p: 1, borderRadius: 1 }}>
                                        <Typography variant="caption" sx={{ color: '#999' }}>Descuento</Typography>
                                        <Typography variant="body2" sx={{ color: '#f44336', fontWeight: 600 }}>-S/ {descuento.toFixed(2)}</Typography>
                                      </Box>
                                    )}
                                    <Box sx={{ flex: 1, textAlign: 'center', backgroundColor: '#2D2D2D', p: 1, borderRadius: 1 }}>
                                      <Typography variant="caption" sx={{ color: '#999' }}>Pagado</Typography>
                                      <Typography variant="body2" sx={{ color: '#4CAF50', fontWeight: 600 }}>S/ {pagado.toFixed(2)}</Typography>
                                    </Box>
                                    <Box sx={{ flex: 1, textAlign: 'center', backgroundColor: '#2D2D2D', p: 1, borderRadius: 1 }}>
                                      <Typography variant="caption" sx={{ color: '#999' }}>Saldo</Typography>
                                      <Typography variant="body2" sx={{ color: saldo > 0 ? '#ff9800' : '#4CAF50', fontWeight: 600 }}>S/ {saldo.toFixed(2)}</Typography>
                                    </Box>
                                  </Box>
                                </Paper>
                              );
                            })}
                          </Box>
                        )}
                      </Box>
                    )}

                    {/* Tab 1: Tratamientos realizados */}
                    {tabDetalleModal === 1 && (
                      <Box>
                        {!detallePersonalData || !detallePersonalData.tratamientos || detallePersonalData.tratamientos.length === 0 ? (
                          <Alert severity="info" sx={{ backgroundColor: '#3A3A3A', color: '#ccc', '& .MuiAlert-icon': { color: '#81c784' } }}>
                            No hay tratamientos realizados en el período seleccionado.
                          </Alert>
                        ) : (
                          <TableContainer>
                            <Table size="small">
                              <TableHead>
                                <TableRow>
                                  <TableCell sx={{ color: '#999', borderColor: '#4A4A4A', fontWeight: 600 }}>Tratamiento</TableCell>
                                  <TableCell align="center" sx={{ color: '#999', borderColor: '#4A4A4A', fontWeight: 600 }}>Sesiones</TableCell>
                                  <TableCell align="right" sx={{ color: '#999', borderColor: '#4A4A4A', fontWeight: 600 }}>Ingresos</TableCell>
                                </TableRow>
                              </TableHead>
                              <TableBody>
                                {detallePersonalData.tratamientos.map((trat, idx) => (
                                  <TableRow key={idx}>
                                    <TableCell sx={{ color: 'white', borderColor: '#4A4A4A' }}>{trat.tratamiento_nombre}</TableCell>
                                    <TableCell align="center" sx={{ color: '#81c784', borderColor: '#4A4A4A', fontWeight: 600 }}>{trat.total_sesiones}</TableCell>
                                    <TableCell align="right" sx={{ color: BRAND_COLORS.warning, borderColor: '#4A4A4A', fontWeight: 600 }}>
                                      S/ {Number(trat.total_ingresos || 0).toFixed(2)}
                                    </TableCell>
                                  </TableRow>
                                ))}
                                <TableRow>
                                  <TableCell sx={{ color: 'white', borderColor: '#4A4A4A', fontWeight: 700 }}>Total</TableCell>
                                  <TableCell align="center" sx={{ color: '#81c784', borderColor: '#4A4A4A', fontWeight: 700 }}>
                                    {detallePersonalData.tratamientos.reduce((s, t) => s + t.total_sesiones, 0)}
                                  </TableCell>
                                  <TableCell align="right" sx={{ color: BRAND_COLORS.warning, borderColor: '#4A4A4A', fontWeight: 700 }}>
                                    S/ {Number(detallePersonalData.totales?.total_ingresos || 0).toFixed(2)}
                                  </TableCell>
                                </TableRow>
                              </TableBody>
                            </Table>
                          </TableContainer>
                        )}
                      </Box>
                    )}

                    {/* Tab 2: Historial de pagos */}
                    {tabDetalleModal === 2 && (
                      <Box>
                        {historialPagos.length === 0 ? (
                          <Alert severity="info" sx={{ backgroundColor: '#3A3A3A', color: '#ccc', '& .MuiAlert-icon': { color: '#81c784' } }}>
                            No hay pagos registrados para este especialista.
                          </Alert>
                        ) : (
                          <TableContainer>
                            <Table size="small">
                              <TableHead>
                                <TableRow>
                                  <TableCell sx={{ color: '#999', borderColor: '#4A4A4A', fontWeight: 600 }}>Fecha</TableCell>
                                  <TableCell align="right" sx={{ color: '#999', borderColor: '#4A4A4A', fontWeight: 600 }}>Monto</TableCell>
                                  <TableCell sx={{ color: '#999', borderColor: '#4A4A4A', fontWeight: 600 }}>Método</TableCell>
                                  <TableCell sx={{ color: '#999', borderColor: '#4A4A4A', fontWeight: 600 }}>Referencia</TableCell>
                                  <TableCell sx={{ color: '#999', borderColor: '#4A4A4A', fontWeight: 600 }}>Estado</TableCell>
                                </TableRow>
                              </TableHead>
                              <TableBody>
                                {historialPagos.map((pago) => (
                                  <TableRow key={pago.id}>
                                    <TableCell sx={{ color: 'white', borderColor: '#4A4A4A' }}>{pago.fecha_pago}</TableCell>
                                    <TableCell align="right" sx={{ color: '#4CAF50', borderColor: '#4A4A4A', fontWeight: 600 }}>
                                      S/ {Number(pago.monto || 0).toFixed(2)}
                                    </TableCell>
                                    <TableCell sx={{ color: '#ddd', borderColor: '#4A4A4A', textTransform: 'capitalize' }}>{pago.metodo_pago || '-'}</TableCell>
                                    <TableCell sx={{ color: '#ddd', borderColor: '#4A4A4A' }}>{pago.referencia || '-'}</TableCell>
                                    <TableCell sx={{ borderColor: '#4A4A4A' }}>
                                      <Chip label={pago.estado || 'pagado'} size="small" sx={{ backgroundColor: '#4CAF5030', color: '#4CAF50', fontSize: '0.7rem', textTransform: 'capitalize' }} />
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </TableContainer>
                        )}
                      </Box>
                    )}
                  </>
                )}
              </DialogContent>
            </>
          );
        })()}
      </Dialog>
        </>
      )}

      {/* Pestaña: Pagos del mes */}
      {tabActual === 1 && (
        <Paper elevation={0} sx={{ p: 3, backgroundColor: "white", borderRadius: 2, border: `1px solid ${BRAND_COLORS.secondary}` }}>
          <Typography variant="h6" sx={{ mb: 3 }}>Nómina del mes</Typography>
          <Alert severity="info">Funcionalidad en desarrollo</Alert>
        </Paper>
      )}

      {/* Pestaña: Historial */}
      {tabActual === 2 && (
        <Paper elevation={0} sx={{ p: 3, backgroundColor: "white", borderRadius: 2, border: `1px solid ${BRAND_COLORS.secondary}` }}>
          <Typography variant="h6" sx={{ mb: 3 }}>Historial de pagos</Typography>
          <Alert severity="info">Funcionalidad en desarrollo</Alert>
        </Paper>
      )}

      {/* Pestaña: Configuración */}
      {tabActual === 3 && (
        <Paper elevation={0} sx={{ p: 3, backgroundColor: "white", borderRadius: 2, border: `1px solid ${BRAND_COLORS.secondary}` }}>
          <Typography variant="h6" sx={{ mb: 3 }}>Configuración</Typography>
          <Alert severity="info">Funcionalidad en desarrollo</Alert>
        </Paper>
      )}

      {/* Pestaña: Usuarios del Sistema (solo master) */}
      {isMaster && tabActual === 4 && (
        <GestionUsuarios />
      )}

      {/* REMOVED DUPLICATE USER MANAGEMENT CODE */}
      {false && isMaster && tabActual === 3 && (
        <Paper elevation={0} sx={{ p: 3, mt: 4, borderRadius: 3, border: "1px solid rgba(163,105,32,0.2)", backgroundColor: "#fffdf7" }}>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
            <Typography variant="h6" sx={{ fontWeight: "bold", color: "#a36920", display: "flex", alignItems: "center", gap: 1 }}>
              <VpnKey /> Gestión de Usuarios
            </Typography>
            <Button
              variant="contained"
              startIcon={<PersonAdd />}
              onClick={() => setOpenCreateUser(true)}
              sx={{ backgroundColor: "#a36920", "&:hover": { backgroundColor: "#8a5a1a" } }}
            >
              Crear Usuario
            </Button>
          </Box>
          <Divider sx={{ mb: 2 }} />
          {usuarios.length === 0 ? (
            <Typography color="text.secondary">No se encontraron usuarios.</Typography>
          ) : (
            <Grid container spacing={2}>
              {usuarios.map((u) => (
                <Grid item xs={12} sm={6} md={4} key={u.id}>
                  <Paper elevation={2} sx={{ p: 2, borderRadius: 2, border: "1px solid #e0d6c2", backgroundColor: "#f5f1e4" }}>
                    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 1.5 }}>
                      <Box>
                        <Typography sx={{ fontWeight: "bold", color: "#333", fontSize: "1rem" }}>{u.username}</Typography>
                        <Chip 
                          label={u.role} 
                          size="small" 
                          sx={{ 
                            mt: 0.5, 
                            backgroundColor: u.role === "master" ? "#a36920" : u.role === "doctor" ? "#ba9a63" : "#e0d6c2", 
                            color: u.role === "master" || u.role === "doctor" ? "white" : "#555", 
                            fontWeight: 600, 
                            fontSize: "0.7rem" 
                          }} 
                        />
                      </Box>
                      {u.role !== "master" && (
                        <IconButton 
                          size="small" 
                          onClick={() => eliminarUsuario(u.id, u.username)} 
                          sx={{ color: "#d32f2f" }}
                        >
                          <Delete fontSize="small" />
                        </IconButton>
                      )}
                    </Box>
                    
                    <Divider sx={{ my: 1.5 }} />
                    
                    <Stack spacing={1}>
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<Lock />}
                        fullWidth
                        onClick={() => { setPasswordEditing(u.id); setNewPassword(""); setShowPassword(false); }}
                        sx={{ 
                          borderColor: "#a36920", 
                          color: "#a36920",
                          fontSize: "0.75rem",
                          "&:hover": { borderColor: "#8a5a1a", backgroundColor: "rgba(163,105,32,0.05)" }
                        }}
                      >
                        Cambiar Contraseña
                      </Button>
                      
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<LockOpen />}
                        fullWidth
                        onClick={() => abrirEditarPermisos(u)}
                        sx={{ 
                          borderColor: "#ba9a63", 
                          color: "#ba9a63",
                          fontSize: "0.75rem",
                          "&:hover": { borderColor: "#a36920", backgroundColor: "rgba(186,154,99,0.05)" }
                        }}
                      >
                        Gestionar Permisos
                      </Button>
                    </Stack>
                    
                    {passwordEditing === u.id && (
                      <Box sx={{ mt: 1.5, p: 1.5, backgroundColor: "white", borderRadius: 1, border: "1px solid #e0d6c2" }}>
                        <TextField
                          size="small"
                          fullWidth
                          type={showPassword ? "text" : "password"}
                          label="Nueva contraseña"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") cambiarPassword(u.id); }}
                          InputProps={{
                            endAdornment: (
                              <IconButton size="small" onClick={() => setShowPassword(!showPassword)}>
                                {showPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                              </IconButton>
                            ),
                          }}
                          sx={{ mb: 1 }}
                        />
                        <Box sx={{ display: "flex", gap: 1 }}>
                          <Button 
                            size="small" 
                            variant="contained" 
                            onClick={() => cambiarPassword(u.id)} 
                            disabled={savingPassword} 
                            sx={{ backgroundColor: "#a36920", "&:hover": { backgroundColor: "#8a5a1a" }, fontSize: "0.75rem" }}
                          >
                            {savingPassword ? "Guardando..." : "Guardar"}
                          </Button>
                          <Button 
                            size="small" 
                            onClick={() => { setPasswordEditing(null); setNewPassword(""); }} 
                            sx={{ color: "#ba9a63", fontSize: "0.75rem" }}
                          >
                            Cancelar
                          </Button>
                        </Box>
                      </Box>
                    )}
                    
                    {u.permissions && u.permissions.length > 0 && (
                      <Box sx={{ mt: 1.5, pt: 1.5, borderTop: "1px solid #e0d6c2" }}>
                        <Typography variant="caption" sx={{ color: "#666", fontWeight: "bold", display: "block", mb: 0.5 }}>
                          Permisos activos:
                        </Typography>
                        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                          {u.permissions.filter(p => p.can_access).map((perm, idx) => (
                            <Chip
                              key={idx}
                              label={availableModules.find(m => m.key === perm.module_name)?.name || perm.module_name}
                              size="small"
                              icon={perm.can_edit ? <CheckCircle /> : undefined}
                              sx={{ 
                                fontSize: "0.65rem", 
                                height: 20,
                                backgroundColor: perm.can_edit ? "#4caf50" : "#ba9a63",
                                color: "white"
                              }}
                            />
                          ))}
                        </Box>
                      </Box>
                    )}
                  </Paper>
                </Grid>
              ))}
            </Grid>
          )}
        </Paper>
      )}

      {/* Dialog: Crear Usuario */}
      <Dialog open={openCreateUser} onClose={() => setOpenCreateUser(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ background: "linear-gradient(135deg, #a36920 0%, #c48a3a 100%)", color: "white" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <PersonAdd />
            <Typography variant="h6">Crear Nuevo Usuario</Typography>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Nombre de usuario"
                value={newUser.username}
                onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                size="small"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                type={showPassword ? "text" : "password"}
                label="Contraseña"
                value={newUser.password}
                onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                size="small"
                InputProps={{
                  endAdornment: (
                    <IconButton size="small" onClick={() => setShowPassword(!showPassword)}>
                      {showPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                    </IconButton>
                  ),
                }}
              />
            </Grid>
            <Grid item xs={12}>
              <FormControl fullWidth size="small">
                <InputLabel>Rol</InputLabel>
                <Select
                  value={newUser.role}
                  onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                  label="Rol"
                >
                  <MenuItem value="asistente">Asistente</MenuItem>
                  <MenuItem value="logistica">Logística</MenuItem>
                  <MenuItem value="doctor">Doctor</MenuItem>
                  <MenuItem value="doctora">Doctora</MenuItem>
                  <MenuItem value="admin">Admin</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <Divider sx={{ my: 1 }} />
              <Typography variant="subtitle2" sx={{ fontWeight: "bold", color: "#a36920", mb: 1.5 }}>
                Permisos de Módulos
              </Typography>
              <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 300 }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: "bold", backgroundColor: "#f5f1e4" }}>Módulo</TableCell>
                      <TableCell align="center" sx={{ fontWeight: "bold", backgroundColor: "#f5f1e4" }}>Acceso</TableCell>
                      <TableCell align="center" sx={{ fontWeight: "bold", backgroundColor: "#f5f1e4" }}>Edición</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {availableModules.map((mod) => (
                      <TableRow key={mod.key} hover>
                        <TableCell>{mod.name}</TableCell>
                        <TableCell align="center">
                          <IconButton
                            size="small"
                            onClick={() => toggleNewUserPermission(mod.key, 'can_access')}
                            sx={{ color: getNewUserPermission(mod.key, 'can_access') ? "#4caf50" : "#ccc" }}
                          >
                            {getNewUserPermission(mod.key, 'can_access') ? <CheckCircle /> : <Cancel />}
                          </IconButton>
                        </TableCell>
                        <TableCell align="center">
                          <IconButton
                            size="small"
                            onClick={() => toggleNewUserPermission(mod.key, 'can_edit')}
                            sx={{ color: getNewUserPermission(mod.key, 'can_edit') ? "#4caf50" : "#ccc" }}
                          >
                            {getNewUserPermission(mod.key, 'can_edit') ? <CheckCircle /> : <Cancel />}
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setOpenCreateUser(false)} sx={{ color: "#ba9a63" }}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            onClick={crearUsuario}
            disabled={creatingUser}
            sx={{ backgroundColor: "#a36920", "&:hover": { backgroundColor: "#8a5a1a" } }}
          >
            {creatingUser ? "Creando..." : "Crear Usuario"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog: Editar Permisos */}
      <Dialog open={openPermissionsDialog} onClose={() => setOpenPermissionsDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ background: "linear-gradient(135deg, #a36920 0%, #c48a3a 100%)", color: "white" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <LockOpen />
            <Typography variant="h6">Gestionar Permisos</Typography>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 400 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: "bold", backgroundColor: "#f5f1e4" }}>Módulo</TableCell>
                  <TableCell align="center" sx={{ fontWeight: "bold", backgroundColor: "#f5f1e4" }}>Acceso</TableCell>
                  <TableCell align="center" sx={{ fontWeight: "bold", backgroundColor: "#f5f1e4" }}>Edición</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {tempPermissions.map((perm) => (
                  <TableRow key={perm.module_name} hover>
                    <TableCell>{perm.module_label}</TableCell>
                    <TableCell align="center">
                      <IconButton
                        size="small"
                        onClick={() => togglePermission(perm.module_name, 'can_access')}
                        sx={{ color: perm.can_access ? "#4caf50" : "#ccc" }}
                      >
                        {perm.can_access ? <CheckCircle /> : <Cancel />}
                      </IconButton>
                    </TableCell>
                    <TableCell align="center">
                      <IconButton
                        size="small"
                        onClick={() => togglePermission(perm.module_name, 'can_edit')}
                        sx={{ color: perm.can_edit ? "#4caf50" : "#ccc" }}
                      >
                        {perm.can_edit ? <CheckCircle /> : <Cancel />}
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setOpenPermissionsDialog(false)} sx={{ color: "#ba9a63" }}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            onClick={guardarPermisos}
            sx={{ backgroundColor: "#a36920", "&:hover": { backgroundColor: "#8a5a1a" } }}
          >
            Guardar Permisos
          </Button>
        </DialogActions>
      </Dialog>


      {/* Modal de Detalle */}
      <Dialog
        open={modalDetalle.abierto}
        onClose={cerrarModalDetalle}
        maxWidth="lg"
        fullWidth
        PaperProps={{
          elevation: 8,
          sx: { borderRadius: 2 }
        }}
      >
        <DialogTitle 
          sx={{ 
            background: "linear-gradient(135deg, #a36920 0%, #c48a3a 100%)",
            color: "white",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center"
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center" }}>
            <Person sx={{ mr: 1, fontSize: 30 }} />
            <Typography variant="h6" component="span">
              Detalle Completo - {modalDetalle.especialista?.especialista_nombre}
            </Typography>
          </Box>
          <IconButton onClick={cerrarModalDetalle} sx={{ color: "white" }}>
            <Close />
          </IconButton>
        </DialogTitle>
        
        <DialogContent sx={{ mt: 3, minHeight: 400 }}>
          {loadingDetalle ? (
            <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: 300 }}>
              <CircularProgress size={60} sx={{ color: "#a36920" }} />
            </Box>
          ) : modalDetalle.datos && modalDetalle.datos.sesiones ? (
            <>
              {/* Resumen del Especialista */}
              {(() => {
                const esp = modalDetalle.especialista;
                const totales = modalDetalle.datos.totales || {};
                const espBackend = modalDetalle.datos.especialista || {};
                // Preferir datos del backend (actualizados) sobre los del frontend (pueden estar desactualizados)
                const porcentaje = espBackend.comision_porcentaje ?? esp?.comision_porcentaje ?? 20;
                const pagoFijo = espBackend.pago_fijo ?? esp?.pago_fijo ?? 0;
                const ingresos = Number(totales.total_ingresos || 0);
                const sesiones = totales.total_sesiones || 0;
                // Usar cálculos del backend si están disponibles, sino calcular localmente
                const comisionCalc = totales.comision_calculada != null ? Number(totales.comision_calculada) : ingresos * (porcentaje / 100);
                const pagoTotalEsp = totales.pago_total_especialista != null ? Number(totales.pago_total_especialista) : comisionCalc + pagoFijo;
                const ganancia = totales.ganancia_clinica != null ? Number(totales.ganancia_clinica) : Math.max(0, ingresos - pagoTotalEsp);
                return (
              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={6} sm={2.4}>
                  <Card variant="outlined" sx={{ textAlign: "center", borderColor: "#a36920" }}>
                    <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
                      <Typography variant="h5" sx={{ fontWeight: "bold", color: "#a36920" }}>
                        {sesiones}
                      </Typography>
                      <Typography variant="caption" sx={{ color: "#666" }}>Total Sesiones</Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={6} sm={2.4}>
                  <Card variant="outlined" sx={{ textAlign: "center", borderColor: "#4caf50" }}>
                    <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
                      <Typography variant="h5" sx={{ fontWeight: "bold", color: "#4caf50" }}>
                        S/ {ingresos.toFixed(2)}
                      </Typography>
                      <Typography variant="caption" sx={{ color: "#666" }}>Ingresos</Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={6} sm={2.4}>
                  <Card variant="outlined" sx={{ textAlign: "center", borderColor: "#ff9800" }}>
                    <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
                      <Typography variant="h5" sx={{ fontWeight: "bold", color: "#ff9800" }}>
                        S/ {pagoTotalEsp.toFixed(2)}
                      </Typography>
                      <Typography variant="caption" sx={{ color: "#666" }}>
                        Pago Esp. ({porcentaje}%{pagoFijo > 0 ? ` + S/ ${Number(pagoFijo).toFixed(2)} fijo` : ""})
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={6} sm={2.4}>
                  <Card variant="outlined" sx={{ textAlign: "center", borderColor: "#2e7d32" }}>
                    <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
                      <Typography variant="h5" sx={{ fontWeight: "bold", color: "#2e7d32" }}>
                        S/ {ganancia.toFixed(2)}
                      </Typography>
                      <Typography variant="caption" sx={{ color: "#666" }}>Ganancia Clínica</Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={6} sm={2.4}>
                  <Card variant="outlined" sx={{ textAlign: "center", borderColor: "#9c27b0" }}>
                    <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
                      <Typography variant="h5" sx={{ fontWeight: "bold", color: "#9c27b0" }}>
                        S/ {sesiones > 0 ? (ingresos / sesiones).toFixed(2) : "0.00"}
                      </Typography>
                      <Typography variant="caption" sx={{ color: "#666" }}>Prom. Sesión</Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
                );
              })()}

              {/* Resumen por Tratamiento */}
              {modalDetalle.datos.tratamientos && modalDetalle.datos.tratamientos.length > 0 && (
                <Box sx={{ mb: 3 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: "bold", color: "#a36920", mb: 1 }}>
                    Resumen por Tratamiento
                  </Typography>
                  <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
                    {modalDetalle.datos.tratamientos.map((trat, idx) => (
                      <Chip
                        key={idx}
                        label={`${trat.tratamiento_nombre} (${trat.total_sesiones} ses. - S/ ${Number(trat.total_ingresos).toFixed(2)})`}
                        variant="outlined"
                        size="small"
                        sx={{ borderColor: "#a36920", color: "#333" }}
                      />
                    ))}
                  </Box>
                  <Divider sx={{ mt: 2 }} />
                </Box>
              )}

              {/* Tabla Detallada Tipo Historial Clínico */}
              <Typography variant="h6" sx={{ mb: 2, fontWeight: "bold", color: "#a36920" }}>
                Historial de Tratamientos Realizados
              </Typography>
              
              {modalDetalle.datos.sesiones.length > 0 ? (
                <TableContainer sx={{ maxHeight: 600 }}>
                  <Table stickyHeader size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight: "bold", bgcolor: "#f5f5f5" }}>Fecha</TableCell>
                        <TableCell sx={{ fontWeight: "bold", bgcolor: "#f5f5f5" }}>Paciente</TableCell>
                        <TableCell sx={{ fontWeight: "bold", bgcolor: "#f5f5f5" }}>Tratamiento</TableCell>
                        <TableCell sx={{ fontWeight: "bold", bgcolor: "#f5f5f5" }}>Tipo</TableCell>
                        <TableCell sx={{ fontWeight: "bold", bgcolor: "#f5f5f5" }}>Paquete</TableCell>
                        <TableCell sx={{ fontWeight: "bold", bgcolor: "#f5f5f5" }}>Productos Usados</TableCell>
                        <TableCell align="right" sx={{ fontWeight: "bold", bgcolor: "#f5f5f5" }}>Precio</TableCell>
                        <TableCell align="right" sx={{ fontWeight: "bold", bgcolor: "#f5f5f5" }}>Descuento</TableCell>
                        <TableCell align="right" sx={{ fontWeight: "bold", bgcolor: "#fff3e0" }}>Total</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {modalDetalle.datos.sesiones.map((sesion, idx) => (
                        <TableRow key={idx} sx={{ "&:hover": { backgroundColor: "#f9f9f9" } }}>
                          <TableCell>
                            <Box sx={{ display: "flex", alignItems: "center" }}>
                              <CalendarToday sx={{ fontSize: 16, mr: 1, color: "#666" }} />
                              <Typography variant="body2" sx={{ whiteSpace: "nowrap" }}>
                                {formatearFechaCorta(sesion.fecha_realizada)}
                              </Typography>
                            </Box>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" sx={{ fontWeight: "bold" }}>
                              {sesion.paciente_completo}
                            </Typography>
                            {sesion.paciente_dni && (
                              <Typography variant="caption" sx={{ color: "#666" }}>
                                DNI: {sesion.paciente_dni}
                              </Typography>
                            )}
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" sx={{ fontWeight: "bold" }}>
                              {sesion.tratamiento_nombre}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Chip 
                              label={sesion.tipo} 
                              size="small"
                              color={sesion.tipo === 'Paquete' ? 'info' : 'success'}
                            />
                          </TableCell>
                          <TableCell>
                            {sesion.paquete_nombre ? (
                              <Box>
                                <Typography variant="body2" sx={{ fontWeight: "bold" }}>
                                  {sesion.paquete_nombre}
                                </Typography>
                                <Typography variant="caption" sx={{ color: "#666" }}>
                                  Sesión {sesion.sesion_numero}
                                </Typography>
                              </Box>
                            ) : (
                              <Typography variant="body2" sx={{ color: "#999" }}>-</Typography>
                            )}
                          </TableCell>
                          <TableCell>
                            {sesion.productos_usados && sesion.productos_usados.length > 0 ? (
                              <Box>
                                {sesion.productos_usados.map((prod, pIdx) => (
                                  <Typography key={pIdx} variant="caption" sx={{ display: "block" }}>
                                    • {prod.nombre || prod.variante_nombre || 'Producto'} 
                                    {prod.cantidad && ` (${prod.cantidad})`}
                                  </Typography>
                                ))}
                              </Box>
                            ) : (
                              <Typography variant="caption" sx={{ color: "#999" }}>Sin productos</Typography>
                            )}
                          </TableCell>
                          <TableCell align="right">
                            <Typography variant="body2">
                              S/ {Number(sesion.precio_sesion || 0).toFixed(2)}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            {sesion.descuento_aplicado > 0 ? (
                              <Chip 
                                label={`-${Number(sesion.descuento_aplicado).toFixed(0)}%`}
                                size="small"
                                color="warning"
                              />
                            ) : (
                              <Typography variant="body2" sx={{ color: "#999" }}>-</Typography>
                            )}
                          </TableCell>
                          <TableCell align="right" sx={{ bgcolor: "#fff3e0" }}>
                            <Typography variant="body2" sx={{ fontWeight: "bold", color: "#4caf50" }}>
                              S/ {Number(sesion.precio_final || sesion.precio_sesion || 0).toFixed(2)}
                            </Typography>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              ) : (
                <Alert severity="info">No hay tratamientos registrados para este especialista.</Alert>
              )}

              {/* Tabla de Productos Usados */}
              {modalDetalle.datos.sesiones && modalDetalle.datos.sesiones.length > 0 && (() => {
                const productosUsados = [];
                modalDetalle.datos.sesiones.forEach(sesion => {
                  if (sesion.productos_usados && sesion.productos_usados.length > 0) {
                    sesion.productos_usados.forEach(prod => {
                      const key = `${prod.nombre || prod.variante_nombre || 'Producto'}_${prod.variante_id || ''}`;
                      const existing = productosUsados.find(p => 
                        `${p.nombre}_${p.variante_id}` === key
                      );
                      if (existing) {
                        existing.cantidad_total += parseFloat(prod.cantidad || 0);
                        existing.veces_usado += 1;
                      } else {
                        productosUsados.push({
                          nombre: prod.nombre || prod.variante_nombre || 'Producto',
                          variante_id: prod.variante_id,
                          cantidad_total: parseFloat(prod.cantidad || 0),
                          veces_usado: 1,
                          precio_unitario: prod.precio || 0
                        });
                      }
                    });
                  }
                });

                return productosUsados.length > 0 ? (
                  <Box sx={{ mt: 4 }}>
                    <Typography variant="h6" sx={{ mb: 2, fontWeight: "bold", color: "#a36920" }}>
                      Productos Usados
                    </Typography>
                    <TableContainer component={Paper} elevation={1}>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell sx={{ fontWeight: "bold", bgcolor: "#f5f5f5" }}>Producto</TableCell>
                            <TableCell align="center" sx={{ fontWeight: "bold", bgcolor: "#f5f5f5" }}>Cantidad Total Usada</TableCell>
                            <TableCell align="center" sx={{ fontWeight: "bold", bgcolor: "#f5f5f5" }}>Veces Usado</TableCell>
                            <TableCell align="right" sx={{ fontWeight: "bold", bgcolor: "#f5f5f5" }}>Costo Unit.</TableCell>
                            <TableCell align="right" sx={{ fontWeight: "bold", bgcolor: "#fff3e0" }}>Subtotal</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {productosUsados.map((prod, idx) => (
                            <TableRow key={idx} sx={{ "&:hover": { backgroundColor: "#f9f9f9" } }}>
                              <TableCell>
                                <Typography variant="body2" sx={{ fontWeight: "bold" }}>
                                  {prod.nombre}
                                </Typography>
                              </TableCell>
                              <TableCell align="center">
                                <Chip 
                                  label={`${prod.cantidad_total.toFixed(2)} ml`}
                                  size="small"
                                  color="info"
                                  sx={{ fontWeight: "bold" }}
                                />
                              </TableCell>
                              <TableCell align="center">
                                <Typography variant="body2" sx={{ color: "#666" }}>
                                  {prod.veces_usado} {prod.veces_usado === 1 ? 'vez' : 'veces'}
                                </Typography>
                              </TableCell>
                              <TableCell align="right">
                                <Typography variant="body2">
                                  S/ {Number(prod.precio_unitario).toFixed(2)}
                                </Typography>
                              </TableCell>
                              <TableCell align="right" sx={{ bgcolor: "#fff3e0" }}>
                                <Typography variant="body2" sx={{ fontWeight: "bold", color: "#f57c00" }}>
                                  S/ {(prod.cantidad_total * prod.precio_unitario).toFixed(2)}
                                </Typography>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Box>
                ) : null;
              })()}
            </>
          ) : (
            <Alert severity="warning">No se pudo cargar la información del especialista.</Alert>
          )}
        </DialogContent>
        
        <DialogActions sx={{ p: 2, bgcolor: "#f5f5f5" }}>
          <Button 
            onClick={cerrarModalDetalle} 
            variant="contained"
            sx={{ 
              backgroundColor: "#a36920",
              "&:hover": { backgroundColor: "#8a5a1a" }
            }}
          >
            Cerrar
          </Button>
        </DialogActions>
      </Dialog>

      {/* Modal: Registrar Pago */}
      <Dialog open={modalRegistrarPago.abierto} onClose={() => setModalRegistrarPago({ abierto: false, trabajador: null })} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ background: `linear-gradient(135deg, ${BRAND_COLORS.primary} 0%, ${BRAND_COLORS.primaryDark} 100%)`, color: "white" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Payment />
            <Typography variant="h6">Registrar Pago</Typography>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ mt: 3 }}>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <Typography variant="body2" sx={{ mb: 2, color: "#666" }}>
                Trabajador: <strong>{modalRegistrarPago.trabajador?.especialista_nombre}</strong>
              </Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Monto a pagar"
                type="number"
                value={datoPago.monto}
                onChange={(e) => setDatoPago({ ...datoPago, monto: parseFloat(e.target.value) })}
                InputProps={{
                  startAdornment: <Typography sx={{ mr: 1 }}>S/</Typography>
                }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Fecha de pago"
                type="date"
                value={datoPago.fecha}
                onChange={(e) => setDatoPago({ ...datoPago, fecha: e.target.value })}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Método de pago</InputLabel>
                <Select
                  value={datoPago.metodo}
                  onChange={(e) => setDatoPago({ ...datoPago, metodo: e.target.value })}
                  label="Método de pago"
                >
                  <MenuItem value="efectivo">Efectivo</MenuItem>
                  <MenuItem value="transferencia">Transferencia</MenuItem>
                  <MenuItem value="yape">Yape</MenuItem>
                  <MenuItem value="plin">Plin</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Referencia / Nº Operación"
                value={datoPago.referencia}
                onChange={(e) => setDatoPago({ ...datoPago, referencia: e.target.value })}
                placeholder="Opcional"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setModalRegistrarPago({ abierto: false, trabajador: null })} sx={{ color: "#666" }}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            onClick={registrarPago}
            sx={{ backgroundColor: BRAND_COLORS.primary, "&:hover": { backgroundColor: BRAND_COLORS.primaryDark } }}
          >
            Confirmar Pago
          </Button>
        </DialogActions>
      </Dialog>

      {/* Modal: Editar Datos */}
      <Dialog open={modalEditarDatos.abierto} onClose={() => setModalEditarDatos({ abierto: false, trabajador: null })} maxWidth="md" fullWidth>
        <DialogTitle sx={{ background: `linear-gradient(135deg, ${BRAND_COLORS.primary} 0%, ${BRAND_COLORS.primaryDark} 100%)`, color: "white" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Edit />
            <Typography variant="h6">Editar Datos del Trabajador</Typography>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ mt: 3 }}>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <Typography variant="body2" sx={{ mb: 2, color: "#666" }}>
                Trabajador: <strong>{modalEditarDatos.trabajador?.especialista_nombre}</strong>
              </Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="DNI"
                value={datoEdicion.dni}
                onChange={(e) => setDatoEdicion({ ...datoEdicion, dni: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Especialidad"
                value={datoEdicion.especialidad}
                onChange={(e) => setDatoEdicion({ ...datoEdicion, especialidad: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Fecha de ingreso"
                type="date"
                value={datoEdicion.fecha_ingreso}
                onChange={(e) => setDatoEdicion({ ...datoEdicion, fecha_ingreso: e.target.value })}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Tipo de contrato</InputLabel>
                <Select
                  value={datoEdicion.tipo_contrato}
                  onChange={(e) => setDatoEdicion({ ...datoEdicion, tipo_contrato: e.target.value })}
                  label="Tipo de contrato"
                >
                  <MenuItem value="indefinido">Indefinido</MenuItem>
                  <MenuItem value="temporal">Temporal</MenuItem>
                  <MenuItem value="por_servicios">Por servicios</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Sueldo fijo mensual"
                type="number"
                value={datoEdicion.sueldo_fijo}
                onChange={(e) => setDatoEdicion({ ...datoEdicion, sueldo_fijo: parseFloat(e.target.value) })}
                InputProps={{
                  startAdornment: <Typography sx={{ mr: 1 }}>S/</Typography>
                }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="% Comisión"
                type="number"
                value={datoEdicion.comision_porcentaje}
                onChange={(e) => setDatoEdicion({ ...datoEdicion, comision_porcentaje: parseFloat(e.target.value) })}
                InputProps={{
                  endAdornment: <Typography sx={{ ml: 1 }}>%</Typography>
                }}
                inputProps={{ min: 0, max: 100 }}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Cuenta bancaria"
                value={datoEdicion.cuenta_bancaria}
                onChange={(e) => setDatoEdicion({ ...datoEdicion, cuenta_bancaria: e.target.value })}
                placeholder="Banco - Nº Cuenta"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setModalEditarDatos({ abierto: false, trabajador: null })} sx={{ color: "#666" }}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            onClick={guardarEdicionDatos}
            sx={{ backgroundColor: BRAND_COLORS.primary, "&:hover": { backgroundColor: BRAND_COLORS.primaryDark } }}
          >
            Guardar Cambios
          </Button>
        </DialogActions>
      </Dialog>

      {/* Modal: Historial de Pagos */}
      <Dialog open={modalHistorial.abierto} onClose={() => setModalHistorial({ abierto: false, trabajador: null })} maxWidth="lg" fullWidth>
        <DialogTitle sx={{ background: `linear-gradient(135deg, ${BRAND_COLORS.primary} 0%, ${BRAND_COLORS.primaryDark} 100%)`, color: "white" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <History />
            <Typography variant="h6">Historial de Pagos</Typography>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ mt: 3 }}>
          <Typography variant="body2" sx={{ mb: 3, color: "#666" }}>
            Trabajador: <strong>{modalHistorial.trabajador?.especialista_nombre}</strong>
          </Typography>
          {historialPagos.length === 0 ? (
            <Alert severity="info">No hay pagos registrados para este trabajador.</Alert>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600 }}>Fecha</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600 }}>Monto</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Método</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Mes/Año</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Referencia</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Estado</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {historialPagos.map((pago) => (
                    <TableRow key={pago.id}>
                      <TableCell>{pago.fecha_pago}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600, color: BRAND_COLORS.success }}>
                        S/ {Number(pago.monto || 0).toFixed(2)}
                      </TableCell>
                      <TableCell sx={{ textTransform: 'capitalize' }}>{pago.metodo_pago || '-'}</TableCell>
                      <TableCell>{pago.mes && pago.anio ? `${pago.mes}/${pago.anio}` : '-'}</TableCell>
                      <TableCell>{pago.referencia || '-'}</TableCell>
                      <TableCell>
                        <Chip label={pago.estado || 'pagado'} size="small" color="success" variant="outlined" sx={{ textTransform: 'capitalize' }} />
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>Total</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, color: BRAND_COLORS.primary }}>
                      S/ {historialPagos.reduce((s, p) => s + Number(p.monto || 0), 0).toFixed(2)}
                    </TableCell>
                    <TableCell colSpan={4} />
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button 
            onClick={() => setModalHistorial({ abierto: false, trabajador: null })} 
            variant="contained"
            sx={{ backgroundColor: BRAND_COLORS.primary, "&:hover": { backgroundColor: BRAND_COLORS.primaryDark } }}
          >
            Cerrar
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default GestionClinica;
