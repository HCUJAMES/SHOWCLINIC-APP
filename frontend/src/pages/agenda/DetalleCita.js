import React from "react";
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  IconButton,
  Tooltip,
  Typography,
  useMediaQuery,
} from "@mui/material";
import { Close, Edit, OpenInNew, Person, Badge, MedicalServices, Description, Phone, AccessTime, CalendarMonth, PersonAdd } from "../../iconos";
import { BRAND } from "../../brand";
import { colorCita } from "./colores";
import { textoDiaLargo, textoHorario, fechaDe } from "./fechas";

function Fila({ icono: Icono, children }) {
  return (
    <Box sx={{ display: "flex", gap: 1.75, alignItems: "flex-start", py: 0.75 }}>
      <Icono sx={{ fontSize: 19, color: BRAND.textoTenue, mt: "1px" }} />
      <Box sx={{ minWidth: 0, flex: 1 }}>{children}</Box>
    </Box>
  );
}

export default function DetalleCita({ cita, onClose, onEditar, onVerPaciente, onRegistrarPaciente }) {
  const movil = useMediaQuery("(max-width:600px)");
  if (!cita) return null;
  const color = colorCita(cita);
  const p = cita.paciente;
  const nombre = p ? [p.nombre, p.apellido].filter(Boolean).join(" ") : null;
  const dia = cita.todoElDia ? cita.inicio : fechaDe(cita.inicio);

  // Para citas creadas en ShowClinic las notas ya vienen aparte; la
  // descripción se muestra solo si la escribieron a mano en Google.
  // (sin el bloque "Datos de ShowClinic", que ya se ve arriba).
  const descripcion =
    cita.creadoDesde === "google" ? String(cita.descripcion || "").split("— Datos de ShowClinic —")[0].trim() || null : null;

  return (
    <Dialog open={Boolean(cita)} onClose={onClose} fullWidth maxWidth="xs" fullScreen={movil}>
      <Box sx={{ height: 6, bgcolor: color }} />
      <Box sx={{ display: "flex", justifyContent: "flex-end", px: 1, pt: 1, gap: 0.5 }}>
        {cita.escribible !== false && (
          <Tooltip title="Editar">
            <IconButton onClick={() => onEditar(cita)} aria-label="Editar cita">
              <Edit fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
        {cita.enlace && (
          <Tooltip title="Abrir en Google Calendar">
            <IconButton component="a" href={cita.enlace} target="_blank" rel="noopener noreferrer" aria-label="Abrir en Google Calendar">
              <OpenInNew fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
        <IconButton onClick={onClose} aria-label="Cerrar">
          <Close fontSize="small" />
        </IconButton>
      </Box>
      <DialogContent sx={{ pt: 0 }}>
        <Box sx={{ display: "flex", gap: 1.5, alignItems: "flex-start", mb: 1.5 }}>
          <Box sx={{ width: 14, height: 14, borderRadius: "4px", bgcolor: color, mt: "6px", flexShrink: 0 }} />
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontSize: 20, fontWeight: 700, lineHeight: 1.3, color: BRAND.texto, wordBreak: "break-word" }}>
              {cita.titulo}
            </Typography>
            <Typography sx={{ fontSize: 14, color: BRAND.textoSuave, mt: 0.25 }}>
              {textoDiaLargo(dia, { anio: true })}
            </Typography>
          </Box>
        </Box>

        <Fila icono={AccessTime}>
          <Typography sx={{ fontSize: 14 }}>{textoHorario(cita)}</Typography>
          {cita.recurrente && <Typography sx={{ fontSize: 12, color: BRAND.textoTenue }}>Cita que se repite</Typography>}
        </Fila>

        {cita.calendarioNombre && (
          <Fila icono={CalendarMonth}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <Box sx={{ width: 10, height: 10, borderRadius: "3px", bgcolor: color, flexShrink: 0 }} />
              <Typography sx={{ fontSize: 14 }}>{cita.calendarioNombre}</Typography>
            </Box>
            {cita.escribible === false && (
              <Typography sx={{ fontSize: 12, color: BRAND.textoTenue }}>Calendario de solo lectura</Typography>
            )}
          </Fila>
        )}

        <Fila icono={Person}>
          {p ? (
            <>
              <Typography sx={{ fontSize: 14, fontWeight: 600 }}>{nombre}</Typography>
              <Typography sx={{ fontSize: 12.5, color: BRAND.textoSuave }}>{p.dni ? `DNI ${p.dni}` : "Sin DNI registrado"}</Typography>
              {p.vinculo === "auto" && (
                <Chip
                  size="small"
                  label="Reconocida por nombre/DNI"
                  sx={{ mt: 0.5, height: 20, fontSize: 11, bgcolor: "rgba(186,154,99,0.16)", color: BRAND.oroProfundo }}
                />
              )}
            </>
          ) : (
            <Typography sx={{ fontSize: 14, color: BRAND.textoTenue }}>Sin paciente vinculada</Typography>
          )}
        </Fila>

        {p?.celular && (
          <Fila icono={Phone}>
            <Typography sx={{ fontSize: 14 }}>{p.celular}</Typography>
          </Fila>
        )}

        {cita.tratamiento && (
          <Fila icono={MedicalServices}>
            <Typography sx={{ fontSize: 14 }}>{cita.tratamiento}</Typography>
          </Fila>
        )}

        {cita.especialistaNombre && (
          <Fila icono={Badge}>
            <Typography sx={{ fontSize: 14 }}>{cita.especialistaNombre}</Typography>
          </Fila>
        )}

        {(cita.notas || descripcion) && (
          <Fila icono={Description}>
            <Typography sx={{ fontSize: 13.5, whiteSpace: "pre-wrap", wordBreak: "break-word", color: BRAND.textoSuave }}>
              {cita.notas || descripcion}
            </Typography>
          </Fila>
        )}

        <Typography sx={{ fontSize: 11.5, color: BRAND.textoTenue, mt: 1.5 }}>
          {cita.creadoDesde === "showclinic"
            ? `Agendada desde ShowClinic${cita.creadoPor ? ` por ${cita.creadoPor}` : ""}`
            : "Creada directamente en Google Calendar"}
        </Typography>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
        {p ? (
          <Button variant="contained" fullWidth onClick={() => onVerPaciente(p)}>
            Ver historial de la paciente
          </Button>
        ) : cita.escribible !== false ? (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1, width: "100%" }}>
            <Typography sx={{ fontSize: 12.5, color: BRAND.textoSuave, textAlign: "center" }}>
              Esta persona no está vinculada a ninguna ficha del historial clínico.
            </Typography>
            <Button variant="contained" fullWidth startIcon={<PersonAdd />} onClick={() => onRegistrarPaciente?.(cita)}>
              Registrar paciente nueva
            </Button>
            <Button variant="outlined" fullWidth onClick={() => onEditar(cita)}>
              Vincular a una paciente existente
            </Button>
          </Box>
        ) : null}
      </DialogActions>
    </Dialog>
  );
}
