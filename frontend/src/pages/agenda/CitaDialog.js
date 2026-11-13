/**
 * Formulario para crear o editar una cita. Lo que se guarda aquí aparece al
 * instante en el Google Calendar de la clínica.
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  MenuItem,
  Switch,
  TextField,
  Tooltip,
  Typography,
  useMediaQuery,
} from "@mui/material";
import { Close, Delete, Check } from "../../iconos";
import { BRAND } from "../../brand";
import { COLORES_GOOGLE, colorPorId } from "./colores";
import agendaApi, { mensajeError } from "./api";
import RegistroRapidoPaciente, { sugerirDatosPaciente } from "./RegistroRapidoPaciente";
import {
  fechaDe,
  horaDe,
  sumarMinutos,
  duracionMinutos,
  textoDiaLargo,
  hoy as hoyFn,
} from "./fechas";

const DURACIONES = [15, 20, 30, 45, 60, 75, 90, 120, 150, 180, 240];

const textoDuracion = (m) => {
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h} h ${r} min` : `${h} ${h === 1 ? "hora" : "horas"}`;
};

const nombrePaciente = (p) => (p ? [p.nombre, p.apellido].map((x) => String(x || "").trim()).filter(Boolean).join(" ") : "");

const tituloAuto = (paciente, tratamiento) =>
  paciente ? `${nombrePaciente(paciente)}${tratamiento ? ` – ${tratamiento}` : ""}` : "";

const seCruzan = (a, b) => a.inicio < b.fin && b.inicio < a.fin;

function BuscadorPaciente({ value, onChange, disabled, onRegistrarNueva }) {
  const [texto, setTexto] = useState("");
  const [opciones, setOpciones] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const pedido = useRef(0);

  useEffect(() => {
    const term = texto.trim();
    if (term.length < 2 || (value && term === `${nombrePaciente(value)}${value.dni ? ` · DNI ${value.dni}` : ""}`)) {
      setOpciones(value ? [value] : []);
      setCargando(false);
      return undefined;
    }
    const n = ++pedido.current;
    setCargando(true);
    const t = setTimeout(() => {
      agendaApi
        .buscarPacientes(term)
        .then((lista) => {
          if (n !== pedido.current) return;
          setOpciones((lista || []).slice(0, 25));
          setError("");
        })
        .catch((err) => n === pedido.current && setError(mensajeError(err, "No se pudo buscar pacientes")))
        .finally(() => n === pedido.current && setCargando(false));
    }, 300);
    return () => clearTimeout(t);
  }, [texto, value]);

  return (
    <Autocomplete
      value={value}
      onChange={(_, v) => onChange(v)}
      inputValue={texto}
      onInputChange={(_, v) => setTexto(v)}
      options={opciones}
      filterOptions={(x) => x}
      loading={cargando}
      disabled={disabled}
      isOptionEqualToValue={(a, b) => a.id === b.id}
      getOptionLabel={(p) => `${nombrePaciente(p)}${p.dni ? ` · DNI ${p.dni}` : ""}`}
      noOptionsText={
        texto.trim().length < 2 ? (
          "Escribe al menos 2 letras del nombre o el DNI"
        ) : (
          <Box>
            No se encontró ninguna paciente.{" "}
            <Box
              component="span"
              role="button"
              tabIndex={0}
              // mousedown sin efecto para que la lista no se cierre antes del clic
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onRegistrarNueva?.(texto.trim())}
              onKeyDown={(e) => e.key === "Enter" && onRegistrarNueva?.(texto.trim())}
              sx={{ color: BRAND.oro, fontWeight: 600, cursor: "pointer", "&:hover": { textDecoration: "underline" } }}
            >
              Registrar “{texto.trim()}” como paciente nueva
            </Box>
          </Box>
        )
      }
      loadingText="Buscando…"
      renderOption={(props, p) => {
        const { key, ...resto } = props;
        return (
          <li key={p.id} {...resto}>
            <Box>
              <Typography sx={{ fontWeight: 600, fontSize: 14 }}>{nombrePaciente(p)}</Typography>
              <Typography sx={{ fontSize: 12, color: BRAND.textoSuave }}>
                {[p.dni && `DNI ${p.dni}`, p.celular && `Cel. ${p.celular}`].filter(Boolean).join(" · ") || "Sin DNI registrado"}
              </Typography>
            </Box>
          </li>
        );
      }}
      renderInput={(params) => (
        <TextField
          {...params}
          label="Paciente"
          placeholder="Buscar por nombre, apellido o DNI"
          error={Boolean(error)}
          helperText={error || undefined}
          InputProps={{
            ...params.InputProps,
            endAdornment: (
              <>
                {cargando ? <CircularProgress color="inherit" size={18} /> : null}
                {params.InputProps.endAdornment}
              </>
            ),
          }}
        />
      )}
    />
  );
}

export default function CitaDialog({
  open,
  onClose,
  cita,
  inicial,
  especialistas = [],
  calendarios = [],
  predeterminado = null,
  tratamientos = [],
  citasCargadas = [],
  onGuardado,
  onEliminado,
}) {
  const movil = useMediaQuery("(max-width:600px)");
  const editando = Boolean(cita);

  const [paciente, setPaciente] = useState(null);
  const [sinPaciente, setSinPaciente] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [tituloEditado, setTituloEditado] = useState(false);
  const [tratamiento, setTratamiento] = useState("");
  const [especialistaId, setEspecialistaId] = useState("");
  const [calendarId, setCalendarId] = useState("");
  const [fecha, setFecha] = useState(hoyFn());
  const [fechaFin, setFechaFin] = useState(hoyFn());
  const [todoElDia, setTodoElDia] = useState(false);
  const [hora, setHora] = useState("09:00");
  const [duracion, setDuracion] = useState(30);
  const [colorId, setColorId] = useState("");
  const [notas, setNotas] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [confirmarEliminar, setConfirmarEliminar] = useState(false);
  const [registroInicial, setRegistroInicial] = useState(null); // abre el registro rápido

  // Cargar los datos al abrir
  useEffect(() => {
    if (!open) return;
    setError("");
    setGuardando(false);
    setConfirmarEliminar(false);
    if (cita) {
      const p = cita.paciente ? { ...cita.paciente } : null;
      setPaciente(p);
      setSinPaciente(!p);
      setTitulo(cita.titulo || "");
      setTituloEditado(!p || (cita.titulo || "") !== tituloAuto(p, cita.tratamiento || ""));
      setTratamiento(cita.tratamiento || "");
      setEspecialistaId(cita.especialistaId ? String(cita.especialistaId) : "");
      setCalendarId(cita.calendarId || "");
      setTodoElDia(Boolean(cita.todoElDia));
      setFecha(fechaDe(cita.inicio));
      setFechaFin(cita.todoElDia ? cita.fin : fechaDe(cita.inicio));
      setHora(cita.todoElDia ? "09:00" : horaDe(cita.inicio));
      setDuracion(cita.todoElDia ? 30 : Math.max(5, duracionMinutos(cita.inicio, cita.fin)));
      setColorId(cita.colorId || "");
      setNotas(cita.notas ?? "");
    } else {
      const ini = inicial?.inicio || `${hoyFn()}T09:00`;
      setPaciente(inicial?.paciente || null);
      setSinPaciente(false);
      setTitulo("");
      setTituloEditado(false);
      setTratamiento(inicial?.tratamiento || "");
      setEspecialistaId(inicial?.especialistaId ? String(inicial.especialistaId) : "");
      setCalendarId(inicial?.calendarId || "");
      setTodoElDia(Boolean(inicial?.todoElDia));
      setFecha(fechaDe(ini));
      setFechaFin(fechaDe(ini));
      setHora(ini.length > 10 ? horaDe(ini) : "09:00");
      setDuracion(30);
      setColorId("");
      setNotas("");
    }
  }, [open, cita, inicial]);

  // Calendarios donde se puede agendar (si la cita está en uno oculto, igual se ofrece)
  const escribibles = useMemo(() => {
    const lista = calendarios.filter((c) => c.escribible);
    if (cita?.calendarId && !lista.some((c) => c.id === cita.calendarId)) {
      lista.push({ id: cita.calendarId, nombre: cita.calendarioNombre || cita.calendarId, color: cita.color, escribible: true });
    }
    return lista;
  }, [calendarios, cita]);

  const calendarioDeEspecialista = (espId) =>
    espId ? escribibles.find((c) => String(c.especialistaId) === String(espId)) : null;

  // Cita nueva: el calendario del especialista o, si no, el predeterminado
  useEffect(() => {
    if (!open || cita || calendarId || !escribibles.length) return;
    const cal =
      calendarioDeEspecialista(especialistaId) ||
      escribibles.find((c) => c.id === predeterminado) ||
      escribibles[0];
    if (cal) setCalendarId(cal.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, cita, calendarId, escribibles, predeterminado, especialistaId]);

  // Especialista y calendario van juntos: al elegir uno se sugiere el otro
  const cambiarEspecialista = (valor) => {
    setEspecialistaId(valor);
    const cal = calendarioDeEspecialista(valor);
    if (cal) setCalendarId(cal.id);
  };
  const cambiarCalendario = (valor) => {
    setCalendarId(valor);
    const cal = escribibles.find((c) => c.id === valor);
    if (cal?.especialistaId) setEspecialistaId(String(cal.especialistaId));
  };

  // El título se arma solo (paciente – tratamiento) hasta que alguien lo edite
  useEffect(() => {
    if (!tituloEditado) setTitulo(tituloAuto(sinPaciente ? null : paciente, tratamiento));
  }, [paciente, tratamiento, sinPaciente, tituloEditado]);

  const inicio = todoElDia ? fecha : `${fecha}T${hora}`;
  const fin = todoElDia ? (fechaFin < fecha ? fecha : fechaFin) : sumarMinutos(`${fecha}T${hora}`, duracion);

  const especialista = especialistas.find((e) => String(e.id) === String(especialistaId));
  const calendario = escribibles.find((c) => c.id === calendarId);
  // Sin color propio, la cita lleva el color de su calendario (igual que en Google)
  const colorVisible = colorId ? colorPorId(colorId) : calendario?.color || BRAND.oro;
  const soloLectura = editando && cita?.escribible === false;

  // Avisos de choque de horario (no bloquean: la clínica decide)
  const avisos = useMemo(() => {
    if (todoElDia || !fecha || !hora) return [];
    const yo = { inicio, fin };
    const otros = citasCargadas.filter((c) => !c.todoElDia && c.id !== cita?.id && seCruzan(yo, c));
    const lista = [];
    const choque =
      (especialistaId && otros.find((c) => String(c.especialistaId) === String(especialistaId))) ||
      (calendarId && otros.find((c) => c.calendarId === calendarId));
    if (choque) {
      const quien = especialista?.nombre || calendario?.nombre || "Ese calendario";
      lista.push(`${quien} ya tiene una cita de ${horaDe(choque.inicio)} a ${horaDe(choque.fin)} (${choque.titulo}).`);
    }
    if (paciente && !sinPaciente) {
      const choque = otros.find((c) => c.paciente?.id === paciente.id);
      if (choque) lista.push(`Esta paciente ya tiene otra cita a esa hora (${horaDe(choque.inicio)} – ${horaDe(choque.fin)}).`);
    }
    return lista;
  }, [citasCargadas, inicio, fin, especialistaId, especialista, calendarId, calendario, paciente, sinPaciente, todoElDia, fecha, hora, cita]);

  const opcionesDuracion = DURACIONES.includes(duracion) ? DURACIONES : [...DURACIONES, duracion].sort((a, b) => a - b);
  const nombresTratamientos = useMemo(
    () => [...new Set(tratamientos.map((t) => String(t.nombre || "").trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, "es")),
    [tratamientos]
  );

  const validar = () => {
    if (!sinPaciente && !paciente) return "Elige una paciente o marca “Sin paciente”.";
    if (!titulo.trim()) return "Escribe un título para la cita.";
    if (!calendarId) return "Elige el calendario donde se guardará la cita.";
    if (!fecha) return "Elige la fecha.";
    if (!todoElDia && !/^\d{2}:\d{2}$/.test(hora)) return "Escribe la hora de inicio.";
    if (todoElDia && fechaFin && fechaFin < fecha) return "La fecha final no puede ser antes de la inicial.";
    return "";
  };

  const guardar = async () => {
    const problema = validar();
    if (problema) {
      setError(problema);
      return;
    }
    setGuardando(true);
    setError("");
    const datos = {
      titulo: titulo.trim(),
      pacienteId: sinPaciente ? null : paciente?.id || null,
      sinPaciente,
      especialistaId: especialistaId ? Number(especialistaId) : null,
      calendarId,
      tratamiento: tratamiento.trim(),
      notas: notas.trim(),
      inicio,
      fin,
      todoElDia,
      colorId: colorId || null,
    };
    try {
      const resultado = editando ? await agendaApi.actualizar(cita.id, datos) : await agendaApi.crear(datos);
      onGuardado?.(resultado, editando ? "editada" : "creada");
    } catch (err) {
      setError(mensajeError(err, "No se pudo guardar la cita."));
      setGuardando(false);
    }
  };

  const eliminar = async () => {
    if (!confirmarEliminar) {
      setConfirmarEliminar(true);
      return;
    }
    setGuardando(true);
    setError("");
    try {
      await agendaApi.eliminar(cita.id);
      onEliminado?.(cita);
    } catch (err) {
      setError(mensajeError(err, "No se pudo eliminar la cita."));
      setGuardando(false);
      setConfirmarEliminar(false);
    }
  };

  const cerrar = () => !guardando && onClose();

  return (
    <Dialog open={open} onClose={cerrar} fullWidth maxWidth="sm" fullScreen={movil} scroll="paper">
      <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1, pr: 1.5 }}>
        <Box sx={{ width: 12, height: 12, borderRadius: "50%", bgcolor: colorVisible }} />
        <Typography component="span" sx={{ fontWeight: 700, fontSize: 18, flex: 1 }}>
          {editando ? "Editar cita" : "Nueva cita"}
        </Typography>
        <IconButton onClick={cerrar} aria-label="Cerrar" disabled={guardando}>
          <Close />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers sx={{ display: "flex", flexDirection: "column", gap: 2.25, pt: "20px !important" }}>
        {soloLectura && (
          <Alert severity="warning">
            Esta cita está en el calendario “{cita.calendarioNombre}”, que es de solo lectura. Solo se puede modificar desde la
            cuenta de Google dueña de ese calendario.
          </Alert>
        )}
        {cita?.recurrente && (
          <Alert severity="info">Esta cita se repite en Google Calendar: los cambios solo se aplican a esta fecha.</Alert>
        )}

        {/* Paciente */}
        <Box>
          {!sinPaciente && (
            <BuscadorPaciente
              value={paciente}
              onChange={setPaciente}
              disabled={guardando}
              onRegistrarNueva={(texto) => setRegistroInicial(sugerirDatosPaciente(texto))}
            />
          )}
          {!sinPaciente && !paciente && (
            <Typography sx={{ fontSize: 12.5, color: BRAND.textoSuave, mt: 0.75 }}>
              ¿No está en el historial clínico?{" "}
              <Box
                component="span"
                role="button"
                tabIndex={0}
                onClick={() => setRegistroInicial(sugerirDatosPaciente(cita?.titulo || "", cita?.descripcion || ""))}
                onKeyDown={(e) => e.key === "Enter" && setRegistroInicial(sugerirDatosPaciente(cita?.titulo || "", cita?.descripcion || ""))}
                sx={{ color: BRAND.oro, fontWeight: 600, cursor: "pointer", "&:hover": { textDecoration: "underline" } }}
              >
                Registrar paciente nueva
              </Box>
            </Typography>
          )}
          <FormControlLabel
            sx={{ mt: sinPaciente ? 0 : 0.5 }}
            control={
              <Switch
                size="small"
                checked={sinPaciente}
                onChange={(e) => {
                  setSinPaciente(e.target.checked);
                  if (e.target.checked) setPaciente(null);
                }}
              />
            }
            label={<Typography sx={{ fontSize: 13.5 }}>Sin paciente (reunión, bloqueo de horario, etc.)</Typography>}
          />
          {cita?.paciente?.vinculo === "auto" && paciente?.id === cita.paciente.id && (
            <Typography sx={{ fontSize: 12, color: BRAND.textoSuave, mt: 0.5 }}>
              Esta paciente se reconoció automáticamente por el nombre o DNI escrito en Google. Al guardar, el vínculo queda fijo.
            </Typography>
          )}
        </Box>

        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2 }}>
          <Autocomplete
            freeSolo
            options={nombresTratamientos}
            value={tratamiento}
            onChange={(_, v) => setTratamiento(v || "")}
            inputValue={tratamiento}
            onInputChange={(_, v) => setTratamiento(v)}
            renderInput={(params) => <TextField {...params} label="Tratamiento" placeholder="Ej. Botox, Evaluación…" />}
          />
          <TextField select label="Especialista" value={especialistaId} onChange={(e) => cambiarEspecialista(e.target.value)}>
            <MenuItem value="">
              <em>Sin asignar</em>
            </MenuItem>
            {especialistas.map((e) => {
              const cal = calendarioDeEspecialista(e.id);
              return (
                <MenuItem key={e.id} value={String(e.id)}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <Box sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: cal?.color || "transparent", border: cal ? "none" : `1px solid ${BRAND.borde}` }} />
                    {e.nombre}
                  </Box>
                </MenuItem>
              );
            })}
          </TextField>
        </Box>

        <TextField
          select
          label="Calendario de Google"
          value={escribibles.some((c) => c.id === calendarId) ? calendarId : ""}
          onChange={(e) => cambiarCalendario(e.target.value)}
          helperText={
            editando && cita?.calendarId && calendarId !== cita.calendarId
              ? `La cita se pasará del calendario “${cita.calendarioNombre}” a este.`
              : "En este calendario se guardará la cita (igual que en Google)."
          }
        >
          {escribibles.length === 0 && (
            <MenuItem value="" disabled>
              No hay calendarios disponibles
            </MenuItem>
          )}
          {escribibles.map((c) => (
            <MenuItem key={c.id} value={c.id}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Box sx={{ width: 12, height: 12, borderRadius: "3px", bgcolor: c.color }} />
                {c.nombre}
              </Box>
            </MenuItem>
          ))}
        </TextField>

        <TextField
          label="Título en Google Calendar"
          value={titulo}
          onChange={(e) => {
            setTitulo(e.target.value);
            setTituloEditado(true);
          }}
          helperText={
            tituloEditado && !sinPaciente && paciente ? (
              <Box
                component="span"
                onClick={() => setTituloEditado(false)}
                sx={{ color: BRAND.oro, cursor: "pointer", "&:hover": { textDecoration: "underline" } }}
              >
                Usar título automático
              </Box>
            ) : (
              "Así se verá la cita en los celulares del equipo"
            )
          }
          inputProps={{ maxLength: 300 }}
        />

        {/* Fecha y hora */}
        <Box sx={{ p: 2, borderRadius: 2, bgcolor: BRAND.cremaClara, border: `1px solid ${BRAND.borde}` }}>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: todoElDia ? "1fr 1fr" : "1.3fr 1fr 1fr" }, gap: 2 }}>
            <TextField
              type="date"
              label={todoElDia ? "Desde" : "Fecha"}
              value={fecha}
              onChange={(e) => {
                setFecha(e.target.value);
                if (fechaFin < e.target.value) setFechaFin(e.target.value);
              }}
              InputLabelProps={{ shrink: true }}
              sx={{ bgcolor: "#fff" }}
            />
            {todoElDia ? (
              <TextField
                type="date"
                label="Hasta"
                value={fechaFin}
                inputProps={{ min: fecha }}
                onChange={(e) => setFechaFin(e.target.value)}
                InputLabelProps={{ shrink: true }}
                sx={{ bgcolor: "#fff" }}
              />
            ) : (
              <>
                <TextField
                  type="time"
                  label="Hora"
                  value={hora}
                  onChange={(e) => setHora(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                  inputProps={{ step: 300 }}
                  sx={{ bgcolor: "#fff" }}
                />
                <TextField
                  select
                  label="Duración"
                  value={duracion}
                  onChange={(e) => setDuracion(Number(e.target.value))}
                  sx={{ bgcolor: "#fff" }}
                >
                  {opcionesDuracion.map((m) => (
                    <MenuItem key={m} value={m}>
                      {textoDuracion(m)}
                    </MenuItem>
                  ))}
                </TextField>
              </>
            )}
          </Box>
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mt: 1, flexWrap: "wrap", gap: 1 }}>
            <FormControlLabel
              control={<Switch size="small" checked={todoElDia} onChange={(e) => setTodoElDia(e.target.checked)} />}
              label={<Typography sx={{ fontSize: 13.5 }}>Todo el día</Typography>}
            />
            {fecha && (
              <Typography sx={{ fontSize: 13, color: BRAND.textoSuave }}>
                {todoElDia
                  ? textoDiaLargo(fecha)
                  : `${textoDiaLargo(fecha)}, de ${hora} a ${horaDe(fin)}${fechaDe(fin) !== fecha ? " (del día siguiente)" : ""}`}
              </Typography>
            )}
          </Box>
        </Box>

        {avisos.map((a) => (
          <Alert key={a} severity="warning">
            {a}
          </Alert>
        ))}

        {/* Color */}
        <Box>
          <Typography sx={{ fontSize: 13, color: BRAND.textoSuave, mb: 0.75 }}>Color en el calendario</Typography>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75, alignItems: "center" }}>
            <Tooltip title={calendario ? `Color del calendario “${calendario.nombre}”` : "Color del calendario"}>
              <Box
                role="button"
                tabIndex={0}
                aria-label="Color automático"
                onClick={() => setColorId("")}
                onKeyDown={(e) => e.key === "Enter" && setColorId("")}
                sx={{
                  height: 28,
                  px: 1.25,
                  borderRadius: 14,
                  display: "flex",
                  alignItems: "center",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  border: `1.5px solid ${!colorId ? BRAND.oro : BRAND.borde}`,
                  color: !colorId ? BRAND.oro : BRAND.textoSuave,
                  gap: 0.75,
                }}
              >
                <Box component="span" sx={{ width: 12, height: 12, borderRadius: "50%", bgcolor: calendario?.color || BRAND.oro }} />
                Del calendario
              </Box>
            </Tooltip>
            {COLORES_GOOGLE.map((c) => (
              <Tooltip key={c.id} title={c.nombre}>
                <Box
                  role="button"
                  tabIndex={0}
                  aria-label={`Color ${c.nombre}`}
                  onClick={() => setColorId(c.id)}
                  onKeyDown={(e) => e.key === "Enter" && setColorId(c.id)}
                  sx={{
                    width: 28,
                    height: 28,
                    borderRadius: "50%",
                    bgcolor: c.color,
                    cursor: "pointer",
                    display: "grid",
                    placeItems: "center",
                    color: "#fff",
                    boxShadow: colorId === c.id ? `0 0 0 2px #fff, 0 0 0 4px ${c.color}` : "none",
                  }}
                >
                  {colorId === c.id && <Check sx={{ fontSize: 16 }} />}
                </Box>
              </Tooltip>
            ))}
          </Box>
        </Box>

        <TextField
          label="Notas"
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          multiline
          minRows={2}
          maxRows={6}
          placeholder="Indicaciones, qué debe traer, observaciones…"
          inputProps={{ maxLength: 4000 }}
        />

        {cita?.creadoDesde === "google" && cita.descripcion && (
          <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: "#faf8f1", border: `1px dashed ${BRAND.borde}` }}>
            <Typography sx={{ fontSize: 12, color: BRAND.textoTenue, mb: 0.5 }}>Descripción escrita en Google (se conserva)</Typography>
            <Typography sx={{ fontSize: 13, whiteSpace: "pre-wrap", color: BRAND.textoSuave }}>{cita.descripcion}</Typography>
          </Box>
        )}

        {error && <Alert severity="error">{error}</Alert>}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2, gap: 1, flexWrap: "wrap" }}>
        {editando && !soloLectura && (
          <Button
            color="error"
            startIcon={<Delete />}
            onClick={eliminar}
            disabled={guardando}
            variant={confirmarEliminar ? "contained" : "text"}
            sx={{ mr: "auto" }}
          >
            {confirmarEliminar ? "Sí, eliminar" : "Eliminar"}
          </Button>
        )}
        {confirmarEliminar && (
          <Typography sx={{ fontSize: 12.5, color: BRAND.error, width: { xs: "100%", sm: "auto" }, order: { xs: -1, sm: 0 } }}>
            También se borrará de Google Calendar.
          </Typography>
        )}
        <Button onClick={cerrar} disabled={guardando}>
          Cancelar
        </Button>
        <Button
          variant="contained"
          onClick={guardar}
          disabled={guardando || soloLectura}
          startIcon={guardando ? <CircularProgress size={16} color="inherit" /> : null}
        >
          {guardando ? "Guardando…" : editando ? "Guardar cambios" : "Agendar cita"}
        </Button>
      </DialogActions>
      <RegistroRapidoPaciente
        open={Boolean(registroInicial)}
        inicial={registroInicial}
        onClose={() => setRegistroInicial(null)}
        onCreada={(p) => {
          setRegistroInicial(null);
          setSinPaciente(false);
          setPaciente({ id: p.id, nombre: p.nombre, apellido: p.apellido, dni: p.dni, celular: p.celular });
        }}
      />
    </Dialog>
  );
}
