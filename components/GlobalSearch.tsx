"use client"

import { useState, useEffect, useCallback, useRef, useMemo } from "react"
import { useAuth } from "@/contexts/auth-context"
import { getUserPermissions, checkUserEditPermission } from "@/lib/auth"
import { supabase } from "@/lib/secure-db"
import { censoService } from "@/lib/mod/censo-service"
import { censoMdgService } from "@/lib/mod/censo-mdg-service"
import { censoJovenesService } from "@/lib/mod/censo-jovenes-service"
import { censoNinosService } from "@/lib/mod/censo-ninos-service"
import { type AuditInfo } from "@/lib/mod/audit-service"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Search,
  Loader2,
  ArrowLeft,
  User,
  IdCard,
  X,
  Pencil,
  Trash2,
  Save,
  Plus,
  AlertTriangle,
} from "lucide-react"
import { toast } from "sonner"

/**
 * Fuentes de censo. Cada fuente está protegida por su módulo específico:
 * el usuario SOLO puede buscar/editar en el censo cuyo módulo tiene permiso.
 * Ej: con "censo-mdg" pero sin "censo-jovenes", no verá resultados de jóvenes.
 */
interface CensoSource {
  module: string
  table: string
  label: string
  badgeClass: string
  kind: "adulto" | "nino"
  /** Permiso efectivo de edición para este censo (incluye líder de grupo) */
  canEdit?: boolean
}

const CENSO_SOURCES: CensoSource[] = [
  { module: "censo", table: "censo", label: "Censo Protocolo", badgeClass: "bg-blue-100 text-blue-800 border-blue-200", kind: "adulto" },
  { module: "censo-mdg", table: "censo_mdg", label: "Censo MDG", badgeClass: "bg-purple-100 text-purple-800 border-purple-200", kind: "adulto" },
  { module: "censo-jovenes", table: "censo_jovenes", label: "Censo Jóvenes", badgeClass: "bg-orange-100 text-orange-800 border-orange-200", kind: "adulto" },
  { module: "censo-ninos", table: "censo_ninos", label: "Censo Niños", badgeClass: "bg-green-100 text-green-800 border-green-200", kind: "nino" },
]

/** Etiquetas legibles para los campos de los registros. */
const FIELD_LABELS: Record<string, string> = {
  cedula: "Cédula",
  apellidos_nombres: "Apellidos y Nombres",
  fecha_nacimiento: "Fecha de Nacimiento",
  edad: "Edad",
  si_a_cristo: "Sí a Cristo",
  bautizo: "Bautizo",
  tipo_sangre: "Tipo de Sangre",
  estado_civil: "Estado Civil",
  sexo: "Sexo",
  capacidad_esp: "Capacidad Especial",
  tiene_discapacidad: "Tiene Discapacidad",
  porcentaje: "Porcentaje",
  tipo_discapacidad: "Tipo de Discapacidad",
  celular: "Celular",
  convencional: "Convencional",
  familiar: "Familiar",
  familiar_nombre: "Nombre del Familiar",
  conyuge: "Cónyuge",
  cedula_conyugue: "Cédula del Cónyuge",
  correo: "Correo",
  nivel_estudio: "Nivel de Estudio",
  curso: "Curso",
  direccion: "Dirección",
  ciudad: "Ciudad",
  parroquia: "Parroquia",
  barrio: "Barrio",
  tiene_hijos: "Tiene Hijos",
  hijos: "Hijos",
  jornada_trabajo: "Jornada de Trabajo",
  cargo: "Cargo",
  lugar_trabajo: "Lugar de Trabajo",
  discipulado_irdd: "Discipulado IRDD",
  primeros_pasos: "Primeros Pasos",
  seguimos_avanzando: "Seguimos Avanzando",
  siendo_iglesia: "Siendo Iglesia",
  bautizo_irdd: "Bautizo IRDD",
  fecha_bautizo: "Fecha de Bautizo",
  matrimonio_irdd: "Matrimonio IRDD",
  fecha_matrimonio: "Fecha de Matrimonio",
  hora_matrimonio: "Hora de Matrimonio",
  oficio_matrimonio: "Oficio de Matrimonio",
  padrino1_matrimonio: "Padrino 1",
  padrino2_matrimonio: "Padrino 2",
  miembro: "Miembro",
  miembro_activo: "Miembro Activo",
  sirve_iglesia: "Sirve en la Iglesia",
  ministerio: "Ministerio",
  ministerios_list: "Ministerios",
  cargo_ministerio: "Cargo en Ministerio",
  seminarios: "Seminarios",
  proyecto_mario: "Proyecto Mario",
  proyecto_mario_detalle: "Detalle Proyecto Mario",
  celula_asiste: "Asiste a Célula",
  celula_nombre: "Nombre de Célula",
  nuevo_creyente: "Nuevo Creyente",
  nombre: "Nombre",
  grupo: "Grupo",
  nombre_madre: "Nombre de la Madre",
  telefono_madre: "Teléfono de la Madre",
  nombre_padre: "Nombre del Padre",
  telefono_padre: "Teléfono del Padre",
  alergias: "Alergias",
  observaciones: "Observaciones",
}

