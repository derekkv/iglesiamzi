/**
 * Servicio para el módulo REDIL - Ayuda Social.
 * Maneja el CRUD de casos, solicitudes, visitas técnicas y entregas.
 * Usa el cliente seguro (db) que pasa por /api/db con JWT + permisos.
 */

import { db } from "@/lib/secure-db"
import { auditService } from "./audit-service"
import { formatPhoneForWhatsApp } from "@/lib/format-phone"
import { getInternalHeaders } from "@/lib/auth-fetch"

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
  // Ficha socioeconómica
  ficha_num_personas_hogar: number | null
  ficha_num_hijos_menores: number | null
  ficha_personas_dependientes: number | null
  ficha_trabaja_actualmente: boolean | null
  ficha_ocupacion: string | null
  ficha_tiene_negocio: boolean | null
  ficha_ingreso_mensual: string | null
  ficha_tipo_vivienda: string | null
  ficha_material_vivienda: string | null
  ficha_servicios_basicos: string[] | null
  ficha_desea_emprender: boolean | null
  ficha_idea_negocio: string | null
  ficha_espacio_emprendimiento: boolean | null
  ficha_espacio_descripcion: string | null
  ficha_motivacion: string | null
  ficha_apoyo_familiar: string | null
  ficha_cuidado_hijos: string | null
  ficha_observaciones_ts: string | null
  ficha_recomendacion: string | null
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
  articulos_entregados: ArticulosEntregados | null  // JSONB con lo entregado
  created_at: string
}

// Un artículo entregado (descontado del inventario de existencia-ayuda)
export interface ArticuloEntregado {
  item_id: number
  item_nombre: string
  categoria: string | null
  cantidad: number
}

// Estructura persistida en entregas_redil.articulos_entregados (JSONB)
export interface ArticulosEntregados {
  incluye_canasta: boolean
  articulos: ArticuloEntregado[]
}

/** Parsear los artículos entregados desde la columna JSONB (tolerante a texto o objeto). */
export function parseArticulosEntregados(entrega: EntregaRedil): ArticulosEntregados {
  const vacio: ArticulosEntregados = { incluye_canasta: false, articulos: [] }
  const raw = entrega.articulos_entregados as any
  if (!raw) return vacio
  try {
    const obj = typeof raw === "string" ? JSON.parse(raw) : raw
    return {
      incluye_canasta: !!obj?.incluye_canasta,
      articulos: Array.isArray(obj?.articulos) ? obj.articulos : [],
    }
  } catch {
    return vacio
  }
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
  // Ficha socioeconómica
  ficha_num_personas_hogar?: number | null
  ficha_num_hijos_menores?: number | null
  ficha_personas_dependientes?: number | null
  ficha_trabaja_actualmente?: boolean | null
  ficha_ocupacion?: string | null
  ficha_tiene_negocio?: boolean | null
  ficha_ingreso_mensual?: string | null
  ficha_tipo_vivienda?: string | null
  ficha_material_vivienda?: string | null
  ficha_servicios_basicos?: string[] | null
  ficha_desea_emprender?: boolean | null
  ficha_idea_negocio?: string | null
  ficha_espacio_emprendimiento?: boolean | null
  ficha_espacio_descripcion?: string | null
  ficha_motivacion?: string | null
  ficha_apoyo_familiar?: string | null
  ficha_cuidado_hijos?: string | null
  ficha_observaciones_ts?: string | null
  ficha_recomendacion?: string | null
}

// Input para entrega
export interface EntregaInput {
  fecha_entrega: string
  archivos: ArchivoSubido[]
  observaciones?: string
  /** Si la entrega incluye la canasta (todos los alimentos de existencia-ayuda) */
  incluye_canasta?: boolean
  /** Artículos a entregar; se descuentan del inventario y se registran como egresos */
  articulos?: ArticuloEntregado[]
}

// ============================================================
// ADJUNTOS Y NOTAS POR ETAPA
// ============================================================

/** Etapa del caso a la que se asocia un adjunto o una nota. */
export type EtapaRedil = "general" | "solicitud" | "visita" | "entrega"

export const ETAPAS_LABELS: Record<EtapaRedil, string> = {
  general: "General",
  solicitud: "Solicitud",
  visita: "Visita Técnica",
  entrega: "Entrega",
}

export const ETAPAS_ORDEN: EtapaRedil[] = ["general", "solicitud", "visita", "entrega"]

