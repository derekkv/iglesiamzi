"use client"

import { PermissionsGuard } from "@/lib/permissions-guard"
import { MensajesCitaciones } from "@/components/MensajesCitaciones"

export default function MensajesCelulasPage() {
  return (
    <PermissionsGuard moduleName="mensajes-celulas">
      {(canEdit) => <MensajesCitaciones moduloKey="celulas" title="Somos Uno - Células" canEdit={canEdit} />}
    </PermissionsGuard>
  )
}
