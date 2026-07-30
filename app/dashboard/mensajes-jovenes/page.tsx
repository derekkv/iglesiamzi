"use client"

import { PermissionsGuard } from "@/lib/permissions-guard"
import { MensajesCitaciones } from "@/components/MensajesCitaciones"

export default function MensajesJovenesPage() {
  return (
    <PermissionsGuard moduleName="mensajes-jovenes">
      {(canEdit) => <MensajesCitaciones moduloKey="jovenes" title="Jóvenes" canEdit={canEdit} />}
    </PermissionsGuard>
  )
}
