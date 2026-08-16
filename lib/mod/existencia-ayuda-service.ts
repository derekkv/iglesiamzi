/**
 * Servicio para el módulo REDIL - Existencia de Ayuda.
 * Maneja el inventario de productos de ayuda social (items), las
 * categorías administrables y el registro de ingresos/egresos
 * (movimientos) que ajustan la existencia.
 *
 * Usa el cliente seguro (db) que pasa por /api/db con JWT + permisos.
 */

import { db } from "@/lib/secure-db"
import { auditService } from "./audit-service"

const MODULE = "existencia_ayuda"

// ============================================================
// TIPOS
// ============================================================

export type TipoMovimiento = "ingreso" | "egreso"

export interface CategoriaExistencia {
  id: number
  nombre: string
  icon: string | null
  created_at: string
}

export interface ExistenciaItem {
  id: number
  nombre: string
  categoria: string
  cantidad_actual: number
  descripcion: string | null
  registrado_por: string | null
  registrado_por_nombre: string | null
  created_at: string
  updated_at: string
}

export interface MovimientoExistencia {
  id: number
  item_id: number | null
  item_nombre: string
  categoria: string | null
  tipo: TipoMovimiento
  cantidad: number
  motivo: string | null
  fecha: string
  usuario_id: string | null
  usuario_nombre: string | null
  created_at: string
}

export interface ItemInput {
  nombre: string
  categoria: string
  cantidad_actual: number
  descripcion?: string | null
}

export interface MovimientoInput {
  item_id: number
  tipo: TipoMovimiento
  cantidad: number
  motivo?: string | null
  fecha: string
}

export interface MovimientoUpdateInput {
  tipo: TipoMovimiento
  cantidad: number
  motivo?: string | null
  fecha: string
}

interface Usuario {
  id: string
  nombre: string
}

/** Efecto de un movimiento sobre la existencia. */
function efecto(tipo: TipoMovimiento, cantidad: number): number {
  return tipo === "ingreso" ? cantidad : -cantidad
}

// ============================================================
// SERVICIO
// ============================================================

class ExistenciaAyudaService {
  // ---- CATEGORÍAS ----

  async getCategorias(): Promise<CategoriaExistencia[]> {
    const { data, error } = await db
      .from("existencia_ayuda_categorias")
      .select("*")
      .order("nombre", { ascending: true })

    if (error) throw new Error(error.message)
    return data || []
  }

  async addCategoria(nombre: string, usuario: Usuario, icon?: string): Promise<CategoriaExistencia> {
    const limpio = nombre.trim()
    if (!limpio) throw new Error("El nombre de la categoría es obligatorio")

    const { data, error } = await db
      .from("existencia_ayuda_categorias")
      .insert({ nombre: limpio, icon: icon?.trim() || null })
      .select("*")
      .single()

    if (error || !data) throw new Error(error?.message || "Error creando la categoría")

    auditService.log({
      user_id: usuario.id,
      user_name: usuario.nombre,
      module: MODULE,
      action: "crear",
      description: `Categoría creada - ${limpio}`,
      details: { categoria_id: data.id, nombre: limpio },
    })

    return data
  }

  async deleteCategoria(id: number, usuario: Usuario): Promise<void> {
    const { data: cat } = await db
      .from("existencia_ayuda_categorias")
      .select("*")
      .eq("id", id)
      .maybeSingle()

    const { error } = await db.from("existencia_ayuda_categorias").delete().eq("id", id)
    if (error) throw new Error(error.message)

    auditService.log({
      user_id: usuario.id,
      user_name: usuario.nombre,
      module: MODULE,
      action: "eliminar",
      description: `Categoría eliminada - ${cat?.nombre || `#${id}`}`,
      details: { categoria_id: id, nombre: cat?.nombre },
    })
  }

  // ---- ITEMS ----

  async getItems(): Promise<ExistenciaItem[]> {
    const { data, error } = await db
      .from("existencia_ayuda_items")
      .select("*")
      .order("categoria", { ascending: true })
      .order("nombre", { ascending: true })

    if (error) throw new Error(error.message)
    return data || []
  }

