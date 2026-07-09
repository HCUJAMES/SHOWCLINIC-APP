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
  Switch,
  FormControlLabel,
  ToggleButton,
  ToggleButtonGroup,
} from "@mui/material";
import { ArrowBack, Home } from "@mui/icons-material";
import { useNavigate } from "react-router-dom";
import { useToast } from "../components/ToastProvider";
import { useAuth } from "../hooks/useAuth";
import { COLORS, API_BASE_URL } from "../constants";
import { calcularEdad } from "../utils/dateUtils";

/* ─── palette ─── */
const C = {
  gold: "#a36920",
  goldHover: "#8a5a1a",
  goldLight: "#ba9a63",
  cream: "#f5f1e4",
  creamSoft: "#fffdf7",
  white: "#ffffff",
  border: "#e8dcc8",
  text: "#3e2c1a",
  muted: "#8a7560",
  red: "#c0392b",
  vip: "#c0392b",
};

/* ─── shared sx ─── */
const inputSx = {
  "& .MuiInputBase-root": {
    backgroundColor: C.creamSoft,
    borderRadius: "10px",
    fontSize: 14,
  },
  "& .MuiOutlinedInput-notchedOutline": {
    borderColor: C.border,
  },
  "& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline": {
    borderColor: C.goldLight,
  },
  "& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline": {
    borderColor: C.gold,
    boxShadow: `0 0 0 3px rgba(163,105,32,0.12)`,
  },
  "& .MuiInputLabel-root": {
    color: C.muted,
    fontWeight: 500,
    fontSize: 13,
  },
  "& .MuiInputLabel-root.Mui-focused": {
    color: C.gold,
  },
};

const RequiredMark = () => (
  <span style={{ color: C.red, marginLeft: 2, fontWeight: 700 }}>*</span>
);

const SectionCard = ({ number, title, children }) => (
  <Paper
    elevation={0}
    sx={{
      mb: 3,
      borderRadius: "16px",
      border: `1px solid ${C.border}`,
      background: C.white,
      boxShadow: "0 2px 12px rgba(0,0,0,0.04)",
      overflow: "hidden",
    }}
  >
    <Box
      sx={{
        px: 3,
        py: 1.8,
        borderBottom: `1px solid ${C.border}`,
        display: "flex",
        alignItems: "center",
        gap: 1.5,
      }}
    >
      <Box
        sx={{
          width: 30,
          height: 30,
          borderRadius: "50%",
          background: `linear-gradient(135deg, ${C.gold}, ${C.goldLight})`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: C.white,
          fontWeight: 700,
          fontSize: 14,
          flexShrink: 0,
        }}
      >
        {number}
      </Box>
      <Typography
        sx={{
          fontFamily: "'Cormorant Garamond', serif",
          fontSize: 19,
          fontWeight: 600,
          color: C.text,
        }}
      >
        {title}
      </Typography>
    </Box>
    <Box sx={{ px: 3, py: 2.5 }}>{children}</Box>
  </Paper>
);

const FieldLabel = ({ label, required }) => (
  <Typography
    sx={{
      fontSize: 12.5,
      fontWeight: 600,
      color: C.muted,
      mb: 0.6,
      letterSpacing: 0.2,
      textTransform: "uppercase",
    }}
  >
    {label}
    {required && <RequiredMark />}
  </Typography>
);

const YesNoToggle = ({ value, onChange }) => (
  <ToggleButtonGroup
    value={value}
    exclusive
    onChange={(_, v) => { if (v !== null) onChange(v); }}
    size="small"
    sx={{
      height: 40,
      "& .MuiToggleButton-root": {
        textTransform: "none",
        fontWeight: 600,
        fontSize: 13,
        px: 2.5,
        borderColor: C.border,
        color: C.muted,
        borderRadius: "10px !important",
        "&.Mui-selected": {
          background: `linear-gradient(135deg, ${C.gold}, ${C.goldLight})`,
          color: C.white,
          borderColor: C.gold,
          "&:hover": { background: C.goldHover },
        },
      },
    }}
  >
    <ToggleButton value="Sí">Sí</ToggleButton>
    <ToggleButton value="No">No</ToggleButton>
  </ToggleButtonGroup>
);

