"use client"

import { PermissionsGuard } from "@/lib/permissions-guard"
import { ProyectoMarioCicloView } from "@/app/dashboard/proyecto-mario/ProyectoMarioCicloView"

function Content({ canEdit }: { canEdit: boolean }) {
  return <ProyectoMarioCicloView tipo="manualidades" canEdit={canEdit} />
}

export default function ProyectoMarioManualidadesPage() {
  return (
    <PermissionsGuard moduleName="proyecto_mario_manualidades">
      {(canEdit) => <Content canEdit={canEdit} />}
    </PermissionsGuard>
  )
}
