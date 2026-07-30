"use client"

import { PermissionsGuard } from "@/lib/permissions-guard"
import { ControlAsistenciaServidores } from "@/components/ControlAsistenciaServidores"

export default function AsistenciaServidoresDiscipuladoPage() {
  return (
    <PermissionsGuard moduleName="asistencia-servidores-discipulado">
      {(canEdit) => (
        <ControlAsistenciaServidores
          moduloKey="discipulado"
          moduleName="cronograma-discipulado"
          title="Discipulado"
          canEdit={canEdit}
        />
      )}
    </PermissionsGuard>
  )
}
