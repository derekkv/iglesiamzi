"use client"

import { PermissionsGuard } from "@/lib/permissions-guard"
import { DiscipuladoCicloView } from "@/app/dashboard/discipulado/DiscipuladoCicloView"

function Content({ canEdit }: { canEdit: boolean }) {
  return <DiscipuladoCicloView tipo="siendo_iglesia" canEdit={canEdit} />
}

export default function DiscipuladoSiendoIglesiaPage() {
  return (
    <PermissionsGuard moduleName="discipulado_siendo_iglesia">
      {(canEdit) => <Content canEdit={canEdit} />}
    </PermissionsGuard>
  )
}