  async getItemById(id: number): Promise<ExistenciaItem | null> {
    const { data, error } = await db
      .from("existencia_ayuda_items")
      .select("*")
      .eq("id", id)
      .maybeSingle()

    if (error) return null
    return data
  }

  async addItem(input: ItemInput, usuario: Usuario): Promise<ExistenciaItem> {
    const { data, error } = await db
      .from("existencia_ayuda_items")
      .insert({
        nombre: input.nombre.trim(),
        categoria: input.categoria,
        cantidad_actual: input.cantidad_actual || 0,
        descripcion: input.descripcion?.trim() || null,
        registrado_por: usuario.id,
        registrado_por_nombre: usuario.nombre,
      })
      .select("*")
      .single()

    if (error || !data) throw new Error(error?.message || "Error creando el producto")

    auditService.log({
      user_id: usuario.id,
      user_name: usuario.nombre,
      module: MODULE,
      action: "crear",
      description: `Producto de ayuda creado - ${input.nombre} (${input.categoria})`,
      details: { item_id: data.id, ...input },
    })

    return data
  }

  async updateItem(id: number, input: ItemInput, usuario: Usuario): Promise<ExistenciaItem> {
    const { data, error } = await db
      .from("existencia_ayuda_items")
      .update({
        nombre: input.nombre.trim(),
        categoria: input.categoria,
        cantidad_actual: input.cantidad_actual || 0,
        descripcion: input.descripcion?.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select("*")
      .single()

    if (error || !data) throw new Error(error?.message || "Error actualizando el producto")

    auditService.log({
      user_id: usuario.id,
      user_name: usuario.nombre,
      module: MODULE,
      action: "editar",
      description: `Producto de ayuda editado - ${input.nombre}`,
      details: { item_id: id, ...input },
    })

    return data
  }

  async deleteItem(id: number, usuario: Usuario): Promise<void> {
    const item = await this.getItemById(id)

    const { error } = await db.from("existencia_ayuda_items").delete().eq("id", id)
    if (error) throw new Error(error.message)

    auditService.log({
      user_id: usuario.id,
      user_name: usuario.nombre,
      module: MODULE,
      action: "eliminar",
      description: `Producto de ayuda eliminado - ${item?.nombre || `#${id}`}`,
      details: { item_id: id, nombre: item?.nombre, categoria: item?.categoria },
    })
  }

  // ---- MOVIMIENTOS (ingresos / egresos) ----

  async getMovimientos(): Promise<MovimientoExistencia[]> {
    const { data, error } = await db
      .from("existencia_ayuda_movimientos")
      .select("*")
      .order("fecha", { ascending: false })
      .order("created_at", { ascending: false })

    if (error) throw new Error(error.message)
    return data || []
  }

  /** Ajusta la existencia de un item y hace rollback del movimiento si falla. */
  private async ajustarExistencia(itemId: number, delta: number, rollbackMovId?: number): Promise<void> {
    const item = await this.getItemById(itemId)
    if (!item) return

    const nuevaCantidad = Math.max(0, Number(item.cantidad_actual) + delta)

    const { error } = await db
      .from("existencia_ayuda_items")
      .update({ cantidad_actual: nuevaCantidad, updated_at: new Date().toISOString() })
      .eq("id", itemId)

    if (error) {
      if (rollbackMovId !== undefined) {
        await db.from("existencia_ayuda_movimientos").delete().eq("id", rollbackMovId)
      }
      throw new Error(error.message)
    }
  }

  /** Registrar un ingreso o egreso: crea el movimiento y ajusta la existencia. */
  async registrarMovimiento(input: MovimientoInput, usuario: Usuario): Promise<MovimientoExistencia> {
    const item = await this.getItemById(input.item_id)
    if (!item) throw new Error("El producto seleccionado no existe")

    if (input.tipo === "egreso" && input.cantidad > Number(item.cantidad_actual)) {
      throw new Error(
        `No hay existencia suficiente de "${item.nombre}" (disponible: ${item.cantidad_actual})`
      )
    }

    const { data: mov, error } = await db
      .from("existencia_ayuda_movimientos")
      .insert({
        item_id: item.id,
        item_nombre: item.nombre,
        categoria: item.categoria,
        tipo: input.tipo,
        cantidad: input.cantidad,
        motivo: input.motivo?.trim() || null,
        fecha: input.fecha,
        usuario_id: usuario.id,
        usuario_nombre: usuario.nombre,
      })
      .select("*")
      .single()

    if (error || !mov) throw new Error(error?.message || "Error registrando el movimiento")

    await this.ajustarExistencia(item.id, efecto(input.tipo, input.cantidad), mov.id)

    auditService.log({
      user_id: usuario.id,
      user_name: usuario.nombre,
      module: MODULE,
      action: "crear",
      description: `${input.tipo === "ingreso" ? "Ingreso" : "Egreso"} de ${input.cantidad} - ${item.nombre}`,
      details: { movimiento_id: mov.id, item_id: item.id, tipo: input.tipo, cantidad: input.cantidad, motivo: input.motivo },
    })

    return mov
  }

  /** Editar un movimiento: revierte el efecto anterior y aplica el nuevo. */
  async updateMovimiento(id: number, input: MovimientoUpdateInput, usuario: Usuario): Promise<void> {
    const { data: anterior, error: getErr } = await db
      .from("existencia_ayuda_movimientos")
      .select("*")
      .eq("id", id)
      .maybeSingle()

    if (getErr || !anterior) throw new Error(getErr?.message || "Movimiento no encontrado")

    const item = anterior.item_id ? await this.getItemById(anterior.item_id) : null

    // Validar existencia resultante para egresos
    if (item) {
      const existenciaSinAnterior = Number(item.cantidad_actual) - efecto(anterior.tipo, Number(anterior.cantidad))
      const existenciaResultante = existenciaSinAnterior + efecto(input.tipo, input.cantidad)
      if (existenciaResultante < 0) {
        throw new Error(`El cambio dejaría la existencia de "${item.nombre}" en negativo`)
      }
    }

    const { error } = await db
      .from("existencia_ayuda_movimientos")
      .update({
        tipo: input.tipo,
        cantidad: input.cantidad,
        motivo: input.motivo?.trim() || null,
        fecha: input.fecha,
      })
      .eq("id", id)

    if (error) throw new Error(error.message)

    // Ajustar existencia: quitar efecto anterior, aplicar efecto nuevo
    if (item) {
      const delta = efecto(input.tipo, input.cantidad) - efecto(anterior.tipo, Number(anterior.cantidad))
      if (delta !== 0) await this.ajustarExistencia(item.id, delta)
    }

    auditService.log({
      user_id: usuario.id,
      user_name: usuario.nombre,
      module: MODULE,
      action: "editar",
      description: `Movimiento editado - ${anterior.item_nombre}`,
      details: {
        movimiento_id: id,
        antes: { tipo: anterior.tipo, cantidad: anterior.cantidad },
        despues: { tipo: input.tipo, cantidad: input.cantidad },
      },
    })
  }

  /** Eliminar un movimiento: revierte su efecto sobre la existencia. */
  async deleteMovimiento(id: number, usuario: Usuario): Promise<void> {
    const { data: mov, error: getErr } = await db
      .from("existencia_ayuda_movimientos")
      .select("*")
      .eq("id", id)
      .maybeSingle()

    if (getErr || !mov) throw new Error(getErr?.message || "Movimiento no encontrado")

    const { error } = await db.from("existencia_ayuda_movimientos").delete().eq("id", id)
    if (error) throw new Error(error.message)

    // Revertir el efecto: un ingreso se resta, un egreso se suma
    if (mov.item_id) {
      await this.ajustarExistencia(mov.item_id, -efecto(mov.tipo, Number(mov.cantidad)))
    }

    auditService.log({
      user_id: usuario.id,
      user_name: usuario.nombre,
      module: MODULE,
      action: "eliminar",
      description: `Movimiento eliminado (${mov.tipo}) - ${mov.item_nombre}`,
      details: { movimiento_id: id, tipo: mov.tipo, cantidad: mov.cantidad },
    })
  }
}

export const existenciaAyudaService = new ExistenciaAyudaService()
