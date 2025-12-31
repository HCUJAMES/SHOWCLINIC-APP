import axios from "axios";

// Base URL del backend (usa variable de entorno si existe, sino detecta automáticamente)
const API_BASE_URL =
  process.env.REACT_APP_API_URL ||
  `${window.location.protocol}//${window.location.hostname}:4000`;

// Crear instancia de axios con configuración base
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000, // 30 segundos
  headers: {
    "Content-Type": "application/json",
  },
});

// Interceptor de request: agrega Authorization header automáticamente
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Interceptor de response: maneja errores de autenticación globalmente
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;

    // Si el token expiró o es inválido, redirigir a login
    if (status === 401) {
      const currentPath = window.location.pathname;
      // No redirigir si ya estamos en login
      if (currentPath !== "/" && currentPath !== "/login") {
        localStorage.removeItem("token");
        localStorage.removeItem("role");
        window.location.href = "/";
      }
    }

    return Promise.reject(error);
  }
);

// Helper para obtener headers de auth (para fetch nativo si se necesita)
export const getAuthHeaders = () => {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

// Exportar la URL base para casos donde se necesite
export { API_BASE_URL };

export default api;
