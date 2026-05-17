import React, { useState, useEffect, useMemo } from "react";
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  TextField,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  InputAdornment,
  Grid,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  LinearProgress,
  Checkbox,
  FormControlLabel,
  Collapse,
  Divider,
} from "@mui/material";
import {
  ArrowBack,
  Search,
  Download,
  Add,
  Visibility,
  Edit,
  Warning,
  Inventory2,
  Category,
  Schedule,
  Print,
  ExpandMore,
  ExpandLess,
  Close,
} from "@mui/icons-material";
import { useNavigate } from "react-router-dom";
import bwipjs from "bwip-js";

const API_BASE = process.env.REACT_APP_API_URL || `${window.location.protocol}//${window.location.hostname}:4000`;
const colorPrincipal = "#a36920";
const colorSecundario = "#ba9a63";
const colorFondo = "#f5f1e4";
const colorCream = "#fffdf7";

const inferirCategoria = (marca, variante) => {
  const texto = `${marca || ""} ${variante || ""}`.toLowerCase();
  if (texto.includes("botox") || texto.includes("toxina") || texto.includes("dysport") || texto.includes("xeomin") || texto.includes("nbotox")) return "Toxina";
  if (texto.includes("filler") || texto.includes("relleno") || texto.includes("juvederm") || texto.includes("restylane") || texto.includes("volift") || texto.includes("belotero")) return "Filler";
  if (texto.includes("bioestimulante") || texto.includes("radiesse") || texto.includes("sculptra") || texto.includes("profhilo") || texto.includes("jalupro")) return "Bioestim.";
  if (texto.includes("enzima") || texto.includes("lipolytic") || texto.includes("pb serum")) return "Enzima";
  if (texto.includes("skincare") || texto.includes("skin") || texto.includes("peeling") || texto.includes("serum")) return "Skincare";
  return "Otro";
};

const getCategoriaColor = (cat) => {
  switch (cat) {
    case "Toxina": return { bg: "#fef3e2", text: "#a36920" };
    case "Filler": return { bg: "#e8f5e9", text: "#2e7d32" };
    case "Bioestim.": return { bg: "#e3f2fd", text: "#1565c0" };
    case "Enzima": return { bg: "#fce4ec", text: "#c62828" };
    case "Skincare": return { bg: "#f3e5f5", text: "#7b1fa2" };
    default: return { bg: "#f5f5f5", text: "#616161" };
  }
};

const getEstadoInfo = (disponible, vencimiento) => {
  if (disponible <= 0) return { label: "Agotado", color: "#d32f2f", dot: "#d32f2f" };
  if (vencimiento) {
    const today = new Date();
    const venc = new Date(vencimiento);
    const diffDays = Math.ceil((venc - today) / (1000 * 60 * 60 * 24));
    if (diffDays <= 30 && diffDays > 0) return { label: `Por vencer (${diffDays}d)`, color: "#f57c00", dot: "#f57c00" };
  }
  if (disponible <= 3) return { label: "Bajo", color: "#f57c00", dot: "#f57c00" };
  return { label: "Óptimo", color: "#2e7d32", dot: "#2e7d32" };
};

const generarCodigoBarras = async (codigo) => {
  try {
    const canvas = document.createElement("canvas");
    bwipjs.toCanvas(canvas, {
      bcid: "code128",
      text: codigo,
      scale: 3,
      height: 10,
      includetext: false,
      paddingwidth: 0,
      paddingheight: 0,
    });
    return canvas.toDataURL("image/png");
  } catch (err) {
    console.error("Error generando código de barras:", err);
    return "";
  }
};

const construirPrefijoCodigo = (nombreProducto, lote) => {
  const letras = (nombreProducto || "XX").replace(/[^a-zA-Z]/g, "").substring(0, 2).toUpperCase() || "XX";
  const numLote = (lote || "00").replace(/\D/g, "");
  const ultimos2 = numLote.length >= 2 ? numLote.slice(-2) : numLote.padStart(2, "0");
  return `${letras}${ultimos2}`;
};

const STICKER_W = "50mm";
const STICKER_H = "25mm";

