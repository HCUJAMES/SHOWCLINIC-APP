import express from "express";
import bwipjs from "bwip-js";
import { promisify } from "util";
import sqlite3 from "sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import { authMiddleware } from "../middleware/auth.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();
router.use(authMiddleware);

const db = new sqlite3.Database("./db/showclinic.db");
const dbAll = promisify(db.all.bind(db));
const dbRun = promisify(db.run.bind(db));
const dbGet = promisify(db.get.bind(db));

const requireBarcodeAccess = (req, res, next) => {
  const role = req.user?.role;
  if (role === "master" || role === "doctor" || role === "admin" || role === "asistente") {
    return next();
  }
  return res.status(403).json({ message: "Acceso denegado al módulo de códigos de barras" });
};

const inferirTipoProducto = (marca, variante) => {
  const texto = `${marca || ""} ${variante || ""}`.toLowerCase();
  if (texto.includes("botox") || texto.includes("toxina") || texto.includes("dysport") || texto.includes("xeomin")) return "1";
  if (texto.includes("filler") || texto.includes("relleno") || texto.includes("juvederm") || texto.includes("restylane")) return "2";
  if (texto.includes("bioestimulante") || texto.includes("radiesse") || texto.includes("sculptra") || texto.includes("profhilo")) return "3";
  if (texto.includes("enzima") || texto.includes("lipolytic")) return "4";
  if (texto.includes("skincare") || texto.includes("skin") || texto.includes("peeling")) return "5";
  return "9";
};

const generarCodigoBarras = (tipo, loteId, fechaVencimiento, correlativo) => {
  const year = fechaVencimiento ? new Date(fechaVencimiento).getFullYear().toString().slice(-2) : "99";
  const week = fechaVencimiento ? getWeekNumber(new Date(fechaVencimiento)).toString().padStart(2, "0") : "99";
  const loteStr = loteId.toString().padStart(3, "0").slice(-3);
  const corrStr = correlativo.toString().padStart(4, "0");
  return `SC${tipo}${loteStr}${year}${week}${corrStr}`;
};

const getWeekNumber = (date) => {
  const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
  const pastDaysOfYear = (date - firstDayOfYear) / 86400000;
  return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
};

const generarImagenBarcode = async (codigo) => {
  try {
    const png = await bwipjs.toBuffer({
      bcid: "code128",
      text: codigo,
      scale: 2,
      height: 10,
      includetext: false,
      paddingwidth: 0,
      paddingheight: 0,
    });
    return png.toString("base64");
  } catch (err) {
    console.error("Error generando barcode:", err);
    throw err;
  }
};

router.get("/lotes", requireBarcodeAccess, async (req, res) => {
  try {
    const lotes = await dbAll(`
      SELECT 
        sl.id,
        sl.lote,
        sl.fecha_vencimiento,
        sl.cajas,
        sl.jeringas,
        sl.cantidad_unidades,
        v.nombre AS variante_nombre,
        pb.nombre AS marca,
        (SELECT COUNT(*) FROM barcode_units WHERE lote_id = sl.id) AS stickers_generados
      FROM stock_lotes sl
      LEFT JOIN variantes v ON v.id = sl.variante_id
      LEFT JOIN productos_base pb ON pb.id = v.producto_base_id
      WHERE sl.cantidad_unidades > 0
      ORDER BY sl.creado_en DESC
    `);
    res.json(lotes);
  } catch (err) {
    console.error("Error listando lotes:", err.message);
    res.status(500).json({ message: "Error al listar lotes" });
  }
});

