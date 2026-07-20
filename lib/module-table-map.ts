/**
 * Mapa de tablas a módulos de permisos.
 * Define qué módulo se necesita para acceder a cada tabla.
 * 
 * Reglas:
 * - Si una tabla requiere un módulo específico, solo usuarios con can_view en ese módulo pueden leerla
 * - Si una tabla requiere "any" → cualquier usuario autenticado puede acceder
 * - Si una tabla no está listada → acceso bloqueado
 * - Para escritura (INSERT/UPDATE/DELETE) se requiere can_edit en el módulo
 */

export interface TableAccess {
  /** Módulo(s) que dan acceso. "any" = cualquier usuario autenticado */
  modules: string[] | "any"
  /** Si true, requiere can_edit para escritura. Default: true */
  requireEditForWrite?: boolean
  /** Si true, requiere can_admin para DELETE. Default: false */
  requireAdminForDelete?: boolean
  /** Campos que NUNCA se deben retornar al cliente */
  blockedFields?: string[]
}

export const TABLE_ACCESS_MAP: Record<string, TableAccess> = {
  // === SISTEMA (cualquier usuario autenticado) ===
  users: {
    modules: "any",
    requireEditForWrite: true,
    requireAdminForDelete: true,
    blockedFields: ["password_hash"],
  },
  buzon_mensajes: {
    modules: "any",
    requireEditForWrite: false, // Cualquiera puede insertar/marcar leído
  },
  user_permissions: {
    modules: "any", // Lectura abierta: muchos módulos necesitan consultar permisos (cronogramas, mensajes, asistencia, notificaciones)
    requireEditForWrite: true, // Solo admins con can_edit pueden modificar permisos
    requireAdminForDelete: true,
  },
  user_group_leaders: {
    modules: "any", // Lectura abierta: gestion-atrasados-service necesita buscar líderes para notificar
    requireEditForWrite: true,
    requireAdminForDelete: true,
  },
  system_modules: {
    modules: "any", // Lectura abierta: gestion-atrasados-service necesita resolver group_id del módulo
    requireEditForWrite: true,
  },
  module_groups: {
    modules: "any",
  },
  configuraciones_globales: {
    modules: "any",
  },
  configuraciones_mes: {
    modules: "any",
    requireEditForWrite: true,
  },
  acceso_restringido: {
    modules: "any",
    requireEditForWrite: true,
    requireAdminForDelete: true,
  },
  meses: {
    modules: "any",
    requireEditForWrite: true,
  },

  // === FINANCIERO (muy sensible) ===
  nomina: {
    modules: ["flujo_pago", "resumen-pastoral"],
  },
  payment_tables: {
    modules: ["flujo_pago"],
  },
  payment_rows: {
    modules: ["flujo_pago"],
  },
  ingresos: {
    modules: ["ingresos_egresos", "diezmos", "caja_chica", "control_mensual", "eventos_encuentro", "resumen-pastoral"],
  },
  egresos: {
    modules: ["ingresos_egresos", "flujo_pago", "pago_diario", "caja_chica", "control_mensual", "resumen-pastoral"],
  },

  // === CAJA CHICA ===
  caja_chica_movimientos: {
    modules: ["caja_chica"],
  },
  caja_chica_arqueos: {
    modules: ["caja_chica"],
  },
  diezmos: {
    modules: ["diezmos", "ingresos_egresos"],
  },
  alfoli: {
    modules: ["administracion", "control_mensual", "resumen-pastoral"],
  },
  ofrendas_celulas: {
    modules: ["ofrenda-celulas", "celulas", "resumen-pastoral"],
  },

  // === GESTIÓN DE CÉLULAS ===
  gestion_celulas: {
    modules: ["celulas", "ofrenda-celulas", "resumen-pastoral"],
  },
  miembros_celulas: {
    modules: ["celulas"],
  },

  // === CRONOGRAMA Y ASISTENCIA ===
  cronograma_servicio: {
    modules: [
      "cronograma-protocolo", "cronograma-administracion", "cronograma-discipulado",
      "cronograma-alabanza", "cronograma-comunicacion", "cronograma-herederos",
      "cronograma-intercesion", "cronograma-mdg", "cronograma-redil",
      "cronograma-hombres", "cronograma-jovenes", "cronograma-pastoral",
      "cronograma-celulas", "cronograma-eventos-celulas",
      "cronograma-eventos-protocolo", "cronograma-eventos-administracion",
      "cronograma-eventos-discipulado", "cronograma-eventos-alabanza",
      "cronograma-eventos-comunicacion", "cronograma-eventos-herederos",
      "cronograma-eventos-intercesion", "cronograma-eventos-mdg",
      "cronograma-eventos-redil", "cronograma-eventos-hombres",
      "cronograma-eventos-jovenes", "cronograma-eventos-pastoral",
      "cronograma-proyecto-mario", "cronograma-eventos-proyecto-mario",
      "gestion-cronogramas",
    ],
  },
  gestion_atrasados: {
    modules: [
      "cronograma-protocolo", "cronograma-administracion", "cronograma-discipulado",
      "cronograma-alabanza", "cronograma-comunicacion", "cronograma-herederos",
      "cronograma-intercesion", "cronograma-mdg", "cronograma-redil",
      "cronograma-hombres", "cronograma-jovenes", "cronograma-pastoral",
      "cronograma-celulas", "cronograma-proyecto-mario",
      "gestion-cronogramas", "resumen-pastoral"],
  },

  // === ASISTENCIA GENERAL ===
  asistencia_columnas: {
    modules: ["asistencia", "control_mensual", "resumen-pastoral"],
  },
  asistencia_detalles: {
    modules: ["asistencia", "control_mensual", "resumen-pastoral"],
  },
  asistencia_datos: {
    modules: ["asistencia", "control_mensual", "resumen-pastoral"],
  },

  // === ASISTENCIA SERVIDORES ===
  asistencia_servidores: {
    modules: [
      "asistencia-servidores-protocolo", "asistencia-servidores-administracion",
      "asistencia-servidores-discipulado", "asistencia-servidores-alabanza",
      "asistencia-servidores-comunicacion", "asistencia-servidores-herederos",
      "asistencia-servidores-intercesion", "asistencia-servidores-mdg",
      "asistencia-servidores-redil", "asistencia-servidores-hombres",
      "asistencia-servidores-jovenes", "asistencia-servidores-pastoral",
      "asistencia-servidores-celulas", "asistencia-servidores-proyecto-mario",
      "control_mensual", "resumen-pastoral"],
  },

  // === DATOS PERSONALES ===
  censo: {
    modules: ["censo", "bautizo", "matrimonio", "celulas", "cumpleanos-comunicacion", "listados", "control_mensual", "resumen-pastoral"],
  },
  censo_mdg: {
    modules: ["censo-mdg", "bautizo", "matrimonio", "celulas", "cumpleanos-comunicacion", "listados", "control_mensual", "resumen-pastoral"],
  },
  censo_catalogos: {
    modules: ["censo", "censo-mdg"],
  },
  censo_configuraciones: {
    modules: ["censo", "censo-mdg"],
  },
  bautizos: {
    modules: ["bautizo", "resumen-pastoral"],
  },
  bautizos_manual: {
    modules: ["bautizo"],
  },
  matrimonios: {
    modules: ["matrimonio", "resumen-pastoral"],
  },
  matrimonios_manual: {
    modules: ["matrimonio"],
  },
  presentacion_ninos: {
    modules: ["presentacion-ninos", "listados", "resumen-pastoral"],
  },

  // === INVENTARIO ===
  inventory_items: {
    modules: ["inventario"],
  },

  // === DISCIPULADO ===
  discipulado_ciclos: {
    modules: ["discipulado_primeros_pasos", "discipulado_seguimos_avanzando", "discipulado_siendo_iglesia", "historial_discipulado", "listados", "resumen-pastoral"],
  },
  discipulado_ciclo_participantes: {
    modules: ["discipulado_primeros_pasos", "discipulado_seguimos_avanzando", "discipulado_siendo_iglesia", "historial_discipulado", "listados"],
  },
  discipulado_ciclo_fechas: {
    modules: ["discipulado_primeros_pasos", "discipulado_seguimos_avanzando", "discipulado_siendo_iglesia", "historial_discipulado", "listados"],
  },
  discipulado_ciclo_asistencia: {
    modules: ["discipulado_primeros_pasos", "discipulado_seguimos_avanzando", "discipulado_siendo_iglesia", "historial_discipulado", "listados"],
  },
  discipulado_asistencia: {
    modules: ["discipulado_primeros_pasos", "discipulado_seguimos_avanzando", "discipulado_siendo_iglesia", "historial_discipulado", "listados", "resumen-pastoral"],
  },
  discipulado_fechas: {
    modules: ["discipulado_primeros_pasos", "discipulado_seguimos_avanzando", "discipulado_siendo_iglesia", "historial_discipulado", "listados", "resumen-pastoral"],
  },
  discipulado_participantes: {
    modules: ["discipulado_primeros_pasos", "discipulado_seguimos_avanzando", "discipulado_siendo_iglesia", "historial_discipulado", "listados", "resumen-pastoral"],
  },

  // === PROYECTO MARIO ===
  proyecto_mario_ciclos: {
    modules: ["proyecto_mario_belleza_integral_sabados", "proyecto_mario_belleza_integral_viernes", "proyecto_mario_manualidades", "proyecto_mario_belleza_cejas", "proyecto_mario_gastronomia", "historial_proyecto_mario", "listados", "resumen-pastoral"],
  },
  proyecto_mario_ciclo_participantes: {
    modules: ["proyecto_mario_belleza_integral_sabados", "proyecto_mario_belleza_integral_viernes", "proyecto_mario_manualidades", "proyecto_mario_belleza_cejas", "proyecto_mario_gastronomia", "historial_proyecto_mario", "listados", "resumen-pastoral"],
  },
  proyecto_mario_ciclo_fechas: {
    modules: ["proyecto_mario_belleza_integral_sabados", "proyecto_mario_belleza_integral_viernes", "proyecto_mario_manualidades", "proyecto_mario_belleza_cejas", "proyecto_mario_gastronomia", "historial_proyecto_mario", "listados", "resumen-pastoral"],
  },
  proyecto_mario_ciclo_asistencia: {
    modules: ["proyecto_mario_belleza_integral_sabados", "proyecto_mario_belleza_integral_viernes", "proyecto_mario_manualidades", "proyecto_mario_belleza_cejas", "proyecto_mario_gastronomia", "historial_proyecto_mario", "listados", "resumen-pastoral"],
  },

  // === MENSAJES Y CITACIONES ===
  mensajes_citaciones: {
    modules: [
      "mensajes-administracion", "mensajes-protocolo", "mensajes-discipulado",
      "mensajes-alabanza", "mensajes-comunicacion", "mensajes-herederos",
      "mensajes-intercesion", "mensajes-mdg", "mensajes-redil",
      "mensajes-hombres", "mensajes-jovenes", "mensajes-pastoral",
      "mensajes-celulas", "mensajes-proyecto-mario",
    ],
  },
  mensajes_citaciones_recibidos: {
    modules: [
      "mensajes-administracion", "mensajes-protocolo", "mensajes-discipulado",
      "mensajes-alabanza", "mensajes-comunicacion", "mensajes-herederos",
      "mensajes-intercesion", "mensajes-mdg", "mensajes-redil",
      "mensajes-hombres", "mensajes-jovenes", "mensajes-pastoral",
      "mensajes-celulas", "mensajes-proyecto-mario",
    ],
  },

  // === REQUERIMIENTOS ===
  requerimientos_bienes_servicios: {
    modules: [
      "requerimientos-admin", "requerimientos-protocolo", "requerimientos-discipulado",
      "requerimientos-mdg", "requerimientos-alabanza", "requerimientos-intercesion",
      "requerimientos-herederos", "requerimientos-redil", "requerimientos-comunicacion",
      "requerimientos-jovenes", "requerimientos-hombres", "requerimientos-pastoral",
      "requerimientos-celulas", "requerimientos-proyecto-mario",
    ],
  },

  // === CUMPLEAÑOS ===
  cumpleanos_enviados: {
    modules: ["cumpleanos-comunicacion", "control_mensual", "resumen-pastoral"],
    requireEditForWrite: false,
  },

  // === MATRIMONIOS PDF ===
  matrimonios_pdf_generados: {
    modules: ["matrimonio"],
    requireEditForWrite: false,
  },

  // === BAUTIZOS PDF ===
  bautizos_pdf_generados: {
    modules: ["bautizo"],
    requireEditForWrite: false,
  },

  // === PAGO DIARIO ===
  pago_diario: {
    modules: ["pago_diario", "ingresos_egresos"],
  },

  // === INVENTARIO (movimientos) ===
  inventory_movements: {
    modules: ["inventario"],
  },

  // === REDIL - AYUDA SOCIAL ===
  casos_redil: {
    modules: ["redil_ayuda_social", "control_mensual", "resumen-pastoral"],
    requireEditForWrite: true,
  },
  solicitudes_redil: {
    modules: ["redil_ayuda_social", "control_mensual", "resumen-pastoral"],
    requireEditForWrite: true,
  },
  visitas_tecnicas: {
    modules: ["redil_ayuda_social", "control_mensual", "resumen-pastoral"],
    requireEditForWrite: true,
  },
  entregas_redil: {
    modules: ["redil_ayuda_social", "control_mensual", "resumen-pastoral"],
    requireEditForWrite: true,
  },

  // === WHATSAPP ===
  whatsapp_messages: {
    modules: ["administracion"],
    requireEditForWrite: false,
  },

  // === EVENTOS (ENCUENTRO) ===
  encuentro_participantes: {
    modules: ["eventos_encuentro"],
    requireEditForWrite: true,
  },
  eventos_tabs: {
    modules: ["eventos_encuentro", "control_mensual", "resumen-pastoral"],
    requireEditForWrite: true,
    requireAdminForDelete: true,
  },
  evento_participantes: {
    modules: ["eventos_encuentro", "control_mensual", "resumen-pastoral"],
    requireEditForWrite: true,
  },

  // === NOTIFICACIONES ===
  service_notifications_log: {
    modules: "any",
    requireEditForWrite: false,
  },

  // === AUDITORÍA (solo lectura + insert, nunca delete/update) ===
  audit_logs: {
    modules: "any",
    requireEditForWrite: false,
    requireAdminForDelete: true, // Efectivamente imposible
  },

  // === PUSH (solo desde API routes con service_key) ===
  push_subscriptions: {
    modules: [], // Nadie accede por esta vía, solo service_key routes
  },
  security_keys: {
    modules: [], // Solo server actions
  },
  user_sessions: {
    modules: [], // Solo server
  },

  // === POS / VENTAS (no accesible desde cliente) ===
  account_types: { modules: [] },
  cash_registers: { modules: [] },
  ingredients: { modules: [] },
  product_ingredients: { modules: [] },
  products: { modules: [] },
  sale_items: { modules: [] },
  sales: { modules: [] },

  // === VISTAS / AUXILIARES ===
  users_2: { modules: [] },
  users_safe: { modules: [] },
}

