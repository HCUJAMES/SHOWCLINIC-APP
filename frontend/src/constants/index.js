/**
 * Constantes centralizadas de ShowClinic CRM
 * Mantener todas las constantes del sistema en un solo lugar
 */

// Colores del tema
export const COLORS = {
  PRIMARY: "#a36920",
  PRIMARY_RGB: [163, 105, 32],
  PRIMARY_HOVER: "#8a541a",
  PRIMARY_LIGHT: "rgba(163,105,32,0.08)",
  PRIMARY_BORDER: "rgba(163,105,32,0.15)",
};

// Configuración de API
export const API_BASE_URL =
  process.env.REACT_APP_API_URL ||
  `${window.location.protocol}//${window.location.hostname}:4000`;

// Roles del sistema
export const ROLES = {
  DOCTOR: "doctor",
  ASISTENTE: "asistente",
  LOGISTICA: "logistica",
  ADMIN: "admin",
  MASTER: "master",
  DOCTORA: "doctora",
};

// Métodos de pago
export const PAYMENT_METHODS = {
  EFECTIVO: "Efectivo",
  TARJETA: "Tarjeta",
  TRANSFERENCIA: "Transferencia",
  YAPE: "Yape",
  PLIN: "Plin",
};

// Tipos de atención
export const ATTENTION_TYPES = {
  TRATAMIENTO: "Tratamiento",
  CONSULTA: "Consulta",
  EMERGENCIA: "Emergencia",
};
