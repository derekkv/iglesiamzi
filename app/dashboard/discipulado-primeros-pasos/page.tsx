"use client"

import { PermissionsGuard } from "@/lib/permissions-guard"
import { DiscipuladoCicloView } from "@/app/dashboard/discipulado/DiscipuladoCicloView"

function Content({ canEdit }: { canEdit: boolean }) {
  return <DiscipuladoCicloView tipo="primeros_pasos" canEdit={canEdit} />
}

export default function DiscipuladoPrimerosPasosPage() {
  return (
    <PermissionsGuard moduleName="discipulado_primeros_pasos">
      {(canEdit) => <Content canEdit={canEdit} />}
    </PermissionsGuard>
  )
}
