import React, { useState } from "react";
import { TextField, Button, Typography, Box, InputAdornment, IconButton, CircularProgress } from "@mui/material";
import { Visibility, VisibilityOff, PersonOutline, LockOutlined } from "@mui/icons-material";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { useToast } from "../components/ToastProvider";
import { BRAND, FONTS, LOGOS } from "../brand";

const API_BASE =
  process.env.REACT_APP_API_URL ||
  `${window.location.protocol}//${window.location.hostname}:4000`;


export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const navigate = useNavigate();
  const { showToast } = useToast();

  // Foto de fondo a pantalla completa
  const backgroundImage = "/images/login-fondo.jpg";

  const handleLogin = async () => {
    try {
      const res = await axios.post(`${API_BASE}/api/auth/login`, {
        username: username.trim(),
        password: password.trim(),
      });
      localStorage.setItem("token", res.data.token);
      localStorage.setItem("role", res.data.role);
      localStorage.setItem("username", username.trim());
      // El saludo ya aparece en la cabecera del Dashboard
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

  const onSubmit = async (e) => {
    e.preventDefault();
    if (enviando) return;
    setEnviando(true);
    try {
      await handleLogin();
    } finally {
      setEnviando(false);
    }
  };

  // Campos sobre vidrio: blancos semitransparentes que dejan ver el fondo
  const campo = {
    "& .MuiOutlinedInput-root": {
      backgroundColor: "rgba(255,255,255,0.72)",
      borderRadius: "14px",
      transition: "background-color .2s ease",
      "& input": { py: { xs: 1.6, md: 1.9 }, color: BRAND.texto, fontSize: "0.95rem" },
      "& .MuiOutlinedInput-notchedOutline": { borderColor: "rgba(255,255,255,0.6)" },
      "&:hover": { backgroundColor: "rgba(255,255,255,0.85)" },
      "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: "rgba(255,255,255,0.9)" },
      "&.Mui-focused": { backgroundColor: "rgba(255,255,255,0.92)" },
      "&.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: BRAND.oro, borderWidth: 1.5 },
    },
  };

  const etiqueta = {
    display: "block",
    fontSize: "0.8rem",
    fontWeight: 600,
    color: "#fff",
    mb: 1,
    letterSpacing: "0.06em",
    textShadow: "0 1px 6px rgba(60,35,10,0.35)",
  };

  return (
    <Box
      sx={{
        position: "relative",
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: { xs: "center", md: "flex-end" },
        px: { xs: 2, sm: 4, md: "7vw" },
        py: 4,
        overflow: "hidden",
        backgroundColor: "#b48a66",
        backgroundImage: `url('${backgroundImage}')`,
        backgroundSize: "cover",
        // La cara queda a la izquierda y el panel a la derecha
        backgroundPosition: { xs: "28% center", md: "35% center" },
        backgroundRepeat: "no-repeat",
        "&::before": {
          content: '""',
          position: "absolute",
          inset: 0,
          // Oscurece un poco solo el lado del formulario para que se lea bien
          background: {
            xs: "rgba(70,45,20,0.25)",
            md: "linear-gradient(90deg, rgba(70,45,20,0) 40%, rgba(70,45,20,0.28) 100%)",
          },
        },
      }}
    >
      {/* Marca arriba a la izquierda, sobre la foto */}
      <Box
        component="img"
        src={LOGOS.imagotipoBlanco}
        alt=""
        sx={{
          position: "absolute",
          top: { xs: 24, md: 36 },
          left: { xs: "50%", md: 40 },
          transform: { xs: "translateX(-50%)", md: "none" },
          width: { xs: 120, md: 140 },
          display: { xs: "none", sm: "block" },
          filter: "drop-shadow(0 2px 8px rgba(60,35,10,0.35))",
        }}
      />
      <Typography
        sx={{
          position: "absolute",
          left: 40,
          bottom: 36,
          display: { xs: "none", md: "block" },
          fontFamily: FONTS.titulo,
          color: "#fff",
          fontSize: { md: "1.2rem", lg: "1.45rem" },
          letterSpacing: "0.08em",
          lineHeight: 1.4,
          textShadow: "0 2px 12px rgba(60,35,10,0.45)",
        }}
      >
        Seguridad que se siente,
        <br />
        belleza que se nota.
      </Typography>

      {/* Panel de acceso: vidrio esmerilado */}
      <Box
        component="form"
        onSubmit={onSubmit}
        noValidate
        sx={{
          position: "relative",
          zIndex: 1,
          width: "100%",
          // Proporción cercana a 4:5, más presente en pantalla
          maxWidth: { xs: 440, md: 500, xl: 540 },
          minHeight: { md: "min(660px, 82vh)" },
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          px: { xs: 3.5, sm: 6, md: 7 },
          py: { xs: 5, sm: 6 },
          borderRadius: "32px",
          backgroundColor: "rgba(255,248,238,0.16)",
          backdropFilter: "blur(22px) saturate(140%)",
          WebkitBackdropFilter: "blur(22px) saturate(140%)",
          border: "1px solid rgba(255,255,255,0.38)",
          boxShadow: "0 30px 60px -20px rgba(60,35,10,0.45), inset 0 1px 0 rgba(255,255,255,0.35)",
          animation: "entrarPanel .7s cubic-bezier(.22,1,.36,1) both",
          "@keyframes entrarPanel": {
            from: { opacity: 0, transform: "translateY(16px)" },
            to: { opacity: 1, transform: "none" },
          },
        }}
      >
        <Box sx={{ textAlign: "center", mb: { xs: 4, md: 5 } }}>
          <Box
            component="img"
            src={LOGOS.isotipoLineaCrema}
            alt="ShowClinic"
            sx={{ width: { xs: 76, md: 92 }, height: { xs: 76, md: 92 }, display: "block", mx: "auto", mb: 2, filter: "drop-shadow(0 2px 8px rgba(60,35,10,0.3))" }}
          />
          <Typography
            component="h1"
            sx={{
              fontFamily: FONTS.titulo,
              fontSize: { xs: "1.55rem", md: "1.9rem" },
              letterSpacing: "0.14em",
              color: "#fff",
              textShadow: "0 2px 10px rgba(60,35,10,0.35)",
            }}
          >
            Iniciar sesión
          </Typography>
          <Typography sx={{ color: "rgba(255,255,255,0.9)", fontSize: { xs: "0.88rem", md: "0.95rem" }, mt: 1, textShadow: "0 1px 6px rgba(60,35,10,0.35)" }}>
            Ingresa tu usuario y contraseña
          </Typography>
        </Box>

        <Typography component="label" htmlFor="login-usuario" sx={etiqueta}>
          Usuario
        </Typography>
        <TextField
          id="login-usuario"
          fullWidth
          autoFocus
          autoComplete="username"
          placeholder="Tu usuario"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <PersonOutline sx={{ color: BRAND.oro }} />
              </InputAdornment>
            ),
          }}
          sx={{ ...campo, mb: 3 }}
        />

        <Typography component="label" htmlFor="login-clave" sx={etiqueta}>
          Contraseña
        </Typography>
        <TextField
          id="login-clave"
          fullWidth
          autoComplete="current-password"
          type={showPassword ? "text" : "password"}
          placeholder="Tu contraseña"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <LockOutlined sx={{ color: BRAND.oro }} />
              </InputAdornment>
            ),
            endAdornment: (
              <InputAdornment position="end">
                <IconButton
                  aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                  onClick={() => setShowPassword(!showPassword)}
                  edge="end"
                  sx={{ color: BRAND.oro }}
                >
                  {showPassword ? <VisibilityOff /> : <Visibility />}
                </IconButton>
              </InputAdornment>
            ),
          }}
          sx={{ ...campo, mb: 4.5 }}
        />

        <Button
          type="submit"
          fullWidth
          variant="contained"
          disabled={enviando}
          sx={{
            py: { xs: 1.7, md: 2 },
            borderRadius: "14px",
            fontSize: "1rem",
            letterSpacing: "0.08em",
            boxShadow: "0 10px 24px -10px rgba(92,60,18,0.6)",
            "&.Mui-disabled": { backgroundColor: BRAND.oroOscuro, color: "#fff" },
          }}
        >
          {enviando ? <CircularProgress size={22} sx={{ color: "white" }} /> : "Ingresar"}
        </Button>

        <Typography sx={{ textAlign: "center", mt: 5, color: "rgba(255,255,255,0.8)", fontSize: "0.7rem", letterSpacing: "0.12em" }}>
          SHOWCLINIC © {new Date().getFullYear()}
        </Typography>
      </Box>
    </Box>
  );
}
