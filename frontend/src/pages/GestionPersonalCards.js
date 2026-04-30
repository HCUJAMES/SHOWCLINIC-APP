import React, { useState, useEffect } from "react";
import {
  Container,
  Typography,
  Box,
  Grid,
  Card,
  Avatar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  IconButton,
  Chip,
  Paper,
  Stack,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  Alert,
  Tabs,
  Tab,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableContainer,
  TextField
} from "@mui/material";
import {
  Close,
  Home,
  Visibility,
  Payment,
  History,
  FileDownload,
  Edit,
  PictureAsPdf
} from "@mui/icons-material";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { useToast } from "../components/ToastProvider";
import { formatearFechaCorta } from "../utils/dateUtils";
import * as XLSX from "xlsx";
import { generarReporteComisionPDF } from "../utils/generarReporteComisionPDF";

const API_BASE_URL = process.env.REACT_APP_API_URL || `${window.location.protocol}//${window.location.hostname}:4000`;

const BRAND_COLORS = {
  primary: '#854F0B',
  secondary: '#FAEEDA',
  primaryDark: '#6B3F08',
  secondaryLight: '#FDF8F0',
  success: '#4CAF50',
  warning: '#FF9800',
  error: '#D32F2F',
  info: '#2196F3'
};

const AVATAR_COLORS = ['#F4C430', '#9B7EBD', '#7FB3D5', '#F8B4B4', '#B4E7CE'];

