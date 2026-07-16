"use client"

import { PermissionsGuard } from "@/lib/permissions-guard"
import { CronogramaServicio } from "@/components/CronogramaServicio"

export default function CronogramaProyectoMarioPage() {
  return (
    <PermissionsGuard moduleName="cronograma-proyecto-mario">
      {(canEdit, canAdmin, canLeader) => (
        <CronogramaServicio canEdit={canEdit} moduloKey="proyecto-mario" moduleName="cronograma-proyecto-mario" title="Proyecto Mario" canLeader={canLeader} />
      )}
    </PermissionsGuard>
  )
}
