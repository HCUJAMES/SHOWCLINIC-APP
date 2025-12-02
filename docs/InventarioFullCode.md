# Código completo del módulo de inventario (copiar y pegar)

Aquí tienes todos los archivos que necesitas con la funcionalidad de guías PDF por cada actualización de inventario. Copia cada bloque en la ruta indicada dentro de tu proyecto.

## backend/index.js
```javascript
import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import sqlite3 from "sqlite3";

import authRoutes from "./routes/auth.js";
import patientRoutes from "./routes/patientRoutes.js";
import treatmentRoutes from "./routes/treatmentRoutes.js";
import inventoryRoutes from "./routes/inventoryRoutes.js";
import especialistasRoutes from "./routes/especialistas.js";
import finanzasRoutes from "./routes/finanzasRoutes.js";

const app = express();
app.use(cors());
app.use(bodyParser.json());

// ✅ Servir imágenes de forma pública (📸 importante para ver las fotos)
app.use("/uploads", express.static("uploads"));

// ✅ Conexión a la base de datos SQLite
const db = new sqlite3.Database("./db/showclinic.db", (err) => {
  if (err) {
    console.error("❌ Error al conectar con la base de datos:", err.message);
  } else {
    console.log("✅ Conectado a showclinic.db");

    // 🧱 Tabla de usuarios (login)
    db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE,
        password TEXT,
        role TEXT
      )
    `);

    // 🧱 Tabla de pacientes
    db.run(`
      CREATE TABLE IF NOT EXISTS patients (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        dni TEXT,
        nombre TEXT,
        apellido TEXT,
        edad INTEGER,
        sexo TEXT,
        direccion TEXT,
        ocupacion TEXT,
        fechaNacimiento TEXT,
        ciudadNacimiento TEXT,
        ciudadResidencia TEXT,
        alergias TEXT,
        enfermedad TEXT,
        correo TEXT,
        celular TEXT,
        cirugiaEstetica TEXT,
        drogas TEXT,
        tabaco TEXT,
        alcohol TEXT,
        referencia TEXT,
        fechaRegistro TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 🧱 Tabla de tratamientos base
    db.run(`
      CREATE TABLE IF NOT EXISTS tratamientos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT,
        descripcion TEXT
      )
    `);

    // 🧱 Tabla de tratamientos realizados
    db.run(`
      CREATE TABLE IF NOT EXISTS tratamientos_realizados (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        paciente_id INTEGER,
        tratamiento_id INTEGER,
        productos TEXT,
        cantidad_total INTEGER,
        precio_total REAL,
        descuento REAL,
        pagoMetodo TEXT,
        sesion INTEGER,
        tipoAtencion TEXT,
        especialista TEXT,
        foto_izquierda TEXT,
        foto_frontal TEXT,
        foto_derecha TEXT,
        foto_extra1 TEXT,
        foto_extra2 TEXT,
        foto_extra3 TEXT,
        fecha TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(paciente_id) REFERENCES patients(id),
        FOREIGN KEY(tratamiento_id) REFERENCES tratamientos(id)
      )
    `);

    const ensureColumnExists = (table, column, definition) => {
      db.all(`PRAGMA table_info(${table})`, (err, rows) => {
        if (err) {
          console.error(`Error verificando columna ${column} en ${table}:`, err);
          return;
        }
        const exists = rows.some((col) => col.name === column);
        if (!exists) {
          db.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`, (err) => {
            if (err) {
              console.error(`Error agregando columna ${column} a ${table}:`, err);
            } else {
              console.log(`Columna ${column} agregada a ${table}`);
            }
          });
        }
      });
    };

    [
      ["foto_extra1", "TEXT"],
      ["foto_extra2", "TEXT"],
      ["foto_extra3", "TEXT"],
    ].forEach(([column, definition]) =>
      ensureColumnExists("tratamientos_realizados", column, definition)
    );

    // 🧱 Tabla de inventario
    db.run(`
      CREATE TABLE IF NOT EXISTS inventario (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        producto TEXT,
        marca TEXT,
        sku TEXT,
        proveedor TEXT,
        contenido TEXT,
        precio REAL,
        stock INTEGER,
        fechaVencimiento TEXT,
        ultima_actualizacion TEXT,
        actualizado_por TEXT,
        documento_pdf TEXT
      )
    `);

    [
      ["contenido", "TEXT"],
      ["ultima_actualizacion", "TEXT"],
      ["actualizado_por", "TEXT"],
      ["documento_pdf", "TEXT"],
    ].forEach(([column, definition]) =>
      ensureColumnExists("inventario", column, definition)
    );

    db.run(`
      CREATE TABLE IF NOT EXISTS inventario_documentos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        inventario_id INTEGER NOT NULL,
        archivo TEXT NOT NULL,
        uploaded_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(inventario_id) REFERENCES inventario(id)
      )
    `);

    console.log("🧩 Todas las tablas listas para usar ✅");
  }
});

