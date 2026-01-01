import React from "react";
import {
  Dialog,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
} from "@mui/material";
import { Print, Close } from "@mui/icons-material";

export default function ReciboModal({ open, onClose, datos }) {
  const handlePrint = () => {
    window.print();
  };

  if (!datos) return null;

  const {
    paciente,
    tratamientos = [],
    especialista,
    fecha,
    pagoMetodo,
    sesion,
    totalGeneral,
  } = datos;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
          "@media print": {
            boxShadow: "none",
            margin: 0,
            maxWidth: "100%",
          },
        },
      }}
    >
      <DialogContent sx={{ p: 0 }}>
        {/* Contenido del recibo */}
        <Box
          id="recibo-contenido"
          sx={{
            p: 4,
            backgroundColor: "white",
            "@media print": {
              padding: "20mm",
            },
          }}
        >
          {/* Header con logo */}
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              mb: 4,
              pb: 3,
              borderBottom: "3px solid #D4AF37",
            }}
          >
            <Box>
              <Typography
                variant="h4"
                sx={{
                  fontWeight: 800,
                  color: "#D4AF37",
                  letterSpacing: 1,
                  mb: 0.5,
                }}
              >
                SHOWCLINIC
              </Typography>
              <Typography
                variant="body2"
                sx={{ color: "rgba(0,0,0,0.6)", fontWeight: 500 }}
              >
                Centro de Estética Profesional
              </Typography>
            </Box>
            <Box sx={{ textAlign: "right" }}>
              <Typography
                variant="h6"
                sx={{ fontWeight: 700, color: "#D4AF37", mb: 0.5 }}
              >
                RECIBO DE PAGO
              </Typography>
              <Typography variant="body2" sx={{ color: "rgba(0,0,0,0.7)" }}>
                {fecha || new Date().toLocaleDateString("es-PE")}
              </Typography>
            </Box>
          </Box>

          {/* Información del paciente */}
          <Box sx={{ mb: 4 }}>
            <Typography
              variant="subtitle1"
              sx={{
                fontWeight: 700,
                color: "#D4AF37",
                mb: 2,
                textTransform: "uppercase",
                letterSpacing: 0.5,
              }}
            >
              Datos del Paciente
            </Typography>
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 2,
                backgroundColor: "rgba(212,175,55,0.05)",
                p: 2.5,
                borderRadius: 2,
                border: "1px solid rgba(212,175,55,0.2)",
              }}
            >
              <Box>
                <Typography
                  variant="caption"
                  sx={{ color: "rgba(0,0,0,0.5)", fontWeight: 600 }}
                >
                  NOMBRE COMPLETO
                </Typography>
                <Typography variant="body1" sx={{ fontWeight: 600, mt: 0.5 }}>
                  {paciente?.nombre || "—"} {paciente?.apellido || ""}
                </Typography>
              </Box>
              <Box>
                <Typography
                  variant="caption"
                  sx={{ color: "rgba(0,0,0,0.5)", fontWeight: 600 }}
                >
                  DNI
                </Typography>
                <Typography variant="body1" sx={{ fontWeight: 600, mt: 0.5 }}>
                  {paciente?.dni || "—"}
                </Typography>
              </Box>
              <Box>
                <Typography
                  variant="caption"
                  sx={{ color: "rgba(0,0,0,0.5)", fontWeight: 600 }}
                >
                  ESPECIALISTA
                </Typography>
                <Typography variant="body1" sx={{ fontWeight: 600, mt: 0.5 }}>
                  {especialista || "—"}
                </Typography>
              </Box>
              <Box>
                <Typography
                  variant="caption"
                  sx={{ color: "rgba(0,0,0,0.5)", fontWeight: 600 }}
                >
                  SESIÓN N°
                </Typography>
                <Typography variant="body1" sx={{ fontWeight: 600, mt: 0.5 }}>
                  {sesion || "—"}
                </Typography>
              </Box>
            </Box>
          </Box>

          {/* Detalle de tratamientos */}
          <Box sx={{ mb: 4 }}>
            <Typography
              variant="subtitle1"
              sx={{
                fontWeight: 700,
                color: "#D4AF37",
                mb: 2,
                textTransform: "uppercase",
                letterSpacing: 0.5,
              }}
            >
              Detalle de Servicios
            </Typography>
            <Table
              sx={{
                border: "1px solid rgba(212,175,55,0.2)",
                borderRadius: 2,
                overflow: "hidden",
              }}
            >
              <TableHead>
                <TableRow sx={{ backgroundColor: "#D4AF37" }}>
                  <TableCell
                    sx={{
                      color: "white",
                      fontWeight: 700,
                      fontSize: "0.875rem",
                    }}
                  >
                    TRATAMIENTO
                  </TableCell>
                  <TableCell
                    align="center"
                    sx={{
                      color: "white",
                      fontWeight: 700,
                      fontSize: "0.875rem",
                    }}
                  >
                    CANTIDAD
                  </TableCell>
                  <TableCell
                    align="right"
                    sx={{
                      color: "white",
                      fontWeight: 700,
                      fontSize: "0.875rem",
                    }}
                  >
                    PRECIO
                  </TableCell>
                  <TableCell
                    align="right"
                    sx={{
                      color: "white",
                      fontWeight: 700,
                      fontSize: "0.875rem",
                    }}
                  >
                    DESCUENTO
                  </TableCell>
                  <TableCell
                    align="right"
                    sx={{
                      color: "white",
                      fontWeight: 700,
                      fontSize: "0.875rem",
                    }}
                  >
                    TOTAL
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {tratamientos.map((trat, idx) => (
                  <TableRow
                    key={idx}
                    sx={{
                      "&:nth-of-type(odd)": {
                        backgroundColor: "rgba(212,175,55,0.03)",
                      },
                    }}
                  >
                    <TableCell sx={{ fontWeight: 500 }}>
                      {trat.nombre || "—"}
                    </TableCell>
                    <TableCell align="center">{trat.cantidad || 1}</TableCell>
                    <TableCell align="right">
                      S/ {Number(trat.precio || 0).toFixed(2)}
                    </TableCell>
                    <TableCell align="right">
                      {trat.descuento || 0}%
                    </TableCell>
                    <TableCell
                      align="right"
                      sx={{ fontWeight: 600, color: "#D4AF37" }}
                    >
                      S/ {Number(trat.total || 0).toFixed(2)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>

          {/* Total y método de pago */}
          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              backgroundColor: "rgba(212,175,55,0.1)",
              p: 3,
              borderRadius: 2,
              border: "2px solid #D4AF37",
              mb: 4,
            }}
          >
            <Box>
              <Typography
                variant="caption"
                sx={{ color: "rgba(0,0,0,0.6)", fontWeight: 600 }}
              >
                MÉTODO DE PAGO
              </Typography>
              <Typography variant="h6" sx={{ fontWeight: 700, mt: 0.5 }}>
                {pagoMetodo || "—"}
              </Typography>
            </Box>
            <Box sx={{ textAlign: "right" }}>
              <Typography
                variant="caption"
                sx={{ color: "rgba(0,0,0,0.6)", fontWeight: 600 }}
              >
                TOTAL A PAGAR
              </Typography>
              <Typography
                variant="h4"
                sx={{ fontWeight: 800, color: "#D4AF37", mt: 0.5 }}
              >
                S/ {Number(totalGeneral || 0).toFixed(2)}
              </Typography>
            </Box>
          </Box>

          {/* Footer */}
          <Divider sx={{ mb: 3, borderColor: "rgba(212,175,55,0.3)" }} />
          <Box sx={{ textAlign: "center" }}>
            <Typography
              variant="body2"
              sx={{ color: "rgba(0,0,0,0.5)", mb: 1, fontStyle: "italic" }}
            >
              Gracias por confiar en ShowClinic
            </Typography>
            <Typography variant="caption" sx={{ color: "rgba(0,0,0,0.4)" }}>
              Este documento es un comprobante de pago válido
            </Typography>
          </Box>
        </Box>
      </DialogContent>

      {/* Botones de acción (no se imprimen) */}
      <DialogActions
        sx={{
          p: 2,
          borderTop: "1px solid rgba(0,0,0,0.1)",
          "@media print": {
            display: "none",
          },
        }}
      >
        <Button
          onClick={onClose}
          startIcon={<Close />}
          sx={{ color: "rgba(0,0,0,0.6)" }}
        >
          Cerrar
        </Button>
        <Button
          onClick={handlePrint}
          variant="contained"
          startIcon={<Print />}
          sx={{
            backgroundColor: "#D4AF37",
            "&:hover": { backgroundColor: "#B8941F" },
            fontWeight: 600,
          }}
        >
          Imprimir Recibo
        </Button>
      </DialogActions>

      {/* Estilos de impresión */}
      <style>
        {`
          @media print {
            body * {
              visibility: hidden;
            }
            #recibo-contenido,
            #recibo-contenido * {
              visibility: visible;
            }
            #recibo-contenido {
              position: absolute;
              left: 0;
              top: 0;
              width: 100%;
            }
            @page {
              size: A4;
              margin: 20mm;
            }
          }
        `}
      </style>
    </Dialog>
  );
}
