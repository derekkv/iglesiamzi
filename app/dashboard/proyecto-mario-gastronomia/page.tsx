"use client"

import { PermissionsGuard } from "@/lib/permissions-guard"
import { ProyectoMarioCicloView } from "@/app/dashboard/proyecto-mario/ProyectoMarioCicloView"

function Content({ canEdit }: { canEdit: boolean }) {
  return <ProyectoMarioCicloView tipo="gastronomia" canEdit={canEdit} />
}

export default function ProyectoMarioGastronomiaPage() {
  return (
    <PermissionsGuard moduleName="proyecto_mario_gastronomia">
      {(canEdit) => <Content canEdit={canEdit} />}
    </PermissionsGuard>
  )
}
