import React, { useEffect, useState } from "react";
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
} from "@mui/material";
import InfoIcon from "@mui/icons-material/Info";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { useToast } from "../../components/ToastProvider";

const API_BASE =
  process.env.REACT_APP_API_URL ||
  `${window.location.protocol}//${window.location.hostname}:4000`;

export default function Inventario() {
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
  });
  const [pdfIngreso, setPdfIngreso] = useState(null);
  const [pdfIngresoKey, setPdfIngresoKey] = useState(0);
  const [guardandoIngreso, setGuardandoIngreso] = useState(false);
  const [editLoteId, setEditLoteId] = useState(null);
  const [editLote, setEditLote] = useState("");
  const [editCantidad, setEditCantidad] = useState("");
  const [guardandoEdicionLote, setGuardandoEdicionLote] = useState(false);
  const role = localStorage.getItem("role");
  const canWriteInventory = role === "doctor" || role === "logistica";
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
        });
      } else {
        prev.disponible_efectivo += disponible;
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
      });
    });

    // Enlazar laboratorio y stock mínimo desde variantes
    variantes.forEach((v) => {
      const key = String(v.id);
      const row = map.get(key);
      if (!row) return;
      row.laboratorio = v.laboratorio || "";
      row.stock_minimo_unidades = parseFloat(v.stock_minimo_unidades) || 0;
      row.producto_base_nombre = v.producto_base_nombre || row.producto_base_nombre;
      row.variante_nombre = v.nombre || row.variante_nombre;
      row.unidad_base = v.unidad_base || row.unidad_base;
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

  const ensureVariante = async ({ productoBaseId, nombreVariante, laboratorio }) => {
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
        unidad_base: "U",
        contenido_por_presentacion: 1,
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
      unidad_base: "U",
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
        body: JSON.stringify({ lote: lote || null, cantidad_unidades: cantidad }),
      });
      if (!res.ok) throw new Error();
      await obtenerStockLotes();
      setEditLoteId(null);
      setEditLote("");
      setEditCantidad("");
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

      setFormIngresoSimple({ marca: "", variante: "", laboratorio: "", lote: "", cantidad: "" });
      setPdfIngreso(null);
      setPdfIngresoKey((k) => k + 1);
      setSelectedMarcaId("");
      setSelectedVarianteId("");
      setModoMarca("select");
      setModoVariante("select");
      await Promise.all([obtenerProductosBase(), obtenerVariantes(), obtenerStockLotes()]);
      showToast({ severity: "success", message: "Stock actualizado" });
    } catch (e) {
      console.error(e);
      showToast({ severity: "error", message: "Error al registrar ingreso" });
    } finally {
      setGuardandoIngreso(false);
    }
  };

  return (
    <Box
      sx={{
        display: "flex",
        justifyContent: "center",
        alignItems: "flex-start",
        minHeight: "100vh",
        padding: "40px 10px",
        background:
          "linear-gradient(rgba(255,255,255,0.9), rgba(243,226,200,0.9)), url('/images/background-showclinic.jpg')",
        backgroundSize: "cover",
      }}
    >
      <Paper
        sx={{
          p: 5,
          borderRadius: 4,
          background:
            "linear-gradient(180deg, rgba(255,249,236,0.98) 0%, rgba(255,255,255,0.92) 52%, rgba(247,234,193,0.55) 100%)",
          border: "1px solid rgba(212,175,55,0.22)",
          backdropFilter: "blur(10px)",
          width: "95%",
          maxWidth: 1100,
          boxShadow: "0 18px 46px rgba(0,0,0,0.14), 0 0 0 1px rgba(212,175,55,0.10)",
        }}
      >
        <Typography
          variant="h5"
          sx={{ color: colorPrincipal, fontWeight: "bold", mb: 3 }}
          align="center"
        >
          Inventario Clínico
        </Typography>

        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 2,
            flexWrap: "wrap",
            mb: 2,
          }}
        >
          <TextField
            label="Buscar (marca, variante, laboratorio)"
            value={filtroTexto}
            onChange={(e) => setFiltroTexto(e.target.value)}
            size="small"
            sx={{ minWidth: 280 }}
          />
          <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap", justifyContent: "flex-end" }}>
            <Button
              variant="contained"
              sx={{ backgroundColor: colorPrincipal, fontWeight: "bold" }}
              onClick={exportarPDF}
            >
              Exportar inventario (PDF)
            </Button>
          </Box>
        </Box>

        {(() => {
          const resumen = calcularResumenPorVariante();
          const emergencias = resumen.filter((r) => r.estado === "EMERGENCIA");
          if (emergencias.length === 0) return null;
          return (
            <Box
              sx={{
                mb: 3,
                p: 2,
                borderRadius: 2,
                backgroundColor: "rgba(211,47,47,0.08)",
                border: "1px solid rgba(211,47,47,0.30)",
              }}
            >
              <Typography sx={{ fontWeight: "bold", color: "#b71c1c", mb: 0.5 }}>
                ALERTA DE EMERGENCIA: bajo stock
              </Typography>
              <Typography variant="body2" sx={{ color: "rgba(0,0,0,0.70)" }}>
                Hay productos con stock efectivo menor al mínimo (por defecto <strong>3</strong>).
              </Typography>
            </Box>
          );
        })()}

        <Typography
          variant="h6"
          sx={{ color: colorPrincipal, mt: 2 }}
          align="left"
        >
          Resumen rápido ("Tenemos X unidades")
        </Typography>

        <Table sx={{ mt: 1 }}>
          <TableHead>
            <TableRow>
              <TableCell>Marca</TableCell>
              <TableCell>Variante</TableCell>
              <TableCell>Laboratorio</TableCell>
              <TableCell>Disponible</TableCell>
              <TableCell>Mínimo</TableCell>
              <TableCell>Estado</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {calcularResumenPorVariante().map((r) => (
              <TableRow
                key={r.variante_id}
                sx={
                  r.estado === "EMERGENCIA"
                    ? { backgroundColor: "rgba(211,47,47,0.08)" }
                    : undefined
                }
              >
                <TableCell>{r.producto_base_nombre}</TableCell>
                <TableCell>{r.variante_nombre}</TableCell>
                <TableCell>{r.laboratorio || "—"}</TableCell>
                <TableCell>
                  <strong>
                    {Number(r.disponible_efectivo || 0).toFixed(2)} {r.unidad_base}
                  </strong>
                </TableCell>
                <TableCell>
                  {Number(r.stock_minimo_final || 0).toFixed(2)} {r.unidad_base}
                </TableCell>
                <TableCell>
                  <strong style={{ color: r.estado === "EMERGENCIA" ? "#b71c1c" : "inherit" }}>
                    {r.estado}
                  </strong>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <Box
          sx={{
            mt: 3,
            mb: 2,
            p: 2,
            borderRadius: 3,
            backgroundColor: "rgba(255,255,255,0.78)",
            border: "1px solid rgba(163,105,32,0.16)",
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1.5 }}>
            <InfoIcon sx={{ color: colorPrincipal }} />
            <Typography sx={{ fontWeight: "bold", color: colorPrincipal }}>
              Ingreso rápido (suma stock automáticamente)
            </Typography>
          </Box>

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
              <Grid item xs={12} md={3}>
                <TextField
                  label="Cantidad (unidades)"
                  type="number"
                  fullWidth
                  size="small"
                  value={formIngresoSimple.cantidad}
                  onChange={(e) =>
                    setFormIngresoSimple((p) => ({ ...p, cantidad: e.target.value }))
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
                      borderColor: colorPrincipal,
                      color: colorPrincipal,
                      fontWeight: "bold",
                      backgroundColor: "rgba(255,255,255,0.85)",
                      "&:hover": { backgroundColor: "rgba(255,255,255,0.95)" },
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
                    sx={{ backgroundColor: colorPrincipal, fontWeight: "bold" }}
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

        <Typography
          variant="h6"
          sx={{ color: colorPrincipal, mt: 4 }}
          align="left"
        >
          Lotes registrados
        </Typography>

        <Table sx={{ mt: 1 }}>
          <TableHead>
            <TableRow>
              <TableCell>Marca</TableCell>
              <TableCell>Variante</TableCell>
              <TableCell>Laboratorio</TableCell>
              <TableCell>Número de lote</TableCell>
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
                          value={editCantidad}
                          onChange={(e) => setEditCantidad(e.target.value)}
                        />
                      ) : (
                        Number(l.cantidad_unidades || 0).toFixed(2)
                      )}
                    </TableCell>
                    <TableCell>
                      {l.documento_pdf ? (
                        <Button
                          size="small"
                          variant="outlined"
                          sx={{ borderColor: colorPrincipal, color: colorPrincipal, fontWeight: "bold" }}
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
                              sx={{ backgroundColor: colorPrincipal, fontWeight: "bold" }}
                              onClick={() => editarStockLote(l.id, editLote, editCantidad)}
                            >
                              Guardar
                            </Button>
                            <Button
                              size="small"
                              variant="outlined"
                              sx={{ borderColor: colorPrincipal, color: colorPrincipal, fontWeight: "bold" }}
                              onClick={() => {
                                setEditLoteId(null);
                                setEditLote("");
                                setEditCantidad("");
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
                              sx={{ borderColor: colorPrincipal, color: colorPrincipal, fontWeight: "bold" }}
                              onClick={() => {
                                setEditLoteId(l.id);
                                setEditLote(l.lote || "");
                                setEditCantidad(String(l.cantidad_unidades ?? ""));
                              }}
                            >
                              Editar
                            </Button>
                            <Button
                              size="small"
                              variant="outlined"
                              sx={{ borderColor: "#b71c1c", color: "#b71c1c", fontWeight: "bold" }}
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
  );
}
