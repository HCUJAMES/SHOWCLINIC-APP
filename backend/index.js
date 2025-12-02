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
