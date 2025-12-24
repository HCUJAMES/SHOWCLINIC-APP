import express from "express";
import sqlite3 from "sqlite3";
import bodyParser from "body-parser";
import multer from "multer";
import path from "path";
import fs from "fs";
import jwt from "jsonwebtoken";

import { reservarStockFEFO, consumirStockFEFO } from "../services/inventoryOps.js";

const router = express.Router();
const db = new sqlite3.Database("./db/showclinic.db");
router.use(bodyParser.json());

const SECRET = "showclinic_secret";

const authMiddleware = (req, res, next) => {
  const authHeader = req.headers["authorization"] || req.headers["Authorization"];
  if (!authHeader) {
    return res.status(401).json({ message: "Token no proporcionado" });
  }

  const [, token] = authHeader.split(" ");
  try {
    const decoded = jwt.verify(token, SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    console.error("❌ Token inválido en inventario:", err.message);
    return res.status(401).json({ message: "Token inválido" });
  }
};

const requireInventoryWrite = (req, res, next) => {
  const role = req.user?.role;
  if (role !== "doctor" && role !== "logistica") {
    return res.status(403).json({ message: "No tienes permisos para modificar el inventario" });
  }
  next();
};

router.use(authMiddleware);

// Helpers simples para usar sqlite3 con async/await en las nuevas rutas
const dbAll = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });

const dbRun = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve(this);
    });
  });

/* ==============================================
   📁 CONFIGURAR SUBIDA DE DOCUMENTOS PDF
============================================== */
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = "./uploads/docs";
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});
const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const isPdf =
      file?.mimetype === "application/pdf" ||
      String(file?.originalname || "").toLowerCase().endsWith(".pdf");
    if (!isPdf) {
      req.fileValidationError = "Solo se permite PDF";
      return cb(null, false);
    }
    cb(null, true);
  },
});

/* ==============================================
   🧱 CREAR PRODUCTO
============================================== */
router.post("/crear", requireInventoryWrite, (req, res) => {
  const {
    producto,
    marca,
    sku,
    proveedor,
    contenido,
    precio,
    stock,
    fechaVencimiento,
    actualizado_por,
  } = req.body;

  if (!producto || !marca) {
    return res.status(400).json({ message: "Faltan campos obligatorios" });
  }

  const query = `
    INSERT INTO inventario
      (producto, marca, sku, proveedor, contenido, precio, stock, fechaVencimiento, ultima_actualizacion, actualizado_por)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now', '-5 hours'), ?)
  `;

  db.run(
    query,
    [
      producto,
      marca,
      sku,
      proveedor,
      contenido,
      precio,
      stock,
      fechaVencimiento,
      actualizado_por || "Desconocido",
    ],
    function (err) {
      if (err) {
        console.error("❌ Error al registrar producto:", err.message);
        return res.status(500).json({ message: "Error al registrar producto" });
      }
      res.json({ message: "✅ Producto registrado correctamente" });
    }
  );
});

/* ==============================================
   📋 LISTAR PRODUCTOS
============================================== */
router.get("/listar", (req, res) => {
  db.all("SELECT * FROM inventario ORDER BY id DESC", [], (err, productos) => {
    if (err) {
      console.error("❌ Error al listar productos:", err.message);
      return res.status(500).json({ message: "Error al listar productos" });
    }

    db.all(
      `SELECT inventario_id, archivo, uploaded_at FROM inventario_documentos ORDER BY uploaded_at DESC`,
      [],
      (docsErr, docs) => {
        if (docsErr) {
          console.error("❌ Error al listar documentos:", docsErr.message);
          return res
            .status(500)
            .json({ message: "Error al listar documentos de inventario" });
        }

        const documentosPorProducto = docs.reduce((acc, doc) => {
          if (!acc[doc.inventario_id]) acc[doc.inventario_id] = [];
          acc[doc.inventario_id].push(doc);
          return acc;
        }, {});

        const respuesta = productos.map((p) => ({
          ...p,
          documentos: documentosPorProducto[p.id] || [],
        }));

        res.json(respuesta);
      }
    );
  });
});

