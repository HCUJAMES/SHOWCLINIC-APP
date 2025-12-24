import jsPDF from "jspdf";
import "jspdf-autotable";

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

  // Recorte circular + dibujo tipo "cover"
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

  // Borde fino y delicado
  ctx.beginPath();
  ctx.arc(cx, cy, r + borderPx / 2, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(255,255,255,0.92)";
  ctx.lineWidth = borderPx;
  ctx.stroke();

  // Borde externo sutil
  ctx.beginPath();
  ctx.arc(cx, cy, r + borderPx, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(0,0,0,0.10)";
  ctx.lineWidth = 1;
  ctx.stroke();

  return canvas.toDataURL("image/png");
};

export const generarPDFPaciente = async (paciente, historial) => {
  const doc = new jsPDF("p", "pt", "a4");
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const colorPrincipal = [163, 105, 32];
  const margenX = 40;
  const headerHeight = 92;

  const logo = "/images/logo-showclinic.png";
  const img = await loadImage(logo);
  const logoCircular = makeCircularImageDataUrl(img, 256, 10);

  const numeroHijosTexto =
    paciente?.numeroHijos !== null && paciente?.numeroHijos !== undefined
      ? String(paciente.numeroHijos)
      : "No registrado";

  const datosPaciente = [
    ["Nombre", `${paciente.nombre || ""} ${paciente.apellido || ""}`.trim()],
    ["DNI", paciente.dni || "-"],
    ["Edad", paciente.edad ?? "-"],
    ["Sexo", paciente.sexo || "-"],
    ["Embarazada", paciente.embarazada || "No especifica"],
    ["Teléfono", paciente.celular || "-"],
    ["Correo", paciente.correo || "-"],
    ["Número de hijos", numeroHijosTexto],
  ];

  const filas = (historial || []).map((h) => [
    h.fecha ? String(h.fecha).split(" ")[0] : "-",
    h.tratamiento || "-",
    h.sesion ?? "-",
    `${h.descuento ?? 0}%`,
    h.pagoMetodo || "-",
    `S/ ${(Number(h.precio_total || 0)).toFixed(2)}`,
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
    doc.text("Historial Clínico del Paciente", margenX + 72, 46);

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
  const labelW = 120;
  const valueW = tablaW - labelW;
  const mitad = Math.ceil(datosPaciente.length / 2);
  const datosIzq = datosPaciente.slice(0, mitad);
  const datosDer = datosPaciente.slice(mitad);

  doc.autoTable({
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

  doc.autoTable({
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

  const startTabla = Math.max(finalYIzq, finalYDer) + 18;
  doc.autoTable({
    startY: startTabla,
    margin: { left: margenX, right: margenX },
    head: [["Fecha", "Tratamiento", "Sesión", "Desc.", "Pago", "Total"]],
    body: filas,
    theme: "striped",
    headStyles: {
      fillColor: colorPrincipal,
      textColor: 255,
      fontStyle: "bold",
      halign: "center",
      valign: "middle",
    },
    styles: { fontSize: 9, cellPadding: 4, valign: "middle" },
    alternateRowStyles: { fillColor: [247, 242, 234] },
    columnStyles: {
      0: { cellWidth: 70 },
      2: { halign: "center", cellWidth: 50 },
      3: { halign: "center", cellWidth: 50 },
      5: { halign: "right", cellWidth: 70 },
    },
  });

  doc.save(`Historial_${paciente.nombre}_${paciente.apellido}.pdf`);
};
