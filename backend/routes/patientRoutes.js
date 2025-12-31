import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import db from "../db/database.js";
import { authMiddleware, requirePatientWrite } from "../middleware/auth.js";

const router = express.Router();

router.use(authMiddleware);

const storagePerfil = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = "./uploads/perfiles";
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, `perfil_${Date.now()}${path.extname(file.originalname)}`);
  },
});

const uploadPerfil = multer({ storage: storagePerfil });
// ✅ Editar paciente
router.put("/editar/:id", requirePatientWrite, (req, res) => {
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
    embarazada,
    drogas,
    tabaco,
    alcohol,
    referencia,
    numeroHijos,
  } = req.body;

  const dniStr = typeof dni === "string" ? dni.trim() : String(dni || "").trim();
  const nombreStr = typeof nombre === "string" ? nombre.trim() : String(nombre || "").trim();
  const apellidoStr = typeof apellido === "string" ? apellido.trim() : String(apellido || "").trim();
  const celularStr =
    typeof celular === "string" ? celular.trim() : String(celular || "").trim();

  if (!dniStr || !nombreStr || !apellidoStr || !celularStr) {
    return res.status(400).json({
      message: "DNI, Nombre, Apellido y Celular son obligatorios",
    });
  }

  if (!/^\d{8}$/.test(dniStr)) {
    return res.status(400).json({ message: "El DNI debe tener exactamente 8 dígitos" });
  }

  if (!/^\d{9}$/.test(celularStr)) {
    return res.status(400).json({ message: "El celular debe tener exactamente 9 dígitos" });
  }

  const id = req.params.id;

  const query = `
    UPDATE patients
    SET dni=?, nombre=?, apellido=?, edad=?, sexo=?, direccion=?, ocupacion=?,
        fechaNacimiento=?, ciudadNacimiento=?, ciudadResidencia=?, alergias=?, enfermedad=?,
        correo=?, celular=?, cirugiaEstetica=?, embarazada=?, drogas=?, tabaco=?, alcohol=?, referencia=?, numeroHijos=?
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
      embarazada,
      drogas,
      tabaco,
      alcohol,
      referencia,
      numeroHijos,
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

// ✅ Subir/actualizar foto de perfil del paciente
router.post("/:id/foto-perfil", requirePatientWrite, uploadPerfil.single("foto"), (req, res) => {
  const { id } = req.params;
  if (!req.file) {
    return res.status(400).json({ message: "No se envió ninguna imagen" });
  }

  const rutaPublica = `/uploads/perfiles/${req.file.filename}`;
  db.run(
    `UPDATE patients SET fotoPerfil = ? WHERE id = ?`,
    [rutaPublica, id],
    function (err) {
      if (err) {
        console.error("❌ Error al guardar fotoPerfil:", err.message);
        return res.status(500).json({ message: "Error al guardar foto de perfil" });
      }
      res.json({ message: "Foto de perfil actualizada", fotoPerfil: rutaPublica });
    }
  );
});

// ✅ Registrar paciente
router.post("/registrar", requirePatientWrite, (req, res) => {
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
    embarazada,
    drogas,
    tabaco,
    alcohol,
    referencia,
    numeroHijos,
  } = req.body;

  const query = `
    INSERT INTO patients (
      dni, nombre, apellido, edad, sexo, direccion, ocupacion,
      fechaNacimiento, ciudadNacimiento, ciudadResidencia,
      alergias, enfermedad, correo, celular,
      cirugiaEstetica, embarazada, drogas, tabaco, alcohol, referencia, numeroHijos
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
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
      embarazada,
      drogas,
      tabaco,
      alcohol,
      referencia,
      numeroHijos,
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

// ✅ Editar observación de un paciente
router.put("/:id/observaciones/:observacionId", requirePatientWrite, (req, res) => {
  const { id, observacionId } = req.params;
  const { texto } = req.body;

  const textoTrim = typeof texto === "string" ? texto.trim() : "";
  if (!textoTrim) {
    return res.status(400).json({ message: "La observación no puede estar vacía" });
  }

  const query = `
    UPDATE patient_observaciones
    SET texto = ?
    WHERE id = ? AND paciente_id = ?
  `;

  db.run(query, [textoTrim, observacionId, id], function (err) {
    if (err) {
      console.error("❌ Error al editar observación:", err.message);
      return res.status(500).json({ message: "Error al editar observación" });
    }
    if (this.changes === 0) {
      return res.status(404).json({ message: "Observación no encontrada" });
    }
    res.json({ message: "Observación actualizada correctamente" });
  });
});

// 📋 Listar ofertas ofrecidas de un paciente
router.get("/:id/ofertas", (req, res) => {
  const { id } = req.params;
  const query = `
    SELECT id, paciente_id, items_json, total, creado_en
    FROM patient_ofertas
    WHERE paciente_id = ?
    ORDER BY creado_en DESC, id DESC
  `;

  db.all(query, [id], (err, rows) => {
    if (err) {
      console.error("❌ Error al listar ofertas:", err.message);
      return res.status(500).json({ message: "Error al listar ofertas" });
    }

    const parsed = (rows || []).map((r) => {
      let items = [];
      try {
        items = JSON.parse(r.items_json || "[]");
      } catch {
        items = [];
      }
      return { ...r, items };
    });

    res.json(parsed);
  });
});

// ✅ Crear oferta ofrecida (con fecha/hora Perú)
router.post("/:id/ofertas", requirePatientWrite, (req, res) => {
  const { id } = req.params;
  const { items } = req.body;

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: "Debes seleccionar al menos un tratamiento" });
  }

  const normalized = items
    .map((it) => {
      const tratamientoId = it?.tratamientoId;
      const nombre = typeof it?.nombre === "string" ? it.nombre.trim() : "";
      const precioNum = Number(it?.precio);
      return {
        tratamientoId: tratamientoId !== undefined && tratamientoId !== null ? Number(tratamientoId) : null,
        nombre,
        precio: Number.isFinite(precioNum) ? precioNum : 0,
      };
    })
    .filter((it) => it.nombre);

  if (normalized.length === 0) {
    return res.status(400).json({ message: "Items inválidos" });
  }

  const total = normalized.reduce((sum, it) => sum + (Number(it.precio) || 0), 0);

  const creadoEn = new Date()
    .toLocaleString("sv-SE", { timeZone: "America/Lima" })
    .replace("T", " ")
    .slice(0, 19);

  const query = `
    INSERT INTO patient_ofertas (paciente_id, items_json, total, creado_en)
    VALUES (?, ?, ?, ?)
  `;

  db.run(query, [id, JSON.stringify(normalized), total, creadoEn], function (err) {
    if (err) {
      console.error("❌ Error al crear oferta:", err.message);
      return res.status(500).json({ message: "Error al crear oferta" });
    }

    res.json({
      id: this.lastID,
      paciente_id: Number(id),
      items: normalized,
      total,
      creado_en: creadoEn,
    });
  });
});

