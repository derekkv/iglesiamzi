"use client"

import { PermissionsGuard } from "@/lib/permissions-guard"
import { CronogramaEventosGeneral } from "@/components/CronogramaEventosGeneral"

export default function CronogramaEventosJovenesPage() {
  return (
    <PermissionsGuard moduleName="cronograma-eventos-jovenes">
      {() => <CronogramaEventosGeneral moduloKey="jovenes" title="Jóvenes" />}
    </PermissionsGuard>
  )
}
