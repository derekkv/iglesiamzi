import * as fs from "fs"
import * as path from "path"

/**
 * Obtiene la imagen de cumpleaños como Buffer.
 * Busca primero un PNG pre-convertido. Si no existe, usa el PDF directamente.
 * 
 * IMPORTANTE: Para que funcione como imagen en WhatsApp, debes tener
 * el archivo "plantilla-cumpleanos.png" en public/.
 * Si solo tienes el PDF, se enviará como documento.
 */

const BIRTHDAY_PNG_PATH = path.join(process.cwd(), "public", "plantilla-cumpleanos.png")
const BIRTHDAY_PDF_PATH = path.join(process.cwd(), "public", "plantilla de cumpleaños (1).pdf")

let cachedImage: { buffer: Buffer; type: "image/png" | "application/pdf"; filename: string } | null = null

export async function getBirthdayImage(): Promise<{ buffer: Buffer; type: "image/png" | "application/pdf"; filename: string } | null> {
  if (cachedImage) return cachedImage

  // Preferir PNG si existe
  if (fs.existsSync(BIRTHDAY_PNG_PATH)) {
    const buffer = fs.readFileSync(BIRTHDAY_PNG_PATH)
    cachedImage = { buffer, type: "image/png", filename: "Feliz Cumpleaños.png" }
    return cachedImage
  }

  // Fallback al PDF
  if (fs.existsSync(BIRTHDAY_PDF_PATH)) {
    const buffer = fs.readFileSync(BIRTHDAY_PDF_PATH)
    cachedImage = { buffer, type: "application/pdf", filename: "Feliz Cumpleaños.pdf" }
    return cachedImage
  }

  console.warn("No se encontró archivo de imagen de cumpleaños en public/")
  return null
}
