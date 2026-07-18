import { supabase } from "@/lib/secure-db"
import { auditService } from "@/lib/mod/audit-service"

export type Genero = "masculino" | "femenino"
export type Contextura = "delgada" | "media" | "robusta"
export type Equipo = "amarillo" | "azul" | "verde" | "naranja"

export interface EncuentroParticipante {
  id: number
  nombre: string
  edad: number
  telefono: string | null
  genero: Genero
  contextura: Contextura
  limitacion_fisica: boolean
  ministerio: string | null
  valor: number
  abono: number
  equipo: Equipo | null
  equipo_razon: string | null
  created_at: string
  updated_at: string
}

export type EncuentroParticipanteInput = Omit<EncuentroParticipante, "id" | "created_at" | "updated_at" | "equipo" | "equipo_razon">

export const EQUIPOS: { id: Equipo; label: string; color: string; bgClass: string; borderClass: string; textClass: string }[] = [
  { id: "amarillo", label: "Amarillo", color: "#EAB308", bgClass: "bg-yellow-100", borderClass: "border-yellow-400", textClass: "text-yellow-800" },
  { id: "azul", label: "Azul", color: "#3B82F6", bgClass: "bg-blue-100", borderClass: "border-blue-400", textClass: "text-blue-800" },
  { id: "verde", label: "Verde", color: "#22C55E", bgClass: "bg-green-100", borderClass: "border-green-400", textClass: "text-green-800" },
  { id: "naranja", label: "Naranja", color: "#F97316", bgClass: "bg-orange-100", borderClass: "border-orange-400", textClass: "text-orange-800" },
]

