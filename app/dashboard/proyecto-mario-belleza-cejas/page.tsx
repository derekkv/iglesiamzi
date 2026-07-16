"use client"

import { PermissionsGuard } from "@/lib/permissions-guard"
import { ProyectoMarioCicloView } from "@/app/dashboard/proyecto-mario/ProyectoMarioCicloView"

function Content({ canEdit }: { canEdit: boolean }) {
  return <ProyectoMarioCicloView tipo="belleza_cejas" canEdit={canEdit} />
}

export default function ProyectoMarioBellezaCejasPage() {
  return (
    <PermissionsGuard moduleName="proyecto_mario_belleza_cejas">
      {(canEdit) => <Content canEdit={canEdit} />}
    </PermissionsGuard>
  )
}
