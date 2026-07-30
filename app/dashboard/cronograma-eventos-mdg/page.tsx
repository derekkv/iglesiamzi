"use client"

import { PermissionsGuard } from "@/lib/permissions-guard"
import { CronogramaEventosGeneral } from "@/components/CronogramaEventosGeneral"

export default function CronogramaEventosMdgPage() {
  return (
    <PermissionsGuard moduleName="cronograma-eventos-mdg">
      {() => <CronogramaEventosGeneral moduloKey="mdg" title="Mujeres de Gracia" />}
    </PermissionsGuard>
  )
}
