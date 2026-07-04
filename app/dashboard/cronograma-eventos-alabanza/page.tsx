"use client"

import { PermissionsGuard } from "@/lib/permissions-guard"
import { CronogramaEventosGeneral } from "@/components/CronogramaEventosGeneral"

export default function CronogramaEventosAlabanzaPage() {
  return (
    <PermissionsGuard moduleName="cronograma-eventos-alabanza">
      {() => <CronogramaEventosGeneral moduloKey="alabanza" title="Alabanza" />}
    </PermissionsGuard>
  )
}
