"use client"

import { PermissionsGuard } from "@/lib/permissions-guard"
import { ControlAsistenciaServidores } from "@/components/ControlAsistenciaServidores"

export default function AsistenciaServidoresAlabanzaPage() {
  return (
    <PermissionsGuard moduleName="asistencia-servidores-alabanza">
      {(canEdit) => (
        <ControlAsistenciaServidores
          moduloKey="alabanza"
          moduleName="cronograma-alabanza"
          title="Alabanza"
          canEdit={canEdit}
        />
      )}
    </PermissionsGuard>
  )
}
