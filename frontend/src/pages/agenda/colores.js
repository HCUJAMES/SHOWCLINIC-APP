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

/**
 * Color con el que se pinta una cita: el mismo que en Google (el color propio
 * de la cita o, si no tiene, el de su calendario). El servidor ya lo resuelve.
 */
export const colorCita = (cita) => cita?.color || POR_ID[cita?.colorId] || BRAND.oro;

/**
 * Los 24 colores de calendario de Google (los que aparecen al elegir el color
 * de un calendario), para que el administrador pueda corregir uno a mano.
 */
export const COLORES_CALENDARIO = [
  { nombre: "Tomate", color: "#d50000" },
  { nombre: "Flamenco", color: "#e67c73" },
  { nombre: "Mandarina", color: "#f4511e" },
  { nombre: "Plátano", color: "#f6bf26" },
  { nombre: "Salvia", color: "#33b679" },
  { nombre: "Albahaca", color: "#0b8043" },
  { nombre: "Pavo real", color: "#039be5" },
  { nombre: "Arándano", color: "#3f51b5" },
  { nombre: "Lavanda", color: "#7986cb" },
  { nombre: "Uva", color: "#8e24aa" },
  { nombre: "Grafito", color: "#616161" },
  { nombre: "Radicchio", color: "#ad1457" },
  { nombre: "Flor de cerezo", color: "#d81b60" },
  { nombre: "Calabaza", color: "#ef6c00" },
  { nombre: "Mango", color: "#f09300" },
  { nombre: "Citrón", color: "#e4c441" },
  { nombre: "Aguacate", color: "#c0ca33" },
  { nombre: "Pistacho", color: "#7cb342" },
  { nombre: "Eucalipto", color: "#009688" },
  { nombre: "Cobalto", color: "#4285f4" },
  { nombre: "Glicina", color: "#b39ddb" },
  { nombre: "Amatista", color: "#9e69af" },
  { nombre: "Abedul", color: "#a79b8e" },
  { nombre: "Cacao", color: "#795548" },
];

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

/** Texto blanco u oscuro según qué se lea mejor sobre ese color (como hace Google). */
export const textoSobre = (hex) => {
  const h = String(hex || "").replace("#", "");
  if (h.length !== 6) return "#fff";
  const n = parseInt(h, 16);
  const canal = (c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  const lum = 0.2126 * canal((n >> 16) & 255) + 0.7152 * canal((n >> 8) & 255) + 0.0722 * canal(n & 255);
  return lum > 0.45 ? "#3c4043" : "#fff";
};
