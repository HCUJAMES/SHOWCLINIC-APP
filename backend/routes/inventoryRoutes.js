import express from "express";
import sqlite3 from "sqlite3";
import bodyParser from "body-parser";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbDir = path.join(__dirname, "../db");
const dbPath = path.join(dbDir, "showclinic.db");
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

const db = new sqlite3.Database(dbPath);
router.use(bodyParser.json());

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
const upload = multer({ storage });

/* ==============================================
   🧱 CREAR PRODUCTO
============================================== */
router.post("/crear", (req, res) => {
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
router.put("/editar/:id", (req, res) => {
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
router.post("/subir-pdf/:id", upload.single("documento"), (req, res) => {
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
router.delete("/eliminar/:id", (req, res) => {
  const { id } = req.params;
  db.run("DELETE FROM inventario WHERE id = ?", [id], function (err) {
    if (err) {
      console.error("❌ Error al eliminar producto:", err.message);
      return res.status(500).json({ message: "Error al eliminar producto" });
    }
    res.json({ message: "✅ Producto eliminado correctamente" });
  });
});

export default router;
