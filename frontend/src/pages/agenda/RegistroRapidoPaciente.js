/**
 * Registro rápido de una paciente nueva desde la Agenda.
 *
 * Cuando una cita de Google tiene el nombre de alguien que todavía no está en
 * el historial clínico, se registra aquí con los datos mínimos (los mismos
 * obligatorios del registro normal) y queda vinculada a la cita. El resto de
 * la ficha se completa después en Pacientes.
 */
import React, { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  TextField,
  Typography,
  useMediaQuery,
} from "@mui/material";
import { Close, PersonAdd } from "../../iconos";
import { BRAND } from "../../brand";
import agendaApi, { mensajeError } from "./api";

const capitalizar = (s) =>
  String(s || "")
    .toLowerCase()
    .replace(/(^|[\s-])([a-záéíóúñü])/g, (m, sep, letra) => sep + letra.toUpperCase());

/**
 * Saca nombre, apellido y DNI del título de la cita: "EMILEZ ALCIDES MONTANCHEZ
 * CHAVEZ" → Emilez Alcides / Montanchez Chavez; "Conny cerron, 11am – Botox" →
 * Conny / Cerron. Es solo una sugerencia: se puede corregir antes de guardar.
 */
export const sugerirDatosPaciente = (titulo = "", descripcion = "") => {
  const dni = (`${titulo} ${descripcion}`.match(/\b\d{8}\b/) || [])[0] || "";
  const limpio = String(titulo)
    .split(/\s[–—-]\s|,|\(|\||:/)[0] // lo que va después suele ser el tratamiento u hora
    .replace(/\d+\s*(am|pm|hrs?|h)?\b/gi, " ")
    .replace(/[^a-záéíóúñü\s'-]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  const palabras = limpio.split(" ").filter(Boolean).slice(0, 6);
  let nombres = [];
  let apellidos = [];
  if (palabras.length === 1) nombres = palabras;
  else if (palabras.length === 2) [nombres, apellidos] = [palabras.slice(0, 1), palabras.slice(1)];
  else if (palabras.length === 3) [nombres, apellidos] = [palabras.slice(0, 1), palabras.slice(1)];
  else [nombres, apellidos] = [palabras.slice(0, 2), palabras.slice(2)];
  return { nombre: capitalizar(nombres.join(" ")), apellido: capitalizar(apellidos.join(" ")), dni };
};

const nombreCompleto = (p) => [p?.nombre, p?.apellido].map((x) => String(x || "").trim()).filter(Boolean).join(" ");

export default function RegistroRapidoPaciente({ open, inicial, onClose, onCreada }) {
  const movil = useMediaQuery("(max-width:600px)");
  const [datos, setDatos] = useState({ tipoDocumento: "DNI", dni: "", nombre: "", apellido: "", celular: "", sexo: "" });
  const [errores, setErrores] = useState({});
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [existente, setExistente] = useState(null); // paciente con el mismo DNI

  useEffect(() => {
    if (!open) return;
    setDatos({
      tipoDocumento: "DNI",
      dni: inicial?.dni || "",
      nombre: inicial?.nombre || "",
      apellido: inicial?.apellido || "",
      celular: "",
      sexo: "",
    });
    setErrores({});
    setError("");
    setExistente(null);
    setGuardando(false);
  }, [open, inicial]);

  const campo = (nombre) => ({
    value: datos[nombre],
    onChange: (e) => {
      setDatos((d) => ({ ...d, [nombre]: e.target.value }));
      if (errores[nombre]) setErrores((er) => ({ ...er, [nombre]: undefined }));
      if (nombre === "dni" || nombre === "tipoDocumento") setExistente(null);
    },
    error: Boolean(errores[nombre]),
    helperText: errores[nombre] || undefined,
  });

  const validar = () => {
    const e = {};
    if (!datos.dni.trim()) e.dni = "El documento es obligatorio";
    else if (datos.tipoDocumento === "DNI" && !/^\d{8}$/.test(datos.dni.trim())) e.dni = "El DNI debe tener 8 números";
    if (!datos.nombre.trim()) e.nombre = "El nombre es obligatorio";
    if (!datos.apellido.trim()) e.apellido = "El apellido es obligatorio";
    if (!datos.celular.trim()) e.celular = "El celular es obligatorio";
    else if (datos.celular.replace(/\D/g, "").length < 9) e.celular = "Revisa el número";
    setErrores(e);
    return Object.keys(e).length === 0;
  };

  const guardar = async () => {
    if (!validar()) return;
    setGuardando(true);
    setError("");
    try {
      // ¿Ya existe alguien con ese documento? Mejor usar su ficha que duplicarla.
      const dni = datos.dni.trim();
      const coincidencias = await agendaApi.buscarPacientes(dni);
      const mismo = (coincidencias || []).find((p) => String(p.dni || "").trim() === dni);
      if (mismo) {
        setExistente(mismo);
        setGuardando(false);
        return;
      }
      const cuerpo = {
        tipoDocumento: datos.tipoDocumento,
        dni,
        nombre: datos.nombre.trim(),
        apellido: datos.apellido.trim(),
        celular: datos.celular.trim(),
        sexo: datos.sexo || null,
      };
      const r = await agendaApi.registrarPaciente(cuerpo);
      if (!r?.id) throw new Error("sin id");
      onCreada?.({ id: r.id, ...cuerpo }, "nueva");
    } catch (err) {
      setError(
        err?.message === "sin id"
          ? "La paciente se registró, pero el servidor está desactualizado y no se pudo vincular. Actualiza el servidor y vincúlala desde la cita."
          : mensajeError(err, "No se pudo registrar a la paciente.")
      );
      setGuardando(false);
    }
  };

  const cerrar = () => !guardando && onClose();

  return (
    <Dialog open={open} onClose={cerrar} fullWidth maxWidth="sm" fullScreen={movil}>
      <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1, pr: 1.5 }}>
        <PersonAdd sx={{ color: BRAND.oro }} />
        <Typography component="span" sx={{ fontWeight: 700, fontSize: 18, flex: 1 }}>
          Registrar paciente nueva
        </Typography>
        <IconButton onClick={cerrar} aria-label="Cerrar" disabled={guardando}>
          <Close />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers sx={{ display: "flex", flexDirection: "column", gap: 2, pt: "20px !important" }}>
        <Typography sx={{ fontSize: 13.5, color: BRAND.textoSuave }}>
          Se crea su ficha en el historial clínico con estos datos y queda vinculada a la cita. El resto de la ficha (alergias,
          antecedentes, etc.) se completa después en Pacientes.
        </Typography>

        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2 }}>
          <TextField label="Nombre *" {...campo("nombre")} autoFocus />
          <TextField label="Apellido *" {...campo("apellido")} />
          <TextField select label="Tipo de documento" {...campo("tipoDocumento")}>
            <MenuItem value="DNI">DNI</MenuItem>
            <MenuItem value="Cédula">Cédula</MenuItem>
            <MenuItem value="PASAPORTE">Pasaporte</MenuItem>
            <MenuItem value="C.E.">Carné de extranjería</MenuItem>
          </TextField>
          <TextField
            label="Número de documento *"
            {...campo("dni")}
            inputProps={{ inputMode: datos.tipoDocumento === "DNI" ? "numeric" : "text", maxLength: 20 }}
          />
          <TextField label="Celular *" {...campo("celular")} inputProps={{ inputMode: "tel", maxLength: 20 }} />
          <TextField select label="Género" {...campo("sexo")}>
            <MenuItem value="">— Seleccionar —</MenuItem>
            <MenuItem value="Femenino">Femenino</MenuItem>
            <MenuItem value="Masculino">Masculino</MenuItem>
            <MenuItem value="Otro">Otro</MenuItem>
            <MenuItem value="Prefiere no decir">Prefiere no decir</MenuItem>
          </TextField>
        </Box>

        {existente && (
          <Alert
            severity="warning"
            action={
              <Button color="inherit" size="small" onClick={() => onCreada?.(existente, "existente")}>
                Usar esta ficha
              </Button>
            }
          >
            Ya existe una paciente con el documento {existente.dni}: <b>{nombreCompleto(existente)}</b>. Para no duplicarla,
            vincula la cita a su ficha.
          </Alert>
        )}
        {error && <Alert severity="error">{error}</Alert>}
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={cerrar} disabled={guardando}>
          Cancelar
        </Button>
        <Button
          variant="contained"
          onClick={guardar}
          disabled={guardando}
          startIcon={guardando ? <CircularProgress size={16} color="inherit" /> : <PersonAdd />}
        >
          {guardando ? "Registrando…" : "Registrar y vincular"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
