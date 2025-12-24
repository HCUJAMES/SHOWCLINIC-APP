import React, { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Box, Button } from "@mui/material";
import { useToast } from "./ToastProvider";

const ProtectedRoute = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { showToast } = useToast();

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      showToast({ severity: "warning", message: "Inicia sesión para continuar" });
      navigate("/", { replace: true, state: { from: location.pathname } });
    }
  }, [navigate, showToast, location.pathname]);

  const token = localStorage.getItem("token");
  if (!token) return null;

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
