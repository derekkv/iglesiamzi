"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { checkUserEditPermission } from "./auth"
import { toast } from "sonner"
import { useAuth } from "@/contexts/auth-context"

interface PermissionsGuardProps {
  children: (canEdit: boolean, canAdmin?: boolean, canLeader?: boolean) => React.ReactNode
  moduleName: string
  alternateModules?: string[]
  fallbackPath?: string
}

export function PermissionsGuard({ children, moduleName, alternateModules, fallbackPath = "/dashboard" }: PermissionsGuardProps) {
  const { user, isLoading } = useAuth()
  const router = useRouter()
  const [permState, setPermState] = useState<{ canView: boolean; canEdit: boolean; canAdmin: boolean; canLeader: boolean } | null>(null)

  useEffect(() => {
    const checkPermission = async () => {
      if (isLoading) return

      if (!user) {
        toast.error("Debe iniciar sesión")
        router.push("/login")
        return
      }

      // Check primary module first
      const result = await checkUserEditPermission(user.id, moduleName)

      if (result.success && result.canView) {
        setPermState({ canView: result.canView, canEdit: result.canEdit, canAdmin: result.canAdmin, canLeader: result.canLeader })
        return
      }

      // Check alternate modules if primary didn't grant access
      if (alternateModules && alternateModules.length > 0) {
        for (const altModule of alternateModules) {
          const altResult = await checkUserEditPermission(user.id, altModule)
          if (altResult.success && altResult.canView) {
            setPermState({ canView: altResult.canView, canEdit: altResult.canEdit, canAdmin: altResult.canAdmin, canLeader: altResult.canLeader })
            return
          }
        }
      }

      toast.error("No tiene permiso para acceder a este módulo")
      router.push(fallbackPath)
    }

    checkPermission()
  }, [user, isLoading, moduleName, alternateModules, router, fallbackPath])

  if (isLoading || permState === null) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Verificando permisos...</p>
        </div>
      </div>
    )
  }

  if (!permState.canView) {
    return null
  }

  return <>{children(permState.canEdit, permState.canAdmin, permState.canLeader)}</>
}

export function withPermissions(Component: React.ComponentType<{ canEdit: boolean; canAdmin?: boolean; canLeader?: boolean }>, moduleName: string) {
  return function PermissionsWrappedComponent(props: any) {
    return (
      <PermissionsGuard moduleName={moduleName}>
        {(canEdit, canAdmin, canLeader) => <Component {...props} canEdit={canEdit} canAdmin={canAdmin} canLeader={canLeader} />}
      </PermissionsGuard>
    )
  }
}
