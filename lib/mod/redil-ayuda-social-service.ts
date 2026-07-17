/**
 * Servicio para el módulo REDIL - Ayuda Social.
 * Maneja el CRUD de casos, solicitudes, visitas técnicas y entregas.
 * Usa el cliente seguro (db) que pasa por /api/db con JWT + permisos.
 */

import { db } from "@/lib/secure-db"

// ============================================================
// TIPOS
// ============================================================

export type EstadoCaso =
  | "pendiente_visita"
  | "en_visita_tecnica"
  | "aprobado"
  | "rechazado"
  | "pendiente_entrega"
  | "entregado"
  | "cerrado"

export const ESTADOS_LABELS: Record<EstadoCaso, string> = {
  pendiente_visita: "Pendiente de visita",
  en_visita_tecnica: "En visita técnica",
  aprobado: "Aprobado",
  rechazado: "Rechazado",
  pendiente_entrega: "Pendiente de entrega",
  entregado: "Entregado",
  cerrado: "Cerrado",
}

export const ESTADOS_COLORS: Record<EstadoCaso, { bg: string; text: string; dot: string }> = {
  pendiente_visita: { bg: "bg-yellow-100", text: "text-yellow-800", dot: "bg-yellow-500" },
  en_visita_tecnica: { bg: "bg-blue-100", text: "text-blue-800", dot: "bg-blue-500" },
  aprobado: { bg: "bg-green-100", text: "text-green-800", dot: "bg-green-500" },
  rechazado: { bg: "bg-red-100", text: "text-red-800", dot: "bg-red-500" },
  pendiente_entrega: { bg: "bg-orange-100", text: "text-orange-800", dot: "bg-orange-500" },
  entregado: { bg: "bg-emerald-100", text: "text-emerald-800", dot: "bg-emerald-500" },
  cerrado: { bg: "bg-gray-100", text: "text-gray-800", dot: "bg-gray-500" },
}

export const TIPOS_AYUDA = [
  { value: "canasta", label: "Canasta / Víveres", icon: "🧺" },
  { value: "medicinas", label: "Medicinas", icon: "💊" },
  { value: "ropa", label: "Ropa", icon: "🧥" },
  { value: "panales", label: "Pañales", icon: "👶" },
  { value: "utiles_escolares", label: "Útiles escolares", icon: "📚" },
  { value: "ayuda_economica", label: "Ayuda económica", icon: "💰" },
  { value: "otro", label: "Otro", icon: "📦" },
] as const

export type TipoAyuda = typeof TIPOS_AYUDA[number]["value"]

export interface CasoRedil {
  id: number
  estado: EstadoCaso
  fecha_creacion: string
  fecha_cierre: string | null
  usuario_creador: string
  usuario_creador_nombre: string
  aprobado_por: string | null
  aprobado_por_nombre: string | null
  fecha_aprobacion: string | null
  created_at: string
  updated_at: string
}

export interface SolicitudRedil {
  id: number
  caso_id: number
  nombre_completo: string
  edad: number | null
  cedula: string | null
  telefono: string | null
  direccion: string | null
  barrio_sector: string | null
  estado_civil: string | null
  numero_hijos: number
  edad_hijos: string | null
  tiempo_asistiendo: string | null
  trabaja_actualmente: boolean
  lugar_trabajo: string | null
  ingreso_mensual: string | null
  motivo: string | null
  tipo_ayuda: string[]
  tipo_ayuda_otro: string | null
  referencia_nombre: string | null
  referencia_telefono: string | null
  created_at: string
}

export interface VisitaTecnica {
  id: number
  caso_id: number
  resultado: "aprobado" | "no_aprobado"
  observaciones: string | null
  motivo_rechazo: string | null
  tipo_ayuda_aprobada: string[]
  fecha_visita: string
  realizada_por: string
  realizada_por_nombre: string
  created_at: string
}

export interface EntregaRedil {
  id: number
  caso_id: number
  fecha_entrega: string
  foto1: string | null       // JSON stringified de ArchivoSubido[]
  foto2: string | null
  observaciones: string | null
  entregado_por: string
  entregado_por_nombre: string
  created_at: string
}

// Archivo subido a Supabase Storage
export interface ArchivoSubido {
  url: string
  name: string
  size: number
  type: string
}

