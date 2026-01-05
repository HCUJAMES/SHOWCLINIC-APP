import React, { useEffect, useState } from "react";
import {
  Container,
  Typography,
  TextField,
  Button,
  Grid,
  MenuItem,
  Paper,
  Select,
  FormControl,
  Divider,
  Box,
  Autocomplete,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItemButton,
  ListItemText,
} from "@mui/material";
import { ArrowBack, Receipt, Home } from "@mui/icons-material";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { useToast } from "../../components/ToastProvider";

const API_BASE_URL =
  process.env.REACT_APP_API_URL || `http://${window.location.hostname}:4000`;

const ComenzarTratamiento = () => {
  const navigate = useNavigate();
  const colorPrincipal = "#a36920";
  const { showToast } = useToast();
  const token = localStorage.getItem("token");
  const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};
  const [pacientes, setPacientes] = useState([]);
  const [tratamientos, setTratamientos] = useState([]);
  const [variantesInv, setVariantesInv] = useState([]);
  const [especialistas, setEspecialistas] = useState([]);
  const [recetasPorTratamiento, setRecetasPorTratamiento] = useState({});

  // Estado para presupuestos/ofertas del paciente
  const [ofertasPaciente, setOfertasPaciente] = useState([]);
  const [paquetesPaciente, setPaquetesPaciente] = useState([]);
  const [openOfertasModal, setOpenOfertasModal] = useState(false);
  const [presupuestoAplicado, setPresupuestoAplicado] = useState(false);
  const [paqueteAplicado, setPaqueteAplicado] = useState(null);

  const [tipoAtencion, setTipoAtencion] = useState("Tratamiento");
  const [paciente_id, setPaciente_id] = useState("");
  const [especialista, setEspecialista] = useState("");
  const [pagoMetodo, setPagoMetodo] = useState("Efectivo");
  const [sesion, setSesion] = useState(1);
  const [bloques, setBloques] = useState([
    {
      tratamiento_id: "",
      producto: "",
      variante_id: "",
      marca: "",
      cantidad: 1,
      dosis_unidades: "",
      precio: 0,
      descuento: 0,
      total: 0,
      pago_en_partes: false,
      monto_adelanto: "",
    },
  ]);

  const [totalGeneral, setTotalGeneral] = useState(0);

  // Cargar datos iniciales
  useEffect(() => {
    axios
      .get(`${API_BASE_URL}/api/pacientes/listar`, { headers: authHeaders })
      .then((res) => setPacientes(res.data));
    axios
      .get(`${API_BASE_URL}/api/tratamientos/listar`, { headers: authHeaders })
      .then((res) => setTratamientos(res.data));
    axios
      .get(`${API_BASE_URL}/api/inventario/variantes`, { headers: authHeaders })
      .then((res) => setVariantesInv(Array.isArray(res.data) ? res.data : []))
      .catch(() => setVariantesInv([]));
    axios
      .get(`${API_BASE_URL}/api/especialistas/listar`, { headers: authHeaders })
      .then((res) => setEspecialistas(res.data));
  }, []);

  // Calcular total general
  useEffect(() => {
    const total = bloques.reduce((sum, b) => sum + b.total, 0);
    setTotalGeneral(total);
  }, [bloques]);

  // Recalcular totales cuando cambian los bloques
  useEffect(() => {
    setBloques((prev) =>
      (prev || []).map((b) => {
        const precio = parseFloat(b?.precio) || 0;
        const cantidad = parseFloat(b?.cantidad) || 1;
        const descuento = parseFloat(b?.descuento) || 0;

        const subtotal = precio * cantidad;
        const totalConDescuento = subtotal - subtotal * (descuento / 100);

        return { ...b, total: totalConDescuento };
      })
    );
  }, [recetasPorTratamiento]);

  // Actualizar bloque de tratamiento
  const actualizarBloque = (index, campo, valor) => {
    const nuevosBloques = [...bloques];
    nuevosBloques[index][campo] = valor;

    if (campo === "pago_en_partes" && !valor) {
      nuevosBloques[index].monto_adelanto = "";
    }

    if (campo === "tratamiento_id") {
      const tratamientoId = valor;
      if (tratamientoId && !recetasPorTratamiento[tratamientoId]) {
        axios
          .get(`${API_BASE_URL}/api/tratamientos/recetas/${tratamientoId}`, { headers: authHeaders })
          .then((res) => {
            setRecetasPorTratamiento((prev) => ({
              ...prev,
              [tratamientoId]: Array.isArray(res.data) ? res.data : [],
            }));
          })
          .catch(() => {
            setRecetasPorTratamiento((prev) => ({ ...prev, [tratamientoId]: [] }));
          });
      }

      // Si el tratamiento tiene receta, por defecto la dosis queda vacía para que el doctor la indique
      // y la cantidad (venta) se mantiene para no romper precios.
    }

    if (campo === "variante_id") {
      const v = valor
        ? variantesInv.find((x) => String(x.id) === String(valor))
        : null;
      
      // Solo actualizar el precio si NO hay un precio manual ya establecido (presupuesto)
      const precioActual = parseFloat(nuevosBloques[index].precio) || 0;
      const tienePresupuesto = presupuestoAplicado && precioActual > 0;
      
      if (!tienePresupuesto) {
        // Usar precio_cliente (precio de venta al paciente) si existe, sino precio_unitario
        if (v && (v.precio_cliente != null || v.precio_unitario != null)) {
          nuevosBloques[index].precio = Number(v.precio_cliente) || Number(v.precio_unitario) || 0;
        } else {
          nuevosBloques[index].precio = 0;
        }
      }
    }

    const precio = parseFloat(nuevosBloques[index].precio) || 0;
    const cantidad = parseFloat(nuevosBloques[index].cantidad) || 1;
    const descuento = parseFloat(nuevosBloques[index].descuento) || 0;

    // Calcular subtotal: precio * cantidad (ml)
    const subtotal = precio * cantidad;

    const totalConDescuento = subtotal - subtotal * (descuento / 100);

    nuevosBloques[index].total = totalConDescuento;

    setBloques(nuevosBloques);
  };

  // Agregar nuevo tratamiento
  const agregarBloque = () => {
    setBloques([
      ...bloques,
      {
        tratamiento_id: "",
        producto: "",
        variante_id: "",
        marca: "",
        cantidad: 1,
        dosis_unidades: "",
        precio: 0,
        descuento: 0,
        total: 0,
        pago_en_partes: false,
        monto_adelanto: "",
      },
    ]);
  };

  const quitarBloque = (index) => {
    setBloques((prev) => prev.filter((_, i) => i !== index));
  };

  // Cargar ofertas/presupuestos del paciente seleccionado
  const cargarOfertasPaciente = async (idPaciente) => {
    if (!idPaciente) {
      setOfertasPaciente([]);
      setPaquetesPaciente([]);
      return;
    }
    try {
      const res = await axios.get(`${API_BASE_URL}/api/pacientes/${idPaciente}/ofertas`, {
        headers: authHeaders,
      });
      setOfertasPaciente(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Error al cargar ofertas:", err);
      setOfertasPaciente([]);
    }
    
    // Cargar paquetes del paciente
    try {
      const resPaquetes = await axios.get(`${API_BASE_URL}/api/paquetes/paciente/${idPaciente}`, {
        headers: authHeaders,
      });
      // Solo mostrar paquetes activos (no completados ni cancelados)
      const paquetesActivos = (Array.isArray(resPaquetes.data) ? resPaquetes.data : [])
        .filter(p => p.estado === 'activo');
      setPaquetesPaciente(paquetesActivos);
    } catch (err) {
      console.error("Error al cargar paquetes:", err);
      setPaquetesPaciente([]);
    }
  };

  // Abrir modal de presupuestos
  const abrirPresupuestos = () => {
    if (!paciente_id) {
      showToast({ severity: "warning", message: "Primero selecciona un paciente" });
      return;
    }
    cargarOfertasPaciente(paciente_id);
    setOpenOfertasModal(true);
  };

  // Aplicar oferta seleccionada al primer bloque
  const aplicarOferta = (oferta) => {
    if (!oferta?.items || oferta.items.length === 0) {
      showToast({ severity: "warning", message: "Esta oferta no tiene items" });
      return;
    }

    // Crear bloques a partir de los items de la oferta
    const nuevosBloques = oferta.items.map((item) => {
      // El item tiene: tratamientoId, nombre, precio
      const nombreTratamiento = String(item.nombre || item.tratamiento || "").trim().toLowerCase();
      const tratamientoIdGuardado = item.tratamientoId;
      
      // Primero intentar buscar por ID si existe
      let tratamientoEncontrado = null;
      if (tratamientoIdGuardado) {
        tratamientoEncontrado = tratamientos.find(
          (t) => t.id === tratamientoIdGuardado || String(t.id) === String(tratamientoIdGuardado)
        );
      }
      
      // Si no encuentra por ID, buscar por nombre (exacto)
      if (!tratamientoEncontrado && nombreTratamiento) {
        tratamientoEncontrado = tratamientos.find(
          (t) => String(t.nombre || "").trim().toLowerCase() === nombreTratamiento
        );
      }
      
      // Si no encuentra exacto, buscar que contenga el nombre
      if (!tratamientoEncontrado && nombreTratamiento) {
        tratamientoEncontrado = tratamientos.find(
          (t) => String(t.nombre || "").trim().toLowerCase().includes(nombreTratamiento) ||
                 nombreTratamiento.includes(String(t.nombre || "").trim().toLowerCase())
        );
      }

      return {
        tratamiento_id: tratamientoEncontrado?.id || "",
        producto: "",
        variante_id: "",
        marca: "",
        cantidad: 1,
        dosis_unidades: "",
        precio: Number(item.precio) || 0,
        descuento: 0,
        total: Number(item.precio) || 0,
        pago_en_partes: false,
        monto_adelanto: "",
      };
    });

    setBloques(nuevosBloques);
    setPresupuestoAplicado(true);
    setOpenOfertasModal(false);
    
    // Verificar si todos los tratamientos fueron encontrados
    const noEncontrados = nuevosBloques.filter(b => !b.tratamiento_id);
    if (noEncontrados.length > 0) {
      showToast({ 
        severity: "warning", 
        message: `Presupuesto aplicado. ${noEncontrados.length} tratamiento(s) no encontrado(s) en el sistema, selecciónalos manualmente.` 
      });
    } else {
      showToast({ severity: "success", message: "Presupuesto aplicado correctamente" });
    }
  };

  // Aplicar paquete del paciente - cada sesión pendiente como bloque individual
  const aplicarPaquete = (paquete) => {
    if (!paquete?.sesiones || paquete.sesiones.length === 0) {
      showToast({ severity: "warning", message: "Este paquete no tiene sesiones pendientes" });
      return;
    }

    // Filtrar solo sesiones pendientes
    const sesionesPendientes = paquete.sesiones.filter(s => s.estado === 'pendiente');
    
    if (sesionesPendientes.length === 0) {
      showToast({ severity: "warning", message: "No hay sesiones pendientes en este paquete" });
      return;
    }

    // Crear un bloque por CADA sesión pendiente
    const nuevosBloques = sesionesPendientes.map((sesion) => {
      const tratamientoEncontrado = tratamientos.find(
        (t) => t.id === sesion.tratamiento_id || String(t.id) === String(sesion.tratamiento_id)
      );

      return {
        tratamiento_id: tratamientoEncontrado?.id || sesion.tratamiento_id,
        producto: "",
        variante_id: "",
        marca: "",
        cantidad: 1,
        dosis_unidades: "",
        precio: Number(sesion.precio_sesion) || 0,
        descuento: 0,
        total: Number(sesion.precio_sesion) || 0,
        pago_en_partes: false,
        monto_adelanto: "",
        sesion_paquete_id: sesion.id, // Guardar referencia a la sesión del paquete
      };
    });

    setBloques(nuevosBloques);
    setPresupuestoAplicado(true);
    setPaqueteAplicado(paquete);
    setOpenOfertasModal(false);
    
    showToast({ 
      severity: "success", 
      message: `Paquete "${paquete.paquete_nombre}" aplicado - ${sesionesPendientes.length} sesión(es)` 
    });
  };

  // Cancelar/limpiar presupuesto aplicado
  const cancelarPresupuesto = () => {
    setBloques([
      {
        tratamiento_id: "",
        producto: "",
        variante_id: "",
        marca: "",
        cantidad: 1,
        dosis_unidades: "",
        precio: 0,
        descuento: 0,
        total: 0,
        pago_en_partes: false,
        monto_adelanto: "",
      },
    ]);
    setPresupuestoAplicado(false);
    setPaqueteAplicado(null);
    showToast({ severity: "info", message: "Presupuesto cancelado" });
  };

  // Guardar tratamiento
  const handleSubmit = async (e) => {
    e.preventDefault();

    const bloquesValidos = (bloques || []).filter((b) => {
      const id = b?.tratamiento_id;
      return id != null && String(id).trim() !== "";
    });

    if (bloquesValidos.length === 0) {
      showToast({ severity: "warning", message: "Agrega al menos un tratamiento antes de guardar" });
      return;
    }

    // Validar que cada bloque tenga al menos un precio establecido (excepto si viene de un paquete)
    const bloqueSinPrecio = (bloquesValidos || []).find((b) => {
      // Si viene de un paquete, no validar precio (ya fue pagado)
      if (b.sesion_paquete_id) return false;
      
      const tienePrecio = parseFloat(b?.precio) > 0;
      const tieneTotal = parseFloat(b?.total) > 0;
      
      // Si tiene precio o total, está OK
      return !tienePrecio && !tieneTotal;
    });

    if (bloqueSinPrecio) {
      showToast({
        severity: "warning",
        message: "Establece un precio para cada tratamiento antes de guardar",
      });
      return;
    }

    const data = new FormData();
    data.append("tipoAtencion", tipoAtencion);
    data.append("paciente_id", paciente_id);
    data.append("especialista", especialista);
    data.append("pagoMetodo", pagoMetodo);
    data.append("sesion", sesion);
    data.append("productos", JSON.stringify(bloquesValidos));

    try {
      const res = await axios.post(`${API_BASE_URL}/api/tratamientos/realizado`, data, {
        headers: authHeaders,
      });
      showToast({ severity: "success", message: res.data.message || "Tratamiento registrado correctamente" });
      
      // Si hay sesiones de paquete, marcarlas como completadas
      const sesionesConPaquete = bloquesValidos.filter(b => b.sesion_paquete_id);
      if (sesionesConPaquete.length > 0) {
        for (const bloque of sesionesConPaquete) {
          try {
            await axios.patch(
              `${API_BASE_URL}/api/paquetes/sesion/${bloque.sesion_paquete_id}/completar`,
              { especialista },
              { headers: authHeaders }
            );
          } catch (errPaquete) {
            console.error("Error al completar sesión del paquete:", errPaquete);
          }
        }
        showToast({ severity: "info", message: `${sesionesConPaquete.length} sesión(es) del paquete marcadas como completadas` });
      }
      
      // Limpiar formulario
      setPaciente_id("");
      setEspecialista("");
      setPagoMetodo("Efectivo");
      setSesion(1);
      setBloques([
        {
          tratamiento_id: "",
          producto: "",
          variante_id: "",
          marca: "",
          cantidad: 1,
          dosis_unidades: "",
          precio: 0,
          descuento: 0,
          total: 0,
          pago_en_partes: false,
          monto_adelanto: "",
        },
      ]);
      setTotalGeneral(0);
      setPresupuestoAplicado(false);
      setPaqueteAplicado(null);
    } catch (err) {
      console.error(err);
      const status = err?.response?.status;
      const msg = err?.response?.data?.message;
      showToast({
        severity: "error",
        message: msg ? `Error al registrar tratamiento${status ? ` (${status})` : ""}: ${msg}` : "Error al registrar tratamiento",
      });
    }
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        px: 2,
        py: { xs: 5, sm: 7 },
        backgroundImage:
          "radial-gradient(circle at top, rgba(255,255,255,0.92), rgba(247,234,193,0.62), rgba(0,0,0,0.05)), url('/images/background-showclinic.jpg')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        position: "relative",
        "&::before": {
          content: '""',
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(135deg, rgba(255,255,255,0.50), rgba(250,240,210,0.35))",
          pointerEvents: "none",
        },
        "& > *": { position: "relative", zIndex: 1 },
      }}
    >
      <Container maxWidth="xl">
        <Paper
          elevation={6}
          sx={{
            p: { xs: 3, sm: 5 },
            backgroundColor: "rgba(255,255,255,0.82)",
            borderRadius: 5,
            border: "1px solid rgba(212,175,55,0.20)",
            backdropFilter: "blur(10px)",
            boxShadow: "0 18px 48px rgba(0,0,0,0.14)",
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
            <IconButton onClick={() => navigate("/tratamientos")} sx={{ color: colorPrincipal }}>
              <ArrowBack />
            </IconButton>
            <Typography
              variant="h5"
              sx={{ color: colorPrincipal, fontWeight: 800, flex: 1, textAlign: "center", letterSpacing: 0.2 }}
            >
              Nueva Sesión
            </Typography>
            <IconButton onClick={() => navigate("/dashboard")} sx={{ color: colorPrincipal }} title="Inicio">
              <Home />
            </IconButton>
          </Box>

          <Typography
            variant="body2"
            align="center"
            sx={{ color: "rgba(46,46,46,0.75)", mb: 4 }}
          >
            Registra la sesión y el detalle de la venta
          </Typography>

          <form onSubmit={handleSubmit}>
            <Grid container spacing={4}>
              {/* Tipo de atención */}
              <Grid item xs={12} sm={12} md={3}>
                <FormControl fullWidth>
                  <Select
                    value={tipoAtencion}
                    onChange={(e) => setTipoAtencion(e.target.value)}
                    inputProps={{ "aria-label": "Tipo de Atención" }}
                    sx={{
                      minHeight: "56px",
                      backgroundColor: "rgba(255,255,255,0.95)",
                      borderRadius: 3,
                    }}
                  >
                    <MenuItem value="Tratamiento">Tratamiento</MenuItem>
                    <MenuItem value="Control">Control</MenuItem>
                    <MenuItem value="Retoque">Retoque</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              {/* Paciente */}
              <Grid item xs={12} sm={12} md={5} sx={{ minWidth: 220 }}>
                <FormControl fullWidth>
                  <Autocomplete
                    fullWidth
                    options={pacientes}
                    value={pacientes.find((p) => p.id === paciente_id) || null}
                    onChange={(_, newValue) => setPaciente_id(newValue?.id || "")}
                    getOptionLabel={(option) =>
                      `${option?.nombre || ""} ${option?.apellido || ""}`.trim() || "-"
                    }
                    isOptionEqualToValue={(option, value) => option?.id === value?.id}
                    filterOptions={(options, state) => {
                      const input = String(state.inputValue || "").trim().toLowerCase();
                      if (!input) return options;
                      return options.filter((p) => {
                        const nombre = String(p?.nombre || "").toLowerCase();
                        const apellido = String(p?.apellido || "").toLowerCase();
                        const dni = String(p?.dni || "").toLowerCase();
                        return (
                          nombre.includes(input) ||
                          apellido.includes(input) ||
                          `${nombre} ${apellido}`.includes(input) ||
                          dni.includes(input)
                        );
                      });
                    }}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Seleccionar paciente"
                        placeholder="Buscar por nombre o DNI"
                        fullWidth
                        sx={{
                          "& .MuiInputBase-root": {
                            minHeight: "56px",
                            backgroundColor: "rgba(255,255,255,0.95)",
                            borderRadius: 3,
                          },
                          "& .MuiInputBase-input": {
                            textOverflow: "clip",
                          },
                        }}
                      />
                    )}
                  />
                </FormControl>
              </Grid>

              {/* Botón Presupuesto Inicial */}
              <Grid item xs={12} sm={6} md={2}>
                <Box sx={{ display: "flex", gap: 1 }}>
                  <Button
                    fullWidth
                    variant="outlined"
                    startIcon={<Receipt />}
                    onClick={abrirPresupuestos}
                    sx={{
                      minHeight: "56px",
                      borderColor: colorPrincipal,
                      color: colorPrincipal,
                      fontWeight: 700,
                      borderRadius: 3,
                      backgroundColor: "rgba(255,255,255,0.95)",
                      "&:hover": {
                        borderColor: "#8a541a",
                        backgroundColor: "rgba(163,105,32,0.08)",
                      },
                    }}
                  >
                    Presupuesto
                  </Button>
                  {presupuestoAplicado && (
                    <Button
                      variant="outlined"
                      color="error"
                      onClick={cancelarPresupuesto}
                      sx={{
                        minHeight: "56px",
                        minWidth: "56px",
                        borderRadius: 3,
                        fontWeight: 700,
                      }}
                    >
                      ✕
                    </Button>
                  )}
                </Box>
              </Grid>

              {/* BLOQUES DE TRATAMIENTO */}
              {bloques.map((b, index) => (
                <Grid item xs={12} key={index}>
                  <Paper
                    elevation={3}
                    sx={{
                      p: { xs: 2.5, sm: 3.5 },
                      borderRadius: 4,
                      backgroundColor: "rgba(255,255,255,0.90)",
                      border: "1px solid rgba(212,175,55,0.18)",
                      boxShadow: "0 12px 28px rgba(0,0,0,0.08)",
                      mb: 2.5,
                      position: "relative",
                      overflow: "hidden",
                      "&::before": {
                        content: '""',
                        position: "absolute",
                        inset: 0,
                        background:
                          "radial-gradient(circle at top, rgba(212,175,55,0.14), transparent 55%)",
                        pointerEvents: "none",
                      },
                      "& > *": { position: "relative", zIndex: 1 },
                    }}
                  >
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 2,
                        mb: 2.5,
                      }}
                    >
                      <Typography
                        variant="subtitle1"
                        sx={{ color: colorPrincipal, fontWeight: 800 }}
                      >
                        Tratamiento #{index + 1}
                      </Typography>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                        {bloques.length > 1 && (
                          <Button
                            variant="outlined"
                            color="inherit"
                            onClick={() => quitarBloque(index)}
                            sx={{
                              borderRadius: 999,
                              textTransform: "none",
                              fontWeight: 800,
                              px: 2,
                              borderColor: "rgba(163,105,32,0.35)",
                              color: colorPrincipal,
                              backgroundColor: "rgba(255,255,255,0.75)",
                              "&:hover": {
                                borderColor: "rgba(163,105,32,0.55)",
                                backgroundColor: "rgba(255,255,255,0.92)",
                              },
                            }}
                          >
                            Quitar
                          </Button>
                        )}
                        <Box
                          sx={{
                            px: 1.5,
                            py: 0.8,
                            borderRadius: 999,
                            backgroundColor: "rgba(255,246,234,0.95)",
                            border: "1px solid rgba(224,195,155,0.9)",
                          }}
                        >
                          <Typography
                            sx={{ color: colorPrincipal, fontWeight: 800, fontSize: 13 }}
                          >
                            Total: S/ {b.total.toFixed(2)}
                          </Typography>
                        </Box>
                      </Box>
                    </Box>

                    <Typography
                      variant="body2"
                      sx={{ color: "rgba(46,46,46,0.70)", mb: 2.5 }}
                    >
                      Completa los campos para registrar el detalle de la venta.
                    </Typography>

                    <Grid container spacing={2.2}>
                      <Grid item xs={12} sm={6} md sx={{ flexGrow: 1, minWidth: 260 }}>
                        <FormControl fullWidth>
                          <Select
                            value={b.tratamiento_id}
                            onChange={(e) => actualizarBloque(index, "tratamiento_id", e.target.value)}
                            displayEmpty
                            inputProps={{ "aria-label": `Tratamiento ${index + 1}` }}
                            renderValue={(selected) => {
                              if (selected) {
                                const t = tratamientos.find((x) => x.id === selected);
                                if (t) return t.nombre;
                                return String(selected);
                              }
                              return (
                                <Box component="span" sx={{ color: "rgba(46,46,46,0.55)" }}>
                                  Selecciona tratamiento
                                </Box>
                              );
                            }}
                            sx={{
                              minHeight: "56px",
                              backgroundColor: "rgba(255,255,255,0.95)",
                              borderRadius: 3,
                            }}
                          >
                            {tratamientos.map((t) => (
                              <MenuItem key={t.id} value={t.id}>
                                {t.nombre}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      </Grid>

                      {/* Mostrar productos configurados para el tratamiento */}
                      {(() => {
                        const receta = b.tratamiento_id ? recetasPorTratamiento[b.tratamiento_id] || [] : [];
                        if (!receta || receta.length === 0) return null;
                        return (
                          <Grid item xs={12}>
                            <Typography variant="body2" sx={{ color: "#666", fontStyle: "italic", mb: -1 }}>
                              Productos disponibles: {receta.map(r => `${r.producto_base_nombre || ""} ${r.variante_nombre || ""}`).join(", ")}
                            </Typography>
                          </Grid>
                        );
                      })()}

                      <Grid item xs={12} sm={6} md sx={{ flexGrow: 1, minWidth: 260 }}>
                        {(() => {
                          // Filtrar productos según la receta del tratamiento
                          const receta = b.tratamiento_id ? recetasPorTratamiento[b.tratamiento_id] || [] : [];
                          const tieneReceta = Array.isArray(receta) && receta.length > 0;
                          
                          // Si hay receta, solo mostrar los productos de la receta
                          // Si no hay receta, mostrar todos los productos
                          const opcionesProductos = tieneReceta
                            ? variantesInv.filter(v => receta.some(r => String(r.variante_id) === String(v.id)))
                            : variantesInv;

                          return (
                            <Autocomplete
                              fullWidth
                              options={opcionesProductos}
                              value={
                                b.variante_id
                                  ? variantesInv.find((v) => String(v.id) === String(b.variante_id)) || null
                                  : null
                              }
                              getOptionLabel={(opt) => {
                                if (!opt) return "";
                                const marca = opt.producto_base_nombre || "";
                                const nombre = opt.nombre || "";
                                const precio = opt.precio_cliente ? ` - S/ ${Number(opt.precio_cliente).toFixed(2)}` : "";
                                return `${marca} - ${nombre}${precio}`.trim();
                              }}
                              isOptionEqualToValue={(opt, val) => String(opt.id) === String(val.id)}
                              onChange={(_, val) => {
                                actualizarBloque(index, "variante_id", val ? val.id : "");
                                actualizarBloque(
                                  index,
                                  "producto",
                                  val
                                    ? `${val.producto_base_nombre || ""} - ${val.nombre || ""}`.trim()
                                    : ""
                                );
                              }}
                              renderInput={(params) => (
                                <TextField
                                  {...params}
                                  label={tieneReceta ? "Producto (filtrado)" : "Producto"}
                                  placeholder={tieneReceta ? "Productos configurados para este tratamiento" : "Seleccionar producto"}
                                  fullWidth
                                  helperText={tieneReceta ? `${opcionesProductos.length} producto(s) disponible(s)` : ""}
                                  sx={{
                                    "& .MuiInputBase-root": {
                                      backgroundColor: "rgba(255,255,255,0.95)",
                                      borderRadius: 3,
                                      minHeight: "56px",
                                    },
                                    "& .MuiInputBase-input": {
                                      textOverflow: "clip",
                                    },
                                  }}
                                />
                              )}
                            />
                          );
                        })()}
                      </Grid>

                      <Grid item xs={12} sm="auto" md="auto">
                        <TextField
                          label="Cantidad (ml)"
                          type="number"
                          value={b.cantidad}
                          onChange={(e) => actualizarBloque(index, "cantidad", e.target.value)}
                          inputProps={{ min: 0.1, step: 0.1 }}
                          sx={{
                            "& .MuiInputBase-root": {
                              backgroundColor: "rgba(255,255,255,0.95)",
                              borderRadius: 3,
                              minHeight: "56px",
                            },
                            width: { xs: "100%", sm: 160 },
                          }}
                          helperText="ml a descontar del inventario"
                        />
                      </Grid>

                      <Grid item xs={12} sm={6} md={4}>
                        <TextField
                          label="Precio Unitario (S/)"
                          type="number"
                          value={b.precio}
                          onChange={(e) => actualizarBloque(index, "precio", parseFloat(e.target.value) || 0)}
                          fullWidth
                          sx={{
                            "& .MuiInputBase-root": {
                              borderRadius: 3,
                              backgroundColor: "rgba(255,255,255,0.95)",
                              minHeight: "56px",
                            },
                          }}
                        />
                      </Grid>

                      <Grid item xs={12} sm={6} md={4}>
                        <FormControl fullWidth>
                          <Select
                            value={b.pago_en_partes ? "SI" : "NO"}
                            onChange={(e) =>
                              actualizarBloque(index, "pago_en_partes", e.target.value === "SI")
                            }
                            inputProps={{ "aria-label": "Pago en partes" }}
                            sx={{
                              minHeight: "56px",
                              backgroundColor: "rgba(255,255,255,0.95)",
                              borderRadius: 3,
                            }}
                          >
                            <MenuItem value="NO">Pago completo</MenuItem>
                            <MenuItem value="SI">Pago en partes</MenuItem>
                          </Select>
                        </FormControl>
                      </Grid>

                      {b.pago_en_partes && (
                        <Grid item xs={12} sm={6} md={4}>
                          <TextField
                            label="Adelanto (S/)"
                            type="number"
                            fullWidth
                            value={b.monto_adelanto}
                            onChange={(e) => actualizarBloque(index, "monto_adelanto", e.target.value)}
                            sx={{
                              "& .MuiInputBase-root": {
                                borderRadius: 3,
                                backgroundColor: "rgba(255,255,255,0.95)",
                                minHeight: "56px",
                              },
                            }}
                            helperText="Se registrará como deuda pendiente."
                          />
                        </Grid>
                      )}

                      <Grid item xs={12} sm={6} md={4}>
                        <TextField
                          label="Descuento (%)"
                          type="number"
                          fullWidth
                          value={b.descuento}
                          onChange={(e) => actualizarBloque(index, "descuento", parseFloat(e.target.value))}
                          sx={{
                            "& .MuiInputBase-root": {
                              borderRadius: 3,
                              backgroundColor: "rgba(255,255,255,0.95)",
                            },
                          }}
                        />
                      </Grid>
                    </Grid>
                  </Paper>
                </Grid>
              ))}

              {/* Botón agregar tratamiento */}
              <Grid item xs={12}>
                <Button
                  variant="outlined"
                  fullWidth
                  onClick={agregarBloque}
                  sx={{
                    borderColor: colorPrincipal,
                    color: colorPrincipal,
                    fontWeight: "bold",
                    py: 1.3,
                    borderRadius: 999,
                    backgroundColor: "rgba(255,255,255,0.65)",
                    "&:hover": { backgroundColor: "rgba(246,227,197,0.75)" },
                  }}
                >
                  + Agregar otro tratamiento
                </Button>
              </Grid>

              <Divider sx={{ width: "100%", my: 4 }} />

              {/* Datos finales */}
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Número de Sesión"
                  type="number"
                  fullWidth
                  value={sesion}
                  onChange={(e) => setSesion(e.target.value)}
                  sx={{
                    "& .MuiInputBase-root": {
                      borderRadius: 3,
                      backgroundColor: "rgba(255,255,255,0.95)",
                    },
                  }}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <Select
                    value={especialista}
                    onChange={(e) => setEspecialista(e.target.value)}
                    displayEmpty
                    inputProps={{ "aria-label": "Especialista" }}
                    renderValue={(selected) => {
                      if (selected) return selected;
                      return (
                        <Box component="span" sx={{ color: "rgba(46,46,46,0.55)" }}>
                          Selecciona especialista
                        </Box>
                      );
                    }}
                    sx={{ backgroundColor: "rgba(255,255,255,0.95)", borderRadius: 3 }}
                  >
                    {especialistas.map((esp) => (
                      <MenuItem key={esp.id} value={esp.nombre}>
                        {esp.nombre}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12}>
                <FormControl fullWidth>
                  <Select
                    value={pagoMetodo}
                    onChange={(e) => setPagoMetodo(e.target.value)}
                    inputProps={{ "aria-label": "Método de Pago" }}
                    sx={{
                      minHeight: "56px",
                      backgroundColor: "rgba(255,255,255,0.95)",
                      borderRadius: 3,
                    }}
                  >
                    <MenuItem value="Efectivo">Efectivo</MenuItem>
                    <MenuItem value="Tarjeta">Tarjeta</MenuItem>
                    <MenuItem value="Transferencia">Transferencia</MenuItem>
                    <MenuItem value="Yape">Yape</MenuItem>
                    <MenuItem value="Plin">Plin</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              {/* Total general */}
              <Grid item xs={12}>
                <Box
                  sx={{
                    mt: 2,
                    mb: 2,
                    p: 2,
                    borderRadius: 4,
                    border: "1px solid rgba(224,195,155,0.9)",
                    background:
                      "linear-gradient(90deg, rgba(255,246,234,0.92), rgba(255,255,255,0.85))",
                    boxShadow: "0 10px 22px rgba(0,0,0,0.06)",
                    textAlign: "center",
                  }}
                >
                  <Typography
                    variant="overline"
                    sx={{ color: "rgba(46,46,46,0.72)", letterSpacing: 1.2 }}
                  >
                    Total general
                  </Typography>
                  <Typography
                    variant="h5"
                    sx={{ color: colorPrincipal, fontWeight: 900, mt: 0.2 }}
                  >
                    S/ {totalGeneral.toFixed(2)}
                  </Typography>
                </Box>
              </Grid>

              {/* Guardar */}
              <Grid item xs={12}>
                <Button
                  type="submit"
                  fullWidth
                  variant="contained"
                  sx={{
                    backgroundColor: colorPrincipal,
                    fontSize: "1.1rem",
                    fontWeight: "bold",
                    py: 1.6,
                    borderRadius: 999,
                    boxShadow: "0 14px 28px rgba(163,105,32,0.26)",
                    "&:hover": { backgroundColor: "#8b581b" },
                  }}
                >
                  GUARDAR SESIÓN
                </Button>
              </Grid>
            </Grid>
          </form>
        </Paper>
      </Container>

      {/* Modal de Presupuestos Iniciales */}
      <Dialog
        open={openOfertasModal}
        onClose={() => setOpenOfertasModal(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 4,
            background: "linear-gradient(180deg, rgba(255,249,236,0.98) 0%, rgba(255,255,255,0.95) 100%)",
          },
        }}
      >
        <DialogTitle sx={{ color: colorPrincipal, fontWeight: 800 }}>
          Presupuestos y Paquetes
        </DialogTitle>
        <DialogContent dividers>
          {/* Sección de Paquetes Contratados */}
          {paquetesPaciente.length > 0 && (
            <Box sx={{ mb: 3 }}>
              <Typography sx={{ fontWeight: 700, color: "#1565c0", mb: 1.5, display: "flex", alignItems: "center", gap: 1 }}>
                📦 Paquetes Contratados (En Curso)
              </Typography>
              <List sx={{ pt: 0 }}>
                {paquetesPaciente.map((paquete) => {
                  const sesionesPendientes = (paquete.sesiones || []).filter(s => s.estado === 'pendiente');
                  return (
                    <ListItemButton
                      key={paquete.id}
                      onClick={() => aplicarPaquete(paquete)}
                      sx={{
                        borderRadius: 2,
                        mb: 1,
                        border: "2px solid rgba(33, 150, 243, 0.4)",
                        backgroundColor: "rgba(33, 150, 243, 0.05)",
                        "&:hover": {
                          backgroundColor: "rgba(33, 150, 243, 0.12)",
                        },
                      }}
                    >
                      <ListItemText
                        primary={
                          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <Typography sx={{ fontWeight: 700, color: "#1565c0" }}>
                              🎁 {paquete.paquete_nombre}
                            </Typography>
                            <Box sx={{ 
                              backgroundColor: "#2196f3", 
                              color: "white", 
                              px: 1.5, 
                              py: 0.3, 
                              borderRadius: 2,
                              fontSize: "0.75rem",
                              fontWeight: "bold"
                            }}>
                              {sesionesPendientes.length} pendiente(s)
                            </Box>
                          </Box>
                        }
                        secondary={
                          <Box sx={{ mt: 0.5 }}>
                            <Typography variant="caption" sx={{ color: "rgba(46,46,46,0.6)" }}>
                              Progreso: {paquete.sesiones_completadas}/{paquete.sesiones_totales} sesiones
                            </Typography>
                            {sesionesPendientes.slice(0, 3).map((sesion, idx) => (
                              <Typography key={idx} variant="body2" sx={{ color: "#1565c0" }}>
                                • {sesion.tratamiento_nombre} - Sesión {sesion.sesion_numero} (S/ {(sesion.precio_sesion || 0).toFixed(2)})
                              </Typography>
                            ))}
                            {sesionesPendientes.length > 3 && (
                              <Typography variant="body2" sx={{ color: "rgba(46,46,46,0.6)", fontStyle: "italic" }}>
                                ... y {sesionesPendientes.length - 3} más
                              </Typography>
                            )}
                          </Box>
                        }
                      />
                    </ListItemButton>
                  );
                })}
              </List>
            </Box>
          )}

          {/* Separador si hay ambos */}
          {paquetesPaciente.length > 0 && ofertasPaciente.length > 0 && (
            <Divider sx={{ my: 2 }} />
          )}

          {/* Sección de Presupuestos Iniciales */}
          {ofertasPaciente.length > 0 && (
            <Box>
              <Typography sx={{ fontWeight: 700, color: colorPrincipal, mb: 1.5 }}>
                📋 Presupuestos Iniciales
              </Typography>
              <List sx={{ pt: 0 }}>
                {ofertasPaciente.map((oferta) => (
                  <ListItemButton
                    key={oferta.id}
                    onClick={() => aplicarOferta(oferta)}
                    sx={{
                      borderRadius: 2,
                      mb: 1,
                      border: "1px solid rgba(212,175,55,0.25)",
                      "&:hover": {
                        backgroundColor: "rgba(163,105,32,0.08)",
                      },
                    }}
                  >
                    <ListItemText
                      primary={
                        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <Typography sx={{ fontWeight: 700, color: colorPrincipal }}>
                            {oferta.creado_en?.split(" ")[0] || "Sin fecha"}
                          </Typography>
                          <Typography sx={{ fontWeight: 800, color: colorPrincipal }}>
                            S/ {Number(oferta.total || 0).toFixed(2)}
                          </Typography>
                        </Box>
                      }
                      secondary={
                        <Box sx={{ mt: 0.5 }}>
                          {(oferta.items || []).map((item, idx) => (
                            <Typography key={idx} variant="body2" sx={{ color: "rgba(46,46,46,0.75)" }}>
                              • {item.nombre || item.tratamiento || "Sin nombre"} - S/ {Number(item.precio || 0).toFixed(2)}
                            </Typography>
                          ))}
                        </Box>
                      }
                    />
                  </ListItemButton>
                ))}
              </List>
            </Box>
          )}

          {/* Mensaje si no hay nada */}
          {ofertasPaciente.length === 0 && paquetesPaciente.length === 0 && (
            <Typography sx={{ color: "rgba(46,46,46,0.70)", py: 2, textAlign: "center" }}>
              Este paciente no tiene presupuestos ni paquetes registrados.
            </Typography>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button
            onClick={() => setOpenOfertasModal(false)}
            sx={{ color: colorPrincipal, fontWeight: 700 }}
          >
            Cerrar
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ComenzarTratamiento;
