/**
 * Identidad visual ShowClinic (Manual de Identidad 2025)
 *
 * Colores corporativos:
 *   #a36920  marrón dorado (principal)
 *   #ba9a63  arena
 *   #f5f1e4  crema
 * Tipografías:
 *   The Amoret Collection Sans → imagotipo y títulos
 *   Montserrat                  → textos
 *
 * Todo color o fuente nueva debería salir de aquí.
 */

export const BRAND = {
  // Corporativos
  oro: "#a36920",
  arena: "#ba9a63",
  crema: "#f5f1e4",

  // Derivados (mismo tono, para hover, texto y fondos)
  oroOscuro: "#8a5a1a",
  oroProfundo: "#5c3c12",
  arenaClara: "#d9c7a4",
  cremaClara: "#faf8f1",
  blanco: "#ffffff",

  // Neutros cálidos para texto
  texto: "#2b2219",
  textoSuave: "#6b5d4d",
  textoTenue: "#9a8c7a",
  borde: "rgba(163,105,32,0.16)",
  bordeFuerte: "rgba(163,105,32,0.32)",

  // Estados, en tonos apagados que conviven con la paleta
  exito: "#4f7a4a",
  error: "#b3412e",
  aviso: "#c07a1c",
  info: "#5b7083",
};

export const FONTS = {
  titulo: "'The Amoret Collection Sans', 'Montserrat', sans-serif",
  texto: "'Montserrat', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
};

export const LOGOS = {
  isotipo: "/brand/isotipo-arena.png",
  isotipoLinea: "/brand/isotipo-linea.png",
  isotipoLineaCrema: "/brand/isotipo-linea-crema.png",
  imagotipo: "/brand/imagotipo-marron.png",
  imagotipoArena: "/brand/imagotipo-arena.png",
  imagotipoCrema: "/brand/imagotipo-crema.png",
  imagotipoBlanco: "/brand/imagotipo-blanco.png",
};

export default BRAND;
