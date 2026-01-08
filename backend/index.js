import "dotenv/config";
import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import sqlite3 from "sqlite3";
import path from "path";
import { fileURLToPath } from "url";

import authRoutes from "./routes/auth.js";
import patientRoutes from "./routes/patientRoutes.js";
import treatmentRoutes from "./routes/treatmentRoutes.js";
import inventoryRoutes from "./routes/inventoryRoutes.js";
import deudasRoutes from "./routes/deudasRoutes.js";
import especialistasRoutes from "./routes/especialistas.js";
import finanzasRoutes from "./routes/finanzasRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import statsRoutes from "./routes/statsRoutes.js";
import backupRoutes from "./routes/backupRoutes.js";
import paquetesRoutes from "./routes/paquetesRoutes.js";
import whatsappRoutes from "./routes/whatsappRoutes.js";
import bcrypt from "bcryptjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
     db.get(`SELECT COUNT(*) as count FROM users`, (userErr, row) => {
      if (userErr) {
        console.error("❌ Error verificando usuarios:", userErr.message);
      } else if (row?.count === 0) {
        const hash = bcrypt.hashSync("admin123", 10);
        db.run(
          `INSERT INTO users (username, password, role) VALUES (?, ?, ?)`,
          ["admin", hash, "doctor"],
          (insertErr) => {
            if (insertErr) {
              console.error("❌ Error creando usuario por defecto:", insertErr.message);
            } else {
              console.log("✅ Usuario por defecto creado: admin / admin123");
            }
          }
        );
      }
    });

     const ensureUser = (username, passwordPlain, role) => {
      db.get(
        "SELECT id FROM users WHERE username = ?",
        [username],
        (getErr, existing) => {
          if (getErr) {
            console.error("❌ Error verificando usuario:", getErr.message);
            return;
          }
          if (existing?.id) return;
          const hash = bcrypt.hashSync(passwordPlain, 10);
          db.run(
            "INSERT INTO users (username, password, role) VALUES (?, ?, ?)",
            [username, hash, role],
            (insertErr) => {
              if (insertErr) {
                console.error("❌ Error creando usuario:", insertErr.message);
              } else {
                console.log(`✅ Usuario creado: ${username} / ${passwordPlain} (${role})`);
              }
            }
          );
        }
      );
     };

     ensureUser("logistica", "1234", "logistica");
     ensureUser("asistente", "1234", "asistente");
     ensureUser("master", "2006", "master");

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
        numeroHijos INTEGER,
        fechaRegistro TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    db.all("PRAGMA table_info(patients)", [], (err, rows) => {
      if (err) {
        console.error("❌ Error verificando columnas de patients:", err.message);
      } else {
        const tieneNumeroHijos = rows.some((col) => col.name === "numeroHijos");
        if (!tieneNumeroHijos) {
          db.run("ALTER TABLE patients ADD COLUMN numeroHijos INTEGER", (alterErr) => {
            if (alterErr) {
              console.error("❌ Error agregando columna numeroHijos:", alterErr.message);
            } else {
              console.log("✅ Columna numeroHijos agregada a patients");
            }
          });
        }

        const tieneEmbarazada = rows.some((col) => col.name === "embarazada");
        if (!tieneEmbarazada) {
          db.run("ALTER TABLE patients ADD COLUMN embarazada TEXT", (alterErr) => {
            if (alterErr) {
              console.error("❌ Error agregando columna embarazada:", alterErr.message);
            } else {
              console.log("✅ Columna embarazada agregada a patients");
            }
          });
        }

        const tieneObservaciones = rows.some((col) => col.name === "observaciones");
        if (!tieneObservaciones) {
          db.run("ALTER TABLE patients ADD COLUMN observaciones TEXT", (alterErr) => {
            if (alterErr) {
              console.error("❌ Error agregando columna observaciones:", alterErr.message);
            } else {
              console.log("✅ Columna observaciones agregada a patients");
            }
          });
        }

        const tieneFotoPerfil = rows.some((col) => col.name === "fotoPerfil");
        if (!tieneFotoPerfil) {
          db.run("ALTER TABLE patients ADD COLUMN fotoPerfil TEXT", (alterErr) => {
            if (alterErr) {
              console.error("❌ Error agregando columna fotoPerfil:", alterErr.message);
            } else {
              console.log("✅ Columna fotoPerfil agregada a patients");
            }
          });
        }
      }
    });

    // 🧱 Tabla de tratamientos base
    db.run(`
      CREATE TABLE IF NOT EXISTS tratamientos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT,
        descripcion TEXT
      )
    `);

    db.all("PRAGMA table_info(tratamientos)", [], (err, rows) => {
      if (err) {
        console.error("❌ Error verificando columnas de tratamientos:", err.message);
      } else {
        const tienePrecio = rows.some((col) => col.name === "precio");
        if (!tienePrecio) {
          db.run("ALTER TABLE tratamientos ADD COLUMN precio REAL", (alterErr) => {
            if (alterErr) {
              console.error("❌ Error agregando columna precio en tratamientos:", alterErr.message);
            } else {
              console.log("✅ Columna precio agregada a tratamientos");
            }
          });
        }
      }
    });

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

    // 💳 Deudas por pago en partes (por tratamiento realizado)
    db.run(`
      CREATE TABLE IF NOT EXISTS deudas_tratamientos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        paciente_id INTEGER NOT NULL,
        tratamiento_realizado_id INTEGER NOT NULL,
        tratamiento_id INTEGER,
        monto_total REAL NOT NULL,
        monto_adelanto REAL NOT NULL,
        monto_saldo REAL NOT NULL,
        estado TEXT NOT NULL DEFAULT 'pendiente',
        creado_en TEXT DEFAULT CURRENT_TIMESTAMP,
        cancelado_en TEXT,
        cancelado_monto REAL,
        cancelado_metodo TEXT,
        FOREIGN KEY(paciente_id) REFERENCES patients(id),
        FOREIGN KEY(tratamiento_realizado_id) REFERENCES tratamientos_realizados(id),
        FOREIGN KEY(tratamiento_id) REFERENCES tratamientos(id)
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS deudas_pagos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        deuda_id INTEGER NOT NULL,
        numero INTEGER NOT NULL,
        monto REAL NOT NULL,
        metodo TEXT NOT NULL,
        creado_en TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(deuda_id) REFERENCES deudas_tratamientos(id)
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS patient_observaciones (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        paciente_id INTEGER NOT NULL,
        texto TEXT NOT NULL,
        creado_en TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(paciente_id) REFERENCES patients(id)
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS patient_ofertas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        paciente_id INTEGER NOT NULL,
        items_json TEXT NOT NULL,
        total REAL NOT NULL,
        descuento REAL DEFAULT 0,
        creado_en TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(paciente_id) REFERENCES patients(id)
      )
    `);
    
    // Migración: agregar columna descuento si no existe
    db.run(`ALTER TABLE patient_ofertas ADD COLUMN descuento REAL DEFAULT 0`, (err) => {
      if (err && !err.message.includes('duplicate column')) {
        console.log('Columna descuento ya existe o error:', err.message);
      }
    });

    // 🎁 Tabla de paquetes de tratamientos
    db.run(`
      CREATE TABLE IF NOT EXISTS paquetes_tratamientos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT NOT NULL,
        descripcion TEXT,
        tratamiento_id INTEGER,
        tratamientos_json TEXT,
        productos_json TEXT,
        precio_regular REAL NOT NULL,
        precio_paquete REAL NOT NULL,
        descuento_porcentaje REAL,
        sesiones INTEGER NOT NULL DEFAULT 1,
        vigencia_inicio TEXT,
        vigencia_fin TEXT,
        estado TEXT NOT NULL DEFAULT 'activo',
        creado_en TEXT DEFAULT CURRENT_TIMESTAMP,
        actualizado_en TEXT,
        creado_por TEXT,
        FOREIGN KEY(tratamiento_id) REFERENCES tratamientos(id)
      )
    `);

    // Agregar columna tratamientos_json si no existe (migración)
    db.run(`ALTER TABLE paquetes_tratamientos ADD COLUMN tratamientos_json TEXT`, (err) => {
      if (err && !err.message.includes('duplicate column')) {
        console.log("Columna tratamientos_json ya existe o error:", err.message);
      }
    });

    console.log("✅ Tabla de paquetes de tratamientos creada");

    // 🎁 Tabla de paquetes asignados a pacientes
    db.run(`
      CREATE TABLE IF NOT EXISTS paquetes_pacientes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        paciente_id INTEGER NOT NULL,
        paquete_id INTEGER NOT NULL,
        paquete_nombre TEXT NOT NULL,
        tratamientos_json TEXT NOT NULL,
        precio_total REAL NOT NULL,
        estado TEXT NOT NULL DEFAULT 'activo',
        fecha_inicio TEXT DEFAULT CURRENT_TIMESTAMP,
        fecha_fin TEXT,
        notas TEXT,
        creado_en TEXT DEFAULT CURRENT_TIMESTAMP,
        creado_por TEXT,
        FOREIGN KEY(paciente_id) REFERENCES patients(id),
        FOREIGN KEY(paquete_id) REFERENCES paquetes_tratamientos(id)
      )
    `);

    // 🎁 Tabla de sesiones de paquetes (tracking de cada sesión realizada)
    db.run(`
      CREATE TABLE IF NOT EXISTS paquetes_sesiones (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        paquete_paciente_id INTEGER NOT NULL,
        tratamiento_id INTEGER NOT NULL,
        tratamiento_nombre TEXT NOT NULL,
        sesion_numero INTEGER NOT NULL,
        precio_sesion REAL NOT NULL,
        estado TEXT NOT NULL DEFAULT 'pendiente',
        fecha_realizada TEXT,
        especialista TEXT,
        notas TEXT,
        creado_en TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(paquete_paciente_id) REFERENCES paquetes_pacientes(id),
        FOREIGN KEY(tratamiento_id) REFERENCES tratamientos(id)
      )
    `);

    console.log("✅ Tablas de paquetes de pacientes creadas");

    // Agregar columnas de pago a paquetes_pacientes si no existen
    db.run(`ALTER TABLE paquetes_pacientes ADD COLUMN pagado INTEGER DEFAULT 0`, (err) => {
      if (err && !err.message.includes('duplicate column')) {
        console.error("Error agregando columna pagado a paquetes:", err.message);
      }
    });
    db.run(`ALTER TABLE paquetes_pacientes ADD COLUMN monto_pagado REAL DEFAULT 0`, (err) => {
      if (err && !err.message.includes('duplicate column')) {
        console.error("Error agregando columna monto_pagado a paquetes:", err.message);
      }
    });
    db.run(`ALTER TABLE paquetes_pacientes ADD COLUMN monto_adelanto REAL DEFAULT 0`, (err) => {
      if (err && !err.message.includes('duplicate column')) {
        console.error("Error agregando columna monto_adelanto a paquetes:", err.message);
      }
    });
    db.run(`ALTER TABLE paquetes_pacientes ADD COLUMN saldo_pendiente REAL DEFAULT 0`, (err) => {
      if (err && !err.message.includes('duplicate column')) {
        console.error("Error agregando columna saldo_pendiente a paquetes:", err.message);
      }
    });
    db.run(`ALTER TABLE paquetes_pacientes ADD COLUMN estado_pago TEXT DEFAULT 'pendiente_pago'`, (err) => {
      if (err && !err.message.includes('duplicate column')) {
        console.error("Error agregando columna estado_pago a paquetes:", err.message);
      }
    });
    db.run(`ALTER TABLE paquetes_pacientes ADD COLUMN fecha_pago TEXT`, (err) => {
      if (err && !err.message.includes('duplicate column')) {
        console.error("Error agregando columna fecha_pago a paquetes:", err.message);
      }
    });
    db.run(`ALTER TABLE paquetes_pacientes ADD COLUMN metodo_pago TEXT`, (err) => {
      if (err && !err.message.includes('duplicate column')) {
        console.error("Error agregando columna metodo_pago a paquetes:", err.message);
      }
    });

    // 📋 Tabla de presupuestos asignados a pacientes (similar a paquetes)
    db.run(`
      CREATE TABLE IF NOT EXISTS presupuestos_asignados (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        paciente_id INTEGER NOT NULL,
        oferta_id INTEGER NOT NULL,
        tratamientos_json TEXT NOT NULL,
        precio_total REAL NOT NULL,
        descuento REAL DEFAULT 0,
        estado TEXT NOT NULL DEFAULT 'activo',
        fecha_inicio TEXT DEFAULT CURRENT_TIMESTAMP,
        fecha_fin TEXT,
        notas TEXT,
        creado_en TEXT DEFAULT CURRENT_TIMESTAMP,
        creado_por TEXT,
        FOREIGN KEY(paciente_id) REFERENCES patients(id),
        FOREIGN KEY(oferta_id) REFERENCES ofertas(id)
      )
    `);
    
    // Migración: agregar columna descuento si no existe
    db.run(`ALTER TABLE presupuestos_asignados ADD COLUMN descuento REAL DEFAULT 0`, (err) => {
      if (err && !err.message.includes('duplicate column')) {
        console.log('Columna descuento en presupuestos_asignados ya existe o error:', err.message);
      }
    });

    // 📋 Tabla de sesiones de presupuestos (tracking de cada tratamiento)
    db.run(`
      CREATE TABLE IF NOT EXISTS presupuestos_sesiones (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        presupuesto_asignado_id INTEGER NOT NULL,
        tratamiento_id INTEGER,
        tratamiento_nombre TEXT NOT NULL,
        sesion_numero INTEGER NOT NULL DEFAULT 1,
        precio_sesion REAL NOT NULL,
        estado TEXT NOT NULL DEFAULT 'pendiente',
        fecha_realizada TEXT,
        especialista TEXT,
        notas TEXT,
        creado_en TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(presupuesto_asignado_id) REFERENCES presupuestos_asignados(id)
      )
    `);

    console.log("✅ Tablas de presupuestos asignados creadas");

    // Agregar columnas de pago a presupuestos_asignados si no existen
    db.run(`ALTER TABLE presupuestos_asignados ADD COLUMN pagado INTEGER DEFAULT 0`, (err) => {
      if (err && !err.message.includes('duplicate column')) {
        console.error("Error agregando columna pagado:", err.message);
      }
    });
    db.run(`ALTER TABLE presupuestos_asignados ADD COLUMN monto_pagado REAL DEFAULT 0`, (err) => {
      if (err && !err.message.includes('duplicate column')) {
        console.error("Error agregando columna monto_pagado:", err.message);
      }
    });
    db.run(`ALTER TABLE presupuestos_asignados ADD COLUMN fecha_pago TEXT`, (err) => {
      if (err && !err.message.includes('duplicate column')) {
        console.error("Error agregando columna fecha_pago:", err.message);
      }
    });
    db.run(`ALTER TABLE presupuestos_asignados ADD COLUMN metodo_pago TEXT`, (err) => {
      if (err && !err.message.includes('duplicate column')) {
        console.error("Error agregando columna metodo_pago:", err.message);
      }
    });
    
    // Columnas para adelantos y estado de pago
    db.run(`ALTER TABLE presupuestos_asignados ADD COLUMN monto_adelanto REAL DEFAULT 0`, (err) => {
      if (err && !err.message.includes('duplicate column')) {
        console.error("Error agregando columna monto_adelanto:", err.message);
      }
    });
    db.run(`ALTER TABLE presupuestos_asignados ADD COLUMN saldo_pendiente REAL DEFAULT 0`, (err) => {
      if (err && !err.message.includes('duplicate column')) {
        console.error("Error agregando columna saldo_pendiente:", err.message);
      }
    });
    db.run(`ALTER TABLE presupuestos_asignados ADD COLUMN estado_pago TEXT DEFAULT 'pendiente_pago'`, (err) => {
      if (err && !err.message.includes('duplicate column')) {
        console.error("Error agregando columna estado_pago:", err.message);
      }
    });

    // 💰 Tabla de finanzas para registrar ingresos y egresos
    db.run(`
      CREATE TABLE IF NOT EXISTS finanzas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tipo TEXT NOT NULL DEFAULT 'ingreso',
        categoria TEXT,
        monto REAL NOT NULL,
        descripcion TEXT,
        fecha TEXT,
        metodo_pago TEXT,
        paciente_id INTEGER,
        referencia_id INTEGER,
        referencia_tipo TEXT,
        creado_en TEXT DEFAULT CURRENT_TIMESTAMP,
        creado_por TEXT,
        FOREIGN KEY(paciente_id) REFERENCES patients(id)
      )
    `);
    console.log("✅ Tabla de finanzas creada");

    db.all(
      `SELECT id, observaciones FROM patients WHERE observaciones IS NOT NULL AND TRIM(observaciones) != ''`,
      [],
      (err, rows) => {
        if (err) {
          console.error("❌ Error leyendo observaciones antiguas:", err.message);
          return;
        }

        (rows || []).forEach((r) => {
          db.get(
            `SELECT COUNT(*) as count FROM patient_observaciones WHERE paciente_id = ?`,
            [r.id],
            (countErr, countRow) => {
              if (countErr) {
                console.error("❌ Error verificando observaciones por paciente:", countErr.message);
                return;
              }

              if ((countRow?.count || 0) > 0) return;

              const creadoEn = new Date()
                .toLocaleString("sv-SE", { timeZone: "America/Lima" })
                .replace("T", " ")
                .slice(0, 19);

              db.run(
                `INSERT INTO patient_observaciones (paciente_id, texto, creado_en) VALUES (?, ?, ?)`,
                [r.id, String(r.observaciones), creadoEn],
                (insErr) => {
                  if (insErr) {
                    console.error("❌ Error migrando observación antigua:", insErr.message);
                  }
                }
              );
            }
          );
        });
      }
    );

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

    db.run(`
      CREATE TABLE IF NOT EXISTS productos_base (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT NOT NULL,
        categoria TEXT,
        descripcion TEXT
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS variantes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        producto_base_id INTEGER NOT NULL,
        nombre TEXT NOT NULL,
        laboratorio TEXT,
        sku TEXT,
        unidad_base TEXT NOT NULL,
        contenido_por_presentacion REAL NOT NULL,
        es_medico INTEGER NOT NULL DEFAULT 0,
        costo_unitario REAL,
        precio_unitario REAL,
        stock_minimo_unidades REAL DEFAULT 0,
        FOREIGN KEY(producto_base_id) REFERENCES productos_base(id)
      )
    `);

    [
      ["laboratorio", "TEXT"],
      ["precio_cliente", "REAL"],
    ].forEach(([column, definition]) =>
      ensureColumnExists("variantes", column, definition)
    );

    db.run(`
      CREATE TABLE IF NOT EXISTS stock_lotes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        variante_id INTEGER NOT NULL,
        lote TEXT,
        fecha_vencimiento TEXT,
        ubicacion TEXT,
        cantidad_unidades REAL NOT NULL,
        creado_en TEXT DEFAULT CURRENT_TIMESTAMP,
        actualizado_en TEXT,
        FOREIGN KEY(variante_id) REFERENCES variantes(id)
      )
    `);

    [
      ["cantidad_reservada_unidades", "REAL NOT NULL DEFAULT 0"],
      ["condicion_almacenamiento", "TEXT"],
      ["estado", "TEXT NOT NULL DEFAULT 'Disponible'"],
      ["documento_pdf", "TEXT"],
    ].forEach(([column, definition]) =>
      ensureColumnExists("stock_lotes", column, definition)
    );

    db.run(`
      CREATE TABLE IF NOT EXISTS movimientos_inventario (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tipo TEXT NOT NULL,
        motivo TEXT,
        fecha TEXT DEFAULT CURRENT_TIMESTAMP,
        referencia_tipo TEXT,
        referencia_id INTEGER,
        usuario TEXT
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS movimientos_detalle (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        movimiento_id INTEGER NOT NULL,
        variante_id INTEGER NOT NULL,
        stock_lote_id INTEGER,
        cantidad_unidades REAL NOT NULL,
        costo_unitario REAL,
        FOREIGN KEY(movimiento_id) REFERENCES movimientos_inventario(id),
        FOREIGN KEY(variante_id) REFERENCES variantes(id),
        FOREIGN KEY(stock_lote_id) REFERENCES stock_lotes(id)
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS recetas_tratamiento (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tratamiento_id INTEGER NOT NULL,
        variante_id INTEGER NOT NULL,
        cantidad_unidades REAL NOT NULL,
        unidad_mostrada TEXT,
        obligatorio INTEGER DEFAULT 1,
        FOREIGN KEY(tratamiento_id) REFERENCES tratamientos(id),
        FOREIGN KEY(variante_id) REFERENCES variantes(id)
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
app.use("/api/paquetes", paquetesRoutes);
app.use("/api/deudas", deudasRoutes);
app.use("/api/especialistas", especialistasRoutes);
app.use("/api/finanzas", finanzasRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/stats", statsRoutes);
app.use("/api/backup", backupRoutes);
app.use("/api/whatsapp", whatsappRoutes);
app.use("/uploads/docs", express.static("uploads/docs"));

// ✅ Servir frontend (React build) para acceso remoto (ej. iPad/iPhone)
const frontendBuildPath = path.join(__dirname, "..", "frontend", "build");
app.use(express.static(frontendBuildPath));
app.get(/^(?!\/api\/)(?!\/uploads\/).*/, (req, res) => {
  res.sendFile(path.join(frontendBuildPath, "index.html"));
});


// ✅ Servidor en puerto configurable (default 4000)
const PORT = process.env.PORT || 4000;
app.listen(PORT, "0.0.0.0", () =>
  console.log(`🚀 Servidor backend disponible en red en http://0.0.0.0:${PORT}`)
);
