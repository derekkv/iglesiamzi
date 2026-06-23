"use client"

import type React from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Settings } from "lucide-react"
import type { CensoRecord, CatalogOption } from "@/lib/mod/censo-service"

interface CensoFormProps {
  formData: CensoRecord
  onChangeFormData: (data: CensoRecord) => void
  allCatalogs: Record<string, CatalogOption[]>
  onManageCatalog: (tipo: string) => void
  onSubmit: (e: React.FormEvent) => void
  onCancel: () => void
  isSaving: boolean
  submitLabel: string
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
}: CensoFormProps) {
  
  const setFormField = (field: keyof CensoRecord, value: any) => {
    onChangeFormData({
      ...formData,
      [field]: value,
    })
  }

  const renderFormField = (
    label: string,
    field: keyof CensoRecord,
    type: "text" | "date" | "number" | "select" | "textarea" = "text",
    selectType?: string,
  ) => {
    if (type === "select" && selectType) {
      return (
        <div className="space-y-2">
          <Label htmlFor={field as string}>{label}</Label>
          <div className="flex gap-2">
            <Select
              value={(formData[field] as string) || ""}
              onValueChange={(value) => setFormField(field, value)}
            >
              <SelectTrigger id={field as string}>
                <SelectValue placeholder={`Seleccionar ${label}`} />
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
        <div className="space-y-2">
          <Label htmlFor={field as string}>{label}</Label>
          <Textarea
            id={field as string}
            value={(formData[field] as string) || ""}
            onChange={(e) => setFormField(field, e.target.value)}
            placeholder={label}
          />
        </div>
      )
    }

    return (
      <div className="space-y-2">
        <Label htmlFor={field as string}>{label}</Label>
        <Input
          id={field as string}
          type={type}
          value={(formData[field] as string) || ""}
          onChange={(e) =>
            setFormField(
              field,
              type === "number" ? Number.parseFloat(e.target.value) || 0 : e.target.value
            )
          }
          placeholder={label}
        />
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* DATOS PERSONALES */}
        <div className="space-y-4 bg-green-50 dark:bg-green-950/20 p-4 rounded-lg">
          <h3 className="text-lg font-semibold bg-green-100 dark:bg-green-900 p-2 rounded">
            DATOS PERSONALES
          </h3>
          {renderFormField("Cédula *", "cedula")}
          {renderFormField("Apellidos y Nombres *", "apellidos_nombres")}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {renderFormField("Fecha de Nacimiento", "fecha_nacimiento", "date")}
            {renderFormField("Edad", "edad", "number")}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {renderFormField("Si a Cristo", "si_a_cristo", "select", "si_a_cristo")}
            {renderFormField("Bautizo", "bautizo", "select", "bautizo")}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {renderFormField("Tipo de Sangre", "tipo_sangre", "select", "tipo_sangre")}
            {renderFormField("Estado Civil", "estado_civil", "select", "estado_civil")}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {renderFormField("Sexo", "sexo", "select", "sexo")}
            {renderFormField("Capacidad Especial", "capacidad_esp", "select", "capacidad_esp")}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {renderFormField("Porcentaje", "porcentaje", "number")}
            {renderFormField("Tipo de Discapacidad", "tipo_discapacidad")}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {renderFormField("Celular", "celular")}
            {renderFormField("Convencional", "convencional")}
            {renderFormField("Familiar", "familiar")}
          </div>
          {renderFormField("Cónyuge", "conyuge")}
          {renderFormField("Correo", "correo")}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {renderFormField("Nivel de Estudio", "nivel_estudio", "select", "nivel_estudio")}
            {renderFormField("Curso", "curso")}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {renderFormField("Acumula Décimos", "acumula_decimos", "select", "acumula_decimos")}
            {renderFormField("Hoja de Vida", "hoja_vida", "select", "hoja_vida")}
          </div>
          {renderFormField("Estado", "estado", "select", "estado")}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {renderFormField("Fecha Registro SAITE", "fecha_registro_saite", "date")}
            {renderFormField("Fecha Registro IESS", "fecha_registro_iess", "date")}
          </div>
          {renderFormField("Dirección", "direccion", "textarea")}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {renderFormField("Ciudad", "ciudad")}
            {renderFormField("Parroquia", "parroquia")}
          </div>
          {renderFormField("Barrio", "barrio")}
        </div>

        {/* DATOS IGLESIA */}
        <div className="space-y-4 bg-orange-50 dark:bg-orange-950/20 p-4 rounded-lg">
          <h3 className="text-lg font-semibold bg-orange-100 dark:bg-orange-900 p-2 rounded">
            DATOS IGLESIA
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {renderFormField("Jornada de Trabajo", "jornada_trabajo", "select", "jornada_trabajo")}
            {renderFormField("Cargo", "cargo", "select", "cargo")}
          </div>
          {renderFormField("Local", "local", "select", "local")}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {renderFormField("Fecha Ingreso", "fecha_ingreso", "date")}
            {renderFormField("Fecha Reingreso", "fecha_reingreso", "date")}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {renderFormField("Fecha Salida", "fecha_salida", "date")}
            {renderFormField("Días por Mes", "dias_por_mes", "number")}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {renderFormField("Horas Diarias", "horas_diarias", "number")}
            {renderFormField("Horas Semanal", "horas_semanal", "number")}
          </div>
          {renderFormField("Sueldo", "sueldo", "number")}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {renderFormField("Pagos", "pagos", "select", "pagos")}
            {renderFormField("Banco", "banco", "select", "banco")}
          </div>
          {renderFormField("# Cuenta", "numero_cuenta")}
          {renderFormField("Intersección", "interseccion", "textarea")}
          {renderFormField("Redil", "redil")}
          {renderFormField("Niños", "ninos", "textarea")}
          {renderFormField("Otros", "otros", "textarea")}
        </div>
      </div>

      <div className="flex justify-end gap-2">
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
