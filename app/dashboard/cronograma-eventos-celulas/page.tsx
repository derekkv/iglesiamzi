"use client"

import { PermissionsGuard } from "@/lib/permissions-guard"
import { CronogramaEventosGeneral } from "@/components/CronogramaEventosGeneral"

export default function CronogramaEventosCelulasPage() {
  return (
    <PermissionsGuard moduleName="cronograma-eventos-celulas">
      {() => <CronogramaEventosGeneral moduloKey="celulas" title="Somos Uno - Células" />}
    </PermissionsGuard>
  )
}
