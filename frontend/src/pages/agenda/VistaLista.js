import React, { useMemo } from "react";
import { Box, Typography, Chip } from "@mui/material";
import { BRAND } from "../../brand";
import { colorCita } from "./colores";
import { citaEnDia, textoDiaLargo, hoy as hoyFn, sumarDias, textoHorario, diferenciaDias } from "./fechas";
import { CalendarToday } from "../../iconos";

export default function VistaLista({ desde, hasta, citas, onAbrir, alto }) {
  const hoy = hoyFn();
  const grupos = useMemo(() => {
    const dias = Array.from({ length: diferenciaDias(desde, hasta) }, (_, i) => sumarDias(desde, i));
    return dias
      .map((d) => ({
        dia: d,
        citas: citas
          .filter((c) => citaEnDia(c, d))
          .sort((a, b) => (b.todoElDia ? 1 : 0) - (a.todoElDia ? 1 : 0) || a.inicio.localeCompare(b.inicio)),
      }))
      .filter((g) => g.citas.length);
  }, [desde, hasta, citas]);

  if (!grupos.length) {
    return (
      <Box sx={{ height: alto, minHeight: 300, display: "grid", placeItems: "center", bgcolor: "#fff", p: 3 }}>
        <Box sx={{ textAlign: "center", color: BRAND.textoSuave }}>
          <CalendarToday sx={{ fontSize: 40, color: BRAND.arena, mb: 1 }} />
          <Typography sx={{ fontWeight: 600 }}>No hay citas en estas dos semanas</Typography>
          <Typography variant="body2">Usa “Nueva cita” para agendar una.</Typography>
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ height: alto, minHeight: 300, overflowY: "auto", bgcolor: "#fff" }}>
      {grupos.map(({ dia, citas: lista }) => {
        const esHoy = dia === hoy;
        return (
          <Box key={dia} sx={{ borderBottom: `1px solid ${BRAND.borde}` }}>
            <Box
              sx={{
                position: "sticky",
                top: 0,
                zIndex: 1,
                bgcolor: esHoy ? "#f8f0e2" : BRAND.cremaClara,
                px: { xs: 2, sm: 3 },
                py: 1,
                display: "flex",
                alignItems: "center",
                gap: 1,
              }}
            >
              <Typography sx={{ fontWeight: 700, color: esHoy ? BRAND.oro : BRAND.texto, fontSize: 14 }}>
                {textoDiaLargo(dia)}
              </Typography>
              {esHoy && <Chip size="small" label="Hoy" sx={{ bgcolor: BRAND.oro, color: "#fff", height: 20, fontSize: 11 }} />}
              <Typography sx={{ ml: "auto", fontSize: 12, color: BRAND.textoTenue }}>
                {lista.length} {lista.length === 1 ? "cita" : "citas"}
              </Typography>
            </Box>
            {lista.map((c) => {
              const color = colorCita(c);
              const nombre = c.paciente
                ? [c.paciente.nombre, c.paciente.apellido].filter(Boolean).join(" ")
                : null;
              return (
                <Box
                  key={c.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => onAbrir(c)}
                  onKeyDown={(e) => e.key === "Enter" && onAbrir(c)}
                  sx={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: { xs: 1.5, sm: 2.5 },
                    px: { xs: 2, sm: 3 },
                    py: 1.25,
                    cursor: "pointer",
                    "&:hover": { bgcolor: "rgba(163,105,32,0.04)" },
                    "&:focus-visible": { outline: `2px solid ${BRAND.oro}`, outlineOffset: -2 },
                  }}
                >
                  <Typography
                    sx={{
                      width: { xs: 74, sm: 110 },
                      flexShrink: 0,
                      fontSize: 13,
                      color: BRAND.textoSuave,
                      fontVariantNumeric: "tabular-nums",
                      pt: "1px",
                    }}
                  >
                    {textoHorario(c)}
                  </Typography>
                  <Box sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: color, mt: "5px", flexShrink: 0 }} />
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography sx={{ fontWeight: 600, fontSize: 14, color: BRAND.texto }} noWrap>
                      {c.titulo}
                    </Typography>
                    <Typography sx={{ fontSize: 12.5, color: BRAND.textoSuave }} noWrap>
                      {[nombre && `Paciente: ${nombre}`, c.tratamiento, c.especialistaNombre].filter(Boolean).join(" · ") ||
                        "Sin paciente vinculada"}
                    </Typography>
                  </Box>
                </Box>
              );
            })}
          </Box>
        );
      })}
    </Box>
  );
}
