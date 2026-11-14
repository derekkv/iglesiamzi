/**
 * Utilidades de PDF para los reportes que además emiten certificados.
 *
 * Los generadores de certificados (`lib/generate-*.ts`) producen un documento
 * por persona; aquí se unen en un solo archivo descargable.
 */

import { PDFDocument } from "pdf-lib"

/** Une varios PDF en uno, conservando todas las páginas de cada documento. */
export async function unirPdfs(documentos: Uint8Array[]): Promise<Uint8Array> {
  if (documentos.length === 1) return documentos[0]

  const destino = await PDFDocument.create()
  for (const bytes of documentos) {
    const origen = await PDFDocument.load(bytes)
    const paginas = await destino.copyPages(origen, origen.getPageIndices())
    for (const pagina of paginas) destino.addPage(pagina)
  }
  return destino.save()
}
