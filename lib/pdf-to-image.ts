import * as fs from "fs"
import * as path from "path"
import * as os from "os"
import { execSync } from "child_process"
import { PDFDocument, rgb, StandardFonts } from "pdf-lib"

const BIRTHDAY_PDF_PATH = path.join(process.cwd(), "public", "plantilla de cumpleaños (1).pdf")
const BIRTHDAY_OGG_PATH = path.join(process.cwd(), "public", "cumpleanos-feliz.ogg")

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


/**
 * Genera un vídeo MP4 personalizado para el cumpleaños:
 *   - Imagen PNG generada a partir de la plantilla PDF con el nombre de la persona.
 *   - Audio de "Cumpleaños Feliz" tomado de public/cumpleanos-feliz.ogg.
 *
 * El vídeo dura exactamente lo que dure el audio (FFmpeg trunca o extiende la
 * imagen estática para que coincida). Cumple con los requisitos de la
 * WhatsApp Cloud API para vídeos de plantilla:
 *   - Codec vídeo: H.264 (libx264), perfil baseline, pixel format yuv420p
 *   - Codec audio: AAC
 *   - Contenedor: MP4 (moov atom al inicio con -movflags +faststart)
 *   - Ancho múltiplo de 2 (necesario para yuv420p)
 *
 * Retorna null si la imagen o el archivo OGG no están disponibles, o si
 * FFmpeg no está instalado en el servidor.
 */
export async function getBirthdayVideo(nombre: string): Promise<{
  buffer: Buffer
  type: "video/mp4"
  filename: string
} | null> {
  try {
    // 1. Generar la imagen personalizada con el nombre
    const img = await getBirthdayImage(nombre)
    if (!img) return null

    // 2. Verificar que el audio exista
    if (!fs.existsSync(BIRTHDAY_OGG_PATH)) {
      console.warn("Audio de cumpleaños no encontrado:", BIRTHDAY_OGG_PATH)
      return null
    }

    const tmpDir = os.tmpdir()
    const ts = Date.now()
    const tmpPng = path.join(tmpDir, `cumple-vid-${ts}.png`)
    const tmpMp4 = path.join(tmpDir, `cumple-vid-${ts}.mp4`)

    // 3. Escribir la imagen al disco temporalmente
    fs.writeFileSync(tmpPng, img.buffer)

    // 4. Construir el vídeo con FFmpeg
    //    -loop 1             → convierte la imagen estática en un stream de vídeo infinito
    //    -i <ogg>            → audio de cumpleaños
    //    -shortest           → truncar al stream más corto (el audio)
    //    -vf scale=720:-2    → 720px de ancho, alto calculado y par (requerido para yuv420p)
    //    -preset ultrafast   → encode mínimo, mucho más rápido en VPS de pocos cores
    //    -crf 28             → calidad razonable sin inflar el archivo
    //    -c:v libx264        → H.264, compatible con WhatsApp
    //    -profile:v baseline -level 3.0 → máxima compatibilidad en móviles
    //    -pix_fmt yuv420p    → requerido por la Cloud API para vídeos de plantilla
    //    -c:a aac -b:a 96k  → audio AAC ligero
    //    -movflags +faststart → mueve el moov atom al inicio (streaming-friendly)
    const ffmpegCmd =
      `ffmpeg -y -loop 1 -i "${tmpPng}" -i "${BIRTHDAY_OGG_PATH}" ` +
      `-shortest -vf "scale=720:-2" ` +
      `-c:v libx264 -preset ultrafast -crf 28 -profile:v baseline -level 3.0 -pix_fmt yuv420p ` +
      `-c:a aac -b:a 96k -movflags +faststart "${tmpMp4}"`

    try {
      execSync(ffmpegCmd, { timeout: 120_000, stdio: "pipe" })
    } catch (ffmpegErr: any) {
      console.error("FFmpeg error generando vídeo de cumpleaños:", ffmpegErr?.stderr?.toString() || ffmpegErr)
      return null
    }

    const mp4Buffer = fs.readFileSync(tmpMp4)

    // 5. Limpiar temporales
    try { fs.unlinkSync(tmpPng) } catch {}
    try { fs.unlinkSync(tmpMp4) } catch {}

    const safeName = nombre.replace(/\s+/g, "-").replace(/[^a-zA-Z0-9-]/g, "")
    return {
      buffer: mp4Buffer,
      type: "video/mp4",
      filename: `cumpleanos-${safeName}.mp4`,
    }
  } catch (err) {
    console.error("Error generando vídeo de cumpleaños:", err)
    return null
  }
}
