"use client"

import { PermissionsGuard } from "@/lib/permissions-guard"
import { CronogramaServicio } from "@/components/CronogramaServicio"

export default function CronogramaHombresPage() {
  return (
    <PermissionsGuard moduleName="cronograma-hombres">
      {(canEdit, canAdmin, canLeader) => (
        <CronogramaServicio canEdit={canEdit} moduloKey="hombres" moduleName="cronograma-hombres" title="Hombres" canLeader={canLeader} />
      )}
    </PermissionsGuard>
  )
}