/** Archivo adjunto a un caso (tabla redil_adjuntos). */
export interface AdjuntoRedil {
  id: number
  caso_id: number
  etapa: EtapaRedil
  url: string
  path: string | null
  name: string
  size: number
  type: string | null
  descripcion: string | null
  subido_por: string | null
  subido_por_nombre: string | null
  created_at: string
}

/** Nota / seguimiento de un caso (tabla redil_notas). */
export interface NotaRedil {
  id: number
  caso_id: number
  etapa: EtapaRedil
  contenido: string
  usuario_id: string | null
  usuario_nombre: string | null
  editado: boolean
  created_at: string
  updated_at: string
}

/** Datos de un adjunto a punto de guardar (ya subido a storage). */
export interface AdjuntoInput extends ArchivoSubido {
  path?: string | null
  descripcion?: string | null
}

/** Evento unificado para la línea de tiempo / historial del caso. */
export interface TimelineEvento {
  id: string
  tipo: "hito" | "nota" | "adjunto"
  etapa: EtapaRedil
  fecha: string
  titulo: string
  descripcion?: string | null
  usuario?: string | null
  icon: string
  color: string
  /** Datos crudos para render enriquecido (nota o adjunto). */
  nota?: NotaRedil
  adjunto?: AdjuntoRedil
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

    // Audit log
    auditService.log({
      user_id: usuario.id,
      user_name: usuario.nombre,
      module: "redil_ayuda_social",
      action: "crear",
      description: `Solicitud Redil creada - ${input.nombre_completo}`,
      details: {
        caso_id: caso.id,
        nombre: input.nombre_completo,
        tipo_ayuda: input.tipo_ayuda,
        motivo: input.motivo,
        barrio_sector: input.barrio_sector,
      },
    })

