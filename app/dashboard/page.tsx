"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

import { getUserPermissions } from "@/lib/auth"
import { useMonth } from "@/contexts/month-context"
import { useAuth } from "@/contexts/auth-context"

interface ModulePermission {
  module: {
    id: string
    name: string
    display_name: string
    description: string
    icon: string
  }
  can_view: boolean
  is_active: boolean
}

export default function DashboardPage() {
  const { user, logout } = useAuth()
  const { currentMonth, startNewMonth } = useMonth()
  const router = useRouter()
  const [permissions, setPermissions] = useState<ModulePermission[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) {
      router.push("/login")
      return
    }

    loadPermissions()
  }, [user, router])

  const loadPermissions = async () => {
    if (!user) return

    try {
      const userPermissions = await getUserPermissions(user.id)
      setPermissions(userPermissions)
    } catch (error) {
      console.error("Error cargando permisos:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = () => {
    logout()
  }

  const handleCreateMonth = () => {
    startNewMonth()
  }

  const handleModuleClick = (module: any) => {
    if (!module.hasAccess) return

    if (!currentMonth && module.requiresActiveMonth) {
      return
    }

    router.push(module.href)
  }

  const moduleRoutes: Record<string, { href: string; requiresActiveMonth: boolean }> = {
    Administración: { href: "/dashboard/administracion", requiresActiveMonth: false },
    "Control Mensual": { href: "/dashboard/control-mensual", requiresActiveMonth: false },
    "Ingresos y Egresos": { href: "/dashboard/ingresos-egresos", requiresActiveMonth: true },
    "Estadística de Asistencia": { href: "/dashboard/asistencia", requiresActiveMonth: true },
    "Listado de Diezmo": { href: "/dashboard/diezmos", requiresActiveMonth: true },
    "Asistencia o Discipulado": { href: "/dashboard/discipulado", requiresActiveMonth: true },
    "Flujo de Pago": { href: "/dashboard/flujo-pago", requiresActiveMonth: false },
    Inventario: { href: "/dashboard/inventario", requiresActiveMonth: false },
    Censo: { href: "/dashboard/censo", requiresActiveMonth: false },
    Bautizo: { href: "/dashboard/bautizo", requiresActiveMonth: false },
    Matrimonio: { href: "/dashboard/matrimonio", requiresActiveMonth: false },
  }

  const availableModules = permissions
    .map((permission) => {
      const route = moduleRoutes[permission.module.display_name] || {
        href: "#",
        requiresActiveMonth: false,
      }
      return {
        name: permission.module.name,
        title: permission.module.display_name,
        description: permission.module.description,
        icon: permission.module.icon,
        href: route.href,
        requiresActiveMonth: route.requiresActiveMonth,
        hasAccess: permission.can_view,
        is_active: permission.is_active,
      }
    })
    .filter((module) => module.hasAccess)

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                  />
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">Dashboard Iglesia</h1>
                <p className="text-sm text-gray-600">Bienvenido, {user.displayName}</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <Badge variant="outline" className="text-blue-600 border-blue-200">
                {currentMonth?.name || "Sin mes activo"}
              </Badge>
              <Button variant="outline" onClick={handleLogout}>
                Cerrar Sesión
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Módulos del Sistema</h2>
          <p className="text-gray-600">Seleccione el módulo con el que desea trabajar</p>
        </div>

        {!currentMonth && (
          <Alert className="mb-6 border-amber-200 bg-amber-50">
            <AlertDescription className="flex items-center justify-between">
              <span className="text-amber-800">
                ⚠️ No hay un mes activo. Debe crear un nuevo mes para acceder a los módulos de gestión.
              </span>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" className="bg-amber-600 hover:bg-amber-700 text-white">
                    Crear Mes
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>¿Crear nuevo mes?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Se creará un nuevo período mensual con configuraciones predeterminadas. Podrá comenzar a registrar
                      datos inmediatamente.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={handleCreateMonth} className="bg-green-600 hover:bg-green-700">
                      Crear Mes
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </AlertDescription>
          </Alert>
        )}

        {availableModules.length === 0 ? (
          <Alert className="border-red-200 bg-red-50">
            <AlertDescription className="text-red-800">
              ⚠️ No tienes permisos para acceder a ningún módulo. Contacta al administrador.
            </AlertDescription>
          </Alert>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {availableModules.map((module, index) => {
              const isAccessible = module.hasAccess && (!module.requiresActiveMonth || currentMonth)
              const isBlocked = module.requiresActiveMonth && !currentMonth

              return (
                <Card
                  key={index}
                  className={`transition-all duration-200 ${
                    isAccessible
                      ? "hover:shadow-lg hover:scale-105 cursor-pointer border-blue-200"
                      : isBlocked
                        ? "opacity-40 cursor-not-allowed border-amber-200 bg-amber-50"
                        : "opacity-60 cursor-not-allowed"
                  }`}
                  onClick={() => handleModuleClick(module)}
                >
                  <CardHeader className="text-center">
                    <div className="text-4xl mb-2">{module.icon}</div>
                    <CardTitle className="text-lg">{module.title}</CardTitle>
                    <CardDescription>{module.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="text-center">
                    {isAccessible ? (
                      <Badge className="bg-green-100 text-green-800 border-green-200">Disponible</Badge>
                    ) : isBlocked ? (
                      <Badge className="bg-amber-100 text-amber-800 border-amber-200">Requiere mes activo</Badge>
                    ) : (
                      <Badge variant="secondary">Sin acceso</Badge>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
