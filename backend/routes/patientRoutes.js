import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import db, { dbGet, dbRun, dbAll } from "../db/database.js";
import { authMiddleware, requirePatientWrite, requireRole } from "../middleware/auth.js";

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

const storageFotosPaciente = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = "./uploads/fotos-paciente";
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, `foto_${Date.now()}_${Math.round(Math.random() * 1e4)}${path.extname(file.originalname)}`);
  },
});
const uploadFotosPaciente = multer({ storage: storageFotosPaciente });
// ✅ Editar paciente
router.put("/editar/:id", requirePatientWrite, (req, res) => {
  const {
    tipoDocumento,
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
    referenciaDetalle,
    numeroHijos,
    especial,
  } = req.body;

  const dniStr = typeof dni === "string" ? dni.trim() : String(dni || "").trim();
  const nombreStr = typeof nombre === "string" ? nombre.trim() : String(nombre || "").trim();
  const apellidoStr = typeof apellido === "string" ? apellido.trim() : String(apellido || "").trim();
  const celularStr =
    typeof celular === "string" ? celular.trim() : String(celular || "").trim();

  if (!dniStr || !nombreStr || !apellidoStr || !celularStr) {
    const camposFaltantes = [];
    if (!dniStr) camposFaltantes.push("DNI");
    if (!nombreStr) camposFaltantes.push("Nombre");
    if (!apellidoStr) camposFaltantes.push("Apellido");
    if (!celularStr) camposFaltantes.push("Celular");
    return res.status(400).json({
      message: `Campos obligatorios vacíos: ${camposFaltantes.join(", ")}`,
    });
  }

  // Validación flexible según tipo de documento
  if (tipoDocumento === 'DNI' && !/^\d{8}$/.test(dniStr)) {
    return res.status(400).json({ message: "El DNI debe tener exactamente 8 dígitos" });
  }

  if (!/^\d{9}$/.test(celularStr)) {
    return res.status(400).json({ message: "El celular debe tener exactamente 9 dígitos" });
  }

  const id = req.params.id;

  const query = `
    UPDATE patients
    SET tipoDocumento=?, dni=?, nombre=?, apellido=?, edad=?, sexo=?, direccion=?, ocupacion=?,
        fechaNacimiento=?, ciudadNacimiento=?, ciudadResidencia=?, alergias=?, enfermedad=?,
        correo=?, celular=?, cirugiaEstetica=?, embarazada=?, drogas=?, tabaco=?, alcohol=?, referencia=?, referenciaDetalle=?, numeroHijos=?, especial=?
    WHERE id=?
  `;

  db.run(
    query,
    [
      tipoDocumento || 'DNI',
      dniStr,
      nombreStr,
      apellidoStr,
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
      celularStr,
      cirugiaEstetica,
      embarazada,
      drogas,
      tabaco,
      alcohol,
      referencia,
      referenciaDetalle,
      numeroHijos,
      especial ? 1 : 0,
      id,
    ],
    function (err) {
      if (err) {
        console.error("❌ Error al editar paciente:", err.message);
        return res.status(500).json({ message: "Error al editar paciente: " + err.message });
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
    tipoDocumento,
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
    referenciaDetalle,
    numeroHijos,
    especial,
  } = req.body;

  const query = `
    INSERT INTO patients (
      tipoDocumento, dni, nombre, apellido, edad, sexo, direccion, ocupacion,
      fechaNacimiento, ciudadNacimiento, ciudadResidencia,
      alergias, enfermedad, correo, celular,
      cirugiaEstetica, embarazada, drogas, tabaco, alcohol, referencia, referenciaDetalle, numeroHijos, especial
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `;

  db.run(
    query,
    [
      tipoDocumento || 'DNI',
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
      referenciaDetalle,
      numeroHijos,
      especial ? 1 : 0,
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

/**
 * Fecha y hora de Lima (UTC−5) en formato "YYYY-MM-DD HH:MM:SS".
 *
 * CURRENT_TIMESTAMP de SQLite guarda en UTC, así que una marca hecha por la
 * tarde en la clínica quedaba registrada con la fecha del día siguiente.
 */
const ahoraLima = () =>
  new Date().toLocaleString("sv-SE", { timeZone: "America/Lima" }).replace("T", " ").slice(0, 19);

/**
 * Marca de "ya saludé por su cumpleaños".
 *
 * El cumpleaños se repite cada año, así que la marca se guarda por paciente y
 * año: saludar en 2026 no oculta el aviso de 2027.
 */
let cumpleanosSchemaReady = false;
async function ensureCumpleanosSchema() {
  if (cumpleanosSchemaReady) return;
  await dbRun(`CREATE TABLE IF NOT EXISTS cumpleanos_saludados (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    paciente_id INTEGER NOT NULL,
    anio INTEGER NOT NULL,
    saludado_en TEXT DEFAULT CURRENT_TIMESTAMP,
    saludado_por TEXT,
    UNIQUE(paciente_id, anio)
  )`);
  cumpleanosSchemaReady = true;
}

/**
 * 🎂 CUMPLEAÑOS DEL MES
 *
 * Lista los pacientes que cumplen años en el mes indicado (por defecto el
 * actual), ordenados por día. Marca cuál es hoy y cuáles ya pasaron, para
 * poder saludar sin revisar fichas una por una.
 *
 * Los ya saludados vienen con `saludado: true` en vez de desaparecer: así la
 * pantalla puede esconderlos pero seguir ofreciendo deshacer la marca.
 *
 * Query: ?mes=1..12 (por defecto el mes en curso, hora Lima)
 */
router.get("/cumpleanos", async (req, res) => {
  try {
    await ensureCumpleanosSchema();

    // Hora de Lima: con UTC, de noche el "mes actual" podía saltar de mes
    const hoyLima = new Date().toLocaleString("sv-SE", { timeZone: "America/Lima" }).slice(0, 10);
    const [anioHoy, mesHoy, diaHoy] = hoyLima.split("-").map(Number);

    const mes = Math.min(12, Math.max(1, parseInt(req.query.mes, 10) || mesHoy));
    const mesStr = String(mes).padStart(2, "0");

    const filas = await dbAll(
      `SELECT id, nombre, apellido, dni, celular, fechaNacimiento
       FROM patients
       WHERE fechaNacimiento IS NOT NULL AND fechaNacimiento <> ''
         AND strftime('%m', fechaNacimiento) = ?
       ORDER BY CAST(strftime('%d', fechaNacimiento) AS INTEGER) ASC`,
      [mesStr]
    );

    // Saludos ya registrados de este año
    const marcas = await dbAll(
      `SELECT id, paciente_id, saludado_en FROM cumpleanos_saludados WHERE anio = ?`,
      [anioHoy]
    );
    const porPaciente = new Map(marcas.map((m) => [m.paciente_id, m]));

    const cumpleanos = filas.map((f) => {
      const dia = Number(String(f.fechaNacimiento).slice(8, 10));
      const anioNac = Number(String(f.fechaNacimiento).slice(0, 4));
      // Edad que cumple este año
      const edad = anioNac > 1900 ? anioHoy - anioNac : null;

      const esHoy = mes === mesHoy && dia === diaHoy;
      const yaPaso = mes < mesHoy || (mes === mesHoy && dia < diaHoy);
      const marca = porPaciente.get(f.id);

      return {
        paciente_id: f.id,
        nombre: f.nombre,
        apellido: f.apellido,
        dni: f.dni,
        celular: f.celular,
        fecha_nacimiento: f.fechaNacimiento,
        dia,
        edad,
        es_hoy: esHoy,
        ya_paso: yaPaso && !esHoy,
        dias_faltan: mes === mesHoy ? dia - diaHoy : null,
        saludado: !!marca,
        saludado_id: marca?.id || null,
        saludado_en: marca?.saludado_en || null,
      };
    });

    const pendientes = cumpleanos.filter((c) => !c.saludado);

    res.json({
      mes,
      anio: anioHoy,
      mes_actual: mesHoy,
      dia_actual: diaHoy,
      // `total` cuenta solo los que faltan saludar: es lo que se muestra
      total: pendientes.length,
      total_mes: cumpleanos.length,
      saludados: cumpleanos.length - pendientes.length,
      hoy: pendientes.filter((c) => c.es_hoy).length,
      proximos: pendientes.filter((c) => !c.es_hoy && !c.ya_paso).length,
      cumpleanos,
    });
  } catch (err) {
    console.error("❌ Error obteniendo cumpleaños:", err.message);
    res.status(500).json({ message: "Error al obtener cumpleaños" });
  }
});

// ✅ Marcar un cumpleaños como saludado
router.post("/cumpleanos/saludado", async (req, res) => {
  try {
    await ensureCumpleanosSchema();
    const { paciente_id } = req.body;
    if (!paciente_id) return res.status(400).json({ message: "paciente_id es requerido" });

    const anio = Number(
      new Date().toLocaleString("sv-SE", { timeZone: "America/Lima" }).slice(0, 4)
    );
    const anioMarca = parseInt(req.body.anio, 10) || anio;

    await dbRun(
      `INSERT OR IGNORE INTO cumpleanos_saludados (paciente_id, anio, saludado_en, saludado_por)
       VALUES (?, ?, ?, ?)`,
      [paciente_id, anioMarca, ahoraLima(), req.user?.username || "sistema"]
    );
    const fila = await dbGet(
      `SELECT id FROM cumpleanos_saludados WHERE paciente_id = ? AND anio = ?`,
      [paciente_id, anioMarca]
    );
    res.json({ message: "✅ Saludo registrado", id: fila?.id || null });
  } catch (err) {
    console.error("❌ Error marcando saludo:", err.message);
    res.status(500).json({ message: "Error al marcar el saludo" });
  }
});

// ↩️ Deshacer el saludo, por id de la marca
router.delete("/cumpleanos/saludado/:id", async (req, res) => {
  try {
    await ensureCumpleanosSchema();
    await dbRun(`DELETE FROM cumpleanos_saludados WHERE id = ?`, [req.params.id]);
    res.json({ message: "✅ Saludo deshecho" });
  } catch (err) {
    console.error("❌ Error deshaciendo saludo:", err.message);
    res.status(500).json({ message: "Error al deshacer el saludo" });
  }
});

// ↩️ Deshacer el saludo, identificándolo por paciente + año
router.delete("/cumpleanos/saludado", async (req, res) => {
  try {
    await ensureCumpleanosSchema();
    const { paciente_id } = req.body || {};
    if (!paciente_id) return res.status(400).json({ message: "Falta paciente_id" });
    const anio = parseInt(req.body.anio, 10) ||
      Number(new Date().toLocaleString("sv-SE", { timeZone: "America/Lima" }).slice(0, 4));
    await dbRun(`DELETE FROM cumpleanos_saludados WHERE paciente_id = ? AND anio = ?`, [paciente_id, anio]);
    res.json({ message: "✅ Saludo deshecho" });
  } catch (err) {
    console.error("❌ Error deshaciendo saludo:", err.message);
    res.status(500).json({ message: "Error al deshacer el saludo" });
  }
});

/**
 * Marca de "ya se contactó" para un recordatorio.
 * Se guarda junto a la fecha de vencimiento, así el aviso desaparece hasta que
 * llegue el SIGUIENTE ciclo del paciente (no lo silencia para siempre).
 */
let recordatoriosSchemaReady = false;
async function ensureRecordatoriosSchema() {
  if (recordatoriosSchemaReady) return;
  await dbRun(`CREATE TABLE IF NOT EXISTS recordatorios_contactados (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    paciente_id INTEGER NOT NULL,
    tratamiento TEXT NOT NULL,
    proxima_fecha TEXT NOT NULL,
    contactado_en TEXT DEFAULT CURRENT_TIMESTAMP,
    contactado_por TEXT,
    UNIQUE(paciente_id, tratamiento, proxima_fecha)
  )`);
  recordatoriosSchemaReady = true;
}

// ✅ Marcar un recordatorio como contactado
router.post("/recordatorios/contactado", async (req, res) => {
  try {
    await ensureRecordatoriosSchema();
    const { paciente_id, tratamiento, proxima_fecha } = req.body;
    if (!paciente_id || !tratamiento || !proxima_fecha) {
      return res.status(400).json({ message: "paciente_id, tratamiento y proxima_fecha son requeridos" });
    }
    await dbRun(
      `INSERT OR IGNORE INTO recordatorios_contactados
        (paciente_id, tratamiento, proxima_fecha, contactado_en, contactado_por)
       VALUES (?, ?, ?, ?, ?)`,
      [paciente_id, tratamiento, String(proxima_fecha).slice(0, 10), ahoraLima(), req.user?.username || "sistema"]
    );
    // Se devuelve el id para poder deshacer la marca sin recargar la lista
    const fila = await dbGet(
      `SELECT id FROM recordatorios_contactados
       WHERE paciente_id = ? AND tratamiento = ? AND proxima_fecha = ?`,
      [paciente_id, tratamiento, String(proxima_fecha).slice(0, 10)]
    );
    res.json({ message: "✅ Contacto registrado", id: fila?.id || null });
  } catch (err) {
    console.error("❌ Error marcando contacto:", err.message);
    res.status(500).json({ message: "Error al marcar el contacto" });
  }
});

// ↩️ Deshacer la marca de contactado, por id de la marca
router.delete("/recordatorios/contactado/:id", async (req, res) => {
  try {
    await ensureRecordatoriosSchema();
    await dbRun(`DELETE FROM recordatorios_contactados WHERE id = ?`, [req.params.id]);
    res.json({ message: "✅ Marca de contacto retirada" });
  } catch (err) {
    console.error("❌ Error deshaciendo contacto:", err.message);
    res.status(500).json({ message: "Error al deshacer el contacto" });
  }
});

// ↩️ Deshacer la marca de contactado, identificándola por sus tres campos
router.delete("/recordatorios/contactado", async (req, res) => {
  try {
    await ensureRecordatoriosSchema();
    const { paciente_id, tratamiento, proxima_fecha } = req.body || {};
    await dbRun(
      `DELETE FROM recordatorios_contactados
       WHERE paciente_id = ? AND tratamiento = ? AND proxima_fecha = ?`,
      [paciente_id, tratamiento, String(proxima_fecha || "").slice(0, 10)]
    );
    res.json({ message: "✅ Marca de contacto retirada" });
  } catch (err) {
    console.error("❌ Error deshaciendo contacto:", err.message);
    res.status(500).json({ message: "Error al deshacer el contacto" });
  }
});

/**
 * 🔔 RECORDATORIOS DE RETOQUE
 *
 * Cada tratamiento tiene su ciclo: la toxina botulínica (botox, modulaciones)
 * se repite cada 4 meses y el resto cada 10 meses. Este endpoint calcula,
 * para cada paciente y tratamiento, cuándo toca repetirlo y devuelve los que
 * ya vencieron o están por vencer, para avisar en el dashboard.
 *
 * Query: ?dias=45 (ventana de aviso) & ?limite=20
 */
router.get("/recordatorios", async (req, res) => {
  try {
    await ensureRecordatoriosSchema();
    const ventanaDias = Math.max(1, parseInt(req.query.dias, 10) || 45);
    const limite = Math.max(1, parseInt(req.query.limite, 10) || 25);

    // Última vez que se hizo cada tratamiento, por paciente
    const filas = await dbAll(`
      SELECT
        pa.paciente_id,
        p.nombre, p.apellido, p.dni, p.celular,
        ps.tratamiento_nombre,
        MAX(DATE(ps.fecha_realizada)) AS ultima_fecha
      FROM presupuestos_sesiones ps
      JOIN presupuestos_asignados pa ON pa.id = ps.presupuesto_asignado_id
      JOIN patients p ON p.id = pa.paciente_id
      WHERE ps.estado = 'completada' AND ps.fecha_realizada IS NOT NULL
      GROUP BY pa.paciente_id, ps.tratamiento_nombre
    `);

    // Cada cuántos meses toca repetir el tratamiento.
    // La toxina se registra en la clínica como "botox", "toxina" o "modulación".
    const MESES_TOXINA = 4;
    const MESES_RESTO = 10;

    const esToxina = (nombre = "") => {
      const t = String(nombre).toLowerCase();
      return t.includes("botox") || t.includes("toxina") || t.includes("modulaci");
    };

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const candidatos = [];
    for (const f of filas) {
      if (!f.ultima_fecha) continue;
      const meses = esToxina(f.tratamiento_nombre) ? MESES_TOXINA : MESES_RESTO;

      const ultima = new Date(`${f.ultima_fecha}T00:00:00`);
      if (isNaN(ultima)) continue;
      const proxima = new Date(ultima);
      proxima.setMonth(proxima.getMonth() + meses);

      const diasRestantes = Math.round((proxima - hoy) / 86400000);
      if (diasRestantes > ventanaDias) continue; // todavía falta mucho

      candidatos.push({
        paciente_id: f.paciente_id,
        nombre: f.nombre,
        apellido: f.apellido,
        dni: f.dni,
        celular: f.celular,
        tratamiento: f.tratamiento_nombre,
        tipo: esToxina(f.tratamiento_nombre) ? "toxina" : "general",
        ciclo_meses: meses,
        ultima_fecha: f.ultima_fecha,
        proxima_fecha: proxima.toISOString().slice(0, 10),
        dias_restantes: diasRestantes,          // negativo = ya venció
        vencido: diasRestantes < 0,
      });
    }

    // Quitar a los pacientes ya contactados hace poco.
    // El aviso es sobre la PERSONA: si ya se le llamó, no debe reaparecer por
    // otro de sus tratamientos. Vuelve a la lista pasados 60 días.
    const DIAS_SILENCIO = 60;
    const contactados = await dbAll(
      `SELECT paciente_id, MAX(DATE(contactado_en)) AS ultimo
       FROM recordatorios_contactados GROUP BY paciente_id`
    );
    const silenciados = new Set();
    for (const c of contactados) {
      if (!c.ultimo) continue;
      const dias = Math.round((hoy - new Date(`${c.ultimo}T00:00:00`)) / 86400000);
      if (dias <= DIAS_SILENCIO) silenciados.add(c.paciente_id);
    }

    // Un aviso por paciente: el tratamiento más urgente
    const porPaciente = new Map();
    for (const c of candidatos) {
      if (silenciados.has(c.paciente_id)) continue;
      const prev = porPaciente.get(c.paciente_id);
      if (!prev || c.dias_restantes < prev.dias_restantes) porPaciente.set(c.paciente_id, c);
    }

    const lista = Array.from(porPaciente.values())
      .sort((a, b) => a.dias_restantes - b.dias_restantes)
      .slice(0, limite);

    // Los contactados dentro del periodo de silencio se devuelven aparte, para
    // que la pantalla pueda mostrarlos y permitir deshacer la marca.
    const corte = new Date(hoy.getTime() - DIAS_SILENCIO * 86400000)
      .toLocaleString("sv-SE", { timeZone: "America/Lima" }).slice(0, 10);
    const contactadosDetalle = await dbAll(
      `SELECT rc.id, rc.paciente_id, rc.tratamiento, rc.proxima_fecha, rc.contactado_en,
              rc.contactado_por, p.nombre, p.apellido, p.dni, p.celular
       FROM recordatorios_contactados rc
       JOIN patients p ON p.id = rc.paciente_id
       WHERE DATE(rc.contactado_en) >= ?
       ORDER BY rc.contactado_en DESC
       LIMIT 40`,
      [corte]
    );

    res.json({
      total: lista.length,
      vencidos: lista.filter((r) => r.vencido).length,
      proximos: lista.filter((r) => !r.vencido).length,
      ventana_dias: ventanaDias,
      recordatorios: lista,
      contactados: contactadosDetalle,
    });
  } catch (err) {
    console.error("❌ Error calculando recordatorios:", err.message);
    res.status(500).json({ message: "Error al calcular recordatorios" });
  }
});

/* ======================================================================
   🤝 SEGUIMIENTO DE PROFORMAS SIN CERRAR

   Pacientes que vinieron a consulta, se les hizo la proforma y todavía no
   empezaron. La mayoría NO hay que marcarlos a mano: si existe presupuesto
   y ninguna de sus sesiones está completada, es justamente ese caso.

   El marcado manual queda para lo que el sistema no puede deducir: vino a
   consulta y aún no se le hizo proforma.

   Dos acciones distintas a propósito:
     · contactado → vuelve a la lista a los 30 días si sigue sin empezar
     · descartado → dijo que no; no vuelve a aparecer
====================================================================== */
let seguimientoSchemaReady = false;
async function ensureSeguimientoSchema() {
  if (seguimientoSchemaReady) return;
  await dbRun(`CREATE TABLE IF NOT EXISTS seguimiento_pacientes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    paciente_id INTEGER NOT NULL UNIQUE,
    estado TEXT NOT NULL DEFAULT 'pendiente',   -- pendiente | contactado | descartado
    manual INTEGER NOT NULL DEFAULT 0,          -- 1 = lo marcó una persona
    nota TEXT,
    actualizado_en TEXT,
    actualizado_por TEXT
  )`);
  await dbRun(`CREATE INDEX IF NOT EXISTS idx_seguimiento_estado
               ON seguimiento_pacientes(estado)`);
  seguimientoSchemaReady = true;
}

// Días que se calla el aviso tras marcar "ya lo contacté"
const DIAS_SILENCIO_SEGUIMIENTO = 30;

router.get("/seguimiento-proformas", async (req, res) => {
  try {
    await ensureSeguimientoSchema();

    const hoyLima = new Date().toLocaleString("sv-SE", { timeZone: "America/Lima" }).slice(0, 10);
    const hoy = new Date(`${hoyLima}T00:00:00`);
    const diasDesde = (fecha) => {
      if (!fecha) return null;
      const f = new Date(String(fecha).replace(" ", "T").slice(0, 19));
      if (isNaN(f)) return null;
      f.setHours(0, 0, 0, 0);
      return Math.round((hoy - f) / 86400000);
    };

    // 1) Proformas hechas que nunca arrancaron (una fila por paciente: la última)
    const proformas = await dbAll(`
      SELECT
        pa.paciente_id,
        p.nombre, p.apellido, p.dni, p.celular,
        MAX(pa.creado_en)  AS fecha_consulta,
        COUNT(pa.id)       AS proformas,
        SUM(pa.precio_total) AS monto_total,
        MAX(pa.precio_total) AS monto_ultima
      FROM presupuestos_asignados pa
      JOIN patients p ON p.id = pa.paciente_id
      WHERE pa.estado <> 'completado'
        AND NOT EXISTS (
          SELECT 1 FROM presupuestos_sesiones ps
          WHERE ps.presupuesto_asignado_id = pa.id AND ps.estado = 'completada'
        )
      GROUP BY pa.paciente_id
    `);

    // 2) Marcados a mano (aunque todavía no tengan proforma)
    const manuales = await dbAll(`
      SELECT s.paciente_id, s.nota, p.nombre, p.apellido, p.dni, p.celular
      FROM seguimiento_pacientes s
      JOIN patients p ON p.id = s.paciente_id
      WHERE s.manual = 1
    `);

    // Fecha de la consulta pagada más reciente, como respaldo cuando no hay proforma
    const consultas = await dbAll(`
      SELECT paciente_id, MAX(fecha) AS fecha FROM consultas_paciente GROUP BY paciente_id
    `).catch(() => []);
    const fechaConsulta = new Map(consultas.map((c) => [c.paciente_id, c.fecha]));

    // Estado guardado de cada paciente
    const marcas = await dbAll(`SELECT * FROM seguimiento_pacientes`);
    const marcaPorPaciente = new Map(marcas.map((m) => [m.paciente_id, m]));

    const porPaciente = new Map();

    for (const f of proformas) {
      porPaciente.set(f.paciente_id, {
        paciente_id: f.paciente_id,
        nombre: f.nombre, apellido: f.apellido, dni: f.dni, celular: f.celular,
        motivo: "proforma",
        fecha_consulta: f.fecha_consulta,
        proformas: f.proformas,
        monto: Number(f.monto_ultima) || 0,
        monto_total: Number(f.monto_total) || 0,
      });
    }

    for (const m of manuales) {
      const previo = porPaciente.get(m.paciente_id);
      if (previo) { previo.nota = m.nota; previo.manual = true; continue; }
      porPaciente.set(m.paciente_id, {
        paciente_id: m.paciente_id,
        nombre: m.nombre, apellido: m.apellido, dni: m.dni, celular: m.celular,
        motivo: "manual",
        manual: true,
        nota: m.nota,
        fecha_consulta: fechaConsulta.get(m.paciente_id) || null,
        proformas: 0,
        monto: 0,
        monto_total: 0,
      });
    }

    const pendientes = [];
    const atendidos = [];

    for (const item of porPaciente.values()) {
      const marca = marcaPorPaciente.get(item.paciente_id);
      const dias = diasDesde(item.fecha_consulta);
      const fila = {
        ...item,
        manual: !!item.manual,
        dias_desde_consulta: dias,
        estado: marca?.estado || "pendiente",
        nota: item.nota ?? marca?.nota ?? null,
        actualizado_en: marca?.actualizado_en || null,
      };

      if (marca?.estado === "descartado") { atendidos.push(fila); continue; }

      if (marca?.estado === "contactado") {
        const desde = diasDesde(marca.actualizado_en);
        // Aún dentro del silencio: se muestra en la sección de "ya atendidos"
        if (desde !== null && desde <= DIAS_SILENCIO_SEGUIMIENTO) { atendidos.push(fila); continue; }
        fila.estado = "pendiente";
        fila.reaparecio = true;   // ya se le contactó antes y sigue sin empezar
      }

      pendientes.push(fila);
    }

    // Primero el dinero dormido más grande; a igual monto, el más antiguo
    pendientes.sort((a, b) =>
      (b.monto_total - a.monto_total) || ((b.dias_desde_consulta || 0) - (a.dias_desde_consulta || 0))
    );
    atendidos.sort((a, b) => String(b.actualizado_en || "").localeCompare(String(a.actualizado_en || "")));

    res.json({
      total: pendientes.length,
      monto_en_juego: pendientes.reduce((s, r) => s + (r.monto_total || 0), 0),
      dias_silencio: DIAS_SILENCIO_SEGUIMIENTO,
      seguimientos: pendientes,
      atendidos,
    });
  } catch (err) {
    console.error("❌ Error obteniendo seguimiento:", err.message);
    res.status(500).json({ message: "Error al obtener el seguimiento" });
  }
});

// ✅ Marcar el estado de un paciente en seguimiento
router.post("/seguimiento-proformas/:paciente_id", async (req, res) => {
  try {
    await ensureSeguimientoSchema();
    const pacienteId = Number(req.params.paciente_id);
    if (!Number.isFinite(pacienteId) || pacienteId <= 0) {
      return res.status(400).json({ message: "Paciente inválido" });
    }

    const estadosValidos = ["pendiente", "contactado", "descartado"];
    const manual = req.body?.manual ? 1 : 0;
    // Añadir a mano significa "ponlo en la lista", no "ya lo llamé": sin estado
    // explícito entra como pendiente. Sin `manual`, la acción es contactarlo.
    const porDefecto = manual ? "pendiente" : "contactado";
    const estado = estadosValidos.includes(req.body?.estado) ? req.body.estado : porDefecto;
    const nota = req.body?.nota ? String(req.body.nota).slice(0, 500) : null;

    const existe = await dbGet(`SELECT id FROM patients WHERE id = ?`, [pacienteId]);
    if (!existe) return res.status(404).json({ message: "El paciente no existe" });

    await dbRun(
      `INSERT INTO seguimiento_pacientes (paciente_id, estado, manual, nota, actualizado_en, actualizado_por)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(paciente_id) DO UPDATE SET
         estado = excluded.estado,
         -- el marcado manual no se pierde al cambiar de estado
         manual = MAX(seguimiento_pacientes.manual, excluded.manual),
         nota = COALESCE(excluded.nota, seguimiento_pacientes.nota),
         actualizado_en = excluded.actualizado_en,
         actualizado_por = excluded.actualizado_por`,
      [pacienteId, estado, manual, nota, ahoraLima(), req.user?.username || "sistema"]
    );

    res.json({ message: "✅ Seguimiento actualizado", estado });
  } catch (err) {
    console.error("❌ Error guardando seguimiento:", err.message);
    res.status(500).json({ message: "Error al guardar el seguimiento" });
  }
});

// ↩️ Deshacer: vuelve a pendiente. Con ?quitar=1 retira también la marca manual.
router.delete("/seguimiento-proformas/:paciente_id", async (req, res) => {
  try {
    await ensureSeguimientoSchema();
    const pacienteId = Number(req.params.paciente_id);

    if (String(req.query.quitar) === "1") {
      await dbRun(`DELETE FROM seguimiento_pacientes WHERE paciente_id = ?`, [pacienteId]);
      return res.json({ message: "✅ Paciente retirado del seguimiento" });
    }

    await dbRun(
      `UPDATE seguimiento_pacientes
       SET estado = 'pendiente', actualizado_en = ?, actualizado_por = ?
       WHERE paciente_id = ?`,
      [ahoraLima(), req.user?.username || "sistema", pacienteId]
    );
    res.json({ message: "✅ Seguimiento reabierto" });
  } catch (err) {
    console.error("❌ Error deshaciendo seguimiento:", err.message);
    res.status(500).json({ message: "Error al deshacer el seguimiento" });
  }
});

// 📊 Seguimiento de pacientes - último tratamiento y tiempo sin venir
router.get("/seguimiento", async (req, res) => {
  try {
    const rows = await dbAll(`
      SELECT 
        p.id,
        p.nombre,
        p.apellido,
        p.dni,
        tr.fecha AS ultima_fecha,
        t.nombre AS ultimo_tratamiento,
        tr.especialista AS ultimo_especialista
      FROM patients p
      INNER JOIN tratamientos_realizados tr ON tr.paciente_id = p.id
      INNER JOIN (
        SELECT paciente_id, MAX(fecha) AS max_fecha
        FROM tratamientos_realizados
        GROUP BY paciente_id
      ) ult ON ult.paciente_id = p.id AND tr.fecha = ult.max_fecha
      LEFT JOIN tratamientos t ON t.id = tr.tratamiento_id
      GROUP BY p.id
      ORDER BY tr.fecha ASC
    `);
    res.json(rows || []);
  } catch (err) {
    console.error("❌ Error en seguimiento:", err.message);
    res.status(500).json({ message: "Error al obtener seguimiento" });
  }
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
    SELECT id, paciente_id, items_json, total, descuento, creado_en
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
  const { items, descuento: descuentoBody } = req.body;
  const descuentoNum = Number(descuentoBody) || 0;

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: "Debes seleccionar al menos un tratamiento" });
  }

  const normalized = items
    .map((it) => {
      const tratamientoId = it?.tratamientoId;
      const nombre = typeof it?.nombre === "string" ? it.nombre.trim() : "";
      const precioNum = Number(it?.precio);
      const sesionesNum = Number(it?.sesiones);
      return {
        tratamientoId: tratamientoId !== undefined && tratamientoId !== null ? Number(tratamientoId) : null,
        nombre,
        precio: Number.isFinite(precioNum) ? precioNum : 0,
        sesiones: Number.isFinite(sesionesNum) && sesionesNum >= 1 ? sesionesNum : 1,
        producto: typeof it?.producto === "string" ? it.producto.trim() : "",
        ml: typeof it?.ml === "string" ? it.ml.trim() : (it?.ml ? String(it.ml) : ""),
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
    INSERT INTO patient_ofertas (paciente_id, items_json, total, descuento, creado_en)
    VALUES (?, ?, ?, ?, ?)
  `;

  db.run(query, [id, JSON.stringify(normalized), total, descuentoNum, creadoEn], function (err) {
    if (err) {
      console.error("❌ Error al crear oferta:", err.message);
      return res.status(500).json({ message: "Error al crear oferta" });
    }

    res.json({
      id: this.lastID,
      paciente_id: Number(id),
      items: normalized,
      total,
      descuento: descuentoNum,
      creado_en: creadoEn,
    });
  });
});

// ✅ Editar oferta ofrecida (items y total) + sincronizar presupuesto asignado
router.put("/:id/ofertas/:ofertaId", requirePatientWrite, async (req, res) => {
  const { id, ofertaId } = req.params;
  const { items, descuento: descuentoBody } = req.body;
  const descuentoNum = Number(descuentoBody) || 0;

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: "Debes seleccionar al menos un tratamiento" });
  }

  const normalized = items
    .map((it) => {
      const tratamientoId = it?.tratamientoId;
      const nombre = typeof it?.nombre === "string" ? it.nombre.trim() : "";
      const precioNum = Number(it?.precio);
      const sesionesNum = Number(it?.sesiones);
      return {
        tratamientoId: tratamientoId !== undefined && tratamientoId !== null ? Number(tratamientoId) : null,
        nombre,
        precio: Number.isFinite(precioNum) ? precioNum : 0,
        sesiones: Number.isFinite(sesionesNum) && sesionesNum >= 1 ? sesionesNum : 1,
        producto: typeof it?.producto === "string" ? it.producto.trim() : "",
        ml: typeof it?.ml === "string" ? it.ml.trim() : (it?.ml ? String(it.ml) : ""),
      };
    })
    .filter((it) => it.nombre);

  if (normalized.length === 0) {
    return res.status(400).json({ message: "Items inválidos" });
  }

  const total = normalized.reduce((sum, it) => sum + (Number(it.precio) || 0), 0);

  try {
    // 1. Actualizar la oferta
    const result = await dbRun(
      `UPDATE patient_ofertas SET items_json = ?, total = ?, descuento = ? WHERE id = ? AND paciente_id = ?`,
      [JSON.stringify(normalized), total, descuentoNum, ofertaId, id]
    );

    if (result.changes === 0) {
      return res.status(404).json({ message: "Oferta no encontrada" });
    }

    // 2. Sincronizar presupuesto asignado vinculado (si existe)
    const asignado = await dbGet(
      `SELECT * FROM presupuestos_asignados WHERE oferta_id = ? AND paciente_id = ?`,
      [ofertaId, id]
    );

    if (asignado) {
      const descuento = Number(asignado.descuento) || 0;
      const montoPagado = Number(asignado.monto_pagado) || 0;
      const nuevoSaldo = Math.max(0, total - descuento - montoPagado);

      // Actualizar tratamientos_json y precio_total del presupuesto asignado
      await dbRun(
        `UPDATE presupuestos_asignados 
         SET tratamientos_json = ?, precio_total = ?, saldo_pendiente = ?
         WHERE id = ?`,
        [JSON.stringify(normalized), total, nuevoSaldo, asignado.id]
      );

      // 3. Sincronizar sesiones: reconstruir sesiones pendientes
      // Obtener sesiones completadas (no se tocan)
      const sesionesCompletadas = await dbAll(
        `SELECT * FROM presupuestos_sesiones 
         WHERE presupuesto_asignado_id = ? AND estado = 'completada'`,
        [asignado.id]
      );

      // Eliminar solo sesiones pendientes
      await dbRun(
        `DELETE FROM presupuestos_sesiones 
         WHERE presupuesto_asignado_id = ? AND estado = 'pendiente'`,
        [asignado.id]
      );

      // Crear un mapa de sesiones completadas por tratamiento
      const completadasPorTrat = {};
      for (const sc of sesionesCompletadas) {
        const key = sc.tratamiento_nombre;
        completadasPorTrat[key] = (completadasPorTrat[key] || 0) + 1;
      }

      // Recrear sesiones pendientes según los nuevos items
      const ahora = new Date().toLocaleString("sv-SE", { timeZone: "America/Lima" }).replace("T", " ").slice(0, 19);
      for (const item of normalized) {
        const numSesiones = Number(item.sesiones) >= 1 ? Number(item.sesiones) : 1;
        const precioTotal = Number(item.precio) || 0;
        const precioPorSesion = precioTotal / numSesiones;
        const completadas = completadasPorTrat[item.nombre] || 0;
        const pendientes = Math.max(0, numSesiones - completadas);

        for (let s = 1; s <= pendientes; s++) {
          await dbRun(
            `INSERT INTO presupuestos_sesiones (
              presupuesto_asignado_id, tratamiento_id, tratamiento_nombre,
              sesion_numero, precio_sesion, estado, creado_en
            ) VALUES (?, ?, ?, ?, ?, 'pendiente', ?)`,
            [
              asignado.id,
              item.tratamientoId || item.tratamiento_id || null,
              item.nombre,
              completadas + s,
              precioPorSesion,
              ahora
            ]
          );
        }
      }

      // Si un tratamiento fue eliminado, también remove sus sesiones completadas
      // (solo si ese nombre ya no existe en normalized)
      const nombresActuales = normalized.map(it => it.nombre);
      for (const sc of sesionesCompletadas) {
        if (!nombresActuales.includes(sc.tratamiento_nombre)) {
          await dbRun(
            `DELETE FROM presupuestos_sesiones WHERE id = ?`,
            [sc.id]
          );
        }
      }
    }

    res.json({ message: "Oferta actualizada correctamente" });
  } catch (err) {
    console.error("❌ Error al editar oferta:", err.message);
    res.status(500).json({ message: "Error al editar oferta" });
  }
});

// ✅ Actualizar descuento de una oferta
router.patch("/:id/ofertas/:ofertaId/descuento", requirePatientWrite, (req, res) => {
  const { id, ofertaId } = req.params;
  const { descuento } = req.body;

  const descuentoNum = Number(descuento) || 0;

  const query = `
    UPDATE patient_ofertas
    SET descuento = ?
    WHERE id = ? AND paciente_id = ?
  `;

  db.run(query, [descuentoNum, ofertaId, id], function (err) {
    if (err) {
      console.error("❌ Error al actualizar descuento:", err.message);
      return res.status(500).json({ message: "Error al actualizar descuento" });
    }
    if (this.changes === 0) {
      return res.status(404).json({ message: "Oferta no encontrada" });
    }
    res.json({ message: "Descuento actualizado correctamente", descuento: descuentoNum });
  });
});

// ✅ Actualizar fecha de creación de una oferta/presupuesto
//    Sincroniza también los presupuestos_asignados ligados (oferta_id) para que
//    el cambio se refleje en Gestión Clínica (que lee presupuestos_asignados).
router.patch("/:id/ofertas/:ofertaId/fecha", requirePatientWrite, async (req, res) => {
  const { id, ofertaId } = req.params;
  const { creado_en } = req.body;

  if (!creado_en) {
    return res.status(400).json({ message: "Fecha inválida" });
  }

  try {
    const oferta = await dbGet(
      `SELECT creado_en FROM patient_ofertas WHERE id = ? AND paciente_id = ?`,
      [ofertaId, id]
    );
    if (!oferta) {
      return res.status(404).json({ message: "Oferta no encontrada" });
    }

    const horaOriginal = (oferta.creado_en && oferta.creado_en.includes(' '))
      ? oferta.creado_en.split(' ')[1]
      : '00:00:00';
    const soloFecha = String(creado_en).split(' ')[0];
    const nuevaFecha = `${soloFecha} ${horaOriginal}`;

    // 1) Actualizar la oferta (Presupuestos del Paciente)
    await dbRun(
      `UPDATE patient_ofertas SET creado_en = ? WHERE id = ? AND paciente_id = ?`,
      [nuevaFecha, ofertaId, id]
    );

    // 2) Sincronizar presupuestos_asignados ligados (lo que ve Gestión Clínica).
    //    Conserva la hora original de cada presupuesto asignado, solo cambia la fecha.
    const asignados = await dbAll(
      `SELECT id, fecha_inicio, creado_en FROM presupuestos_asignados WHERE oferta_id = ? AND paciente_id = ?`,
      [ofertaId, id]
    );
    for (const pa of asignados) {
      const horaInicio = (pa.fecha_inicio && pa.fecha_inicio.includes(' ')) ? pa.fecha_inicio.split(' ')[1] : horaOriginal;
      const horaCreado = (pa.creado_en && pa.creado_en.includes(' ')) ? pa.creado_en.split(' ')[1] : horaOriginal;
      await dbRun(
        `UPDATE presupuestos_asignados SET fecha_inicio = ?, creado_en = ? WHERE id = ?`,
        [`${soloFecha} ${horaInicio}`, `${soloFecha} ${horaCreado}`, pa.id]
      );
    }

    res.json({
      message: "Fecha actualizada correctamente",
      creado_en: nuevaFecha,
      presupuestos_sincronizados: asignados.length
    });
  } catch (err) {
    console.error("❌ Error al actualizar fecha:", err.message);
    res.status(500).json({ message: "Error al actualizar fecha" });
  }
});

// ✅ Eliminar una oferta/presupuesto
router.delete("/:id/ofertas/:ofertaId", requirePatientWrite, (req, res) => {
  const { id, ofertaId } = req.params;

  const query = `DELETE FROM patient_ofertas WHERE id = ? AND paciente_id = ?`;

  db.run(query, [ofertaId, id], function (err) {
    if (err) {
      console.error("❌ Error al eliminar oferta:", err.message);
      return res.status(500).json({ message: "Error al eliminar oferta" });
    }
    if (this.changes === 0) {
      return res.status(404).json({ message: "Oferta no encontrada" });
    }
    res.json({ message: "Oferta eliminada correctamente" });
  });
});

// ✅ Buscar pacientes por nombre o DNI
router.get("/buscar", (req, res) => {
  const { term, tratamientoId, fechaDesde, fechaHasta } = req.query;

  const where = [];
  const params = [];

  const trimmedTerm = typeof term === "string" ? term.trim() : "";
  if (trimmedTerm) {
    const valueLower = `%${trimmedTerm.toLowerCase()}%`;
    // Buscar en nombre, apellido, DNI (case-insensitive), y en la concatenación de nombre + apellido
    where.push("(LOWER(nombre) LIKE ? OR LOWER(apellido) LIKE ? OR dni LIKE ? OR LOWER(nombre || ' ' || COALESCE(apellido, '')) LIKE ?)");
    params.push(valueLower, valueLower, trimmedTerm, valueLower);
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
           tr.descuento, tr.pagoMetodo,
           tr.foto_antes1, tr.foto_antes2, tr.foto_antes3,
           tr.foto_despues1, tr.foto_despues2, tr.foto_despues3,
           tr.foto_izquierda, tr.foto_frontal, tr.foto_derecha,
           tr.foto_extra1, tr.foto_extra2, tr.foto_extra3
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

// 📸 Subir fotos de paciente (hasta 15 fotos con nombre de tratamiento)
router.post("/:id/fotos", requirePatientWrite, uploadFotosPaciente.array("fotos", 15), (req, res) => {
  const { id } = req.params;
  const { nombre_tratamiento } = req.body;

  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ message: "No se enviaron imágenes" });
  }

  const nombreTrat = typeof nombre_tratamiento === "string" ? nombre_tratamiento.trim() : "Sin nombre";

  const creadoEn = new Date()
    .toLocaleString("sv-SE", { timeZone: "America/Lima" })
    .replace("T", " ")
    .slice(0, 19);

  const insertados = [];
  let errores = 0;

  req.files.forEach((file, idx) => {
    const rutaArchivo = `/uploads/fotos-paciente/${file.filename}`;
    db.run(
      `INSERT INTO fotos_paciente (paciente_id, nombre_tratamiento, archivo, creado_en) VALUES (?, ?, ?, ?)`,
      [id, nombreTrat, rutaArchivo, creadoEn],
      function (err) {
        if (err) {
          console.error("❌ Error al guardar foto de paciente:", err.message);
          errores++;
        } else {
          insertados.push({ id: this.lastID, archivo: rutaArchivo, nombre_tratamiento: nombreTrat, creado_en: creadoEn });
        }

        if (insertados.length + errores === req.files.length) {
          res.json({ message: `${insertados.length} foto(s) subidas correctamente`, fotos: insertados });
        }
      }
    );
  });
});

// 📸 Listar fotos de un paciente (ordenadas por fecha DESC)
router.get("/:id/fotos", (req, res) => {
  const { id } = req.params;
  const query = `
    SELECT id, paciente_id, nombre_tratamiento, archivo, creado_en
    FROM fotos_paciente
    WHERE paciente_id = ?
    ORDER BY creado_en DESC, id DESC
  `;

  db.all(query, [id], (err, rows) => {
    if (err) {
      console.error("❌ Error al listar fotos de paciente:", err.message);
      return res.status(500).json({ message: "Error al listar fotos" });
    }
    res.json(rows || []);
  });
});

// 📸 Eliminar una foto de paciente
router.delete("/:id/fotos/:fotoId", requirePatientWrite, (req, res) => {
  const { id, fotoId } = req.params;

  db.get(
    `SELECT archivo FROM fotos_paciente WHERE id = ? AND paciente_id = ?`,
    [fotoId, id],
    (err, row) => {
      if (err) {
        console.error("❌ Error al buscar foto:", err.message);
        return res.status(500).json({ message: "Error al eliminar foto" });
      }
      if (!row) {
        return res.status(404).json({ message: "Foto no encontrada" });
      }

      // Eliminar archivo físico
      const filePath = "." + row.archivo;
      if (fs.existsSync(filePath)) {
        try { fs.unlinkSync(filePath); } catch (e) { console.error("Error borrando archivo:", e); }
      }

      db.run(
        `DELETE FROM fotos_paciente WHERE id = ? AND paciente_id = ?`,
        [fotoId, id],
        function (delErr) {
          if (delErr) {
            console.error("❌ Error al eliminar foto:", delErr.message);
            return res.status(500).json({ message: "Error al eliminar foto" });
          }
          res.json({ message: "Foto eliminada correctamente" });
        }
      );
    }
  );
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

// ✅ Actualizar campo especial de un paciente
router.patch("/:id/especial", requirePatientWrite, (req, res) => {
  const { id } = req.params;
  const { especial } = req.body;
  db.run(`UPDATE patients SET especial = ? WHERE id = ?`, [especial ? 1 : 0, id], function (err) {
    if (err) {
      console.error("❌ Error al actualizar especial:", err.message);
      return res.status(500).json({ message: "Error al actualizar especial" });
    }
    res.json({ message: "Estado especial actualizado correctamente" });
  });
});

// ✅ Actualizar clasificación de un paciente
router.patch("/:id/clasificacion", requirePatientWrite, (req, res) => {
  const { id } = req.params;
  const { clasificacion, codigo_smsc } = req.body;
  db.run(`UPDATE patients SET clasificacion = ?, codigo_smsc = ? WHERE id = ?`, [clasificacion || null, codigo_smsc || null, id], function (err) {
    if (err) {
      console.error("❌ Error al actualizar clasificacion:", err.message);
      return res.status(500).json({ message: "Error al actualizar clasificacion" });
    }
    res.json({ message: "Clasificación actualizada correctamente", clasificacion, codigo_smsc });
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

// ✅ Eliminar paciente y todos sus datos relacionados (solo master)
router.delete("/eliminar/:id", requireRole("master"), (req, res) => {
  const { id } = req.params;

  // Verificar que el paciente existe
  db.get("SELECT id, nombre, apellido FROM patients WHERE id = ?", [id], (err, paciente) => {
    if (err) {
      console.error("❌ Error al buscar paciente:", err.message);
      return res.status(500).json({ message: "Error al buscar paciente" });
    }
    if (!paciente) {
      return res.status(404).json({ message: "Paciente no encontrado" });
    }

    // Eliminar en orden para respetar foreign keys
    const deletes = [
      "DELETE FROM deudas_pagos WHERE deuda_id IN (SELECT id FROM deudas_tratamientos WHERE paciente_id = ?)",
      "DELETE FROM deudas_tratamientos WHERE paciente_id = ?",
      "DELETE FROM patient_observaciones WHERE paciente_id = ?",
      "DELETE FROM patient_ofertas WHERE paciente_id = ?",
      "DELETE FROM patient_marcados WHERE paciente_id = ?",
      "DELETE FROM fotos_paciente WHERE paciente_id = ?",
      "DELETE FROM paquetes_sesiones WHERE paquete_paciente_id IN (SELECT id FROM paquetes_pacientes WHERE paciente_id = ?)",
      "DELETE FROM paquetes_pacientes WHERE paciente_id = ?",
      "DELETE FROM presupuestos_sesiones WHERE presupuesto_asignado_id IN (SELECT id FROM presupuestos_asignados WHERE paciente_id = ?)",
      "DELETE FROM presupuestos_asignados WHERE paciente_id = ?",
      "DELETE FROM tratamientos_realizados WHERE paciente_id = ?",
      "DELETE FROM finanzas WHERE paciente_id = ?",
      "DELETE FROM patients WHERE id = ?",
    ];

    db.serialize(() => {
      db.run("BEGIN TRANSACTION");

      let error = null;
      for (const sql of deletes) {
        if (error) break;
        db.run(sql, [id], (delErr) => {
          if (delErr && !error) {
            error = delErr;
          }
        });
      }

      db.run("COMMIT", (commitErr) => {
        if (error || commitErr) {
          db.run("ROLLBACK");
          console.error("❌ Error al eliminar paciente:", (error || commitErr).message);
          return res.status(500).json({ message: "Error al eliminar paciente" });
        }
        console.log(`🗑️ Paciente eliminado: ${paciente.nombre} ${paciente.apellido} (ID: ${id})`);
        res.json({ message: "Paciente eliminado correctamente" });
      });
    });
  });
});

// 📌 Obtener marcas de tratamientos de un paciente
router.get("/:id/marcados", (req, res) => {
  const { id } = req.params;
  db.get(
    `SELECT marcados_json FROM patient_marcados WHERE paciente_id = ?`,
    [id],
    (err, row) => {
      if (err) {
        console.error("❌ Error al obtener marcados:", err.message);
        return res.status(500).json({ message: "Error al obtener marcados" });
      }
      try {
        res.json(row ? JSON.parse(row.marcados_json) : {});
      } catch (e) {
        res.json({});
      }
    }
  );
});

// 📌 Guardar marcas de tratamientos de un paciente
router.put("/:id/marcados", (req, res) => {
  const { id } = req.params;
  const { marcados } = req.body;
  const json = JSON.stringify(marcados || {});
  db.run(
    `INSERT INTO patient_marcados (paciente_id, marcados_json, actualizado_en)
     VALUES (?, ?, datetime('now', '-5 hours'))
     ON CONFLICT(paciente_id) DO UPDATE SET marcados_json = ?, actualizado_en = datetime('now', '-5 hours')`,
    [id, json, json],
    (err) => {
      if (err) {
        console.error("❌ Error al guardar marcados:", err.message);
        return res.status(500).json({ message: "Error al guardar marcados" });
      }
      res.json({ message: "Marcados guardados" });
    }
  );
});

// ==============================
// 🏋️ PRESUPUESTO CORPORAL
// ==============================

// Obtener todos los registros corporales de un paciente
router.get("/:id/corporal", (req, res) => {
  const { id } = req.params;
  db.all(
    `SELECT * FROM presupuesto_corporal WHERE paciente_id = ? ORDER BY creado_en DESC`,
    [id],
    (err, rows) => {
      if (err) {
        console.error("❌ Error al obtener corporal:", err.message);
        return res.status(500).json({ message: "Error al obtener datos corporales" });
      }
      const parsed = (rows || []).map(r => ({
        ...r,
        tablas_json: JSON.parse(r.tablas_json || "[]"),
      }));
      res.json(parsed);
    }
  );
});

// Crear nuevo registro corporal
router.post("/:id/corporal", requirePatientWrite, (req, res) => {
  const { id } = req.params;
  const { tipo, tablas_json, actividad_fisica, observaciones } = req.body;
  const ahora = new Date(new Date().getTime() - 5 * 60 * 60 * 1000).toISOString().replace("T", " ").slice(0, 19);
  const username = req.user?.username || "sistema";

  db.run(
    `INSERT INTO presupuesto_corporal (paciente_id, tipo, tablas_json, actividad_fisica, observaciones, creado_en, actualizado_en, creado_por)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, tipo || "evaluacion", JSON.stringify(tablas_json || []), actividad_fisica || "", observaciones || "", ahora, ahora, username],
    function (err) {
      if (err) {
        console.error("❌ Error al crear corporal:", err.message);
        return res.status(500).json({ message: "Error al crear registro corporal" });
      }
      res.json({ id: this.lastID, message: "Registro corporal creado" });
    }
  );
});

// Actualizar registro corporal
router.put("/corporal/:corporalId", requirePatientWrite, (req, res) => {
  const { corporalId } = req.params;
  const { tipo, tablas_json, actividad_fisica, observaciones } = req.body;
  const ahora = new Date(new Date().getTime() - 5 * 60 * 60 * 1000).toISOString().replace("T", " ").slice(0, 19);

  const tablasStr = JSON.stringify(tablas_json || []);
  console.log(`📝 Actualizando corporal ID=${corporalId}, tipo=${tipo}, tablas_json length=${tablasStr.length}, actividad=${(actividad_fisica || "").length} chars, obs=${(observaciones || "").length} chars`);

  db.run(
    `UPDATE presupuesto_corporal SET tipo = ?, tablas_json = ?, actividad_fisica = ?, observaciones = ?, actualizado_en = ? WHERE id = ?`,
    [tipo || "evaluacion", tablasStr, actividad_fisica || "", observaciones || "", ahora, corporalId],
    function (err) {
      if (err) {
        console.error("❌ Error al actualizar corporal:", err.message);
        return res.status(500).json({ message: "Error al actualizar registro corporal" });
      }
      if (this.changes === 0) {
        console.warn(`⚠️ Corporal ID=${corporalId} no encontrado para actualizar`);
        return res.json({ message: "Registro corporal actualizado", warning: "El registro no fue encontrado, es posible que haya sido eliminado" });
      }
      console.log(`✅ Corporal ID=${corporalId} actualizado correctamente`);
      res.json({ message: "Registro corporal actualizado" });
    }
  );
});

// Eliminar registro corporal
router.delete("/corporal/:corporalId", requirePatientWrite, (req, res) => {
  const { corporalId } = req.params;
  db.run(`DELETE FROM presupuesto_corporal WHERE id = ?`, [corporalId], function (err) {
    if (err) {
      console.error("❌ Error al eliminar corporal:", err.message);
      return res.status(500).json({ message: "Error al eliminar registro corporal" });
    }
    res.json({ message: "Registro corporal eliminado" });
  });
});

// ==============================
// 🎭 MAPA FACIAL 3D
// ==============================

// Obtener todos los registros de mapa facial de un paciente
router.get("/:id/mapa-facial", (req, res) => {
  const { id } = req.params;
  db.all(
    `SELECT * FROM mapa_facial_3d WHERE paciente_id = ? ORDER BY creado_en DESC`,
    [id],
    (err, rows) => {
      if (err) {
        console.error("❌ Error al obtener mapa facial:", err.message);
        return res.status(500).json({ message: "Error al obtener mapa facial" });
      }
      const parsed = (rows || []).map(r => ({
        ...r,
        zonas_json: JSON.parse(r.zonas_json || "{}"),
        notas_json: JSON.parse(r.notas_json || "{}"),
      }));
      res.json(parsed);
    }
  );
});

// Crear nuevo registro de mapa facial
router.post("/:id/mapa-facial", requirePatientWrite, (req, res) => {
  const { id } = req.params;
  const { zonas_json, notas_json, nombre } = req.body;
  const ahora = new Date(new Date().getTime() - 5 * 60 * 60 * 1000).toISOString().replace("T", " ").slice(0, 19);
  const username = req.user?.username || "sistema";

  db.run(
    `INSERT INTO mapa_facial_3d (paciente_id, zonas_json, notas_json, nombre, creado_en, actualizado_en, creado_por)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, JSON.stringify(zonas_json || {}), JSON.stringify(notas_json || {}), nombre || "Sesión", ahora, ahora, username],
    function (err) {
      if (err) {
        console.error("❌ Error al crear mapa facial:", err.message);
        return res.status(500).json({ message: "Error al crear mapa facial" });
      }
      res.json({ id: this.lastID, message: "Mapa facial creado" });
    }
  );
});

// Actualizar registro de mapa facial
router.put("/mapa-facial/:mapaId", requirePatientWrite, (req, res) => {
  const { mapaId } = req.params;
  const { zonas_json, notas_json, nombre } = req.body;
  const ahora = new Date(new Date().getTime() - 5 * 60 * 60 * 1000).toISOString().replace("T", " ").slice(0, 19);

  db.run(
    `UPDATE mapa_facial_3d SET zonas_json = ?, notas_json = ?, nombre = ?, actualizado_en = ? WHERE id = ?`,
    [JSON.stringify(zonas_json || {}), JSON.stringify(notas_json || {}), nombre || "Sesión", ahora, mapaId],
    function (err) {
      if (err) {
        console.error("❌ Error al actualizar mapa facial:", err.message);
        return res.status(500).json({ message: "Error al actualizar mapa facial" });
      }
      res.json({ message: "Mapa facial actualizado" });
    }
  );
});

// Eliminar registro de mapa facial
router.delete("/mapa-facial/:mapaId", requirePatientWrite, (req, res) => {
  const { mapaId } = req.params;
  db.run(`DELETE FROM mapa_facial_3d WHERE id = ?`, [mapaId], function (err) {
    if (err) {
      console.error("❌ Error al eliminar mapa facial:", err.message);
      return res.status(500).json({ message: "Error al eliminar mapa facial" });
    }
    res.json({ message: "Mapa facial eliminado" });
  });
});

export default router;
