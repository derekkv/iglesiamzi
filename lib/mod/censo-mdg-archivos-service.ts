import { supabase } from "@/lib/secure-db"

export interface CensoMdgArchivo {
  id: number
  censo_mdg_id: number
  nombre_archivo: string
  url: string
  tipo: string | null
  tamano: number | null
  created_at: string
}

export const censoMdgArchivosService = {
  async getByCensoMdgId(censoMdgId: number): Promise<CensoMdgArchivo[]> {
    const { data, error } = await supabase
      .from("censo_mdg_archivos")
      .select("*")
      .eq("censo_mdg_id", censoMdgId)
      .order("created_at", { ascending: false })
    if (error) throw error
    return data || []
  },

  async getCountsByCensoMdgIds(ids: number[]): Promise<Record<number, number>> {
    if (ids.length === 0) return {}
    const { data, error } = await supabase
      .from("censo_mdg_archivos")
      .select("censo_mdg_id")
      .in("censo_mdg_id", ids)
    if (error) throw error
    const counts: Record<number, number> = {}
    for (const row of data || []) {
      counts[row.censo_mdg_id] = (counts[row.censo_mdg_id] || 0) + 1
    }
    return counts
  },

  async upload(censoMdgId: number, file: File, token: string): Promise<CensoMdgArchivo> {
    const formData = new FormData()
    formData.append("file", file)
    formData.append("folder", `censo-mdg/${censoMdgId}`)

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
      .from("censo_mdg_archivos")
      .insert({
        censo_mdg_id: censoMdgId,
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
      .from("censo_mdg_archivos")
      .delete()
      .eq("id", archivoId)
    if (error) throw error
  },
}
