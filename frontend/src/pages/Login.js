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
          background: "linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(255, 255, 255, 0.98) 100%)",
          backdropFilter: "blur(20px)",
          boxShadow: "-8px 0 32px rgba(0, 0, 0, 0.12), inset 0 0 0 1px rgba(255, 255, 255, 0.5)",
          animation: "slideInRight 0.8s cubic-bezier(0.4, 0, 0.2, 1)",
          "@keyframes slideInRight": {
            "0%": {
              opacity: 0,
              transform: "translateX(40px)",
            },
            "100%": {
              opacity: 1,
              transform: "translateX(0)",
            },
          },
        }}
      >
        <Box sx={{ width: "100%", maxWidth: 420 }}>
          {/* Logo */}
          <Box 
            sx={{ 
              textAlign: "center", 
              mb: 5,
              animation: "fadeInScale 1s cubic-bezier(0.4, 0, 0.2, 1) 0.2s both",
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
            <Box
              sx={{
                position: "relative",
                display: "inline-block",
                "&::before": {
                  content: '""',
                  position: "absolute",
                  inset: -8,
                  background: "linear-gradient(135deg, rgba(212, 175, 55, 0.1), rgba(212, 175, 55, 0.05))",
                  borderRadius: "50%",
                  animation: "pulse 3s ease-in-out infinite",
                },
                "@keyframes pulse": {
                  "0%, 100%": {
                    opacity: 0.5,
                    transform: "scale(1)",
                  },
                  "50%": {
                    opacity: 1,
                    transform: "scale(1.05)",
                  },
                },
              }}
            >
              <img
                src="/logo-showclinic.png"
                alt="ShowClinic"
                style={{
                  width: 110,
                  height: 110,
                  objectFit: "cover",
                  borderRadius: "50%",
                  backgroundColor: "white",
                  border: "4px solid #D4AF37",
                  boxShadow: "0 8px 24px rgba(212,175,55,0.3), 0 0 0 8px rgba(212,175,55,0.05)",
                  position: "relative",
                }}
              />
            </Box>
          </Box>

          {/* Título */}
          <Typography
            variant="h4"
            sx={{
              fontWeight: 700,
              mb: 2,
              color: "#2E2E2E",
              textAlign: "center",
              animation: "fadeInUp 0.8s cubic-bezier(0.4, 0, 0.2, 1) 0.3s both",
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
            INICIAR SESIÓN
          </Typography>
          <Box
            sx={{
              width: 60,
              height: 3,
              background: "linear-gradient(90deg, #D4AF37, #F4D03F)",
              margin: "0 auto 16px",
              borderRadius: 2,
              boxShadow: "0 2px 8px rgba(212,175,55,0.3)",
              animation: "expandWidth 0.8s cubic-bezier(0.4, 0, 0.2, 1) 0.5s both",
              "@keyframes expandWidth": {
                "0%": {
                  width: 0,
                  opacity: 0,
                },
                "100%": {
                  width: 60,
                  opacity: 1,
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
              animation: "fadeInUp 0.8s cubic-bezier(0.4, 0, 0.2, 1) 0.4s both",
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
              animation: "fadeInUp 0.8s cubic-bezier(0.4, 0, 0.2, 1) 0.5s both",
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
                  <PersonOutline sx={{ color: "rgba(212,175,55,0.6)" }} />
                </InputAdornment>
              ),
            }}
            sx={{
              mb: 3.5,
              animation: "fadeInUp 0.8s cubic-bezier(0.4, 0, 0.2, 1) 0.6s both",
              "& .MuiOutlinedInput-root": {
                backgroundColor: "rgba(250, 250, 250, 0.7)",
                backdropFilter: "blur(10px)",
                borderRadius: 3,
                transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                "& fieldset": {
                  borderColor: "rgba(212,175,55,0.15)",
                  transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                },
                "&:hover": {
                  backgroundColor: "rgba(255, 255, 255, 0.9)",
                  boxShadow: "0 4px 12px rgba(212,175,55,0.15)",
                  transform: "translateY(-2px)",
                },
                "&:hover fieldset": {
                  borderColor: "rgba(212,175,55,0.4)",
                },
                "&.Mui-focused": {
                  backgroundColor: "rgba(255, 255, 255, 0.95)",
                  boxShadow: "0 6px 20px rgba(212,175,55,0.2)",
                  transform: "translateY(-2px)",
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
              animation: "fadeInUp 0.8s cubic-bezier(0.4, 0, 0.2, 1) 0.7s both",
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
                  <LockOutlined sx={{ color: "rgba(212,175,55,0.6)" }} />
                </InputAdornment>
              ),
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    onClick={() => setShowPassword(!showPassword)}
                    edge="end"
                    sx={{ 
                      color: "rgba(212,175,55,0.6)",
                      transition: "all 0.3s ease",
                      "&:hover": {
                        color: "#D4AF37",
                        transform: "scale(1.1)",
                      },
                    }}
                  >
                    {showPassword ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
            sx={{
              mb: 3,
              animation: "fadeInUp 0.8s cubic-bezier(0.4, 0, 0.2, 1) 0.8s both",
              "& .MuiOutlinedInput-root": {
                backgroundColor: "rgba(250, 250, 250, 0.7)",
                backdropFilter: "blur(10px)",
                borderRadius: 3,
                transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                "& fieldset": {
                  borderColor: "rgba(212,175,55,0.15)",
                  transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                },
                "&:hover": {
                  backgroundColor: "rgba(255, 255, 255, 0.9)",
                  boxShadow: "0 4px 12px rgba(212,175,55,0.15)",
                  transform: "translateY(-2px)",
                },
                "&:hover fieldset": {
                  borderColor: "rgba(212,175,55,0.4)",
                },
                "&.Mui-focused": {
                  backgroundColor: "rgba(255, 255, 255, 0.95)",
                  boxShadow: "0 6px 20px rgba(212,175,55,0.2)",
                  transform: "translateY(-2px)",
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
              animation: "fadeInUp 0.8s cubic-bezier(0.4, 0, 0.2, 1) 0.9s both",
            }}
          >
            <FormControlLabel
              control={
                <Checkbox
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  sx={{
                    color: "rgba(212,175,55,0.4)",
                    transition: "all 0.3s ease",
                    "&.Mui-checked": {
                      color: "#D4AF37",
                    },
                    "&:hover": {
                      transform: "scale(1.1)",
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
              borderRadius: 3,
              background: "linear-gradient(135deg, #D4AF37 0%, #F4D03F 100%)",
              color: "white",
              fontWeight: 700,
              fontSize: "1.05rem",
              textTransform: "none",
              letterSpacing: "0.5px",
              boxShadow: "0 6px 20px rgba(212,175,55,0.4), 0 0 0 0 rgba(212,175,55,0.5)",
              position: "relative",
              overflow: "hidden",
              animation: "fadeInUp 0.8s cubic-bezier(0.4, 0, 0.2, 1) 1s both",
              transition: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
              "&::before": {
                content: '""',
                position: "absolute",
                top: 0,
                left: "-100%",
                width: "100%",
                height: "100%",
                background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)",
                transition: "left 0.5s ease",
              },
              "&:hover": {
                background: "linear-gradient(135deg, #F4D03F 0%, #D4AF37 100%)",
                boxShadow: "0 8px 28px rgba(212,175,55,0.5), 0 0 0 4px rgba(212,175,55,0.1)",
                transform: "translateY(-3px)",
              },
              "&:hover::before": {
                left: "100%",
              },
              "&:active": {
                transform: "translateY(-1px)",
                boxShadow: "0 4px 16px rgba(212,175,55,0.4)",
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
              animation: "fadeIn 1s ease-out 1.2s both",
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
