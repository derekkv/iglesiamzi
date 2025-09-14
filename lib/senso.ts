import { supabase } from "./supabase"

export async function getDatosIglesia() {
  try {
    const { data, error } = await supabase
      .from("censo_datos_iglesia")
      .select("*")
      .order("created_at", { ascending: false })

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    console.error("Error fetching datos iglesia:", error)
    return { data: null, error }
  }
}

export async function postDatosIglesia(body: any) {
  try {
    const { data, error } = await supabase
      .from("censo_datos_iglesia")
      .insert([body])
      .select()
      .single()

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    console.error("Error creating datos iglesia:", error)
    return { data: null, error }
  }
}

export async function putDatosIglesia(body: any) {
  try {
    const { id, ...updateData } = body
    const { data, error } = await supabase
      .from("censo_datos_iglesia")
      .update(updateData)
      .eq("id", id)
      .select()
      .single()

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    console.error("Error updating datos iglesia:", error)
    return { data: null, error }
  }
}


export async function deleteDatosIglesia(id: string) {
  try {
    const { error } = await supabase
      .from("censo_datos_iglesia")
      .delete()
      .eq("id", id)

    if (error) throw error
    
    return { success: true, error: null }
  } catch (error) {
    console.error("Error deleting datos iglesia:", error)
    return { success: false, error }
  }
}

export async function getDatosPersonales() {
  try {
    const { data, error } = await supabase
      .from("censo_datos_personales")
      .select("*")
      .order("created_at", { ascending: false })

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    console.error("Error fetching datos personales:", error)
    return { data: null, error }
  }
}

// Función para crear un nuevo registro
export async function postDatosPersonales(body: any) {
  try {
    const { data, error } = await supabase
      .from("censo_datos_personales")
      .insert([body])
      .select()
      .single()

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    console.error("Error creating datos personales:", error)
    return { data: null, error }
  }
}

// Función para actualizar un registro
export async function putDatosPersonales(body: any) {
  try {
    const { id, ...updateData } = body
    const { data, error } = await supabase
      .from("censo_datos_personales")
      .update(updateData)
      .eq("id", id)
      .select()
      .single()

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    console.error("Error updating datos personales:", error)
    return { data: null, error }
  }
}

// Función para eliminar un registro
export async function deleteDatosPersonales(id: string) {
  try {
    const { error } = await supabase
      .from("censo_datos_personales")
      .delete()
      .eq("id", id)

    if (error) throw error
    return { success: true, error: null }
  } catch (error) {
    console.error("Error deleting datos personales:", error)
    return { success: false, error }
  }
}