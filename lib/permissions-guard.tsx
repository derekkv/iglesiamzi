"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { checkUserPermission } from "./auth"
import { toast } from "sonner"
import { useAuth } from "@/contexts/auth-context"

interface PermissionsGuardProps {
  children: React.ReactNode
  moduleName: string
  fallbackPath?: string
}

export function PermissionsGuard({ children, moduleName, fallbackPath = "/dashboard" }: PermissionsGuardProps) {
  const { user, isLoading } = useAuth()
  const router = useRouter()
  const [hasPermission, setHasPermission] = useState<boolean | null>(null)

  useEffect(() => {


    const checkPermission = async () => {
      if (isLoading) return

      if (!user) {
        toast.error("Debe iniciar sesión")
        router.push("/login")
        return
      }

      const result = await checkUserPermission(user.id, moduleName)

      if (!result.success || !result.hasPermission) {
        toast.error("No tiene permiso para acceder a este módulo")
        router.push(fallbackPath)
        return
      }

      setHasPermission(true)
    }

    checkPermission()
  }, [user, isLoading, moduleName, router, fallbackPath])

  if (isLoading || hasPermission === null) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Verificando permisos...</p>
        </div>
      </div>
    )
  }

  if (!hasPermission) {
    return null
  }

  return <>{children}</>
}

export function withPermissions(Component: React.ComponentType, moduleName: string) {
  return function PermissionsWrappedComponent(props: any) {
    return (
      <PermissionsGuard moduleName={moduleName}>
        <Component {...props} />
      </PermissionsGuard>
    )
  }
}
