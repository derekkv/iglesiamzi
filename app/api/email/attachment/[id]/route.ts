import { NextRequest, NextResponse } from "next/server"
import { verifyApiAuth } from "@/lib/api-auth"
import { supabaseServer } from "@/lib/supabase-server"

const STORAGE_BUCKET = "redil-archivos"

/**
 * Descarga autenticada de un adjunto de correo.
 *
 * Los adjuntos viven en Supabase Storage. Se sirven por esta ruta en lugar de
 * exponer la URL pública para que solo los usuarios autenticados del panel
 * puedan abrirlos.
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

    const { data: att, error } = await supabaseServer
      .from("email_attachments")
      .select("filename, mime_type, storage_path, size_bytes")
      .eq("id", id)
      .maybeSingle()

    if (error || !att) {
      return NextResponse.json({ success: false, error: "Adjunto no encontrado" }, { status: 404 })
    }

    if (!att.storage_path) {
      return NextResponse.json(
        { success: false, error: "El adjunto no se almacenó (excedía el tamaño máximo)" },
        { status: 410 }
      )
    }

    const { data: file, error: dlError } = await supabaseServer.storage
      .from(STORAGE_BUCKET)
      .download(att.storage_path)

    if (dlError || !file) {
      return NextResponse.json(
        { success: false, error: dlError?.message || "No se pudo descargar el adjunto" },
        { status: 502 }
      )
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const filename = (att.filename || "adjunto").replace(/["\\]/g, "")

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": att.mime_type || "application/octet-stream",
        "Content-Length": String(buffer.length),
        "Content-Disposition": `inline; filename="${filename}"`,
        "Cache-Control": "private, max-age=3600",
      },
    })
  } catch (error: any) {
    console.error("[/api/email/attachment] Error:", error?.message)
    return NextResponse.json(
      { success: false, error: error?.message || "Error obteniendo el adjunto" },
      { status: 500 }
    )
  }
}
