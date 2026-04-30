import jsPDF from "jspdf";

const LOGO_URL = "/logo-showclinic.png";

const loadImageAsBase64 = (url) =>
  new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });

const NOMBRE_MES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

const fmtSoles = (n) => `S/ ${Number(n || 0).toFixed(2)}`;

const fmtFecha = (str) => {
  if (!str) return "-";
  return String(str).split(" ")[0];
};

/**
 * Genera reporte PDF con el informe de comisión del especialista.
 * Solo muestra: datos del especialista, comisión, y presupuestos asignados
 * replicando el diseño del sistema (cards con tratamientos y resumen financiero).
 */
export const generarReporteComisionPDF = async ({
  trabajador,
  presupuestos = [],
  mes,
  anio
}) => {
  const logoBase64 = await loadImageAsBase64(LOGO_URL);

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Paleta de marca
  const dorado = [163, 105, 32];        // #a36920
  const doradoMedio = [186, 154, 99];    // #ba9a63
  const cremaClaro = [245, 241, 228];    // #f5f1e4
  const cremaSuave = [253, 248, 240];    // #FDF8F0
  const beigeBorde = [250, 238, 218];    // #FAEEDA
  const blanco = [255, 255, 255];
  const negro = [40, 40, 40];
  const gris = [110, 110, 110];
  const grisTexto = [85, 85, 85];
  const verde = [76, 175, 80];
  const rojo = [244, 67, 54];
  const naranja = [255, 152, 0];
  const activoNaranja = [255, 152, 0];

  const marginX = 14;
  const contentW = pageWidth - marginX * 2;

  // ============ HEADER ============
  doc.setFillColor(...dorado);
  doc.rect(0, 0, pageWidth, 32, "F");

  if (logoBase64) {
    try { doc.addImage(logoBase64, "PNG", 12, 5, 22, 22); } catch (e) {}
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(...blanco);
  doc.text("SHOWCLINIC", 40, 14);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("Clínica de Estética y Belleza", 40, 20);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("INFORME DE PAGO DE COMISIÓN", pageWidth - 14, 14, { align: "right" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const periodo = (mes && anio) ? `Período: ${NOMBRE_MES[mes - 1]} ${anio}` : "Período: -";
  doc.text(periodo, pageWidth - 14, 21, { align: "right" });
  doc.text(`Emitido: ${new Date().toLocaleDateString("es-PE")}`, pageWidth - 14, 27, { align: "right" });

  // ============ DATOS DEL ESPECIALISTA ============
  let y = 42;
  doc.setFillColor(...cremaClaro);
  doc.roundedRect(marginX, y, contentW, 28, 3, 3, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...dorado);
  doc.text("ESPECIALISTA", marginX + 6, y + 7);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...negro);
  doc.text(String(trabajador.especialista_nombre || "-").toUpperCase(), marginX + 6, y + 15);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...gris);
  const rol = trabajador.tipo === "doctor" ? "Doctor / Medicina estética"
    : trabajador.tipo === "asistente" ? "Asistente clínica"
    : trabajador.tipo === "recepcion" ? "Recepción" : (trabajador.tipo || "-");
  const comPct = Number(trabajador.comision_porcentaje || 0);
  doc.text(`Rol: ${rol}`, marginX + 6, y + 22);
  doc.text(`Comisión: ${comPct.toFixed(0)}%`, marginX + 6, y + 27);

  y += 36;

  // ============ COMISIÓN (tarjeta única) ============
  const totalPagadoPresup = presupuestos.reduce((s, p) => s + Number(p.monto_pagado || 0), 0);
  const comisionCalculada = totalPagadoPresup * (comPct / 100);

  doc.setFillColor(...cremaSuave);
  doc.setDrawColor(...beigeBorde);
  doc.setLineWidth(0.4);
  doc.roundedRect(marginX, y, contentW, 22, 2, 2, "FD");

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...gris);
  doc.text(`Comisión (${comPct.toFixed(0)}% sobre pagado)`, marginX + contentW / 2, y + 8, { align: "center" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(...dorado);
  doc.text(fmtSoles(comisionCalculada), marginX + contentW / 2, y + 17, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...gris);
  doc.text(`Total pagado por pacientes: ${fmtSoles(totalPagadoPresup)}`, marginX + contentW / 2, y + 21, { align: "center" });

  y += 30;

  // ============ PRESUPUESTOS ASIGNADOS ============
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...dorado);
  doc.text("PRESUPUESTOS ASIGNADOS", marginX, y);
  doc.setDrawColor(...dorado);
  doc.setLineWidth(0.4);
  doc.line(marginX, y + 2, pageWidth - marginX, y + 2);
  y += 7;

  if (presupuestos.length === 0) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    doc.setTextColor(...gris);
    doc.text("No hay presupuestos asignados en el período seleccionado.", marginX, y);
  } else {
    // Renderizar cada presupuesto como card (mismo diseño del sistema)
    for (const pres of presupuestos) {
      const tratamientos = pres.tratamientos || [];
      const precioTotal = Number(pres.precio_total || 0);
      const descuento = Number(pres.descuento || 0);
      const pagado = Number(pres.monto_pagado || 0);
      const saldo = Math.max(0, precioTotal - descuento - pagado);
      const estado = pres.estado || "-";
      const estadoLabel = estado === "completado" ? "Completado"
        : estado === "activo" ? "Activo"
        : estado;
      const estadoColor = estado === "completado" ? verde
        : estado === "activo" ? activoNaranja
        : [153, 153, 153];

      // Calcular alto dinámico de la card
      const headerH = 14;
      const tratH = tratamientos.length * 5.5 + 3;
      const resumenH = 14;
      const paddingV = 4;
      const cardH = headerH + tratH + resumenH + paddingV;

      // Salto de página si no entra
      if (y + cardH > pageHeight - 22) {
        doc.addPage();
        y = 20;
      }

      // Fondo crema con borde según estado
      doc.setFillColor(...cremaSuave);
      doc.setDrawColor(estadoColor[0], estadoColor[1], estadoColor[2]);
      doc.setLineWidth(0.4);
      doc.roundedRect(marginX, y, contentW, cardH, 2.5, 2.5, "FD");

      // ----- Header de la card -----
      // Paciente (nombre)
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(...negro);
      const nombrePaciente = `${pres.paciente_nombre || ""} ${pres.paciente_apellido || ""}`.trim().toUpperCase();
      doc.text(nombrePaciente || "-", marginX + 4, y + 6);

      // DNI + fecha
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(...gris);
      const sub = `${pres.paciente_dni ? `DNI: ${pres.paciente_dni} · ` : ""}Creado: ${fmtFecha(pres.creado_en)}`;
      doc.text(sub, marginX + 4, y + 11);

      // Chips a la derecha: sesiones y estado
      const sesionesTxt = `${pres.sesiones_completadas || 0}/${pres.sesiones_totales || 0} sesiones`;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      const sesionesW = doc.getTextWidth(sesionesTxt) + 6;
      const estadoW = doc.getTextWidth(estadoLabel) + 6;
      const chipY = y + 4;
      const chipH = 5;
      const estadoX = marginX + contentW - 4 - estadoW;
      const sesionesX = estadoX - 2 - sesionesW;

      // Chip sesiones (beige)
      doc.setFillColor(...beigeBorde);
      doc.roundedRect(sesionesX, chipY, sesionesW, chipH, 1.2, 1.2, "F");
      doc.setTextColor(...dorado);
      doc.text(sesionesTxt, sesionesX + sesionesW / 2, chipY + 3.5, { align: "center" });

      // Chip estado (tintado por color de estado)
      doc.setFillColor(estadoColor[0], estadoColor[1], estadoColor[2]);
      doc.setGState(new doc.GState({ opacity: 0.18 }));
      doc.roundedRect(estadoX, chipY, estadoW, chipH, 1.2, 1.2, "F");
      doc.setGState(new doc.GState({ opacity: 1 }));
      doc.setTextColor(estadoColor[0], estadoColor[1], estadoColor[2]);
      doc.text(estadoLabel, estadoX + estadoW / 2, chipY + 3.5, { align: "center" });

      // ----- Tratamientos -----
      let tY = y + headerH;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      tratamientos.forEach((t, idx) => {
        const nombreT = `${t.nombre || t.tratamiento || "Tratamiento"}${t.sesiones > 1 ? ` (${t.sesiones} ses.)` : ""}`;
        doc.setTextColor(...grisTexto);
        doc.text(nombreT, marginX + 4, tY + 4);
        doc.setTextColor(...dorado);
        doc.setFont("helvetica", "bold");
        doc.text(fmtSoles(t.precio), marginX + contentW - 4, tY + 4, { align: "right" });
        doc.setFont("helvetica", "normal");

        // Línea separadora entre tratamientos
        if (idx < tratamientos.length - 1) {
          doc.setDrawColor(...beigeBorde);
          doc.setLineWidth(0.2);
          doc.line(marginX + 4, tY + 5.5, marginX + contentW - 4, tY + 5.5);
        }
        tY += 5.5;
      });

      // ----- Resumen financiero (Total, Descuento, Pagado, Saldo) -----
      const resumenY = y + headerH + tratH;
      const cajas = [
        { label: "Total", value: fmtSoles(precioTotal), color: negro },
        ...(descuento > 0 ? [{ label: "Descuento", value: `-${fmtSoles(descuento)}`, color: rojo }] : []),
        { label: "Pagado", value: fmtSoles(pagado), color: verde },
        { label: "Saldo", value: fmtSoles(saldo), color: saldo > 0 ? naranja : verde }
      ];
      const cajaGap = 2;
      const cajaW = (contentW - 8 - cajaGap * (cajas.length - 1)) / cajas.length;

      cajas.forEach((c, i) => {
        const cx = marginX + 4 + i * (cajaW + cajaGap);
        doc.setFillColor(...blanco);
        doc.setDrawColor(...beigeBorde);
        doc.setLineWidth(0.25);
        doc.roundedRect(cx, resumenY, cajaW, 12, 1.5, 1.5, "FD");

        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        doc.setTextColor(...gris);
        doc.text(c.label, cx + cajaW / 2, resumenY + 4, { align: "center" });

        doc.setFont("helvetica", "bold");
        doc.setFontSize(8.5);
        doc.setTextColor(c.color[0], c.color[1], c.color[2]);
        doc.text(c.value, cx + cajaW / 2, resumenY + 9.5, { align: "center" });
      });

      y += cardH + 4;
    }
  }

  // ============ FOOTER en cada página ============
  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFillColor(...dorado);
    doc.rect(0, pageHeight - 14, pageWidth, 14, "F");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...blanco);
    doc.text("ShowClinic - Clínica de Estética y Belleza  |  Av. Ejército 616, Yanahuara - Tel: +51 974 212 114",
      12, pageHeight - 5);
    doc.text(`Página ${i} de ${totalPages}`, pageWidth - 12, pageHeight - 5, { align: "right" });
  }

  const safeName = String(trabajador.especialista_nombre || "especialista").replace(/\s+/g, "_");
  const periodoArchivo = (mes && anio) ? `_${anio}-${String(mes).padStart(2, "0")}` : "";
  doc.save(`Comision_${safeName}${periodoArchivo}.pdf`);
  return true;
};
