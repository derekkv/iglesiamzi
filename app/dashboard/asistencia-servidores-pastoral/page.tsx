"use client"

import { PermissionsGuard } from "@/lib/permissions-guard"
import { ControlAsistenciaServidores } from "@/components/ControlAsistenciaServidores"

export default function AsistenciaServidoresPastoralPage() {
  return (
    <PermissionsGuard moduleName="asistencia-servidores-pastoral">
      {(canEdit) => (
        <ControlAsistenciaServidores
          moduloKey="pastoral"
          moduleName="cronograma-pastoral"
          title="Pastoral"
          canEdit={canEdit}
        />
      )}
    </PermissionsGuard>
  )
}
