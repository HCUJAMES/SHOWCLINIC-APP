# Código actualizado para login e historial clínico (copiar y pegar)

## backend/index.js
```javascript
import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import sqlite3 from "sqlite3";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

import authRoutes from "./routes/auth.js";
import patientRoutes from "./routes/patientRoutes.js";
import treatmentRoutes from "./routes/treatmentRoutes.js";
import inventoryRoutes from "./routes/inventoryRoutes.js";
import especialistasRoutes from "./routes/especialistas.js";
import finanzasRoutes from "./routes/finanzasRoutes.js";
import bcrypt from "bcryptjs";

const app = express();
app.use(cors());
app.use(bodyParser.json());

// ✅ Servir imágenes de forma pública (📸 importante para ver las fotos)
app.use("/uploads", express.static("uploads"));

// ✅ Ruta segura a la base de datos SQLite (independiente del cwd)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbDir = path.join(__dirname, "db");
const dbPath = path.join(dbDir, "showclinic.db");
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// ✅ Conexión a la base de datos SQLite
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error("❌ Error al conectar con la base de datos:", err.message);
  } else {
    console.log(`✅ Conectado a ${dbPath}`);

    // 🧱 Tabla de usuarios (login)
    db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE,
        password TEXT,
        role TEXT
      )
    `);

    const ensureDefaultAdmin = () => {
      const defaultUser = { username: "admin", password: "admin123", role: "doctor" };
      const defaultHash = bcrypt.hashSync(defaultUser.password, 10);

      db.get(`SELECT * FROM users WHERE username = ?`, [defaultUser.username], (userErr, user) => {
        if (userErr) {
          console.error("❌ Error verificando usuario por defecto:", userErr.message);
          return;
        }

        if (!user) {
          db.run(
            `INSERT INTO users (username, password, role) VALUES (?, ?, ?)`,
            [defaultUser.username, defaultHash, defaultUser.role],
            (insertErr) => {
              if (insertErr) {
                console.error("❌ Error creando usuario por defecto:", insertErr.message);
              } else {
                console.log("✅ Usuario por defecto creado: admin / admin123");
              }
            }
          );
          return;
        }

        const passwordOk = bcrypt.compareSync(defaultUser.password, user.password);
        if (!passwordOk || user.role !== defaultUser.role) {
          db.run(
            `UPDATE users SET password = ?, role = ? WHERE username = ?`,
            [defaultHash, defaultUser.role, defaultUser.username],
            (updateErr) => {
              if (updateErr) {
                console.error("❌ Error actualizando usuario por defecto:", updateErr.message);
              } else {
                console.log("✅ Usuario por defecto sincronizado: admin / admin123");
              }
            }
          );
        }
      });
    };

    ensureDefaultAdmin();

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
        foto_antes1 TEXT,
        foto_antes2 TEXT,
        foto_antes3 TEXT,
        foto_despues1 TEXT,
        foto_despues2 TEXT,
        foto_despues3 TEXT,
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
      ["foto_antes1", "TEXT"],
      ["foto_antes2", "TEXT"],
      ["foto_antes3", "TEXT"],
      ["foto_despues1", "TEXT"],
      ["foto_despues2", "TEXT"],
      ["foto_despues3", "TEXT"],
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

## backend/routes/auth.js
```javascript
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../db/database");

const router = express.Router();
const SECRET = "showclinic_secret"; // puedes moverlo luego a .env

router.post("/login", (req, res) => {
  const { username, password } = req.body;
  db.get("SELECT * FROM users WHERE username = ?", [username], (err, user) => {
    if (err) return res.status(500).json({ message: "Error interno" });
    if (!user) return res.status(400).json({ message: "Usuario no encontrado" });

    const valid = bcrypt.compareSync(password, user.password);
    if (!valid) return res.status(401).json({ message: "Contraseña incorrecta" });

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      SECRET,
      { expiresIn: "8h" }
    );
    res.json({ token, role: user.role });
  });
});

module.exports = router;
```

## backend/routes/treatmentRoutes.js
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
```

## frontend/src/pages/Login.js
```javascript
import React, { useState } from "react";
import {
  TextField,
  Button,
  Typography,
  Box,
  Paper,
  Avatar,
} from "@mui/material";
import axios from "axios";
import { useNavigate } from "react-router-dom";

