"use client"

import { PermissionsGuard } from "@/lib/permissions-guard"
import { MensajesCitaciones } from "@/components/MensajesCitaciones"

export default function MensajesHombresPage() {
  return (
    <PermissionsGuard moduleName="mensajes-hombres">
      {(canEdit) => <MensajesCitaciones moduloKey="hombres" title="Hombres" canEdit={canEdit} />}
    </PermissionsGuard>
  )
}
