import React, { useEffect, useMemo, useState } from "react";
import { Box, Container, Paper, Typography, Grid, Button } from "@mui/material";
import axios from "axios";

const API_BASE_URL = `${window.location.protocol}//${window.location.hostname}:4000`;

const CAMPOS_FOTOS = [
  "foto_antes1",
  "foto_antes2",
  "foto_antes3",
  "foto_despues1",
  "foto_despues2",
  "foto_despues3",
  "foto_izquierda",
  "foto_frontal",
  "foto_derecha",
  "foto_extra1",
  "foto_extra2",
  "foto_extra3",
];

const FotosPaciente = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [tratamientos, setTratamientos] = useState([]);
  const [paciente, setPaciente] = useState(null);

  const token = localStorage.getItem("token");

  const query = useMemo(() => new URLSearchParams(window.location.search), []);
  const pacienteId = query.get("pacienteId");
  const tratamientoRealizadoId = query.get("tratamientoRealizadoId");

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError("");

        const pacienteRes = await axios.get(`${API_BASE_URL}/api/pacientes/${pacienteId}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        setPaciente(pacienteRes?.data || null);

        const res = await axios.get(`${API_BASE_URL}/api/tratamientos/historial/${pacienteId}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const rows = Array.isArray(res.data) ? res.data : [];
        setTratamientos(rows);
      } catch (e) {
        setError("Error al cargar las fotos del paciente");
        setTratamientos([]);
        setPaciente(null);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [pacienteId]);

  const nombreCompletoPaciente = useMemo(() => {
    const nombre = typeof paciente?.nombre === "string" ? paciente.nombre.trim() : "";
    const apellido = typeof paciente?.apellido === "string" ? paciente.apellido.trim() : "";
    const full = `${nombre} ${apellido}`.trim();
    return full;
  }, [paciente]);

  const tratamientosFiltrados = useMemo(() => {
    const idNum = tratamientoRealizadoId ? Number(tratamientoRealizadoId) : null;
    if (idNum && Number.isFinite(idNum)) {
      return tratamientos.filter((t) => Number(t.id) === idNum);
    }
    return tratamientos;
  }, [tratamientos, tratamientoRealizadoId]);

  const fotos = useMemo(() => {
    const items = [];
    for (const t of tratamientosFiltrados) {
      for (const campo of CAMPOS_FOTOS) {
        if (!t?.[campo]) continue;
        items.push({
          tratamientoRealizadoId: t.id,
          fecha: t.fecha,
          nombreTratamiento: t.nombreTratamiento,
          campo,
          filename: t[campo],
        });
      }
    }
    return items;
  }, [tratamientosFiltrados]);

  return (
    <div
      style={{
        backgroundImage:
          "linear-gradient(rgba(255,255,255,0.85), rgba(232,211,57,0.85)), url('/images/background-showclinic.jpg')",
        backgroundSize: "cover",
        minHeight: "100vh",
        padding: "40px 20px",
      }}
    >
      <Container maxWidth="lg">
        <Paper
          sx={{
            p: 4,
            borderRadius: "15px",
            background:
              "linear-gradient(180deg, rgba(255,249,236,0.98) 0%, rgba(255,255,255,0.92) 52%, rgba(247,234,193,0.55) 100%)",
            border: "1px solid rgba(212,175,55,0.22)",
            backdropFilter: "blur(10px)",
            boxShadow:
              "0 18px 46px rgba(0,0,0,0.14), 0 0 0 1px rgba(212,175,55,0.10)",
          }}
        >
          <Box sx={{ display: "flex", justifyContent: "space-between", gap: 2, flexWrap: "wrap" }}>
            <Typography variant="h5" sx={{ color: "#a36920", fontWeight: "bold" }}>
              Fotos del paciente{nombreCompletoPaciente ? ` ${nombreCompletoPaciente}` : ""}
            </Typography>
            <Button
              variant="outlined"
              sx={{ color: "#a36920", borderColor: "#a36920" }}
              onClick={() => window.close()}
            >
              Cerrar
            </Button>
          </Box>

          <Typography sx={{ mt: 1, color: "rgba(0,0,0,0.65)" }}>
            Paciente ID: {pacienteId || "-"}
            {tratamientoRealizadoId ? ` | Tratamiento realizado ID: ${tratamientoRealizadoId}` : ""}
          </Typography>

          {loading && <Typography sx={{ mt: 3 }}>Cargando...</Typography>}
          {!loading && error && (
            <Typography sx={{ mt: 3, color: "#b00020" }}>{error}</Typography>
          )}

          {!loading && !error && fotos.length === 0 && (
            <Typography sx={{ mt: 3 }}>No hay fotos registradas.</Typography>
          )}

          {!loading && !error && fotos.length > 0 && (
            <Grid container spacing={2} sx={{ mt: 1 }}>
              {fotos.map((f, idx) => (
                <Grid item xs={12} sm={6} md={4} lg={3} key={`${f.filename}-${idx}`}>
                  <Paper
                    variant="outlined"
                    sx={{
                      p: 1,
                      borderRadius: 2,
                      borderColor: "rgba(163,105,32,0.25)",
                      backgroundColor: "rgba(255,255,255,0.72)",
                    }}
                  >
                    <a
                      href={`${API_BASE_URL}/uploads/${f.filename}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ textDecoration: "none" }}
                    >
                      <img
                        src={`${API_BASE_URL}/uploads/${f.filename}`}
                        alt={f.campo}
                        style={{ width: "100%", height: 220, objectFit: "cover", borderRadius: 8 }}
                      />
                    </a>
                    <Typography variant="caption" sx={{ display: "block", mt: 1, color: "rgba(0,0,0,0.65)" }}>
                      {f.nombreTratamiento || "Tratamiento"}
                    </Typography>
                    <Typography variant="caption" sx={{ display: "block", color: "rgba(0,0,0,0.65)" }}>
                      {f.fecha ? f.fecha.split(" ")[0] : ""}
                    </Typography>
                  </Paper>
                </Grid>
              ))}
            </Grid>
          )}
        </Paper>
      </Container>
    </div>
  );
};

export default FotosPaciente;
