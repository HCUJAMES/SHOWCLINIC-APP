import React, { useEffect, useState } from "react";
import {
  Container,
  Typography,
  TextField,
  Button,
  Grid,
  Paper,
  Avatar,
  Table,
  TableContainer,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Divider,
  Box,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
} from "@mui/material";
import { ArrowBack, Home, Receipt, Edit, Delete } from "@mui/icons-material";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { useToast } from "../components/ToastProvider";
import ReciboTicket from "../components/ReciboTicket";
import ReciboConsolidado from "../components/ReciboConsolidado";

 const API_BASE_URL = `${window.location.protocol}//${window.location.hostname}:4000`;

const loadImage = (src) =>
  new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });

const makeCircularImageDataUrl = (img, sizePx = 256, borderPx = 10) => {
  if (!img) return null;
  const canvas = document.createElement("canvas");
  canvas.width = sizePx;
  canvas.height = sizePx;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const innerSize = sizePx - borderPx * 2;
  const r = innerSize / 2;
  const cx = sizePx / 2;
  const cy = sizePx / 2;

  ctx.clearRect(0, 0, sizePx, sizePx);

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();

  const scale = Math.max(innerSize / img.width, innerSize / img.height);
  const w = img.width * scale;
  const h = img.height * scale;
  const x = cx - w / 2;
  const y = cy - h / 2;
  ctx.drawImage(img, x, y, w, h);
  ctx.restore();

  ctx.beginPath();
  ctx.arc(cx, cy, r + borderPx / 2, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(255,255,255,0.92)";
  ctx.lineWidth = borderPx;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(cx, cy, r + borderPx, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(0,0,0,0.10)";
  ctx.lineWidth = 1;
  ctx.stroke();

  return canvas.toDataURL("image/png");
};

const CAMPOS_FOTOS_ANTES = ["foto_antes1", "foto_antes2", "foto_antes3"];
const CAMPOS_FOTOS_DESPUES = ["foto_despues1", "foto_despues2", "foto_despues3"];
const CAMPOS_FOTOS_LEGACY = [
  "foto_izquierda",
  "foto_frontal",
  "foto_derecha",
  "foto_extra1",
  "foto_extra2",
  "foto_extra3",
];

const HistorialClinico = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [pacientes, setPacientes] = useState([]);
  const [filtro, setFiltro] = useState("");
  const [pacienteSeleccionado, setPacienteSeleccionado] = useState(null);
  const [tratamientos, setTratamientos] = useState([]);
  const [resumenDeuda, setResumenDeuda] = useState({ cantidad_pendiente: 0, total_pendiente: 0 });
  const [nuevaObservacion, setNuevaObservacion] = useState("");
  const [observaciones, setObservaciones] = useState([]);
  const [guardandoObservaciones, setGuardandoObservaciones] = useState(false);
  const [observacionEditId, setObservacionEditId] = useState(null);
  const [observacionEditTexto, setObservacionEditTexto] = useState("");
  const [guardandoObservacionEdit, setGuardandoObservacionEdit] = useState(false);
  const [tratamientosBase, setTratamientosBase] = useState([]);
  const [showOferta, setShowOferta] = useState(false);
  const [ofertaItems, setOfertaItems] = useState([]);
  const [guardandoOferta, setGuardandoOferta] = useState(false);
  const [ofertas, setOfertas] = useState([]);
  const [ofertaEditId, setOfertaEditId] = useState(null);
  const [subiendoFotoPerfil, setSubiendoFotoPerfil] = useState(false);
  const [fotosTratamiento, setFotosTratamiento] = useState([]);
  const [tratamientoSeleccionado, setTratamientoSeleccionado] = useState(null);

  // Estado para modal de recibo
  const [openReciboModal, setOpenReciboModal] = useState(false);
  const [datosRecibo, setDatosRecibo] = useState(null);

  // Estado para modal de recibo consolidado
  const [openReciboConsolidado, setOpenReciboConsolidado] = useState(false);
  const [datosReciboConsolidado, setDatosReciboConsolidado] = useState(null);

  // Estados para editar tratamiento
  const [openEditarModal, setOpenEditarModal] = useState(false);
  const [tratamientoEditar, setTratamientoEditar] = useState(null);
  const [editEspecialista, setEditEspecialista] = useState("");
  const [editSesion, setEditSesion] = useState(1);
  const [editPrecio, setEditPrecio] = useState(0);
  const [editDescuento, setEditDescuento] = useState(0);
  const [editPagoMetodo, setEditPagoMetodo] = useState("Efectivo");
  const [editTipoAtencion, setEditTipoAtencion] = useState("Tratamiento");

  // Estados para confirmar cancelación
  const [openConfirmarCancelar, setOpenConfirmarCancelar] = useState(false);
  const [tratamientoCancelar, setTratamientoCancelar] = useState(null);

  const token = localStorage.getItem("token");
  const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};

  useEffect(() => {
    axios
      .get(`${API_BASE_URL}/api/pacientes/listar`, { headers: authHeaders })
      .then((res) => setPacientes(res.data))
      .catch((err) => console.error("Error al obtener pacientes:", err));

    axios
      .get(`${API_BASE_URL}/api/tratamientos/listar`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      .then((res) => setTratamientosBase(Array.isArray(res.data) ? res.data : []))
      .catch((err) => {
        console.error("Error al obtener tratamientos base:", err);
        setTratamientosBase([]);
      });
  }, []);

  const cargarHistorial = async (id) => {
    try {
      const paciente = pacientes.find((p) => p.id === id) || null;
      setPacienteSeleccionado(paciente);
      setResumenDeuda({ cantidad_pendiente: 0, total_pendiente: 0 });

      setNuevaObservacion("");
      setShowOferta(false);
      setOfertaItems([]);
      setOfertaEditId(null);
      setObservacionEditId(null);
      setObservacionEditTexto("");
      try {
        const obsRes = await axios.get(`${API_BASE_URL}/api/pacientes/${id}/observaciones`, {
          headers: authHeaders,
        });
        setObservaciones(Array.isArray(obsRes.data) ? obsRes.data : []);
      } catch (e) {
        console.error("Error al obtener observaciones:", e);
        setObservaciones([]);
      }

      try {
        const ofertasRes = await axios.get(`${API_BASE_URL}/api/pacientes/${id}/ofertas`, {
          headers: authHeaders,
        });
        setOfertas(Array.isArray(ofertasRes.data) ? ofertasRes.data : []);
      } catch (e) {
        console.error("Error al obtener ofertas:", e);
        setOfertas([]);
      }

      try {
        const deudaRes = await axios.get(`${API_BASE_URL}/api/deudas/resumen/${id}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        setResumenDeuda({
          cantidad_pendiente: Number(deudaRes?.data?.cantidad_pendiente || 0),
          total_pendiente: Number(deudaRes?.data?.total_pendiente || 0),
        });
      } catch (e) {
        console.error("Error al obtener resumen de deuda:", e);
        setResumenDeuda({ cantidad_pendiente: 0, total_pendiente: 0 });
      }

      const res = await axios.get(`${API_BASE_URL}/api/tratamientos/historial/${id}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      setTratamientos(res.data);
    } catch (error) {
      console.error("Error al obtener historial clínico:", error);
    }
  };

  const subirFotoPerfil = async (file) => {
    if (!pacienteSeleccionado?.id || !file) return;
    try {
      setSubiendoFotoPerfil(true);
      const formData = new FormData();
      formData.append("foto", file);
      const res = await axios.post(
        `${API_BASE_URL}/api/pacientes/${pacienteSeleccionado.id}/foto-perfil`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
            ...authHeaders,
          },
        }
      );

      const fotoPerfil = res?.data?.fotoPerfil;
      if (fotoPerfil) {
        const updated = { ...pacienteSeleccionado, fotoPerfil };
        setPacienteSeleccionado(updated);
        setPacientes((prev) =>
          prev.map((p) => (p.id === updated.id ? { ...p, fotoPerfil } : p))
        );
      }

      showToast({ severity: "success", message: "Foto de perfil actualizada" });
    } catch (e) {
      console.error("Error al subir foto de perfil:", e);
      showToast({ severity: "error", message: "Error al subir foto de perfil" });
    } finally {
      setSubiendoFotoPerfil(false);
    }
  };

  const guardarEdicionObservacion = async () => {
    if (!pacienteSeleccionado?.id) return;
    if (!observacionEditId) return;

    try {
      setGuardandoObservacionEdit(true);
      await axios.put(
        `${API_BASE_URL}/api/pacientes/${pacienteSeleccionado.id}/observaciones/${observacionEditId}`,
        { texto: observacionEditTexto },
        { headers: authHeaders }
      );

      const obsRes = await axios.get(
        `${API_BASE_URL}/api/pacientes/${pacienteSeleccionado.id}/observaciones`,
        { headers: authHeaders }
      );
      setObservaciones(Array.isArray(obsRes.data) ? obsRes.data : []);
      setObservacionEditId(null);
      setObservacionEditTexto("");
      showToast({ severity: "success", message: "Observación actualizada" });
    } catch (e) {
      console.error("Error al editar observación:", e);
      showToast({ severity: "error", message: "Error al editar observación" });
    } finally {
      setGuardandoObservacionEdit(false);
    }
  };

  const toggleOfertaItem = (t) => {
    setOfertaItems((prev) => {
      const exists = prev.some((x) => x.tratamientoId === t.id);
      if (exists) return prev.filter((x) => x.tratamientoId !== t.id);
      return [...prev, { tratamientoId: t.id, nombre: t.nombre, precio: "" }];
    });
  };

  const setOfertaPrecio = (tratamientoId, value) => {
    setOfertaItems((prev) =>
      prev.map((x) =>
        x.tratamientoId === tratamientoId ? { ...x, precio: value } : x
      )
    );
  };

  const totalOferta = ofertaItems.reduce((sum, it) => {
    const n = Number(it.precio);
    return sum + (Number.isFinite(n) ? n : 0);
  }, 0);

  const guardarOferta = async () => {
    if (!pacienteSeleccionado?.id) return;
    if (!ofertaItems.length) {
      showToast({ severity: "warning", message: "Selecciona al menos un tratamiento" });
      return;
    }
    try {
      setGuardandoOferta(true);
      const payload = {
        items: ofertaItems.map((it) => ({
          tratamientoId: it.tratamientoId,
          nombre: it.nombre,
          precio: it.precio,
        })),
      };

      if (ofertaEditId) {
        await axios.put(
          `${API_BASE_URL}/api/pacientes/${pacienteSeleccionado.id}/ofertas/${ofertaEditId}`,
          payload,
          { headers: authHeaders }
        );
      } else {
        await axios.post(
          `${API_BASE_URL}/api/pacientes/${pacienteSeleccionado.id}/ofertas`,
          payload,
          { headers: authHeaders }
        );
      }

      const ofertasRes = await axios.get(
        `${API_BASE_URL}/api/pacientes/${pacienteSeleccionado.id}/ofertas`,
        { headers: authHeaders }
      );
      setOfertas(Array.isArray(ofertasRes.data) ? ofertasRes.data : []);
      setOfertaItems([]);
      setShowOferta(false);
      setOfertaEditId(null);
      showToast({ severity: "success", message: ofertaEditId ? "Oferta actualizada" : "Oferta guardada" });
    } catch (e) {
      console.error("Error al guardar oferta:", e);
      showToast({ severity: "error", message: "Error al guardar oferta" });
    } finally {
      setGuardandoOferta(false);
    }
  };

  const guardarObservacion = async () => {
    if (!pacienteSeleccionado?.id) return;
    try {
      setGuardandoObservaciones(true);
      await axios.post(
        `${API_BASE_URL}/api/pacientes/${pacienteSeleccionado.id}/observaciones`,
        { texto: nuevaObservacion },
        { headers: authHeaders }
      );

      const obsRes = await axios.get(
        `${API_BASE_URL}/api/pacientes/${pacienteSeleccionado.id}/observaciones`,
        { headers: authHeaders }
      );
      setObservaciones(Array.isArray(obsRes.data) ? obsRes.data : []);
      setNuevaObservacion("");
      showToast({ severity: "success", message: "Observación guardada" });
    } catch (error) {
      console.error("Error al guardar observación:", error);
      showToast({ severity: "error", message: "Error al guardar observación" });
    } finally {
      setGuardandoObservaciones(false);
    }
  };

  const manejarCambioFotos = (e) => {
    const archivos = Array.from(e.target.files || []);
    if (archivos.length > 3) {
      showToast({ severity: "warning", message: "Solo puedes subir hasta 3 fotos por tratamiento" });
    }
    setFotosTratamiento(archivos.slice(0, 3));
  };

  const subirFotos = async (tratamientoId) => {
    if (!fotosTratamiento.length) {
      showToast({ severity: "warning", message: "Selecciona hasta 3 fotos para subir" });
      return;
    }

    const data = new FormData();
    fotosTratamiento.forEach((f) => data.append("fotos", f));

    try {
      await axios.post(
        `${API_BASE_URL}/api/tratamientos/subir-fotos/${tratamientoId}`,
        data,
        {
          headers: {
            "Content-Type": "multipart/form-data",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        }
      );
      showToast({ severity: "success", message: "Fotos agregadas correctamente" });
      setFotosTratamiento([]);
      setTratamientoSeleccionado(null);
      cargarHistorial(pacienteSeleccionado.id);
    } catch (err) {
      console.error("Error al subir fotos:", err);
      const status = err?.response?.status;
      const message = err?.response?.data?.message;
      showToast({
        severity: "error",
        message: message ? `Error al subir fotos${status ? ` (${status})` : ""}: ${message}` : "Error al subir fotos",
      });
    }
  };

  const abrirFotosPaciente = (tratamientoRealizadoId) => {
    if (!pacienteSeleccionado?.id) return;
    const url = `/fotos-paciente?pacienteId=${pacienteSeleccionado.id}&tratamientoRealizadoId=${tratamientoRealizadoId}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const pacientesFiltrados = pacientes.filter(
    (p) =>
      p.nombre.toLowerCase().includes(filtro.toLowerCase()) ||
      p.apellido.toLowerCase().includes(filtro.toLowerCase())
  );

  const totalGeneral = tratamientos.reduce(
    (acc, t) => acc + Number(t.precio_total || t.precioTotal || 0),
    0
  );

  const generarPDF = async () => {
    if (!pacienteSeleccionado) return;

    const doc = new jsPDF("p", "pt", "a4");
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const colorPrincipal = [163, 105, 32];
    const margenX = 40;
    const headerHeight = 92;

    const logo = "/images/logo-showclinic.png";
    const img = await loadImage(logo);
    const logoCircular = makeCircularImageDataUrl(img, 256, 10);

    const p = pacienteSeleccionado;
    const datosPaciente = [
      ["DNI", p.dni || "-"],
      ["Nombre", `${p.nombre || ""} ${p.apellido || ""}`.trim()],
      ["Edad", p.edad ?? "-"],
      ["Sexo", p.sexo || "-"],
      ["Embarazada", p.embarazada || "No especifica"],
      ["Ocupación", p.ocupacion || "-"],
      ["Correo", p.correo || "-"],
      ["Celular", p.celular || "-"],
      ["Dirección", p.direccion || "-"],
      ["Ciudad Nacimiento", p.ciudadNacimiento || "-"],
      ["Ciudad Residencia", p.ciudadResidencia || "-"],
      ["Alergias", p.alergias || "Ninguna"],
      ["Enfermedades", p.enfermedad || "Ninguna"],
      ["Cirugía Estética", p.cirugiaEstetica || "No"],
      ["Tabaco", p.tabaco || "No"],
      ["Alcohol", p.alcohol || "No"],
      ["Drogas", p.drogas || "No"],
      ["Referencia", p.referencia || "No especificada"],
      ["Número de hijos", p.numeroHijos ?? "No registrado"],
    ];

    const tabla = tratamientos.map((t) => [
      t.fecha ? t.fecha.split(" ")[0] : "-",
      t.nombreTratamiento || "—",
      t.tipoAtencion || "-",
      t.especialista || "No especificado",
      `S/ ${(t.precio_total || 0).toFixed(2)}`,
      `${t.descuento || 0}%`,
      t.pagoMetodo || "-",
      t.sesion ?? "-",
    ]);

    const didDrawHeaderFooter = (data) => {
      doc.setFillColor(...colorPrincipal);
      doc.rect(0, 0, pageWidth, headerHeight, "F");

      if (logoCircular) {
        const logoSize = 54;
        doc.addImage(logoCircular, "PNG", margenX, 20, logoSize, logoSize);
      }

      doc.setFont("helvetica", "bold");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(18);
      doc.text("Historial Clínico", margenX + 72, 46);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text(
        `Emitido: ${new Date().toLocaleDateString()}`,
        pageWidth - margenX,
        64,
        { align: "right" }
      );

      doc.setDrawColor(220);
      doc.line(margenX, headerHeight + 6, pageWidth - margenX, headerHeight + 6);

      doc.setTextColor(120);
      doc.setFontSize(9);
      doc.text(`Página ${data.pageNumber}`, pageWidth - margenX, pageHeight - 22, {
        align: "right",
      });
      doc.text("ShowClinic CRM", margenX, pageHeight - 22);
    };

    const startDatosY = headerHeight + 24;
    const gap = 14;
    const tablaW = (pageWidth - margenX * 2 - gap) / 2;
    const labelW = 130;
    const valueW = tablaW - labelW;
    const mitad = Math.ceil(datosPaciente.length / 2);
    const datosIzq = datosPaciente.slice(0, mitad);
    const datosDer = datosPaciente.slice(mitad);

    autoTable(doc, {
      margin: { top: headerHeight + 16, left: margenX, right: margenX },
      startY: startDatosY,
      tableWidth: tablaW,
      theme: "plain",
      styles: { fontSize: 10, cellPadding: 3, textColor: 30 },
      body: datosIzq,
      columnStyles: {
        0: { cellWidth: labelW, fontStyle: "bold", textColor: colorPrincipal },
        1: { cellWidth: valueW },
      },
      didDrawPage: didDrawHeaderFooter,
    });
    const finalYIzq = doc.lastAutoTable.finalY;

    autoTable(doc, {
      margin: {
        top: headerHeight + 16,
        left: margenX + tablaW + gap,
        right: margenX,
      },
      startY: startDatosY,
      tableWidth: tablaW,
      theme: "plain",
      styles: { fontSize: 10, cellPadding: 3, textColor: 30 },
      body: datosDer,
      columnStyles: {
        0: { cellWidth: labelW, fontStyle: "bold", textColor: colorPrincipal },
        1: { cellWidth: valueW },
      },
      didDrawPage: didDrawHeaderFooter,
    });
    const finalYDer = doc.lastAutoTable.finalY;

    const startTabla = Math.max(finalYIzq, finalYDer) + 20;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(...colorPrincipal);
    doc.text("Tratamientos Realizados", margenX, startTabla);

    autoTable(doc, {
      startY: startTabla + 10,
      margin: { left: margenX, right: margenX },
      head: [
        [
          "Fecha",
          "Tratamiento",
          "Tipo Atención",
          "Especialista",
          "Total",
          "Desc.",
          "Pago",
          "Sesión",
        ],
      ],
      body: tabla,
      theme: "striped",
      headStyles: { fillColor: colorPrincipal, textColor: 255, fontStyle: "bold" },
      styles: { fontSize: 9, cellPadding: 4, valign: "middle" },
      alternateRowStyles: { fillColor: [247, 242, 234] },
      columnStyles: {
        0: { cellWidth: 60 },
        4: { halign: "right", cellWidth: 55 },
        5: { halign: "center", cellWidth: 40 },
        7: { halign: "center", cellWidth: 40 },
      },
      didDrawPage: didDrawHeaderFooter,
    });

    const startObs = doc.lastAutoTable.finalY + 26;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(...colorPrincipal);
    doc.text("Otras observaciones", margenX, startObs);

    const obsRows = (Array.isArray(observaciones) ? observaciones : []).map((o) => [
      o?.creado_en || "-",
      o?.texto || "",
    ]);

    if (obsRows.length > 0) {
      autoTable(doc, {
        startY: startObs + 10,
        margin: { left: margenX, right: margenX },
        head: [["Fecha", "Observación"]],
        body: obsRows,
        theme: "striped",
        headStyles: { fillColor: colorPrincipal, textColor: 255, fontStyle: "bold" },
        styles: { fontSize: 9, cellPadding: 4, valign: "top" },
        alternateRowStyles: { fillColor: [247, 242, 234] },
        columnStyles: {
          0: { cellWidth: 90 },
          1: { cellWidth: "auto" },
        },
        didDrawPage: didDrawHeaderFooter,
      });
    } else {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(60);
      doc.text("Sin observaciones registradas.", margenX, startObs + 26);
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...colorPrincipal);
    doc.text(
      `Total general: S/ ${totalGeneral.toFixed(2)}`,
      pageWidth - margenX,
      (doc.lastAutoTable?.finalY || startObs + 26) + 22,
      { align: "right" }
    );

    doc.save(`Historial_${p.nombre}_${p.apellido}.pdf`);
  };

  // Función para abrir modal de recibo de un tratamiento específico
  const abrirReciboTratamiento = (tratamiento) => {
    setDatosRecibo({
      paciente: pacienteSeleccionado,
      tratamiento: {
        nombre: tratamiento.nombreTratamiento,
        precio: tratamiento.precio_total,
      },
      especialista: tratamiento.especialista,
      fecha: tratamiento.fecha?.split(" ")[0] || new Date().toLocaleDateString("es-PE"),
      pagoMetodo: tratamiento.pagoMetodo,
      sesion: tratamiento.sesion,
      total: tratamiento.precio_total,
      descuento: tratamiento.descuento || 0,
    });
    setOpenReciboModal(true);
  };

  // Función para abrir modal de recibo consolidado por fecha
  const abrirReciboConsolidadoPorFecha = (fecha) => {
    // Filtrar tratamientos de la misma fecha
    const tratamientosMismaFecha = tratamientos.filter(t => {
      const fechaTratamiento = t.fecha?.split(" ")[0];
      return fechaTratamiento === fecha;
    });

    if (tratamientosMismaFecha.length === 0) return;

    // Preparar datos para el recibo consolidado
    const tratamientosRecibo = tratamientosMismaFecha.map(t => ({
      nombre: t.nombreTratamiento,
      especialista: t.especialista,
      sesion: t.sesion,
      precio: t.precio_total,
      descuento: t.descuento || 0,
      total: t.precio_total,
      pagoMetodo: t.pagoMetodo,
    }));

    const totalGeneral = tratamientosMismaFecha.reduce((sum, t) => sum + (t.precio_total || 0), 0);

    setDatosReciboConsolidado({
      paciente: pacienteSeleccionado,
      tratamientos: tratamientosRecibo,
      fecha: fecha,
      totalGeneral: totalGeneral,
    });
    setOpenReciboConsolidado(true);
  };

  // Agrupar tratamientos por fecha
  const tratamientosPorFecha = tratamientos.reduce((acc, t) => {
    const fecha = t.fecha?.split(" ")[0];
    if (!acc[fecha]) {
      acc[fecha] = [];
    }
    acc[fecha].push(t);
    return acc;
  }, {});

  // Función para abrir modal de edición
  const abrirEditarTratamiento = (tratamiento) => {
    setTratamientoEditar(tratamiento);
    setEditEspecialista(tratamiento.especialista || "");
    setEditSesion(tratamiento.sesion || 1);
    setEditPrecio(tratamiento.precio_total || 0);
    setEditDescuento(tratamiento.descuento || 0);
    setEditPagoMetodo(tratamiento.pagoMetodo || "Efectivo");
    setEditTipoAtencion(tratamiento.tipoAtencion || "Tratamiento");
    setOpenEditarModal(true);
  };

  // Función para guardar cambios del tratamiento
  const guardarEditarTratamiento = async () => {
    if (!tratamientoEditar) return;

    try {
      await axios.put(
        `${API_BASE_URL}/api/tratamientos/realizado/${tratamientoEditar.id}`,
        {
          especialista: editEspecialista,
          sesion: editSesion,
          precio_total: editPrecio,
          descuento: editDescuento,
          pagoMetodo: editPagoMetodo,
          tipoAtencion: editTipoAtencion,
        },
        { headers: authHeaders }
      );

      showToast({ severity: "success", message: "Tratamiento actualizado correctamente" });
      setOpenEditarModal(false);
      cargarHistorial(pacienteSeleccionado.id);
    } catch (error) {
      console.error("Error al editar tratamiento:", error);
      const mensaje = error.response?.data?.message || "Error al editar tratamiento";
      showToast({ severity: "error", message: mensaje });
    }
  };

  // Función para abrir confirmación de cancelación
  const abrirConfirmacionCancelar = (tratamiento) => {
    setTratamientoCancelar(tratamiento);
    setOpenConfirmarCancelar(true);
  };

  // Función para cancelar tratamiento
  const cancelarTratamiento = async () => {
    if (!tratamientoCancelar) return;

    try {
      await axios.delete(
        `${API_BASE_URL}/api/tratamientos/realizado/${tratamientoCancelar.id}`,
        { headers: authHeaders }
      );

      showToast({ severity: "success", message: "Tratamiento cancelado correctamente" });
      setOpenConfirmarCancelar(false);
      cargarHistorial(pacienteSeleccionado.id);
    } catch (error) {
      console.error("Error al cancelar tratamiento:", error);
      const mensaje = error.response?.data?.message || "Error al cancelar tratamiento";
      showToast({ severity: "error", message: mensaje });
    }
  };

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
            p: 5,
            borderRadius: "15px",
            background:
              "linear-gradient(180deg, rgba(255,249,236,0.98) 0%, rgba(255,255,255,0.92) 52%, rgba(247,234,193,0.55) 100%)",
            border: "1px solid rgba(212,175,55,0.22)",
            backdropFilter: "blur(10px)",
            boxShadow:
              "0 18px 46px rgba(0,0,0,0.14), 0 0 0 1px rgba(212,175,55,0.10)",
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", mb: 3 }}>
            <IconButton onClick={() => navigate("/pacientes")} sx={{ color: "#a36920" }}>
              <ArrowBack />
            </IconButton>
            <Typography
              variant="h5"
              sx={{ flex: 1, color: "#a36920", fontWeight: "bold", textAlign: "center" }}
            >
              Historial Clínico de Pacientes
            </Typography>
            <IconButton onClick={() => navigate("/dashboard")} sx={{ color: "#a36920" }} title="Inicio">
              <Home />
            </IconButton>
          </Box>

          {!pacienteSeleccionado ? (
            <>
              <Box
                sx={{
                  display: "flex",
                  flexDirection: { xs: "column", md: "row" },
                  gap: 2,
                  alignItems: { xs: "stretch", md: "center" },
                  justifyContent: "space-between",
                  mb: 3,
                }}
              >
                <TextField
                  label="Buscar paciente"
                  placeholder="Escribe nombre o apellido"
                  fullWidth
                  value={filtro}
                  onChange={(e) => setFiltro(e.target.value)}
                  sx={{
                    flex: 1,
                    "& .MuiInputBase-root": {
                      backgroundColor: "rgba(255,255,255,0.72)",
                      borderRadius: 2,
                    },
                  }}
                />
                <Box
                  sx={{
                    minWidth: { xs: "auto", md: 240 },
                    textAlign: { xs: "left", md: "right" },
                  }}
                >
                  <Typography
                    variant="body2"
                    sx={{ color: "rgba(0,0,0,0.60)", lineHeight: 1.4 }}
                  >
                    Selecciona un paciente para ver tratamientos,
                    cargar fotos y exportar PDF.
                  </Typography>
                </Box>
              </Box>

              <Grid container spacing={2.2}>
                {pacientesFiltrados.map((pac) => (
                  <Grid item xs={12} md={6} key={pac.id}>
                    <Paper
                      sx={{
                        p: 2.2,
                        display: "flex",
                        gap: 2,
                        justifyContent: "space-between",
                        alignItems: "center",
                        borderRadius: 3,
                        border: "1px solid rgba(212,175,55,0.22)",
                        backgroundColor: "rgba(255,255,255,0.70)",
                        boxShadow: "0 10px 24px rgba(0,0,0,0.08)",
                      }}
                    >
                      <Box sx={{ minWidth: 0 }}>
                        <Typography
                          fontWeight="bold"
                          sx={{ color: "#2E2E2E", lineHeight: 1.15 }}
                        >
                          {pac.nombre} {pac.apellido}
                        </Typography>
                        <Typography
                          variant="body2"
                          sx={{ color: "rgba(0,0,0,0.60)", mt: 0.4 }}
                        >
                          DNI: {pac.dni}
                        </Typography>
                      </Box>
                      <Button
                        variant="contained"
                        sx={{
                          backgroundColor: "#a36920",
                          "&:hover": { backgroundColor: "#8b581b" },
                          borderRadius: 3,
                          px: 2.4,
                          py: 1.0,
                          fontWeight: "bold",
                        }}
                        onClick={() => cargarHistorial(pac.id)}
                      >
                        Ver historial
                      </Button>
                    </Paper>
                  </Grid>
                ))}
              </Grid>
            </>
          ) : (
            <>
              <Box
                sx={{
                  display: "flex",
                  flexDirection: { xs: "column", sm: "row" },
                  alignItems: { xs: "stretch", sm: "center" },
                  justifyContent: "space-between",
                  gap: 1.5,
                  mb: 3,
                }}
              >
                <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap" }}>
                  <Button
                    variant="outlined"
                    onClick={() => setPacienteSeleccionado(null)}
                    sx={{
                      borderColor: "#a36920",
                      color: "#a36920",
                      borderRadius: 3,
                      "&:hover": { backgroundColor: "#f7f2ea" },
                      fontWeight: "bold",
                    }}
                  >
                    Volver
                  </Button>
                  <Button
                    variant="contained"
                    sx={{
                      backgroundColor: "#a36920",
                      "&:hover": { backgroundColor: "#8b581b" },
                      borderRadius: 3,
                      fontWeight: "bold",
                    }}
                    onClick={generarPDF}
                  >
                    Exportar PDF
                  </Button>
                </Box>

                <Box sx={{ textAlign: { xs: "left", sm: "right" } }}>
                  <Typography
                    variant="body2"
                    sx={{ color: "rgba(0,0,0,0.62)", lineHeight: 1.4 }}
                  >
                    {pacienteSeleccionado.nombre} {pacienteSeleccionado.apellido}
                  </Typography>
                  <Typography variant="caption" sx={{ color: "rgba(0,0,0,0.52)" }}>
                    DNI: {pacienteSeleccionado.dni}
                  </Typography>

                  {Number(resumenDeuda?.total_pendiente || 0) > 0 ? (
                    <Typography
                      variant="caption"
                      sx={{
                        display: "inline-block",
                        mt: 0.5,
                        px: 1,
                        py: 0.25,
                        borderRadius: 1.5,
                        backgroundColor: "rgba(183,28,28,0.10)",
                        color: "#b71c1c",
                        fontWeight: 800,
                      }}
                    >
                      Deuda pendiente: S/ {Number(resumenDeuda.total_pendiente || 0).toFixed(2)}
                    </Typography>
                  ) : null}
                </Box>
              </Box>

              {/* Información completa del paciente */}
              <Typography
                variant="h6"
                sx={{ color: "#a36920", fontWeight: "bold", mb: 2 }}
              >
                Información completa del paciente
              </Typography>

              <Paper
                elevation={0}
                sx={{
                  mb: 4,
                  p: 2.5,
                  borderRadius: 3,
                  backgroundColor: "rgba(255,255,255,0.68)",
                  border: "1px solid rgba(212,175,55,0.18)",
                }}
              >
                <Grid container spacing={2.2}>
                  <Grid item xs={12} md={4}>
                    <Paper
                      elevation={0}
                      sx={{
                        p: 2,
                        borderRadius: 3,
                        backgroundColor: "rgba(255,255,255,0.78)",
                        border: "1px solid rgba(163,105,32,0.16)",
                      }}
                    >
                      <Typography sx={{ fontWeight: "bold", color: "#a36920", mb: 1 }}>
                        Foto de perfil
                      </Typography>

                      <Avatar
                        variant="rounded"
                        src={
                          pacienteSeleccionado?.fotoPerfil
                            ? `${API_BASE_URL}${pacienteSeleccionado.fotoPerfil}`
                            : undefined
                        }
                        sx={{
                          width: "100%",
                          height: { xs: 240, md: 280 },
                          borderRadius: 3,
                          border: "2px solid rgba(163,105,32,0.22)",
                          boxShadow: "0 12px 26px rgba(0,0,0,0.10)",
                          bgcolor: "rgba(163,105,32,0.12)",
                          color: "#a36920",
                          fontWeight: "bold",
                          fontSize: 64,
                        }}
                      >
                        {`${pacienteSeleccionado?.nombre || ""} ${pacienteSeleccionado?.apellido || ""}`
                          .trim()
                          .slice(0, 1)
                          .toUpperCase() || "P"}
                      </Avatar>

                      <Button
                        fullWidth
                        variant="outlined"
                        component="label"
                        disabled={subiendoFotoPerfil}
                        sx={{
                          mt: 2,
                          borderColor: "#a36920",
                          color: "#a36920",
                          fontWeight: "bold",
                          borderRadius: 3,
                          "&:hover": { backgroundColor: "rgba(163,105,32,0.08)" },
                        }}
                      >
                        {pacienteSeleccionado?.fotoPerfil ? "Cambiar foto" : "Subir foto"}
                        <input
                          hidden
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) subirFotoPerfil(file);
                            e.target.value = "";
                          }}
                        />
                      </Button>
                    </Paper>
                  </Grid>

                  <Grid item xs={12} md={8}>
                    <Grid container spacing={2.2}>
                      <Grid item xs={12} md={6}>
                        <Box sx={{ display: "grid", gap: 0.8 }}>
                          <Typography><strong>DNI:</strong> {pacienteSeleccionado.dni}</Typography>
                          <Typography><strong>Nombre:</strong> {pacienteSeleccionado.nombre}</Typography>
                          <Typography><strong>Apellido:</strong> {pacienteSeleccionado.apellido}</Typography>
                          <Typography><strong>Edad:</strong> {pacienteSeleccionado.edad}</Typography>
                          <Typography><strong>Sexo:</strong> {pacienteSeleccionado.sexo}</Typography>
                          <Typography><strong>Embarazada:</strong> {pacienteSeleccionado.embarazada || "No especifica"}</Typography>
                          <Typography><strong>Ocupación:</strong> {pacienteSeleccionado.ocupacion}</Typography>
                          <Typography><strong>Fecha Nacimiento:</strong> {pacienteSeleccionado.fechaNacimiento}</Typography>
                          <Typography><strong>Ciudad Nacimiento:</strong> {pacienteSeleccionado.ciudadNacimiento}</Typography>
                          <Typography><strong>Ciudad Residencia:</strong> {pacienteSeleccionado.ciudadResidencia}</Typography>
                        </Box>
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <Box sx={{ display: "grid", gap: 0.8 }}>
                          <Typography><strong>Correo:</strong> {pacienteSeleccionado.correo}</Typography>
                          <Typography><strong>Celular:</strong> {pacienteSeleccionado.celular}</Typography>
                          <Typography><strong>Dirección:</strong> {pacienteSeleccionado.direccion}</Typography>
                          <Typography><strong>Alergias:</strong> {pacienteSeleccionado.alergias || "Ninguna"}</Typography>
                          <Typography><strong>Enfermedades:</strong> {pacienteSeleccionado.enfermedad || "Ninguna"}</Typography>
                          <Typography><strong>Cirugía estética:</strong> {pacienteSeleccionado.cirugiaEstetica || "No"}</Typography>
                          <Typography><strong>Consume tabaco:</strong> {pacienteSeleccionado.tabaco || "No"}</Typography>
                          <Typography><strong>Consume alcohol:</strong> {pacienteSeleccionado.alcohol || "No"}</Typography>
                          <Typography><strong>Consume drogas:</strong> {pacienteSeleccionado.drogas || "No"}</Typography>
                          <Typography><strong>Referencia:</strong> {pacienteSeleccionado.referencia || "No especificada"}</Typography>
                          <Typography><strong>Número de hijos:</strong> {pacienteSeleccionado.numeroHijos ?? "No registrado"}</Typography>
                        </Box>
                      </Grid>
                    </Grid>
                  </Grid>
                </Grid>
              </Paper>

              <Typography
                variant="h6"
                sx={{ color: "#a36920", fontWeight: "bold", mb: 2 }}
              >
                Otras observaciones
              </Typography>

              <Paper
                elevation={0}
                sx={{
                  mb: 4,
                  p: 2.5,
                  borderRadius: 3,
                  backgroundColor: "rgba(255,255,255,0.68)",
                  border: "1px solid rgba(212,175,55,0.18)",
                }}
              >
                <TextField
                  fullWidth
                  multiline
                  minRows={4}
                  placeholder="Escribe aquí cualquier observación adicional..."
                  value={nuevaObservacion}
                  onChange={(e) => setNuevaObservacion(e.target.value)}
                  sx={{
                    "& .MuiInputBase-root": {
                      backgroundColor: "rgba(255,255,255,0.72)",
                      borderRadius: 2,
                    },
                  }}
                />
                <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 2 }}>
                  <Button
                    variant="contained"
                    sx={{
                      backgroundColor: "#a36920",
                      "&:hover": { backgroundColor: "#8b581b" },
                      borderRadius: 3,
                      fontWeight: "bold",
                    }}
                    disabled={guardandoObservaciones}
                    onClick={guardarObservacion}
                  >
                    Guardar observación
                  </Button>
                </Box>

                {Array.isArray(observaciones) && observaciones.length > 0 && (
                  <Box sx={{ mt: 2 }}>
                    <Typography
                      variant="subtitle2"
                      sx={{ color: "rgba(0,0,0,0.70)", mb: 1, fontWeight: "bold" }}
                    >
                      Historial de observaciones
                    </Typography>
                    <Box
                      sx={{
                        display: "grid",
                        gap: 1.2,
                        maxHeight: 220,
                        overflowY: "auto",
                        pr: 0.5,
                      }}
                    >
                      {observaciones.map((o) => (
                        <Paper
                          key={o.id}
                          elevation={0}
                          sx={{
                            p: 1.6,
                            borderRadius: 2,
                            backgroundColor: "rgba(255,255,255,0.78)",
                            border: "1px solid rgba(163,105,32,0.16)",
                          }}
                        >
                          <Box
                            sx={{
                              display: "flex",
                              alignItems: "flex-start",
                              justifyContent: "space-between",
                              gap: 2,
                            }}
                          >
                            <Box sx={{ flex: 1 }}>
                              <Typography
                                variant="caption"
                                sx={{
                                  display: "block",
                                  color: "rgba(0,0,0,0.58)",
                                  mb: 0.5,
                                }}
                              >
                                {o.creado_en}
                              </Typography>

                              {observacionEditId === o.id ? (
                                <TextField
                                  fullWidth
                                  multiline
                                  minRows={3}
                                  value={observacionEditTexto}
                                  onChange={(e) =>
                                    setObservacionEditTexto(e.target.value)
                                  }
                                  sx={{
                                    "& .MuiInputBase-root": {
                                      backgroundColor: "rgba(255,255,255,0.72)",
                                      borderRadius: 2,
                                    },
                                  }}
                                />
                              ) : (
                                <Typography sx={{ whiteSpace: "pre-wrap" }}>
                                  {o.texto}
                                </Typography>
                              )}
                            </Box>

                            <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                              {observacionEditId === o.id ? (
                                <>
                                  <Button
                                    size="small"
                                    variant="contained"
                                    sx={{
                                      backgroundColor: "#a36920",
                                      "&:hover": { backgroundColor: "#8b581b" },
                                      borderRadius: 3,
                                      fontWeight: "bold",
                                    }}
                                    disabled={guardandoObservacionEdit}
                                    onClick={guardarEdicionObservacion}
                                  >
                                    Guardar
                                  </Button>
                                  <Button
                                    size="small"
                                    variant="outlined"
                                    sx={{
                                      borderColor: "#a36920",
                                      color: "#a36920",
                                      borderRadius: 3,
                                      fontWeight: "bold",
                                    }}
                                    onClick={() => {
                                      setObservacionEditId(null);
                                      setObservacionEditTexto("");
                                    }}
                                  >
                                    Cancelar
                                  </Button>
                                </>
                              ) : (
                                <Button
                                  size="small"
                                  variant="outlined"
                                  sx={{
                                    borderColor: "#a36920",
                                    color: "#a36920",
                                    borderRadius: 3,
                                    fontWeight: "bold",
                                    "&:hover": { backgroundColor: "rgba(163,105,32,0.08)" },
                                  }}
                                  onClick={() => {
                                    setObservacionEditId(o.id);
                                    setObservacionEditTexto(o.texto || "");
                                  }}
                                >
                                  Editar
                                </Button>
                              )}
                            </Box>
                          </Box>
                        </Paper>
                      ))}
                    </Box>
                  </Box>
                )}
              </Paper>

              <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 2 }}>
                <Typography
                  variant="h6"
                  sx={{ color: "#a36920", fontWeight: "bold" }}
                >
                  Presupuesto inicial
                </Typography>
                <Button
                  variant="outlined"
                  sx={{
                    borderColor: "#a36920",
                    color: "#a36920",
                    fontWeight: "bold",
                    borderRadius: 3,
                    "&:hover": { backgroundColor: "rgba(163,105,32,0.08)" },
                  }}
                  onClick={() => setShowOferta((v) => !v)}
                  disabled={!pacienteSeleccionado}
                >
                  {showOferta ? "Cerrar" : "Agregar nuevo presupuesto"}
                </Button>
              </Box>

              {showOferta && (
                <Paper
                  elevation={0}
                  sx={{
                    mb: 4,
                    p: 2.5,
                    borderRadius: 3,
                    backgroundColor: "rgba(255,255,255,0.68)",
                    border: "1px solid rgba(212,175,55,0.18)",
                  }}
                >
                  <Typography sx={{ mb: 1.5, fontWeight: "bold" }}>
                    {ofertaEditId
                      ? "Editando oferta (ajusta tratamientos y precios)"
                      : "Selecciona tratamientos y asigna precio especial"}
                  </Typography>

                  <Box
                    sx={{
                      display: "grid",
                      gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
                      gap: 1.2,
                      mb: 2,
                      maxHeight: 260,
                      overflowY: "auto",
                      pr: 0.5,
                    }}
                  >
                    {tratamientosBase.map((t) => {
                      const selected = ofertaItems.some(
                        (x) => x.tratamientoId === t.id
                      );
                      const item = ofertaItems.find(
                        (x) => x.tratamientoId === t.id
                      );
                      return (
                        <Paper
                          key={t.id}
                          elevation={0}
                          sx={{
                            p: 1.6,
                            borderRadius: 2,
                            backgroundColor: selected
                              ? "rgba(163,105,32,0.10)"
                              : "rgba(255,255,255,0.78)",
                            border: "1px solid rgba(163,105,32,0.16)",
                          }}
                        >
                          <Box
                            sx={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              gap: 1.5,
                              mb: 1,
                            }}
                          >
                            <Typography sx={{ fontWeight: "bold" }}>
                              {t.nombre}
                            </Typography>
                            <Button
                              size="small"
                              variant={selected ? "contained" : "outlined"}
                              sx={{
                                backgroundColor: selected ? "#a36920" : "transparent",
                                borderColor: "#a36920",
                                color: selected ? "white" : "#a36920",
                                "&:hover": {
                                  backgroundColor: selected
                                    ? "#8b581b"
                                    : "rgba(163,105,32,0.08)",
                                },
                                borderRadius: 3,
                                fontWeight: "bold",
                              }}
                              onClick={() => toggleOfertaItem(t)}
                            >
                              {selected ? "Quitar" : "Agregar"}
                            </Button>
                          </Box>

                          {selected && (
                            <TextField
                              fullWidth
                              label="Precio especial (S/)"
                              type="number"
                              value={item?.precio ?? ""}
                              onChange={(e) =>
                                setOfertaPrecio(t.id, e.target.value)
                              }
                              sx={{
                                "& .MuiInputBase-root": {
                                  backgroundColor: "rgba(255,255,255,0.72)",
                                  borderRadius: 2,
                                },
                              }}
                            />
                          )}
                        </Paper>
                      );
                    })}
                  </Box>

                  <Box
                    sx={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 2,
                      flexWrap: "wrap",
                    }}
                  >
                    <Typography sx={{ fontWeight: "bold" }}>
                      Total: S/ {totalOferta.toFixed(2)}
                    </Typography>
                    {ofertaEditId && (
                      <Button
                        variant="outlined"
                        sx={{
                          borderColor: "#a36920",
                          color: "#a36920",
                          fontWeight: "bold",
                          borderRadius: 3,
                          "&:hover": { backgroundColor: "rgba(163,105,32,0.08)" },
                        }}
                        onClick={() => {
                          setOfertaEditId(null);
                          setOfertaItems([]);
                          setShowOferta(false);
                        }}
                      >
                        Cancelar edición
                      </Button>
                    )}
                    <Button
                      variant="contained"
                      sx={{
                        backgroundColor: "#a36920",
                        "&:hover": { backgroundColor: "#8b581b" },
                        borderRadius: 3,
                        fontWeight: "bold",
                      }}
                      disabled={guardandoOferta}
                      onClick={guardarOferta}
                    >
                      {ofertaEditId ? "Guardar cambios" : "Guardar oferta"}
                    </Button>
                  </Box>
                </Paper>
              )}

              {Array.isArray(ofertas) && ofertas.length > 0 && (
                <Paper
                  elevation={0}
                  sx={{
                    mb: 4,
                    p: 2.5,
                    borderRadius: 3,
                    backgroundColor: "rgba(255,255,255,0.68)",
                    border: "1px solid rgba(212,175,55,0.18)",
                  }}
                >
                  <Typography
                    variant="subtitle2"
                    sx={{ color: "rgba(0,0,0,0.70)", mb: 1, fontWeight: "bold" }}
                  >
                    Historial de ofertas
                  </Typography>
                  <Box
                    sx={{
                      display: "grid",
                      gap: 1.2,
                      maxHeight: 260,
                      overflowY: "auto",
                      pr: 0.5,
                    }}
                  >
                    {ofertas.map((o) => (
                      <Paper
                        key={o.id}
                        elevation={0}
                        sx={{
                          p: 1.6,
                          borderRadius: 2,
                          backgroundColor: "rgba(255,255,255,0.78)",
                          border: "1px solid rgba(163,105,32,0.16)",
                        }}
                      >
                        <Box
                          sx={{
                            display: "flex",
                            alignItems: "flex-start",
                            justifyContent: "space-between",
                            gap: 2,
                          }}
                        >
                          <Box sx={{ flex: 1 }}>
                            <Typography
                              variant="caption"
                              sx={{
                                display: "block",
                                color: "rgba(0,0,0,0.58)",
                                mb: 0.5,
                              }}
                            >
                              {o.creado_en}
                            </Typography>
                          </Box>
                          <Button
                            size="small"
                            variant="outlined"
                            sx={{
                              borderColor: "#a36920",
                              color: "#a36920",
                              borderRadius: 3,
                              fontWeight: "bold",
                              "&:hover": { backgroundColor: "rgba(163,105,32,0.08)" },
                            }}
                            onClick={() => {
                              setOfertaEditId(o.id);
                              setOfertaItems(
                                (o.items || []).map((it) => ({
                                  tratamientoId: it.tratamientoId ?? it.tratamiento_id ?? null,
                                  nombre: it.nombre,
                                  precio: String(it.precio ?? ""),
                                }))
                              );
                              setShowOferta(true);
                            }}
                          >
                            Editar
                          </Button>
                        </Box>
                        <Box sx={{ display: "grid", gap: 0.5, mb: 1 }}>
                          {(o.items || []).map((it, idx) => (
                            <Box
                              key={`${o.id}-${idx}`}
                              sx={{
                                display: "flex",
                                justifyContent: "space-between",
                                gap: 2,
                              }}
                            >
                              <Typography>{it.nombre}</Typography>
                              <Typography sx={{ fontWeight: "bold" }}>
                                S/ {Number(it.precio || 0).toFixed(2)}
                              </Typography>
                            </Box>
                          ))}
                        </Box>
                        <Divider sx={{ my: 1 }} />
                        <Typography sx={{ fontWeight: "bold" }}>
                          Total: S/ {Number(o.total || 0).toFixed(2)}
                        </Typography>
                      </Paper>
                    ))}
                  </Box>
                </Paper>
              )}

              <Divider sx={{ mb: 3 }} />

              {/* Tratamientos realizados */}
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2 }}>
                <Typography
                  variant="h6"
                  sx={{ color: "#a36920", fontWeight: "bold" }}
                >
                  Tratamientos realizados
                </Typography>
                
                {/* Mostrar botón de recibo consolidado si hay fechas con múltiples tratamientos */}
                {Object.keys(tratamientosPorFecha).some(fecha => tratamientosPorFecha[fecha].length > 1) && (
                  <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                    {Object.keys(tratamientosPorFecha)
                      .filter(fecha => tratamientosPorFecha[fecha].length > 1)
                      .map(fecha => (
                        <Button
                          key={fecha}
                          variant="outlined"
                          size="small"
                          startIcon={<Receipt />}
                          sx={{
                            borderColor: "#D4AF37",
                            color: "#D4AF37",
                            fontWeight: 600,
                            borderRadius: 2,
                            "&:hover": {
                              backgroundColor: "rgba(212,175,55,0.1)",
                              borderColor: "#B8941F",
                            },
                          }}
                          onClick={() => abrirReciboConsolidadoPorFecha(fecha)}
                        >
                          Recibo {fecha} ({tratamientosPorFecha[fecha].length} servicios)
                        </Button>
                      ))}
                  </Box>
                )}
              </Box>

              {tratamientos.length === 0 ? (
                <Typography>No hay tratamientos registrados.</Typography>
              ) : (
                <>
                  <TableContainer
                    component={Paper}
                    elevation={0}
                    sx={{
                      borderRadius: 3,
                      overflow: "hidden",
                      border: "1px solid rgba(212,175,55,0.18)",
                      backgroundColor: "rgba(255,255,255,0.68)",
                    }}
                  >
                    <Table stickyHeader>
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ fontWeight: "bold" }}>Fecha</TableCell>
                          <TableCell sx={{ fontWeight: "bold" }}>Tratamiento</TableCell>
                          <TableCell sx={{ fontWeight: "bold" }}>Tipo Atención</TableCell>
                          <TableCell sx={{ fontWeight: "bold" }}>Especialista</TableCell>
                          <TableCell sx={{ fontWeight: "bold" }}>Total (S/)</TableCell>
                          <TableCell sx={{ fontWeight: "bold" }}>Desc. (%)</TableCell>
                          <TableCell sx={{ fontWeight: "bold" }}>Pago</TableCell>
                          <TableCell sx={{ fontWeight: "bold" }}>Sesión</TableCell>
                          <TableCell sx={{ fontWeight: "bold" }}>Fotos</TableCell>
                          <TableCell sx={{ fontWeight: "bold" }}>Recibo</TableCell>
                          <TableCell sx={{ fontWeight: "bold" }}>Acciones</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                      {tratamientos.map((t) => {
                        const tieneFotosAntes = CAMPOS_FOTOS_ANTES.some((key) => t[key]);
                        const tieneFotosDespues = CAMPOS_FOTOS_DESPUES.some((key) => t[key]);
                        const tieneFotosLegacy = CAMPOS_FOTOS_LEGACY.some((key) => t[key]);
                        const tieneFotos = tieneFotosAntes || tieneFotosDespues || tieneFotosLegacy;

                        return (
                          <TableRow key={t.id}>
                            <TableCell>{t.fecha?.split(" ")[0]}</TableCell>
                            <TableCell>{t.nombreTratamiento}</TableCell>
                            <TableCell>{t.tipoAtencion}</TableCell>
                            <TableCell>{t.especialista}</TableCell>
                            <TableCell>S/ {(t.precio_total || 0).toFixed(2)}</TableCell>
                            <TableCell>{t.descuento}</TableCell>
                            <TableCell>{t.pagoMetodo}</TableCell>
                            <TableCell>{t.sesion}</TableCell>

                            <TableCell>
                              {tratamientoSeleccionado === t.id ? (
                                <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                                  <Box>
                                    <Typography variant="body2" fontWeight="bold" color="#a36920" sx={{ mb: 0.5 }}>
                                      Subir fotos (máx. 3)
                                    </Typography>
                                    <input
                                      type="file"
                                      multiple
                                      accept="image/*"
                                      onClick={(e) => (e.target.value = null)}
                                      onChange={manejarCambioFotos}
                                    />
                                  </Box>
                                  <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
                                    <Button
                                      variant="outlined"
                                      size="small"
                                      sx={{
                                        mt: 0.5,
                                        color: "#a36920",
                                        borderColor: "#a36920",
                                      }}
                                      onClick={() => subirFotos(t.id)}
                                    >
                                      Guardar Fotos
                                    </Button>
                                    <Button
                                      variant="text"
                                      size="small"
                                      sx={{
                                        mt: 0.5,
                                        color: "#a36920",
                                        textTransform: "none",
                                      }}
                                      onClick={() => abrirFotosPaciente(t.id)}
                                    >
                                      Ver fotos
                                    </Button>
                                  </Box>
                                </Box>
                              ) : (
                                <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
                                  <Button
                                    variant="text"
                                    size="small"
                                    sx={{
                                      color: "#a36920",
                                      textTransform: "none",
                                    }}
                                    onClick={() => setTratamientoSeleccionado(t.id)}
                                  >
                                    {tieneFotos ? "Actualizar fotos" : "Agregar fotos"}
                                  </Button>
                                  <Button
                                    variant="text"
                                    size="small"
                                    sx={{
                                      color: "#a36920",
                                      textTransform: "none",
                                    }}
                                    onClick={() => abrirFotosPaciente(t.id)}
                                  >
                                    Ver fotos
                                  </Button>
                                </Box>
                              )}
                            </TableCell>

                            {/* Columna de Recibo */}
                            <TableCell>
                              <IconButton
                                size="small"
                                sx={{
                                  color: "#D4AF37",
                                  "&:hover": {
                                    backgroundColor: "rgba(212,175,55,0.1)",
                                  },
                                }}
                                onClick={() => abrirReciboTratamiento(t)}
                                title="Imprimir recibo"
                              >
                                <Receipt />
                              </IconButton>
                            </TableCell>

                            {/* Columna de Acciones */}
                            <TableCell>
                              <Box sx={{ display: "flex", gap: 0.5 }}>
                                <IconButton
                                  size="small"
                                  sx={{
                                    color: "#1976d2",
                                    "&:hover": {
                                      backgroundColor: "rgba(25,118,210,0.1)",
                                    },
                                  }}
                                  onClick={() => abrirEditarTratamiento(t)}
                                  title="Editar tratamiento"
                                >
                                  <Edit />
                                </IconButton>
                                <IconButton
                                  size="small"
                                  sx={{
                                    color: "#d32f2f",
                                    "&:hover": {
                                      backgroundColor: "rgba(211,47,47,0.1)",
                                    },
                                  }}
                                  onClick={() => abrirConfirmacionCancelar(t)}
                                  title="Cancelar tratamiento"
                                >
                                  <Delete />
                                </IconButton>
                              </Box>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      </TableBody>
                    </Table>
                  </TableContainer>

                  <Typography
                    align="right"
                    sx={{ mt: 3, color: "#a36920", fontWeight: "bold" }}
                  >
                    Total General: S/ {totalGeneral.toFixed(2)}
                  </Typography>
                </>
              )}
            </>
          )}
        </Paper>
      </Container>

      {/* Modal de Recibo para Ticketera */}
      <ReciboTicket
        open={openReciboModal}
        onClose={() => setOpenReciboModal(false)}
        datos={datosRecibo}
      />

      {/* Modal de Recibo Consolidado */}
      <ReciboConsolidado
        open={openReciboConsolidado}
        onClose={() => setOpenReciboConsolidado(false)}
        datos={datosReciboConsolidado}
      />

      {/* Modal para Editar Tratamiento */}
      <Dialog open={openEditarModal} onClose={() => setOpenEditarModal(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ backgroundColor: "#a36920", color: "white" }}>
          Editar Tratamiento
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Especialista"
                value={editEspecialista}
                onChange={(e) => setEditEspecialista(e.target.value)}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Sesión"
                type="number"
                value={editSesion}
                onChange={(e) => setEditSesion(Number(e.target.value))}
                inputProps={{ min: 1 }}
              />
            </Grid>
            <Grid item xs={6}>
              <FormControl fullWidth>
                <InputLabel>Tipo de Atención</InputLabel>
                <Select
                  value={editTipoAtencion}
                  onChange={(e) => setEditTipoAtencion(e.target.value)}
                  label="Tipo de Atención"
                >
                  <MenuItem value="Tratamiento">Tratamiento</MenuItem>
                  <MenuItem value="Consulta">Consulta</MenuItem>
                  <MenuItem value="Seguimiento">Seguimiento</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Precio Total (S/)"
                type="number"
                value={editPrecio}
                onChange={(e) => setEditPrecio(Number(e.target.value))}
                inputProps={{ min: 0, step: 0.01 }}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Descuento (%)"
                type="number"
                value={editDescuento}
                onChange={(e) => setEditDescuento(Number(e.target.value))}
                inputProps={{ min: 0, max: 100 }}
              />
            </Grid>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Método de Pago</InputLabel>
                <Select
                  value={editPagoMetodo}
                  onChange={(e) => setEditPagoMetodo(e.target.value)}
                  label="Método de Pago"
                >
                  <MenuItem value="Efectivo">Efectivo</MenuItem>
                  <MenuItem value="Tarjeta">Tarjeta</MenuItem>
                  <MenuItem value="Transferencia">Transferencia</MenuItem>
                  <MenuItem value="Yape">Yape</MenuItem>
                  <MenuItem value="Plin">Plin</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setOpenEditarModal(false)} sx={{ color: "#666" }}>
            Cancelar
          </Button>
          <Button
            onClick={guardarEditarTratamiento}
            variant="contained"
            sx={{
              backgroundColor: "#a36920",
              "&:hover": { backgroundColor: "#8a5a1a" },
            }}
          >
            Guardar Cambios
          </Button>
        </DialogActions>
      </Dialog>

      {/* Modal de Confirmación para Cancelar Tratamiento */}
      <Dialog open={openConfirmarCancelar} onClose={() => setOpenConfirmarCancelar(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ backgroundColor: "#d32f2f", color: "white" }}>
          Confirmar Cancelación
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          <Typography>
            ¿Estás seguro de que deseas cancelar este tratamiento?
          </Typography>
          {tratamientoCancelar && (
            <Box sx={{ mt: 2, p: 2, backgroundColor: "#f5f5f5", borderRadius: 1 }}>
              <Typography variant="body2"><strong>Tratamiento:</strong> {tratamientoCancelar.nombreTratamiento}</Typography>
              <Typography variant="body2"><strong>Fecha:</strong> {tratamientoCancelar.fecha?.split(" ")[0]}</Typography>
              <Typography variant="body2"><strong>Especialista:</strong> {tratamientoCancelar.especialista}</Typography>
              <Typography variant="body2"><strong>Total:</strong> S/ {tratamientoCancelar.precio_total?.toFixed(2)}</Typography>
            </Box>
          )}
          <Typography sx={{ mt: 2, color: "#d32f2f", fontWeight: "bold" }}>
            Esta acción no se puede deshacer.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setOpenConfirmarCancelar(false)} sx={{ color: "#666" }}>
            No, mantener
          </Button>
          <Button
            onClick={cancelarTratamiento}
            variant="contained"
            sx={{
              backgroundColor: "#d32f2f",
              "&:hover": { backgroundColor: "#b71c1c" },
            }}
          >
            Sí, cancelar tratamiento
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
};

export default HistorialClinico;
