"use client"

import { PermissionsGuard } from "@/lib/permissions-guard"
import { CronogramaServicio } from "@/components/CronogramaServicio"

export default function CronogramaDiscipuladoPage() {
  return (
    <PermissionsGuard moduleName="cronograma-discipulado">
      {(canEdit) => (
        <CronogramaServicio
          canEdit={canEdit}
          moduloKey="discipulado"
          moduleName="cronograma-discipulado"
          title="Discipulado"
        />
      )}
    </PermissionsGuard>
  )
}
