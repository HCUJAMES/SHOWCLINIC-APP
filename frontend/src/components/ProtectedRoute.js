import React, { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Box, Button } from "@mui/material";
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

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    showToast({ severity: "success", message: "Sesión cerrada" });
    navigate("/", { replace: true });
  };

  // Mostrar el botón de cerrar sesión solo en el Dashboard
  const showLogoutButton = location.pathname === "/dashboard";

  return (
    <>
      {showLogoutButton && (
        <Box
          sx={{
            position: "fixed",
            top: 12,
            right: 12,
            zIndex: 1400,
          }}
        >
          <Button
            variant="outlined"
            size="small"
            onClick={logout}
            sx={{
              textTransform: "none",
              fontWeight: 700,
            }}
          >
            Cerrar sesión
          </Button>
        </Box>
      )}
      {children}
    </>
  );
};

export default ProtectedRoute;
