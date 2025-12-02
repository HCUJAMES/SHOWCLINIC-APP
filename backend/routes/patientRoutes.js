import express from "express";
import sqlite3 from "sqlite3";
import bodyParser from "body-parser";
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
// ✅ Editar paciente
router.put("/editar/:id", (req, res) => {
  const {
    dni,
    nombre,
    apellido,
    edad,
    sexo,
    direccion,
    ocupacion,
    fechaNacimiento,
    ciudadNacimiento,
    ciudadResidencia,
    alergias,
    enfermedad,
    correo,
    celular,
    cirugiaEstetica,
    drogas,
    tabaco,
    alcohol,
    referencia,
  } = req.body;

  const id = req.params.id;

  const query = `
    UPDATE patients
    SET dni=?, nombre=?, apellido=?, edad=?, sexo=?, direccion=?, ocupacion=?,
        fechaNacimiento=?, ciudadNacimiento=?, ciudadResidencia=?, alergias=?, enfermedad=?,
        correo=?, celular=?, cirugiaEstetica=?, drogas=?, tabaco=?, alcohol=?, referencia=?
    WHERE id=?
  `;

  db.run(
    query,
    [
      dni,
      nombre,
      apellido,
      edad,
      sexo,
      direccion,
      ocupacion,
      fechaNacimiento,
      ciudadNacimiento,
      ciudadResidencia,
      alergias,
      enfermedad,
      correo,
      celular,
      cirugiaEstetica,
      drogas,
      tabaco,
      alcohol,
      referencia,
      id,
    ],
    function (err) {
      if (err) {
        console.error("❌ Error al editar paciente:", err.message);
        return res.status(500).json({ message: "Error al editar paciente" });
      }
      console.log(`✅ Paciente ID ${id} actualizado correctamente`);
      res.json({ message: "Paciente actualizado correctamente" });
    }
  );
});

// ✅ Registrar paciente
router.post("/registrar", (req, res) => {
  const {
    dni,
    nombre,
    apellido,
    edad,
    sexo,
    direccion,
    ocupacion,
    fechaNacimiento,
    ciudadNacimiento,
    ciudadResidencia,
    alergias,
    enfermedad,
    correo,
    celular,
    cirugiaEstetica,
    drogas,
    tabaco,
    alcohol,
    referencia,
  } = req.body;

  const query = `
    INSERT INTO patients (
      dni, nombre, apellido, edad, sexo, direccion, ocupacion,
      fechaNacimiento, ciudadNacimiento, ciudadResidencia,
      alergias, enfermedad, correo, celular,
      cirugiaEstetica, drogas, tabaco, alcohol, referencia
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `;

  db.run(
    query,
    [
      dni,
      nombre,
      apellido,
      edad,
      sexo,
      direccion,
      ocupacion,
      fechaNacimiento,
      ciudadNacimiento,
      ciudadResidencia,
      alergias,
      enfermedad,
      correo,
      celular,
      cirugiaEstetica,
      drogas,
      tabaco,
      alcohol,
      referencia,
    ],
    function (err) {
      if (err) {
        console.error("❌ Error al registrar paciente:", err);
        return res.status(500).json({ message: "Error al registrar paciente" });
      }
      console.log("✅ Paciente registrado:", nombre, apellido);
      res.json({ message: "Paciente registrado exitosamente" });
    }
  );
});

// ✅ Listar pacientes
router.get("/listar", (req, res) => {
  const query = "SELECT * FROM patients ORDER BY id DESC";
  db.all(query, [], (err, rows) => {
    if (err) {
      console.error("❌ Error al listar pacientes:", err);
      return res.status(500).json({ message: "Error al listar pacientes" });
    }
    res.json(rows);
  });
});

// ✅ Buscar pacientes por nombre o DNI
router.get("/buscar", (req, res) => {
  const { term } = req.query;
  const query = `
    SELECT * FROM patients
    WHERE nombre LIKE ? OR apellido LIKE ? OR dni LIKE ?
    ORDER BY id DESC
  `;
  const value = `%${term}%`;
  db.all(query, [value, value, value], (err, rows) => {
    if (err) {
      console.error("❌ Error al buscar pacientes:", err);
      return res.status(500).json({ message: "Error al buscar pacientes" });
    }
    res.json(rows);
  });
});
// 📋 Obtener historial clínico completo de un paciente
router.get("/:id/historial", (req, res) => {
  const { id } = req.params;

  const query = `
    SELECT tr.id, tr.fecha, tr.sesion, t.nombre AS tratamiento, 
           tr.productos, tr.cantidad_total, tr.precio_total,
           tr.descuento, tr.pagoMetodo, tr.fotosAntes, tr.fotosDespues
    FROM tratamientos_realizados tr
    LEFT JOIN tratamientos t ON tr.tratamiento_id = t.id
    WHERE tr.paciente_id = ?
    ORDER BY tr.fecha DESC
  `;

  db.all(query, [id], (err, rows) => {
    if (err) {
      console.error("❌ Error al obtener historial:", err.message);
      return res.status(500).json({ message: "Error al obtener historial" });
    }
    res.json(rows);
  });
});


export default router;
