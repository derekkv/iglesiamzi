import { PDFDocument, rgb, StandardFonts } from "pdf-lib"

/**
 * Genera un PDF de cumpleaños con el nombre del cumpleañero
 * usando la plantilla de /public/plantilla de cumpleaños (1).pdf
 */
export async function generateCumpleanosPDF(nombre: string): Promise<Uint8Array> {
  // Cargar la plantilla
  const templateResponse = await fetch("/plantilla de cumpleaños (1).pdf")
  const templateBytes = await templateResponse.arrayBuffer()

  // Cargar el documento template
  const templateDoc = await PDFDocument.load(templateBytes)

  // Embed fonts
  const fontCursiva = await templateDoc.embedFont(StandardFonts.TimesRomanBoldItalic)

  // Obtener la primera página
  const pages = templateDoc.getPages()
  const page = pages[0]
  const { width, height } = page.getSize()

  // Escribir el nombre centrado en la plantilla
  const nombreFontSize = 28
  const nombreTextWidth = fontCursiva.widthOfTextAtSize(nombre.toUpperCase(), nombreFontSize)
  const nombreX = (width - nombreTextWidth) / 2
  // Posición vertical — ajustar según dónde va el nombre en la plantilla
  const nombreY = height / 2 + 80

  page.drawText(nombre.toUpperCase(), {
    x: nombreX,
    y: nombreY,
    size: nombreFontSize,
    font: fontCursiva,
    color: rgb(0.72, 0.53, 0.04),
  })

  return await templateDoc.save()
}
