"use client"

import { PermissionsGuard } from "@/lib/permissions-guard"
import { ControlAsistenciaServidores } from "@/components/ControlAsistenciaServidores"

export default function AsistenciaServidoresHerederosPage() {
  return (
    <PermissionsGuard moduleName="asistencia-servidores-herederos">
      {(canEdit) => (
        <ControlAsistenciaServidores
          moduloKey="herederos"
          moduleName="cronograma-herederos"
          title="Herederos del Reino"
          canEdit={canEdit}
        />
      )}
    </PermissionsGuard>
  )
}
