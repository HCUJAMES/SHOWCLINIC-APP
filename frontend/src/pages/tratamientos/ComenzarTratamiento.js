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
  InputAdornment,
  Chip,
} from "@mui/material";
import { ArrowBack, Receipt, Home, QrCodeScanner, Close, Add as AddIcon } from "@mui/icons-material";
import { useNavigate, useSearchParams } from "react-router-dom";
import axios from "axios";
import { useToast } from "../../components/ToastProvider";

const API_BASE_URL =
  process.env.REACT_APP_API_URL || `${window.location.protocol}//${window.location.hostname}:4000`;

const ComenzarTratamiento = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const colorPrincipal = "#a36920";
  const { showToast } = useToast();
  const token = localStorage.getItem("token");
  const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};
  const [pacientes, setPacientes] = useState([]);
  const [tratamientos, setTratamientos] = useState([]);
  const [variantesInv, setVariantesInv] = useState([]);
  const [especialistas, setEspecialistas] = useState([]);
  const [recetasPorTratamiento, setRecetasPorTratamiento] = useState({});
  const [cargaInicial, setCargaInicial] = useState(false);

  // Estado para presupuestos/ofertas del paciente
  const [ofertasPaciente, setOfertasPaciente] = useState([]);
  const [paquetesPaciente, setPaquetesPaciente] = useState([]);
  const [openOfertasModal, setOpenOfertasModal] = useState(false);
  const [presupuestoAplicado, setPresupuestoAplicado] = useState(false);
  const [paqueteAplicado, setPaqueteAplicado] = useState(null);

  const [tipoAtencion, setTipoAtencion] = useState("Tratamiento");
  const [paciente_id, setPaciente_id] = useState("");
  const [especialista, setEspecialista] = useState("");
  // Pagos se manejan desde el historial del paciente
  const [sesion, setSesion] = useState(1);
  const [bloques, setBloques] = useState([
    {
      tratamiento_id: "",
      producto: "",
      variante_id: "",
      marca: "",
      cantidad: 1,
      dosis_unidades: "",
      codigo_ingresado: "",
      codigo_validado: false,
      unidades_usadas_principal: "", // Cantidad a usar del código principal
      codigos_extra: [], // Array de códigos adicionales: [{ codigo: "ABC123", unidades_usadas: 20, validado: false }]
    },
  ]);


  // Cargar datos iniciales
  const cargarDatos = async () => {
    try {
      const [pacientesRes, tratamientosRes, variantesRes, especialistasRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/api/pacientes/listar`, { headers: authHeaders }),
        axios.get(`${API_BASE_URL}/api/tratamientos/listar`, { headers: authHeaders }),
        axios.get(`${API_BASE_URL}/api/inventario/variantes`, { headers: authHeaders }).catch(() => ({ data: [] })),
        axios.get(`${API_BASE_URL}/api/especialistas/listar`, { headers: authHeaders }),
      ]);
      
      const pacientesOrdenados = Array.isArray(pacientesRes.data) ? pacientesRes.data.sort((a, b) => {
        const nombreA = `${a.nombre || ''} ${a.apellido || ''}`.trim().toLowerCase();
        const nombreB = `${b.nombre || ''} ${b.apellido || ''}`.trim().toLowerCase();
        return nombreA.localeCompare(nombreB);
      }) : [];
      const tratamientosOrdenados = Array.isArray(tratamientosRes.data) ? tratamientosRes.data.sort((a, b) => {
        return (a.nombre || '').toLowerCase().localeCompare((b.nombre || '').toLowerCase());
      }) : [];
      const especialistasOrdenados = Array.isArray(especialistasRes.data) ? especialistasRes.data.sort((a, b) => {
        const nombreA = `${a.nombre || ''} ${a.apellido || ''}`.trim().toLowerCase();
        const nombreB = `${b.nombre || ''} ${b.apellido || ''}`.trim().toLowerCase();
        return nombreA.localeCompare(nombreB);
      }) : [];
      
      setPacientes(pacientesOrdenados);
      setTratamientos(tratamientosOrdenados);
      setVariantesInv(Array.isArray(variantesRes.data) ? variantesRes.data : []);
      setEspecialistas(especialistasOrdenados);
      setCargaInicial(true);
    } catch (err) {
      console.error("Error cargando datos iniciales:", err);
      setCargaInicial(true);
    }
  };

  useEffect(() => {
    cargarDatos();
    // Recargar tratamientos e inventario al volver a la página
    const handleFocus = () => {
      axios.get(`${API_BASE_URL}/api/tratamientos/listar`, { headers: authHeaders })
        .then((res) => {
          const sorted = Array.isArray(res.data) ? res.data.sort((a, b) =>
            (a.nombre || '').toLowerCase().localeCompare((b.nombre || '').toLowerCase())
          ) : [];
          setTratamientos(sorted);
        }).catch(() => {});
      axios.get(`${API_BASE_URL}/api/inventario/variantes`, { headers: authHeaders })
        .then((res) => setVariantesInv(Array.isArray(res.data) ? res.data : []))
        .catch(() => {});
    };
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, []);

  // Cargar paciente y presupuesto/paquete desde URL
  useEffect(() => {
    if (!cargaInicial || tratamientos.length === 0) return;
    
    const pacienteParam = searchParams.get("paciente");
    const presupuestoParam = searchParams.get("presupuesto");
    const paqueteParam = searchParams.get("paquete");
    
    if (pacienteParam) {
      setPaciente_id(pacienteParam);
      
      // Si viene con presupuesto asignado, cargarlo automáticamente
      if (presupuestoParam) {
        axios.get(`${API_BASE_URL}/api/paquetes/presupuestos/paciente/${pacienteParam}`, { headers: authHeaders })
          .then((res) => {
            const presupuestos = Array.isArray(res.data) ? res.data : [];
            const presupuestoEncontrado = presupuestos.find(p => String(p.id) === String(presupuestoParam));
            if (presupuestoEncontrado) {
              // Parsear tratamientos del presupuesto asignado
              let tratamientosPresupuesto = [];
              try {
                tratamientosPresupuesto = presupuestoEncontrado.tratamientos_json 
                  ? JSON.parse(presupuestoEncontrado.tratamientos_json) 
                  : [];
              } catch (e) {
                tratamientosPresupuesto = [];
              }
              
              // Crear bloques a partir de los tratamientos del presupuesto
              const nuevosBloques = tratamientosPresupuesto.map((item) => {
                const nombreTratamiento = String(item.nombre || item.tratamiento || "").trim().toLowerCase();
                const tratamientoIdGuardado = item.tratamiento_id || item.tratamientoId;
                
                let tratamientoEncontrado = null;
                if (tratamientoIdGuardado) {
                  tratamientoEncontrado = tratamientos.find(
                    (t) => t.id === tratamientoIdGuardado || String(t.id) === String(tratamientoIdGuardado)
                  );
                }
                if (!tratamientoEncontrado && nombreTratamiento) {
                  tratamientoEncontrado = tratamientos.find(
                    (t) => String(t.nombre || "").trim().toLowerCase() === nombreTratamiento
                  );
                }
                
                return {
                  tratamiento_id: tratamientoEncontrado?.id || "",
                  producto: "",
                  variante_id: "",
                  marca: "",
                  cantidad: 1,
                  dosis_unidades: "",
                  codigo_ingresado: "",
                  codigo_validado: false,
                  unidades_usadas_principal: "",
                  codigos_extra: [],
                };
              });
              
              if (nuevosBloques.length > 0) {
                setBloques(nuevosBloques);
                setPresupuestoAplicado(true);
                showToast({ severity: "success", message: "Presupuesto cargado automáticamente" });
              } else {
                showToast({ severity: "warning", message: "El presupuesto no tiene tratamientos configurados" });
              }
            } else {
              showToast({ severity: "warning", message: "Presupuesto no encontrado" });
            }
          })
          .catch((err) => {
            console.error("Error cargando presupuesto:", err);
            showToast({ severity: "error", message: "Error al cargar el presupuesto" });
          });
      }
      
      // Si viene con paquete, cargarlo automáticamente
      if (paqueteParam) {
        axios.get(`${API_BASE_URL}/api/paquetes/paciente/${pacienteParam}`, { headers: authHeaders })
          .then((res) => {
            const paquetes = Array.isArray(res.data) ? res.data : [];
            const paqueteEncontrado = paquetes.find(p => String(p.id) === String(paqueteParam));
            if (paqueteEncontrado) {
              const sesionesPendientes = (paqueteEncontrado.sesiones || []).filter(s => s.estado === 'pendiente');
              
              if (sesionesPendientes.length > 0) {
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
                    sesion_paquete_id: sesion.id,
                    codigo_ingresado: "",
                    codigo_validado: false,
                  unidades_usadas_principal: "",
                    codigos_extra: [],
                  };
                });
                
                setBloques(nuevosBloques);
                setPresupuestoAplicado(true);
                setPaqueteAplicado(paqueteEncontrado);
                showToast({ severity: "success", message: `Paquete "${paqueteEncontrado.paquete_nombre}" cargado - ${sesionesPendientes.length} sesión(es)` });
              } else {
                showToast({ severity: "warning", message: "No hay sesiones pendientes en este paquete" });
              }
            }
          })
          .catch((err) => console.error("Error cargando paquete:", err));
      }
    }
  }, [cargaInicial, tratamientos, searchParams]);


  // Actualizar bloque de tratamiento
  const actualizarBloque = (index, campo, valor) => {
    const nuevosBloques = [...bloques];
    nuevosBloques[index][campo] = valor;

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
    }

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
        codigo_ingresado: "",
        codigo_validado: false,
        unidades_usadas_principal: "",
        codigos_extra: [],
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
        codigo_ingresado: "",
        codigo_validado: false,
        unidades_usadas_principal: "",
        codigos_extra: [],
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
        sesion_paquete_id: sesion.id, // Guardar referencia a la sesión del paquete
        codigo_ingresado: "",
        codigo_validado: false,
        unidades_usadas_principal: "",
        codigos_extra: [],
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
        codigo_ingresado: "",
        codigo_validado: false,
        unidades_usadas_principal: "",
        codigos_extra: [],
      },
    ]);
    setPresupuestoAplicado(false);
    setPaqueteAplicado(null);
    showToast({ severity: "info", message: "Presupuesto cancelado" });
  };

  // Validar código de producto contra los códigos de barras registrados en inventario
  const validarCodigoProducto = async (index, codigo) => {
    const bloque = bloques[index];
    if (!bloque.variante_id) {
      showToast({ severity: "warning", message: "Primero selecciona un producto" });
      return;
    }
    if (!codigo || codigo.trim() === "") {
      const nuevosBloques = [...bloques];
      nuevosBloques[index] = { ...nuevosBloques[index], codigo_validado: false, unidades_restantes_codigo: null };
      setBloques(nuevosBloques);
      return;
    }

    const codigoIngresado = String(codigo).trim();

    try {
      // Consultar los códigos de barras registrados para esta variante
      const res = await axios.get(
        `${API_BASE_URL}/api/barcodes/variant/${bloque.variante_id}/codes`,
        { headers: authHeaders }
      );
      const data = res.data;
      // Un código es disponible si está activo O si aún tiene unidades restantes > 0
      const codigosDisponibles = (data.codes || []).filter(
        c => c.status === "active" || (c.unidades_restantes > 0)
      );

      if (codigosDisponibles.length === 0) {
        showToast({ severity: "error", message: "Este producto no tiene códigos disponibles registrados en inventario." });
        const nuevosBloques = [...bloques];
        nuevosBloques[index] = { ...nuevosBloques[index], codigo_validado: false, unidades_restantes_codigo: null };
        setBloques(nuevosBloques);
        return;
      }

      // Verificar si el código ingresado coincide con alguno de los disponibles
      const coincide = codigosDisponibles.find(c => c.barcode === codigoIngresado);

      if (coincide) {
        const restantes = parseFloat(coincide.unidades_restantes) || 0;
        const totales = parseFloat(coincide.unidades_totales) || 0;
        const nuevosBloques = [...bloques];
        nuevosBloques[index] = { 
          ...nuevosBloques[index], 
          codigo_validado: true, 
          unidades_restantes_codigo: restantes,
          unidades_totales_codigo: totales,
        };
        setBloques(nuevosBloques);
        if (restantes > 0 && restantes < totales) {
          showToast({ severity: "success", message: `Código validado - Restantes: ${restantes} de ${totales} unidades` });
        } else if (restantes > 0) {
          showToast({ severity: "success", message: `Código validado - ${restantes} unidades disponibles` });
        } else {
          showToast({ severity: "success", message: `Código validado correctamente` });
        }
      } else {
        // Verificar si el código existe pero ya está agotado
        const codigoAgotado = (data.codes || []).find(c => c.barcode === codigoIngresado);
        const nuevosBloques = [...bloques];
        nuevosBloques[index] = { ...nuevosBloques[index], codigo_validado: false, unidades_restantes_codigo: null };
        setBloques(nuevosBloques);
        if (codigoAgotado) {
          showToast({ severity: "error", message: `Este código ya fue agotado (0 unidades restantes). Usa otro código.` });
        } else {
          showToast({ severity: "error", message: `Código incorrecto. No coincide con ningún código de este producto.` });
        }
      }
    } catch (err) {
      console.error("Error validando código:", err);
      showToast({ severity: "error", message: "Error al validar el código del producto" });
      const nuevosBloques = [...bloques];
      nuevosBloques[index] = { ...nuevosBloques[index], codigo_validado: false, unidades_restantes_codigo: null };
      setBloques(nuevosBloques);
    }
  };

  // Agregar código extra con botón +
  const agregarCodigoExtra = (index) => {
    const nuevosBloques = [...bloques];
    nuevosBloques[index] = {
      ...nuevosBloques[index],
      codigos_extra: [
        ...(nuevosBloques[index].codigos_extra || []),
        { codigo: "", unidades_usadas: "", validado: false }
      ]
    };
    setBloques(nuevosBloques);
  };

  // Validar código extra individualmente
  const validarCodigoExtra = async (indexBloque, indexCodigo) => {
    const bloque = bloques[indexBloque];
    const codigoExtra = bloque.codigos_extra[indexCodigo];
    
    if (!bloque.variante_id) {
      alert("Primero selecciona un producto");
      return;
    }
    
    if (!codigoExtra.codigo || codigoExtra.codigo.trim() === "") {
      alert("Ingresa un código para validar");
      return;
    }

    const codigoIngresado = String(codigoExtra.codigo).trim();

    try {
      const res = await axios.get(
        `${API_BASE_URL}/api/barcodes/variant/${bloque.variante_id}/codes`,
        { headers: authHeaders }
      );
      const data = res.data;
      const codigosDisponibles = (data.codes || []).filter(
        c => c.status === "active" || (c.unidades_restantes > 0)
      );

      if (codigosDisponibles.length === 0) {
        alert("Este producto no tiene códigos disponibles registrados en inventario.");
        return;
      }

      const coincide = codigosDisponibles.find(c => c.barcode === codigoIngresado);

      if (coincide) {
        const nuevosBloques = [...bloques];
        nuevosBloques[indexBloque].codigos_extra[indexCodigo] = {
          ...nuevosBloques[indexBloque].codigos_extra[indexCodigo],
          validado: true,
        };
        setBloques(nuevosBloques);
        alert("Código validado correctamente");
      } else {
        alert("Código incorrecto. No coincide con ningún código de este producto.");
      }
    } catch (err) {
      console.error("Error validando código extra:", err);
      alert("Error al validar el código");
    }
  };

  // Eliminar código extra
  const eliminarCodigoExtra = (indexBloque, indexCodigo) => {
    const nuevosBloques = [...bloques];
    nuevosBloques[indexBloque].codigos_extra = nuevosBloques[indexBloque].codigos_extra.filter((_, i) => i !== indexCodigo);
    setBloques(nuevosBloques);
  };

  // Actualizar código extra
  const actualizarCodigoExtra = (indexBloque, indexCodigo, campo, valor) => {
    const nuevosBloques = [...bloques];
    nuevosBloques[indexBloque].codigos_extra[indexCodigo][campo] = valor;
    setBloques(nuevosBloques);
  };

  // Calcular total de unidades (principal + extras)
  const calcularTotalUnidades = (bloque) => {
    let total = 0;
    // Sumar unidades usadas del código principal
    if (bloque.unidades_usadas_principal) {
      total += parseFloat(bloque.unidades_usadas_principal) || 0;
    }
    // Sumar unidades de códigos extra
    if (bloque.codigos_extra && bloque.codigos_extra.length > 0) {
      bloque.codigos_extra.forEach(c => {
        total += parseFloat(c.unidades_usadas) || 0;
      });
    }
    return total;
  };

  // Guardar tratamiento (solo registra en historial, sin pagos)
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

    // Validar que el código de producto sea correcto para cada bloque con producto seleccionado
    for (let i = 0; i < bloquesValidos.length; i++) {
      const bloque = bloquesValidos[i];
      if (bloque.variante_id) {
        // Si tiene producto seleccionado, DEBE tener código validado
        if (!bloque.codigo_ingresado || bloque.codigo_ingresado.trim() === "") {
          showToast({ 
            severity: "error", 
            message: `Debes ingresar el código del producto en el tratamiento #${i + 1}` 
          });
          return;
        }
        if (!bloque.codigo_validado) {
          showToast({ 
            severity: "error", 
            message: `El código del producto en el tratamiento #${i + 1} no es válido. Debe coincidir con el SKU del inventario.` 
          });
          return;
        }
      }
    }

    // Calcular total de unidades para cada bloque y actualizar dosis_unidades
    const bloquesConTotal = bloquesValidos.map(bloque => {
      const totalUnidades = calcularTotalUnidades(bloque);
      return {
        ...bloque,
        dosis_unidades: totalUnidades > 0 ? totalUnidades : bloque.dosis_unidades,
      };
    });

    const data = new FormData();
    data.append("tipoAtencion", tipoAtencion);
    data.append("paciente_id", paciente_id);
    data.append("especialista", especialista);
    data.append("sesion", sesion);
    data.append("productos", JSON.stringify(bloquesConTotal));
    data.append("sinPago", "true"); // Indicar que no hay pago en esta sesión

    try {
      const res = await axios.post(`${API_BASE_URL}/api/tratamientos/realizado`, data, {
        headers: authHeaders,
      });
      showToast({ severity: "success", message: res.data.message || "Sesión registrada correctamente" });
      
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
      setSesion(1);
      setBloques([
        {
          tratamiento_id: "",
          producto: "",
          variante_id: "",
          marca: "",
          cantidad: 1,
          dosis_unidades: "",
          codigo_ingresado: "",
          codigo_validado: false,
          unidades_usadas_principal: "",
          codigos_extra: [],
        },
      ]);
      setPresupuestoAplicado(false);
      setPaqueteAplicado(null);
    } catch (err) {
      console.error(err);
      const status = err?.response?.status;
      const msg = err?.response?.data?.message;
      showToast({
        severity: "error",
        message: msg ? `Error al registrar sesión${status ? ` (${status})` : ""}: ${msg}` : "Error al registrar sesión",
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
                      </Box>
                    </Box>

                    <Typography
                      variant="body2"
                      sx={{ color: "rgba(46,46,46,0.70)", mb: 2.5 }}
                    >
                      Completa los campos para registrar la sesión.
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

                      {/* Producto y cantidad (opcional en Retoque) */}
                          <Grid item xs={12} sm={6} md sx={{ flexGrow: 1, minWidth: 260 }}>
                            {(() => {
                              // Filtrar productos según la receta del tratamiento
                              const receta = b.tratamiento_id ? recetasPorTratamiento[b.tratamiento_id] || [] : [];
                              const tieneReceta = Array.isArray(receta) && receta.length > 0;
                              const esRetoque = tipoAtencion === "Retoque";
                              
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
                                    const unidad = opt.unidad_base ? ` (${opt.unidad_base})` : "";
                                    const precio = opt.precio_cliente ? ` - S/ ${Number(opt.precio_cliente).toFixed(2)}` : "";
                                    return `${marca} - ${nombre}${unidad}${precio}`.trim();
                                  }}
                                  isOptionEqualToValue={(opt, val) => String(opt.id) === String(val.id)}
                                  onChange={(_, val) => {
                                    const nuevosBloques = [...bloques];
                                    nuevosBloques[index] = {
                                      ...nuevosBloques[index],
                                      variante_id: val ? val.id : "",
                                      producto: val
                                        ? `${val.producto_base_nombre || ""} - ${val.nombre || ""}`.trim()
                                        : "",
                                      codigo_ingresado: "",
                                      codigo_validado: false,
                  unidades_usadas_principal: "",
                                      codigos_extra: [],
                                    };
                                    setBloques(nuevosBloques);
                                  }}
                                  renderInput={(params) => (
                                    <TextField
                                      {...params}
                                      label={esRetoque ? "Producto (opcional)" : tieneReceta ? "Producto (filtrado)" : "Producto"}
                                      placeholder={esRetoque ? "Sin producto (opcional)" : tieneReceta ? "Productos configurados para este tratamiento" : "Seleccionar producto"}
                                      fullWidth
                                      helperText={esRetoque ? "En retoque el producto es opcional" : tieneReceta ? `${opcionesProductos.length} producto(s) disponible(s)` : ""}
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

                          {/* Campo para ingresar código del producto (SKU) */}
                          {b.variante_id && (
                          <Grid item xs={12} sm={6} md sx={{ flexGrow: 1, minWidth: 200 }}>
                            <TextField
                              label="Código del producto"
                              placeholder="Ingresa el código del producto"
                              fullWidth
                              value={b.codigo_ingresado || ""}
                              onChange={(e) => {
                                const nuevosBloques = [...bloques];
                                nuevosBloques[index] = { 
                                  ...nuevosBloques[index], 
                                  codigo_ingresado: e.target.value,
                                  codigo_validado: false,
                  unidades_usadas_principal: "",
                                };
                                setBloques(nuevosBloques);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  validarCodigoProducto(index, e.target.value);
                                }
                              }}
                              InputProps={{
                                startAdornment: (
                                  <InputAdornment position="start">
                                    <QrCodeScanner sx={{ color: b.codigo_validado ? "#2e7d32" : "#a36920" }} />
                                  </InputAdornment>
                                ),
                                endAdornment: b.codigo_ingresado ? (
                                  <InputAdornment position="end">
                                    <Button
                                      size="small"
                                      onClick={() => validarCodigoProducto(index, b.codigo_ingresado)}
                                      sx={{ color: b.codigo_validado ? "#2e7d32" : "#a36920", fontWeight: 700, minWidth: "auto" }}
                                    >
                                      {b.codigo_validado ? "Validado" : "Validar"}
                                    </Button>
                                  </InputAdornment>
                                ) : null,
                              }}
                              helperText={
                                b.codigo_validado 
                                  ? (b.unidades_restantes_codigo != null && b.unidades_totales_codigo
                                    ? `Código validado - ${b.unidades_restantes_codigo} de ${b.unidades_totales_codigo} unidades disponibles`
                                    : "Código correcto - coincide con inventario")
                                  : b.codigo_ingresado 
                                    ? "Presiona Validar o Enter para verificar el código" 
                                    : "Obligatorio: ingresa el código del producto"
                              }
                              sx={{
                                "& .MuiInputBase-root": {
                                  backgroundColor: "rgba(255,255,255,0.95)",
                                  borderRadius: 3,
                                  minHeight: "56px",
                                  border: b.codigo_validado ? "2px solid #2e7d32" : b.codigo_ingresado && !b.codigo_validado ? "2px solid #f57c00" : "none",
                                },
                              }}
                            />
                          </Grid>
                          )}

                          {/* Campo para cantidad a usar del código principal */}
                          {b.variante_id && b.codigo_validado && (
                          <Grid item xs={12} sm={6} md sx={{ minWidth: 140 }}>
                            <TextField
                              label="Unidades a usar"
                              placeholder="0"
                              type="number"
                              fullWidth
                              value={b.unidades_usadas_principal || ""}
                              onChange={(e) => {
                                const nuevosBloques = [...bloques];
                                nuevosBloques[index] = { ...nuevosBloques[index], unidades_usadas_principal: e.target.value };
                                setBloques(nuevosBloques);
                              }}
                              helperText="Cantidad del código principal"
                            />
                          </Grid>
                          )}

                          {/* Botón para agregar código extra */}
                          {b.variante_id && b.codigo_validado && (
                          <Grid item xs={12} sm="auto">
                            <Button
                              variant="outlined"
                              startIcon={<AddIcon />}
                              onClick={() => agregarCodigoExtra(index)}
                              sx={{
                                borderColor: colorPrincipal,
                                color: colorPrincipal,
                                "&:hover": {
                                  borderColor: "#8a5a1a",
                                  backgroundColor: "rgba(163,105,32,0.05)",
                                },
                                borderRadius: 3,
                                height: "56px",
                              }}
                            >
                              Agregar código
                            </Button>
                          </Grid>
                          )}

                          {/* Lista de códigos extra */}
                          {b.codigos_extra && b.codigos_extra.length > 0 && (
                          <Grid item xs={12}>
                            <Box sx={{ 
                              backgroundColor: "rgba(255,255,255,0.95)",
                              borderRadius: 3,
                              p: 2,
                              border: "1px solid rgba(163,105,32,0.2)",
                            }}>
                              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1.5 }}>
                                <Typography variant="body2" sx={{ fontWeight: 700, color: colorPrincipal }}>
                                  Códigos adicionales
                                </Typography>
                                <Chip
                                  label={`Total: ${calcularTotalUnidades(b)} unidades`}
                                  sx={{
                                    backgroundColor: "#e8f5e9",
                                    color: "#2e7d32",
                                    fontWeight: 700,
                                  }}
                                />
                              </Box>
                              <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
                                {b.codigos_extra.map((codigo, idx) => (
                                  <Box
                                    key={idx}
                                    sx={{
                                      display: "flex",
                                      gap: 1,
                                      alignItems: "center",
                                    }}
                                  >
                                    <TextField
                                      label="Código"
                                      placeholder="Código adicional"
                                      size="small"
                                      value={codigo.codigo || ""}
                                      onChange={(e) => actualizarCodigoExtra(index, idx, "codigo", e.target.value)}
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                          e.preventDefault();
                                          validarCodigoExtra(index, idx);
                                        }
                                      }}
                                      InputProps={{
                                        endAdornment: codigo.codigo ? (
                                          <InputAdornment position="end">
                                            <Button
                                              size="small"
                                              onClick={() => validarCodigoExtra(index, idx)}
                                              sx={{ color: codigo.validado ? "#2e7d32" : "#a36920", fontWeight: 700, minWidth: "auto" }}
                                            >
                                              {codigo.validado ? "Validado" : "Validar"}
                                            </Button>
                                          </InputAdornment>
                                        ) : null,
                                      }}
                                      sx={{ flexGrow: 1, minWidth: 150 }}
                                    />
                                    <TextField
                                      label="Unidades usadas"
                                      placeholder="0"
                                      type="number"
                                      size="small"
                                      value={codigo.unidades_usadas || ""}
                                      onChange={(e) => actualizarCodigoExtra(index, idx, "unidades_usadas", e.target.value)}
                                      disabled={!codigo.validado}
                                      sx={{ width: 120 }}
                                    />
                                    <IconButton
                                      size="small"
                                      onClick={() => eliminarCodigoExtra(index, idx)}
                                      sx={{ color: "#d32f2f" }}
                                    >
                                      <Close fontSize="small" />
                                    </IconButton>
                                  </Box>
                                ))}
                              </Box>
                            </Box>
                          </Grid>
                          )}

                          {/* Solo mostrar cantidad si se seleccionó un producto */}
                          {b.variante_id && (
                          <Grid item xs={12} sm="auto" md="auto">
                            {(() => {
                              const varSel = b.variante_id ? variantesInv.find(v => String(v.id) === String(b.variante_id)) : null;
                              const unidadVar = varSel?.unidad_base || "ml";
                              const labelCantidad = unidadVar === "U" ? "Unidades (U)" : unidadVar === "frasco" ? "Frascos" : "Cantidad (ml)";
                              const helperCantidad = unidadVar === "U" ? "Unidades a usar (ej: 24,5)" : unidadVar === "frasco" ? "Frascos a usar" : "ml a descontar (ej: 2,5)";
                              const valorMostrar = b.dosis_unidades || b.cantidad || "";
                              return (
                                <TextField
                                  label={labelCantidad}
                                  type="text"
                                  inputMode="decimal"
                                  value={valorMostrar}
                                  onChange={(e) => {
                                    // Permitir comas y puntos como separador decimal
                                    let raw = e.target.value;
                                    // Solo permitir números, comas y puntos
                                    raw = raw.replace(/[^0-9.,]/g, "");
                                    // Reemplazar coma por punto para el valor interno
                                    const valNormalizado = raw.replace(",", ".");
                                    setBloques(prev => {
                                      const copia = [...prev];
                                      copia[index] = { ...copia[index], dosis_unidades: raw, cantidad: valNormalizado };
                                      return copia;
                                    });
                                  }}
                                  sx={{
                                    "& .MuiInputBase-root": {
                                      backgroundColor: "rgba(255,255,255,0.95)",
                                      borderRadius: 3,
                                      minHeight: "56px",
                                    },
                                    width: { xs: "100%", sm: 160 },
                                  }}
                              helperText={helperCantidad}
                            />
                          );
                        })()}
                      </Grid>
                          )}

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

              {/* Mensaje informativo */}
              <Grid item xs={12}>
                <Box
                  sx={{
                    p: 2,
                    borderRadius: 2,
                    backgroundColor: "rgba(163,105,32,0.08)",
                    border: "1px solid rgba(163,105,32,0.25)",
                  }}
                >
                  <Typography variant="body2" sx={{ color: "#a36920", fontWeight: 600 }}>
                    💰 Los pagos se gestionan desde el historial del paciente (Presupuestos Asignados / Paquetes)
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
