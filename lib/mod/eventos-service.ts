import { supabase } from "@/lib/secure-db"
import { auditService } from "@/lib/mod/audit-service"

// ==================== TIPOS ====================

export type Genero = "masculino" | "femenino"
export type Contextura = "delgada" | "media" | "robusta"
export type Equipo = "amarillo" | "azul" | "verde" | "naranja"
export type MetodoPago = "Efectivo" | "Transferencia"

export interface EventoTab {
  id: number
  nombre: string
  descripcion: string | null
  fecha_inicio: string | null
  fecha_fin: string | null
  valor_default: number
  is_active: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

export type EventoTabInput = Omit<EventoTab, "id" | "created_at" | "updated_at">

export interface EventoParticipante {
  id: number
  evento_id: number
  nombre: string
  edad: number
  telefono: string | null
  genero: Genero
  contextura: Contextura
  limitacion_fisica: boolean
  ministerio: string | null
  valor: number
  abono: number
  metodo_pago: MetodoPago
  equipo: Equipo | null
  equipo_razon: string | null
  importado_de_evento_id: number | null
  created_at: string
  updated_at: string
}

export type EventoParticipanteInput = Omit<
  EventoParticipante,
  "id" | "created_at" | "updated_at" | "equipo" | "equipo_razon" | "importado_de_evento_id"
>

export const EQUIPOS: { id: Equipo; label: string; color: string; bgClass: string; borderClass: string; textClass: string }[] = [
  { id: "amarillo", label: "Amarillo", color: "#EAB308", bgClass: "bg-yellow-100", borderClass: "border-yellow-400", textClass: "text-yellow-800" },
  { id: "azul", label: "Azul", color: "#3B82F6", bgClass: "bg-blue-100", borderClass: "border-blue-400", textClass: "text-blue-800" },
  { id: "verde", label: "Verde", color: "#22C55E", bgClass: "bg-green-100", borderClass: "border-green-400", textClass: "text-green-800" },
  { id: "naranja", label: "Naranja", color: "#F97316", bgClass: "bg-orange-100", borderClass: "border-orange-400", textClass: "text-orange-800" },
]

// ==================== SERVICIO DE TABS ====================

export const eventosTabsService = {
  async getAll(): Promise<EventoTab[]> {
    const { data, error } = await supabase
      .from("eventos_tabs")
      .select("*")
      .order("sort_order", { ascending: true })
    if (error) throw error
    return data || []
  },

  async getActive(): Promise<EventoTab[]> {
    const { data, error } = await supabase
      .from("eventos_tabs")
      .select("*")
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
    if (error) throw error
    return data || []
  },

  async getById(id: number): Promise<EventoTab | null> {
    const { data, error } = await supabase
      .from("eventos_tabs")
      .select("*")
      .eq("id", id)
      .maybeSingle()
    if (error) throw error
    return data
  },

  async create(input: Partial<EventoTabInput>, audit?: { userId: string; userName: string }): Promise<EventoTab> {
    const { data, error } = await supabase
      .from("eventos_tabs")
      .insert([{
        nombre: input.nombre || "Nuevo Evento",
        descripcion: input.descripcion || null,
        fecha_inicio: input.fecha_inicio || null,
        fecha_fin: input.fecha_fin || null,
        valor_default: input.valor_default || 0,
        is_active: input.is_active ?? true,
        sort_order: input.sort_order ?? 0,
        updated_at: new Date().toISOString(),
      }])
      .select()
      .single()
    if (error) throw error
    if (audit) {
      auditService.log({
        user_id: audit.userId,
        user_name: audit.userName,
        module: "encuentro",
        action: "crear",
        description: `Evento/tab creado: ${input.nombre}`,
        details: { nombre: input.nombre, id: data.id },
      })
    }
    return data
  },

  async update(id: number, input: Partial<EventoTabInput>, audit?: { userId: string; userName: string }): Promise<EventoTab> {
    const { data, error } = await supabase
      .from("eventos_tabs")
      .update({ ...input, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single()
    if (error) throw error
    if (audit) {
      auditService.log({
        user_id: audit.userId,
        user_name: audit.userName,
        module: "encuentro",
        action: "editar",
        description: `Evento/tab editado: ${input.nombre || `ID ${id}`}`,
        details: { id, cambios: input },
      })
    }
    return data
  },

  async delete(id: number, audit?: { userId: string; userName: string; nombre: string }): Promise<void> {
    const { error } = await supabase
      .from("eventos_tabs")
      .delete()
      .eq("id", id)
    if (error) throw error
    if (audit) {
      auditService.log({
        user_id: audit.userId,
        user_name: audit.userName,
        module: "encuentro",
        action: "eliminar",
        description: `Evento/tab eliminado: ${audit.nombre}`,
        details: { id, nombre: audit.nombre },
      })
    }
  },
}

// ==================== SERVICIO DE PARTICIPANTES POR EVENTO ====================

/** Obtiene el mes activo actual (necesario para registrar ingresos) */
async function _getActiveMesId(): Promise<string | null> {
  const { data } = await supabase
    .from("meses")
    .select("id")
    .eq("status", "active")
    .order("start_date", { ascending: false })
    .limit(1)
  return data && data.length > 0 ? data[0].id : null
}

/** Genera el detalle único para vincular ingreso con participante del evento */
function _ingresoDetalle(nombre: string, eventoNombre: string): string {
  return `Abono evento - ${nombre} (${eventoNombre})`
}

/** Obtiene el nombre del evento por su ID */
async function _getEventoNombre(eventoId: number): Promise<string> {
  const { data } = await supabase
    .from("eventos_tabs")
    .select("nombre")
    .eq("id", eventoId)
    .maybeSingle()
  return data?.nombre || `Evento #${eventoId}`
}

export const eventoParticipantesService = {
  async getByEvento(eventoId: number): Promise<EventoParticipante[]> {
    const { data, error } = await supabase
      .from("evento_participantes")
      .select("*")
      .eq("evento_id", eventoId)
      .order("nombre", { ascending: true })
    if (error) throw error
    return data || []
  },

  async create(input: EventoParticipanteInput, audit?: { userId: string; userName: string }): Promise<EventoParticipante> {
    const { data, error } = await supabase
      .from("evento_participantes")
      .insert([{ ...input, updated_at: new Date().toISOString() }])
      .select()
      .single()
    if (error) throw error
    if (audit) {
      auditService.log({
        user_id: audit.userId,
        user_name: audit.userName,
        module: "encuentro",
        action: "crear",
        description: `Participante evento: ${input.nombre}`,
        details: { nombre: input.nombre, evento_id: input.evento_id },
      })
    }

    // Sincronizar ingreso si tiene abono > 0
    if (data.abono > 0) {
      await this._syncIngresoCreate(data)
    }

    return data
  },

  async update(id: number, input: Partial<EventoParticipanteInput>, audit?: { userId: string; userName: string }): Promise<EventoParticipante> {
    // Obtener datos antes de actualizar (para sync de ingreso)
    const { data: antes } = await supabase.from("evento_participantes").select("*").eq("id", id).maybeSingle()

    const { data, error } = await supabase
      .from("evento_participantes")
      .update({ ...input, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single()
    if (error) throw error
    if (audit) {
      auditService.log({
        user_id: audit.userId,
        user_name: audit.userName,
        module: "encuentro",
        action: "editar",
        description: `Participante evento editado: ${input.nombre || `ID ${id}`}`,
        details: { id, cambios: input },
      })
    }

    // Sincronizar ingreso cuando cambia el abono
    if (antes) {
      await this._syncIngresoUpdate(antes, data)
    }

    return data
  },

  async delete(id: number, audit?: { userId: string; userName: string; nombre: string }): Promise<void> {
    // Obtener datos antes de eliminar (para eliminar ingreso vinculado)
    const { data: record } = await supabase.from("evento_participantes").select("*").eq("id", id).maybeSingle()

    const { error } = await supabase
      .from("evento_participantes")
      .delete()
      .eq("id", id)
    if (error) throw error
    if (audit) {
      auditService.log({
        user_id: audit.userId,
        user_name: audit.userName,
        module: "encuentro",
        action: "eliminar",
        description: `Participante evento eliminado: ${audit.nombre}`,
        details: { id, nombre: audit.nombre },
      })
    }

    // Eliminar ingreso vinculado si tenía abono
    if (record && record.abono > 0) {
      await this._syncIngresoDelete(record)
    }
  },

  /**
   * Importa participantes de un evento anterior al nuevo evento.
   * - Copia todos los datos personales (nombre, edad, teléfono, género, contextura, limitación, ministerio)
   * - Pone el valor del nuevo evento (valor_default del tab destino o el valor anterior)
   * - Resetea abono a 0
   * - Limpia equipo/equipo_razon
   * - Registra importado_de_evento_id para trazabilidad
   */
  async importarDesdeEvento(
    eventoOrigenId: number,
    eventoDestinoId: number,
    options: {
      usarValorDefault?: boolean
      valorDefault?: number
    },
    audit?: { userId: string; userName: string }
  ): Promise<{ importados: number; duplicados: number }> {
    // Obtener participantes del evento origen
    const origen = await this.getByEvento(eventoOrigenId)
    if (origen.length === 0) {
      throw new Error("El evento origen no tiene participantes")
    }

    // Obtener participantes existentes en destino para evitar duplicados
    const destino = await this.getByEvento(eventoDestinoId)
    const nombresExistentes = new Set(destino.map(p => p.nombre.toLowerCase().trim()))

    let importados = 0
    let duplicados = 0

    for (const p of origen) {
      // Verificar duplicado por nombre
      if (nombresExistentes.has(p.nombre.toLowerCase().trim())) {
        duplicados++
        continue
      }

      const nuevoValor = options.usarValorDefault && options.valorDefault !== undefined
        ? options.valorDefault
        : p.valor

      await supabase
        .from("evento_participantes")
        .insert([{
          evento_id: eventoDestinoId,
          nombre: p.nombre,
          edad: p.edad,
          telefono: p.telefono,
          genero: p.genero,
          contextura: p.contextura,
          limitacion_fisica: p.limitacion_fisica,
          ministerio: p.ministerio,
          valor: nuevoValor,
          abono: 0, // Siempre resetear abono
          equipo: null,
          equipo_razon: null,
          importado_de_evento_id: eventoOrigenId,
          updated_at: new Date().toISOString(),
        }])

      importados++
    }

    if (audit) {
      auditService.log({
        user_id: audit.userId,
        user_name: audit.userName,
        module: "encuentro",
        action: "crear",
        description: `Importados ${importados} participantes desde evento #${eventoOrigenId} a evento #${eventoDestinoId}`,
        details: { eventoOrigenId, eventoDestinoId, importados, duplicados },
      })
    }

    return { importados, duplicados }
  },

  // ==================== SYNC CON INGRESOS ====================

  async _syncIngresoCreate(record: EventoParticipante) {
    try {
      const mesId = await _getActiveMesId()
      if (!mesId) return // No hay mes activo, no se puede registrar ingreso

      const eventoNombre = await _getEventoNombre(record.evento_id)
      const detalle = _ingresoDetalle(record.nombre, eventoNombre)

      await supabase.from("ingresos").insert({
        mes_id: mesId,
        concepto: "auto-evento",
        monto: record.abono,
        fecha: new Date().toISOString().split("T")[0],
        ministerio: "Administración",
        categoria_principal: "Ingresos x Eventos",
        detalle,
        observacion: `Abono de ${record.nombre} para ${eventoNombre} (valor total: $${Number(record.valor).toFixed(2)})`,
        estado: "Procesado",
        metodo_pago: record.metodo_pago || "Efectivo",
      })
    } catch (e) {
      console.error("[eventos] Error sync ingreso create:", e)
    }
  },

  async _syncIngresoUpdate(antes: EventoParticipante, despues: EventoParticipante) {
    try {
      const eventoNombre = await _getEventoNombre(antes.evento_id)
      const oldDetalle = _ingresoDetalle(antes.nombre, eventoNombre)

      // Buscar ingreso vinculado
      const { data: ingreso } = await supabase
        .from("ingresos")
        .select("id")
        .eq("concepto", "auto-evento")
        .eq("detalle", oldDetalle)
        .limit(1)
        .maybeSingle()

      const abonoAntes = Number(antes.abono)
      const abonoDespues = Number(despues.abono)

      if (abonoAntes === 0 && abonoDespues > 0) {
        // No tenía ingreso, crear uno nuevo
        await this._syncIngresoCreate(despues)
      } else if (abonoAntes > 0 && abonoDespues === 0) {
        // Abono eliminado, borrar ingreso
        if (ingreso) {
          await supabase.from("ingresos").delete().eq("id", ingreso.id)
        }
      } else if (abonoAntes > 0 && abonoDespues > 0 && ingreso) {
        // Actualizar monto y datos del ingreso
        const newDetalle = _ingresoDetalle(despues.nombre, eventoNombre)
        await supabase.from("ingresos").update({
          monto: abonoDespues,
          detalle: newDetalle,
          observacion: `Abono de ${despues.nombre} para ${eventoNombre} (valor total: $${Number(despues.valor).toFixed(2)})`,
          metodo_pago: despues.metodo_pago || "Efectivo",
        }).eq("id", ingreso.id)
      }
    } catch (e) {
      console.error("[eventos] Error sync ingreso update:", e)
    }
  },

  async _syncIngresoDelete(record: EventoParticipante) {
    try {
      const eventoNombre = await _getEventoNombre(record.evento_id)
      const detalle = _ingresoDetalle(record.nombre, eventoNombre)

      await supabase
        .from("ingresos")
        .delete()
        .eq("concepto", "auto-evento")
        .eq("detalle", detalle)
    } catch (e) {
      console.error("[eventos] Error sync ingreso delete:", e)
    }
  },

  /**
   * Sincroniza todos los abonos de un evento con ingresos.
   * - Crea ingresos faltantes para participantes con abono > 0 que no tienen ingreso
   * - Actualiza montos desincronizados
   * - Elimina ingresos huérfanos (de participantes que ya no existen o abono = 0)
   */
  async syncMissingIngresos(eventoId: number): Promise<{ creados: number; actualizados: number; eliminados: number }> {
    try {
      const mesId = await _getActiveMesId()
      if (!mesId) return { creados: 0, actualizados: 0, eliminados: 0 }

      const eventoNombre = await _getEventoNombre(eventoId)
      const participantes = await this.getByEvento(eventoId)

      // Obtener ingresos auto-evento existentes (todos los del mes con concepto auto-evento)
      const { data: ingresosExistentes } = await supabase
        .from("ingresos")
        .select("id, detalle, monto, metodo_pago")
        .eq("concepto", "auto-evento")
        .ilike("detalle", `%${eventoNombre}%`)

      // Mapa de ingresos existentes por detalle
      const ingresosMap = new Map<string, { id: number; monto: number; metodo_pago: string }>()
      for (const ing of (ingresosExistentes || [])) {
        ingresosMap.set(ing.detalle, { id: ing.id, monto: Number(ing.monto), metodo_pago: ing.metodo_pago })
      }

      let creados = 0
      let actualizados = 0
      let eliminados = 0

      // Recorrer participantes con abono > 0
      const detallesActivos = new Set<string>()
      for (const p of participantes) {
        if (Number(p.abono) <= 0) continue

        const detalle = _ingresoDetalle(p.nombre, eventoNombre)
        detallesActivos.add(detalle)

        const existente = ingresosMap.get(detalle)

        if (!existente) {
          // No tiene ingreso, crear
          await supabase.from("ingresos").insert({
            mes_id: mesId,
            concepto: "auto-evento",
            monto: p.abono,
            fecha: new Date().toISOString().split("T")[0],
            ministerio: "Administración",
            categoria_principal: "Ingresos x Eventos",
            detalle,
            observacion: `Abono de ${p.nombre} para ${eventoNombre} (valor total: $${Number(p.valor).toFixed(2)})`,
            estado: "Procesado",
            metodo_pago: p.metodo_pago || "Efectivo",
          })
          creados++
        } else if (existente.monto !== Number(p.abono) || existente.metodo_pago !== (p.metodo_pago || "Efectivo")) {
          // Monto o método desincronizado, actualizar
          await supabase.from("ingresos").update({
            monto: p.abono,
            observacion: `Abono de ${p.nombre} para ${eventoNombre} (valor total: $${Number(p.valor).toFixed(2)})`,
            metodo_pago: p.metodo_pago || "Efectivo",
          }).eq("id", existente.id)
          actualizados++
        }
      }

      // Eliminar ingresos huérfanos (participante eliminado o abono puesto a 0)
      for (const [detalle, ing] of ingresosMap) {
        if (!detallesActivos.has(detalle)) {
          await supabase.from("ingresos").delete().eq("id", ing.id)
          eliminados++
        }
      }

      return { creados, actualizados, eliminados }
    } catch (e) {
      console.error("[eventos] Error syncMissingIngresos:", e)
      return { creados: 0, actualizados: 0, eliminados: 0 }
    }
  },

  /**
   * Divide participantes de un evento en 4 equipos equilibrados.
   * Misma lógica multi-criterio del encuentro original.
   */
  async dividirEquipos(
    eventoId: number,
    audit?: { userId: string; userName: string },
    options?: { incluirSinCancelar?: boolean; idsExcluidos?: number[] }
  ): Promise<{
    equipos: Record<Equipo, EventoParticipante[]>
    razones: string[]
    excluidos: EventoParticipante[]
  }> {
    const todos = await this.getByEvento(eventoId)

    const incluirSinCancelar = options?.incluirSinCancelar ?? false
    const idsExcluidos = options?.idsExcluidos ?? []
    let participantes: EventoParticipante[]
    let excluidos: EventoParticipante[]

    if (incluirSinCancelar) {
      participantes = todos
      excluidos = []
    } else if (idsExcluidos.length > 0) {
      // Exclusión individual por IDs específicos
      participantes = todos.filter(p => !idsExcluidos.includes(p.id))
      excluidos = todos.filter(p => idsExcluidos.includes(p.id))
    } else {
      participantes = todos.filter(p => p.valor <= 0 || p.abono >= p.valor)
      excluidos = todos.filter(p => p.valor > 0 && p.abono < p.valor)
    }

    if (participantes.length < 4) {
      throw new Error("Se necesitan al menos 4 participantes para dividir en equipos")
    }

    const equipoNames: Equipo[] = ["amarillo", "azul", "verde", "naranja"]
    const equipos: Record<Equipo, EventoParticipante[]> = {
      amarillo: [],
      azul: [],
      verde: [],
      naranja: [],
    }

    // Separar por limitación física
    const conLimitacion = participantes.filter(p => p.limitacion_fisica)
    const sinLimitacion = participantes.filter(p => !p.limitacion_fisica)

    // Fase 1: Round-robin para limitaciones
    const limOrdenadas = [...conLimitacion].sort((a, b) => {
      const ctxOrder: Record<string, number> = { robusta: 0, media: 1, delgada: 2 }
      const ca = ctxOrder[a.contextura] ?? 1
      const cb = ctxOrder[b.contextura] ?? 1
      if (ca !== cb) return ca - cb
      return a.genero.localeCompare(b.genero)
    })

    for (let i = 0; i < limOrdenadas.length; i++) {
      equipos[equipoNames[i % 4]].push(limOrdenadas[i])
    }

    // Fase 2: Asignación greedy multi-criterio
    const targetSize = Math.floor(participantes.length / 4)

    const getEquipoScore = (equipo: EventoParticipante[], persona: EventoParticipante): number => {
      let score = 0
      score += (equipo.length - targetSize) * 100
      const mismoGenero = equipo.filter(m => m.genero === persona.genero).length
      const otroGenero = equipo.length - mismoGenero
      score += (mismoGenero - otroGenero) * 5
      const mismaContextura = equipo.filter(m => m.contextura === persona.contextura).length
      score += mismaContextura * 8
      if (equipo.length > 0) {
        const edadConNuevo = (equipo.reduce((s, m) => s + m.edad, 0) + persona.edad) / (equipo.length + 1)
        const edadGlobal = participantes.reduce((s, p) => s + p.edad, 0) / participantes.length
        score += Math.abs(edadConNuevo - edadGlobal) * 0.5
      }
      return score
    }

    const sinLimOrdenados = [...sinLimitacion].sort((a, b) => {
      const ctxOrder: Record<string, number> = { robusta: 0, media: 1, delgada: 2 }
      const ca = ctxOrder[a.contextura] ?? 1
      const cb = ctxOrder[b.contextura] ?? 1
      if (ca !== cb) return ca - cb
      if (a.genero !== b.genero) return a.genero === "masculino" ? -1 : 1
      return b.edad - a.edad
    })

    for (const persona of sinLimOrdenados) {
      let mejorEquipo = equipoNames[0]
      let mejorScore = Infinity
      for (const eq of equipoNames) {
        const score = getEquipoScore(equipos[eq], persona)
        if (score < mejorScore) {
          mejorScore = score
          mejorEquipo = eq
        }
      }
      equipos[mejorEquipo].push(persona)
    }

    // Generar razones
    const razones: string[] = []
    razones.push("--- CRITERIOS DE DIVISIÓN DE EQUIPOS ---")
    razones.push("")
    razones.push("1. LIMITACIÓN FÍSICA: Distribuidas equitativamente (round-robin).")
    razones.push("2. TAMAÑO: Equipos del mismo tamaño (±1).")
    razones.push("3. CONTEXTURA: Balance de complexión física.")
    razones.push("4. GÉNERO: Proporción M/F equilibrada.")
    razones.push("5. EDAD: Promedio de edad similar.")
    if (excluidos.length > 0) {
      razones.push(`⚠ EXCLUIDOS: ${excluidos.length} personas con saldo pendiente.`)
    }
    razones.push("")

    for (const eq of equipoNames) {
      const miembros = equipos[eq]
      const masc = miembros.filter(m => m.genero === "masculino").length
      const fem = miembros.filter(m => m.genero === "femenino").length
      const conLim = miembros.filter(m => m.limitacion_fisica).length
      const edadProm = miembros.length > 0 ? Math.round(miembros.reduce((s, m) => s + m.edad, 0) / miembros.length) : 0

      razones.push(`EQUIPO ${eq.toUpperCase()} (${miembros.length}): ${masc}M/${fem}F · Edad: ${edadProm} · Limitaciones: ${conLim}`)
    }

    // Actualizar en base de datos
    for (const eq of equipoNames) {
      for (const participante of equipos[eq]) {
        const razon = `Equipo ${eq}: edad(${participante.edad}), ctx(${participante.contextura}), lim(${participante.limitacion_fisica ? "sí" : "no"}), gen(${participante.genero})`
        await supabase
          .from("evento_participantes")
          .update({ equipo: eq, equipo_razon: razon, updated_at: new Date().toISOString() })
          .eq("id", participante.id)
        participante.equipo = eq
        participante.equipo_razon = razon
      }
    }

    if (audit) {
      auditService.log({
        user_id: audit.userId,
        user_name: audit.userName,
        module: "encuentro",
        action: "editar",
        description: `Equipos divididos en evento #${eventoId} (${participantes.length} participantes)`,
        details: {
          eventoId,
          amarillo: equipos.amarillo.length,
          azul: equipos.azul.length,
          verde: equipos.verde.length,
          naranja: equipos.naranja.length,
        },
      })
    }

    return { equipos, razones, excluidos }
  },

  async limpiarEquipos(eventoId: number, audit?: { userId: string; userName: string }): Promise<void> {
    const todos = await this.getByEvento(eventoId)
    const conEquipo = todos.filter(p => p.equipo !== null)

    for (const p of conEquipo) {
      await supabase
        .from("evento_participantes")
        .update({ equipo: null, equipo_razon: null, updated_at: new Date().toISOString() })
        .eq("id", p.id)
    }

    if (audit) {
      auditService.log({
        user_id: audit.userId,
        user_name: audit.userName,
        module: "encuentro",
        action: "editar",
        description: `Equipos reiniciados en evento #${eventoId}`,
        details: { eventoId, total: conEquipo.length },
      })
    }
  },
}
