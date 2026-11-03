import React, { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useToast } from "./ToastProvider";

const ProtectedRoute = ({ children, requiredRole, allowedRoles }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { showToast } = useToast();

  const checkRole = () => {
    const userRole = localStorage.getItem("role");
    if (userRole === "master") return true;
    if (allowedRoles && Array.isArray(allowedRoles)) {
      return allowedRoles.includes(userRole);
    }
    if (requiredRole) {
      return userRole === requiredRole;
    }
    return true;
  };

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      showToast({ severity: "warning", message: "Inicia sesión para continuar" });
      navigate("/", { replace: true, state: { from: location.pathname } });
      return;
    }

    if (!checkRole()) {
      showToast({ severity: "error", message: "No tienes permisos para acceder a esta sección" });
      navigate("/dashboard", { replace: true });
    }
  }, [navigate, showToast, location.pathname, requiredRole, allowedRoles]);

  const token = localStorage.getItem("token");
  if (!token) return null;

  if (!checkRole()) return null;

  // El botón de cerrar sesión vive en la barra superior del Dashboard
  return <>{children}</>;
};

export default ProtectedRoute;