const HIDDEN_FIELDS = new Set(["id", "created_at", "updated_at"])
const FIELD_ORDER = Object.keys(FIELD_LABELS)

// Tipos de campo para inferir el input correcto en la edición
const BOOLEAN_FIELDS = new Set([
  "tiene_discapacidad", "tiene_hijos", "discipulado_irdd", "primeros_pasos",
  "seguimos_avanzando", "siendo_iglesia", "bautizo_irdd", "matrimonio_irdd",
  "miembro", "miembro_activo", "sirve_iglesia", "proyecto_mario",
  "celula_asiste", "nuevo_creyente",
])
const NUMBER_FIELDS = new Set(["edad", "porcentaje"])
const DATE_FIELDS = new Set(["fecha_nacimiento", "fecha_bautizo", "fecha_matrimonio"])
const TIME_FIELDS = new Set(["hora_matrimonio"])
const TEXTAREA_FIELDS = new Set([
  "direccion", "observaciones", "proyecto_mario_detalle", "alergias",
  "tipo_discapacidad", "lugar_trabajo",
])
const STRING_ARRAY_FIELDS = new Set(["ministerios_list", "seminarios"])
const OBJECT_ARRAY_FIELDS = new Set(["hijos"])

type FieldType =
  | "boolean" | "number" | "date" | "time" | "textarea"
  | "stringArray" | "hijos" | "email" | "text"

function inferType(key: string, value: any): FieldType {
  if (OBJECT_ARRAY_FIELDS.has(key)) return "hijos"
  if (STRING_ARRAY_FIELDS.has(key)) return "stringArray"
  if (Array.isArray(value)) {
    if (value.length > 0 && typeof value[0] === "object" && value[0] !== null) return "hijos"
    return "stringArray"
  }
  if (BOOLEAN_FIELDS.has(key) || typeof value === "boolean") return "boolean"
  if (NUMBER_FIELDS.has(key) || typeof value === "number") return "number"
  if (DATE_FIELDS.has(key)) return "date"
  if (TIME_FIELDS.has(key)) return "time"
  if (key === "correo") return "email"
  if (TEXTAREA_FIELDS.has(key)) return "textarea"
  return "text"
}

interface FieldDescriptor {
  key: string
  label: string
  type: FieldType
  wide: boolean
}

function buildDescriptors(record: Record<string, any>): FieldDescriptor[] {
  const keys = Object.keys(record).filter((k) => !HIDDEN_FIELDS.has(k))
  keys.sort((a, b) => {
    const ia = FIELD_ORDER.indexOf(a)
    const ib = FIELD_ORDER.indexOf(b)
    if (ia === -1 && ib === -1) return a.localeCompare(b)
    if (ia === -1) return 1
    if (ib === -1) return -1
    return ia - ib
  })
  return keys.map((key) => {
    const type = inferType(key, record[key])
    return {
      key,
      label: FIELD_LABELS[key] || key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      type,
      wide: type === "textarea" || type === "hijos" || type === "stringArray",
    }
  })
}

