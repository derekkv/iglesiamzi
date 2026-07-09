import * as fs from "fs"
import * as path from "path"
import { createCanvas } from "@napi-rs/canvas"

/**
 * Convierte la primera página de un PDF a imagen PNG usando pdfjs-dist + @napi-rs/canvas.
 * Retorna un Buffer con el PNG.
 */
export async function pdfToImage(pdfPath: string, scale: number = 2.0): Promise<Buffer> {
  // Importar pdfjs-dist dinámicamente (es ESM-only en v4)
  const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs")

  const pdfData = fs.readFileSync(pdfPath)
  const uint8Array = new Uint8Array(pdfData)

  const loadingTask = pdfjsLib.getDocument({ data: uint8Array })
  const pdfDoc = await loadingTask.promise

  const page = await pdfDoc.getPage(1)
  const viewport = page.getViewport({ scale })

  const width = Math.floor(viewport.width)
  const height = Math.floor(viewport.height)

  const canvas = createCanvas(width, height)
  const ctx = canvas.getContext("2d")

  // Fondo blanco
  ctx.fillStyle = "white"
  ctx.fillRect(0, 0, width, height)

  // Renderizar la página del PDF en el canvas
  const renderContext = {
    canvasContext: ctx as any,
    viewport,
  }

  await page.render(renderContext).promise

  // Convertir a PNG buffer
  const pngBuffer = canvas.toBuffer("image/png")
  return Buffer.from(pngBuffer)
}

/**
 * Convierte el PDF de cumpleaños a imagen PNG.
 * Cachea el resultado para no reconvertir cada vez.
 */
let cachedBirthdayImage: Buffer | null = null

export async function getBirthdayImage(): Promise<Buffer | null> {
  if (cachedBirthdayImage) return cachedBirthdayImage

  const pdfPath = path.join(process.cwd(), "public", "plantilla de cumpleaños (1).pdf")
  if (!fs.existsSync(pdfPath)) {
    console.warn("PDF de cumpleaños no encontrado:", pdfPath)
    return null
  }

  try {
    cachedBirthdayImage = await pdfToImage(pdfPath, 2.5)
    return cachedBirthdayImage
  } catch (err) {
    console.error("Error convirtiendo PDF a imagen:", err)
    return null
  }
}
