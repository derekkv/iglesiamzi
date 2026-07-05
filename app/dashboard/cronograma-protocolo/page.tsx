"use client"

import { PermissionsGuard } from "@/lib/permissions-guard"
import { CronogramaServicio } from "@/components/CronogramaServicio"

export default function CronogramaProtocoloPage() {
  return (
    <PermissionsGuard moduleName="cronograma-protocolo">
      {(canEdit, canAdmin, canLeader) => (
        <CronogramaServicio
          canEdit={canEdit}
          moduloKey="protocolo"
          moduleName="cronograma-protocolo"
          title="Protocolo"
          canLeader={canLeader}
        />
      )}
    </PermissionsGuard>
  )
}
