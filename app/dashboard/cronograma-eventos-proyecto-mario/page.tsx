"use client"

import { PermissionsGuard } from "@/lib/permissions-guard"
import { CronogramaEventosGeneral } from "@/components/CronogramaEventosGeneral"

export default function CronogramaEventosProyectoMarioPage() {
  return (
    <PermissionsGuard moduleName="cronograma-eventos-proyecto-mario">
      {() => <CronogramaEventosGeneral moduloKey="proyecto-mario" title="Proyecto Mario" />}
    </PermissionsGuard>
  )
}
