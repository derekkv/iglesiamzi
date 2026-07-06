"use client"

import { PermissionsGuard } from "@/lib/permissions-guard"
import { CronogramaEventosGeneral } from "@/components/CronogramaEventosGeneral"

export default function CronogramaEventosComunicacionPage() {
  return (
    <PermissionsGuard moduleName="cronograma-eventos-comunicacion">
      {() => <CronogramaEventosGeneral moduloKey="comunicacion" title="Comunicación" />}
    </PermissionsGuard>
  )
}
