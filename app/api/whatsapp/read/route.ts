import { NextRequest, NextResponse } from "next/server"
import { verifyApiAuth } from "@/lib/api-auth"
import { markAsRead } from "@/lib/mod/wa-cloud-service"
import { markConversationRead } from "@/lib/mod/wa-crm-service"

/**
 * Marca una conversación como leída.
 *
 * POST { contactId, wamid? }
 *  - pone unread_count = 0 en el CRM
 *  - si se pasa el wamid del último mensaje entrante, además avisa a Meta para
 *    que el contacto vea el doble check azul
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await verifyApiAuth(request)
    if (!auth.authenticated) {
      return NextResponse.json({ success: false, error: auth.error || "No autorizado" }, { status: 401 })
    }

    const body = (await request.json()) as { contactId?: string; wamid?: string }

    if (!body.contactId) {
      return NextResponse.json({ success: false, error: "Se requiere 'contactId'" }, { status: 400 })
    }

    await markConversationRead(body.contactId)

    let notified = false
    if (body.wamid) {
      const res = await markAsRead(body.wamid)
      notified = res.success
    }

    return NextResponse.json({ success: true, notified })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || "Error marcando como leído" },
      { status: 500 }
    )
  }
}
