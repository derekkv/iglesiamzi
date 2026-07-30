import { supabase } from "@/lib/secure-db"

export interface CensoJovenArchivo {
  id: number
  censo_joven_id: number
  nombre_archivo: string
  url: string
  tipo: string | null
  tamano: number | null
  created_at: string
}

export const censoJovenesArchivosService = {
  async getByJovenId(censoJovenId: number): Promise<CensoJovenArchivo[]> {
    const { data, error } = await supabase
      .from("censo_jovenes_archivos")
      .select("*")
      .eq("censo_joven_id", censoJovenId)
      .order("created_at", { ascending: false })
    if (error) throw error
    return data || []
  },

  async getCountsByJovenIds(ids: number[]): Promise<Record<number, number>> {
    if (ids.length === 0) return {}
    const { data, error } = await supabase
      .from("censo_jovenes_archivos")
      .select("censo_joven_id")
      .in("censo_joven_id", ids)
    if (error) throw error
    const counts: Record<number, number> = {}
    for (const row of data || []) {
      counts[row.censo_joven_id] = (counts[row.censo_joven_id] || 0) + 1
    }
    return counts
  },

  async upload(censoJovenId: number, file: File, token: string): Promise<CensoJovenArchivo> {
    const formData = new FormData()
    formData.append("file", file)
    formData.append("folder", `censo-jovenes/${censoJovenId}`)

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

    const { data, error } = await supabase
      .from("censo_jovenes_archivos")
      .insert({
        censo_joven_id: censoJovenId,
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

  async delete(archivoId: number): Promise<void> {
    const { error } = await supabase
      .from("censo_jovenes_archivos")
      .delete()
      .eq("id", archivoId)
    if (error) throw error
  },
}
