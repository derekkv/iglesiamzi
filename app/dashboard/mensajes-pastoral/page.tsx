"use client"

import { PermissionsGuard } from "@/lib/permissions-guard"
import { MensajesCitaciones } from "@/components/MensajesCitaciones"

export default function MensajesPastoralPage() {
  return (
    <PermissionsGuard moduleName="mensajes-pastoral">
      {(canEdit) => <MensajesCitaciones moduloKey="pastoral" title="Pastoral" canEdit={canEdit} />}
    </PermissionsGuard>
  )
}
