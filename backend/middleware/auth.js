import jwt from "jsonwebtoken";

// Usar variable de entorno o fallback al secret anterior (compatibilidad)
const SECRET = process.env.JWT_SECRET || "showclinic_secret";

/**
 * Middleware de autenticación JWT
 * Verifica el token y agrega req.user con los datos del usuario
 */
export const authMiddleware = (req, res, next) => {
  const authHeader = req.headers["authorization"] || req.headers["Authorization"];
  if (!authHeader) {
    return res.status(401).json({ message: "Token no proporcionado" });
  }

  const [, token] = authHeader.split(" ");
  if (!token) {
    return res.status(401).json({ message: "Token no proporcionado" });
  }

  try {
    const decoded = jwt.verify(token, SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    console.error("❌ Token inválido:", err.message);
    return res.status(401).json({ message: "Token inválido o expirado" });
  }
};

/**
 * Middleware para requerir rol específico
 * @param  {...string} roles - Roles permitidos
 */
export const requireRole = (...roles) => {
  return (req, res, next) => {
    const userRole = req.user?.role;
    // Master tiene acceso total a todo
    if (userRole === "master" || roles.includes(userRole)) {
      return next();
    }
    return res.status(403).json({ 
      message: `Acceso denegado. Se requiere rol: ${roles.join(" o ")}` 
    });
  };
};

/**
 * Middleware para escritura de inventario (doctor, logistica o master)
 */
export const requireInventoryWrite = (req, res, next) => {
  const role = req.user?.role;
  if (role !== "doctor" && role !== "logistica" && role !== "master") {
    return res.status(403).json({ message: "No tienes permisos para modificar el inventario" });
  }
  next();
};

/**
 * Middleware para escritura de pacientes (doctor, asistente, admin o master)
 */
export const requirePatientWrite = (req, res, next) => {
  const role = req.user?.role;
  if (role !== "doctor" && role !== "asistente" && role !== "admin" && role !== "master") {
    return res.status(403).json({ message: "No tienes permisos para modificar pacientes" });
  }
  next();
};

/**
 * Middleware para acciones solo de doctor (o master)
 */
export const requireDoctor = (req, res, next) => {
  const role = req.user?.role;
  if (role !== "doctor" && role !== "master") {
    return res.status(403).json({ message: "Solo el rol doctor puede ejecutar esta acción" });
  }
  next();
};

/**
 * Genera un token JWT
 */
export const generateToken = (payload, expiresIn = "8h") => {
  return jwt.sign(payload, SECRET, { expiresIn });
};

/**
 * Verifica un token JWT
 */
export const verifyToken = (token) => {
  return jwt.verify(token, SECRET);
};

export default {
  authMiddleware,
  requireRole,
  requireInventoryWrite,
  requirePatientWrite,
  requireDoctor,
  generateToken,
  verifyToken,
};
