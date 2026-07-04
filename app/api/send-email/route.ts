import { NextRequest, NextResponse } from "next/server"
import { emailService, type EmailServiceParams } from "@/lib/mod/email-service"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as EmailServiceParams

    if (!body.to || !body.type || !body.data) {
      return NextResponse.json(
        { success: false, error: "Faltan campos requeridos: to, type, data" },
        { status: 400 }
      )
    }

    const result = await emailService.sendServiceEmail(body)

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
