import { NextRequest, NextResponse } from "next/server"
import { notifyError } from "@/lib/error-notifier"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { context?: string; error?: string; details?: string; url?: string }
    const { context, error, details, url } = body

    if (!error) {
      return NextResponse.json({ success: false, error: "Campo 'error' requerido" }, { status: 400 })
    }

    await notifyError({
      context: context || "Frontend",
      error,
      details: [details, url ? `URL: ${url}` : ""].filter(Boolean).join("\n"),
    })

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
