import { NextRequest, NextResponse } from "next/server"
import { verifyApiAuth } from "@/lib/api-auth"
import { supabaseServer } from "@/lib/supabase-server"
import { renderTemplate } from "@/lib/mod/email-service"
import { listDefaultTemplates, DEFAULT_TEMPLATES, renderDefaultTemplate, type DefaultTemplateSlug } from "@/lib/mod/email-templates"

/**
 * Plantillas de correo.
 *
 *  GET               → plantillas guardadas en BD + catálogo por defecto del código
 *  GET ?preview=slug → HTML renderizado con datos de ejemplo
 *  POST              → importa una plantilla por defecto a la BD para poder editarla
 *  PUT               → guarda cambios de una plantilla
 *  DELETE ?slug=     → vuelve a la versión por defecto (borra la fila de BD)
 *
 * Las plantillas de BD tienen prioridad sobre las del código; si no existe la
 * fila, el sistema sigue funcionando con la versión por defecto.
 */

const SAMPLE_DATA: Record<string, Record<string, any>> = {
  asignacion: { userName: "Juan Pérez", asignacion: "Puerta principal", fecha: "2026-08-02", horaEntrada: "08:30", modulo: "protocolo", ministerio: "Protocolo", evento: "" },
  alerta2: { userName: "Juan Pérez", asignacion: "Puerta principal", fecha: "2026-08-02", horaEntrada: "08:30", modulo: "protocolo", ministerio: "Protocolo" },
  alerta1: { userName: "Juan Pérez", asignacion: "Puerta principal", fecha: "2026-08-02", horaEntrada: "08:30", modulo: "protocolo", ministerio: "Protocolo" },
  cumpleanos: { nombre: "María González", edad: 34, tieneImagen: false },
  resumen_cumpleanos: { fecha: "28/07/2026", total: 2, lista: "<ul><li><strong>María González</strong> — 34 años</li><li><strong>Pedro Ruiz</strong> — 51 años</li></ul>" },
  recuperacion: { codigo: "482913", minutos: 15 },
  citacion: { destinatario: "Ministerio de Alabanza", remitente: "Jaime Torres", asunto: "Ensayo general", detalle: "Ensayo general antes del servicio dominical.", fecha: "Sábado 1 de agosto de 2026", eventoLugar: "Santuario principal", valor: "", modulo: "Administración" },
  aviso_pago: { nombre: "Ana Salazar", concepto: "Nómina (primera quincena)", valor: "$250.00", metodo: "Transferencia bancaria", detalle: "" },
  requerimiento: { titulo: "Requerimiento aprobado", destinatario: "Luis Pérez", solicitante: "Administración", requerimiento: "Compra de 20 sillas", estado: "aprobado", observaciones: "Aprobado con presupuesto del mes.", valor: "$400.00" },
  generico: { asunto: "Comunicado importante", titulo: "Comunicado importante", cuerpo: "<p>Contenido del mensaje.</p>" },
}

export async function GET(request: NextRequest) {
  const auth = await verifyApiAuth(request)
  if (!auth.authenticated) {
    return NextResponse.json({ success: false, error: auth.error || "No autorizado" }, { status: 401 })
  }

  const preview = request.nextUrl.searchParams.get("preview")
  if (preview) {
    const rendered = await renderTemplate(preview, SAMPLE_DATA[preview] || {})
    if (!rendered) {
      return NextResponse.json({ success: false, error: `Plantilla "${preview}" no encontrada` }, { status: 404 })
    }
    return NextResponse.json({ success: true, ...rendered })
  }

  const { data, error } = await supabaseServer
    .from("email_templates")
    .select("*")
    .order("slug", { ascending: true })

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    templates: data || [],
    defaults: listDefaultTemplates(),
    sampleData: SAMPLE_DATA,
  })
}

/** Importa una plantilla por defecto a la BD para poder editarla. */
export async function POST(request: NextRequest) {
  const auth = await verifyApiAuth(request)
  if (!auth.authenticated) {
    return NextResponse.json({ success: false, error: auth.error || "No autorizado" }, { status: 401 })
  }

  try {
    const { slug } = (await request.json()) as { slug?: string }
    if (!slug || !(slug in DEFAULT_TEMPLATES)) {
      return NextResponse.json({ success: false, error: `Plantilla por defecto "${slug}" no existe` }, { status: 400 })
    }

    const def = DEFAULT_TEMPLATES[slug as DefaultTemplateSlug]
    const rendered = renderDefaultTemplate(slug as DefaultTemplateSlug, SAMPLE_DATA[slug] || {})

    const { data, error } = await supabaseServer
      .from("email_templates")
      .upsert(
        {
          slug,
          nombre: def.nombre,
          asunto: def.asunto,
          body_html: rendered.html,
          variables: def.variables,
          categoria: def.categoria,
          descripcion: def.descripcion,
          is_active: true,
          is_system: true,
          updated_by: auth.userId || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "slug" }
      )
      .select("*")
      .single()

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, template: data })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || "Error importando" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  const auth = await verifyApiAuth(request)
  if (!auth.authenticated) {
    return NextResponse.json({ success: false, error: auth.error || "No autorizado" }, { status: 401 })
  }

  try {
    const body = await request.json()
    if (!body.id && !body.slug) {
      return NextResponse.json({ success: false, error: "Se requiere 'id' o 'slug'" }, { status: 400 })
    }

    const patch: Record<string, any> = { updated_at: new Date().toISOString(), updated_by: auth.userId || null }
    for (const key of ["nombre", "asunto", "body_html", "variables", "categoria", "descripcion", "is_active"]) {
      if (key in body) patch[key] = body[key]
    }

    let query = supabaseServer.from("email_templates").update(patch)
    query = body.id ? query.eq("id", body.id) : query.eq("slug", body.slug)

    const { data, error } = await query.select("*").single()
    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, template: data })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || "Error guardando" }, { status: 500 })
  }
}

/** Vuelve a la versión por defecto del código. */
export async function DELETE(request: NextRequest) {
  const auth = await verifyApiAuth(request)
  if (!auth.authenticated) {
    return NextResponse.json({ success: false, error: auth.error || "No autorizado" }, { status: 401 })
  }

  const slug = request.nextUrl.searchParams.get("slug")
  if (!slug) {
    return NextResponse.json({ success: false, error: "Se requiere 'slug'" }, { status: 400 })
  }

  const { error } = await supabaseServer.from("email_templates").delete().eq("slug", slug)
  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, restored: slug })
}