router.post("/lotes/:loteId/generate", requireBarcodeAccess, async (req, res) => {
  const { loteId } = req.params;
  const { quantity, unit_type } = req.body;

  if (!quantity || quantity <= 0) {
    return res.status(400).json({ message: "Cantidad inválida" });
  }
  if (!["caja", "jeringa", "frasco"].includes(unit_type)) {
    return res.status(400).json({ message: "Tipo de unidad inválido" });
  }

  try {
    const lote = await dbGet(`
      SELECT 
        sl.*,
        v.nombre AS variante_nombre,
        pb.nombre AS marca
      FROM stock_lotes sl
      LEFT JOIN variantes v ON v.id = sl.variante_id
      LEFT JOIN productos_base pb ON pb.id = v.producto_base_id
      WHERE sl.id = ?
    `, [loteId]);

    if (!lote) {
      return res.status(404).json({ message: "Lote no encontrado" });
    }

    const tipo = inferirTipoProducto(lote.marca, lote.variante_nombre);
    
    const maxIndex = await dbGet(
      `SELECT COALESCE(MAX(unit_index), 0) AS max_idx FROM barcode_units WHERE lote_id = ?`,
      [loteId]
    );
    let correlativo = (maxIndex?.max_idx || 0) + 1;

    const barcodes = [];
    for (let i = 0; i < quantity; i++) {
      const codigo = generarCodigoBarras(tipo, loteId, lote.fecha_vencimiento, correlativo);
      await dbRun(
        `INSERT INTO barcode_units (lote_id, barcode, unit_type, unit_index, status) VALUES (?, ?, ?, ?, 'active')`,
        [loteId, codigo, unit_type, correlativo]
      );
      barcodes.push({ barcode: codigo, unit_index: correlativo });
      correlativo++;
    }

    res.json({ 
      message: `${quantity} códigos generados exitosamente`,
      barcodes 
    });
  } catch (err) {
    console.error("Error generando códigos:", err.message);
    res.status(500).json({ message: "Error al generar códigos de barras" });
  }
});

router.get("/lotes/:loteId", requireBarcodeAccess, async (req, res) => {
  const { loteId } = req.params;
  try {
    const barcodes = await dbAll(`
      SELECT 
        bu.*,
        sl.lote,
        v.nombre AS variante_nombre,
        pb.nombre AS marca
      FROM barcode_units bu
      LEFT JOIN stock_lotes sl ON sl.id = bu.lote_id
      LEFT JOIN variantes v ON v.id = sl.variante_id
      LEFT JOIN productos_base pb ON pb.id = v.producto_base_id
      WHERE bu.lote_id = ?
      ORDER BY bu.unit_index ASC
    `, [loteId]);
    res.json(barcodes);
  } catch (err) {
    console.error("Error listando barcodes del lote:", err.message);
    res.status(500).json({ message: "Error al listar códigos del lote" });
  }
});

router.post("/print-batch", requireBarcodeAccess, async (req, res) => {
  const { barcode_ids } = req.body;

  if (!Array.isArray(barcode_ids) || barcode_ids.length === 0) {
    return res.status(400).json({ message: "IDs de códigos inválidos" });
  }

  try {
    const placeholders = barcode_ids.map(() => "?").join(",");
    const barcodes = await dbAll(`
      SELECT 
        bu.*,
        sl.lote,
        sl.fecha_vencimiento,
        v.nombre AS variante_nombre,
        pb.nombre AS marca
      FROM barcode_units bu
      LEFT JOIN stock_lotes sl ON sl.id = bu.lote_id
      LEFT JOIN variantes v ON v.id = sl.variante_id
      LEFT JOIN productos_base pb ON pb.id = v.producto_base_id
      WHERE bu.id IN (${placeholders})
      ORDER BY bu.unit_index ASC
    `, barcode_ids);

    const stickersData = await Promise.all(
      barcodes.map(async (bc) => {
        const imagenBase64 = await generarImagenBarcode(bc.barcode);
        return {
          id: bc.id,
          barcode: bc.barcode,
          marca: bc.marca || "SHOWCLINIC",
          variante: bc.variante_nombre || "Producto",
          lote: bc.lote || "N/A",
          vencimiento: bc.fecha_vencimiento || null,
          unit_type: bc.unit_type,
          imagen_base64: imagenBase64,
        };
      })
    );

    res.json({ stickers: stickersData });
  } catch (err) {
    console.error("Error preparando impresión:", err.message);
    res.status(500).json({ message: "Error al preparar impresión" });
  }
});

// Obtener el siguiente correlativo para un prefijo de código
router.get("/next-correlativo", requireBarcodeAccess, async (req, res) => {
  const { prefix } = req.query;
  if (!prefix || prefix.length < 2) {
    return res.status(400).json({ message: "Prefijo inválido" });
  }
  try {
    const row = await dbGet(
      `SELECT COALESCE(MAX(CAST(SUBSTR(barcode, LENGTH(?) + 1) AS INTEGER)), 0) AS max_corr
       FROM barcode_units
       WHERE barcode LIKE ? || '%'`,
      [prefix, prefix]
    );
    const next = (row?.max_corr || 0) + 1;
    res.json({ next, prefix, codigo: `${prefix}${next.toString().padStart(4, "0")}` });
  } catch (err) {
    console.error("Error obteniendo correlativo:", err.message);
    res.status(500).json({ message: "Error al obtener correlativo" });
  }
});

