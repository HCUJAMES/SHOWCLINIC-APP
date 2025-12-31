/**
 * Hook personalizado para manejo de autenticación
 * Centraliza el acceso a token, rol y headers de autenticación
 */

export const useAuth = () => {
  const token = localStorage.getItem("token");
  const role = localStorage.getItem("role");
  const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};

  return {
    token,
    role,
    authHeaders,
    isAuthenticated: !!token,
  };
};
