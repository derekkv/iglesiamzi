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
      console.error("[getBirthdayImage] PDF de cumpleaños no encontrado:", BIRTHDAY_PDF_PATH)
      return null
    }

    const templateBytes = fs.readFileSync(BIRTHDAY_PDF_PATH)
    const templateDoc = await PDFDocument.load(templateBytes)
    const fontCursiva = await templateDoc.embedFont(StandardFonts.TimesRomanBoldItalic)

    const pages = templateDoc.getPages()
    const page = pages[0]
    const { width, height } = page.getSize()

    // Sanitizar nombre: eliminar caracteres de control que pdf-lib no soporta
    const nombreLimpio = nombre.replace(/[\x00-\x1F\x7F]/g, "").trim()
    if (!nombreLimpio) {
      console.error("[getBirthdayImage] Nombre vacío o inválido después de sanitizar:", JSON.stringify(nombre))
      return null
    }

    const nombreFontSize = 28
    const nombreUpper = nombreLimpio.toUpperCase()
    const nombreTextWidth = fontCursiva.widthOfTextAtSize(nombreUpper, nombreFontSize)
    const nombreX = (width - nombreTextWidth) / 2
    const nombreY = height / 2 + 80

    page.drawText(nombreUpper, {
      x: nombreX,
      y: nombreY,
      size: nombreFontSize,
      font: fontCursiva,
      color: rgb(0.72, 0.53, 0.04),
    })

    const pdfBytes = await templateDoc.save()

    const tmpDir = os.tmpdir()
    const ts = Date.now()
    const tmpPdf = path.join(tmpDir, `cumple-img-${ts}.pdf`)
    const tmpPng = path.join(tmpDir, `cumple-img-${ts}.png`)

    fs.writeFileSync(tmpPdf, pdfBytes)

    // Convertir PDF a PNG con ImageMagick (intenta 'convert' primero, luego 'magick')
    try {
      execSync(`convert -density 150 "${tmpPdf}[0]" -colorspace sRGB -flatten -depth 8 -quality 85 -resize 1280x "${tmpPng}"`, {
        timeout: 15000,
        stdio: "pipe",
      })
    } catch {
      try {
        execSync(`magick -density 150 "${tmpPdf}[0]" -colorspace sRGB -flatten -depth 8 -quality 85 -resize 1280x "${tmpPng}"`, {
          timeout: 15000,
          stdio: "pipe",
        })
      } catch (magickErr: any) {
        console.error("[getBirthdayImage] ImageMagick falló:", magickErr?.stderr?.toString() || magickErr)
        try { fs.unlinkSync(tmpPdf) } catch {}
        return null
      }
    }

    // Verificar que el PNG se generó correctamente
    if (!fs.existsSync(tmpPng)) {
      console.error("[getBirthdayImage] PNG no fue generado por ImageMagick")
      try { fs.unlinkSync(tmpPdf) } catch {}
      return null
    }

    const pngStats = fs.statSync(tmpPng)
    if (pngStats.size < 500) {
      console.error(`[getBirthdayImage] PNG demasiado pequeño (${pngStats.size} bytes), posiblemente corrupto`)
      try { fs.unlinkSync(tmpPdf) } catch {}
      try { fs.unlinkSync(tmpPng) } catch {}
      return null
    }

    const pngBuffer = fs.readFileSync(tmpPng)

    try { fs.unlinkSync(tmpPdf) } catch {}
    try { fs.unlinkSync(tmpPng) } catch {}

    return {
      buffer: pngBuffer,
      type: "image/png",
      filename: `cumpleanos-${nombreLimpio.replace(/\s+/g, "-").replace(/[^a-zA-Z0-9-]/g, "")}.png`,
    }
  } catch (err) {
    console.error("[getBirthdayImage] Error generando imagen de cumpleaños:", err)
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
 *
 * Incluye lógica de reintento (hasta 3 intentos) para manejar fallos
 * transitorios de FFmpeg o del sistema de archivos.
 */
export async function getBirthdayVideo(nombre: string, options?: { maxRetries?: number }): Promise<{
  buffer: Buffer
  type: "video/mp4"
  filename: string
} | null> {
  const maxRetries = options?.maxRetries ?? 3
  let lastError: any = null

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // 1. Generar la imagen personalizada con el nombre
      const img = await getBirthdayImage(nombre)
      if (!img) {
        console.error(`[getBirthdayVideo] Intento ${attempt}/${maxRetries}: No se pudo generar la imagen para "${nombre}"`)
        if (attempt < maxRetries) {
          await sleep(1000 * attempt) // backoff progresivo
          continue
        }
        return null
      }

      // 2. Verificar que el audio exista
      if (!fs.existsSync(BIRTHDAY_OGG_PATH)) {
        // Este error no es transitorio — no reintentar
        console.error("[getBirthdayVideo] Audio de cumpleaños no encontrado:", BIRTHDAY_OGG_PATH)
        return null
      }

      const tmpDir = os.tmpdir()
      const ts = Date.now()
      const tmpPng = path.join(tmpDir, `cumple-vid-${ts}-${attempt}.png`)
      const tmpMp4 = path.join(tmpDir, `cumple-vid-${ts}-${attempt}.mp4`)

      // 3. Escribir la imagen al disco temporalmente
      fs.writeFileSync(tmpPng, img.buffer)

      // 4. Construir el vídeo con FFmpeg
      //    -loop 1             → convierte la imagen estática en un stream de vídeo infinito
      //    -i <ogg>            → audio de cumpleaños
      //    -t 60               → duración máxima de seguridad (60s)
      //    -shortest           → truncar al stream más corto (el audio)
      //    -vf scale=720:-2    → 720px de ancho, alto calculado y par (requerido para yuv420p)
      //    -preset ultrafast   → encode mínimo, mucho más rápido en VPS de pocos cores
      //    -crf 28             → calidad razonable sin inflar el archivo
      //    -c:v libx264        → H.264, compatible con WhatsApp
      //    -profile:v baseline -level 3.0 → máxima compatibilidad en móviles
      //    -pix_fmt yuv420p    → requerido por la Cloud API para vídeos de plantilla
      //    -c:a aac -b:a 96k  → audio AAC ligero
      //    -movflags +faststart → mueve el moov atom al inicio (streaming-friendly)
      //    -loglevel error     → solo errores en stderr (reduce ruido)
      const ffmpegCmd =
        `ffmpeg -y -loop 1 -i "${tmpPng}" -i "${BIRTHDAY_OGG_PATH}" ` +
        `-t 60 -shortest -vf "scale=720:-2" ` +
        `-c:v libx264 -preset ultrafast -crf 28 -profile:v baseline -level 3.0 -pix_fmt yuv420p ` +
        `-c:a aac -b:a 96k -movflags +faststart -loglevel error "${tmpMp4}"`

      try {
        execSync(ffmpegCmd, { timeout: 120_000, stdio: "pipe" })
      } catch (ffmpegErr: any) {
        lastError = ffmpegErr
        const stderr = ffmpegErr?.stderr?.toString() || String(ffmpegErr)
        console.error(`[getBirthdayVideo] Intento ${attempt}/${maxRetries} FFmpeg falló para "${nombre}":`, stderr)
        // Limpiar temporales del intento fallido
        try { fs.unlinkSync(tmpPng) } catch {}
        try { fs.unlinkSync(tmpMp4) } catch {}
        if (attempt < maxRetries) {
          await sleep(2000 * attempt)
          continue
        }
        return null
      }

      // Verificar que el archivo se generó y tiene contenido
      if (!fs.existsSync(tmpMp4)) {
        console.error(`[getBirthdayVideo] Intento ${attempt}/${maxRetries}: MP4 no se creó`)
        try { fs.unlinkSync(tmpPng) } catch {}
        if (attempt < maxRetries) {
          await sleep(1000 * attempt)
          continue
        }
        return null
      }

      const stats = fs.statSync(tmpMp4)
      if (stats.size < 1000) {
        // Archivo demasiado pequeño, probablemente corrupto
        console.error(`[getBirthdayVideo] Intento ${attempt}/${maxRetries}: MP4 demasiado pequeño (${stats.size} bytes)`)
        try { fs.unlinkSync(tmpPng) } catch {}
        try { fs.unlinkSync(tmpMp4) } catch {}
        if (attempt < maxRetries) {
          await sleep(1000 * attempt)
          continue
        }
        return null
      }

      const mp4Buffer = fs.readFileSync(tmpMp4)

      // 5. Limpiar temporales
      try { fs.unlinkSync(tmpPng) } catch {}
      try { fs.unlinkSync(tmpMp4) } catch {}

      const safeName = nombre.replace(/\s+/g, "-").replace(/[^a-zA-Z0-9-]/g, "")

      if (attempt > 1) {
        console.info(`[getBirthdayVideo] Éxito en intento ${attempt}/${maxRetries} para "${nombre}"`)
      }

      return {
        buffer: mp4Buffer,
        type: "video/mp4",
        filename: `cumpleanos-${safeName}.mp4`,
      }
    } catch (err) {
      lastError = err
      console.error(`[getBirthdayVideo] Intento ${attempt}/${maxRetries} error inesperado:`, err)
      if (attempt < maxRetries) {
        await sleep(2000 * attempt)
        continue
      }
    }
  }

  console.error(`[getBirthdayVideo] Falló definitivamente después de ${maxRetries} intentos para "${nombre}":`, lastError)
  return null
}

/** Helper para esperar con backoff entre reintentos */
function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}