/* ==============================================
   ✏️ EDITAR PRODUCTO
============================================== */
router.put("/editar/:id", requireInventoryWrite, (req, res) => {
  const { id } = req.params;
  const {
    producto,
    marca,
    sku,
    proveedor,
    contenido,
    precio,
    stock,
    fechaVencimiento,
    actualizado_por,
  } = req.body;

  const query = `
    UPDATE inventario SET
      producto = ?,
      marca = ?,
      sku = ?,
      proveedor = ?,
      contenido = ?,
      precio = ?,
      stock = ?,
      fechaVencimiento = ?,
      ultima_actualizacion = datetime('now', '-5 hours'),
      actualizado_por = ?
    WHERE id = ?
  `;

  db.run(
    query,
    [
      producto,
      marca,
      sku,
      proveedor,
      contenido,
      precio,
      stock,
      fechaVencimiento,
      actualizado_por || "Desconocido",
      id,
    ],
    function (err) {
      if (err) {
        console.error("❌ Error al editar producto:", err.message);
        return res.status(500).json({ message: "Error al editar producto" });
      }
      res.json({ message: "✅ Producto actualizado correctamente" });
    }
  );
});

/* ==============================================
   📄 SUBIR DOCUMENTO PDF POR PRODUCTO
============================================== */
router.post("/subir-pdf/:id", requireInventoryWrite, upload.single("documento"), (req, res) => {
  const { id } = req.params;
  if (!req.file)
    return res.status(400).json({ message: "No se subió ningún archivo PDF" });

  db.serialize(() => {
    db.run(
      `
        INSERT INTO inventario_documentos (inventario_id, archivo, uploaded_at)
        VALUES (?, ?, datetime('now', '-5 hours'))
      `,
      [id, req.file.filename],
      function (insertErr) {
        if (insertErr) {
          console.error("❌ Error al guardar PDF:", insertErr.message);
          return res.status(500).json({ message: "Error al guardar PDF" });
        }

        db.run(
          `
            UPDATE inventario
            SET documento_pdf = ?, ultima_actualizacion = datetime('now', '-5 hours')
            WHERE id = ?
          `,
          [req.file.filename, id],
          function (updateErr) {
            if (updateErr) {
              console.error("❌ Error al vincular PDF:", updateErr.message);
              return res
                .status(500)
                .json({ message: "Error al vincular PDF con el producto" });
            }

            res.json({
              message: "✅ Documento PDF guardado correctamente",
              archivo: req.file.filename,
            });
          }
        );
      }
    );
  });
});

/* ==============================================
   🗑️ ELIMINAR PRODUCTO
============================================== */
router.delete("/eliminar/:id", requireInventoryWrite, (req, res) => {
  const { id } = req.params;
  db.run("DELETE FROM inventario WHERE id = ?", [id], function (err) {
    if (err) {
      console.error("❌ Error al eliminar producto:", err.message);
      return res.status(500).json({ message: "Error al eliminar producto" });
    }
    res.json({ message: "✅ Producto eliminado correctamente" });
  });
});

/* ==============================================
   🧱 PRODUCTOS BASE (marca / familia)
============================================== */

router.get("/productos-base", async (req, res) => {
  try {
    const filas = await dbAll(
      `SELECT id, nombre, categoria, descripcion FROM productos_base ORDER BY nombre ASC`
    );
    res.json(filas);
  } catch (err) {
    console.error("❌ Error al listar productos_base:", err.message);
    res.status(500).json({ message: "Error al listar productos base" });
  }
});

/* ==============================================
   ✏️ EDITAR / 🗑️ ELIMINAR STOCK POR LOTE
   - Mantiene UI simple para correcciones
============================================== */

router.put("/stock-lotes/:id", requireInventoryWrite, async (req, res) => {
  const { id } = req.params;
  const { lote, cantidad_unidades } = req.body;

  const cantidad = parseFloat(cantidad_unidades);
  if (isNaN(cantidad) || cantidad < 0) {
    return res.status(400).json({ message: "cantidad_unidades inválida" });
  }

  try {
    await dbRun(
      `
        UPDATE stock_lotes
        SET lote = ?,
            cantidad_unidades = ?,
            actualizado_en = datetime('now', '-5 hours')
        WHERE id = ?
      `,
      [lote || null, cantidad, id]
    );

    res.json({ message: "✅ Lote actualizado" });
  } catch (err) {
    console.error("❌ Error al editar stock_lote:", err.message);
    res.status(500).json({ message: "Error al editar lote de stock" });
  }
});

