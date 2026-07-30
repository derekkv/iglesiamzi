"use client"

import { PermissionsGuard } from "@/lib/permissions-guard"
import { ControlAsistenciaServidores } from "@/components/ControlAsistenciaServidores"

export default function AsistenciaServidoresCelulasPage() {
  return (
    <PermissionsGuard moduleName="asistencia-servidores-celulas">
      {(canEdit) => (
        <ControlAsistenciaServidores
          moduloKey="celulas"
          moduleName="cronograma-celulas"
          title="Somos Uno - Células"
          canEdit={canEdit}
        />
      )}
    </PermissionsGuard>
  )
}
