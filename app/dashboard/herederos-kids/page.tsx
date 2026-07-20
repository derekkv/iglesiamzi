"use client"

import { PermissionsGuard } from "@/lib/permissions-guard"
import { HerederosCicloView } from "@/app/dashboard/herederos/HerederosCicloView"

function Content({ canEdit }: { canEdit: boolean }) {
  return <HerederosCicloView tipo="herederos_kids" canEdit={canEdit} />
}

export default function HerederosKidsPage() {
  return (
    <PermissionsGuard moduleName="herederos_kids">
      {(canEdit) => <Content canEdit={canEdit} />}
    </PermissionsGuard>
  )
}
