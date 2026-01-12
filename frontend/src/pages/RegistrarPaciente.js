import React, { useState } from "react";
import {
  Box,
  TextField,
  Typography,
  Button,
  Grid,
  Paper,
  MenuItem,
  IconButton,
} from "@mui/material";
import { ArrowBack, Home } from "@mui/icons-material";
import { useNavigate } from "react-router-dom";
import { useToast } from "../components/ToastProvider";
import { useAuth } from "../hooks/useAuth";
import { COLORS, API_BASE_URL } from "../constants";

export default function RegistrarPaciente() {
  const navigate = useNavigate();
  const colorPrincipal = COLORS.PRIMARY;
  const { showToast } = useToast();
  const { token } = useAuth();
  const [formData, setFormData] = useState({
    tipoDocumento: "DNI",
    dni: "",
    nombre: "",
    apellido: "",
    edad: "",
    sexo: "",
    direccion: "",
    ocupacion: "",
    fechaNacimiento: "",
    ciudadNacimiento: "",
    ciudadResidencia: "",
    alergias: "",
    enfermedad: "",
    correo: "",
    celular: "",
    cirugiaEstetica: "",
    embarazada: "",
    drogas: "",
    tabaco: "",
    alcohol: "",
    referencia: "",
    referenciaDetalle: "",
    numeroHijos: "",
  });

  const [errors, setErrors] = useState({});

  const handleChange = (e) => {
    const { name, value } = e.target;

    if (name === "dni") {
      setFormData({ ...formData, [name]: value });
      setErrors((prev) => ({ ...prev, dni: "" }));
      return;
    }

    if (name === "celular") {
      setFormData({ ...formData, [name]: value });
      setErrors((prev) => ({ ...prev, celular: "" }));
      return;
    }

    setFormData({ ...formData, [name]: value });
    if (name === "nombre" || name === "apellido") {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  const validar = () => {
    const tipoDocumento = String(formData.tipoDocumento || "").trim();
    const dni = String(formData.dni || "").trim();
    const nombre = String(formData.nombre || "").trim();
    const apellido = String(formData.apellido || "").trim();
    const celular = String(formData.celular || "").trim();

    const next = {};
    if (!dni) next.dni = "El documento es obligatorio";
    
    if (!nombre) next.nombre = "El nombre es obligatorio";
    if (!apellido) next.apellido = "El apellido es obligatorio";

    if (!celular) next.celular = "El celular es obligatorio";

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        backgroundImage: "url('/images/background-showclinic.jpg')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        p: 4,
        "&::before": {
          content: '""',
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(135deg, rgba(255,255,255,0.6), rgba(247,234,193,0.55))",
          zIndex: 0,
        },
        "& > *": { position: "relative", zIndex: 1 },
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Paper
        elevation={6}
        sx={{
          p: 4,
          width: "80%",
          maxWidth: "1000px",
          borderRadius: 4,
          background:
            "linear-gradient(180deg, rgba(255,249,236,0.98) 0%, rgba(255,255,255,0.92) 52%, rgba(247,234,193,0.55) 100%)",
          border: "1px solid rgba(212,175,55,0.22)",
          backdropFilter: "blur(10px)",
          boxShadow:
            "0 16px 40px rgba(0,0,0,0.10), 0 0 0 1px rgba(212,175,55,0.10)",
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
          <IconButton onClick={() => navigate("/pacientes")} sx={{ color: colorPrincipal }}>
            <ArrowBack />
          </IconButton>
          <Typography
            variant="h5"
            sx={{ color: colorPrincipal, fontWeight: "bold", flex: 1, textAlign: "center" }}
          >
            Registro de Paciente
          </Typography>
          <IconButton onClick={() => navigate("/dashboard")} sx={{ color: colorPrincipal }} title="Inicio">
            <Home />
          </IconButton>
        </Box>

        <Grid container spacing={2}>
          {/* Primera fila */}
          <Grid item xs={12} sm={6} md={2}>
            <TextField
              select
              label="Tipo Documento"
              name="tipoDocumento"
              value={formData.tipoDocumento}
              onChange={handleChange}
              fullWidth
              sx={{
                "& .MuiInputBase-root": {
                  backgroundColor: "rgba(255,255,255,0.72)",
                  borderRadius: 2,
                },
              }}
            >
              <MenuItem value="DNI">DNI</MenuItem>
              <MenuItem value="PASAPORTE">PASAPORTE</MenuItem>
              <MenuItem value="C.E.">C.E.</MenuItem>
            </TextField>
          </Grid>
          <Grid item xs={12} sm={6} md={2}>
            <TextField
              label="Número de Documento"
              name="dni"
              value={formData.dni}
              onChange={handleChange}
              required
              error={Boolean(errors.dni)}
              helperText={errors.dni || ""}
              fullWidth
              sx={{
                "& .MuiInputBase-root": {
                  backgroundColor: "rgba(255,255,255,0.72)",
                  borderRadius: 2,
                },
              }}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={2}>
            <TextField
              label="Nombre"
              name="nombre"
              value={formData.nombre}
              onChange={handleChange}
              required
              error={Boolean(errors.nombre)}
              helperText={errors.nombre || ""}
              fullWidth
              sx={{
                "& .MuiInputBase-root": {
                  backgroundColor: "rgba(255,255,255,0.72)",
                  borderRadius: 2,
                },
              }}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={2}>
            <TextField
              label="Apellido"
              name="apellido"
              value={formData.apellido}
              onChange={handleChange}
              required
              error={Boolean(errors.apellido)}
              helperText={errors.apellido || ""}
              fullWidth
              sx={{
                "& .MuiInputBase-root": {
                  backgroundColor: "rgba(255,255,255,0.72)",
                  borderRadius: 2,
                },
              }}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={2}>
            <TextField
              label="Edad"
              name="edad"
              value={formData.edad}
              onChange={handleChange}
              fullWidth
              sx={{
                "& .MuiInputBase-root": {
                  backgroundColor: "rgba(255,255,255,0.72)",
                  borderRadius: 2,
                },
              }}
            />
          </Grid>

          {/* Segunda fila */}
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              select
              label="Sexo"
              name="sexo"
              value={formData.sexo}
              onChange={handleChange}
              fullWidth
              sx={{
                "& .MuiInputBase-root": {
                  backgroundColor: "rgba(255,255,255,0.72)",
                  borderRadius: 2,
                },
              }}
            >
              <MenuItem value="Masculino">Masculino</MenuItem>
              <MenuItem value="Femenino">Femenino</MenuItem>
              <MenuItem value="Neutral">Neutral</MenuItem>
            </TextField>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <TextField
              label="¿Está embarazada?"
              name="embarazada"
              value={formData.embarazada}
              onChange={handleChange}
              fullWidth
              placeholder="Ej: Sí / No / No especifica"
              sx={{
                "& .MuiInputBase-root": {
                  backgroundColor: "rgba(255,255,255,0.72)",
                  borderRadius: 2,
                },
              }}
            />
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <TextField
              label="Dirección"
              name="direccion"
              value={formData.direccion}
              onChange={handleChange}
              fullWidth
            />
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <TextField
              label="Ocupación"
              name="ocupacion"
              value={formData.ocupacion}
              onChange={handleChange}
              fullWidth
            />
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <TextField
              type="date"
              label="Fecha de nacimiento"
              name="fechaNacimiento"
              value={formData.fechaNacimiento}
              onChange={handleChange}
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
          </Grid>

          {/* Más campos */}
          <Grid item xs={12} sm={6} md={4}>
            <TextField
              label="Ciudad de nacimiento"
              name="ciudadNacimiento"
              value={formData.ciudadNacimiento}
              onChange={handleChange}
              fullWidth
            />
          </Grid>

          <Grid item xs={12} sm={6} md={4}>
            <TextField
              label="Ciudad de residencia"
              name="ciudadResidencia"
              value={formData.ciudadResidencia}
              onChange={handleChange}
              fullWidth
            />
          </Grid>

          <Grid item xs={12} sm={6} md={4}>
            <TextField
              label="Correo electrónico"
              name="correo"
              value={formData.correo}
              onChange={handleChange}
              fullWidth
            />
          </Grid>

          <Grid item xs={12} sm={6} md={4}>
            <TextField
              label="Celular"
              name="celular"
              value={formData.celular}
              onChange={handleChange}
              required
              error={Boolean(errors.celular)}
              helperText={errors.celular || ""}
              fullWidth
            />
          </Grid>

          <Grid item xs={12} sm={6} md={4}>
            <TextField
              label="Alergias"
              name="alergias"
              value={formData.alergias}
              onChange={handleChange}
              fullWidth
            />
          </Grid>

          <Grid item xs={12} sm={6} md={4}>
            <TextField
              label="Enfermedad"
              name="enfermedad"
              value={formData.enfermedad}
              onChange={handleChange}
              fullWidth
            />
          </Grid>

          {/* Campos ahora editables */}
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              label="Cirugía estética"
              name="cirugiaEstetica"
              value={formData.cirugiaEstetica}
              onChange={handleChange}
              fullWidth
              placeholder="Ej: Botox, Lipo, etc."
            />
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <TextField
              label="Consumo de tabaco"
              name="tabaco"
              value={formData.tabaco}
              onChange={handleChange}
              fullWidth
              placeholder="Ej: No, Ocasional, Frecuente"
            />
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <TextField
              select
              label="¿Cómo se enteró?"
              name="referencia"
              value={formData.referencia}
              onChange={handleChange}
              fullWidth
              sx={{
                "& .MuiInputBase-root": {
                  backgroundColor: "rgba(255,255,255,0.72)",
                  borderRadius: 2,
                },
              }}
            >
              <MenuItem value="TikTok">TikTok</MenuItem>
              <MenuItem value="Instagram">Instagram</MenuItem>
              <MenuItem value="Facebook">Facebook</MenuItem>
              <MenuItem value="Influencer">Influencer</MenuItem>
              <MenuItem value="Boca a boca">Boca a boca</MenuItem>
              <MenuItem value="Otro">Otro</MenuItem>
            </TextField>
          </Grid>

          {(formData.referencia === "Influencer" || formData.referencia === "Otro") && (
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                label={formData.referencia === "Influencer" ? "Nombre del influencer" : "Especificar"}
                name="referenciaDetalle"
                value={formData.referenciaDetalle}
                onChange={handleChange}
                fullWidth
                placeholder={formData.referencia === "Influencer" ? "Ingrese el nombre del influencer" : "Especifique cómo se enteró"}
                sx={{
                  "& .MuiInputBase-root": {
                    backgroundColor: "rgba(255,255,255,0.72)",
                    borderRadius: 2,
                  },
                }}
              />
            </Grid>
          )}

          <Grid item xs={12} sm={6} md={3}>
            <TextField
              type="number"
              label="Número de hijos"
              name="numeroHijos"
              value={formData.numeroHijos}
              onChange={handleChange}
              fullWidth
              InputProps={{ inputProps: { min: 0 } }}
            />
          </Grid>
        </Grid>

        <Box textAlign="center" mt={3}>
          <Button
            variant="contained"
            sx={{
              backgroundColor: colorPrincipal,
              "&:hover": { backgroundColor: "#8a541a" },
              color: "white",
              px: 5,
              py: 1.2,
              borderRadius: 3,
              fontWeight: "bold",
            }}
            onClick={async () => {
              try {
                if (!validar()) {
                  showToast({ severity: "warning", message: "Revisa los campos obligatorios" });
                  return;
                }
                const response = await fetch(
                  `${API_BASE_URL}/api/pacientes/registrar`,
                  {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                      ...(token ? { Authorization: `Bearer ${token}` } : {}),
                    },
                    body: JSON.stringify(formData),
                  }
                );

                const data = await response.json();
                if (response.ok) {
                  showToast({ severity: "success", message: "Paciente registrado exitosamente" });
                  setFormData({
                    tipoDocumento: "DNI",
                    dni: "",
                    nombre: "",
                    apellido: "",
                    edad: "",
                    sexo: "",
                    direccion: "",
                    ocupacion: "",
                    fechaNacimiento: "",
                    ciudadNacimiento: "",
                    ciudadResidencia: "",
                    alergias: "",
                    enfermedad: "",
                    correo: "",
                    celular: "",
                    cirugiaEstetica: "",
                    embarazada: "",
                    drogas: "",
                    tabaco: "",
                    alcohol: "",
                    referencia: "",
                    referenciaDetalle: "",
                    numeroHijos: "",
                  });
                  setErrors({});
                } else {
                  showToast({ severity: "error", message: `Error: ${data.message}` });
                }
              } catch (err) {
                console.error("Error:", err);
                showToast({ severity: "error", message: "Error al conectar con el servidor" });
              }
            }}
          >
            Guardar Paciente
          </Button>
        </Box>
      </Paper>
    </Box>
  );
}
