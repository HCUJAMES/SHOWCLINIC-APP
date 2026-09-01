import React, { useState, useEffect } from "react";
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Autocomplete,
  Chip,
  Divider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from "@mui/material";
import { ArrowBack, Home, Settings, Add, Delete, PhotoCamera, Close, Edit, Check, Face, Inventory2 } from "@mui/icons-material";
import { useNavigate } from "react-router-dom";
import { useToast } from "../../components/ToastProvider";
import FacialMapMini from "../../components/FacialMapMini";
import { useAuth } from "../../hooks/useAuth";
import { canCreateTreatments, isDoctor as checkIsDoctor } from "../../utils/permissions";
import { COLORS, API_BASE_URL } from "../../constants";

/** "Botox - Botox" queda feo; si marca y variante coinciden, se muestra una sola vez. */
function nombreProducto(p) {
  const marca = String(p?.producto_base_nombre || "").trim();
  const variante = String(p?.variante_nombre || "").trim();
  if (!marca) return variante || "Producto";
  if (!variante || marca.toLowerCase() === variante.toLowerCase()) return marca;
  return `${marca} ${variante}`;
}

export default function CrearTratamiento() {
  const navigate = useNavigate();
  const colorPrincipal = COLORS.PRIMARY;
  const { showToast } = useToast();
  const { role, token } = useAuth();
  const [tratamientos, setTratamientos] = useState([]);
  const [nuevo, setNuevo] = useState({ nombre: "", descripcion: "", precio: "", procedimiento: "", sesiones: "1" });
  const [inlineEdit, setInlineEdit] = useState(null);
  const [filtroProcedimiento, setFiltroProcedimiento] = useState("");
  const isDoctor = checkIsDoctor(role);
  const canCreate = canCreateTreatments(role);

  // Estados para configurar productos del tratamiento
  const [modalProductos, setModalProductos] = useState(false);
  const [tratamientoSeleccionado, setTratamientoSeleccionado] = useState(null);
  const [productosDelTratamiento, setProductosDelTratamiento] = useState([]);
  const [variantes, setVariantes] = useState([]);
  const [varianteSeleccionada, setVarianteSeleccionada] = useState(null);
  const [cantidadProducto, setCantidadProducto] = useState(1);

  // Estados para imágenes de tratamientos
  const [imagenesTratamiento, setImagenesTratamiento] = useState([]);
  const [subiendoImagen, setSubiendoImagen] = useState(false);

  // { tratamiento_id: [ {producto_base_nombre, variante_nombre, ...} ] }
  const [recetasPorTratamiento, setRecetasPorTratamiento] = useState({});

  // Estados para el mapa facial 3D por defecto del tratamiento
  const [modalMapa, setModalMapa] = useState(false);
  const [puntosMapa, setPuntosMapa] = useState({});
  const [guardandoMapa, setGuardandoMapa] = useState(false);

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

  // Productos configurados de TODOS los protocolos, para mostrarlos en la
  // lista sin tener que abrir cada uno.
  const cargarRecetasTodas = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/tratamientos/recetas-todas`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      setRecetasPorTratamiento(data && typeof data === "object" ? data : {});
    } catch (err) {
      console.error("Error al cargar los productos de los protocolos:", err);
    }
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
    await cargarImagenesTratamiento(tratamiento.id);
    setModalProductos(true);
  };

  const cargarImagenesTratamiento = async (tratamientoId) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/tratamientos/protocolo/${tratamientoId}/imagenes`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      setImagenesTratamiento(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Error al cargar imágenes:", err);
      setImagenesTratamiento([]);
    }
  };

  const subirImagenes = async (e) => {
    if (!tratamientoSeleccionado) return;
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (imagenesTratamiento.length + files.length > 6) {
      showToast({ severity: "warning", message: `Solo puedes tener hasta 6 imágenes. Tienes ${imagenesTratamiento.length}.` });
      return;
    }

    setSubiendoImagen(true);
    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
      formData.append("imagenes", files[i]);
    }

    try {
      const res = await fetch(
        `${API_BASE_URL}/api/tratamientos/protocolo/${tratamientoSeleccionado.id}/imagenes`,
        {
          method: "POST",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: formData,
        }
      );
      if (res.ok) {
        showToast({ severity: "success", message: "Imágenes subidas correctamente" });
        await cargarImagenesTratamiento(tratamientoSeleccionado.id);
      } else {
        const err = await res.json();
        showToast({ severity: "error", message: err.message || "Error al subir imágenes" });
      }
    } catch (err) {
      console.error(err);
      showToast({ severity: "error", message: "Error al subir imágenes" });
    }
    setSubiendoImagen(false);
    e.target.value = "";
  };

  const eliminarImagen = async (imagenId) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/tratamientos/protocolo/imagen/${imagenId}`, {
        method: "DELETE",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        showToast({ severity: "success", message: "Imagen eliminada" });
        await cargarImagenesTratamiento(tratamientoSeleccionado.id);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const abrirMapaFacial = async (tratamiento) => {
    if (!tratamiento) return;
    setTratamientoSeleccionado(tratamiento);
    setPuntosMapa({});
    setModalMapa(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/tratamientos/${tratamiento.id}/mapa-facial`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      setPuntosMapa(data?.zonas_default_json || {});
    } catch (err) {
      console.error("Error al cargar mapa facial del tratamiento:", err);
      setPuntosMapa({});
    }
  };

  const guardarMapaFacial = async () => {
    if (!isDoctor) {
      showToast({ severity: "warning", message: "Solo el rol doctor puede modificar el mapa facial" });
      return;
    }
    if (!tratamientoSeleccionado) return;
    setGuardandoMapa(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/tratamientos/${tratamientoSeleccionado.id}/mapa-facial`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ zonas_default_json: puntosMapa }),
      });
      if (res.ok) {
        showToast({ severity: "success", message: "Mapa facial guardado" });
        setModalMapa(false);
        cargarTratamientos();
      } else {
        const err = await res.json();
        showToast({ severity: "error", message: err.message || "Error al guardar mapa facial" });
      }
    } catch (err) {
      console.error(err);
      showToast({ severity: "error", message: "Error al guardar mapa facial" });
    }
    setGuardandoMapa(false);
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
        cargarRecetasTodas();   // refresca lo que se ve en la lista
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
        cargarRecetasTodas();   // refresca lo que se ve en la lista
      } else {
        showToast({ severity: "error", message: "Error al eliminar producto" });
      }
    } catch (err) {
      console.error(err);
      showToast({ severity: "error", message: "Error al eliminar producto" });
    }
  };

  const iniciarEdicionInline = (t) => {
    setInlineEdit({
      id: t.id,
      nombre: t.nombre || "",
      descripcion: t.descripcion || "",
      precio: t.precio == null ? "" : String(t.precio),
      procedimiento: t.procedimiento || "",
      sesiones: t.sesiones == null ? "1" : String(t.sesiones),
    });
  };

  const cancelarEdicionInline = () => {
    setInlineEdit(null);
  };

  const guardarEdicionInline = async () => {
    if (!isDoctor) {
      showToast({ severity: "warning", message: "Solo el rol doctor puede modificar tratamientos" });
      return;
    }
    if (!inlineEdit) return;
    if (!inlineEdit.nombre) {
      showToast({ severity: "warning", message: "Por favor, completa el Nombre del tratamiento." });
      return;
    }

    const res = await fetch(`${API_BASE_URL}/api/tratamientos/${inlineEdit.id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        nombre: inlineEdit.nombre,
        descripcion: inlineEdit.descripcion,
        precio: inlineEdit.precio,
        procedimiento: inlineEdit.procedimiento,
        sesiones: inlineEdit.sesiones,
      }),
    });

    if (res.ok) {
      showToast({ severity: "success", message: "Tratamiento actualizado" });
      setInlineEdit(null);
      cargarTratamientos();
    } else {
      showToast({ severity: "error", message: "Error al actualizar tratamiento" });
    }
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
      setNuevo({ nombre: "", descripcion: "", precio: "", procedimiento: "", sesiones: "1" });
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
    cargarRecetasTodas();
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
              size="small"
              value={nuevo.nombre}
              onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })}
              placeholder="Ej: Diseño de labios, Botox facial, etc."
            />
            <TextField
              label="Descripción"
              multiline
              rows={2}
              size="small"
              value={nuevo.descripcion}
              onChange={(e) =>
                setNuevo({ ...nuevo, descripcion: e.target.value })
              }
            />
            <Box sx={{ display: "flex", gap: 1.5 }}>
              <FormControl size="small" sx={{ flex: 1 }}>
                <InputLabel>Procedimiento</InputLabel>
                <Select
                  value={nuevo.procedimiento}
                  label="Procedimiento"
                  onChange={(e) => setNuevo({ ...nuevo, procedimiento: e.target.value })}
                >
                  <MenuItem value=""><em>Sin asignar</em></MenuItem>
                  <MenuItem value="Cosmiatría Corporal">Cosmiatría Corporal</MenuItem>
                  <MenuItem value="Cosmiatría Facial">Cosmiatría Facial</MenuItem>
                  <MenuItem value="Armonización">Armonización</MenuItem>
                </Select>
              </FormControl>
              <TextField
                label="Precio (S/)"
                type="number"
                size="small"
                value={nuevo.precio}
                onChange={(e) => setNuevo({ ...nuevo, precio: e.target.value })}
                placeholder="1200"
                inputProps={{ min: 0, step: 0.01 }}
                sx={{ width: 130 }}
              />
              <TextField
                label="Sesiones"
                type="number"
                size="small"
                value={nuevo.sesiones}
                onChange={(e) => setNuevo({ ...nuevo, sesiones: e.target.value })}
                placeholder="3"
                inputProps={{ min: 1, step: 1 }}
                sx={{ width: 100 }}
              />
            </Box>
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
              onClick={crearTratamiento}
            >
              Guardar Tratamiento
            </Button>
          </Box>
        ) : null}

        {/* Filtros por procedimiento */}
        <Box sx={{ display: "flex", gap: 1.5, mb: 2, flexWrap: "wrap" }}>
          <Button
            size="small"
            variant={filtroProcedimiento === "" ? "contained" : "outlined"}
            onClick={() => setFiltroProcedimiento("")}
            sx={{
              borderColor: colorPrincipal,
              color: filtroProcedimiento === "" ? "white" : colorPrincipal,
              backgroundColor: filtroProcedimiento === "" ? colorPrincipal : "transparent",
              "&:hover": {
                backgroundColor: filtroProcedimiento === "" ? "#8a5a1a" : "rgba(163,105,32,0.1)",
              },
              borderRadius: 2,
              px: 2,
              fontSize: "0.85rem",
            }}
          >
            Todos
          </Button>
          <Button
            size="small"
            variant={filtroProcedimiento === "Cosmiatría Corporal" ? "contained" : "outlined"}
            onClick={() => setFiltroProcedimiento("Cosmiatría Corporal")}
            sx={{
              borderColor: colorPrincipal,
              color: filtroProcedimiento === "Cosmiatría Corporal" ? "white" : colorPrincipal,
              backgroundColor: filtroProcedimiento === "Cosmiatría Corporal" ? colorPrincipal : "transparent",
              "&:hover": {
                backgroundColor: filtroProcedimiento === "Cosmiatría Corporal" ? "#8a5a1a" : "rgba(163,105,32,0.1)",
              },
              borderRadius: 2,
              px: 2,
              fontSize: "0.85rem",
            }}
          >
            Cosmiatría Corporal
          </Button>
          <Button
            size="small"
            variant={filtroProcedimiento === "Cosmiatría Facial" ? "contained" : "outlined"}
            onClick={() => setFiltroProcedimiento("Cosmiatría Facial")}
            sx={{
              borderColor: colorPrincipal,
              color: filtroProcedimiento === "Cosmiatría Facial" ? "white" : colorPrincipal,
              backgroundColor: filtroProcedimiento === "Cosmiatría Facial" ? colorPrincipal : "transparent",
              "&:hover": {
                backgroundColor: filtroProcedimiento === "Cosmiatría Facial" ? "#8a5a1a" : "rgba(163,105,32,0.1)",
              },
              borderRadius: 2,
              px: 2,
              fontSize: "0.85rem",
            }}
          >
            Cosmiatría Facial
          </Button>
          <Button
            size="small"
            variant={filtroProcedimiento === "Armonización" ? "contained" : "outlined"}
            onClick={() => setFiltroProcedimiento("Armonización")}
            sx={{
              borderColor: colorPrincipal,
              color: filtroProcedimiento === "Armonización" ? "white" : colorPrincipal,
              backgroundColor: filtroProcedimiento === "Armonización" ? colorPrincipal : "transparent",
              "&:hover": {
                backgroundColor: filtroProcedimiento === "Armonización" ? "#8a5a1a" : "rgba(163,105,32,0.1)",
              },
              borderRadius: 2,
              px: 2,
              fontSize: "0.85rem",
            }}
          >
            Armonización
          </Button>
        </Box>

        {/* Lista de tratamientos con edición inline */}
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
          {tratamientos.filter(t => !filtroProcedimiento || t.procedimiento === filtroProcedimiento).map((t) => {
            const isEditing = inlineEdit?.id === t.id;
            return (
              <Paper
                key={t.id}
                elevation={isEditing ? 3 : 0}
                sx={{
                  p: isEditing ? 2 : 1.5,
                  borderRadius: 2.5,
                  border: isEditing ? `2px solid ${colorPrincipal}` : "1px solid rgba(163,105,32,0.15)",
                  backgroundColor: isEditing ? "#fffdf7" : "white",
                  transition: "all 0.2s ease",
                }}
              >
                {isEditing ? (
                  /* ─── Modo edición inline ─── */
                  <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
                    <TextField
                      label="Nombre *"
                      size="small"
                      value={inlineEdit.nombre}
                      onChange={(e) => setInlineEdit({ ...inlineEdit, nombre: e.target.value })}
                      fullWidth
                      autoFocus
                      sx={{ "& .MuiInputBase-root": { backgroundColor: "white" } }}
                    />
                    <TextField
                      label="Descripción"
                      size="small"
                      multiline
                      rows={2}
                      value={inlineEdit.descripcion}
                      onChange={(e) => setInlineEdit({ ...inlineEdit, descripcion: e.target.value })}
                      fullWidth
                      sx={{ "& .MuiInputBase-root": { backgroundColor: "white" } }}
                    />
                    <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                      <FormControl size="small" sx={{ flex: 1, minWidth: 150 }}>
                        <InputLabel>Procedimiento</InputLabel>
                        <Select
                          value={inlineEdit.procedimiento}
                          label="Procedimiento"
                          onChange={(e) => setInlineEdit({ ...inlineEdit, procedimiento: e.target.value })}
                          sx={{ backgroundColor: "white" }}
                        >
                          <MenuItem value=""><em>Sin asignar</em></MenuItem>
                          <MenuItem value="Cosmiatría Corporal">Cosmiatría Corporal</MenuItem>
                          <MenuItem value="Cosmiatría Facial">Cosmiatría Facial</MenuItem>
                          <MenuItem value="Armonización">Armonización</MenuItem>
                        </Select>
                      </FormControl>
                      <TextField
                        label="Precio (S/)"
                        type="number"
                        size="small"
                        value={inlineEdit.precio}
                        onChange={(e) => setInlineEdit({ ...inlineEdit, precio: e.target.value })}
                        inputProps={{ min: 0, step: 0.01 }}
                        sx={{ width: 120, "& .MuiInputBase-root": { backgroundColor: "white" } }}
                      />
                      <TextField
                        label="Sesiones"
                        type="number"
                        size="small"
                        value={inlineEdit.sesiones}
                        onChange={(e) => setInlineEdit({ ...inlineEdit, sesiones: e.target.value })}
                        inputProps={{ min: 1, step: 1 }}
                        sx={{ width: 90, "& .MuiInputBase-root": { backgroundColor: "white" } }}
                      />
                    </Box>
                    <Box sx={{ display: "flex", gap: 1, justifyContent: "flex-end" }}>
                      <Button
                        size="small"
                        variant="contained"
                        startIcon={<Check />}
                        onClick={guardarEdicionInline}
                        sx={{
                          backgroundColor: colorPrincipal,
                          "&:hover": { backgroundColor: "#8a5a1a" },
                          fontWeight: 700,
                          borderRadius: 2,
                          textTransform: "none",
                        }}
                      >
                        Guardar
                      </Button>
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={cancelarEdicionInline}
                        sx={{ borderColor: "#999", color: "#666", borderRadius: 2, textTransform: "none" }}
                      >
                        Cancelar
                      </Button>
                      <IconButton
                        size="small"
                        onClick={() => abrirConfigProductos(t)}
                        title="Productos"
                        sx={{ color: colorPrincipal }}
                      >
                        <Settings fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => eliminarTratamiento(t.id)}
                        title="Eliminar"
                        sx={{ color: "#d32f2f" }}
                      >
                        <Delete fontSize="small" />
                      </IconButton>
                    </Box>
                  </Box>
                ) : (
                  /* ─── Modo visualización ─── */
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.3 }}>
                        <Typography sx={{ fontWeight: 700, fontSize: "0.92rem", color: "#1a1a1a" }}>
                          {t.nombre}
                        </Typography>
                        {t.procedimiento && (
                          <Chip
                            label={t.procedimiento}
                            size="small"
                            sx={{
                              height: 20,
                              fontSize: "0.65rem",
                              fontWeight: 700,
                              backgroundColor: t.procedimiento === "Armonización" ? "rgba(163,105,32,0.12)" :
                                t.procedimiento === "Cosmiatría Facial" ? "rgba(76,175,80,0.12)" :
                                "rgba(33,150,243,0.12)",
                              color: t.procedimiento === "Armonización" ? "#a36920" :
                                t.procedimiento === "Cosmiatría Facial" ? "#2e7d32" :
                                "#1565c0",
                            }}
                          />
                        )}
                      </Box>
                      {t.descripcion && (
                        <Typography sx={{ fontSize: "0.78rem", color: "#888", lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {t.descripcion}
                        </Typography>
                      )}

                      {/* Productos configurados: se ven sin abrir nada */}
                      {(() => {
                        const productos = recetasPorTratamiento[t.id] || [];

                        if (productos.length === 0) {
                          return (
                            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mt: 0.6 }}>
                              <Inventory2 sx={{ fontSize: 13, color: "#c9b8a0" }} />
                              <Typography sx={{ fontSize: "0.7rem", color: "#b3a08c", fontStyle: "italic" }}>
                                Sin productos configurados
                              </Typography>
                            </Box>
                          );
                        }

                        // Se muestran 3 y el resto se resume, para no romper la fila
                        const visibles = productos.slice(0, 3);
                        const resto = productos.length - visibles.length;
                        const listaCompleta = productos
                          .map((p) => `${nombreProducto(p)} · ${p.cantidad_unidades} ${p.unidad_base || "u"}`)
                          .join("\n");

                        return (
                          <Box
                            sx={{ display: "flex", alignItems: "center", gap: 0.5, mt: 0.6, flexWrap: "wrap" }}
                            title={listaCompleta}
                          >
                            <Inventory2 sx={{ fontSize: 13, color: colorPrincipal, flexShrink: 0 }} />
                            {visibles.map((p) => (
                              <Chip
                                key={p.variante_id}
                                label={`${nombreProducto(p)}${p.cantidad_unidades ? ` · ${p.cantidad_unidades} ${p.unidad_base || "u"}` : ""}`}
                                size="small"
                                sx={{
                                  height: 19,
                                  fontSize: "0.65rem",
                                  fontWeight: 600,
                                  maxWidth: 210,
                                  backgroundColor: "rgba(163,105,32,0.08)",
                                  color: "#7a5216",
                                  border: "1px solid rgba(163,105,32,0.18)",
                                  "& .MuiChip-label": { px: 0.8 },
                                }}
                              />
                            ))}
                            {resto > 0 && (
                              <Typography sx={{ fontSize: "0.65rem", fontWeight: 700, color: "#a36920" }}>
                                +{resto} más
                              </Typography>
                            )}
                          </Box>
                        );
                      })()}
                    </Box>

                    {/* Precio + Sesiones */}
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexShrink: 0 }}>
                      <Box sx={{ textAlign: "right" }}>
                        <Typography sx={{ fontWeight: 800, fontSize: "0.88rem", color: "#1a1a1a" }}>
                          {t.precio != null && t.precio !== "" ? `S/ ${Number(t.precio).toFixed(2)}` : "—"}
                        </Typography>
                        <Typography sx={{ fontSize: "0.68rem", color: "#999" }}>
                          {t.sesiones && t.sesiones > 1 ? `${t.sesiones} sesiones` : "1 sesión"}
                        </Typography>
                      </Box>

                      {/* Acciones */}
                      {isDoctor ? (
                        <Box sx={{ display: "flex", gap: 0.3 }}>
                          <IconButton
                            size="small"
                            onClick={() => iniciarEdicionInline(t)}
                            title="Editar"
                            sx={{
                              color: colorPrincipal,
                              "&:hover": { backgroundColor: "rgba(163,105,32,0.08)" },
                            }}
                          >
                            <Edit fontSize="small" />
                          </IconButton>
                          <IconButton
                            size="small"
                            onClick={() => abrirConfigProductos(t)}
                            title="Productos"
                            sx={{
                              color: "#ba9a63",
                              "&:hover": { backgroundColor: "rgba(186,154,99,0.08)" },
                            }}
                          >
                            <Settings fontSize="small" />
                          </IconButton>
                          <IconButton
                            size="small"
                            onClick={() => eliminarTratamiento(t.id)}
                            title="Eliminar"
                            sx={{
                              color: "#ccc",
                              "&:hover": { color: "#d32f2f", backgroundColor: "rgba(211,47,47,0.06)" },
                            }}
                          >
                            <Delete fontSize="small" />
                          </IconButton>
                        </Box>
                      ) : (
                        <IconButton
                          size="small"
                          onClick={() => abrirConfigProductos(t)}
                          title="Ver productos"
                          sx={{ color: colorPrincipal }}
                        >
                          <Settings fontSize="small" />
                        </IconButton>
                      )}
                    </Box>
                  </Box>
                )}
              </Paper>
            );
          })}
        </Box>
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

          {/* Sección de imágenes del tratamiento */}
          <Divider sx={{ my: 2 }} />
          <Typography variant="subtitle2" sx={{ fontWeight: "bold", mb: 1, color: colorPrincipal }}>
            📸 Imágenes del tratamiento ({imagenesTratamiento.length}/6):
          </Typography>

          {imagenesTratamiento.length > 0 ? (
            <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap", mb: 2 }}>
              {imagenesTratamiento.map((img) => (
                <Box
                  key={img.id}
                  sx={{
                    position: "relative",
                    width: 110,
                    height: 110,
                    borderRadius: 2,
                    overflow: "hidden",
                    border: "2px solid rgba(163,105,32,0.2)",
                    "&:hover .delete-btn": { opacity: 1 },
                  }}
                >
                  <img
                    src={`${API_BASE_URL}${img.imagen_url}`}
                    alt="Tratamiento"
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                  {isDoctor && (
                    <IconButton
                      className="delete-btn"
                      size="small"
                      onClick={() => eliminarImagen(img.id)}
                      sx={{
                        position: "absolute",
                        top: 2,
                        right: 2,
                        backgroundColor: "rgba(211,47,47,0.85)",
                        color: "white",
                        opacity: 0,
                        transition: "opacity 0.2s",
                        "&:hover": { backgroundColor: "#d32f2f" },
                        padding: "2px",
                      }}
                    >
                      <Close sx={{ fontSize: 14 }} />
                    </IconButton>
                  )}
                </Box>
              ))}
            </Box>
          ) : (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2, fontStyle: "italic" }}>
              No hay imágenes. Sube fotos para mostrar en el historial del paciente.
            </Typography>
          )}

          {isDoctor && imagenesTratamiento.length < 6 && (
            <Button
              variant="outlined"
              component="label"
              startIcon={<PhotoCamera />}
              disabled={subiendoImagen}
              sx={{ borderColor: colorPrincipal, color: colorPrincipal, mb: 2 }}
            >
              {subiendoImagen ? "Subiendo..." : "Subir imágenes"}
              <input
                type="file"
                hidden
                multiple
                accept="image/*"
                onChange={subirImagenes}
              />
            </Button>
          )}

          {/* Mapa facial 3D por defecto */}
          <Divider sx={{ my: 2 }} />
          <Typography variant="subtitle2" sx={{ fontWeight: "bold", mb: 1, color: colorPrincipal }}>
            🎭 Mapa facial 3D del tratamiento:
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Marca los puntos que se aplican en este tratamiento. Aparecerán de forma
            predeterminada en el mapa facial 3D al crear un presupuesto.
          </Typography>
          <Button
            variant="outlined"
            startIcon={<Face />}
            onClick={() => abrirMapaFacial(tratamientoSeleccionado)}
            sx={{ borderColor: colorPrincipal, color: colorPrincipal, mb: 1 }}
          >
            {isDoctor ? "Configurar puntos del mapa facial" : "Ver puntos del mapa facial"}
          </Button>

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
                  label={`Cantidad (${varianteSeleccionada?.unidad_base || "ml"})`}
                  type="number"
                  value={cantidadProducto}
                  onChange={(e) => setCantidadProducto(parseFloat(e.target.value) || 1)}
                  sx={{ width: 120 }}
                  inputProps={{ min: (varianteSeleccionada?.unidad_base === "U" || varianteSeleccionada?.unidad_base === "frasco") ? 1 : 0.1, step: (varianteSeleccionada?.unidad_base === "U" || varianteSeleccionada?.unidad_base === "frasco") ? 1 : 0.1 }}
                  helperText={varianteSeleccionada?.unidad_base === "U" ? "Ej: 50 unidades" : varianteSeleccionada?.unidad_base === "frasco" ? "Ej: 1 frasco" : "Ej: 1 ml"}
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

      {/* Modal del mapa facial 3D por defecto del tratamiento */}
      <Dialog
        open={modalMapa}
        onClose={() => setModalMapa(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ backgroundColor: colorPrincipal, color: "white" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Face />
            <span>Mapa facial 3D - {tratamientoSeleccionado?.nombre}</span>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            {isDoctor
              ? "Haz clic sobre el rostro para marcar los puntos del tratamiento. Usa la herramienta de borrar para quitarlos."
              : "Visualización de los puntos predeterminados de este tratamiento."}
          </Typography>
          <FacialMapMini
            points={puntosMapa}
            onChange={setPuntosMapa}
            editable={isDoctor}
            color={colorPrincipal}
            height={420}
          />
          <Typography variant="caption" sx={{ display: "block", mt: 1, color: "#888" }}>
            {Object.keys(puntosMapa || {}).length} punto(s) marcado(s)
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setModalMapa(false)} sx={{ color: "#666" }}>
            Cerrar
          </Button>
          {isDoctor && (
            <Button
              variant="contained"
              onClick={guardarMapaFacial}
              disabled={guardandoMapa}
              sx={{ backgroundColor: colorPrincipal, "&:hover": { backgroundColor: "#8a5a1a" }, fontWeight: 700 }}
            >
              {guardandoMapa ? "Guardando..." : "Guardar mapa"}
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
}
