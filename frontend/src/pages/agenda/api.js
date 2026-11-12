import api from "../../api/axios";

/** Mensaje legible de un error de la API (el backend ya los manda en español). */
export const mensajeError = (err, porDefecto = "No se pudo completar la acción.") => {
  if (err?.response?.data?.message) return err.response.data.message;
  if (err?.code === "ECONNABORTED") return "El servidor tardó demasiado en responder. Intenta de nuevo.";
  if (!err?.response) return "No hay conexión con el servidor de la clínica.";
  return porDefecto;
};

const BASE = "/api/calendario";

export const agendaApi = {
  estado: () => api.get(`${BASE}/estado`).then((r) => r.data),
  conectar: (datos) => api.post(`${BASE}/conectar`, datos, { timeout: 45000 }).then((r) => r.data),
  desconectar: () => api.delete(`${BASE}/conectar`).then((r) => r.data),
  listar: (desde, hasta) => api.get(`${BASE}/eventos`, { params: { desde, hasta } }).then((r) => r.data),
  delPaciente: (pacienteId) => api.get(`${BASE}/paciente/${pacienteId}/eventos`).then((r) => r.data),
  crear: (datos) => api.post(`${BASE}/eventos`, datos).then((r) => r.data),
  actualizar: (id, datos) => api.put(`${BASE}/eventos/${encodeURIComponent(id)}`, datos).then((r) => r.data),
  mover: (id, datos) => api.patch(`${BASE}/eventos/${encodeURIComponent(id)}/mover`, datos).then((r) => r.data),
  eliminar: (id) => api.delete(`${BASE}/eventos/${encodeURIComponent(id)}`).then((r) => r.data),

  // Datos del sistema para el formulario
  buscarPacientes: (term) => api.get("/api/pacientes/buscar", { params: { term } }).then((r) => r.data),
  especialistas: () => api.get("/api/especialistas/listar").then((r) => r.data),
  tratamientos: () => api.get("/api/tratamientos/listar").then((r) => r.data),
};

export default agendaApi;
