"use client"

import { PermissionsGuard } from "@/lib/permissions-guard"
import { MensajesCitaciones } from "@/components/MensajesCitaciones"

export default function MensajesDiscipuladoPage() {
  return (
    <PermissionsGuard moduleName="mensajes-discipulado">
      {(canEdit) => <MensajesCitaciones moduloKey="discipulado" title="Discipulado" canEdit={canEdit} />}
    </PermissionsGuard>
  )
}
