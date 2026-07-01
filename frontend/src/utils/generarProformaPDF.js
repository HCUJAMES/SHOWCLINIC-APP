import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatearFecha, obtenerFechaSoloPerú } from "./dateUtils";

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
 * Generar proforma en PDF con diseño profesional VERTICAL (A4 Portrait)
 * Diseño elegante con colores de ShowClinic según especificaciones
 * Incluye segunda página con cronograma visual del tratamiento
 * @param {Object} presupuesto - Datos del presupuesto
 * @param {Object} paciente - Datos del paciente
 * @param {string} tipo - Tipo de documento
 * @param {string|null} seguimientoImageBase64 - Captura del gráfico de seguimiento (si existe)
 */
export const generarProformaPDF = async (presupuesto, paciente, tipo = "presupuesto", seguimientoImageBase64 = null) => {
  try {
    console.log("Generando proforma PDF con cronograma...", { presupuesto, paciente, tipo });
    
    // Cargar logo
    const logoBase64 = await loadImageAsBase64(LOGO_URL);
    
    // Crear PDF en orientación VERTICAL (portrait) A4
    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4"
    });
    
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    // Paleta de marca ShowClinic
    const marron = [93, 64, 55]; // #5D4037
    const bronce = [169, 113, 46]; // #A9712E
    const dorado = [200, 169, 110]; // #C8A96E
    const crema = [255, 252, 247]; // #FFFCF7
    const blanco = [255, 255, 255];
    const grisTexto = [80, 80, 80];
    const verdeCortes = [94, 140, 97]; // #5E8C61
    const divisor = [238, 229, 215]; // #EEE5D7

    // ============================================
    // HEADER CON GRADIENTE MARRÓN → BRONCE
    // ============================================
    // Simular gradiente con franjas horizontales
    const headerHeight = 40;
    const stripes = 40;
    for (let i = 0; i < stripes; i++) {
      const ratio = i / stripes;
      const r = marron[0] + (bronce[0] - marron[0]) * ratio;
      const g = marron[1] + (bronce[1] - marron[1]) * ratio;
      const b = marron[2] + (bronce[2] - marron[2]) * ratio;
      doc.setFillColor(r, g, b);
      doc.rect(0, (headerHeight / stripes) * i, pageWidth, headerHeight / stripes, "F");
    }

    // Logo en marco redondeado blanco (izquierda)
    const logoX = 15;
    const logoY = 8;
    const logoSize = 24;
    doc.setFillColor(blanco[0], blanco[1], blanco[2]);
    doc.roundedRect(logoX, logoY, logoSize, logoSize, 3, 3, "F");
    
    if (logoBase64) {
      try {
        doc.addImage(logoBase64, "PNG", logoX + 2, logoY + 2, logoSize - 4, logoSize - 4);
      } catch (e) {
        console.log("No se pudo agregar el logo");
      }
    }

    // Nombre "ShowClinic" y subtítulo (izquierda, después del logo)
    doc.setFontSize(20);
    doc.setFont("times", "bold"); // Cormorant Garamond → times como aproximación
    doc.setTextColor(blanco[0], blanco[1], blanco[2]);
    doc.text("ShowClinic", logoX + logoSize + 5, 20);

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal"); // DM Sans → helvetica
    doc.text("Clínica de Estética y Belleza", logoX + logoSize + 5, 26);

    // Título "PROFORMA" y N° (derecha)
    doc.setFontSize(24);
    doc.setFont("times", "bold");
    doc.text("PROFORMA", pageWidth - 15, 20, { align: "right" });

    const numeroProforma = Date.now().toString().slice(-8);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setFillColor(dorado[0], dorado[1], dorado[2]);
    doc.roundedRect(pageWidth - 50, 24, 35, 7, 2, 2, "F");
    doc.setTextColor(blanco[0], blanco[1], blanco[2]);
    doc.text(`N° ${numeroProforma}`, pageWidth - 32.5, 28.5, { align: "center" });

    // Línea de acento dorado debajo del header
    doc.setDrawColor(dorado[0], dorado[1], dorado[2]);
    doc.setLineWidth(1);
    doc.line(0, headerHeight, pageWidth, headerHeight);

    // ============================================
    // DOS TARJETAS: DATOS DEL CLIENTE E INFORMACIÓN
    // ============================================
    let yPos = headerHeight + 10;
    const cardWidth = (pageWidth - 40) / 2;
    const cardHeight = 28;
    const cardX1 = 15;
    const cardX2 = cardX1 + cardWidth + 10;

    // Tarjeta 1: Datos del Cliente
    doc.setFillColor(crema[0], crema[1], crema[2]);
    doc.roundedRect(cardX1, yPos, cardWidth, cardHeight, 3, 3, "F");
    doc.setDrawColor(dorado[0], dorado[1], dorado[2]);
    doc.setLineWidth(0.8);
    doc.line(cardX1, yPos, cardX1 + cardWidth, yPos); // Borde superior dorado

    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(bronce[0], bronce[1], bronce[2]);
    doc.text("— DATOS DEL CLIENTE", cardX1 + 4, yPos + 6);

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(grisTexto[0], grisTexto[1], grisTexto[2]);
    
    const nombreCompleto = `${paciente.nombre || ""} ${paciente.apellido || ""}`.trim() || "Cliente";
    doc.setFont("helvetica", "bold");
    doc.text("Nombre", cardX1 + 4, yPos + 12);
    doc.setFont("helvetica", "normal");
    doc.text(nombreCompleto, cardX1 + 4, yPos + 16);

    doc.setFont("helvetica", "bold");
    doc.text("Documento", cardX1 + 4, yPos + 21);
    doc.setFont("helvetica", "normal");
    const documento = paciente.dni ? `${paciente.tipoDocumento || 'DNI'} ${paciente.dni}` : "—";
    doc.text(documento, cardX1 + 4, yPos + 25);

    // Tarjeta 2: Información
    doc.setFillColor(crema[0], crema[1], crema[2]);
    doc.roundedRect(cardX2, yPos, cardWidth, cardHeight, 3, 3, "F");
    doc.setDrawColor(dorado[0], dorado[1], dorado[2]);
    doc.setLineWidth(0.8);
    doc.line(cardX2, yPos, cardX2 + cardWidth, yPos);

    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(bronce[0], bronce[1], bronce[2]);
    doc.text("— INFORMACIÓN", cardX2 + 4, yPos + 6);

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(grisTexto[0], grisTexto[1], grisTexto[2]);

    const fecha = presupuesto.creado_en || obtenerFechaSoloPerú();
    const fechaFormateada = formatearFecha(fecha);
    
    doc.setFont("helvetica", "bold");
    doc.text("Fecha", cardX2 + 4, yPos + 12);
    doc.setFont("helvetica", "normal");
    doc.text(fechaFormateada, cardX2 + 4, yPos + 16);

    doc.setFont("helvetica", "bold");
    doc.text("N° Proforma", cardX2 + 4, yPos + 21);
    doc.setFont("helvetica", "normal");
    doc.text(numeroProforma, cardX2 + 4, yPos + 25);

    // ============================================
    // TABLA DE SERVICIOS
    // ============================================
    yPos += cardHeight + 10;

    const items = presupuesto.items || presupuesto.tratamientos || [];
    
    // Preparar datos de la tabla con manejo especial para cortesías
    const tableData = items.map((item, index) => {
      const precio = Number(item.precio || 0);
      const esCortesia = precio === 0;
      
      return [
        (index + 1).toString(),
        item.nombre || item.tratamiento || "Tratamiento",
        item.sesiones ? item.sesiones.toString() : "1",
        esCortesia ? "CORTESIA" : `S/ ${precio.toFixed(2)}`,
      ];
    });

    autoTable(doc, {
      startY: yPos,
      head: [["#", "DESCRIPCIÓN DEL SERVICIO", "SESIONES", "PRECIO"]],
      body: tableData,
      theme: "plain",
      headStyles: {
        fillColor: [marron[0], marron[1], marron[2]], // Marrón de marca, NO negro
        textColor: [blanco[0], blanco[1], blanco[2]],
        fontStyle: "bold",
        fontSize: 9,
        halign: "center",
        cellPadding: 4,
      },
      bodyStyles: {
        fontSize: 9,
        textColor: [grisTexto[0], grisTexto[1], grisTexto[2]],
        cellPadding: 4,
      },
      alternateRowStyles: {
        fillColor: [crema[0], crema[1], crema[2]],
      },
      columnStyles: {
        0: { 
          halign: "center", 
          cellWidth: 15,
        },
        1: { 
          cellWidth: 95,
          textColor: [grisTexto[0], grisTexto[1], grisTexto[2]],
        },
        2: { 
          halign: "center", 
          cellWidth: 25,
        },
        3: { 
          halign: "right", 
          cellWidth: 45,
        },
      },
      margin: { left: 15, right: 15 },
      styles: {
        lineColor: [divisor[0], divisor[1], divisor[2]],
        lineWidth: 0.1,
      },
      didDrawCell: (data) => {
        // Dibujar círculo dorado para el número de ítem
        if (data.section === 'body' && data.column.index === 0) {
          const centerX = data.cell.x + data.cell.width / 2;
          const centerY = data.cell.y + data.cell.height / 2;
          doc.setDrawColor(dorado[0], dorado[1], dorado[2]);
          doc.setLineWidth(0.5);
          doc.circle(centerX, centerY, 4, 'S');
        }
        
        // Dibujar chip verde de cortesía para precios S/ 0.00
        if (data.section === 'body' && data.column.index === 3 && data.cell.raw === "CORTESIA") {
          const cellX = data.cell.x;
          const cellY = data.cell.y;
          const cellWidth = data.cell.width;
          const cellHeight = data.cell.height;
          
          // Chip verde con ícono de regalo
          const chipWidth = 30;
          const chipHeight = 6;
          const chipX = cellX + cellWidth - chipWidth - 3;
          const chipY = cellY + (cellHeight - chipHeight) / 2;
          
          doc.setFillColor(verdeCortes[0], verdeCortes[1], verdeCortes[2]);
          doc.roundedRect(chipX, chipY, chipWidth, chipHeight, 2, 2, "F");
          
          // Ícono de regalo SVG inline (line icon estilo Lucide)
          const iconX = chipX + 2;
          const iconY = chipY + chipHeight / 2;
          const iconSize = 3;
          
          doc.setDrawColor(blanco[0], blanco[1], blanco[2]);
          doc.setLineWidth(0.3);
          // Caja del regalo
          doc.rect(iconX, iconY - iconSize/2, iconSize, iconSize, 'S');
          // Lazo superior
          doc.line(iconX, iconY - iconSize/2, iconX + iconSize, iconY - iconSize/2);
          doc.line(iconX + iconSize/2, iconY - iconSize/2 - 1, iconX + iconSize/2, iconY - iconSize/2);
          
          // Texto "Cortesía"
          doc.setFontSize(7);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(blanco[0], blanco[1], blanco[2]);
          doc.text("Cortesía", chipX + iconSize + 3, chipY + chipHeight / 2 + 1);
        }
      },
    });

    // ============================================
    // CAJA DE TOTALES (alineada a la derecha)
    // ============================================
    let finalY = doc.lastAutoTable.finalY + 10;
    const totalesWidth = 80;
    const totalesX = pageWidth - totalesWidth - 15;

    // Calcular totales
    const subtotal = items.reduce((sum, item) => sum + Number(item.precio || 0), 0);
    const descuento = Number(presupuesto.descuento) || 0;
    const total = subtotal - descuento;

    // Fondo crema
    const totalesHeight = descuento > 0 ? 32 : 22;
    doc.setFillColor(crema[0], crema[1], crema[2]);
    doc.roundedRect(totalesX, finalY, totalesWidth, totalesHeight, 3, 3, "F");

    let totalY = finalY + 8;

    // Subtotal
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(grisTexto[0], grisTexto[1], grisTexto[2]);
    doc.text("Subtotal", totalesX + 4, totalY);
    doc.text(`S/ ${subtotal.toFixed(2)}`, totalesX + totalesWidth - 4, totalY, { align: "right" });

    if (descuento > 0) {
      totalY += 7;
      doc.text("Descuentos", totalesX + 4, totalY);
      doc.text(`S/ ${descuento.toFixed(2)}`, totalesX + totalesWidth - 4, totalY, { align: "right" });
    }

    // Caja de Total con gradiente marrón → bronce
    totalY = finalY + totalesHeight + 2;
    const totalBoxHeight = 14;
    
    // Gradiente para el total
    const totalStripes = 20;
    for (let i = 0; i < totalStripes; i++) {
      const ratio = i / totalStripes;
      const r = marron[0] + (bronce[0] - marron[0]) * ratio;
      const g = marron[1] + (bronce[1] - marron[1]) * ratio;
      const b = marron[2] + (bronce[2] - marron[2]) * ratio;
      doc.setFillColor(r, g, b);
      doc.rect(totalesX + (totalesWidth / totalStripes) * i, totalY, totalesWidth / totalStripes, totalBoxHeight, "F");
    }
    
    doc.roundedRect(totalesX, totalY, totalesWidth, totalBoxHeight, 3, 3, "S");

    doc.setFontSize(14);
    doc.setFont("times", "bold");
    doc.setTextColor(blanco[0], blanco[1], blanco[2]);
    doc.text("Total", totalesX + 4, totalY + 9);
    doc.text(`S/ ${total.toFixed(2)}`, totalesX + totalesWidth - 4, totalY + 9, { align: "right" });

    // ============================================
    // DOS BLOQUES: TÉRMINOS Y CONDICIONES + MEDIOS DE PAGO
    // ============================================
    finalY = totalY + totalBoxHeight + 12;
    const blockWidth = (pageWidth - 40) / 2;
    const blockX1 = 15;
    const blockX2 = blockX1 + blockWidth + 10;

    // Bloque 1: Términos y Condiciones
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(marron[0], marron[1], marron[2]);
    doc.text("TÉRMINOS Y CONDICIONES", blockX1, finalY);

    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(grisTexto[0], grisTexto[1], grisTexto[2]);
    const terminos = [
      "Esta proforma tiene una validez de 15 días desde la fecha",
      "de emisión. Los precios incluyen IGV. Para confirmar su",
      "cita y reservar el tratamiento, comuníquese con nuestra",
      "recepción."
    ];
    let terminosY = finalY + 5;
    terminos.forEach(linea => {
      doc.text(linea, blockX1, terminosY);
      terminosY += 4;
    });

    // Bloque 2: Medios de Pago
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(marron[0], marron[1], marron[2]);
    doc.text("MEDIOS DE PAGO", blockX2, finalY);

    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(grisTexto[0], grisTexto[1], grisTexto[2]);
    
    let pagosY = finalY + 5;
    const mediosPago = [
      { label: "Efectivo / Tarjeta", value: "Aceptado" },
      { label: "Yape / Plin", value: "974 212 114" },
      { label: "Transferencia", value: "BCP" }
    ];
    
    mediosPago.forEach(medio => {
      doc.setFont("helvetica", "bold");
      doc.text(medio.label, blockX2, pagosY);
      doc.setFont("helvetica", "normal");
      doc.text(medio.value, blockX2 + blockWidth - 4, pagosY, { align: "right" });
      pagosY += 4.5;
    });

    // ============================================
    // FIRMA AUTORIZADA (alineada a la derecha)
    // ============================================
    const firmaY = finalY + 25;
    const firmaX = pageWidth - 60;
    
    doc.setDrawColor(grisTexto[0], grisTexto[1], grisTexto[2]);
    doc.setLineWidth(0.3);
    doc.line(firmaX, firmaY, firmaX + 45, firmaY);
    
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(grisTexto[0], grisTexto[1], grisTexto[2]);
    doc.text("FIRMA AUTORIZADA", firmaX + 22.5, firmaY + 4, { align: "center" });
    doc.setFontSize(7);
    doc.text("ShowClinic - Estética y Belleza", firmaX + 22.5, firmaY + 8, { align: "center" });

    // ============================================
    // FOOTER CON GRADIENTE DE MARCA
    // ============================================
    const footerHeight = 18;
    const footerY = pageHeight - footerHeight;
    
    // Gradiente marrón → bronce
    const footerStripes = 30;
    for (let i = 0; i < footerStripes; i++) {
      const ratio = i / footerStripes;
      const r = marron[0] + (bronce[0] - marron[0]) * ratio;
      const g = marron[1] + (bronce[1] - marron[1]) * ratio;
      const b = marron[2] + (bronce[2] - marron[2]) * ratio;
      doc.setFillColor(r, g, b);
      doc.rect(0, footerY + (footerHeight / footerStripes) * i, pageWidth, footerHeight / footerStripes, "F");
    }

    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(blanco[0], blanco[1], blanco[2]);
    doc.text("ShowClinic", 15, footerY + 7);
    
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.text("Tel: +51 974 212 114  |  Av. Ejército 616, Centro de Negocios, Yanahuara, Perú", 15, footerY + 12);

    // Handle @showclinic (derecha del footer)
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setFillColor(dorado[0], dorado[1], dorado[2]);
    doc.roundedRect(pageWidth - 45, footerY + 5, 30, 7, 2, 2, "F");
    doc.setTextColor(blanco[0], blanco[1], blanco[2]);
    doc.text("@showclinic", pageWidth - 30, footerY + 9.5, { align: "center" });

    // ============================================
    // MARCA DE AGUA OPCIONAL (monograma "S")
    // ============================================
    doc.setFontSize(180);
    doc.setFont("times", "bold");
    doc.setTextColor(0, 0, 0);
    doc.setGState(new doc.GState({ opacity: 0.02 }));
    doc.text("S", pageWidth / 2, pageHeight / 2, { 
      align: "center",
      baseline: "middle"
    });
    doc.setGState(new doc.GState({ opacity: 1 })); // Restaurar opacidad

    // ============================================
    // SEGUNDA PÁGINA: CRONOGRAMA DEL TRATAMIENTO
    // ============================================
    {
      // Página horizontal para mejor visualización del cronograma
      doc.addPage('l'); // landscape
      const pgW = doc.internal.pageSize.getWidth();   // ~297mm
      const pgH = doc.internal.pageSize.getHeight();  // ~210mm
      const hdrH = 32;
      const ftrH = 18;
      const ftrY = pgH - ftrH;
      
      // Header con gradiente
      for (let i = 0; i < stripes; i++) {
        const ratio = i / stripes;
        const r = marron[0] + (bronce[0] - marron[0]) * ratio;
        const g = marron[1] + (bronce[1] - marron[1]) * ratio;
        const b = marron[2] + (bronce[2] - marron[2]) * ratio;
        doc.setFillColor(r, g, b);
        doc.rect(0, (hdrH / stripes) * i, pgW, hdrH / stripes, "F");
      }

      // Logo
      doc.setFillColor(blanco[0], blanco[1], blanco[2]);
      doc.roundedRect(logoX, logoY, logoSize, logoSize, 3, 3, "F");
      if (logoBase64) {
        try {
          doc.addImage(logoBase64, "PNG", logoX + 2, logoY + 2, logoSize - 4, logoSize - 4);
        } catch (e) {
          console.log("No se pudo agregar el logo");
        }
      }

      // Título de la sección
      doc.setFontSize(18);
      doc.setFont("times", "bold");
      doc.setTextColor(blanco[0], blanco[1], blanco[2]);
      doc.text("CRONOGRAMA DE TRATAMIENTO", pgW / 2, 20, { align: "center" });
      
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.text("Plan de sesiones personalizado", pgW / 2, 28, { align: "center" });

      // Línea de acento dorado
      doc.setDrawColor(dorado[0], dorado[1], dorado[2]);
      doc.setLineWidth(1);
      doc.line(0, hdrH, pgW, hdrH);

      // Información del paciente
      yPos = hdrH + 8;
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(bronce[0], bronce[1], bronce[2]);
      doc.text(`Paciente: ${nombreCompleto}`, 15, yPos);
      
      const totalSesiones = items.reduce((sum, item) => sum + (Number(item.sesiones) || 1), 0);
      doc.text(`Total de sesiones: ${totalSesiones}`, pgW - 15, yPos, { align: "right" });

      yPos += 8;

      // Si tenemos la captura real del gráfico, usarla directamente
      if (seguimientoImageBase64) {
        try {
          // Reducir al 70% del espacio disponible para que no se vea tan grande
          const maxWidth = (pgW - 40) * 0.7;
          const maxHeight = (pgH - yPos - ftrH - 10) * 0.7;
          const imgX = (pgW - maxWidth) / 2; // Centrar horizontalmente
          doc.addImage(seguimientoImageBase64, "PNG", imgX, yPos + 5, maxWidth, maxHeight);
        } catch (e) {
          console.error("Error agregando imagen de seguimiento:", e);
          doc.setFontSize(10);
          doc.setTextColor(grisTexto[0], grisTexto[1], grisTexto[2]);
          doc.text("No se pudo cargar la imagen del seguimiento", pgW / 2, yPos + 20, { align: "center" });
        }
      } else {
      // ─── DIBUJAR CRONOGRAMA VISUAL (fallback) ───
      // Categorizar tratamientos
      const categorizeTreatment = (nombre) => {
        const n = (nombre || '').toLowerCase();
        if (n.includes('corporal') || n.includes('reducti') || n.includes('lipopapada') || n.includes('lipo') || 
            n.includes('masaje') || n.includes('modelado') || n.includes('criolipo') || n.includes('cavita') ||
            n.includes('drenaje') || n.includes('reafirm') || n.includes('gluteo') || n.includes('abdomen')) {
          return 'corporal';
        }
        if (n.includes('facial') || n.includes('hifu') || n.includes('radiofrecuencia') || n.includes('limpieza') || 
            n.includes('peeling') || n.includes('microneeld') || n.includes('dermapen') || n.includes('led') ||
            n.includes('cosm') || n.includes('rejuvenec') || n.includes('mancha') || n.includes('acne') ||
            n.includes('carboxi')) {
          return 'facial';
        }
        return 'armonizacion';
      };

      const categoryConfig = {
        corporal: { label: "Cosmiatría Corporal", color: [95, 147, 138], initial: "C" },
        facial: { label: "Cosmiatría Facial", color: [192, 132, 109], initial: "F" },
        armonizacion: { label: "Armonización", color: [200, 169, 110], initial: "A" },
      };

      // Organizar items por categoría con sesiones
      const sessionsByCategory = {};
      items.forEach((item) => {
        const cat = categorizeTreatment(item.nombre || item.tratamiento || "");
        if (!sessionsByCategory[cat]) sessionsByCategory[cat] = [];
        const numSesiones = Number(item.sesiones) || 1;
        for (let s = 1; s <= numSesiones; s++) {
          sessionsByCategory[cat].push({
            nombre: item.nombre || item.tratamiento || "Tratamiento",
            sesionNum: s,
            totalSesiones: numSesiones,
          });
        }
      });

      // Calcular semanas necesarias
      const maxSessions = Math.max(...Object.values(sessionsByCategory).map(arr => arr.length), 1);
      const numWeeks = Math.max(4, maxSessions);

      // ─── Dibujar el gráfico tipo timeline ───
      const graphX = 15;
      const graphY = yPos;
      const graphWidth = pgW - 30;
      const laneHeight = 38;
      const catKeys = Object.keys(sessionsByCategory);
      const activeCats = catKeys.length > 0 ? catKeys : ['armonizacion'];
      const graphHeight = activeCats.length * laneHeight + 30; // +30 para header de semanas

      // Fondo del gráfico
      doc.setFillColor(255, 252, 247);
      doc.roundedRect(graphX, graphY, graphWidth, graphHeight, 4, 4, "F");
      doc.setDrawColor(dorado[0], dorado[1], dorado[2]);
      doc.setLineWidth(0.3);
      doc.roundedRect(graphX, graphY, graphWidth, graphHeight, 4, 4, "S");

      // Header con semanas
      const weekWidth = graphWidth / numWeeks;
      const headerY2 = graphY;
      
      doc.setFillColor(245, 240, 230);
      doc.rect(graphX, headerY2, graphWidth, 10, "F");
      
      for (let w = 0; w < numWeeks; w++) {
        const wx = graphX + w * weekWidth + weekWidth / 2;
        doc.setFontSize(7);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(marron[0], marron[1], marron[2]);
        doc.text(`SEM ${w + 1}`, wx, headerY2 + 7, { align: "center" });
        
        // Líneas verticales divisorias
        if (w > 0) {
          doc.setDrawColor(dorado[0], dorado[1], dorado[2]);
          doc.setLineWidth(0.15);
          doc.line(graphX + w * weekWidth, headerY2, graphX + w * weekWidth, graphY + graphHeight);
        }
      }

      // Dibujar carriles por categoría
      activeCats.forEach((catKey, catIdx) => {
        const config = categoryConfig[catKey] || categoryConfig.armonizacion;
        const laneY = graphY + 12 + catIdx * laneHeight;
        const sessions = sessionsByCategory[catKey] || [];

        // Etiqueta de categoría (lado izquierdo, dentro del carril)
        // Círculo con inicial
        const labelX = graphX + 4;
        const labelY = laneY + laneHeight / 2;
        doc.setFillColor(config.color[0], config.color[1], config.color[2]);
        doc.circle(labelX + 4, labelY, 4, "F");
        doc.setFontSize(7);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(255, 255, 255);
        doc.text(config.initial, labelX + 4, labelY + 2.5, { align: "center" });

        // Nombre de categoría
        doc.setFontSize(6.5);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(config.color[0], config.color[1], config.color[2]);
        doc.text(config.label, labelX + 10, labelY + 2);

        // Línea horizontal del carril (guía)
        const lineStartX = graphX + 35;
        const lineEndX = graphX + graphWidth - 5;
        doc.setDrawColor(config.color[0], config.color[1], config.color[2]);
        doc.setLineWidth(0.3);
        doc.setLineDashPattern([2, 2], 0);
        doc.line(lineStartX, labelY, lineEndX, labelY);
        doc.setLineDashPattern([], 0);

        // Dibujar nodos de sesiones
        const nodeStartX = graphX + 38;
        const availableWidth = graphWidth - 45;
        
        sessions.forEach((session, sIdx) => {
          const weekForSession = sIdx; // Una sesión por semana
          const nodeX = nodeStartX + (weekForSession + 0.5) * (availableWidth / numWeeks);
          const nodeY = labelY;
          const nodeR = 5;

          // Círculo del nodo (pendiente - borde punteado)
          doc.setFillColor(255, 252, 247);
          doc.setDrawColor(config.color[0], config.color[1], config.color[2]);
          doc.setLineWidth(0.6);
          doc.circle(nodeX, nodeY, nodeR, "FD");

          // Número de orden dentro del nodo
          doc.setFontSize(6);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(config.color[0], config.color[1], config.color[2]);
          doc.text(`${sIdx + 1}`, nodeX, nodeY + 2, { align: "center" });

          // Nombre del tratamiento debajo del nodo (solo primera sesión de cada tratamiento)
          if (session.sesionNum === 1 || sessions.length <= numWeeks) {
            doc.setFontSize(5);
            doc.setFont("helvetica", "normal");
            doc.setTextColor(grisTexto[0], grisTexto[1], grisTexto[2]);
            const nombre = session.nombre.length > 18 ? session.nombre.substring(0, 16) + "..." : session.nombre;
            doc.text(nombre, nodeX, nodeY + nodeR + 4, { align: "center" });
          }

          // Conectar nodos con línea
          if (sIdx > 0) {
            const prevNodeX = nodeStartX + (sIdx - 1 + 0.5) * (availableWidth / numWeeks);
            doc.setDrawColor(config.color[0], config.color[1], config.color[2]);
            doc.setLineWidth(0.5);
            doc.line(prevNodeX + nodeR, nodeY, nodeX - nodeR, nodeY);
          }
        });
      });

      // ─── Línea de ALTA al final ───
      const altaX = graphX + graphWidth - 8;
      doc.setDrawColor(76, 175, 80);
      doc.setLineWidth(0.8);
      doc.line(altaX, graphY + 10, altaX, graphY + graphHeight - 2);
      
      // Etiqueta ALTA
      doc.setFillColor(76, 175, 80);
      doc.roundedRect(altaX - 7, graphY + 10, 14, 5, 1.5, 1.5, "F");
      doc.setFontSize(6);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(255, 255, 255);
      doc.text("ALTA", altaX, graphY + 13.5, { align: "center" });

      // ─── LEYENDA ───
      yPos = graphY + graphHeight + 10;
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(marron[0], marron[1], marron[2]);
      doc.text("LEYENDA", 15, yPos);
      yPos += 6;

      const legendItems = [
        { color: [95, 147, 138], label: "Cosmiatría Corporal — Modelado y reductivos" },
        { color: [192, 132, 109], label: "Cosmiatría Facial — Aparatología y limpieza" },
        { color: [200, 169, 110], label: "Armonización — Inyectables y rellenos" },
      ];

      legendItems.forEach((item) => {
        doc.setFillColor(item.color[0], item.color[1], item.color[2]);
        doc.circle(20, yPos - 1.5, 2.5, "F");
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(grisTexto[0], grisTexto[1], grisTexto[2]);
        doc.text(item.label, 25, yPos);
        yPos += 6;
      });

      // Nota del cronograma
      yPos += 4;
      doc.setFillColor(crema[0], crema[1], crema[2]);
      doc.roundedRect(15, yPos, pgW - 30, 18, 3, 3, "F");
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(grisTexto[0], grisTexto[1], grisTexto[2]);
      doc.text("Nota: El cronograma es referencial. Las fechas exactas de cada sesión se", 20, yPos + 6);
      doc.text("coordinarán con su especialista según disponibilidad y evolución del tratamiento.", 20, yPos + 11);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(bronce[0], bronce[1], bronce[2]);
      doc.text("Frecuencia recomendada: 1 sesión por semana.", 20, yPos + 16);
      } // fin else (cronograma generado)

      // Footer en la segunda página (landscape)
      for (let i = 0; i < footerStripes; i++) {
        const ratio = i / footerStripes;
        const r = marron[0] + (bronce[0] - marron[0]) * ratio;
        const g = marron[1] + (bronce[1] - marron[1]) * ratio;
        const b = marron[2] + (bronce[2] - marron[2]) * ratio;
        doc.setFillColor(r, g, b);
        doc.rect(0, ftrY + (ftrH / footerStripes) * i, pgW, ftrH / footerStripes, "F");
      }

      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(blanco[0], blanco[1], blanco[2]);
      doc.text("ShowClinic", 15, ftrY + 7);
      
      doc.setFontSize(7);
      doc.setFont("helvetica", "normal");
      doc.text("Tel: +51 974 212 114  |  Av. Ejército 616, Centro de Negocios, Yanahuara, Perú", 15, ftrY + 12);

      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setFillColor(dorado[0], dorado[1], dorado[2]);
      doc.roundedRect(pgW - 45, ftrY + 5, 30, 7, 2, 2, "F");
      doc.setTextColor(blanco[0], blanco[1], blanco[2]);
      doc.text("@showclinic", pgW - 30, ftrY + 9.5, { align: "center" });
    }

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
      creado_en: paquete.creado_en || obtenerFechaSoloPerú(),
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
