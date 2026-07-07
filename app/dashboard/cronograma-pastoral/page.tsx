"use client"

import { PermissionsGuard } from "@/lib/permissions-guard"
import { CronogramaServicio } from "@/components/CronogramaServicio"

export default function CronogramaPastoralPage() {
  return (
    <PermissionsGuard moduleName="cronograma-pastoral">
      {(canEdit, canAdmin, canLeader) => (
        <CronogramaServicio canEdit={canEdit} moduloKey="pastoral" moduleName="cronograma-pastoral" title="Pastoral" canLeader={canLeader} />
      )}
    </PermissionsGuard>
  )
}
