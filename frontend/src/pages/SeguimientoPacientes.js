import React, { useState, useEffect, useMemo } from "react";
import {
  Box, Typography, Paper, IconButton, TextField, MenuItem, Select,
  FormControl, InputAdornment, Pagination, Button, Avatar,
} from "@mui/material";
import { ArrowBack, Home, Search, Description, Download } from "@mui/icons-material";
import { useNavigate } from "react-router-dom";
import axios from "axios";

const API = `${window.location.protocol}//${window.location.hostname}:4000`;

// Brand colors
const C = {
  bg: "#f5f1e4",
  card: "#fffdf7",
  border: "rgba(163,105,32,0.15)",
  borderHover: "rgba(163,105,32,0.35)",
  primary: "#a36920",
  brown: "#5a3e1b",
  brownLight: "#ba9a63",
  text: "#2E2E2E",
  muted: "#999",
  avatar: "#a36920",
};

const PER_PAGE = 6;

function tiempoTranscurrido(fechaStr) {
  if (!fechaStr) return { label: "Sin datos", days: Infinity };
  const fecha = new Date(fechaStr);
  const ahora = new Date();
  let diffMs = ahora - fecha;
  if (diffMs < 0) diffMs = 0;
  const totalDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const years = Math.floor(totalDays / 365);
  const months = Math.floor((totalDays % 365) / 30);
  const days = totalDays % 30;

  const parts = [];
  if (years > 0) parts.push(`${years} año${years > 1 ? "s" : ""}`);
  if (months > 0) parts.push(`${months} mes${months > 1 ? "es" : ""}`);
  if (days > 0 || parts.length === 0) parts.push(`${days} día${days !== 1 ? "s" : ""}`);
  return { label: parts.join(" y "), days: totalDays };
}

function formatFecha(fechaStr) {
  if (!fechaStr) return "";
  const d = new Date(fechaStr);
  const meses = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  return `${String(d.getDate()).padStart(2, "0")} ${meses[d.getMonth()]} ${d.getFullYear()}`;
}

function getInitials(nombre, apellido) {
  const n = (nombre || "").trim();
  const a = (apellido || "").trim();
  return ((n[0] || "") + (a[0] || "")).toUpperCase() || "?";
}

