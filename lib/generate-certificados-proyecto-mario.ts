import { PDFDocument, rgb, StandardFonts } from "pdf-lib"
import type { ProyectoMarioCicloTipo } from "./mod/proyecto-mario-ciclos-service"

const MODULO_LABELS: Record<ProyectoMarioCicloTipo, string> = {
  belleza_integral_sabados: "BELLEZA INTEGRAL - SABADOS",
  belleza_integral_viernes: "BELLEZA INTEGRAL - VIERNES",
  manualidades: "MANUALIDADES",
  belleza_cejas: "BELLEZA CEJAS",
  gastronomia: "GASTRONOMÍA",
}

/**
 * Genera un PDF genérico blanco y negro con una página de certificado por cada nombre aprobado.
 * No usa plantilla externa, se genera completamente con pdf-lib.
 */
export async function generateCertificadosProyectoMarioPDF(
  aprobados: string[],
  tipo: ProyectoMarioCicloTipo
): Promise<Uint8Array> {
  const doc = await PDFDocument.create()

  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold)
  const fontRegular = await doc.embedFont(StandardFonts.Helvetica)
  const fontItalic = await doc.embedFont(StandardFonts.HelveticaOblique)

  // Fecha actual formateada
  const hoy = new Date()
  const meses = [
    "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
  ]
  const fechaText = `Manta, ${hoy.getDate()} de ${meses[hoy.getMonth()]} de ${hoy.getFullYear()}`

  const moduloText = MODULO_LABELS[tipo]

  for (const nombre of aprobados) {
    // Página tamaño carta horizontal (landscape)
    const page = doc.addPage([842, 595]) // A4 landscape
    const { width, height } = page.getSize()

    // --- BORDE ---
    const margin = 40
    page.drawRectangle({
      x: margin,
      y: margin,
      width: width - margin * 2,
      height: height - margin * 2,
      borderColor: rgb(0, 0, 0),
      borderWidth: 2,
    })

    // Borde interior decorativo
    page.drawRectangle({
      x: margin + 10,
      y: margin + 10,
      width: width - (margin + 10) * 2,
      height: height - (margin + 10) * 2,
      borderColor: rgb(0.3, 0.3, 0.3),
      borderWidth: 1,
    })

    // --- TÍTULO: "CERTIFICADO DE APROBACIÓN" ---
    const tituloText = "CERTIFICADO DE APROBACIÓN"
    const tituloFontSize = 28
    const tituloWidth = fontBold.widthOfTextAtSize(tituloText, tituloFontSize)
    page.drawText(tituloText, {
      x: (width - tituloWidth) / 2,
      y: height - 120,
      size: tituloFontSize,
      font: fontBold,
      color: rgb(0, 0, 0),
    })

    // --- SUBTÍTULO: "PROYECTO MARIO" ---
    const subtituloText = "PROYECTO MARIO"
    const subtituloFontSize = 18
    const subtituloWidth = fontBold.widthOfTextAtSize(subtituloText, subtituloFontSize)
    page.drawText(subtituloText, {
      x: (width - subtituloWidth) / 2,
      y: height - 155,
      size: subtituloFontSize,
      font: fontBold,
      color: rgb(0, 0, 0),
    })

    // --- TEXTO: "Se certifica que:" ---
    const certText = "Se certifica que:"
    const certFontSize = 14
    const certWidth = fontItalic.widthOfTextAtSize(certText, certFontSize)
    page.drawText(certText, {
      x: (width - certWidth) / 2,
      y: height - 210,
      size: certFontSize,
      font: fontItalic,
      color: rgb(0, 0, 0),
    })

    // --- NOMBRE ---
    const nombreFontSize = 30
    const nombreWidth = fontBold.widthOfTextAtSize(nombre, nombreFontSize)
    page.drawText(nombre, {
      x: (width - nombreWidth) / 2,
      y: height - 265,
      size: nombreFontSize,
      font: fontBold,
      color: rgb(0, 0, 0),
    })

    // Línea bajo el nombre
    const lineY = height - 275
    const lineMargin = 150
    page.drawLine({
      start: { x: lineMargin, y: lineY },
      end: { x: width - lineMargin, y: lineY },
      thickness: 1,
      color: rgb(0, 0, 0),
    })

    // --- TEXTO DE APROBACIÓN ---
    const aprobText = `Ha aprobado satisfactoriamente el curso de:`
    const aprobFontSize = 13
    const aprobWidth = fontRegular.widthOfTextAtSize(aprobText, aprobFontSize)
    page.drawText(aprobText, {
      x: (width - aprobWidth) / 2,
      y: height - 320,
      size: aprobFontSize,
      font: fontRegular,
      color: rgb(0, 0, 0),
    })

    // --- NOMBRE DEL MÓDULO ---
    const moduloFontSize = 20
    const moduloWidth = fontBold.widthOfTextAtSize(moduloText, moduloFontSize)
    page.drawText(moduloText, {
      x: (width - moduloWidth) / 2,
      y: height - 355,
      size: moduloFontSize,
      font: fontBold,
      color: rgb(0, 0, 0),
    })

    // --- FECHA ---
    const fechaFontSize = 12
    const fechaWidth = fontRegular.widthOfTextAtSize(fechaText, fechaFontSize)
    page.drawText(fechaText, {
      x: (width - fechaWidth) / 2,
      y: height - 420,
      size: fechaFontSize,
      font: fontRegular,
      color: rgb(0, 0, 0),
    })

    // --- LÍNEAS DE FIRMA ---
    const firmaY = margin + 80
    const firmaWidth2 = 180

    // Firma izquierda
    page.drawLine({
      start: { x: width / 2 - firmaWidth2 - 40, y: firmaY },
      end: { x: width / 2 - 40, y: firmaY },
      thickness: 1,
      color: rgb(0, 0, 0),
    })
    const firma1Text = "Coordinador(a)"
    const firma1Width = fontRegular.widthOfTextAtSize(firma1Text, 10)
    page.drawText(firma1Text, {
      x: width / 2 - firmaWidth2 - 40 + (firmaWidth2 - firma1Width) / 2,
      y: firmaY - 15,
      size: 10,
      font: fontRegular,
      color: rgb(0, 0, 0),
    })

    // Firma derecha
    page.drawLine({
      start: { x: width / 2 + 40, y: firmaY },
      end: { x: width / 2 + 40 + firmaWidth2, y: firmaY },
      thickness: 1,
      color: rgb(0, 0, 0),
    })
    const firma2Text = "Director(a)"
    const firma2Width = fontRegular.widthOfTextAtSize(firma2Text, 10)
    page.drawText(firma2Text, {
      x: width / 2 + 40 + (firmaWidth2 - firma2Width) / 2,
      y: firmaY - 15,
      size: 10,
      font: fontRegular,
      color: rgb(0, 0, 0),
    })
  }

  return await doc.save()
}

/**
 * Genera y descarga el PDF de certificados de Proyecto Mario.
 */
export async function downloadCertificadosProyectoMario(aprobados: string[], tipo: ProyectoMarioCicloTipo) {
  const pdfBytes = await generateCertificadosProyectoMarioPDF(aprobados, tipo)

  const blob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: "application/pdf" })
  const url = URL.createObjectURL(blob)

  const link = document.createElement("a")
  link.href = url
  link.download = `Certificados_ProyectoMario_${tipo}_${new Date().toISOString().split("T")[0]}.pdf`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)

  URL.revokeObjectURL(url)
}
