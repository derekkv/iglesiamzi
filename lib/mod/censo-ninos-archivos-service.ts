import { supabase } from "@/lib/secure-db"

export interface CensoNinoArchivo {
  id: number
  censo_nino_id: number
  nombre_archivo: string
  url: string
  tipo: string | null
  tamano: number | null
  created_at: string
}

export const censoNinosArchivosService = {
  /**
   * Obtener todos los archivos de un niño
   */
  async getByNinoId(censoNinoId: number): Promise<CensoNinoArchivo[]> {
    const { data, error } = await supabase
      .from("censo_ninos_archivos")
      .select("*")
      .eq("censo_nino_id", censoNinoId)
      .order("created_at", { ascending: false })
    if (error) throw error
    return data || []
  },

  /**
   * Obtener conteo de archivos por niño (para mostrar en tabla)
   */
  async getCountsByNinoIds(ids: number[]): Promise<Record<number, number>> {
    if (ids.length === 0) return {}
    const { data, error } = await supabase
      .from("censo_ninos_archivos")
      .select("censo_nino_id")
      .in("censo_nino_id", ids)
    if (error) throw error
    const counts: Record<number, number> = {}
    for (const row of data || []) {
      counts[row.censo_nino_id] = (counts[row.censo_nino_id] || 0) + 1
    }
    return counts
  },

  /**
   * Subir un archivo y registrarlo en la tabla
   */
  async upload(censoNinoId: number, file: File, token: string): Promise<CensoNinoArchivo> {
    // 1. Subir archivo al storage via API existente
    const formData = new FormData()
    formData.append("file", file)
    formData.append("folder", `censo-ninos/${censoNinoId}`)

    const res = await fetch("/api/upload-file", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    })

    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.error || "Error subiendo archivo")
    }

    const uploadResult = await res.json()

    // 2. Registrar en la tabla
    const { data, error } = await supabase
      .from("censo_ninos_archivos")
      .insert({
        censo_nino_id: censoNinoId,
        nombre_archivo: file.name,
        url: uploadResult.url,
        tipo: file.type || null,
        tamano: file.size || null,
      })
      .select()
      .single()

    if (error) throw error
    return data
  },

  /**
   * Eliminar un archivo (registro + storage)
   */
  async delete(archivoId: number): Promise<void> {
    const { error } = await supabase
      .from("censo_ninos_archivos")
      .delete()
      .eq("id", archivoId)
    if (error) throw error
  },
}