router.delete("/stock-lotes/:id", requireInventoryWrite, async (req, res) => {
  const { id } = req.params;
  try {
    await dbRun(`DELETE FROM stock_lotes WHERE id = ?`, [id]);
    res.json({ message: "✅ Lote eliminado" });
  } catch (err) {
    console.error("❌ Error al eliminar stock_lote:", err.message);
    res.status(500).json({ message: "Error al eliminar lote de stock" });
  }
});

router.post("/productos-base", requireInventoryWrite, async (req, res) => {
  const { nombre, categoria, descripcion } = req.body;
  if (!nombre) {
    return res.status(400).json({ message: "El nombre es obligatorio" });
  }

  try {
    const result = await dbRun(
      `INSERT INTO productos_base (nombre, categoria, descripcion) VALUES (?, ?, ?)` ,
      [nombre, categoria || null, descripcion || null]
    );
    res.json({ id: result.lastID, nombre, categoria, descripcion });
  } catch (err) {
    console.error("❌ Error al crear producto_base:", err.message);
    res.status(500).json({ message: "Error al crear producto base" });
  }
});

/* ==============================================
   🧱 VARIANTES (SKU con unidad y contenido)
============================================== */

router.get("/variantes", async (req, res) => {
  try {
    const filas = await dbAll(
      `
        SELECT v.*, pb.nombre AS producto_base_nombre
        FROM variantes v
        LEFT JOIN productos_base pb ON pb.id = v.producto_base_id
        ORDER BY pb.nombre ASC, v.nombre ASC
      `
    );
    res.json(filas);
  } catch (err) {
    console.error("❌ Error al listar variantes:", err.message);
    res.status(500).json({ message: "Error al listar variantes" });
  }
});

router.get("/variantes/producto-base/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const filas = await dbAll(
      `
        SELECT v.*, pb.nombre AS producto_base_nombre
        FROM variantes v
        LEFT JOIN productos_base pb ON pb.id = v.producto_base_id
        WHERE v.producto_base_id = ?
        ORDER BY v.nombre ASC
      `,
      [id]
    );
    res.json(filas);
  } catch (err) {
    console.error("❌ Error al listar variantes por producto_base:", err.message);
    res.status(500).json({ message: "Error al listar variantes del producto" });
  }
});

