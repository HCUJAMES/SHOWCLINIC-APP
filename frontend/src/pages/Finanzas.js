import React, { useEffect, useState, useRef, useCallback } from "react";
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchTrigger]);

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
          "linear-gradient(rgba(255,255,255,0.85), rgba(232,211,57,0.85)), url('/images/background-showclinic.jpg')",
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
              "linear-gradient(180deg, rgba(255,249,236,0.98) 0%, rgba(255,255,255,0.92) 52%, rgba(247,234,193,0.55) 100%)",
            border: "1px solid rgba(212,175,55,0.22)",
            backdropFilter: "blur(10px)",
            borderRadius: "15px",
            boxShadow:
              "0 18px 46px rgba(0,0,0,0.14), 0 0 0 1px rgba(212,175,55,0.10)",
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
              background: "linear-gradient(135deg, rgba(163,105,32,0.03) 0%, rgba(212,175,55,0.06) 100%)",
              border: "1px solid rgba(163,105,32,0.15)",
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
                    backgroundColor: filtroRapido === btn.key ? colorPrincipal : "white",
                    borderColor: filtroRapido === btn.key ? colorPrincipal : "rgba(163,105,32,0.3)",
                    color: filtroRapido === btn.key ? "white" : colorPrincipal,
                    fontWeight: 700,
                    fontSize: "0.8rem",
                    px: 2.5,
                    py: 0.8,
                    borderRadius: 2.5,
                    textTransform: "none",
                    boxShadow: filtroRapido === btn.key ? "0 2px 8px rgba(163,105,32,0.3)" : "0 1px 3px rgba(0,0,0,0.06)",
                    "&:hover": { 
                      backgroundColor: filtroRapido === btn.key ? "#8a5a1a" : "rgba(163,105,32,0.06)",
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
                  backgroundColor: filtroRapido === "caja" ? "#2e7d32" : "white",
                  borderColor: filtroRapido === "caja" ? "#2e7d32" : "rgba(46,125,50,0.3)",
                  color: filtroRapido === "caja" ? "white" : "#2e7d32",
                  fontWeight: 700,
                  fontSize: "0.8rem",
                  px: 2.5,
                  py: 0.8,
                  borderRadius: 2.5,
                  textTransform: "none",
                  boxShadow: filtroRapido === "caja" ? "0 2px 8px rgba(46,125,50,0.3)" : "0 1px 3px rgba(0,0,0,0.06)",
                  "&:hover": { backgroundColor: filtroRapido === "caja" ? "#1b5e20" : "rgba(46,125,50,0.06)" },
                }}
              >
                💰 Cierre de caja
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
                    "& .MuiInputBase-root": { backgroundColor: "white", borderRadius: 2, fontSize: "0.85rem", height: 40 },
                    "& .MuiOutlinedInput-root": { "&:hover fieldset": { borderColor: colorPrincipal }, "&.Mui-focused fieldset": { borderColor: colorPrincipal } },
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
                    "& .MuiInputBase-root": { backgroundColor: "white", borderRadius: 2, fontSize: "0.85rem", height: 40 },
                    "& .MuiOutlinedInput-root": { "&:hover fieldset": { borderColor: colorPrincipal }, "&.Mui-focused fieldset": { borderColor: colorPrincipal } },
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
                    "& .MuiInputBase-root": { backgroundColor: "white", borderRadius: 2, fontSize: "0.85rem", height: 40 },
                    "& .MuiOutlinedInput-root": { "&:hover fieldset": { borderColor: colorPrincipal }, "&.Mui-focused fieldset": { borderColor: colorPrincipal } },
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
                    "& .MuiInputBase-root": { backgroundColor: "white", borderRadius: 2, fontSize: "0.85rem", height: 40 },
                    "& .MuiOutlinedInput-root": { "&:hover fieldset": { borderColor: colorPrincipal }, "&.Mui-focused fieldset": { borderColor: colorPrincipal } },
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
                    "& .MuiInputBase-root": { backgroundColor: "white", borderRadius: 2, fontSize: "0.85rem", height: 40 },
                    "& .MuiOutlinedInput-root": { "&:hover fieldset": { borderColor: colorPrincipal }, "&.Mui-focused fieldset": { borderColor: colorPrincipal } },
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
                  color: "#666",
                  fontWeight: 600,
                  textTransform: "none",
                  fontSize: "0.8rem",
                  mr: "auto",
                  "&:hover": { backgroundColor: "rgba(0,0,0,0.04)" },
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
                  borderColor: "#bbb",
                  color: "#777",
                  fontWeight: 600,
                  borderRadius: 2,
                  textTransform: "none",
                  fontSize: "0.8rem",
                  "&:hover": { backgroundColor: "rgba(0,0,0,0.04)", borderColor: "#999" },
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
                  boxShadow: "0 2px 8px rgba(163,105,32,0.25)",
                  "&:hover": { backgroundColor: "#8a5a1a" },
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
                  <TableRow>
                    <TableCell>Fecha</TableCell>
                    <TableCell sx={{ minWidth: 220, maxWidth: 320 }}>Paciente</TableCell>
                    <TableCell sx={{ minWidth: 220, maxWidth: 340 }}>Tratamiento</TableCell>
                    <TableCell>Método de Pago</TableCell>
                    <TableCell sx={{ minWidth: 130, textAlign: "right" }}>Monto bruto (S/)</TableCell>
                    <TableCell sx={{ minWidth: 110, textAlign: "center" }}>Descuento (%)</TableCell>
                    <TableCell sx={{ minWidth: 100, textAlign: "center" }}>Estado</TableCell>
                    {canDoActions && <TableCell align="center">Acciones</TableCell>}
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
                              sx={{ color: "#2e7d32" }}
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
                                  sx={{ color: "#1565c0" }}
                                >
                                  <Edit fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Editar monto pagado">
                                <IconButton
                                  size="small"
                                  onClick={() => abrirEditarMonto(r)}
                                  sx={{ color: "#e65100" }}
                                >
                                  <AttachMoney fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Editar fecha de pago">
                                <IconButton
                                  size="small"
                                  onClick={() => abrirEditarFecha(r)}
                                  sx={{ color: "#6a1b9a" }}
                                >
                                  <CalendarMonth fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Eliminar registro">
                                <IconButton
                                  size="small"
                                  onClick={() => eliminarRegistro(r)}
                                  sx={{ color: "#b71c1c" }}
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
                  background: "linear-gradient(135deg, rgba(163,105,32,0.06) 0%, rgba(212,175,55,0.08) 100%)",
                  border: "1px solid rgba(163,105,32,0.18)",
                }}
              >
                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2.5, flexWrap: "wrap", gap: 1 }}>
                  <Typography variant="h6" sx={{ fontWeight: "bold", color: colorPrincipal, display: "flex", alignItems: "center", gap: 1 }}>
                    <AttachMoney /> Total del Período Filtrado
                  </Typography>
                  {(fechaInicio || fechaFin) && (
                    <Typography variant="body2" sx={{ color: "#666", fontWeight: 600, backgroundColor: "rgba(163,105,32,0.08)", px: 1.5, py: 0.5, borderRadius: 2, fontSize: "0.8rem" }}>
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
                        backgroundColor: "rgba(46,125,50,0.08)",
                        border: "1px solid rgba(46,125,50,0.25)",
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
                      <Typography variant="h5" sx={{ fontWeight: "bold", color: "#2e7d32", mt: 0.5 }}>
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
                        backgroundColor: "rgba(163,105,32,0.08)",
                        border: "1px solid rgba(163,105,32,0.25)",
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
                        backgroundColor: "rgba(198,40,40,0.06)",
                        border: "1px solid rgba(198,40,40,0.18)",
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
                      <Typography variant="h5" sx={{ fontWeight: "bold", color: "#c62828", mt: 0.5 }}>
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
                      backgroundColor: "rgba(255,255,255,0.7)",
                      border: "1px solid rgba(163,105,32,0.12)",
                    }}
                  >
                    <Typography variant="subtitle2" sx={{ fontWeight: "bold", color: "#555", mb: 1.5 }}>
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
                              backgroundColor: "rgba(163,105,32,0.04)",
                              border: "1px solid rgba(163,105,32,0.10)",
                            }}
                          >
                            <Typography variant="body2" sx={{ fontWeight: 600, color: "#555" }}>
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

                <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 2.5 }}>
                  <Button
                    variant="outlined"
                    onClick={generarPDF}
                    sx={{
                      borderColor: colorPrincipal,
                      color: colorPrincipal,
                      fontWeight: "bold",
                      px: 3,
                      "&:hover": { backgroundColor: "#f6e3c5" },
                    }}
                  >
                    Exportar PDF
                  </Button>
                </Box>
              </Paper>
            </>
          )}
        </Paper>

        <Dialog open={pagoDialogOpen} onClose={() => setPagoDialogOpen(false)} maxWidth="xs" fullWidth>
          <DialogTitle sx={{ color: colorPrincipal, fontWeight: "bold" }}>Registrar Pago</DialogTitle>
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
            <Button onClick={() => setPagoDialogOpen(false)} sx={{ color: "#666" }}>Cancelar</Button>
            <Button
              variant="contained"
              onClick={registrarPago}
              disabled={guardandoPago}
              sx={{ backgroundColor: "#2e7d32", "&:hover": { backgroundColor: "#1b5e20" } }}
            >
              {guardandoPago ? "Guardando..." : "Registrar Pago"}
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog open={editMetodoOpen} onClose={() => setEditMetodoOpen(false)} maxWidth="xs" fullWidth>
          <DialogTitle sx={{ color: "#1565c0", fontWeight: "bold" }}>Editar Método de Pago</DialogTitle>
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
            <Button onClick={() => setEditMetodoOpen(false)} sx={{ color: "#666" }}>Cancelar</Button>
            <Button
              variant="contained"
              onClick={guardarMetodoPago}
              disabled={guardandoMetodo}
              sx={{ backgroundColor: "#1565c0", "&:hover": { backgroundColor: "#0d47a1" } }}
            >
              {guardandoMetodo ? "Guardando..." : "Guardar Cambio"}
            </Button>
          </DialogActions>
        </Dialog>
        <Dialog open={editFechaOpen} onClose={() => setEditFechaOpen(false)} maxWidth="xs" fullWidth>
          <DialogTitle sx={{ color: "#6a1b9a", fontWeight: "bold" }}>Editar Fecha de Pago</DialogTitle>
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
            <Button onClick={() => setEditFechaOpen(false)} sx={{ color: "#666" }}>Cancelar</Button>
            <Button
              variant="contained"
              onClick={guardarFechaPago}
              disabled={guardandoFecha}
              sx={{ backgroundColor: "#6a1b9a", "&:hover": { backgroundColor: "#4a148c" } }}
            >
              {guardandoFecha ? "Guardando..." : "Guardar Cambio"}
            </Button>
          </DialogActions>
        </Dialog>
        <Dialog open={editMontoOpen} onClose={() => setEditMontoOpen(false)} maxWidth="xs" fullWidth>
          <DialogTitle sx={{ color: "#e65100", fontWeight: "bold" }}>Editar Monto Pagado</DialogTitle>
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
            <Button onClick={() => setEditMontoOpen(false)} sx={{ color: "#666" }}>Cancelar</Button>
            <Button
              variant="contained"
              onClick={guardarMontoPago}
              disabled={guardandoMonto}
              sx={{ backgroundColor: "#e65100", "&:hover": { backgroundColor: "#bf360c" } }}
            >
              {guardandoMonto ? "Guardando..." : "Guardar Cambio"}
            </Button>
          </DialogActions>
        </Dialog>
      </Container>
    </div>
  );
};

export default Finanzas;
