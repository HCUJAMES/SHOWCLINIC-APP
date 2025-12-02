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
import { API_BASE } from "../config/api";

const Finanzas = () => {
  const [paciente, setPaciente] = useState("");
  const [metodoPago, setMetodoPago] = useState("");
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");
  const [reporte, setReporte] = useState([]);
  const [totalGeneral, setTotalGeneral] = useState(0);
  const [totalesMetodo, setTotalesMetodo] = useState({});

  const colorPrincipal = "#a36920";

  const obtenerReporte = async () => {
    try {
      const params = {};
      if (paciente) params.paciente = paciente;
      if (metodoPago) params.metodoPago = metodoPago;
      if (fechaInicio) params.fechaInicio = fechaInicio;
      if (fechaFin) params.fechaFin = fechaFin;

      const res = await axios.get(`${API_BASE}/api/finanzas/reporte`, { params });
      setReporte(res.data.resultados);
      setTotalGeneral(res.data.totalGeneral);
      setTotalesMetodo(res.data.totalesPorMetodo);
    } catch (error) {
      console.error("❌ Error al obtener reporte financiero:", error);
      alert("Error al obtener reporte financiero");
    }
  };

  const generarPDF = () => {
    const doc = new jsPDF("p", "pt", "a4");

    // Logo
    const logo = "/images/logo-showclinic.png";
    const img = new Image();
    img.src = logo;
    img.onload = () => {
      doc.addImage(img, "PNG", 40, 30, 100, 60);

      doc.setFont("Helvetica", "bold");
      doc.setTextColor(colorPrincipal);
      doc.setFontSize(18);
      doc.text("Reporte Financiero - ShowClinic", 180, 70);

      doc.setFontSize(11);
      doc.setTextColor("#000");
      doc.text(`Fecha de emisión: ${new Date().toLocaleDateString()}`, 400, 100);

      // Tabla
      const tabla = reporte.map((r) => [
        r.fecha ? r.fecha.split(" ")[0] : "-",
        r.paciente,
        r.tratamiento,
        r.pagoMetodo,
        `S/ ${(r.precio_total || 0).toFixed(2)}`,
        `${r.descuento || 0}%`,
      ]);

      autoTable(doc, {
        startY: 130,
        head: [["Fecha", "Paciente", "Tratamiento", "Pago", "Monto", "Desc."]],
        body: tabla,
        headStyles: { fillColor: [163, 105, 32], halign: "center" },
        styles: { fontSize: 9 },
      });

      // Totales
      let y = doc.lastAutoTable.finalY + 30;
      doc.setFontSize(13);
      doc.setTextColor(colorPrincipal);
      doc.text(`💰 Total general: S/ ${totalGeneral.toFixed(2)}`, 40, y);

      y += 20;
      doc.setFontSize(11);
      doc.setTextColor("#000");
      Object.entries(totalesMetodo).forEach(([metodo, total]) => {
        doc.text(`• ${metodo}: S/ ${total.toFixed(2)}`, 60, y);
        y += 15;
      });

      doc.save("Reporte_Finanzas_ShowClinic.pdf");
    };
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
            backgroundColor: "rgba(255, 255, 255, 0.95)",
            borderRadius: "15px",
            boxShadow: "0px 8px 30px rgba(0,0,0,0.15)",
          }}
        >
          <Typography
            variant="h5"
            align="center"
            sx={{ mb: 4, color: colorPrincipal, fontWeight: "bold" }}
          >
            💰 Reporte Financiero
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
              <Button
                variant="contained"
                onClick={obtenerReporte}
                sx={{
                  backgroundColor: colorPrincipal,
                  "&:hover": { backgroundColor: "#8b581b" },
                  fontWeight: "bold",
                }}
              >
                🔍 Filtrar
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
                    <TableCell>Paciente</TableCell>
                    <TableCell>Tratamiento</TableCell>
                    <TableCell>Método de Pago</TableCell>
                    <TableCell>Monto (S/)</TableCell>
                    <TableCell>Descuento (%)</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {reporte.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>{r.fecha?.split(" ")[0]}</TableCell>
                      <TableCell>{r.paciente}</TableCell>
                      <TableCell>{r.tratamiento}</TableCell>
                      <TableCell>{r.pagoMetodo}</TableCell>
                      <TableCell>{r.precio_total?.toFixed(2)}</TableCell>
                      <TableCell>{r.descuento}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <Divider sx={{ my: 3 }} />

              <Typography align="right" sx={{ color: colorPrincipal, fontWeight: "bold", mb: 1 }}>
                💰 Total General: S/ {totalGeneral.toFixed(2)}
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
                🧾 Exportar PDF
              </Button>
            </>
          )}
        </Paper>
      </Container>
    </div>
  );
};

export default Finanzas;
