"use client"

import { PermissionsGuard } from "@/lib/permissions-guard"
import { CronogramaServicio } from "@/components/CronogramaServicio"

export default function CronogramaMDGPage() {
  return (
    <PermissionsGuard moduleName="cronograma-mdg">
      {(canEdit) => (
        <CronogramaServicio
          canEdit={canEdit}
          moduloKey="mdg"
          moduleName="cronograma-mdg"
          title="Mujeres de Gracia"
        />
      )}
    </PermissionsGuard>
  )
}
