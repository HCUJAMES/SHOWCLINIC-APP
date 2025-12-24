import React, { useState } from "react";
import { TextField, Button, Typography, Box, Paper } from "@mui/material";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { useToast } from "../components/ToastProvider";

const API_BASE =
  process.env.REACT_APP_API_URL ||
  `${window.location.protocol}//${window.location.hostname}:4000`;

const LOGIN_IMAGES = [
  "/images/fondologin.jpg",
  "/images/fondologin2.jpg",
  "/images/fondologin3.jpg",
  "/images/fondologin6.jpg",
  "/images/fondologin5.jpg",
  "/images/fondologin6.jpg",
];

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
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
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        backgroundImage:
          "radial-gradient(circle at top, rgba(255,255,255,0.8), rgba(255,255,255,0.35), rgba(0,0,0,0.45))",
        backgroundRepeat: "no-repeat",
        backgroundSize: "cover",
        backgroundPosition: "center",
        position: "relative",
      }}
    >
      {/* Faja de fondo dorada detrás de las imágenes */}
      <Box
        sx={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "100%",
          maxWidth: 1600,
          height: "100vh",
          borderRadius: 12,
          background:
            "linear-gradient(90deg, rgba(212,175,55,0.25), rgba(233,196,106,0.35), rgba(212,175,55,0.25))",
          boxShadow: "0 0 30px rgba(212,175,55,0.35)",
          filter: "blur(0.3px)",
        }}
      />

      {/* Fila de imágenes con esquinas redondeadas */}
      <Box
        sx={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "100%",
          maxWidth: 1600,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          pointerEvents: "none",
        }}
      >
        {LOGIN_IMAGES.map((src, idx) => (
          <Box
            key={src}
            sx={{
              width: "22%",
              minWidth: 260,
              height: "82vh",
              borderRadius: 10,
              overflow: "hidden",
              boxShadow: "0 0 18px rgba(212,175,55,0.5)",
              border: "1px solid rgba(212,175,55,0.55)",
              backgroundColor: "#D4AF37",
              opacity: 0.94,
            }}
          >
            <img
              src={src}
              alt={`Fondo login ${idx + 1}`}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                display: "block",
              }}
            />
          </Box>
        ))}
      </Box>
      <Paper
        elevation={10}
        sx={{
          p: 5,
          borderRadius: 5,
          textAlign: "center",
          width: 400,
          background:
            "linear-gradient(180deg, rgba(255,249,236,0.98) 0%, rgba(255,255,255,0.92) 52%, rgba(247,234,193,0.55) 100%)",
          border: "1px solid rgba(212,175,55,0.35)",
          backdropFilter: "blur(8px)",
          boxShadow: "0 18px 46px rgba(0,0,0,0.12), 0 0 0 1px rgba(212,175,55,0.12)",
          position: "relative",
          zIndex: 1,
        }}
      >
        <Box sx={{ mb: 2 }}>
          <img
            src="/logo-showclinic.png"
            alt="ShowClinic"
            style={{
              width: 140,
              height: 140,
              objectFit: "cover",
              display: "block",
              margin: "0 auto",
              borderRadius: "50%",
              backgroundColor: "rgba(255,255,255,0.96)",
              border: "2px solid rgba(212,175,55,0.55)",
              boxShadow:
                "0 10px 24px rgba(0,0,0,0.08), 0 0 18px rgba(212,175,55,0.25)",
            }}
          />
        </Box>
        <Typography
          variant="h4"
          sx={{ mb: 1, fontWeight: "bold", color: "#D4AF37" }}
        >
          SHOWCLINIC
        </Typography>
        <Typography variant="subtitle1" sx={{ mb: 3, color: "#2E2E2E" }}>
          Iniciar sesión
        </Typography>

        <TextField
          label="Usuario"
          fullWidth
          margin="normal"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          sx={{
            "& .MuiInputBase-root": {
              backgroundColor: "rgba(255,255,255,0.72)",
              borderRadius: 2,
            },
          }}
        />
        <TextField
          label="Contraseña"
          type="password"
          fullWidth
          margin="normal"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          sx={{
            "& .MuiInputBase-root": {
              backgroundColor: "rgba(255,255,255,0.72)",
              borderRadius: 2,
            },
          }}
        />

        <Button
          variant="contained"
          fullWidth
          sx={{
            mt: 3,
            py: 1.3,
            fontWeight: "bold",
            fontSize: "1rem",
            borderRadius: "30px",
            background: "linear-gradient(90deg, #D4AF37, #E9C46A)",
            color: "white",
            "&:hover": {
              background: "linear-gradient(90deg, #B8860B, #D4AF37)",
            },
          }}
          onClick={handleLogin}
        >
          Entrar
        </Button>
      </Paper>
    </Box>
  );
}
