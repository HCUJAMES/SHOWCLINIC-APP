import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { authMiddleware } from "../middleware/auth.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Middleware para verificar que el usuario sea master
const requireMaster = (req, res, next) => {
  const role = req.user?.role;
  if (role !== "master") {
    return res.status(403).json({ message: "Acceso denegado. Solo el usuario master puede realizar backups." });
  }
  next();
};

// 📦 Generar backup de la base de datos
router.get("/generar", authMiddleware, requireMaster, (req, res) => {
  try {
    const dbPath = path.join(__dirname, "..", "db", "showclinic.db");
    
    // Verificar que la base de datos existe
    if (!fs.existsSync(dbPath)) {
      return res.status(404).json({ message: "Base de datos no encontrada" });
    }

    // Leer el archivo de la base de datos
    const dbBuffer = fs.readFileSync(dbPath);
    
    // Generar nombre del archivo con fecha y hora
    const now = new Date();
    const timestamp = now.toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const filename = `showclinic_backup_${timestamp}.db`;

    // Configurar headers para descarga
    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Length", dbBuffer.length);

    // Enviar el archivo
    res.send(dbBuffer);
    
    console.log(`✅ Backup generado exitosamente: ${filename}`);
  } catch (err) {
    console.error("❌ Error al generar backup:", err);
    res.status(500).json({ message: "Error al generar backup de la base de datos" });
  }
});

export default router;
