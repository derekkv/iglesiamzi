"use client"

import { PermissionsGuard } from "@/lib/permissions-guard"
import { CronogramaEventosGeneral } from "@/components/CronogramaEventosGeneral"

export default function CronogramaEventosRedilPage() {
  return (
    <PermissionsGuard moduleName="cronograma-eventos-redil">
      {() => <CronogramaEventosGeneral moduloKey="redil" title="Redil" />}
    </PermissionsGuard>
  )
}
