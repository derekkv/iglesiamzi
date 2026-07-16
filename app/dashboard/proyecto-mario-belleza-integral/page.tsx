"use client"

import { PermissionsGuard } from "@/lib/permissions-guard"
import { ProyectoMarioCicloView } from "@/app/dashboard/proyecto-mario/ProyectoMarioCicloView"

function Content({ canEdit }: { canEdit: boolean }) {
  return <ProyectoMarioCicloView tipo="belleza_integral" canEdit={canEdit} />
}

export default function ProyectoMarioBellezaIntegralPage() {
  return (
    <PermissionsGuard moduleName="proyecto_mario_belleza_integral">
      {(canEdit) => <Content canEdit={canEdit} />}
    </PermissionsGuard>
  )
}
