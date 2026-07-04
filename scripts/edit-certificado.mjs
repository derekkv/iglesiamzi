import { PDFDocument, rgb, StandardFonts } from "pdf-lib"
import fs from "fs"
import path from "path"

const pdfPath = path.resolve("public/MODELO CERTIFICADO.pdf")
const outputPath = path.resolve("public/CERTIFICADO_Derek_Palacios.pdf")

async function main() {
  const pdfBytes = fs.readFileSync(pdfPath)
  const pdfDoc = await PDFDocument.load(pdfBytes)

  const pages = pdfDoc.getPages()
  const firstPage = pages[0]
  const { width, height } = firstPage.getSize()
  console.log(`Dimensiones: ${width} x ${height}`)
  // Landscape A4: 841.92 x 595.5

  // ========================================
  // PASO 1: Cubrir las líneas de los módulos con rectángulos blancos
  // Las líneas de módulos suelen estar en la zona inferior-central del certificado
  // Vamos a cubrir un rango amplio donde típicamente están esas 3 líneas
  // Ajustar estas coordenadas si no cubren exactamente el texto
  // ========================================

  // Cubrir zona de las 3 líneas de módulos
  // En PDF, Y=0 es abajo, Y=height es arriba
  // Las líneas de texto de módulos probablemente están entre Y=150 y Y=250 (zona inferior-media)
  // Cubrimos toda la anchura central donde podría estar el texto
  const coverX = 100       // margen izquierdo
  const coverWidth = 640   // ancho del rectángulo (centrado)
  
  // Línea 1: "MODULO 1: PRIMEROS PASOS DE LA VIDA CRISTIANA"
  firstPage.drawRectangle({
    x: coverX,
    y: 195,
    width: coverWidth,
    height: 22,
    color: rgb(1, 1, 1), // blanco
  })

  // Línea 2: "MODULO 2: MAS PASOS BASICOS DE LA VIDA CRISTIANA"
  firstPage.drawRectangle({
    x: coverX,
    y: 170,
    width: coverWidth,
    height: 22,
    color: rgb(1, 1, 1),
  })

  // Línea 3: "SIENDO IGLESIA, VIVIENDO JUNTOS LOS UNOS CON LOS OTROS"
  firstPage.drawRectangle({
    x: coverX,
    y: 145,
    width: coverWidth,
    height: 22,
    color: rgb(1, 1, 1),
  })

  // ========================================
  // PASO 2: Escribir el nombre más arriba
  // ========================================
  const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const nombre = "Derek Palacios"
  const fontSize = 28
  const textWidth = font.widthOfTextAtSize(nombre, fontSize)
  const x = (width - textWidth) / 2
  // Subir el nombre: más arriba que height/2, por ejemplo 2/3 de la altura
  const y = height * 0.6

  firstPage.drawText(nombre, {
    x,
    y,
    size: fontSize,
    font,
    color: rgb(0, 0, 0),
  })

  const modifiedPdf = await pdfDoc.save()
  fs.writeFileSync(outputPath, modifiedPdf)
  console.log(`Certificado guardado en: ${outputPath}`)
  console.log(`Nombre posicionado en Y=${y} (de ${height} total)`)
  console.log(`Rectángulos blancos en Y=145-217 cubriendo módulos`)
}

main().catch(console.error)
