"use client"

import { useEffect, useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import type { CensoRecord } from "@/lib/mod/censo-jovenes-service"
import { supabase } from "@/lib/secure-db"

interface AuditEntry { timestamp: string; user_name: string; action: string }

interface Props {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  record: CensoRecord | null
}

export function CensoJovenesDetailView({ isOpen, onOpenChange, record }: Props) {
  const [auditInfo, setAuditInfo] = useState<AuditEntry | null>(null)
  const [lastEditInfo, setLastEditInfo] = useState<AuditEntry | null>(null)

  useEffect(() => {
    if (isOpen && record?.id) {
      supabase.from("audit_logs").select("timestamp, user_name, action").eq("module", "censo-jovenes").eq("action", "crear").ilike("description", `%${record.apellidos_nombres}%`).order("timestamp", { ascending: true }).limit(1).then(({ data }) => { setAuditInfo(data?.[0] || null) })
      supabase.from("audit_logs").select("timestamp, user_name, action").eq("module", "censo-jovenes").eq("action", "editar").ilike("description", `%${record.apellidos_nombres}%`).order("timestamp", { ascending: false }).limit(1).then(({ data }) => { setLastEditInfo(data?.[0] || null) })
    }
  }, [isOpen, record])

  if (!record) return null
  const r = record as any
  const seminarios: string[] = r.seminarios || []

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-1rem)] sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Detalle del Registro</DialogTitle>
          <DialogDescription>{record.apellidos_nombres}</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">


          {/* VIDA ESPIRITUAL */}
          {r.nuevo_creyente && (
            <div className="col-span-1 md:col-span-2 bg-purple-50/50 p-4 rounded-lg border border-purple-100">
              <p className="text-sm"><strong>Nuevo Creyente:</strong> <span className="text-green-600 font-semibold">Sí</span></p>
            </div>
          )}

          {/* DATOS PERSONALES */}
          <div className="space-y-3 bg-green-50/50 p-4 rounded-lg border border-green-100">
            <h3 className="text-md font-bold text-green-800 border-b border-green-200 pb-2">DATOS PERSONALES</h3>
            <div className="space-y-2 text-sm">
              <p><strong>Cédula:</strong> {record.cedula}</p>
              <p><strong>Nombres y Apellidos:</strong> {record.apellidos_nombres}</p>
              <p><strong>Fecha de Nacimiento:</strong> {record.fecha_nacimiento || "-"}</p>
              <p><strong>Edad:</strong> {record.edad || "-"}</p>
              <p><strong>Género:</strong> {r.sexo || "-"}</p>
              <p><strong>Dirección:</strong> {record.direccion || "-"}</p>
              <p><strong>Ciudad:</strong> {record.ciudad || "-"}</p>
              <p><strong>Parroquia:</strong> {record.parroquia || "-"}</p>
              <p><strong>Barrio:</strong> {record.barrio || "-"}</p>
              <p><strong>Teléfono:</strong> {record.celular || "-"}</p>
              <p><strong>Correo:</strong> {record.correo || "-"}</p>
              <div className="border-t pt-2 mt-2">
                <p className="font-medium text-green-700 mb-1">Redes Sociales</p>
                <p><strong>Instagram:</strong> {r.ig || "-"}</p>
                <p><strong>TikTok:</strong> {r.tiktok || "-"}</p>
                <p><strong>Facebook:</strong> {r.facebook || "-"}</p>
              </div>
            </div>
          </div>

          {/* DATOS FAMILIARES */}
          <div className="space-y-3 bg-blue-50/50 p-4 rounded-lg border border-blue-100">
            <h3 className="text-md font-bold text-blue-800 border-b border-blue-200 pb-2">DATOS FAMILIARES</h3>
            <div className="space-y-2 text-sm">
              <p><strong>Nombre del Padre:</strong> {r.familiar_nombre || "-"}</p>
              <p><strong>Número del Padre:</strong> {r.convencional || "-"}</p>
              <p><strong>Nombre de la Madre:</strong> {r.conyuge || "-"}</p>
              <p><strong>Número de la Madre:</strong> {r.cedula_conyugue || "-"}</p>
              <p><strong>¿Con quién vives?:</strong> {r.familiar || "-"}</p>
              <div className="border-t pt-2 mt-2">
                <p className="font-medium text-blue-700 mb-1">Contacto de Emergencia</p>
                <p><strong>Nombre:</strong> {r.lugar_trabajo || "-"}</p>
                <p><strong>Parentesco:</strong> {r.jornada_trabajo || "-"}</p>
                <p><strong>Número:</strong> {r.cargo || "-"}</p>
              </div>
            </div>
          </div>

          {/* VIDA ESPIRITUAL */}
          <div className="space-y-3 bg-purple-50/50 p-4 rounded-lg border border-purple-100">
            <h3 className="text-md font-bold text-purple-800 border-b border-purple-200 pb-2">VIDA ESPIRITUAL</h3>
            <div className="space-y-2 text-sm">
              <p><strong>Sí a Cristo:</strong> {r.si_a_cristo || "-"}</p>
              <p><strong>Bautizo:</strong> {r.bautizo || "-"}</p>
              <p><strong>Primera vez en la iglesia:</strong> {r.primera_vez_iglesia ? "Sí" : "No"}</p>
              {r.primera_vez_iglesia && r.fecha_matrimonio && <p className="ml-4"><strong>Fecha:</strong> {r.fecha_matrimonio}</p>}
            </div>
          </div>

          {/* ESTUDIOS Y SALUD */}
          <div className="space-y-3 bg-yellow-50/50 p-4 rounded-lg border border-yellow-100">
            <h3 className="text-md font-bold text-yellow-800 border-b border-yellow-200 pb-2">ESTUDIOS Y SALUD</h3>
            <div className="space-y-2 text-sm">
              <p><strong>Nivel de Estudio:</strong> {record.nivel_estudio || "-"}</p>
              <p><strong>Curso:</strong> {record.curso || "-"}</p>
              <p><strong>Alergias / Condición Médica:</strong> {r.capacidad_esp || "-"}</p>
              <p><strong>Medicamento:</strong> {r.tipo_discapacidad || "-"}</p>
            </div>
          </div>


          {/* DATOS DE LA IGLESIA */}
          <div className="col-span-1 md:col-span-2 space-y-3 bg-orange-50/50 p-4 rounded-lg border border-orange-100">
            <h3 className="text-md font-bold text-orange-800 border-b border-orange-200 pb-2">DATOS DE LA IGLESIA</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="space-y-2">
                <p><strong>Discipulado IRDD:</strong> {r.discipulado_irdd ? "Sí" : "No"}</p>
                {r.discipulado_irdd && (
                  <div className="ml-4 space-y-1">
                    <p>• Primeros pasos: {r.primeros_pasos ? <Badge className="bg-green-100 text-green-800">Sí</Badge> : <Badge variant="secondary">No</Badge>}</p>
                    <p>• Seguimos avanzando: {r.seguimos_avanzando ? <Badge className="bg-green-100 text-green-800">Sí</Badge> : <Badge variant="secondary">No</Badge>}</p>
                    <p>• Siendo Iglesia: {r.siendo_iglesia ? <Badge className="bg-green-100 text-green-800">Sí</Badge> : <Badge variant="secondary">No</Badge>}</p>
                  </div>
                )}
                <p><strong>Bautizo en IRDD:</strong> {r.bautizo_irdd ? "Sí" : "No"}</p>
                {r.bautizo_irdd && <p className="ml-4"><strong>Fecha:</strong> {r.fecha_bautizo || "-"}</p>}
                <p><strong>Membresía:</strong> {r.miembro ? "Sí" : "No"} {r.miembro_activo && <Badge className="bg-green-100 text-green-800 ml-1">Activo</Badge>}</p>
              </div>
              <div className="space-y-2">
                <p><strong>Sirve en la iglesia:</strong> {r.sirve_iglesia ? "Sí" : "No"}</p>
                {r.sirve_iglesia && <p className="ml-4"><strong>Ministerio:</strong> {r.ministerio || "-"}</p>}
                {r.sirve_iglesia && r.cargo_ministerio && <p className="ml-4"><strong>Cargo:</strong> {r.cargo_ministerio}</p>}
                {seminarios.length > 0 && (
                  <div>
                    <p><strong>Seminarios:</strong></p>
                    <div className="ml-4">{seminarios.map((s, i) => <p key={i}>• {s}</p>)}</div>
                  </div>
                )}
                <p><strong>Proyecto Mario:</strong> {r.proyecto_mario ? "Sí" : "No"}</p>
                <p><strong>Asiste a célula:</strong> {r.celula_asiste ? "Sí" : "No"}</p>
                {r.celula_asiste && <p className="ml-4"><strong>Célula:</strong> {r.celula_nombre || "-"}</p>}
              </div>
            </div>
          </div>
        </div>

        {/* Auditoría */}
        {(auditInfo || lastEditInfo) && (
          <div className="mt-4 pt-3 border-t text-[11px] text-gray-400 space-y-0.5">
            {auditInfo && <p>Creado por {auditInfo.user_name} el {new Date(auditInfo.timestamp).toLocaleString("es-EC")}</p>}
            {lastEditInfo && <p>Última edición por {lastEditInfo.user_name} el {new Date(lastEditInfo.timestamp).toLocaleString("es-EC")}</p>}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
