"use client"

import { PermissionsGuard } from "@/lib/permissions-guard"
import { ControlAsistenciaServidores } from "@/components/ControlAsistenciaServidores"

export default function AsistenciaServidoresRedilPage() {
  return (
    <PermissionsGuard moduleName="asistencia-servidores-redil">
      {(canEdit) => (
        <ControlAsistenciaServidores
          moduloKey="redil"
          moduleName="cronograma-redil"
          title="Redil"
          canEdit={canEdit}
        />
      )}
    </PermissionsGuard>
  )
}
