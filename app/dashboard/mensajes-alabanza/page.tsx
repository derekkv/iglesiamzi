"use client"

import { PermissionsGuard } from "@/lib/permissions-guard"
import { MensajesCitaciones } from "@/components/MensajesCitaciones"

export default function MensajesAlabanzaPage() {
  return (
    <PermissionsGuard moduleName="mensajes-alabanza">
      {(canEdit) => <MensajesCitaciones moduloKey="alabanza" title="Alabanza" canEdit={canEdit} />}
    </PermissionsGuard>
  )
}
