"use client"

import type React from "react"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Settings, Plus, Trash2 } from "lucide-react"
import { censoService, type CensoRecord, type CatalogOption, type HijoData, type ConfiguracionesGlobales } from "@/lib/mod/censo-service"

const CELULAS = [
  "Carlos y Ruth",
  "Sarita y Lady",
  "Jessy Mendoza",
  "Líder y Angela",
  "Juan Pablo y Angie",
  "Alina y Anita",
  "Neyda y Carmen",
  "Yadira y Tania",
  "Luis y Ariana",
  "Layla Salem",
  "Estuardo y Catalina",
  "Gabriela López",
]

interface CensoFormProps {
  formData: CensoRecord
  onChangeFormData: (data: CensoRecord) => void
  allCatalogs: Record<string, CatalogOption[]>
  onManageCatalog: (tipo: string) => void
  onSubmit: (e: React.FormEvent) => void
  onCancel: () => void
  isSaving: boolean
  submitLabel: string
  showNuevoCreyente?: boolean
}

export function CensoForm({
  formData,
  onChangeFormData,
  allCatalogs,
  onManageCatalog,
  onSubmit,
  onCancel,
  isSaving,
  submitLabel,
  showNuevoCreyente = false,
}: CensoFormProps) {
  const [configuraciones, setConfiguraciones] = useState<ConfiguracionesGlobales | null>(null)

  useEffect(() => {
    censoService.getConfiguraciones().then(setConfiguraciones).catch(console.error)
  }, [])

  // Inicializar fecha_nacimiento_display cuando se carga el form con datos existentes
  useEffect(() => {
    if (formData.fecha_nacimiento && !(formData as any).fecha_nacimiento_display) {
      const parts = formData.fecha_nacimiento.split("-")
      if (parts.length === 3) {
        const display = `${parts[2]}/${parts[1]}/${parts[0]}`
        onChangeFormData({ ...formData, fecha_nacimiento_display: display } as any)
      }
    }
  }, [formData.fecha_nacimiento])

  // Inicializar fecha_bautizo_display
  useEffect(() => {
    if (formData.fecha_bautizo && !(formData as any).fecha_bautizo_display) {
      const parts = formData.fecha_bautizo.split("-")
      if (parts.length === 3) {
        const display = `${parts[2]}/${parts[1]}/${parts[0]}`
        onChangeFormData({ ...formData, fecha_bautizo_display: display } as any)
      }
    }
  }, [formData.fecha_bautizo])

  // Inicializar fecha_matrimonio_display
  useEffect(() => {
    if (formData.fecha_matrimonio && !(formData as any).fecha_matrimonio_display) {
      const parts = formData.fecha_matrimonio.split("-")
      if (parts.length === 3) {
        const display = `${parts[2]}/${parts[1]}/${parts[0]}`
        onChangeFormData({ ...formData, fecha_matrimonio_display: display } as any)
      }
    }
  }, [formData.fecha_matrimonio])

  const setFormField = (field: keyof CensoRecord, value: any) => {
    const updated = { ...formData, [field]: value }

    // Auto-calcular edad desde fecha de nacimiento
    if (field === "fecha_nacimiento" && value) {
      const birth = new Date(value + "T12:00:00")
      const today = new Date()
      let age = today.getFullYear() - birth.getFullYear()
      const monthDiff = today.getMonth() - birth.getMonth()
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
        age--
      }
      updated.edad = age >= 0 ? age : undefined
    }

    // Auto-marcar/desmarcar miembro_activo según discipulados
    if (field === "primeros_pasos" || field === "seguimos_avanzando" || field === "siendo_iglesia") {
      const pp = field === "primeros_pasos" ? value : updated.primeros_pasos
      const sa = field === "seguimos_avanzando" ? value : updated.seguimos_avanzando
      const si = field === "siendo_iglesia" ? value : updated.siendo_iglesia
      updated.miembro_activo = !!(pp || sa || si)
    }

    // Si marca discipulado_irdd = false, limpiar sub-campos y desmarcar miembro_activo
    if (field === "discipulado_irdd" && !value) {
      updated.primeros_pasos = false
      updated.seguimos_avanzando = false
      updated.siendo_iglesia = false
      updated.miembro_activo = false
    }

    onChangeFormData(updated)
  }

  // Manejo de hijos dinámicos
  const hijos: HijoData[] = formData.hijos || []

  const addHijo = () => {
    setFormField("hijos", [...hijos, { nombre: "", edad: "" }])
  }

  const removeHijo = (index: number) => {
    setFormField("hijos", hijos.filter((_, i) => i !== index))
  }

  const updateHijo = (index: number, field: keyof HijoData, value: string) => {
    const updated = [...hijos]
    updated[index] = { ...updated[index], [field]: value }
    setFormField("hijos", updated)
  }

  // Manejo de seminarios dinámicos
  const seminarios: string[] = formData.seminarios || []

  const addSeminario = () => {
    setFormField("seminarios", [...seminarios, ""])
  }

  const removeSeminario = (index: number) => {
    setFormField("seminarios", seminarios.filter((_, i) => i !== index))
  }

  const updateSeminario = (index: number, value: string) => {
    const updated = [...seminarios]
    updated[index] = value
    setFormField("seminarios", updated)
  }

  const renderFormField = (
    label: string,
    field: keyof CensoRecord,
    type: "text" | "date" | "number" | "select" | "textarea" = "text",
    selectType?: string,
  ) => {
    if (type === "select" && selectType) {
      return (
        <div className="space-y-1.5">
          <Label htmlFor={field as string} className="text-sm text-gray-700">{label}</Label>
          <div className="flex gap-2">
            <Select
              value={(formData[field] as string) || ""}
              onValueChange={(value) => setFormField(field, value)}
            >
              <SelectTrigger id={field as string}>
                <SelectValue placeholder={`Seleccionar`} />
              </SelectTrigger>
              <SelectContent>
                {allCatalogs[selectType]?.map((option) => (
                  <SelectItem key={option.id} value={option.valor}>
                    {option.valor}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button type="button" variant="outline" size="icon" onClick={() => onManageCatalog(selectType)}>
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )
    }

    if (type === "textarea") {
      return (
        <div className="space-y-1.5">
          <Label htmlFor={field as string} className="text-sm text-gray-700">{label}</Label>
          <Textarea
            id={field as string}
            value={(formData[field] as string) || ""}
            onChange={(e) => setFormField(field, e.target.value)}
            placeholder={label}
            rows={2}
          />
        </div>
      )
    }

    return (
      <div className="space-y-1.5">
        <Label htmlFor={field as string} className="text-sm text-gray-700">{label}</Label>
        <Input
          id={field as string}
          type={type}
          value={(formData[field] as string) || ""}
          onChange={(e) =>
            setFormField(
              field,
              type === "number" ? (e.target.value === "" ? null : Number.parseFloat(e.target.value)) : e.target.value
            )
          }
          placeholder={label}
        />
      </div>
    )
  }

  const renderCheckbox = (label: string, field: keyof CensoRecord) => (
    <div className="flex items-center space-x-2 py-1">
      <Checkbox
        id={field as string}
        checked={(formData[field] as boolean) || false}
        onCheckedChange={(checked) => setFormField(field, checked as boolean)}
      />
      <Label htmlFor={field as string} className="cursor-pointer text-sm font-normal text-gray-700">{label}</Label>
    </div>
  )

  return (
    <form onSubmit={onSubmit} className="space-y-8">
      {/* Nuevo Creyente - solo para censo MDG */}
      {showNuevoCreyente && (
        <div className="bg-purple-50 dark:bg-purple-950/20 p-3 sm:p-5 rounded-xl border border-purple-200">
          <h3 className="text-base font-semibold text-purple-800 bg-purple-100 dark:bg-purple-900 px-3 py-2 rounded-lg mb-4">
            Estado del Creyente
          </h3>
          <div className="flex items-center space-x-2 py-1">
            <Checkbox
              id="nuevo_creyente"
              checked={formData.nuevo_creyente || false}
              onCheckedChange={(checked) => setFormField("nuevo_creyente", checked as boolean)}
            />
            <Label htmlFor="nuevo_creyente" className="cursor-pointer text-sm font-normal text-gray-700">¿Es nuevo creyente?</Label>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-8">
        {/* DATOS PERSONALES */}
        <div className="space-y-4 sm:space-y-5 bg-green-50 dark:bg-green-950/20 p-3 sm:p-5 rounded-xl border border-green-200">
          <h3 className="text-base font-semibold text-green-800 bg-green-100 dark:bg-green-900 px-3 py-2 rounded-lg">
            Datos Personales
          </h3>

          <div className="space-y-4">
            {renderFormField("Cédula *", "cedula")}
            {renderFormField("Apellidos y Nombres *", "apellidos_nombres")}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="fecha_nacimiento" className="text-sm text-gray-700">Fecha de Nacimiento</Label>
                <Input
                  id="fecha_nacimiento"
                  type="text"
                  value={((formData as any).fecha_nacimiento_display as string) || ""}
                  onChange={(e) => {
                    const raw = e.target.value
                    const updated = { ...formData, fecha_nacimiento_display: raw } as any
                    // Intentar parsear: dd/mm/yyyy, dd-mm-yyyy, dd mm yyyy, dd,mm,yyyy
                    const cleaned = raw.replace(/[/,\-]/g, " ").replace(/\s+/g, " ").trim()
                    const parts = cleaned.split(" ")
                    if (parts.length === 3) {
                      const day = parseInt(parts[0], 10)
                      const month = parseInt(parts[1], 10)
                      const year = parseInt(parts[2], 10)
                      if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 1900 && year <= 2100) {
                        const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
                        updated.fecha_nacimiento = dateStr
                        // Calcular edad
                        const birth = new Date(dateStr + "T12:00:00")
                        const today = new Date()
                        let age = today.getFullYear() - birth.getFullYear()
                        const monthDiff = today.getMonth() - birth.getMonth()
                        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) age--
                        updated.edad = age >= 0 ? age : undefined
                      }
                    }
                    onChangeFormData(updated)
                  }}
                  placeholder="dd / mm / aaaa"
                />
              </div>
              {renderFormField("Edad", "edad", "number")}
            </div>

            {renderFormField("Si a Cristo", "si_a_cristo", "select", "si_a_cristo")}
            {renderFormField("Bautizo", "bautizo", "select", "bautizo")}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {renderFormField("Tipo de Sangre", "tipo_sangre", "select", "tipo_sangre")}
              {renderFormField("Estado Civil", "estado_civil", "select", "estado_civil")}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {renderFormField("Sexo", "sexo", "select", "sexo")}
            </div>

            <div className="space-y-2">
              <div className="flex items-center space-x-2 py-1">
                <Checkbox
                  id="tiene_discapacidad"
                  checked={formData.tiene_discapacidad || false}
                  onCheckedChange={(checked) => {
                    if (!checked) {
                      onChangeFormData({ ...formData, tiene_discapacidad: false, capacidad_esp: undefined, porcentaje: undefined, tipo_discapacidad: undefined })
                    } else {
                      setFormField("tiene_discapacidad", true)
                    }
                  }}
                />
                <Label htmlFor="tiene_discapacidad" className="cursor-pointer text-sm font-normal text-gray-700">¿Tiene discapacidad?</Label>
              </div>
              {formData.tiene_discapacidad && (
                <div className="ml-6 space-y-4 border-l-2 border-green-300 pl-4 py-2">
                  {renderFormField("Tipo de Discapacidad", "capacidad_esp", "select", "capacidad_esp")}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {renderFormField("Porcentaje", "porcentaje", "number")}
                    {renderFormField("Detalle", "tipo_discapacidad")}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Contacto */}
          <div className="border-t border-green-200 pt-4">
            <p className="text-sm font-medium text-green-700 mb-3">Contacto</p>
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {renderFormField("Celular", "celular")}
                {renderFormField("Convencional", "convencional")}
                {renderFormField("Contacto Familiar", "familiar")}
              </div>
              {renderFormField("Nombre del Familiar", "familiar_nombre")}
              {renderFormField("Correo Electrónico", "correo")}
            </div>
          </div>

          {/* Estudios */}
          <div className="border-t border-green-200 pt-4">
            <p className="text-sm font-medium text-green-700 mb-3">Estudios</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {renderFormField("Nivel de Estudio", "nivel_estudio", "select", "nivel_estudio")}
              {renderFormField("Curso/Profesión", "curso")}
            </div>
          </div>

          {/* Dirección */}
          <div className="border-t border-green-200 pt-4">
            <p className="text-sm font-medium text-green-700 mb-3">Dirección</p>
            <div className="space-y-4">
              {renderFormField("Dirección", "direccion", "textarea")}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {renderFormField("Ciudad", "ciudad")}
                {renderFormField("Parroquia", "parroquia")}
                {renderFormField("Barrio", "barrio")}
              </div>
            </div>
          </div>

          {/* Cónyuge */}
          <div className="border-t border-green-200 pt-4">
            <p className="text-sm font-medium text-green-700 mb-3">Cónyuge</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {renderFormField("Nombre del Cónyuge", "conyuge")}
              {renderFormField("Cédula del Cónyuge", "cedula_conyugue")}
            </div>
          </div>

          {/* Hijos */}
          <div className="border-t border-green-200 pt-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium text-green-700">Hijos</p>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="tiene_hijos"
                  checked={formData.tiene_hijos || false}
                  onCheckedChange={(checked) => {
                    const value = checked as boolean
                    onChangeFormData({
                      ...formData,
                      tiene_hijos: value,
                      hijos: value ? formData.hijos : [],
                    })
                  }}
                />
                <Label htmlFor="tiene_hijos" className="cursor-pointer text-sm font-normal">¿Tiene hijos?</Label>
              </div>
            </div>
            {formData.tiene_hijos && (
              <div className="space-y-2">
                {hijos.map((hijo, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Input
                      placeholder="Nombre del hijo"
                      value={hijo.nombre}
                      onChange={(e) => updateHijo(index, "nombre", e.target.value)}
                      className="flex-1"
                    />
                    <Input
                      placeholder="Edad"
                      value={hijo.edad}
                      onChange={(e) => updateHijo(index, "edad", e.target.value)}
                      className="w-20"
                    />
                    <Button type="button" variant="ghost" size="icon" onClick={() => removeHijo(index)} className="shrink-0">
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                ))}
                <Button type="button" variant="outline" size="sm" onClick={addHijo}>
                  <Plus className="h-4 w-4 mr-1" /> Agregar hijo
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* DATOS DE LA IGLESIA */}
        <div className="space-y-4 sm:space-y-5 bg-orange-50 dark:bg-orange-950/20 p-3 sm:p-5 rounded-xl border border-orange-200">
          <h3 className="text-base font-semibold text-orange-800 bg-orange-100 dark:bg-orange-900 px-3 py-2 rounded-lg">
            Datos de la Iglesia
          </h3>

          {/* Trabajo */}
          <div className="space-y-4">
            <p className="text-sm font-medium text-orange-700">Información Laboral</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {renderFormField("Jornada de Trabajo", "jornada_trabajo", "select", "jornada_trabajo")}
              {renderFormField("Cargo (trabajo)", "cargo")}
            </div>
            {renderFormField("Lugar de Trabajo", "lugar_trabajo")}
          </div>

          {/* Discipulado */}
          <div className="border-t border-orange-200 pt-4">
            <p className="text-sm font-medium text-orange-700 mb-3">Discipulado</p>
            {renderCheckbox("¿Ha hecho discipulado en IRDD?", "discipulado_irdd")}
            {formData.discipulado_irdd && (
              <div className="ml-6 mt-3 space-y-1 border-l-2 border-orange-300 pl-4 py-2 bg-orange-100/50 rounded-r-lg">
                <p className="text-xs text-orange-600 mb-2">¿Qué discipulado hizo?</p>
                {renderCheckbox("1: Primeros pasos en la vida cristiana", "primeros_pasos")}
                {renderCheckbox("2: Seguimos avanzando", "seguimos_avanzando")}
                {renderCheckbox("3: Siendo Iglesia", "siendo_iglesia")}
              </div>
            )}
          </div>

          {/* Bautizo IRDD */}
          <div className="border-t border-orange-200 pt-4">
            <p className="text-sm font-medium text-orange-700 mb-3">Bautizo en IRDD</p>
            {renderCheckbox("¿Se bautizó en la IRDD?", "bautizo_irdd")}
            {formData.bautizo_irdd && (
              <div className="ml-6 mt-3 border-l-2 border-orange-300 pl-4 py-2">
                <div className="space-y-1.5">
                  <Label htmlFor="fecha_bautizo" className="text-sm text-gray-700">Fecha del Bautizo</Label>
                  <Input
                    id="fecha_bautizo"
                    type="text"
                    value={((formData as any).fecha_bautizo_display as string) || ""}
                    onChange={(e) => {
                      const raw = e.target.value
                      const updated = { ...formData, fecha_bautizo_display: raw } as any
                      const cleaned = raw.replace(/[/,\-]/g, " ").replace(/\s+/g, " ").trim()
                      const parts = cleaned.split(" ")
                      if (parts.length === 3) {
                        const day = parseInt(parts[0], 10)
                        const month = parseInt(parts[1], 10)
                        const year = parseInt(parts[2], 10)
                        if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 1900 && year <= 2100) {
                          updated.fecha_bautizo = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
                        }
                      }
                      onChangeFormData(updated)
                    }}
                    placeholder="dd / mm / aaaa"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Matrimonio IRDD */}
          <div className="border-t border-orange-200 pt-4">
            <p className="text-sm font-medium text-orange-700 mb-3">Matrimonio en IRDD</p>
            {renderCheckbox("¿Matrimonio en la Iglesia IRDD?", "matrimonio_irdd")}
            {formData.matrimonio_irdd && (
              <div className="ml-6 mt-3 border-l-2 border-orange-300 pl-4 py-2">
                <div className="space-y-1.5">
                  <Label htmlFor="fecha_matrimonio" className="text-sm text-gray-700">Fecha del Matrimonio</Label>
                  <Input
                    id="fecha_matrimonio"
                    type="text"
                    value={((formData as any).fecha_matrimonio_display as string) || ""}
                    onChange={(e) => {
                      const raw = e.target.value
                      const updated = { ...formData, fecha_matrimonio_display: raw } as any
                      const cleaned = raw.replace(/[/,\-]/g, " ").replace(/\s+/g, " ").trim()
                      const parts = cleaned.split(" ")
                      if (parts.length === 3) {
                        const day = parseInt(parts[0], 10)
                        const month = parseInt(parts[1], 10)
                        const year = parseInt(parts[2], 10)
                        if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 1900 && year <= 2100) {
                          updated.fecha_matrimonio = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
                        }
                      }
                      onChangeFormData(updated)
                    }}
                    placeholder="dd / mm / aaaa"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Membresía */}
          <div className="border-t border-orange-200 pt-4">
            <p className="text-sm font-medium text-orange-700 mb-3">Membresía</p>
            <div className="space-y-1">
              {renderCheckbox("Miembro", "miembro")}
              {renderCheckbox("Miembro Activo", "miembro_activo")}
            </div>
          </div>

          {/* Servicio en la iglesia */}
          <div className="border-t border-orange-200 pt-4">
            <p className="text-sm font-medium text-orange-700 mb-3">Servicio en la Iglesia</p>
            {renderCheckbox("¿Sirve a la iglesia?", "sirve_iglesia")}
            {formData.sirve_iglesia && (
              <div className="ml-6 mt-3 space-y-4 border-l-2 border-orange-300 pl-4 py-2">
                <div className="space-y-1.5">
                  <Label className="text-sm text-gray-700">Ministerios</Label>
                  <div className="space-y-2 mt-1">
                    {configuraciones?.ministerios?.map((m) => {
                      const selected = formData.ministerios_list || (formData.ministerio ? [formData.ministerio] : [])
                      const isChecked = selected.includes(m)
                      return (
                        <div key={m} className="flex items-center space-x-2">
                          <Checkbox
                            id={`min-${m}`}
                            checked={isChecked}
                            onCheckedChange={(checked) => {
                              const current = formData.ministerios_list || (formData.ministerio ? [formData.ministerio] : [])
                              const updated = checked
                                ? [...current, m]
                                : current.filter((x: string) => x !== m)
                              onChangeFormData({ ...formData, ministerios_list: updated, ministerio: updated.join(", ") })
                            }}
                          />
                          <Label htmlFor={`min-${m}`} className="cursor-pointer text-sm font-normal text-gray-700">{m}</Label>
                        </div>
                      )
                    })}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm text-gray-700">Cargo en el ministerio</Label>
                  <Select
                    value={formData.cargo_ministerio || ""}
                    onValueChange={(value) => setFormField("cargo_ministerio", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar cargo" />
                    </SelectTrigger>
                    <SelectContent>
                      {configuraciones?.cargos_ministerio?.map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                      <SelectItem value="Anciano">Anciano</SelectItem>
                      <SelectItem value="Pastor/a Vitalicio">Pastor/a Vitalicio</SelectItem>
                      <SelectItem value="Profesionales Externos">Profesionales Externos</SelectItem>
                      <SelectItem value="Pastores Externos">Pastores Externos</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </div>

          {/* Seminarios */}
          <div className="border-t border-orange-200 pt-4">
            <p className="text-sm font-medium text-orange-700 mb-3">Seminarios realizados IRDD</p>
            <div className="space-y-2">
              {seminarios.map((seminario, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Input
                    placeholder={`Seminario ${index + 1}`}
                    value={seminario}
                    onChange={(e) => updateSeminario(index, e.target.value)}
                    className="flex-1"
                  />
                  <Button type="button" variant="ghost" size="icon" onClick={() => removeSeminario(index)} className="shrink-0">
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={addSeminario}>
                <Plus className="h-4 w-4 mr-1" /> Agregar seminario
              </Button>
            </div>
          </div>

          {/* Proyecto Mario */}
          <div className="border-t border-orange-200 pt-4">
            <p className="text-sm font-medium text-orange-700 mb-3">Proyecto Mario</p>
            {renderCheckbox("¿Participa en Proyecto Mario?", "proyecto_mario")}
            {formData.proyecto_mario && (
              <div className="ml-6 mt-3 border-l-2 border-orange-300 pl-4 py-2">
                {renderFormField("Detalle", "proyecto_mario_detalle", "textarea")}
              </div>
            )}
          </div>

          {/* Célula */}
          <div className="border-t border-orange-200 pt-4">
            <p className="text-sm font-medium text-orange-700 mb-3">Célula</p>
            {renderCheckbox("¿Asiste a una célula?", "celula_asiste")}
              <div className="ml-6 mt-3 border-l-2 border-orange-300 pl-4 py-2">
                <Label className="text-sm text-gray-700">Célula asignada</Label>
                <Select
                  value={formData.celula_nombre || ""}
                  onValueChange={(value) => setFormField("celula_nombre", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar célula" />
                  </SelectTrigger>
                  <SelectContent>
                    {CELULAS.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isSaving}
        >
          Limpiar / Cancelar
        </Button>
        <Button type="submit" disabled={isSaving}>
          {isSaving ? "Guardando..." : submitLabel}
        </Button>
      </div>
    </form>
  )
}