const imprimirSticker = (stickerData) => {
  const printWindow = window.open("", "_blank");
  if (!printWindow) return;
  const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Sticker</title>
<style>
  @page {
    size: 50mm 25mm landscape;
    margin: 0;
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body {
    width: 50mm; height: 25mm;
    margin: 0 !important; padding: 0 !important;
    overflow: hidden;
    font-family: Arial, sans-serif;
    -webkit-print-color-adjust: exact;
  }
  .sticker {
    width: 50mm; height: 25mm;
    padding: 1mm 2mm;
    display: flex; flex-direction: column;
    justify-content: space-between;
  }
  .row-top {
    display: flex; justify-content: space-between; align-items: center;
    font-size: 5.5pt; font-weight: 700;
    border-bottom: 0.3pt solid #000;
    padding-bottom: 0.5mm; line-height: 1;
  }
  .name {
    font-size: 7pt; font-weight: 900;
    text-transform: uppercase; line-height: 1;
    margin-top: 0.5mm;
    overflow: hidden; white-space: nowrap; text-overflow: ellipsis;
  }
  .sub {
    font-size: 5pt; line-height: 1; margin-top: 0.2mm;
    overflow: hidden; white-space: nowrap; text-overflow: ellipsis;
  }
  .bc { text-align: center; flex: 1; display: flex; align-items: center; justify-content: center; }
  .bc img { width: 44mm; height: 6mm; object-fit: contain; }
  .code {
    font-size: 6.5pt; font-weight: 800; text-align: center;
    letter-spacing: 1.2px; font-family: 'Courier New', monospace; line-height: 1;
  }
  .row-bot {
    display: flex; justify-content: space-between; align-items: center;
    font-size: 5pt; border-top: 0.3pt solid #000;
    padding-top: 0.3mm; line-height: 1;
  }
</style></head>
<body>
<div class="sticker">
  <div class="row-top"><span>SHOWCLINIC</span><span>${stickerData.semana}</span></div>
  <div class="name">${stickerData.nombre}</div>
  <div class="sub">${stickerData.marca} &middot; Lote: ${stickerData.lote}</div>
  <div class="bc"><img src="${stickerData.barcodeImg}" /></div>
  <div class="code">${stickerData.codigo}</div>
  <div class="row-bot"><span>Vence: ${stickerData.vence}</span><span>${stickerData.unidad}</span></div>
</div>
</body></html>`;
  printWindow.document.write(html);
  printWindow.document.close();
  setTimeout(() => {
    printWindow.focus();
    printWindow.print();
  }, 500);
};

export default function Inventario() {
  const navigate = useNavigate();
  const token = localStorage.getItem("token");
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  const [vista, setVista] = useState("lista");
  const [productoDetalle, setProductoDetalle] = useState(null);

  const [variantes, setVariantes] = useState([]);
  const [stockLotes, setStockLotes] = useState([]);
  const [productosBase, setProductosBase] = useState([]);
  const [filtroTexto, setFiltroTexto] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState("Todos");

  // Modal Registrar
  const [openRegistrar, setOpenRegistrar] = useState(false);
  const [modoNuevoProducto, setModoNuevoProducto] = useState(false);
  const [formLote, setFormLote] = useState({
    variante_id: "",
    lote: "",
    fecha_vencimiento: "",
    cantidad_unidades: "",
    cajas: "",
    jeringas: "",
    fecha_ingreso: new Date().toISOString().slice(0, 10),
  });
  const [formNuevoProducto, setFormNuevoProducto] = useState({
    marca: "",
    nombre: "",
    laboratorio: "",
    unidad_base: "UI",
    contenido_por_presentacion: "",
  });
  const [imprimirAlGuardar, setImprimirAlGuardar] = useState(false);
  const [codigoPreview, setCodigoPreview] = useState({ prefijo: "", correlativo: "", codigo: "" });

  const obtenerSiguienteCorrelativo = async (nombreProducto, lote) => {
    const prefijo = construirPrefijoCodigo(nombreProducto, lote);
    if (prefijo.length < 2) return;
    try {
      const res = await fetch(`${API_BASE}/api/barcodes/next-correlativo?prefix=${encodeURIComponent(prefijo)}`, { headers });
      if (res.ok) {
        const data = await res.json();
        setCodigoPreview({ prefijo: data.prefix, correlativo: String(data.next).padStart(4, "0"), codigo: data.codigo });
      } else {
        setCodigoPreview({ prefijo, correlativo: "0001", codigo: `${prefijo}0001` });
      }
    } catch {
      setCodigoPreview({ prefijo, correlativo: "0001", codigo: `${prefijo}0001` });
    }
  };

  // Modal Editar
  const [openEditarLote, setOpenEditarLote] = useState(false);
  const [loteEditando, setLoteEditando] = useState(null);

  // Modal Sticker
  const [openSticker, setOpenSticker] = useState(false);
  const [stickerPreview, setStickerPreview] = useState(null);

  useEffect(() => { cargarDatos(); }, []);

  const cargarDatos = () => {
    Promise.all([
      fetch(`${API_BASE}/api/inventario/variantes`, { headers }).then(r => r.json()),
      fetch(`${API_BASE}/api/inventario/stock-lotes`, { headers }).then(r => r.json()),
      fetch(`${API_BASE}/api/inventario/productos-base`, { headers }).then(r => r.json()),
    ]).then(([vars, lotes, prods]) => {
      setVariantes(Array.isArray(vars) ? vars : []);
      setStockLotes(Array.isArray(lotes) ? lotes : []);
      setProductosBase(Array.isArray(prods) ? prods : []);
    }).catch(err => console.error("Error cargando datos:", err));
  };

  const productos = useMemo(() => {
    const map = new Map();
    stockLotes.forEach((l) => {
      const key = String(l.variante_id);
      const disponible = Math.max(0, (parseFloat(l.cantidad_unidades) || 0) - (parseFloat(l.cantidad_reservada_unidades) || 0));
      const prev = map.get(key);
      if (!prev) {
        map.set(key, {
          variante_id: l.variante_id,
          marca: l.producto_base_nombre || "",
          variante: l.variante_nombre || "",
          unidad_base: l.unidad_base || "",
          stock: disponible,
          cajas: parseFloat(l.cajas) || 0,
          jeringas: parseFloat(l.jeringas) || 0,
          lotes_count: 1,
          vencimiento_proximo: l.fecha_vencimiento || null,
        });
      } else {
        prev.stock += disponible;
        prev.cajas += (parseFloat(l.cajas) || 0);
        prev.jeringas += (parseFloat(l.jeringas) || 0);
        prev.lotes_count += 1;
        if (l.fecha_vencimiento && (!prev.vencimiento_proximo || l.fecha_vencimiento < prev.vencimiento_proximo)) {
          prev.vencimiento_proximo = l.fecha_vencimiento;
        }
      }
    });
    variantes.forEach((v) => {
      const key = String(v.id);
      if (!map.has(key)) {
        map.set(key, {
          variante_id: v.id, marca: v.producto_base_nombre || "", variante: v.nombre || "",
          unidad_base: v.unidad_base || "", stock: 0, cajas: 0, jeringas: 0, lotes_count: 0, vencimiento_proximo: null,
        });
      }
    });
    return Array.from(map.values()).map((p) => ({
      ...p,
      categoria: inferirCategoria(p.marca, p.variante),
      estado: getEstadoInfo(p.stock, p.vencimiento_proximo),
    }));
  }, [stockLotes, variantes]);

  const categorias = useMemo(() => {
    const counts = {};
    productos.forEach(p => { counts[p.categoria] = (counts[p.categoria] || 0) + 1; });
    return Object.entries(counts).map(([cat, count]) => ({ label: cat, count }));
  }, [productos]);

  const productosFiltrados = useMemo(() => {
    let filtered = productos;
    if (filtroCategoria !== "Todos") filtered = filtered.filter(p => p.categoria === filtroCategoria);
    if (filtroTexto.trim()) {
      const term = filtroTexto.trim().toLowerCase();
      filtered = filtered.filter(p => `${p.variante} ${p.marca}`.toLowerCase().includes(term));
    }
    return filtered.sort((a, b) => {
      if (a.stock === 0 && b.stock > 0) return -1;
      if (b.stock === 0 && a.stock > 0) return 1;
      return a.variante.localeCompare(b.variante);
    });
  }, [productos, filtroCategoria, filtroTexto]);

  const stockBajo = productos.filter(p => p.estado.label === "Bajo" || p.estado.label === "Agotado").length;
  const porVencer = productos.filter(p => p.estado.label.includes("Por vencer")).length;
  const marcasActivas = new Set(productos.map(p => p.marca)).size;

  const lotesDelProducto = useMemo(() => {
    if (!productoDetalle) return [];
    return stockLotes
      .filter(l => String(l.variante_id) === String(productoDetalle.variante_id))
      .map(l => {
        const disponible = Math.max(0, (parseFloat(l.cantidad_unidades) || 0) - (parseFloat(l.cantidad_reservada_unidades) || 0));
        const cantidadOriginal = parseFloat(l.cantidad_unidades) || 0;
        return { ...l, disponible, cantidad_original: cantidadOriginal, porcentaje: cantidadOriginal > 0 ? (disponible / cantidadOriginal) * 100 : 0 };
      })
      .sort((a, b) => {
        if (!a.fecha_vencimiento) return 1;
        if (!b.fecha_vencimiento) return -1;
        return a.fecha_vencimiento.localeCompare(b.fecha_vencimiento);
      });
  }, [productoDetalle, stockLotes]);

  const handleCrearProductoYRegistrar = async () => {
    const { marca, nombre, laboratorio, unidad_base, contenido_por_presentacion } = formNuevoProducto;
    if (!marca || !nombre || !unidad_base || !contenido_por_presentacion) {
      alert("Marca, nombre, unidad y contenido son obligatorios");
      return;
    }
    try {
      let productoBaseId;
      const existente = productosBase.find(pb => pb.nombre.toLowerCase() === marca.toLowerCase());
      if (existente) {
        productoBaseId = existente.id;
      } else {
        const resMarca = await fetch(`${API_BASE}/api/inventario/productos-base`, { method: "POST", headers, body: JSON.stringify({ nombre: marca }) });
        const marcaData = await resMarca.json();
        productoBaseId = marcaData.id;
      }

      const resVar = await fetch(`${API_BASE}/api/inventario/variantes`, {
        method: "POST", headers,
        body: JSON.stringify({ producto_base_id: productoBaseId, nombre, laboratorio, unidad_base, contenido_por_presentacion: parseFloat(contenido_por_presentacion), es_medico: true }),
      });
      const varData = await resVar.json();

      if (!formLote.cantidad_unidades) { alert("Cantidad de unidades es obligatoria"); return; }

      const resLote = await fetch(`${API_BASE}/api/inventario/stock-lotes`, {
        method: "POST", headers,
        body: JSON.stringify({
          variante_id: varData.id,
          lote: formLote.lote || null,
          fecha_vencimiento: formLote.fecha_vencimiento || null,
          cantidad_unidades: parseFloat(formLote.cantidad_unidades),
          cajas: parseFloat(formLote.cajas) || 0,
          jeringas: parseFloat(formLote.jeringas) || 0,
        }),
      });

      if (resLote.ok) {
        if (imprimirAlGuardar && codigoPreview.codigo) {
          const barcodeImg = await generarCodigoBarras(codigoPreview.codigo);
          const now = new Date();
          const semana = `${String(now.getFullYear()).slice(-2)}-W${String(Math.ceil(((now - new Date(now.getFullYear(), 0, 1)) / 86400000 + 1) / 7)).padStart(2, "0")}`;
          imprimirSticker({
            nombre, marca, lote: formLote.lote || "S/N", codigo: codigoPreview.codigo, barcodeImg, semana,
            vence: formLote.fecha_vencimiento ? formLote.fecha_vencimiento.replace("-", "/") : "N/A",
            unidad: `${formLote.cantidad_unidades} ${unidad_base}`,
          });
        }
        resetFormularios();
        cargarDatos();
      }
    } catch (err) {
      console.error("Error creando producto y registrando lote:", err);
      alert("Error al crear producto");
    }
  };

  const handleRegistrarLote = async () => {
    if (modoNuevoProducto) { handleCrearProductoYRegistrar(); return; }
    if (!formLote.variante_id || !formLote.cantidad_unidades) { alert("Producto y cantidad son obligatorios"); return; }
    try {
      const res = await fetch(`${API_BASE}/api/inventario/stock-lotes`, {
        method: "POST", headers,
        body: JSON.stringify({
          variante_id: formLote.variante_id,
          lote: formLote.lote || null,
          fecha_vencimiento: formLote.fecha_vencimiento || null,
          cantidad_unidades: parseFloat(formLote.cantidad_unidades),
          cajas: parseFloat(formLote.cajas) || 0,
          jeringas: parseFloat(formLote.jeringas) || 0,
        }),
      });
      if (res.ok) {
        if (imprimirAlGuardar && codigoPreview.codigo) {
          const v = variantes.find(x => String(x.id) === String(formLote.variante_id));
          const barcodeImg = await generarCodigoBarras(codigoPreview.codigo);
          const now = new Date();
          const semana = `${String(now.getFullYear()).slice(-2)}-W${String(Math.ceil(((now - new Date(now.getFullYear(), 0, 1)) / 86400000 + 1) / 7)).padStart(2, "0")}`;
          imprimirSticker({
            nombre: v?.nombre || "", marca: v?.producto_base_nombre || "", lote: formLote.lote || "S/N",
            codigo: codigoPreview.codigo, barcodeImg, semana,
            vence: formLote.fecha_vencimiento ? formLote.fecha_vencimiento.replace("-", "/") : "N/A",
            unidad: `${formLote.cantidad_unidades} ${v?.unidad_base || "u"}`,
          });
        }
        resetFormularios();
        cargarDatos();
      } else {
        const err = await res.json();
        alert(err.message || "Error al registrar lote");
      }
    } catch (err) { console.error("Error registrando lote:", err); }
  };

  const resetFormularios = () => {
    setOpenRegistrar(false);
    setModoNuevoProducto(false);
    setImprimirAlGuardar(false);
    setFormLote({ variante_id: "", lote: "", fecha_vencimiento: "", cantidad_unidades: "", cajas: "", jeringas: "", fecha_ingreso: new Date().toISOString().slice(0, 10) });
    setFormNuevoProducto({ marca: "", nombre: "", laboratorio: "", unidad_base: "UI", contenido_por_presentacion: "" });
    setCodigoPreview({ prefijo: "", correlativo: "", codigo: "" });
  };

  const handleEditarLote = async () => {
    if (!loteEditando) return;
    try {
      const res = await fetch(`${API_BASE}/api/inventario/stock-lotes/${loteEditando.id}`, {
        method: "PUT", headers,
        body: JSON.stringify({ lote: loteEditando.lote, cantidad_unidades: parseFloat(loteEditando.cantidad_unidades), cajas: parseFloat(loteEditando.cajas) || 0, jeringas: parseFloat(loteEditando.jeringas) || 0 }),
      });
      if (res.ok) { setOpenEditarLote(false); setLoteEditando(null); cargarDatos(); }
    } catch (err) { console.error("Error editando lote:", err); }
  };

  const handleImprimirSticker = async (lote, producto) => {
    const prefijo = construirPrefijoCodigo(producto.variante, lote.lote);
    let codigo;
    try {
      const res = await fetch(`${API_BASE}/api/barcodes/next-correlativo?prefix=${encodeURIComponent(prefijo)}`, { headers });
      if (res.ok) {
        const data = await res.json();
        codigo = data.codigo;
      } else {
        codigo = `${prefijo}0001`;
      }
    } catch { codigo = `${prefijo}0001`; }
    const barcodeImg = await generarCodigoBarras(codigo);
    const now = new Date();
    const semana = `${String(now.getFullYear()).slice(-2)}-W${String(Math.ceil(((now - new Date(now.getFullYear(), 0, 1)) / 86400000 + 1) / 7)).padStart(2, "0")}`;
    const data = {
      nombre: producto.variante, marca: producto.marca, lote: lote.lote || "S/N",
      codigo, barcodeImg, semana,
      vence: lote.fecha_vencimiento ? formatVencimiento(lote.fecha_vencimiento) : "N/A",
      unidad: `${lote.disponible} ${producto.unidad_base || "u"}`,
    };
    setStickerPreview(data);
    setOpenSticker(true);
  };

  const formatVencimiento = (fecha) => {
    if (!fecha) return "—";
    const d = new Date(fecha);
    return `${(d.getMonth() + 1).toString().padStart(2, "0")}/${d.getFullYear()}`;
  };

  const formatStock = (stock, unidad) => {
    if (unidad && unidad.toLowerCase().includes("jeringa")) return `${stock} ${stock === 1 ? "jeringa" : "jeringas"}`;
    if (unidad && unidad.toLowerCase().includes("ml")) return `${stock} ml`;
    return `${stock} ${unidad || "u"}`;
  };

  /* ===== MODALS ===== */
  const renderModals = () => (
    <>
      {/* Modal Registrar Lote */}
      <Dialog open={openRegistrar} onClose={resetFormularios} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 4 } }}>
        <DialogTitle sx={{ pb: 0, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>Registrar nuevo lote</Typography>
            <Typography variant="body2" sx={{ color: "#888" }}>Ingresa los datos del lote recibido del proveedor</Typography>
          </Box>
          <IconButton onClick={resetFormularios} size="small"><Close /></IconButton>
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          {/* Producto Section */}
          <Box sx={{ background: colorCream, borderRadius: 2, p: 2, mb: 2 }}>
            <Typography variant="caption" sx={{ color: colorPrincipal, fontWeight: 700, textTransform: "uppercase", mb: 1, display: "block" }}>
              Producto
            </Typography>

            {!modoNuevoProducto ? (
              <>
                <Box sx={{ display: "flex", gap: 1, alignItems: "flex-start" }}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Producto existente o nuevo</InputLabel>
                    <Select
                      value={formLote.variante_id}
                      onChange={(e) => {
                        const vid = e.target.value;
                        setFormLote(prev => ({ ...prev, variante_id: vid }));
                        const v = variantes.find(x => String(x.id) === String(vid));
                        if (v && formLote.lote) obtenerSiguienteCorrelativo(v.nombre, formLote.lote);
                      }}
                      label="Producto existente o nuevo"
                    >
                      {variantes.map(v => (
                        <MenuItem key={v.id} value={v.id}>
                          {v.nombre} · {v.producto_base_nombre || "Sin marca"}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <Button
                    variant="outlined"
                    onClick={() => setModoNuevoProducto(true)}
                    sx={{ borderColor: colorPrincipal, color: colorPrincipal, whiteSpace: "nowrap", minWidth: 100, height: 40, "&:hover": { borderColor: "#8a5a1a", background: colorCream } }}
                  >
                    + Nuevo
                  </Button>
                </Box>
                {formLote.variante_id && (() => {
                  const v = variantes.find(x => String(x.id) === String(formLote.variante_id));
                  if (!v) return null;
                  const cat = inferirCategoria(v.producto_base_nombre, v.nombre);
                  return (
                    <Chip
                      label={`Categoría: ${cat} · Unidad: ${v.unidad_base || "unidad"}`}
                      size="small"
                      sx={{ mt: 1, background: "#e8f5e9", color: "#2e7d32", fontWeight: 500 }}
                      icon={<Category sx={{ fontSize: 14 }} />}
                    />
                  );
                })()}
              </>
            ) : (
              <Box>
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1.5 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600, color: colorPrincipal }}>Crear nuevo producto</Typography>
                  <Button size="small" onClick={() => setModoNuevoProducto(false)} sx={{ color: "#888", textTransform: "none" }}>
                    ← Elegir existente
                  </Button>
                </Box>
                <Grid container spacing={1.5}>
                  <Grid item xs={6}>
                    <TextField fullWidth label="Marca / Familia *" size="small" value={formNuevoProducto.marca}
                      onChange={(e) => setFormNuevoProducto(prev => ({ ...prev, marca: e.target.value }))} placeholder="Ej: Allergan" />
                  </Grid>
                  <Grid item xs={6}>
                    <TextField fullWidth label="Nombre del producto *" size="small" value={formNuevoProducto.nombre}
                      onChange={(e) => {
                        const newName = e.target.value;
                        setFormNuevoProducto(prev => ({ ...prev, nombre: newName }));
                        if (newName && formLote.lote) obtenerSiguienteCorrelativo(newName, formLote.lote);
                      }} placeholder="Ej: Botox 100 UI" />
                  </Grid>
                  <Grid item xs={4}>
                    <TextField fullWidth label="Laboratorio" size="small" value={formNuevoProducto.laboratorio}
                      onChange={(e) => setFormNuevoProducto(prev => ({ ...prev, laboratorio: e.target.value }))} />
                  </Grid>
                  <Grid item xs={4}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Unidad *</InputLabel>
                      <Select value={formNuevoProducto.unidad_base} onChange={(e) => setFormNuevoProducto(prev => ({ ...prev, unidad_base: e.target.value }))} label="Unidad *">
                        <MenuItem value="UI">UI</MenuItem>
                        <MenuItem value="ml">ml</MenuItem>
                        <MenuItem value="Jeringa 1ml">Jeringa 1ml</MenuItem>
                        <MenuItem value="Ampolla 3ml">Ampolla 3ml</MenuItem>
                        <MenuItem value="Vial 5ml">Vial 5ml</MenuItem>
                        <MenuItem value="Vial">Vial</MenuItem>
                        <MenuItem value="Unidad">Unidad</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={4}>
                    <TextField fullWidth label="Contenido *" type="number" size="small" value={formNuevoProducto.contenido_por_presentacion}
                      onChange={(e) => setFormNuevoProducto(prev => ({ ...prev, contenido_por_presentacion: e.target.value }))} placeholder="Ej: 100" />
                  </Grid>
                </Grid>
              </Box>
            )}
          </Box>

          {/* Datos del Lote */}
          <Box sx={{ background: colorCream, borderRadius: 2, p: 2, mb: 2 }}>
            <Typography variant="caption" sx={{ color: colorPrincipal, fontWeight: 700, textTransform: "uppercase", mb: 1, display: "block" }}>
              Datos del lote
            </Typography>
            <Grid container spacing={1.5}>
              <Grid item xs={6}>
                <TextField fullWidth label="Número de lote *" size="small" value={formLote.lote}
                  onChange={(e) => {
                    const newLote = e.target.value;
                    setFormLote(prev => ({ ...prev, lote: newLote }));
                    if (modoNuevoProducto && formNuevoProducto.nombre && newLote) {
                      obtenerSiguienteCorrelativo(formNuevoProducto.nombre, newLote);
                    } else if (!modoNuevoProducto && formLote.variante_id && newLote) {
                      const v = variantes.find(x => String(x.id) === String(formLote.variante_id));
                      if (v) obtenerSiguienteCorrelativo(v.nombre, newLote);
                    }
                  }}
                  placeholder="C8742A" />
              </Grid>
              <Grid item xs={6}>
                <TextField fullWidth label="Vencimiento *" type="month" size="small" value={formLote.fecha_vencimiento}
                  onChange={(e) => setFormLote(prev => ({ ...prev, fecha_vencimiento: e.target.value }))} InputLabelProps={{ shrink: true }} />
              </Grid>
              <Grid item xs={4}>
                <TextField fullWidth label="Cantidad de unidades *" type="number" size="small" value={formLote.cantidad_unidades}
                  onChange={(e) => setFormLote(prev => ({ ...prev, cantidad_unidades: e.target.value }))} />
              </Grid>
              <Grid item xs={4}>
                <TextField fullWidth label="Cajas" type="number" size="small" value={formLote.cajas}
                  onChange={(e) => setFormLote(prev => ({ ...prev, cajas: e.target.value }))} />
              </Grid>
              <Grid item xs={4}>
                <TextField fullWidth label="Fecha de ingreso" type="date" size="small" value={formLote.fecha_ingreso}
                  onChange={(e) => setFormLote(prev => ({ ...prev, fecha_ingreso: e.target.value }))} InputLabelProps={{ shrink: true }} />
              </Grid>
            </Grid>
          </Box>

          {/* Código de Barras Preview */}
          {codigoPreview.codigo && (
            <Box sx={{ background: "#f0f7ff", border: "1px solid #bbdefb", borderRadius: 2, p: 2, mb: 2 }}>
              <Typography variant="caption" sx={{ color: "#1565c0", fontWeight: 700, textTransform: "uppercase", mb: 1, display: "block" }}>
                Código de barras generado
              </Typography>
              <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                <Box sx={{ flex: 1 }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
                    <Typography variant="body2" sx={{ color: "#666" }}>Prefijo:</Typography>
                    <Chip label={codigoPreview.prefijo} size="small" sx={{ fontWeight: 700, fontFamily: "monospace", background: "#e3f2fd", color: "#1565c0" }} />
                    <Typography variant="body2" sx={{ color: "#666" }}>Nº:</Typography>
                    <Chip label={codigoPreview.correlativo} size="small" sx={{ fontWeight: 700, fontFamily: "monospace", background: "#e8f5e9", color: "#2e7d32" }} />
                  </Box>
                  <Typography variant="h6" sx={{ fontWeight: 800, fontFamily: "monospace", letterSpacing: 2, color: "#2d2d2d" }}>
                    {codigoPreview.codigo}
                  </Typography>
                  <Typography variant="caption" sx={{ color: "#888" }}>
                    = 2 letras producto ({codigoPreview.prefijo.substring(0, 2)}) + 2 últimos dígitos lote ({codigoPreview.prefijo.substring(2)}) + correlativo ({codigoPreview.correlativo})
                  </Typography>
                </Box>
              </Box>
            </Box>
          )}

          {/* Imprimir sticker checkbox */}
          <Card sx={{ border: "1px solid #e8e0d0", boxShadow: "none", borderRadius: 2 }}>
            <CardContent sx={{ p: 1.5, "&:last-child": { pb: 1.5 } }}>
              <FormControlLabel
                control={<Checkbox checked={imprimirAlGuardar} onChange={(e) => setImprimirAlGuardar(e.target.checked)} sx={{ color: colorPrincipal, "&.Mui-checked": { color: colorPrincipal } }} />}
                label={
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>Imprimir stickers ahora</Typography>
                    <Typography variant="caption" sx={{ color: "#888" }}>
                      Generar código de barras único al guardar
                    </Typography>
                  </Box>
                }
              />
            </CardContent>
          </Card>
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 1.5 }}>
          <Button onClick={resetFormularios} sx={{ color: "#888", borderRadius: 2 }}>Cancelar</Button>
          <Button
            variant="contained"
            onClick={handleRegistrarLote}
            sx={{ background: colorPrincipal, borderRadius: 2, px: 4, "&:hover": { background: "#8a5a1a" } }}
          >
            {imprimirAlGuardar ? "Guardar e imprimir" : "Guardar"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Modal Editar Lote */}
      <Dialog open={openEditarLote} onClose={() => setOpenEditarLote(false)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 4 } }}>
        <DialogTitle>Ajustar lote</DialogTitle>
        <DialogContent>
          {loteEditando && (
            <Box sx={{ mt: 1 }}>
              <TextField fullWidth label="Número de lote" size="small" value={loteEditando.lote || ""} onChange={(e) => setLoteEditando(prev => ({ ...prev, lote: e.target.value }))} sx={{ mb: 2 }} />
              <TextField fullWidth label="Cantidad unidades" type="number" size="small" value={loteEditando.cantidad_unidades || ""} onChange={(e) => setLoteEditando(prev => ({ ...prev, cantidad_unidades: e.target.value }))} sx={{ mb: 2 }} />
              <TextField fullWidth label="Cajas" type="number" size="small" value={loteEditando.cajas || ""} onChange={(e) => setLoteEditando(prev => ({ ...prev, cajas: e.target.value }))} sx={{ mb: 2 }} />
              <TextField fullWidth label="Jeringas" type="number" size="small" value={loteEditando.jeringas || ""} onChange={(e) => setLoteEditando(prev => ({ ...prev, jeringas: e.target.value }))} />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenEditarLote(false)}>Cancelar</Button>
          <Button variant="contained" onClick={handleEditarLote} sx={{ background: colorPrincipal, "&:hover": { background: "#8a5a1a" } }}>Guardar</Button>
        </DialogActions>
      </Dialog>

      {/* Modal Sticker Preview */}
      <Dialog open={openSticker} onClose={() => setOpenSticker(false)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 4 } }}>
        <DialogTitle sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>Sticker - Código de Barras</Typography>
          <IconButton onClick={() => setOpenSticker(false)} size="small"><Close /></IconButton>
        </DialogTitle>
        <DialogContent>
          {stickerPreview && (
            <Box sx={{ display: "flex", justifyContent: "center", my: 2 }}>
              <Box sx={{
                width: STICKER_W, height: STICKER_H, p: "1mm 1.5mm", border: "1px dashed #bbb", borderRadius: 0.5,
                display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#fff",
                fontFamily: "'Arial Narrow', Arial, sans-serif", overflow: "hidden",
              }}>
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "0.3mm solid #000", pb: "0.8mm", fontSize: "6.5pt", fontWeight: 700, lineHeight: 1, letterSpacing: "0.3px" }}>
                  <span>SHOWCLINIC</span><span>{stickerPreview.semana}</span>
                </Box>
                <Typography sx={{ fontSize: "8pt", fontWeight: 900, textTransform: "uppercase", lineHeight: 1.1, mt: "0.5mm", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {stickerPreview.nombre}
                </Typography>
                <Typography sx={{ fontSize: "5.5pt", color: "#333", lineHeight: 1, mt: "0.3mm", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {stickerPreview.marca} · Lote: {stickerPreview.lote}
                </Typography>
                <Box sx={{ textAlign: "center", flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", my: "0.5mm", minHeight: 0 }}>
                  {stickerPreview.barcodeImg && <img src={stickerPreview.barcodeImg} alt="barcode" style={{ width: "46mm", height: "7mm", objectFit: "contain" }} />}
                </Box>
                <Typography sx={{ fontSize: "7pt", fontWeight: 800, textAlign: "center", letterSpacing: "1.5px", fontFamily: "'Courier New', monospace", lineHeight: 1, mt: "0.3mm" }}>
                  {stickerPreview.codigo}
                </Typography>
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "0.3mm solid #000", pt: "0.5mm", fontSize: "5.5pt", lineHeight: 1 }}>
                  <span>Vence: {stickerPreview.vence}</span><span>{stickerPreview.unidad}</span>
                </Box>
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setOpenSticker(false)} sx={{ color: "#888" }}>Cerrar</Button>
          <Button
            variant="contained"
            startIcon={<Print />}
            onClick={() => { if (stickerPreview) imprimirSticker(stickerPreview); }}
            sx={{ background: colorPrincipal, "&:hover": { background: "#8a5a1a" } }}
          >
            Imprimir
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );

  /* ===== DETAIL VIEW ===== */
  if (vista === "detalle" && productoDetalle) {
    return (
      <>
        <DetalleProducto
          productoDetalle={productoDetalle}
          lotesDelProducto={lotesDelProducto}
          onVolver={() => { setVista("lista"); setProductoDetalle(null); }}
          onNuevoLote={() => { setFormLote(prev => ({ ...prev, variante_id: productoDetalle.variante_id })); setOpenRegistrar(true); }}
          onEditarLote={(lote) => { setLoteEditando({ ...lote }); setOpenEditarLote(true); }}
          onImprimirSticker={(lote) => handleImprimirSticker(lote, productoDetalle)}
          formatVencimiento={formatVencimiento}
          formatStock={formatStock}
        />
        {renderModals()}
      </>
    );
  }

  /* ===== LIST VIEW ===== */
  return (
    <Box sx={{ minHeight: "100vh", backgroundColor: colorFondo, p: { xs: 2, md: 3 } }}>
      <Box sx={{ maxWidth: 1200, margin: "0 auto" }}>

        {/* Header */}
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 3, flexWrap: "wrap", gap: 1 }}>
          <Box sx={{ display: "flex", alignItems: "center" }}>
            <IconButton onClick={() => navigate("/dashboard")} sx={{ mr: 2, color: colorPrincipal }}><ArrowBack /></IconButton>
            <Box>
              <Typography variant="h4" sx={{ fontWeight: 800, color: "#2d2d2d" }}>Inventario clínico</Typography>
              <Typography variant="body2" sx={{ color: "#888", textTransform: "uppercase", letterSpacing: 1 }}>Gestión de stock · ShowClinic</Typography>
            </Box>
          </Box>
          <Box sx={{ display: "flex", gap: 1.5 }}>
            <Button variant="outlined" startIcon={<Download />} sx={{ borderColor: colorSecundario, color: colorPrincipal, fontWeight: 600, borderRadius: 2, "&:hover": { borderColor: colorPrincipal, background: colorCream } }}>
              Exportar
            </Button>
            <Button variant="contained" startIcon={<Add />} onClick={() => setOpenRegistrar(true)} sx={{ background: colorPrincipal, fontWeight: 600, borderRadius: 2, px: 3, "&:hover": { background: "#8a5a1a" } }}>
              Registrar lote
            </Button>
          </Box>
        </Box>

        {/* Summary Cards */}
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={6} md={4}>
            <Card sx={{ borderRadius: 3, border: "1px solid #e8e0d0", boxShadow: "none" }}>
              <CardContent sx={{ p: 2 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
                  <Inventory2 sx={{ fontSize: 16, color: colorPrincipal }} />
                  <Typography variant="caption" sx={{ color: "#888", fontWeight: 600, textTransform: "uppercase" }}>Productos</Typography>
                </Box>
                <Typography variant="h4" sx={{ fontWeight: 800, color: "#2d2d2d" }}>{productos.length}</Typography>
                <Typography variant="caption" sx={{ color: "#aaa" }}>{marcasActivas} marcas activas</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={6} md={4}>
            <Card sx={{ borderRadius: 3, border: "1px solid #ffcdd2", boxShadow: "none", background: "#fff5f5" }}>
              <CardContent sx={{ p: 2 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
                  <Warning sx={{ fontSize: 16, color: "#d32f2f" }} />
                  <Typography variant="caption" sx={{ color: "#d32f2f", fontWeight: 600, textTransform: "uppercase" }}>Stock Bajo</Typography>
                </Box>
                <Typography variant="h4" sx={{ fontWeight: 800, color: "#d32f2f" }}>{stockBajo}</Typography>
                <Typography variant="caption" sx={{ color: "#aaa" }}>Requiere reposición</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={6} md={4}>
            <Card sx={{ borderRadius: 3, border: "1px solid #ffe0b2", boxShadow: "none", background: "#fff8e1" }}>
              <CardContent sx={{ p: 2 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
                  <Schedule sx={{ fontSize: 16, color: "#f57c00" }} />
                  <Typography variant="caption" sx={{ color: "#f57c00", fontWeight: 600, textTransform: "uppercase" }}>Por Vencer</Typography>
                </Box>
                <Typography variant="h4" sx={{ fontWeight: 800, color: "#f57c00" }}>{porVencer}</Typography>
                <Typography variant="caption" sx={{ color: "#aaa" }}>En menos de 30 días</Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Products Section */}
        <Card sx={{ borderRadius: 3, boxShadow: "0 2px 12px rgba(0,0,0,0.06)", overflow: "visible" }}>
          <CardContent sx={{ p: 3 }}>
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2.5 }}>
              <Typography variant="h5" sx={{ fontWeight: 700, color: "#2d2d2d" }}>Productos en stock</Typography>
              <TextField
                placeholder="Buscar producto, marca, lote..."
                size="small"
                value={filtroTexto}
                onChange={(e) => setFiltroTexto(e.target.value)}
                InputProps={{ startAdornment: <InputAdornment position="start"><Search sx={{ color: "#aaa" }} /></InputAdornment> }}
                sx={{ width: 280, "& .MuiOutlinedInput-root": { borderRadius: 2, background: colorCream, "&.Mui-focused fieldset": { borderColor: colorPrincipal } } }}
              />
            </Box>

            {/* Category Chips */}
            <Box sx={{ display: "flex", gap: 1, mb: 2.5, flexWrap: "wrap" }}>
              <Chip
                label={`Todos (${productos.length})`}
                onClick={() => setFiltroCategoria("Todos")}
                sx={{ fontWeight: 600, borderRadius: 5, background: filtroCategoria === "Todos" ? colorPrincipal : "#fff", color: filtroCategoria === "Todos" ? "#fff" : "#555", border: filtroCategoria === "Todos" ? "none" : "1px solid #ddd", "&:hover": { background: filtroCategoria === "Todos" ? "#8a5a1a" : "#f5f5f5" } }}
              />
              {categorias.map(({ label, count }) => (
                <Chip key={label} label={`${label} (${count})`} onClick={() => setFiltroCategoria(label)}
                  sx={{ fontWeight: 600, borderRadius: 5, background: filtroCategoria === label ? colorPrincipal : "#fff", color: filtroCategoria === label ? "#fff" : "#555", border: filtroCategoria === label ? "none" : "1px solid #ddd", "&:hover": { background: filtroCategoria === label ? "#8a5a1a" : "#f5f5f5" } }}
                />
              ))}
            </Box>

            {/* Table Header */}
            <Box sx={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 0.8fr 1fr 1.2fr 0.8fr", px: 2, py: 1, borderBottom: "1px solid #eee", mb: 1 }}>
              {["PRODUCTO", "CATEGORÍA", "STOCK", "LOTES", "VENCE", "ESTADO", "ACCIONES"].map((h) => (
                <Typography key={h} variant="caption" sx={{ fontWeight: 700, color: "#999", letterSpacing: 0.5 }}>{h}</Typography>
              ))}
            </Box>

            {/* ALL Product Rows - scrollable */}
            <Box sx={{ maxHeight: "60vh", overflowY: "auto", "&::-webkit-scrollbar": { width: 6 }, "&::-webkit-scrollbar-thumb": { borderRadius: 3, background: colorSecundario } }}>
              {productosFiltrados.map((p, idx) => {
                const catColor = getCategoriaColor(p.categoria);
                const rowBg = p.stock === 0 ? "#fff5f5" : idx % 2 === 0 ? "#fff" : "#fafafa";
                return (
                  <Box key={p.variante_id} sx={{
                    display: "grid", gridTemplateColumns: "2fr 1fr 1fr 0.8fr 1fr 1.2fr 0.8fr",
                    px: 2, py: 1.5, alignItems: "center", borderBottom: "1px solid #f5f5f5", background: rowBg, borderRadius: 1,
                    transition: "background 0.15s", "&:hover": { background: "#fdf6ec" },
                    borderLeft: p.stock === 0 ? "3px solid #d32f2f" : "3px solid transparent", cursor: "pointer",
                  }}
                    onClick={() => { setProductoDetalle(p); setVista("detalle"); }}
                  >
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 700, color: "#2d2d2d" }}>{p.variante || "Sin nombre"}</Typography>
                      <Typography variant="caption" sx={{ color: "#999" }}>{p.marca} · {p.unidad_base || "Unidad"}</Typography>
                    </Box>
                    <Box>
                      <Chip label={p.categoria} size="small" sx={{ background: catColor.bg, color: catColor.text, fontWeight: 600, fontSize: 11, height: 24 }} />
                    </Box>
                    <Typography variant="body2" sx={{ fontWeight: 600, color: p.stock === 0 ? "#d32f2f" : "#2d2d2d" }}>{formatStock(p.stock, p.unidad_base)}</Typography>
                    <Typography variant="body2" sx={{ color: "#666" }}>{p.lotes_count}</Typography>
                    <Typography variant="body2" sx={{ color: "#666" }}>{formatVencimiento(p.vencimiento_proximo)}</Typography>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                      <Box sx={{ width: 8, height: 8, borderRadius: "50%", background: p.estado.dot }} />
                      <Typography variant="caption" sx={{ color: p.estado.color, fontWeight: 600 }}>{p.estado.label}</Typography>
                    </Box>
                    <Box sx={{ display: "flex", gap: 0.5 }} onClick={(e) => e.stopPropagation()}>
                      <IconButton size="small" onClick={() => { setProductoDetalle(p); setVista("detalle"); }} sx={{ color: colorPrincipal }}>
                        <Visibility fontSize="small" />
                      </IconButton>
                      <IconButton size="small" onClick={() => { setProductoDetalle(p); setVista("detalle"); }} sx={{ color: "#888" }}>
                        <Edit fontSize="small" />
                      </IconButton>
                    </Box>
                  </Box>
                );
              })}
            </Box>

            {productosFiltrados.length === 0 && (
              <Typography sx={{ textAlign: "center", py: 4, color: "#999" }}>No se encontraron productos</Typography>
            )}

            {/* Footer count */}
            <Box sx={{ mt: 2, pt: 2, borderTop: "1px solid #eee" }}>
              <Typography variant="caption" sx={{ color: "#999" }}>
                Mostrando {productosFiltrados.length} de {productos.length} productos
              </Typography>
            </Box>
          </CardContent>
        </Card>
      </Box>

      {renderModals()}
    </Box>
  );
}

/* ===== DETALLE PRODUCTO ===== */
function DetalleProducto({ productoDetalle, lotesDelProducto, onVolver, onNuevoLote, onEditarLote, onImprimirSticker, formatVencimiento, formatStock }) {
  const [tabLotes, setTabLotes] = useState("activos");

  const lotesActivos = lotesDelProducto.filter(l => l.disponible > 0);
  const lotesAgotados = lotesDelProducto.filter(l => l.disponible <= 0);
  const lotesVisibles = tabLotes === "activos" ? lotesActivos : lotesAgotados;
  const stockTotal = lotesDelProducto.reduce((sum, l) => sum + l.disponible, 0);
  const categoria = inferirCategoria(productoDetalle.marca, productoDetalle.variante);

  const getLoteEstado = (lote) => {
    if (lote.disponible <= 0) return { label: "Agotado", color: "#d32f2f" };
    if (lote.cantidad_reservada_unidades > 0) return { label: "Abierto", color: "#f57c00" };
    return { label: "Activo", color: "#2e7d32" };
  };

  return (
    <Box sx={{ minHeight: "100vh", backgroundColor: colorFondo, p: { xs: 2, md: 3 } }}>
      <Box sx={{ maxWidth: 1000, margin: "0 auto" }}>
        {/* Breadcrumb */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 3 }}>
          <IconButton onClick={onVolver} size="small" sx={{ color: colorPrincipal }}><ArrowBack /></IconButton>
          <Typography variant="body2" sx={{ color: "#999", cursor: "pointer" }} onClick={onVolver}>Inventario</Typography>
          <Typography variant="body2" sx={{ color: "#999" }}>/</Typography>
          <Typography variant="body2" sx={{ color: "#999", cursor: "pointer" }} onClick={onVolver}>Productos</Typography>
          <Typography variant="body2" sx={{ color: "#999" }}>/</Typography>
          <Typography variant="body2" sx={{ color: "#2d2d2d", fontWeight: 600 }}>{productoDetalle.variante}</Typography>
        </Box>

        {/* Product Info */}
        <Card sx={{ borderRadius: 3, mb: 3, boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
          <CardContent sx={{ p: 3 }}>
            <Box sx={{ display: "flex", gap: 1, mb: 1.5 }}>
              <Chip label={categoria} size="small" sx={{ background: getCategoriaColor(categoria).bg, color: getCategoriaColor(categoria).text, fontWeight: 700, fontSize: 11 }} />
            </Box>
            <Typography variant="h4" sx={{ fontWeight: 800, color: "#2d2d2d", mb: 0.5 }}>{productoDetalle.variante}</Typography>
            <Typography variant="body2" sx={{ color: "#888", mb: 2 }}>{productoDetalle.marca} · {productoDetalle.unidad_base || "Unidad"}</Typography>
            <Button variant="contained" startIcon={<Add />} onClick={onNuevoLote} sx={{ background: colorPrincipal, borderRadius: 2, "&:hover": { background: "#8a5a1a" } }}>
              Nuevo lote
            </Button>

            <Grid container spacing={3} sx={{ mt: 2 }}>
              <Grid item xs={4}>
                <Typography variant="caption" sx={{ color: "#888", textTransform: "uppercase", fontWeight: 600 }}>Stock Total</Typography>
                <Typography variant="h4" sx={{ fontWeight: 800, color: "#2d2d2d" }}>
                  {stockTotal} <Typography component="span" variant="body2" sx={{ color: "#888" }}>{productoDetalle.unidad_base || "u"}</Typography>
                </Typography>
              </Grid>
              <Grid item xs={4}>
                <Typography variant="caption" sx={{ color: "#888", textTransform: "uppercase", fontWeight: 600 }}>Lotes Activos</Typography>
                <Typography variant="h4" sx={{ fontWeight: 800, color: "#2d2d2d" }}>{lotesActivos.length}</Typography>
              </Grid>
              <Grid item xs={4}>
                <Typography variant="caption" sx={{ color: "#888", textTransform: "uppercase", fontWeight: 600 }}>Total Lotes</Typography>
                <Typography variant="h4" sx={{ fontWeight: 800, color: "#2d2d2d" }}>{lotesDelProducto.length}</Typography>
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* Lotes */}
        <Card sx={{ borderRadius: 3, boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
          <CardContent sx={{ p: 3 }}>
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
              <Typography variant="h5" sx={{ fontWeight: 700 }}>Lotes registrados</Typography>
              <Box sx={{ display: "flex", gap: 1 }}>
                <Chip label={`Activos (${lotesActivos.length})`} onClick={() => setTabLotes("activos")}
                  sx={{ fontWeight: 600, borderRadius: 5, background: tabLotes === "activos" ? colorPrincipal : "#fff", color: tabLotes === "activos" ? "#fff" : "#555", border: tabLotes === "activos" ? "none" : "1px solid #ddd" }} />
                <Chip label={`Agotados (${lotesAgotados.length})`} onClick={() => setTabLotes("agotados")}
                  sx={{ fontWeight: 600, borderRadius: 5, background: tabLotes === "agotados" ? colorPrincipal : "#fff", color: tabLotes === "agotados" ? "#fff" : "#555", border: tabLotes === "agotados" ? "none" : "1px solid #ddd" }} />
              </Box>
            </Box>

            {lotesVisibles.length === 0 && (
              <Typography sx={{ textAlign: "center", py: 4, color: "#999" }}>No hay lotes {tabLotes === "activos" ? "activos" : "agotados"}</Typography>
            )}

            {lotesVisibles.map((lote) => {
              const estado = getLoteEstado(lote);
              return (
                <Card key={lote.id} sx={{ mb: 2, borderRadius: 2, border: "1px solid #eee", boxShadow: "none" }}>
                  <CardContent sx={{ p: 2 }}>
                    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <Box>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
                          <Typography variant="body1" sx={{ fontWeight: 700 }}>Lote {lote.lote || "S/N"}</Typography>
                          <Chip label={estado.label} size="small" sx={{
                            background: `${estado.color}15`, color: estado.color, fontWeight: 600, fontSize: 11, height: 22,
                            "& .MuiChip-label": { px: 1 },
                          }} icon={<Box sx={{ width: 6, height: 6, borderRadius: "50%", background: estado.color, ml: 1 }} />} />
                        </Box>
                        <Typography variant="caption" sx={{ color: "#888" }}>
                          Ingreso: {lote.creado_en ? new Date(lote.creado_en).toLocaleDateString() : "N/A"} · Vence: {formatVencimiento(lote.fecha_vencimiento)}
                          {lote.cajas > 0 && ` · ${lote.cajas} cajas`}
                          {lote.jeringas > 0 && ` · ${lote.jeringas} jeringas`}
                        </Typography>
                      </Box>
                      <Box sx={{ textAlign: "right" }}>
                        <Typography variant="caption" sx={{ color: "#888", textTransform: "uppercase", fontWeight: 600 }}>Disponible</Typography>
                        <Typography variant="h5" sx={{ fontWeight: 800, color: "#2d2d2d" }}>
                          {lote.disponible}<Typography component="span" variant="body2" sx={{ color: "#888" }}> / {lote.cantidad_original} {productoDetalle.unidad_base || "u"}</Typography>
                        </Typography>
                      </Box>
                    </Box>

                    <LinearProgress variant="determinate" value={Math.min(100, lote.porcentaje)} sx={{
                      mt: 1.5, mb: 1.5, height: 6, borderRadius: 3, background: "#f0e8dc",
                      "& .MuiLinearProgress-bar": {
                        borderRadius: 3,
                        background: lote.porcentaje > 50 ? `linear-gradient(90deg, ${colorPrincipal}, ${colorSecundario})` : lote.porcentaje > 20 ? "#f57c00" : "#d32f2f",
                      },
                    }} />

                    <Box sx={{ display: "flex", gap: 1 }}>
                      <Button size="small" variant="outlined" onClick={() => onImprimirSticker(lote)}
                        sx={{ borderColor: "#ddd", color: "#555", borderRadius: 2, textTransform: "none", fontSize: 12, "&:hover": { borderColor: colorPrincipal, color: colorPrincipal } }}>
                        🏷️ Imprimir stickers
                      </Button>
                      <Button size="small" variant="outlined" onClick={() => onEditarLote(lote)}
                        sx={{ borderColor: "#ddd", color: "#555", borderRadius: 2, textTransform: "none", fontSize: 12, "&:hover": { borderColor: colorPrincipal, color: colorPrincipal } }}>
                        ✏️ Ajustar
                      </Button>
                    </Box>
                  </CardContent>
                </Card>
              );
            })}
          </CardContent>
        </Card>
      </Box>
    </Box>
  );
}
