"use client"

import { PermissionsGuard } from "@/lib/permissions-guard"
import { MensajesCitaciones } from "@/components/MensajesCitaciones"

export default function MensajesHerederosPage() {
  return (
    <PermissionsGuard moduleName="mensajes-herederos">
      {(canEdit) => <MensajesCitaciones moduloKey="herederos" title="Herederos del Reino" canEdit={canEdit} />}
    </PermissionsGuard>
  )
}
