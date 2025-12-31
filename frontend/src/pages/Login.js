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
          backgroundColor: "#FFFFFF",
          boxShadow: "-4px 0 24px rgba(0, 0, 0, 0.08)",
          animation: "slideInRight 0.6s ease-out",
          "@keyframes slideInRight": {
            "0%": {
              opacity: 0,
              transform: "translateX(30px)",
            },
            "100%": {
              opacity: 1,
              transform: "translateX(0)",
            },
          },
        }}
      >
        <Box sx={{ width: "100%", maxWidth: 450 }}>
          {/* Logo */}
          <Box 
            sx={{ 
              textAlign: "center", 
              mb: 5,
              animation: "fadeInScale 0.8s ease-out",
              "@keyframes fadeInScale": {
                "0%": {
                  opacity: 0,
                  transform: "scale(0.8)",
                },
                "100%": {
                  opacity: 1,
                  transform: "scale(1)",
                },
              },
            }}
          >
            <img
              src="/logo-showclinic.png"
              alt="ShowClinic"
              style={{
                width: 120,
                height: 120,
                objectFit: "cover",
                borderRadius: "50%",
                backgroundColor: "white",
                border: "4px solid #D4AF37",
                boxShadow: "0 8px 24px rgba(212,175,55,0.25)",
              }}
            />
          </Box>

          {/* Título */}
          <Typography
            variant="h4"
            sx={{
              fontWeight: 700,
              mb: 2,
              color: "#2E2E2E",
              textAlign: "center",
              animation: "fadeInUp 0.8s ease-out 0.2s both",
              "@keyframes fadeInUp": {
                "0%": {
                  opacity: 0,
                  transform: "translateY(20px)",
                },
                "100%": {
                  opacity: 1,
                  transform: "translateY(0)",
                },
              },
            }}
          >
            Iniciar Sesión
          </Typography>
          <Box
            sx={{
              width: 60,
              height: 3,
              backgroundColor: "#D4AF37",
              margin: "0 auto 16px",
              borderRadius: 2,
              animation: "expandWidth 0.6s ease-out 0.4s both",
              "@keyframes expandWidth": {
                "0%": {
                  width: 0,
                },
                "100%": {
                  width: 60,
                },
              },
            }}
          />
          <Typography
            variant="body2"
            sx={{
              mb: 5,
              color: "rgba(46,46,46,0.7)",
              textAlign: "center",
              animation: "fadeInUp 0.8s ease-out 0.3s both",
            }}
          >
            Ingresa tus credenciales para continuar
          </Typography>

          {/* Campo Usuario */}
          <Typography
            variant="body2"
            sx={{ 
              mb: 1, 
              fontWeight: 600, 
              color: "#2E2E2E", 
              textAlign: "center",
              animation: "fadeInUp 0.8s ease-out 0.4s both",
            }}
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
              mb: 3.5,
              animation: "fadeInUp 0.8s ease-out 0.5s both",
              "& .MuiOutlinedInput-root": {
                backgroundColor: "#FAFAFA",
                borderRadius: 2,
                transition: "all 0.3s ease",
                "& fieldset": {
                  borderColor: "rgba(0,0,0,0.12)",
                  transition: "all 0.3s ease",
                },
                "&:hover fieldset": {
                  borderColor: "rgba(212,175,55,0.5)",
                  backgroundColor: "#F5F5F5",
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
            sx={{ 
              mb: 1, 
              fontWeight: 600, 
              color: "#2E2E2E", 
              textAlign: "center",
              animation: "fadeInUp 0.8s ease-out 0.6s both",
            }}
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
              mb: 3,
              animation: "fadeInUp 0.8s ease-out 0.7s both",
              "& .MuiOutlinedInput-root": {
                backgroundColor: "#FAFAFA",
                borderRadius: 2,
                transition: "all 0.3s ease",
                "& fieldset": {
                  borderColor: "rgba(0,0,0,0.12)",
                  transition: "all 0.3s ease",
                },
                "&:hover fieldset": {
                  borderColor: "rgba(212,175,55,0.5)",
                  backgroundColor: "#F5F5F5",
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
              justifyContent: "center",
              alignItems: "center",
              mb: 4,
              animation: "fadeInUp 0.8s ease-out 0.8s both",
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
              py: 2,
              borderRadius: 2.5,
              backgroundColor: "#D4AF37",
              color: "white",
              fontWeight: 700,
              fontSize: "1.1rem",
              textTransform: "none",
              boxShadow: "0 6px 20px rgba(212,175,55,0.35)",
              transition: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
              animation: "fadeInUp 0.8s ease-out 0.9s both",
              "&:hover": {
                backgroundColor: "#B8860B",
                boxShadow: "0 8px 28px rgba(212,175,55,0.45)",
                transform: "translateY(-3px)",
              },
              "&:active": {
                transform: "translateY(-1px)",
                boxShadow: "0 4px 16px rgba(212,175,55,0.35)",
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
              mt: 5,
              color: "rgba(46,46,46,0.5)",
              animation: "fadeIn 1s ease-out 1s both",
              "@keyframes fadeIn": {
                "0%": {
                  opacity: 0,
                },
                "100%": {
                  opacity: 1,
                },
              },
            }}
          >
            ShowClinic CRM © 2026
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}
