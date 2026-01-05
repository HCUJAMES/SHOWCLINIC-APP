import React, { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Box, Button } from "@mui/material";
import { useToast } from "./ToastProvider";

const ProtectedRoute = ({ children, requiredRole }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { showToast } = useToast();

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      showToast({ severity: "warning", message: "Inicia sesión para continuar" });
      navigate("/", { replace: true, state: { from: location.pathname } });
      return;
    }

    // Verificar rol si es requerido
    if (requiredRole) {
      const userRole = localStorage.getItem("role");
      if (userRole !== requiredRole) {
        showToast({ severity: "error", message: "No tienes permisos para acceder a esta sección" });
        navigate("/dashboard", { replace: true });
      }
    }
  }, [navigate, showToast, location.pathname, requiredRole]);

  const token = localStorage.getItem("token");
  if (!token) return null;

  // Verificar rol si es requerido
  if (requiredRole) {
    const userRole = localStorage.getItem("role");
    if (userRole !== requiredRole) return null;
  }

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    showToast({ severity: "success", message: "Sesión cerrada" });
    navigate("/", { replace: true });
  };

  return (
    <>
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
      {children}
    </>
  );
};

export default ProtectedRoute;
