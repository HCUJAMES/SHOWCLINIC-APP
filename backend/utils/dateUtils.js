/**
 * Utilidades para manejo de fechas en el backend
 * Todas las fechas usan la zona horaria de Perú (America/Lima, GMT-5)
 */

/**
 * Obtiene la fecha y hora actual en formato para base de datos (Perú GMT-5)
 * @returns {string} Fecha y hora en formato YYYY-MM-DD HH:mm:ss
 */
export const fechaLima = () => {
  return new Date()
    .toLocaleString("sv-SE", { timeZone: "America/Lima" })
    .replace("T", " ")
    .slice(0, 19);
};

/**
 * Obtiene solo la fecha actual en formato YYYY-MM-DD (Perú GMT-5)
 * @returns {string} Fecha en formato YYYY-MM-DD
 */
export const fechaSoloLima = () => {
  return new Date()
    .toLocaleString("sv-SE", { timeZone: "America/Lima" })
    .slice(0, 10);
};

/**
 * Formatea una fecha para timestamp de archivo
 * @returns {string} Timestamp en formato YYYY-MM-DD-HHmmss
 */
export const timestampArchivo = () => {
  const fecha = fechaLima();
  return fecha.replace(/[: ]/g, "-");
};

/**
 * Convierte una fecha ISO a formato de Perú
 * @param {string} fechaISO - Fecha en formato ISO
 * @returns {string} Fecha en formato YYYY-MM-DD HH:mm:ss (Perú)
 */
export const convertirALima = (fechaISO) => {
  if (!fechaISO) return null;
  return new Date(fechaISO)
    .toLocaleString("sv-SE", { timeZone: "America/Lima" })
    .replace("T", " ")
    .slice(0, 19);
};

export default {
  fechaLima,
  fechaSoloLima,
  timestampArchivo,
  convertirALima
};
