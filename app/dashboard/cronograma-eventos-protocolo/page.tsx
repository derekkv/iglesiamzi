"use client"

import { PermissionsGuard } from "@/lib/permissions-guard"
import { CronogramaEventosGeneral } from "@/components/CronogramaEventosGeneral"

export default function CronogramaEventosProtocoloPage() {
  return (
    <PermissionsGuard moduleName="cronograma-eventos-protocolo">
      {() => <CronogramaEventosGeneral moduloKey="protocolo" title="Protocolo" />}
    </PermissionsGuard>
  )
}
