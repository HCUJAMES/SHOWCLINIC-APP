import React, { useEffect, useState } from "react";
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
} from "@mui/material";
import { ArrowBack, Home, Receipt, Edit, Delete, Print, Close, Description } from "@mui/icons-material";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { generarProformaPDF, generarProformaPaquete } from "../utils/generarProformaPDF";
import generarConsentimientoPDF from "../utils/generarConsentimientoPDF";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { useToast } from "../components/ToastProvider";
import ReciboTicket from "../components/ReciboTicket";
import ReciboConsolidado from "../components/ReciboConsolidado";

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
  const { showToast } = useToast();
  const [pacientes, setPacientes] = useState([]);
  const [filtro, setFiltro] = useState("");
  const [pacienteSeleccionado, setPacienteSeleccionado] = useState(null);
  const [tratamientos, setTratamientos] = useState([]);
  const [resumenDeuda, setResumenDeuda] = useState({ cantidad_pendiente: 0, total_pendiente: 0 });
  const [nuevaObservacion, setNuevaObservacion] = useState("");
  const [observaciones, setObservaciones] = useState([]);
  const [guardandoObservaciones, setGuardandoObservaciones] = useState(false);
  const [observacionEditId, setObservacionEditId] = useState(null);
  const [observacionEditTexto, setObservacionEditTexto] = useState("");
  const [guardandoObservacionEdit, setGuardandoObservacionEdit] = useState(false);
  const [tratamientosBase, setTratamientosBase] = useState([]);
  const [paquetesActivos, setPaquetesActivos] = useState([]);
  const [paquetesPaciente, setPaquetesPaciente] = useState([]);
  const [asignandoPaquete, setAsignandoPaquete] = useState(false);
  const [presupuestosAsignados, setPresupuestosAsignados] = useState([]);
  const [asignandoPresupuesto, setAsignandoPresupuesto] = useState(false);
  const [showOferta, setShowOferta] = useState(false);
  const [ofertaItems, setOfertaItems] = useState([]);
  const [guardandoOferta, setGuardandoOferta] = useState(false);
  const [ofertas, setOfertas] = useState([]);
  const [ofertaEditId, setOfertaEditId] = useState(null);
  const [subiendoFotoPerfil, setSubiendoFotoPerfil] = useState(false);
  const [fotosTratamiento, setFotosTratamiento] = useState([]);
  const [tratamientoSeleccionado, setTratamientoSeleccionado] = useState(null);

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
  const [editPrecio, setEditPrecio] = useState(0);
  const [editDescuento, setEditDescuento] = useState(0);
  const [editPagoMetodo, setEditPagoMetodo] = useState("Efectivo");
  const [editTipoAtencion, setEditTipoAtencion] = useState("Tratamiento");
  const [editFecha, setEditFecha] = useState("");
  const [modalDescuento, setModalDescuento] = useState(false);
  const [descuentoProforma, setDescuentoProforma] = useState(0);
  const [presupuestoParaProforma, setPresupuestoParaProforma] = useState(null);

  // Estados para modal de descuento de presupuesto
  const [modalDescuentoPresupuesto, setModalDescuentoPresupuesto] = useState(false);
  const [presupuestoParaDescuento, setPresupuestoParaDescuento] = useState(null);
  const [nuevoDescuento, setNuevoDescuento] = useState(0);

  // Estados para confirmar cancelación
  const [openConfirmarCancelar, setOpenConfirmarCancelar] = useState(false);
  const [tratamientoCancelar, setTratamientoCancelar] = useState(null);

  // Estados para modal de pago de presupuesto
  const [modalPagoPresupuesto, setModalPagoPresupuesto] = useState(false);
  const [presupuestoParaPago, setPresupuestoParaPago] = useState(null);
  const [montoPago, setMontoPago] = useState(0);
  const [metodoPago, setMetodoPago] = useState("efectivo");
  const [tipoPago, setTipoPago] = useState("total"); // 'total', 'adelanto', 'saldo'

  // Estados para modal de pago de paquete
  const [modalPagoPaquete, setModalPagoPaquete] = useState(false);
  const [paqueteParaPago, setPaqueteParaPago] = useState(null);
  
  // Estado para controlar qué presupuestos están colapsados
  const [presupuestosColapsados, setPresupuestosColapsados] = useState({});
  
  // Estado para controlar qué paquetes están colapsados
  const [paquetesColapsados, setPaquetesColapsados] = useState({});

  const token = localStorage.getItem("token");
  const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};

  useEffect(() => {
    axios
      .get(`${API_BASE_URL}/api/pacientes/listar`, { headers: authHeaders })
      .then((res) => setPacientes(res.data))
      .catch((err) => console.error("Error al obtener pacientes:", err));

    axios
      .get(`${API_BASE_URL}/api/tratamientos/listar`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      .then((res) => setTratamientosBase(Array.isArray(res.data) ? res.data : []))
      .catch((err) => {
        console.error("Error al obtener tratamientos base:", err);
        setTratamientosBase([]);
      });

    // Cargar paquetes activos
    axios
      .get(`${API_BASE_URL}/api/paquetes`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      .then((res) => {
        const activos = (res.data || []).filter(p => p.estado === 'activo');
        setPaquetesActivos(activos);
      })
      .catch((err) => {
        console.error("Error al obtener paquetes:", err);
        setPaquetesActivos([]);
      });
  }, []);

  const cargarHistorial = async (id) => {
    try {
      const paciente = pacientes.find((p) => p.id === id) || null;
      setPacienteSeleccionado(paciente);
      setResumenDeuda({ cantidad_pendiente: 0, total_pendiente: 0 });

      setNuevaObservacion("");
      setShowOferta(false);
      setOfertaItems([]);
      setOfertaEditId(null);
      setObservacionEditId(null);
      setObservacionEditTexto("");
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

      const res = await axios.get(`${API_BASE_URL}/api/tratamientos/historial/${id}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      setTratamientos(res.data);

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
    } catch (error) {
      console.error("Error al obtener historial clínico:", error);
    }
  };

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
    try {
      await axios.patch(
        `${API_BASE_URL}/api/paquetes/sesion/${sesionId}/completar`,
        {},
        { headers: authHeaders }
      );
      
      showToast({ severity: "success", message: "Sesión completada" });
      
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

  // Asignar presupuesto al paciente
  const asignarPresupuesto = async (oferta) => {
    if (!pacienteSeleccionado?.id) return;
    
    setAsignandoPresupuesto(true);
    try {
      await axios.post(
        `${API_BASE_URL}/api/paquetes/presupuesto/asignar`,
        {
          paciente_id: pacienteSeleccionado.id,
          oferta_id: oferta.id,
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
    try {
      await axios.patch(
        `${API_BASE_URL}/api/paquetes/presupuesto/sesion/${sesionId}/completar`,
        {},
        { headers: authHeaders }
      );
      
      showToast({ severity: "success", message: "Tratamiento completado" });
      
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
        { descuento: nuevoDescuento },
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

  const subirFotoPerfil = async (file) => {
    if (!pacienteSeleccionado?.id || !file) return;
    try {
      setSubiendoFotoPerfil(true);
      const formData = new FormData();
      formData.append("foto", file);
      const res = await axios.post(
        `${API_BASE_URL}/api/pacientes/${pacienteSeleccionado.id}/foto-perfil`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
            ...authHeaders,
          },
        }
      );

      const fotoPerfil = res?.data?.fotoPerfil;
      if (fotoPerfil) {
        const updated = { ...pacienteSeleccionado, fotoPerfil };
        setPacienteSeleccionado(updated);
        setPacientes((prev) =>
          prev.map((p) => (p.id === updated.id ? { ...p, fotoPerfil } : p))
        );
      }

      showToast({ severity: "success", message: "Foto de perfil actualizada" });
    } catch (e) {
      console.error("Error al subir foto de perfil:", e);
      showToast({ severity: "error", message: "Error al subir foto de perfil" });
    } finally {
      setSubiendoFotoPerfil(false);
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

  // Generar recibo PDF del paquete completado
  const generarReciboPaquete = (paquete) => {
    if (!pacienteSeleccionado || !paquete) return;

    const doc = new jsPDF("p", "mm", [80, 200]);
    const pageWidth = 80;
    let y = 10;

    // Logo y encabezado
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("SHOWCLINIC", pageWidth / 2, y, { align: "center" });
    y += 6;

    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text("Centro de Estética", pageWidth / 2, y, { align: "center" });
    y += 8;

    // Línea separadora
    doc.setDrawColor(200);
    doc.line(5, y, pageWidth - 5, y);
    y += 5;

    // Título del recibo
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("RECIBO DE PAQUETE", pageWidth / 2, y, { align: "center" });
    y += 6;

    // Datos del paciente
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    const nombrePaciente = `${pacienteSeleccionado.nombre || ""} ${pacienteSeleccionado.apellido || ""}`.trim();
    doc.text(`Cliente: ${nombrePaciente}`, 5, y);
    y += 4;
    doc.text(`Documento: ${pacienteSeleccionado.tipoDocumento || 'DNI'}: ${pacienteSeleccionado.dni || "-"}`, 5, y);
    y += 4;
    doc.text(`Fecha: ${new Date().toLocaleDateString("es-PE")}`, 5, y);
    y += 6;

    // Línea separadora
    doc.line(5, y, pageWidth - 5, y);
    y += 5;

    // Nombre del paquete
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text(paquete.paquete_nombre, pageWidth / 2, y, { align: "center" });
    y += 6;

    // Sesiones realizadas
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    
    if (paquete.sesiones && paquete.sesiones.length > 0) {
      paquete.sesiones.forEach((sesion) => {
        const estado = sesion.estado === 'completada' ? '✓' : '○';
        const fecha = sesion.fecha_realizada ? sesion.fecha_realizada.split(' ')[0] : '-';
        doc.text(`${estado} ${sesion.tratamiento_nombre}`, 5, y);
        y += 3.5;
        doc.text(`   Sesión ${sesion.sesion_numero} - ${fecha}`, 5, y);
        y += 4;
      });
    }

    y += 2;
    // Línea separadora
    doc.line(5, y, pageWidth - 5, y);
    y += 5;

    // Total
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("TOTAL PAQUETE:", 5, y);
    doc.text(`S/ ${(paquete.precio_total || 0).toFixed(2)}`, pageWidth - 5, y, { align: "right" });
    y += 6;

    // Estado
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text(`Estado: ${paquete.estado.toUpperCase()}`, pageWidth / 2, y, { align: "center" });
    y += 6;

    // Línea separadora
    doc.line(5, y, pageWidth - 5, y);
    y += 5;

    // Mensaje de agradecimiento
    doc.setFontSize(7);
    doc.text("¡Gracias por su preferencia!", pageWidth / 2, y, { align: "center" });
    y += 4;
    doc.text("ShowClinic - Tu belleza, nuestra pasión", pageWidth / 2, y, { align: "center" });

    // Abrir en nueva ventana para imprimir
    const pdfBlob = doc.output("blob");
    const pdfUrl = URL.createObjectURL(pdfBlob);
    window.open(pdfUrl, "_blank");
  };

  const toggleOfertaItem = (t) => {
    setOfertaItems((prev) => {
      const exists = prev.some((x) => x.tratamientoId === t.id);
      if (exists) return prev.filter((x) => x.tratamientoId !== t.id);
      return [...prev, { tratamientoId: t.id, nombre: t.nombre, precio: "" }];
    });
  };

  const setOfertaPrecio = (tratamientoId, value) => {
    setOfertaItems((prev) =>
      prev.map((x) =>
        x.tratamientoId === tratamientoId ? { ...x, precio: value } : x
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
        })),
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

  const pacientesFiltrados = pacientes.filter(
    (p) =>
      p.nombre.toLowerCase().includes(filtro.toLowerCase()) ||
      p.apellido.toLowerCase().includes(filtro.toLowerCase())
  );

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

    const tabla = tratamientos.map((t) => [
      t.fecha ? t.fecha.split(" ")[0] : "-",
      t.nombreTratamiento || "—",
      t.tipoAtencion || "-",
      t.especialista || "No especificado",
      `S/ ${(t.precio_total || 0).toFixed(2)}`,
      `${t.descuento || 0}%`,
      t.pagoMetodo || "-",
      t.sesion ?? "-",
    ]);

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
          "Tipo Atención",
          "Especialista",
          "Total",
          "Desc.",
          "Pago",
          "Sesión",
        ],
      ],
      body: tabla,
      theme: "striped",
      headStyles: { fillColor: colorPrincipal, textColor: 255, fontStyle: "bold" },
      styles: { fontSize: 9, cellPadding: 4, valign: "middle" },
      alternateRowStyles: { fillColor: [247, 242, 234] },
      columnStyles: {
        0: { cellWidth: 60 },
        4: { halign: "right", cellWidth: 55 },
        5: { halign: "center", cellWidth: 40 },
        7: { halign: "center", cellWidth: 40 },
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
    setEditPrecio(tratamiento.precio_total || 0);
    setEditDescuento(tratamiento.descuento || 0);
    setEditPagoMetodo(tratamiento.pagoMetodo || "Efectivo");
    setEditTipoAtencion(tratamiento.tipoAtencion || "Tratamiento");
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
          precio_total: editPrecio,
          descuento: editDescuento,
          pagoMetodo: editPagoMetodo,
          tipoAtencion: editTipoAtencion,
          fecha: editFecha,
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
        padding: "40px 20px",
      }}
    >
      <Container maxWidth="lg">
        <Paper
          sx={{
            p: 5,
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
              sx={{ flex: 1, color: "#a36920", fontWeight: "bold", textAlign: "center" }}
            >
              Historial Clínico de Pacientes
            </Typography>
            <IconButton onClick={() => navigate("/dashboard")} sx={{ color: "#a36920" }} title="Inicio">
              <Home />
            </IconButton>
          </Box>

          {!pacienteSeleccionado ? (
            <>
              <Box
                sx={{
                  display: "flex",
                  flexDirection: { xs: "column", md: "row" },
                  gap: 2,
                  alignItems: { xs: "stretch", md: "center" },
                  justifyContent: "space-between",
                  mb: 3,
                }}
              >
                <TextField
                  label="Buscar paciente"
                  placeholder="Escribe nombre o apellido"
                  fullWidth
                  value={filtro}
                  onChange={(e) => setFiltro(e.target.value)}
                  sx={{
                    flex: 1,
                    "& .MuiInputBase-root": {
                      backgroundColor: "rgba(255,255,255,0.72)",
                      borderRadius: 2,
                    },
                  }}
                />
                <Box
                  sx={{
                    minWidth: { xs: "auto", md: 240 },
                    textAlign: { xs: "left", md: "right" },
                  }}
                >
                  <Typography
                    variant="body2"
                    sx={{ color: "rgba(0,0,0,0.60)", lineHeight: 1.4 }}
                  >
                    Selecciona un paciente para ver tratamientos,
                    cargar fotos y exportar PDF.
                  </Typography>
                </Box>
              </Box>

              <Grid container spacing={2.2}>
                {pacientesFiltrados.map((pac) => (
                  <Grid item xs={12} md={6} key={pac.id}>
                    <Paper
                      sx={{
                        p: 2.2,
                        display: "flex",
                        gap: 2,
                        justifyContent: "space-between",
                        alignItems: "center",
                        borderRadius: 3,
                        border: "1px solid rgba(212,175,55,0.22)",
                        backgroundColor: "rgba(255,255,255,0.70)",
                        boxShadow: "0 10px 24px rgba(0,0,0,0.08)",
                      }}
                    >
                      <Box sx={{ minWidth: 0 }}>
                        <Typography
                          fontWeight="bold"
                          sx={{ color: "#2E2E2E", lineHeight: 1.15 }}
                        >
                          {pac.nombre} {pac.apellido}
                        </Typography>
                        <Typography
                          variant="body2"
                          sx={{ color: "rgba(0,0,0,0.60)", mt: 0.4 }}
                        >
                          Documento: {pac.tipoDocumento || 'DNI'}: {pac.dni}
                        </Typography>
                      </Box>
                      <Button
                        variant="contained"
                        sx={{
                          backgroundColor: "#a36920",
                          "&:hover": { backgroundColor: "#8b581b" },
                          borderRadius: 3,
                          px: 2.4,
                          py: 1.0,
                          fontWeight: "bold",
                        }}
                        onClick={() => cargarHistorial(pac.id)}
                      >
                        Ver historial
                      </Button>
                    </Paper>
                  </Grid>
                ))}
              </Grid>
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
                <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap" }}>
                  <Button
                    variant="outlined"
                    onClick={() => setPacienteSeleccionado(null)}
                    sx={{
                      borderColor: "#a36920",
                      color: "#a36920",
                      borderRadius: 3,
                      "&:hover": { backgroundColor: "#f7f2ea" },
                      fontWeight: "bold",
                    }}
                  >
                    Volver
                  </Button>
                  <Box sx={{ textAlign: { xs: "left", sm: "left" }, display: "flex", gap: 2, flexWrap: "wrap" }}>
                    <Button
                      variant="contained"
                      sx={{
                        backgroundColor: "#a36920",
                        "&:hover": { backgroundColor: "#8b581b" },
                        borderRadius: 3,
                        fontWeight: "bold",
                      }}
                      onClick={generarPDF}
                    >
                      Exportar PDF
                    </Button>
                    <Button
                      variant="outlined"
                      startIcon={<Description />}
                      sx={{
                        borderColor: "#a36920",
                        color: "#a36920",
                        "&:hover": { 
                          borderColor: "#8b581b",
                          backgroundColor: "rgba(163, 105, 32, 0.04)"
                        },
                        borderRadius: 3,
                        fontWeight: "bold",
                      }}
                      onClick={() => generarConsentimientoPDF(pacienteSeleccionado)}
                    >
                      Consentimiento Informado
                    </Button>
                  </Box>
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
              <Typography
                variant="h6"
                sx={{ color: "#a36920", fontWeight: "bold", mb: 2 }}
              >
                Información completa del paciente
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
                <Grid container spacing={2.2}>
                  <Grid item xs={12} md={4}>
                    <Paper
                      elevation={0}
                      sx={{
                        p: 2,
                        borderRadius: 3,
                        backgroundColor: "rgba(255,255,255,0.78)",
                        border: "1px solid rgba(163,105,32,0.16)",
                      }}
                    >
                      <Typography sx={{ fontWeight: "bold", color: "#a36920", mb: 1 }}>
                        Foto de perfil
                      </Typography>

                      <Avatar
                        variant="rounded"
                        src={
                          pacienteSeleccionado?.fotoPerfil
                            ? `${API_BASE_URL}${pacienteSeleccionado.fotoPerfil}`
                            : undefined
                        }
                        sx={{
                          width: "100%",
                          height: { xs: 240, md: 280 },
                          borderRadius: 3,
                          border: "2px solid rgba(163,105,32,0.22)",
                          boxShadow: "0 12px 26px rgba(0,0,0,0.10)",
                          bgcolor: "rgba(163,105,32,0.12)",
                          color: "#a36920",
                          fontWeight: "bold",
                          fontSize: 64,
                        }}
                      >
                        {`${pacienteSeleccionado?.nombre || ""} ${pacienteSeleccionado?.apellido || ""}`
                          .trim()
                          .slice(0, 1)
                          .toUpperCase() || "P"}
                      </Avatar>

                      <Button
                        fullWidth
                        variant="outlined"
                        component="label"
                        disabled={subiendoFotoPerfil}
                        sx={{
                          mt: 2,
                          borderColor: "#a36920",
                          color: "#a36920",
                          fontWeight: "bold",
                          borderRadius: 3,
                          "&:hover": { backgroundColor: "rgba(163,105,32,0.08)" },
                        }}
                      >
                        {pacienteSeleccionado?.fotoPerfil ? "Cambiar foto" : "Subir foto"}
                        <input
                          hidden
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) subirFotoPerfil(file);
                            e.target.value = "";
                          }}
                        />
                      </Button>
                    </Paper>
                  </Grid>

                  <Grid item xs={12} md={8}>
                    <Grid container spacing={2.2}>
                      <Grid item xs={12} md={6}>
                        <Box sx={{ display: "grid", gap: 0.8 }}>
                          <Typography><strong>Documento:</strong> {pacienteSeleccionado.tipoDocumento || 'DNI'}: {pacienteSeleccionado.dni}</Typography>
                          <Typography><strong>Nombre:</strong> {pacienteSeleccionado.nombre}</Typography>
                          <Typography><strong>Apellido:</strong> {pacienteSeleccionado.apellido}</Typography>
                          <Typography><strong>Edad:</strong> {pacienteSeleccionado.edad}</Typography>
                          <Typography><strong>Sexo:</strong> {pacienteSeleccionado.sexo}</Typography>
                          <Typography><strong>Embarazada:</strong> {pacienteSeleccionado.embarazada || "No especifica"}</Typography>
                          <Typography><strong>Ocupación:</strong> {pacienteSeleccionado.ocupacion}</Typography>
                          <Typography><strong>Fecha Nacimiento:</strong> {pacienteSeleccionado.fechaNacimiento}</Typography>
                          <Typography><strong>Ciudad Nacimiento:</strong> {pacienteSeleccionado.ciudadNacimiento}</Typography>
                          <Typography><strong>Ciudad Residencia:</strong> {pacienteSeleccionado.ciudadResidencia}</Typography>
                        </Box>
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <Box sx={{ display: "grid", gap: 0.8 }}>
                          <Typography><strong>Correo:</strong> {pacienteSeleccionado.correo}</Typography>
                          <Typography><strong>Celular:</strong> {pacienteSeleccionado.celular}</Typography>
                          <Typography><strong>Dirección:</strong> {pacienteSeleccionado.direccion}</Typography>
                          <Typography><strong>Alergias:</strong> {pacienteSeleccionado.alergias || "Ninguna"}</Typography>
                          <Typography><strong>Enfermedades:</strong> {pacienteSeleccionado.enfermedad || "Ninguna"}</Typography>
                          <Typography><strong>Cirugía estética:</strong> {pacienteSeleccionado.cirugiaEstetica || "No"}</Typography>
                          <Typography><strong>Consume tabaco:</strong> {pacienteSeleccionado.tabaco || "No"}</Typography>
                          <Typography><strong>Consume alcohol:</strong> {pacienteSeleccionado.alcohol || "No"}</Typography>
                          <Typography><strong>Consume drogas:</strong> {pacienteSeleccionado.drogas || "No"}</Typography>
                          <Typography><strong>Referencia:</strong> {pacienteSeleccionado.referencia || "No especificada"}</Typography>
                          <Typography><strong>Número de hijos:</strong> {pacienteSeleccionado.numeroHijos ?? "No registrado"}</Typography>
                        </Box>
                      </Grid>
                    </Grid>
                  </Grid>
                </Grid>
              </Paper>

              <Typography
                variant="h6"
                sx={{ color: "#a36920", fontWeight: "bold", mb: 2 }}
              >
                Otras observaciones
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
                <TextField
                  fullWidth
                  multiline
                  minRows={4}
                  placeholder="Escribe aquí cualquier observación adicional..."
                  value={nuevaObservacion}
                  onChange={(e) => setNuevaObservacion(e.target.value)}
                  sx={{
                    "& .MuiInputBase-root": {
                      backgroundColor: "rgba(255,255,255,0.72)",
                      borderRadius: 2,
                    },
                  }}
                />
                <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 2 }}>
                  <Button
                    variant="contained"
                    sx={{
                      backgroundColor: "#a36920",
                      "&:hover": { backgroundColor: "#8b581b" },
                      borderRadius: 3,
                      fontWeight: "bold",
                    }}
                    disabled={guardandoObservaciones}
                    onClick={guardarObservacion}
                  >
                    Guardar observación
                  </Button>
                </Box>

                {Array.isArray(observaciones) && observaciones.length > 0 && (
                  <Box sx={{ mt: 2 }}>
                    <Typography
                      variant="subtitle2"
                      sx={{ color: "rgba(0,0,0,0.70)", mb: 1, fontWeight: "bold" }}
                    >
                      Historial de observaciones
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
                            p: 1.6,
                            borderRadius: 2,
                            backgroundColor: "rgba(255,255,255,0.78)",
                            border: "1px solid rgba(163,105,32,0.16)",
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
                                  color: "rgba(0,0,0,0.58)",
                                  mb: 0.5,
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
                                      backgroundColor: "rgba(255,255,255,0.72)",
                                      borderRadius: 2,
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
              </Paper>

              <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 2, flexWrap: "wrap" }}>
                <Typography
                  variant="h6"
                  sx={{ color: "#a36920", fontWeight: "bold" }}
                >
                  Presupuesto inicial
                </Typography>
                <Button
                  variant="outlined"
                  sx={{
                    borderColor: "#a36920",
                    color: "#a36920",
                    fontWeight: "bold",
                    borderRadius: 3,
                    "&:hover": { backgroundColor: "rgba(163,105,32,0.08)" },
                  }}
                  onClick={() => setShowOferta((v) => !v)}
                  disabled={!pacienteSeleccionado}
                >
                  {showOferta ? "Cerrar" : "Agregar nuevo presupuesto"}
                </Button>
                <Button
                  variant="contained"
                  sx={{
                    backgroundColor: "#4caf50",
                    color: "white",
                    fontWeight: "bold",
                    borderRadius: 3,
                    "&:hover": { backgroundColor: "#388e3c" },
                  }}
                  onClick={() => {
                    // Scroll hacia la sección de paquetes promocionales
                    const paquetesSection = document.getElementById("paquetes-promocionales");
                    if (paquetesSection) {
                      paquetesSection.scrollIntoView({ behavior: "smooth" });
                    }
                  }}
                  disabled={!pacienteSeleccionado}
                >
                  📦 Agregar Paquete
                </Button>
              </Box>

              {showOferta && (
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
                  <Typography sx={{ mb: 1.5, fontWeight: "bold" }}>
                    {ofertaEditId
                      ? "Editando oferta (ajusta tratamientos y precios)"
                      : "Selecciona tratamientos y asigna precio especial"}
                  </Typography>

                  <Box
                    sx={{
                      display: "grid",
                      gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
                      gap: 1.2,
                      mb: 2,
                      maxHeight: 260,
                      overflowY: "auto",
                      pr: 0.5,
                    }}
                  >
                    {tratamientosBase.map((t) => {
                      const selected = ofertaItems.some(
                        (x) => x.tratamientoId === t.id
                      );
                      const item = ofertaItems.find(
                        (x) => x.tratamientoId === t.id
                      );
                      return (
                        <Paper
                          key={t.id}
                          elevation={0}
                          sx={{
                            p: 1.6,
                            borderRadius: 2,
                            backgroundColor: selected
                              ? "rgba(163,105,32,0.10)"
                              : "rgba(255,255,255,0.78)",
                            border: "1px solid rgba(163,105,32,0.16)",
                          }}
                        >
                          <Box
                            sx={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              gap: 1.5,
                              mb: 1,
                            }}
                          >
                            <Typography sx={{ fontWeight: "bold" }}>
                              {t.nombre}
                            </Typography>
                            <Button
                              size="small"
                              variant={selected ? "contained" : "outlined"}
                              sx={{
                                backgroundColor: selected ? "#a36920" : "transparent",
                                borderColor: "#a36920",
                                color: selected ? "white" : "#a36920",
                                "&:hover": {
                                  backgroundColor: selected
                                    ? "#8b581b"
                                    : "rgba(163,105,32,0.08)",
                                },
                                borderRadius: 3,
                                fontWeight: "bold",
                              }}
                              onClick={() => toggleOfertaItem(t)}
                            >
                              {selected ? "Quitar" : "Agregar"}
                            </Button>
                          </Box>

                          {selected && (
                            <TextField
                              fullWidth
                              label="Precio especial (S/)"
                              type="number"
                              value={item?.precio ?? ""}
                              onChange={(e) =>
                                setOfertaPrecio(t.id, e.target.value)
                              }
                              sx={{
                                "& .MuiInputBase-root": {
                                  backgroundColor: "rgba(255,255,255,0.72)",
                                  borderRadius: 2,
                                },
                              }}
                            />
                          )}
                        </Paper>
                      );
                    })}
                  </Box>

                  <Box
                    sx={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 2,
                      flexWrap: "wrap",
                    }}
                  >
                    <Typography sx={{ fontWeight: "bold" }}>
                      Total: S/ {totalOferta.toFixed(2)}
                    </Typography>
                    {ofertaEditId && (
                      <Button
                        variant="outlined"
                        sx={{
                          borderColor: "#a36920",
                          color: "#a36920",
                          fontWeight: "bold",
                          borderRadius: 3,
                          "&:hover": { backgroundColor: "rgba(163,105,32,0.08)" },
                        }}
                        onClick={() => {
                          setOfertaEditId(null);
                          setOfertaItems([]);
                          setShowOferta(false);
                        }}
                      >
                        Cancelar edición
                      </Button>
                    )}
                    <Button
                      variant="contained"
                      sx={{
                        backgroundColor: "#a36920",
                        "&:hover": { backgroundColor: "#8b581b" },
                        borderRadius: 3,
                        fontWeight: "bold",
                      }}
                      disabled={guardandoOferta}
                      onClick={guardarOferta}
                    >
                      {ofertaEditId ? "Guardar cambios" : "Guardar oferta"}
                    </Button>
                  </Box>
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
                  <Box sx={{ display: "grid", gap: 2 }}>
                    {ofertas.map((o) => {
                      const items = o.items || [];
                      const totalItems = items.length;
                      
                      return (
                        <Paper
                          key={o.id}
                          elevation={0}
                          sx={{
                            p: 2,
                            borderRadius: 2,
                            backgroundColor: "white",
                            border: "1px solid rgba(163, 105, 32, 0.2)",
                          }}
                        >
                          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 1 }}>
                            <Box>
                              <Typography sx={{ fontWeight: "bold", color: "#333" }}>
                                Presupuesto
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                Creado: {o.creado_en?.split(' ')[0] || o.creado_en}
                              </Typography>
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
                          
                          {/* Lista de tratamientos del presupuesto */}
                          <Box sx={{ mt: 1 }}>
                            <Typography variant="caption" sx={{ fontWeight: "bold", color: "#666", mb: 1, display: "block" }}>
                              Tratamientos:
                            </Typography>
                            <Box sx={{ display: "grid", gap: 0.5 }}>
                              {items.map((it, idx) => (
                                <Box
                                  key={`${o.id}-${idx}`}
                                  sx={{
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                    p: 1,
                                    backgroundColor: "rgba(163, 105, 32, 0.05)",
                                    borderRadius: 1,
                                    border: "1px solid rgba(163, 105, 32, 0.1)",
                                  }}
                                >
                                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                                    <Box sx={{
                                      width: 20,
                                      height: 20,
                                      borderRadius: "50%",
                                      backgroundColor: "#a36920",
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      fontSize: "0.7rem",
                                      color: "white"
                                    }}>
                                      {idx + 1}
                                    </Box>
                                    <Typography variant="body2">
                                      {it.nombre}
                                    </Typography>
                                  </Box>
                                  <Typography variant="body2" sx={{ fontWeight: "bold", color: "#a36920" }}>
                                    S/ {Number(it.precio || 0).toFixed(2)}
                                  </Typography>
                                </Box>
                              ))}
                            </Box>
                          </Box>

                          {/* Total del presupuesto y botones */}
                          <Box sx={{ mt: 2, pt: 1, borderTop: "1px dashed #e0e0e0", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 1 }}>
                            <Box>
                              <Typography variant="body2" color="text.secondary">
                                Subtotal:
                              </Typography>
                              <Typography sx={{ fontWeight: "bold", color: "#666", fontSize: "0.95rem" }}>
                                S/ {Number(o.total || 0).toFixed(2)}
                              </Typography>
                              {Number(o.descuento || 0) > 0 && (
                                <Box sx={{ mt: 0.5 }}>
                                  <Typography variant="body2" color="error" sx={{ fontSize: "0.85rem" }}>
                                    Descuento: -S/ {Number(o.descuento).toFixed(2)}
                                  </Typography>
                                  <Typography sx={{ fontWeight: "bold", color: "#a36920", fontSize: "1.1rem" }}>
                                    Total: S/ {(Number(o.total || 0) - Number(o.descuento || 0)).toFixed(2)}
                                  </Typography>
                                </Box>
                              )}
                              {Number(o.descuento || 0) === 0 && (
                                <Typography sx={{ fontWeight: "bold", color: "#a36920", fontSize: "1.1rem" }}>
                                  Total: S/ {Number(o.total || 0).toFixed(2)}
                                </Typography>
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
                                disabled={asignandoPresupuesto}
                                onClick={() => asignarPresupuesto(o)}
                                sx={{
                                  fontSize: "0.7rem",
                                  py: 0.5,
                                  borderRadius: 2,
                                  backgroundColor: "#4caf50",
                                  "&:hover": { backgroundColor: "#388e3c" }
                                }}
                              >
                                {asignandoPresupuesto ? "Asignando..." : "✓ Asignar"}
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
                                  setOfertaItems(
                                    (o.items || []).map((it) => ({
                                      tratamientoId: it.tratamientoId ?? it.tratamiento_id ?? null,
                                      nombre: it.nombre,
                                      precio: String(it.precio ?? ""),
                                    }))
                                  );
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
                  <Typography
                    variant="h6"
                    sx={{ color: "#2e7d32", fontWeight: "bold", mb: 2, display: "flex", alignItems: "center", gap: 1 }}
                  >
                    🎁 Paquetes Promocionales Disponibles
                  </Typography>
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
                  <Typography
                    variant="h6"
                    sx={{ color: "#a36920", fontWeight: "bold", mb: 2, display: "flex", alignItems: "center", gap: 1 }}
                  >
                    📋 Presupuestos Asignados
                  </Typography>
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
                                        {sesion.tratamiento_nombre}
                                      </Typography>
                                      <Typography variant="caption" color="text.secondary">
                                        (S/ {Number(sesion.precio_sesion || 0).toFixed(2)})
                                      </Typography>
                                    </Box>
                                    {sesion.estado === 'pendiente' && presupuesto.estado === 'activo' && (
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
                          <Box sx={{ mt: 2, pt: 1, borderTop: "1px dashed #e0e0e0" }}>
                            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 1 }}>
                              <Box>
                                {Number(presupuesto.descuento || 0) > 0 ? (
                                  <>
                                    <Typography variant="body2" color="text.secondary">
                                      Subtotal:
                                    </Typography>
                                    <Typography sx={{ fontWeight: "bold", color: "#666", fontSize: "0.95rem" }}>
                                      S/ {Number(presupuesto.precio_total || 0).toFixed(2)}
                                    </Typography>
                                    <Typography variant="body2" color="error" sx={{ fontSize: "0.85rem" }}>
                                      Descuento: -S/ {Number(presupuesto.descuento).toFixed(2)}
                                    </Typography>
                                    <Typography sx={{ fontWeight: "bold", color: "#a36920", fontSize: "1.1rem" }}>
                                      Total: S/ {(Number(presupuesto.precio_total || 0) - Number(presupuesto.descuento || 0)).toFixed(2)}
                                    </Typography>
                                  </>
                                ) : (
                                  <>
                                    <Typography variant="body2" color="text.secondary">
                                      Total del presupuesto:
                                    </Typography>
                                    <Typography sx={{ fontWeight: "bold", color: "#a36920", fontSize: "1.1rem" }}>
                                      S/ {Number(presupuesto.precio_total || 0).toFixed(2)}
                                    </Typography>
                                  </>
                                )}
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
                                      S/ {(presupuesto.saldo_pendiente || ((presupuesto.precio_total || 0) - (presupuesto.descuento || 0) - (presupuesto.monto_pagado || 0))).toFixed(2)}
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
                            <Box sx={{ display: "flex", gap: 1, mt: 1.5, justifyContent: "flex-end" }}>
                              {presupuesto.estado_pago !== 'pagado' && presupuesto.pagado !== 1 && (
                                <Button
                                  size="small"
                                  variant="contained"
                                  onClick={() => {
                                    setPresupuestoParaPago(presupuesto);
                                    // Calcular precio con descuento
                                    const precioConDescuento = (presupuesto.precio_total || 0) - (presupuesto.descuento || 0);
                                    const saldoPendiente = presupuesto.saldo_pendiente || (precioConDescuento - (presupuesto.monto_pagado || 0));
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
                  <Typography
                    variant="h6"
                    sx={{ color: "#1565c0", fontWeight: "bold", mb: 2, display: "flex", alignItems: "center", gap: 1 }}
                  >
                    📦 Paquetes del Paciente
                  </Typography>
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
                                      S/ {(paquete.saldo_pendiente || (paquete.precio_total - (paquete.monto_pagado || 0))).toFixed(2)}
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
                              {paquete.estado_pago !== 'pagado' && paquete.pagado !== 1 && (
                                <Button
                                  size="small"
                                  variant="contained"
                                  onClick={() => {
                                    setPaqueteParaPago(paquete);
                                    const saldoPendiente = paquete.saldo_pendiente || (paquete.precio_total - (paquete.monto_pagado || 0));
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
                      overflow: "hidden",
                      border: "1px solid rgba(212,175,55,0.18)",
                      backgroundColor: "rgba(255,255,255,0.68)",
                    }}
                  >
                    <Table stickyHeader>
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ fontWeight: "bold" }}>Fecha</TableCell>
                          <TableCell sx={{ fontWeight: "bold" }}>Tratamiento</TableCell>
                          <TableCell sx={{ fontWeight: "bold" }}>Tipo Atención</TableCell>
                          <TableCell sx={{ fontWeight: "bold" }}>Especialista</TableCell>
                          <TableCell sx={{ fontWeight: "bold" }}>Sesión</TableCell>
                          <TableCell sx={{ fontWeight: "bold" }}>Fotos</TableCell>
                          <TableCell sx={{ fontWeight: "bold" }}>Recibo</TableCell>
                          <TableCell sx={{ fontWeight: "bold" }}>Acciones</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                      {tratamientos.map((t) => {
                        const tieneFotosAntes = CAMPOS_FOTOS_ANTES.some((key) => t[key]);
                        const tieneFotosDespues = CAMPOS_FOTOS_DESPUES.some((key) => t[key]);
                        const tieneFotosLegacy = CAMPOS_FOTOS_LEGACY.some((key) => t[key]);
                        const tieneFotos = tieneFotosAntes || tieneFotosDespues || tieneFotosLegacy;

                        return (
                          <TableRow key={t.id}>
                            <TableCell>{t.fecha?.split(" ")[0]}</TableCell>
                            <TableCell>{t.nombreTratamiento}</TableCell>
                            <TableCell>{t.tipoAtencion}</TableCell>
                            <TableCell>{t.especialista}</TableCell>
                            <TableCell>{t.sesion}</TableCell>

                            <TableCell>
                              {tratamientoSeleccionado === t.id ? (
                                <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                                  <Box>
                                    <Typography variant="body2" fontWeight="bold" color="#a36920" sx={{ mb: 0.5 }}>
                                      Subir fotos (máx. 3)
                                    </Typography>
                                    <input
                                      type="file"
                                      multiple
                                      accept="image/*"
                                      onClick={(e) => (e.target.value = null)}
                                      onChange={manejarCambioFotos}
                                    />
                                  </Box>
                                  <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
                                    <Button
                                      variant="outlined"
                                      size="small"
                                      sx={{
                                        mt: 0.5,
                                        color: "#a36920",
                                        borderColor: "#a36920",
                                      }}
                                      onClick={() => subirFotos(t.id)}
                                    >
                                      Guardar Fotos
                                    </Button>
                                    <Button
                                      variant="text"
                                      size="small"
                                      sx={{
                                        mt: 0.5,
                                        color: "#a36920",
                                        textTransform: "none",
                                      }}
                                      onClick={() => abrirFotosPaciente(t.id)}
                                    >
                                      Ver fotos
                                    </Button>
                                  </Box>
                                </Box>
                              ) : (
                                <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
                                  <Button
                                    variant="text"
                                    size="small"
                                    sx={{
                                      color: "#a36920",
                                      textTransform: "none",
                                    }}
                                    onClick={() => setTratamientoSeleccionado(t.id)}
                                  >
                                    {tieneFotos ? "Actualizar fotos" : "Agregar fotos"}
                                  </Button>
                                  <Button
                                    variant="text"
                                    size="small"
                                    sx={{
                                      color: "#a36920",
                                      textTransform: "none",
                                    }}
                                    onClick={() => abrirFotosPaciente(t.id)}
                                  >
                                    Ver fotos
                                  </Button>
                                </Box>
                              )}
                            </TableCell>

                            {/* Columna de Recibo */}
                            <TableCell>
                              <IconButton
                                size="small"
                                sx={{
                                  color: "#D4AF37",
                                  "&:hover": {
                                    backgroundColor: "rgba(212,175,55,0.1)",
                                  },
                                }}
                                onClick={() => abrirReciboTratamiento(t)}
                                title="Imprimir recibo"
                              >
                                <Receipt />
                              </IconButton>
                            </TableCell>

                            {/* Columna de Acciones */}
                            <TableCell>
                              <Box sx={{ display: "flex", gap: 0.5 }}>
                                <IconButton
                                  size="small"
                                  sx={{
                                    color: "#1976d2",
                                    "&:hover": {
                                      backgroundColor: "rgba(25,118,210,0.1)",
                                    },
                                  }}
                                  onClick={() => abrirEditarTratamiento(t)}
                                  title="Editar tratamiento"
                                >
                                  <Edit />
                                </IconButton>
                                <IconButton
                                  size="small"
                                  sx={{
                                    color: "#d32f2f",
                                    "&:hover": {
                                      backgroundColor: "rgba(211,47,47,0.1)",
                                    },
                                  }}
                                  onClick={() => abrirConfirmacionCancelar(t)}
                                  title="Cancelar tratamiento"
                                >
                                  <Delete />
                                </IconButton>
                              </Box>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      </TableBody>
                    </Table>
                  </TableContainer>

                </>
              )}
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
                label="Especialista"
                value={editEspecialista}
                onChange={(e) => setEditEspecialista(e.target.value)}
              />
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
                onChange={(e) => setEditPrecio(Number(e.target.value))}
                inputProps={{ min: 0, step: 0.01 }}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Descuento (%)"
                type="number"
                value={editDescuento}
                onChange={(e) => setEditDescuento(Number(e.target.value))}
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
                {(presupuestoParaProforma.items || []).map((item, idx) => (
                  <Box
                    key={idx}
                    sx={{
                      display: "flex",
                      justifyContent: "space-between",
                      mb: 1,
                    }}
                  >
                    <Typography>{item.nombre}</Typography>
                    <Typography sx={{ fontWeight: "bold" }}>
                      S/ {Number(item.precio || 0).toFixed(2)}
                    </Typography>
                  </Box>
                ))}
                <Divider sx={{ my: 1.5 }} />
                <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                  <Typography sx={{ fontWeight: "bold" }}>Subtotal:</Typography>
                  <Typography sx={{ fontWeight: "bold" }}>
                    S/ {(presupuestoParaProforma.items || []).reduce((sum, item) => sum + Number(item.precio || 0), 0).toFixed(2)}
                  </Typography>
                </Box>
              </Box>

              <TextField
                fullWidth
                label="Descuento (S/)"
                type="number"
                value={descuentoProforma}
                onChange={(e) => setDescuentoProforma(Number(e.target.value))}
                inputProps={{ min: 0, step: 0.01 }}
                helperText="Ingresa el monto de descuento a aplicar (opcional)"
                sx={{ mb: 2 }}
              />

              <Box sx={{ p: 2, backgroundColor: "#e8f5e9", borderRadius: 2 }}>
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <Typography variant="h6" sx={{ fontWeight: "bold", color: "#2e7d32" }}>
                    Total Final:
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: "bold", color: "#2e7d32" }}>
                    S/ {(
                      (presupuestoParaProforma.items || []).reduce((sum, item) => sum + Number(item.precio || 0), 0) - descuentoProforma
                    ).toFixed(2)}
                  </Typography>
                </Box>
                {descuentoProforma > 0 && (
                  <Typography variant="caption" sx={{ color: "#666", mt: 1, display: "block" }}>
                    Ahorro: S/ {descuentoProforma.toFixed(2)}
                  </Typography>
                )}
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
                await generarProformaPDF(
                  { ...presupuestoParaProforma, descuento: descuentoProforma },
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
          💰 {nuevoDescuento > 0 ? "Editar" : "Agregar"} Descuento
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
                onChange={(e) => setNuevoDescuento(Number(e.target.value))}
                inputProps={{ min: 0, step: 0.01, max: presupuestoParaDescuento.total }}
                sx={{ mb: 2 }}
                helperText={`Máximo: S/ ${Number(presupuestoParaDescuento.total || 0).toFixed(2)}`}
              />
              
              <Box sx={{ p: 2, backgroundColor: "#fff3e0", borderRadius: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  Total con descuento:
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: "bold", color: "#ff9800" }}>
                  S/ {(Number(presupuestoParaDescuento.total || 0) - nuevoDescuento).toFixed(2)}
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
            disabled={nuevoDescuento < 0 || nuevoDescuento > (presupuestoParaDescuento?.total || 0)}
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
                      const saldo = precioConDescuento - (presupuestoParaPago.monto_pagado || 0);
                      setMontoPago(saldo > 0 ? saldo : precioConDescuento);
                    } else if (e.target.value === 'saldo') {
                      const saldoPendiente = presupuestoParaPago.saldo_pendiente || (precioConDescuento - (presupuestoParaPago.monto_pagado || 0));
                      setMontoPago(saldoPendiente);
                    }
                  }}
                  label="Tipo de Pago"
                >
                  <MenuItem value="total">💵 Pago Total</MenuItem>
                  <MenuItem value="adelanto">📝 Adelanto</MenuItem>
                  {(presupuestoParaPago.saldo_pendiente > 0 || presupuestoParaPago.estado_pago === 'adelanto') && (
                    <MenuItem value="saldo">✅ Pagar Saldo Restante</MenuItem>
                  )}
                </Select>
              </FormControl>

              <TextField
                fullWidth
                label="Monto a pagar (S/)"
                type="number"
                value={montoPago}
                onChange={(e) => setMontoPago(Number(e.target.value))}
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
                  const precioConDescuento = (presupuestoParaPago.precio_total || 0) - (presupuestoParaPago.descuento || 0);
                  const saldoPendiente = presupuestoParaPago.saldo_pendiente || (precioConDescuento - (presupuestoParaPago.monto_pagado || 0));
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
            disabled={montoPago <= 0}
            onClick={async () => {
              if (presupuestoParaPago && montoPago > 0) {
                await registrarPagoPresupuesto(presupuestoParaPago.id, montoPago, metodoPago, tipoPago);
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
                      setMontoPago(paqueteParaPago.saldo_pendiente || 0);
                    }
                  }}
                  label="Tipo de Pago"
                >
                  <MenuItem value="total">💵 Pago Total</MenuItem>
                  <MenuItem value="adelanto">📝 Adelanto</MenuItem>
                  {(paqueteParaPago.saldo_pendiente > 0 || paqueteParaPago.estado_pago === 'adelanto') && (
                    <MenuItem value="saldo">✅ Pagar Saldo Restante</MenuItem>
                  )}
                </Select>
              </FormControl>

              <TextField
                fullWidth
                label="Monto a pagar (S/)"
                type="number"
                value={montoPago}
                onChange={(e) => setMontoPago(Number(e.target.value))}
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
                {(paqueteParaPago.saldo_pendiente > 0 || (paqueteParaPago.precio_total - (paqueteParaPago.monto_pagado || 0)) > 0) && (
                  <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                    <Typography variant="body2" color="text.secondary">Saldo pendiente:</Typography>
                    <Typography sx={{ color: "#f57c00", fontWeight: "bold" }}>
                      S/ {(paqueteParaPago.saldo_pendiente || (paqueteParaPago.precio_total - (paqueteParaPago.monto_pagado || 0))).toFixed(2)}
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
            disabled={montoPago <= 0}
            onClick={async () => {
              if (paqueteParaPago && montoPago > 0) {
                await registrarPagoPaquete(paqueteParaPago.id, montoPago, metodoPago, tipoPago);
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
    </div>
  );
};

export default HistorialClinico;