// ✅ Editar oferta ofrecida (items y total)
router.put("/:id/ofertas/:ofertaId", requirePatientWrite, (req, res) => {
  const { id, ofertaId } = req.params;
  const { items } = req.body;

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: "Debes seleccionar al menos un tratamiento" });
  }

  const normalized = items
    .map((it) => {
      const tratamientoId = it?.tratamientoId;
      const nombre = typeof it?.nombre === "string" ? it.nombre.trim() : "";
      const precioNum = Number(it?.precio);
      return {
        tratamientoId: tratamientoId !== undefined && tratamientoId !== null ? Number(tratamientoId) : null,
        nombre,
        precio: Number.isFinite(precioNum) ? precioNum : 0,
      };
    })
    .filter((it) => it.nombre);

  if (normalized.length === 0) {
    return res.status(400).json({ message: "Items inválidos" });
  }

  const total = normalized.reduce((sum, it) => sum + (Number(it.precio) || 0), 0);

  const query = `
    UPDATE patient_ofertas
    SET items_json = ?, total = ?
    WHERE id = ? AND paciente_id = ?
  `;

  db.run(query, [JSON.stringify(normalized), total, ofertaId, id], function (err) {
    if (err) {
      console.error("❌ Error al editar oferta:", err.message);
      return res.status(500).json({ message: "Error al editar oferta" });
    }
    if (this.changes === 0) {
      return res.status(404).json({ message: "Oferta no encontrada" });
    }
    res.json({ message: "Oferta actualizada correctamente" });
  });
});