export const encuentroService = {
  async getAll(): Promise<EncuentroParticipante[]> {
    const { data, error } = await supabase
      .from("encuentro_participantes")
      .select("*")
      .order("nombre", { ascending: true })
    if (error) throw error
    return data || []
  },

  async create(record: EncuentroParticipanteInput, audit?: { userId: string; userName: string }): Promise<EncuentroParticipante> {
    const { data, error } = await supabase
      .from("encuentro_participantes")
      .insert([{ ...record, updated_at: new Date().toISOString() }])
      .select()
      .single()
    if (error) throw error
    if (audit) {
      auditService.log({
        user_id: audit.userId,
        user_name: audit.userName,
        module: "encuentro",
        action: "crear",
        description: `Participante encuentro: ${record.nombre}`,
        details: { nombre: record.nombre, edad: record.edad },
      })
    }
    return data
  },

  async update(id: number, record: Partial<EncuentroParticipanteInput>, audit?: { userId: string; userName: string }): Promise<EncuentroParticipante> {
    const { data, error } = await supabase
      .from("encuentro_participantes")
      .update({ ...record, updated_at: new Date().toISOString() })
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
        description: `Participante encuentro editado: ${record.nombre || `ID ${id}`}`,
        details: { id, cambios: record },
      })
    }
    return data
  },

  async delete(id: number, audit?: { userId: string; userName: string; nombre: string }): Promise<void> {
    const { error } = await supabase
      .from("encuentro_participantes")
      .delete()
      .eq("id", id)
    if (error) throw error
    if (audit) {
      auditService.log({
        user_id: audit.userId,
        user_name: audit.userName,
        module: "encuentro",
        action: "eliminar",
        description: `Participante encuentro eliminado: ${audit.nombre}`,
        details: { id, nombre: audit.nombre },
      })
    }
  },

  /**
   * Divide a los participantes en 4 equipos lo más equilibradamente posible
   * considerando: edad, limitaciones físicas y contextura.
   * 
   * @param options.incluirSinCancelar - Si true, incluye participantes que no han pagado todo. Default: false
   */
  async dividirEquipos(audit?: { userId: string; userName: string }, options?: { incluirSinCancelar?: boolean }): Promise<{
    equipos: Record<Equipo, EncuentroParticipante[]>
    razones: string[]
    excluidos: EncuentroParticipante[]
  }> {
    const todos = await this.getAll()

    // Filtrar según opción de pago
    const incluirSinCancelar = options?.incluirSinCancelar ?? false
    let participantes: EncuentroParticipante[]
    let excluidos: EncuentroParticipante[]

    if (incluirSinCancelar) {
      participantes = todos
      excluidos = []
    } else {
      participantes = todos.filter(p => p.valor <= 0 || p.abono >= p.valor)
      excluidos = todos.filter(p => p.valor > 0 && p.abono < p.valor)
    }

    if (participantes.length < 4) {
      throw new Error("Se necesitan al menos 4 participantes para dividir en equipos")
    }

    const equipoNames: Equipo[] = ["amarillo", "azul", "verde", "naranja"]
    const equipos: Record<Equipo, EncuentroParticipante[]> = {
      amarillo: [],
      azul: [],
      verde: [],
      naranja: [],
    }

    /**
     * Algoritmo de distribución equilibrada multi-criterio:
     * 
     * Fase 1: Distribuir personas con limitación física equitativamente (round-robin)
     * Fase 2: Distribuir el resto asignando cada persona al equipo que más la necesita
     *         usando una función de "necesidad" que evalúa:
     *         - Tamaño del equipo (prioridad máxima: equipos deben ser parejos)
     *         - Balance de género
     *         - Balance de contextura
     *         - Balance de edad
     * 
     * Esto garantiza equipos del mismo tamaño (±1), limitaciones repartidas,
     * y dentro de eso el mejor balance posible de contextura/edad/género.
     */

    // Separar por limitación física
    const conLimitacion = participantes.filter(p => p.limitacion_fisica)
    const sinLimitacion = participantes.filter(p => !p.limitacion_fisica)

    // Fase 1: Distribuir personas con limitación física con round-robin
    // Ordenar por contextura variada para no poner todas las robustas juntas
    const limOrdenadas = [...conLimitacion].sort((a, b) => {
      const ctxOrder = { robusta: 0, media: 1, delgada: 2 }
      const ca = ctxOrder[a.contextura] ?? 1
      const cb = ctxOrder[b.contextura] ?? 1
      if (ca !== cb) return ca - cb
      return a.genero.localeCompare(b.genero)
    })

    for (let i = 0; i < limOrdenadas.length; i++) {
      const eqIdx = i % 4
      equipos[equipoNames[eqIdx]].push(limOrdenadas[i])
    }

    // Fase 2: Distribuir el resto al equipo que más "necesita" a esa persona
    // Función de score: menor score = el equipo necesita más a esta persona
    const getEquipoScore = (equipo: EncuentroParticipante[], persona: EncuentroParticipante, targetSize: number): number => {
      let score = 0

      // Penalización por tamaño (PRIORIDAD MÁXIMA): equipos más grandes reciben penalización alta
      const sizePenalty = (equipo.length - targetSize) * 100
      score += sizePenalty

      // Balance de género: penalizar si ya tiene muchos del mismo género
      const mismoGenero = equipo.filter(m => m.genero === persona.genero).length
      const otroGenero = equipo.length - mismoGenero
      score += (mismoGenero - otroGenero) * 5

      // Balance de contextura: penalizar si ya tiene muchos de la misma contextura
      const mismaContextura = equipo.filter(m => m.contextura === persona.contextura).length
      score += mismaContextura * 8

      // Balance de edad: penalizar si el promedio se aleja mucho de la media global
      if (equipo.length > 0) {
        const edadActual = equipo.reduce((s, m) => s + m.edad, 0) / equipo.length
        const edadConNuevo = (equipo.reduce((s, m) => s + m.edad, 0) + persona.edad) / (equipo.length + 1)
        const edadGlobal = participantes.reduce((s, p) => s + p.edad, 0) / participantes.length
        score += Math.abs(edadConNuevo - edadGlobal) * 0.5
      }

      return score
    }

    // Tamaño objetivo por equipo
    const targetSize = Math.floor(participantes.length / 4)

    // Ordenar los sin limitación por variedad (alternar contextura y género)
    const sinLimOrdenados = [...sinLimitacion].sort((a, b) => {
      // Primero robustos, luego medios, luego delgados (para que se repartan primero los "difíciles")
      const ctxOrder = { robusta: 0, media: 1, delgada: 2 }
      const ca = ctxOrder[a.contextura] ?? 1
      const cb = ctxOrder[b.contextura] ?? 1
      if (ca !== cb) return ca - cb
      // Dentro del mismo tipo, alternar género
      if (a.genero !== b.genero) return a.genero === "masculino" ? -1 : 1
      // Dentro del mismo género, mayor edad primero
      return b.edad - a.edad
    })

    // Asignar cada persona al equipo con menor score
    for (const persona of sinLimOrdenados) {
      let mejorEquipo = equipoNames[0]
      let mejorScore = Infinity

      for (const eq of equipoNames) {
        const score = getEquipoScore(equipos[eq], persona, targetSize)
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
    razones.push("Se consideraron los siguientes factores para equilibrar los equipos:")
    razones.push("1. LIMITACIÓN FÍSICA: Se distribuyeron primero las personas con limitaciones equitativamente (round-robin).")
    razones.push("2. TAMAÑO: Se priorizó que todos los equipos tengan el mismo número de integrantes (±1).")
    razones.push("3. CONTEXTURA: Se asignó cada persona al equipo que menos tiene de su misma contextura.")
    razones.push("4. GÉNERO: Se balanceó la proporción M/F en cada equipo.")
    razones.push("5. EDAD: Se equilibró el promedio de edad entre equipos.")
    razones.push("6. MÉTODO: Asignación greedy multi-criterio (cada persona va al equipo que más la necesita).")
    if (excluidos.length > 0) {
      razones.push(`6. EXCLUIDOS: ${excluidos.length} personas no incluidas por tener saldo pendiente.`)
    }
    razones.push("")

    // Estadísticas por equipo
    for (const eq of equipoNames) {
      const miembros = equipos[eq]
      const masc = miembros.filter(m => m.genero === "masculino").length
      const fem = miembros.filter(m => m.genero === "femenino").length
      const conLimitacion = miembros.filter(m => m.limitacion_fisica).length
      const edadProm = miembros.length > 0 ? Math.round(miembros.reduce((s, m) => s + m.edad, 0) / miembros.length) : 0
      const delgados = miembros.filter(m => m.contextura === "delgada").length
      const medios = miembros.filter(m => m.contextura === "media").length
      const robustos = miembros.filter(m => m.contextura === "robusta").length

      razones.push(`EQUIPO ${eq.toUpperCase()} (${miembros.length} personas):`)
      razones.push(`  - Género: ${masc}M / ${fem}F`)
      razones.push(`  - Edad promedio: ${edadProm} años`)
      razones.push(`  - Contextura: ${delgados} delgada, ${medios} media, ${robustos} robusta`)
      razones.push(`  - Con limitación física: ${conLimitacion}`)
      razones.push("")
    }

    // Actualizar en base de datos
    for (const eq of equipoNames) {
      for (const participante of equipos[eq]) {
        const razonIndividual = `Asignado al equipo ${eq} por balance de: edad(${participante.edad}), contextura(${participante.contextura}), limitación(${participante.limitacion_fisica ? "sí" : "no"}), género(${participante.genero})`
        await supabase
          .from("encuentro_participantes")
          .update({ equipo: eq, equipo_razon: razonIndividual, updated_at: new Date().toISOString() })
          .eq("id", participante.id)
        participante.equipo = eq
        participante.equipo_razon = razonIndividual
      }
    }

    if (audit) {
      auditService.log({
        user_id: audit.userId,
        user_name: audit.userName,
        module: "encuentro",
        action: "editar",
        description: `Equipos divididos automáticamente (${participantes.length} participantes)`,
        details: {
          amarillo: equipos.amarillo.length,
          azul: equipos.azul.length,
          verde: equipos.verde.length,
          naranja: equipos.naranja.length,
        },
      })
    }

    return { equipos, razones, excluidos }
  },

  /**
   * Limpia la asignación de equipos de todos los participantes
   */
  async limpiarEquipos(audit?: { userId: string; userName: string }): Promise<void> {
    // Obtener todos los participantes con equipo asignado
    const todos = await this.getAll()
    const conEquipo = todos.filter(p => p.equipo !== null && p.equipo !== undefined)
    
    // Actualizar uno por uno para evitar el error de UPDATE sin WHERE
    for (const p of conEquipo) {
      await supabase
        .from("encuentro_participantes")
        .update({ equipo: null, equipo_razon: null, updated_at: new Date().toISOString() })
        .eq("id", p.id)
    }

    if (audit) {
      auditService.log({
        user_id: audit.userId,
        user_name: audit.userName,
        module: "encuentro",
        action: "editar",
        description: "Equipos reiniciados (todos sin equipo)",
        details: { total: conEquipo.length },
      })
    }
  },
}
