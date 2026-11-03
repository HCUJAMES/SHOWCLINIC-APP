/**
 * Carga diferida de librerías pesadas.
 *
 * jsPDF, autoTable, html2canvas y xlsx suman cerca de 1 MB. Solo hacen falta
 * al exportar o imprimir, así que se descargan la primera vez que se usan
 * en vez de al abrir la página.
 */

export const cargarPDF = async () => {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  return { jsPDF, autoTable };
};

export const cargarHtml2canvas = async () => (await import("html2canvas")).default;

export const cargarXLSX = () => import("xlsx");
