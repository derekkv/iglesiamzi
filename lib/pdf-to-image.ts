import * as fs from "fs"
import * as path from "path"
import * as os from "os"
import { execSync } from "child_process"
import { PDFDocument, rgb, StandardFonts } from "pdf-lib"

const BIRTHDAY_PDF_PATH = path.join(process.cwd(), "public", "plantilla de cumpleaños (1).pdf")

/**
 * Genera un PDF personalizado con el nombre y lo convierte a imagen PNG
 * usando ImageMagick (convert) instalado en el servidor.
 * Retorna el Buffer de la imagen PNG.
 */
export async function getBirthdayImage(nombre: string): Promise<{ buffer: Buffer; type: "image/png"; filename: string } | null> {
  try {
    if (!fs.existsSync(BIRTHDAY_PDF_PATH)) {
      console.warn("PDF de cumpleaños no encontrado:", BIRTHDAY_PDF_PATH)
      return null
    }

    const templateBytes = fs.readFileSync(BIRTHDAY_PDF_PATH)
    const templateDoc = await PDFDocument.load(templateBytes)
    const fontCursiva = await templateDoc.embedFont(StandardFonts.TimesRomanBoldItalic)

    const pages = templateDoc.getPages()
    const page = pages[0]
    const { width, height } = page.getSize()

    const nombreFontSize = 28
    const nombreTextWidth = fontCursiva.widthOfTextAtSize(nombre.toUpperCase(), nombreFontSize)
    const nombreX = (width - nombreTextWidth) / 2
    const nombreY = height / 2 + 80

    page.drawText(nombre.toUpperCase(), {
      x: nombreX,
      y: nombreY,
      size: nombreFontSize,
      font: fontCursiva,
      color: rgb(0.72, 0.53, 0.04),
    })

    const pdfBytes = await templateDoc.save()

    const tmpDir = os.tmpdir()
    const tmpPdf = path.join(tmpDir, `cumple-${Date.now()}.pdf`)
    const tmpPng = path.join(tmpDir, `cumple-${Date.now()}.png`)

    fs.writeFileSync(tmpPdf, pdfBytes)

    try {
      execSync(`convert -density 150 "${tmpPdf}[0]" -colorspace sRGB -flatten -depth 8 -quality 85 -resize 1280x "${tmpPng}"`, {
        timeout: 15000,
      })
    } catch {
      execSync(`magick -density 150 "${tmpPdf}[0]" -colorspace sRGB -flatten -depth 8 -quality 85 -resize 1280x "${tmpPng}"`, {
        timeout: 15000,
      })
    }

    const pngBuffer = fs.readFileSync(tmpPng)

    try { fs.unlinkSync(tmpPdf) } catch {}
    try { fs.unlinkSync(tmpPng) } catch {}

    return {
      buffer: pngBuffer,
      type: "image/png",
      filename: `cumpleanos-${nombre.replace(/\s+/g, "-").replace(/[^a-zA-Z0-9-]/g, "")}.png`,
    }
  } catch (err) {
    console.error("Error generando imagen de cumpleaños:", err)
    return null
  }
}
