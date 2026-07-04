"use client"

import { PermissionsGuard } from "@/lib/permissions-guard"
import { DiscipuladoCicloView } from "@/app/dashboard/discipulado/DiscipuladoCicloView"

function Content({ canEdit }: { canEdit: boolean }) {
  return <DiscipuladoCicloView tipo="seguimos_avanzando" canEdit={canEdit} />
}

export default function DiscipuladoSeguimosAvanzandoPage() {
  return (
    <PermissionsGuard moduleName="discipulado_seguimos_avanzando">
      {(canEdit) => <Content canEdit={canEdit} />}
    </PermissionsGuard>
  )
}
