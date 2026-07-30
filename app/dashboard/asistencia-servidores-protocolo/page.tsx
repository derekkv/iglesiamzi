"use client"

import { PermissionsGuard } from "@/lib/permissions-guard"
import { ControlAsistenciaServidores } from "@/components/ControlAsistenciaServidores"

export default function AsistenciaServidoresProtocoloPage() {
  return (
    <PermissionsGuard moduleName="asistencia-servidores-protocolo">
      {(canEdit) => (
        <ControlAsistenciaServidores
          moduloKey="protocolo"
          moduleName="cronograma-protocolo"
          title="Protocolo"
          canEdit={canEdit}
        />
      )}
    </PermissionsGuard>
  )
}