const GestionPersonalCards = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [estadisticas, setEstadisticas] = useState([]);
  const [mesSeleccionado, setMesSeleccionado] = useState(new Date().getMonth() + 1);
  const [anioSeleccionado, setAnioSeleccionado] = useState(new Date().getFullYear());
  const [rolFiltro, setRolFiltro] = useState("");
  const [personalExpandido, setPersonalExpandido] = useState(null);
  
  // Datos para el modal de detalle
  const [detalleData, setDetalleData] = useState(null);
  const [presupuestosEsp, setPresupuestosEsp] = useState([]);
  const [historialPagos, setHistorialPagos] = useState([]);
  const [loadingDetalle, setLoadingDetalle] = useState(false);
  const [tabDetalle, setTabDetalle] = useState(0);

  // Modal registrar pago
  const [modalPago, setModalPago] = useState({ abierto: false, trabajador: null });
  const [datoPago, setDatoPago] = useState({
    monto: 0,
    fecha: new Date().toISOString().split('T')[0],
    metodo: 'transferencia',
    referencia: ''
  });

  // Modal edición rápida desde card
  const [modalEditarCard, setModalEditarCard] = useState({ abierto: false, trabajador: null });
  const [datoEditarCard, setDatoEditarCard] = useState({
    nombre: '',
    apellido: '',
    especialidad: '',
    pago_fijo: 0,
    comision_porcentaje: 20,
    cuenta_bancaria: '',
    foto_perfil: ''
  });
  const [subiendoFoto, setSubiendoFoto] = useState(false);
  const [fotosError, setFotosError] = useState({});

  const token = localStorage.getItem("token");
  const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};

  useEffect(() => {
    cargarDatos();
  }, [mesSeleccionado, anioSeleccionado, rolFiltro]);

  const getFechasRango = () => {
    const primerDia = new Date(anioSeleccionado, mesSeleccionado - 1, 1);
    const ultimoDia = new Date(anioSeleccionado, mesSeleccionado, 0);
    const fmt = (d) => {
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      return `${yyyy}-${mm}-${dd}`;
    };
    return { fechaInicio: fmt(primerDia), fechaFin: fmt(ultimoDia) };
  };

  const cargarDatos = async () => {
    setLoading(true);
    try {
      const { fechaInicio, fechaFin } = getFechasRango();

      const res = await axios.get(`${API_BASE_URL}/api/gestion-clinica/estadisticas`, {
        headers: authHeaders,
        params: { fechaInicio, fechaFin }
      });

      let datos = res.data.estadisticas || [];
      if (rolFiltro) {
        datos = datos.filter(e => e.tipo === rolFiltro);
      }
      setEstadisticas(datos);
    } catch (error) {
      console.error("Error al cargar datos:", error);
      showToast({ severity: "error", message: "Error al cargar datos" });
    } finally {
      setLoading(false);
    }
  };

  const abrirDetalle = async (trabajador) => {
    setPersonalExpandido(trabajador.especialista_id);
    setTabDetalle(0);
    setLoadingDetalle(true);
    setDetalleData(null);
    setPresupuestosEsp([]);
    setHistorialPagos([]);

    try {
      const { fechaInicio, fechaFin } = getFechasRango();
      const qs = `?fecha_inicio=${fechaInicio}&fecha_fin=${fechaFin}`;

      const [detalleRes, presupuestosRes, historialRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/api/gestion-clinica/especialista/${trabajador.especialista_id}/detalle${qs}`, { headers: authHeaders }),
        axios.get(`${API_BASE_URL}/api/gestion-clinica/especialista/${trabajador.especialista_id}/presupuestos${qs}`, { headers: authHeaders }),
        axios.get(`${API_BASE_URL}/api/gestion-clinica/historial-pagos/${trabajador.especialista_id}`, { headers: authHeaders })
      ]);

      setDetalleData(detalleRes.data);
      setPresupuestosEsp(Array.isArray(presupuestosRes.data) ? presupuestosRes.data : []);
      setHistorialPagos(Array.isArray(historialRes.data) ? historialRes.data : []);
    } catch (error) {
      console.error("Error al cargar detalle:", error);
      setDetalleData(null);
      setPresupuestosEsp([]);
      setHistorialPagos([]);
    } finally {
      setLoadingDetalle(false);
    }
  };

  const cerrarDetalle = () => {
    setPersonalExpandido(null);
    setDetalleData(null);
    setPresupuestosEsp([]);
    setHistorialPagos([]);
  };

  const abrirModalPago = (trabajador) => {
    setDatoPago({
      monto: trabajador.pago_total_especialista || 0,
      fecha: new Date().toISOString().split('T')[0],
      metodo: 'transferencia',
      referencia: ''
    });
    setModalPago({ abierto: true, trabajador });
  };

  const registrarPago = async () => {
    try {
      await axios.post(
        `${API_BASE_URL}/api/gestion-clinica/registrar-pago`,
        {
          especialista_id: modalPago.trabajador.especialista_id,
          monto: datoPago.monto,
          fecha: datoPago.fecha,
          metodo: datoPago.metodo,
          referencia: datoPago.referencia,
          mes: mesSeleccionado,
          anio: anioSeleccionado
        },
        { headers: authHeaders }
      );
      showToast({ severity: "success", message: "Pago registrado exitosamente" });
      setModalPago({ abierto: false, trabajador: null });
      // Refrescar historial si el modal de detalle está abierto
      if (personalExpandido) {
        const res = await axios.get(`${API_BASE_URL}/api/gestion-clinica/historial-pagos/${personalExpandido}`, { headers: authHeaders });
        setHistorialPagos(Array.isArray(res.data) ? res.data : []);
      }
    } catch (error) {
      showToast({ severity: "error", message: error.response?.data?.message || "Error al registrar pago" });
    }
  };

  const exportarExcel = (trabajador) => {
    if (!trabajador) return;
    const datos = [{
      'Nombre': trabajador.especialista_nombre,
      'Rol': trabajador.tipo || 'Doctor',
      'Tratamientos': trabajador.total_atenciones,
      'Ingresos Generados': Number(trabajador.total_ingresos).toFixed(2),
      'Comision %': Number(trabajador.comision_porcentaje).toFixed(0),
      'Comision Calculada': Number(trabajador.comision_calculada).toFixed(2),
      'Sueldo Fijo': Number(trabajador.pago_fijo).toFixed(2),
      'Total a Pagar': Number(trabajador.pago_total_especialista).toFixed(2),
    }];
    const ws = XLSX.utils.json_to_sheet(datos);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Detalle");
    XLSX.writeFile(wb, `detalle_${trabajador.especialista_nombre.replace(/\s/g, '_')}.xlsx`);
    showToast({ severity: "success", message: "Exportado exitosamente" });
  };

  const exportarPDF = async (trabajador) => {
    if (!trabajador) return;
    try {
      await generarReporteComisionPDF({
        trabajador,
        presupuestos: presupuestosEsp,
        tratamientosRealizados: detalleData?.tratamientos || [],
        totalesTratamientos: detalleData?.totales || {},
        historialPagos,
        mes: mesSeleccionado,
        anio: anioSeleccionado
      });
      showToast({ severity: "success", message: "PDF generado exitosamente" });
    } catch (error) {
      console.error("Error generando PDF:", error);
      showToast({ severity: "error", message: "Error al generar PDF" });
    }
  };

  const abrirModalEditarCard = async (e, trabajador) => {
    e.stopPropagation();
    try {
      const res = await axios.get(`${API_BASE_URL}/api/especialistas/${trabajador.especialista_id}`, { headers: authHeaders });
      setDatoEditarCard({
        nombre: res.data.nombre || '',
        apellido: res.data.apellido || '',
        especialidad: res.data.especialidad || '',
        pago_fijo: res.data.pago_fijo || 0,
        comision_porcentaje: res.data.comision_porcentaje || 20,
        cuenta_bancaria: res.data.cuenta_bancaria || '',
        foto_perfil: res.data.foto_perfil || ''
      });
      setModalEditarCard({ abierto: true, trabajador });
    } catch (error) {
      console.error('Error al cargar datos:', error);
      setDatoEditarCard({
        nombre: trabajador.especialista_nombre?.split(' ')[0] || '',
        apellido: trabajador.especialista_nombre?.split(' ').slice(1).join(' ') || '',
        especialidad: '',
        pago_fijo: trabajador.pago_fijo || 0,
        comision_porcentaje: trabajador.comision_porcentaje || 20,
        cuenta_bancaria: '',
        foto_perfil: ''
      });
      setModalEditarCard({ abierto: true, trabajador });
    }
  };

  const subirFotoPerfil = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const formData = new FormData();
    formData.append('foto', file);
    
    const espId = modalEditarCard.trabajador?.especialista_id;
    if (!espId) return;

    setSubiendoFoto(true);
    try {
      const res = await axios.post(
        `${API_BASE_URL}/api/especialistas/${espId}/foto`,
        formData,
        { headers: { ...authHeaders, 'Content-Type': 'multipart/form-data' } }
      );
      const nuevaUrl = res.data.foto_url;
      setDatoEditarCard(prev => ({ ...prev, foto_perfil: nuevaUrl }));
      // Actualizar la foto en estadisticas localmente sin recargar
      setEstadisticas(prev => prev.map(s => 
        s.especialista_id === espId ? { ...s, foto_perfil: nuevaUrl } : s
      ));
      setFotosError(prev => { const n = {...prev}; delete n[espId]; return n; });
      showToast({ severity: 'success', message: 'Foto subida exitosamente' });
    } catch (error) {
      const msg = error.response?.data?.message || 'Error al subir foto';
      showToast({ severity: 'error', message: msg });
    } finally {
      setSubiendoFoto(false);
      // Reset input para poder subir el mismo archivo de nuevo
      e.target.value = '';
    }
  };

  const guardarEdicionCard = async () => {
    try {
      const dataToSend = {
        nombre: datoEditarCard.nombre,
        apellido: datoEditarCard.apellido,
        especialidad: datoEditarCard.especialidad,
        pago_fijo: datoEditarCard.pago_fijo,
        comision_porcentaje: datoEditarCard.comision_porcentaje,
        cuenta_bancaria: datoEditarCard.cuenta_bancaria
      };
      
      await axios.put(
        `${API_BASE_URL}/api/especialistas/${modalEditarCard.trabajador.especialista_id}`,
        dataToSend,
        { headers: authHeaders }
      );
      showToast({ severity: "success", message: "Datos actualizados exitosamente" });
      setModalEditarCard({ abierto: false, trabajador: null });
      setTimeout(() => cargarDatos(), 200);
    } catch (error) {
      console.error('Error al actualizar:', error);
      showToast({ severity: "error", message: error.response?.data?.message || "Error al actualizar datos" });
    }
  };

  const trabajadorActual = estadisticas.find(e => e.especialista_id === personalExpandido);
  const mesNombres = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4, backgroundColor: '#f5f1e4', minHeight: '100vh', py: 4 }}>
      {/* Header */}
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 4 }}>
        <Typography variant="h4" sx={{ color: '#854F0B', fontWeight: 600 }}>
          Gestión de personal clínico
        </Typography>
        <Button
          variant="outlined"
          startIcon={<Home />}
          onClick={() => navigate("/dashboard")}
          sx={{ borderColor: '#854F0B', color: '#854F0B', '&:hover': { borderColor: '#6B3F08', backgroundColor: '#FDF8F0' } }}
        >
          Volver
        </Button>
      </Box>

      {/* Filtros */}
      <Box sx={{ display: 'flex', gap: 2, mb: 4, flexWrap: 'wrap' }}>
        <FormControl sx={{ minWidth: 150 }}>
          <InputLabel sx={{ color: '#666' }}>Mes</InputLabel>
          <Select
            value={mesSeleccionado}
            onChange={(e) => setMesSeleccionado(e.target.value)}
            label="Mes"
            sx={{ backgroundColor: 'white', color: '#333', '& .MuiOutlinedInput-notchedOutline': { borderColor: '#ba9a63' } }}
          >
            {mesNombres.map((m, i) => (
              <MenuItem key={i + 1} value={i + 1}>{m} {anioSeleccionado}</MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl sx={{ minWidth: 100 }}>
          <InputLabel sx={{ color: '#666' }}>Año</InputLabel>
          <Select
            value={anioSeleccionado}
            onChange={(e) => setAnioSeleccionado(e.target.value)}
            label="Año"
            sx={{ backgroundColor: 'white', color: '#333', '& .MuiOutlinedInput-notchedOutline': { borderColor: '#ba9a63' } }}
          >
            {[2024, 2025, 2026, 2027].map(a => (
              <MenuItem key={a} value={a}>{a}</MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl sx={{ minWidth: 150 }}>
          <InputLabel sx={{ color: '#666' }}>Todos los roles</InputLabel>
          <Select
            value={rolFiltro}
            onChange={(e) => setRolFiltro(e.target.value)}
            label="Todos los roles"
            sx={{ backgroundColor: 'white', color: '#333', '& .MuiOutlinedInput-notchedOutline': { borderColor: '#ba9a63' } }}
          >
            <MenuItem value="">Todos</MenuItem>
            <MenuItem value="doctor">Doctor</MenuItem>
            <MenuItem value="asistente">Asistente</MenuItem>
            <MenuItem value="admin">Admin</MenuItem>
          </Select>
        </FormControl>
      </Box>

      {/* Cards de Personal */}
      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", p: 6 }}>
          <CircularProgress sx={{ color: BRAND_COLORS.warning }} />
        </Box>
      ) : estadisticas.length === 0 ? (
        <Alert severity="info">No se encontraron resultados.</Alert>
      ) : (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, justifyContent: 'flex-start' }}>
          {estadisticas.map((stat) => {
            const colorIndex = stat.especialista_id % AVATAR_COLORS.length;
            const iniciales = stat.especialista_nombre.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
            const hasFoto = !!(stat.foto_perfil && stat.foto_perfil.includes('.'));
            
            return (
              <Box key={stat.especialista_id} sx={{ width: { xs: 'calc(50% - 8px)', sm: 'calc(33.33% - 11px)', md: 'calc(20% - 13px)' } }}>
                <Card
                  onClick={() => abrirDetalle(stat)}
                  sx={{
                    cursor: 'pointer',
                    backgroundColor: '#fff',
                    borderRadius: '18px',
                    overflow: 'hidden',
                    transition: 'all 0.3s ease',
                    border: 'none',
                    position: 'relative',
                    display: 'flex',
                    flexDirection: 'column',
                    boxShadow: '0 2px 10px rgba(0,0,0,0.06)',
                    '&:hover': {
                      transform: 'translateY(-4px)',
                      boxShadow: '0 8px 24px rgba(0,0,0,0.1)'
                    }
                  }}
                >
                  <IconButton
                    size="small"
                    onClick={(e) => abrirModalEditarCard(e, stat)}
                    sx={{
                      position: 'absolute', top: 8, right: 8, zIndex: 3,
                      width: 28, height: 28,
                      backgroundColor: 'rgba(255,255,255,0.85)',
                      backdropFilter: 'blur(4px)',
                      '&:hover': { backgroundColor: 'rgba(255,255,255,1)' }
                    }}
                  >
                    <Edit sx={{ fontSize: '0.8rem', color: '#555' }} />
                  </IconButton>

                  {/* Zona de foto con gradiente */}
                  <Box sx={{
                    width: '100%',
                    height: 160,
                    background: hasFoto ? 'none' : `linear-gradient(135deg, ${AVATAR_COLORS[colorIndex]}, ${AVATAR_COLORS[(colorIndex + 2) % AVATAR_COLORS.length]})`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative',
                    overflow: 'hidden'
                  }}>
                    {hasFoto && (
                      <Avatar
                        variant="square"
                        src={stat.foto_perfil}
                        sx={{
                          width: '100%',
                          height: '100%',
                          borderRadius: 0,
                          '& img': { objectFit: 'cover', objectPosition: 'center top' }
                        }}
                      />
                    )}
                    {!hasFoto && (
                      <Typography sx={{ fontSize: '2.8rem', fontWeight: 700, color: 'rgba(0,0,0,0.12)' }}>
                        {iniciales}
                      </Typography>
                    )}
                    {/* Gradiente difuminado inferior */}
                    <Box sx={{
                      position: 'absolute',
                      bottom: 0, left: 0, right: 0,
                      height: '55%',
                      background: 'linear-gradient(to top, rgba(255,255,255,1) 0%, rgba(255,255,255,0.7) 35%, rgba(255,255,255,0) 100%)',
                      pointerEvents: 'none'
                    }} />
                  </Box>

                  {/* Info */}
                  <Box sx={{ px: 1.5, pb: 2, mt: -2.5, position: 'relative', zIndex: 1 }}>
                    <Typography sx={{ color: '#1a1a1a', fontWeight: 700, fontSize: '0.85rem', textAlign: 'center', lineHeight: 1.3, mb: 0.2 }}>
                      {stat.especialista_nombre}
                    </Typography>
                    <Typography sx={{ color: '#999', fontSize: '0.65rem', textAlign: 'center', mb: 1.5, textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                      {stat.especialidad || (stat.tipo === 'doctor' ? 'Medicina estética' : stat.tipo === 'asistente' ? 'Asistente clínica' : 'Recepción')}
                    </Typography>

                    <Box sx={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center' }}>
                      <Box sx={{ textAlign: 'center' }}>
                        <Typography sx={{ fontWeight: 700, fontSize: '0.9rem', color: '#854F0B' }}>
                          S/ {Number(stat.pago_fijo || 0).toLocaleString('es-PE', { minimumFractionDigits: 0 })}
                        </Typography>
                        <Typography sx={{ color: '#bbb', fontSize: '0.58rem' }}>pago fijo</Typography>
                      </Box>
                      <Box sx={{ textAlign: 'center' }}>
                        <Typography sx={{ fontWeight: 700, fontSize: '0.9rem', color: '#333' }}>
                          {stat.total_atenciones || 0}
                        </Typography>
                        <Typography sx={{ color: '#bbb', fontSize: '0.58rem' }}>tratamientos</Typography>
                      </Box>
                    </Box>
                  </Box>
                </Card>
              </Box>
            );
          })}
        </Box>
      )}

      {/* Modal de Detalle del Especialista */}
      <Dialog 
        open={personalExpandido !== null} 
        onClose={cerrarDetalle}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            backgroundColor: 'white',
            borderRadius: 3
          }
        }}
      >
        {trabajadorActual && (
          <>
            <DialogTitle sx={{ pb: 1 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Button
                  startIcon={<Close />}
                  onClick={cerrarDetalle}
                  sx={{ color: '#854F0B' }}
                >
                  Volver al equipo
                </Button>
                <IconButton onClick={cerrarDetalle} sx={{ color: '#854F0B' }}>
                  <Close />
                </IconButton>
              </Box>
            </DialogTitle>
            
            <DialogContent>
              {/* Header con Avatar */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                <Avatar
                  sx={{
                    width: 80,
                    height: 80,
                    backgroundColor: AVATAR_COLORS[trabajadorActual.especialista_id % AVATAR_COLORS.length],
                    fontSize: '1.8rem',
                    fontWeight: 'bold',
                    color: '#2D2D2D'
                  }}
                >
                  {trabajadorActual.especialista_nombre.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                </Avatar>
                <Box>
                  <Typography variant="h5" sx={{ color: '#333', fontWeight: 600 }}>
                    {trabajadorActual.especialista_nombre}
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#666' }}>
                    {trabajadorActual.tipo === 'doctor' ? 'Medicina estética' : trabajadorActual.tipo === 'asistente' ? 'Asistente clínica' : 'Recepción'}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                    <Chip label={trabajadorActual.tipo || 'Doctor'} size="small" sx={{ backgroundColor: '#FAEEDA', color: '#854F0B', fontWeight: 600, textTransform: 'capitalize' }} />
                    <Chip 
                      label={trabajadorActual.pago_fijo > 0 && trabajadorActual.comision_porcentaje > 0 ? 'Fijo + comisión' : trabajadorActual.pago_fijo > 0 ? 'Fijo' : 'Comisión'} 
                      size="small" 
                      sx={{ backgroundColor: '#FAEEDA', color: '#854F0B', fontWeight: 600 }} 
                    />
                  </Box>
                </Box>
              </Box>
              
              {/* Resumen Financiero - 2 cards: Sueldo fijo + Comisión calculada sobre pagado */}
              {(() => {
                const totalPagado = presupuestosEsp.reduce((sum, p) => sum + Number(p.monto_pagado || 0), 0);
                const comisionPct = Number(trabajadorActual.comision_porcentaje || 0);
                const comisionCalculada = totalPagado * (comisionPct / 100);
                return (
                  <Grid container spacing={2} sx={{ mb: 3 }}>
                    <Grid item xs={6}>
                      <Paper sx={{ p: 2, backgroundColor: '#FDF8F0', textAlign: 'center', border: '1px solid #FAEEDA', borderRadius: 2 }}>
                        <Typography variant="caption" sx={{ color: '#666', fontSize: '0.7rem' }}>Sueldo fijo</Typography>
                        <Typography variant="h6" sx={{ color: '#333', fontWeight: 600, fontSize: '1.1rem' }}>
                          S/ {Number(trabajadorActual.pago_fijo || 0).toFixed(2)}
                        </Typography>
                      </Paper>
                    </Grid>
                    <Grid item xs={6}>
                      <Paper sx={{ p: 2, backgroundColor: '#FDF8F0', textAlign: 'center', border: '1px solid #FAEEDA', borderRadius: 2 }}>
                        <Typography variant="caption" sx={{ color: '#666', fontSize: '0.7rem' }}>Comisión ({comisionPct.toFixed(0)}% sobre pagado)</Typography>
                        <Typography variant="h6" sx={{ color: '#854F0B', fontWeight: 600, fontSize: '1.1rem' }}>
                          S/ {comisionCalculada.toFixed(2)}
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#999', fontSize: '0.6rem' }}>
                          Total pagado: S/ {totalPagado.toFixed(2)}
                        </Typography>
                      </Paper>
                    </Grid>
                  </Grid>
                );
              })()}
              
              {/* Info adicional: Tratamientos */}
              <Box sx={{ mb: 2, textAlign: 'center' }}>
                <Chip 
                  label={`${trabajadorActual.total_atenciones || 0} tratamientos realizados`}
                  sx={{ backgroundColor: '#FAEEDA', color: '#854F0B', fontWeight: 600 }}
                />
              </Box>

              {/* Botones de Acción */}
              <Stack direction="row" spacing={2} sx={{ mb: 3 }}>
                <Button 
                  variant="contained" 
                  fullWidth
                  startIcon={<Payment />}
                  onClick={() => abrirModalPago(trabajadorActual)}
                  sx={{ backgroundColor: '#854F0B', '&:hover': { backgroundColor: '#6B3F08' } }}
                >
                  Registrar pago
                </Button>
                <Button 
                  variant="outlined" 
                  fullWidth
                  startIcon={<PictureAsPdf />}
                  onClick={() => exportarPDF(trabajadorActual)}
                  sx={{ borderColor: '#D32F2F', color: '#D32F2F', '&:hover': { borderColor: '#B71C1C', backgroundColor: '#FFEBEE' } }}
                >
                  Exportar PDF
                </Button>
                <Button 
                  variant="outlined" 
                  fullWidth
                  startIcon={<FileDownload />}
                  onClick={() => exportarExcel(trabajadorActual)}
                  sx={{ borderColor: '#854F0B', color: '#854F0B', '&:hover': { borderColor: '#6B3F08', backgroundColor: '#FDF8F0' } }}
                >
                  Exportar Excel
                </Button>
              </Stack>

              {/* Tabs de contenido */}
              <Box sx={{ borderBottom: 1, borderColor: '#FAEEDA', mb: 2 }}>
                <Tabs 
                  value={tabDetalle} 
                  onChange={(_, v) => setTabDetalle(v)}
                  sx={{ 
                    '& .MuiTab-root': { color: '#666', fontSize: '0.85rem', textTransform: 'none', fontWeight: 600 }, 
                    '& .Mui-selected': { color: '#854F0B' },
                    '& .MuiTabs-indicator': { backgroundColor: '#854F0B' }
                  }}
                >
                  <Tab label="Presupuestos asignados" />
                  <Tab label="Tratamientos realizados" />
                  <Tab label="Historial de pagos" />
                </Tabs>
              </Box>

              {loadingDetalle ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                  <CircularProgress size={40} sx={{ color: '#854F0B' }} />
                </Box>
              ) : (
                <>
                  {/* Tab 0: Presupuestos asignados */}
                  {tabDetalle === 0 && (
                    <Box>
                      {presupuestosEsp.length === 0 ? (
                        <Alert severity="info">No hay presupuestos asignados a este especialista en el período seleccionado.</Alert>
                      ) : (
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          {presupuestosEsp.map((pres) => {
                            const tratamientos = pres.tratamientos || [];
                            const precioTotal = Number(pres.precio_total || 0);
                            const descuento = Number(pres.descuento || 0);
                            const pagado = Number(pres.monto_pagado || 0);
                            const saldo = Math.max(0, precioTotal - descuento - pagado);
                            const estadoColor = pres.estado === 'completado' ? '#4CAF50' : pres.estado === 'activo' ? '#FF9800' : '#999';
                            
                            return (
                              <Paper key={pres.id} sx={{ p: 2, backgroundColor: '#FDF8F0', borderRadius: 2, border: `1px solid ${estadoColor}40` }}>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                                  <Box>
                                    <Typography variant="subtitle2" sx={{ color: '#333', fontWeight: 600 }}>
                                      {pres.paciente_nombre} {pres.paciente_apellido || ''}
                                    </Typography>
                                    <Typography variant="caption" sx={{ color: '#666' }}>
                                      {pres.paciente_dni ? `DNI: ${pres.paciente_dni} · ` : ''}Creado: {pres.creado_en?.split(' ')[0] || '-'}
                                    </Typography>
                                  </Box>
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <Chip 
                                      label={`${pres.sesiones_completadas || 0}/${pres.sesiones_totales || 0} sesiones`}
                                      size="small"
                                      sx={{ backgroundColor: '#FAEEDA', color: '#854F0B', fontSize: '0.7rem', fontWeight: 600 }}
                                    />
                                    <Chip 
                                      label={pres.estado === 'completado' ? 'Completado' : pres.estado === 'activo' ? 'Activo' : pres.estado}
                                      size="small"
                                      sx={{ backgroundColor: `${estadoColor}20`, color: estadoColor, fontWeight: 600, fontSize: '0.7rem' }}
                                    />
                                  </Box>
                                </Box>
                                
                                {/* Tratamientos del presupuesto */}
                                <Box sx={{ mb: 1.5 }}>
                                  {tratamientos.map((trat, idx) => (
                                    <Box key={idx} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5, borderBottom: idx < tratamientos.length - 1 ? '1px solid #FAEEDA' : 'none' }}>
                                      <Typography variant="body2" sx={{ color: '#555', fontSize: '0.8rem' }}>
                                        {trat.nombre || trat.tratamiento || 'Tratamiento'}
                                        {trat.sesiones > 1 ? ` (${trat.sesiones} ses.)` : ''}
                                      </Typography>
                                      <Typography variant="body2" sx={{ color: '#854F0B', fontWeight: 600, fontSize: '0.8rem' }}>
                                        S/ {Number(trat.precio || 0).toFixed(2)}
                                      </Typography>
                                    </Box>
                                  ))}
                                </Box>

                                {/* Resumen financiero del presupuesto */}
                                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                                  <Box sx={{ flex: 1, textAlign: 'center', backgroundColor: 'white', p: 1, borderRadius: 1, border: '1px solid #FAEEDA' }}>
                                    <Typography variant="caption" sx={{ color: '#666' }}>Total</Typography>
                                    <Typography variant="body2" sx={{ color: '#333', fontWeight: 600 }}>S/ {precioTotal.toFixed(2)}</Typography>
                                  </Box>
                                  {descuento > 0 && (
                                    <Box sx={{ flex: 1, textAlign: 'center', backgroundColor: 'white', p: 1, borderRadius: 1, border: '1px solid #FAEEDA' }}>
                                      <Typography variant="caption" sx={{ color: '#666' }}>Descuento</Typography>
                                      <Typography variant="body2" sx={{ color: '#f44336', fontWeight: 600 }}>-S/ {descuento.toFixed(2)}</Typography>
                                    </Box>
                                  )}
                                  <Box sx={{ flex: 1, textAlign: 'center', backgroundColor: 'white', p: 1, borderRadius: 1, border: '1px solid #FAEEDA' }}>
                                    <Typography variant="caption" sx={{ color: '#666' }}>Pagado</Typography>
                                    <Typography variant="body2" sx={{ color: '#4CAF50', fontWeight: 600 }}>S/ {pagado.toFixed(2)}</Typography>
                                  </Box>
                                  <Box sx={{ flex: 1, textAlign: 'center', backgroundColor: 'white', p: 1, borderRadius: 1, border: '1px solid #FAEEDA' }}>
                                    <Typography variant="caption" sx={{ color: '#666' }}>Saldo</Typography>
                                    <Typography variant="body2" sx={{ color: saldo > 0 ? '#ff9800' : '#4CAF50', fontWeight: 600 }}>S/ {saldo.toFixed(2)}</Typography>
                                  </Box>
                                </Box>
                              </Paper>
                            );
                          })}
                        </Box>
                      )}
                    </Box>
                  )}

                  {/* Tab 1: Tratamientos realizados */}
                  {tabDetalle === 1 && (
                    <Box>
                      {!detalleData || !detalleData.tratamientos || detalleData.tratamientos.length === 0 ? (
                        <Alert severity="info">No hay tratamientos realizados en el período seleccionado.</Alert>
                      ) : (
                        <TableContainer sx={{ backgroundColor: '#FDF8F0', borderRadius: 1, border: '1px solid #FAEEDA' }}>
                          <Table size="small">
                            <TableHead>
                              <TableRow sx={{ backgroundColor: '#FAEEDA' }}>
                                <TableCell sx={{ color: '#854F0B', fontWeight: 600 }}>Tratamiento</TableCell>
                                <TableCell align="center" sx={{ color: '#854F0B', fontWeight: 600 }}>Sesiones</TableCell>
                                <TableCell align="right" sx={{ color: '#854F0B', fontWeight: 600 }}>Ingresos</TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {detalleData.tratamientos.map((trat, idx) => (
                                <TableRow key={idx} sx={{ '&:hover': { backgroundColor: '#FAEEDA' } }}>
                                  <TableCell sx={{ color: '#333' }}>{trat.tratamiento_nombre}</TableCell>
                                  <TableCell align="center" sx={{ color: '#854F0B', fontWeight: 600 }}>{trat.total_sesiones}</TableCell>
                                  <TableCell align="right" sx={{ color: '#854F0B', fontWeight: 600 }}>
                                    S/ {Number(trat.total_ingresos || 0).toFixed(2)}
                                  </TableCell>
                                </TableRow>
                              ))}
                              <TableRow sx={{ backgroundColor: '#FAEEDA' }}>
                                <TableCell sx={{ color: '#854F0B', fontWeight: 700 }}>Total</TableCell>
                                <TableCell align="center" sx={{ color: '#854F0B', fontWeight: 700 }}>
                                  {detalleData.tratamientos.reduce((s, t) => s + t.total_sesiones, 0)}
                                </TableCell>
                                <TableCell align="right" sx={{ color: '#854F0B', fontWeight: 700 }}>
                                  S/ {Number(detalleData.totales?.total_ingresos || 0).toFixed(2)}
                                </TableCell>
                              </TableRow>
                            </TableBody>
                          </Table>
                        </TableContainer>
                      )}
                    </Box>
                  )}

                  {/* Tab 2: Historial de pagos */}
                  {tabDetalle === 2 && (
                    <Box>
                      {historialPagos.length === 0 ? (
                        <Alert severity="info">No hay pagos registrados para este especialista.</Alert>
                      ) : (
                        <TableContainer sx={{ backgroundColor: '#FDF8F0', borderRadius: 1, border: '1px solid #FAEEDA' }}>
                          <Table size="small">
                            <TableHead>
                              <TableRow sx={{ backgroundColor: '#FAEEDA' }}>
                                <TableCell sx={{ color: '#854F0B', fontWeight: 600 }}>Fecha</TableCell>
                                <TableCell align="right" sx={{ color: '#854F0B', fontWeight: 600 }}>Monto</TableCell>
                                <TableCell sx={{ color: '#854F0B', fontWeight: 600 }}>Método</TableCell>
                                <TableCell sx={{ color: '#854F0B', fontWeight: 600 }}>Referencia</TableCell>
                                <TableCell sx={{ color: '#854F0B', fontWeight: 600 }}>Estado</TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {historialPagos.map((pago) => (
                                <TableRow key={pago.id} sx={{ '&:hover': { backgroundColor: '#FAEEDA' } }}>
                                  <TableCell sx={{ color: '#333' }}>{pago.fecha_pago}</TableCell>
                                  <TableCell align="right" sx={{ color: '#4CAF50', fontWeight: 600 }}>
                                    S/ {Number(pago.monto || 0).toFixed(2)}
                                  </TableCell>
                                  <TableCell sx={{ color: '#555', textTransform: 'capitalize' }}>{pago.metodo_pago || '-'}</TableCell>
                                  <TableCell sx={{ color: '#555' }}>{pago.referencia || '-'}</TableCell>
                                  <TableCell>
                                    <Chip label={pago.estado || 'pagado'} size="small" sx={{ backgroundColor: '#4CAF5020', color: '#4CAF50', fontSize: '0.7rem', fontWeight: 600, textTransform: 'capitalize' }} />
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </TableContainer>
                      )}
                    </Box>
                  )}
                </>
              )}
            </DialogContent>
          </>
        )}
      </Dialog>

      {/* Modal: Registrar Pago */}
      <Dialog
        open={modalPago.abierto}
        onClose={() => setModalPago({ abierto: false, trabajador: null })}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ color: '#854F0B', fontWeight: 600 }}>
          Registrar pago - {modalPago.trabajador?.especialista_nombre}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              label="Monto (S/)"
              type="number"
              value={datoPago.monto}
              onChange={(e) => setDatoPago(prev => ({ ...prev, monto: parseFloat(e.target.value) || 0 }))}
              fullWidth
              size="small"
            />
            <TextField
              label="Fecha"
              type="date"
              value={datoPago.fecha}
              onChange={(e) => setDatoPago(prev => ({ ...prev, fecha: e.target.value }))}
              fullWidth
              size="small"
              InputLabelProps={{ shrink: true }}
            />
            <FormControl fullWidth size="small">
              <InputLabel>Método de pago</InputLabel>
              <Select
                value={datoPago.metodo}
                onChange={(e) => setDatoPago(prev => ({ ...prev, metodo: e.target.value }))}
                label="Método de pago"
              >
                <MenuItem value="transferencia">Transferencia</MenuItem>
                <MenuItem value="efectivo">Efectivo</MenuItem>
                <MenuItem value="yape">Yape</MenuItem>
                <MenuItem value="plin">Plin</MenuItem>
              </Select>
            </FormControl>
            <TextField
              label="Referencia (opcional)"
              value={datoPago.referencia}
              onChange={(e) => setDatoPago(prev => ({ ...prev, referencia: e.target.value }))}
              fullWidth
              size="small"
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setModalPago({ abierto: false, trabajador: null })} sx={{ color: '#666' }}>
            Cancelar
          </Button>
          <Button 
            variant="contained" 
            onClick={registrarPago}
            sx={{ backgroundColor: '#854F0B', '&:hover': { backgroundColor: '#6B3F08' } }}
          >
            Registrar pago
          </Button>
        </DialogActions>
      </Dialog>

      {/* Modal: Edición Rápida desde Card */}
      <Dialog
        open={modalEditarCard.abierto}
        onClose={() => setModalEditarCard({ abierto: false, trabajador: null })}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ color: '#854F0B', fontWeight: 600 }}>
          Editar datos - {modalEditarCard.trabajador?.especialista_nombre}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            {/* Foto de perfil */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, p: 2, backgroundColor: '#FDF8F0', borderRadius: 2 }}>
              <Avatar
                src={datoEditarCard.foto_perfil || ''}
                sx={{ width: 100, height: 100, border: '3px solid #FAEEDA' }}
              >
                {!datoEditarCard.foto_perfil && (datoEditarCard.nombre?.[0] || 'U')}
              </Avatar>
              <Box sx={{ flex: 1 }}>
                <Typography variant="body2" sx={{ color: '#666', mb: 1 }}>Foto de perfil</Typography>
                <Button
                  variant="outlined"
                  component="label"
                  size="small"
                  disabled={subiendoFoto}
                  sx={{ borderColor: '#854F0B', color: '#854F0B' }}
                >
                  {subiendoFoto ? 'Subiendo...' : 'Subir foto'}
                  <input
                    type="file"
                    hidden
                    accept="image/*"
                    onChange={subirFotoPerfil}
                  />
                </Button>
              </Box>
            </Box>

            <Grid container spacing={2}>
              <Grid item xs={6}>
                <TextField
                  label="Nombre"
                  value={datoEditarCard.nombre}
                  onChange={(e) => setDatoEditarCard(prev => ({ ...prev, nombre: e.target.value }))}
                  fullWidth
                  size="small"
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  label="Apellido"
                  value={datoEditarCard.apellido}
                  onChange={(e) => setDatoEditarCard(prev => ({ ...prev, apellido: e.target.value }))}
                  fullWidth
                  size="small"
                />
              </Grid>
            </Grid>

            <TextField
              label="Especialidad"
              value={datoEditarCard.especialidad}
              onChange={(e) => setDatoEditarCard(prev => ({ ...prev, especialidad: e.target.value }))}
              fullWidth
              size="small"
              placeholder="Ej: Medicina estética"
            />

            <TextField
              label="Cuenta bancaria"
              value={datoEditarCard.cuenta_bancaria}
              onChange={(e) => setDatoEditarCard(prev => ({ ...prev, cuenta_bancaria: e.target.value }))}
              fullWidth
              size="small"
              placeholder="Ej: BCP 123-456789-0-12"
            />

            <Grid container spacing={2}>
              <Grid item xs={6}>
                <TextField
                  label="Pago fijo mensual (S/)"
                  type="number"
                  value={datoEditarCard.pago_fijo}
                  onChange={(e) => setDatoEditarCard(prev => ({ ...prev, pago_fijo: parseFloat(e.target.value) || 0 }))}
                  fullWidth
                  size="small"
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  label="Comisión (%)"
                  type="number"
                  value={datoEditarCard.comision_porcentaje}
                  onChange={(e) => setDatoEditarCard(prev => ({ ...prev, comision_porcentaje: parseFloat(e.target.value) || 0 }))}
                  fullWidth
                  size="small"
                  inputProps={{ min: 0, max: 100, step: 1 }}
                />
              </Grid>
            </Grid>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setModalEditarCard({ abierto: false, trabajador: null })} sx={{ color: '#666' }}>
            Cancelar
          </Button>
          <Button 
            variant="contained" 
            onClick={guardarEdicionCard}
            sx={{ backgroundColor: '#854F0B', '&:hover': { backgroundColor: '#6B3F08' } }}
          >
            Guardar cambios
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default GestionPersonalCards;
