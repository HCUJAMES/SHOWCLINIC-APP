import React, { useState } from "react";
import {
  Box,
  TextField,
  Typography,
  Button,
  Grid,
  Paper,
  MenuItem,
} from "@mui/material";
import { API_BASE } from "../config/api";

export default function RegistrarPaciente() {
  const colorPrincipal = "#a36920ff";
  const [formData, setFormData] = useState({
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
    drogas: "",
    tabaco: "",
    alcohol: "",
    referencia: "",
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
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
          backgroundColor: "rgba(255,255,255,0.95)",
          boxShadow: "0 8px 25px rgba(163,105,32,0.4)",
        }}
      >
        <Typography
          variant="h5"
          sx={{ color: colorPrincipal, fontWeight: "bold", mb: 3 }}
          align="center"
        >
          Registro de Paciente
        </Typography>

        <Grid container spacing={2}>
          {/* Primera fila */}
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              label="DNI"
              name="dni"
              value={formData.dni}
              onChange={handleChange}
              fullWidth
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              label="Nombre"
              name="nombre"
              value={formData.nombre}
              onChange={handleChange}
              fullWidth
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              label="Apellido"
              name="apellido"
              value={formData.apellido}
              onChange={handleChange}
              fullWidth
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              label="Edad"
              name="edad"
              value={formData.edad}
              onChange={handleChange}
              fullWidth
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
            >
              <MenuItem value="Masculino">Masculino</MenuItem>
              <MenuItem value="Femenino">Femenino</MenuItem>
            </TextField>
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
              label="Tipo de referencia"
              name="referencia"
              value={formData.referencia}
              onChange={handleChange}
              fullWidth
            >
              <MenuItem value="TikTok">TikTok</MenuItem>
              <MenuItem value="Instagram">Instagram</MenuItem>
              <MenuItem value="Boca a boca">Boca a boca</MenuItem>
              <MenuItem value="Otro">Otro</MenuItem>
            </TextField>
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
      const response = await fetch(`${API_BASE}/api/pacientes/registrar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await response.json();
      if (response.ok) {
        alert("✅ Paciente registrado exitosamente");
        setFormData({
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
          drogas: "",
          tabaco: "",
          alcohol: "",
          referencia: "",
        });
      } else {
        alert("❌ Error: " + data.message);
      }
    } catch (err) {
      console.error("Error:", err);
      alert("❌ Error al conectar con el servidor");
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
