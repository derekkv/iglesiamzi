"use client"

import { PermissionsGuard } from "@/lib/permissions-guard"
import { CronogramaServicio } from "@/components/CronogramaServicio"

export default function CronogramaHerederosPage() {
  return (
    <PermissionsGuard moduleName="cronograma-herederos">
      {(canEdit) => (
        <CronogramaServicio
          canEdit={canEdit}
          moduloKey="herederos"
          moduleName="cronograma-herederos"
          title="Herederos del Reino"
        />
      )}
    </PermissionsGuard>
  )
}
