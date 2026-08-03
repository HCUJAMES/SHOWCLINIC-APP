import React, { useMemo, useState } from "react";
import { Box, Typography, Avatar, Tooltip, Chip, Button, Collapse } from "@mui/material";
import { CheckRounded, CloseRounded, GroupsRounded } from "@mui/icons-material";

/**
 * Asignación de especialistas a los tratamientos de un presupuesto.
 *
 * Pensado para hacerlo rápido, no tratamiento por tratamiento:
 *   1. Un clic en un avatar de arriba asigna TODOS los tratamientos a esa persona
 *      (el caso más común: un solo especialista hace todo).
 *   2. Para las excepciones se tocan las filas a mover y un clic en el avatar de
 *      la barra inferior las reasigna en bloque.
 *
 * Props:
 *   items          [{ nombre, sesiones, precio }]
 *   especialistas  [{ id, nombre }]
 *   value          { [nombreTratamiento]: especialistaId }
 *   onChange(next) recibe el mapa completo ya actualizado
 */

// Tonos de la paleta ShowClinic (marrón/dorado) para distinguir personas
// sin salirse de la identidad de la marca. Se asignan por posición en la lista
// para que dos especialistas nunca compartan color.
const TONOS = ["#8A5A1A", "#C4944A", "#4E342E", "#B8823C", "#6D4C41", "#A36920", "#8D6E63", "#D4AF37"];

