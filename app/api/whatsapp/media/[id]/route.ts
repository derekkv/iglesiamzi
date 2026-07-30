import { NextRequest, NextResponse } from "next/server"
import { verifyApiAuth } from "@/lib/api-auth"
import { getMediaInfo, downloadMedia } from "@/lib/mod/wa-cloud-service"

/**
 * Descarga de multimedia entrante.
 *
 * El CDN de Meta exige el header Authorization con el access_token, así que la
 * URL no se puede poner directamente en un <img>. Esta ruta actúa de proxy
 * autenticado: el navegador pide /api/whatsapp/media/<media_id> con su JWT y
 * aquí se resuelve contra Meta.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await verifyApiAuth(request)
    if (!auth.authenticated) {
      return NextResponse.json({ success: false, error: auth.error || "No autorizado" }, { status: 401 })
    }

    const { id } = await context.params
    if (!id) {
      return NextResponse.json({ success: false, error: "Falta el id del archivo" }, { status: 400 })
    }

    const info = await getMediaInfo(id)
    if (!info.success || !info.url) {
      return NextResponse.json({ success: false, error: info.error || "Archivo no encontrado" }, { status: 404 })
    }

    const file = await downloadMedia(info.url)
    if (!file.success || !file.buffer) {
      return NextResponse.json({ success: false, error: file.error || "No se pudo descargar" }, { status: 502 })
    }

    const mime = info.mimeType || file.mimeType || "application/octet-stream"

    return new NextResponse(new Uint8Array(file.buffer), {
      status: 200,
      headers: {
        "Content-Type": mime,
        "Content-Length": String(file.buffer.length),
        // Los media_id de Meta son inmutables mientras existan (30 días)
        "Cache-Control": "private, max-age=86400",
      },
    })
  } catch (error: any) {
    console.error("[/api/whatsapp/media] Error:", error?.message)
    return NextResponse.json(
      { success: false, error: error?.message || "Error obteniendo el archivo" },
      { status: 500 }
    )
  }
}