const API_BASE =
  process.env.REACT_APP_API_URL ||
  `${window.location.protocol}//${window.location.hostname}:4000`;

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();

  const handleLogin = async () => {
    try {
      const res = await axios.post(`${API_BASE}/api/auth/login`, {
        username: username.trim(),
        password: password.trim(),
      });
      localStorage.setItem("token", res.data.token);
      localStorage.setItem("role", res.data.role);
      navigate("/dashboard");
    } catch (e) {
      const status = e.response?.status;
      if (status === 400 || status === 401) {
        alert("Usuario o contraseña incorrectos");
      } else {
        alert(
          "No se pudo conectar con el servidor. Verifica que el backend esté ejecutándose y accesible."
        );
      }
    }
  };

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        background: "linear-gradient(135deg, #ffffff 0%, #f7eac1 100%)",
      }}
    >
      <Paper
        elevation={10}
        sx={{
          p: 5,
          borderRadius: 5,
          textAlign: "center",
          width: 400,
          backgroundColor: "white",
          border: "1px solid #e0e0e0",
          boxShadow: "0 10px 30px rgba(212,175,55,0.2)",
        }}
      >
        <Avatar
          src="/logo-showclinic.png"
          alt="ShowClinic"
          sx={{
            width: 90,
            height: 90,
            mx: "auto",
            mb: 2,
            bgcolor: "#D4AF37",
            boxShadow: "0 0 15px rgba(212,175,55,0.6)",
          }}
        />
        <Typography
          variant="h4"
          sx={{ mb: 1, fontWeight: "bold", color: "#D4AF37" }}
        >
          SHOWCLINIC
        </Typography>
        <Typography variant="subtitle1" sx={{ mb: 3, color: "#2E2E2E" }}>
          Iniciar sesión
        </Typography>

        <TextField
          label="Usuario"
          fullWidth
          margin="normal"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        <TextField
          label="Contraseña"
          type="password"
          fullWidth
          margin="normal"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <Button
          variant="contained"
          fullWidth
          sx={{
            mt: 3,
            py: 1.3,
            fontWeight: "bold",
            fontSize: "1rem",
            borderRadius: "30px",
            background: "linear-gradient(90deg, #D4AF37, #E9C46A)",
            color: "white",
            "&:hover": {
              background: "linear-gradient(90deg, #B8860B, #D4AF37)",
            },
          }}
          onClick={handleLogin}
        >
          Entrar
        </Button>
      </Paper>
    </Box>
  );
}
```

## frontend/src/pages/HistorialClinico.js
```javascript
import React, { useEffect, useState } from "react";
import {
  Container,
  Typography,
  TextField,
  Button,
  Grid,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Divider,
  Box,
} from "@mui/material";
import axios from "axios";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const CAMPOS_FOTOS_ANTES = ["foto_antes1", "foto_antes2", "foto_antes3"];
const CAMPOS_FOTOS_DESPUES = ["foto_despues1", "foto_despues2", "foto_despues3"];
const CAMPOS_FOTOS_LEGACY = [
  "foto_izquierda",
  "foto_frontal",
  "foto_derecha",
  "foto_extra1",
  "foto_extra2",
  "foto_extra3",
];

