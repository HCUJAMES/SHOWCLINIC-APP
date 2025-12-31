import React, { useState } from "react";
import { TextField, Button, Typography, Box, InputAdornment, IconButton, Checkbox, FormControlLabel } from "@mui/material";
import { Visibility, VisibilityOff, PersonOutline, LockOutlined } from "@mui/icons-material";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { useToast } from "../components/ToastProvider";

const API_BASE =
  process.env.REACT_APP_API_URL ||
  `${window.location.protocol}//${window.location.hostname}:4000`;


export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const navigate = useNavigate();
  const { showToast } = useToast();

  const handleLogin = async () => {
    try {
      const res = await axios.post(`${API_BASE}/api/auth/login`, {
        username: username.trim(),
        password: password.trim(),
      });
      localStorage.setItem("token", res.data.token);
      localStorage.setItem("role", res.data.role);
      showToast({ severity: "success", message: "Bienvenido" });
      navigate("/dashboard");
    } catch (e) {
      const status = e.response?.status;
      if (status === 400 || status === 401) {
        showToast({ severity: "error", message: "Usuario o contraseña incorrectos" });
      } else {
        showToast({
          severity: "error",
          message:
            "No se pudo conectar con el servidor. Verifica que el backend esté ejecutándose y accesible.",
        });
      }
    }
  };

  return (
    <Box
      sx={{
        display: "flex",
        minHeight: "100vh",
        overflow: "hidden",
        backgroundImage: "url('/images/fondologin.jpg')",
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      {/* LADO IZQUIERDO - Welcome Back */}
      <Box
        sx={{
          flex: 1,
          position: "relative",
          backgroundImage: "url('/images/fondologin.jpg')",
          backgroundSize: "cover",
          backgroundPosition: "center",
          display: { xs: "none", md: "flex" },
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "flex-start",
          px: 8,
          "&::before": {
            content: '""',
            position: "absolute",
            inset: 0,
            background: "linear-gradient(135deg, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.5) 50%, rgba(0,0,0,0.7) 100%)",
          },
        }}
      >
        <Box sx={{ position: "relative", zIndex: 1 }}>
          <Typography
            variant="h2"
            sx={{
              color: "white",
              fontWeight: 800,
              mb: 2,
              fontSize: { md: "3rem", lg: "3.5rem" },
              lineHeight: 1.2,
            }}
          >
            Bienvenido
            <br />
            de Vuelta
          </Typography>
          <Typography
            variant="body1"
            sx={{
              color: "rgba(255,255,255,0.85)",
              maxWidth: 400,
              mb: 4,
              lineHeight: 1.6,
            }}
          >
            Sistema de gestión clínica para ShowClinic. Inicia sesión para acceder a tu panel de control.
          </Typography>
        </Box>
      </Box>

      {/* LADO DERECHO - Sign In Form */}
      <Box
        sx={{
          flex: { xs: 1, md: 0.8 },
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          px: { xs: 3, sm: 6, md: 8 },
          py: 4,
          background: "rgba(255, 255, 255, 0.85)",
          backdropFilter: "blur(10px)",
        }}
      >
        <Box sx={{ width: "100%", maxWidth: 420 }}>
          {/* Logo */}
          <Box sx={{ textAlign: "center", mb: 4 }}>
            <img
              src="/logo-showclinic.png"
              alt="ShowClinic"
              style={{
                width: 100,
                height: 100,
                objectFit: "cover",
                borderRadius: "50%",
                backgroundColor: "white",
                border: "3px solid #D4AF37",
                boxShadow: "0 4px 12px rgba(212,175,55,0.2)",
              }}
            />
          </Box>

          {/* Título */}
          <Typography
            variant="h4"
            sx={{
              fontWeight: 700,
              mb: 1,
              color: "#2E2E2E",
              textAlign: "left",
            }}
          >
            Iniciar Sesión
          </Typography>
          <Typography
            variant="body2"
            sx={{
              mb: 4,
              color: "rgba(46,46,46,0.6)",
              textAlign: "left",
            }}
          >
            Ingresa tus credenciales para continuar
          </Typography>

          {/* Campo Usuario */}
          <Typography
            variant="body2"
            sx={{ mb: 0.5, fontWeight: 600, color: "#2E2E2E" }}
          >
            Usuario
          </Typography>
          <TextField
            fullWidth
            placeholder="Ingresa tu usuario"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && handleLogin()}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <PersonOutline sx={{ color: "rgba(0,0,0,0.4)" }} />
                </InputAdornment>
              ),
            }}
            sx={{
              mb: 3,
              "& .MuiOutlinedInput-root": {
                backgroundColor: "rgba(255, 255, 255, 0.9)",
                borderRadius: 2,
                backdropFilter: "blur(5px)",
                "& fieldset": {
                  borderColor: "rgba(0,0,0,0.15)",
                },
                "&:hover fieldset": {
                  borderColor: "rgba(212,175,55,0.5)",
                },
                "&.Mui-focused fieldset": {
                  borderColor: "#D4AF37",
                  borderWidth: 2,
                },
              },
            }}
          />

          {/* Campo Contraseña */}
          <Typography
            variant="body2"
            sx={{ mb: 0.5, fontWeight: 600, color: "#2E2E2E" }}
          >
            Contraseña
          </Typography>
          <TextField
            fullWidth
            type={showPassword ? "text" : "password"}
            placeholder="Ingresa tu contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && handleLogin()}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <LockOutlined sx={{ color: "rgba(0,0,0,0.4)" }} />
                </InputAdornment>
              ),
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    onClick={() => setShowPassword(!showPassword)}
                    edge="end"
                    sx={{ color: "rgba(0,0,0,0.4)" }}
                  >
                    {showPassword ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
            sx={{
              mb: 2,
              "& .MuiOutlinedInput-root": {
                backgroundColor: "rgba(255, 255, 255, 0.9)",
                borderRadius: 2,
                backdropFilter: "blur(5px)",
                "& fieldset": {
                  borderColor: "rgba(0,0,0,0.15)",
                },
                "&:hover fieldset": {
                  borderColor: "rgba(212,175,55,0.5)",
                },
                "&.Mui-focused fieldset": {
                  borderColor: "#D4AF37",
                  borderWidth: 2,
                },
              },
            }}
          />

          {/* Remember Me & Forgot Password */}
          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              mb: 3,
            }}
          >
            <FormControlLabel
              control={
                <Checkbox
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  sx={{
                    color: "rgba(0,0,0,0.3)",
                    "&.Mui-checked": {
                      color: "#D4AF37",
                    },
                  }}
                />
              }
              label={
                <Typography variant="body2" sx={{ color: "rgba(46,46,46,0.7)" }}>
                  Recordarme
                </Typography>
              }
            />
          </Box>

          {/* Botón Sign In */}
          <Button
            fullWidth
            variant="contained"
            onClick={handleLogin}
            sx={{
              py: 1.5,
              borderRadius: 2,
              backgroundColor: "#D4AF37",
              color: "white",
              fontWeight: 600,
              fontSize: "1rem",
              textTransform: "none",
              boxShadow: "0 4px 12px rgba(212,175,55,0.3)",
              transition: "all 0.3s ease",
              "&:hover": {
                backgroundColor: "#B8860B",
                boxShadow: "0 6px 16px rgba(212,175,55,0.4)",
                transform: "translateY(-2px)",
              },
              "&:active": {
                transform: "translateY(0px)",
              },
            }}
          >
            Iniciar Sesión
          </Button>

          {/* Footer */}
          <Typography
            variant="caption"
            sx={{
              display: "block",
              textAlign: "center",
              mt: 4,
              color: "rgba(46,46,46,0.5)",
            }}
          >
            ShowClinic CRM © 2024
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}
