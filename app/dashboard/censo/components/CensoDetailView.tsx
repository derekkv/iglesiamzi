"use client"

import { useEffect, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import type { CensoRecord, HijoData } from "@/lib/mod/censo-service"
import { supabase } from "@/lib/secure-db"

interface AuditEntry {
  timestamp: string
  user_name: string
  action: string
}

interface CensoDetailViewProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  record: CensoRecord | null
}

export function CensoDetailView({ isOpen, onOpenChange, record }: CensoDetailViewProps) {
  const [auditInfo, setAuditInfo] = useState<AuditEntry | null>(null)
  const [lastEditInfo, setLastEditInfo] = useState<AuditEntry | null>(null)

  useEffect(() => {
    if (isOpen && record?.id) {
      // Log de creación
      supabase
        .from("audit_logs")
        .select("timestamp, user_name, action")
        .eq("module", "censo")
        .eq("action", "crear")
        .ilike("description", `%${record.apellidos_nombres}%`)
        .order("timestamp", { ascending: true })
        .limit(1)
        .then(({ data }) => {
          setAuditInfo(data && data.length > 0 ? data[0] : null)
        })

      // Último log de edición
      supabase
        .from("audit_logs")
        .select("timestamp, user_name, action")
        .eq("module", "censo")
        .eq("action", "editar")
        .ilike("description", `%${record.apellidos_nombres}%`)
        .order("timestamp", { ascending: false })
        .limit(1)
        .then(({ data }) => {
          setLastEditInfo(data && data.length > 0 ? data[0] : null)
        })
    }
  }, [isOpen, record])

  if (!record) return null

  const hijos: HijoData[] = (record.hijos as HijoData[]) || []
  const seminarios: string[] = (record.seminarios as string[]) || []

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-1rem)] sm:max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Detalles del Registro de Censo</DialogTitle>
          <DialogDescription>Información completa registrada para la persona</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
          {/* NUEVO CREYENTE - mostrar si el campo existe */}
          {record.nuevo_creyente !== undefined && (
            <div className="col-span-1 md:col-span-2 bg-purple-50/50 dark:bg-purple-950/10 p-4 rounded-lg border border-purple-100 dark:border-purple-900/50">
              <p className="text-sm"><strong>Nuevo Creyente:</strong> {record.nuevo_creyente ? <span className="text-green-600 font-semibold">Sí</span> : <span className="text-gray-500">No</span>}</p>
            </div>
          )}

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
              <p><strong>Correo:</strong> {record.correo || "-"}</p>
              <p><strong>Nivel de Estudio:</strong> {record.nivel_estudio || "-"}</p>
              <p><strong>Curso/Profesión:</strong> {record.curso || "-"}</p>
              <p><strong>Dirección:</strong> {record.direccion || "-"}</p>
              <p><strong>Ciudad:</strong> {record.ciudad || "-"}</p>
              <p><strong>Parroquia:</strong> {record.parroquia || "-"}</p>
              <p><strong>Barrio:</strong> {record.barrio || "-"}</p>

              {/* Cónyuge */}
              <div className="border-t pt-2 mt-2">
                <p><strong>Cónyuge:</strong> {record.conyuge || "-"}</p>
                <p><strong>Cédula Cónyuge:</strong> {record.cedula_conyugue || "-"}</p>
              </div>

              {/* Hijos */}
              <div className="border-t pt-2 mt-2">
                <p><strong>¿Tiene hijos?:</strong> {record.tiene_hijos ? "Sí" : "No"}</p>
                {hijos.length > 0 && (
                  <div className="ml-4 mt-1 space-y-1">
                    {hijos.map((hijo, i) => (
                      <p key={i} className="text-gray-700">• {hijo.nombre} - {hijo.edad} años</p>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* DATOS IGLESIA */}
          <div className="space-y-3 bg-orange-50/50 dark:bg-orange-950/10 p-4 rounded-lg border border-orange-100 dark:border-orange-900/50">
            <h3 className="text-md font-bold text-orange-800 dark:text-orange-300 border-b border-orange-200 dark:border-orange-800 pb-2">
              DATOS DE LA IGLESIA
            </h3>
            <div className="space-y-2 text-sm">
              <p><strong>Jornada de Trabajo:</strong> {record.jornada_trabajo || "-"}</p>
              <p><strong>Cargo:</strong> {record.cargo || "-"}</p>
              <p><strong>Lugar de Trabajo:</strong> {record.lugar_trabajo || "-"}</p>

              {/* Discipulado */}
              <div className="border-t pt-2 mt-2">
                <p><strong>¿Discipulado en IRDD?:</strong> {record.discipulado_irdd ? "Sí" : "No"}</p>
                {record.discipulado_irdd && (
                  <div className="ml-4 mt-1 space-y-1">
                    <p>• Primeros pasos: {record.primeros_pasos ? <Badge className="bg-green-100 text-green-800">Sí</Badge> : <Badge variant="secondary">No</Badge>}</p>
                    <p>• Seguimos avanzando: {record.seguimos_avanzando ? <Badge className="bg-green-100 text-green-800">Sí</Badge> : <Badge variant="secondary">No</Badge>}</p>
                    <p>• Siendo Iglesia: {record.siendo_iglesia ? <Badge className="bg-green-100 text-green-800">Sí</Badge> : <Badge variant="secondary">No</Badge>}</p>
                  </div>
                )}
              </div>

              {/* Bautizo */}
              <div className="border-t pt-2 mt-2">
                <p><strong>¿Bautizo en IRDD?:</strong> {record.bautizo_irdd ? "Sí" : "No"}</p>
                {record.bautizo_irdd && (
                  <p className="ml-4"><strong>Fecha:</strong> {record.fecha_bautizo || "-"}</p>
                )}
              </div>

              {/* Matrimonio */}
              <div className="border-t pt-2 mt-2">
                <p><strong>¿Matrimonio en IRDD?:</strong> {record.matrimonio_irdd ? "Sí" : "No"}</p>
                {record.matrimonio_irdd && (
                  <p className="ml-4"><strong>Fecha:</strong> {record.fecha_matrimonio || "-"}</p>
                )}
              </div>

              {/* Membresía */}
              <div className="border-t pt-2 mt-2">
                <p><strong>Miembro:</strong> {record.miembro ? <Badge className="bg-blue-100 text-blue-800">Sí</Badge> : <Badge variant="secondary">No</Badge>}</p>
                <p><strong>Miembro Activo:</strong> {record.miembro_activo ? <Badge className="bg-green-100 text-green-800">Sí</Badge> : <Badge variant="secondary">No</Badge>}</p>
              </div>

              {/* Servicio */}
              <div className="border-t pt-2 mt-2">
                <p><strong>¿Sirve a la iglesia?:</strong> {record.sirve_iglesia ? "Sí" : "No"}</p>
                {record.sirve_iglesia && (
                  <div className="ml-4 mt-1">
                    <p><strong>Ministerio(s):</strong> {record.ministerios_list && record.ministerios_list.length > 0 ? record.ministerios_list.join(", ") : record.ministerio || "-"}</p>
                    <p><strong>Cargo:</strong> {record.cargo_ministerio || "-"}</p>
                  </div>
                )}
              </div>

              {/* Seminarios */}
              {seminarios.length > 0 && (
                <div className="border-t pt-2 mt-2">
                  <p><strong>Seminarios realizados:</strong></p>
                  <div className="ml-4 mt-1 space-y-1">
                    {seminarios.map((s, i) => (
                      <p key={i} className="text-gray-700">• {s}</p>
                    ))}
                  </div>
                </div>
              )}

              {/* Proyecto Mario */}
              <div className="border-t pt-2 mt-2">
                <p><strong>¿Proyecto Mario?:</strong> {record.proyecto_mario ? "Sí" : "No"}</p>
                {record.proyecto_mario && record.proyecto_mario_detalle && (
                  <p className="ml-4"><strong>Detalle:</strong> {record.proyecto_mario_detalle}</p>
                )}
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="mt-6">
          <div className="w-full">
            {/* Info de registro */}
            {(record.created_at || auditInfo) && (
              <div className="mb-4 p-3 bg-gray-50 rounded-lg border border-gray-200 text-sm text-gray-600">
                {auditInfo && (
                  <>
                    <p><strong>Creado por:</strong> {auditInfo.user_name}</p>
                    <p><strong>Fecha de creación:</strong> {new Date(auditInfo.timestamp).toLocaleDateString("es-EC", { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
                  </>
                )}
                {!auditInfo && record.created_at && (
                  <p><strong>Registrado:</strong> {new Date(record.created_at).toLocaleDateString("es-EC", { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
                )}
                {lastEditInfo && (
                  <>
                    <p><strong>Última edición por:</strong> {lastEditInfo.user_name}</p>
                    <p><strong>Fecha de edición:</strong> {new Date(lastEditInfo.timestamp).toLocaleDateString("es-EC", { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
                  </>
                )}
              </div>
            )}
            <div className="flex justify-end">
              <Button onClick={() => onOpenChange(false)}>Cerrar</Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
