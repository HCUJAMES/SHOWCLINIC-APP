import React, { useEffect, useMemo, useState } from "react";
import {
  Box,
  Typography,
  Paper,
  TextField,
  FormControl,
  Select,
  MenuItem,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
} from "@mui/material";
import { useToast } from "../components/ToastProvider";

const API_BASE_URL = `${window.location.protocol}//${window.location.hostname}:4000`;

export default function PacientesConDeudas() {
  const colorPrincipal = "#a36920ff";
  const { showToast } = useToast();
  const token = localStorage.getItem("token");
  const role = localStorage.getItem("role");
  const canModifyDeudas = role === "doctor";

  const [rows, setRows] = useState([]);
  const [tratamientosBase, setTratamientosBase] = useState([]);

  const [term, setTerm] = useState("");
  const [tratamientoId, setTratamientoId] = useState("");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");

  const [cancelarOpen, setCancelarOpen] = useState(false);
  const [cancelarRow, setCancelarRow] = useState(null);
  const [cancelarMetodo, setCancelarMetodo] = useState("Efectivo");
  const [cancelarMonto, setCancelarMonto] = useState("");
  const [guardandoCancelacion, setGuardandoCancelacion] = useState(false);

  const authHeaders = useMemo(
    () => (token ? { Authorization: `Bearer ${token}` } : {}),
    [token]
  );

  const cargarTratamientosBase = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/tratamientos/listar`, {
        headers: authHeaders,
      });
      const data = await res.json();
      setTratamientosBase(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      setTratamientosBase([]);
    }
  };

  const cargarDeudas = async () => {
    try {
      const params = new URLSearchParams();
      if (term.trim()) params.set("term", term.trim());
      if (tratamientoId) params.set("tratamientoId", tratamientoId);
      if (fechaDesde) params.set("fechaDesde", fechaDesde);
      if (fechaHasta) params.set("fechaHasta", fechaHasta);

      const qs = params.toString() ? `?${params.toString()}` : "";
      const res = await fetch(`${API_BASE_URL}/api/deudas/listar${qs}`, {
        headers: authHeaders,
      });
      const data = await res.json();
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      setRows([]);
    }
  };

  useEffect(() => {
    cargarTratamientosBase();
    cargarDeudas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const abrirCancelar = (row) => {
    if (!canModifyDeudas) {
      showToast({ severity: "warning", message: "No tienes permisos para registrar pagos" });
      return;
    }
    setCancelarRow(row);
    setCancelarMetodo("Efectivo");
    setCancelarMonto(String(row?.monto_saldo ?? ""));
    setCancelarOpen(true);
  };

  const confirmarCancelacion = async () => {
    if (!cancelarRow?.id) return;
    const montoNum = parseFloat(cancelarMonto);
    if (!(montoNum > 0)) {
      showToast({ severity: "warning", message: "El monto debe ser mayor a 0" });
      return;
    }
    if (!cancelarMetodo) {
      showToast({ severity: "warning", message: "Selecciona el método de pago" });
      return;
    }

    try {
      setGuardandoCancelacion(true);
      const res = await fetch(`${API_BASE_URL}/api/deudas/${cancelarRow.id}/abonar`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders,
        },
        body: JSON.stringify({ metodo: cancelarMetodo, monto: montoNum }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast({ severity: "error", message: data?.message || "Error al cancelar deuda" });
        return;
      }
      setCancelarOpen(false);
      setCancelarRow(null);
      showToast({ severity: "success", message: "Pago registrado" });
      await cargarDeudas();
    } catch (e) {
      console.error(e);
      showToast({ severity: "error", message: "Error al cancelar deuda" });
    } finally {
      setGuardandoCancelacion(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        backgroundImage: "url('/images/background-showclinic.jpg')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        position: "relative",
        p: { xs: 2, md: 4 },
        "&::before": {
          content: '""',
          position: "absolute",
          inset: 0,
          background: "linear-gradient(135deg, rgba(255,255,255,0.75), rgba(247,234,193,0.60))",
          zIndex: 0,
        },
        "& > *": { position: "relative", zIndex: 1 },
      }}
    >
      <Paper
        elevation={6}
        sx={{
          maxWidth: 1100,
          mx: "auto",
          p: { xs: 2.5, md: 4 },
          borderRadius: 4,
          backgroundColor: "rgba(255,255,255,0.88)",
          border: "1px solid rgba(212,175,55,0.20)",
          backdropFilter: "blur(10px)",
        }}
      >
        <Box sx={{ display: "flex", justifyContent: "space-between", gap: 2, flexWrap: "wrap" }}>
          <Typography variant="h5" sx={{ color: colorPrincipal, fontWeight: 800 }}>
            Pacientes con deudas
          </Typography>
          <Button
            variant="outlined"
            sx={{ borderColor: colorPrincipal, color: colorPrincipal, fontWeight: "bold" }}
            onClick={() => (window.location.href = "/pacientes")}
          >
            Volver
          </Button>
        </Box>

        <Box sx={{ mt: 3 }}>
          <Grid container spacing={2}>
            <Grid item xs={12} md={4}>
              <TextField
                label="Buscar (nombre/DNI)"
                fullWidth
                value={term}
                onChange={(e) => setTerm(e.target.value)}
              />
            </Grid>

            <Grid item xs={12} md={4}>
              <FormControl fullWidth>
                <Select
                  value={tratamientoId}
                  displayEmpty
                  onChange={(e) => setTratamientoId(e.target.value)}
                  renderValue={(selected) => {
                    if (!selected) return "Filtrar por tratamiento";
                    const t = tratamientosBase.find((x) => String(x.id) === String(selected));
                    return t?.nombre || String(selected);
                  }}
                >
                  <MenuItem value="">(Todos)</MenuItem>
                  {tratamientosBase.map((t) => (
                    <MenuItem key={t.id} value={t.id}>
                      {t.nombre}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} md={2}>
              <TextField
                label="Desde"
                type="date"
                fullWidth
                InputLabelProps={{ shrink: true }}
                value={fechaDesde}
                onChange={(e) => setFechaDesde(e.target.value)}
              />
            </Grid>

            <Grid item xs={12} md={2}>
              <TextField
                label="Hasta"
                type="date"
                fullWidth
                InputLabelProps={{ shrink: true }}
                value={fechaHasta}
                onChange={(e) => setFechaHasta(e.target.value)}
              />
            </Grid>

            <Grid item xs={12}>
              <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                <Button
                  variant="contained"
                  sx={{ backgroundColor: colorPrincipal, fontWeight: "bold" }}
                  onClick={cargarDeudas}
                >
                  Buscar
                </Button>
                <Button
                  variant="outlined"
                  sx={{ borderColor: colorPrincipal, color: colorPrincipal, fontWeight: "bold" }}
                  onClick={() => {
                    setTerm("");
                    setTratamientoId("");
                    setFechaDesde("");
                    setFechaHasta("");
                    setTimeout(cargarDeudas, 0);
                  }}
                >
                  Limpiar
                </Button>
              </Box>
            </Grid>
          </Grid>
        </Box>

        <Table sx={{ mt: 3 }}>
          <TableHead>
            <TableRow>
              <TableCell>Paciente</TableCell>
              <TableCell>Tratamiento</TableCell>
              <TableCell>Adelanto</TableCell>
              <TableCell>Saldo</TableCell>
              <TableCell>Fecha</TableCell>
              <TableCell>Acciones</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell>
                  {`${r.paciente_nombre || ""} ${r.paciente_apellido || ""}`.trim() || "—"}
                </TableCell>
                <TableCell>{r.tratamiento_nombre || "—"}</TableCell>
                <TableCell>S/ {Number(r.monto_adelanto || 0).toFixed(2)}</TableCell>
                <TableCell>S/ {Number(r.monto_saldo || 0).toFixed(2)}</TableCell>
                <TableCell>{r.fecha_tratamiento || r.creado_en || "—"}</TableCell>
                <TableCell>
                  <Button
                    size="small"
                    variant="contained"
                    sx={{ backgroundColor: colorPrincipal, fontWeight: "bold" }}
                    onClick={() => abrirCancelar(r)}
                  >
                    Registrar pago
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>

      <Dialog open={cancelarOpen} onClose={() => setCancelarOpen(false)}>
        <DialogTitle>Registrar abono</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 1, display: "flex", flexDirection: "column", gap: 2, minWidth: 320 }}>
            <FormControl fullWidth>
              <Select value={cancelarMetodo} onChange={(e) => setCancelarMetodo(e.target.value)}>
                <MenuItem value="Efectivo">Efectivo</MenuItem>
                <MenuItem value="Tarjeta">Tarjeta</MenuItem>
                <MenuItem value="Transferencia">Transferencia</MenuItem>
                <MenuItem value="Yape">Yape</MenuItem>
                <MenuItem value="Plin">Plin</MenuItem>
              </Select>
            </FormControl>
            <TextField
              label="Monto pagado (S/)"
              type="number"
              value={cancelarMonto}
              onChange={(e) => setCancelarMonto(e.target.value)}
              fullWidth
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCancelarOpen(false)}>Cerrar</Button>
          <Button
            variant="contained"
            disabled={guardandoCancelacion}
            sx={{ backgroundColor: colorPrincipal, fontWeight: "bold" }}
            onClick={confirmarCancelacion}
          >
            Confirmar
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
