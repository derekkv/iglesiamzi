"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Download, Check, ArrowLeft, LayoutGrid, List } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"

import { getUserPermissions } from "@/lib/auth"
import { useMonth } from "@/contexts/month-context"
import { useAuth } from "@/contexts/auth-context"
import { CreateMonthModal } from "@/components/CreateMonthModal"
import { ChangePasswordModal } from "@/components/ChangePasswordModal"


interface ModulePermission {
  module: {
    id: string
    name: string
    display_name: string
    description: string
    icon: string
    route: string
    requires_active_month: boolean
    group_id?: string
    group?: {
      id: string
      name: string
      display_name: string
      icon: string
      image?: string
      sort_order: number
    }
  }
  can_view: boolean
  is_active: boolean
}

interface GroupData {
  id: string
  name: string
  display_name: string
  icon: string
  image?: string
  sort_order: number
  modules: ModuleData[]
}

interface ModuleData {
  name: string
  title: string
  description: string
  icon: string
  href: string
  requiresActiveMonth: boolean
  hasAccess: boolean
  is_active: boolean
}

function DownloadSeparator({
  fileUrl = "#",
  fileName = "archivo.pdf",
  label = "Descargar archivo",
}) {
  const [downloaded, setDownloaded] = useState(false)

  const handleDownload = () => {
    const link = document.createElement("a")
    link.href = fileUrl
    link.download = fileName
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    setDownloaded(true)
    setTimeout(() => setDownloaded(false), 2000)
  }

  return (
    <div className="flex items-center w-full my-8">
      <div className="flex-grow border-t border-gray-300" />
      <button
        onClick={handleDownload}
        className="mx-4 flex items-center gap-2 rounded-full bg-blue-600 px-5 py-2.5 text-sm font-medium text-white shadow-md transition-all duration-150 hover:scale-105 hover:bg-blue-700 active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
      >
        {downloaded ? (
          <span className="flex items-center gap-2">
            <Check size={16} />
            Descargado
          </span>
        ) : (
          <span className="flex items-center gap-2">
            <Download size={16} />
            {label}
          </span>
        )}
      </button>
      <div className="flex-grow border-t border-gray-300" />
    </div>
  )
}

