import { storage } from "./storage"
import { supabase } from "@/lib/secure-db"

// lib/globalConfig.ts
// NOTA: El campo `ministerios` se obtiene de la tabla `module_groups.display_name`
// (fuente única de verdad). El DEFAULT_CONFIG solo se usa como fallback si falla la consulta.
export interface GlobalConfig {
  ministerios: string[]
  ubicaciones: string[]
  estados: string[]
  categorias_principales: string[]
  detalles: string[]
}

export const DEFAULT_CONFIG: GlobalConfig = {
  ministerios: [],
  categorias_principales: ["Ofrenda", "Diezmo", "Proyecto Especial"],
  detalles: ["Detalle 1", "Detalle 2", "Detalle 3"],
  ubicaciones: [
    "Santuario Principal",
    "Salón de Niños",
    "Salón de Jóvenes",
    "Oficina Pastoral",
    "Bodega",
    "Cocina",
    "Baños",
    "Estacionamiento",
  ],
  estados: ["Bueno", "Dañado", "En Reparación", "Perdido", "Prestado"],
}

export const getGlobalConfig = async (): Promise<GlobalConfig> => {
  try {
    const [config, ministeriosResult] = await Promise.all([
      storage.getGlobalConfig(),
      supabase.from("module_groups").select("display_name").order("sort_order", { ascending: true }),
    ])
    const result = config || DEFAULT_CONFIG
    if (ministeriosResult.data && ministeriosResult.data.length > 0) {
      result.ministerios = ministeriosResult.data.map((g: any) => g.display_name)
    }
    return result
  } catch (error) {
    console.error("Error getting global config:", error);
    return DEFAULT_CONFIG;
  }
}

export const updateGlobalConfig = async (config: GlobalConfig): Promise<void> => {
  try {
    await storage.updateGlobalConfig(config);
  } catch (error) {
    console.error("Error updating global config:", error);
    throw error;
  }
}