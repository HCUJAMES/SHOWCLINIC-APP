/**
 * Utilidades para validación de permisos
 * Centraliza toda la lógica de permisos del sistema
 */

import { ROLES } from "../constants";

/**
 * Verifica si un rol tiene permiso para una acción específica
 * @param {string} role - Rol del usuario
 * @param {string} action - Acción a verificar
 * @returns {boolean}
 */
export const hasPermission = (role, action) => {
  const permissions = {
    // Permisos de pacientes
    writePatients: [ROLES.DOCTOR, ROLES.ASISTENTE, ROLES.ADMIN, ROLES.MASTER, ROLES.DOCTORA],
    readPatients: [ROLES.DOCTOR, ROLES.ASISTENTE, ROLES.ADMIN, ROLES.LOGISTICA, ROLES.MASTER, ROLES.DOCTORA],

    // Permisos de tratamientos
    writeTreatments: [ROLES.DOCTOR, ROLES.ASISTENTE, ROLES.MASTER, ROLES.DOCTORA],
    createTreatmentBase: [ROLES.DOCTOR, ROLES.ASISTENTE, ROLES.MASTER, ROLES.DOCTORA],
    deleteTreatments: [ROLES.DOCTOR, ROLES.MASTER],

    // Permisos de inventario
    writeInventory: [ROLES.DOCTOR, ROLES.LOGISTICA, ROLES.MASTER],
    readInventory: [ROLES.DOCTOR, ROLES.LOGISTICA, ROLES.ASISTENTE, ROLES.MASTER],

    // Permisos de finanzas
    viewStats: [ROLES.DOCTOR, ROLES.ADMIN, ROLES.MASTER],
    modifyDebts: [ROLES.DOCTOR, ROLES.MASTER, ROLES.DOCTORA],

    // Permisos de gestión
    manageSystem: [ROLES.MASTER],
    createBackup: [ROLES.MASTER],

    // Permisos de paquetes
    writePackages: [ROLES.DOCTOR, ROLES.ASISTENTE, ROLES.ADMIN, ROLES.MASTER, ROLES.DOCTORA],
    deletePackages: [ROLES.DOCTOR, ROLES.ASISTENTE, ROLES.ADMIN, ROLES.MASTER, ROLES.DOCTORA],

    // Permisos de gestión clínica
    viewClinicalManagement: [ROLES.DOCTOR, ROLES.ADMIN, ROLES.MASTER],
  };

  return permissions[action]?.includes(role) || false;
};

/**
 * Verifica si el usuario puede escribir/modificar pacientes
 * @param {string} role - Rol del usuario
 * @returns {boolean}
 */
export const canWritePatients = (role) => hasPermission(role, "writePatients");

/**
 * Verifica si el usuario puede crear tratamientos
 * @param {string} role - Rol del usuario
 * @returns {boolean}
 */
export const canCreateTreatments = (role) => hasPermission(role, "createTreatmentBase");

/**
 * Verifica si el usuario puede modificar inventario
 * @param {string} role - Rol del usuario
 * @returns {boolean}
 */
export const canWriteInventory = (role) => hasPermission(role, "writeInventory");

/**
 * Verifica si el usuario puede ver estadísticas
 * @param {string} role - Rol del usuario
 * @returns {boolean}
 */
export const canViewStats = (role) => hasPermission(role, "viewStats");

/**
 * Verifica si el usuario puede modificar deudas
 * @param {string} role - Rol del usuario
 * @returns {boolean}
 */
export const canModifyDebts = (role) => hasPermission(role, "modifyDebts");

/**
 * Verifica si el usuario tiene permisos de doctor
 * @param {string} role - Rol del usuario
 * @returns {boolean}
 */
export const isDoctor = (role) => role === ROLES.DOCTOR || role === ROLES.MASTER;

/**
 * Verifica si el usuario puede crear/editar paquetes
 * @param {string} role - Rol del usuario
 * @returns {boolean}
 */
export const canWritePackages = (role) => hasPermission(role, "writePackages");

/**
 * Verifica si el usuario puede eliminar paquetes
 * @param {string} role - Rol del usuario
 * @returns {boolean}
 */
export const canDeletePackages = (role) => hasPermission(role, "deletePackages");
