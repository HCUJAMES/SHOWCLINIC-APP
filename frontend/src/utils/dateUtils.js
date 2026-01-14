/**
 * Utilidades para manejo de fechas y cálculos relacionados
 * Todas las fechas usan la zona horaria de Perú (America/Lima, GMT-5)
 */

/**
 * Obtiene la fecha actual en la zona horaria de Perú
 * @returns {Date} Fecha actual en Perú
 */
export const obtenerFechaPerú = () => {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Lima' }));
};

/**
 * Calcula la edad actual a partir de una fecha de nacimiento
 * Usa la zona horaria de Perú (GMT-5)
 * @param {string} fechaNacimiento - Fecha en formato YYYY-MM-DD
 * @returns {number} Edad en años
 */
export const calcularEdad = (fechaNacimiento) => {
  if (!fechaNacimiento) return null;
  
  // Usar fecha actual de Perú
  const hoy = obtenerFechaPerú();
  const nacimiento = new Date(fechaNacimiento + 'T00:00:00');
  
  let edad = hoy.getFullYear() - nacimiento.getFullYear();
  const mes = hoy.getMonth() - nacimiento.getMonth();
  
  // Si aún no ha cumplido años este año, restar 1
  if (mes < 0 || (mes === 0 && hoy.getDate() < nacimiento.getDate())) {
    edad--;
  }
  
  return edad;
};

/**
 * Formatea una fecha para mostrar en formato legible (zona horaria Perú)
 * @param {string} fecha - Fecha en formato ISO
 * @returns {string} Fecha formateada
 */
export const formatearFecha = (fecha) => {
  if (!fecha) return '';
  const date = new Date(fecha);
  return date.toLocaleDateString('es-PE', { 
    timeZone: 'America/Lima',
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
};

/**
 * Obtiene la fecha y hora actual en formato ISO para Perú
 * @returns {string} Fecha y hora en formato YYYY-MM-DD HH:mm:ss
 */
export const obtenerFechaHoraPerú = () => {
  const fecha = obtenerFechaPerú();
  const año = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  const horas = String(fecha.getHours()).padStart(2, '0');
  const minutos = String(fecha.getMinutes()).padStart(2, '0');
  const segundos = String(fecha.getSeconds()).padStart(2, '0');
  
  return `${año}-${mes}-${dia} ${horas}:${minutos}:${segundos}`;
};

/**
 * Obtiene solo la fecha actual en formato YYYY-MM-DD para Perú
 * @returns {string} Fecha en formato YYYY-MM-DD
 */
export const obtenerFechaSoloPerú = () => {
  const fecha = obtenerFechaPerú();
  const año = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  
  return `${año}-${mes}-${dia}`;
};

/**
 * Formatea una fecha y hora para mostrar en formato legible (zona horaria Perú)
 * @param {string} fechaHora - Fecha y hora en formato ISO
 * @returns {string} Fecha y hora formateada
 */
export const formatearFechaHora = (fechaHora) => {
  if (!fechaHora) return '';
  const date = new Date(fechaHora);
  return date.toLocaleString('es-PE', { 
    timeZone: 'America/Lima',
    year: 'numeric', 
    month: 'long', 
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};