const iniciales = (nombre = "") =>
  nombre
    .replace(/^(Dr|Dra|Lic)\.?\s+/i, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();

// Nombre corto para no romper el layout: "Dr. Erick Espetia" → "Erick E."
const nombreCorto = (nombre = "") => {
  const limpio = nombre.replace(/^(Dr|Dra|Lic)\.?\s+/i, "");
  const partes = limpio.split(/\s+/).filter(Boolean);
  if (partes.length <= 1) return limpio;
  return `${partes[0]} ${partes[1][0]}.`;
};

function AvatarEspecialista({ esp, tono, size = 34, activo, onClick, title }) {
  return (
    <Tooltip title={title || esp.nombre} arrow>
      <Avatar
        onClick={onClick}
        sx={{
          width: size,
          height: size,
          bgcolor: tono,
          color: "#fff",
          fontSize: size * 0.36,
          fontWeight: 700,
          fontFamily: "'Poppins', sans-serif",
          cursor: onClick ? "pointer" : "default",
          border: activo ? "2.5px solid #1A1A1A" : "2.5px solid transparent",
          transition: "transform .15s ease, box-shadow .15s ease",
          "&:hover": onClick
            ? { transform: "scale(1.12)", boxShadow: "0 4px 12px rgba(163,105,32,0.4)" }
            : {},
        }}
      >
        {iniciales(esp.nombre)}
      </Avatar>
    </Tooltip>
  );
}

export default function AsignacionEspecialistas({ items = [], especialistas = [], value = {}, onChange }) {
  const [seleccion, setSeleccion] = useState([]); // nombres de tratamiento marcados

  const asignados = useMemo(
    () => items.filter((it) => value[it.nombre]).length,
    [items, value]
  );
  const completo = items.length > 0 && asignados === items.length;

  const espPorId = useMemo(() => {
    const m = new Map();
    especialistas.forEach((e) => m.set(String(e.id), e));
    return m;
  }, [especialistas]);

  // Color por posición: distinto para cada especialista de la lista.
  const tonoPorId = useMemo(() => {
    const m = new Map();
    especialistas.forEach((e, i) => m.set(String(e.id), TONOS[i % TONOS.length]));
    return m;
  }, [especialistas]);
  const tonoDe = (id) => tonoPorId.get(String(id)) || TONOS[0];

  const aplicar = (nombres, espId) => {
    const next = { ...value };
    nombres.forEach((n) => { next[n] = espId; });
    onChange(next);
  };

  const asignarATodos = (espId) => {
    aplicar(items.map((it) => it.nombre), espId);
    setSeleccion([]);
  };

  const asignarASeleccion = (espId) => {
    aplicar(seleccion, espId);
    setSeleccion([]);
  };

  const quitar = (nombre) => {
    const next = { ...value };
    delete next[nombre];
    onChange(next);
  };

  const toggle = (nombre) =>
    setSeleccion((prev) =>
      prev.includes(nombre) ? prev.filter((n) => n !== nombre) : [...prev, nombre]
    );

  const todosSeleccionados = seleccion.length === items.length && items.length > 0;

  if (items.length === 0) return null;

  return (
    <Box
      sx={{
        mt: 1.5,
        mb: 1.5,
        borderRadius: 3,
        overflow: "hidden",
        border: "1px solid rgba(163,105,32,0.22)",
        backgroundColor: "#FFFDFA",
      }}
    >
      {/* Cabecera */}
      <Box
        sx={{
          px: 2,
          py: 1.25,
          display: "flex",
          alignItems: "center",
          gap: 1,
          flexWrap: "wrap",
          backgroundColor: "rgba(163,105,32,0.06)",
          borderBottom: "1px solid rgba(163,105,32,0.15)",
        }}
      >
        <GroupsRounded sx={{ fontSize: 19, color: "#A36920" }} />
        <Typography sx={{ fontWeight: 700, fontSize: "0.85rem", color: "#5D4037", flex: 1 }}>
          ¿Quién realizará los tratamientos?
        </Typography>
        <Chip
          size="small"
          label={completo ? "Todo asignado" : `${asignados} de ${items.length}`}
          icon={completo ? <CheckRounded sx={{ fontSize: 14 }} /> : undefined}
          sx={{
            height: 22,
            fontSize: "0.68rem",
            fontWeight: 700,
            backgroundColor: completo ? "rgba(76,175,80,0.16)" : "rgba(255,152,0,0.16)",
            color: completo ? "#2e7d32" : "#e65100",
            "& .MuiChip-icon": { color: "#2e7d32" },
          }}
        />
      </Box>

      {/* Paso 1: asignar todo de un clic */}
      <Box sx={{ px: 2, pt: 1.5, pb: 1.25, display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
        <Typography sx={{ fontSize: "0.72rem", fontWeight: 600, color: "#6B6B6B", mr: 0.5 }}>
          Todos a:
        </Typography>
        {especialistas.map((esp) => (
          <AvatarEspecialista
            key={esp.id}
            esp={esp}
            tono={tonoDe(esp.id)}
            size={34}
            title={`Asignar los ${items.length} tratamientos a ${esp.nombre}`}
            onClick={() => asignarATodos(esp.id)}
          />
        ))}
      </Box>

      {/* Lista de tratamientos */}
      <Box sx={{ px: 2, pb: 1 }}>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 0.5 }}>
          <Typography sx={{ fontSize: "0.68rem", color: "#9e9e9e", fontWeight: 600, letterSpacing: 0.4 }}>
            TOCA LOS QUE HAGA OTRA PERSONA
          </Typography>
          <Button
            size="small"
            onClick={() => setSeleccion(todosSeleccionados ? [] : items.map((it) => it.nombre))}
            sx={{ fontSize: "0.68rem", textTransform: "none", color: "#A36920", minWidth: 0, p: "2px 6px" }}
          >
            {todosSeleccionados ? "Ninguno" : "Todos"}
          </Button>
        </Box>

        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
          {items.map((it) => {
            const espId = value[it.nombre];
            const esp = espId != null ? espPorId.get(String(espId)) : null;
            const marcado = seleccion.includes(it.nombre);

            return (
              <Box
                key={it.nombre}
                onClick={() => toggle(it.nombre)}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1,
                  px: 1.25,
                  py: 0.75,
                  borderRadius: 2,
                  cursor: "pointer",
                  userSelect: "none",
                  border: marcado ? "1.5px solid #A36920" : "1.5px solid transparent",
                  backgroundColor: marcado ? "rgba(163,105,32,0.10)" : "rgba(0,0,0,0.02)",
                  transition: "background-color .15s ease, border-color .15s ease",
                  "&:hover": { backgroundColor: "rgba(163,105,32,0.07)" },
                }}
              >
                {/* Casilla */}
                <Box
                  sx={{
                    width: 17,
                    height: 17,
                    borderRadius: "5px",
                    flexShrink: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    border: marcado ? "none" : "1.5px solid #c9bda9",
                    backgroundColor: marcado ? "#A36920" : "transparent",
                  }}
                >
                  {marcado && <CheckRounded sx={{ fontSize: 13, color: "#fff" }} />}
                </Box>

                <Typography sx={{ flex: 1, minWidth: 0, fontSize: "0.78rem", color: "#3E2723" }} noWrap>
                  {it.nombre}
                  {Number(it.sesiones) > 1 && (
                    <Typography component="span" sx={{ fontSize: "0.7rem", color: "#9e9e9e", ml: 0.6 }}>
                      {it.sesiones} ses.
                    </Typography>
                  )}
                </Typography>

                {/* Especialista actual */}
                {esp ? (
                  <Box
                    sx={{ display: "flex", alignItems: "center", gap: 0.6, flexShrink: 0 }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <AvatarEspecialista esp={esp} tono={tonoDe(esp.id)} size={24} />
                    <Typography sx={{ fontSize: "0.72rem", fontWeight: 600, color: "#5D4037" }}>
                      {nombreCorto(esp.nombre)}
                    </Typography>
                    <Tooltip title="Quitar" arrow>
                      <CloseRounded
                        onClick={() => quitar(it.nombre)}
                        sx={{
                          fontSize: 15,
                          color: "#bdbdbd",
                          cursor: "pointer",
                          "&:hover": { color: "#e53935" },
                        }}
                      />
                    </Tooltip>
                  </Box>
                ) : (
                  <Typography sx={{ fontSize: "0.7rem", color: "#ff9800", fontWeight: 600, flexShrink: 0 }}>
                    sin asignar
                  </Typography>
                )}
              </Box>
            );
          })}
        </Box>
      </Box>

      {/* Paso 2: barra de acción para los seleccionados */}
      <Collapse in={seleccion.length > 0}>
        <Box
          sx={{
            px: 2,
            py: 1.25,
            display: "flex",
            alignItems: "center",
            gap: 1,
            flexWrap: "wrap",
            backgroundColor: "#3E2723",
          }}
        >
          <Typography sx={{ fontSize: "0.74rem", fontWeight: 700, color: "#fff" }}>
            {seleccion.length} seleccionado{seleccion.length === 1 ? "" : "s"} →
          </Typography>
          {especialistas.map((esp) => (
            <AvatarEspecialista
              key={esp.id}
              esp={esp}
              tono={tonoDe(esp.id)}
              size={31}
              title={`Asignar a ${esp.nombre}`}
              onClick={() => asignarASeleccion(esp.id)}
            />
          ))}
          <Box sx={{ flex: 1 }} />
          <Button
            size="small"
            onClick={() => setSeleccion([])}
            sx={{ fontSize: "0.7rem", textTransform: "none", color: "rgba(255,255,255,0.75)", minWidth: 0 }}
          >
            Cancelar
          </Button>
        </Box>
      </Collapse>

      {!completo && seleccion.length === 0 && (
        <Typography sx={{ px: 2, pb: 1.5, fontSize: "0.7rem", color: "#9e9e9e" }}>
          Lo que quede sin asignar se puede definir al completar cada sesión.
        </Typography>
      )}
    </Box>
  );
}
