"use client"

import { PermissionsGuard } from "@/lib/permissions-guard"
import { ControlAsistenciaServidores } from "@/components/ControlAsistenciaServidores"

export default function AsistenciaServidoresMdgPage() {
  return (
    <PermissionsGuard moduleName="asistencia-servidores-mdg">
      {(canEdit) => (
        <ControlAsistenciaServidores
          moduloKey="mdg"
          moduleName="cronograma-mdg"
          title="Mujeres de Gracia"
          canEdit={canEdit}
        />
      )}
    </PermissionsGuard>
  )
}