/** Parsear archivos desde la columna foto1 (JSON) */
export function parseArchivos(entrega: EntregaRedil): ArchivoSubido[] {
  if (!entrega.foto1) return []
  try {
    return JSON.parse(entrega.foto1)
  } catch {
    return []
  }
}

// Caso completo con todas las relaciones
export interface CasoCompleto {
  caso: CasoRedil
  solicitud: SolicitudRedil | null
  visita: VisitaTecnica | null
  entrega: EntregaRedil | null
}

// Input para crear solicitud
export interface SolicitudInput {
  nombre_completo: string
  edad?: number | null
  cedula?: string
  telefono?: string
  direccion?: string
  barrio_sector?: string
  estado_civil?: string
  numero_hijos?: number
  edad_hijos?: string
  tiempo_asistiendo?: string
  trabaja_actualmente?: boolean
  lugar_trabajo?: string
  ingreso_mensual?: string
  motivo?: string
  tipo_ayuda: string[]
  tipo_ayuda_otro?: string
  referencia_nombre?: string
  referencia_telefono?: string
}

// Input para visita técnica
export interface VisitaTecnicaInput {
  resultado: "aprobado" | "no_aprobado"
  observaciones?: string
  motivo_rechazo?: string
  tipo_ayuda_aprobada: string[]
}

// Input para entrega
export interface EntregaInput {
  fecha_entrega: string
  archivos: ArchivoSubido[]
  observaciones?: string
}

// ============================================================
// SERVICIO
// ============================================================

class RedilAyudaSocialService {
  // ---- CASOS ----

  /** Obtener todos los casos activos (no cerrados ni rechazados que ya pasaron) */
  async getCasosActivos(): Promise<CasoRedil[]> {
    const { data, error } = await db
      .from("casos_redil")
      .select("*")
      .not("estado", "in", '("cerrado")')
      .order("fecha_creacion", { ascending: false })

    if (error) throw new Error(error.message)
    return data || []
  }

  /** Obtener historial (casos cerrados y rechazados) */
  async getHistorial(): Promise<CasoRedil[]> {
    const { data, error } = await db
      .from("casos_redil")
      .select("*")
      .or("estado.eq.cerrado,estado.eq.rechazado")
      .order("fecha_creacion", { ascending: false })

    if (error) throw new Error(error.message)
    return data || []
  }

  /** Obtener caso por ID */
  async getCasoById(casoId: number): Promise<CasoRedil | null> {
    const { data, error } = await db
      .from("casos_redil")
      .select("*")
      .eq("id", casoId)
      .single()

    if (error) return null
    return data
  }

  /** Obtener caso completo con todas sus relaciones */
  async getCasoCompleto(casoId: number): Promise<CasoCompleto | null> {
    const caso = await this.getCasoById(casoId)
    if (!caso) return null

    const [solicitudRes, visitaRes, entregaRes] = await Promise.all([
      db.from("solicitudes_redil").select("*").eq("caso_id", casoId).maybeSingle(),
      db.from("visitas_tecnicas").select("*").eq("caso_id", casoId).maybeSingle(),
      db.from("entregas_redil").select("*").eq("caso_id", casoId).maybeSingle(),
    ])

    return {
      caso,
      solicitud: solicitudRes.data || null,
      visita: visitaRes.data || null,
      entrega: entregaRes.data || null,
    }
  }

  /** Crear nueva solicitud (Paso 1) - Crea caso + solicitud */
  async crearSolicitud(
    input: SolicitudInput,
    usuario: { id: string; nombre: string }
  ): Promise<CasoRedil> {
    // 1. Crear el caso
    const { data: caso, error: casoError } = await db
      .from("casos_redil")
      .insert({
        estado: "pendiente_visita",
        usuario_creador: usuario.id,
        usuario_creador_nombre: usuario.nombre,
      })
      .select("*")
      .single()

    if (casoError || !caso) {
      throw new Error(casoError?.message || "Error creando caso")
    }

    // 2. Crear la solicitud vinculada al caso
    const { error: solError } = await db
      .from("solicitudes_redil")
      .insert({
        caso_id: caso.id,
        nombre_completo: input.nombre_completo,
        edad: input.edad || null,
        cedula: input.cedula || null,
        telefono: input.telefono || null,
        direccion: input.direccion || null,
        barrio_sector: input.barrio_sector || null,
        estado_civil: input.estado_civil || null,
        numero_hijos: input.numero_hijos || 0,
        edad_hijos: input.edad_hijos || null,
        tiempo_asistiendo: input.tiempo_asistiendo || null,
        trabaja_actualmente: input.trabaja_actualmente || false,
        lugar_trabajo: input.lugar_trabajo || null,
        ingreso_mensual: input.ingreso_mensual || null,
        motivo: input.motivo || null,
        tipo_ayuda: input.tipo_ayuda,
        tipo_ayuda_otro: input.tipo_ayuda_otro || null,
        referencia_nombre: input.referencia_nombre || null,
        referencia_telefono: input.referencia_telefono || null,
      })
      .select("*")

    if (solError) {
      // Rollback: eliminar el caso creado
      await db.from("casos_redil").delete().eq("id", caso.id)
      throw new Error(solError.message || "Error creando solicitud")
    }

    return caso
  }

