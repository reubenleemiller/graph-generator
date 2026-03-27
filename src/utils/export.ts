import { jsPDF } from "jspdf";

/**
 * Download a canvas as a PNG file.
 */
export function downloadCanvasAsPNG(
  canvas: HTMLCanvasElement,
  filename: string
): void {
  const link = document.createElement("a");
  link.download = filename;
  link.href = canvas.toDataURL("image/png");
  link.click();
}

/**
 * Export a single canvas as a PDF page.
 */
export function exportCanvasAsPDF(
  canvas: HTMLCanvasElement,
  filename: string
): void {
  const imgData = canvas.toDataURL("image/png");
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const margin = 10;
  const pageWidth = pdf.internal.pageSize.getWidth();
  const size = pageWidth - margin * 2;
  pdf.addImage(imgData, "PNG", margin, margin, size, size);
  pdf.save(filename);
}

/**
 * Export multiple canvas images as separate pages in one PDF.
 */
export function exportCanvasArrayAsPDF(
  canvases: Array<{ canvas: HTMLCanvasElement; label: string }>,
  filename: string
): void {
  if (canvases.length === 0) return;
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const margin = 10;
  const pageWidth = pdf.internal.pageSize.getWidth();
  const size = pageWidth - margin * 2;

  canvases.forEach(({ canvas, label }, index) => {
    if (index > 0) pdf.addPage();
    const imgData = canvas.toDataURL("image/png");
    pdf.addImage(imgData, "PNG", margin, margin, size, size);
    pdf.setFontSize(10);
    pdf.text(label, margin, margin + size + 6);
  });

  pdf.save(filename);
}
