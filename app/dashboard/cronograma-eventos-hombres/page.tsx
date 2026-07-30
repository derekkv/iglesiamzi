"use client"

import { PermissionsGuard } from "@/lib/permissions-guard"
import { CronogramaEventosGeneral } from "@/components/CronogramaEventosGeneral"

export default function CronogramaEventosHombresPage() {
  return (
    <PermissionsGuard moduleName="cronograma-eventos-hombres">
      {() => <CronogramaEventosGeneral moduloKey="hombres" title="Hombres" />}
    </PermissionsGuard>
  )
}
