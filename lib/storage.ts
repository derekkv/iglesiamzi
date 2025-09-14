import { GlobalConfig } from "./globalConfig";
import { supabase } from "./supabase";


interface StorageAdapter {
  getMonth(id: string): Promise<any | null>;
  saveMonth(month: any): Promise<void>;
  addIngreso(mesId: string, ingreso: any): Promise<void>;
  addEgreso(mesId: string, egreso: any): Promise<void>;
  addAsistencia(mesId: string, asistencia: any): Promise<void>;
  addDiezmo(mesId: string, diezmo: any): Promise<void>;
  updateDiscipulado(mesId: string, discipulado: any): Promise<void>;
  updateConfiguraciones(mesId: string, configuraciones: any): Promise<void>;
  getFullMonth(id: string): Promise<any | null>;
  getActiveMonth(): Promise<any | null>;
  getClosedMonths(): Promise<any[]>;
  getGlobalConfig(): Promise<any>;
  updateGlobalConfig(config: any): Promise<void>;
}

export interface InventoryItem {
  id: string
  cantidad: number
  codigo: string
  detalle: string
  numeroSerie: string
  ubicacion: string
  ministerio: string
  estado: string
  fechaRegistro: string
}
export class SupabaseAdapter implements StorageAdapter {
  async getMonth(id: string) {
    const { data, error } = await supabase
      .from("meses")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      if (error.code === "PGRST116") return null;
      throw new Error(`Supabase getMonth error: ${error.message}`);
    }
    return data;
  }

async saveMonth(month: any) {
  if (month.status === "active" && !month.end_date) {
    // mes nuevo
    const { error } = await supabase.from("meses").insert({
      id: month.id,
      name: month.name,
      year: month.year,
      month: month.month,
      start_date: month.start_date,
      status: month.status,
    });
    if (error) throw new Error(`Supabase saveMonth error: ${error.message}`);
  } else {
    // mes cerrado o actualización
    const { error } = await supabase.from("meses").update({
      end_date: month.end_date,
      status: month.status,
    }).eq("id", month.id);
    if (error) throw new Error(`Supabase saveMonth error: ${error.message}`);
  }
}


async addIngreso(mesId: string, ingreso: any) {
  const { error } = await supabase.from("ingresos").insert({
    mes_id: mesId,
    concepto: "bb",
    monto: ingreso.monto,
    fecha: ingreso.fecha || new Date().toISOString(),
    ministerio: ingreso.ministerio,
    categoria_principal: ingreso.categoria_principal,
    detalle: ingreso.detalle,
    observacion: ingreso.observacion,
    estado: ingreso.estado,
  });

  if (error) throw new Error(`Supabase addIngreso error: ${error.message}`);
}

async updateIngreso(id: number, ingreso: any) {
  const { error } = await supabase
    .from("ingresos")
    .update({
      concepto: "edit we",
      monto: ingreso.monto,
      fecha: ingreso.fecha || new Date().toISOString(),
      // Si agregaste columnas extra, inclúyelas aquí
      ministerio: ingreso.ministerio,
      categoria_principal: ingreso.categoria_principal,
      detalle: ingreso.detalle,
      observacion: ingreso.observacion,
      estado: ingreso.estado,
    })
    .eq("id", id);

  if (error) throw new Error(`Supabase updateIngreso error: ${error.message}`);
}

// Editar egreso
async updateEgreso(id: number, egreso: any) {
  const { error } = await supabase
    .from("egresos")
    .update({
      concepto: "edit we",
      monto: egreso.monto,
      fecha: egreso.fecha || new Date().toISOString(),
      // Columnas extra
      ministerio: egreso.ministerio,
      categoria_principal: egreso.categoria_principal,
      detalle: egreso.detalle,
      observacion: egreso.observacion,
      estado: egreso.estado,
    })
    .eq("id", id);

  if (error) throw new Error(`Supabase updateEgreso error: ${error.message}`);
}

// Eliminar ingreso
async deleteIngreso(id: number) {
  const { error } = await supabase
    .from("ingresos")
    .delete()
    .eq("id", id);

  if (error) throw new Error(`Supabase deleteIngreso error: ${error.message}`);
}