    return caso
  }

  /** Registrar visita técnica (Paso 2) */
  async registrarVisitaTecnica(
    casoId: number,
    input: VisitaTecnicaInput,
    usuario: { id: string; nombre: string }
  ): Promise<void> {
    // 1. Crear registro de visita con ficha socioeconómica
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
        // Ficha socioeconómica
        ficha_num_personas_hogar: input.ficha_num_personas_hogar ?? null,
        ficha_num_hijos_menores: input.ficha_num_hijos_menores ?? null,
        ficha_personas_dependientes: input.ficha_personas_dependientes ?? null,
        ficha_trabaja_actualmente: input.ficha_trabaja_actualmente ?? null,
        ficha_ocupacion: input.ficha_ocupacion || null,
        ficha_tiene_negocio: input.ficha_tiene_negocio ?? null,
        ficha_ingreso_mensual: input.ficha_ingreso_mensual || null,
        ficha_tipo_vivienda: input.ficha_tipo_vivienda || null,
        ficha_material_vivienda: input.ficha_material_vivienda || null,
        ficha_servicios_basicos: input.ficha_servicios_basicos || null,
        ficha_desea_emprender: input.ficha_desea_emprender ?? null,
        ficha_idea_negocio: input.ficha_idea_negocio || null,
        ficha_espacio_emprendimiento: input.ficha_espacio_emprendimiento ?? null,
        ficha_espacio_descripcion: input.ficha_espacio_descripcion || null,
        ficha_motivacion: input.ficha_motivacion || null,
        ficha_apoyo_familiar: input.ficha_apoyo_familiar || null,
        ficha_cuidado_hijos: input.ficha_cuidado_hijos || null,
        ficha_observaciones_ts: input.ficha_observaciones_ts || null,
        ficha_recomendacion: input.ficha_recomendacion || null,
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

    // Audit log
    auditService.log({
      user_id: usuario.id,
      user_name: usuario.nombre,
      module: "redil_ayuda_social",
      action: "editar",
      description: `Visita técnica registrada - Caso #${casoId} - Resultado: ${input.resultado}`,
      details: {
        caso_id: casoId,
        resultado: input.resultado,
        tipo_ayuda_aprobada: input.tipo_ayuda_aprobada,
        observaciones: input.observaciones,
        motivo_rechazo: input.motivo_rechazo,
        antes: { estado: "pendiente_visita" },
        despues: { estado: nuevoEstado },
      },
    })
  }

  /** Registrar entrega (Paso 3) */
  async registrarEntrega(
    casoId: number,
    input: EntregaInput,
    usuario: { id: string; nombre: string }
  ): Promise<void> {
    const token = typeof window !== "undefined" ? localStorage.getItem("authToken") : null
    if (!token) throw new Error("No hay sesión activa")

    const arts = (input.articulos || []).filter((a) => a.item_id && Number(a.cantidad) > 0)

    const res = await fetch("/api/redil/registrar-entrega", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        caso_id: casoId,
        fecha_entrega: input.fecha_entrega,
        observaciones: input.observaciones || null,
        foto1: input.archivos.length > 0 ? JSON.stringify(input.archivos) : null,
        incluye_canasta: !!input.incluye_canasta,
        articulos: arts,
        usuario_nombre: usuario.nombre,
      }),
    })

    if (!res.ok) {
      const json = await res.json().catch(() => ({}))
      throw new Error(json.error || `Error ${res.status} registrando entrega`)
    }
  }

  /** Eliminar caso completo (solo admin) */
  async eliminarCaso(casoId: number, usuario?: { id: string; nombre: string }): Promise<void> {
    // Obtener datos antes de eliminar para audit
    const { data: caso } = await db.from("casos_redil").select("*").eq("id", casoId).maybeSingle()
    const { data: solicitud } = await db.from("solicitudes_redil").select("nombre_completo, tipo_ayuda").eq("caso_id", casoId).maybeSingle()

    const { error } = await db
      .from("casos_redil")
      .delete()
      .eq("id", casoId)

    if (error) throw new Error(error.message)

    // Audit log
    if (usuario) {
      auditService.log({
        user_id: usuario.id,
        user_name: usuario.nombre,
        module: "redil_ayuda_social",
        action: "eliminar",
        description: `Caso Redil eliminado #${casoId} - ${solicitud?.nombre_completo || "Sin nombre"}`,
        details: {
          caso_id: casoId,
          estado_al_eliminar: caso?.estado,
          nombre_solicitante: solicitud?.nombre_completo,
          tipo_ayuda: solicitud?.tipo_ayuda,
        },
      })
    }
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

  // ---- EDICIÓN DE SOLICITUD ----

  /** Actualizar los datos de la solicitud (Paso 1) de un caso. */
  async actualizarSolicitud(
    casoId: number,
    input: SolicitudInput,
    usuario: { id: string; nombre: string }
  ): Promise<void> {
    const { error } = await db
      .from("solicitudes_redil")
      .update({
        nombre_completo: input.nombre_completo,
        edad: input.edad ?? null,
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
      .eq("caso_id", casoId)

    if (error) throw new Error(error.message)

    auditService.log({
      user_id: usuario.id,
      user_name: usuario.nombre,
      module: "redil_ayuda_social",
      action: "editar",
      description: `Solicitud Redil editada - Caso #${casoId} - ${input.nombre_completo}`,
      details: { caso_id: casoId, nombre: input.nombre_completo, tipo_ayuda: input.tipo_ayuda },
    })
  }

  // ---- ADJUNTOS (archivos por etapa) ----

  /** Obtener los adjuntos de un caso (opcionalmente filtrando por etapa). */
  async getAdjuntos(casoId: number, etapa?: EtapaRedil): Promise<AdjuntoRedil[]> {
    let query = db.from("redil_adjuntos").select("*").eq("caso_id", casoId)
    if (etapa) query = query.eq("etapa", etapa)
    const { data, error } = await query.order("created_at", { ascending: true })
    if (error) throw new Error(error.message)
    return data || []
  }

  /** Registrar un adjunto ya subido a storage, en una etapa del caso. */
  async agregarAdjunto(
    casoId: number,
    etapa: EtapaRedil,
    archivo: AdjuntoInput,
    usuario: { id: string; nombre: string }
  ): Promise<AdjuntoRedil> {
    const { data, error } = await db
      .from("redil_adjuntos")
      .insert({
        caso_id: casoId,
        etapa,
        url: archivo.url,
        path: archivo.path || null,
        name: archivo.name,
        size: archivo.size || 0,
        type: archivo.type || null,
        descripcion: archivo.descripcion || null,
        subido_por: usuario.id,
        subido_por_nombre: usuario.nombre,
      })
      .select("*")
      .single()

    if (error || !data) throw new Error(error?.message || "Error guardando adjunto")

    auditService.log({
      user_id: usuario.id,
      user_name: usuario.nombre,
      module: "redil_ayuda_social",
      action: "crear",
      description: `Adjunto agregado (${ETAPAS_LABELS[etapa]}) - Caso #${casoId} - ${archivo.name}`,
      details: { caso_id: casoId, etapa, archivo: archivo.name },
    })

    return data
  }

  /** Actualizar la descripción de un adjunto. */
  async actualizarAdjunto(
    id: number,
    descripcion: string,
    usuario: { id: string; nombre: string }
  ): Promise<void> {
    const { error } = await db
      .from("redil_adjuntos")
      .update({ descripcion: descripcion || null })
      .eq("id", id)
    if (error) throw new Error(error.message)

    auditService.log({
      user_id: usuario.id,
      user_name: usuario.nombre,
      module: "redil_ayuda_social",
      action: "editar",
      description: `Descripción de adjunto editada #${id}`,
      details: { adjunto_id: id, descripcion },
    })
  }

  /** Eliminar un adjunto (solo el registro; el archivo permanece en storage). */
  async eliminarAdjunto(id: number, usuario: { id: string; nombre: string }): Promise<void> {
    const { error } = await db.from("redil_adjuntos").delete().eq("id", id)
    if (error) throw new Error(error.message)

    auditService.log({
      user_id: usuario.id,
      user_name: usuario.nombre,
      module: "redil_ayuda_social",
      action: "eliminar",
      description: `Adjunto eliminado #${id}`,
      details: { adjunto_id: id },
    })
  }

  // ---- NOTAS (seguimiento por etapa) ----

  /** Obtener las notas de un caso (opcionalmente filtrando por etapa). */
  async getNotas(casoId: number, etapa?: EtapaRedil): Promise<NotaRedil[]> {
    let query = db.from("redil_notas").select("*").eq("caso_id", casoId)
    if (etapa) query = query.eq("etapa", etapa)
    const { data, error } = await query.order("created_at", { ascending: true })
    if (error) throw new Error(error.message)
    return data || []
  }

  /** Agregar una nota a una etapa del caso. */
  async agregarNota(
    casoId: number,
    etapa: EtapaRedil,
    contenido: string,
    usuario: { id: string; nombre: string }
  ): Promise<NotaRedil> {
    const texto = (contenido || "").trim()
    if (!texto) throw new Error("La nota no puede estar vacía")

    const { data, error } = await db
      .from("redil_notas")
      .insert({
        caso_id: casoId,
        etapa,
        contenido: texto,
        usuario_id: usuario.id,
        usuario_nombre: usuario.nombre,
      })
      .select("*")
      .single()

    if (error || !data) throw new Error(error?.message || "Error guardando nota")

    auditService.log({
      user_id: usuario.id,
      user_name: usuario.nombre,
      module: "redil_ayuda_social",
      action: "crear",
      description: `Nota agregada (${ETAPAS_LABELS[etapa]}) - Caso #${casoId}`,
      details: { caso_id: casoId, etapa, contenido: texto.slice(0, 200) },
    })

    return data
  }

  /** Editar el contenido de una nota. */
  async actualizarNota(
    id: number,
    contenido: string,
    usuario: { id: string; nombre: string }
  ): Promise<void> {
    const texto = (contenido || "").trim()
    if (!texto) throw new Error("La nota no puede estar vacía")

    const { error } = await db
      .from("redil_notas")
      .update({ contenido: texto, editado: true, updated_at: new Date().toISOString() })
      .eq("id", id)
    if (error) throw new Error(error.message)

    auditService.log({
      user_id: usuario.id,
      user_name: usuario.nombre,
      module: "redil_ayuda_social",
      action: "editar",
      description: `Nota editada #${id}`,
      details: { nota_id: id, contenido: texto.slice(0, 200) },
    })
  }

  /** Eliminar una nota. */
  async eliminarNota(id: number, usuario: { id: string; nombre: string }): Promise<void> {
    const { error } = await db.from("redil_notas").delete().eq("id", id)
    if (error) throw new Error(error.message)

    auditService.log({
      user_id: usuario.id,
      user_name: usuario.nombre,
      module: "redil_ayuda_social",
      action: "eliminar",
      description: `Nota eliminada #${id}`,
      details: { nota_id: id },
    })
  }
}

export const redilService = new RedilAyudaSocialService()

// ============================================================
// LÍNEA DE TIEMPO / HISTORIAL DEL CASO
// ============================================================

/**
 * Construye una línea de tiempo unificada de un caso a partir de:
 * - Hitos derivados del caso (creación, visita técnica, entrega/cierre).
 * - Notas registradas por etapa.
 * - Adjuntos subidos por etapa (incluye los archivos legados de la entrega).
 * Devuelve los eventos ordenados cronológicamente (ascendente).
 */
export function construirTimeline(
  casoCompleto: CasoCompleto,
  notas: NotaRedil[],
  adjuntos: AdjuntoRedil[]
): TimelineEvento[] {
  const eventos: TimelineEvento[] = []
  const { caso, solicitud, visita, entrega } = casoCompleto

  // --- Hitos del caso ---
  if (caso?.fecha_creacion) {
    eventos.push({
      id: `hito-creado-${caso.id}`,
      tipo: "hito",
      etapa: "solicitud",
      fecha: caso.fecha_creacion,
      titulo: "Solicitud creada",
      descripcion: solicitud?.nombre_completo ? `Beneficiario: ${solicitud.nombre_completo}` : null,
      usuario: caso.usuario_creador_nombre,
      icon: "ClipboardList",
      color: "blue",
    })
  }

  if (visita?.fecha_visita) {
    const aprobado = visita.resultado === "aprobado"
    eventos.push({
      id: `hito-visita-${visita.id}`,
      tipo: "hito",
      etapa: "visita",
      fecha: visita.fecha_visita,
      titulo: aprobado ? "Visita técnica: APROBADO" : "Visita técnica: DENEGADO",
      descripcion: aprobado
        ? (visita.observaciones || null)
        : (visita.motivo_rechazo || visita.observaciones || null),
      usuario: visita.realizada_por_nombre,
      icon: aprobado ? "CheckCircle" : "XCircle",
      color: aprobado ? "green" : "red",
    })
  }

  if (entrega?.fecha_entrega) {
    eventos.push({
      id: `hito-entrega-${entrega.id}`,
      tipo: "hito",
      etapa: "entrega",
      fecha: entrega.created_at || entrega.fecha_entrega,
      titulo: "Entrega realizada",
      descripcion: entrega.observaciones || null,
      usuario: entrega.entregado_por_nombre,
      icon: "Package",
      color: "emerald",
    })
  }

  // --- Notas ---
  for (const nota of notas) {
    eventos.push({
      id: `nota-${nota.id}`,
      tipo: "nota",
      etapa: nota.etapa,
      fecha: nota.created_at,
      titulo: `Nota · ${ETAPAS_LABELS[nota.etapa]}`,
      descripcion: nota.contenido,
      usuario: nota.usuario_nombre,
      icon: "StickyNote",
      color: "amber",
      nota,
    })
  }

  // --- Adjuntos (tabla redil_adjuntos) ---
  for (const adj of adjuntos) {
    eventos.push({
      id: `adj-${adj.id}`,
      tipo: "adjunto",
      etapa: adj.etapa,
      fecha: adj.created_at,
      titulo: `Archivo · ${ETAPAS_LABELS[adj.etapa]}`,
      descripcion: adj.descripcion || adj.name,
      usuario: adj.subido_por_nombre,
      icon: "Paperclip",
      color: "slate",
      adjunto: adj,
    })
  }

  // --- Adjuntos legados de la entrega (columna foto1 JSON) ---
  if (entrega) {
    const legacy = parseArchivos(entrega)
    legacy.forEach((arch, idx) => {
      eventos.push({
        id: `adj-legacy-${entrega.id}-${idx}`,
        tipo: "adjunto",
        etapa: "entrega",
        fecha: entrega.created_at || entrega.fecha_entrega,
        titulo: "Archivo · Entrega",
        descripcion: arch.name,
        usuario: entrega.entregado_por_nombre,
        icon: "Paperclip",
        color: "slate",
        adjunto: {
          id: -1 - idx,
          caso_id: entrega.caso_id,
          etapa: "entrega",
          url: arch.url,
          path: null,
          name: arch.name,
          size: arch.size,
          type: arch.type,
          descripcion: null,
          subido_por: null,
          subido_por_nombre: entrega.entregado_por_nombre,
          created_at: entrega.created_at || entrega.fecha_entrega,
        },
      })
    })
  }

  eventos.sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime())
  return eventos
}

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

  // Usar JWT del usuario si está disponible (llamada desde el browser),
  // o el secreto interno si no hay token (llamada desde el servidor).
  const headers = token
    ? { "Content-Type": "application/json", Authorization: `Bearer ${token}` }
    : getInternalHeaders()

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
          phone: formatPhoneForWhatsApp(params.destinatario.telefono),
          message: mensajeWa,
          origen: "redil",
          useCase: "aviso_ayuda_social",
          templateData: {
            destinatario: params.destinatario.nombre || "",
            detalle: mensajeWa.slice(0, 300),
          },
        }),
      })
    } catch (err) {
      console.error("Error enviando WhatsApp REDIL:", err)
    }
  }
}
