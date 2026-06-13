import React, { useState, useEffect } from "react";
import {
  Box,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Button,
  Chip,
  CircularProgress,
  Divider,
} from "@mui/material";
import { Search, FileDownload, CalendarToday, QrCodeScanner } from "@mui/icons-material";
import axios from "axios";

const API_BASE_URL = `${window.location.protocol}//${window.location.hostname}:4000`;

const ProductosAplicados = () => {
  const [tratamientos, setTratamientos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");
  const [filtroNombre, setFiltroNombre] = useState("");

  // Búsqueda por código de producto
  const [codigoBusqueda, setCodigoBusqueda] = useState("");
  const [codigoResultados, setCodigoResultados] = useState(null);
  const [codigoLoading, setCodigoLoading] = useState(false);

  const buscarPorCodigo = async () => {
    const codigo = codigoBusqueda.trim();
    if (!codigo) return;
    setCodigoLoading(true);
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(`${API_BASE_URL}/api/tratamientos/buscar-por-codigo`, {
        params: { codigo },
        headers: { Authorization: `Bearer ${token}` },
      });
      setCodigoResultados(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error("Error al buscar por código:", error);
      setCodigoResultados([]);
    } finally {
      setCodigoLoading(false);
    }
  };

  useEffect(() => {
    // Set default dates: last 30 days
    const hoy = new Date();
    const hace30Dias = new Date();
    hace30Dias.setDate(hoy.getDate() - 30);
    
    setFechaFin(hoy.toISOString().split("T")[0]);
    setFechaInicio(hace30Dias.toISOString().split("T")[0]);
  }, []);

  useEffect(() => {
    if (fechaInicio && fechaFin) {
      cargarTratamientos();
    }
  }, [fechaInicio, fechaFin]);

  const cargarTratamientos = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(`${API_BASE_URL}/api/tratamientos/productos-aplicados`, {
        params: { fechaInicio, fechaFin },
        headers: { Authorization: `Bearer ${token}` },
      });
      setTratamientos(response.data || []);
    } catch (error) {
      console.error("Error al cargar tratamientos:", error);
      setTratamientos([]);
    } finally {
      setLoading(false);
    }
  };

  const tratamientosFiltrados = tratamientos.filter((t) => {
    if (!filtroNombre) return true;
    const busqueda = filtroNombre.toLowerCase();
    const nombreCompleto = `${t.paciente_nombre || ""} ${t.paciente_apellido || ""}`.trim().toLowerCase();
    return (
      t.paciente_nombre?.toLowerCase().includes(busqueda) ||
      t.paciente_apellido?.toLowerCase().includes(busqueda) ||
      nombreCompleto.includes(busqueda) ||
      t.tratamiento_nombre?.toLowerCase().includes(busqueda) ||
      t.productos_texto?.toLowerCase().includes(busqueda)
    );
  });

  const exportarExcel = () => {
    const headers = ["Fecha", "Paciente", "Tratamiento", "Producto", "Cantidad", "Especialista"];
    const rows = tratamientosFiltrados.map((t) => [
      t.fecha || "-",
      `${t.paciente_nombre || ""} ${t.paciente_apellido || ""}`.trim() || "-",
      t.tratamiento_nombre || "-",
      t.productos_texto || "-",
      t.cantidad_total || "-",
      t.especialista || "-",
    ]);

    let csv = headers.join(",") + "\n";
    rows.forEach((row) => {
      csv += row.map((cell) => `"${cell}"`).join(",") + "\n";
    });

    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `productos_aplicados_${fechaInicio}_${fechaFin}.csv`;
    link.click();
  };

  return (
    <Box sx={{ p: 3, maxWidth: 1400, mx: "auto" }}>
      {/* Header */}
      <Paper
        elevation={0}
        sx={{
          mb: 3,
          p: 3,
          background: "linear-gradient(135deg, #FFFDF8 0%, #f5f1e4 100%)",
          border: "2px solid #E8DFD0",
          borderRadius: 3,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 2 }}>
          <Box
            sx={{
              width: 50,
              height: 50,
              borderRadius: "50%",
              background: "linear-gradient(135deg, #B8860B 0%, #D4AF37 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 2px 8px rgba(184,134,11,0.3)",
            }}
          >
            <CalendarToday sx={{ color: "white", fontSize: 28 }} />
          </Box>
          <Box>
            <Typography
              sx={{
                fontFamily: "'Cormorant Garamond', serif",
                fontWeight: 700,
                fontSize: "1.8rem",
                textTransform: "uppercase",
                letterSpacing: 2,
                color: "#3B2F1E",
              }}
            >
              Productos Aplicados
            </Typography>
            <Typography sx={{ fontFamily: "'DM Sans', sans-serif", fontSize: "0.9rem", color: "#8B7D6B" }}>
              Historial de productos utilizados en tratamientos
            </Typography>
          </Box>
        </Box>

        {/* Filters */}
        <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", alignItems: "center" }}>
          <TextField
            label="Fecha Inicio"
            type="date"
            value={fechaInicio}
            onChange={(e) => setFechaInicio(e.target.value)}
            InputLabelProps={{ shrink: true }}
            size="small"
            sx={{ minWidth: 160 }}
          />
          <TextField
            label="Fecha Fin"
            type="date"
            value={fechaFin}
            onChange={(e) => setFechaFin(e.target.value)}
            InputLabelProps={{ shrink: true }}
            size="small"
            sx={{ minWidth: 160 }}
          />
          <Button
            variant="contained"
            startIcon={<Search />}
            onClick={cargarTratamientos}
            sx={{
              backgroundColor: "#B8860B",
              "&:hover": { backgroundColor: "#8a5a1a" },
              fontWeight: 600,
            }}
          >
            Buscar
          </Button>
          <TextField
            placeholder="Buscar paciente, tratamiento o producto..."
            value={filtroNombre}
            onChange={(e) => setFiltroNombre(e.target.value)}
            size="small"
            sx={{ flexGrow: 1, minWidth: 250 }}
            InputProps={{
              startAdornment: <Search sx={{ color: "#8B7D6B", mr: 1 }} />,
            }}
          />
          <Button
            variant="outlined"
            startIcon={<FileDownload />}
            onClick={exportarExcel}
            disabled={tratamientosFiltrados.length === 0}
            sx={{
              borderColor: "#B8860B",
              color: "#B8860B",
              "&:hover": { borderColor: "#8a5a1a", backgroundColor: "rgba(184,134,11,0.08)" },
            }}
          >
            Exportar CSV
          </Button>
        </Box>

        {/* Stats */}
        <Box sx={{ display: "flex", gap: 2, mt: 2 }}>
          <Chip
            label={`${tratamientosFiltrados.length} tratamientos`}
            sx={{
              backgroundColor: "rgba(76,175,80,0.15)",
              color: "#2e7d32",
              fontWeight: 600,
              fontSize: "0.85rem",
            }}
          />
        </Box>
      </Paper>

      {/* Búsqueda por código de producto */}
      <Paper
        elevation={0}
        sx={{
          mb: 3,
          p: 3,
          background: "linear-gradient(135deg, #FFFDF8 0%, #f5f1e4 100%)",
          border: "2px solid #E8DFD0",
          borderRadius: 3,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 2 }}>
          <QrCodeScanner sx={{ color: "#a36920" }} />
          <Box>
            <Typography sx={{ fontWeight: 700, color: "#3B2F1E", fontSize: "1.05rem" }}>
              Buscar por código de producto
            </Typography>
            <Typography sx={{ fontSize: "0.82rem", color: "#8B7D6B" }}>
              Escanea o escribe un código para ver a qué paciente se le aplicó
            </Typography>
          </Box>
        </Box>
        <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", alignItems: "center" }}>
          <TextField
            placeholder="Ingresa o escanea el código..."
            value={codigoBusqueda}
            onChange={(e) => setCodigoBusqueda(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                buscarPorCodigo();
              }
            }}
            size="small"
            sx={{ flexGrow: 1, minWidth: 250 }}
            InputProps={{
              startAdornment: <QrCodeScanner sx={{ color: "#8B7D6B", mr: 1 }} />,
            }}
          />
          <Button
            variant="contained"
            startIcon={<Search />}
            onClick={buscarPorCodigo}
            disabled={!codigoBusqueda.trim() || codigoLoading}
            sx={{
              backgroundColor: "#B8860B",
              "&:hover": { backgroundColor: "#8a5a1a" },
              fontWeight: 600,
            }}
          >
            Buscar código
          </Button>
          {codigoResultados !== null && (
            <Button
              variant="outlined"
              onClick={() => {
                setCodigoBusqueda("");
                setCodigoResultados(null);
              }}
              sx={{
                borderColor: "#B8860B",
                color: "#B8860B",
                "&:hover": { borderColor: "#8a5a1a", backgroundColor: "rgba(184,134,11,0.08)" },
              }}
            >
              Limpiar
            </Button>
          )}
        </Box>

        {/* Resultados de la búsqueda por código */}
        {codigoLoading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}>
            <CircularProgress size={28} sx={{ color: "#B8860B" }} />
          </Box>
        ) : codigoResultados !== null ? (
          codigoResultados.length === 0 ? (
            <Typography sx={{ mt: 2, color: "#8B7D6B", fontSize: "0.9rem" }}>
              No se encontró ningún código que coincida con "{codigoBusqueda}".
            </Typography>
          ) : (
            <Box sx={{ mt: 2, display: "flex", flexDirection: "column", gap: 1.5 }}>
              {codigoResultados.map((r) => {
                const aplicado = !!r.treatment_id && !!r.paciente_id;
                return (
                  <Paper
                    key={r.barcode_unit_id}
                    elevation={0}
                    sx={{
                      p: 2,
                      borderRadius: 2,
                      border: "1px solid #E8DFD0",
                      backgroundColor: "white",
                    }}
                  >
                    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 1 }}>
                      <Typography sx={{ fontWeight: 700, color: "#3B2F1E", fontFamily: "monospace" }}>
                        {r.barcode}
                      </Typography>
                      <Chip
                        label={aplicado ? "Aplicado" : (r.status === "active" ? "Disponible" : "Sin uso registrado")}
                        size="small"
                        sx={{
                          fontWeight: 600,
                          backgroundColor: aplicado ? "rgba(76,175,80,0.15)" : "rgba(33,150,243,0.15)",
                          color: aplicado ? "#2e7d32" : "#1565c0",
                        }}
                      />
                    </Box>
                    <Typography sx={{ fontSize: "0.85rem", color: "#8B7D6B", mt: 0.5 }}>
                      {`${r.producto_base_nombre || ""} ${r.variante_nombre || ""}`.trim() || "Producto sin nombre"}
                      {r.unidades_restantes != null && r.unidades_totales != null
                        ? ` — Restantes: ${r.unidades_restantes} de ${r.unidades_totales}`
                        : ""}
                    </Typography>
                    <Divider sx={{ my: 1.2 }} />
                    {aplicado ? (
                      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 3, rowGap: 0.5 }}>
                        <Typography sx={{ fontSize: "0.85rem" }}>
                          <b>Paciente:</b>{" "}
                          {`${r.paciente_nombre || ""} ${r.paciente_apellido || ""}`.trim() || "-"}
                          {r.paciente_dni ? ` (DNI ${r.paciente_dni})` : ""}
                        </Typography>
                        <Typography sx={{ fontSize: "0.85rem" }}>
                          <b>Tratamiento:</b> {r.tratamiento_nombre || "-"}
                        </Typography>
                        <Typography sx={{ fontSize: "0.85rem" }}>
                          <b>Fecha:</b> {r.tratamiento_fecha || r.scanned_at || "-"}
                        </Typography>
                        <Typography sx={{ fontSize: "0.85rem" }}>
                          <b>Especialista:</b> {r.especialista || "-"}
                        </Typography>
                        <Typography sx={{ fontSize: "0.85rem" }}>
                          <b>Sesión:</b> {r.sesion || "-"}
                        </Typography>
                      </Box>
                    ) : (
                      <Typography sx={{ fontSize: "0.85rem", color: "#8B7D6B" }}>
                        Este código existe en inventario pero aún no se ha aplicado a ningún paciente.
                      </Typography>
                    )}
                  </Paper>
                );
              })}
            </Box>
          )
        ) : null}
      </Paper>

      {/* Table */}
      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 5 }}>
          <CircularProgress sx={{ color: "#B8860B" }} />
        </Box>
      ) : (
        <TableContainer
          component={Paper}
          elevation={0}
          sx={{
            borderRadius: 3,
            border: "1px solid #E8DFD0",
            maxHeight: "calc(100vh - 400px)",
          }}
        >
          <Table stickyHeader size="small">
            <TableHead>
              <TableRow>
                {["Fecha", "Paciente", "Tratamiento", "Producto Aplicado", "Cantidad", "Especialista", "Sesión", "Tipo"].map(
                  (header) => (
                    <TableCell
                      key={header}
                      sx={{
                        fontWeight: 700,
                        fontSize: "0.75rem",
                        color: "white",
                        backgroundColor: "#a36920",
                        borderBottom: "2px solid #8a5a1a",
                        whiteSpace: "nowrap",
                        py: 1.5,
                        px: 2,
                      }}
                    >
                      {header}
                    </TableCell>
                  )
                )}
              </TableRow>
            </TableHead>
            <TableBody>
              {tratamientosFiltrados.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                    <Typography sx={{ color: "#8B7D6B", fontSize: "0.9rem" }}>
                      No se encontraron tratamientos en el rango de fechas seleccionado
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                tratamientosFiltrados.map((t, idx) => (
                  <TableRow
                    key={t.id || idx}
                    sx={{
                      "&:hover": { backgroundColor: "rgba(184,134,11,0.05)" },
                      "&:nth-of-type(even)": { backgroundColor: "rgba(245,241,228,0.3)" },
                    }}
                  >
                    <TableCell sx={{ fontSize: "0.8rem", whiteSpace: "nowrap", px: 2 }}>
                      {t.fecha || "-"}
                    </TableCell>
                    <TableCell sx={{ fontSize: "0.8rem", fontWeight: 600, px: 2 }}>
                      {`${t.paciente_nombre || ""} ${t.paciente_apellido || ""}`.trim() || "-"}
                    </TableCell>
                    <TableCell sx={{ fontSize: "0.8rem", px: 2 }}>{t.tratamiento_nombre || "-"}</TableCell>
                    <TableCell sx={{ fontSize: "0.8rem", px: 2, maxWidth: 300 }}>
                      {t.productos_texto || "-"}
                    </TableCell>
                    <TableCell sx={{ fontSize: "0.8rem", textAlign: "center", px: 2 }}>
                      {t.cantidad_total || "-"}
                    </TableCell>
                    <TableCell sx={{ fontSize: "0.8rem", px: 2 }}>{t.especialista || "-"}</TableCell>
                    <TableCell sx={{ fontSize: "0.8rem", textAlign: "center", px: 2 }}>
                      {t.sesion || "-"}
                    </TableCell>
                    <TableCell sx={{ fontSize: "0.8rem", px: 2 }}>
                      <Chip
                        label={t.tipoAtencion || "Estándar"}
                        size="small"
                        sx={{
                          fontSize: "0.7rem",
                          height: 22,
                          backgroundColor:
                            t.tipoAtencion === "urgencia"
                              ? "rgba(244,67,54,0.15)"
                              : "rgba(33,150,243,0.15)",
                          color: t.tipoAtencion === "urgencia" ? "#c62828" : "#1565c0",
                        }}
                      />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
};

export default ProductosAplicados;
