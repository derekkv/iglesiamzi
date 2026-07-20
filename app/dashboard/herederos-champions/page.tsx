"use client"

import { PermissionsGuard } from "@/lib/permissions-guard"
import { HerederosCicloView } from "@/app/dashboard/herederos/HerederosCicloView"

function Content({ canEdit }: { canEdit: boolean }) {
  return <HerederosCicloView tipo="herederos_champions" canEdit={canEdit} />
}

export default function HerederosChampionsPage() {
  return (
    <PermissionsGuard moduleName="herederos_champions">
      {(canEdit) => <Content canEdit={canEdit} />}
    </PermissionsGuard>
  )
}