// ✅ Rutas de la API
app.use("/api/auth", authRoutes);
app.use("/api/pacientes", patientRoutes);
app.use("/api/tratamientos", treatmentRoutes);
app.use("/api/inventario", inventoryRoutes);
app.use("/api/especialistas", especialistasRoutes);
app.use("/api/finanzas", finanzasRoutes);
app.use("/uploads/docs", express.static("uploads/docs"));

// ✅ Servidor en puerto 4000
const PORT = 4000;
app.listen(PORT, "0.0.0.0", () =>
  console.log(`🚀 Servidor backend disponible en red en http://0.0.0.0:${PORT}`)
);
```

## backend/routes/inventoryRoutes.js
```javascript
import express from "express";
import sqlite3 from "sqlite3";
import bodyParser from "body-parser";
import multer from "multer";
import path from "path";
import fs from "fs";

const router = express.Router();
const db = new sqlite3.Database("./db/showclinic.db");
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
```

## frontend/src/pages/inventario/Inventario.js
```javascript
import React, { useEffect, useState } from "react";
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  IconButton,
  Tooltip,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";

export default function Inventario() {
  const colorPrincipal = "#a36920ff";
  const [productos, setProductos] = useState([]);
  const [form, setForm] = useState({
    producto: "",
    marca: "",
    sku: "",
    proveedor: "",
    contenido: "",
    precio: "",
    stock: "",
    fechaVencimiento: "",
  });
  const [editando, setEditando] = useState(null);
  const role = localStorage.getItem("role"); // 🔒 Rol actual (doctor / admin)

  // ✅ Obtener productos
  const obtenerProductos = () => {
    fetch("http://localhost:4000/api/inventario/listar")
      .then((r) => r.json())
      .then(setProductos)
      .catch(console.error);
  };

  useEffect(() => {
    obtenerProductos();
  }, []);

  // ✅ Guardar producto
  const guardarProducto = async () => {
    const metodo = editando ? "PUT" : "POST";
    const url = editando
      ? `http://localhost:4000/api/inventario/editar/${editando}`
      : "http://localhost:4000/api/inventario/crear";

    const data = { ...form, actualizado_por: role };

    const res = await fetch(url, {
      method: metodo,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (res.ok) {
      alert(editando ? "✅ Producto actualizado" : "✅ Producto registrado");
      setForm({
        producto: "",
        marca: "",
        sku: "",
        proveedor: "",
        contenido: "",
        precio: "",
        stock: "",
        fechaVencimiento: "",
      });
      setEditando(null);
      obtenerProductos();
    } else {
      alert("❌ Error al guardar producto");
    }
  };

  // ✅ Eliminar producto
  const eliminarProducto = async (id) => {
    if (!window.confirm("¿Eliminar producto?")) return;
    const res = await fetch(
      `http://localhost:4000/api/inventario/eliminar/${id}`,
      { method: "DELETE" }
    );
    if (res.ok) {
      alert("🗑️ Producto eliminado");
      obtenerProductos();
    }
  };

  // ✅ Editar producto
  const editarProducto = (p) => {
    setEditando(p.id);
    setForm(p);
  };

  // ✅ Subir documento PDF
  const subirPDF = async (id, file) => {
    if (!file) return alert("Seleccione un archivo PDF antes de subir.");

    const data = new FormData();
    data.append("documento", file);

    try {
      const res = await fetch(
        `http://localhost:4000/api/inventario/subir-pdf/${id}`,
        { method: "POST", body: data }
      );
      if (res.ok) {
        alert("📄 Documento PDF subido correctamente");
        obtenerProductos();
      } else {
        alert("❌ Error al subir documento PDF");
      }
    } catch (err) {
      console.error("❌ Error al subir PDF:", err);
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
          p: 4,
          borderRadius: 4,
          backgroundColor: "rgba(255,255,255,0.95)",
          width: "95%",
          maxWidth: 1100,
        }}
      >
        <Typography
          variant="h5"
          sx={{ color: colorPrincipal, fontWeight: "bold", mb: 3 }}
          align="center"
        >
          Inventario de Productos
        </Typography>

        {/* 🔒 Solo DOCTOR puede crear/editar productos */}
        {role === "doctor" && (
          <>
            <Grid container spacing={2}>
              {Object.keys(form).map((campo) => (
                <Grid item xs={12} md={4} key={campo}>
                  <TextField
                    label={campo.charAt(0).toUpperCase() + campo.slice(1)}
                    name={campo}
                    type={
                      campo === "precio"
                        ? "number"
                        : campo === "stock"
                        ? "number"
                        : campo === "fechaVencimiento"
                        ? "date"
                        : "text"
                    }
                    fullWidth
                    value={form[campo]}
                    onChange={(e) =>
                      setForm({ ...form, [e.target.name]: e.target.value })
                    }
                    InputLabelProps={
                      campo === "fechaVencimiento" ? { shrink: true } : {}
                    }
                  />
                </Grid>
              ))}
            </Grid>

            <Button
              variant="contained"
              sx={{
                mt: 3,
                backgroundColor: colorPrincipal,
                "&:hover": { backgroundColor: "#8a541a" },
              }}
              onClick={guardarProducto}
              fullWidth
            >
              {editando ? "Actualizar Producto" : "Guardar Producto"}
            </Button>
          </>
        )}

        {/* 🧾 Tabla de productos */}
        <Typography
          variant="h6"
          sx={{ color: colorPrincipal, mt: 5 }}
          align="center"
        >
          Lista de Productos
        </Typography>

        <Table sx={{ mt: 2 }}>
          <TableHead>
            <TableRow>
              <TableCell>Producto</TableCell>
              <TableCell>Marca</TableCell>
              <TableCell>Contenido</TableCell>
              <TableCell>Proveedor</TableCell>
              <TableCell>Precio (S/)</TableCell>
              <TableCell>Stock</TableCell>
              <TableCell>Vence</TableCell>
              <TableCell>PDF</TableCell>
              {role === "doctor" && <TableCell>Acciones</TableCell>}
            </TableRow>
          </TableHead>

          <TableBody>
            {productos.map((p) => (
              <TableRow key={p.id}>
                <TableCell>{p.producto}</TableCell>
                <TableCell>{p.marca}</TableCell>
                <TableCell>{p.contenido}</TableCell>
                <TableCell>{p.proveedor}</TableCell>
                <TableCell>{p.precio}</TableCell>
                <TableCell>{p.stock}</TableCell>
                <TableCell>{p.fechaVencimiento}</TableCell>

                {/* 📎 PDF del producto */}
                <TableCell>
                  {p.documentos && p.documentos.length > 0 ? (
                    <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
                      {p.documentos.map((doc, idx) => (
                        <Box
                          key={`${doc.archivo}-${idx}`}
                          sx={{ display: "flex", alignItems: "center", gap: 0.5 }}
                        >
                          <Tooltip
                            title={`Ver guía (${doc.uploaded_at?.split(" ")[0] || ""})`}
                          >
                            <a
                              href={`http://localhost:4000/uploads/docs/${doc.archivo}`}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <PictureAsPdfIcon
                                sx={{ color: "#a36920", fontSize: 28 }}
                              />
                            </a>
                          </Tooltip>
                          <Typography variant="caption" color="textSecondary">
                            {doc.uploaded_at?.split(" ")[0] || "Guía"}
                          </Typography>
                        </Box>
                      ))}
                    </Box>
                  ) : (
                    <Typography color="textSecondary">—</Typography>
                  )}

                  {role === "doctor" && (
                    <label
                      style={{
                        display: "inline-block",
                        color: "#a36920",
                        cursor: "pointer",
                        fontWeight: "bold",
                        marginTop: 4,
                      }}
                    >
                      📎 Subir PDF
                      <input
                        type="file"
                        accept="application/pdf"
                        style={{ display: "none" }}
                        onChange={(e) => subirPDF(p.id, e.target.files[0])}
                      />
                    </label>
                  )}
                </TableCell>

                {/* ✏️ Acciones */}
                {role === "doctor" && (
                  <TableCell>
                    <IconButton color="primary" onClick={() => editarProducto(p)}>
                      <EditIcon />
                    </IconButton>
                    <IconButton color="error" onClick={() => eliminarProducto(p.id)}>
                      <DeleteIcon />
                    </IconButton>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>
    </Box>
  );
}
```
