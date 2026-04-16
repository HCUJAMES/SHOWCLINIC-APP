import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import db from "../db/database.js";
import { authMiddleware, requireDoctor } from "../middleware/auth.js";

const router = express.Router();

// Configuración de multer para subir fotos de perfil
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/especialistas';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'perfil-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowedExt = /\.(jpe?g|png|gif|webp|heic|heif|bmp|tiff?)$/i;
    const allowedMime = /^image\//i;
    const extOk = allowedExt.test(path.extname(file.originalname));
    const mimeOk = allowedMime.test(file.mimetype);
    if (extOk || mimeOk) {
      return cb(null, true);
    }
    cb(new Error('Solo se permiten archivos de imagen'));
  }
});

// Función para formatear nombre de especialista a formato correcto
// Ej: "ERICK SPETIA" -> "Erick Spetia", "dr. erick spetia" -> "Dr. Erick Spetia"
function formatNombreEspecialista(nombre) {
  if (!nombre) return nombre;
  const trimmed = nombre.trim().replace(/\s+/g, ' ');
  
  const palabras = trimmed.split(' ');
  const prefijos = ['dr.', 'dra.', 'dr', 'dra', 'lic.', 'lic', 'ing.', 'ing'];
  
  const formateadas = palabras.map((palabra, index) => {
    const lower = palabra.toLowerCase();
    // Mantener prefijos con formato correcto
    if (index === 0 && prefijos.includes(lower)) {
      // Capitalizar prefijo: dr. -> Dr., dra -> Dra.
      let prefijo = lower.charAt(0).toUpperCase() + lower.slice(1);
      if (!prefijo.endsWith('.')) prefijo += '.';
      return prefijo;
    }
    // Title case: primera letra mayúscula, resto minúscula
    if (palabra.length === 0) return palabra;
    return palabra.charAt(0).toUpperCase() + palabra.slice(1).toLowerCase();
  });
  
  return formateadas.join(' ');
}

// ✅ Listar especialistas (requiere autenticación)
router.get("/listar", authMiddleware, (req, res) => {
  db.all("SELECT * FROM especialistas ORDER BY nombre ASC", [], (err, rows) => {
    if (err) {
      console.error("❌ Error al listar especialistas:", err.message);
      return res.status(500).json({ message: "Error al listar especialistas" });
    }
    res.json(rows);
  });
});

// ✅ Crear especialista (solo doctor)
router.post("/crear", authMiddleware, requireDoctor, (req, res) => {
  const { nombre, especialidad, telefono, correo, tipo } = req.body;

  if (!nombre) {
    return res.status(400).json({ message: "El nombre es obligatorio" });
  }

  const tipoEspecialista = tipo || 'doctor';

  const query = `
    INSERT INTO especialistas (nombre, especialidad, telefono, correo, tipo)
    VALUES (?, ?, ?, ?, ?)
  `;

  const nombreFormateado = formatNombreEspecialista(nombre);

  db.run(query, [nombreFormateado, especialidad, telefono, correo, tipoEspecialista], function (err) {
    if (err) {
      console.error("❌ Error al crear especialista:", err.message);
      return res.status(500).json({ message: "Error al crear especialista" });
    }

    console.log(`✅ Especialista creado con ID ${this.lastID}`);
    res.json({ id: this.lastID, nombre: nombreFormateado, especialidad, telefono, correo, tipo: tipoEspecialista });
  });
});

// ✅ Eliminar especialista (solo doctor)
router.delete("/eliminar/:id", authMiddleware, requireDoctor, (req, res) => {
  const { id } = req.params;
  db.run("DELETE FROM especialistas WHERE id = ?", [id], function (err) {
    if (err) {
      console.error("❌ Error al eliminar especialista:", err.message);
      return res.status(500).json({ message: "Error al eliminar especialista" });
    }

    if (this.changes === 0) {
      return res.status(404).json({ message: "Especialista no encontrado" });
    }

    console.log(`🗑️ Especialista ID ${id} eliminado`);
    res.json({ message: "Especialista eliminado correctamente" });
  });
});

