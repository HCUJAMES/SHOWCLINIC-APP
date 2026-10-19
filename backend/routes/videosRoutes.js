import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { dbAll, dbGet, dbRun } from "../db/database.js";
import { authMiddleware } from "../middleware/auth.js";

/**
 * 🎬 ANTES Y DESPUÉS — videos de los tratamientos realizados
 *
 * Cada tratamiento realizado puede llevar dos videos: uno de "antes" y otro
 * de "después". El archivo se guarda en el servidor (uploads/videos), así que
 * se ve desde cualquier computadora de la clínica y no depende del celular o
 * la PC desde donde se subió.
 *
 * El módulo está abierto a todos los roles: cualquiera con sesión puede ver,
 * subir, reemplazar y quitar videos.
 */

const router = express.Router();
router.use(authMiddleware);

const CARPETA = "./uploads/videos";
const TIPOS = new Set(["antes", "despues"]);
const EXTENSIONES = new Set([".mp4", ".mov", ".m4v", ".webm", ".avi", ".3gp", ".mkv"]);
const TAMANO_MAXIMO = 2 * 1024 * 1024 * 1024; // 2 GB

let schemaListo = false;
async function asegurarTabla() {
  if (schemaListo) return;
  await dbRun(`CREATE TABLE IF NOT EXISTS tratamiento_videos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tratamiento_realizado_id INTEGER NOT NULL,
    paciente_id INTEGER NOT NULL,
    tipo TEXT NOT NULL,
    archivo TEXT NOT NULL,
    nombre_original TEXT,
    tamano INTEGER,
    mime TEXT,
    subido_por TEXT,
    creado_en TEXT DEFAULT (datetime('now', '-5 hours')),
    UNIQUE(tratamiento_realizado_id, tipo)
  )`);
  await dbRun(`CREATE INDEX IF NOT EXISTS idx_tratamiento_videos_paciente ON tratamiento_videos(paciente_id)`);
  schemaListo = true;
}
asegurarTabla().catch((err) => console.error("❌ Error creando tratamiento_videos:", err.message));

const subida = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      if (!fs.existsSync(CARPETA)) fs.mkdirSync(CARPETA, { recursive: true });
      cb(null, CARPETA);
    },
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname || "").toLowerCase() || ".mp4";
      cb(null, `vid_${req.params.trId}_${req.params.tipo}_${Date.now()}${ext}`);
    },
  }),
  // Algunos celulares mandan los .mov como "application/octet-stream":
  // se acepta por tipo o por extensión.
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    cb(null, /^video\//.test(file.mimetype) || EXTENSIONES.has(ext));
  },
  limits: { fileSize: TAMANO_MAXIMO },
});

const borrarArchivo = (url) => {
  if (!url) return;
  try {
    const ruta = path.join(".", url);
    if (fs.existsSync(ruta)) fs.unlinkSync(ruta);
  } catch { /* ya no estaba */ }
};

/**
 * Filtro de fechas común. Sin fechas → todo el historial.
 * Devuelve el trozo de SQL y sus parámetros.
 */
function filtroFechas(query) {
  const fecha = /^\d{4}-\d{2}-\d{2}$/;
  const desde = fecha.test(query.desde || "") ? query.desde : null;
  const hasta = fecha.test(query.hasta || "") ? query.hasta : null;
  let sql = "";
  const params = [];
  if (desde) { sql += " AND DATE(tr.fecha) >= ?"; params.push(desde); }
  if (hasta) { sql += " AND DATE(tr.fecha) <= ?"; params.push(hasta); }
  return { sql, params };
}

// Videos de cada tratamiento resumidos en una sola fila
const SUBCONSULTA_VIDEOS = `
  SELECT tratamiento_realizado_id,
         MAX(CASE WHEN tipo = 'antes' THEN 1 ELSE 0 END) AS tiene_antes,
         MAX(CASE WHEN tipo = 'despues' THEN 1 ELSE 0 END) AS tiene_despues
  FROM tratamiento_videos
  GROUP BY tratamiento_realizado_id
`;

/**
 * Lista de pacientes con tratamientos en el rango, y el resumen de arriba.
 * GET /api/videos/pacientes?desde=AAAA-MM-DD&hasta=AAAA-MM-DD
 */
