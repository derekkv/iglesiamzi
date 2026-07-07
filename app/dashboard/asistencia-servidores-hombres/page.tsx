"use client"

import { PermissionsGuard } from "@/lib/permissions-guard"
import { ControlAsistenciaServidores } from "@/components/ControlAsistenciaServidores"

export default function AsistenciaServidoresHombresPage() {
  return (
    <PermissionsGuard moduleName="asistencia-servidores-hombres">
      {(canEdit) => (
        <ControlAsistenciaServidores
          moduloKey="hombres"
          moduleName="cronograma-hombres"
          title="Hombres"
          canEdit={canEdit}
        />
      )}
    </PermissionsGuard>
  )
}
