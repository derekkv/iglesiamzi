"use client"

import { PermissionsGuard } from "@/lib/permissions-guard"
import { CronogramaServicio } from "@/components/CronogramaServicio"

export default function CronogramaAlabanzaPage() {
  return (
    <PermissionsGuard moduleName="cronograma-alabanza">
      {(canEdit) => (
        <CronogramaServicio
          canEdit={canEdit}
          moduloKey="alabanza"
          moduleName="cronograma-alabanza"
          title="Alabanza"
        />
      )}
    </PermissionsGuard>
  )
}