// ✅ Normalizar nombres de todos los especialistas existentes (solo doctor)
router.post("/normalizar", authMiddleware, requireDoctor, (req, res) => {
  db.all("SELECT id, nombre FROM especialistas", [], (err, rows) => {
    if (err) {
      console.error("❌ Error al obtener especialistas para normalizar:", err.message);
      return res.status(500).json({ message: "Error al normalizar especialistas" });
    }

    let actualizados = 0;
    let errores = 0;
    const total = rows.length;

    if (total === 0) {
      return res.json({ message: "No hay especialistas para normalizar", actualizados: 0 });
    }

    let procesados = 0;
    function checkDone() {
      procesados++;
      if (procesados === total) {
        console.log(`📋 Normalización completada: ${actualizados} actualizados, ${errores} errores de ${total} total`);
        res.json({ message: "Normalización completada", actualizados, errores, total });
      }
    }

    rows.forEach((row) => {
      const nombreFormateado = formatNombreEspecialista(row.nombre);
      if (nombreFormateado !== row.nombre) {
        db.run("UPDATE especialistas SET nombre = ? WHERE id = ?", [nombreFormateado, row.id], (updateErr) => {
          if (updateErr) {
            console.error(`❌ Error actualizando especialista ID ${row.id}:`, updateErr.message);
            errores++;
          } else {
            console.log(`✅ Normalizado: "${row.nombre}" -> "${nombreFormateado}"`);
            actualizados++;
          }
          checkDone();
        });
      } else {
        checkDone();
      }
    });
  });
});

// ✅ Actualizar comisión y pago fijo de un especialista (solo doctor)
router.put("/comision/:id", authMiddleware, requireDoctor, (req, res) => {
  const { id } = req.params;
  const { comision_porcentaje, pago_fijo } = req.body;

  const comision = comision_porcentaje != null ? Number(comision_porcentaje) : null;
  const fijo = pago_fijo != null ? Number(pago_fijo) : null;

  if (comision !== null && (isNaN(comision) || comision < 0 || comision > 100)) {
    return res.status(400).json({ message: "Comisión debe ser entre 0 y 100" });
  }

  if (fijo !== null && (isNaN(fijo) || fijo < 0)) {
    return res.status(400).json({ message: "Pago fijo debe ser mayor o igual a 0" });
  }

  const updates = [];
  const params = [];

  if (comision !== null) {
    updates.push("comision_porcentaje = ?");
    params.push(comision);
  }
  if (fijo !== null) {
    updates.push("pago_fijo = ?");
    params.push(fijo);
  }

  if (updates.length === 0) {
    return res.status(400).json({ message: "No se enviaron datos para actualizar" });
  }

  params.push(id);

  db.run(
    `UPDATE especialistas SET ${updates.join(", ")} WHERE id = ?`,
    params,
    function (err) {
      if (err) {
        console.error("❌ Error al actualizar comisión:", err.message);
        return res.status(500).json({ message: "Error al actualizar comisión" });
      }

      if (this.changes === 0) {
        return res.status(404).json({ message: "Especialista no encontrado" });
      }

      console.log(`✅ Comisión actualizada para especialista ID ${id}`);
      res.json({ message: "Comisión actualizada correctamente" });
    }
  );
});

// ✅ Obtener datos completos de un especialista
router.get("/:id", authMiddleware, (req, res) => {
  const { id } = req.params;
  
  db.get("SELECT * FROM especialistas WHERE id = ?", [id], (err, row) => {
    if (err) {
      console.error("❌ Error al obtener especialista:", err.message);
      return res.status(500).json({ message: "Error al obtener especialista" });
    }
    
    if (!row) {
      return res.status(404).json({ message: "Especialista no encontrado" });
    }
    
    res.json(row);
  });
});

