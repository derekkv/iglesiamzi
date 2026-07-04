"use client"

import { PermissionsGuard } from "@/lib/permissions-guard"
import { MensajesCitaciones } from "@/components/MensajesCitaciones"

export default function MensajesMdgPage() {
  return (
    <PermissionsGuard moduleName="mensajes-mdg">
      {(canEdit) => <MensajesCitaciones moduloKey="mdg" title="Mujeres de Gracia" canEdit={canEdit} />}
    </PermissionsGuard>
  )
}
