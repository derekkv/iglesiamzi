"use client"

import { PermissionsGuard } from "@/lib/permissions-guard"
import { CronogramaEventosGeneral } from "@/components/CronogramaEventosGeneral"

export default function CronogramaEventosPastoralPage() {
  return (
    <PermissionsGuard moduleName="cronograma-eventos-pastoral">
      {() => <CronogramaEventosGeneral moduloKey="pastoral" title="Pastoral" />}
    </PermissionsGuard>
  )
}