  /** Registrar visita técnica (Paso 2) */
  async registrarVisitaTecnica(
    casoId: number,
    input: VisitaTecnicaInput,
    usuario: { id: string; nombre: string }
  ): Promise<void> {
    // 1. Crear registro de visita
    const { error: visitaError } = await db
      .from("visitas_tecnicas")
      .insert({
        caso_id: casoId,
        resultado: input.resultado,
        observaciones: input.observaciones || null,
        motivo_rechazo: input.motivo_rechazo || null,
        tipo_ayuda_aprobada: input.tipo_ayuda_aprobada,
        realizada_por: usuario.id,
        realizada_por_nombre: usuario.nombre,
      })
      .select("*")

    if (visitaError) throw new Error(visitaError.message)

    // 2. Actualizar estado del caso
    const nuevoEstado: EstadoCaso = input.resultado === "aprobado"
      ? "pendiente_entrega"
      : "rechazado"

    const updateData: any = { estado: nuevoEstado }
    if (input.resultado === "aprobado") {
      updateData.aprobado_por = usuario.id
      updateData.aprobado_por_nombre = usuario.nombre
      updateData.fecha_aprobacion = new Date().toISOString()
    }
    if (input.resultado === "no_aprobado") {
      updateData.fecha_cierre = new Date().toISOString()
    }

    const { error: updateError } = await db
      .from("casos_redil")
      .update(updateData)
      .eq("id", casoId)

    if (updateError) throw new Error(updateError.message)
  }

  /** Registrar entrega (Paso 3) */
  async registrarEntrega(
    casoId: number,
    input: EntregaInput,
    usuario: { id: string; nombre: string }
  ): Promise<void> {
    // 1. Crear registro de entrega
    const { error: entregaError } = await db
      .from("entregas_redil")
      .insert({
        caso_id: casoId,
        fecha_entrega: input.fecha_entrega,
        foto1: input.archivos.length > 0 ? JSON.stringify(input.archivos) : null,
        observaciones: input.observaciones || null,
        entregado_por: usuario.id,
        entregado_por_nombre: usuario.nombre,
      })
      .select("*")

    if (entregaError) throw new Error(entregaError.message)

    // 2. Cerrar el caso
    const { error: updateError } = await db
      .from("casos_redil")
      .update({
        estado: "cerrado",
        fecha_cierre: new Date().toISOString(),
      })
      .eq("id", casoId)

    if (updateError) throw new Error(updateError.message)
  }

  /** Eliminar caso completo (solo admin) */
  async eliminarCaso(casoId: number): Promise<void> {
    const { error } = await db
      .from("casos_redil")
      .delete()
      .eq("id", casoId)

    if (error) throw new Error(error.message)
  }

  /** Obtener solicitud de un caso */
  async getSolicitud(casoId: number): Promise<SolicitudRedil | null> {
    const { data, error } = await db
      .from("solicitudes_redil")
      .select("*")
      .eq("caso_id", casoId)
      .maybeSingle()

    if (error) return null
    return data
  }

  /** Obtener visita técnica de un caso */
  async getVisitaTecnica(casoId: number): Promise<VisitaTecnica | null> {
    const { data, error } = await db
      .from("visitas_tecnicas")
      .select("*")
      .eq("caso_id", casoId)
      .maybeSingle()

    if (error) return null
    return data
  }

