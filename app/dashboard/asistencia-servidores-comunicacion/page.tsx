"use client"

import { PermissionsGuard } from "@/lib/permissions-guard"
import { ControlAsistenciaServidores } from "@/components/ControlAsistenciaServidores"

export default function AsistenciaServidoresComunicacionPage() {
  return (
    <PermissionsGuard moduleName="asistencia-servidores-comunicacion">
      {(canEdit) => (
        <ControlAsistenciaServidores
          moduloKey="comunicacion"
          moduleName="cronograma-comunicacion"
          title="Comunicación"
          canEdit={canEdit}
        />
      )}
    </PermissionsGuard>
  )
}
