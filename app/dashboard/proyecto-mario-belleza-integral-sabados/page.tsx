"use client"

import { PermissionsGuard } from "@/lib/permissions-guard"
import { ProyectoMarioCicloView } from "@/app/dashboard/proyecto-mario/ProyectoMarioCicloView"

function Content({ canEdit }: { canEdit: boolean }) {
  return <ProyectoMarioCicloView tipo="belleza_integral_sabados" canEdit={canEdit} />
}

export default function ProyectoMarioBellezaIntegralSabadosPage() {
  return (
    <PermissionsGuard moduleName="proyecto_mario_belleza_integral_sabados">
      {(canEdit) => <Content canEdit={canEdit} />}
    </PermissionsGuard>
  )
}