export default function RegistrarPaciente() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { token } = useAuth();

  const initialFormData = {
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
    especial: false,
  };

  const [formData, setFormData] = useState(initialFormData);
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

    // Si cambia la fecha de nacimiento, calcular automáticamente la edad
    if (name === "fechaNacimiento") {
      const edad = calcularEdad(value);
      setFormData({ ...formData, [name]: value, edad: edad || "" });
      return;
    }

    setFormData({ ...formData, [name]: value });
    if (name === "nombre" || name === "apellido") {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  const setField = (name, value) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const validar = () => {
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

  const handleSubmit = async () => {
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
        setFormData(initialFormData);
        setErrors({});
      } else {
        showToast({ severity: "error", message: `Error: ${data.message}` });
      }
    } catch (err) {
      console.error("Error:", err);
      showToast({ severity: "error", message: "Error al conectar con el servidor" });
    }
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        background: `linear-gradient(170deg, ${C.cream} 0%, ${C.creamSoft} 50%, ${C.cream} 100%)`,
        py: { xs: 2, md: 4 },
        px: { xs: 1.5, md: 3 },
      }}
    >
      <Box sx={{ maxWidth: 1100, mx: "auto" }}>
        {/* ─── Header ─── */}
        <Box sx={{ display: "flex", alignItems: "center", mb: 3, px: 1 }}>
          <IconButton
            onClick={() => navigate("/pacientes")}
            sx={{
              color: C.gold,
              border: `1px solid ${C.border}`,
              width: 40,
              height: 40,
              "&:hover": { background: "rgba(163,105,32,0.06)" },
            }}
          >
            <ArrowBack fontSize="small" />
          </IconButton>
          <Box sx={{ flex: 1, textAlign: "center" }}>
            <Typography
              sx={{
                fontFamily: "'Cormorant Garamond', serif",
                fontSize: { xs: 24, md: 30 },
                fontWeight: 700,
                color: C.gold,
                letterSpacing: 0.5,
              }}
            >
              Registro de Paciente
            </Typography>
            <Typography sx={{ fontSize: 13, color: C.muted, mt: 0.3 }}>
              Completa la información del nuevo paciente
            </Typography>
          </Box>
          <IconButton
            onClick={() => navigate("/dashboard")}
            title="Inicio"
            sx={{
              color: C.gold,
              border: `1px solid ${C.border}`,
              width: 40,
              height: 40,
              "&:hover": { background: "rgba(163,105,32,0.06)" },
            }}
          >
            <Home fontSize="small" />
          </IconButton>
        </Box>

        {/* ═══════ 1. IDENTIFICACIÓN ═══════ */}
        <SectionCard number={1} title="Identificación">
          <Grid container spacing={2.5}>
            <Grid item xs={12} sm={6} md={4}>
              <FieldLabel label="Tipo de documento" />
              <TextField
                select
                name="tipoDocumento"
                value={formData.tipoDocumento}
                onChange={handleChange}
                fullWidth
                size="small"
                sx={inputSx}
              >
                <MenuItem value="DNI">DNI</MenuItem>
                <MenuItem value="Cédula">Cédula</MenuItem>
                <MenuItem value="PASAPORTE">Pasaporte</MenuItem>
                <MenuItem value="C.E.">Carné de extranjería</MenuItem>
              </TextField>
            </Grid>

            <Grid item xs={12} sm={6} md={4}>
              <FieldLabel label="Número de documento" required />
              <TextField
                name="dni"
                value={formData.dni}
                onChange={handleChange}
                fullWidth
                size="small"
                error={Boolean(errors.dni)}
                helperText={errors.dni || ""}
                placeholder="Ingrese el número"
                sx={inputSx}
              />
            </Grid>

            <Grid item xs={12} sm={6} md={4}>
              <FieldLabel label="Nombre" required />
              <TextField
                name="nombre"
                value={formData.nombre}
                onChange={handleChange}
                fullWidth
                size="small"
                error={Boolean(errors.nombre)}
                helperText={errors.nombre || ""}
                placeholder="Nombre del paciente"
                sx={inputSx}
              />
            </Grid>

            <Grid item xs={12} sm={6} md={4}>
              <FieldLabel label="Apellido" required />
              <TextField
                name="apellido"
                value={formData.apellido}
                onChange={handleChange}
                fullWidth
                size="small"
                error={Boolean(errors.apellido)}
                helperText={errors.apellido || ""}
                placeholder="Apellido del paciente"
                sx={inputSx}
              />
            </Grid>

            <Grid item xs={12} sm={6} md={4}>
              <FieldLabel label="Género" />
              <TextField
                select
                name="sexo"
                value={formData.sexo}
                onChange={handleChange}
                fullWidth
                size="small"
                sx={inputSx}
              >
                <MenuItem value="">— Seleccionar —</MenuItem>
                <MenuItem value="Femenino">Femenino</MenuItem>
                <MenuItem value="Masculino">Masculino</MenuItem>
                <MenuItem value="Otro">Otro</MenuItem>
                <MenuItem value="Prefiere no decir">Prefiere no decir</MenuItem>
              </TextField>
            </Grid>

            <Grid item xs={12} sm={6} md={4}>
              <FieldLabel label="Fecha de nacimiento" />
              <TextField
                type="date"
                name="fechaNacimiento"
                value={formData.fechaNacimiento}
                onChange={handleChange}
                fullWidth
                size="small"
                InputLabelProps={{ shrink: true }}
                sx={inputSx}
              />
            </Grid>

            <Grid item xs={12} sm={6} md={4}>
              <FieldLabel label="Edad" />
              <TextField
                name="edad"
                value={formData.edad}
                fullWidth
                size="small"
                disabled
                placeholder="Se calcula automáticamente"
                helperText="Se calcula desde la fecha de nacimiento"
                sx={{
                  ...inputSx,
                  "& .MuiInputBase-root": {
                    ...inputSx["& .MuiInputBase-root"],
                    backgroundColor: "#f0ebe0",
                  },
                }}
              />
            </Grid>

            {formData.sexo === "Femenino" && (
              <Grid item xs={12} sm={6} md={4}>
                <FieldLabel label="¿Está embarazada?" />
                <Box sx={{ pt: 0.5 }}>
                  <YesNoToggle
                    value={formData.embarazada}
                    onChange={(v) => setField("embarazada", v)}
                  />
                </Box>
              </Grid>
            )}
          </Grid>
        </SectionCard>

        {/* ═══════ 2. CONTACTO Y UBICACIÓN ═══════ */}
        <SectionCard number={2} title="Contacto y ubicación">
          <Grid container spacing={2.5}>
            <Grid item xs={12} sm={6} md={4}>
              <FieldLabel label="Celular" required />
              <TextField
                name="celular"
                value={formData.celular}
                onChange={handleChange}
                fullWidth
                size="small"
                error={Boolean(errors.celular)}
                helperText={errors.celular || ""}
                placeholder="Número de celular"
                sx={inputSx}
              />
            </Grid>

            <Grid item xs={12} sm={6} md={4}>
              <FieldLabel label="Correo electrónico" />
              <TextField
                name="correo"
                value={formData.correo}
                onChange={handleChange}
                fullWidth
                size="small"
                placeholder="ejemplo@correo.com"
                sx={inputSx}
              />
            </Grid>

            <Grid item xs={12} sm={6} md={4}>
              <FieldLabel label="Dirección" />
              <TextField
                name="direccion"
                value={formData.direccion}
                onChange={handleChange}
                fullWidth
                size="small"
                placeholder="Dirección del paciente"
                sx={inputSx}
              />
            </Grid>

            <Grid item xs={12} sm={6} md={4}>
              <FieldLabel label="Ciudad de nacimiento" />
              <TextField
                name="ciudadNacimiento"
                value={formData.ciudadNacimiento}
                onChange={handleChange}
                fullWidth
                size="small"
                placeholder="Ciudad de nacimiento"
                sx={inputSx}
              />
            </Grid>

            <Grid item xs={12} sm={6} md={4}>
              <FieldLabel label="Ciudad de residencia" />
              <TextField
                name="ciudadResidencia"
                value={formData.ciudadResidencia}
                onChange={handleChange}
                fullWidth
                size="small"
                placeholder="Ciudad de residencia"
                sx={inputSx}
              />
            </Grid>

            <Grid item xs={12} sm={6} md={4}>
              <FieldLabel label="Ocupación" />
              <TextField
                name="ocupacion"
                value={formData.ocupacion}
                onChange={handleChange}
                fullWidth
                size="small"
                placeholder="Ocupación del paciente"
                sx={inputSx}
              />
            </Grid>
          </Grid>
        </SectionCard>

        {/* ═══════ 3. HISTORIA MÉDICA Y HÁBITOS ═══════ */}
        <SectionCard number={3} title="Historia médica y hábitos">
          <Grid container spacing={2.5}>
            <Grid item xs={12} sm={6} md={4}>
              <FieldLabel label="Alergias" />
              <TextField
                name="alergias"
                value={formData.alergias}
                onChange={handleChange}
                fullWidth
                size="small"
                placeholder="Ej: Penicilina, látex…"
                sx={inputSx}
              />
            </Grid>

            <Grid item xs={12} sm={6} md={4}>
              <FieldLabel label="Enfermedad" />
              <TextField
                name="enfermedad"
                value={formData.enfermedad}
                onChange={handleChange}
                fullWidth
                size="small"
                placeholder="Enfermedades conocidas"
                sx={inputSx}
              />
            </Grid>

            <Grid item xs={12} sm={6} md={4}>
              <FieldLabel label="Cirugía estética previa" />
              <TextField
                name="cirugiaEstetica"
                value={formData.cirugiaEstetica}
                onChange={handleChange}
                fullWidth
                size="small"
                placeholder="Ej: Botox, Lipo, etc."
                sx={inputSx}
              />
            </Grid>

            <Grid item xs={12} sm={6} md={4}>
              <FieldLabel label="Número de hijos" />
              <TextField
                type="number"
                name="numeroHijos"
                value={formData.numeroHijos}
                onChange={handleChange}
                fullWidth
                size="small"
                InputProps={{ inputProps: { min: 0 } }}
                placeholder="0"
                sx={inputSx}
              />
            </Grid>

            <Grid item xs={12} sm={6} md={4}>
              <FieldLabel label="¿Consume alcohol?" />
              <Box sx={{ pt: 0.5 }}>
                <YesNoToggle
                  value={formData.alcohol}
                  onChange={(v) => setField("alcohol", v)}
                />
              </Box>
            </Grid>

            <Grid item xs={12} sm={6} md={4}>
              <FieldLabel label="¿Consume drogas?" />
              <Box sx={{ pt: 0.5 }}>
                <YesNoToggle
                  value={formData.drogas}
                  onChange={(v) => setField("drogas", v)}
                />
              </Box>
            </Grid>

            <Grid item xs={12} sm={6} md={4}>
              <FieldLabel label="¿Fuma?" />
              <Box sx={{ pt: 0.5 }}>
                <YesNoToggle
                  value={formData.tabaco}
                  onChange={(v) => setField("tabaco", v)}
                />
              </Box>
            </Grid>
          </Grid>
        </SectionCard>

        {/* ═══════ 4. DATOS ADMINISTRATIVOS ═══════ */}
        <SectionCard number={4} title="Datos administrativos">
          <Grid container spacing={2.5} alignItems="flex-start">
            <Grid item xs={12} sm={6} md={4}>
              <FieldLabel label="¿Cómo se enteró de ShowClinic?" />
              <TextField
                select
                name="referencia"
                value={formData.referencia}
                onChange={handleChange}
                fullWidth
                size="small"
                sx={inputSx}
              >
                <MenuItem value="">— Seleccionar —</MenuItem>
                <MenuItem value="Instagram">Instagram</MenuItem>
                <MenuItem value="Facebook">Facebook</MenuItem>
                <MenuItem value="TikTok">TikTok</MenuItem>
                <MenuItem value="Google">Google</MenuItem>
                <MenuItem value="Boca a boca">Recomendación</MenuItem>
                <MenuItem value="Paciente anterior">Paciente anterior</MenuItem>
                <MenuItem value="Influencer">Influencer</MenuItem>
                <MenuItem value="Otro">Otro</MenuItem>
              </TextField>
            </Grid>

            {formData.referencia === "Influencer" && (
              <Grid item xs={12} sm={6} md={4}>
                <FieldLabel label="Código del influencer" />
                <TextField
                  name="referenciaDetalle"
                  value={formData.referenciaDetalle}
                  onChange={handleChange}
                  fullWidth
                  size="small"
                  placeholder="Ingrese el código del influencer"
                  sx={inputSx}
                />
              </Grid>
            )}

            {formData.referencia === "Otro" && (
              <Grid item xs={12} sm={6} md={4}>
                <FieldLabel label="Especificar" />
                <TextField
                  name="referenciaDetalle"
                  value={formData.referenciaDetalle}
                  onChange={handleChange}
                  fullWidth
                  size="small"
                  placeholder="Especifique cómo se enteró"
                  sx={inputSx}
                />
              </Grid>
            )}

            <Grid item xs={12} sm={6} md={4}>
              <FieldLabel label="Tipo de cliente" />
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1.5,
                  pt: 0.8,
                }}
              >
                <FormControlLabel
                  control={
                    <Switch
                      checked={formData.especial}
                      onChange={(e) => setField("especial", e.target.checked)}
                      sx={{
                        "& .MuiSwitch-switchBase.Mui-checked": { color: C.gold },
                        "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": {
                          backgroundColor: C.gold,
                        },
                      }}
                    />
                  }
                  label={
                    <Typography
                      sx={{
                        fontWeight: 600,
                        fontSize: 14,
                        color: formData.especial ? C.gold : C.muted,
                      }}
                    >
                      {formData.especial ? "Cliente VIP" : "Cliente Normal"}
                    </Typography>
                  }
                />
              </Box>
            </Grid>
          </Grid>
        </SectionCard>

        {/* ─── Buttons ─── */}
        <Box
          sx={{
            display: "flex",
            justifyContent: "center",
            gap: 2,
            mt: 1,
            mb: 4,
          }}
        >
          <Button
            variant="outlined"
            onClick={() => navigate("/pacientes")}
            sx={{
              color: C.gold,
              borderColor: C.border,
              borderRadius: "28px",
              px: 4,
              py: 1.2,
              fontWeight: 600,
              fontSize: 14,
              textTransform: "none",
              "&:hover": {
                borderColor: C.gold,
                background: "rgba(163,105,32,0.04)",
              },
            }}
          >
            Cancelar
          </Button>
          <Button
            variant="contained"
            onClick={handleSubmit}
            sx={{
              background: `linear-gradient(135deg, ${C.gold}, ${C.goldLight})`,
              color: C.white,
              borderRadius: "28px",
              px: 5,
              py: 1.2,
              fontWeight: 700,
              fontSize: 14,
              textTransform: "none",
              boxShadow: "0 4px 14px rgba(163,105,32,0.25)",
              "&:hover": {
                background: C.goldHover,
                boxShadow: "0 6px 20px rgba(163,105,32,0.35)",
              },
            }}
          >
            Guardar Paciente
          </Button>
        </Box>
      </Box>
    </Box>
  );
}
