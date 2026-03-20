import express from "express";
import fs from "fs";
import path from "path";
import bcrypt from "bcryptjs";
import db, { dbAll, dbRun } from "../db/database.js";
import { authMiddleware, requireDoctor, requireRole } from "../middleware/auth.js";

const router = express.Router();

router.use(express.json());
router.use(authMiddleware);

// Listar usuarios (solo master)
router.get("/users", requireRole("master"), async (req, res) => {
  try {
    const users = await dbAll("SELECT id, username, role FROM users ORDER BY username");
    res.json(users || []);
  } catch (err) {
    console.error("Error al listar usuarios:", err);
    res.status(500).json({ message: "Error al listar usuarios" });
  }
});

// Cambiar contraseña de un usuario (solo master)
router.put("/users/:id/password", requireRole("master"), async (req, res) => {
  const { id } = req.params;
  const { newPassword } = req.body;
  if (!newPassword || newPassword.length < 4) {
    return res.status(400).json({ message: "La contraseña debe tener al menos 4 caracteres" });
  }
  try {
    const user = await new Promise((resolve, reject) => {
      db.get("SELECT id, username FROM users WHERE id = ?", [id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
    if (!user) return res.status(404).json({ message: "Usuario no encontrado" });
    const hash = bcrypt.hashSync(newPassword, 10);
    await dbRun("UPDATE users SET password = ? WHERE id = ?", [hash, id]);
    res.json({ message: `Contraseña de "${user.username}" actualizada correctamente` });
  } catch (err) {
    console.error("Error al cambiar contraseña:", err);
    res.status(500).json({ message: "Error al cambiar contraseña" });
  }
});

const fechaStamp = () => {
  const s = new Date().toISOString().replace(/[:.]/g, "-");
  return s;
};

const resolveUploadsPath = (ref) => {
  if (!ref) return null;
  const s = String(ref).trim();
  if (!s) return null;

  // Puede venir como:
  // - "/uploads/perfiles/xxx.jpg"
  // - "uploads/perfiles/xxx.jpg"
  // - "xxx.jpg" (cuando se guarda solo filename)
  let rel = s;
  if (rel.startsWith("http://") || rel.startsWith("https://")) return null;
  if (rel.startsWith("/")) rel = rel.slice(1);

  if (!rel.startsWith("uploads")) {
    rel = path.posix.join("uploads", rel);
  }

  // Normalizar separadores y resolver ruta final
  const normalized = rel.replace(/\\/g, "/");
  return path.join(process.cwd(), normalized);
};

const safeUnlink = async (filePath) => {
  if (!filePath) return false;
  try {
    await fs.promises.unlink(filePath);
    return true;
  } catch {
    return false;
  }
};

const safeReadDir = async (dirPath) => {
  try {
    return await fs.promises.readdir(dirPath);
  } catch {
    return [];
  }
};

router.post("/purge-pacientes", requireDoctor, async (req, res) => {
  const { confirm, dryRun, purgeInventoryDocs } = req.body || {};

  if (confirm !== "PURGE_PACIENTES") {
    return res.status(400).json({
      message: "Confirmación inválida. Envía { confirm: 'PURGE_PACIENTES' }",
    });
  }

  try {
    // 1) Recolectar archivos asociados a pacientes/historial
    const pacientes = await dbAll("SELECT fotoPerfil FROM patients");
    const tratamientosRealizados = await dbAll(
      `
      SELECT
        foto_izquierda,
        foto_frontal,
        foto_derecha,
        foto_extra1,
        foto_extra2,
        foto_extra3,
        foto_antes1,
        foto_antes2,
        foto_antes3,
        foto_despues1,
        foto_despues2,
        foto_despues3
      FROM tratamientos_realizados
    `
    );

    const fileRefs = new Set();
    (pacientes || []).forEach((p) => {
      if (p?.fotoPerfil) fileRefs.add(p.fotoPerfil);
    });

    (tratamientosRealizados || []).forEach((tr) => {
      Object.values(tr || {}).forEach((v) => {
        if (v) fileRefs.add(v);
      });
    });

    const filePaths = Array.from(fileRefs)
      .map(resolveUploadsPath)
      .filter(Boolean);

    // 1b) (Opcional) Recolectar PDFs/docs de inventario (uploads/docs)
    const docsDir = path.join(process.cwd(), "uploads", "docs");
    const docsFiles = purgeInventoryDocs ? await safeReadDir(docsDir) : [];
    const docsPaths = (docsFiles || []).map((f) => path.join(docsDir, f));

    // 2) Backup automático DB
    const dbFile = path.join(process.cwd(), "db", "showclinic.db");
    const backupFile = path.join(
      process.cwd(),
      "db",
      `showclinic.backup_${fechaStamp()}.db`
    );

    if (!dryRun) {
      await fs.promises.copyFile(dbFile, backupFile);
    }

    // 3) Borrar datos (orden para evitar referencias)
    const deletes = [
      "DELETE FROM deudas_tratamientos",
      "DELETE FROM patient_ofertas",
      "DELETE FROM patient_observaciones",
      "DELETE FROM tratamientos_realizados",
      "DELETE FROM patients",
    ];

    if (!dryRun) {
      await dbRun("BEGIN TRANSACTION");
      try {
        for (const sql of deletes) {
          await dbRun(sql);
        }

        if (purgeInventoryDocs) {
          // No tocamos inventario (stock/cantidad), solo quitamos referencias a PDFs
          await dbRun("DELETE FROM inventario_documentos");
          await dbRun("UPDATE inventario SET documento_pdf = NULL");
          await dbRun("UPDATE stock_lotes SET documento_pdf = NULL");
        }

        // Reset AUTOINCREMENT
        await dbRun(
          `DELETE FROM sqlite_sequence WHERE name IN ('deudas_tratamientos','patient_ofertas','patient_observaciones','tratamientos_realizados','patients')`
        );

        if (purgeInventoryDocs) {
          await dbRun(`DELETE FROM sqlite_sequence WHERE name IN ('inventario_documentos')`);
        }

        await dbRun("COMMIT");
      } catch (err) {
        await dbRun("ROLLBACK");
        throw err;
      }
    }

    // 4) Borrar archivos asociados
    let archivosEliminados = 0;
    let docsEliminados = 0;
    if (!dryRun) {
      for (const p of filePaths) {
        const ok = await safeUnlink(p);
        if (ok) archivosEliminados += 1;
      }

      if (purgeInventoryDocs) {
        for (const p of docsPaths) {
          const ok = await safeUnlink(p);
          if (ok) docsEliminados += 1;
        }
      }
    }

    res.json({
      message: dryRun
        ? "Dry-run OK. No se borró nada."
        : "✅ Pacientes e historiales eliminados (0 rastros)",
      backup: dryRun ? null : backupFile,
      archivosDetectados: filePaths.length,
      archivosEliminados: dryRun ? 0 : archivosEliminados,
      docsInventarioDetectados: purgeInventoryDocs ? docsPaths.length : 0,
      docsInventarioEliminados: dryRun ? 0 : docsEliminados,
    });
  } catch (err) {
    console.error("❌ Error purge-pacientes:", err?.message || err);
    res.status(500).json({ message: "Error al purgar pacientes" });
  }
});

export default router;
