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
} from "@mui/material";
import axios from "axios";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { useToast } from "../components/ToastProvider";

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
  process.env.REACT_APP_API_URL || `http://${window.location.hostname}:4000`;

const Finanzas = () => {
  const [paciente, setPaciente] = useState("");
  const [metodoPago, setMetodoPago] = useState("");
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");
  const [reporte, setReporte] = useState([]);
  const [totalGeneral, setTotalGeneral] = useState(0);
  const [totalBruto, setTotalBruto] = useState(0);
  const [totalComision, setTotalComision] = useState(0);
  const [totalesMetodo, setTotalesMetodo] = useState({});

  const { showToast } = useToast();

  const colorPrincipal = "#a36920";

  const hoyISO = () => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  const obtenerReporte = async () => {
    try {
      const params = {};
      if (paciente) params.paciente = paciente;
      if (metodoPago) params.metodoPago = metodoPago;
      if (fechaInicio) params.fechaInicio = fechaInicio;
      if (fechaFin) params.fechaFin = fechaFin;

      const res = await axios.get(`${API_BASE_URL}/api/finanzas/reporte`, { params });
      setReporte(res.data.resultados);
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
        r.fecha ? r.fecha.split(" ")[0] : "-",
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
          <Typography
            variant="h5"
            align="center"
            sx={{ mb: 4, color: colorPrincipal, fontWeight: "bold" }}
          >
            Reporte Financiero
          </Typography>

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
                <Grid item xs={12} sm={6}>
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
                <Grid item xs={12} sm={6}>
                  <Button
                    variant="outlined"
                    fullWidth
                    sx={{
                      borderColor: colorPrincipal,
                      color: colorPrincipal,
                      fontWeight: "bold",
                      "&:hover": { backgroundColor: "rgba(246,227,197,0.75)" },
                    }}
                    onClick={() => {
                      const hoy = hoyISO();
                      setFechaInicio(hoy);
                      setFechaFin(hoy);
                      setTimeout(obtenerReporte, 0);
                    }}
                  >
                    HOY (Cierre de caja)
                  </Button>
                </Grid>
              </Grid>
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
                  </TableRow>
                </TableHead>
                <TableBody>
                  {reporte.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>{r.fecha?.split(" ")[0]}</TableCell>
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
      </Container>
    </div>
  );
};

export default Finanzas;
