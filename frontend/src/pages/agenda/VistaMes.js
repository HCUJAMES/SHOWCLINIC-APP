import React, { useMemo } from "react";
import { Box, Typography, useMediaQuery } from "@mui/material";
import { BRAND } from "../../brand";
import { colorCita, textoSobre } from "./colores";
import { cuadriculaMes, citaEnDia, numeroDia, hoy as hoyFn, horaDe } from "./fechas";

const DIAS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

const etiqueta = (c) => {
  const nombre = c.paciente
    ? [c.paciente.nombre, (c.paciente.apellido || "").split(" ")[0]].filter(Boolean).join(" ")
    : c.titulo;
  return c.todoElDia ? nombre : `${horaDe(c.inicio)} ${nombre}`;
};

export default function VistaMes({ fecha, citas, onAbrir, onIrADia, onCrearDia, alto }) {
  const movil = useMediaQuery("(max-width:700px)");
  const hoy = hoyFn();
  const mes = fecha.slice(0, 7);
  const celdas = useMemo(() => cuadriculaMes(fecha), [fecha]);
  const porCelda = useMemo(
    () =>
      celdas.map((d) =>
        citas
          .filter((c) => citaEnDia(c, d))
          .sort((a, b) => (b.todoElDia ? 1 : 0) - (a.todoElDia ? 1 : 0) || a.inicio.localeCompare(b.inicio))
      ),
    [celdas, citas]
  );
  const maxVisibles = movil ? 0 : 3;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: alto, minHeight: 420, bgcolor: "#fff" }}>
      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", borderBottom: `1px solid ${BRAND.borde}` }}>
        {DIAS.map((d) => (
          <Typography
            key={d}
            sx={{
              textAlign: "center",
              py: 1,
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: BRAND.textoTenue,
            }}
          >
            {d}
          </Typography>
        ))}
      </Box>
      <Box sx={{ flex: 1, display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gridTemplateRows: "repeat(6, 1fr)" }}>
        {celdas.map((d, i) => {
          const lista = porCelda[i];
          const fuera = d.slice(0, 7) !== mes;
          const esHoy = d === hoy;
          const ocultas = lista.length - maxVisibles;
          return (
            <Box
              key={d}
              onClick={() => (movil ? onIrADia(d) : onCrearDia(d))}
              sx={{
                borderRight: (i + 1) % 7 ? `1px solid ${BRAND.borde}` : "none",
                borderBottom: i < 35 ? `1px solid ${BRAND.borde}` : "none",
                p: 0.5,
                minWidth: 0,
                overflow: "hidden",
                cursor: "pointer",
                bgcolor: fuera ? "rgba(245,241,228,0.45)" : "transparent",
                "&:hover": { bgcolor: "rgba(163,105,32,0.04)" },
              }}
            >
              <Box sx={{ display: "flex", justifyContent: "center", mb: 0.25 }}>
                <Box
                  component="span"
                  onClick={(e) => {
                    e.stopPropagation();
                    onIrADia(d);
                  }}
                  sx={{
                    width: 26,
                    height: 26,
                    borderRadius: "50%",
                    display: "grid",
                    placeItems: "center",
                    fontSize: 13,
                    fontWeight: esHoy ? 700 : 500,
                    bgcolor: esHoy ? BRAND.oro : "transparent",
                    color: esHoy ? "#fff" : fuera ? BRAND.textoTenue : BRAND.texto,
                    "&:hover": { bgcolor: esHoy ? BRAND.oroOscuro : "rgba(163,105,32,0.1)" },
                  }}
                >
                  {numeroDia(d)}
                </Box>
              </Box>

              {movil ? (
                lista.length > 0 && (
                  <Box sx={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "3px" }}>
                    {lista.slice(0, 6).map((c) => (
                      <Box key={c.id} sx={{ width: 6, height: 6, borderRadius: "50%", bgcolor: colorCita(c) }} />
                    ))}
                  </Box>
                )
              ) : (
                <>
                  {lista.slice(0, maxVisibles).map((c) => {
                    const color = colorCita(c);
                    return (
                      <Box
                        key={c.id}
                        role="button"
                        tabIndex={0}
                        onClick={(e) => {
                          e.stopPropagation();
                          onAbrir(c);
                        }}
                        onKeyDown={(e) => e.key === "Enter" && onAbrir(c)}
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          gap: 0.5,
                          px: 0.5,
                          py: "1px",
                          mb: "2px",
                          borderRadius: "4px",
                          fontSize: 11.5,
                          lineHeight: 1.45,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          ...(c.todoElDia
                            ? { bgcolor: color, color: textoSobre(color), fontWeight: 600 }
                            : { color: BRAND.texto, "&:hover": { bgcolor: "rgba(163,105,32,0.08)" } }),
                        }}
                      >
                        {!c.todoElDia && (
                          <Box component="span" sx={{ width: 7, height: 7, borderRadius: "50%", bgcolor: color, flexShrink: 0 }} />
                        )}
                        <Box component="span" sx={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                          {etiqueta(c)}
                        </Box>
                      </Box>
                    );
                  })}
                  {ocultas > 0 && (
                    <Typography
                      onClick={(e) => {
                        e.stopPropagation();
                        onIrADia(d);
                      }}
                      sx={{
                        fontSize: 11.5,
                        fontWeight: 600,
                        color: BRAND.oro,
                        px: 0.5,
                        "&:hover": { textDecoration: "underline" },
                      }}
                    >
                      +{ocultas} más
                    </Typography>
                  )}
                </>
              )}
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
