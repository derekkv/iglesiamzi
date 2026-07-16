"use client"

import { PermissionsGuard } from "@/lib/permissions-guard"
import { MensajesCitaciones } from "@/components/MensajesCitaciones"

export default function MensajesProyectoMarioPage() {
  return (
    <PermissionsGuard moduleName="mensajes-proyecto-mario">
      {(canEdit) => <MensajesCitaciones moduloKey="proyecto-mario" title="Proyecto Mario" canEdit={canEdit} />}
    </PermissionsGuard>
  )
}