/**
 * Verifica si un usuario tiene acceso a una tabla según sus módulos permitidos.
 */
export function checkTableAccess(
  table: string,
  userModules: string[],
  operation: "select" | "insert" | "update" | "delete",
  userCanEdit: boolean,
  userCanAdmin: boolean
): { allowed: boolean; reason?: string } {
  const access = TABLE_ACCESS_MAP[table]

  if (!access) {
    return { allowed: false, reason: `Tabla "${table}" no está registrada en el sistema` }
  }

  // Tablas con modules = [] son inaccesibles por esta ruta
  if (Array.isArray(access.modules) && access.modules.length === 0) {
    return { allowed: false, reason: `Tabla "${table}" no es accesible desde el cliente` }
  }

  // "any" = cualquier usuario autenticado puede acceder
  if (access.modules === "any") {
    // Para escritura, verificar si se requiere can_edit
    if (operation !== "select" && access.requireEditForWrite !== false && !userCanEdit) {
      return { allowed: false, reason: "Requiere permiso de edición" }
    }
    if (operation === "delete" && access.requireAdminForDelete && !userCanAdmin) {
      return { allowed: false, reason: "Requiere permiso de administrador para eliminar" }
    }
    return { allowed: true }
  }

  // Verificar que el usuario tenga acceso a al menos uno de los módulos requeridos
  const hasModuleAccess = access.modules.some((m) => userModules.includes(m))
  if (!hasModuleAccess) {
    return { allowed: false, reason: `No tiene acceso a ningún módulo que permita acceder a "${table}"` }
  }

  // Para escritura, verificar can_edit
  if (operation !== "select" && access.requireEditForWrite !== false && !userCanEdit) {
    return { allowed: false, reason: "Requiere permiso de edición" }
  }

  // Para delete, verificar can_admin si es requerido
  if (operation === "delete" && access.requireAdminForDelete && !userCanAdmin) {
    return { allowed: false, reason: "Requiere permiso de administrador para eliminar" }
  }

  return { allowed: true }
}
