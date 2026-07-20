"use client"

import { PermissionsGuard } from "@/lib/permissions-guard"
import { HerederosCicloView } from "@/app/dashboard/herederos/HerederosCicloView"

function Content({ canEdit }: { canEdit: boolean }) {
  return <HerederosCicloView tipo="herederos_explores" canEdit={canEdit} />
}

export default function HerederosExploresPage() {
  return (
    <PermissionsGuard moduleName="herederos_explores">
      {(canEdit) => <Content canEdit={canEdit} />}
    </PermissionsGuard>
  )
}
