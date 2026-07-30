"use client"

import React, { useEffect, useState } from "react"
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
import { Paperclip, Upload, Download, Trash2, Eye, Loader2, FileText } from "lucide-react"

interface ArchivoBase {
  id: number
  nombre_archivo: string
  url: string
  tipo: string | null
  tamano: number | null
  created_at: string
}

interface AuditEntry {
  timestamp: string
  user_name: string
  action: string
}

interface CensoDetailViewProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  record: CensoRecord | null
  auditModule?: string
  archivos?: ArchivoBase[]
  loadingArchivos?: boolean
  canEdit?: boolean
  onUpload?: () => void
  onDeleteArchivo?: (id: number) => void
  onPreview?: (archivo: ArchivoBase) => void
  onDownload?: (url: string, filename: string) => void
  getFileIcon?: (tipo: string | null) => React.ReactNode
}

export function CensoDetailView({ isOpen, onOpenChange, record, auditModule = "censo", archivos = [], loadingArchivos = false, canEdit = false, onUpload, onDeleteArchivo, onPreview, onDownload, getFileIcon }: CensoDetailViewProps) {
  const [auditInfo, setAuditInfo] = useState<AuditEntry | null>(null)
  const [lastEditInfo, setLastEditInfo] = useState<AuditEntry | null>(null)

  useEffect(() => {
    if (isOpen && record?.id) {
      supabase
        .from("audit_logs")
        .select("timestamp, user_name, action")
        .eq("module", auditModule)
        .eq("action", "crear")
        .ilike("description", `%${record.apellidos_nombres}%`)
        .order("timestamp", { ascending: true })
        .limit(1)
        .then(({ data }) => {
          setAuditInfo(data && data.length > 0 ? data[0] : null)
        })

      supabase
        .from("audit_logs")
        .select("timestamp, user_name, action")
        .eq("module", auditModule)
        .eq("action", "editar")
        .ilike("description", `%${record.apellidos_nombres}%`)
        .order("timestamp", { ascending: false })
        .limit(1)
        .then(({ data }) => {
          setLastEditInfo(data && data.length > 0 ? data[0] : null)
        })
    }
  }, [isOpen, record, auditModule])

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
          {record.nuevo_creyente !== undefined && (
            <div className="col-span-1 md:col-span-2 bg-purple-50/50 dark:bg-purple-950/10 p-4 rounded-lg border border-purple-100 dark:border-purple-900/50">
              <p className="text-sm"><strong>Nuevo Creyente:</strong> {record.nuevo_creyente ? <span className="text-green-600 font-semibold">Sí</span> : <span className="text-gray-500">No</span>}</p>
            </div>
          )}

          <div className="space-y-3 bg-green-50/50 dark:bg-green-950/10 p-4 rounded-lg border border-green-100 dark:border-green-900/50">
            <h3 className="text-md font-bold text-green-800 dark:text-green-300 border-b border-green-200 dark:border-green-800 pb-2">DATOS PERSONALES</h3>
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
              <div className="border-t pt-2 mt-2">
                <p><strong>Cónyuge:</strong> {record.conyuge || "-"}</p>
                <p><strong>Cédula Cónyuge:</strong> {record.cedula_conyugue || "-"}</p>
              </div>
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

          <div className="space-y-3 bg-orange-50/50 dark:bg-orange-950/10 p-4 rounded-lg border border-orange-100 dark:border-orange-900/50">
            <h3 className="text-md font-bold text-orange-800 dark:text-orange-300 border-b border-orange-200 dark:border-orange-800 pb-2">DATOS DE LA IGLESIA</h3>
            <div className="space-y-2 text-sm">
              <p><strong>Jornada de Trabajo:</strong> {record.jornada_trabajo || "-"}</p>
              <p><strong>Cargo:</strong> {record.cargo || "-"}</p>
              <p><strong>Lugar de Trabajo:</strong> {record.lugar_trabajo || "-"}</p>
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
              <div className="border-t pt-2 mt-2">
                <p><strong>¿Bautizo en IRDD?:</strong> {record.bautizo_irdd ? "Sí" : "No"}</p>
                {record.bautizo_irdd && <p className="ml-4"><strong>Fecha:</strong> {record.fecha_bautizo || "-"}</p>}
              </div>
              <div className="border-t pt-2 mt-2">
                <p><strong>¿Matrimonio en IRDD?:</strong> {record.matrimonio_irdd ? "Sí" : "No"}</p>
                {record.matrimonio_irdd && (
                  <div className="ml-4 space-y-1">
                    <p><strong>Fecha:</strong> {record.fecha_matrimonio || "-"}</p>
                    <p><strong>Hora:</strong> {(record as any).hora_matrimonio || "-"}</p>
                    <p><strong>Quién ofició:</strong> {(record as any).oficio_matrimonio || "-"}</p>
                    <p><strong>Padrino 1:</strong> {(record as any).padrino1_matrimonio || "-"}</p>
                    <p><strong>Padrino 2:</strong> {(record as any).padrino2_matrimonio || "-"}</p>
                  </div>
                )}
              </div>
              <div className="border-t pt-2 mt-2">
                <p><strong>Miembro:</strong> {record.miembro ? <Badge className="bg-blue-100 text-blue-800">Sí</Badge> : <Badge variant="secondary">No</Badge>}</p>
                <p><strong>Miembro Activo:</strong> {record.miembro_activo ? <Badge className="bg-green-100 text-green-800">Sí</Badge> : <Badge variant="secondary">No</Badge>}</p>
              </div>
              <div className="border-t pt-2 mt-2">
                <p><strong>¿Sirve a la iglesia?:</strong> {record.sirve_iglesia ? "Sí" : "No"}</p>
                {record.sirve_iglesia && (
                  <div className="ml-4 mt-1">
                    <p><strong>Ministerio(s):</strong> {record.ministerios_list && record.ministerios_list.length > 0 ? record.ministerios_list.join(", ") : record.ministerio || "-"}</p>
                    <p><strong>Cargo:</strong> {record.cargo_ministerio || "-"}</p>
                  </div>
                )}
              </div>
              {seminarios.length > 0 && (
                <div className="border-t pt-2 mt-2">
                  <p><strong>Seminarios realizados:</strong></p>
                  <div className="ml-4 mt-1 space-y-1">{seminarios.map((s, i) => <p key={i} className="text-gray-700">• {s}</p>)}</div>
                </div>
              )}
              <div className="border-t pt-2 mt-2">
                <p><strong>¿Proyecto Mario?:</strong> {record.proyecto_mario ? "Sí" : "No"}</p>
                {record.proyecto_mario && record.proyecto_mario_detalle && <p className="ml-4"><strong>Detalle:</strong> {record.proyecto_mario_detalle}</p>}
              </div>
            </div>
          </div>
        </div>

        {/* ARCHIVOS */}
        <div className="col-span-1 md:col-span-2 space-y-3 bg-gray-50/50 p-4 rounded-lg border border-gray-200 mt-4">
          <div className="flex items-center justify-between">
            <h3 className="text-md font-bold text-gray-800 flex items-center gap-2">
              <Paperclip className="w-4 h-4" /> Archivos
            </h3>
            {canEdit && onUpload && (
              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={onUpload}>
                <Upload className="w-3 h-3 mr-1" /> Subir
              </Button>
            )}
          </div>
          {loadingArchivos ? (
            <div className="flex justify-center py-3"><Loader2 className="w-4 h-4 animate-spin text-gray-400" /></div>
          ) : archivos.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-2">Sin archivos</p>
          ) : (
            <div className="space-y-1.5">
              {archivos.map(archivo => (
                <div key={archivo.id} className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-gray-100">
                  <div className="flex items-center gap-2 min-w-0">
                    {getFileIcon ? getFileIcon(archivo.tipo) : <FileText className="w-4 h-4 text-gray-400" />}
                    <div className="min-w-0">
                      <p className="text-xs text-gray-800 truncate">{archivo.nombre_archivo}</p>
                      <p className="text-[10px] text-gray-400">
                        {archivo.tamano ? `${(archivo.tamano / 1024).toFixed(0)} KB` : ""} · {new Date(archivo.created_at).toLocaleDateString("es-EC")}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {onPreview && (
                      <button onClick={() => onPreview(archivo)} className="text-indigo-600 hover:text-indigo-800 p-1" title="Ver"><Eye className="w-3.5 h-3.5" /></button>
                    )}
                    {onDownload && (
                      <button onClick={() => onDownload(archivo.url, archivo.nombre_archivo)} className="text-blue-600 hover:text-blue-800 p-1" title="Descargar"><Download className="w-3.5 h-3.5" /></button>
                    )}
                    {canEdit && onDeleteArchivo && (
                      <button onClick={() => onDeleteArchivo(archivo.id)} className="text-red-500 hover:text-red-700 p-1" title="Eliminar"><Trash2 className="w-3.5 h-3.5" /></button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter className="mt-6">
          <div className="w-full">
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
