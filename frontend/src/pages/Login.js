import React, { useState } from "react";
import {
  TextField,
  Button,
  Typography,
  Box,
  Paper,
  Avatar,
} from "@mui/material";
import axios from "axios";
import { useNavigate } from "react-router-dom";

import API_BASE from "../config/api";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();

  const handleLogin = async () => {
    try {
      const res = await axios.post(`${API_BASE}/api/auth/login`, {
        username: username.trim(),
        password: password.trim(),
      });
      localStorage.setItem("token", res.data.token);
      localStorage.setItem("role", res.data.role);
      navigate("/dashboard");
    } catch (e) {
      const status = e.response?.status;
      if (status === 400 || status === 401) {
        alert("Usuario o contraseña incorrectos");
      } else {
        alert(
          "No se pudo conectar con el servidor. Verifica que el backend esté ejecutándose y accesible."
        );
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
        background: "linear-gradient(135deg, #ffffff 0%, #f7eac1 100%)",
      }}
    >
      <Paper
        elevation={10}
        sx={{
          p: 5,
          borderRadius: 5,
          textAlign: "center",
          width: 400,
          backgroundColor: "white",
          border: "1px solid #e0e0e0",
          boxShadow: "0 10px 30px rgba(212,175,55,0.2)",
        }}
      >
        <Avatar
          src="/logo-showclinic.png"
          alt="ShowClinic"
          sx={{
            width: 90,
            height: 90,
            mx: "auto",
            mb: 2,
            bgcolor: "#D4AF37",
            boxShadow: "0 0 15px rgba(212,175,55,0.6)",
          }}
        />
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
        />
        <TextField
          label="Contraseña"
          type="password"
          fullWidth
          margin="normal"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
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
