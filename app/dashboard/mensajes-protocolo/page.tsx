"use client"

import { PermissionsGuard } from "@/lib/permissions-guard"
import { MensajesCitaciones } from "@/components/MensajesCitaciones"

export default function MensajesProtocoloPage() {
  return (
    <PermissionsGuard moduleName="mensajes-protocolo">
      {(canEdit) => <MensajesCitaciones moduloKey="protocolo" title="Protocolo" canEdit={canEdit} />}
    </PermissionsGuard>
  )
}
