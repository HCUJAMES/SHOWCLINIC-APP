import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

// Logo de ShowClinic en base64 (se cargará dinámicamente)
const LOGO_URL = "/logo-showclinic.png";

/**
 * Cargar imagen como base64
 */
const loadImageAsBase64 = (url) => {
  return new Promise((resolve, reject) => {
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
};

/**
 * Generar proforma en PDF con diseño profesional HORIZONTAL
 * Diseño elegante con colores de ShowClinic
 */
export const generarProformaPDF = async (presupuesto, paciente, tipo = "presupuesto") => {
  try {
    console.log("Generando proforma PDF...", { presupuesto, paciente, tipo });
    
    // Cargar logo
    const logoBase64 = await loadImageAsBase64(LOGO_URL);
    
    // Crear PDF en orientación HORIZONTAL (landscape)
    const doc = new jsPDF({
      orientation: "landscape",
      unit: "mm",
      format: "a4"
    });
    
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    // Colores de ShowClinic
    const dorado = [163, 105, 32];
    const negro = [30, 30, 30];
    const grisOscuro = [80, 80, 80];
    const blanco = [255, 255, 255];

    // ============================================
    // HEADER - Franja dorada superior
    // ============================================
    doc.setFillColor(dorado[0], dorado[1], dorado[2]);
    doc.rect(0, 0, pageWidth, 28, "F");

    // Logo de ShowClinic (si se cargó)
    if (logoBase64) {
      try {
        doc.addImage(logoBase64, "PNG", 10, 3, 22, 22);
      } catch (e) {
        console.log("No se pudo agregar el logo");
      }
    }

    // Nombre de la clínica en el header (después del logo)
    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(blanco[0], blanco[1], blanco[2]);
    doc.text("SHOWCLINIC", 38, 15);

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text("Clínica de Estética y Belleza", 38, 22);

    // Título del documento (derecha del header)
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    const titulo = tipo === "paquete" ? "PROFORMA - PAQUETE PROMOCIONAL" : "PROFORMA";
    doc.text(titulo, pageWidth - 15, 16, { align: "right" });

    // ============================================
    // INFORMACIÓN DEL CLIENTE Y FECHA
    // ============================================
    let yPos = 38;
    const colIzquierda = 15;

    // Cuadro de información del cliente
    doc.setFillColor(248, 248, 248);
    doc.roundedRect(colIzquierda, yPos, 120, 30, 3, 3, "F");

    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(dorado[0], dorado[1], dorado[2]);
    doc.text("DATOS DEL CLIENTE", colIzquierda + 5, yPos + 8);

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(negro[0], negro[1], negro[2]);

    const nombreCompleto = `${paciente.nombre || ""} ${paciente.apellido || ""}`.trim() || "Cliente";
    doc.text(`Nombre: ${nombreCompleto}`, colIzquierda + 5, yPos + 16);
    
    if (paciente.dni) {
      doc.text(`DNI: ${paciente.dni}`, colIzquierda + 5, yPos + 22);
    }
    if (paciente.telefono) {
      doc.text(`Teléfono: ${paciente.telefono}`, colIzquierda + 5, yPos + 28);
    }

    // Cuadro de fecha y número (derecha)
    doc.setFillColor(248, 248, 248);
    doc.roundedRect(pageWidth - 135, yPos, 120, 30, 3, 3, "F");

    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(dorado[0], dorado[1], dorado[2]);
    doc.text("INFORMACIÓN", pageWidth - 130, yPos + 8);

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(negro[0], negro[1], negro[2]);

    const fecha = presupuesto.creado_en || new Date().toISOString().split("T")[0];
    const fechaFormateada = new Date(fecha).toLocaleDateString("es-PE", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    doc.text(`Fecha: ${fechaFormateada}`, pageWidth - 130, yPos + 16);
    doc.text(`N° Proforma: ${Date.now().toString().slice(-8)}`, pageWidth - 130, yPos + 23);

    // ============================================
    // TABLA DE TRATAMIENTOS/SERVICIOS
    // ============================================
    yPos = 78;

    const items = presupuesto.items || presupuesto.tratamientos || [];
    const tableData = items.map((item, index) => [
      (index + 1).toString(),
      item.nombre || item.tratamiento || "Tratamiento",
      item.sesiones ? item.sesiones.toString() : "1",
      `S/ ${Number(item.precio || 0).toFixed(2)}`,
    ]);

    // Calcular totales
    const subtotal = items.reduce((sum, item) => sum + Number(item.precio || 0), 0);
    const descuento = Number(presupuesto.descuento) || 0;
    const total = subtotal - descuento;

    autoTable(doc, {
      startY: yPos,
      head: [["#", "DESCRIPCIÓN DEL SERVICIO", "SESIONES", "PRECIO"]],
      body: tableData,
      theme: "striped",
      headStyles: {
        fillColor: [30, 30, 30],
        textColor: [255, 255, 255],
        fontStyle: "bold",
        fontSize: 10,
        halign: "center",
        cellPadding: 4,
      },
      bodyStyles: {
        fontSize: 10,
        textColor: [50, 50, 50],
        cellPadding: 3,
      },
      alternateRowStyles: {
        fillColor: [250, 250, 250],
      },
      columnStyles: {
        0: { halign: "center", cellWidth: 15 },
        1: { cellWidth: 140 },
        2: { halign: "center", cellWidth: 25 },
        3: { halign: "right", cellWidth: 50 },
      },
      margin: { left: 15, right: 15 },
      styles: {
        lineColor: [220, 220, 220],
        lineWidth: 0.1,
      },
      tableWidth: "auto",
    });

    // ============================================
    // RESUMEN DE TOTALES (Cuadro elegante)
    // ============================================
    const finalY = doc.lastAutoTable.finalY + 10;
    const boxWidth = 100;
    const boxX = pageWidth - boxWidth - 15;

    // Altura del cuadro depende de si hay descuento
    const boxHeight = descuento > 0 ? 50 : 30;

    // Fondo del cuadro de totales
    doc.setFillColor(248, 248, 248);
    doc.roundedRect(boxX, finalY, boxWidth, boxHeight, 3, 3, "F");

    let totalY = finalY + 10;

    if (descuento > 0) {
      // Subtotal
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(80, 80, 80);
      doc.text("Subtotal:", boxX + 5, totalY);
      doc.text(`S/ ${subtotal.toFixed(2)}`, boxX + boxWidth - 5, totalY, { align: "right" });

      // Descuento
      totalY += 8;
      doc.setTextColor(46, 125, 50); // Verde
      doc.text("Descuento:", boxX + 5, totalY);
      doc.text(`- S/ ${descuento.toFixed(2)}`, boxX + boxWidth - 5, totalY, { align: "right" });

      // Línea separadora
      totalY += 5;
      doc.setDrawColor(dorado[0], dorado[1], dorado[2]);
      doc.setLineWidth(0.5);
      doc.line(boxX + 5, totalY, boxX + boxWidth - 5, totalY);

      totalY += 8;
    }

    // Total final
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(dorado[0], dorado[1], dorado[2]);
    doc.text("TOTAL:", boxX + 5, totalY);
    doc.text(`S/ ${total.toFixed(2)}`, boxX + boxWidth - 5, totalY, { align: "right" });

    // ============================================
    // FOOTER - Franja dorada inferior
    // ============================================
    const footerY = pageHeight - 20;
    
    doc.setFillColor(dorado[0], dorado[1], dorado[2]);
    doc.rect(0, footerY, pageWidth, 20, "F");

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(blanco[0], blanco[1], blanco[2]);
    doc.text("ShowClinic - Clínica de Estética y Belleza", 15, footerY + 8);
    doc.text("Tel: +51 974 212 114  |  Av. Ejército 616, Centro de Negocios, Yanahuara, Perú", 15, footerY + 14);

    // Firma (derecha del footer)
    doc.setDrawColor(blanco[0], blanco[1], blanco[2]);
    doc.setLineWidth(0.3);
    doc.line(pageWidth - 80, footerY + 6, pageWidth - 15, footerY + 6);
    doc.setFontSize(8);
    doc.text("Firma Autorizada", pageWidth - 55, footerY + 12);

    // ============================================
    // GUARDAR PDF
    // ============================================
    const nombreArchivo = `Proforma_${nombreCompleto.replace(/\s+/g, "_")}_${Date.now()}.pdf`;
    console.log("Guardando PDF:", nombreArchivo);
    doc.save(nombreArchivo);
    console.log("PDF generado exitosamente");
    return true;
  } catch (error) {
    console.error("Error generando PDF:", error);
    alert("Error al generar el PDF: " + error.message);
    return false;
  }
};

/**
 * Generar proforma para paquete promocional
 * Usa directamente los datos del paquete tal como fueron guardados
 */
export const generarProformaPaquete = async (paquete, paciente) => {
  try {
    console.log("Generando proforma de paquete...", { paquete, paciente });
    
    // Parsear tratamientos del paquete desde tratamientos_json
    let tratamientos = [];
    if (paquete.tratamientos_json) {
      try {
        tratamientos = JSON.parse(paquete.tratamientos_json);
        console.log("Tratamientos parseados:", tratamientos);
      } catch (e) {
        console.error("Error parseando tratamientos_json:", e);
        tratamientos = [];
      }
    } else if (paquete.tratamientos) {
      tratamientos = paquete.tratamientos;
    }

    // Crear estructura de presupuesto desde el paquete
    // Usar precio_unitario directamente como el precio del tratamiento (ya incluye todo)
    const presupuestoFromPaquete = {
      creado_en: paquete.creado_en || new Date().toISOString(),
      items: tratamientos.map(t => ({
        nombre: t.nombre || t.tratamiento || "Tratamiento",
        sesiones: t.sesiones || 1,
        precio: t.precio_unitario || t.precioUnitario || t.precio || 0,
      })),
      nombrePaquete: paquete.nombre,
    };

    console.log("Presupuesto generado para PDF:", presupuestoFromPaquete);

    return await generarProformaPDF(presupuestoFromPaquete, paciente, "paquete");
  } catch (error) {
    console.error("Error generando proforma de paquete:", error);
    alert("Error al generar la proforma del paquete: " + error.message);
    return false;
  }
};
