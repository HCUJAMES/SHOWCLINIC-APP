import React, { useEffect, useRef, useState } from "react";
import { Box, TextField, Typography, Chip, InputAdornment } from "@mui/material";
import { SwapHorizRounded } from "@mui/icons-material";

/**
 * Descuento en monto y porcentaje a la vez, siempre sincronizados.
 *
 * Se escribe en cualquiera de los dos campos y el otro se recalcula solo:
 * poner S/ 500 sobre S/ 3000 muestra 16.67 %, y poner 20 % muestra S/ 600.
 * El valor que se guarda siempre es el MONTO, que es lo que espera el backend.
 *
 * Props:
 *   base       subtotal sobre el que se calcula el descuento
 *   value      monto de descuento actual (número)
 *   onChange   recibe el monto ya redondeado a 2 decimales
 *   compact    versión angosta para paneles laterales
 *   atajos     muestra chips de % rápidos (10, 15, 20, 25)
 */

const ATAJOS_PCT = [10, 15, 20, 25];

const redondear2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

// Quita ceros sobrantes: 16.70 → "16.7", 20.00 → "20"
const limpiarNumero = (n) => {
  const s = redondear2(n).toFixed(2);
  return s.replace(/\.?0+$/, "") || "0";
};

export default function DescuentoDual({
  base = 0,
  value = 0,
  onChange,
  compact = false,
  atajos = true,
  autoFocus = false,
}) {
  const baseNum = Number(base) || 0;

  const [montoStr, setMontoStr] = useState(value ? String(redondear2(value)) : "");
  const [pctStr, setPctStr] = useState(
    value && baseNum > 0 ? limpiarNumero((Number(value) / baseNum) * 100) : ""
  );
  // Campo que el usuario está escribiendo: no se reformatea mientras teclea.
  const editando = useRef(null);

  // Resincroniza si el valor o el subtotal cambian desde fuera.
  useEffect(() => {
    if (editando.current) return;
    const v = Number(value) || 0;
    setMontoStr(v ? String(redondear2(v)) : "");
    setPctStr(v && baseNum > 0 ? limpiarNumero((v / baseNum) * 100) : "");
  }, [value, baseNum]);

  const emitir = (monto) => {
    if (onChange) onChange(redondear2(monto));
  };

  const cambiarMonto = (texto) => {
    editando.current = "monto";
    setMontoStr(texto);

    if (texto === "") {
      setPctStr("");
      emitir(0);
      return;
    }
    const crudo = Number(texto);
    let monto = crudo;
    if (isNaN(monto) || monto < 0) monto = 0;
    if (baseNum > 0 && monto > baseNum) monto = baseNum; // no se descuenta más del total

    // Si hubo que corregirlo, el campo también muestra el valor corregido:
    // ver "99999" mientras se guarda otra cifra confunde.
    if (monto !== crudo) setMontoStr(String(monto));

    setPctStr(baseNum > 0 ? limpiarNumero((monto / baseNum) * 100) : "");
    emitir(monto);
  };

  const cambiarPct = (texto) => {
    editando.current = "pct";
    setPctStr(texto);

    if (texto === "") {
      setMontoStr("");
      emitir(0);
      return;
    }
    const crudo = Number(texto);
    let pct = crudo;
    if (isNaN(pct) || pct < 0) pct = 0;
    if (pct > 100) pct = 100;

    if (pct !== crudo) setPctStr(String(pct));

    const monto = redondear2((baseNum * pct) / 100);
    setMontoStr(String(monto));
    emitir(monto);
  };

  const aplicarAtajo = (pct) => {
    editando.current = null;
    const monto = redondear2((baseNum * pct) / 100);
    setPctStr(String(pct));
    setMontoStr(String(monto));
    emitir(monto);
  };

  const soltar = () => { editando.current = null; };

  const monto = Number(montoStr) || 0;
  const total = Math.max(0, baseNum - monto);

  const campoSx = {
    "& .MuiInputBase-root": {
      backgroundColor: "#fffdf7",
      borderRadius: 1.5,
      fontSize: compact ? "0.8rem" : "0.95rem",
      height: compact ? 34 : 44,
      fontWeight: 600,
    },
    "& .MuiOutlinedInput-root": {
      "& fieldset": { borderColor: "rgba(163,105,32,0.25)" },
      "&:hover fieldset": { borderColor: "#ba9a63" },
      "&.Mui-focused fieldset": { borderColor: "#a36920", borderWidth: 2 },
    },
  };

  return (
    <Box>
      <Box sx={{ display: "flex", alignItems: "center", gap: compact ? 0.75 : 1.25 }}>
        {/* Monto */}
        <TextField
          size="small"
          type="number"
          placeholder="0.00"
          autoFocus={autoFocus}
          value={montoStr}
          onChange={(e) => cambiarMonto(e.target.value)}
          onBlur={soltar}
          inputProps={{ min: 0, max: baseNum || undefined, step: 0.01 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Typography sx={{ fontSize: compact ? "0.75rem" : "0.85rem", color: "#a36920", fontWeight: 700 }}>
                  S/
                </Typography>
              </InputAdornment>
            ),
          }}
          sx={{ ...campoSx, flex: 1, minWidth: compact ? 96 : 130 }}
        />

        <SwapHorizRounded sx={{ fontSize: compact ? 17 : 20, color: "#c0a875", flexShrink: 0 }} />

        {/* Porcentaje */}
        <TextField
          size="small"
          type="number"
          placeholder="0"
          value={pctStr}
          onChange={(e) => cambiarPct(e.target.value)}
          onBlur={soltar}
          inputProps={{ min: 0, max: 100, step: 0.1 }}
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                <Typography sx={{ fontSize: compact ? "0.75rem" : "0.85rem", color: "#a36920", fontWeight: 700 }}>
                  %
                </Typography>
              </InputAdornment>
            ),
          }}
          sx={{ ...campoSx, flex: 1, minWidth: compact ? 88 : 120 }}
        />
      </Box>

      {/* Atajos de porcentaje */}
      {atajos && baseNum > 0 && (
        <Box sx={{ display: "flex", gap: 0.6, mt: 0.75, flexWrap: "wrap" }}>
          {ATAJOS_PCT.map((p) => {
            const activo = Math.abs((Number(pctStr) || 0) - p) < 0.01;
            return (
              <Chip
                key={p}
                label={`${p}%`}
                size="small"
                onClick={() => aplicarAtajo(p)}
                sx={{
                  height: 22,
                  fontSize: "0.68rem",
                  fontWeight: 700,
                  cursor: "pointer",
                  backgroundColor: activo ? "#a36920" : "rgba(163,105,32,0.10)",
                  color: activo ? "#fff" : "#8a5a1a",
                  "&:hover": { backgroundColor: activo ? "#8a5a1a" : "rgba(163,105,32,0.20)" },
                }}
              />
            );
          })}
          {monto > 0 && (
            <Chip
              label="Quitar"
              size="small"
              onClick={() => aplicarAtajo(0)}
              sx={{
                height: 22,
                fontSize: "0.68rem",
                fontWeight: 600,
                cursor: "pointer",
                backgroundColor: "transparent",
                color: "#999",
                border: "1px solid #e0d6c2",
                "&:hover": { backgroundColor: "#f5f5f5", color: "#e53935" },
              }}
            />
          )}
        </Box>
      )}

      {/* Resumen del cálculo */}
      {monto > 0 && (
        <Typography
          sx={{
            mt: 0.9,
            fontSize: compact ? "0.72rem" : "0.8rem",
            color: "#6B6B6B",
          }}
        >
          S/ {baseNum.toFixed(2)} − S/ {monto.toFixed(2)} ({limpiarNumero(baseNum > 0 ? (monto / baseNum) * 100 : 0)}%) ={" "}
          <strong style={{ color: "#a36920" }}>S/ {total.toFixed(2)}</strong>
        </Typography>
      )}
    </Box>
  );
}