const HistorialClinico = () => {
  const [pacientes, setPacientes] = useState([]);
  const [filtro, setFiltro] = useState("");
  const [pacienteSeleccionado, setPacienteSeleccionado] = useState(null);
  const [tratamientos, setTratamientos] = useState([]);
  const [fotosAntes, setFotosAntes] = useState([]);
  const [fotosDespues, setFotosDespues] = useState([]);
  const [previewsAntes, setPreviewsAntes] = useState([]);
  const [previewsDespues, setPreviewsDespues] = useState([]);
  const [tratamientoSeleccionado, setTratamientoSeleccionado] = useState(null);

  useEffect(() => {
    axios
      .get("http://localhost:4000/api/pacientes/listar")
      .then((res) => setPacientes(res.data))
      .catch((err) => console.error("❌ Error al obtener pacientes:", err));
  }, []);

  const cargarHistorial = async (id) => {
    try {
      const paciente = pacientes.find((p) => p.id === id) || null;
      setPacienteSeleccionado(paciente);
      const res = await axios.get(
        `http://localhost:4000/api/tratamientos/historial/${id}`
      );
      setTratamientos(res.data);
    } catch (error) {
      console.error("❌ Error al obtener historial clínico:", error);
    }
  };

  const manejarCambioFotos = (tipo) => (e) => {
    const archivos = Array.from(e.target.files || []);
    if (archivos.length > 3) {
      alert("Solo puedes subir hasta 3 fotos en esta sección");
    }
    const seleccionados = archivos.slice(0, 3);

    if (tipo === "antes") {
      setFotosAntes(seleccionados);
      setPreviewsAntes(seleccionados.map((f) => URL.createObjectURL(f)));
    } else {
      setFotosDespues(seleccionados);
      setPreviewsDespues(seleccionados.map((f) => URL.createObjectURL(f)));
    }
  };

  const subirFotos = async (tratamientoId) => {
    if (!fotosAntes.length && !fotosDespues.length)
      return alert("📸 Selecciona fotos de antes o después para subir");

    const data = new FormData();
    fotosAntes.forEach((f) => data.append("fotosAntes", f));
    fotosDespues.forEach((f) => data.append("fotosDespues", f));

    try {
      await axios.post(
        `http://localhost:4000/api/tratamientos/subir-fotos/${tratamientoId}`,
        data,
        { headers: { "Content-Type": "multipart/form-data" } }
      );
      alert("✅ Fotos agregadas correctamente");
      setFotosAntes([]);
      setFotosDespues([]);
      setPreviewsAntes([]);
      setPreviewsDespues([]);
      setTratamientoSeleccionado(null);
      cargarHistorial(pacienteSeleccionado.id);
    } catch (err) {
      console.error("❌ Error al subir fotos:", err);
      alert("Error al subir fotos");
    }
  };

  const pacientesFiltrados = pacientes.filter(
    (p) =>
      p.nombre.toLowerCase().includes(filtro.toLowerCase()) ||
      p.apellido.toLowerCase().includes(filtro.toLowerCase())
  );

  const totalGeneral = tratamientos.reduce(
    (acc, t) => acc + Number(t.precio_total || t.precioTotal || 0),
    0
  );

  const generarPDF = async () => {
    if (!pacienteSeleccionado) return;

    const doc = new jsPDF("p", "pt", "a4");
    const logo = "/images/logo-showclinic.png";
    const img = new Image();
    img.src = logo;
    await new Promise((resolve) => {
      img.onload = () => {
        doc.addImage(img, "PNG", 40, 30, 90, 60);
        resolve();
      };
    });

    doc.setFont("Helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor("#a36920");
    doc.text("Historial Clínico - SHOWCLINIC", 160, 70);
    doc.setFontSize(11);
    doc.setTextColor("#000");
    doc.text(`Emitido: ${new Date().toLocaleDateString()}`, 420, 100);

    const p = pacienteSeleccionado;
    doc.setFontSize(13);
    doc.setTextColor("#a36920");
    doc.text("Datos del Paciente", 40, 140);

    doc.setFontSize(11);
    doc.setTextColor("#000");
    const datos = [
      ["DNI", p.dni],
      ["Nombre", `${p.nombre} ${p.apellido}`],
      ["Edad", p.edad],
      ["Sexo", p.sexo],
      ["Ocupación", p.ocupacion],
      ["Correo", p.correo],
      ["Celular", p.celular],
      ["Dirección", p.direccion],
      ["Ciudad Nacimiento", p.ciudadNacimiento],
      ["Ciudad Residencia", p.ciudadResidencia],
      ["Alergias", p.alergias || "Ninguna"],
      ["Enfermedades", p.enfermedad || "Ninguna"],
      ["Cirugía Estética", p.cirugiaEstetica || "No"],
      ["Tabaco", p.tabaco || "No"],
      ["Alcohol", p.alcohol || "No"],
      ["Drogas", p.drogas || "No"],
      ["Referencia", p.referencia || "No especificada"],
    ];

    let y = 160;
    datos.forEach(([k, v]) => {
      doc.text(`${k}:`, 40, y);
      doc.text(`${v}`, 200, y);
      y += 16;
    });

    doc.setFontSize(13);
    doc.setTextColor("#a36920");
    doc.text("Tratamientos Realizados", 40, y + 20);

    const tabla = tratamientos.map((t) => [
      t.fecha ? t.fecha.split(" ")[0] : "-",
      t.nombreTratamiento || "—",
      t.tipoAtencion || "-",
      t.especialista || "No especificado",
      `S/ ${(t.precio_total || 0).toFixed(2)}`,
      `${t.descuento || 0}%`,
      t.pagoMetodo,
      t.sesion,
    ]);

    autoTable(doc, {
      startY: y + 30,
      head: [
        [
          "Fecha",
          "Tratamiento",
          "Tipo Atención",
          "Especialista",
          "Total (S/)",
          "Descuento (%)",
          "Pago",
          "Sesión",
        ],
      ],
      body: tabla,
      headStyles: { fillColor: [163, 105, 32], textColor: 255 },
      styles: { fontSize: 9, cellPadding: 5 },
    });

    doc.text(
      `Monto total general: S/ ${totalGeneral.toFixed(2)}`,
      350,
      doc.lastAutoTable.finalY + 30
    );
    doc.save(`Historial_${p.nombre}_${p.apellido}.pdf`);
  };

  const renderMiniaturas = (keys, tratamiento) => (
    <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mt: 0.5 }}>
      {keys.map(
        (key, i) =>
          tratamiento[key] && (
            <a
              key={`${key}-${i}`}
              href={`http://localhost:4000/uploads/${tratamiento[key]}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <img
                src={`http://localhost:4000/uploads/${tratamiento[key]}`}
                width={70}
                alt={key}
                style={{
                  borderRadius: 6,
                  border: "1px solid #ccc",
                  cursor: "pointer",
                }}
              />
            </a>
          )
      )}
    </Box>
  );

  return (
    <div
      style={{
        backgroundImage:
          "linear-gradient(rgba(255,255,255,0.85), rgba(232,211,57,0.85)), url('/images/background-showclinic.jpg')",
        backgroundSize: "cover",
        minHeight: "100vh",
        padding: "40px 20px",
      }}
    >
      <Container maxWidth="lg">
        <Paper sx={{ p: 5, borderRadius: "15px", backgroundColor: "#fff" }}>
          <Typography
            variant="h5"
            align="center"
            sx={{ mb: 4, color: "#a36920", fontWeight: "bold" }}
          >
            🩺 Historial Clínico de Pacientes
          </Typography>

          {!pacienteSeleccionado ? (
            <>
              <TextField
                label="Buscar paciente por nombre o apellido"
                fullWidth
                value={filtro}
                onChange={(e) => setFiltro(e.target.value)}
                sx={{ mb: 3 }}
              />
              <Grid container spacing={2}>
                {pacientesFiltrados.map((pac) => (
                  <Grid item xs={12} md={6} key={pac.id}>
                    <Paper
                      sx={{
                        p: 2,
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        border: "1px solid #ddd",
                      }}
                    >
                      <div>
                        <Typography fontWeight="bold">
                          {pac.nombre} {pac.apellido}
                        </Typography>
                        <Typography variant="body2">DNI: {pac.dni}</Typography>
                      </div>
                      <Button
                        variant="contained"
                        sx={{
                          backgroundColor: "#a36920",
                          "&:hover": { backgroundColor: "#8b581b" },
                        }}
                        onClick={() => cargarHistorial(pac.id)}
                      >
                        Ver historial
                      </Button>
                    </Paper>
                  </Grid>
                ))}
              </Grid>
            </>
          ) : (
            <>
              <Button
                variant="outlined"
                onClick={() => setPacienteSeleccionado(null)}
                sx={{
                  mb: 3,
                  borderColor: "#a36920",
                  color: "#a36920",
                  "&:hover": { backgroundColor: "#f7f2ea" },
                }}
              >
                ← Volver
              </Button>

              <Button
                variant="contained"
                sx={{
                  mb: 3,
                  ml: 2,
                  backgroundColor: "#a36920",
                  "&:hover": { backgroundColor: "#8b581b" },
                }}
                onClick={generarPDF}
              >
                🧾 Exportar PDF
              </Button>

              {/* 🧍 Información completa del paciente */}
              <Typography
                variant="h6"
                sx={{ color: "#a36920", fontWeight: "bold", mb: 2 }}
              >
                👤 Información completa del paciente
              </Typography>

              <Grid container spacing={2} sx={{ mb: 4 }}>
                <Grid item xs={12} sm={6}>
                  <Typography><strong>DNI:</strong> {pacienteSeleccionado.dni}</Typography>
                  <Typography><strong>Nombre:</strong> {pacienteSeleccionado.nombre}</Typography>
                  <Typography><strong>Apellido:</strong> {pacienteSeleccionado.apellido}</Typography>
                  <Typography><strong>Edad:</strong> {pacienteSeleccionado.edad}</Typography>
                  <Typography><strong>Sexo:</strong> {pacienteSeleccionado.sexo}</Typography>
                  <Typography><strong>Ocupación:</strong> {pacienteSeleccionado.ocupacion}</Typography>
                  <Typography><strong>Fecha Nacimiento:</strong> {pacienteSeleccionado.fechaNacimiento}</Typography>
                  <Typography><strong>Ciudad Nacimiento:</strong> {pacienteSeleccionado.ciudadNacimiento}</Typography>
                  <Typography><strong>Ciudad Residencia:</strong> {pacienteSeleccionado.ciudadResidencia}</Typography>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <Typography><strong>Correo:</strong> {pacienteSeleccionado.correo}</Typography>
                  <Typography><strong>Celular:</strong> {pacienteSeleccionado.celular}</Typography>
                  <Typography><strong>Dirección:</strong> {pacienteSeleccionado.direccion}</Typography>
                  <Typography><strong>Alergias:</strong> {pacienteSeleccionado.alergias || "Ninguna"}</Typography>
                  <Typography><strong>Enfermedades:</strong> {pacienteSeleccionado.enfermedad || "Ninguna"}</Typography>
                  <Typography><strong>Cirugía Estética:</strong> {pacienteSeleccionado.cirugiaEstetica || "No"}</Typography>
                  <Typography><strong>Consume tabaco:</strong> {pacienteSeleccionado.tabaco || "No"}</Typography>
                  <Typography><strong>Consume alcohol:</strong> {pacienteSeleccionado.alcohol || "No"}</Typography>
                  <Typography><strong>Consume drogas:</strong> {pacienteSeleccionado.drogas || "No"}</Typography>
                  <Typography><strong>Referencia:</strong> {pacienteSeleccionado.referencia || "No especificada"}</Typography>
                </Grid>
              </Grid>

              <Divider sx={{ mb: 3 }} />

              {/* 💆 Tratamientos realizados */}
              <Typography
                variant="h6"
                sx={{ color: "#a36920", fontWeight: "bold", mb: 2 }}
              >
                💆‍♀️ Tratamientos realizados
              </Typography>

              {tratamientos.length === 0 ? (
                <Typography>No hay tratamientos registrados.</Typography>
              ) : (
                <>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Fecha</TableCell>
                        <TableCell>Tratamiento</TableCell>
                        <TableCell>Tipo Atención</TableCell>
                        <TableCell>Especialista</TableCell>
                        <TableCell>Total (S/)</TableCell>
                        <TableCell>Desc. (%)</TableCell>
                        <TableCell>Pago</TableCell>
                        <TableCell>Sesión</TableCell>
                        <TableCell>Fotos</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {tratamientos.map((t) => {
                        const tieneFotosAntes = CAMPOS_FOTOS_ANTES.some((key) => t[key]);
                        const tieneFotosDespues = CAMPOS_FOTOS_DESPUES.some((key) => t[key]);
                        const tieneFotosLegacy = CAMPOS_FOTOS_LEGACY.some((key) => t[key]);
                        const tieneFotos = tieneFotosAntes || tieneFotosDespues || tieneFotosLegacy;

                        return (
                          <TableRow key={t.id}>
                            <TableCell>{t.fecha?.split(" ")[0]}</TableCell>
                            <TableCell>{t.nombreTratamiento}</TableCell>
                            <TableCell>{t.tipoAtencion}</TableCell>
                            <TableCell>{t.especialista}</TableCell>
                            <TableCell>S/ {(t.precio_total || 0).toFixed(2)}</TableCell>
                            <TableCell>{t.descuento}</TableCell>
                            <TableCell>{t.pagoMetodo}</TableCell>
                            <TableCell>{t.sesion}</TableCell>

                            <TableCell>
                              {tieneFotos && (
                                <Box sx={{ display: "flex", flexDirection: "column", gap: 1, mb: 1 }}>
                                  <Box>
                                    <Typography variant="body2" fontWeight="bold" color="#a36920">
                                      ANTES
                                    </Typography>
                                    {tieneFotosAntes ? (
                                      renderMiniaturas(CAMPOS_FOTOS_ANTES, t)
                                    ) : (
                                      <Typography color="textSecondary" variant="caption">
                                        Sin fotos de antes
                                      </Typography>
                                    )}
                                  </Box>
                                  <Box>
                                    <Typography variant="body2" fontWeight="bold" color="#a36920">
                                      DESPUÉS
                                    </Typography>
                                    {tieneFotosDespues ? (
                                      renderMiniaturas(CAMPOS_FOTOS_DESPUES, t)
                                    ) : (
                                      <Typography color="textSecondary" variant="caption">
                                        Sin fotos del después
                                      </Typography>
                                    )}
                                  </Box>
                                  {tieneFotosLegacy && (
                                    <Box>
                                      <Typography variant="body2" fontWeight="bold" color="#a36920">
                                        Galería previa
                                      </Typography>
                                      {renderMiniaturas(CAMPOS_FOTOS_LEGACY, t)}
                                    </Box>
                                  )}
                                </Box>
                              )}

                              {tratamientoSeleccionado === t.id ? (
                                <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                                  <Box>
                                    <Typography variant="body2" fontWeight="bold" color="#a36920" sx={{ mb: 0.5 }}>
                                      Subir fotos de ANTES (máx. 3)
                                    </Typography>
                                    <input
                                      type="file"
                                      multiple
                                      accept="image/*"
                                      onClick={(e) => (e.target.value = null)}
                                      onChange={manejarCambioFotos("antes")}
                                    />
                                    {previewsAntes.length > 0 && (
                                      <Box sx={{ display: "flex", gap: 1, mt: 0.5 }}>
                                        {previewsAntes.map((src, idx) => (
                                          <img
                                            key={`antes-${idx}`}
                                            src={src}
                                            alt="preview antes"
                                            width={70}
                                            style={{ borderRadius: "6px", border: "1px solid #ccc" }}
                                          />
                                        ))}
                                      </Box>
                                    )}
                                  </Box>

                                  <Box>
                                    <Typography variant="body2" fontWeight="bold" color="#a36920" sx={{ mb: 0.5 }}>
                                      Subir fotos de DESPUÉS (máx. 3)
                                    </Typography>
                                    <input
                                      type="file"
                                      multiple
                                      accept="image/*"
                                      onClick={(e) => (e.target.value = null)}
                                      onChange={manejarCambioFotos("despues")}
                                    />
                                    {previewsDespues.length > 0 && (
                                      <Box sx={{ display: "flex", gap: 1, mt: 0.5 }}>
                                        {previewsDespues.map((src, idx) => (
                                          <img
                                            key={`despues-${idx}`}
                                            src={src}
                                            alt="preview después"
                                            width={70}
                                            style={{ borderRadius: "6px", border: "1px solid #ccc" }}
                                          />
                                        ))}
                                      </Box>
                                    )}
                                  </Box>

                                  <Button
                                    variant="outlined"
                                    size="small"
                                    sx={{
                                      mt: 0.5,
                                      color: "#a36920",
                                      borderColor: "#a36920",
                                      alignSelf: "flex-start",
                                    }}
                                    onClick={() => subirFotos(t.id)}
                                  >
                                    💾 Guardar Fotos
                                  </Button>
                                </Box>
                              ) : (
                                <Button
                                  variant="text"
                                  size="small"
                                  sx={{
                                    color: "#a36920",
                                    textTransform: "none",
                                  }}
                                  onClick={() => setTratamientoSeleccionado(t.id)}
                                >
                                  {tieneFotos ? "📸 Actualizar fotos" : "📸 Agregar fotos"}
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>

                  <Typography
                    align="right"
                    sx={{ mt: 3, color: "#a36920", fontWeight: "bold" }}
                  >
                    💰 Total General: S/ {totalGeneral.toFixed(2)}
                  </Typography>
                </>
              )}
            </>
          )}
        </Paper>
      </Container>
    </div>
  );
};

export default HistorialClinico;
```
