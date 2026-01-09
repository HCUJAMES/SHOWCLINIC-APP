import jsPDF from "jspdf";

const loadImage = (src) =>
  new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });

const generarConsentimientoPDF = async (paciente) => {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  let yPos = 15;

  // Colores
  const colorTexto = [0, 0, 0];

  // Cargar logo como marca de agua
  const logoImg = await loadImage("/images/logo-showclinic.png");
  if (logoImg) {
    const logoWidth = 130;
    const logoHeight = (logoImg.height / logoImg.width) * logoWidth;
    const logoX = (pageWidth - logoWidth) / 2;
    const logoY = (pageHeight - logoHeight) / 2;
    
    doc.setGState(new doc.GState({ opacity: 0.35 }));
    doc.addImage(logoImg, "PNG", logoX, logoY, logoWidth, logoHeight);
    doc.setGState(new doc.GState({ opacity: 1.0 }));
  }

  // Función para agregar texto con wrap y justificación
  const addWrappedText = (text, x, y, maxWidth, lineHeight = 4.8, align = "justify") => {
    const lines = doc.splitTextToSize(text, maxWidth);
    lines.forEach((line, index) => {
      doc.text(line, x, y + (index * lineHeight), { align: align === "justify" ? "left" : align });
    });
    return y + lines.length * lineHeight;
  };

  // Calcular edad
  const calcularEdad = (fechaNacimiento) => {
    if (!fechaNacimiento) return "";
    const hoy = new Date();
    const nacimiento = new Date(fechaNacimiento);
    let edad = hoy.getFullYear() - nacimiento.getFullYear();
    const mes = hoy.getMonth() - nacimiento.getMonth();
    if (mes < 0 || (mes === 0 && hoy.getDate() < nacimiento.getDate())) {
      edad--;
    }
    return edad;
  };

  const nombreCompleto = `${paciente.nombre || ""} ${paciente.apellido || ""}`.trim();
  const edad = calcularEdad(paciente.fecha_nacimiento);

  // ENCABEZADO - Fecha y N° H.C.
  doc.setFontSize(10);
  doc.setFont("times", "normal");
  doc.setTextColor(...colorTexto);
  doc.text("Fecha: _______________", margin, yPos);
  doc.text(`N° H.C: _______________`, pageWidth - margin - 50, yPos);
  yPos += 12;

  // TÍTULO
  doc.setFontSize(12);
  doc.setFont("times", "bold");
  doc.text("CONSENTIMIENTO INFORMADO", pageWidth / 2, yPos, { align: "center" });
  yPos += 12;

  // PÁRRAFO INICIAL - con datos en negrita
  doc.setFontSize(10);
  doc.setFont("times", "normal");
  
  // Construir el párrafo con partes en negrita
  let xPos = margin;
  doc.text("Yo, ", xPos, yPos);
  xPos += doc.getTextWidth("Yo, ");
  
  // Nombre en negrita
  doc.setFont("times", "bold");
  const nombreTexto = nombreCompleto || "______________________________";
  doc.text(nombreTexto, xPos, yPos);
  xPos += doc.getTextWidth(nombreTexto);
  
  doc.setFont("times", "normal");
  doc.text(" de ", xPos, yPos);
  xPos += doc.getTextWidth(" de ");
  
  // Edad en negrita
  doc.setFont("times", "bold");
  const edadTexto = edad ? `${edad}` : "____";
  doc.text(edadTexto, xPos, yPos);
  xPos += doc.getTextWidth(edadTexto);
  
  doc.setFont("times", "normal");
  const resto1 = " años de edad, de sexo ";
  doc.text(resto1, xPos, yPos);
  xPos += doc.getTextWidth(resto1);
  
  // Sexo en negrita
  doc.setFont("times", "bold");
  const sexoTexto = paciente.sexo || "____________";
  doc.text(sexoTexto, xPos, yPos);
  xPos += doc.getTextWidth(sexoTexto);
  
  doc.setFont("times", "normal");
  yPos += 5;
  
  const parrafoResto = `con grado de instrucción _________________ y de ocupación ${paciente.ocupacion ? "**" + paciente.ocupacion + "**" : "_________________"} identificado con DNI N°. ${paciente.dni ? "**" + paciente.dni + "**" : "_________________"} en mi calidad de paciente y en pleno uso de mis facultades mentales y de mis derechos de salud, en cumplimiento de la Ley N° 26842 - Ley General de Salud, declaro haber recibido y entendido la información brindada en forma respetuosa y con claridad.`;
  
  // Procesar el resto del texto con negritas
  const partes = parrafoResto.split("**");
  xPos = margin;
  let currentY = yPos;
  
  partes.forEach((parte, index) => {
    if (index % 2 === 0) {
      doc.setFont("times", "normal");
    } else {
      doc.setFont("times", "bold");
    }
    
    const palabras = parte.split(" ");
    palabras.forEach((palabra, i) => {
      const palabraConEspacio = i < palabras.length - 1 ? palabra + " " : palabra;
      const anchoTexto = doc.getTextWidth(palabraConEspacio);
      
      if (xPos + anchoTexto > pageWidth - margin) {
        currentY += 4.8;
        xPos = margin;
      }
      
      doc.text(palabraConEspacio, xPos, currentY);
      xPos += anchoTexto;
    });
  });
  
  yPos = currentY + 6;

  // Por lo que, Doy mi autorización...
  const autorizacion = `Por lo que, Doy mi autorización y conformidad en forma libre y voluntaria:`;
  yPos = addWrappedText(autorizacion, margin, yPos, contentWidth, 4.8);
  yPos += 6;

  // Que el/la Doctor(a)...
  const doctor = `Que el/la Doctor(a): .................................................... .....me realice el PROCEDIMIENTO ESTÉTICO que me ha explicado que:`;
  yPos = addWrappedText(doctor, margin, yPos, contentWidth, 4.8);
  yPos += 6;

  // PUNTOS NUMERADOS
  doc.setFontSize(10);
  doc.setFont("times", "normal");

  const puntos = [
    "1. El objetivo del tratamiento es lograr un relleno dérmico para tratar arrugas, surcos, cicatrices, deformidades faciales, perfilado facial, aumento de labios y/o hidratación mediante inyecciones intradérmicas.",
    
    "2. Se tomará una fotografía de la zona tratada antes de iniciar y después de finalizar el tratamiento, con fines didácticos y científicos, asegurando siempre el respeto a mi intimidad y condición médica.",
    
    "3. He informado al doctor(a) sobre cualquier enfermedad de la piel, alergias, problemas de coagulación, intervenciones médicas/estéticas, etc. así como el uso de medicación para cualquier condición médica. Declaro que todos los antecedentes de mi salud proporcionados son precisos y completos.",
    
    "4. Soy consciente de que las respuestas a los tratamientos pueden variar entre individuos. A pesar de la elección adecuada y la correcta ejecución del tratamiento, pueden ocurrir efectos no deseados, hinchazón, enrojecimiento, dolor, picazón y/o reacciones alérgicas. Además, pueden aparecer hematomas que desaparecen en varios días o con la aplicación de hielo local. Excepcionalmente pueden surgir efectos adversos como granulomas, abscesos o necrosis en la zona tratada.",
    
    "5. Sé que tengo que después del tratamiento, debo mantener la zona limpia, hidratada y desinfectada. Debo evitar la exposición directa a la luz solar o rayos UV, tocar la zona tratada, hacer productos con alcohol, realizar ejercicio intenso o exponerme a altas temperaturas según lo indicado por el médico tratante. Además, se me aconseja no fumar ni consumir alcohol."
  ];

  puntos.forEach(punto => {
    yPos = addWrappedText(punto, margin, yPos, contentWidth, 4.8);
    yPos += 5;
  });

  // PÁRRAFO FINAL (con resaltado amarillo)
  doc.setFont("times", "normal");
  
  const parte1 = `Estoy satisfecho(a) con la información proporcionada y entiendo los beneficios, riesgos y posibles complicaciones del tratamiento. Además, comprendo que `;
  yPos = addWrappedText(parte1, margin, yPos, contentWidth, 4.8);
  
  // Texto resaltado en amarillo
  const textoResaltado = `no se aceptan cambios ni devoluciones DE ADELANTOS, CONSULTAS, PAGO PARCIAL O TOTAL DEL TRATAMIENTO`;
  const lineasResaltadas = doc.splitTextToSize(textoResaltado, contentWidth);
  
  lineasResaltadas.forEach((linea) => {
    const anchoLinea = doc.getTextWidth(linea);
    // Dibujar rectángulo amarillo de fondo
    doc.setFillColor(255, 255, 0); // Amarillo
    doc.rect(margin, yPos - 3, anchoLinea, 5, 'F');
    // Escribir texto encima
    doc.setTextColor(0, 0, 0);
    doc.text(linea, margin, yPos);
    yPos += 4.8;
  });
  
  const parte2 = `, pero estoy dispuesto(a) a discutir cualquier preocupación para llegar a un acuerdo, y comprendo que este es un documento MÉDICO LEGAL, según la LEY N° 29414 en el cual bajo todo el completo uso de mis facultades acepto el o los tratamientos que estoy tomando y sus resultados finales.`;
  yPos = addWrappedText(parte2, margin, yPos, contentWidth, 4.8);
  yPos += 8;

  // FIRMA DEL PACIENTE
  doc.setFont("times", "normal");
  doc.text(`Paciente: `, margin, yPos);
  doc.setFont("times", "bold");
  doc.text(nombreCompleto || "_________________________________________________________", margin + 20, yPos);
  yPos += 10;

  doc.setFont("times", "normal");
  doc.text(`(DNI/FIRMA)`, pageWidth / 2, yPos, { align: "center" });
  yPos += 12;

  // FIRMA DEL ESPECIALISTA
  doc.text(`Especialista: _____________________________________________________`, margin, yPos);
  yPos += 10;

  doc.text(`_______________________`, pageWidth / 2 - 30, yPos, { align: "center" });
  yPos += 4;
  doc.text(`(DNI/FIRMA)`, pageWidth / 2 - 30, yPos, { align: "center" });

  // Guardar PDF
  const nombreArchivo = `Consentimiento_${nombreCompleto.replace(/\s+/g, "_")}_${new Date().getTime()}.pdf`;
  doc.save(nombreArchivo);
};

export default generarConsentimientoPDF;
