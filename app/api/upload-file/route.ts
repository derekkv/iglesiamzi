import { NextRequest, NextResponse } from "next/server"
import { supabaseServer } from "@/lib/supabase-server"
import { verifyApiAuth } from "@/lib/api-auth"

const BUCKET_NAME = "redil-archivos"
const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB

// Extensiones permitidas
const ALLOWED_EXTENSIONS = [
  // Imágenes
  ".jpg", ".jpeg", ".png", ".gif", ".webp", ".heic",
  // Videos
  ".mp4", ".mov", ".avi", ".webm", ".mkv",
  // Documentos
  ".pdf", ".doc", ".docx", ".xls", ".xlsx",
]

export async function POST(request: NextRequest) {
  try {
    // Verificar autenticación
    const auth = await verifyApiAuth(request)
    if (!auth.authenticated) {
      return NextResponse.json({ success: false, error: auth.error || "No autorizado" }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get("file") as File | null
    const folder = formData.get("folder") as string || "general"

    if (!file) {
      return NextResponse.json({ success: false, error: "No se envió archivo" }, { status: 400 })
    }

    // Validar tamaño
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ success: false, error: "El archivo excede 50MB" }, { status: 400 })
    }

    // Validar extensión
    const ext = "." + file.name.split(".").pop()?.toLowerCase()
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return NextResponse.json(
        { success: false, error: `Tipo de archivo no permitido. Permitidos: ${ALLOWED_EXTENSIONS.join(", ")}` },
        { status: 400 }
      )
    }

    // Generar nombre único
    const timestamp = Date.now()
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_")
    const filePath = `${folder}/${timestamp}_${safeName}`

    // Convertir a buffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Subir a Supabase Storage
    const { data, error } = await supabaseServer.storage
      .from(BUCKET_NAME)
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: false,
      })

    if (error) {
      console.error("[upload-file] Storage error:", error.message)
      return NextResponse.json({ success: false, error: "Error subiendo archivo: " + error.message }, { status: 500 })
    }

    // Obtener URL pública
    const { data: urlData } = supabaseServer.storage
      .from(BUCKET_NAME)
      .getPublicUrl(data.path)

    return NextResponse.json({
      success: true,
      url: urlData.publicUrl,
      path: data.path,
      name: file.name,
      size: file.size,
      type: file.type,
    })
  } catch (error: any) {
    console.error("[upload-file] Error:", error.message)
    return NextResponse.json({ success: false, error: "Error interno" }, { status: 500 })
  }
}
