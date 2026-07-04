"use client"

import { PermissionsGuard } from "@/lib/permissions-guard"
import { ControlAsistenciaServidores } from "@/components/ControlAsistenciaServidores"

export default function AsistenciaServidoresIntercesionPage() {
  return (
    <PermissionsGuard moduleName="asistencia-servidores-intercesion">
      {(canEdit) => (
        <ControlAsistenciaServidores
          moduloKey="intercesion"
          moduleName="cronograma-intercesion"
          title="Intercesión"
          canEdit={canEdit}
        />
      )}
    </PermissionsGuard>
  )
}
