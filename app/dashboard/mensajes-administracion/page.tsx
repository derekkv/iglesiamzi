"use client"

import { PermissionsGuard } from "@/lib/permissions-guard"
import { MensajesCitaciones } from "@/components/MensajesCitaciones"

export default function MensajesAdministracionPage() {
  return (
    <PermissionsGuard moduleName="mensajes-administracion">
      {(canEdit) => <MensajesCitaciones moduloKey="administracion" title="Administración" canEdit={canEdit} />}
    </PermissionsGuard>
  )
}
