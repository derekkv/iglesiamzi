"use client"

import { PermissionsGuard } from "@/lib/permissions-guard"
import { CronogramaEventosGeneral } from "@/components/CronogramaEventosGeneral"

export default function CronogramaEventosHerederosPage() {
  return (
    <PermissionsGuard moduleName="cronograma-eventos-herederos">
      {() => <CronogramaEventosGeneral moduloKey="herederos" title="Herederos del Reino" />}
    </PermissionsGuard>
  )
}
