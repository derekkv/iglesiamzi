import { PDFDocument, StandardFonts } from "pdf-lib"
import { dibujarNombreCumpleanos } from "./cumpleanos-nombre"

/**
 * Genera un PDF de cumpleaños con el nombre del cumpleañero
 * usando la plantilla de /public/plantilla de cumpleaños (1).pdf
 */
export async function generateCumpleanosPDF(nombre: string): Promise<Uint8Array> {
  const templateResponse = await fetch("/plantilla de cumpleaños (1).pdf")
  const templateBytes = await templateResponse.arrayBuffer()

  const templateDoc = await PDFDocument.load(templateBytes)

  const fontCursiva = await templateDoc.embedFont(StandardFonts.TimesRomanBoldItalic)

  const page = templateDoc.getPages()[0]

  // El nombre se ajusta al ancho disponible (entre los globos); si es muy largo, va en dos líneas.
  dibujarNombreCumpleanos(page, fontCursiva, nombre)

  return await templateDoc.save()
}
