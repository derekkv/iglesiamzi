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
import { useMonth } from "@/contexts/month-context"

interface User {
  cedula: string
  name: string
}

export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null)
  const router = useRouter()
  const { currentMonth, startNewMonth } = useMonth()

  useEffect(() => {
    const userData = localStorage.getItem("churchUser")
    if (!userData) {
      router.push("/")
      return
    }

    setUser(JSON.parse(userData))
  }, [router])

  const handleLogout = () => {
    localStorage.removeItem("churchUser")
    router.push("/")
  }

  const handleCreateMonth = () => {
    startNewMonth()
  }

  const handleModuleClick = (module: any) => {
    if (!module.available) return

    if (!currentMonth && module.requiresActiveMonth) {
      // Solo bloquear módulos que requieren mes activo
      return
    }

    router.push(module.href)
  }

  const modules = [
    {
      title: "Control Mensual",
      description: "Gestión general del mes actual",
      icon: "📊",
      href: "/dashboard/control-mensual",
      available: true,
      requiresActiveMonth: false,
    },
    {
      title: "Ingresos y Egresos",
      description: "Reporte detallado de finanzas",
      icon: "💰",
      href: "/dashboard/ingresos-egresos",
      available: true,
      requiresActiveMonth: true,
    },
    {
      title: "Estadística de Asistencia",
      description: "Control de asistencia a servicios",
      icon: "👥",
      href: "/dashboard/asistencia",
      available: true,
      requiresActiveMonth: true,
    },
    {
      title: "Listado de Diezmo",
      description: "Registro de diezmos y ofrendas",
      icon: "🙏",
      href: "/dashboard/diezmos",
      available: true,
      requiresActiveMonth: true,
    },
    {
      title: "Asistencia o Discipulado",
      description: "Control de discipulado",
      icon: "📖",
      href: "/dashboard/discipulado",
      available: true,
      requiresActiveMonth: true,
    },
    {
      title: "Flujo de Pago",
      description: "Gestión de pagos y transacciones",
      icon: "💳",
      href: "/dashboard/flujo-pago",
      available: true,
      requiresActiveMonth: false,
    },
    {
      title: "Inventario",
      description: "Gestión de artículos y equipos",
      icon: "📦",
      href: "/dashboard/inventario",
      available: true,
      requiresActiveMonth: false,
    },  
    {
      title: "Censo",
      description: "Gestión de datos",
      icon: "🐱‍🐉",
      href: "/dashboard/censo",
      available: false,
      requiresActiveMonth: false,
    },
  ]

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando..</p>
        </div>
      </div>
    )
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
                <p className="text-sm text-gray-600">Bienvenido, {user.name}</p>
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

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {modules.map((module, index) => {
            const isAccessible = module.available && (!module.requiresActiveMonth || currentMonth)
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
                    <Badge variant="secondary">Próximamente</Badge>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      </main>
    </div>
  )
}
