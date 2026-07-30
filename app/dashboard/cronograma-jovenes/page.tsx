"use client"

import { PermissionsGuard } from "@/lib/permissions-guard"
import { CronogramaServicio } from "@/components/CronogramaServicio"

export default function CronogramaJovenesPage() {
  return (
    <PermissionsGuard moduleName="cronograma-jovenes">
      {(canEdit, canAdmin, canLeader) => (
        <CronogramaServicio canEdit={canEdit} moduloKey="jovenes" moduleName="cronograma-jovenes" title="Jóvenes" canLeader={canLeader} />
      )}
    </PermissionsGuard>
  )
}