function formatValue(type: FieldType, value: any): string | null {
  if (value === null || value === undefined || value === "") return null
  if (type === "boolean" || typeof value === "boolean") return value ? "Sí" : "No"
  if (Array.isArray(value)) {
    if (value.length === 0) return null
    if (typeof value[0] === "object" && value[0] !== null) {
      return value
        .map((item: any) => {
          const nombre = item?.nombre || ""
          const edad = item?.edad ? ` (${item.edad})` : ""
          return `${nombre}${edad}`.trim()
        })
        .filter(Boolean)
        .join(", ")
    }
    return value.join(", ")
  }
  return String(value)
}

interface PersonResult {
  key: string
  source: CensoSource
  displayName: string
  cedula: string | null
  edad: number | string | null
  extra: string | null
  record: Record<string, any>
}

function makeResult(source: CensoSource, rec: any): PersonResult {
  if (source.kind === "nino") {
    return {
      key: `${source.table}-${rec.id}`,
      source,
      displayName: rec.nombre || "(Sin nombre)",
      cedula: null,
      edad: rec.edad ?? null,
      extra: rec.grupo || null,
      record: rec,
    }
  }
  return {
    key: `${source.table}-${rec.id}`,
    source,
    displayName: rec.apellidos_nombres || "(Sin nombre)",
    cedula: rec.cedula || null,
    edad: rec.edad ?? null,
    extra: rec.celular || null,
    record: rec,
  }
}

interface Hijo { nombre: string; edad: string }

