"use client"

import { PermissionsGuard } from "@/lib/permissions-guard"
import { CronogramaServicio } from "@/components/CronogramaServicio"

export default function CronogramaRedilPage() {
  return (
    <PermissionsGuard moduleName="cronograma-redil">
      {(canEdit) => (
        <CronogramaServicio
          canEdit={canEdit}
          moduloKey="redil"
          moduleName="cronograma-redil"
          title="Redil"
        />
      )}
    </PermissionsGuard>
  )
}
