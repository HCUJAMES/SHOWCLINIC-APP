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

/* ==============================
   📁 CONFIGURAR SUBIDA DE FOTOS
============================== */
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = "./uploads";
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});
const upload = multer({ storage });

/* ==============================
   💊 CRUD TRATAMIENTOS BASE
============================== */

// ✅ Crear tratamiento
router.post("/crear", (req, res) => {
  const { nombre, descripcion } = req.body;
  if (!nombre || !descripcion) {
    return res.status(400).json({ message: "Faltan datos" });
  }

  db.run(
    `INSERT INTO tratamientos (nombre, descripcion) VALUES (?, ?)`,
    [nombre, descripcion],
    function (err) {
      if (err)
        return res.status(500).json({ message: "Error al crear tratamiento" });
      res.json({ id: this.lastID, nombre, descripcion });
    }
  );
});

// ✅ Listar tratamientos
router.get("/listar", (req, res) => {
  db.all("SELECT * FROM tratamientos ORDER BY id DESC", [], (err, rows) => {
    if (err)
      return res.status(500).json({ message: "Error al listar tratamientos" });
    res.json(rows);
  });
});

/* ==============================
   📦 PRODUCTOS Y MARCAS
============================== */

router.get("/productos", (req, res) => {
  db.all("SELECT * FROM inventario ORDER BY producto ASC", [], (err, rows) => {
    if (err)
      return res.status(500).json({ message: "Error al obtener productos" });
    res.json(rows);
  });
});

router.get("/marcas", (req, res) => {
  db.all(
    "SELECT DISTINCT marca FROM inventario WHERE marca IS NOT NULL AND marca != '' ORDER BY marca ASC",
    [],
    (err, rows) => {
      if (err)
        return res.status(500).json({ message: "Error al obtener marcas" });
      res.json(rows);
    }
  );
});

/* ==============================
   💉 REGISTRO DE TRATAMIENTOS REALIZADOS
============================== */

router.post("/realizado", upload.array("fotos", 6), (req, res) => {
  try {
    const { paciente_id, productos, pagoMetodo, sesion, especialista, tipoAtencion } = req.body;
    const productosData = JSON.parse(productos);

    if (!productosData || productosData.length === 0)
      return res.status(400).json({ message: "No se enviaron tratamientos" });

    const fechaLocal = new Date()
      .toLocaleString("sv-SE")
      .replace("T", " ")
      .slice(0, 19);

    // 🔁 Procesar cada tratamiento
    productosData.forEach((b) => {
      const subtotal = b.precio * b.cantidad;
      const descuentoAplicado = (b.descuento / 100) * subtotal;
      const totalFinal = subtotal - descuentoAplicado;

      db.run(
        `
        INSERT INTO tratamientos_realizados 
        (paciente_id, tratamiento_id, productos, cantidad_total, precio_total, descuento, pagoMetodo, especialista, sesion, tipoAtencion, fecha)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
        [
          paciente_id,
          b.tratamiento_id || null,
          JSON.stringify([{ producto: b.producto, cantidad: b.cantidad, precio: b.precio }]),
          b.cantidad,
          totalFinal,
          b.descuento || 0,
          pagoMetodo,
          especialista || "No especificado",
          sesion || 1,
          tipoAtencion || "Tratamiento",
          fechaLocal,
        ],
        function (err) {
          if (err) {
            console.error("❌ Error al registrar:", err.message);
          } else {
            console.log(`✅ Tratamiento registrado correctamente (ID ${this.lastID})`);
          }
        }
      );

      // 🔻 Actualizar stock
      db.run(
        `UPDATE inventario SET stock = stock - ? WHERE producto = ?`,
        [b.cantidad, b.producto],
        (err) => {
          if (err) console.error(`Error al actualizar stock de ${b.producto}`);
        }
      );
    });

    res.json({ message: "✅ Tratamientos registrados correctamente" });
  } catch (error) {
    console.error("Error general:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
});

/* ==============================
   📸 SUBIR FOTOS DEL TRATAMIENTO
============================== */

router.post(
  "/subir-fotos/:id",
  upload.fields([
    { name: "fotosAntes", maxCount: 3 },
    { name: "fotosDespues", maxCount: 3 },
    // Compatibilidad con el formato anterior (un solo array "fotos")
    { name: "fotos", maxCount: 6 },
  ]),
  (req, res) => {
    const { id } = req.params;
    const archivosAntes = req.files?.fotosAntes || [];
    const archivosDespues = req.files?.fotosDespues || [];

    // Soportar cargas antiguas en un único campo "fotos"
    const archivosLegacy = req.files?.fotos || [];
    if (!archivosAntes.length && !archivosDespues.length && archivosLegacy.length) {
      archivosAntes.push(...archivosLegacy.slice(0, 3));
      archivosDespues.push(...archivosLegacy.slice(3, 6));
    }

    if (!archivosAntes.length && !archivosDespues.length) {
      return res.status(400).json({ message: "No se han subido imágenes" });
    }

    const camposAntes = ["foto_antes1", "foto_antes2", "foto_antes3"];
    const camposDespues = ["foto_despues1", "foto_despues2", "foto_despues3"];

    const fotosAntes = camposAntes.map((_, idx) => archivosAntes[idx]?.filename || null);
    const fotosDespues = camposDespues.map((_, idx) => archivosDespues[idx]?.filename || null);

    db.run(
      `UPDATE tratamientos_realizados
       SET foto_antes1 = ?, foto_antes2 = ?, foto_antes3 = ?,
           foto_despues1 = ?, foto_despues2 = ?, foto_despues3 = ?
       WHERE id = ?`,
      [...fotosAntes, ...fotosDespues, id],
      function (err) {
        if (err) {
          console.error("❌ Error al guardar fotos:", err.message);
          return res.status(500).json({ message: "Error al guardar fotos" });
        }
        res.json({ message: "✅ Fotos guardadas correctamente" });
      }
    );
  }
);

/* ==============================
   📋 HISTORIAL CLÍNICO
============================== */

router.get("/historial/:paciente_id", (req, res) => {
  const { paciente_id } = req.params;
  db.all(
    `
    SELECT tr.*, t.nombre AS nombreTratamiento
    FROM tratamientos_realizados tr
    LEFT JOIN tratamientos t ON t.id = tr.tratamiento_id
    WHERE tr.paciente_id = ?
    ORDER BY tr.fecha DESC
  `,
    [paciente_id],
    (err, rows) => {
      if (err)
        return res
          .status(500)
          .json({ message: "Error al obtener historial clínico" });
      res.json(rows);
    }
  );
});

export default router;
