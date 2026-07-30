"use client"

import { PermissionsGuard } from "@/lib/permissions-guard"
import { CronogramaServicio } from "@/components/CronogramaServicio"

export default function CronogramaMDGPage() {
  return (
    <PermissionsGuard moduleName="cronograma-mdg">
      {(canEdit, canAdmin, canLeader) => (
        <CronogramaServicio canEdit={canEdit} moduloKey="mdg" moduleName="cronograma-mdg" title="Mujeres de Gracia" canLeader={canLeader} />
      )}
    </PermissionsGuard>
  )
}
