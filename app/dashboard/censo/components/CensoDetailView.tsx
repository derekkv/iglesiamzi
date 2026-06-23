"use client"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import type { CensoRecord } from "@/lib/mod/censo-service"

interface CensoDetailViewProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  record: CensoRecord | null
}

export function CensoDetailView({ isOpen, onOpenChange, record }: CensoDetailViewProps) {
  if (!record) return null

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Detalles del Registro de Censo</DialogTitle>
          <DialogDescription>Información completa registrada para la persona</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
          {/* DATOS PERSONALES */}
          <div className="space-y-3 bg-green-50/50 dark:bg-green-950/10 p-4 rounded-lg border border-green-100 dark:border-green-900/50">
            <h3 className="text-md font-bold text-green-800 dark:text-green-300 border-b border-green-200 dark:border-green-800 pb-2">
              DATOS PERSONALES
            </h3>
            <div className="space-y-2 text-sm">
              <p><strong>Cédula:</strong> {record.cedula}</p>
              <p><strong>Apellidos y Nombres:</strong> {record.apellidos_nombres}</p>
              <p><strong>Fecha de Nacimiento:</strong> {record.fecha_nacimiento || "-"}</p>
              <p><strong>Edad:</strong> {record.edad || "-"}</p>
              <p><strong>Si a Cristo:</strong> {record.si_a_cristo || "-"}</p>
              <p><strong>Bautizo:</strong> {record.bautizo || "-"}</p>
              <p><strong>Tipo de Sangre:</strong> {record.tipo_sangre || "-"}</p>
              <p><strong>Estado Civil:</strong> {record.estado_civil || "-"}</p>
              <p><strong>Sexo:</strong> {record.sexo || "-"}</p>
              <p><strong>Capacidad Especial:</strong> {record.capacidad_esp || "-"}</p>
              {record.capacidad_esp && record.capacidad_esp !== "Ninguna" && (
                <>
                  <p><strong>Porcentaje:</strong> {record.porcentaje || "-"}%</p>
                  <p><strong>Tipo de Discapacidad:</strong> {record.tipo_discapacidad || "-"}</p>
                </>
              )}
              <p><strong>Celular:</strong> {record.celular || "-"}</p>
              <p><strong>Convencional:</strong> {record.convencional || "-"}</p>
              <p><strong>Contacto Familiar:</strong> {record.familiar || "-"}</p>
              <p><strong>Cónyuge:</strong> {record.conyuge || "-"}</p>
              <p><strong>Correo:</strong> {record.correo || "-"}</p>
              <p><strong>Nivel de Estudio:</strong> {record.nivel_estudio || "-"}</p>
              <p><strong>Curso:</strong> {record.curso || "-"}</p>
              <p><strong>Acumula Décimos:</strong> {record.acumula_decimos || "-"}</p>
              <p><strong>Hoja de Vida:</strong> {record.hoja_vida || "-"}</p>
              <p><strong>Estado:</strong> {record.estado || "-"}</p>
              <p><strong>Fecha Registro SAITE:</strong> {record.fecha_registro_saite || "-"}</p>
              <p><strong>Fecha Registro IESS:</strong> {record.fecha_registro_iess || "-"}</p>
              <p><strong>Dirección:</strong> {record.direccion || "-"}</p>
              <p><strong>Ciudad:</strong> {record.ciudad || "-"}</p>
              <p><strong>Parroquia:</strong> {record.parroquia || "-"}</p>
              <p><strong>Barrio:</strong> {record.barrio || "-"}</p>
            </div>
          </div>

          {/* DATOS IGLESIA */}
          <div className="space-y-3 bg-orange-50/50 dark:bg-orange-950/10 p-4 rounded-lg border border-orange-100 dark:border-orange-900/50">
            <h3 className="text-md font-bold text-orange-800 dark:text-orange-300 border-b border-orange-200 dark:border-orange-800 pb-2">
              DATOS IGLESIA
            </h3>
            <div className="space-y-2 text-sm">
              <p><strong>Jornada de Trabajo:</strong> {record.jornada_trabajo || "-"}</p>
              <p><strong>Cargo:</strong> {record.cargo || "-"}</p>
              <p><strong>Local asignado:</strong> {record.local || "-"}</p>
              <p><strong>Fecha Ingreso:</strong> {record.fecha_ingreso || "-"}</p>
              <p><strong>Fecha Reingreso:</strong> {record.fecha_reingreso || "-"}</p>
              <p><strong>Fecha Salida:</strong> {record.fecha_salida || "-"}</p>
              <p><strong>Días por Mes:</strong> {record.dias_por_mes || "-"}</p>
              <p><strong>Horas Diarias:</strong> {record.horas_diarias || "-"}</p>
              <p><strong>Horas Semanales:</strong> {record.horas_semanal || "-"}</p>
              <p><strong>Sueldo:</strong> {record.sueldo ? `$${record.sueldo.toFixed(2)}` : "-"}</p>
              <p><strong>Pagos:</strong> {record.pagos || "-"}</p>
              <p><strong>Banco:</strong> {record.banco || "-"}</p>
              <p><strong>Número de Cuenta:</strong> {record.numero_cuenta || "-"}</p>
              <p><strong>Intersección Vial:</strong> {record.interseccion || "-"}</p>
              <p><strong>Redil:</strong> {record.redil || "-"}</p>
              <p><strong>Niños a Cargo:</strong> {record.ninos || "-"}</p>
              <p><strong>Observaciones / Otros:</strong> {record.otros || "-"}</p>
            </div>
          </div>
        </div>

        <DialogFooter className="mt-6">
          <Button onClick={() => onOpenChange(false)}>Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