router.get("/pacientes", async (req, res) => {
  try {
    await asegurarTabla();
    const { sql, params } = filtroFechas(req.query);

    const pacientes = await dbAll(
      `
      SELECT
        p.id, p.nombre, p.apellido, p.dni, p.fotoPerfil,
        COUNT(tr.id) AS tratamientos,
        SUM(CASE WHEN COALESCE(v.tiene_antes, 0) = 1 AND COALESCE(v.tiene_despues, 0) = 1 THEN 1 ELSE 0 END) AS completos,
        SUM(CASE WHEN COALESCE(v.tiene_antes, 0) = 0 THEN 1 ELSE 0 END) AS faltan_antes,
        SUM(CASE WHEN COALESCE(v.tiene_despues, 0) = 0 THEN 1 ELSE 0 END) AS faltan_despues,
        SUM(COALESCE(v.tiene_antes, 0) + COALESCE(v.tiene_despues, 0)) AS videos,
        MAX(tr.fecha) AS ultima_fecha
      FROM tratamientos_realizados tr
      JOIN patients p ON p.id = tr.paciente_id
      LEFT JOIN (${SUBCONSULTA_VIDEOS}) v ON v.tratamiento_realizado_id = tr.id
      WHERE tr.paciente_id IS NOT NULL ${sql}
      GROUP BY p.id
      ORDER BY MAX(tr.fecha) DESC
      `,
      params
    );

    const lista = pacientes.map((p) => {
      const tratamientos = Number(p.tratamientos) || 0;
      const completos = Number(p.completos) || 0;
      return {
        ...p,
        tratamientos,
        completos,
        pendientes: tratamientos - completos,
        faltan_antes: Number(p.faltan_antes) || 0,
        faltan_despues: Number(p.faltan_despues) || 0,
        videos: Number(p.videos) || 0,
      };
    });

    const resumen = {
      pacientes: lista.length,
      pacientes_pendientes: lista.filter((p) => p.pendientes > 0).length,
      pacientes_completos: lista.filter((p) => p.pendientes === 0).length,
      tratamientos: lista.reduce((s, p) => s + p.tratamientos, 0),
      tratamientos_pendientes: lista.reduce((s, p) => s + p.pendientes, 0),
      faltan_antes: lista.reduce((s, p) => s + p.faltan_antes, 0),
      faltan_despues: lista.reduce((s, p) => s + p.faltan_despues, 0),
      videos: lista.reduce((s, p) => s + p.videos, 0),
    };

    res.json({ resumen, pacientes: lista });
  } catch (err) {
    console.error("❌ Error listando pacientes para videos:", err.message);
    res.status(500).json({ message: "Error al cargar los pacientes" });
  }
});

/**
 * Tratamientos realizados de un paciente con sus videos.
 * GET /api/videos/paciente/:id?desde=&hasta=
 */
router.get("/paciente/:id", async (req, res) => {
  try {
    await asegurarTabla();
    const paciente = await dbGet(
      `SELECT id, nombre, apellido, dni, fotoPerfil FROM patients WHERE id = ?`,
      [req.params.id]
    );
    if (!paciente) return res.status(404).json({ message: "El paciente no existe" });

    const { sql, params } = filtroFechas(req.query);
    const tratamientos = await dbAll(
      `
      SELECT tr.id, tr.fecha, tr.sesion, tr.tipoAtencion, tr.especialista,
             COALESCE(t.nombre, 'Tratamiento') AS tratamiento_nombre
      FROM tratamientos_realizados tr
      LEFT JOIN tratamientos t ON t.id = tr.tratamiento_id
      WHERE tr.paciente_id = ? ${sql}
      ORDER BY tr.fecha DESC, tr.id DESC
      `,
      [req.params.id, ...params]
    );

    const ids = tratamientos.map((t) => t.id);
    const videos = ids.length
      ? await dbAll(
          `SELECT id, tratamiento_realizado_id, tipo, archivo, nombre_original, tamano, mime, subido_por, creado_en
           FROM tratamiento_videos WHERE tratamiento_realizado_id IN (${ids.map(() => "?").join(",")})`,
          ids
        )
      : [];

    const porTratamiento = {};
    for (const v of videos) {
      porTratamiento[v.tratamiento_realizado_id] = porTratamiento[v.tratamiento_realizado_id] || {};
      porTratamiento[v.tratamiento_realizado_id][v.tipo] = v;
    }

    res.json({
      paciente,
      tratamientos: tratamientos.map((t) => ({
        ...t,
        antes: porTratamiento[t.id]?.antes || null,
        despues: porTratamiento[t.id]?.despues || null,
      })),
    });
  } catch (err) {
    console.error("❌ Error cargando tratamientos con videos:", err.message);
    res.status(500).json({ message: "Error al cargar los tratamientos del paciente" });
  }
});

