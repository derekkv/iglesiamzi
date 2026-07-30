"use client"

import { PermissionsGuard } from "@/lib/permissions-guard"
import { CronogramaEventosGeneral } from "@/components/CronogramaEventosGeneral"

export default function CronogramaEventosDiscipuladoPage() {
  return (
    <PermissionsGuard moduleName="cronograma-eventos-discipulado">
      {() => <CronogramaEventosGeneral moduloKey="discipulado" title="Discipulado" />}
    </PermissionsGuard>
  )
}
