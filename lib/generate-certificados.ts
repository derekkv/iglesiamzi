import { PDFDocument, rgb, StandardFonts } from "pdf-lib"
import type { CicloTipo } from "./mod/discipulado-ciclos-service"

const MODULO_LABELS: Record<CicloTipo, string> = {
  primeros_pasos: "MODULO 1: PRIMEROS PASOS DE LA VIDA CRISTIANA",
  seguimos_avanzando: "MODULO 2: SEGUIMOS AVANZANDO",
  siendo_iglesia: "MODULO 3: SIENDO IGLESIA, VIVIENDO JUNTOS LOS UNOS CON LOS OTROS",
}

/**
 * Genera un PDF con una página de certificado por cada nombre aprobado.
 * Usa el modelo certificado de /public como plantilla base.
 */
export async function generateCertificadosPDF(
  aprobados: string[],
  tipo: CicloTipo
): Promise<Uint8Array> {
  // Cargar el modelo base
  const templateResponse = await fetch("/MODELO CERTIFICADO.pdf")
  const templateBytes = await templateResponse.arrayBuffer()

  // Crear documento final
  const finalDoc = await PDFDocument.create()

  const fontBold = await finalDoc.embedFont(StandardFonts.HelveticaBold)
  const fontRegular = await finalDoc.embedFont(StandardFonts.Helvetica)

  // Fecha actual formateada
  const hoy = new Date()
  const meses = [
    "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
  ]
  const fechaText = `Manta, ${hoy.getDate()} de ${meses[hoy.getMonth()]} de ${hoy.getFullYear()}`

  const moduloText = MODULO_LABELS[tipo]

  for (const nombre of aprobados) {
    // Cargar el template como documento independiente para cada página
    const templateDoc = await PDFDocument.load(templateBytes)
    const [templatePage] = await finalDoc.copyPages(templateDoc, [0])

    const { width, height } = templatePage.getSize()

    // --- MÓDULO: centrado ---
    const moduloFontSize = 12
    const moduloTextWidth = fontBold.widthOfTextAtSize(moduloText, moduloFontSize)
    const moduloX = (width - moduloTextWidth) / 2
    const moduloY = height - 350

    templatePage.drawText(moduloText, {
      x: moduloX,
      y: moduloY,
      size: moduloFontSize,
      font: fontBold,
      color: rgb(0, 0, 0),
    })

    // --- NOMBRE: grande, centrado ---
    const nombreFontSize = 30
    const nombreTextWidth = fontBold.widthOfTextAtSize(nombre, nombreFontSize)
    const nombreX = (width - nombreTextWidth) / 2
    const nombreY = height - 180

    templatePage.drawText(nombre, {
      x: nombreX,
      y: nombreY,
      size: nombreFontSize,
      font: fontBold,
      color: rgb(0, 0, 0),
    })

    // --- FECHA: centrada con offset ---
    const fechaFontSize = 12
    const fechaTextWidth = fontRegular.widthOfTextAtSize(fechaText, fechaFontSize)
    const fechaX = (width - fechaTextWidth - 50) / 2
    const fechaY = height - 495.29 + 70

    templatePage.drawText(fechaText, {
      x: fechaX,
      y: fechaY,
      size: fechaFontSize,
      font: fontRegular,
      color: rgb(0, 0, 0),
    })

    finalDoc.addPage(templatePage)
  }

  return await finalDoc.save()
}

/**
 * Genera y descarga el PDF de certificados.
 */
export async function downloadCertificados(aprobados: string[], tipo: CicloTipo) {
  const pdfBytes = await generateCertificadosPDF(aprobados, tipo)

  const blob = new Blob([pdfBytes], { type: "application/pdf" })
  const url = URL.createObjectURL(blob)

  const link = document.createElement("a")
  link.href = url
  link.download = `Certificados_${tipo}_${new Date().toISOString().split("T")[0]}.pdf`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)

  URL.revokeObjectURL(url)
}