export function GlobalSearch() {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [allowedSources, setAllowedSources] = useState<CensoSource[]>([])
  const [permsLoaded, setPermsLoaded] = useState(false)
  const [query, setQuery] = useState("")
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<PersonResult[]>([])
  const [selected, setSelected] = useState<PersonResult | null>(null)
  const [mode, setMode] = useState<"view" | "edit">("view")
  const [editData, setEditData] = useState<Record<string, any>>({})
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const searchIdRef = useRef(0)

  // Cargar permisos (can_view + can_edit efectivo por censo) al abrir
  useEffect(() => {
    if (!open || !user || permsLoaded) return
    let cancelled = false
    ;(async () => {
      try {
        const perms = await getUserPermissions(user.id)
        const viewable = new Set(
          (perms || []).map((p: any) => p?.module?.name).filter(Boolean),
        )
        const sources = CENSO_SOURCES.filter((s) => viewable.has(s.module))
        // Determinar can_edit efectivo (incluye líder) para cada censo permitido
        const withEdit = await Promise.all(
          sources.map(async (s) => {
            try {
              const perm = await checkUserEditPermission(user.id, s.module)
              return { ...s, canEdit: !!perm.canEdit }
            } catch {
              return { ...s, canEdit: false }
            }
          }),
        )
        if (!cancelled) {
          setAllowedSources(withEdit)
          setPermsLoaded(true)
        }
      } catch (err) {
        console.error("Error cargando permisos de búsqueda:", err)
        if (!cancelled) setPermsLoaded(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open, user, permsLoaded])

  const runSearch = useCallback(
    async (rawQuery: string) => {
      const q = rawQuery.trim()
      if (q.length < 2 || allowedSources.length === 0) {
        setResults([])
        setLoading(false)
        return
      }
      const safe = q.replace(/[,%()]/g, " ").trim()
      if (!safe) {
        setResults([])
        setLoading(false)
        return
      }

      const currentSearch = ++searchIdRef.current
      setLoading(true)

      try {
        const perSource = await Promise.all(
          allowedSources.map(async (source) => {
            try {
              let queryBuilder
              if (source.kind === "nino") {
                queryBuilder = supabase
                  .from(source.table)
                  .select("*")
                  .or(`nombre.ilike.%${safe}%,nombre_madre.ilike.%${safe}%,nombre_padre.ilike.%${safe}%`)
                  .order("nombre", { ascending: true })
                  .limit(25)
              } else {
                queryBuilder = supabase
                  .from(source.table)
                  .select("*")
                  .or(`cedula.ilike.%${safe}%,apellidos_nombres.ilike.%${safe}%`)
                  .order("apellidos_nombres", { ascending: true })
                  .limit(25)
              }
              const { data, error } = await queryBuilder
              if (error) {
                console.warn(`Búsqueda en ${source.table} falló:`, error.message)
                return [] as PersonResult[]
              }
              return (data || []).map((rec: any) => makeResult(source, rec))
            } catch (err: any) {
              console.warn(`Error buscando en ${source.table}:`, err?.message)
              return [] as PersonResult[]
            }
          }),
        )
        if (currentSearch !== searchIdRef.current) return
        setResults(perSource.flat())
      } finally {
        if (currentSearch === searchIdRef.current) setLoading(false)
      }
    },
    [allowedSources],
  )

  useEffect(() => {
    if (!open) return
    const t = setTimeout(() => runSearch(query), 350)
    return () => clearTimeout(t)
  }, [query, open, runSearch])

  const resetDetail = () => {
    setSelected(null)
    setMode("view")
    setEditData({})
    setConfirmDelete(false)
  }

  const handleOpenChange = (v: boolean) => {
    if (!v && (saving || deleting)) return
    setOpen(v)
    if (!v) {
      setQuery("")
      setResults([])
      resetDetail()
      setLoading(false)
    }
  }

  const openDetail = (r: PersonResult) => {
    setSelected(r)
    setMode("view")
    setConfirmDelete(false)
  }

  // ===== EDICIÓN =====
  const descriptors = useMemo(
    () => (selected ? buildDescriptors(selected.record) : []),
    [selected],
  )

  const startEdit = () => {
    if (!selected) return
    const rec = selected.record
    const d: Record<string, any> = {}
    for (const desc of buildDescriptors(rec)) {
      const v = rec[desc.key]
      switch (desc.type) {
        case "boolean":
          d[desc.key] = !!v
          break
        case "stringArray":
          d[desc.key] = Array.isArray(v) ? v.join(", ") : v || ""
          break
        case "hijos":
          d[desc.key] = Array.isArray(v)
            ? v.map((h: any) => ({ nombre: h?.nombre || "", edad: h?.edad != null ? String(h.edad) : "" }))
            : []
          break
        case "number":
          d[desc.key] = v ?? ""
          break
        default:
          d[desc.key] = v ?? ""
      }
    }
    setEditData(d)
    setConfirmDelete(false)
    setMode("edit")
  }

  const setField = (key: string, value: any) => {
    setEditData((prev) => ({ ...prev, [key]: value }))
  }

  const updateHijo = (key: string, index: number, field: keyof Hijo, value: string) => {
    setEditData((prev) => {
      const list: Hijo[] = Array.isArray(prev[key]) ? [...prev[key]] : []
      list[index] = { ...list[index], [field]: value }
      return { ...prev, [key]: list }
    })
  }
  const addHijo = (key: string) => {
    setEditData((prev) => {
      const list: Hijo[] = Array.isArray(prev[key]) ? [...prev[key]] : []
      list.push({ nombre: "", edad: "" })
      return { ...prev, [key]: list }
    })
  }
  const removeHijo = (key: string, index: number) => {
    setEditData((prev) => {
      const list: Hijo[] = Array.isArray(prev[key]) ? [...prev[key]] : []
      list.splice(index, 1)
      return { ...prev, [key]: list }
    })
  }

  const buildPayload = (): Record<string, any> => {
    const payload: Record<string, any> = {}
    for (const desc of descriptors) {
      const v = editData[desc.key]
      switch (desc.type) {
        case "boolean":
          payload[desc.key] = !!v
          break
        case "number":
          payload[desc.key] = v === "" || v === null || v === undefined ? null : Number(v)
          break
        case "stringArray":
          payload[desc.key] = typeof v === "string"
            ? v.split(",").map((t) => t.trim()).filter(Boolean)
            : Array.isArray(v) ? v : []
          break
        case "hijos":
          payload[desc.key] = (Array.isArray(v) ? v : [])
            .filter((h: Hijo) => h.nombre && h.nombre.trim())
            .map((h: Hijo) => ({ nombre: h.nombre.trim(), edad: h.edad }))
          break
        default:
          payload[desc.key] = v
      }
    }
    return payload
  }

  const handleSave = async () => {
    if (!selected || !user) return
    const src = selected.source
    const id = selected.record.id
    const payload = buildPayload()
    const auditAdulto: AuditInfo = { user_id: user.id, user_name: user.displayName }
    const auditNino = { userId: user.id, userName: user.displayName }

    setSaving(true)
    try {
      let updated: any
      if (src.table === "censo") updated = await censoService.update(id, payload, auditAdulto)
      else if (src.table === "censo_mdg") updated = await censoMdgService.update(id, payload, auditAdulto)
      else if (src.table === "censo_jovenes") updated = await censoJovenesService.update(id, payload, auditAdulto)
      else if (src.table === "censo_ninos") updated = await censoNinosService.update(id, payload as any, auditNino)

      const newRecord = { ...selected.record, ...payload, ...(updated || {}) }
      const newResult = makeResult(src, newRecord)
      setSelected(newResult)
      setResults((prev) => prev.map((r) => (r.key === newResult.key ? newResult : r)))
      setMode("view")
      toast.success("Registro actualizado correctamente")
    } catch (err: any) {
      console.error("Error al guardar:", err)
      toast.error(err?.message || "Error al guardar los cambios")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!selected || !user) return
    const src = selected.source
    const id = selected.record.id
    const auditAdulto: AuditInfo = { user_id: user.id, user_name: user.displayName }
    const auditNino = { userId: user.id, userName: user.displayName }

    setDeleting(true)
    try {
      if (src.table === "censo") await censoService.delete(id, auditAdulto)
      else if (src.table === "censo_mdg") await censoMdgService.delete(id, auditAdulto)
      else if (src.table === "censo_jovenes") await censoJovenesService.delete(id, auditAdulto)
      else if (src.table === "censo_ninos") await censoNinosService.delete(id, auditNino)

      const removedKey = selected.key
      setResults((prev) => prev.filter((r) => r.key !== removedKey))
      resetDetail()
      toast.success("Registro eliminado correctamente")
    } catch (err: any) {
      console.error("Error al eliminar:", err)
      toast.error(err?.message || "Error al eliminar el registro")
    } finally {
      setDeleting(false)
    }
  }

  // ===== RENDER =====
  const grouped = allowedSources
    .map((source) => ({ source, items: results.filter((r) => r.source.table === source.table) }))
    .filter((g) => g.items.length > 0)

  const canEditSelected = !!selected?.source.canEdit

  return (
    <>
      <Button
        variant="outline"
        size="icon"
        onClick={() => setOpen(true)}
        title="Buscar personas"
        aria-label="Buscar personas"
        className="h-9 w-9"
      >
        <Search className="h-4 w-4" />
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent
          className="max-w-4xl w-[95vw] p-0 gap-0 overflow-hidden"
          showCloseButton={!selected}
        >
          <DialogHeader className="px-5 pt-4 pb-3 border-b">
            <DialogTitle className="flex items-center gap-2 text-base">
              <Search className="h-4 w-4 text-blue-600" />
              {selected
                ? mode === "edit"
                  ? "Editar persona"
                  : "Detalle de persona"
                : "Búsqueda rápida de personas"}
            </DialogTitle>
          </DialogHeader>

          {selected ? (
            /* ============ DETALLE / EDICIÓN ============ */
            <div className="flex flex-col">
              <div className="flex items-center justify-between gap-2 px-5 py-2.5 border-b bg-gray-50">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => (mode === "edit" ? setMode("view") : resetDetail())}
                  disabled={saving || deleting}
                  className="flex items-center gap-1 text-sm"
                >
                  <ArrowLeft className="h-4 w-4" /> {mode === "edit" ? "Cancelar" : "Volver"}
                </Button>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={selected.source.badgeClass}>
                    {selected.source.label}
                  </Badge>
                  {mode === "view" && canEditSelected && (
                    <>
                      <Button size="sm" variant="outline" onClick={startEdit} className="h-8 gap-1">
                        <Pencil className="h-3.5 w-3.5" /> Editar
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setConfirmDelete(true)}
                        className="h-8 gap-1 text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Eliminar
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {/* Confirmación de eliminación */}
              {confirmDelete && (
                <div className="flex items-center justify-between gap-3 px-5 py-3 bg-red-50 border-b border-red-200">
                  <div className="flex items-center gap-2 text-sm text-red-800">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    <span>¿Eliminar a <strong>{selected.displayName}</strong>? Esta acción no se puede deshacer.</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(false)} disabled={deleting}>
                      Cancelar
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleDelete}
                      disabled={deleting}
                      className="bg-red-600 hover:bg-red-700 text-white gap-1"
                    >
                      {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                      Sí, eliminar
                    </Button>
                  </div>
                </div>
              )}

              <div className="px-5 py-3 border-b">
                <h3 className="text-lg font-semibold text-gray-900">{selected.displayName}</h3>
                {selected.cedula && (
                  <p className="text-sm text-gray-500 flex items-center gap-1">
                    <IdCard className="h-3.5 w-3.5" /> {selected.cedula}
                  </p>
                )}
              </div>

              <ScrollArea className="max-h-[65vh]">
                {mode === "view" ? (
                  /* ---- VISTA: todos los campos del censo ---- */
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-3 px-5 py-4">
                    {descriptors.map((d) => {
                      const val = formatValue(d.type, selected.record[d.key])
                      return (
                        <div key={d.key} className={`min-w-0 ${d.wide ? "sm:col-span-2 lg:col-span-3" : ""}`}>
                          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{d.label}</p>
                          <p className="text-sm text-gray-900 break-words whitespace-pre-wrap">{val ?? "—"}</p>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  /* ---- EDICIÓN: formulario con todos los campos ---- */
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 px-5 py-4">
                    {descriptors.map((d) => {
                      const v = editData[d.key]
                      if (d.type === "boolean") {
                        return (
                          <div key={d.key} className="flex items-center gap-2 self-end pb-1">
                            <Checkbox
                              id={`f-${d.key}`}
                              checked={!!v}
                              onCheckedChange={(c) => setField(d.key, c === true)}
                            />
                            <Label htmlFor={`f-${d.key}`} className="cursor-pointer">{d.label}</Label>
                          </div>
                        )
                      }
                      if (d.type === "hijos") {
                        const list: Hijo[] = Array.isArray(v) ? v : []
                        return (
                          <div key={d.key} className="sm:col-span-2 space-y-2">
                            <Label>{d.label}</Label>
                            <div className="space-y-2">
                              {list.map((h, i) => (
                                <div key={i} className="flex items-center gap-2">
                                  <Input
                                    value={h.nombre}
                                    onChange={(e) => updateHijo(d.key, i, "nombre", e.target.value)}
                                    placeholder="Nombre"
                                    className="flex-1"
                                  />
                                  <Input
                                    value={h.edad}
                                    onChange={(e) => updateHijo(d.key, i, "edad", e.target.value)}
                                    placeholder="Edad"
                                    className="w-24"
                                    noUppercase
                                  />
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => removeHijo(d.key, i)}
                                    className="text-red-500 hover:text-red-700 shrink-0"
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </div>
                              ))}
                              <Button type="button" variant="outline" size="sm" onClick={() => addHijo(d.key)} className="gap-1">
                                <Plus className="h-3.5 w-3.5" /> Agregar hijo
                              </Button>
                            </div>
                          </div>
                        )
                      }
                      if (d.type === "textarea") {
                        return (
                          <div key={d.key} className="sm:col-span-2 space-y-1">
                            <Label htmlFor={`f-${d.key}`}>{d.label}</Label>
                            <Textarea id={`f-${d.key}`} value={v ?? ""} onChange={(e) => setField(d.key, e.target.value)} />
                          </div>
                        )
                      }
                      const inputType =
                        d.type === "number" ? "number"
                        : d.type === "date" ? "date"
                        : d.type === "time" ? "time"
                        : d.type === "email" ? "email"
                        : "text"
                      return (
                        <div key={d.key} className="space-y-1">
                          <Label htmlFor={`f-${d.key}`}>
                            {d.label}
                            {d.type === "stringArray" && (
                              <span className="text-xs text-gray-400 font-normal ml-1">(separar con comas)</span>
                            )}
                          </Label>
                          <Input
                            id={`f-${d.key}`}
                            type={inputType}
                            value={v ?? ""}
                            onChange={(e) => setField(d.key, e.target.value)}
                            noUppercase={d.type === "email" || d.type === "number" || d.type === "date" || d.type === "time"}
                          />
                        </div>
                      )
                    })}
                  </div>
                )}
              </ScrollArea>

              {mode === "edit" && (
                <div className="flex items-center justify-end gap-2 px-5 py-3 border-t bg-gray-50">
                  <Button variant="outline" onClick={() => setMode("view")} disabled={saving}>
                    Cancelar
                  </Button>
                  <Button onClick={handleSave} disabled={saving} className="gap-1">
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Guardar cambios
                  </Button>
                </div>
              )}
            </div>
          ) : (
            /* ============ BÚSQUEDA ============ */
            <div className="flex flex-col">
              <div className="p-5 pb-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Buscar por cédula o nombre..."
                    className="pl-9 pr-9 h-11 text-base"
                    autoFocus
                    noUppercase
                  />
                  {query && (
                    <button
                      type="button"
                      onClick={() => setQuery("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      aria-label="Limpiar"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
                {permsLoaded && allowedSources.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {allowedSources.map((s) => (
                      <Badge key={s.table} variant="outline" className={`${s.badgeClass} text-[10px]`}>
                        {s.label}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              <ScrollArea className="max-h-[60vh] min-h-[160px]">
                <div className="px-3 pb-4">
                  {!permsLoaded ? (
                    <div className="flex justify-center py-12">
                      <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                    </div>
                  ) : allowedSources.length === 0 ? (
                    <p className="text-center text-sm text-gray-500 py-12 px-4">
                      No tienes permisos para buscar en ningún censo.
                    </p>
                  ) : loading ? (
                    <div className="flex justify-center py-12">
                      <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                    </div>
                  ) : query.trim().length < 2 ? (
                    <p className="text-center text-sm text-gray-400 py-12 px-4">
                      Escribe al menos 2 caracteres para buscar.
                    </p>
                  ) : grouped.length === 0 ? (
                    <p className="text-center text-sm text-gray-500 py-12 px-4">
                      No se encontraron personas con "{query.trim()}".
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {grouped.map(({ source, items }) => (
                        <div key={source.table}>
                          <div className="flex items-center gap-2 px-2 py-1 sticky top-0 bg-background z-10">
                            <Badge variant="outline" className={`${source.badgeClass} text-[10px]`}>
                              {source.label}
                            </Badge>
                            <span className="text-xs text-gray-400">
                              {items.length} resultado{items.length !== 1 ? "s" : ""}
                            </span>
                          </div>
                          <div className="space-y-1">
                            {items.map((r) => (
                              <button
                                key={r.key}
                                type="button"
                                onClick={() => openDetail(r)}
                                className="w-full text-left px-3 py-2.5 rounded-md hover:bg-gray-100 transition-colors flex items-center gap-3"
                              >
                                <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                                  <User className="h-4 w-4 text-gray-500" />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-medium text-gray-900 truncate">{r.displayName}</p>
                                  <p className="text-xs text-gray-500 truncate">
                                    {r.cedula ? `CI: ${r.cedula}` : r.extra || ""}
                                    {r.edad !== null && r.edad !== "" ? ` · ${r.edad} años` : ""}
                                  </p>
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
