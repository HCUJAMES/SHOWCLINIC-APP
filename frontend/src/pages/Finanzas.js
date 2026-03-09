import React, { useEffect, useState } from "react";
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
  const isMaster = localStorage.getItem("role") === "master";
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
    setTimeout(obtenerReporte, 0);
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
    setTimeout(obtenerReporte, 0);
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
    setTimeout(obtenerReporte, 0);
  };

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

          <Grid container spacing={2}>
            <Grid item xs={12} sm={4}>
              <TextField
                label="Paciente"
                value={paciente}
                onChange={(e) => setPaciente(e.target.value)}
                fullWidth
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                select
                label="Método de pago"
                value={metodoPago}
                onChange={(e) => setMetodoPago(e.target.value)}
                fullWidth
              >
                <MenuItem value="">Todos</MenuItem>
                <MenuItem value="Efectivo">Efectivo</MenuItem>
                <MenuItem value="Tarjeta">Tarjeta</MenuItem>
                <MenuItem value="Transferencia">Transferencia</MenuItem>
                <MenuItem value="Yape">Yape</MenuItem>
                <MenuItem value="Plin">Plin</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={6} sm={2}>
              <TextField
                label="Desde"
                type="date"
                InputLabelProps={{ shrink: true }}
                value={fechaInicio}
                onChange={(e) => setFechaInicio(e.target.value)}
                fullWidth
              />
            </Grid>
            <Grid item xs={6} sm={2}>
              <TextField
                label="Hasta"
                type="date"
                InputLabelProps={{ shrink: true }}
                value={fechaFin}
                onChange={(e) => setFechaFin(e.target.value)}
                fullWidth
              />
            </Grid>
            <Grid item xs={12}>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6} md={3}>
                  <Button
                    variant="contained"
                    fullWidth
                    sx={{
                      backgroundColor: colorPrincipal,
                      color: "white",
                      fontWeight: "bold",
                    }}
                    onClick={obtenerReporte}
                  >
                    Filtrar
                  </Button>
                </Grid>
                <Grid item xs={6} sm={3} md={2.25}>
                  <Button
                    variant="outlined"
                    fullWidth
                    sx={{
                      borderColor: colorPrincipal,
                      color: colorPrincipal,
                      fontWeight: "bold",
                      "&:hover": { backgroundColor: "rgba(246,227,197,0.75)" },
                    }}
                    onClick={filtrarPorDia}
                  >
                    Día
                  </Button>
                </Grid>
                <Grid item xs={6} sm={3} md={2.25}>
                  <Button
                    variant="outlined"
                    fullWidth
                    sx={{
                      borderColor: colorPrincipal,
                      color: colorPrincipal,
                      fontWeight: "bold",
                      "&:hover": { backgroundColor: "rgba(246,227,197,0.75)" },
                    }}
                    onClick={filtrarPorSemana}
                  >
                    Semana
                  </Button>
                </Grid>
                <Grid item xs={6} sm={3} md={2.25}>
                  <Button
                    variant="outlined"
                    fullWidth
                    sx={{
                      borderColor: colorPrincipal,
                      color: colorPrincipal,
                      fontWeight: "bold",
                      "&:hover": { backgroundColor: "rgba(246,227,197,0.75)" },
                    }}
                    onClick={filtrarPorMes}
                  >
                    Mes
                  </Button>
                </Grid>
                <Grid item xs={6} sm={3} md={2.25}>
                  <Button
                    variant="outlined"
                    fullWidth
                    sx={{
                      borderColor: "#2e7d32",
                      color: "#2e7d32",
                      fontWeight: "bold",
                      "&:hover": { backgroundColor: "rgba(46,125,50,0.1)" },
                    }}
                    onClick={filtrarPorDia}
                  >
                    Cierre de caja
                  </Button>
                </Grid>
              </Grid>
            </Grid>
            <Grid item xs={12}>
              <Button
                variant="outlined"
                startIcon={<SwapVert />}
                sx={{
                  borderColor: colorPrincipal,
                  color: colorPrincipal,
                  fontWeight: "bold",
                  "&:hover": { backgroundColor: "rgba(246,227,197,0.75)" },
                }}
                onClick={toggleOrden}
              >
                {ordenDescendente ? "Más recientes primero" : "Más antiguos primero"}
              </Button>
            </Grid>
          </Grid>

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
                    {isMaster && <TableCell align="center">Acciones</TableCell>}
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
                      {isMaster && (
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
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <Divider sx={{ my: 3 }} />

              <Typography align="right" sx={{ color: colorPrincipal, fontWeight: "bold", mb: 1 }}>
                Total neto: S/ {Number(totalGeneral || 0).toFixed(2)}
              </Typography>

              <Typography align="right" sx={{ color: "#555" }}>
                Total bruto: S/ {Number(totalBruto || 0).toFixed(2)}
              </Typography>

              <Typography align="right" sx={{ color: "#555", mb: 1 }}>
                Comisión POS (4% Tarjeta): S/ {Number(totalComision || 0).toFixed(2)}
              </Typography>

              {Object.entries(totalesMetodo).map(([metodo, total]) => (
                <Typography key={metodo} align="right" sx={{ color: "#555" }}>
                  {metodo}: S/ {total.toFixed(2)}
                </Typography>
              ))}

              <Button
                variant="outlined"
                onClick={generarPDF}
                sx={{
                  mt: 3,
                  borderColor: colorPrincipal,
                  color: colorPrincipal,
                  fontWeight: "bold",
                  "&:hover": { backgroundColor: "#f6e3c5" },
                }}
              >
                Exportar PDF
              </Button>
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
