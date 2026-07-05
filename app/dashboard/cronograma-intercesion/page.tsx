"use client"

import { PermissionsGuard } from "@/lib/permissions-guard"
import { CronogramaServicio } from "@/components/CronogramaServicio"

export default function CronogramaIntercesionPage() {
  return (
    <PermissionsGuard moduleName="cronograma-intercesion">
      {(canEdit, canAdmin, canLeader) => (
        <CronogramaServicio canEdit={canEdit} moduloKey="intercesion" moduleName="cronograma-intercesion" title="Intercesión" canLeader={canLeader} />
      )}
    </PermissionsGuard>
  )
}
