import express from "express";
import fs from "fs";
import path from "path";
import bcrypt from "bcryptjs";
import db, { dbAll, dbRun } from "../db/database.js";
import { authMiddleware, requireDoctor, requireRole } from "../middleware/auth.js";

const router = express.Router();

router.use(express.json());
router.use(authMiddleware);

// Obtener permisos del usuario actual
router.get("/my-permissions", async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: "No autenticado" });
    }
    
    const permissions = await dbAll(
      "SELECT module_name, can_access, can_edit FROM user_permissions WHERE user_id = ?",
      [userId]
    );
    
    res.json(permissions || []);
  } catch (err) {
    console.error("Error al obtener permisos:", err);
    res.status(500).json({ message: "Error al obtener permisos" });
  }
});

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

// Crear nuevo usuario (solo master)
router.post("/users", requireRole("master"), async (req, res) => {
  const { username, password, role, permissions } = req.body;
  
  if (!username || !password || !role) {
    return res.status(400).json({ message: "Username, password y role son requeridos" });
  }
  
  if (password.length < 4) {
    return res.status(400).json({ message: "La contraseña debe tener al menos 4 caracteres" });
  }
  
  try {
    const existingUser = await new Promise((resolve, reject) => {
      db.get("SELECT id FROM users WHERE username = ?", [username], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
    
    if (existingUser) {
      return res.status(400).json({ message: "El nombre de usuario ya existe" });
    }
    
    const hash = bcrypt.hashSync(password, 10);
    
    const result = await dbRun(
      "INSERT INTO users (username, password, role) VALUES (?, ?, ?)",
      [username, hash, role]
    );
    
    const userId = result.lastID;
    
    if (permissions && Array.isArray(permissions)) {
      for (const perm of permissions) {
        await dbRun(
          "INSERT INTO user_permissions (user_id, module_name, can_access, can_edit) VALUES (?, ?, ?, ?)",
          [userId, perm.module_name, perm.can_access ? 1 : 0, perm.can_edit ? 1 : 0]
        );
      }
    }
    
    res.status(201).json({ 
      message: "Usuario creado exitosamente",
      userId 
    });
  } catch (err) {
    console.error("Error al crear usuario:", err);
    res.status(500).json({ message: "Error al crear usuario" });
  }
});

// Obtener permisos de un usuario
router.get("/users/:id/permissions", requireRole("master"), async (req, res) => {
  const { id } = req.params;
  
  try {
    const permissions = await dbAll(
      "SELECT module_name, can_access, can_edit FROM user_permissions WHERE user_id = ?",
      [id]
    );
    
    res.json(permissions || []);
  } catch (err) {
    console.error("Error al obtener permisos:", err);
    res.status(500).json({ message: "Error al obtener permisos" });
  }
});

// Actualizar permisos de un usuario
router.put("/users/:id/permissions", requireRole("master"), async (req, res) => {
  const { id } = req.params;
  const { permissions } = req.body;
  
  if (!permissions || !Array.isArray(permissions)) {
    return res.status(400).json({ message: "Permisos inválidos" });
  }
  
  try {
    await dbRun("DELETE FROM user_permissions WHERE user_id = ?", [id]);
    
    for (const perm of permissions) {
      await dbRun(
        "INSERT INTO user_permissions (user_id, module_name, can_access, can_edit) VALUES (?, ?, ?, ?)",
        [id, perm.module_name, perm.can_access ? 1 : 0, perm.can_edit ? 1 : 0]
      );
    }
    
    res.json({ message: "Permisos actualizados exitosamente" });
  } catch (err) {
    console.error("Error al actualizar permisos:", err);
    res.status(500).json({ message: "Error al actualizar permisos" });
  }
});

// Eliminar usuario (solo master)
router.delete("/users/:id", requireRole("master"), async (req, res) => {
  const { id } = req.params;
  
  try {
    const user = await new Promise((resolve, reject) => {
      db.get("SELECT id, username, role FROM users WHERE id = ?", [id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
    
    if (!user) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }
    
    if (user.role === "master") {
      return res.status(403).json({ message: "No se puede eliminar un usuario master" });
    }
    
    await dbRun("DELETE FROM user_permissions WHERE user_id = ?", [id]);
    await dbRun("DELETE FROM users WHERE id = ?", [id]);
    
    res.json({ message: `Usuario "${user.username}" eliminado exitosamente` });
  } catch (err) {
    console.error("Error al eliminar usuario:", err);
    res.status(500).json({ message: "Error al eliminar usuario" });
  }
});

// Cambiar rol de un usuario (solo master)
router.put("/users/:id/role", requireRole("master"), async (req, res) => {
  const { id } = req.params;
  const { role } = req.body;
  if (!role) {
    return res.status(400).json({ message: "El rol es requerido" });
  }
  try {
    const user = await new Promise((resolve, reject) => {
      db.get("SELECT id, username, role FROM users WHERE id = ?", [id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
    if (!user) return res.status(404).json({ message: "Usuario no encontrado" });
    if (user.role === "master") return res.status(403).json({ message: "No se puede cambiar el rol del usuario master" });
    await dbRun("UPDATE users SET role = ? WHERE id = ?", [role, id]);
    res.json({ message: `Rol de "${user.username}" actualizado a "${role}"` });
  } catch (err) {
    console.error("Error al cambiar rol:", err);
    res.status(500).json({ message: "Error al cambiar rol" });
  }
});

// Editar username de un usuario (solo master)
router.put("/users/:id/username", requireRole("master"), async (req, res) => {
  const { id } = req.params;
  const { username } = req.body;
  if (!username || username.trim().length < 2) {
    return res.status(400).json({ message: "El nombre de usuario debe tener al menos 2 caracteres" });
  }
  try {
    const user = await new Promise((resolve, reject) => {
      db.get("SELECT id, username, role FROM users WHERE id = ?", [id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
    if (!user) return res.status(404).json({ message: "Usuario no encontrado" });
    const existing = await new Promise((resolve, reject) => {
      db.get("SELECT id FROM users WHERE username = ? AND id != ?", [username.trim(), id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
    if (existing) return res.status(400).json({ message: "Ese nombre de usuario ya existe" });
    await dbRun("UPDATE users SET username = ? WHERE id = ?", [username.trim(), id]);
    res.json({ message: `Nombre actualizado a "${username.trim()}"` });
  } catch (err) {
    console.error("Error al cambiar username:", err);
    res.status(500).json({ message: "Error al cambiar nombre de usuario" });
  }
});

// ====== ROLES PERSONALIZADOS ======

// Listar roles personalizados
router.get("/roles", requireRole("master"), async (req, res) => {
  try {
    const roles = await dbAll("SELECT * FROM custom_roles ORDER BY name");
    for (const role of roles) {
      try {
        role.default_modules = JSON.parse(role.default_modules || "[]");
      } catch { role.default_modules = []; }
    }
    res.json(roles || []);
  } catch (err) {
    console.error("Error al listar roles:", err);
    res.status(500).json({ message: "Error al listar roles" });
  }
});

// Crear rol personalizado
router.post("/roles", requireRole("master"), async (req, res) => {
  const { name, label, default_modules } = req.body;
  if (!name || !label) {
    return res.status(400).json({ message: "Nombre y etiqueta son requeridos" });
  }
  const roleName = name.toLowerCase().replace(/\s+/g, "_");
  try {
    const existing = await new Promise((resolve, reject) => {
      db.get("SELECT id FROM custom_roles WHERE name = ?", [roleName], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
    if (existing) return res.status(400).json({ message: "Ya existe un rol con ese nombre" });
    const result = await dbRun(
      "INSERT INTO custom_roles (name, label, default_modules) VALUES (?, ?, ?)",
      [roleName, label, JSON.stringify(default_modules || [])]
    );
    res.status(201).json({ message: "Rol creado exitosamente", id: result.lastID, name: roleName });
  } catch (err) {
    console.error("Error al crear rol:", err);
    res.status(500).json({ message: "Error al crear rol" });
  }
});

// Editar rol personalizado
router.put("/roles/:id", requireRole("master"), async (req, res) => {
  const { id } = req.params;
  const { label, default_modules } = req.body;
  try {
    await dbRun(
      "UPDATE custom_roles SET label = ?, default_modules = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      [label, JSON.stringify(default_modules || []), id]
    );
    res.json({ message: "Rol actualizado exitosamente" });
  } catch (err) {
    console.error("Error al editar rol:", err);
    res.status(500).json({ message: "Error al editar rol" });
  }
});

// Eliminar rol personalizado
router.delete("/roles/:id", requireRole("master"), async (req, res) => {
  const { id } = req.params;
  try {
    const role = await new Promise((resolve, reject) => {
      db.get("SELECT name FROM custom_roles WHERE id = ?", [id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
    if (!role) return res.status(404).json({ message: "Rol no encontrado" });
    const usersWithRole = await dbAll("SELECT id FROM users WHERE role = ?", [role.name]);
    if (usersWithRole && usersWithRole.length > 0) {
      return res.status(400).json({ message: `No se puede eliminar: ${usersWithRole.length} usuario(s) tienen este rol asignado` });
    }
    await dbRun("DELETE FROM custom_roles WHERE id = ?", [id]);
    res.json({ message: "Rol eliminado exitosamente" });
  } catch (err) {
    console.error("Error al eliminar rol:", err);
    res.status(500).json({ message: "Error al eliminar rol" });
  }
});

// Listar usuarios con sus permisos (solo master)
router.get("/users-with-permissions", requireRole("master"), async (req, res) => {
  try {
    const users = await dbAll("SELECT id, username, role FROM users ORDER BY username");
    
    const usersWithPermissions = await Promise.all(
      users.map(async (user) => {
        const permissions = await dbAll(
          "SELECT module_name, can_access, can_edit FROM user_permissions WHERE user_id = ?",
          [user.id]
        );
        
        return {
          ...user,
          permissions: permissions || []
        };
      })
    );
    
    res.json(usersWithPermissions);
  } catch (err) {
    console.error("Error al listar usuarios con permisos:", err);
    res.status(500).json({ message: "Error al listar usuarios" });
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
