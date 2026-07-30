"use client"

import { PermissionsGuard } from "@/lib/permissions-guard"
import { HerederosCicloView } from "@/app/dashboard/herederos/HerederosCicloView"

function Content({ canEdit }: { canEdit: boolean }) {
  return <HerederosCicloView tipo="herederos_baby" canEdit={canEdit} />
}

export default function HerederosBabyPage() {
  return (
    <PermissionsGuard moduleName="herederos_baby">
      {(canEdit) => <Content canEdit={canEdit} />}
    </PermissionsGuard>
  )
}
