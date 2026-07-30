"use client"

import { PermissionsGuard } from "@/lib/permissions-guard"
import { ControlAsistenciaServidores } from "@/components/ControlAsistenciaServidores"

export default function AsistenciaServidoresJovenesPage() {
  return (
    <PermissionsGuard moduleName="asistencia-servidores-jovenes">
      {(canEdit) => (
        <ControlAsistenciaServidores
          moduloKey="jovenes"
          moduleName="cronograma-jovenes"
          title="Jóvenes"
          canEdit={canEdit}
        />
      )}
    </PermissionsGuard>
  )
}