// Registrar múltiples códigos con prefijo secuencial (usado al registrar lote desde Inventario)
router.post("/register-batch", requireBarcodeAccess, async (req, res) => {
  const { prefix, quantity, lote_id } = req.body;
  if (!prefix || prefix.length < 2 || !quantity || quantity <= 0) {
    return res.status(400).json({ message: "Prefijo y cantidad son obligatorios" });
  }
  try {
    const row = await dbGet(
      `SELECT COALESCE(MAX(CAST(SUBSTR(barcode, LENGTH(?) + 1) AS INTEGER)), 0) AS max_corr
       FROM barcode_units
       WHERE barcode LIKE ? || '%'`,
      [prefix, prefix]
    );
    let correlativo = (row?.max_corr || 0) + 1;
    const codes = [];
    for (let i = 0; i < quantity; i++) {
      const codigo = `${prefix}${correlativo.toString().padStart(4, "0")}`;
      await dbRun(
        `INSERT INTO barcode_units (lote_id, barcode, unit_type, unit_index, status) VALUES (?, ?, 'caja', ?, 'active')`,
        [lote_id || null, codigo, correlativo]
      );
      codes.push(codigo);
      correlativo++;
    }
    res.json({ codes, prefix, start: correlativo - quantity, end: correlativo - 1 });
  } catch (err) {
    console.error("Error registrando batch de códigos:", err.message);
    res.status(500).json({ message: "Error al registrar códigos" });
  }
});

router.post("/scan", requireBarcodeAccess, async (req, res) => {
  const { barcode } = req.body;

  if (!barcode) {
    return res.status(400).json({ message: "Código de barras requerido" });
  }

  try {
    const bc = await dbGet(`
      SELECT 
        bu.*,
        sl.lote,
        sl.fecha_vencimiento,
        sl.cantidad_unidades,
        sl.variante_id,
        v.nombre AS variante_nombre,
        v.unidad_base,
        pb.nombre AS marca
      FROM barcode_units bu
      LEFT JOIN stock_lotes sl ON sl.id = bu.lote_id
      LEFT JOIN variantes v ON v.id = sl.variante_id
      LEFT JOIN productos_base pb ON pb.id = v.producto_base_id
      WHERE bu.barcode = ?
    `, [barcode]);

    if (!bc) {
      return res.status(404).json({ message: "Código de barras no encontrado" });
    }

    res.json({
      valid: true,
      barcode_info: bc,
      message: bc.status === "scanned" ? "Este código ya fue escaneado anteriormente" : "Código válido",
    });
  } catch (err) {
    console.error("Error escaneando código:", err.message);
    res.status(500).json({ message: "Error al escanear código" });
  }
});

// Obtener códigos de barras disponibles para una variante específica
router.get("/variant/:varianteId/codes", requireBarcodeAccess, async (req, res) => {
  const { varianteId } = req.params;

  if (!varianteId) {
    return res.status(400).json({ message: "ID de variante requerido" });
  }

  try {
    const codes = await dbAll(`
      SELECT 
        bu.id,
        bu.barcode,
        bu.status,
        bu.unit_type,
        bu.unit_index,
        sl.lote,
        sl.fecha_vencimiento,
        sl.cantidad_unidades
      FROM barcode_units bu
      LEFT JOIN stock_lotes sl ON sl.id = bu.lote_id
      WHERE sl.variante_id = ?
      ORDER BY bu.status DESC, bu.unit_index ASC
    `, [varianteId]);

    // Agrupar por estado
    const activos = codes.filter(c => c.status === 'active');
    const usados = codes.filter(c => c.status === 'scanned');

    res.json({
      variante_id: varianteId,
      total_codes: codes.length,
      activos: activos.length,
      usados: usados.length,
      codes: codes
    });
  } catch (err) {
    console.error("Error obteniendo códigos de variante:", err.message);
    res.status(500).json({ message: "Error al obtener códigos de barras" });
  }
});

export default router;
