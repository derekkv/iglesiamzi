"use client"

import { PermissionsGuard } from "@/lib/permissions-guard"
import { CronogramaEventosGeneral } from "@/components/CronogramaEventosGeneral"

export default function CronogramaEventosAdministracionPage() {
  return (
    <PermissionsGuard moduleName="cronograma-eventos-administracion">
      {() => <CronogramaEventosGeneral moduloKey="administracion" title="Administración" />}
    </PermissionsGuard>
  )
}
