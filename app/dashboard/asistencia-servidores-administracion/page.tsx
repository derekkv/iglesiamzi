"use client"

import { PermissionsGuard } from "@/lib/permissions-guard"
import { ControlAsistenciaServidores } from "@/components/ControlAsistenciaServidores"

export default function AsistenciaServidoresAdministracionPage() {
  return (
    <PermissionsGuard moduleName="asistencia-servidores-administracion">
      {(canEdit) => (
        <ControlAsistenciaServidores
          moduloKey="administracion"
          moduleName="cronograma-administracion"
          title="Administración"
          canEdit={canEdit}
        />
      )}
    </PermissionsGuard>
  )
}
