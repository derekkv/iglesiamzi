"use client"

import { PermissionsGuard } from "@/lib/permissions-guard"
import { ControlAsistenciaServidores } from "@/components/ControlAsistenciaServidores"

export default function AsistenciaServidoresProyectoMarioPage() {
  return (
    <PermissionsGuard moduleName="asistencia-servidores-proyecto-mario">
      {(canEdit) => (
        <ControlAsistenciaServidores
          moduloKey="proyecto-mario"
          moduleName="cronograma-proyecto-mario"
          title="Proyecto Mario"
          canEdit={canEdit}
        />
      )}
    </PermissionsGuard>
  )
}
