"use client"

import { PermissionsGuard } from "@/lib/permissions-guard"
import { CronogramaServicio } from "@/components/CronogramaServicio"

export default function CronogramaCelulasPage() {
  return (
    <PermissionsGuard moduleName="cronograma-celulas">
      {(canEdit, canAdmin, canLeader) => (
        <CronogramaServicio
          canEdit={canEdit}
          moduloKey="celulas"
          moduleName="cronograma-celulas"
          title="Somos Uno - Células"
          canLeader={canLeader}
        />
      )}
    </PermissionsGuard>
  )
}
