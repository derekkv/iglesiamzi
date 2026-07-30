"use client"

import { PermissionsGuard } from "@/lib/permissions-guard"
import { CronogramaServicio } from "@/components/CronogramaServicio"

export default function CronogramaComunicacionPage() {
  return (
    <PermissionsGuard moduleName="cronograma-comunicacion">
      {(canEdit, canAdmin, canLeader) => (
        <CronogramaServicio canEdit={canEdit} moduloKey="comunicacion" moduleName="cronograma-comunicacion" title="Comunicación" canLeader={canLeader} />
      )}
    </PermissionsGuard>
  )
}
