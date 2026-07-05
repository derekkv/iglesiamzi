"use client"

import { PermissionsGuard } from "@/lib/permissions-guard"
import { SomosUnoContent } from "@/app/dashboard/somos-uno/page"

export default function CelulasPage() {
  return (
    <PermissionsGuard moduleName="celulas">
      {(canEdit) => <SomosUnoContent canEdit={canEdit} />}
    </PermissionsGuard>
  )
}
