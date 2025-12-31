import express from "express";
import bcrypt from "bcryptjs";
import rateLimit from "express-rate-limit";
import db from "../db/database.js";
import { generateToken } from "../middleware/auth.js";

const router = express.Router();

// Rate limiting para login (máximo 5 intentos por minuto por IP)
const loginLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 5, // máximo 5 intentos
  message: { message: "Demasiados intentos de login. Intenta de nuevo en 1 minuto." },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post("/login", loginLimiter, (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ message: "Usuario y contraseña son requeridos" });
  }

  db.get("SELECT * FROM users WHERE username = ?", [username.trim()], (err, user) => {
    if (err) {
      console.error("❌ Error en login:", err.message);
      return res.status(500).json({ message: "Error interno" });
    }
    if (!user) return res.status(400).json({ message: "Usuario no encontrado" });

    const valid = bcrypt.compareSync(password, user.password);
    if (!valid) return res.status(401).json({ message: "Contraseña incorrecta" });

    const token = generateToken({ 
      id: user.id, 
      username: user.username, 
      role: user.role 
    });
    
    res.json({ token, role: user.role });
  });
});

export default router;
