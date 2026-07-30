"use client"

import { PermissionsGuard } from "@/lib/permissions-guard"
import { MensajesCitaciones } from "@/components/MensajesCitaciones"

export default function MensajesIntercesionPage() {
  return (
    <PermissionsGuard moduleName="mensajes-intercesion">
      {(canEdit) => <MensajesCitaciones moduloKey="intercesion" title="Intercesión" canEdit={canEdit} />}
    </PermissionsGuard>
  )
}
