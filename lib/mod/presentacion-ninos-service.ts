import { supabase } from "@/lib/secure-db"
import { auditService } from "./audit-service"

export interface PresentacionNino {
  id: number
  nombre_presentado: string
  nombre_padre: string
  nombre_madre: string
  fecha: string
  nombre_pastor: string
  created_at: string
  updated_at: string
}

export interface PresentacionNinoInput {
  nombre_presentado: string
  nombre_padre: string
  nombre_madre: string
  fecha: string
  nombre_pastor: string
}

export const presentacionNinosService = {
  async getAll(): Promise<PresentacionNino[]> {
    const { data, error } = await supabase
      .from("presentacion_ninos")
      .select("*")
      .order("fecha", { ascending: false })

    if (error) throw error
    return data || []
  },

  async create(
    input: PresentacionNinoInput,
    audit?: { userId: string; userName: string }
  ): Promise<PresentacionNino> {
    const { data, error } = await supabase
      .from("presentacion_ninos")
      .insert({
        nombre_presentado: input.nombre_presentado.trim(),
        nombre_padre: input.nombre_padre.trim(),
        nombre_madre: input.nombre_madre.trim(),
        fecha: input.fecha,
        nombre_pastor: input.nombre_pastor.trim(),
      })
      .select()
      .single()

    if (error) throw error

    if (audit) {
      auditService.log({
        user_id: audit.userId,
        user_name: audit.userName,
        module: "presentacion-ninos",
        action: "crear",
        description: `Presentación: ${input.nombre_presentado}`,
        details: { ...input },
      })
    }

    return data
  },

  async update(
    id: number,
    input: Partial<PresentacionNinoInput>,
    audit?: { userId: string; userName: string }
  ): Promise<PresentacionNino> {
    const updateData: Record<string, any> = { updated_at: new Date().toISOString() }
    if (input.nombre_presentado !== undefined) updateData.nombre_presentado = input.nombre_presentado.trim()
    if (input.nombre_padre !== undefined) updateData.nombre_padre = input.nombre_padre.trim()
    if (input.nombre_madre !== undefined) updateData.nombre_madre = input.nombre_madre.trim()
    if (input.fecha !== undefined) updateData.fecha = input.fecha
    if (input.nombre_pastor !== undefined) updateData.nombre_pastor = input.nombre_pastor.trim()

    const { data, error } = await supabase
      .from("presentacion_ninos")
      .update(updateData)
      .eq("id", id)
      .select()
      .single()

    if (error) throw error

    if (audit) {
      auditService.log({
        user_id: audit.userId,
        user_name: audit.userName,
        module: "presentacion-ninos",
        action: "editar",
        description: `Presentación editada: ${data.nombre_presentado}`,
        details: { id, cambios: input },
      })
    }

    return data
  },

  async delete(
    id: number,
    audit?: { userId: string; userName: string }
  ): Promise<void> {
    const { data: antes } = await supabase
      .from("presentacion_ninos")
      .select("nombre_presentado")
      .eq("id", id)
      .single()

    const { error } = await supabase
      .from("presentacion_ninos")
      .delete()
      .eq("id", id)

    if (error) throw error

    if (audit && antes) {
      auditService.log({
        user_id: audit.userId,
        user_name: audit.userName,
        module: "presentacion-ninos",
        action: "eliminar",
        description: `Presentación eliminada: ${antes.nombre_presentado}`,
        details: { id },
      })
    }
  },
}
