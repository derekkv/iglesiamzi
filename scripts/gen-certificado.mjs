import { PDFDocument, rgb, StandardFonts } from "pdf-lib"
import fs from "fs"
import path from "path"

const pdfPath = path.resolve("public/MODELO CERTIFICADO.pdf")
const outputPath = path.resolve("public/CERTIFICADO_GENERADO.pdf")

async function main() {
  const pdfBytes = fs.readFileSync(pdfPath)
  const pdfDoc = await PDFDocument.load(pdfBytes)

  const pages = pdfDoc.getPages()
  const firstPage = pages[0]
  const { width, height } = firstPage.getSize()
  console.log(`Dimensiones PDF: ${width} x ${height}`)

  // Las coordenadas del usuario vienen de un visor donde Y crece hacia abajo
  // En pdf-lib, Y=0 es abajo, Y=height es arriba
  // Conversión: pdfY = height - viewerY
  // "Varios centímetros arriba" en visor = Y más bajo en visor = Y más alto en pdf-lib
  // 1 cm ≈ 28.35 puntos PDF, "varios cm" ≈ 60-80 puntos

  // Posiciones base del visor (Y hacia abajo):
  // Módulo referencia:  x=264.04, y=275.27 → varios cm arriba de ahí
  // Nombre referencia:  x=361.85, y=180.44 → varios cm arriba de ahí  
  // Fecha referencia:   x=163.60, y=495.29 → varios cm arriba de ahí

  // Convertir a coordenadas pdf-lib con offset hacia arriba (+70pt ≈ 2.5cm arriba):
  const moduloY = height - 350
  const nombreY = height - 180
  const fechaY = height - 495.29 + 70

  console.log(`Módulo Y (pdf-lib): ${moduloY}`)
  console.log(`Fecha Y (pdf-lib): ${fechaY}`)
  console.log(`Nombre Y (pdf-lib): ${nombreY}`)

  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica)

  // ========================================
  // 1. MÓDULO - centrado, varios cm arriba de y=275
  // ========================================
  const moduloText = "MODULO 1: PRIMEROS PASOS DE LA VIDA CRISTIANA"
  const moduloFontSize = 12
  const moduloTextWidth = fontBold.widthOfTextAtSize(moduloText, moduloFontSize)
  const moduloX = (width - moduloTextWidth) / 2

  firstPage.drawText(moduloText, {
    x: moduloX,
    y: moduloY,
    size: moduloFontSize,
    font: fontBold,
    color: rgb(0, 0, 0),
  })

  // ========================================
  // 2. CIUDAD Y FECHA - en la posición indicada
  // ========================================
  const hoy = new Date()
  const meses = ["enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"]
  const fechaText = `Manta, ${hoy.getDate()} de ${meses[hoy.getMonth()]} de ${hoy.getFullYear()}`
  const fechaFontSize = 12
  const fechaTextWidth = fontRegular.widthOfTextAtSize(fechaText, fechaFontSize)
  const fechaX = (width - fechaTextWidth - 50) / 2 // centrado

  firstPage.drawText(fechaText, {
    x: fechaX,
    y: fechaY,
    size: fechaFontSize,
    font: fontRegular,
    color: rgb(0, 0, 0),
  })

  // ========================================
  // 3. NOMBRE - en grande, centrado en la posición indicada
  // ========================================
  const nombreText = "Derek Ismael Palacios Tandazo"
  const nombreFontSize = 30
  const nombreTextWidth = fontBold.widthOfTextAtSize(nombreText, nombreFontSize)
  const nombreX = (width - nombreTextWidth) / 2

  firstPage.drawText(nombreText, {
    x: nombreX,
    y: nombreY,
    size: nombreFontSize,
    font: fontBold,
    color: rgb(0, 0, 0),
  })

  // Guardar
  const modifiedPdf = await pdfDoc.save()
  fs.writeFileSync(outputPath, modifiedPdf)
  console.log(`\nCertificado generado en: ${outputPath}`)
}

main().catch(console.error)
