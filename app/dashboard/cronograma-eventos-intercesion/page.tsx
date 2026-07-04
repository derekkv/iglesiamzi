"use client"

import { PermissionsGuard } from "@/lib/permissions-guard"
import { CronogramaEventosGeneral } from "@/components/CronogramaEventosGeneral"

export default function CronogramaEventosIntercesionPage() {
  return (
    <PermissionsGuard moduleName="cronograma-eventos-intercesion">
      {() => <CronogramaEventosGeneral moduloKey="intercesion" title="Intercesión" />}
    </PermissionsGuard>
  )
}