// Eliminar egreso
async deleteEgreso(id: number) {
  const { error } = await supabase
    .from("egresos")
    .delete()
    .eq("id", id);

  if (error) throw new Error(`Supabase deleteEgreso error: ${error.message}`);
}

async addEgreso(mesId: string, ingreso: any) {
  const { error } = await supabase.from("egresos").insert({
    mes_id: mesId,
    concepto: "bb",
    monto: ingreso.monto,
    fecha: ingreso.fecha || new Date().toISOString(),
    ministerio: ingreso.ministerio,
    categoria_principal: ingreso.categoria_principal,
    detalle: ingreso.detalle,
    observacion: ingreso.observacion,
    estado: ingreso.estado,
  });

  if (error) throw new Error(`Supabase addEgreso error: ${error.message}`);
}


  async addAsistencia(mesId: string, asistencia: any) {
    const { error } = await supabase.from("asistencia").insert({
      mes_id: mesId,
      fecha: asistencia.fecha,
      ministerio: asistencia.ministerio,
      cantidad: asistencia.cantidad,
    });

    if (error) throw new Error(`Supabase addAsistencia error: ${error.message}`);
  }

  async addDiezmo(mesId: string, diezmo: any) {
    const { error } = await supabase.from("diezmos").insert({
      mes_id: mesId,
      persona: diezmo.persona,
      monto: diezmo.monto,
      fecha: diezmo.fecha || new Date().toISOString(),
    });

    if (error) throw new Error(`Supabase addDiezmo error: ${error.message}`);
  }

  async updateDiscipulado(mesId: string, discipulado: any) {
    // Eliminar datos existentes
    await supabase.from("discipulado_asistencia").delete().eq("mes_id", mesId);
    await supabase.from("discipulado_fechas").delete().eq("mes_id", mesId);
    await supabase.from("discipulado_participantes").delete().eq("mes_id", mesId);

    // Insertar participantes
    if (discipulado.participants && discipulado.participants.length > 0) {
      const participantesData = discipulado.participants.map((nombre: string) => ({
        mes_id: mesId,
        nombre,
      }));
      
      const { error: partError } = await supabase
        .from("discipulado_participantes")
        .insert(participantesData);
      
      if (partError) throw new Error(`Error inserting participants: ${partError.message}`);
    }

    // Insertar fechas
    if (discipulado.dates && discipulado.dates.length > 0) {
      const fechasData = discipulado.dates.map((fecha: string) => ({
        mes_id: mesId,
        fecha,
      }));
      
      const { error: fechaError } = await supabase
        .from("discipulado_fechas")
        .insert(fechasData);
      
      if (fechaError) throw new Error(`Error inserting dates: ${fechaError.message}`);
    }

    // Insertar asistencia (necesitamos obtener los IDs primero)
    if (discipulado.attendance && Object.keys(discipulado.attendance).length > 0) {
      // Obtener participantes con sus IDs
      const { data: participantes, error: partError } = await supabase
        .from("discipulado_participantes")
        .select("id, nombre")
        .eq("mes_id", mesId);
      
      if (partError) throw new Error(`Error getting participants: ${partError.message}`);
      
      // Obtener fechas con sus IDs
      const { data: fechas, error: fechaError } = await supabase
        .from("discipulado_fechas")
        .select("id, fecha")
        .eq("mes_id", mesId);
      
      if (fechaError) throw new Error(`Error getting dates: ${fechaError.message}`);
      
      // Preparar datos de asistencia
      const asistenciaData: any[] = [];
      
      for (const [fechaStr, asistencias] of Object.entries(discipulado.attendance)) {
        const fechaObj = fechas?.find(f => f.fecha === fechaStr);
        if (!fechaObj) continue;
        
        for (const [participanteName, estado] of Object.entries(asistencias as Record<string, string>)) {
          const participanteObj = participantes?.find(p => p.nombre === participanteName);
          if (!participanteObj) continue;
          
          asistenciaData.push({
            mes_id: mesId,
            fecha_id: fechaObj.id,
            participante_id: participanteObj.id,
            estado: estado as string,
          });
        }
      }
      
      // Insertar asistencia
      if (asistenciaData.length > 0) {
        const { error: asistError } = await supabase
          .from("discipulado_asistencia")
          .insert(asistenciaData);
        
        if (asistError) throw new Error(`Error inserting attendance: ${asistError.message}`);
      }
    }
  }

  async updateConfiguraciones(mesId: string, configuraciones: any) {
    const { error } = await supabase
      .from("configuraciones_mes")
      .upsert({
        mes_id: mesId,
        ministerios: configuraciones.ministerios || [],
        categorias_principales: configuraciones.categoriasPrincipales || [],
        detalles: configuraciones.detalles || [],
      }, {
        onConflict: 'mes_id'
      });

    if (error) throw new Error(`Supabase updateConfiguraciones error: ${error.message}`);
  }

  // Recupera mes con todos sus datos relacionados
  async getFullMonth(id: string) {
    // Obtener mes base
    const { data: mes, error: mesError } = await supabase
      .from("meses")
      .select("*")
      .eq("id", id)
      .single();

    if (mesError) return null;


    const { data: ingresos } = await supabase
      .from("ingresos")
      .select("*")
      .eq("mes_id", id);

    const { data: egresos } = await supabase
      .from("egresos")
      .select("*")
      .eq("mes_id", id);

          const { data: configuraciones } = await supabase
      .from("configuraciones_mes")
      .select("*")
      .eq("mes_id", id)
      .single();


   /*   const { data: asistencia } = await supabase
      .from("asistencia")
      .select("*")
      .eq("mes_id", id);

    const { data: diezmos } = await supabase
      .from("diezmos")
      .select("*")
      .eq("mes_id", id);

    // Obtener configuraciones


    // Obtener y reconstruir datos de discipulado
    const { data: participantes } = await supabase
      .from("discipulado_participantes")
      .select("id, nombre")
      .eq("mes_id", id)
      .order("nombre");

    const { data: fechas } = await supabase
      .from("discipulado_fechas")
      .select("id, fecha")
      .eq("mes_id", id)
      .order("fecha");

    const { data: asistencias } = await supabase
      .from("discipulado_asistencia")
      .select(`
        estado,
        discipulado_fechas(fecha),
        discipulado_participantes(nombre)
      `)
      .eq("mes_id", id);

    // Reconstruir objeto de discipulado
    const discipulado = {
      participants: participantes?.map(p => p.nombre) || [],
      dates: fechas?.map(f => f.fecha) || [],
      attendance: {} as Record<string, Record<string, string>>
    };

    // Llenar el objeto de attendance
    asistencias?.forEach(a => {
      const fecha = a.discipulado_fechas?.fecha;
      const participante = a.discipulado_participantes?.nombre;
      
      if (fecha && participante) {
        if (!discipulado.attendance[fecha]) {
          discipulado.attendance[fecha] = {};
        }
        discipulado.attendance[fecha][participante] = a.estado;
      }
    });*/

    return {
      ...mes,
      start_date: mes.start_date,
      end_date: mes.end_date,
      data: {
        ingresos: ingresos || [],
        egresos: egresos || [],
  /*       asistencia: asistencia || [],
        diezmos: diezmos || [],
        discipulado,*/
        configuraciones: {
          ministerios: configuraciones?.ministerios || [],
          categoriasPrincipales: configuraciones?.categorias_principales || [],
          detalles: configuraciones?.detalles || [],
        }
      }
    };
  }

  async getIngresosByMonth(id: string) {
  const month = await this.getFullMonth(id);
  return month?.data.ingresos || [];
}