router.post("/variantes", requireInventoryWrite, async (req, res) => {
  const {
    producto_base_id,
    nombre,
    laboratorio,
    sku,
    unidad_base,
    contenido_por_presentacion,
    es_medico,
    costo_unitario,
    precio_unitario,
    stock_minimo_unidades,
  } = req.body;

  if (!producto_base_id || !nombre || !unidad_base || !contenido_por_presentacion) {
    return res.status(400).json({ message: "producto_base_id, nombre, unidad_base y contenido_por_presentacion son obligatorios" });
  }

  try {
    const result = await dbRun(
      `
        INSERT INTO variantes
        (producto_base_id, nombre, laboratorio, sku, unidad_base, contenido_por_presentacion, es_medico, costo_unitario, precio_unitario, stock_minimo_unidades)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        producto_base_id,
        nombre,
        laboratorio || null,
        sku || null,
        unidad_base,
        parseFloat(contenido_por_presentacion),
        es_medico ? 1 : 0,
        costo_unitario != null ? parseFloat(costo_unitario) : null,
        precio_unitario != null ? parseFloat(precio_unitario) : null,
        stock_minimo_unidades != null ? parseFloat(stock_minimo_unidades) : 0,
      ]
    );

    res.json({ id: result.lastID, nombre });
  } catch (err) {
    console.error("❌ Error al crear variante:", err.message);
    res.status(500).json({ message: "Error al crear variante" });
  }
});

/* ==============================================
   📦 STOCK POR LOTE (FEFO)
============================================== */

router.get("/stock-lotes", async (req, res) => {
  try {
    const filas = await dbAll(
      `
        SELECT sl.*, v.nombre AS variante_nombre, v.unidad_base, pb.nombre AS producto_base_nombre
        FROM stock_lotes sl
        LEFT JOIN variantes v ON v.id = sl.variante_id
        LEFT JOIN productos_base pb ON pb.id = v.producto_base_id
        ORDER BY (sl.fecha_vencimiento IS NULL) ASC, sl.fecha_vencimiento ASC, sl.id ASC
      `
    );
    res.json(filas);
  } catch (err) {
    console.error("❌ Error al listar stock_lotes:", err.message);
    res.status(500).json({ message: "Error al listar stock por lote" });
  }
});

router.get("/stock-lotes/variante/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const filas = await dbAll(
      `
        SELECT sl.*, v.nombre AS variante_nombre, v.unidad_base, pb.nombre AS producto_base_nombre
        FROM stock_lotes sl
        LEFT JOIN variantes v ON v.id = sl.variante_id
        LEFT JOIN productos_base pb ON pb.id = v.producto_base_id
        WHERE sl.variante_id = ?
        ORDER BY (sl.fecha_vencimiento IS NULL) ASC, sl.fecha_vencimiento ASC, sl.id ASC
      `,
      [id]
    );
    res.json(filas);
  } catch (err) {
    console.error("❌ Error al listar stock_lotes por variante:", err.message);
    res.status(500).json({ message: "Error al listar stock por variante" });
  }
});

router.post("/stock-lotes", requireInventoryWrite, async (req, res) => {
  const { variante_id, lote, fecha_vencimiento, ubicacion, cantidad_unidades } = req.body;

  if (!variante_id || cantidad_unidades == null) {
    return res.status(400).json({ message: "variante_id y cantidad_unidades son obligatorios" });
  }

  try {
    const result = await dbRun(
      `
        INSERT INTO stock_lotes
        (variante_id, lote, fecha_vencimiento, ubicacion, cantidad_unidades, creado_en)
        VALUES (?, ?, ?, ?, ?, datetime('now', '-5 hours'))
      `,
      [
        variante_id,
        lote || null,
        fecha_vencimiento || null,
        ubicacion || null,
        parseFloat(cantidad_unidades),
      ]
    );

    res.json({ id: result.lastID });
  } catch (err) {
    console.error("❌ Error al crear stock_lote:", err.message);
    res.status(500).json({ message: "Error al crear lote de stock" });
  }
});

/* ==============================================
   📥 INGRESO DE PRODUCTOS (ENTRADAS DE STOCK)
   - Registra movimientos_inventario tipo 'entrada'
   - Crea o actualiza stock_lotes y detalle por cada línea
============================================== */

router.post("/ingreso", requireInventoryWrite, upload.single("pdf"), async (req, res) => {
  // Soporta JSON (application/json) y multipart/form-data (con PDF opcional)
  const proveedor = req.body?.proveedor ?? null;
  const documento = req.body?.documento ?? null;
  const observacion = req.body?.observacion ?? null;
  const lineasRaw = req.body?.lineas;
  if (req.fileValidationError) {
    return res.status(400).json({ message: req.fileValidationError });
  }
  const lineas = Array.isArray(lineasRaw)
    ? lineasRaw
    : typeof lineasRaw === "string"
      ? JSON.parse(lineasRaw)
      : [];

  if (!Array.isArray(lineas) || lineas.length === 0) {
    return res.status(400).json({ message: "Debe enviar al menos una línea de producto" });
  }

  try {
    // Crear cabecera de movimiento de inventario (entrada)
    const usuario = req.user?.username || req.user?.role || "desconocido";

    const movimiento = await dbRun(
      `
        INSERT INTO movimientos_inventario
        (tipo, motivo, fecha, referencia_tipo, referencia_id, usuario)
        VALUES ('entrada', ?, datetime('now', '-5 hours'), ?, ?, ?)
      `,
      [
        observacion || "ingreso_manual",
        documento ? "compra_documento" : "compra_manual",
        null,
        usuario,
      ]
    );

    const movimientoId = movimiento.lastID;

    // Procesar cada línea: crear/actualizar lote y registrar detalle
    const pdfFilename = req.file?.filename || null;

    for (const linea of lineas) {
      const {
        variante_id,
        lote,
        fecha_vencimiento,
        ubicacion,
        cantidad_unidades,
        cantidad_presentaciones,
        condicion_almacenamiento,
        costo_unitario,
      } = linea;

      if (!variante_id || (cantidad_unidades == null && cantidad_presentaciones == null)) {
        continue; // saltar líneas inválidas sin cortar todo el ingreso
      }

      let cantidad = cantidad_unidades != null ? parseFloat(cantidad_unidades) : NaN;

      if ((isNaN(cantidad) || cantidad <= 0) && cantidad_presentaciones != null) {
        const pres = parseFloat(cantidad_presentaciones);
        if (!isNaN(pres) && pres > 0) {
          const vars = await dbAll(
            `SELECT contenido_por_presentacion FROM variantes WHERE id = ?`,
            [variante_id]
          );
          const contenido = parseFloat(vars[0]?.contenido_por_presentacion);
          if (!isNaN(contenido) && contenido > 0) {
            cantidad = pres * contenido;
          }
        }
      }

      if (isNaN(cantidad) || cantidad <= 0) {
        continue;
      }

      // Buscar si ya existe un lote con misma clave (variante + lote + vencimiento + ubicación + condición)
      const existentes = await dbAll(
        `
          SELECT * FROM stock_lotes
          WHERE variante_id = ?
            AND (lote IS ? OR lote = ?)
            AND (fecha_vencimiento IS ? OR fecha_vencimiento = ?)
            AND (ubicacion IS ? OR ubicacion = ?)
            AND (condicion_almacenamiento IS ? OR condicion_almacenamiento = ?)
        `,
        [
          variante_id,
          lote || null,
          lote || null,
          fecha_vencimiento || null,
          fecha_vencimiento || null,
          ubicacion || null,
          ubicacion || null,
          condicion_almacenamiento || null,
          condicion_almacenamiento || null,
        ]
      );

      let stockLoteId;

      if (existentes.length > 0) {
        // Actualizar lote existente sumando cantidad
        const loteExistente = existentes[0];

        if (pdfFilename) {
          await dbRun(
            `
              UPDATE stock_lotes
              SET cantidad_unidades = cantidad_unidades + ?,
                  documento_pdf = ?,
                  actualizado_en = datetime('now', '-5 hours')
              WHERE id = ?
            `,
            [cantidad, pdfFilename, loteExistente.id]
          );
        } else {
          await dbRun(
            `
              UPDATE stock_lotes
              SET cantidad_unidades = cantidad_unidades + ?, actualizado_en = datetime('now', '-5 hours')
              WHERE id = ?
            `,
            [cantidad, loteExistente.id]
          );
        }

        stockLoteId = loteExistente.id;
      } else {
        // Crear nuevo lote
        const nuevoLote = await dbRun(
          `
            INSERT INTO stock_lotes
            (variante_id, lote, fecha_vencimiento, ubicacion, condicion_almacenamiento, cantidad_unidades, documento_pdf, creado_en)
            VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now', '-5 hours'))
          `,
          [
            variante_id,
            lote || null,
            fecha_vencimiento || null,
            ubicacion || null,
            condicion_almacenamiento || null,
            cantidad,
            pdfFilename,
          ]
        );
        stockLoteId = nuevoLote.lastID;
      }

      // Registrar detalle del movimiento
      await dbRun(
        `
          INSERT INTO movimientos_detalle
          (movimiento_id, variante_id, stock_lote_id, cantidad_unidades, costo_unitario)
          VALUES (?, ?, ?, ?, ?)
        `,
        [
          movimientoId,
          variante_id,
          stockLoteId,
          cantidad,
          costo_unitario != null ? parseFloat(costo_unitario) : null,
        ]
      );
    }

    res.json({ message: "✅ Ingreso de productos registrado correctamente", movimiento_id: movimientoId });
  } catch (err) {
    const msg = String(err?.message || "");
    if (msg.includes("Solo se permite PDF")) {
      return res.status(400).json({ message: "Solo se permite PDF" });
    }
    console.error("❌ Error al registrar ingreso de inventario:", err.message);
    res.status(500).json({ message: "Error al registrar ingreso de inventario" });
  }
});

/* ==============================================
   🧾 RESERVA SUAVE (OPCIONAL)
   - Reduce el disponible efectivo sin descontar el saldo real
   - Usa FEFO por defecto y soporta split multi-lote
============================================== */

router.post("/reservar", requireInventoryWrite, async (req, res) => {
  const {
    paciente_id,
    tratamiento_realizado_id,
    variante_id,
    cantidad_unidades,
    usuario,
  } = req.body;

  if (!variante_id || cantidad_unidades == null) {
    return res.status(400).json({ message: "variante_id y cantidad_unidades son obligatorios" });
  }

  const cantidad = parseFloat(cantidad_unidades);
  if (isNaN(cantidad) || cantidad <= 0) {
    return res.status(400).json({ message: "cantidad_unidades inválida" });
  }

  try {
    const mov = await dbRun(
      `
        INSERT INTO movimientos_inventario
        (tipo, motivo, fecha, referencia_tipo, referencia_id, usuario)
        VALUES ('reserva', 'reserva_suave', datetime('now', '-5 hours'), 'tratamientos_realizados', ?, ?)
      `,
      [tratamiento_realizado_id || null, usuario || req.user?.username || req.user?.role || "desconocido"]
    );

    const result = await reservarStockFEFO({
      dbAll,
      dbRun,
      movimientoId: mov.lastID,
      varianteId: variante_id,
      cantidad,
    });

    if (!result.ok) {
      return res.status(result.status).json({ message: result.message });
    }

    res.json({
      message: result.message,
      movimiento_id: mov.lastID,
      paciente_id: paciente_id || null,
      detalles: result.detalles.map((d) => ({
        stock_lote_id: d.stock_lote_id,
        cantidad_reservada: d.cantidad,
      })),
    });
  } catch (err) {
    console.error("Error al reservar stock:", err.message);
    res.status(500).json({ message: "Error al reservar stock" });
  }
});

/* ==============================================
   💉 CONSUMO (FEFO + SPLIT MULTI-LOTE)
   - Si viene stock_lote_id: consume de ese lote
   - Si no viene: FEFO automático
   - Libera reserva si existe (consume primero reserva del lote)
============================================== */

router.post("/consumir", requireInventoryWrite, async (req, res) => {
  const {
    paciente_id,
    tratamiento_realizado_id,
    variante_id,
    cantidad_unidades,
    stock_lote_id,
    usuario,
  } = req.body;

  if (!variante_id || cantidad_unidades == null) {
    return res.status(400).json({ message: "variante_id y cantidad_unidades son obligatorios" });
  }

  const cantidad = parseFloat(cantidad_unidades);
  if (isNaN(cantidad) || cantidad <= 0) {
    return res.status(400).json({ message: "cantidad_unidades inválida" });
  }

  try {
    const usuarioFinal = usuario || req.user?.username || req.user?.role || "desconocido";

    const mov = await dbRun(
      `
        INSERT INTO movimientos_inventario
        (tipo, motivo, fecha, referencia_tipo, referencia_id, usuario)
        VALUES ('salida', 'consumo_tratamiento', datetime('now', '-5 hours'), 'tratamientos_realizados', ?, ?)
      `,
      [tratamiento_realizado_id || null, usuarioFinal]
    );

    const result = await consumirStockFEFO({
      dbAll,
      dbRun,
      movimientoId: mov.lastID,
      varianteId: variante_id,
      cantidad,
      stockLoteId: stock_lote_id || null,
    });

    if (!result.ok) {
      return res.status(result.status).json({ message: result.message });
    }

    res.json({
      message: result.message,
      movimiento_id: mov.lastID,
      paciente_id: paciente_id || null,
      detalles: result.detalles.map((d) => ({
        stock_lote_id: d.stock_lote_id,
        cantidad_usada: d.cantidad,
      })),
    });
  } catch (err) {
    console.error("Error al consumir stock:", err.message);
    res.status(500).json({ message: "Error al consumir stock" });
  }
});

export default router;

