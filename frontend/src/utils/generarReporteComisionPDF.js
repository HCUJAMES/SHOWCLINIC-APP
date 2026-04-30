import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

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
  const s = String(str).split(" ")[0];
  return s;
};

/**
 * Genera un reporte PDF con el informe de pago de comisión del especialista,
 * incluyendo presupuestos asignados, tratamientos realizados e historial de pagos.
 */
export const generarReporteComisionPDF = async ({
  trabajador,
  presupuestos = [],
  tratamientosRealizados = [],
  totalesTratamientos = {},
  historialPagos = [],
  mes,
  anio
}) => {
  const logoBase64 = await loadImageAsBase64(LOGO_URL);

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Paleta de marca
  const dorado = [163, 105, 32];
  const doradoMedio = [186, 154, 99];
  const cremaClaro = [245, 241, 228];
  const blanco = [255, 255, 255];
  const negro = [40, 40, 40];
  const gris = [110, 110, 110];

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
  doc.roundedRect(12, y, pageWidth - 24, 28, 3, 3, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...dorado);
  doc.text("ESPECIALISTA", 18, y + 7);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...negro);
  doc.text(String(trabajador.especialista_nombre || "-").toUpperCase(), 18, y + 15);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...gris);
  const rol = trabajador.tipo === "doctor" ? "Doctor / Medicina estética"
    : trabajador.tipo === "asistente" ? "Asistente clínica"
    : trabajador.tipo === "recepcion" ? "Recepción" : (trabajador.tipo || "-");
  doc.text(`Rol: ${rol}`, 18, y + 22);

  // Modalidad de pago
  const pagoFijo = Number(trabajador.pago_fijo || 0);
  const comPct = Number(trabajador.comision_porcentaje || 0);
  const modalidad = pagoFijo > 0 && comPct > 0 ? "Sueldo fijo + comisión"
    : pagoFijo > 0 ? "Sueldo fijo"
    : "Comisión";
  doc.text(`Modalidad: ${modalidad}  |  Comisión: ${comPct.toFixed(0)}%`, 18, y + 27);

  // ============ RESUMEN FINANCIERO (4 cards) ============
  y += 36;
  const totalPagadoPresup = presupuestos.reduce((s, p) => s + Number(p.monto_pagado || 0), 0);
  const comisionCalculada = totalPagadoPresup * (comPct / 100);
  const totalAPagar = pagoFijo + comisionCalculada;
  const totalTratamientos = trabajador.total_atenciones
    || tratamientosRealizados.reduce((s, t) => s + Number(t.total_sesiones || 0), 0);

  const cards = [
    { label: "Sueldo fijo", value: fmtSoles(pagoFijo), color: negro },
    { label: `Comisión (${comPct.toFixed(0)}%)`, value: fmtSoles(comisionCalculada), color: dorado },
    { label: "Total a pagar", value: fmtSoles(totalAPagar), color: [76, 175, 80] },
    { label: "Tratamientos", value: String(totalTratamientos), color: doradoMedio }
  ];

  const cardW = (pageWidth - 24 - 12) / 4;
  cards.forEach((c, i) => {
    const x = 12 + i * (cardW + 4);
    doc.setFillColor(...blanco);
    doc.setDrawColor(...doradoMedio);
    doc.setLineWidth(0.3);
    doc.roundedRect(x, y, cardW, 22, 2, 2, "FD");

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...gris);
    doc.text(c.label, x + cardW / 2, y + 7, { align: "center" });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(...c.color);
    doc.text(c.value, x + cardW / 2, y + 16, { align: "center" });
  });

  y += 28;

  // Total pagado por pacientes (base de la comisión)
  doc.setFont("helvetica", "italic");
  doc.setFontSize(9);
  doc.setTextColor(...gris);
  doc.text(
    `Base de comisión (total pagado por pacientes en presupuestos asignados): ${fmtSoles(totalPagadoPresup)}`,
    12,
    y
  );
  y += 6;

  // ============ PRESUPUESTOS ASIGNADOS ============
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...dorado);
  doc.text("PRESUPUESTOS ASIGNADOS", 12, y);
  y += 2;
  doc.setDrawColor(...dorado);
  doc.setLineWidth(0.4);
  doc.line(12, y + 1, pageWidth - 12, y + 1);
  y += 5;

  if (presupuestos.length === 0) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    doc.setTextColor(...gris);
    doc.text("No hay presupuestos asignados en el período seleccionado.", 12, y);
    y += 6;
  } else {
    const presupBody = presupuestos.map((p) => {
      const total = Number(p.precio_total || 0);
      const desc = Number(p.descuento || 0);
      const pagado = Number(p.monto_pagado || 0);
      const saldo = Math.max(0, total - desc - pagado);
      const tratNombres = (p.tratamientos || [])
        .map(t => `${t.nombre || t.tratamiento || "Tratamiento"}${t.sesiones > 1 ? ` (${t.sesiones})` : ""}`)
        .join(", ");
      return [
        `${p.paciente_nombre || ""} ${p.paciente_apellido || ""}`.trim(),
        p.paciente_dni || "-",
        fmtFecha(p.creado_en),
        tratNombres || "-",
        `${p.sesiones_completadas || 0}/${p.sesiones_totales || 0}`,
        (p.estado || "-").toString(),
        fmtSoles(total),
        fmtSoles(pagado),
        fmtSoles(saldo)
      ];
    });

    autoTable(doc, {
      startY: y,
      head: [["Paciente", "DNI", "Creado", "Tratamientos", "Sesiones", "Estado", "Total", "Pagado", "Saldo"]],
      body: presupBody,
      theme: "striped",
      headStyles: {
        fillColor: dorado,
        textColor: blanco,
        fontStyle: "bold",
        fontSize: 8,
        halign: "center",
        cellPadding: 2
      },
      bodyStyles: { fontSize: 7.5, textColor: negro, cellPadding: 1.8 },
      alternateRowStyles: { fillColor: cremaClaro },
      columnStyles: {
        0: { cellWidth: 30 },
        1: { cellWidth: 18, halign: "center" },
        2: { cellWidth: 18, halign: "center" },
        3: { cellWidth: 45 },
        4: { cellWidth: 14, halign: "center" },
        5: { cellWidth: 18, halign: "center" },
        6: { cellWidth: 18, halign: "right" },
        7: { cellWidth: 18, halign: "right" },
        8: { cellWidth: 18, halign: "right" }
      },
      margin: { left: 12, right: 12 }
    });
    y = doc.lastAutoTable.finalY + 6;
  }

  // ============ TRATAMIENTOS REALIZADOS ============
  if (y > pageHeight - 60) { doc.addPage(); y = 20; }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...dorado);
  doc.text("TRATAMIENTOS REALIZADOS", 12, y);
  y += 2;
  doc.setDrawColor(...dorado);
  doc.line(12, y + 1, pageWidth - 12, y + 1);
  y += 5;

  if (!tratamientosRealizados || tratamientosRealizados.length === 0) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    doc.setTextColor(...gris);
    doc.text("No hay tratamientos realizados en el período seleccionado.", 12, y);
    y += 6;
  } else {
    const tratBody = tratamientosRealizados.map((t) => [
      t.tratamiento_nombre || "-",
      String(t.total_sesiones || 0),
      fmtSoles(t.total_ingresos)
    ]);
    const totalSes = tratamientosRealizados.reduce((s, t) => s + Number(t.total_sesiones || 0), 0);
    const totalIng = Number(totalesTratamientos.total_ingresos || tratamientosRealizados.reduce((s, t) => s + Number(t.total_ingresos || 0), 0));

    autoTable(doc, {
      startY: y,
      head: [["Tratamiento", "Sesiones", "Ingresos"]],
      body: tratBody,
      foot: [["TOTAL", String(totalSes), fmtSoles(totalIng)]],
      theme: "striped",
      headStyles: { fillColor: dorado, textColor: blanco, fontStyle: "bold", fontSize: 9, halign: "center", cellPadding: 2.5 },
      footStyles: { fillColor: cremaClaro, textColor: dorado, fontStyle: "bold", fontSize: 9 },
      bodyStyles: { fontSize: 9, textColor: negro, cellPadding: 2 },
      alternateRowStyles: { fillColor: cremaClaro },
      columnStyles: {
        0: { cellWidth: "auto" },
        1: { cellWidth: 30, halign: "center" },
        2: { cellWidth: 40, halign: "right" }
      },
      margin: { left: 12, right: 12 }
    });
    y = doc.lastAutoTable.finalY + 6;
  }

  // ============ HISTORIAL DE PAGOS ============
  if (y > pageHeight - 60) { doc.addPage(); y = 20; }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...dorado);
  doc.text("HISTORIAL DE PAGOS", 12, y);
  y += 2;
  doc.setDrawColor(...dorado);
  doc.line(12, y + 1, pageWidth - 12, y + 1);
  y += 5;

  if (!historialPagos || historialPagos.length === 0) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    doc.setTextColor(...gris);
    doc.text("No hay pagos registrados para este especialista.", 12, y);
    y += 6;
  } else {
    const pagosBody = historialPagos.map((p) => [
      fmtFecha(p.fecha_pago),
      fmtSoles(p.monto),
      (p.metodo_pago || "-").toString(),
      p.referencia || "-",
      (p.estado || "pagado").toString()
    ]);
    const totalPagos = historialPagos.reduce((s, p) => s + Number(p.monto || 0), 0);

    autoTable(doc, {
      startY: y,
      head: [["Fecha", "Monto", "Método", "Referencia", "Estado"]],
      body: pagosBody,
      foot: [["TOTAL PAGADO", fmtSoles(totalPagos), "", "", ""]],
      theme: "striped",
      headStyles: { fillColor: dorado, textColor: blanco, fontStyle: "bold", fontSize: 9, halign: "center", cellPadding: 2.5 },
      footStyles: { fillColor: cremaClaro, textColor: dorado, fontStyle: "bold", fontSize: 9 },
      bodyStyles: { fontSize: 9, textColor: negro, cellPadding: 2 },
      alternateRowStyles: { fillColor: cremaClaro },
      columnStyles: {
        0: { cellWidth: 30, halign: "center" },
        1: { cellWidth: 32, halign: "right" },
        2: { cellWidth: 30, halign: "center" },
        3: { cellWidth: "auto" },
        4: { cellWidth: 28, halign: "center" }
      },
      margin: { left: 12, right: 12 }
    });
    y = doc.lastAutoTable.finalY + 8;
  }

  // ============ RESUMEN FINAL ============
  if (y > pageHeight - 50) { doc.addPage(); y = 20; }

  const boxX = pageWidth - 90 - 12;
  const boxW = 90;
  const boxH = 38;
  doc.setFillColor(...cremaClaro);
  doc.setDrawColor(...dorado);
  doc.setLineWidth(0.5);
  doc.roundedRect(boxX, y, boxW, boxH, 3, 3, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...dorado);
  doc.text("RESUMEN A PAGAR", boxX + boxW / 2, y + 7, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...negro);
  doc.text("Sueldo fijo:", boxX + 5, y + 15);
  doc.text(fmtSoles(pagoFijo), boxX + boxW - 5, y + 15, { align: "right" });

  doc.text(`Comisión (${comPct.toFixed(0)}%):`, boxX + 5, y + 22);
  doc.text(fmtSoles(comisionCalculada), boxX + boxW - 5, y + 22, { align: "right" });

  doc.setDrawColor(...dorado);
  doc.line(boxX + 5, y + 26, boxX + boxW - 5, y + 26);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...dorado);
  doc.text("TOTAL:", boxX + 5, y + 33);
  doc.text(fmtSoles(totalAPagar), boxX + boxW - 5, y + 33, { align: "right" });

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