async getEgresosByMonth(id: string) {
  const month = await this.getFullMonth(id);
  return month?.data.egresos || [];
}

  async getActiveMonth() {
    const { data, error } = await supabase
      .from("meses")
      .select("*")
      .eq("status", "active")
      .single();

    if (error) {
      if (error.code === "PGRST116") return null;
      throw new Error(`Supabase getActiveMonth error: ${error.message}`);
    }
    
    if (data) {
      return await this.getFullMonth(data.id);
    }
    
    return null;
  }

  async getClosedMonths() {
    const { data, error } = await supabase
      .from("meses")
      .select("*")
      .eq("status", "closed")
      .order("start_date", { ascending: false });

    if (error) throw new Error(`Supabase getClosedMonths error: ${error.message}`);
    
    // Para el historial, solo necesitamos datos básicos, no todos los detalles
    return data || [];
  }

  async getGlobalConfig() {
    const { data, error } = await supabase
      .from("configuraciones_globales")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (error) {
      // Si no existe configuración, crear una por defecto
      const defaultConfig = {
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
      };

      const { data: newConfig } = await supabase
        .from("configuraciones_globales")
        .insert(defaultConfig)
        .select()
        .single();

      return newConfig;
    }

    return data;
  }

async updateGlobalConfig(config: GlobalConfig) {
  const { data, error } = await supabase
    .from("configuraciones_globales")
    .upsert(
      {
        id: 1, // la fila global siempre tendrá id = 1
        ...config,
        updated_at: new Date().toISOString(),
      },
      { onConflict: ["id"] } // actualiza si ya existe
    );

  if (error) throw new Error(`Supabase updateGlobalConfig error: ${error.message}`);
}


 // Inventory methods
  async getInventoryItems(): Promise<InventoryItem[]> {
    try {
      const { data, error } = await supabase
        .from("inventory_items")
        .select("*")
        .order("created_at", { ascending: false })

      if (error) throw error

      return (data || []).map((item) => ({
        id: item.id,
        cantidad: item.cantidad,
        codigo: item.codigo,
        detalle: item.detalle,
        numeroSerie: item.numero_serie || "",
        ubicacion: item.ubicacion,
        ministerio: item.ministerio,
        estado: item.estado,
        fechaRegistro: item.fecha_registro,
      }))
    } catch (error) {
      console.error("Error getting inventory items:", error)
      return []
    }
  }

  async addInventoryItem(item: Omit<InventoryItem, "id">): Promise<InventoryItem> {
    try {
      const { data, error } = await supabase
        .from("inventory_items")
        .insert({
          cantidad: item.cantidad,
          codigo: item.codigo,
          detalle: item.detalle,
          numero_serie: item.numeroSerie || null,
          ubicacion: item.ubicacion,
          ministerio: item.ministerio,
          estado: item.estado,
          fecha_registro: item.fechaRegistro,
        })
        .select()
        .single()

      if (error) throw error

      return {
        id: data.id,
        cantidad: data.cantidad,
        codigo: data.codigo,
        detalle: data.detalle,
        numeroSerie: data.numero_serie || "",
        ubicacion: data.ubicacion,
        ministerio: data.ministerio,
        estado: data.estado,
        fechaRegistro: data.fecha_registro,
      }
    } catch (error) {
      console.error("Error adding inventory item:", error)
      throw error
    }
  }

  async updateInventoryItem(id: string, item: Omit<InventoryItem, "id">): Promise<InventoryItem> {
    try {
      const { data, error } = await supabase
        .from("inventory_items")
        .update({
          cantidad: item.cantidad,
          codigo: item.codigo,
          detalle: item.detalle,
          numero_serie: item.numeroSerie || null,
          ubicacion: item.ubicacion,
          ministerio: item.ministerio,
          estado: item.estado,
          fecha_registro: item.fechaRegistro,
        })
        .eq("id", id)
        .select()
        .single()

      if (error) throw error

      return {
        id: data.id,
        cantidad: data.cantidad,
        codigo: data.codigo,
        detalle: data.detalle,
        numeroSerie: data.numero_serie || "",
        ubicacion: data.ubicacion,
        ministerio: data.ministerio,
        estado: data.estado,
        fechaRegistro: data.fecha_registro,
      }
    } catch (error) {
      console.error("Error updating inventory item:", error)
      throw error
    }
  }

  async deleteInventoryItem(id: string): Promise<void> {
    try {
      const { error } = await supabase.from("inventory_items").delete().eq("id", id)

      if (error) throw error
    } catch (error) {
      console.error("Error deleting inventory item:", error)
      throw error
    }
  }

}

export const storage = new SupabaseAdapter();