import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import db from "../db/database.js";

const router = express.Router();
const SECRET = "showclinic_secret"; // puedes moverlo luego a .env

router.post("/login", (req, res) => {
  const { username, password } = req.body;
  db.get("SELECT * FROM users WHERE username = ?", [username], (err, user) => {
    if (err) return res.status(500).json({ message: "Error interno" });
    if (!user) return res.status(400).json({ message: "Usuario no encontrado" });

    const valid = bcrypt.compareSync(password, user.password);
    if (!valid) return res.status(401).json({ message: "Contraseña incorrecta" });

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      SECRET,
      { expiresIn: "8h" }
    );
    res.json({ token, role: user.role });
  });
});

export default router;
