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
  Delete,
  Inventory2,
  Category,
  Print,
  ExpandMore,
  ExpandLess,
  Close,
  QrCodeScanner,
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

const imprimirSticker = (stickerDataOrArray) => {
  const stickers = Array.isArray(stickerDataOrArray) ? stickerDataOrArray : [stickerDataOrArray];
  const printWindow = window.open("", "_blank");
  if (!printWindow) return;

  const stickerHtmlBlocks = stickers.map((s) => `
<div class="sticker">
  <div class="row-top"><span>SHOWCLINIC</span><span>${s.semana}</span></div>
  <div class="name">${s.nombre}</div>
  <div class="sub">${s.marca} &middot; Lote: ${s.lote}</div>
  <div class="bc"><img src="${s.barcodeImg}" /></div>
  <div class="code">${s.codigo}</div>
  <div class="row-bot"><span>Vence: ${s.vence}</span><span>${s.unidad}</span></div>
</div>`).join("\n");

  const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Stickers (${stickers.length})</title>
<style>
  @page {
    size: 50mm 25mm landscape;
    margin: 0;
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body {
    margin: 0 !important; padding: 0 !important;
    font-family: Arial, sans-serif;
    -webkit-print-color-adjust: exact;
  }
  .sticker {
    width: 50mm; height: 25mm;
    padding: 1mm 2mm;
    display: flex; flex-direction: column;
    justify-content: space-between;
    page-break-after: always;
  }
  .sticker:last-child { page-break-after: auto; }
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
${stickerHtmlBlocks}
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

  // Estados para códigos de barras
  const [openCodigosModal, setOpenCodigosModal] = useState(false);
  const [codigosProducto, setCodigosProducto] = useState([]);
  const [loadingCodigos, setLoadingCodigos] = useState(false);
  const [openEditarCantidadModal, setOpenEditarCantidadModal] = useState(false);
  const [codigoEditando, setCodigoEditando] = useState(null);
  const [formEditarCantidad, setFormEditarCantidad] = useState({ unidades_totales: "", unidades_restantes: "" });
  const [editandoCantidad, setEditandoCantidad] = useState(false);

  // Estados para ajuste de stock
  const [openAjusteStockModal, setOpenAjusteStockModal] = useState(false);
  const [loteAjustando, setLoteAjustando] = useState(null);
  const [formAjusteStock, setFormAjusteStock] = useState({ cantidad_a_reducir: "", motivo: "" });
  const [ajustandoStock, setAjustandoStock] = useState(false);

  // Estado para el gráfico de barras (productos ocultos del gráfico)
  const [productosOcultos, setProductosOcultos] = useState([]);
  const [openFiltroGrafico, setOpenFiltroGrafico] = useState(false);

  const toggleProductoGrafico = (varianteId) => {
    setProductosOcultos((prev) =>
      prev.includes(varianteId) ? prev.filter((id) => id !== varianteId) : [...prev, varianteId]
    );
  };

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
        const loteData = await resLote.json();
        const numCajas = Math.max(1, parseInt(formLote.cajas) || 1);
        if (imprimirAlGuardar && codigoPreview.prefijo) {
          const batchRes = await fetch(`${API_BASE}/api/barcodes/register-batch`, {
            method: "POST", headers,
            body: JSON.stringify({ prefix: codigoPreview.prefijo, quantity: numCajas, lote_id: loteData.id || null }),
          });
          if (batchRes.ok) {
            const { codes } = await batchRes.json();
            const now = new Date();
            const semana = `${String(now.getFullYear()).slice(-2)}-W${String(Math.ceil(((now - new Date(now.getFullYear(), 0, 1)) / 86400000 + 1) / 7)).padStart(2, "0")}`;
            const stickers = [];
            for (const codigo of codes) {
              const barcodeImg = await generarCodigoBarras(codigo);
              stickers.push({
                nombre, marca, lote: formLote.lote || "S/N", codigo, barcodeImg, semana,
                vence: formLote.fecha_vencimiento ? formLote.fecha_vencimiento.replace("-", "/") : "N/A",
                unidad: `${formLote.cantidad_unidades} ${unidad_base}`,
              });
            }
            imprimirSticker(stickers);
          }
        } else if (codigoPreview.prefijo) {
          await fetch(`${API_BASE}/api/barcodes/register-batch`, {
            method: "POST", headers,
            body: JSON.stringify({ prefix: codigoPreview.prefijo, quantity: numCajas, lote_id: loteData.id || null }),
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
        const loteData = await res.json();
        const numCajas = Math.max(1, parseInt(formLote.cajas) || 1);
        if (imprimirAlGuardar && codigoPreview.prefijo) {
          const v = variantes.find(x => String(x.id) === String(formLote.variante_id));
          // Register N codes in the DB and get them back
          const batchRes = await fetch(`${API_BASE}/api/barcodes/register-batch`, {
            method: "POST", headers,
            body: JSON.stringify({ prefix: codigoPreview.prefijo, quantity: numCajas, lote_id: loteData.id || null }),
          });
          if (batchRes.ok) {
            const { codes } = await batchRes.json();
            const now = new Date();
            const semana = `${String(now.getFullYear()).slice(-2)}-W${String(Math.ceil(((now - new Date(now.getFullYear(), 0, 1)) / 86400000 + 1) / 7)).padStart(2, "0")}`;
            const stickers = [];
            for (const codigo of codes) {
              const barcodeImg = await generarCodigoBarras(codigo);
              stickers.push({
                nombre: v?.nombre || "", marca: v?.producto_base_nombre || "", lote: formLote.lote || "S/N",
                codigo, barcodeImg, semana,
                vence: formLote.fecha_vencimiento ? formLote.fecha_vencimiento.replace("-", "/") : "N/A",
                unidad: `${formLote.cantidad_unidades} ${v?.unidad_base || "u"}`,
              });
            }
            imprimirSticker(stickers);
          }
        } else if (codigoPreview.prefijo) {
          // Even without printing, register the codes in the DB
          const numToRegister = numCajas;
          await fetch(`${API_BASE}/api/barcodes/register-batch`, {
            method: "POST", headers,
            body: JSON.stringify({ prefix: codigoPreview.prefijo, quantity: numToRegister, lote_id: loteData.id || null }),
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

  const cargarCodigosProducto = async (varianteId) => {
    if (!varianteId) return;
    setLoadingCodigos(true);
    try {
      const res = await fetch(`${API_BASE}/api/barcodes/variant/${varianteId}/codes`, { headers });
      if (res.ok) {
        const data = await res.json();
        setCodigosProducto(data);
      } else {
        console.error("Error cargando códigos:", await res.text());
        setCodigosProducto([]);
      }
    } catch (err) {
      console.error("Error cargando códigos:", err);
      setCodigosProducto([]);
    } finally {
      setLoadingCodigos(false);
    }
  };

  const handleEliminarCodigo = async (codeId) => {
    if (!window.confirm("¿Estás seguro de eliminar este código?")) return;
    try {
      const res = await fetch(`${API_BASE}/api/barcodes/${codeId}`, { method: "DELETE", headers });
      if (res.ok) {
        // Recargar códigos
        if (productoDetalle?.variante_id) {
          cargarCodigosProducto(productoDetalle.variante_id);
        }
      } else {
        const error = await res.json();
        alert(`❌ ${error.message}`);
      }
    } catch (err) {
      console.error("Error eliminando código:", err);
      alert("❌ Error al eliminar código");
    }
  };

  const handleEditarCantidad = (code) => {
    setCodigoEditando(code);
    setFormEditarCantidad({
      unidades_totales: code.unidades_totales || "",
      unidades_restantes: code.unidades_restantes || "",
    });
    setOpenEditarCantidadModal(true);
  };

  const handleGuardarCantidad = async () => {
    if (!codigoEditando) return;
    setEditandoCantidad(true);
    try {
      const res = await fetch(`${API_BASE}/api/barcodes/${codigoEditando.id}/cantidad`, {
        method: "PATCH",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify(formEditarCantidad),
      });
      if (res.ok) {
        alert("✅ Cantidad actualizada correctamente");
        setOpenEditarCantidadModal(false);
        // Recargar códigos
        if (productoDetalle?.variante_id) {
          cargarCodigosProducto(productoDetalle.variante_id);
        }
      } else {
        const error = await res.json();
        alert(`❌ ${error.message}`);
      }
    } catch (err) {
      console.error("Error actualizando cantidad:", err);
      alert("❌ Error al actualizar cantidad");
    } finally {
      setEditandoCantidad(false);
    }
  };

  const handleEliminarTodosCodigos = async (filter = "all") => {
    const textoFiltro = filter === "active" ? "activos" : filter === "scanned" ? "usados" : "todos los";
    if (!window.confirm(`¿Estás seguro de eliminar ${textoFiltro} códigos de este producto?`)) return;
    try {
      const res = await fetch(
        `${API_BASE}/api/barcodes/variant/${productoDetalle?.variante_id}/codes?filter=${filter}`,
        { method: "DELETE", headers }
      );
      if (res.ok) {
        const data = await res.json();
        alert(`✅ ${data.deleted} código(s) eliminado(s)`);
        cargarCodigosProducto(productoDetalle.variante_id);
      } else {
        const error = await res.json();
        alert(`❌ ${error.message}`);
      }
    } catch (err) {
      console.error("Error eliminando códigos:", err);
      alert("❌ Error al eliminar códigos");
    }
  };

  const handleAjustarStock = async () => {
    if (!loteAjustando || !formAjusteStock.cantidad_a_reducir) {
      alert("Por favor ingresa la cantidad a reducir");
      return;
    }

    const cantidad = parseFloat(formAjusteStock.cantidad_a_reducir);
    if (isNaN(cantidad) || cantidad <= 0) {
      alert("La cantidad debe ser un número mayor a 0");
      return;
    }

    setAjustandoStock(true);
    try {
      const res = await fetch(`${API_BASE}/api/inventario/stock-lotes/${loteAjustando.id}/ajustar`, {
        method: "PUT",
        headers,
        body: JSON.stringify({
          cantidad_a_reducir: cantidad,
          motivo: formAjusteStock.motivo || "Ajuste manual de stock"
        })
      });

      if (res.ok) {
        const data = await res.json();
        alert(`✅ ${data.message}`);
        setOpenAjusteStockModal(false);
        setFormAjusteStock({ cantidad_a_reducir: "", motivo: "" });
        setLoteAjustando(null);
        cargarDatos(); // Recargar datos del inventario
      } else {
        const error = await res.json();
        alert(`❌ ${error.message}`);
      }
    } catch (err) {
      console.error("Error ajustando stock:", err);
      alert("❌ Error al ajustar stock");
    } finally {
      setAjustandoStock(false);
    }
  };

  const eliminarProducto = async (varianteId, nombreProducto) => {
    if (!window.confirm(`¿Estás seguro de eliminar "${nombreProducto}"? Se eliminarán también todos sus lotes. Esta acción no se puede deshacer.`)) return;
    try {
      const res = await fetch(`${API_BASE}/api/inventario/variantes/${varianteId}`, {
        method: "DELETE", headers,
      });
      if (res.ok) {
        cargarDatos();
      } else {
        const err = await res.json();
        alert(err.message || "Error al eliminar producto");
      }
    } catch (err) {
      console.error("Error eliminando producto:", err);
      alert("Error al eliminar producto");
    }
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
          {codigoPreview.codigo && (() => {
            const numCajas = Math.max(1, parseInt(formLote.cajas) || 1);
            const startCorr = parseInt(codigoPreview.correlativo) || 1;
            const endCorr = startCorr + numCajas - 1;
            const lastCode = `${codigoPreview.prefijo}${String(endCorr).padStart(4, "0")}`;
            return (
            <Box sx={{ background: "#f0f7ff", border: "1px solid #bbdefb", borderRadius: 2, p: 2, mb: 2 }}>
              <Typography variant="caption" sx={{ color: "#1565c0", fontWeight: 700, textTransform: "uppercase", mb: 1, display: "block" }}>
                {numCajas > 1 ? `Códigos de barras (${numCajas} stickers)` : "Código de barras generado"}
              </Typography>
              <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                <Box sx={{ flex: 1 }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5, flexWrap: "wrap" }}>
                    <Typography variant="body2" sx={{ color: "#666" }}>Prefijo:</Typography>
                    <Chip label={codigoPreview.prefijo} size="small" sx={{ fontWeight: 700, fontFamily: "monospace", background: "#e3f2fd", color: "#1565c0" }} />
                    <Typography variant="body2" sx={{ color: "#666" }}>Nº:</Typography>
                    <Chip label={numCajas > 1 ? `${codigoPreview.correlativo} → ${String(endCorr).padStart(4, "0")}` : codigoPreview.correlativo} size="small" sx={{ fontWeight: 700, fontFamily: "monospace", background: "#e8f5e9", color: "#2e7d32" }} />
                    {numCajas > 1 && <Chip label={`${numCajas} cajas`} size="small" sx={{ fontWeight: 600, background: "#fff3e0", color: "#e65100" }} />}
                  </Box>
                  {numCajas > 1 ? (
                    <Box>
                      <Typography variant="h6" sx={{ fontWeight: 800, fontFamily: "monospace", letterSpacing: 2, color: "#2d2d2d" }}>
                        {codigoPreview.codigo} ... {lastCode}
                      </Typography>
                    </Box>
                  ) : (
                    <Typography variant="h6" sx={{ fontWeight: 800, fontFamily: "monospace", letterSpacing: 2, color: "#2d2d2d" }}>
                      {codigoPreview.codigo}
                    </Typography>
                  )}
                  <Typography variant="caption" sx={{ color: "#888" }}>
                    = 2 letras producto ({codigoPreview.prefijo.substring(0, 2)}) + 2 últimos dígitos lote ({codigoPreview.prefijo.substring(2)}) + correlativo ({codigoPreview.correlativo})
                  </Typography>
                </Box>
              </Box>
            </Box>
            );
          })()}

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
          onVerCodigos={(varianteId) => {
            cargarCodigosProducto(varianteId);
            setOpenCodigosModal(true);
          }}
          onAjustarStock={(lote) => {
            setLoteAjustando(lote);
            setFormAjusteStock({ cantidad_a_reducir: "", motivo: "" });
            setOpenAjusteStockModal(true);
          }}
          formatVencimiento={formatVencimiento}
          formatStock={formatStock}
        />
        {renderModals()}
        
        {/* Modal de ajuste de stock */}
        <Dialog
          open={openAjusteStockModal}
          onClose={() => setOpenAjusteStockModal(false)}
          maxWidth="sm"
          fullWidth
          PaperProps={{
            sx: {
              borderRadius: 4,
              background: "linear-gradient(180deg, rgba(255,249,236,0.98) 0%, rgba(255,255,255,0.95) 100%)",
            },
          }}
        >
          <DialogTitle sx={{ color: colorPrincipal, fontWeight: 800, display: "flex", alignItems: "center", gap: 1 }}>
            <Inventory2 />
            Reducir Stock - {loteAjustando?.lote || "S/N"}
          </DialogTitle>
          <DialogContent dividers>
            <Typography variant="body2" sx={{ color: "#666", mb: 2 }}>
              Producto: {productoDetalle?.marca} - {productoDetalle?.variante}
            </Typography>
            <Typography variant="body2" sx={{ color: "#666", mb: 3 }}>
              Stock actual: <strong>{loteAjustando?.disponible || 0} {productoDetalle?.unidad_base || "u"}</strong>
            </Typography>

            <TextField
              label="Cantidad a reducir"
              type="number"
              fullWidth
              value={formAjusteStock.cantidad_a_reducir}
              onChange={(e) => setFormAjusteStock({ ...formAjusteStock, cantidad_a_reducir: e.target.value })}
              inputProps={{ min: 0.01, step: 0.01 }}
              helperText="Ingresa la cantidad que deseas reducir del stock"
              sx={{ mb: 2 }}
            />

            <TextField
              label="Motivo del ajuste (opcional)"
              fullWidth
              multiline
              rows={2}
              value={formAjusteStock.motivo}
              onChange={(e) => setFormAjusteStock({ ...formAjusteStock, motivo: e.target.value })}
              placeholder="Ej: Producto dañado, caducado, error de registro, etc."
            />
          </DialogContent>
          <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
            <Button
              onClick={() => setOpenAjusteStockModal(false)}
              sx={{ color: "#666" }}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleAjustarStock}
              disabled={ajustandoStock || !formAjusteStock.cantidad_a_reducir}
              variant="contained"
              sx={{ background: colorPrincipal, "&:hover": { background: "#8a5a1a" } }}
            >
              {ajustandoStock ? "Reduciendo..." : "Reducir Stock"}
            </Button>
          </DialogActions>
        </Dialog>
        
        {/* Modal de códigos de barras */}
        <Dialog
          open={openCodigosModal}
          onClose={() => setOpenCodigosModal(false)}
          maxWidth="md"
          fullWidth
          PaperProps={{
            sx: {
              borderRadius: 4,
              background: "linear-gradient(180deg, rgba(255,249,236,0.98) 0%, rgba(255,255,255,0.95) 100%)",
            },
          }}
        >
          <DialogTitle sx={{ color: colorPrincipal, fontWeight: 800, display: "flex", alignItems: "center", gap: 1 }}>
            <QrCodeScanner />
            Códigos de barras - {productoDetalle?.variante}
          </DialogTitle>
          <DialogContent dividers>
            {loadingCodigos ? (
              <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
                <LinearProgress sx={{ width: "60%" }} />
              </Box>
            ) : (
              <>
                {/* Resumen */}
                <Box sx={{ display: "flex", gap: 2, mb: 3, p: 2, backgroundColor: "rgba(163,105,32,0.08)", borderRadius: 2 }}>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="body2" sx={{ color: "#666" }}>Total de códigos</Typography>
                    <Typography variant="h6" sx={{ fontWeight: 800, color: colorPrincipal }}>{codigosProducto.total_codes || 0}</Typography>
                  </Box>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="body2" sx={{ color: "#666" }}>Activos</Typography>
                    <Typography variant="h6" sx={{ fontWeight: 800, color: "#2e7d32" }}>{codigosProducto.activos || 0}</Typography>
                  </Box>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="body2" sx={{ color: "#666" }}>Usados</Typography>
                    <Typography variant="h6" sx={{ fontWeight: 800, color: "#d32f2f" }}>{codigosProducto.usados || 0}</Typography>
                  </Box>
                </Box>

                {/* Lista de códigos */}
                <Box sx={{ maxHeight: 400, overflowY: "auto" }}>
                  {codigosProducto.codes && codigosProducto.codes.length > 0 ? (
                    codigosProducto.codes.map((code, idx) => (
                      <Box
                        key={code.id}
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          p: 1.5,
                          mb: 1,
                          borderRadius: 2,
                          backgroundColor: code.status === "active" ? "rgba(46,125,50,0.08)" : "rgba(211,47,47,0.08)",
                          border: code.status === "active" ? "1px solid rgba(46,125,50,0.2)" : "1px solid rgba(211,47,47,0.2)",
                        }}
                      >
                        <Typography sx={{ fontFamily: "monospace", fontSize: "0.9rem", fontWeight: 600, flex: 1 }}>
                          {code.barcode}
                        </Typography>
                        <Chip
                          label={code.status === "active" ? "Activo" : "Usado"}
                          size="small"
                          sx={{
                            backgroundColor: code.status === "active" ? "#2e7d32" : "#d32f2f",
                            color: "white",
                            fontWeight: 600,
                            fontSize: "0.75rem",
                            mr: 1,
                          }}
                        />
                        {code.unidades_restantes != null && code.unidades_totales > 0 && (
                          <Typography variant="body2" sx={{ color: "#666", mr: 1, fontSize: "0.75rem" }}>
                            {code.unidades_restantes}/{code.unidades_totales}u
                          </Typography>
                        )}
                        <Typography variant="body2" sx={{ color: "#666", minWidth: 60 }}>
                          {code.unit_type}
                        </Typography>
                        <Typography variant="body2" sx={{ color: "#666", minWidth: 40, textAlign: "center" }}>
                          #{code.unit_index}
                        </Typography>
                        <IconButton
                          size="small"
                          onClick={() => handleEditarCantidad(code)}
                          sx={{ color: colorPrincipal, ml: 0.5 }}
                        >
                          <Edit fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={() => handleEliminarCodigo(code.id)}
                          sx={{ color: "#d32f2f", ml: 0.5 }}
                        >
                          <Delete fontSize="small" />
                        </IconButton>
                      </Box>
                    ))
                  ) : (
                    <Typography sx={{ textAlign: "center", py: 4, color: "#999" }}>
                      No hay códigos de barras registrados para este producto
                    </Typography>
                  )}
                </Box>
              </>
            )}
          </DialogContent>
          <DialogActions sx={{ px: 3, py: 2, justifyContent: "space-between" }}>
            <Box sx={{ display: "flex", gap: 1 }}>
              <Button
                size="small"
                startIcon={<Delete />}
                onClick={() => handleEliminarTodosCodigos("all")}
                sx={{ color: "#d32f2f", fontWeight: 600, fontSize: "0.8rem" }}
                disabled={!codigosProducto.codes || codigosProducto.codes.length === 0}
              >
                Eliminar todos
              </Button>
              <Button
                size="small"
                onClick={() => handleEliminarTodosCodigos("scanned")}
                sx={{ color: "#888", fontWeight: 600, fontSize: "0.8rem" }}
                disabled={!codigosProducto.usados || codigosProducto.usados === 0}
              >
                Eliminar usados
              </Button>
            </Box>
            <Button
              onClick={() => setOpenCodigosModal(false)}
              sx={{ color: colorPrincipal, fontWeight: 700 }}
            >
              Cerrar
            </Button>
          </DialogActions>
        </Dialog>

        {/* Modal de edición de cantidad */}
        <Dialog
          open={openEditarCantidadModal}
          onClose={() => setOpenEditarCantidadModal(false)}
          maxWidth="sm"
          fullWidth
          PaperProps={{
            sx: {
              borderRadius: 4,
              background: "linear-gradient(180deg, rgba(255,249,236,0.98) 0%, rgba(255,255,255,0.95) 100%)",
            },
          }}
        >
          <DialogTitle sx={{ color: colorPrincipal, fontWeight: 800, display: "flex", alignItems: "center", gap: 1 }}>
            <Edit />
            Editar cantidad - {codigoEditando?.barcode}
          </DialogTitle>
          <DialogContent dividers>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
              <TextField
                label="Unidades totales"
                type="number"
                fullWidth
                value={formEditarCantidad.unidades_totales}
                onChange={(e) => setFormEditarCantidad({ ...formEditarCantidad, unidades_totales: e.target.value })}
                helperText="Cantidad total de unidades en este código"
              />
              <TextField
                label="Unidades restantes"
                type="number"
                fullWidth
                value={formEditarCantidad.unidades_restantes}
                onChange={(e) => setFormEditarCantidad({ ...formEditarCantidad, unidades_restantes: e.target.value })}
                helperText="Cantidad de unidades disponibles actualmente"
              />
            </Box>
          </DialogContent>
          <DialogActions sx={{ px: 3, py: 2 }}>
            <Button
              onClick={() => setOpenEditarCantidadModal(false)}
              sx={{ color: colorPrincipal, fontWeight: 700 }}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleGuardarCantidad}
              disabled={editandoCantidad || !formEditarCantidad.unidades_totales}
              variant="contained"
              sx={{ background: colorPrincipal, "&:hover": { background: "#8a5a1a" } }}
            >
              {editandoCantidad ? "Guardando..." : "Guardar"}
            </Button>
          </DialogActions>
        </Dialog>
      </>
    );
  }

  /* ===== LIST VIEW ===== */
  return (
    <Box sx={{ minHeight: "200vh", backgroundColor: colorFondo, p: { xs: 2, md: 3 } }}>
      <Box sx={{ maxWidth: 10000, margin: "0 auto" }}>

        {/* Report Header */}
        <Box sx={{ background: "linear-gradient(135deg,#fffdf7 0%,#f3e9d6 100%)", borderRadius: 4, p: { xs: 2.5, md: 4 }, mb: 4, border: "1px solid #e8dcc3", boxShadow: "0 10px 34px rgba(163,105,32,0.12)" }}>
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 2 }}>
            <Box sx={{ display: "flex", alignItems: "center" }}>
              <IconButton onClick={() => navigate("/dashboard")} sx={{ mr: 2, color: colorPrincipal, background: "#fff", boxShadow: "0 2px 8px rgba(0,0,0,0.08)", "&:hover": { background: colorCream } }}><ArrowBack /></IconButton>
              <Box>
                <Typography sx={{ fontWeight: 900, color: "#2d2d2d", fontSize: { xs: 26, md: 40 }, lineHeight: 1.05, textTransform: "uppercase", letterSpacing: 0.5 }}>Reporte de Inventario</Typography>
                <Typography sx={{ color: colorPrincipal, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", fontSize: 13 }}>Gestión de stock · ShowClinic</Typography>
              </Box>
            </Box>
            <Box sx={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 1.5 }}>
              <Typography sx={{ fontWeight: 900, color: colorPrincipal, fontSize: { xs: 30, md: 46 }, lineHeight: 1 }}>{new Date().getFullYear()}</Typography>
              <Box sx={{ display: "flex", gap: 1.5 }}>
                <Button variant="outlined" startIcon={<Download />} sx={{ borderColor: colorSecundario, color: colorPrincipal, fontWeight: 600, borderRadius: 2, background: "#fff", "&:hover": { borderColor: colorPrincipal, background: colorCream } }}>
                  Exportar
                </Button>
                <Button variant="contained" startIcon={<Add />} onClick={() => setOpenRegistrar(true)} sx={{ background: colorPrincipal, fontWeight: 600, borderRadius: 2, px: 3, "&:hover": { background: "#8a5a1a" } }}>
                  Registrar lote
                </Button>
              </Box>
            </Box>
          </Box>
        </Box>

        {/* ===== KPIs Resumen (números grandes) ===== */}
        {(() => {
          const conStock = productos.filter((p) => p.stock > 0).length;
          const agotados = productos.filter((p) => p.stock <= 0).length;
          const kpis = [
            { label: "Productos", value: productos.length, color: colorPrincipal, sub: `${marcasActivas} marcas` },
            { label: "Con stock", value: conStock, color: "#2e7d32", sub: "Disponibles" },
            { label: "Stock bajo", value: stockBajo, color: "#d32f2f", sub: "Reponer" },
            { label: "Por vencer", value: porVencer, color: "#f57c00", sub: "< 30 días" },
            { label: "Agotados", value: agotados, color: "#b71c1c", sub: "Sin stock" },
          ];
          return (
            <Box sx={{ position: "relative", mt: 3, mb: 5 }}>
              <Box sx={{ position: "absolute", top: -16, left: "50%", transform: "translateX(-50%)", zIndex: 3, background: `linear-gradient(135deg, ${colorPrincipal}, ${colorSecundario})`, color: "#fff", fontWeight: 700, fontSize: 14, px: 3.5, py: 1, borderRadius: 3, boxShadow: "0 6px 16px rgba(163,105,32,0.35)", whiteSpace: "nowrap" }}>
                Resumen del inventario
              </Box>
              <Card sx={{ borderRadius: 4, boxShadow: "0 8px 26px rgba(163,105,32,0.10)", border: "1px solid #efe6d4" }}>
                <CardContent sx={{ pt: 4, pb: 3, px: { xs: 1, md: 3 } }}>
                  <Box sx={{ display: "flex", flexWrap: "wrap" }}>
                    {kpis.map((k, i) => (
                      <Box key={k.label} sx={{ flex: { xs: "1 1 33%", md: 1 }, textAlign: "center", py: 1.5, borderRight: { md: i < kpis.length - 1 ? "1px solid #efe6d4" : "none" } }}>
                        <Typography sx={{ color: "#888", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, fontSize: 12, mb: 0.5 }}>{k.label}</Typography>
                        <Typography sx={{ fontWeight: 900, color: k.color, fontSize: { xs: 30, md: 42 }, lineHeight: 1 }}>{k.value}</Typography>
                        <Typography sx={{ color: "#aaa", fontSize: 11, mt: 0.5 }}>{k.sub}</Typography>
                      </Box>
                    ))}
                  </Box>
                </CardContent>
              </Card>
            </Box>
          );
        })()}

        {/* ===== Fila de gráficos (3 paneles) ===== */}
        <Grid container spacing={4} sx={{ mt: 1, mb: 5 }}>
          {/* Panel: Distribución por categoría (dona) */}
          <Grid item xs={12} md={12}>
            <Box sx={{ position: "relative", height: "100%" }}>
              <Box sx={{ position: "absolute", top: -13, left: "50%", transform: "translateX(-50%)", zIndex: 3, background: `linear-gradient(135deg, ${colorPrincipal}, ${colorSecundario})`, color: "#fff", fontWeight: 700, fontSize: 14, px: 3.5, py: 1, borderRadius: 3, boxShadow: "0 6px 16px rgba(163,105,32,0.35)", whiteSpace: "nowrap" }}>
                Distribución por categoría
              </Box>
              <Card sx={{ borderRadius: 4, height: "100%", boxShadow: "0 6px 22px rgba(163,105,32,0.10)", border: "1px solid #efe6d4" }}>
                <CardContent sx={{ pt: 5, px: { xs: 3, md: 6 }, pb: 4 }}>
                  {(() => {
                    const pal = ["#a36920", "#ba9a63", "#8a5a1a", "#cdb079", "#6e4715", "#d8c39a"];
                    const total = productos.length || 1;
                    let currentAngle = -90;
                    return (
                      <Box sx={{ display: "flex", flexDirection: { xs: "column", md: "row" }, alignItems: "center", gap: { xs: 3, md: 8 }, justifyContent: "center" }}>
                        <Box sx={{ position: "relative", width: 320, height: 320, flexShrink: 0 }}>
                          <svg width="320" height="320" viewBox="0 0 320 320">
                            <circle cx="160" cy="160" r="120" fill="none" stroke="#f5f1e4" strokeWidth="72" />
                            {categorias.map((cat, idx) => {
                              const percentage = (cat.count / total) * 100;
                              const angle = (percentage / 100) * 360;
                              const startAngle = currentAngle;
                              const endAngle = currentAngle + angle;
                              currentAngle = endAngle;
                              const startRad = (startAngle * Math.PI) / 180;
                              const endRad = (endAngle * Math.PI) / 180;
                              const x1 = 160 + 120 * Math.cos(startRad);
                              const y1 = 160 + 120 * Math.sin(startRad);
                              const x2 = 160 + 120 * Math.cos(endRad);
                              const y2 = 160 + 120 * Math.sin(endRad);
                              const largeArc = angle > 180 ? 1 : 0;
                              return (
                                <path key={cat.label} d={`M 160 160 L ${x1} ${y1} A 120 120 0 ${largeArc} 1 ${x2} ${y2} Z`} fill={pal[idx % pal.length]} />
                              );
                            })}
                            <circle cx="160" cy="160" r="84" fill="#fff" />
                          </svg>
                          <Box sx={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", textAlign: "center" }}>
                            <Typography sx={{ fontWeight: 900, color: "#2d2d2d", lineHeight: 1, fontSize: 54 }}>{productos.length}</Typography>
                            <Typography sx={{ color: "#999", fontSize: 16 }}>productos</Typography>
                          </Box>
                        </Box>
                        <Box sx={{ flex: 1, width: "100%", maxWidth: 560 }}>
                          {categorias.map((cat, idx) => (
                            <Box key={cat.label} sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1.4, pb: 1.4, borderBottom: "1px solid #f0e8d8" }}>
                              <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                                <Box sx={{ width: 16, height: 16, borderRadius: "4px", background: pal[idx % pal.length] }} />
                                <Typography sx={{ color: "#2d2d2d", fontWeight: 500, fontSize: 18 }}>{cat.label}</Typography>
                              </Box>
                              <Typography sx={{ fontWeight: 700, color: "#2d2d2d", fontSize: 18 }}>
                                {cat.count} · {Math.round((cat.count / total) * 100)}%
                              </Typography>
                            </Box>
                          ))}
                        </Box>
                      </Box>
                    );
                  })()}
                </CardContent>
              </Card>
            </Box>
          </Grid>

          {/* Panel: Unidades por categoría (barras verticales) */}
          <Grid item xs={12} md={12}>
            <Box sx={{ position: "relative", height: "100%" }}>
              <Box sx={{ position: "absolute", top: -13, left: "50%", transform: "translateX(-50%)", zIndex: 3, background: `linear-gradient(135deg, ${colorPrincipal}, ${colorSecundario})`, color: "#fff", fontWeight: 700, fontSize: 13.5, px: 3, py: 0.9, borderRadius: 3, boxShadow: "0 6px 16px rgba(163,105,32,0.35)", whiteSpace: "nowrap" }}>
                Unidades por categoría
              </Box>
              <Card sx={{ borderRadius: 4, height: "100%", boxShadow: "0 6px 22px rgba(163,105,32,0.10)", border: "1px solid #efe6d4" }}>
                <CardContent sx={{ pt: 4, px: 3, pb: 2.5 }}>
                  {(() => {
                    const map = {};
                    productos.forEach((p) => { map[p.categoria] = (map[p.categoria] || 0) + p.stock; });
                    const arr = Object.entries(map).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
                    const max = Math.max(...arr.map((a) => a.value), 1);
                    const pal = ["#a36920", "#ba9a63", "#8a5a1a", "#cdb079", "#6e4715", "#d8c39a"];
                    if (arr.length === 0) return <Typography sx={{ textAlign: "center", color: "#aaa", py: 6 }}>Sin datos</Typography>;
                    return (
                      <>
                        <Box sx={{ display: "flex", alignItems: "flex-end", height: 260, gap: 3, mt: 1, px: { xs: 0, md: 4 } }}>
                          {arr.map((a, i) => (
                            <Box key={a.label} sx={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", height: "100%" }}>
                              <Typography sx={{ fontWeight: 700, color: "#2d2d2d", fontSize: 16, mb: 0.8 }}>{a.value.toLocaleString()}</Typography>
                              <Box sx={{ width: "75%", maxWidth: 110, height: `${(a.value / max) * 100}%`, minHeight: a.value > 0 ? 10 : 2, background: `linear-gradient(180deg, ${pal[i % pal.length]}, ${pal[i % pal.length]}bb)`, borderRadius: "10px 10px 0 0", transition: "height .4s ease" }} />
                            </Box>
                          ))}
                        </Box>
                        <Box sx={{ display: "flex", gap: 3, mt: 1, pt: 1.5, borderTop: "1px solid #efe6d4", px: { xs: 0, md: 4 } }}>
                          {arr.map((a) => (
                            <Typography key={a.label} sx={{ flex: 1, textAlign: "center", color: "#777", fontWeight: 600, fontSize: 14 }}>{a.label}</Typography>
                          ))}
                        </Box>
                      </>
                    );
                  })()}
                </CardContent>
              </Card>
            </Box>
          </Grid>

          {/* Panel: Top productos en stock (barras verticales) */}
          <Grid item xs={12} md={12}>
            <Box sx={{ position: "relative", height: "100%" }}>
              <Box sx={{ position: "absolute", top: -13, left: "50%", transform: "translateX(-50%)", zIndex: 3, background: `linear-gradient(135deg, ${colorPrincipal}, ${colorSecundario})`, color: "#fff", fontWeight: 700, fontSize: 13.5, px: 3, py: 0.9, borderRadius: 3, boxShadow: "0 6px 16px rgba(163,105,32,0.35)", whiteSpace: "nowrap" }}>
                Top productos en stock
              </Box>
              <Card sx={{ borderRadius: 4, height: "100%", boxShadow: "0 6px 22px rgba(163,105,32,0.10)", border: "1px solid #efe6d4" }}>
                <CardContent sx={{ pt: 4, px: 3, pb: 2.5 }}>
                  {(() => {
                    const data = productos.filter((p) => p.stock > 0).sort((a, b) => b.stock - a.stock).slice(0, 5);
                    const max = Math.max(...data.map((p) => p.stock), 1);
                    const pal = ["#a36920", "#ba9a63", "#8a5a1a", "#cdb079", "#6e4715"];
                    if (data.length === 0) return <Typography sx={{ textAlign: "center", color: "#aaa", py: 6 }}>Sin productos con stock</Typography>;
                    return (
                      <>
                        <Box sx={{ display: "flex", alignItems: "flex-end", height: 190, gap: 1.5, mt: 1 }}>
                          {data.map((p, i) => (
                            <Box key={p.variante_id} sx={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", height: "100%" }}>
                              <Typography sx={{ fontWeight: 700, color: "#2d2d2d", fontSize: 12, mb: 0.5 }}>{p.stock.toLocaleString()}</Typography>
                              <Box sx={{ width: "70%", maxWidth: 46, height: `${(p.stock / max) * 100}%`, minHeight: 8, background: `linear-gradient(180deg, ${pal[i % pal.length]}, ${pal[i % pal.length]}bb)`, borderRadius: "8px 8px 0 0", transition: "height .4s ease" }} />
                            </Box>
                          ))}
                        </Box>
                        <Box sx={{ display: "flex", gap: 1.5, mt: 1, pt: 1, borderTop: "1px solid #efe6d4" }}>
                          {data.map((p) => (
                            <Typography key={p.variante_id} title={p.variante} sx={{ flex: 1, textAlign: "center", color: "#777", fontWeight: 600, fontSize: 10.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.variante}</Typography>
                          ))}
                        </Box>
                      </>
                    );
                  })()}
                </CardContent>
              </Card>
            </Box>
          </Grid>
        </Grid>

        {/* ===== Participación por categoría (medidores semicirculares) ===== */}
        <Box sx={{ position: "relative", mb: 5 }}>
          <Box sx={{ position: "absolute", top: -16, left: "50%", transform: "translateX(-50%)", zIndex: 3, background: `linear-gradient(135deg, ${colorPrincipal}, ${colorSecundario})`, color: "#fff", fontWeight: 700, fontSize: 14, px: 3.5, py: 1, borderRadius: 3, boxShadow: "0 6px 16px rgba(163,105,32,0.35)", whiteSpace: "nowrap" }}>
            Participación por categoría
          </Box>
          <Card sx={{ borderRadius: 4, boxShadow: "0 8px 26px rgba(163,105,32,0.10)", border: "1px solid #efe6d4" }}>
            <CardContent sx={{ pt: 4.5, pb: 3, px: { xs: 1, md: 3 } }}>
              {(() => {
                const total = productos.length || 1;
                const pal = ["#a36920", "#8a5a1a", "#ba9a63", "#cdb079", "#6e4715", "#d8c39a"];
                const data = [...categorias].sort((a, b) => b.count - a.count).slice(0, 6);
                const len = Math.PI * 48;
                if (data.length === 0) return <Typography sx={{ textAlign: "center", color: "#aaa", py: 4 }}>Sin datos</Typography>;
                return (
                  <Box sx={{ display: "flex", flexWrap: "wrap", justifyContent: "space-around", gap: 2 }}>
                    {data.map((cat, idx) => {
                      const pct = Math.round((cat.count / total) * 100);
                      const dash = ((pct / 100) * len).toFixed(1);
                      const color = pal[idx % pal.length];
                      return (
                        <Box key={cat.label} sx={{ flex: "1 1 130px", maxWidth: 200, textAlign: "center" }}>
                          <Box sx={{ position: "relative", display: "inline-block" }}>
                            <svg width="140" height="84" viewBox="0 0 120 72">
                              <path d="M 12 60 A 48 48 0 0 1 108 60" fill="none" stroke="#ece2cd" strokeWidth="12" strokeLinecap="round" />
                              <path d="M 12 60 A 48 48 0 0 1 108 60" fill="none" stroke={color} strokeWidth="12" strokeLinecap="round" strokeDasharray={`${dash} 1000`} />
                              <text x="60" y="54" textAnchor="middle" fontSize="22" fontWeight="800" fill="#2d2d2d">{pct}%</text>
                            </svg>
                          </Box>
                          <Typography sx={{ color: "#555", fontWeight: 600, fontSize: 13, mt: -0.5 }}>{cat.label}</Typography>
                          <Typography sx={{ color: "#aaa", fontSize: 11 }}>{cat.count} producto{cat.count !== 1 ? "s" : ""}</Typography>
                        </Box>
                      );
                    })}
                  </Box>
                );
              })()}
            </CardContent>
          </Card>
        </Box>

        {/* ===== Unidades por producto (barras filtrables, ancho completo) ===== */}
        <Box sx={{ position: "relative", mb: 5 }}>
          <Box sx={{ position: "absolute", top: -16, left: "50%", transform: "translateX(-50%)", zIndex: 3, background: `linear-gradient(135deg, ${colorPrincipal}, ${colorSecundario})`, color: "#fff", fontWeight: 700, fontSize: 14, px: 3.5, py: 1, borderRadius: 3, boxShadow: "0 6px 16px rgba(163,105,32,0.35)", whiteSpace: "nowrap" }}>
            Unidades por producto
          </Box>
          <Card sx={{ borderRadius: 4, boxShadow: "0 8px 26px rgba(163,105,32,0.10)", border: "1px solid #efe6d4" }}>
              <CardContent sx={{ pt: 4, px: { xs: 2, md: 4 }, pb: 2.5 }}>
                <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", mb: 0.5, gap: 1 }}>
                  <Box>
                    <Typography variant="caption" sx={{ color: "#888", display: "block" }}>
                      Ordenado de mayor a menor stock disponible
                    </Typography>
                  </Box>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => setOpenFiltroGrafico((v) => !v)}
                    endIcon={openFiltroGrafico ? <ExpandLess /> : <ExpandMore />}
                    sx={{ borderColor: colorSecundario, color: colorPrincipal, fontWeight: 600, borderRadius: 2, textTransform: "none", whiteSpace: "nowrap", "&:hover": { borderColor: colorPrincipal, background: colorCream } }}
                  >
                    Filtrar {productosOcultos.length > 0 ? `(${productosOcultos.length} oculto${productosOcultos.length > 1 ? "s" : ""})` : ""}
                  </Button>
                </Box>

                {/* Panel de selección de productos a mostrar */}
                <Collapse in={openFiltroGrafico}>
                  <Box sx={{ p: 1.5, mt: 1, mb: 1.5, borderRadius: 2, background: colorFondo, border: "1px solid #e8e0d0" }}>
                    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 0.5 }}>
                      <Typography variant="caption" sx={{ color: "#777", fontWeight: 600 }}>Selecciona los productos a incluir en el gráfico</Typography>
                      {productosOcultos.length > 0 && (
                        <Button size="small" onClick={() => setProductosOcultos([])} sx={{ textTransform: "none", color: colorPrincipal, fontSize: 12, minWidth: 0 }}>Mostrar todos</Button>
                      )}
                    </Box>
                    <Box sx={{ maxHeight: 140, overflowY: "auto", display: "flex", flexWrap: "wrap" }}>
                      {productos.filter((p) => p.stock > 0).sort((a, b) => b.stock - a.stock).map((p) => (
                        <FormControlLabel
                          key={p.variante_id}
                          control={
                            <Checkbox
                              size="small"
                              checked={!productosOcultos.includes(p.variante_id)}
                              onChange={() => toggleProductoGrafico(p.variante_id)}
                              sx={{ color: colorSecundario, "&.Mui-checked": { color: colorPrincipal }, py: 0.25 }}
                            />
                          }
                          label={<Typography variant="caption" sx={{ color: "#444" }}>{p.variante}</Typography>}
                          sx={{ width: { xs: "100%", sm: "50%" }, m: 0 }}
                        />
                      ))}
                    </Box>
                  </Box>
                </Collapse>

                {/* Barras */}
                <Box sx={{ mt: 2 }}>
                  {(() => {
                    const data = productos
                      .filter((p) => p.stock > 0 && !productosOcultos.includes(p.variante_id))
                      .sort((a, b) => b.stock - a.stock);
                    if (data.length === 0) {
                      return <Typography variant="body2" sx={{ color: "#aaa", textAlign: "center", py: 4 }}>No hay productos para mostrar</Typography>;
                    }
                    const maxStock = Math.max(...data.map((p) => p.stock));
                    return (
                      <Box sx={{ maxHeight: 520, overflowY: "auto", pr: 1.5, "&::-webkit-scrollbar": { width: 8 }, "&::-webkit-scrollbar-thumb": { borderRadius: 4, background: colorSecundario } }}>
                        {data.map((p) => {
                          const percentage = maxStock > 0 ? (p.stock / maxStock) * 100 : 0;
                          const catColor = getCategoriaColor(p.categoria);
                          return (
                            <Box key={p.variante_id} sx={{ mb: 2 }}>
                              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 0.6 }}>
                                <Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 0 }}>
                                  <Box sx={{ width: 10, height: 10, borderRadius: "50%", background: catColor.text, flexShrink: 0 }} />
                                  <Typography sx={{ color: "#2d2d2d", fontWeight: 600, fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.variante}</Typography>
                                </Box>
                                <Typography sx={{ fontWeight: 800, color: colorPrincipal, fontSize: 14, flexShrink: 0, ml: 1 }}>
                                  {p.stock.toLocaleString()} {p.unidad_base || "u"}
                                </Typography>
                              </Box>
                              <Box sx={{ width: "100%", height: 16, background: "#f0ece1", borderRadius: 8, overflow: "hidden" }}>
                                <Box sx={{
                                  width: `${percentage}%`,
                                  height: "100%",
                                  minWidth: percentage > 0 ? 8 : 0,
                                  background: `linear-gradient(90deg, ${colorPrincipal}, ${colorSecundario})`,
                                  borderRadius: 8,
                                  transition: "width 0.4s ease",
                                }} />
                              </Box>
                            </Box>
                          );
                        })}
                      </Box>
                    );
                  })()}
                </Box>
              </CardContent>
            </Card>
        </Box>

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

            {(() => {
              const conStock = productosFiltrados.filter((p) => p.stock > 0);
              const sinStock = productosFiltrados.filter((p) => p.stock <= 0);

              const renderFila = (p, idx, agotado) => {
                const catColor = getCategoriaColor(p.categoria);
                const rowBg = agotado ? "#fff5f5" : idx % 2 === 0 ? "#fff" : "#fafafa";
                return (
                  <Box key={p.variante_id} sx={{
                    display: "grid", gridTemplateColumns: "2fr 1fr 1fr 0.8fr 1fr 1.2fr 0.8fr",
                    px: 2, py: 1.5, alignItems: "center", borderBottom: "1px solid #f5f5f5", background: rowBg, borderRadius: 1,
                    transition: "background 0.15s", "&:hover": { background: "#fdf6ec" },
                    borderLeft: agotado ? "3px solid #d32f2f" : "3px solid transparent", cursor: "pointer",
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
                    <Typography variant="body2" sx={{ fontWeight: 600, color: agotado ? "#d32f2f" : "#2d2d2d" }}>{formatStock(p.stock, p.unidad_base)}</Typography>
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
                      <IconButton size="small" onClick={() => eliminarProducto(p.variante_id, p.variante)} sx={{ color: "#d32f2f" }}>
                        <Delete fontSize="small" />
                      </IconButton>
                    </Box>
                  </Box>
                );
              };

              const TableHeader = () => (
                <Box sx={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 0.8fr 1fr 1.2fr 0.8fr", px: 2, py: 1, borderBottom: "1px solid #eee", mb: 1 }}>
                  {["PRODUCTO", "CATEGORÍA", "STOCK", "LOTES", "VENCE", "ESTADO", "ACCIONES"].map((h) => (
                    <Typography key={h} variant="caption" sx={{ fontWeight: 700, color: "#999", letterSpacing: 0.5 }}>{h}</Typography>
                  ))}
                </Box>
              );

              return (
                <>
                  {/* ===== Productos con stock ===== */}
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
                    <Box sx={{ width: 8, height: 8, borderRadius: "50%", background: "#2e7d32" }} />
                    <Typography variant="subtitle1" sx={{ fontWeight: 700, color: "#2d2d2d" }}>Disponibles</Typography>
                    <Chip label={conStock.length} size="small" sx={{ background: "#e8f5e9", color: "#2e7d32", fontWeight: 700, height: 22 }} />
                  </Box>
                  <TableHeader />
                  <Box sx={{ maxHeight: "50vh", overflowY: "auto", "&::-webkit-scrollbar": { width: 6 }, "&::-webkit-scrollbar-thumb": { borderRadius: 3, background: colorSecundario } }}>
                    {conStock.map((p, idx) => renderFila(p, idx, false))}
                    {conStock.length === 0 && (
                      <Typography sx={{ textAlign: "center", py: 3, color: "#999" }}>No hay productos con stock</Typography>
                    )}
                  </Box>

                  {/* ===== Productos sin stock ===== */}
                  <Divider sx={{ my: 3 }} />
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
                    <Box sx={{ width: 8, height: 8, borderRadius: "50%", background: "#d32f2f" }} />
                    <Typography variant="subtitle1" sx={{ fontWeight: 700, color: "#2d2d2d" }}>Sin stock</Typography>
                    <Chip label={sinStock.length} size="small" sx={{ background: "#ffebee", color: "#d32f2f", fontWeight: 700, height: 22 }} />
                  </Box>
                  {sinStock.length > 0 && <TableHeader />}
                  <Box sx={{ maxHeight: "40vh", overflowY: "auto", "&::-webkit-scrollbar": { width: 6 }, "&::-webkit-scrollbar-thumb": { borderRadius: 3, background: colorSecundario } }}>
                    {sinStock.map((p, idx) => renderFila(p, idx, true))}
                    {sinStock.length === 0 && (
                      <Typography sx={{ textAlign: "center", py: 3, color: "#999" }}>Todos los productos tienen stock</Typography>
                    )}
                  </Box>

                  {/* Footer count */}
                  <Box sx={{ mt: 2, pt: 2, borderTop: "1px solid #eee" }}>
                    <Typography variant="caption" sx={{ color: "#999" }}>
                      {conStock.length} disponibles · {sinStock.length} sin stock · {productosFiltrados.length} de {productos.length} productos
                    </Typography>
                  </Box>
                </>
              );
            })()}
          </CardContent>
        </Card>
      </Box>

      {renderModals()}
    </Box>
  );
}

/* ===== DETALLE PRODUCTO ===== */
function DetalleProducto({ productoDetalle, lotesDelProducto, onVolver, onNuevoLote, onEditarLote, onImprimirSticker, onVerCodigos, onAjustarStock, formatVencimiento, formatStock }) {
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
            <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
              <Button variant="contained" startIcon={<Add />} onClick={onNuevoLote} sx={{ background: colorPrincipal, borderRadius: 2, "&:hover": { background: "#8a5a1a" } }}>
                Nuevo lote
              </Button>
              <Button variant="outlined" startIcon={<QrCodeScanner />} onClick={() => onVerCodigos(productoDetalle.variante_id)} sx={{ borderColor: colorPrincipal, color: colorPrincipal, borderRadius: 2, "&:hover": { background: "rgba(163,105,32,0.08)" } }}>
                Ver códigos
              </Button>
            </Box>

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

                    <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                      <Button size="small" variant="outlined" onClick={() => onImprimirSticker(lote)}
                        sx={{ borderColor: "#ddd", color: "#555", borderRadius: 2, textTransform: "none", fontSize: 12, "&:hover": { borderColor: colorPrincipal, color: colorPrincipal } }}>
                        🏷️ Imprimir stickers
                      </Button>
                      <Button size="small" variant="outlined" onClick={() => onEditarLote(lote)}
                        sx={{ borderColor: "#ddd", color: "#555", borderRadius: 2, textTransform: "none", fontSize: 12, "&:hover": { borderColor: colorPrincipal, color: colorPrincipal } }}>
                        ✏️ Ajustar
                      </Button>
                      <Button size="small" variant="outlined" onClick={() => onAjustarStock(lote)}
                        sx={{ borderColor: "#ddd", color: "#555", borderRadius: 2, textTransform: "none", fontSize: 12, "&:hover": { borderColor: colorPrincipal, color: colorPrincipal } }}>
                        📉 Reducir stock
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