// ✅ Buscar pacientes por nombre o DNI
router.get("/buscar", (req, res) => {
  const { term, tratamientoId, fechaDesde, fechaHasta } = req.query;

  const where = [];
  const params = [];

  const trimmedTerm = typeof term === "string" ? term.trim() : "";
  if (trimmedTerm) {
    const value = `%${trimmedTerm}%`;
    where.push("(nombre LIKE ? OR apellido LIKE ? OR dni LIKE ?)");
    params.push(value, value, value);
  }

  const tratamientoIdNumRaw =
    tratamientoId !== undefined && tratamientoId !== null && String(tratamientoId).trim() !== ""
      ? Number(tratamientoId)
      : null;
  const tratamientoIdNum = Number.isFinite(tratamientoIdNumRaw) ? tratamientoIdNumRaw : null;

  const fechaDesdeStr = typeof fechaDesde === "string" ? fechaDesde.trim() : "";
  const fechaHastaStr = typeof fechaHasta === "string" ? fechaHasta.trim() : "";
  const fechaDesdeSql = fechaDesdeStr ? `${fechaDesdeStr} 00:00:00` : "";
  const fechaHastaSql = fechaHastaStr ? `${fechaHastaStr} 23:59:59` : "";

  if (tratamientoIdNum || fechaDesdeSql || fechaHastaSql) {
    const existsWhere = ["tr.paciente_id = patients.id"];
    const existsParams = [];

    if (tratamientoIdNum) {
      existsWhere.push("tr.tratamiento_id = ?");
      existsParams.push(tratamientoIdNum);
    }

    if (fechaDesdeSql) {
      existsWhere.push("tr.fecha >= ?");
      existsParams.push(fechaDesdeSql);
    }

    if (fechaHastaSql) {
      existsWhere.push("tr.fecha <= ?");
      existsParams.push(fechaHastaSql);
    }

    where.push(
      `EXISTS (
        SELECT 1
        FROM tratamientos_realizados tr
        WHERE ${existsWhere.join(" AND ")}
      )`
    );
    params.push(...existsParams);
  }

  const query = `
    SELECT *
    FROM patients
    ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
    ORDER BY id DESC
  `;

  db.all(query, params, (err, rows) => {
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

// ✅ Obtener un paciente por ID
router.get("/:id", (req, res) => {
  const { id } = req.params;
  const query = "SELECT * FROM patients WHERE id = ?";
  db.get(query, [id], (err, row) => {
    if (err) {
      console.error("❌ Error al obtener paciente:", err);
      return res.status(500).json({ message: "Error al obtener paciente" });
    }
    if (!row) {
      return res.status(404).json({ message: "Paciente no encontrado" });
    }
    res.json(row);
  });
});

// 📋 Listar observaciones de un paciente
router.get("/:id/observaciones", (req, res) => {
  const { id } = req.params;
  const query = `
    SELECT id, paciente_id, texto, creado_en
    FROM patient_observaciones
    WHERE paciente_id = ?
    ORDER BY creado_en DESC, id DESC
  `;

  db.all(query, [id], (err, rows) => {
    if (err) {
      console.error("❌ Error al listar observaciones:", err.message);
      return res.status(500).json({ message: "Error al listar observaciones" });
    }
    res.json(rows || []);
  });
});

// ✅ Agregar observación a un paciente (con fecha/hora Perú)
router.post("/:id/observaciones", requirePatientWrite, (req, res) => {
  const { id } = req.params;
  const { texto } = req.body;

  const textoTrim = typeof texto === "string" ? texto.trim() : "";
  if (!textoTrim) {
    return res.status(400).json({ message: "La observación no puede estar vacía" });
  }

  const creadoEn = new Date()
    .toLocaleString("sv-SE", { timeZone: "America/Lima" })
    .replace("T", " ")
    .slice(0, 19);

  const query = `
    INSERT INTO patient_observaciones (paciente_id, texto, creado_en)
    VALUES (?, ?, ?)
  `;

  db.run(query, [id, textoTrim, creadoEn], function (err) {
    if (err) {
      console.error("❌ Error al crear observación:", err.message);
      return res.status(500).json({ message: "Error al crear observación" });
    }
    res.json({ id: this.lastID, paciente_id: Number(id), texto: textoTrim, creado_en: creadoEn });
  });
});

// ✅ Actualizar observaciones de un paciente
router.put("/:id/observaciones", requirePatientWrite, (req, res) => {
  const { id } = req.params;
  const { observaciones } = req.body;

  const query = `UPDATE patients SET observaciones = ? WHERE id = ?`;
  db.run(query, [observaciones ?? "", id], function (err) {
    if (err) {
      console.error("❌ Error al actualizar observaciones:", err.message);
      return res.status(500).json({ message: "Error al actualizar observaciones" });
    }
    res.json({ message: "Observaciones actualizadas correctamente" });
  });
});


export default router;
