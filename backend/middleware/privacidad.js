/**
 * PRIVACIDAD DE DATOS DE CONTACTO DEL PACIENTE
 * ============================================
 *
 * Hay roles que atienden en la clínica pero no deben ver el teléfono de las
 * pacientes (para evitar contacto por fuera). En vez de esconderlo solo en la
 * pantalla —donde seguiría viajando en la respuesta y se vería desde el
 * navegador— el dato se borra aquí, antes de salir del servidor.
 *
 * Se envuelve res.json para limpiar cualquier respuesta, sin importar el
 * endpoint ni lo anidado que venga el campo.
 */

import jwt from "jsonwebtoken";

const SECRET = process.env.JWT_SECRET || "showclinic_secret";

// Roles que NO pueden ver el teléfono de las pacientes
const ROLES_SIN_CONTACTO = new Set(["doctora"]);

// Campos que llevan el teléfono en las distintas respuestas
const CAMPOS_CONTACTO = new Set(["celular", "paciente_celular", "telefono", "celular_paciente"]);

// Se envía vacío (no un texto): así la interfaz simplemente no lo dibuja,
// en vez de mostrar un teléfono falso.
const MARCA = null;

/** Recorre el objeto/array y reemplaza los campos de contacto. */
function ocultarContacto(valor, profundidad = 0) {
  if (valor == null || profundidad > 12) return valor;

  if (Array.isArray(valor)) {
    for (let i = 0; i < valor.length; i++) valor[i] = ocultarContacto(valor[i], profundidad + 1);
    return valor;
  }

  if (typeof valor === "object") {
    for (const clave of Object.keys(valor)) {
      if (CAMPOS_CONTACTO.has(clave)) {
        valor[clave] = valor[clave] ? MARCA : valor[clave];
      } else {
        valor[clave] = ocultarContacto(valor[clave], profundidad + 1);
      }
    }
    return valor;
  }

  return valor;
}

/**
 * Lee el rol del token. El middleware se monta a nivel de app, antes de que
 * cada router aplique su propio authMiddleware, así que resuelve el rol por su
 * cuenta. Si el token no es válido no hace nada: la ruta lo rechazará igual.
 */
function rolDelToken(req) {
  if (req.user?.role) return String(req.user.role).toLowerCase();
  const cabecera = req.headers["authorization"] || req.headers["Authorization"];
  if (!cabecera) return "";
  const [, token] = String(cabecera).split(" ");
  if (!token) return "";
  try {
    return String(jwt.verify(token, SECRET)?.role || "").toLowerCase();
  } catch {
    return "";
  }
}

/**
 * Middleware: quita el teléfono de las respuestas para los roles restringidos.
 */
export function ocultarContactoSegunRol(req, res, next) {
  if (!ROLES_SIN_CONTACTO.has(rolDelToken(req))) return next();

  const jsonOriginal = res.json.bind(res);
  res.json = (cuerpo) => jsonOriginal(ocultarContacto(cuerpo));
  next();
}

/** Para que el frontend sepa si debe mostrar el campo o un aviso. */
export function puedeVerContacto(rol) {
  return !ROLES_SIN_CONTACTO.has(String(rol || "").toLowerCase());
}

export default ocultarContactoSegunRol;
