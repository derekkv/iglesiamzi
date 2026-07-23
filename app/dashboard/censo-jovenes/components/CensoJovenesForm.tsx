"use client"

import type React from "react"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus, Trash2 } from "lucide-react"
import { censoJovenesService, type CensoRecord, type ConfiguracionesGlobales } from "@/lib/mod/censo-jovenes-service"

const CELULAS = [
  "Carlos y Ruth", "Sarita y Lady", "Jessy Mendoza", "Líder y Angela",
  "Juan Pablo y Angie", "Alina y Anita", "Neyda y Carmen", "Yadira y Tania",
  "Luis y Ariana", "Layla Salem", "Estuardo y Catalina", "Gabriela López",
]

interface CensoJovenesFormProps {
  formData: CensoRecord
  onChangeFormData: (data: CensoRecord) => void
  onSubmit: (e: React.FormEvent) => void
  onCancel: () => void
  isSaving: boolean
  submitLabel: string
}

export function CensoJovenesForm({
  formData, onChangeFormData, onSubmit, onCancel, isSaving, submitLabel,
}: CensoJovenesFormProps) {
  const [configuraciones, setConfiguraciones] = useState<ConfiguracionesGlobales | null>(null)

  useEffect(() => {
    censoJovenesService.getConfiguraciones().then(setConfiguraciones).catch(console.error)
  }, [])


  // Inicializar fecha_nacimiento_display
  useEffect(() => {
    if (formData.fecha_nacimiento && !(formData as any).fecha_nacimiento_display) {
      const parts = formData.fecha_nacimiento.split("-")
      if (parts.length === 3) onChangeFormData({ ...formData, fecha_nacimiento_display: `${parts[2]}/${parts[1]}/${parts[0]}` } as any)
    }
  }, [formData.fecha_nacimiento])

  // Inicializar fecha_bautizo_display
  useEffect(() => {
    if (formData.fecha_bautizo && !(formData as any).fecha_bautizo_display) {
      const parts = formData.fecha_bautizo.split("-")
      if (parts.length === 3) onChangeFormData({ ...formData, fecha_bautizo_display: `${parts[2]}/${parts[1]}/${parts[0]}` } as any)
    }
  }, [formData.fecha_bautizo])

  const setFormField = (field: keyof CensoRecord, value: any) => {
    const updated = { ...formData, [field]: value }
    // Auto-calcular edad
    if (field === "fecha_nacimiento" && value) {
      const birth = new Date(value + "T12:00:00")
      const today = new Date()
      let age = today.getFullYear() - birth.getFullYear()
      const monthDiff = today.getMonth() - birth.getMonth()
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) age--
      updated.edad = age >= 0 ? age : undefined
    }
    onChangeFormData(updated)
  }

  // Seminarios dinámicos
  const seminarios: string[] = formData.seminarios || []
  const addSeminario = () => setFormField("seminarios", [...seminarios, ""])
  const removeSeminario = (index: number) => setFormField("seminarios", seminarios.filter((_, i) => i !== index))
  const updateSeminario = (index: number, value: string) => { const u = [...seminarios]; u[index] = value; setFormField("seminarios", u) }

  const handleDateInput = (raw: string, field: string, displayField: string) => {
    const updated: any = { ...formData, [displayField]: raw }
    const cleaned = raw.replace(/[/,\-]/g, " ").replace(/\s+/g, " ").trim()
    const parts = cleaned.split(" ")
    if (parts.length === 3) {
      const day = parseInt(parts[0], 10); const month = parseInt(parts[1], 10); const year = parseInt(parts[2], 10)
      if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 1900 && year <= 2100) {
        updated[field] = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
        if (field === "fecha_nacimiento") {
          const birth = new Date(updated[field] + "T12:00:00"); const today = new Date()
          let age = today.getFullYear() - birth.getFullYear()
          const md = today.getMonth() - birth.getMonth()
          if (md < 0 || (md === 0 && today.getDate() < birth.getDate())) age--
          updated.edad = age >= 0 ? age : undefined
        }
      }
    } else if (!raw.trim()) { updated[field] = null; if (field === "fecha_nacimiento") updated.edad = null }
    onChangeFormData(updated)
  }

  const renderCheckbox = (label: string, field: keyof CensoRecord) => (
    <div className="flex items-center space-x-2 py-1">
      <Checkbox id={field as string} checked={(formData[field] as boolean) || false} onCheckedChange={(checked) => setFormField(field, checked as boolean)} />
      <Label htmlFor={field as string} className="cursor-pointer text-sm font-normal text-gray-700">{label}</Label>
    </div>
  )


  return (
    <form onSubmit={onSubmit} className="space-y-8">
      {/* PRIMERA VEZ EN LA IGLESIA */}
      <div className="bg-purple-50 dark:bg-purple-950/20 p-3 sm:p-5 rounded-xl border border-purple-200">
        <h3 className="text-base font-semibold text-purple-800 bg-purple-100 dark:bg-purple-900 px-3 py-2 rounded-lg mb-4">
          Vida Espiritual
        </h3>
        <div className="space-y-3">
          <div className="flex items-center space-x-2 py-1">
            <Checkbox id="nuevo_creyente" checked={formData.nuevo_creyente || false} onCheckedChange={(checked) => setFormField("nuevo_creyente", checked as boolean)} />
            <Label htmlFor="nuevo_creyente" className="cursor-pointer text-sm font-normal text-gray-700">¿Es nuevo creyente?</Label>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label className="text-sm text-gray-700">Sí a Cristo</Label>
              <Select value={(formData as any).si_a_cristo || ""} onValueChange={(v) => setFormField("si_a_cristo", v)}>
                <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                <SelectContent><SelectItem value="SI">Sí</SelectItem><SelectItem value="NO">No</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm text-gray-700">Bautizo</Label>
              <Select value={(formData as any).bautizo || ""} onValueChange={(v) => setFormField("bautizo", v)}>
                <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                <SelectContent><SelectItem value="SI">Sí</SelectItem><SelectItem value="NO">No</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm text-gray-700">¿Es la primera vez que vienes a la iglesia?</Label>
              <Select value={(formData as any).primera_vez_iglesia ? "SI" : (formData as any).primera_vez_iglesia === false ? "NO" : ""} onValueChange={(v) => onChangeFormData({ ...formData, primera_vez_iglesia: v === "SI" } as any)}>
                <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                <SelectContent><SelectItem value="SI">Sí</SelectItem><SelectItem value="NO">No</SelectItem></SelectContent>
              </Select>
            </div>
          </div>
          {(formData as any).primera_vez_iglesia && (
            <div className="ml-4 border-l-2 border-purple-300 pl-4 py-2">
              <Label className="text-sm text-gray-700">¿Cuándo fue tu primera vez?</Label>
              <Input value={(formData as any).fecha_primera_vez_display || ""} onChange={(e) => handleDateInput(e.target.value, "fecha_matrimonio", "fecha_primera_vez_display")} placeholder="dd / mm / aaaa" noUppercase className="max-w-xs mt-1" />
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-8">
        {/* DATOS PERSONALES */}
        <div className="space-y-4 sm:space-y-5 bg-green-50 dark:bg-green-950/20 p-3 sm:p-5 rounded-xl border border-green-200">
          <h3 className="text-base font-semibold text-green-800 bg-green-100 dark:bg-green-900 px-3 py-2 rounded-lg">Datos Personales</h3>
          <div className="space-y-4">
            <div className="space-y-1.5"><Label className="text-sm text-gray-700">Cédula</Label><Input value={formData.cedula || ""} onChange={(e) => setFormField("cedula", e.target.value)} placeholder="Cédula (opcional)" /></div>
            <div className="space-y-1.5"><Label className="text-sm text-gray-700">Nombres y Apellidos *</Label><Input value={formData.apellidos_nombres || ""} onChange={(e) => setFormField("apellidos_nombres", e.target.value)} placeholder="Nombres y Apellidos" /></div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5"><Label className="text-sm text-gray-700">Fecha de Nacimiento</Label><Input value={(formData as any).fecha_nacimiento_display || ""} onChange={(e) => handleDateInput(e.target.value, "fecha_nacimiento", "fecha_nacimiento_display")} placeholder="dd / mm / aaaa" noUppercase /></div>
              <div className="space-y-1.5"><Label className="text-sm text-gray-700">Edad</Label><Input type="number" value={formData.edad ?? ""} readOnly className="bg-gray-50" /></div>
              <div className="space-y-1.5">
                <Label className="text-sm text-gray-700">Género</Label>
                <Select value={(formData as any).sexo || ""} onValueChange={(v) => setFormField("sexo", v)}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                  <SelectContent><SelectItem value="MASCULINO">Masculino</SelectItem><SelectItem value="FEMENINO">Femenino</SelectItem></SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5"><Label className="text-sm text-gray-700">Dirección</Label><Input value={formData.direccion || ""} onChange={(e) => setFormField("direccion", e.target.value)} /></div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5"><Label className="text-sm text-gray-700">Ciudad</Label><Input value={formData.ciudad || ""} onChange={(e) => setFormField("ciudad", e.target.value)} /></div>
              <div className="space-y-1.5"><Label className="text-sm text-gray-700">Parroquia</Label><Input value={formData.parroquia || ""} onChange={(e) => setFormField("parroquia", e.target.value)} /></div>
              <div className="space-y-1.5"><Label className="text-sm text-gray-700">Barrio</Label><Input value={formData.barrio || ""} onChange={(e) => setFormField("barrio", e.target.value)} /></div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5"><Label className="text-sm text-gray-700">Teléfono</Label><Input value={formData.celular || ""} onChange={(e) => setFormField("celular", e.target.value)} placeholder="0999999999" /></div>
              <div className="space-y-1.5"><Label className="text-sm text-gray-700">Correo</Label><Input value={formData.correo || ""} onChange={(e) => setFormField("correo", e.target.value)} placeholder="correo@email.com" noUppercase /></div>
            </div>

            {/* Redes Sociales */}
            <div className="border-t border-green-200 pt-4">
              <p className="text-sm font-medium text-green-700 mb-3">Redes Sociales</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5"><Label className="text-sm text-gray-700">Instagram</Label><Input value={(formData as any).ig || ""} onChange={(e) => onChangeFormData({ ...formData, ig: e.target.value } as any)} placeholder="@usuario" noUppercase /></div>
                <div className="space-y-1.5"><Label className="text-sm text-gray-700">TikTok</Label><Input value={(formData as any).tiktok || ""} onChange={(e) => onChangeFormData({ ...formData, tiktok: e.target.value } as any)} placeholder="@usuario" noUppercase /></div>
                <div className="space-y-1.5"><Label className="text-sm text-gray-700">Facebook</Label><Input value={(formData as any).facebook || ""} onChange={(e) => onChangeFormData({ ...formData, facebook: e.target.value } as any)} placeholder="Nombre o enlace" noUppercase /></div>
              </div>
            </div>
          </div>
        </div>


        {/* DATOS FAMILIARES */}
        <div className="space-y-4 sm:space-y-5 bg-blue-50 dark:bg-blue-950/20 p-3 sm:p-5 rounded-xl border border-blue-200">
          <h3 className="text-base font-semibold text-blue-800 bg-blue-100 dark:bg-blue-900 px-3 py-2 rounded-lg">Datos Familiares</h3>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5"><Label className="text-sm text-gray-700">Nombre del Padre</Label><Input value={(formData as any).familiar_nombre || ""} onChange={(e) => setFormField("familiar_nombre", e.target.value)} /></div>
              <div className="space-y-1.5"><Label className="text-sm text-gray-700">Número del Padre</Label><Input value={formData.convencional || ""} onChange={(e) => setFormField("convencional", e.target.value)} placeholder="0999999999" /></div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5"><Label className="text-sm text-gray-700">Nombre de la Madre</Label><Input value={formData.conyuge || ""} onChange={(e) => setFormField("conyuge", e.target.value)} /></div>
              <div className="space-y-1.5"><Label className="text-sm text-gray-700">Número de la Madre</Label><Input value={formData.cedula_conyugue || ""} onChange={(e) => setFormField("cedula_conyugue", e.target.value)} placeholder="0999999999" /></div>
            </div>
            <div className="space-y-1.5"><Label className="text-sm text-gray-700">¿Con quién vives?</Label><Input value={formData.familiar || ""} onChange={(e) => setFormField("familiar", e.target.value)} placeholder="Padres, abuelos, solo..." /></div>

            <div className="border-t border-blue-200 pt-4">
              <p className="text-sm font-medium text-blue-700 mb-3">Contacto de Emergencia</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5"><Label className="text-sm text-gray-700">Nombre</Label><Input value={formData.lugar_trabajo || ""} onChange={(e) => setFormField("lugar_trabajo", e.target.value)} /></div>
                <div className="space-y-1.5"><Label className="text-sm text-gray-700">Parentesco</Label><Input value={formData.jornada_trabajo || ""} onChange={(e) => setFormField("jornada_trabajo", e.target.value)} placeholder="Madre, tío, amigo..." /></div>
                <div className="space-y-1.5"><Label className="text-sm text-gray-700">Número</Label><Input value={formData.cargo || ""} onChange={(e) => setFormField("cargo", e.target.value)} placeholder="0999999999" /></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ESTUDIOS Y SALUD */}
      <div className="space-y-4 sm:space-y-5 bg-yellow-50 dark:bg-yellow-950/20 p-3 sm:p-5 rounded-xl border border-yellow-200">
        <h3 className="text-base font-semibold text-yellow-800 bg-yellow-100 dark:bg-yellow-900 px-3 py-2 rounded-lg">Estudios y Salud</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-sm text-gray-700">Nivel de Estudio</Label>
            <Select value={formData.nivel_estudio || ""} onValueChange={(v) => setFormField("nivel_estudio", v)}>
              <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="PRIMARIA">Primaria</SelectItem>
                <SelectItem value="SECUNDARIA">Secundaria</SelectItem>
                <SelectItem value="UNIVERSIDAD">Universidad</SelectItem>
                <SelectItem value="NO ESTUDIO">No Estudio</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5"><Label className="text-sm text-gray-700">Curso</Label><Input value={formData.curso || ""} onChange={(e) => setFormField("curso", e.target.value)} /></div>
        </div>
        <div className="space-y-1.5"><Label className="text-sm text-gray-700">Escuela / Colegio</Label><Input value={(formData as any).escuela_colegio || ""} onChange={(e) => onChangeFormData({ ...formData, escuela_colegio: e.target.value } as any)} placeholder="Nombre de la institución educativa" /></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5"><Label className="text-sm text-gray-700">Alergias o Condición Médica</Label><Input value={(formData as any).capacidad_esp || ""} onChange={(e) => setFormField("capacidad_esp", e.target.value)} placeholder="Alergias, condiciones..." /></div>
          <div className="space-y-1.5"><Label className="text-sm text-gray-700">¿Tomas algún medicamento?</Label><Input value={(formData as any).tipo_discapacidad || ""} onChange={(e) => setFormField("tipo_discapacidad", e.target.value)} placeholder="Nombre del medicamento..." /></div>
        </div>
      </div>


      {/* DATOS DE LA IGLESIA */}
      <div className="space-y-4 sm:space-y-5 bg-orange-50 dark:bg-orange-950/20 p-3 sm:p-5 rounded-xl border border-orange-200">
        <h3 className="text-base font-semibold text-orange-800 bg-orange-100 dark:bg-orange-900 px-3 py-2 rounded-lg">Datos de la Iglesia</h3>

        {/* Discipulado */}
        <div>
          <p className="text-sm font-medium text-orange-700 mb-3">Discipulado</p>
          {renderCheckbox("¿Ha hecho discipulado en IRDD?", "discipulado_irdd")}
          {formData.discipulado_irdd && (
            <div className="ml-6 mt-3 space-y-1 border-l-2 border-orange-300 pl-4 py-2 bg-orange-100/50 rounded-r-lg">
              <p className="text-xs text-orange-600 mb-2">¿Qué discipulado hizo?</p>
              <div className="flex items-center space-x-2 py-1">
                <Checkbox id="primeros_pasos" checked={formData.primeros_pasos || false} onCheckedChange={(checked) => {
                  const updated = { ...formData, primeros_pasos: checked as boolean }
                  if (checked || updated.seguimos_avanzando || updated.siendo_iglesia) updated.miembro_activo = true
                  else if (!updated.seguimos_avanzando && !updated.siendo_iglesia) updated.miembro_activo = false
                  onChangeFormData(updated)
                }} />
                <Label htmlFor="primeros_pasos" className="cursor-pointer text-sm font-normal text-gray-700">1: Primeros pasos en la vida cristiana</Label>
              </div>
              <div className="flex items-center space-x-2 py-1">
                <Checkbox id="seguimos_avanzando" checked={formData.seguimos_avanzando || false} onCheckedChange={(checked) => {
                  const updated = { ...formData, seguimos_avanzando: checked as boolean }
                  if (checked || updated.primeros_pasos || updated.siendo_iglesia) updated.miembro_activo = true
                  else if (!updated.primeros_pasos && !updated.siendo_iglesia) updated.miembro_activo = false
                  onChangeFormData(updated)
                }} />
                <Label htmlFor="seguimos_avanzando" className="cursor-pointer text-sm font-normal text-gray-700">2: Seguimos avanzando</Label>
              </div>
              <div className="flex items-center space-x-2 py-1">
                <Checkbox id="siendo_iglesia" checked={formData.siendo_iglesia || false} onCheckedChange={(checked) => {
                  const updated = { ...formData, siendo_iglesia: checked as boolean }
                  if (checked || updated.primeros_pasos || updated.seguimos_avanzando) updated.miembro_activo = true
                  else if (!updated.primeros_pasos && !updated.seguimos_avanzando) updated.miembro_activo = false
                  onChangeFormData(updated)
                }} />
                <Label htmlFor="siendo_iglesia" className="cursor-pointer text-sm font-normal text-gray-700">3: Siendo Iglesia</Label>
              </div>
            </div>
          )}
        </div>

        {/* Bautizo IRDD */}
        <div className="border-t border-orange-200 pt-4">
          <p className="text-sm font-medium text-orange-700 mb-3">Bautizo en IRDD</p>
          {renderCheckbox("¿Se bautizó en la IRDD?", "bautizo_irdd")}
          {formData.bautizo_irdd && (
            <div className="ml-6 mt-3 border-l-2 border-orange-300 pl-4 py-2">
              <Label className="text-sm text-gray-700">Fecha del Bautizo</Label>
              <Input value={(formData as any).fecha_bautizo_display || ""} onChange={(e) => handleDateInput(e.target.value, "fecha_bautizo", "fecha_bautizo_display")} placeholder="dd / mm / aaaa" noUppercase className="max-w-xs mt-1" />
            </div>
          )}
        </div>

        {/* Membresía */}
        <div className="border-t border-orange-200 pt-4">
          <p className="text-sm font-medium text-orange-700 mb-3">Membresía</p>
          {renderCheckbox("Miembro", "miembro")}
          <div className="flex items-center space-x-2 py-1">
            <Checkbox
              id="miembro_activo"
              checked={formData.miembro_activo || false}
              disabled={!!(formData.primeros_pasos || formData.seguimos_avanzando || formData.siendo_iglesia)}
              onCheckedChange={(checked) => setFormField("miembro_activo", checked as boolean)}
            />
            <Label htmlFor="miembro_activo" className="cursor-pointer text-sm font-normal text-gray-700">
              Miembro Activo
              {!!(formData.primeros_pasos || formData.seguimos_avanzando || formData.siendo_iglesia) && (
                <span className="text-[10px] text-green-600 ml-2">(activo por discipulado)</span>
              )}
            </Label>
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
                        <Checkbox id={`min-${m}`} checked={isChecked} onCheckedChange={(checked) => {
                          const current = formData.ministerios_list || (formData.ministerio ? [formData.ministerio] : [])
                          const updated = checked ? [...current, m] : current.filter((x: string) => x !== m)
                          onChangeFormData({ ...formData, ministerios_list: updated, ministerio: updated.join(", ") })
                        }} />
                        <Label htmlFor={`min-${m}`} className="cursor-pointer text-sm font-normal text-gray-700">{m}</Label>
                      </div>
                    )
                  })}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm text-gray-700">Cargo en el ministerio</Label>
                <Select value={formData.cargo_ministerio || ""} onValueChange={(value) => setFormField("cargo_ministerio", value)}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar cargo" /></SelectTrigger>
                  <SelectContent>
                    {configuraciones?.cargos_ministerio?.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
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
                <Input placeholder={`Seminario ${index + 1}`} value={seminario} onChange={(e) => updateSeminario(index, e.target.value)} className="flex-1" />
                <Button type="button" variant="ghost" size="icon" onClick={() => removeSeminario(index)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={addSeminario}><Plus className="h-4 w-4 mr-1" /> Agregar seminario</Button>
          </div>
        </div>

        {/* Proyecto Mario */}
        <div className="border-t border-orange-200 pt-4">
          <p className="text-sm font-medium text-orange-700 mb-3">Proyecto Mario</p>
          {renderCheckbox("¿Participa en Proyecto Mario?", "proyecto_mario")}
          {formData.proyecto_mario && (
            <div className="ml-6 mt-3 border-l-2 border-orange-300 pl-4 py-2 space-y-1.5">
              <Label className="text-sm text-gray-700">Detalle</Label>
              <Textarea value={(formData as any).proyecto_mario_detalle || ""} onChange={(e) => setFormField("proyecto_mario_detalle" as any, e.target.value)} rows={2} />
            </div>
          )}
        </div>

        {/* Célula */}
        <div className="border-t border-orange-200 pt-4">
          <p className="text-sm font-medium text-orange-700 mb-3">Célula</p>
          {renderCheckbox("¿Asiste a una célula?", "celula_asiste")}
          <div className="ml-6 mt-3 border-l-2 border-orange-300 pl-4 py-2">
            <Label className="text-sm text-gray-700">Célula asignada</Label>
            <Select value={formData.celula_nombre || ""} onValueChange={(value) => setFormField("celula_nombre", value)}>
              <SelectTrigger><SelectValue placeholder="Seleccionar célula" /></SelectTrigger>
              <SelectContent>{CELULAS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSaving}>Cancelar</Button>
        <Button type="submit" disabled={isSaving}>{isSaving ? "Guardando..." : submitLabel}</Button>
      </div>
    </form>
  )
}
