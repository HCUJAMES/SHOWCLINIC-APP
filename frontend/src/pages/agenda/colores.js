/**
 * Colores de las citas: son los 11 colores de eventos de Google Calendar,
 * para que una cita se vea del mismo color en ShowClinic y en el celular.
 */
import { BRAND } from "../../brand";

export const COLORES_GOOGLE = [
  { id: "1", nombre: "Lavanda", color: "#7986cb" },
  { id: "2", nombre: "Salvia", color: "#33b679" },
  { id: "3", nombre: "Uva", color: "#8e24aa" },
  { id: "4", nombre: "Flamenco", color: "#e67c73" },
  { id: "5", nombre: "Plátano", color: "#f6bf26" },
  { id: "6", nombre: "Mandarina", color: "#f4511e" },
  { id: "7", nombre: "Pavo real", color: "#039be5" },
  { id: "8", nombre: "Grafito", color: "#616161" },
  { id: "9", nombre: "Arándano", color: "#3f51b5" },
  { id: "10", nombre: "Albahaca", color: "#0b8043" },
  { id: "11", nombre: "Tomate", color: "#d50000" },
];

const POR_ID = Object.fromEntries(COLORES_GOOGLE.map((c) => [c.id, c.color]));

// Orden en que se reparten los colores entre especialistas (los más
// distinguibles primero).
const ORDEN_ESPECIALISTAS = ["7", "2", "3", "4", "6", "1", "10", "9", "5", "11", "8"];

/** Color sugerido para un especialista (siempre el mismo para la misma persona). */
export const colorIdEspecialista = (especialistaId) =>
  especialistaId ? ORDEN_ESPECIALISTAS[(Number(especialistaId) - 1) % ORDEN_ESPECIALISTAS.length] : null;

/** Color con el que se pinta una cita. */
export const colorCita = (cita) =>
  POR_ID[cita?.colorId] || POR_ID[colorIdEspecialista(cita?.especialistaId)] || BRAND.oro;

export const colorPorId = (id) => POR_ID[id] || BRAND.oro;

/** Mezcla un color con blanco: para fondos suaves que no cansan la vista. */
export const suavizar = (hex, cantidad = 0.82) => {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const mezcla = (c) => Math.round(c + (255 - c) * cantidad);
  return `rgb(${mezcla(r)}, ${mezcla(g)}, ${mezcla(b)})`;
};

/** Oscurece un color para usarlo como texto sobre su versión suave. */
export const oscurecer = (hex, cantidad = 0.45) => {
  const h = hex.replace("#", "");
  const n = parseInt(h, 16);
  const f = (c) => Math.round(c * (1 - cantidad));
  return `rgb(${f((n >> 16) & 255)}, ${f((n >> 8) & 255)}, ${f(n & 255)})`;
};