export default function SeguimientoPacientes() {
  const navigate = useNavigate();
  const token = localStorage.getItem("token");

  const [data, setData] = useState([]);
  const [tratamientos, setTratamientos] = useState([]);
  const [especialistas, setEspecialistas] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState("");
  const [filtroTratamiento, setFiltroTratamiento] = useState("");
  const [filtroEspecialista, setFiltroEspecialista] = useState("");
  const [orden, setOrden] = useState("mas_tiempo");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const headers = { Authorization: `Bearer ${token}` };
    Promise.all([
      axios.get(`${API}/api/pacientes/seguimiento`, { headers }),
      axios.get(`${API}/api/tratamientos/listar`, { headers }),
      axios.get(`${API}/api/especialistas/listar`, { headers }),
    ])
      .then(([segRes, tratRes, espRes]) => {
        setData(segRes.data || []);
        setTratamientos(tratRes.data || []);
        setEspecialistas(espRes.data || []);
      })
      .catch((err) => console.error("Error cargando seguimiento:", err))
      .finally(() => setLoading(false));
  }, [token]);

  // Process data
  const processed = useMemo(() => {
    return data.map((p) => {
      const t = tiempoTranscurrido(p.ultima_fecha);
      return { ...p, tiempo: t };
    });
  }, [data]);

  // Filter + sort
  const filtered = useMemo(() => {
    let list = [...processed];

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (p) =>
          (p.nombre || "").toLowerCase().includes(q) ||
          (p.apellido || "").toLowerCase().includes(q) ||
          (p.dni || "").toLowerCase().includes(q)
      );
    }

    if (filtroTratamiento) {
      list = list.filter((p) => (p.ultimo_tratamiento || "").toLowerCase().includes(filtroTratamiento.toLowerCase()));
    }

    if (filtroEspecialista) {
      list = list.filter((p) => (p.ultimo_especialista || "") === filtroEspecialista);
    }

    if (orden === "mas_tiempo") {
      list.sort((a, b) => b.tiempo.days - a.tiempo.days);
    } else if (orden === "menos_tiempo") {
      list.sort((a, b) => a.tiempo.days - b.tiempo.days);
    } else if (orden === "nombre") {
      list.sort((a, b) => (a.nombre || "").localeCompare(b.nombre || ""));
    }

    return list;
  }, [processed, search, filtroTratamiento, filtroEspecialista, orden]);

  // Stats
  const stats = useMemo(() => {
    const total = filtered.length;
    const menos3 = filtered.filter((p) => p.tiempo.days < 90).length;
    const entre3y6 = filtered.filter((p) => p.tiempo.days >= 90 && p.tiempo.days < 180).length;
    const mas6 = filtered.filter((p) => p.tiempo.days >= 180).length;
    return { total, menos3, entre3y6, mas6 };
  }, [filtered]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const paginated = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  // Unique specialists from data
  const uniqueEspecialistas = useMemo(() => {
    const set = new Set();
    data.forEach((p) => { if (p.ultimo_especialista) set.add(p.ultimo_especialista); });
    return [...set].sort();
  }, [data]);

  // Unique treatments from data
  const uniqueTratamientos = useMemo(() => {
    const set = new Set();
    data.forEach((p) => { if (p.ultimo_tratamiento) set.add(p.ultimo_tratamiento); });
    return [...set].sort();
  }, [data]);

  // Export CSV
  const exportCSV = () => {
    const header = "Paciente,DNI,Último Tratamiento,Especialista,Fecha,Tiempo sin venir\n";
    const rows = filtered.map((p) =>
      `"${p.nombre || ""} ${p.apellido || ""}","${p.dni || ""}","${p.ultimo_tratamiento || ""}","${p.ultimo_especialista || ""}","${formatFecha(p.ultima_fecha)}","${p.tiempo.label}"`
    ).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `seguimiento_pacientes_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Reset page on filter change
  useEffect(() => { setPage(1); }, [search, filtroTratamiento, filtroEspecialista, orden]);

  const StatCard = ({ label, value, active }) => (
    <Paper
      elevation={0}
      sx={{
        flex: 1,
        p: 2,
        borderRadius: 2.5,
        border: `1px solid ${active ? C.primary : C.border}`,
        backgroundColor: active ? "rgba(163,105,32,0.06)" : C.card,
        textAlign: "left",
      }}
    >
      <Typography sx={{ fontSize: 10, fontWeight: 600, letterSpacing: 1.5, textTransform: "uppercase", color: C.muted, mb: 0.5 }}>
        {label}
      </Typography>
      <Typography sx={{ fontSize: 28, fontWeight: 500, color: C.text, fontFamily: "'Cormorant Garamond', serif" }}>
        {value}
      </Typography>
    </Paper>
  );

  return (
    <Box sx={{ minHeight: "100vh", backgroundColor: C.bg, p: { xs: 2, md: 4 } }}>
      <Box sx={{ maxWidth: 820, mx: "auto" }}>
        {/* Nav */}
        <Box sx={{ display: "flex", justifyContent: "space-between", mb: 3 }}>
          <IconButton onClick={() => navigate("/pacientes")} sx={{ backgroundColor: "white", boxShadow: "0 2px 8px rgba(0,0,0,0.08)", "&:hover": { backgroundColor: "#fff" } }}>
            <ArrowBack sx={{ color: C.brown }} />
          </IconButton>
          <IconButton onClick={() => navigate("/dashboard")} sx={{ backgroundColor: "white", boxShadow: "0 2px 8px rgba(0,0,0,0.08)", "&:hover": { backgroundColor: "#fff" } }}>
            <Home sx={{ color: C.brown }} />
          </IconButton>
        </Box>

        {/* Title + Export */}
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 3 }}>
          <Box>
            <Typography sx={{ fontSize: "1.85rem", fontWeight: 400, color: C.text, fontFamily: "'Cormorant Garamond', serif", lineHeight: 1.2 }}>
              Seguimiento de pacientes
            </Typography>
            <Typography sx={{ fontSize: "0.85rem", color: C.muted, mt: 0.5 }}>
              Tiempo transcurrido desde el último tratamiento de cada paciente
            </Typography>
          </Box>
          <Button
            variant="outlined"
            startIcon={<Download />}
            onClick={exportCSV}
            sx={{
              borderColor: C.border, color: C.brown, textTransform: "none", fontWeight: 500,
              fontSize: 13, borderRadius: 2, px: 2, "&:hover": { borderColor: C.brownLight, background: "rgba(163,105,32,0.04)" },
            }}
          >
            Exportar
          </Button>
        </Box>

        {/* Stats */}
        <Box sx={{ display: "flex", gap: 1.5, mb: 3, flexWrap: "wrap" }}>
          <StatCard label="Total pacientes" value={stats.total} />
          <StatCard label="Menos de 3 meses" value={stats.menos3} />
          <StatCard label="3 a 6 meses" value={stats.entre3y6} />
          <StatCard label="Más de 6 meses" value={stats.mas6} active />
        </Box>

        {/* Filters */}
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, mb: 3 }}>
          <TextField
            placeholder="Buscar paciente..."
            size="small"
            fullWidth
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            InputProps={{
              startAdornment: <InputAdornment position="start"><Search sx={{ color: C.muted, fontSize: 20 }} /></InputAdornment>,
            }}
            sx={{
              "& .MuiOutlinedInput-root": {
                borderRadius: 2, backgroundColor: C.card, fontSize: 14,
                "& fieldset": { borderColor: C.border },
                "&:hover fieldset": { borderColor: C.brownLight },
              },
            }}
          />
          <FormControl size="small" fullWidth sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2, backgroundColor: C.card, fontSize: 14, "& fieldset": { borderColor: C.border } } }}>
            <Select
              displayEmpty
              value={filtroTratamiento}
              onChange={(e) => setFiltroTratamiento(e.target.value)}
            >
              <MenuItem value="">Todos los tratamientos</MenuItem>
              {uniqueTratamientos.map((t) => (
                <MenuItem key={t} value={t}>{t}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" fullWidth sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2, backgroundColor: C.card, fontSize: 14, "& fieldset": { borderColor: C.border } } }}>
            <Select
              displayEmpty
              value={filtroEspecialista}
              onChange={(e) => setFiltroEspecialista(e.target.value)}
            >
              <MenuItem value="">Todas las especialistas</MenuItem>
              {uniqueEspecialistas.map((e) => (
                <MenuItem key={e} value={e}>{e}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" fullWidth sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2, backgroundColor: C.card, fontSize: 14, "& fieldset": { borderColor: C.border } } }}>
            <Select
              displayEmpty
              value={orden}
              onChange={(e) => setOrden(e.target.value)}
            >
              <MenuItem value="mas_tiempo">Ordenar: más tiempo</MenuItem>
              <MenuItem value="menos_tiempo">Ordenar: menos tiempo</MenuItem>
              <MenuItem value="nombre">Ordenar: nombre A-Z</MenuItem>
            </Select>
          </FormControl>
        </Box>

        {/* Patient list */}
        {loading ? (
          <Box sx={{ textAlign: "center", py: 6 }}>
            <Typography sx={{ color: C.muted }}>Cargando...</Typography>
          </Box>
        ) : paginated.length === 0 ? (
          <Box sx={{ textAlign: "center", py: 6 }}>
            <Typography sx={{ color: C.muted }}>No se encontraron pacientes</Typography>
          </Box>
        ) : (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
            {paginated.map((p) => {
              const initials = getInitials(p.nombre, p.apellido);
              const fullName = `${p.nombre || ""} ${p.apellido || ""}`.trim();
              const colorTiempo =
                p.tiempo.days >= 180 ? "#c62828" : p.tiempo.days >= 90 ? "#e65100" : C.brownLight;

              return (
                <Paper
                  key={p.id}
                  elevation={0}
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    p: 2,
                    borderRadius: 3,
                    border: `1px solid ${C.border}`,
                    backgroundColor: C.card,
                    transition: "all 0.2s",
                    "&:hover": { borderColor: C.borderHover, boxShadow: "0 2px 12px rgba(163,105,32,0.08)" },
                  }}
                >
                  {/* Avatar */}
                  <Avatar
                    sx={{
                      width: 48, height: 48, mr: 2,
                      backgroundColor: C.avatar, fontSize: 16, fontWeight: 600,
                      fontFamily: "'Inter', sans-serif",
                    }}
                  >
                    {initials}
                  </Avatar>

                  {/* Info */}
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontSize: 15, fontWeight: 600, color: C.text, lineHeight: 1.3 }}>
                      {fullName}
                    </Typography>
                    <Typography sx={{ fontSize: 12, color: C.muted, mt: 0.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      Último: <strong style={{ color: C.brown }}>{p.ultimo_tratamiento || "N/A"}</strong>
                      {p.ultimo_especialista ? ` · ${p.ultimo_especialista}` : ""}
                    </Typography>
                    <Typography sx={{ fontSize: 11, color: C.muted }}>
                      {formatFecha(p.ultima_fecha)}
                    </Typography>
                  </Box>

                  {/* Tiempo sin venir */}
                  <Box sx={{ textAlign: "right", mr: 1.5, flexShrink: 0 }}>
                    <Typography sx={{ fontSize: 10, fontWeight: 600, letterSpacing: 1, textTransform: "uppercase", color: C.muted }}>
                      TIEMPO SIN VENIR
                    </Typography>
                    <Typography sx={{ fontSize: 14, fontWeight: 600, color: colorTiempo, mt: 0.2 }}>
                      {p.tiempo.label}
                    </Typography>
                  </Box>

                  {/* Go to historial */}
                  <IconButton
                    onClick={() => navigate(`/historial-clinico?paciente=${p.id}`)}
                    sx={{
                      border: `1px solid ${C.border}`,
                      borderRadius: 2,
                      width: 40, height: 40,
                      "&:hover": { borderColor: C.brownLight, backgroundColor: "rgba(163,105,32,0.04)" },
                    }}
                    title="Ver historial clínico"
                  >
                    <Description sx={{ color: C.brownLight, fontSize: 20 }} />
                  </IconButton>
                </Paper>
              );
            })}
          </Box>
        )}

        {/* Pagination + Count */}
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mt: 3, flexWrap: "wrap", gap: 1 }}>
          <Typography sx={{ fontSize: 13, color: C.muted }}>
            Mostrando {paginated.length} de {filtered.length} pacientes
          </Typography>
          {totalPages > 1 && (
            <Pagination
              count={totalPages}
              page={page}
              onChange={(_, v) => setPage(v)}
              shape="rounded"
              sx={{
                "& .MuiPaginationItem-root": {
                  color: C.brown,
                  borderColor: C.border,
                  fontSize: 13,
                  "&.Mui-selected": {
                    backgroundColor: C.primary,
                    color: "white",
                    "&:hover": { backgroundColor: "#8a5a1a" },
                  },
                },
              }}
            />
          )}
        </Box>

        {/* Footer */}
        <Box sx={{ textAlign: "center", mt: 5, pb: 3 }}>
          <Typography sx={{ fontSize: "0.85rem", color: C.muted }}>
            <span style={{ color: C.primary, fontWeight: 600 }}>ShowClinic</span> · Seguimiento de pacientes
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}
