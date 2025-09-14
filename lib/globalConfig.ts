import { storage } from "./storage"

// lib/globalConfig.ts
export interface GlobalConfig {
  ministerios: string[]
  ubicaciones: string[]
  estados: string[]
  categorias_principales: string[]
  detalles: string[]
}

export const DEFAULT_CONFIG: GlobalConfig = {
  ministerios: [
    "Alabanza y Adoración",
    "Evangelismo",
    "Discipulado",
    "Niños",
    "Jóvenes",
    "Damas",
    "Caballeros",
    "Administración",
  ],
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
    const config = await storage.getGlobalConfig();
    return config || DEFAULT_CONFIG;
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