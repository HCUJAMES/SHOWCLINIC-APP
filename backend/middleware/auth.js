import jwt from "jsonwebtoken";
import { dbAll } from "../db/database.js";

// Usar variable de entorno o fallback al secret anterior (compatibilidad)
const SECRET = process.env.JWT_SECRET || "showclinic_secret";

// Mapa de roles a módulos que tienen acceso por defecto
const roleToModules = {
  doctor: ["pacientes", "tratamientos", "paquetes", "inventario", "finanzas", "especialistas", "gestion-clinica", "estadisticas", "historial-clinico"],
  admin: ["pacientes", "tratamientos", "paquetes", "inventario", "finanzas", "estadisticas", "historial-clinico"],
  logistica: ["pacientes", "tratamientos", "paquetes", "inventario", "finanzas"],
  asistente: ["pacientes", "tratamientos", "paquetes", "inventario", "finanzas"],
  doctora: ["pacientes", "tratamientos"],
};

// Helper: verifica si un usuario tiene permiso de acceso a un módulo via user_permissions
const checkUserPermission = async (userId, moduleName) => {
  try {
    const perms = await dbAll(
      "SELECT can_access FROM user_permissions WHERE user_id = ? AND module_name = ? AND can_access = 1",
      [userId, moduleName]
    );
    return perms && perms.length > 0;
  } catch { return false; }
};

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
 * Ahora también verifica user_permissions para roles personalizados
 * @param  {...string} roles - Roles permitidos
 */
export const requireRole = (...roles) => {
  return async (req, res, next) => {
    const userRole = req.user?.role;
    const userId = req.user?.id;
    // Master tiene acceso total a todo
    if (userRole === "master" || roles.includes(userRole)) {
      return next();
    }
    // Para roles personalizados, verificar user_permissions
    // Determinar qué módulos corresponden a los roles solicitados
    if (userId) {
      const modulesForRoles = new Set();
      for (const r of roles) {
        (roleToModules[r] || []).forEach(m => modulesForRoles.add(m));
      }
      // Verificar si el usuario tiene permiso en al menos uno de esos módulos
      for (const mod of modulesForRoles) {
        const hasPermission = await checkUserPermission(userId, mod);
        if (hasPermission) return next();
      }
    }
    return res.status(403).json({ 
      message: `Acceso denegado. Se requiere rol: ${roles.join(" o ")}` 
    });
  };
};

/**
 * Middleware para escritura de inventario (doctor, logistica o master)
 */
export const requireInventoryWrite = async (req, res, next) => {
  const role = req.user?.role;
  const userId = req.user?.id;
  if (role === "doctor" || role === "logistica" || role === "master") return next();
  if (userId && await checkUserPermission(userId, "inventario")) return next();
  return res.status(403).json({ message: "No tienes permisos para modificar el inventario" });
};

/**
 * Middleware para escritura de pacientes (doctor, asistente, admin, master o doctora)
 */
export const requirePatientWrite = async (req, res, next) => {
  const role = req.user?.role;
  const userId = req.user?.id;
  if (role === "doctor" || role === "asistente" || role === "admin" || role === "master" || role === "doctora") return next();
  if (userId && await checkUserPermission(userId, "pacientes")) return next();
  return res.status(403).json({ message: "No tienes permisos para modificar pacientes" });
};

/**
 * Middleware para acciones solo de doctor (o master)
 */
export const requireDoctor = async (req, res, next) => {
  const role = req.user?.role;
  const userId = req.user?.id;
  if (role === "doctor" || role === "admin" || role === "master") return next();
  // Permitir si tiene permisos asignados
  if (userId) {
    const perms = await dbAll(
      "SELECT can_access FROM user_permissions WHERE user_id = ? AND can_access = 1",
      [userId]
    );
    if (perms && perms.length > 0) return next();
  }
  return res.status(403).json({ message: "No tienes permisos para ejecutar esta acción" });
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