export default function DashboardPage() {
  const { user, logout } = useAuth()
  const { currentMonth } = useMonth()
  const router = useRouter()
  const [permissions, setPermissions] = useState<ModulePermission[]>([])
  const [loading, setLoading] = useState(true)
  const [openCreateModal, setOpenCreateModal] = useState(false)
  // Vista: "cards" (tarjetas de grupo, default) o "classic" (todos los módulos)
  const [viewMode, setViewMode] = useState<"cards" | "classic">(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("dashboard_view_mode")
      if (saved === "cards" || saved === "classic") return saved
    }
    return "cards"
  })
  // Grupo seleccionado para ver sus sub-módulos (null = vista de grupos)
  const [selectedGroup, setSelectedGroup] = useState<GroupData | null>(null)

  const handleViewModeChange = (mode: "cards" | "classic") => {
    setViewMode(mode)
    localStorage.setItem("dashboard_view_mode", mode)
  }

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
      // @ts-ignore
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

  const handleModuleClick = (module: ModuleData) => {
    if (!module.hasAccess) return
    if (!currentMonth && module.requiresActiveMonth) return
    router.push(module.href)
  }

  // Preparar datos
  const availableModules = permissions
    .map((permission) => ({
      name: permission.module.name,
      title: permission.module.display_name,
      description: permission.module.description,
      icon: permission.module.icon,
      href: permission.module.route || "#",
      requiresActiveMonth: permission.module.requires_active_month || false,
      hasAccess: permission.can_view,
      is_active: permission.is_active,
      groupId: permission.module.group_id || null,
      group: permission.module.group || null,
    }))
    .filter((module) => module.hasAccess)

  // Agrupar módulos por grupo
  const groupedModulesMap = availableModules
    .filter((m) => m.group)
    .reduce((acc, module) => {
      const groupId = module.groupId!
      if (!acc[groupId]) {
        acc[groupId] = {
          id: module.group!.id,
          name: module.group!.name,
          display_name: module.group!.display_name,
          icon: module.group!.icon,
          image: (module.group as any)?.image,
          sort_order: module.group!.sort_order,
          modules: [],
        }
      }
      acc[groupId].modules.push({
        name: module.name,
        title: module.title,
        description: module.description,
        icon: module.icon,
        href: module.href,
        requiresActiveMonth: module.requiresActiveMonth,
        hasAccess: module.hasAccess,
        is_active: module.is_active,
      })
      return acc
    }, {} as Record<string, GroupData>)

  const sortedGroups = Object.values(groupedModulesMap).sort(
    (a, b) => (a.sort_order || 0) - (b.sort_order || 0)
  )

  // Módulos sin grupo (como pastoral)
  const ungroupedModules = availableModules.filter((m) => !m.groupId)

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
              <div className="w-15 h-15 rounded-lg flex items-center justify-center">
                <img src="/logo.png" alt="Logo" className="w-15 h-15" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">Regalo de Dios - Panel de control</h1>
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
              <ChangePasswordModal userId={user.id}>
              </ChangePasswordModal>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header con título y toggle de vista */}
        <div className="flex justify-between items-center mb-8">
          <div>
            {selectedGroup ? (
              <div className="flex items-center space-x-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedGroup(null)}
                  className="flex items-center space-x-2"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Volver</span>
                </Button>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">{selectedGroup.display_name}</h2>
                  <p className="text-gray-600">Seleccione el módulo con el que desea trabajar</p>
                </div>
              </div>
            ) : (
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Módulos del Sistema</h2>
                <p className="text-gray-600">Seleccione el módulo con el que desea trabajar</p>
              </div>
            )}
          </div>
          {!selectedGroup && (
            <div className="flex items-center gap-2">
              <Button
                variant={viewMode === "cards" ? "default" : "outline"}
                size="sm"
                onClick={() => handleViewModeChange("cards")}
                title="Vista de tarjetas"
              >
                <LayoutGrid className="w-4 h-4" />
              </Button>
              <Button
                variant={viewMode === "classic" ? "default" : "outline"}
                size="sm"
                onClick={() => handleViewModeChange("classic")}
                title="Vista clásica"
              >
                <List className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>

        {/* Alerta de mes inactivo */}
        {!currentMonth && (
          <Alert className="mb-6 border-amber-200 bg-amber-50">
            <AlertDescription className="flex items-center justify-between">
              <span className="text-amber-800">
                No hay un mes activo. Debe crear un nuevo mes para acceder a los módulos de gestión.
              </span>
              <Button
                size="sm"
                className="bg-amber-600 hover:bg-amber-700 text-white"
                onClick={() => setOpenCreateModal(true)}
              >
                Crear Mes
              </Button>
            </AlertDescription>
            <CreateMonthModal open={openCreateModal} setOpen={setOpenCreateModal} />
          </Alert>
        )}

        {availableModules.length === 0 ? (
          <Alert className="border-red-200 bg-red-50">
            <AlertDescription className="text-red-800">
              No tienes permisos para acceder a ningún módulo. Contacta al administrador.
            </AlertDescription>
          </Alert>
        ) : selectedGroup ? (
          /* ======= VISTA DE SUB-MÓDULOS DE UN GRUPO ======= */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {selectedGroup.modules.map((module, index) => {
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
        ) : viewMode === "cards" ? (
          /* ======= VISTA DE TARJETAS DE GRUPO (DEFAULT) ======= */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {sortedGroups.map((group) => (
              <Card
                key={group.id}
                className="p-0 overflow-hidden transition-all duration-200 hover:shadow-xl hover:scale-[1.02] cursor-pointer border-0 rounded-xl group"
                onClick={() => setSelectedGroup(group)}
              >
                <div className="relative h-52 overflow-hidden">
                  <img
                    src={group.image || "/logo.png"}
                    alt={group.display_name}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                  <div className="absolute bottom-4 left-4 text-white">
                    <h3 className="text-xl font-bold">{group.display_name}</h3>
                    <p className="text-sm text-white/80">{group.modules.length} módulos</p>
                  </div>
                </div>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex flex-wrap gap-1">
                      {group.modules.slice(0, 4).map((m, i) => (
                        <span key={i} className="text-lg" title={m.title}>{m.icon}</span>
                      ))}
                      {group.modules.length > 4 && (
                        <span className="text-sm text-gray-500 self-center">+{group.modules.length - 4}</span>
                      )}
                    </div>
                    <Button size="sm" variant="outline">
                      Abrir
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
            {/* Módulos independientes (sin grupo) */}
            {ungroupedModules.map((module) => {
              const isAccessible = module.hasAccess && (!module.requiresActiveMonth || currentMonth)
              const isBlocked = module.requiresActiveMonth && !currentMonth
              // Imagen por módulo
              const moduleImage = module.name === "pastoral" ? "/Pastoral.jpg" : null
              return (
                <Card
                  key={module.name}
                  className={`p-0 overflow-hidden transition-all duration-200 rounded-xl ${
                    isAccessible
                      ? "hover:shadow-xl hover:scale-[1.02] cursor-pointer border-0 group"
                      : isBlocked
                        ? "opacity-40 cursor-not-allowed border-amber-200"
                        : "opacity-60 cursor-not-allowed"
                  }`}
                  onClick={() => isAccessible && handleModuleClick(module)}
                >
                  {moduleImage ? (
                    <>
                      <div className="relative h-52 overflow-hidden">
                        <img
                          src={moduleImage}
                          alt={module.title}
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                        <div className="absolute bottom-4 left-4 text-white">
                          <h3 className="text-xl font-bold">{module.title}</h3>
                          <p className="text-sm text-white/80">{module.description}</p>
                        </div>
                      </div>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-end">
                          {isBlocked ? (
                            <span className="text-xs text-amber-600">Requiere mes activo</span>
                          ) : (
                            <Button size="sm" variant="outline">Abrir</Button>
                          )}
                        </div>
                      </CardContent>
                    </>
                  ) : (
                    <>
                      <CardHeader className="text-center pt-8 pb-4">
                        <div className="text-5xl mb-3">{module.icon}</div>
                        <CardTitle className="text-lg">{module.title}</CardTitle>
                        <CardDescription>{module.description}</CardDescription>
                      </CardHeader>
                      <CardContent className="text-center pb-6">
                        {isBlocked ? (
                          <span className="text-xs text-amber-600">Requiere mes activo</span>
                        ) : (
                          <Button size="sm" variant="outline">Abrir</Button>
                        )}
                      </CardContent>
                    </>
                  )}
                </Card>
              )
            })}
          </div>
        ) : (
          /* ======= VISTA CLÁSICA (TODOS LOS MÓDULOS LISTADOS POR GRUPO) ======= */
          <div className="space-y-8">
            {/* Módulos independientes (sin grupo) */}
            {ungroupedModules.length > 0 && (
              <div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {ungroupedModules.map((module, index) => {
                    const isAccessible = module.hasAccess && (!module.requiresActiveMonth || currentMonth)
                    const isBlocked = module.requiresActiveMonth && !currentMonth

                    return (
                      <Card
                        key={`ungrouped-${index}`}
                        className={`transition-all duration-200 ${
                          isAccessible
                            ? "hover:shadow-lg hover:scale-105 cursor-pointer border-blue-200"
                            : isBlocked
                              ? "opacity-40 cursor-not-allowed border-amber-200 bg-amber-50"
                              : "opacity-60 cursor-not-allowed"
                        }`}
                        onClick={() => isAccessible && handleModuleClick(module)}
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
              </div>
            )}

            {/* Módulos agrupados */}
            {sortedGroups.map(({ display_name, icon, modules, id }) => (
              <div key={id}>
                <div className="flex items-center space-x-3 mb-4">
                  <span className="text-2xl">{icon}</span>
                  <h3 className="text-xl font-semibold text-gray-800">{display_name}</h3>
                  <div className="flex-grow border-t border-gray-200"></div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {modules.map((module, index) => {
                    const isAccessible = module.hasAccess && (!module.requiresActiveMonth || currentMonth)
                    const isBlocked = module.requiresActiveMonth && !currentMonth

                    return (
                      <Card
                        key={`${id}-${index}`}
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
              </div>
            ))}
          </div>
        )}

        <DownloadSeparator fileUrl="/regalo-de-dios-setup.exe" fileName="regalo-de-dios-setup.exe" label="Descargar" />
      </main>
    </div>
  )
}
