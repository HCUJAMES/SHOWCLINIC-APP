import React from "react";
import {
  Dialog,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Divider,
} from "@mui/material";
import { Print, Close } from "@mui/icons-material";

export default function ReciboTicket({ open, onClose, datos }) {
  const handlePrint = () => {
    window.print();
  };

  if (!datos) return null;

  const {
    paciente,
    tratamiento,
    especialista,
    fecha,
    pagoMetodo,
    sesion,
    total,
    descuento,
  } = datos;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2,
          "@media print": {
            boxShadow: "none",
            margin: 0,
            maxWidth: "80mm",
          },
        },
      }}
    >
      <DialogContent sx={{ p: 0 }}>
        {/* Contenido del ticket */}
        <Box
          id="ticket-contenido"
          sx={{
            p: 2,
            backgroundColor: "white",
            maxWidth: "80mm",
            margin: "0 auto",
            fontFamily: "monospace",
            "@media print": {
              padding: "5mm",
            },
          }}
        >
          {/* Header con logo */}
          <Box sx={{ textAlign: "center", mb: 2 }}>
            <Box
              component="img"
              src="/images/logo-showclinic.png"
              alt="ShowClinic"
              sx={{
                width: "60px",
                height: "60px",
                margin: "0 auto 8px",
                display: "block",
              }}
            />
            <Typography
              sx={{
                fontWeight: 800,
                fontSize: "1.2rem",
                color: "#D4AF37",
                letterSpacing: 1,
                fontFamily: "Arial, sans-serif",
              }}
            >
              SHOWCLINIC
            </Typography>
            <Typography
              sx={{
                fontSize: "0.7rem",
                color: "rgba(0,0,0,0.7)",
                fontFamily: "Arial, sans-serif",
              }}
            >
              Centro de Estética Profesional
            </Typography>
            <Divider sx={{ my: 1, borderStyle: "dashed" }} />
            <Typography
              sx={{
                fontWeight: 700,
                fontSize: "0.85rem",
                fontFamily: "Arial, sans-serif",
              }}
            >
              RECIBO DE PAGO
            </Typography>
            <Typography sx={{ fontSize: "0.7rem", color: "rgba(0,0,0,0.7)" }}>
              {fecha || new Date().toLocaleDateString("es-PE")}
            </Typography>
          </Box>

          <Divider sx={{ my: 1.5, borderStyle: "dashed" }} />

          {/* Datos del paciente */}
          <Box sx={{ mb: 1.5, fontSize: "0.75rem" }}>
            <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.3 }}>
              <Typography sx={{ fontSize: "0.75rem", fontWeight: 600 }}>
                PACIENTE:
              </Typography>
              <Typography sx={{ fontSize: "0.75rem" }}>
                {paciente?.nombre || "—"} {paciente?.apellido || ""}
              </Typography>
            </Box>
            <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.3 }}>
              <Typography sx={{ fontSize: "0.75rem", fontWeight: 600 }}>
                DNI:
              </Typography>
              <Typography sx={{ fontSize: "0.75rem" }}>
                {paciente?.dni || "—"}
              </Typography>
            </Box>
            <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.3 }}>
              <Typography sx={{ fontSize: "0.75rem", fontWeight: 600 }}>
                ESPECIALISTA:
              </Typography>
              <Typography sx={{ fontSize: "0.75rem" }}>
                {especialista || "—"}
              </Typography>
            </Box>
            <Box sx={{ display: "flex", justifyContent: "space-between" }}>
              <Typography sx={{ fontSize: "0.75rem", fontWeight: 600 }}>
                SESIÓN N°:
              </Typography>
              <Typography sx={{ fontSize: "0.75rem" }}>
                {sesion || "—"}
              </Typography>
            </Box>
          </Box>

          <Divider sx={{ my: 1.5, borderStyle: "dashed" }} />

          {/* Detalle del tratamiento */}
          <Box sx={{ mb: 1.5 }}>
            <Typography
              sx={{
                fontSize: "0.75rem",
                fontWeight: 700,
                mb: 1,
                textAlign: "center",
              }}
            >
              DETALLE DEL SERVICIO
            </Typography>
            <Box sx={{ mb: 1 }}>
              <Typography
                sx={{
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  mb: 0.5,
                }}
              >
                {tratamiento?.nombre || "Tratamiento"}
              </Typography>
              <Box sx={{ display: "flex", justifyContent: "space-between", fontSize: "0.7rem" }}>
                <Typography sx={{ fontSize: "0.7rem" }}>Precio:</Typography>
                <Typography sx={{ fontSize: "0.7rem" }}>
                  S/ {Number(tratamiento?.precio || 0).toFixed(2)}
                </Typography>
              </Box>
              {descuento > 0 && (
                <Box sx={{ display: "flex", justifyContent: "space-between", fontSize: "0.7rem" }}>
                  <Typography sx={{ fontSize: "0.7rem" }}>Descuento:</Typography>
                  <Typography sx={{ fontSize: "0.7rem", color: "#D4AF37" }}>
                    -{descuento}%
                  </Typography>
                </Box>
              )}
            </Box>
          </Box>

          <Divider sx={{ my: 1.5, borderStyle: "dashed" }} />

          {/* Total */}
          <Box sx={{ mb: 1.5 }}>
            <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
              <Typography sx={{ fontSize: "0.75rem", fontWeight: 600 }}>
                MÉTODO DE PAGO:
              </Typography>
              <Typography sx={{ fontSize: "0.75rem" }}>
                {pagoMetodo || "—"}
              </Typography>
            </Box>
            <Divider sx={{ my: 1 }} />
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <Typography
                sx={{
                  fontSize: "1rem",
                  fontWeight: 800,
                }}
              >
                TOTAL:
              </Typography>
              <Typography
                sx={{
                  fontSize: "1.2rem",
                  fontWeight: 800,
                  color: "#D4AF37",
                }}
              >
                S/ {Number(total || 0).toFixed(2)}
              </Typography>
            </Box>
          </Box>

          <Divider sx={{ my: 1.5, borderStyle: "dashed" }} />

          {/* Footer */}
          <Box sx={{ textAlign: "center", mt: 2 }}>
            <Typography
              sx={{
                fontSize: "0.65rem",
                color: "rgba(0,0,0,0.6)",
                fontStyle: "italic",
                mb: 1,
              }}
            >
              Gracias por confiar en ShowClinic
            </Typography>
            <Typography sx={{ fontSize: "0.6rem", color: "rgba(0,0,0,0.5)", mb: 0.3 }}>
              Av. Ejército 616, Centro de Negocios
            </Typography>
            <Typography sx={{ fontSize: "0.6rem", color: "rgba(0,0,0,0.5)", mb: 0.3 }}>
              Yanahuara, Perú
            </Typography>
            <Typography sx={{ fontSize: "0.6rem", color: "rgba(0,0,0,0.5)", fontWeight: 600 }}>
              Tel: 965 416 909
            </Typography>
          </Box>
        </Box>
      </DialogContent>

      {/* Botones de acción */}
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
          Imprimir
        </Button>
      </DialogActions>

      {/* Estilos de impresión para ticketera 80mm */}
      <style>
        {`
          @media print {
            body * {
              visibility: hidden;
            }
            #ticket-contenido,
            #ticket-contenido * {
              visibility: visible;
            }
            #ticket-contenido {
              position: absolute;
              left: 0;
              top: 0;
              width: 80mm;
            }
            @page {
              size: 80mm auto;
              margin: 0;
            }
          }
        `}
      </style>
    </Dialog>
  );
}