/**
 * Subir (o reemplazar) el video de antes o después de un tratamiento.
 * POST /api/videos/tratamiento/:trId/:tipo   (campo "video")
 */
router.post("/tratamiento/:trId/:tipo", (req, res) => {
  const { trId, tipo } = req.params;
  if (!TIPOS.has(tipo)) return res.status(400).json({ message: "Tipo inválido: usa 'antes' o 'despues'" });

  subida.single("video")(req, res, async (errSubida) => {
    const archivo = req.file;
    const urlNueva = archivo ? `/uploads/videos/${archivo.filename}` : null;
    try {
      if (errSubida) {
        borrarArchivo(urlNueva);
        const msg = errSubida.code === "LIMIT_FILE_SIZE"
          ? "El video pesa más de 2 GB. Recórtalo o comprímelo antes de subirlo."
          : "No se pudo recibir el video";
        return res.status(400).json({ message: msg });
      }
      if (!archivo) {
        return res.status(400).json({ message: "Elige un archivo de video (MP4, MOV, WEBM…)" });
      }

      await asegurarTabla();
      const tratamiento = await dbGet(
        `SELECT id, paciente_id FROM tratamientos_realizados WHERE id = ?`,
        [trId]
      );
      if (!tratamiento) {
        borrarArchivo(urlNueva);
        return res.status(404).json({ message: "El tratamiento no existe" });
      }

      const anterior = await dbGet(
        `SELECT archivo FROM tratamiento_videos WHERE tratamiento_realizado_id = ? AND tipo = ?`,
        [trId, tipo]
      );

      await dbRun(
        `INSERT INTO tratamiento_videos
           (tratamiento_realizado_id, paciente_id, tipo, archivo, nombre_original, tamano, mime, subido_por, creado_en)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now', '-5 hours'))
         ON CONFLICT(tratamiento_realizado_id, tipo) DO UPDATE SET
           archivo = excluded.archivo,
           nombre_original = excluded.nombre_original,
           tamano = excluded.tamano,
           mime = excluded.mime,
           subido_por = excluded.subido_por,
           creado_en = excluded.creado_en`,
        [
          trId,
          tratamiento.paciente_id,
          tipo,
          urlNueva,
          String(archivo.originalname || "").slice(0, 200),
          archivo.size || 0,
          archivo.mimetype || null,
          req.user?.username || req.user?.role || null,
        ]
      );

      // El archivo viejo se borra solo cuando el nuevo ya quedó registrado
      if (anterior?.archivo && anterior.archivo !== urlNueva) borrarArchivo(anterior.archivo);

      const video = await dbGet(
        `SELECT id, tratamiento_realizado_id, tipo, archivo, nombre_original, tamano, mime, subido_por, creado_en
         FROM tratamiento_videos WHERE tratamiento_realizado_id = ? AND tipo = ?`,
        [trId, tipo]
      );
      res.json({ message: "✅ Video guardado", video });
    } catch (err) {
      borrarArchivo(urlNueva);
      console.error("❌ Error guardando video:", err.message);
      res.status(500).json({ message: "Error al guardar el video" });
    }
  });
});

// Quitar un video (y su archivo)
router.delete("/:videoId", async (req, res) => {
  try {
    await asegurarTabla();
    const video = await dbGet(`SELECT * FROM tratamiento_videos WHERE id = ?`, [req.params.videoId]);
    if (!video) return res.status(404).json({ message: "El video no existe" });
    await dbRun(`DELETE FROM tratamiento_videos WHERE id = ?`, [req.params.videoId]);
    borrarArchivo(video.archivo);
    res.json({ message: "Video eliminado" });
  } catch (err) {
    console.error("❌ Error eliminando video:", err.message);
    res.status(500).json({ message: "Error al eliminar el video" });
  }
});

export default router;
