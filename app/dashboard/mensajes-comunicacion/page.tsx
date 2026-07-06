"use client"

import { PermissionsGuard } from "@/lib/permissions-guard"
import { MensajesCitaciones } from "@/components/MensajesCitaciones"

export default function MensajesComunicacionPage() {
  return (
    <PermissionsGuard moduleName="mensajes-comunicacion">
      {(canEdit) => <MensajesCitaciones moduloKey="comunicacion" title="Comunicación" canEdit={canEdit} />}
    </PermissionsGuard>
  )
}
