import React, { useEffect, useState, useRef, useCallback } from "react";
import useSocket from "../hooks/useSocket";
import {
  Container,
  Typography,
  TextField,
  Button,
  Grid,
  Paper,
  MenuItem,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Divider,
  Box,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tooltip,
} from "@mui/material";
import { ArrowBack, Home, CheckCircle, Delete, Edit, AttachMoney, CalendarMonth, SwapVert } from "@mui/icons-material";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { useToast } from "../components/ToastProvider";
import { formatearFechaCorta } from "../utils/dateUtils";

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

const API_BASE_URL =
  process.env.REACT_APP_API_URL || `${window.location.protocol}//${window.location.hostname}:4000`;

const Finanzas = () => {
  const navigate = useNavigate();
  const userRole = localStorage.getItem("role");
  const isMaster = userRole === "master";
  const isAdmin = userRole === "admin";
  const canDoActions = isMaster || isAdmin;
  const [paciente, setPaciente] = useState("");
  const [metodoPago, setMetodoPago] = useState("");
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");
  const [reporte, setReporte] = useState([]);
  const [totalGeneral, setTotalGeneral] = useState(0);
  const [totalBruto, setTotalBruto] = useState(0);
  const [totalComision, setTotalComision] = useState(0);
  const [totalesMetodo, setTotalesMetodo] = useState({});
  const [pagoDialogOpen, setPagoDialogOpen] = useState(false);
  const [pagoRegistro, setPagoRegistro] = useState(null);
  const [pagoMonto, setPagoMonto] = useState("");
  const [pagoMetodo, setPagoMetodo] = useState("Efectivo");
  const [guardandoPago, setGuardandoPago] = useState(false);
  const [editMetodoOpen, setEditMetodoOpen] = useState(false);
  const [editMetodoRegistro, setEditMetodoRegistro] = useState(null);
  const [editMetodoNuevo, setEditMetodoNuevo] = useState("Efectivo");
  const [guardandoMetodo, setGuardandoMetodo] = useState(false);
  const [editMontoOpen, setEditMontoOpen] = useState(false);
  const [editMontoRegistro, setEditMontoRegistro] = useState(null);
  const [editMontoNuevo, setEditMontoNuevo] = useState("");
  const [guardandoMonto, setGuardandoMonto] = useState(false);
  const [editFechaOpen, setEditFechaOpen] = useState(false);
  const [editFechaRegistro, setEditFechaRegistro] = useState(null);
  const [editFechaNueva, setEditFechaNueva] = useState("");
  const [guardandoFecha, setGuardandoFecha] = useState(false);
  const [ordenDescendente, setOrdenDescendente] = useState(false);
  const [filtroDia, setFiltroDia] = useState("");
  const [filtroMes, setFiltroMes] = useState("");
  const [filtroAnio, setFiltroAnio] = useState("");
  const [filtroRapido, setFiltroRapido] = useState("");
  const [fetchTrigger, setFetchTrigger] = useState(0);
  const [egresosDialogOpen, setEgresosDialogOpen] = useState(false);
  const [egresoFecha, setEgresoFecha] = useState("");
  const [egresoMonto, setEgresoMonto] = useState("");
  const [egresoDescripcion, setEgresoDescripcion] = useState("");
  const [egresoCategoria, setEgresoCategoria] = useState("Servicios");
  const [egresoMetodoPago, setEgresoMetodoPago] = useState("Efectivo");
  const [guardandoEgreso, setGuardandoEgreso] = useState(false);
  const [egresos, setEgresos] = useState([]);
  const [totalEgresos, setTotalEgresos] = useState(0);
  const [editandoEgreso, setEditandoEgreso] = useState(null);
  const [egresosFechaInicio, setEgresosFechaInicio] = useState("");
  const [egresosFechaFin, setEgresosFechaFin] = useState("");

  const { showToast } = useToast();

  const colorPrincipal = "#a36920";

  const ordenarReporte = (datos, descendente) => {
    return [...datos].sort((a, b) => {
      const fechaA = new Date(a.fecha);
      const fechaB = new Date(b.fecha);
      return descendente ? fechaB - fechaA : fechaA - fechaB;
    });
  };

  const toggleOrden = () => {
    const nuevoOrden = !ordenDescendente;
    setOrdenDescendente(nuevoOrden);
    setReporte(prev => ordenarReporte(prev, nuevoOrden));
  };

  const abrirDialogoPago = (r) => {
    setPagoRegistro(r);
    setPagoMonto(String(Number(r.deuda_pendiente || r.monto_bruto || r.precio_total || 0).toFixed(2)));
    setPagoMetodo("Efectivo");
    setPagoDialogOpen(true);
  };

  const registrarPago = async () => {
    if (!pagoRegistro) return;
    const monto = parseFloat(pagoMonto);
    if (isNaN(monto) || monto <= 0) {
      showToast({ severity: "warning", message: "Ingresa un monto válido" });
      return;
    }
    try {
      setGuardandoPago(true);
      const body = {
        monto,
        metodo_pago: pagoMetodo,
        tipo_registro: pagoRegistro.tipo_registro || "tratamiento",
      };
      if (pagoRegistro.tipo_registro === "tratamiento") {
        body.tratamiento_realizado_id = pagoRegistro.id;
      } else {
        body.finanza_id = pagoRegistro.id;
      }
      await axios.post(`${API_BASE_URL}/api/finanzas/pagar`, body);
      showToast({ severity: "success", message: "Pago registrado correctamente" });
      setPagoDialogOpen(false);
      obtenerReporte();
    } catch (e) {
      console.error(e);
      showToast({ severity: "error", message: "Error al registrar pago" });
    } finally {
      setGuardandoPago(false);
    }
  };

  const abrirEditarMetodo = (r) => {
    setEditMetodoRegistro(r);
    setEditMetodoNuevo(r.pagoMetodo_mostrado || r.pagoMetodo || "Efectivo");
    setEditMetodoOpen(true);
  };

  const guardarMetodoPago = async () => {
    if (!editMetodoRegistro) return;
    try {
      setGuardandoMetodo(true);
      const token = localStorage.getItem("token");
      await axios.put(`${API_BASE_URL}/api/finanzas/editar-metodo-pago`, {
        id: editMetodoRegistro.id,
        tipo_registro: editMetodoRegistro.tipo_registro || "tratamiento",
        nuevo_metodo: editMetodoNuevo,
      }, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      showToast({ severity: "success", message: "Método de pago actualizado correctamente" });
      setEditMetodoOpen(false);
      obtenerReporte();
    } catch (e) {
      console.error(e);
      showToast({ severity: "error", message: e.response?.data?.message || "Error al actualizar método de pago" });
    } finally {
      setGuardandoMetodo(false);
    }
  };

  const abrirEditarMonto = (r) => {
    setEditMontoRegistro(r);
    setEditMontoNuevo(String(Number(r.monto_bruto ?? r.precio_total ?? 0).toFixed(2)));
    setEditMontoOpen(true);
  };

  const guardarMontoPago = async () => {
    if (!editMontoRegistro) return;
    const monto = parseFloat(editMontoNuevo);
    if (isNaN(monto) || monto < 0) {
      showToast({ severity: "warning", message: "Ingresa un monto válido" });
      return;
    }
    try {
      setGuardandoMonto(true);
      const token = localStorage.getItem("token");
      await axios.put(`${API_BASE_URL}/api/finanzas/editar-monto-pago`, {
        id: editMontoRegistro.id,
        tipo_registro: editMontoRegistro.tipo_registro || "tratamiento",
        nuevo_monto: monto,
      }, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      showToast({ severity: "success", message: "Monto actualizado correctamente" });
      setEditMontoOpen(false);
      obtenerReporte();
    } catch (e) {
      console.error(e);
      showToast({ severity: "error", message: e.response?.data?.message || "Error al actualizar monto" });
    } finally {
      setGuardandoMonto(false);
    }
  };

  const abrirEditarFecha = (r) => {
    setEditFechaRegistro(r);
    setEditFechaNueva(r.fecha ? r.fecha.split(" ")[0] : "");
    setEditFechaOpen(true);
  };

  const guardarFechaPago = async () => {
    if (!editFechaRegistro || !editFechaNueva) {
      showToast({ severity: "warning", message: "Selecciona una fecha válida" });
      return;
    }
    try {
      setGuardandoFecha(true);
      const token = localStorage.getItem("token");
      await axios.put(`${API_BASE_URL}/api/finanzas/editar-fecha-pago`, {
        id: editFechaRegistro.id,
        tipo_registro: editFechaRegistro.tipo_registro || "tratamiento",
        nueva_fecha: editFechaNueva,
      }, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      showToast({ severity: "success", message: "Fecha actualizada correctamente" });
      setEditFechaOpen(false);
      obtenerReporte();
    } catch (e) {
      console.error(e);
      showToast({ severity: "error", message: e.response?.data?.message || "Error al actualizar fecha" });
    } finally {
      setGuardandoFecha(false);
    }
  };

  // ===== FUNCIONES DE EGRESOS =====
  const abrirDialogoEgreso = () => {
    setEditandoEgreso(null);
    setEgresoFecha(hoyISO());
    setEgresoMonto("");
    setEgresoDescripcion("");
    setEgresoCategoria("Servicios");
    setEgresoMetodoPago("Efectivo");
    setEgresosDialogOpen(true);
  };

  const abrirEditarEgreso = (egreso) => {
    setEditandoEgreso(egreso);
    setEgresoFecha(egreso.fecha ? egreso.fecha.split(" ")[0] : hoyISO());
    setEgresoMonto(String(egreso.monto || ""));
    setEgresoDescripcion(egreso.descripcion || "");
    setEgresoCategoria(egreso.categoria || "Servicios");
    setEgresoMetodoPago(egreso.metodo_pago || "Efectivo");
    setEgresosDialogOpen(true);
  };

  const guardarEgreso = async () => {
    const monto = parseFloat(egresoMonto);
    if (isNaN(monto) || monto <= 0) {
      showToast({ severity: "warning", message: "Ingresa un monto válido" });
      return;
    }
    if (!egresoDescripcion.trim()) {
      showToast({ severity: "warning", message: "Ingresa una descripción" });
      return;
    }
    if (!egresoFecha) {
      showToast({ severity: "warning", message: "Selecciona una fecha" });
      return;
    }

    try {
      setGuardandoEgreso(true);
      const token = localStorage.getItem("token");
      const body = {
        fecha: egresoFecha,
        monto,
        descripcion: egresoDescripcion.trim(),
        categoria: egresoCategoria,
        metodo_pago: egresoMetodoPago,
      };

      if (editandoEgreso) {
        await axios.put(`${API_BASE_URL}/api/finanzas/egresos/${editandoEgreso.id}`, body, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        showToast({ severity: "success", message: "Egreso actualizado correctamente" });
      } else {
        await axios.post(`${API_BASE_URL}/api/finanzas/egresos`, body, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        showToast({ severity: "success", message: "Egreso registrado correctamente" });
      }

      setEgresosDialogOpen(false);
      obtenerEgresos();
    } catch (e) {
      console.error(e);
      showToast({ severity: "error", message: e.response?.data?.message || "Error al guardar egreso" });
    } finally {
      setGuardandoEgreso(false);
    }
  };

  const eliminarEgreso = async (egreso) => {
    if (!window.confirm(`¿Eliminar el egreso "${egreso.descripcion}"? Esta acción no se puede deshacer.`)) return;
    try {
      const token = localStorage.getItem("token");
      await axios.delete(`${API_BASE_URL}/api/finanzas/egresos/${egreso.id}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      showToast({ severity: "success", message: "Egreso eliminado" });
      obtenerEgresos();
    } catch (e) {
      console.error(e);
      showToast({ severity: "error", message: e.response?.data?.message || "Error al eliminar egreso" });
    }
  };

  const obtenerEgresos = async () => {
    try {
      const params = {};
      if (egresosFechaInicio) params.fechaInicio = egresosFechaInicio;
      if (egresosFechaFin) params.fechaFin = egresosFechaFin;

      const res = await axios.get(`${API_BASE_URL}/api/finanzas/egresos`, { params });
      setEgresos(res.data.egresos || []);
      setTotalEgresos(res.data.totalEgresos || 0);
    } catch (e) {
      console.error("Error obteniendo egresos:", e);
      setEgresos([]);
      setTotalEgresos(0);
    }
  };

  const abrirModalEgresos = () => {
    setEgresosDialogOpen(true);
    obtenerEgresos();
  };

  const eliminarRegistro = async (r) => {
    const tipoRaw = r.tipo_registro || "tratamiento";
    const tipo = tipoRaw === "tratamiento" ? "tratamiento" : "finanza";
    const nombre = r.paciente || "este registro";
    if (!window.confirm(`¿Eliminar el registro de "${nombre}" de finanzas? Esta acción no se puede deshacer.`)) return;
    try {
      const token = localStorage.getItem("token");
      await axios.delete(`${API_BASE_URL}/api/finanzas/registro/${tipo}/${r.id}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      showToast({ severity: "success", message: "Registro eliminado" });
      obtenerReporte();
    } catch (e) {
      console.error(e);
      showToast({ severity: "error", message: e.response?.data?.message || "Error al eliminar registro" });
    }
  };

  const hoyISO = () => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  const filtrarPorDia = () => {
    const hoy = hoyISO();
    setFechaInicio(hoy);
    setFechaFin(hoy);
    setFetchTrigger(t => t + 1);
  };

  const filtrarPorSemana = () => {
    const hoy = new Date();
    const primerDia = new Date(hoy);
    primerDia.setDate(hoy.getDate() - hoy.getDay());
    const ultimoDia = new Date(primerDia);
    ultimoDia.setDate(primerDia.getDate() + 6);
    
    const formatoISO = (d) => {
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      return `${yyyy}-${mm}-${dd}`;
    };
    
    setFechaInicio(formatoISO(primerDia));
    setFechaFin(formatoISO(ultimoDia));
    setFetchTrigger(t => t + 1);
  };

  const filtrarPorMes = () => {
    const hoy = new Date();
    const primerDia = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    const ultimoDia = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);
    
    const formatoISO = (d) => {
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      return `${yyyy}-${mm}-${dd}`;
    };
    
    setFechaInicio(formatoISO(primerDia));
    setFechaFin(formatoISO(ultimoDia));
    setFetchTrigger(t => t + 1);
  };

  const meses = [
    { value: 1, label: "Enero" }, { value: 2, label: "Febrero" }, { value: 3, label: "Marzo" },
    { value: 4, label: "Abril" }, { value: 5, label: "Mayo" }, { value: 6, label: "Junio" },
    { value: 7, label: "Julio" }, { value: 8, label: "Agosto" }, { value: 9, label: "Septiembre" },
    { value: 10, label: "Octubre" }, { value: 11, label: "Noviembre" }, { value: 12, label: "Diciembre" },
  ];

  const anioActual = new Date().getFullYear();
  const aniosDisponibles = [];
  for (let y = anioActual; y >= anioActual - 5; y--) aniosDisponibles.push(y);

  const diasDelMes = (mes, anio) => {
    if (!mes) return 31;
    return new Date(anio || anioActual, mes, 0).getDate();
  };

  const aplicarFiltroInteligente = (dia, mes, anio) => {
    const formatoISO = (d) => {
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      return `${yyyy}-${mm}-${dd}`;
    };

    const a = anio || anioActual;

    if (dia && mes) {
      // Día específico de un mes
      const fecha = new Date(a, mes - 1, dia);
      setFechaInicio(formatoISO(fecha));
      setFechaFin(formatoISO(fecha));
    } else if (mes) {
      // Mes completo
      const primerDia = new Date(a, mes - 1, 1);
      const ultimoDia = new Date(a, mes, 0);
      setFechaInicio(formatoISO(primerDia));
      setFechaFin(formatoISO(ultimoDia));
    } else if (anio) {
      // Año completo
      const primerDia = new Date(a, 0, 1);
      const ultimoDia = new Date(a, 11, 31);
      setFechaInicio(formatoISO(primerDia));
      setFechaFin(formatoISO(ultimoDia));
    } else if (dia) {
      // Solo día = día del mes actual
      const hoy = new Date();
      const fecha = new Date(hoy.getFullYear(), hoy.getMonth(), dia);
      setFechaInicio(formatoISO(fecha));
      setFechaFin(formatoISO(fecha));
    } else {
      return; // Nada seleccionado
    }
    setFiltroRapido("");
    setFetchTrigger(t => t + 1);
  };

  // Auto-fetch cuando cambian los filtros (fetchTrigger se incrementa después de setFechaInicio/setFechaFin)
  useEffect(() => {
    if (fetchTrigger > 0) {
      obtenerReporte();
    }
  }, [fetchTrigger]);

  // Sincronización en tiempo real: refrescar reporte si hay datos visibles
  useSocket(["finanzas:updated", "deudas:updated", "paquetes:updated"], () => {
    if (reporte.length > 0 || fechaInicio || fechaFin) {
      obtenerReporte();
    }
  });

  const obtenerReporte = async () => {
    try {
      const params = {};
      if (paciente) params.paciente = paciente;
      if (metodoPago) params.metodoPago = metodoPago;
      if (fechaInicio) params.fechaInicio = fechaInicio;
      if (fechaFin) params.fechaFin = fechaFin;

      const res = await axios.get(`${API_BASE_URL}/api/finanzas/reporte`, { params });
      const resultados = res.data.resultados || [];
      const ordenados = ordenarReporte(resultados, ordenDescendente);
      setReporte(ordenados);
      setTotalGeneral(res.data.totalGeneral);
      setTotalBruto(Number(res.data.totalBruto || 0));
      setTotalComision(Number(res.data.totalComision || 0));
      setTotalesMetodo(res.data.totalesPorMetodo);
    } catch (error) {
      console.error("Error al obtener reporte financiero:", error);
      showToast({ severity: "error", message: "Error al obtener reporte financiero" });
    }
  };

  const exportarExcel = () => {
    // Preparar datos para Excel
    const datosTabla = (reporte || []).map((r) => ({
      Fecha: formatearFechaCorta(r.fecha),
      Paciente: r.deuda_pendiente > 0
        ? `${r.paciente || "-"} (Deuda: S/ ${Number(r.deuda_pendiente || 0).toFixed(2)})`
        : r.paciente || "-",
      Tratamiento: r.tratamiento || "-",
      "Método de Pago": r.pagoMetodo_mostrado || r.pagoMetodo || "-",
      "Monto Bruto (S/)": Number(r.monto_bruto ?? r.precio_total ?? 0).toFixed(2),
      "Descuento (%)": r.descuento || 0,
      "Monto Neto (S/)": Number(r.precio_total ?? r.monto_bruto ?? 0).toFixed(2),
    }));

    // Crear hoja de trabajo
    const ws = XLSX.utils.json_to_sheet(datosTabla);

    // Ajustar anchos de columna
    ws['!cols'] = [
      { wch: 12 }, // Fecha
      { wch: 30 }, // Paciente
      { wch: 30 }, // Tratamiento
      { wch: 18 }, // Método de Pago
      { wch: 16 }, // Monto Bruto
      { wch: 14 }, // Descuento
      { wch: 16 }, // Monto Neto
    ];

    // Agregar resumen al final
    const filaResumenInicio = datosTabla.length + 3;
    
    XLSX.utils.sheet_add_aoa(ws, [
      [""],
      ["RESUMEN FINANCIERO"],
      [""],
      ["Total Bruto (S/)", Number(totalBruto || 0).toFixed(2)],
      ["Comisión POS (S/)", Number(totalComision || 0).toFixed(2)],
      ["Total Neto (S/)", Number(totalGeneral || 0).toFixed(2)],
      [""],
      ["DESGLOSE POR MÉTODO DE PAGO"],
    ], { origin: `A${filaResumenInicio}` });

    // Agregar totales por método
    let filaMetodo = filaResumenInicio + 8;
    Object.entries(totalesMetodo || {}).forEach(([metodo, total]) => {
      XLSX.utils.sheet_add_aoa(ws, [
        [metodo, `S/ ${Number(total || 0).toFixed(2)}`]
      ], { origin: `A${filaMetodo}` });
      filaMetodo++;
    });

    // Crear libro de trabajo
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Finanzas");

    // Generar nombre de archivo con fecha
    const fecha = new Date().toLocaleDateString('es-PE').replace(/\//g, '-');
    const nombreArchivo = `Reporte_Finanzas_ShowClinic_${fecha}.xlsx`;

    // Descargar archivo
    XLSX.writeFile(wb, nombreArchivo);
    showToast({ severity: "success", message: "Excel exportado correctamente" });
  };

  const generarPDF = () => {
    const generar = async () => {
      const doc = new jsPDF("p", "pt", "a4");
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const colorPrincipalRgb = [163, 105, 32];
      const margenX = 30;
      const headerHeight = 92;

      const logo = "/images/logo-showclinic.png";
      const img = await loadImage(logo);
      const logoCircular = makeCircularImageDataUrl(img, 256, 10);

      const tabla = (reporte || []).map((r) => [
        formatearFechaCorta(r.fecha),
        r.deuda_pendiente > 0
          ? `${r.paciente || "-"} (Deuda: S/ ${Number(r.deuda_pendiente || 0).toFixed(2)})`
          : r.paciente || "-",
        r.tratamiento || "-",
        r.pagoMetodo_mostrado || r.pagoMetodo || "-",
        `S/ ${(Number(r.monto_bruto ?? r.precio_total ?? 0)).toFixed(2)}`,
        `${r.descuento || 0}%`,
      ]);

      autoTable(doc, {
        margin: { top: headerHeight + 16, left: margenX, right: margenX },
        startY: headerHeight + 24,
        head: [["Fecha", "Paciente", "Tratamiento", "Pago", "Bruto", "Desc."]],
        body: tabla,
        theme: "striped",
        headStyles: {
          fillColor: colorPrincipalRgb,
          textColor: 255,
          fontStyle: "bold",
          halign: "center",
          valign: "middle",
        },
        styles: { fontSize: 8.5, cellPadding: 3, valign: "middle", overflow: "linebreak" },
        alternateRowStyles: { fillColor: [247, 242, 234] },
        columnStyles: {
          0: { cellWidth: 55 },
          1: { cellWidth: 140 },
          2: { cellWidth: 140 },
          3: { cellWidth: 90 },
          4: { halign: "right", cellWidth: 60 },
          5: { halign: "center", cellWidth: 30 },
        },
        didDrawPage: (data) => {
          doc.setFillColor(...colorPrincipalRgb);
          doc.rect(0, 0, pageWidth, headerHeight, "F");

          if (logoCircular) {
            const logoSize = 54;
            doc.addImage(logoCircular, "PNG", margenX, 20, logoSize, logoSize);
          }

          doc.setFont("helvetica", "bold");
          doc.setTextColor(255, 255, 255);
          doc.setFontSize(18);
          doc.text("Reporte Financiero", margenX + 72, 46);

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
        },
      });

      const y = doc.lastAutoTable.finalY + 24;
      doc.setDrawColor(220);
      doc.setLineWidth(1);
      doc.line(margenX, y - 12, pageWidth - margenX, y - 12);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(...colorPrincipalRgb);
      doc.text("Resumen", margenX + 12, y + 8);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(...colorPrincipalRgb);
      doc.text(
        `Total neto: S/ ${Number(totalGeneral || 0).toFixed(2)}`,
        pageWidth - margenX - 12,
        y + 8,
        { align: "right" }
      );

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(30);
      doc.text(
        `Total bruto: S/ ${Number(totalBruto || 0).toFixed(2)}  |  Comisión POS: S/ ${Number(totalComision || 0).toFixed(2)}`,
        margenX + 12,
        y + 26
      );

      let yy = y + 46;
      Object.entries(totalesMetodo || {}).forEach(([metodo, total]) => {
        doc.text(
          `${metodo}: S/ ${Number(total || 0).toFixed(2)}`,
          margenX + 12,
          yy
        );
        yy += 14;
      });

      doc.save("Reporte_Finanzas_ShowClinic.pdf");
    };

    generar();
  };

  return (
    <div
      style={{
        backgroundImage:
          "linear-gradient(rgba(245,241,228,0.92), rgba(186,154,99,0.25)), url('/images/background-showclinic.jpg')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 20px",
      }}
    >
      <Container maxWidth="lg">
        <Paper
          elevation={6}
          sx={{
            p: 5,
            background:
              "linear-gradient(180deg, #fffdf7 0%, rgba(245,241,228,0.85) 52%, rgba(186,154,99,0.15) 100%)",
            border: "1px solid rgba(186,154,99,0.3)",
            backdropFilter: "blur(10px)",
            borderRadius: "15px",
            boxShadow:
              "0 18px 46px rgba(163,105,32,0.10), 0 0 0 1px rgba(186,154,99,0.12)",
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
            <IconButton onClick={() => navigate("/dashboard")} sx={{ color: colorPrincipal }}>
              <ArrowBack />
            </IconButton>
            <Typography
              variant="h5"
              sx={{ color: colorPrincipal, fontWeight: "bold", flex: 1, textAlign: "center" }}
            >
              Finanzas
            </Typography>
            <IconButton onClick={() => navigate("/dashboard")} sx={{ color: colorPrincipal }} title="Inicio">
              <Home />
            </IconButton>
          </Box>

          {/* ===== FILTROS ===== */}
          <Paper
            elevation={0}
            sx={{
              p: 2.5,
              borderRadius: 3,
              background: "linear-gradient(135deg, #f5f1e4 0%, rgba(245,241,228,0.6) 100%)",
              border: "1px solid rgba(186,154,99,0.35)",
              mb: 1,
            }}
          >
            {/* Accesos rápidos — arriba, prominentes */}
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mb: 2.5 }}>
              {[
                { label: "📅 Hoy", key: "hoy", action: () => { setFiltroDia(""); setFiltroMes(""); setFiltroAnio(""); filtrarPorDia(); setFiltroRapido("hoy"); } },
                { label: "📆 Esta semana", key: "semana", action: () => { setFiltroDia(""); setFiltroMes(""); setFiltroAnio(""); filtrarPorSemana(); setFiltroRapido("semana"); } },
                { label: "🗓️ Este mes", key: "mes", action: () => { setFiltroDia(""); setFiltroMes(""); setFiltroAnio(""); filtrarPorMes(); setFiltroRapido("mes"); } },
              ].map((btn) => (
                <Button
                  key={btn.key}
                  variant={filtroRapido === btn.key ? "contained" : "outlined"}
                  size="small"
                  onClick={btn.action}
                  sx={{
                    backgroundColor: filtroRapido === btn.key ? colorPrincipal : "#fffdf7",
                    borderColor: filtroRapido === btn.key ? colorPrincipal : "#ba9a63",
                    color: filtroRapido === btn.key ? "#f5f1e4" : colorPrincipal,
                    fontWeight: 700,
                    fontSize: "0.8rem",
                    px: 2.5,
                    py: 0.8,
                    borderRadius: 2.5,
                    textTransform: "none",
                    boxShadow: filtroRapido === btn.key ? "0 2px 8px rgba(163,105,32,0.35)" : "0 1px 3px rgba(186,154,99,0.15)",
                    "&:hover": { 
                      backgroundColor: filtroRapido === btn.key ? "#8a5a1a" : "#f5f1e4",
                      borderColor: colorPrincipal,
                      boxShadow: "0 2px 8px rgba(163,105,32,0.2)",
                    },
                  }}
                >
                  {btn.label}
                </Button>
              ))}
              <Button
                variant={filtroRapido === "caja" ? "contained" : "outlined"}
                size="small"
                onClick={() => { setFiltroDia(""); setFiltroMes(""); setFiltroAnio(""); filtrarPorDia(); setFiltroRapido("caja"); }}
                sx={{
                  backgroundColor: filtroRapido === "caja" ? "#ba9a63" : "#fffdf7",
                  borderColor: filtroRapido === "caja" ? "#ba9a63" : "#ba9a63",
                  color: filtroRapido === "caja" ? "#fff" : "#ba9a63",
                  fontWeight: 700,
                  fontSize: "0.8rem",
                  px: 2.5,
                  py: 0.8,
                  borderRadius: 2.5,
                  textTransform: "none",
                  boxShadow: filtroRapido === "caja" ? "0 2px 8px rgba(186,154,99,0.35)" : "0 1px 3px rgba(186,154,99,0.15)",
                  "&:hover": { backgroundColor: filtroRapido === "caja" ? "#a38b55" : "#f5f1e4", borderColor: "#a36920" },
                }}
              >
                💰 Cierre de caja
              </Button>
              <Button
                variant="outlined"
                size="small"
                onClick={abrirModalEgresos}
                disabled={!canDoActions}
                sx={{
                  backgroundColor: "#fffdf7",
                  borderColor: "#ba9a63",
                  color: "#ba9a63",
                  fontWeight: 700,
                  fontSize: "0.75rem",
                  px: 2,
                  py: 0.8,
                  borderRadius: 2.5,
                  textTransform: "none",
                  boxShadow: "0 1px 3px rgba(186,154,99,0.15)",
                  "&:hover": { backgroundColor: "#f5f1e4", borderColor: "#a36920" },
                  "&:disabled": { backgroundColor: "#eee", borderColor: "#ccc", color: "#999" },
                }}
              >
                💸 Egresos
              </Button>
            </Box>

            {/* Filtros por Día / Mes / Año */}
            <Grid container spacing={1.5} alignItems="flex-end">
              <Grid item xs={4} sm={2}>
                <Typography variant="caption" sx={{ fontWeight: 700, color: colorPrincipal, mb: 0.5, display: "block", fontSize: "0.75rem", letterSpacing: 0.5 }}>
                  DÍA
                </Typography>
                <TextField
                  select
                  size="small"
                  fullWidth
                  value={filtroDia}
                  onChange={(e) => {
                    const d = e.target.value;
                    setFiltroDia(d);
                    setFiltroRapido("custom");
                    aplicarFiltroInteligente(d ? Number(d) : "", filtroMes ? Number(filtroMes) : "", filtroAnio ? Number(filtroAnio) : "");
                  }}
                  sx={{ 
                    "& .MuiInputBase-root": { backgroundColor: "#fffdf7", borderRadius: 2, fontSize: "0.85rem", height: 40 },
                    "& .MuiOutlinedInput-root": { "& fieldset": { borderColor: "#ba9a63" }, "&:hover fieldset": { borderColor: colorPrincipal }, "&.Mui-focused fieldset": { borderColor: colorPrincipal } },
                  }}
                >
                  <MenuItem value="">Todos</MenuItem>
                  {Array.from({ length: diasDelMes(filtroMes ? Number(filtroMes) : null, filtroAnio ? Number(filtroAnio) : null) }, (_, i) => (
                    <MenuItem key={i + 1} value={i + 1}>{i + 1}</MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid item xs={4} sm={3}>
                <Typography variant="caption" sx={{ fontWeight: 700, color: colorPrincipal, mb: 0.5, display: "block", fontSize: "0.75rem", letterSpacing: 0.5 }}>
                  MES
                </Typography>
                <TextField
                  select
                  size="small"
                  fullWidth
                  value={filtroMes}
                  onChange={(e) => {
                    const m = e.target.value;
                    setFiltroMes(m);
                    setFiltroRapido("custom");
                    const maxDia = diasDelMes(m ? Number(m) : null, filtroAnio ? Number(filtroAnio) : null);
                    let diaActual = filtroDia ? Number(filtroDia) : "";
                    if (diaActual && diaActual > maxDia) { diaActual = maxDia; setFiltroDia(String(maxDia)); }
                    aplicarFiltroInteligente(diaActual ? Number(diaActual) : "", m ? Number(m) : "", filtroAnio ? Number(filtroAnio) : "");
                  }}
                  sx={{ 
                    "& .MuiInputBase-root": { backgroundColor: "#fffdf7", borderRadius: 2, fontSize: "0.85rem", height: 40 },
                    "& .MuiOutlinedInput-root": { "& fieldset": { borderColor: "#ba9a63" }, "&:hover fieldset": { borderColor: colorPrincipal }, "&.Mui-focused fieldset": { borderColor: colorPrincipal } },
                  }}
                >
                  <MenuItem value="">Todos</MenuItem>
                  {meses.map((m) => (
                    <MenuItem key={m.value} value={m.value}>{m.label}</MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid item xs={4} sm={2}>
                <Typography variant="caption" sx={{ fontWeight: 700, color: colorPrincipal, mb: 0.5, display: "block", fontSize: "0.75rem", letterSpacing: 0.5 }}>
                  AÑO
                </Typography>
                <TextField
                  select
                  size="small"
                  fullWidth
                  value={filtroAnio}
                  onChange={(e) => {
                    const a = e.target.value;
                    setFiltroAnio(a);
                    setFiltroRapido("custom");
                    aplicarFiltroInteligente(filtroDia ? Number(filtroDia) : "", filtroMes ? Number(filtroMes) : "", a ? Number(a) : "");
                  }}
                  sx={{ 
                    "& .MuiInputBase-root": { backgroundColor: "#fffdf7", borderRadius: 2, fontSize: "0.85rem", height: 40 },
                    "& .MuiOutlinedInput-root": { "& fieldset": { borderColor: "#ba9a63" }, "&:hover fieldset": { borderColor: colorPrincipal }, "&.Mui-focused fieldset": { borderColor: colorPrincipal } },
                  }}
                >
                  <MenuItem value="">Todos</MenuItem>
                  {aniosDisponibles.map((a) => (
                    <MenuItem key={a} value={a}>{a}</MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid item xs={6} sm={2.5}>
                <Typography variant="caption" sx={{ fontWeight: 700, color: colorPrincipal, mb: 0.5, display: "block", fontSize: "0.75rem", letterSpacing: 0.5 }}>
                  PACIENTE
                </Typography>
                <TextField
                  size="small"
                  placeholder="Buscar..."
                  value={paciente}
                  onChange={(e) => setPaciente(e.target.value)}
                  fullWidth
                  sx={{ 
                    "& .MuiInputBase-root": { backgroundColor: "#fffdf7", borderRadius: 2, fontSize: "0.85rem", height: 40 },
                    "& .MuiOutlinedInput-root": { "& fieldset": { borderColor: "#ba9a63" }, "&:hover fieldset": { borderColor: colorPrincipal }, "&.Mui-focused fieldset": { borderColor: colorPrincipal } },
                  }}
                />
              </Grid>
              <Grid item xs={6} sm={2.5}>
                <Typography variant="caption" sx={{ fontWeight: 700, color: colorPrincipal, mb: 0.5, display: "block", fontSize: "0.75rem", letterSpacing: 0.5 }}>
                  MÉTODO
                </Typography>
                <TextField
                  select
                  size="small"
                  value={metodoPago}
                  onChange={(e) => setMetodoPago(e.target.value)}
                  fullWidth
                  sx={{ 
                    "& .MuiInputBase-root": { backgroundColor: "#fffdf7", borderRadius: 2, fontSize: "0.85rem", height: 40 },
                    "& .MuiOutlinedInput-root": { "& fieldset": { borderColor: "#ba9a63" }, "&:hover fieldset": { borderColor: colorPrincipal }, "&.Mui-focused fieldset": { borderColor: colorPrincipal } },
                  }}
                >
                  <MenuItem value="">Todos</MenuItem>
                  <MenuItem value="Efectivo">Efectivo</MenuItem>
                  <MenuItem value="Tarjeta">Tarjeta</MenuItem>
                  <MenuItem value="Transferencia">Transferencia</MenuItem>
                  <MenuItem value="Yape">Yape</MenuItem>
                  <MenuItem value="Plin">Plin</MenuItem>
                </TextField>
              </Grid>
            </Grid>

            {/* Botones de acción */}
            <Box sx={{ display: "flex", gap: 1, mt: 2, justifyContent: "flex-end", flexWrap: "wrap", alignItems: "center" }}>
              <Button
                variant="text"
                size="small"
                startIcon={<SwapVert />}
                onClick={toggleOrden}
                sx={{
                  color: "#ba9a63",
                  fontWeight: 600,
                  textTransform: "none",
                  fontSize: "0.8rem",
                  mr: "auto",
                  "&:hover": { backgroundColor: "rgba(186,154,99,0.08)", color: colorPrincipal },
                }}
              >
                {ordenDescendente ? "Más recientes primero" : "Más antiguos primero"}
              </Button>
              <Button
                variant="outlined"
                size="small"
                onClick={() => {
                  setFiltroDia(""); setFiltroMes(""); setFiltroAnio(""); setFiltroRapido("");
                  setFechaInicio(""); setFechaFin(""); setPaciente(""); setMetodoPago("");
                  setReporte([]); setTotalGeneral(0); setTotalBruto(0); setTotalComision(0); setTotalesMetodo({});
                }}
                sx={{
                  borderColor: "#ba9a63",
                  color: "#ba9a63",
                  fontWeight: 600,
                  borderRadius: 2,
                  textTransform: "none",
                  fontSize: "0.8rem",
                  "&:hover": { backgroundColor: "#f5f1e4", borderColor: colorPrincipal, color: colorPrincipal },
                }}
              >
                Limpiar
              </Button>
              <Button
                variant="contained"
                size="small"
                onClick={obtenerReporte}
                sx={{
                  backgroundColor: colorPrincipal,
                  color: "white",
                  fontWeight: 700,
                  borderRadius: 2,
                  textTransform: "none",
                  fontSize: "0.85rem",
                  px: 3,
                  boxShadow: "0 2px 8px rgba(163,105,32,0.3)",
                  "&:hover": { backgroundColor: "#8a5a1a", boxShadow: "0 3px 12px rgba(163,105,32,0.4)" },
                }}
              >
                🔍 Buscar
              </Button>
            </Box>
          </Paper>

          <Divider sx={{ my: 3 }} />

          {reporte.length === 0 ? (
            <Typography align="center" color="textSecondary">
              No hay datos para mostrar.
            </Typography>
          ) : (
            <>
              <Table>
                <TableHead>
                  <TableRow sx={{ backgroundColor: "#f5f1e4" }}>
                    <TableCell sx={{ fontWeight: 700, color: colorPrincipal, borderBottom: "2px solid #ba9a63" }}>Fecha</TableCell>
                    <TableCell sx={{ minWidth: 220, maxWidth: 320, fontWeight: 700, color: colorPrincipal, borderBottom: "2px solid #ba9a63" }}>Paciente</TableCell>
                    <TableCell sx={{ minWidth: 220, maxWidth: 340, fontWeight: 700, color: colorPrincipal, borderBottom: "2px solid #ba9a63" }}>Tratamiento</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: colorPrincipal, borderBottom: "2px solid #ba9a63" }}>Método de Pago</TableCell>
                    <TableCell sx={{ minWidth: 130, textAlign: "right", fontWeight: 700, color: colorPrincipal, borderBottom: "2px solid #ba9a63" }}>Monto bruto (S/)</TableCell>
                    <TableCell sx={{ minWidth: 110, textAlign: "center", fontWeight: 700, color: colorPrincipal, borderBottom: "2px solid #ba9a63" }}>Descuento (%)</TableCell>
                    <TableCell sx={{ minWidth: 100, textAlign: "center", fontWeight: 700, color: colorPrincipal, borderBottom: "2px solid #ba9a63" }}>Estado</TableCell>
                    {canDoActions && <TableCell align="center" sx={{ fontWeight: 700, color: colorPrincipal, borderBottom: "2px solid #ba9a63" }}>Acciones</TableCell>}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {reporte.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell sx={{ whiteSpace: "nowrap" }}>{formatearFechaCorta(r.fecha)}</TableCell>
                      <TableCell sx={{ minWidth: 220, maxWidth: 320, whiteSpace: "normal", wordBreak: "normal" }}>
                        {r.paciente}
                        {Number(r.deuda_pendiente || 0) > 0 ? (
                          <Typography
                            component="span"
                            sx={{ ml: 1, fontSize: 12, color: "#b71c1c", fontWeight: 700 }}
                          >
                            (Deuda: S/ {Number(r.deuda_pendiente || 0).toFixed(2)})
                          </Typography>
                        ) : null}
                      </TableCell>
                      <TableCell sx={{ minWidth: 220, maxWidth: 340, whiteSpace: "normal", wordBreak: "normal" }}>{r.tratamiento}</TableCell>
                      <TableCell>{r.pagoMetodo_mostrado || r.pagoMetodo}</TableCell>
                      <TableCell sx={{ textAlign: "right" }}>
                        {Number(r.monto_bruto ?? r.precio_total ?? 0).toFixed(2)}
                      </TableCell>
                      <TableCell sx={{ textAlign: "center" }}>{r.descuento}</TableCell>
                      <TableCell sx={{ textAlign: "center" }}>
                        <Box
                          sx={{
                            display: "inline-block",
                            px: 1.5,
                            py: 0.5,
                            borderRadius: 1,
                            backgroundColor: r.estado_pago === "Deuda" ? "#ffebee" : "#e8f5e9",
                            color: r.estado_pago === "Deuda" ? "#c62828" : "#2e7d32",
                            fontWeight: "bold",
                            fontSize: "0.75rem"
                          }}
                        >
                          {r.estado_pago || "Pagado"}
                        </Box>
                      </TableCell>
                      {canDoActions && (
                        <TableCell align="center" sx={{ whiteSpace: "nowrap" }}>
                          <Tooltip title="Registrar pago">
                            <IconButton
                              size="small"
                              onClick={() => abrirDialogoPago(r)}
                              sx={{ color: "#ba9a63" }}
                            >
                              <CheckCircle fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          {isMaster && (
                            <>
                              <Tooltip title="Editar método de pago">
                                <IconButton
                                  size="small"
                                  onClick={() => abrirEditarMetodo(r)}
                                  sx={{ color: "#ba9a63" }}
                                >
                                  <Edit fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Editar monto pagado">
                                <IconButton
                                  size="small"
                                  onClick={() => abrirEditarMonto(r)}
                                  sx={{ color: colorPrincipal }}
                                >
                                  <AttachMoney fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Editar fecha de pago">
                                <IconButton
                                  size="small"
                                  onClick={() => abrirEditarFecha(r)}
                                  sx={{ color: "#a36920" }}
                                >
                                  <CalendarMonth fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Eliminar registro">
                                <IconButton
                                  size="small"
                                  onClick={() => eliminarRegistro(r)}
                                  sx={{ color: "#8a5a1a" }}
                                >
                                  <Delete fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            </>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <Divider sx={{ my: 3 }} />

              {/* Resumen de ingresos — solo del filtro actual */}
              <Paper
                elevation={0}
                sx={{
                  p: 3,
                  borderRadius: 3,
                  background: "linear-gradient(135deg, #f5f1e4 0%, rgba(245,241,228,0.7) 100%)",
                  border: "1px solid rgba(186,154,99,0.3)",
                }}
              >
                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2.5, flexWrap: "wrap", gap: 1 }}>
                  <Typography variant="h6" sx={{ fontWeight: "bold", color: colorPrincipal, display: "flex", alignItems: "center", gap: 1 }}>
                    <AttachMoney /> Total del Período Filtrado
                  </Typography>
                  {(fechaInicio || fechaFin) && (
                    <Typography variant="body2" sx={{ color: colorPrincipal, fontWeight: 600, backgroundColor: "#f5f1e4", border: "1px solid #ba9a63", px: 1.5, py: 0.5, borderRadius: 2, fontSize: "0.8rem" }}>
                      {fechaInicio === fechaFin ? fechaInicio : `${fechaInicio || '...'} — ${fechaFin || '...'}`}
                      {` (${reporte.length} registro${reporte.length !== 1 ? 's' : ''})`}
                    </Typography>
                  )}
                </Box>

                <Grid container spacing={2} sx={{ mb: 2.5 }}>
                  {/* Total Bruto */}
                  <Grid item xs={12} sm={4}>
                    <Paper
                      elevation={0}
                      sx={{
                        p: 2,
                        borderRadius: 2.5,
                        backgroundColor: "rgba(186,154,99,0.12)",
                        border: "1px solid rgba(186,154,99,0.35)",
                        textAlign: "center",
                        height: "100%",
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "center",
                      }}
                    >
                      <Typography variant="caption" sx={{ color: "#555", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>
                        Total Bruto
                      </Typography>
                      <Typography variant="h5" sx={{ fontWeight: "bold", color: "#ba9a63", mt: 0.5 }}>
                        S/ {Number(totalBruto || 0).toFixed(2)}
                      </Typography>
                    </Paper>
                  </Grid>
                  {/* Total Neto */}
                  <Grid item xs={12} sm={4}>
                    <Paper
                      elevation={0}
                      sx={{
                        p: 2,
                        borderRadius: 2.5,
                        backgroundColor: "rgba(163,105,32,0.06)",
                        border: "1px solid rgba(163,105,32,0.3)",
                        textAlign: "center",
                        height: "100%",
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "center",
                      }}
                    >
                      <Typography variant="caption" sx={{ color: "#555", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>
                        Total Neto
                      </Typography>
                      <Typography variant="h5" sx={{ fontWeight: "bold", color: colorPrincipal, mt: 0.5 }}>
                        S/ {Number(totalGeneral || 0).toFixed(2)}
                      </Typography>
                    </Paper>
                  </Grid>
                  {/* Comisión POS */}
                  <Grid item xs={12} sm={4}>
                    <Paper
                      elevation={0}
                      sx={{
                        p: 2,
                        borderRadius: 2.5,
                        backgroundColor: "rgba(245,241,228,0.6)",
                        border: "1px solid rgba(186,154,99,0.3)",
                        textAlign: "center",
                        height: "100%",
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "center",
                      }}
                    >
                      <Typography variant="caption" sx={{ color: "#555", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>
                        Comisión POS (4%)
                      </Typography>
                      <Typography variant="h5" sx={{ fontWeight: "bold", color: "#a36920", mt: 0.5, fontSize: "1.3rem" }}>
                        S/ {Number(totalComision || 0).toFixed(2)}
                      </Typography>
                    </Paper>
                  </Grid>
                </Grid>

                {/* Desglose por método de pago */}
                {Object.keys(totalesMetodo).length > 0 && (
                  <Paper
                    elevation={0}
                    sx={{
                      p: 2,
                      borderRadius: 2,
                      backgroundColor: "#fffdf7",
                      border: "1px solid rgba(186,154,99,0.25)",
                    }}
                  >
                    <Typography variant="subtitle2" sx={{ fontWeight: "bold", color: colorPrincipal, mb: 1.5 }}>
                      Desglose por Método de Pago
                    </Typography>
                    <Grid container spacing={1}>
                      {Object.entries(totalesMetodo).map(([metodo, total]) => (
                        <Grid item xs={6} sm={4} md={3} key={metodo}>
                          <Box
                            sx={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              p: 1.2,
                              borderRadius: 1.5,
                              backgroundColor: "#f5f1e4",
                              border: "1px solid rgba(186,154,99,0.25)",
                            }}
                          >
                            <Typography variant="body2" sx={{ fontWeight: 600, color: "#6b5a3e" }}>
                              {metodo}
                            </Typography>
                            <Typography variant="body2" sx={{ fontWeight: "bold", color: colorPrincipal }}>
                              S/ {total.toFixed(2)}
                            </Typography>
                          </Box>
                        </Grid>
                      ))}
                    </Grid>
                  </Paper>
                )}

                <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 2, mt: 2.5 }}>
                  <Button
                    variant="outlined"
                    onClick={exportarExcel}
                    sx={{
                      borderColor: "#2e7d32",
                      color: "#2e7d32",
                      fontWeight: "bold",
                      px: 3,
                      "&:hover": { 
                        backgroundColor: "#e8f5e9",
                        borderColor: "#1b5e20",
                      },
                    }}
                  >
                    Exportar Excel
                  </Button>
                    <Button
                      variant="outlined"
                      onClick={generarPDF}
                      sx={{
                        borderColor: colorPrincipal,
                        color: colorPrincipal,
                        fontWeight: "bold",
                        px: 3,
                        "&:hover": { backgroundColor: "#f5f1e4" },
                      }}
                    >
                      Exportar PDF
                    </Button>
                </Box>
              </Paper>
            </>
          )}
        </Paper>

        <Dialog open={pagoDialogOpen} onClose={() => setPagoDialogOpen(false)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderTop: "3px solid #a36920" } }}>
          <DialogTitle sx={{ color: colorPrincipal, fontWeight: "bold", backgroundColor: "#f5f1e4" }}>Registrar Pago</DialogTitle>
          <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: "16px !important" }}>
            {pagoRegistro && (
              <Typography variant="body2" sx={{ color: "#555", mb: 1 }}>
                <strong>Paciente:</strong> {pagoRegistro.paciente}<br />
                <strong>Tratamiento:</strong> {pagoRegistro.tratamiento}
              </Typography>
            )}
            <TextField
              label="Monto (S/)"
              type="number"
              fullWidth
              value={pagoMonto}
              onChange={(e) => setPagoMonto(e.target.value)}
              inputProps={{ min: 0.01, step: 0.01 }}
            />
            <TextField
              select
              label="Método de pago"
              fullWidth
              value={pagoMetodo}
              onChange={(e) => setPagoMetodo(e.target.value)}
            >
              <MenuItem value="Efectivo">Efectivo</MenuItem>
              <MenuItem value="Tarjeta">Tarjeta</MenuItem>
              <MenuItem value="Transferencia">Transferencia</MenuItem>
              <MenuItem value="Yape">Yape</MenuItem>
              <MenuItem value="Plin">Plin</MenuItem>
            </TextField>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setPagoDialogOpen(false)} sx={{ color: "#ba9a63" }}>Cancelar</Button>
            <Button
              variant="contained"
              onClick={registrarPago}
              disabled={guardandoPago}
              sx={{ backgroundColor: colorPrincipal, "&:hover": { backgroundColor: "#8a5a1a" } }}
            >
              {guardandoPago ? "Guardando..." : "Registrar Pago"}
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog open={editMetodoOpen} onClose={() => setEditMetodoOpen(false)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderTop: "3px solid #ba9a63" } }}>
          <DialogTitle sx={{ color: colorPrincipal, fontWeight: "bold", backgroundColor: "#f5f1e4" }}>Editar Método de Pago</DialogTitle>
          <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: "16px !important" }}>
            {editMetodoRegistro && (
              <Typography variant="body2" sx={{ color: "#555", mb: 1 }}>
                <strong>Paciente:</strong> {editMetodoRegistro.paciente}<br />
                <strong>Tratamiento:</strong> {editMetodoRegistro.tratamiento}<br />
                <strong>Método actual:</strong> {editMetodoRegistro.pagoMetodo_mostrado || editMetodoRegistro.pagoMetodo || "Desconocido"}
              </Typography>
            )}
            <TextField
              select
              label="Nuevo método de pago"
              fullWidth
              value={editMetodoNuevo}
              onChange={(e) => setEditMetodoNuevo(e.target.value)}
            >
              <MenuItem value="Efectivo">Efectivo</MenuItem>
              <MenuItem value="Tarjeta">Tarjeta</MenuItem>
              <MenuItem value="Transferencia">Transferencia</MenuItem>
              <MenuItem value="Yape">Yape</MenuItem>
              <MenuItem value="Plin">Plin</MenuItem>
            </TextField>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setEditMetodoOpen(false)} sx={{ color: "#ba9a63" }}>Cancelar</Button>
            <Button
              variant="contained"
              onClick={guardarMetodoPago}
              disabled={guardandoMetodo}
              sx={{ backgroundColor: "#ba9a63", "&:hover": { backgroundColor: "#a38b55" } }}
            >
              {guardandoMetodo ? "Guardando..." : "Guardar Cambio"}
            </Button>
          </DialogActions>
        </Dialog>
        <Dialog open={editFechaOpen} onClose={() => setEditFechaOpen(false)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderTop: "3px solid #ba9a63" } }}>
          <DialogTitle sx={{ color: colorPrincipal, fontWeight: "bold", backgroundColor: "#f5f1e4" }}>Editar Fecha de Pago</DialogTitle>
          <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: "16px !important" }}>
            {editFechaRegistro && (
              <Typography variant="body2" sx={{ color: "#555", mb: 1 }}>
                <strong>Paciente:</strong> {editFechaRegistro.paciente}<br />
                <strong>Tratamiento:</strong> {editFechaRegistro.tratamiento}<br />
                <strong>Fecha actual:</strong> {formatearFechaCorta(editFechaRegistro.fecha)}
              </Typography>
            )}
            <TextField
              label="Nueva fecha"
              type="date"
              fullWidth
              value={editFechaNueva}
              onChange={(e) => setEditFechaNueva(e.target.value)}
              InputLabelProps={{ shrink: true }}
              helperText="Selecciona la fecha real en que se realizó el pago"
            />
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setEditFechaOpen(false)} sx={{ color: "#ba9a63" }}>Cancelar</Button>
            <Button
              variant="contained"
              onClick={guardarFechaPago}
              disabled={guardandoFecha}
              sx={{ backgroundColor: colorPrincipal, "&:hover": { backgroundColor: "#8a5a1a" } }}
            >
              {guardandoFecha ? "Guardando..." : "Guardar Cambio"}
            </Button>
          </DialogActions>
        </Dialog>
        <Dialog open={editMontoOpen} onClose={() => setEditMontoOpen(false)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderTop: "3px solid #ba9a63" } }}>
          <DialogTitle sx={{ color: colorPrincipal, fontWeight: "bold", backgroundColor: "#f5f1e4" }}>Editar Monto Pagado</DialogTitle>
          <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: "16px !important" }}>
            {editMontoRegistro && (
              <Typography variant="body2" sx={{ color: "#555", mb: 1 }}>
                <strong>Paciente:</strong> {editMontoRegistro.paciente}<br />
                <strong>Tratamiento:</strong> {editMontoRegistro.tratamiento}<br />
                <strong>Monto actual:</strong> S/ {Number(editMontoRegistro.monto_bruto ?? editMontoRegistro.precio_total ?? 0).toFixed(2)}
              </Typography>
            )}
            <TextField
              label="Nuevo monto (S/)"
              type="number"
              fullWidth
              value={editMontoNuevo}
              onChange={(e) => setEditMontoNuevo(e.target.value)}
              inputProps={{ min: 0, step: 0.01 }}
              helperText="Ingresa el monto correcto que se pagó realmente"
            />
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setEditMontoOpen(false)} sx={{ color: "#ba9a63" }}>Cancelar</Button>
            <Button
              variant="contained"
              onClick={guardarMontoPago}
              disabled={guardandoMonto}
              sx={{ backgroundColor: colorPrincipal, "&:hover": { backgroundColor: "#8a5a1a" } }}
            >
              {guardandoMonto ? "Guardando..." : "Guardar Cambio"}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Modal de Egresos Completo */}
        <Dialog 
          open={egresosDialogOpen} 
          onClose={() => setEgresosDialogOpen(false)} 
          maxWidth="md" 
          fullWidth 
          PaperProps={{ 
            sx: { 
              borderTop: "3px solid #ba9a63",
              maxHeight: "90vh"
            } 
          }}
        >
          <DialogTitle sx={{ color: colorPrincipal, fontWeight: "bold", backgroundColor: "#f5f1e4", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>💸 Gestión de Egresos</span>
            <IconButton onClick={() => setEgresosDialogOpen(false)} size="small">
              <Delete sx={{ fontSize: 20 }} />
            </IconButton>
          </DialogTitle>
          <DialogContent sx={{ pt: "20px !important" }}>
            {/* Formulario de Nuevo Egreso */}
            <Paper elevation={2} sx={{ p: 2.5, mb: 3, backgroundColor: "#fffdf7", border: "1px solid #ba9a63" }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, color: colorPrincipal, mb: 2 }}>
                {editandoEgreso ? "Editar Egreso" : "Registrar Nuevo Egreso"}
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Fecha"
                    type="date"
                    fullWidth
                    size="small"
                    value={egresoFecha}
                    onChange={(e) => setEgresoFecha(e.target.value)}
                    InputLabelProps={{ shrink: true }}
                    sx={{
                      "& .MuiInputBase-root": { backgroundColor: "#fff" },
                      "& .MuiOutlinedInput-root": {
                        "& fieldset": { borderColor: "#ba9a63" },
                        "&:hover fieldset": { borderColor: colorPrincipal },
                        "&.Mui-focused fieldset": { borderColor: colorPrincipal },
                      },
                    }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Monto (S/)"
                    type="number"
                    fullWidth
                    size="small"
                    value={egresoMonto}
                    onChange={(e) => setEgresoMonto(e.target.value)}
                    inputProps={{ min: 0, step: 0.01 }}
                    sx={{
                      "& .MuiInputBase-root": { backgroundColor: "#fff" },
                      "& .MuiOutlinedInput-root": {
                        "& fieldset": { borderColor: "#ba9a63" },
                        "&:hover fieldset": { borderColor: colorPrincipal },
                        "&.Mui-focused fieldset": { borderColor: colorPrincipal },
                      },
                    }}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    label="Descripción"
                    fullWidth
                    size="small"
                    multiline
                    rows={2}
                    value={egresoDescripcion}
                    onChange={(e) => setEgresoDescripcion(e.target.value)}
                    placeholder="Describe el egreso..."
                    sx={{
                      "& .MuiInputBase-root": { backgroundColor: "#fff" },
                      "& .MuiOutlinedInput-root": {
                        "& fieldset": { borderColor: "#ba9a63" },
                        "&:hover fieldset": { borderColor: colorPrincipal },
                        "&.Mui-focused fieldset": { borderColor: colorPrincipal },
                      },
                    }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    select
                    label="Categoría"
                    fullWidth
                    size="small"
                    value={egresoCategoria}
                    onChange={(e) => setEgresoCategoria(e.target.value)}
                    sx={{
                      "& .MuiInputBase-root": { backgroundColor: "#fff" },
                      "& .MuiOutlinedInput-root": {
                        "& fieldset": { borderColor: "#ba9a63" },
                        "&:hover fieldset": { borderColor: colorPrincipal },
                        "&.Mui-focused fieldset": { borderColor: colorPrincipal },
                      },
                    }}
                  >
                    <MenuItem value="Servicios">Servicios</MenuItem>
                    <MenuItem value="Insumos">Insumos</MenuItem>
                    <MenuItem value="Mantenimiento">Mantenimiento</MenuItem>
                    <MenuItem value="Salarios">Salarios</MenuItem>
                    <MenuItem value="Alquiler">Alquiler</MenuItem>
                    <MenuItem value="Impuestos">Impuestos</MenuItem>
                    <MenuItem value="Marketing">Marketing</MenuItem>
                    <MenuItem value="Otros">Otros</MenuItem>
                  </TextField>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    select
                    label="Método de Pago"
                    fullWidth
                    size="small"
                    value={egresoMetodoPago}
                    onChange={(e) => setEgresoMetodoPago(e.target.value)}
                    sx={{
                      "& .MuiInputBase-root": { backgroundColor: "#fff" },
                      "& .MuiOutlinedInput-root": {
                        "& fieldset": { borderColor: "#ba9a63" },
                        "&:hover fieldset": { borderColor: colorPrincipal },
                        "&.Mui-focused fieldset": { borderColor: colorPrincipal },
                      },
                    }}
                  >
                    <MenuItem value="Efectivo">Efectivo</MenuItem>
                    <MenuItem value="Tarjeta">Tarjeta</MenuItem>
                    <MenuItem value="Transferencia">Transferencia</MenuItem>
                    <MenuItem value="Yape">Yape</MenuItem>
                    <MenuItem value="Plin">Plin</MenuItem>
                  </TextField>
                </Grid>
                <Grid item xs={12}>
                  <Box sx={{ display: "flex", gap: 1, justifyContent: "flex-end" }}>
                    {editandoEgreso && (
                      <Button
                        variant="outlined"
                        size="small"
                        onClick={() => {
                          setEditandoEgreso(null);
                          setEgresoFecha(hoyISO());
                          setEgresoMonto("");
                          setEgresoDescripcion("");
                          setEgresoCategoria("Servicios");
                          setEgresoMetodoPago("Efectivo");
                        }}
                        sx={{ borderColor: "#ba9a63", color: "#ba9a63" }}
                      >
                        Cancelar Edición
                      </Button>
                    )}
                    <Button
                      variant="contained"
                      size="small"
                      onClick={guardarEgreso}
                      disabled={guardandoEgreso}
                      sx={{
                        backgroundColor: colorPrincipal,
                        "&:hover": { backgroundColor: "#8a5a1a" },
                      }}
                    >
                      {guardandoEgreso ? "Guardando..." : editandoEgreso ? "Actualizar" : "Guardar Egreso"}
                    </Button>
                  </Box>
                </Grid>
              </Grid>
            </Paper>

            {/* Filtros de Fecha */}
            <Paper elevation={1} sx={{ p: 2, mb: 2, backgroundColor: "#f5f1e4" }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: colorPrincipal, mb: 1.5 }}>
                Filtrar por Fechas
              </Typography>
              <Grid container spacing={2} alignItems="center">
                <Grid item xs={12} sm={4}>
                  <TextField
                    label="Fecha Inicio"
                    type="date"
                    fullWidth
                    size="small"
                    value={egresosFechaInicio}
                    onChange={(e) => setEgresosFechaInicio(e.target.value)}
                    InputLabelProps={{ shrink: true }}
                    sx={{
                      "& .MuiInputBase-root": { backgroundColor: "#fff" },
                      "& .MuiOutlinedInput-root": {
                        "& fieldset": { borderColor: "#ba9a63" },
                        "&:hover fieldset": { borderColor: colorPrincipal },
                        "&.Mui-focused fieldset": { borderColor: colorPrincipal },
                      },
                    }}
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    label="Fecha Fin"
                    type="date"
                    fullWidth
                    size="small"
                    value={egresosFechaFin}
                    onChange={(e) => setEgresosFechaFin(e.target.value)}
                    InputLabelProps={{ shrink: true }}
                    sx={{
                      "& .MuiInputBase-root": { backgroundColor: "#fff" },
                      "& .MuiOutlinedInput-root": {
                        "& fieldset": { borderColor: "#ba9a63" },
                        "&:hover fieldset": { borderColor: colorPrincipal },
                        "&.Mui-focused fieldset": { borderColor: colorPrincipal },
                      },
                    }}
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <Box sx={{ display: "flex", gap: 1 }}>
                    <Button
                      variant="contained"
                      size="small"
                      fullWidth
                      onClick={obtenerEgresos}
                      sx={{
                        backgroundColor: colorPrincipal,
                        "&:hover": { backgroundColor: "#8a5a1a" },
                      }}
                    >
                      Buscar
                    </Button>
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={() => {
                        setEgresosFechaInicio("");
                        setEgresosFechaFin("");
                        obtenerEgresos();
                      }}
                      sx={{ borderColor: "#ba9a63", color: "#ba9a63" }}
                    >
                      Limpiar
                    </Button>
                  </Box>
                </Grid>
              </Grid>
            </Paper>

            {/* Lista de Egresos */}
            <Paper elevation={2} sx={{ p: 2, backgroundColor: "#fff" }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, color: colorPrincipal, mb: 2 }}>
                Egresos Registrados
              </Typography>
              {egresos.length === 0 ? (
                <Typography align="center" color="textSecondary" sx={{ py: 3 }}>
                  No hay egresos registrados
                </Typography>
              ) : (
                <>
                  <Box sx={{ maxHeight: 300, overflowY: "auto" }}>
                    <Table size="small">
                      <TableHead>
                        <TableRow sx={{ backgroundColor: "#f5f1e4" }}>
                          <TableCell sx={{ fontWeight: 700, color: colorPrincipal }}>Fecha</TableCell>
                          <TableCell sx={{ fontWeight: 700, color: colorPrincipal }}>Descripción</TableCell>
                          <TableCell sx={{ fontWeight: 700, color: colorPrincipal }}>Categoría</TableCell>
                          <TableCell sx={{ fontWeight: 700, color: colorPrincipal }}>Método</TableCell>
                          <TableCell sx={{ fontWeight: 700, color: colorPrincipal, textAlign: "right" }}>Monto</TableCell>
                          <TableCell sx={{ fontWeight: 700, color: colorPrincipal, textAlign: "center" }}>Acciones</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {egresos.map((egreso) => (
                          <TableRow key={egreso.id} sx={{ "&:hover": { backgroundColor: "#f5f1e4" } }}>
                            <TableCell sx={{ fontSize: "0.85rem" }}>{formatearFechaCorta(egreso.fecha)}</TableCell>
                            <TableCell sx={{ fontSize: "0.85rem" }}>{egreso.descripcion}</TableCell>
                            <TableCell sx={{ fontSize: "0.85rem" }}>{egreso.categoria}</TableCell>
                            <TableCell sx={{ fontSize: "0.85rem" }}>{egreso.metodo_pago}</TableCell>
                            <TableCell sx={{ textAlign: "right", fontWeight: 600, color: colorPrincipal, fontSize: "0.85rem" }}>
                              S/ {Number(egreso.monto).toFixed(2)}
                            </TableCell>
                            <TableCell sx={{ textAlign: "center" }}>
                              <Tooltip title="Editar">
                                <IconButton size="small" onClick={() => abrirEditarEgreso(egreso)} sx={{ color: "#ba9a63" }}>
                                  <Edit sx={{ fontSize: 16 }} />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Eliminar">
                                <IconButton size="small" onClick={() => eliminarEgreso(egreso)} sx={{ color: "#f44336" }}>
                                  <Delete sx={{ fontSize: 16 }} />
                                </IconButton>
                              </Tooltip>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </Box>
                  {/* Total */}
                  <Box sx={{ mt: 2, p: 2, backgroundColor: "#f5f1e4", borderRadius: 2, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <Typography variant="h6" sx={{ fontWeight: 700, color: colorPrincipal }}>
                      TOTAL EGRESOS:
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 700, color: colorPrincipal }}>
                      S/ {Number(totalEgresos).toFixed(2)}
                    </Typography>
                  </Box>
                </>
              )}
            </Paper>
          </DialogContent>
        </Dialog>
      </Container>
    </div>
  );
};

export default Finanzas;
