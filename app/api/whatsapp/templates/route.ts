import { NextRequest, NextResponse } from "next/server"
import { verifyApiAuth } from "@/lib/api-auth"
import { supabaseServer } from "@/lib/supabase-server"
import { syncTemplates, WA_USE_CASES, WA_USE_CASE_LABELS } from "@/lib/mod/wa-crm-service"

/**
 * Catálogo de plantillas de WhatsApp.
 *
 *  GET   → plantillas guardadas + catálogo de casos de uso del sistema
 *  POST  → sincroniza desde Meta (Graph API) hacia wa_templates
 *  PATCH → asigna una plantilla a un caso de uso y define el mapeo de variables
 *
 * El mapeo use_case → plantilla es lo que permite que los envíos automáticos
 * (cumpleaños, recordatorios, citaciones…) sigan funcionando fuera de la
 * ventana de 24 h.
 */

export async function GET(request: NextRequest) {
  const auth = await verifyApiAuth(request)
  if (!auth.authenticated) {
    return NextResponse.json({ success: false, error: auth.error || "No autorizado" }, { status: 401 })
  }

  const { data, error } = await supabaseServer
    .from("wa_templates")
    .select("*")
    .order("name", { ascending: true })

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    templates: data || [],
    useCases: WA_USE_CASES.map((uc) => ({ value: uc, label: WA_USE_CASE_LABELS[uc] })),
  })
}

export async function POST(request: NextRequest) {
  const auth = await verifyApiAuth(request)
  if (!auth.authenticated) {
    return NextResponse.json({ success: false, error: auth.error || "No autorizado" }, { status: 401 })
  }

  const result = await syncTemplates()
  if (!result.success) {
    return NextResponse.json({ success: false, error: result.error }, { status: 502 })
  }

  const { data } = await supabaseServer
    .from("wa_templates")
    .select("*")
    .order("name", { ascending: true })

  return NextResponse.json({ success: true, synced: result.synced, templates: data || [] })
}

export async function PATCH(request: NextRequest) {
  const auth = await verifyApiAuth(request)
  if (!auth.authenticated) {
    return NextResponse.json({ success: false, error: auth.error || "No autorizado" }, { status: 401 })
  }

  try {
    const body = (await request.json()) as {
      id?: string
      use_case?: string | null
      variable_map?: Record<string, string> | null
    }

    if (!body.id) {
      return NextResponse.json({ success: false, error: "Se requiere 'id' de la plantilla" }, { status: 400 })
    }

    if (body.use_case && !WA_USE_CASES.includes(body.use_case as any)) {
      return NextResponse.json(
        { success: false, error: `Caso de uso desconocido: "${body.use_case}"` },
        { status: 400 }
      )
    }

    // use_case es UNIQUE: liberar el que tuviera otra plantilla
    if (body.use_case) {
      await supabaseServer
        .from("wa_templates")
        .update({ use_case: null })
        .eq("use_case", body.use_case)
        .neq("id", body.id)
    }

    const patch: Record<string, any> = {}
    if ("use_case" in body) patch.use_case = body.use_case || null
    if ("variable_map" in body) patch.variable_map = body.variable_map || null

    const { data, error } = await supabaseServer
      .from("wa_templates")
      .update(patch)
      .eq("id", body.id)
      .select("*")
      .single()

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, template: data })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || "Error actualizando la plantilla" },
      { status: 500 }
    )
  }
}
