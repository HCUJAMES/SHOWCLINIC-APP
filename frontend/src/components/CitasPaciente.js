/**
 * Citas de Google Calendar de una paciente, para su historial clínico:
 * próximas citas, citas pasadas y un botón para agendar una nueva.
 * Si la agenda no está conectada, no muestra nada.
 */
import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Box, Button, Collapse, Paper, Typography, Skeleton } from "@mui/material";
import { CalendarMonth, Add, ExpandMore, ExpandLess } from "../iconos";
import { BRAND } from "../brand";
import useSocket from "../hooks/useSocket";
import agendaApi, { mensajeError } from "../pages/agenda/api";
import { colorCita } from "../pages/agenda/colores";
import { textoDiaLargo, textoHorario, fechaDe, hoy as hoyFn, diferenciaDias } from "../pages/agenda/fechas";

const cuandoEs = (dia) => {
  const d = diferenciaDias(hoyFn(), dia);
  if (d === 0) return "Hoy";
  if (d === 1) return "Mañana";
  if (d > 1 && d < 7) return `En ${d} días`;
  return null;
};

function FilaCita({ cita, pasada, onClick }) {
  const dia = cita.todoElDia ? cita.inicio : fechaDe(cita.inicio);
  const etiqueta = !pasada && cuandoEs(dia);
  return (
    <Box
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => e.key === "Enter" && onClick()}
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1.5,
        py: 1,
        px: 1.25,
        borderRadius: 2,
        cursor: "pointer",
        opacity: pasada ? 0.7 : 1,
        "&:hover": { bgcolor: "rgba(163,105,32,0.06)" },
      }}
    >
      <Box sx={{ width: 4, alignSelf: "stretch", borderRadius: 2, bgcolor: colorCita(cita), flexShrink: 0 }} />
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography sx={{ fontSize: 14, fontWeight: 600, color: BRAND.texto }}>
          {textoDiaLargo(dia, { anio: dia.slice(0, 4) !== hoyFn().slice(0, 4) })} · {textoHorario(cita)}
        </Typography>
        <Typography noWrap sx={{ fontSize: 12.5, color: BRAND.textoSuave }}>
          {[cita.tratamiento, cita.especialistaNombre].filter(Boolean).join(" · ") || cita.titulo}
        </Typography>
      </Box>
      {etiqueta && (
        <Box
          sx={{
            px: 1,
            py: 0.25,
            borderRadius: 10,
            fontSize: 11.5,
            fontWeight: 700,
            bgcolor: etiqueta === "Hoy" ? BRAND.oro : "rgba(163,105,32,0.12)",
            color: etiqueta === "Hoy" ? "#fff" : BRAND.oro,
            flexShrink: 0,
          }}
        >
          {etiqueta}
        </Box>
      )}
    </Box>
  );
}

export default function CitasPaciente({ paciente }) {
  const navigate = useNavigate();
  const [datos, setDatos] = useState(null); // { configurado, eventos }
  const [error, setError] = useState("");
  const [verPasadas, setVerPasadas] = useState(false);
  const id = paciente?.id;

  const cargar = useCallback(async () => {
    if (!id) return;
    try {
      const r = await agendaApi.delPaciente(id);
      setDatos(r);
      setError("");
    } catch (err) {
      setError(mensajeError(err, "No se pudieron cargar las citas."));
    }
  }, [id]);

  useEffect(() => {
    setDatos(null);
    setError("");
    setVerPasadas(false);
    cargar();
  }, [cargar]);

  useSocket("agenda:updated", cargar, Boolean(id));

  if (!id) return null;
  if (datos && !datos.configurado) return null;

  const hoy = hoyFn();
  const eventos = datos?.eventos || [];
  const finDe = (c) => (c.todoElDia ? c.fin : fechaDe(c.fin));
  const proximas = eventos.filter((c) => finDe(c) >= hoy);
  const pasadas = eventos.filter((c) => finDe(c) < hoy).reverse();

  // Abre la agenda en el día de la cita, con la cita ya abierta
  const abrirEnAgenda = (c) =>
    navigate("/agenda", { state: { irA: c.todoElDia ? c.inicio : fechaDe(c.inicio), citaId: c.id } });

  const agendar = () =>
    navigate("/agenda", {
      state: {
        nuevaCita: {
          paciente: { id: paciente.id, nombre: paciente.nombre, apellido: paciente.apellido, dni: paciente.dni },
        },
      },
    });

  return (
    <Paper
      elevation={0}
      sx={{
        mb: 4,
        p: { xs: 2, sm: 2.5 },
        borderRadius: "22px",
        border: `1px solid ${BRAND.borde}`,
        bgcolor: "#fffdf8",
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, mb: 1, flexWrap: "wrap" }}>
        <CalendarMonth sx={{ color: BRAND.oro }} />
        <Typography sx={{ fontWeight: 700, fontSize: 16, flex: 1 }}>Citas</Typography>
        <Button size="small" variant="contained" startIcon={<Add />} onClick={agendar}>
          Agendar cita
        </Button>
      </Box>

      {error && <Typography sx={{ fontSize: 13, color: BRAND.error, px: 1.25 }}>{error}</Typography>}

      {!datos && !error && (
        <Box sx={{ px: 1.25 }}>
          <Skeleton height={28} />
          <Skeleton height={28} width="70%" />
        </Box>
      )}

      {datos && (
        <>
          {proximas.length === 0 ? (
            <Typography sx={{ fontSize: 13.5, color: BRAND.textoTenue, px: 1.25, py: 1 }}>
              No tiene citas próximas en Google Calendar.
            </Typography>
          ) : (
            proximas.map((c) => <FilaCita key={c.id} cita={c} onClick={() => abrirEnAgenda(c)} />)
          )}

          {pasadas.length > 0 && (
            <>
              <Button
                size="small"
                onClick={() => setVerPasadas((v) => !v)}
                endIcon={verPasadas ? <ExpandLess /> : <ExpandMore />}
                sx={{ mt: 0.5, color: BRAND.textoSuave }}
              >
                {verPasadas ? "Ocultar" : "Ver"} citas anteriores ({pasadas.length})
              </Button>
              <Collapse in={verPasadas} unmountOnExit>
                {pasadas.map((c) => (
                  <FilaCita key={c.id} cita={c} pasada onClick={() => abrirEnAgenda(c)} />
                ))}
              </Collapse>
            </>
          )}
        </>
      )}
    </Paper>
  );
}
