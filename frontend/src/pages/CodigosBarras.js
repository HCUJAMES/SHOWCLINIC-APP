import React, { useState } from "react";
import {
  Box,
  Typography,
  TextField,
  Button,
  Card,
  CardContent,
  Grid,
  IconButton,
  Paper,
  Divider,
  InputAdornment,
} from "@mui/material";
import {
  ArrowBack,
  QrCode2,
  Print,
  Add,
  Remove,
} from "@mui/icons-material";
import { useNavigate } from "react-router-dom";
import bwipjs from "bwip-js";

const colorPrincipal = "#a36920";
const colorSecundario = "#ba9a63";
const colorFondo = "#f5f1e4";

export default function CodigosBarras() {
  const navigate = useNavigate();
  
  const [formData, setFormData] = useState({
    header: "SHOWCLINIC",
    weekYear: "",
    productName: "BOTOX 100 UI",
    subtitle: "Allergan",
    barcode: "SC1001263401",
    footer1: "Vencec: 08/2027",
    footer2: "100 UI",
  });
  
  const [cantidad, setCantidad] = useState(1);
  const [barcodeImage, setBarcodeImage] = useState("");
  const [stickers, setStickers] = useState([]);

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const generarCodigoBarras = async (codigo) => {
    try {
      const canvas = document.createElement('canvas');
      bwipjs.toCanvas(canvas, {
        bcid: 'code128',
        text: codigo,
        scale: 3,
        height: 10,
        includetext: false,
        paddingwidth: 0,
        paddingheight: 0,
      });
      return canvas.toDataURL('image/png');
    } catch (err) {
      console.error('Error generando código de barras:', err);
      return '';
    }
  };

  const generarVistaPrevia = async () => {
    const img = await generarCodigoBarras(formData.barcode);
    setBarcodeImage(img);
  };

  const generarStickers = async () => {
    const stickersGenerados = [];
    for (let i = 0; i < cantidad; i++) {
      let codigoActual = formData.barcode;
      
      if (cantidad > 1) {
        const numero = parseInt(formData.barcode.slice(-4)) + i;
        codigoActual = formData.barcode.slice(0, -4) + numero.toString().padStart(4, '0');
      }
      
      const img = await generarCodigoBarras(codigoActual);
      stickersGenerados.push({
        ...formData,
        barcode: codigoActual,
        barcodeImage: img,
      });
    }
    setStickers(stickersGenerados);
  };

  const imprimirStickers = () => {
    const printWindow = window.open('', '_blank');
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Impresión de Stickers - ShowClinic</title>
        <style>
          @page {
            size: 56mm 30mm;
            margin: 0;
          }
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          body {
            font-family: Arial, sans-serif;
            background: white;
          }
          .sticker {
            width: 56mm;
            height: 30mm;
            padding: 2mm;
            page-break-after: always;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            border: 1px dashed #ccc;
            position: relative;
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 8pt;
            font-weight: bold;
            border-bottom: 1px solid #000;
            padding-bottom: 1mm;
          }
          .product-name {
            font-size: 10pt;
            font-weight: bold;
            text-align: left;
            margin: 1mm 0;
            text-transform: uppercase;
          }
          .subtitle {
            font-size: 7pt;
            text-align: left;
            margin-bottom: 1mm;
          }
          .barcode-container {
            text-align: center;
            margin: 1mm 0;
          }
          .barcode-container img {
            width: 100%;
            height: auto;
            max-height: 8mm;
          }
          .barcode-text {
            font-size: 8pt;
            text-align: center;
            letter-spacing: 1px;
            font-weight: bold;
            margin-top: 0.5mm;
          }
          .footer {
            font-size: 7pt;
            display: flex;
            justify-content: space-between;
            border-top: 1px solid #000;
            padding-top: 1mm;
          }
        </style>
      </head>
      <body>
        ${stickers.map(s => `
          <div class="sticker">
            <div class="header">
              <span>${s.header}</span>
              <span>${s.weekYear}</span>
            </div>
            <div class="product-name">${s.productName}</div>
            <div class="subtitle">${s.subtitle}</div>
            <div class="barcode-container">
              <img src="${s.barcodeImage}" alt="${s.barcode}" />
            </div>
            <div class="barcode-text">${s.barcode}</div>
            <div class="footer">
              <span>${s.footer1}</span>
              <span>${s.footer2}</span>
            </div>
          </div>
        `).join('')}
      </body>
      </html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.print();
    }, 500);
  };

  return (
    <Box sx={{ minHeight: "100vh", background: `linear-gradient(to bottom, ${colorFondo}, #fff)`, p: 3 }}>
      <Box sx={{ maxWidth: 1200, margin: "0 auto" }}>
        <Box sx={{ display: "flex", alignItems: "center", mb: 3 }}>
          <IconButton onClick={() => navigate("/dashboard")} sx={{ mr: 2, color: colorPrincipal }}>
            <ArrowBack />
          </IconButton>
          <QrCode2 sx={{ fontSize: 40, color: colorPrincipal, mr: 2 }} />
          <Typography variant="h4" sx={{ fontWeight: 700, color: colorPrincipal }}>
            Generador de Códigos de Barras
          </Typography>
        </Box>

        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Card sx={{ boxShadow: 3 }}>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 2, color: colorPrincipal, fontWeight: 600 }}>
                  Plantilla de Sticker
                </Typography>
                
                <TextField
                  fullWidth
                  label="Encabezado"
                  value={formData.header}
                  onChange={(e) => handleChange('header', e.target.value)}
                  sx={{ mb: 2 }}
                />
                
                <TextField
                  fullWidth
                  label="Semana/Año (ej: 26-W34)"
                  value={formData.weekYear}
                  onChange={(e) => handleChange('weekYear', e.target.value)}
                  sx={{ mb: 2 }}
                  placeholder="26-W34"
                />
                
                <TextField
                  fullWidth
                  label="Nombre del Producto"
                  value={formData.productName}
                  onChange={(e) => handleChange('productName', e.target.value)}
                  sx={{ mb: 2 }}
                />
                
                <TextField
                  fullWidth
                  label="Subtítulo (Marca/Detalle)"
                  value={formData.subtitle}
                  onChange={(e) => handleChange('subtitle', e.target.value)}
                  sx={{ mb: 2 }}
                />
                
                <TextField
                  fullWidth
                  label="Código de Barras"
                  value={formData.barcode}
                  onChange={(e) => handleChange('barcode', e.target.value)}
                  sx={{ mb: 2 }}
                  helperText="Ingresa el código que deseas convertir a barras"
                />
                
                <Grid container spacing={2} sx={{ mb: 2 }}>
                  <Grid item xs={6}>
                    <TextField
                      fullWidth
                      label="Pie izquierdo"
                      value={formData.footer1}
                      onChange={(e) => handleChange('footer1', e.target.value)}
                      placeholder="Vencec: 08/2027"
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <TextField
                      fullWidth
                      label="Pie derecho"
                      value={formData.footer2}
                      onChange={(e) => handleChange('footer2', e.target.value)}
                      placeholder="100 UI"
                    />
                  </Grid>
                </Grid>

                <Divider sx={{ my: 2 }} />

                <Typography variant="body2" sx={{ mb: 1, fontWeight: 600 }}>
                  Cantidad de stickers:
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <IconButton 
                    onClick={() => setCantidad(Math.max(1, cantidad - 1))}
                    sx={{ color: colorPrincipal }}
                  >
                    <Remove />
                  </IconButton>
                  <TextField
                    type="number"
                    value={cantidad}
                    onChange={(e) => setCantidad(Math.max(1, parseInt(e.target.value) || 1))}
                    sx={{ mx: 2, width: 100 }}
                    inputProps={{ min: 1, style: { textAlign: 'center' } }}
                  />
                  <IconButton 
                    onClick={() => setCantidad(cantidad + 1)}
                    sx={{ color: colorPrincipal }}
                  >
                    <Add />
                  </IconButton>
                </Box>
                
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
                  {cantidad > 1 && "Los códigos se incrementarán automáticamente en los últimos 4 dígitos"}
                </Typography>

                <Box sx={{ display: 'flex', gap: 2 }}>
                  <Button
                    fullWidth
                    variant="outlined"
                    onClick={generarVistaPrevia}
                    sx={{ 
                      borderColor: colorPrincipal, 
                      color: colorPrincipal,
                      '&:hover': { borderColor: colorSecundario, background: colorFondo }
                    }}
                  >
                    Vista Previa
                  </Button>
                  <Button
                    fullWidth
                    variant="contained"
                    onClick={generarStickers}
                    sx={{ 
                      background: colorPrincipal,
                      '&:hover': { background: '#8a5a1a' }
                    }}
                  >
                    Generar Stickers
                  </Button>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card sx={{ boxShadow: 3, minHeight: 400 }}>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 2, color: colorPrincipal, fontWeight: 600 }}>
                  Vista Previa (56mm x 30mm)
                </Typography>
                
                <Paper
                  sx={{
                    width: '56mm',
                    height: '30mm',
                    p: '2mm',
                    border: '1px dashed #ccc',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    margin: '0 auto',
                    background: '#fff',
                  }}
                >
                  <Box sx={{ 
                    display: 'flex', 
                    justifyContent: 'space-between',
                    borderBottom: '1px solid #000',
                    pb: '1mm',
                    fontSize: '8pt',
                    fontWeight: 'bold'
                  }}>
                    <span>{formData.header}</span>
                    <span>{formData.weekYear}</span>
                  </Box>
                  
                  <Typography sx={{ fontSize: '10pt', fontWeight: 'bold', my: '1mm' }}>
                    {formData.productName}
                  </Typography>
                  
                  <Typography sx={{ fontSize: '7pt', mb: '1mm' }}>
                    {formData.subtitle}
                  </Typography>
                  
                  <Box sx={{ textAlign: 'center', my: '1mm' }}>
                    {barcodeImage ? (
                      <img src={barcodeImage} alt="barcode" style={{ width: '100%', height: 'auto', maxHeight: '8mm' }} />
                    ) : (
                      <Box sx={{ height: '8mm', background: '#f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Typography variant="caption" color="text.secondary">Código de barras</Typography>
                      </Box>
                    )}
                  </Box>
                  
                  <Typography sx={{ fontSize: '8pt', fontWeight: 'bold', textAlign: 'center', letterSpacing: '1px', mt: '0.5mm' }}>
                    {formData.barcode}
                  </Typography>
                  
                  <Box sx={{ 
                    display: 'flex', 
                    justifyContent: 'space-between',
                    borderTop: '1px solid #000',
                    pt: '1mm',
                    fontSize: '7pt'
                  }}>
                    <span>{formData.footer1}</span>
                    <span>{formData.footer2}</span>
                  </Box>
                </Paper>

                {stickers.length > 0 && (
                  <Box sx={{ mt: 3 }}>
                    <Typography variant="body2" sx={{ mb: 1, fontWeight: 600 }}>
                      {stickers.length} sticker(s) generado(s)
                    </Typography>
                    <Button
                      fullWidth
                      variant="contained"
                      startIcon={<Print />}
                      onClick={imprimirStickers}
                      sx={{ 
                        background: '#4caf50',
                        '&:hover': { background: '#388e3c' }
                      }}
                    >
                      Imprimir en Xprinter (56mm x 30mm)
                    </Button>
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {stickers.length > 0 && (
          <Card sx={{ mt: 3, boxShadow: 3 }}>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2, color: colorPrincipal, fontWeight: 600 }}>
                Stickers Generados ({stickers.length})
              </Typography>
              <Grid container spacing={2}>
                {stickers.map((sticker, idx) => (
                  <Grid item xs={12} sm={6} md={4} lg={3} key={idx}>
                    <Paper
                      sx={{
                        p: 1,
                        border: '1px solid #ddd',
                        minHeight: 120,
                      }}
                    >
                      <Typography variant="caption" sx={{ fontWeight: 'bold', display: 'block', mb: 0.5 }}>
                        Sticker #{idx + 1}
                      </Typography>
                      <Typography variant="caption" sx={{ display: 'block', mb: 0.5 }}>
                        {sticker.productName}
                      </Typography>
                      <Box sx={{ textAlign: 'center', my: 1 }}>
                        <img 
                          src={sticker.barcodeImage} 
                          alt={sticker.barcode}
                          style={{ width: '100%', height: 'auto', maxHeight: 30 }}
                        />
                      </Box>
                      <Typography variant="caption" sx={{ textAlign: 'center', display: 'block', fontWeight: 'bold' }}>
                        {sticker.barcode}
                      </Typography>
                    </Paper>
                  </Grid>
                ))}
              </Grid>
            </CardContent>
          </Card>
        )}
      </Box>
    </Box>
  );
}