// ✅ Actualizar datos completos de un especialista
router.put("/:id", authMiddleware, requireDoctor, (req, res) => {
  const { id } = req.params;
  const { 
    nombre,
    apellido,
    dni, 
    especialidad, 
    fecha_ingreso, 
    tipo_contrato, 
    metodo_pago, 
    sueldo_fijo,
    pago_fijo,
    comision_porcentaje, 
    cuenta_bancaria 
  } = req.body;

  const updates = [];
  const params = [];

  if (nombre !== undefined) {
    updates.push("nombre = ?");
    const nombreCompleto = apellido ? `${nombre} ${apellido}` : nombre;
    params.push(formatNombreEspecialista(nombreCompleto));
  }
  if (dni !== undefined) {
    updates.push("dni = ?");
    params.push(dni);
  }
  if (especialidad !== undefined) {
    updates.push("especialidad = ?");
    params.push(especialidad);
  }
  if (fecha_ingreso !== undefined) {
    updates.push("fecha_ingreso = ?");
    params.push(fecha_ingreso);
  }
  if (tipo_contrato !== undefined) {
    updates.push("tipo_contrato = ?");
    params.push(tipo_contrato);
  }
  if (metodo_pago !== undefined) {
    updates.push("metodo_pago = ?");
    params.push(metodo_pago);
  }
  if (sueldo_fijo !== undefined || pago_fijo !== undefined) {
    updates.push("pago_fijo = ?");
    params.push(Number(pago_fijo || sueldo_fijo));
  }
  if (comision_porcentaje !== undefined) {
    updates.push("comision_porcentaje = ?");
    params.push(Number(comision_porcentaje));
  }
  if (cuenta_bancaria !== undefined) {
    updates.push("cuenta_bancaria = ?");
    params.push(cuenta_bancaria);
  }

  if (updates.length === 0) {
    return res.status(400).json({ message: "No se enviaron datos para actualizar" });
  }

  params.push(id);

  db.run(
    `UPDATE especialistas SET ${updates.join(", ")} WHERE id = ?`,
    params,
    function (err) {
      if (err) {
        console.error("❌ Error al actualizar especialista:", err.message);
        return res.status(500).json({ message: "Error al actualizar especialista" });
      }

      if (this.changes === 0) {
        return res.status(404).json({ message: "Especialista no encontrado" });
      }

      console.log(`✅ Datos actualizados para especialista ID ${id}`);
      res.json({ message: "Datos actualizados correctamente" });
    }
  );
});

// ✅ Subir foto de perfil de un especialista
router.post("/:id/foto", authMiddleware, requireDoctor, (req, res) => {
  upload.single('foto')(req, res, (multerErr) => {
    if (multerErr) {
      console.error("❌ Error multer al subir foto:", multerErr.message);
      return res.status(400).json({ message: multerErr.message || "Error al subir archivo" });
    }

    const { id } = req.params;

    if (!req.file) {
      return res.status(400).json({ message: "No se recibió ninguna foto" });
    }

    const fotoUrl = `/uploads/especialistas/${req.file.filename}`;

    db.run(
      "UPDATE especialistas SET foto_perfil = ? WHERE id = ?",
      [fotoUrl, id],
      function (err) {
        if (err) {
          console.error("❌ Error al actualizar foto:", err.message);
          try { fs.unlinkSync(req.file.path); } catch (_) {}
          return res.status(500).json({ message: "Error al actualizar foto" });
        }

        if (this.changes === 0) {
          try { fs.unlinkSync(req.file.path); } catch (_) {}
          return res.status(404).json({ message: "Especialista no encontrado" });
        }

        console.log(`✅ Foto actualizada para especialista ID ${id}`);
        res.json({ foto_url: fotoUrl, message: "Foto actualizada correctamente" });
      }
    );
  });
});

export default router;
