"use client"

import { PermissionsGuard } from "@/lib/permissions-guard"
import { CronogramaServicio } from "@/components/CronogramaServicio"

export default function CronogramaAdministracionPage() {
  return (
    <PermissionsGuard moduleName="cronograma-administracion">
      {(canEdit) => (
        <CronogramaServicio
          canEdit={canEdit}
          moduloKey="administracion"
          moduleName="cronograma-administracion"
          title="Administración"
        />
      )}
    </PermissionsGuard>
  )
}
