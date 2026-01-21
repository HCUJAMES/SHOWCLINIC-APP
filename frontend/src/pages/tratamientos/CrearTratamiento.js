import React, { useState, useEffect } from "react";
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Autocomplete,
  Chip,
  Divider,
} from "@mui/material";
import { ArrowBack, Home, Settings, Add, Delete } from "@mui/icons-material";
import { useNavigate } from "react-router-dom";
import { useToast } from "../../components/ToastProvider";
import { useAuth } from "../../hooks/useAuth";
import { canCreateTreatments, isDoctor as checkIsDoctor } from "../../utils/permissions";
import { COLORS, API_BASE_URL } from "../../constants";

export default function CrearTratamiento() {
  const navigate = useNavigate();
  const colorPrincipal = COLORS.PRIMARY;
  const { showToast } = useToast();
  const { role, token } = useAuth();
  const [tratamientos, setTratamientos] = useState([]);
  const [nuevo, setNuevo] = useState({ nombre: "", descripcion: "", precio: "" });
  const [editId, setEditId] = useState(null);
  const isDoctor = checkIsDoctor(role);
  const canCreate = canCreateTreatments(role);

  // Estados para configurar productos del tratamiento
  const [modalProductos, setModalProductos] = useState(false);
  const [tratamientoSeleccionado, setTratamientoSeleccionado] = useState(null);
  const [productosDelTratamiento, setProductosDelTratamiento] = useState([]);
  const [variantes, setVariantes] = useState([]);
  const [varianteSeleccionada, setVarianteSeleccionada] = useState(null);
  const [cantidadProducto, setCantidadProducto] = useState(1);

  const cargarTratamientos = async () => {
    const res = await fetch(`${API_BASE_URL}/api/tratamientos/listar`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    const data = await res.json();
    const tratamientosOrdenados = Array.isArray(data) ? data.sort((a, b) => {
      return (a.nombre || '').toLowerCase().localeCompare((b.nombre || '').toLowerCase());
    }) : [];
    setTratamientos(tratamientosOrdenados);
  };

  const cargarVariantes = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/inventario/variantes`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      setVariantes(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Error al cargar variantes:", err);
    }
  };

  const cargarProductosDelTratamiento = async (tratamientoId) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/tratamientos/recetas/${tratamientoId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      setProductosDelTratamiento(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Error al cargar productos del tratamiento:", err);
      setProductosDelTratamiento([]);
    }
  };

  const abrirConfigProductos = async (tratamiento) => {
    setTratamientoSeleccionado(tratamiento);
    await cargarProductosDelTratamiento(tratamiento.id);
    setModalProductos(true);
  };

  const agregarProductoATratamiento = async () => {
    if (!varianteSeleccionada) {
      showToast({ severity: "warning", message: "Selecciona un producto" });
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/tratamientos/recetas/${tratamientoSeleccionado.id}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          variante_id: varianteSeleccionada.id,
          cantidad_unidades: cantidadProducto || 1,
        }),
      });

      if (res.ok) {
        showToast({ severity: "success", message: "Producto agregado" });
        await cargarProductosDelTratamiento(tratamientoSeleccionado.id);
        setVarianteSeleccionada(null);
        setCantidadProducto(1);
      } else {
        const err = await res.json();
        showToast({ severity: "error", message: err.message || "Error al agregar producto" });
      }
    } catch (err) {
      console.error(err);
      showToast({ severity: "error", message: "Error al agregar producto" });
    }
  };

  const eliminarProductoDeTratamiento = async (varianteId) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/tratamientos/recetas/${tratamientoSeleccionado.id}/${varianteId}`, {
        method: "DELETE",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (res.ok) {
        showToast({ severity: "success", message: "Producto eliminado" });
        await cargarProductosDelTratamiento(tratamientoSeleccionado.id);
      } else {
        showToast({ severity: "error", message: "Error al eliminar producto" });
      }
    } catch (err) {
      console.error(err);
      showToast({ severity: "error", message: "Error al eliminar producto" });
    }
  };

  const guardarEdicion = async () => {
    if (!isDoctor) {
      showToast({ severity: "warning", message: "Solo el rol doctor puede modificar tratamientos" });
      return;
    }

    if (!editId) return;

    if (!nuevo.nombre) {
      showToast({ severity: "warning", message: "Por favor, completa el Nombre del tratamiento." });
      return;
    }

    const res = await fetch(`${API_BASE_URL}/api/tratamientos/${editId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(nuevo),
    });

    if (res.ok) {
      showToast({ severity: "success", message: "Tratamiento actualizado correctamente" });
      setNuevo({ nombre: "", descripcion: "", precio: "" });
      setEditId(null);
      cargarTratamientos();
    } else {
      showToast({ severity: "error", message: "Error al actualizar tratamiento" });
    }
  };

  const editarTratamiento = (t) => {
    setEditId(t.id);
    setNuevo({
      nombre: t.nombre || "",
      descripcion: t.descripcion || "",
      precio: t.precio == null ? "" : String(t.precio),
    });
  };

  const cancelarEdicion = () => {
    setEditId(null);
    setNuevo({ nombre: "", descripcion: "", precio: "" });
  };

  const crearTratamiento = async () => {
    if (!canCreate) {
      showToast({ severity: "warning", message: "No tienes permisos para crear tratamientos" });
      return;
    }

    if (!nuevo.nombre) {
      showToast({ severity: "warning", message: "Por favor, completa el Nombre del tratamiento." });
      return;
    }

    const res = await fetch(`${API_BASE_URL}/api/tratamientos/crear`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(nuevo),
    });

    if (res.ok) {
      showToast({ severity: "success", message: "Tratamiento creado correctamente" });
      setNuevo({ nombre: "", descripcion: "", precio: "" });
      cargarTratamientos();
    } else {
      showToast({ severity: "error", message: "Error al crear tratamiento" });
    }
  };

  const eliminarTratamiento = async (id) => {
    if (!isDoctor) {
      showToast({ severity: "warning", message: "Solo el rol doctor puede modificar tratamientos" });
      return;
    }
    if (!window.confirm("¿Deseas eliminar este tratamiento?")) return;
    await fetch(`${API_BASE_URL}/api/tratamientos/eliminar/${id}`, {
      method: "DELETE",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    cargarTratamientos();
  };

  useEffect(() => {
    cargarTratamientos();
    cargarVariantes();
  }, []);

  return (
    <Box
      sx={{
        minHeight: "100vh",
        backgroundImage: "url('/images/background-showclinic.jpg')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        display: "flex",
        justifyContent: "center",
        alignItems: "flex-start",
        p: 4,
        "&::before": {
          content: '""',
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(135deg, rgba(255,255,255,0.7), rgba(247,234,193,0.55))",
          zIndex: 0,
        },
      }}
    >
      <Paper
        sx={{
          p: 4,
          borderRadius: 4,
          background:
            "linear-gradient(180deg, rgba(255,249,236,0.98) 0%, rgba(255,255,255,0.92) 52%, rgba(247,234,193,0.55) 100%)",
          border: "1px solid rgba(212,175,55,0.22)",
          backdropFilter: "blur(10px)",
          zIndex: 1,
          width: "90%",
          maxWidth: 800,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
          <IconButton onClick={() => navigate("/tratamientos")} sx={{ color: colorPrincipal }}>
            <ArrowBack />
          </IconButton>
          <Typography
            variant="h5"
            sx={{ color: colorPrincipal, fontWeight: "bold", flex: 1, textAlign: "center" }}
          >
            {isDoctor ? "Nuevo Protocolo" : "Protocolos de la clínica"}
          </Typography>
          <IconButton onClick={() => navigate("/dashboard")} sx={{ color: colorPrincipal }} title="Inicio">
            <Home />
          </IconButton>
        </Box>

        {canCreate ? (
          <Box sx={{ display: "grid", gap: 2, mb: 3 }}>
            <TextField
              label="Nombre del tratamiento *"
              value={nuevo.nombre}
              onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })}
              placeholder="Ej: Diseño de labios, Botox facial, etc."
            />
            <TextField
              label="Descripción"
              multiline
              rows={3}
              value={nuevo.descripcion}
              onChange={(e) =>
                setNuevo({ ...nuevo, descripcion: e.target.value })
              }
            />
            <Button
              variant="contained"
              sx={{
                backgroundColor: colorPrincipal,
                "&:hover": { backgroundColor: "#8a541a" },
                color: "white",
                py: 1.2,
                borderRadius: 3,
                fontWeight: "bold",
              }}
              onClick={editId ? guardarEdicion : crearTratamiento}
            >
              {editId ? "Guardar cambios" : "Guardar Tratamiento"}
            </Button>

            {isDoctor && editId ? (
              <Button
                variant="outlined"
                sx={{
                  borderColor: colorPrincipal,
                  color: colorPrincipal,
                  py: 1.2,
                  borderRadius: 3,
                  fontWeight: "bold",
                }}
                onClick={cancelarEdicion}
              >
                Cancelar edición
              </Button>
            ) : null}
          </Box>
        ) : null}

        <Table>
          <TableHead>
            <TableRow sx={{ backgroundColor: colorPrincipal }}>
              <TableCell sx={{ color: "white" }}>Nombre</TableCell>
              <TableCell sx={{ color: "white" }}>Descripción</TableCell>
              <TableCell sx={{ color: "white" }}>Acciones</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {tratamientos.map((t) => (
              <TableRow key={t.id}>
                <TableCell>{t.nombre}</TableCell>
                <TableCell>{t.descripcion}</TableCell>
                <TableCell>
                  {isDoctor ? (
                    <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
                      <Button
                        size="small"
                        onClick={() => editarTratamiento(t)}
                      >
                        Editar
                      </Button>
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<Settings />}
                        onClick={() => abrirConfigProductos(t)}
                        sx={{ borderColor: colorPrincipal, color: colorPrincipal }}
                      >
                        Productos
                      </Button>
                      <Button
                        size="small"
                        color="error"
                        onClick={() => eliminarTratamiento(t.id)}
                      >
                        Eliminar
                      </Button>
                    </Box>
                  ) : (
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => abrirConfigProductos(t)}
                      sx={{ borderColor: colorPrincipal, color: colorPrincipal }}
                    >
                      Ver productos
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>

      {/* Modal para configurar productos del tratamiento */}
      <Dialog
        open={modalProductos}
        onClose={() => setModalProductos(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ backgroundColor: colorPrincipal, color: "white" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Settings />
            <span>Configurar Productos - {tratamientoSeleccionado?.nombre}</span>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Define qué productos/marcas se pueden usar para este tratamiento. 
            Al iniciar una sesión, solo aparecerán estos productos como opciones.
          </Typography>

          {/* Productos actuales */}
          <Typography variant="subtitle2" sx={{ fontWeight: "bold", mb: 1, color: colorPrincipal }}>
            Productos configurados:
          </Typography>
          
          {productosDelTratamiento.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2, fontStyle: "italic" }}>
              No hay productos configurados. Se mostrarán todos los productos del inventario.
            </Typography>
          ) : (
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mb: 2 }}>
              {productosDelTratamiento.map((p) => (
                <Chip
                  key={p.variante_id}
                  label={`${p.producto_base_nombre} - ${p.variante_nombre} (${p.cantidad_unidades} ${p.unidad_base})`}
                  onDelete={isDoctor ? () => eliminarProductoDeTratamiento(p.variante_id) : undefined}
                  sx={{ 
                    backgroundColor: "rgba(163, 105, 32, 0.1)",
                    borderColor: colorPrincipal,
                    "& .MuiChip-deleteIcon": { color: "#d32f2f" }
                  }}
                  variant="outlined"
                />
              ))}
            </Box>
          )}

          {isDoctor && (
            <>
              <Divider sx={{ my: 2 }} />
              <Typography variant="subtitle2" sx={{ fontWeight: "bold", mb: 1, color: colorPrincipal }}>
                Agregar producto:
              </Typography>
              <Box sx={{ display: "flex", gap: 2, alignItems: "flex-start", flexWrap: "wrap" }}>
                <Autocomplete
                  sx={{ flex: 1, minWidth: 300 }}
                  options={variantes.filter(v => !productosDelTratamiento.some(p => p.variante_id === v.id))}
                  value={varianteSeleccionada}
                  onChange={(_, val) => setVarianteSeleccionada(val)}
                  getOptionLabel={(opt) => `${opt.producto_base_nombre || ""} - ${opt.nombre || ""} (${opt.unidad_base})`}
                  renderInput={(params) => (
                    <TextField {...params} label="Seleccionar producto" placeholder="Buscar producto..." />
                  )}
                  isOptionEqualToValue={(opt, val) => opt.id === val.id}
                />
                <TextField
                  label="Cantidad"
                  type="number"
                  value={cantidadProducto}
                  onChange={(e) => setCantidadProducto(parseFloat(e.target.value) || 1)}
                  sx={{ width: 120 }}
                  inputProps={{ min: 0.1, step: 0.1 }}
                  helperText="ml / unidades"
                />
                <Button
                  variant="contained"
                  startIcon={<Add />}
                  onClick={agregarProductoATratamiento}
                  sx={{ backgroundColor: colorPrincipal, "&:hover": { backgroundColor: "#8a541a" }, height: 56 }}
                >
                  Agregar
                </Button>
              </Box>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setModalProductos(false)}>Cerrar</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
