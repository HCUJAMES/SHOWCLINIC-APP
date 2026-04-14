import React, { useEffect, useState } from "react";
import useSocket from "../../hooks/useSocket";
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Grid,
  FormControl,
  Select,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tooltip,
  Chip,
  Collapse,
} from "@mui/material";
import InfoIcon from "@mui/icons-material/Info";
import { ArrowBack, Home, Edit, Delete, ExpandMore, ExpandLess } from "@mui/icons-material";
import { useNavigate } from "react-router-dom";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { useToast } from "../../components/ToastProvider";

const API_BASE =
  process.env.REACT_APP_API_URL ||
  `${window.location.protocol}//${window.location.hostname}:4000`;

export default function Inventario() {
  const navigate = useNavigate();
  const colorPrincipal = "#a36920ff";
  const colorPrincipalPdf = [163, 105, 32];
  const { showToast } = useToast();
  const [productosBase, setProductosBase] = useState([]);
  const [variantes, setVariantes] = useState([]);
  const [stockLotes, setStockLotes] = useState([]);
  const [filtroTexto, setFiltroTexto] = useState("");
  const [modoMarca, setModoMarca] = useState("select"); // select | new
  const [selectedMarcaId, setSelectedMarcaId] = useState("");
  const [modoVariante, setModoVariante] = useState("select"); // select | new
  const [selectedVarianteId, setSelectedVarianteId] = useState("");
  const [formIngresoSimple, setFormIngresoSimple] = useState({
    marca: "",
    variante: "",
    laboratorio: "",
    lote: "",
    cantidad: "",
    cajas: "",
    jeringas: "",
  });
  const [unidadNuevaVariante, setUnidadNuevaVariante] = useState("ml");
  const [contenidoNuevaVariante, setContenidoNuevaVariante] = useState("");
  const [pdfIngreso, setPdfIngreso] = useState(null);
  const [pdfIngresoKey, setPdfIngresoKey] = useState(0);
  const [guardandoIngreso, setGuardandoIngreso] = useState(false);
  const [editLoteId, setEditLoteId] = useState(null);
  const [editLote, setEditLote] = useState("");
  const [editCantidad, setEditCantidad] = useState("");
  const [editCajas, setEditCajas] = useState("");
  const [editJeringas, setEditJeringas] = useState("");
  const [guardandoEdicionLote, setGuardandoEdicionLote] = useState(false);
  const [editPrecioVarianteId, setEditPrecioVarianteId] = useState(null);
  const [editPrecioCliente, setEditPrecioCliente] = useState("");
  const [guardandoPrecio, setGuardandoPrecio] = useState(false);
  const [editVarianteOpen, setEditVarianteOpen] = useState(false);
  const [editVarianteData, setEditVarianteData] = useState({ id: null, nombre: "", laboratorio: "", unidad_base: "ml", precio_cliente: "" });
  const [guardandoVariante, setGuardandoVariante] = useState(false);
  const [mostrarAgregarStock, setMostrarAgregarStock] = useState(false);
  const role = localStorage.getItem("role");
  const canWriteInventory = role === "doctor" || role === "logistica" || role === "master";
  const token = localStorage.getItem("token");

  const fechaPeru = () =>
    new Date()
      .toLocaleString("sv-SE", { timeZone: "America/Lima" })
      .replace("T", " ")
      .slice(0, 19);

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

  const exportarPDF = async () => {
    const resumen = calcularResumenPorVariante();
    const doc = new jsPDF("p", "pt", "a4");
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margenX = 40;
    const headerHeight = 92;

    const logo = "/images/logo-showclinic.png";
    const img = await loadImage(logo);
    const logoCircular = makeCircularImageDataUrl(img, 256, 10);

    const filas = resumen.map((r) => [
      r.producto_base_nombre || "",
      r.variante_nombre || "",
      r.laboratorio || "",
      `${Number(r.disponible_efectivo || 0).toFixed(2)} ${r.unidad_base || ""}`.trim(),
    ]);

    const didDrawHeaderFooter = (data) => {
      doc.setFillColor(...colorPrincipalPdf);
      doc.rect(0, 0, pageWidth, headerHeight, "F");

      if (logoCircular) {
        const logoSize = 54;
        doc.addImage(logoCircular, "PNG", margenX, 20, logoSize, logoSize);
      }

      doc.setFont("helvetica", "bold");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(18);
      doc.text("Inventario Clínico", margenX + 72, 46);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text(
        `Emitido: ${fechaPeru()}`,
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
    };

    autoTable(doc, {
      startY: headerHeight + 18,
      margin: { left: margenX, right: margenX },
      head: [["Marca", "Variante", "Laboratorio", "Disponible"]],
      body: filas,
      theme: "striped",
      headStyles: {
        fillColor: colorPrincipalPdf,
        textColor: 255,
        fontStyle: "bold",
        halign: "center",
        valign: "middle",
      },
      styles: { fontSize: 9, cellPadding: 4, valign: "middle" },
      alternateRowStyles: { fillColor: [247, 242, 234] },
      columnStyles: {
        3: { halign: "right", cellWidth: 90 },
      },
      didDrawPage: didDrawHeaderFooter,
    });

    const stamp = fechaPeru().replace(/[: ]/g, "-");
    doc.save(`inventario_${stamp}.pdf`);
  };

  const variantesFiltradasPorMarca = selectedMarcaId
    ? variantes.filter((v) => String(v.producto_base_id) === String(selectedMarcaId))
    : [];

  const varianteSeleccionada = selectedVarianteId
    ? variantes.find((v) => String(v.id) === String(selectedVarianteId))
    : null;

  useEffect(() => {
    if (modoVariante === "select" && varianteSeleccionada) {
      setFormIngresoSimple((p) => ({
        ...p,
        laboratorio: varianteSeleccionada.laboratorio || "",
      }));
    }
  }, [modoVariante, selectedVarianteId]);

  const calcularResumenPorVariante = () => {
    const map = new Map();
    stockLotes.forEach((l) => {
      const key = String(l.variante_id);
      const disponible = Math.max(
        0,
        (parseFloat(l.cantidad_unidades) || 0) -
          (parseFloat(l.cantidad_reservada_unidades) || 0)
      );
      const cajasLote = parseFloat(l.cajas) || 0;
      const jeringasLote = parseFloat(l.jeringas) || 0;

      const prev = map.get(key);
      if (!prev) {
        map.set(key, {
          variante_id: l.variante_id,
          producto_base_nombre: l.producto_base_nombre || "",
          variante_nombre: l.variante_nombre || "",
          unidad_base: l.unidad_base || "",
          laboratorio: "",
          stock_minimo_unidades: 0,
          disponible_efectivo: disponible,
          total_cajas: cajasLote,
          total_jeringas: jeringasLote,
        });
      } else {
        prev.disponible_efectivo += disponible;
        prev.total_cajas = (prev.total_cajas || 0) + cajasLote;
        prev.total_jeringas = (prev.total_jeringas || 0) + jeringasLote;
      }
    });

    // Asegurar que las variantes sin lotes también aparezcan (stock 0)
    variantes.forEach((v) => {
      const key = String(v.id);
      if (map.has(key)) return;
      map.set(key, {
        variante_id: v.id,
        producto_base_nombre: v.producto_base_nombre || "",
        variante_nombre: v.nombre || "",
        unidad_base: v.unidad_base || "",
        laboratorio: v.laboratorio || "",
        stock_minimo_unidades: parseFloat(v.stock_minimo_unidades) || 0,
        disponible_efectivo: 0,
        total_cajas: 0,
        total_jeringas: 0,
      });
    });

    // Enlazar laboratorio, stock mínimo y precio_cliente desde variantes
    variantes.forEach((v) => {
      const key = String(v.id);
      const row = map.get(key);
      if (!row) return;
      row.laboratorio = v.laboratorio || "";
      row.stock_minimo_unidades = parseFloat(v.stock_minimo_unidades) || 0;
      row.producto_base_nombre = v.producto_base_nombre || row.producto_base_nombre;
      row.variante_nombre = v.nombre || row.variante_nombre;
      row.unidad_base = v.unidad_base || row.unidad_base;
      row.precio_cliente = v.precio_cliente != null ? parseFloat(v.precio_cliente) : null;
    });

    const res = Array.from(map.values()).map((r) => {
      const stockMinFinal = Math.max(3, r.stock_minimo_unidades || 0);
      const estado = r.disponible_efectivo < stockMinFinal ? "EMERGENCIA" : "OK";
      return {
        ...r,
        stock_minimo_final: stockMinFinal,
        estado,
      };
    });

    const term = filtroTexto.trim().toLowerCase();
    const filtered = term
      ? res.filter((r) =>
          `${r.producto_base_nombre} ${r.variante_nombre} ${r.laboratorio}`
            .toLowerCase()
            .includes(term)
        )
      : res;

    return filtered.sort((a, b) => {
      if (a.estado !== b.estado) return a.estado === "EMERGENCIA" ? -1 : 1;
      return `${a.producto_base_nombre} ${a.variante_nombre}`.localeCompare(
        `${b.producto_base_nombre} ${b.variante_nombre}`
      );
    });
  };

  // Obtener productos base (marca / familia)
  const obtenerProductosBase = () => {
    fetch(`${API_BASE}/api/inventario/productos-base`, {
      headers: token
        ? {
            Authorization: `Bearer ${token}`,
          }
        : {},
    })
      .then((r) => r.json())
      .then(setProductosBase)
      .catch(console.error);
  };

  // Obtener variantes
  const obtenerVariantes = () => {
    fetch(`${API_BASE}/api/inventario/variantes`, {
      headers: token
        ? {
            Authorization: `Bearer ${token}`,
          }
        : {},
    })
      .then((r) => r.json())
      .then(setVariantes)
      .catch(console.error);
  };

  // Obtener stock por lote (se usa solo para cálculos internos)
  const obtenerStockLotes = () => {
    fetch(`${API_BASE}/api/inventario/stock-lotes`, {
      headers: token
        ? {
            Authorization: `Bearer ${token}`,
          }
        : {},
    })
      .then((r) => r.json())
      .then(setStockLotes)
      .catch(console.error);
  };

  useEffect(() => {
    obtenerProductosBase();
    obtenerVariantes();
    obtenerStockLotes();
  }, []);

  // Sincronización en tiempo real
  useSocket(["inventario:updated"], () => {
    obtenerProductosBase();
    obtenerVariantes();
    obtenerStockLotes();
  });

  const normalizar = (s) => (typeof s === "string" ? s.trim() : "");

  const ensureProductoBase = async (nombreMarca) => {
    const marca = normalizar(nombreMarca);
    if (!marca) throw new Error("Marca vacía");

    const existente = productosBase.find(
      (p) => (p.nombre || "").trim().toLowerCase() === marca.toLowerCase()
    );
    if (existente) return existente;

    const res = await fetch(`${API_BASE}/api/inventario/productos-base`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ nombre: marca, categoria: null, descripcion: null }),
    });
    if (!res.ok) throw new Error("No se pudo crear marca");
    const created = await res.json();
    return { id: created.id, nombre: created.nombre };
  };

  const ensureVariante = async ({ productoBaseId, nombreVariante, laboratorio, unidadBase, contenidoPorPresentacion }) => {
    const nombre = normalizar(nombreVariante);
    const lab = normalizar(laboratorio);
    if (!nombre) throw new Error("Variante vacía");

    const existente = variantes.find(
      (v) =>
        String(v.producto_base_id) === String(productoBaseId) &&
        (v.nombre || "").trim().toLowerCase() === nombre.toLowerCase() &&
        ((v.laboratorio || "").trim().toLowerCase() === lab.toLowerCase())
    );
    if (existente) return existente;

    const unidad = unidadBase || "ml";
    const contenido = parseFloat(contenidoPorPresentacion) || 1;

    const res = await fetch(`${API_BASE}/api/inventario/variantes`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        producto_base_id: Number(productoBaseId),
        nombre,
        laboratorio: lab || null,
        sku: null,
        unidad_base: unidad,
        contenido_por_presentacion: contenido,
        es_medico: false,
        costo_unitario: null,
        precio_unitario: null,
        stock_minimo_unidades: 3,
      }),
    });
    if (!res.ok) throw new Error("No se pudo crear variante");
    const created = await res.json();
    return {
      id: created.id,
      producto_base_id: productoBaseId,
      nombre,
      laboratorio: lab || null,
      unidad_base: unidad,
      contenido_por_presentacion: contenido,
      stock_minimo_unidades: 3,
    };
  };

  const editarStockLote = async (stockLoteId, lote, cantidadUnidades) => {
    if (!canWriteInventory) return;
    const cantidad = parseFloat(cantidadUnidades);
    if (isNaN(cantidad) || cantidad < 0) {
      showToast({ severity: "warning", message: "Cantidad inválida" });
      return;
    }

    try {
      setGuardandoEdicionLote(true);
      const res = await fetch(`${API_BASE}/api/inventario/stock-lotes/${stockLoteId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ lote: lote || null, cantidad_unidades: cantidad, cajas: parseFloat(editCajas) || 0, jeringas: parseFloat(editJeringas) || 0 }),
      });
      if (!res.ok) throw new Error();
      await obtenerStockLotes();
      setEditLoteId(null);
      setEditLote("");
      setEditCantidad("");
      setEditCajas("");
      setEditJeringas("");
    } catch (e) {
      console.error(e);
      showToast({ severity: "error", message: "Error al editar lote" });
    } finally {
      setGuardandoEdicionLote(false);
    }
  };

  const borrarStockLote = async (stockLoteId) => {
    if (!canWriteInventory) return;
    if (!window.confirm("¿Eliminar este lote?")) return;
    try {
      const res = await fetch(`${API_BASE}/api/inventario/stock-lotes/${stockLoteId}`, {
        method: "DELETE",
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (!res.ok) throw new Error();
      await obtenerStockLotes();
      if (editLoteId === stockLoteId) {
        setEditLoteId(null);
        setEditLote("");
        setEditCantidad("");
      }
    } catch (e) {
      console.error(e);
      showToast({ severity: "error", message: "Error al eliminar lote" });
    }
  };

  const guardarPrecioCliente = async (varianteId) => {
    if (!canWriteInventory) return;
    const precio = parseFloat(editPrecioCliente);
    if (isNaN(precio) || precio < 0) {
      showToast({ severity: "warning", message: "Precio inválido" });
      return;
    }

    try {
      setGuardandoPrecio(true);
      const res = await fetch(`${API_BASE}/api/inventario/variantes/${varianteId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ precio_cliente: precio }),
      });
      if (!res.ok) throw new Error();
      await obtenerVariantes();
      setEditPrecioVarianteId(null);
      setEditPrecioCliente("");
      showToast({ severity: "success", message: "Precio actualizado" });
    } catch (e) {
      console.error(e);
      showToast({ severity: "error", message: "Error al guardar precio" });
    } finally {
      setGuardandoPrecio(false);
    }
  };

  const abrirEditarVariante = (r) => {
    setEditVarianteData({
      id: r.variante_id,
      nombre: r.variante_nombre || "",
      laboratorio: r.laboratorio || "",
      unidad_base: r.unidad_base || "ml",
      precio_cliente: r.precio_cliente != null ? String(r.precio_cliente) : "",
    });
    setEditVarianteOpen(true);
  };

  const guardarEditVariante = async () => {
    if (!canWriteInventory || !editVarianteData.id) return;
    if (!editVarianteData.nombre.trim()) {
      showToast({ severity: "warning", message: "El nombre es obligatorio" });
      return;
    }
    try {
      setGuardandoVariante(true);
      const res = await fetch(`${API_BASE}/api/inventario/variantes/${editVarianteData.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          nombre: editVarianteData.nombre.trim(),
          laboratorio: editVarianteData.laboratorio.trim() || null,
          unidad_base: editVarianteData.unidad_base,
          precio_cliente: editVarianteData.precio_cliente !== "" ? parseFloat(editVarianteData.precio_cliente) : null,
        }),
      });
      if (!res.ok) throw new Error();
      await obtenerVariantes();
      await obtenerStockLotes();
      setEditVarianteOpen(false);
      showToast({ severity: "success", message: "Producto actualizado" });
    } catch (e) {
      console.error(e);
      showToast({ severity: "error", message: "Error al actualizar producto" });
    } finally {
      setGuardandoVariante(false);
    }
  };

  const borrarVariante = async (varianteId, nombre) => {
    if (!canWriteInventory) return;
    if (!window.confirm(`¿Eliminar "${nombre}" y todo su stock? Esta acción no se puede deshacer.`)) return;
    try {
      const res = await fetch(`${API_BASE}/api/inventario/variantes/${varianteId}`, {
        method: "DELETE",
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (!res.ok) throw new Error();
      await obtenerVariantes();
      await obtenerStockLotes();
      showToast({ severity: "success", message: `"${nombre}" eliminado` });
    } catch (e) {
      console.error(e);
      showToast({ severity: "error", message: "Error al eliminar producto" });
    }
  };

  const registrarIngresoSimple = async () => {
    if (!canWriteInventory) return;
    let productoBaseId = null;
    let varianteId = null;

    const marcaTexto = normalizar(formIngresoSimple.marca);
    const varianteTexto = normalizar(formIngresoSimple.variante);
    const laboratorioTexto = normalizar(formIngresoSimple.laboratorio);
    const lote = normalizar(formIngresoSimple.lote);
    const cantidad = parseFloat(formIngresoSimple.cantidad);

    if (modoMarca === "select") {
      if (!selectedMarcaId) {
        showToast({ severity: "warning", message: "Selecciona una marca" });
        return;
      }
      productoBaseId = Number(selectedMarcaId);
    } else {
      if (!marcaTexto) {
        showToast({ severity: "warning", message: "Ingresa la marca" });
        return;
      }
    }

    if (modoVariante === "select") {
      if (!selectedVarianteId) {
        showToast({ severity: "warning", message: "Selecciona una variante" });
        return;
      }
      varianteId = Number(selectedVarianteId);
    } else {
      if (!varianteTexto) {
        showToast({ severity: "warning", message: "Ingresa la variante" });
        return;
      }
    }

    if (!lote) {
      showToast({ severity: "warning", message: "Completa el Número de lote" });
      return;
    }
    if (isNaN(cantidad) || cantidad <= 0) {
      showToast({ severity: "warning", message: "La cantidad debe ser mayor a 0" });
      return;
    }

    try {
      setGuardandoIngreso(true);

      if (!productoBaseId) {
        const pb = await ensureProductoBase(marcaTexto);
        productoBaseId = Number(pb.id);
        await obtenerProductosBase();
      }

      if (!varianteId) {
        const v = await ensureVariante({
          productoBaseId,
          nombreVariante: varianteTexto,
          laboratorio: laboratorioTexto,
          unidadBase: unidadNuevaVariante,
          contenidoPorPresentacion: contenidoNuevaVariante,
        });
        varianteId = Number(v.id);
        await obtenerVariantes();
      }

      const payload = {
        proveedor: null,
        documento: null,
        observacion: "ingreso_simple",
        lineas: [
          {
            variante_id: Number(varianteId),
            lote,
            fecha_vencimiento: null,
            ubicacion: null,
            cantidad_unidades: cantidad,
            cantidad_presentaciones: null,
            costo_unitario: null,
            condicion_almacenamiento: null,
            cajas: parseFloat(formIngresoSimple.cajas) || 0,
            jeringas: parseFloat(formIngresoSimple.jeringas) || 0,
          },
        ],
      };

      const url = `${API_BASE}/api/inventario/ingreso`;
      const headersAuth = {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };

      let res;
      if (pdfIngreso) {
        const data = new FormData();
        data.append("observacion", payload.observacion);
        data.append("proveedor", "");
        data.append("documento", "");
        data.append("lineas", JSON.stringify(payload.lineas));
        data.append("pdf", pdfIngreso);
        res = await fetch(url, {
          method: "POST",
          headers: headersAuth,
          body: data,
        });
      } else {
        res = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...headersAuth,
          },
          body: JSON.stringify(payload),
        });
      }
      if (!res.ok) throw new Error();

      setFormIngresoSimple({ marca: "", variante: "", laboratorio: "", lote: "", cantidad: "", cajas: "", jeringas: "" });
      setPdfIngreso(null);
      setPdfIngresoKey((k) => k + 1);
      setSelectedMarcaId("");
      setSelectedVarianteId("");
      setModoMarca("select");
      setModoVariante("select");
      setUnidadNuevaVariante("ml");
      setContenidoNuevaVariante("");
      await Promise.all([obtenerProductosBase(), obtenerVariantes(), obtenerStockLotes()]);
      showToast({ severity: "success", message: "Stock actualizado" });
    } catch (e) {
      console.error(e);
      showToast({ severity: "error", message: "Error al registrar ingreso" });
    } finally {
      setGuardandoIngreso(false);
    }
  };

  const [filtroGrafico, setFiltroGrafico] = useState("todos");

  const calcularPorMarca = () => {
    const resumen = calcularResumenPorVariante();
    const map = new Map();
    resumen.forEach(r => {
      const marca = r.producto_base_nombre || "Sin marca";
      if (!map.has(marca)) map.set(marca, { marca, total: 0, count: 0 });
      const entry = map.get(marca);
      entry.total += r.disponible_efectivo;
      entry.count += 1;
    });
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  };

  const calcularPorLaboratorio = () => {
    const resumen = calcularResumenPorVariante();
    const map = new Map();
    resumen.forEach(r => {
      const lab = r.laboratorio || "Otros";
      if (!map.has(lab)) map.set(lab, { laboratorio: lab, totalStock: 0 });
      map.get(lab).totalStock += r.disponible_efectivo;
    });
    return Array.from(map.values()).sort((a, b) => b.totalStock - a.totalStock);
  };

  const resumenMemo = calcularResumenPorVariante();
  const totalProductos = resumenMemo.length;
  const enEmergencia = resumenMemo.filter(r => r.estado === "EMERGENCIA").length;
  const stockOK = resumenMemo.filter(r => r.estado === "OK").length;
  const marcasUnicas = new Set(resumenMemo.map(r => r.producto_base_nombre)).size;

  const resumenFiltrado = filtroGrafico === "emergencias"
    ? resumenMemo.filter(r => r.estado === "EMERGENCIA")
    : filtroGrafico === "ok"
      ? resumenMemo.filter(r => r.estado === "OK")
      : resumenMemo;

  const maxStock = Math.max(1, ...resumenFiltrado.map(r => r.disponible_efectivo));
  const maxStockMinimo = Math.max(1, ...resumenFiltrado.map(r => r.stock_minimo_final));
  const escalaMax = Math.max(maxStock, maxStockMinimo) * 1.15;

  return (
    <Box sx={{ minHeight: "100vh", backgroundColor: "#f5f1e4", p: { xs: 2, md: 3 } }}>
      <Box sx={{ maxWidth: 1200, margin: "0 auto" }}>

        {/* Nav */}
        <Box sx={{ display: "flex", justifyContent: "space-between", mb: 4 }}>
          <IconButton onClick={() => navigate("/dashboard")} sx={{ backgroundColor: "white", boxShadow: "0 2px 8px rgba(0,0,0,0.08)", "&:hover": { backgroundColor: "#fff", boxShadow: "0 4px 12px rgba(0,0,0,0.12)" } }}>
            <ArrowBack sx={{ color: "#5a3e1b" }} />
          </IconButton>
          <IconButton onClick={() => navigate("/dashboard")} sx={{ backgroundColor: "white", boxShadow: "0 2px 8px rgba(0,0,0,0.08)", "&:hover": { backgroundColor: "#fff", boxShadow: "0 4px 12px rgba(0,0,0,0.12)" } }}>
            <Home sx={{ color: "#5a3e1b" }} />
          </IconButton>
        </Box>

        {/* Título + búsqueda */}
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 2, mb: 4 }}>
          <Box>
            <Typography sx={{ fontSize: "2rem", fontWeight: 400, color: "#2E2E2E", lineHeight: 1.2 }}>
              Inventario clínico
            </Typography>
            <Typography sx={{ fontSize: "0.9rem", color: "#999", textTransform: "uppercase", letterSpacing: 2, mt: 0.5 }}>
              Vista gráfica · ShowClinic Arequipa
            </Typography>
          </Box>
          <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap", alignItems: "center" }}>
            <TextField
              placeholder="Buscar producto…"
              value={filtroTexto}
              onChange={(e) => setFiltroTexto(e.target.value)}
              size="small"
              sx={{
                minWidth: 220,
                "& .MuiOutlinedInput-root": { backgroundColor: "white", borderRadius: 2.5, "& fieldset": { borderColor: "rgba(163,105,32,0.2)" }, "&:hover fieldset": { borderColor: "#ba9a63" } },
              }}
            />
            <Button variant="outlined" size="small" onClick={exportarPDF} sx={{ borderColor: "#5a3e1b", color: "#5a3e1b", fontWeight: 600, borderRadius: 2, "&:hover": { backgroundColor: "rgba(90,62,27,0.06)", borderColor: "#5a3e1b" } }}>
              Exportar PDF
            </Button>
          </Box>
        </Box>

        {/* Estadísticas */}
        <Grid container spacing={2} sx={{ mb: 4 }}>
          {[
            { valor: totalProductos, label: "TOTAL PRODUCTOS", bg: "white", color: "#2E2E2E", labelColor: "#999" },
            { valor: enEmergencia, label: "EN EMERGENCIA", bg: "white", color: enEmergencia > 0 ? "#d32f2f" : "#2E2E2E", labelColor: enEmergencia > 0 ? "#d32f2f" : "#999" },
            { valor: stockOK, label: "ESTADO OK", bg: "white", color: "#2E2E2E", labelColor: "#999" },
            { valor: marcasUnicas, label: "MARCAS", bg: "white", color: "#2E2E2E", labelColor: "#999" },
          ].map((stat, i) => (
            <Grid item xs={6} sm={3} key={i}>
              <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, backgroundColor: stat.bg, border: "1px solid rgba(163,105,32,0.1)" }}>
                <Typography sx={{ fontSize: "2.2rem", fontWeight: 300, color: stat.color, lineHeight: 1 }}>{stat.valor}</Typography>
                <Typography sx={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: 1.5, color: stat.labelColor, mt: 0.5 }}>{stat.label}</Typography>
              </Paper>
            </Grid>
          ))}
        </Grid>

        {/* ═══════════ GRÁFICO 1: Stock por producto ═══════════ */}
        <Paper elevation={0} sx={{ p: 4, borderRadius: 4, backgroundColor: "white", border: "1px solid rgba(163,105,32,0.08)", mb: 3 }}>
          <Typography sx={{ fontSize: "1.2rem", fontWeight: 600, color: "#2E2E2E", mb: 0.5 }}>
            Stock disponible por producto (ml / frascos)
          </Typography>

          {/* Filtros funcionales */}
          <Box sx={{ display: "flex", gap: 1, mt: 1.5, mb: 2.5, flexWrap: "wrap", alignItems: "center" }}>
            <Typography sx={{ fontSize: "0.8rem", color: "#999", mr: 1 }}>Filtrar:</Typography>
            {[
              { key: "todos", label: "Todos" },
              { key: "emergencias", label: "Solo emergencia" },
              { key: "ok", label: "Solo OK" },
            ].map(f => (
              <Chip
                key={f.key}
                label={f.label}
                size="small"
                onClick={() => setFiltroGrafico(f.key)}
                sx={{
                  backgroundColor: filtroGrafico === f.key ? "#5a3e1b" : "transparent",
                  color: filtroGrafico === f.key ? "white" : "#5a3e1b",
                  border: `1px solid ${filtroGrafico === f.key ? "#5a3e1b" : "rgba(90,62,27,0.3)"}`,
                  fontWeight: 500,
                  cursor: "pointer",
                  "&:hover": { backgroundColor: filtroGrafico === f.key ? "#4a3015" : "rgba(90,62,27,0.08)" },
                }}
              />
            ))}
          </Box>

          {/* Leyenda */}
          <Box sx={{ display: "flex", gap: 3, mb: 3 }}>
            {[
              { color: "#5a3e1b", label: "Stock OK" },
              { color: "#ba9a63", label: "Stock bajo" },
              { color: "#d32f2f", label: "Emergencia" },
            ].map((l, i) => (
              <Box key={i} sx={{ display: "flex", alignItems: "center", gap: 0.8 }}>
                <Box sx={{ width: 10, height: 10, borderRadius: "50%", backgroundColor: l.color }} />
                <Typography sx={{ fontSize: "0.75rem", color: "#888" }}>{l.label}</Typography>
              </Box>
            ))}
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.8 }}>
              <Box sx={{ width: 14, height: 0, borderTop: "2px dashed #d32f2f" }} />
              <Typography sx={{ fontSize: "0.75rem", color: "#888" }}>Mínimo (3.00)</Typography>
            </Box>
          </Box>

          {/* Barras */}
          {resumenFiltrado.length === 0 && (
            <Typography sx={{ textAlign: "center", color: "#999", py: 4 }}>No hay productos en este filtro</Typography>
          )}
          {resumenFiltrado.map((r) => {
            const pct = (r.disponible_efectivo / escalaMax) * 100;
            const minPct = (r.stock_minimo_final / escalaMax) * 100;
            const barColor = r.estado === "EMERGENCIA" ? "#d32f2f" : r.disponible_efectivo < r.stock_minimo_final * 1.5 ? "#ba9a63" : "#5a3e1b";
            return (
              <Box key={r.variante_id} sx={{ display: "flex", alignItems: "center", mb: 1.8, gap: 2 }}>
                <Box sx={{ width: 180, minWidth: 180, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <Typography sx={{ fontSize: "0.82rem", fontWeight: 500, color: "#2E2E2E", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 140 }} title={r.variante_nombre}>
                    {r.producto_base_nombre} — {r.variante_nombre}
                  </Typography>
                  {canWriteInventory && (
                    <Box sx={{ display: "flex", ml: 0.5 }}>
                      <IconButton size="small" onClick={() => abrirEditarVariante(r)} sx={{ p: 0.3, color: "#ba9a63" }}><Edit sx={{ fontSize: 14 }} /></IconButton>
                      <IconButton size="small" onClick={() => borrarVariante(r.variante_id, r.variante_nombre)} sx={{ p: 0.3, color: "#d32f2f" }}><Delete sx={{ fontSize: 14 }} /></IconButton>
                    </Box>
                  )}
                </Box>
                <Box sx={{ flex: 1, position: "relative", height: 28, backgroundColor: "#f5f1e4", borderRadius: 1.5 }}>
                  <Box sx={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${Math.max(pct, 0.5)}%`, backgroundColor: barColor, borderRadius: 1.5, transition: "width 0.4s ease" }} />
                  <Box sx={{ position: "absolute", left: `${minPct}%`, top: 0, height: "100%", borderLeft: "2px dashed #d32f2f", zIndex: 2 }} />
                </Box>
                <Typography sx={{ fontSize: "0.75rem", fontWeight: 600, color: "#555", minWidth: 50, textAlign: "right" }}>
                  {r.disponible_efectivo.toFixed(1)}
                </Typography>
              </Box>
            );
          })}
        </Paper>

        {/* ═══════════ GRÁFICO 2: Distribución por marca ═══════════ */}
        <Paper elevation={0} sx={{ p: 4, borderRadius: 4, backgroundColor: "white", border: "1px solid rgba(163,105,32,0.08)", mb: 3 }}>
          <Typography sx={{ fontSize: "1.2rem", fontWeight: 600, color: "#2E2E2E", mb: 3 }}>
            Distribución por marca
          </Typography>
          {(() => {
            const marcas = calcularPorMarca();
            const maxMarca = Math.max(1, ...marcas.map(m => m.total));
            const colores = ["#5a3e1b", "#a36920", "#ba9a63", "#8b6914", "#6b4e1f", "#d4a96a", "#3e2a0f", "#c2955a", "#7a5b2e", "#4a3318"];
            return marcas.map((item, idx) => (
              <Box key={idx} sx={{ display: "flex", alignItems: "center", mb: 1.5, gap: 2 }}>
                <Typography sx={{ width: 120, minWidth: 120, fontSize: "0.82rem", fontWeight: 500, color: "#2E2E2E", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {item.marca} ({item.count})
                </Typography>
                <Box sx={{ flex: 1, height: 22, backgroundColor: "#f5f1e4", borderRadius: 1.5, position: "relative" }}>
                  <Box sx={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${(item.total / maxMarca) * 100}%`, backgroundColor: colores[idx % colores.length], borderRadius: 1.5, transition: "width 0.4s ease" }} />
                </Box>
                <Typography sx={{ fontSize: "0.75rem", color: "#666", minWidth: 60, textAlign: "right" }}>
                  {item.total.toFixed(1)} ml
                </Typography>
              </Box>
            ));
          })()}
        </Paper>

        {/* ═══════════ GRÁFICO 3: Stock acumulado por laboratorio (barras verticales) ═══════════ */}
        <Paper elevation={0} sx={{ p: 4, borderRadius: 4, backgroundColor: "white", border: "1px solid rgba(163,105,32,0.08)", mb: 3 }}>
          <Typography sx={{ fontSize: "1.2rem", fontWeight: 600, color: "#2E2E2E", mb: 3 }}>
            Stock acumulado por laboratorio
          </Typography>
          <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: "1px solid #f0ece3", backgroundColor: "#fdfcf9" }}>
            {(() => {
              const labs = calcularPorLaboratorio();
              const maxLab = Math.max(1, ...labs.map(l => l.totalStock));
              return (
                <Box sx={{ display: "flex", alignItems: "flex-end", justifyContent: "space-around", height: 260, pt: 4 }}>
                  {labs.map((item, idx) => {
                    const pctH = (item.totalStock / maxLab) * 200;
                    return (
                      <Box key={idx} sx={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1, maxWidth: 100 }}>
                        <Typography sx={{ fontSize: "0.75rem", fontWeight: 600, color: "#2E2E2E", mb: 0.5 }}>
                          {item.totalStock.toFixed(0)}
                        </Typography>
                        <Box sx={{ width: "60%", maxWidth: 50, height: `${Math.max(pctH, 4)}px`, backgroundColor: "#5a3e1b", borderRadius: "4px 4px 0 0", transition: "height 0.4s ease" }} />
                        <Typography sx={{ fontSize: "0.65rem", color: "#888", mt: 1, textAlign: "center", wordBreak: "break-word", lineHeight: 1.2 }}>
                          {item.laboratorio}
                        </Typography>
                      </Box>
                    );
                  })}
                </Box>
              );
            })()}
          </Paper>
        </Paper>

        {/* ═══════════ ALERTAS DE EMERGENCIA ═══════════ */}
        {enEmergencia > 0 && (
          <Paper elevation={0} sx={{ p: 4, borderRadius: 4, backgroundColor: "#fffbfb", border: "1px solid rgba(211,47,47,0.2)", mb: 3 }}>
            <Typography sx={{ fontSize: "1.2rem", fontWeight: 600, color: "#d32f2f", mb: 0.5 }}>
              Alertas de emergencia — requieren reposición inmediata
            </Typography>
            <Typography sx={{ fontSize: "0.85rem", color: "#999", mb: 3 }}>
              Productos con stock por debajo del mínimo requerido
            </Typography>
            {resumenMemo.filter(r => r.estado === "EMERGENCIA").map((r) => (
              <Box key={r.variante_id} sx={{ display: "flex", alignItems: "center", py: 1.8, borderBottom: "1px solid rgba(211,47,47,0.08)", gap: 2 }}>
                <Typography sx={{ width: 200, minWidth: 200, fontSize: "0.875rem", fontWeight: 500, color: "#d32f2f" }}>
                  {r.variante_nombre}
                </Typography>
                <Box sx={{ flex: 1, height: 16, backgroundColor: "#fde8e8", borderRadius: 10, overflow: "hidden" }}>
                  <Box sx={{ height: "100%", width: `${Math.min((r.disponible_efectivo / r.stock_minimo_final) * 100, 100)}%`, backgroundColor: "#d32f2f", borderRadius: 10, transition: "width 0.4s ease" }} />
                </Box>
                <Typography sx={{ fontSize: "0.75rem", color: "#888", minWidth: 120, textAlign: "right" }}>
                  {r.disponible_efectivo.toFixed(1)} {r.unidad_base} / mín {r.stock_minimo_final.toFixed(0)} {r.unidad_base}
                </Typography>
              </Box>
            ))}
          </Paper>
        )}

        {/* ═══════════ INGRESO RÁPIDO ═══════════ */}
        <Paper elevation={0} sx={{ p: 3, borderRadius: 4, backgroundColor: "white", border: "1px solid rgba(163,105,32,0.08)", mb: 3 }}>
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }} onClick={() => setMostrarAgregarStock(!mostrarAgregarStock)}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
              <InfoIcon sx={{ color: "#5a3e1b" }} />
              <Typography sx={{ fontWeight: 600, color: "#5a3e1b", fontSize: "1.05rem" }}>Ingreso rápido (suma stock automáticamente)</Typography>
            </Box>
            <IconButton size="small" sx={{ color: "#5a3e1b" }}>
              {mostrarAgregarStock ? <ExpandLess /> : <ExpandMore />}
            </IconButton>
          </Box>
          <Collapse in={mostrarAgregarStock}>
            <Box sx={{ mt: 3 }}>
              {canWriteInventory ? (
            <Grid container spacing={2}>
              <Grid item xs={12} md={3}>
                <FormControl fullWidth size="small">
                  <Select
                    value={modoMarca === "select" ? selectedMarcaId : "__new__"}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === "__new__") {
                        setModoMarca("new");
                        setSelectedMarcaId("");
                        setFormIngresoSimple((p) => ({ ...p, marca: "" }));
                        setModoVariante("new");
                        setSelectedVarianteId("");
                        setFormIngresoSimple((p) => ({ ...p, variante: "", laboratorio: "" }));
                        return;
                      }
                      setModoMarca("select");
                      setSelectedMarcaId(val);
                      setModoVariante("select");
                      setSelectedVarianteId("");
                      setFormIngresoSimple((p) => ({ ...p, variante: "", laboratorio: "" }));
                    }}
                    displayEmpty
                    renderValue={(selected) => {
                      if (!selected) {
                        return (
                          <Box component="span" sx={{ color: "rgba(0,0,0,0.55)" }}>
                            Marca (seleccione…)
                          </Box>
                        );
                      }
                      if (selected === "__new__") return "Nueva marca…";
                      const pb = (productosBase || []).find((x) => String(x.id) === String(selected));
                      return pb?.nombre || String(selected);
                    }}
                    sx={{
                      backgroundColor: "rgba(255,255,255,0.92)",
                      borderRadius: 2,
                      minHeight: 40,
                      "& .MuiSelect-select": {
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      },
                    }}
                  >
                    <MenuItem value="">
                      <em>Seleccione…</em>
                    </MenuItem>
                    {(productosBase || []).map((pb) => (
                      <MenuItem key={pb.id} value={pb.id}>
                        {pb.nombre}
                      </MenuItem>
                    ))}
                    <MenuItem value="__new__">Nueva marca…</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              {modoMarca === "new" && (
                <Grid item xs={12} md={3}>
                  <TextField
                    label="Nueva marca"
                    fullWidth
                    size="small"
                    value={formIngresoSimple.marca}
                    onChange={(e) =>
                      setFormIngresoSimple((p) => ({ ...p, marca: e.target.value }))
                    }
                  />
                </Grid>
              )}

              <Grid item xs={12} md={3}>
                <FormControl fullWidth size="small" disabled={modoMarca === "select" && !selectedMarcaId}>
                  <Select
                    value={modoVariante === "select" ? selectedVarianteId : "__new__"}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === "__new__") {
                        setModoVariante("new");
                        setSelectedVarianteId("");
                        setFormIngresoSimple((p) => ({ ...p, variante: "", laboratorio: "" }));
                        return;
                      }
                      setModoVariante("select");
                      setSelectedVarianteId(val);
                    }}
                    displayEmpty
                    renderValue={(selected) => {
                      if (!selected) {
                        return (
                          <Box component="span" sx={{ color: "rgba(0,0,0,0.55)" }}>
                            Variante (seleccione…)
                          </Box>
                        );
                      }
                      if (selected === "__new__") return "Nueva variante…";
                      const v = variantesFiltradasPorMarca.find((x) => String(x.id) === String(selected));
                      return v?.nombre || String(selected);
                    }}
                    sx={{
                      backgroundColor: "rgba(255,255,255,0.92)",
                      borderRadius: 2,
                      minHeight: 40,
                      "& .MuiSelect-select": {
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      },
                    }}
                  >
                    <MenuItem value="">
                      <em>Seleccione…</em>
                    </MenuItem>
                    {variantesFiltradasPorMarca.map((v) => (
                      <MenuItem key={v.id} value={v.id}>
                        {v.nombre}
                      </MenuItem>
                    ))}
                    <MenuItem value="__new__">Nueva variante…</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              {modoVariante === "new" && (
                <>
                  <Grid item xs={12} md={3}>
                    <TextField
                      label="Nueva variante"
                      fullWidth
                      size="small"
                      value={formIngresoSimple.variante}
                      onChange={(e) =>
                        setFormIngresoSimple((p) => ({ ...p, variante: e.target.value }))
                      }
                    />
                  </Grid>
                  <Grid item xs={6} md={2}>
                    <FormControl fullWidth size="small">
                      <Select
                        value={unidadNuevaVariante}
                        onChange={(e) => setUnidadNuevaVariante(e.target.value)}
                        displayEmpty
                      >
                        <MenuItem value="ml">ml (mililitros)</MenuItem>
                        <MenuItem value="U">U (unidades)</MenuItem>
                        <MenuItem value="frasco">Frasco</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={6} md={2}>
                    <TextField
                      label={unidadNuevaVariante === "U" ? "Unidades por frasco" : "ml por presentación"}
                      type="number"
                      fullWidth
                      size="small"
                      value={contenidoNuevaVariante}
                      onChange={(e) => setContenidoNuevaVariante(e.target.value)}
                      inputProps={{ min: 0.1, step: unidadNuevaVariante === "U" ? 1 : 0.1 }}
                      helperText={unidadNuevaVariante === "U" ? "Ej: Botox = 100" : "Ej: Juvederm = 1"}
                    />
                  </Grid>
                </>
              )}

              <Grid item xs={12} md={3}>
                <TextField
                  label="Laboratorio"
                  fullWidth
                  size="small"
                  value={formIngresoSimple.laboratorio}
                  onChange={(e) =>
                    setFormIngresoSimple((p) => ({ ...p, laboratorio: e.target.value }))
                  }
                  disabled={modoVariante === "select" && !!selectedVarianteId}
                />
              </Grid>
              <Grid item xs={12} md={3}>
                <TextField
                  label="Número de lote"
                  fullWidth
                  size="small"
                  value={formIngresoSimple.lote}
                  onChange={(e) =>
                    setFormIngresoSimple((p) => ({ ...p, lote: e.target.value }))
                  }
                />
              </Grid>
              <Grid item xs={6} md={1.5}>
                <TextField
                  label="Cajas"
                  type="number"
                  fullWidth
                  size="small"
                  value={formIngresoSimple.cajas}
                  onChange={(e) =>
                    setFormIngresoSimple((p) => ({ ...p, cajas: e.target.value }))
                  }
                  inputProps={{ min: 0, step: 1 }}
                  helperText="Ej: 2"
                />
              </Grid>
              <Grid item xs={6} md={1.5}>
                <TextField
                  label="Jeringas"
                  type="number"
                  fullWidth
                  size="small"
                  value={formIngresoSimple.jeringas}
                  onChange={(e) =>
                    setFormIngresoSimple((p) => ({ ...p, jeringas: e.target.value }))
                  }
                  inputProps={{ min: 0, step: 1 }}
                  helperText="Ej: 4"
                />
              </Grid>
              <Grid item xs={12} md={3}>
                <TextField
                  label={`Cantidad (${
                    modoVariante === "select" && varianteSeleccionada
                      ? varianteSeleccionada.unidad_base || "ml"
                      : modoVariante === "new"
                        ? unidadNuevaVariante
                        : "ml"
                  })`}
                  type="number"
                  fullWidth
                  size="small"
                  value={formIngresoSimple.cantidad}
                  onChange={(e) =>
                    setFormIngresoSimple((p) => ({ ...p, cantidad: e.target.value }))
                  }
                  inputProps={{ min: 0.1, step: (modoVariante === "select" && (varianteSeleccionada?.unidad_base === "U" || varianteSeleccionada?.unidad_base === "frasco")) || (modoVariante === "new" && (unidadNuevaVariante === "U" || unidadNuevaVariante === "frasco")) ? 1 : 0.1 }}
                  helperText={
                    (modoVariante === "select" && varianteSeleccionada?.unidad_base === "U") || (modoVariante === "new" && unidadNuevaVariante === "U")
                      ? "Ej: 1 frasco de 100U = 100"
                      : (modoVariante === "select" && varianteSeleccionada?.unidad_base === "frasco") || (modoVariante === "new" && unidadNuevaVariante === "frasco")
                        ? "Ej: 4 frascos"
                        : "Ej: caja 2x1ml = 2"
                  }
                />
              </Grid>
              <Grid item xs={12} md={3}>
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                    height: "100%",
                    flexWrap: "wrap",
                  }}
                >
                  <Button
                    component="label"
                    variant="outlined"
                    size="small"
                    sx={{
                      borderColor: "rgba(90,62,27,0.3)",
                      color: "#5a3e1b",
                      fontWeight: 600,
                      borderRadius: 2,
                      backgroundColor: "rgba(255,255,255,0.85)",
                      "&:hover": { backgroundColor: "rgba(90,62,27,0.06)" },
                      whiteSpace: "nowrap",
                    }}
                  >
                    PDF (guía/recibo)
                    <input
                      key={pdfIngresoKey}
                      hidden
                      type="file"
                      accept="application/pdf"
                      onChange={(e) => {
                        const f = e.target.files?.[0] || null;
                        setPdfIngreso(f);
                      }}
                    />
                  </Button>

                  <Typography
                    variant="body2"
                    sx={{
                      color: "rgba(0,0,0,0.70)",
                      maxWidth: { xs: "100%", md: 220 },
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                    title={pdfIngreso?.name || ""}
                  >
                    {pdfIngreso?.name ? pdfIngreso.name : "Sin archivo"}
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} md={9}>
                <Box sx={{ display: "flex", justifyContent: "flex-end", height: "100%", alignItems: "center" }}>
                  <Button
                    variant="contained"
                    sx={{ backgroundColor: "#5a3e1b", fontWeight: 600, borderRadius: 2, px: 4, "&:hover": { backgroundColor: "#4a3015" } }}
                    disabled={guardandoIngreso}
                    onClick={registrarIngresoSimple}
                  >
                    Agregar al stock
                  </Button>
                </Box>
              </Grid>
            </Grid>
          ) : (
            <Typography variant="body2" sx={{ color: "rgba(0,0,0,0.70)" }}>
              El rol admin solo puede visualizar. Para modificar el inventario, ingresa como doctor.
            </Typography>
          )}
            </Box>
          </Collapse>
        </Paper>

        {/* ═══════════ TABLA: LOTES REGISTRADOS ═══════════ */}
        <Paper elevation={0} sx={{ p: 4, borderRadius: 4, backgroundColor: "white", border: "1px solid rgba(163,105,32,0.08)", mb: 3, overflowX: "auto" }}>
          <Typography sx={{ fontSize: "1.2rem", fontWeight: 600, color: "#2E2E2E", mb: 3 }}>
            Lotes registrados
          </Typography>

        <Table size="small" sx={{ "& .MuiTableCell-root": { fontSize: "0.82rem", borderColor: "rgba(163,105,32,0.08)" }, "& .MuiTableHead-root .MuiTableCell-root": { fontWeight: 600, color: "#5a3e1b", textTransform: "uppercase", fontSize: "0.7rem", letterSpacing: 1 } }}>
          <TableHead>
            <TableRow>
              <TableCell>Marca</TableCell>
              <TableCell>Variante</TableCell>
              <TableCell>Laboratorio</TableCell>
              <TableCell>Número de lote</TableCell>
              <TableCell>Cajas</TableCell>
              <TableCell>Jeringas</TableCell>
              <TableCell>Cantidad</TableCell>
              <TableCell>PDF</TableCell>
              {canWriteInventory && <TableCell>Acciones</TableCell>}
            </TableRow>
          </TableHead>
          <TableBody>
            {stockLotes
              .slice()
              .sort((a, b) => (b.id || 0) - (a.id || 0))
              .filter((l) => {
                const term = filtroTexto.trim().toLowerCase();
                if (!term) return true;
                const lab =
                  variantes.find((v) => String(v.id) === String(l.variante_id))
                    ?.laboratorio || "";
                return `${l.producto_base_nombre || ""} ${l.variante_nombre || ""} ${lab} ${l.lote || ""}`
                  .toLowerCase()
                  .includes(term);
              })
              .map((l) => {
                const varRow = variantes.find((v) => String(v.id) === String(l.variante_id));
                const lab = varRow?.laboratorio || "";
                const enEdicion = editLoteId === l.id;
                return (
                  <TableRow key={l.id}>
                    <TableCell>{l.producto_base_nombre || ""}</TableCell>
                    <TableCell>{l.variante_nombre || ""}</TableCell>
                    <TableCell>{lab || "—"}</TableCell>
                    <TableCell>
                      {enEdicion ? (
                        <TextField
                          size="small"
                          value={editLote}
                          onChange={(e) => setEditLote(e.target.value)}
                        />
                      ) : (
                        l.lote || "—"
                      )}
                    </TableCell>
                    <TableCell>
                      {enEdicion ? (
                        <TextField
                          size="small"
                          type="number"
                          value={editCajas}
                          onChange={(e) => setEditCajas(e.target.value)}
                          sx={{ width: 70 }}
                        />
                      ) : (
                        Number(l.cajas || 0).toFixed(0)
                      )}
                    </TableCell>
                    <TableCell>
                      {enEdicion ? (
                        <TextField
                          size="small"
                          type="number"
                          value={editJeringas}
                          onChange={(e) => setEditJeringas(e.target.value)}
                          sx={{ width: 70 }}
                        />
                      ) : (
                        Number(l.jeringas || 0).toFixed(0)
                      )}
                    </TableCell>
                    <TableCell>
                      {enEdicion ? (
                        <TextField
                          size="small"
                          type="number"
                          value={editCantidad}
                          onChange={(e) => setEditCantidad(e.target.value)}
                        />
                      ) : (
                        `${Number(l.cantidad_unidades || 0).toFixed(2)} ${l.unidad_base || "ml"}`
                      )}
                    </TableCell>
                    <TableCell>
                      {l.documento_pdf ? (
                        <Button
                          size="small"
                          variant="outlined"
                          sx={{ borderColor: "#5a3e1b", color: "#5a3e1b", fontWeight: 600, borderRadius: 2, fontSize: "0.72rem" }}
                          onClick={() =>
                            window.open(`${API_BASE}/uploads/docs/${l.documento_pdf}`, "_blank")
                          }
                        >
                          Ver PDF
                        </Button>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    {canWriteInventory && (
                      <TableCell>
                        {enEdicion ? (
                          <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                            <Button
                              size="small"
                              variant="contained"
                              disabled={guardandoEdicionLote}
                              sx={{ backgroundColor: "#5a3e1b", fontWeight: 600, borderRadius: 2, fontSize: "0.72rem", "&:hover": { backgroundColor: "#4a3015" } }}
                              onClick={() => editarStockLote(l.id, editLote, editCantidad)}
                            >
                              Guardar
                            </Button>
                            <Button
                              size="small"
                              variant="outlined"
                              sx={{ borderColor: "rgba(90,62,27,0.3)", color: "#5a3e1b", fontWeight: 500, borderRadius: 2, fontSize: "0.72rem" }}
                              onClick={() => {
                                setEditLoteId(null);
                                setEditLote("");
                                setEditCantidad("");
                                setEditCajas("");
                                setEditJeringas("");
                              }}
                            >
                              Cancelar
                            </Button>
                          </Box>
                        ) : (
                          <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                            <Button
                              size="small"
                              variant="outlined"
                              sx={{ borderColor: "rgba(90,62,27,0.3)", color: "#5a3e1b", fontWeight: 500, borderRadius: 2, fontSize: "0.72rem" }}
                              onClick={() => {
                                setEditLoteId(l.id);
                                setEditLote(l.lote || "");
                                setEditCantidad(String(l.cantidad_unidades ?? ""));
                                setEditCajas(String(l.cajas ?? ""));
                                setEditJeringas(String(l.jeringas ?? ""));
                              }}
                            >
                              Editar
                            </Button>
                            <Button
                              size="small"
                              variant="outlined"
                              sx={{ borderColor: "rgba(211,47,47,0.3)", color: "#d32f2f", fontWeight: 500, borderRadius: 2, fontSize: "0.72rem" }}
                              onClick={() => borrarStockLote(l.id)}
                            >
                              Borrar
                            </Button>
                          </Box>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
          </TableBody>
        </Table>
        </Paper>
      </Box>

      {/* Dialog para editar variante */}
      <Dialog open={editVarianteOpen} onClose={() => setEditVarianteOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 4 } }}>
        <DialogTitle sx={{ color: "#5a3e1b", fontWeight: 600, fontSize: "1.1rem" }}>Editar Producto</DialogTitle>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: "16px !important" }}>
          <TextField
            label="Nombre"
            fullWidth
            value={editVarianteData.nombre}
            onChange={(e) => setEditVarianteData((p) => ({ ...p, nombre: e.target.value }))}
          />
          <TextField
            label="Laboratorio"
            fullWidth
            value={editVarianteData.laboratorio}
            onChange={(e) => setEditVarianteData((p) => ({ ...p, laboratorio: e.target.value }))}
          />
          <FormControl fullWidth>
            <Select
              value={editVarianteData.unidad_base}
              onChange={(e) => setEditVarianteData((p) => ({ ...p, unidad_base: e.target.value }))}
            >
              <MenuItem value="ml">ml (mililitros)</MenuItem>
              <MenuItem value="U">U (unidades)</MenuItem>
              <MenuItem value="frasco">Frasco</MenuItem>
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setEditVarianteOpen(false)} sx={{ color: "#999", fontWeight: 500, borderRadius: 2 }}>Cancelar</Button>
          <Button
            variant="contained"
            onClick={guardarEditVariante}
            disabled={guardandoVariante}
            sx={{ backgroundColor: "#5a3e1b", fontWeight: 600, borderRadius: 2, "&:hover": { backgroundColor: "#4a3015" } }}
          >
            {guardandoVariante ? "Guardando..." : "Guardar"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
