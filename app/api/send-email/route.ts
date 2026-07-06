import { NextRequest, NextResponse } from "next/server"
import { emailService, type EmailServiceParams } from "@/lib/mod/email-service"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Modo genérico: enviar con subject + html directamente
    if (body.to && body.subject && body.html) {
      const result = await emailService.sendRawEmail({ to: body.to, subject: body.subject, html: body.html })
      if (result.success) {
        return NextResponse.json({ success: true })
      } else {
        return NextResponse.json({ success: false, error: result.error }, { status: 500 })
      }
    }

    // Modo plantilla: to + type + data
    const params = body as EmailServiceParams
    if (!params.to || !params.type || !params.data) {
      return NextResponse.json(
        { success: false, error: "Faltan campos requeridos: to, type, data (o to, subject, html)" },
        { status: 400 }
      )
    }

    const result = await emailService.sendServiceEmail(params)

    if (result.success) {
      return NextResponse.json({ success: true })
    } else {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      )
    }
  } catch (error: any) {
    console.error("Error en /api/send-email:", error)
    return NextResponse.json(
      { success: false, error: error.message || "Error interno" },
      { status: 500 }
    )
  }
}