  /** Obtener entrega de un caso */
  async getEntrega(casoId: number): Promise<EntregaRedil | null> {
    const { data, error } = await db
      .from("entregas_redil")
      .select("*")
      .eq("caso_id", casoId)
      .maybeSingle()

    if (error) return null
    return data
  }
}

export const redilService = new RedilAyudaSocialService()

// ============================================================
// UTILIDADES DE NOTIFICACIÓN
// ============================================================

/**
 * Envía notificación por correo y WhatsApp.
 * Se llama desde el componente del frontend después de crear/aprobar/rechazar.
 */
export async function enviarNotificacionRedil(params: {
  tipo: "nueva_solicitud" | "aprobada" | "rechazada"
  destinatario: { email?: string; telefono?: string; nombre: string }
  solicitante: string
  tipoAyuda: string[]
}): Promise<void> {
  const token = typeof window !== "undefined" ? localStorage.getItem("authToken") : null
  if (!token) return

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  }

  const tipoAyudaTexto = params.tipoAyuda
    .map((t) => TIPOS_AYUDA.find((ta) => ta.value === t)?.label || t)
    .join(", ")

  let asunto = ""
  let mensajeHtml = ""
  let mensajeWa = ""

  switch (params.tipo) {
    case "nueva_solicitud":
      asunto = "Nueva solicitud de ayuda social"
      mensajeHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #2563eb; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
            <h2 style="margin: 0;">🤝 Nueva Solicitud de Ayuda Social</h2>
          </div>
          <div style="padding: 20px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
            <p><strong>Solicitante:</strong> ${params.solicitante}</p>
            <p><strong>Tipo de ayuda:</strong> ${tipoAyudaTexto}</p>
            <p style="margin-top: 20px; color: #6b7280;">Ingrese al sistema para realizar la visita técnica.</p>
          </div>
        </div>
      `
      mensajeWa = `🤝 *Nueva solicitud de ayuda social*\n\nSolicitante: ${params.solicitante}\nTipo: ${tipoAyudaTexto}\n\nIngrese al sistema para realizar la visita técnica.`
      break

    case "aprobada":
      asunto = "Solicitud de ayuda social APROBADA"
      mensajeHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #16a34a; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
            <h2 style="margin: 0;">✅ Solicitud Aprobada</h2>
          </div>
          <div style="padding: 20px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
            <p>La solicitud de ayuda social de <strong>${params.solicitante}</strong> ha sido <strong>APROBADA</strong>.</p>
            <p><strong>Tipo de ayuda:</strong> ${tipoAyudaTexto}</p>
            <p style="margin-top: 20px; color: #6b7280;">Puede proceder con la entrega.</p>
          </div>
        </div>
      `
      mensajeWa = `✅ *Solicitud APROBADA*\n\nLa solicitud de ayuda social de ${params.solicitante} ha sido APROBADA.\n\nTipo: ${tipoAyudaTexto}\n\nPuede proceder con la entrega.`
      break

    case "rechazada":
      asunto = "Solicitud de ayuda social NO APROBADA"
      mensajeHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #dc2626; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
            <h2 style="margin: 0;">❌ Solicitud No Aprobada</h2>
          </div>
          <div style="padding: 20px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
            <p>La solicitud de ayuda social de <strong>${params.solicitante}</strong> no ha sido aprobada.</p>
            <p style="margin-top: 20px; color: #6b7280;">El caso ha sido cerrado y archivado en el historial.</p>
          </div>
        </div>
      `
      mensajeWa = `❌ *Solicitud NO APROBADA*\n\nLa solicitud de ayuda social de ${params.solicitante} no ha sido aprobada.\n\nEl caso ha sido cerrado y archivado en el historial.`
      break
  }

  // Enviar correo
  if (params.destinatario.email) {
    try {
      await fetch("/api/send-email", {
        method: "POST",
        headers,
        body: JSON.stringify({
          to: params.destinatario.email,
          subject: asunto,
          html: mensajeHtml,
        }),
      })
    } catch (err) {
      console.error("Error enviando correo REDIL:", err)
    }
  }

  // Enviar WhatsApp
  if (params.destinatario.telefono) {
    try {
      await fetch("/api/whatsapp/send", {
        method: "POST",
        headers,
        body: JSON.stringify({
          phone: params.destinatario.telefono,
          message: mensajeWa,
        }),
      })
    } catch (err) {
      console.error("Error enviando WhatsApp REDIL:", err)
    }
  }
}
