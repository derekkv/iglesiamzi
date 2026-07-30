"use client"

import { PermissionsGuard } from "@/lib/permissions-guard"
import { MensajesCitaciones } from "@/components/MensajesCitaciones"

export default function MensajesRedilPage() {
  return (
    <PermissionsGuard moduleName="mensajes-redil">
      {(canEdit) => <MensajesCitaciones moduloKey="redil" title="Redil" canEdit={canEdit} />}
    </PermissionsGuard>
  )
}
