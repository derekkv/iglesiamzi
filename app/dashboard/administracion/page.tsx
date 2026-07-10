"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useRealtimeMultiple } from "@/hooks/use-realtime"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import {
  getAllUsers,
  getAllModules,
  getModulesGrouped,
  createUser,
  getUserPermissions,
  setUserPermission,
  setGroupPermissions,
  getUserGroupLeaders,
  setGroupLeader,
  updateUser,
  deleteUser,
} from "@/lib/admin"
import { toast } from "sonner"
import { useAuth } from "@/contexts/auth-context"
import { useSecurityCheck } from "@/contexts/security-context"
import { PermissionsGuard } from "@/lib/permissions-guard"
import { Pencil, Trash2, RefreshCw, Copy, Check, ArrowLeft } from "lucide-react"
import { getSecurityKeys, regenerateAllKeys} from "@/lib/security-keys"
import { AuditLogTab } from "./AuditLogTab"
import { WhatsAppTab } from "./WhatsAppTab"
import { auditService } from "@/lib/mod/audit-service"

interface User {
  id: string
  username: string
  displayName: string
  account_type: string
  email?: string
  ministerio_name?: string
  is_active: boolean
  phone?: string
  created_at: string
}

interface Module {
  id: string
  name: string
  displayName: string
  display_name?: string
  description: string
  icon: string
  group_id?: string
}

interface ModuleGroup {
  id: string
  name: string
  display_name: string
  description: string
  icon: string
  sort_order: number
  modules: Module[]
}

interface SecurityKey {
  id: string
  key_code: string
  is_used: boolean
  used_at?: string
  created_at: string
}

function AdministracionContent({ canEdit, canAdmin }: { canEdit: boolean; canAdmin?: boolean }) {
  const [users, setUsers] = useState<User[]>([])
  const [modules, setModules] = useState<Module[]>([])
  const [moduleGroups, setModuleGroups] = useState<ModuleGroup[]>([])
  const [ungroupedModules, setUngroupedModules] = useState<Module[]>([])
  const [securityKeys, setSecurityKeys] = useState<SecurityKey[]>([])
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [userPermissions, setUserPermissions] = useState<any[]>([])
  const [userLeaderGroups, setUserLeaderGroups] = useState<string[]>([])
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isPermissionsDialogOpen, setIsPermissionsDialogOpen] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const [searchFilter, setSearchFilter] = useState("")
  const [allLeaders, setAllLeaders] = useState<Record<string, string[]>>({})
  const { user: currentUser, isLoading: authLoading } = useAuth()
  const KEYS_ALLOWED_USERS = ["83cb032c-38ef-4b47-85f1-84d4ae7d531e", "8a799e01-11bb-4ea4-8a95-9f7033e90fb1"]
  const canSeeKeys = !!currentUser && KEYS_ALLOWED_USERS.includes(currentUser.id)
  const { checkAndExecute } = useSecurityCheck()
  const router = useRouter()

  // Formulario de nuevo usuario
  const [newUserForm, setNewUserForm] = useState({
    accountType: "personal" as "personal" | "ministerio",
    username: "",
    password: "",
    displayName: "",
    email: "",
    phone: "",
    cedula: "",
    ministerioName: "",
  })

  // Formulario de edición
  const [editUserForm, setEditUserForm] = useState({
    displayName: "",
    email: "",
    phone: "",
    is_active: true,
  })

  useEffect(() => {
    if (!authLoading && !currentUser) {
      router.push("/login")
      return
    }
    if (currentUser) {
      loadData()
    }
  }, [currentUser, authLoading, router])

  const loadData = async () => {
    const usersResult = await getAllUsers()
    const modulesResult = await getAllModules()
    const groupedResult = await getModulesGrouped()
    const keysResult = await getSecurityKeys()

    if (usersResult.success) {
      setUsers(usersResult.users || [])
      // Cargar líderes de todos los usuarios
      const leadersMap: Record<string, string[]> = {}
      for (const u of (usersResult.users || [])) {
        const lr = await getUserGroupLeaders(u.id)
        if (lr.success && lr.groupIds.length > 0) {
          leadersMap[u.id] = lr.groupIds
        }
      }
      setAllLeaders(leadersMap)
    }

    if (modulesResult.success) {
      setModules(modulesResult.modules || [])
    }

    if (groupedResult.success) {
      setModuleGroups(groupedResult.grouped || [])
      setUngroupedModules(groupedResult.ungrouped || [])
    }

    if (keysResult.success) {
      setSecurityKeys(keysResult.keys || [])
    }
  }

  // Realtime: refrescar cuando cambian usuarios o permisos
  useRealtimeMultiple(["users", "user_permissions"], loadData)

  const handleCreateUser = async () => {
    if (!canEdit) {
      toast.error("No tiene permisos para crear usuarios")
      return
    }

    if (!newUserForm.username || !newUserForm.password || !newUserForm.displayName) {
      toast.error("Complete los campos requeridos")
      return
    }

    if (newUserForm.accountType === "ministerio" && !newUserForm.ministerioName) {
      toast.error("Ingrese el nombre del ministerio")
      return
    }

    if (!currentUser?.id) {
      toast.error("Error: Usuario no autenticado")
      return
    }

    setIsCreating(true)

    const result = await createUser({
      ...newUserForm,
      createdBy: currentUser.id,
    })

    setIsCreating(false)

    if (result.success) {
      toast.success("Usuario creado exitosamente")
      auditService.log({ user_id: currentUser!.id, user_name: currentUser!.username, module: "administracion", action: "crear", description: `Usuario creado: ${newUserForm.username}`, details: { username: newUserForm.username, displayName: newUserForm.displayName, accountType: newUserForm.accountType, email: newUserForm.email, ministerioName: newUserForm.ministerioName } })
      setIsCreateDialogOpen(false)
      setNewUserForm({
        accountType: "personal",
        username: "",
        password: "",
        displayName: "",
        email: "",
        phone: "",
        cedula: "",
        ministerioName: "",
      })
      loadData()
    } else {
      toast.error(result.error || "Error al crear usuario")
    }
  }

  const handleOpenEdit = (user: User) => {
    checkAndExecute(user.created_at || new Date().toISOString(), () => {
      setSelectedUser(user)
      setEditUserForm({
        displayName: user.displayName,
        email: user.email || "",
        phone: user.phone || "",
        is_active: user.is_active,
      })
      setIsEditDialogOpen(true)
    })
  }

  const handleUpdateUser = async () => {
    if (!canEdit) {
      toast.error("No tiene permisos para editar usuarios")
      return
    }

    if (!selectedUser) return

    if (!editUserForm.displayName) {
      toast.error("El nombre es requerido")
      return
    }

    setIsUpdating(true)

    const result = await updateUser(selectedUser.id, editUserForm)

    setIsUpdating(false)

    if (result.success) {
      toast.success("Usuario actualizado exitosamente")
      auditService.log({ user_id: currentUser!.id, user_name: currentUser!.username, module: "administracion", action: "editar", description: `Usuario editado: ${selectedUser!.username}`, details: { usuario: selectedUser!.username, cambios: editUserForm } })
      setIsEditDialogOpen(false)
      setSelectedUser(null)
      loadData()
    } else {
      toast.error(result.error || "Error al actualizar usuario")
    }
  }

  const handleDeleteUser = async (userId: string, username: string) => {
    if (!canEdit) {
      toast.error("No tiene permisos para eliminar usuarios")
      return
    }

    if (!confirm(`¿Está seguro de eliminar al usuario "${username}"?`)) {
      return
    }

    const result = await deleteUser(userId)

    if (result.success) {
      toast.success("Usuario eliminado exitosamente")
      auditService.log({ user_id: currentUser!.id, user_name: currentUser!.username, module: "administracion", action: "eliminar", description: `Usuario eliminado: ${username}`, details: { userId, username } })
      loadData()
    } else {
      toast.error(result.error || "Error al eliminar usuario")
    }
  }

  const handleOpenPermissions = async (user: User) => {
    setSelectedUser(user)
    const result = await getUserPermissions(user.id)
    if (result.success) {
      setUserPermissions(result.permissions || [])
    }
    const leadersResult = await getUserGroupLeaders(user.id)
    if (leadersResult.success) {
      setUserLeaderGroups(leadersResult.groupIds || [])
    }
    setIsPermissionsDialogOpen(true)
  }

  const handleTogglePermission = async (moduleId: string, currentValue: boolean) => {
    if (!canEdit) {
      toast.error("No tiene permisos para modificar permisos")
      return
    }

    if (!selectedUser) return

    if (!currentUser?.id) {
      toast.error("Error: Usuario no autenticado")
      return
    }

    const existingPermission = userPermissions.find((p) => p.module_id === moduleId)
    const currentEditValue = existingPermission?.can_edit || false

    const permissionData = {
      userId: selectedUser.id,
      moduleId,
      canView: !currentValue,
      canEdit: !currentValue ? true : false,
      grantedBy: currentUser.id,
    }

    const result = await setUserPermission(permissionData)

    if (result.success) {
      toast.success("Permiso actualizado")
      const updatedResult = await getUserPermissions(selectedUser.id)
      if (updatedResult.success) {
        setUserPermissions(updatedResult.permissions || [])
      }
    } else {
      toast.error("Error al actualizar permiso")
    }
  }

  const handleToggleEditPermission = async (moduleId: string, canView: boolean, canEditValue: boolean) => {
    if (!canEdit) {
      toast.error("No tiene permisos para modificar permisos")
      return
    }

    if (!selectedUser) return

    if (!currentUser?.id) {
      toast.error("Error: Usuario no autenticado")
      return
    }

    const permissionData = {
      userId: selectedUser.id,
      moduleId,
      canView,
      canEdit: !canEditValue,
      grantedBy: currentUser.id,
    }

    const result = await setUserPermission(permissionData)

    if (result.success) {
      toast.success("Permiso de edición actualizado")
      const updatedResult = await getUserPermissions(selectedUser.id)
      if (updatedResult.success) {
        setUserPermissions(updatedResult.permissions || [])
      }
    } else {
      toast.error("Error al actualizar permiso de edición")
    }
  }

  const handleCopyKey = (keyCode: string) => {
    navigator.clipboard.writeText(keyCode)
    setCopiedKey(keyCode)
    toast.success("Clave copiada al portapapeles")
    setTimeout(() => setCopiedKey(null), 2000)
  }

  const handleRegenerateKeys = async () => {
    if (!canEdit) {
      toast.error("No tiene permisos para regenerar claves")
      return
    }

    if (!confirm("¿Está seguro de regenerar todas las claves? Las claves actuales quedarán inválidas.")) {
      return
    }

    const result = await regenerateAllKeys()

    if (result.success) {
      toast.success("Claves regeneradas exitosamente")
      loadData()
    } else {
      toast.error(result.error || "Error al regenerar claves")
    }
  }

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando...</p>
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
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => router.push("/dashboard")}
                  className="flex items-center space-x-2"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Volver</span>
                </Button>
                <h1 className="text-xl font-semibold text-gray-900">Administración del Sistema</h1>
              </div>
              <div className="text-sm text-gray-600">
                Usuario: <span className="font-medium">{currentUser?.displayName}</span>
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Tabs defaultValue="users" className="space-y-6">
            <TabsList>
              <TabsTrigger value="users">Usuarios y Ministerios</TabsTrigger>
              {canSeeKeys && <TabsTrigger value="keys">Clave</TabsTrigger>}
              {canAdmin && <TabsTrigger value="audit">Logs</TabsTrigger>}
              {canAdmin && <TabsTrigger value="whatsapp">WhatsApp</TabsTrigger>}
            </TabsList>

            <TabsContent value="users" className="space-y-4">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Gestión de Usuarios</h2>
                  <p className="text-gray-600">Administre cuentas personales y de ministerios</p>
                </div>
                <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                  <DialogTrigger asChild>
                    <Button disabled={!canEdit}>+ Crear Usuario</Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>Crear Nuevo Usuario</DialogTitle>
                      <DialogDescription>
                        Complete los datos para crear una nueva cuenta
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                          <Label>Usuario *</Label>
                          <Input
                            value={newUserForm.username}
                            onChange={(e) => setNewUserForm({ ...newUserForm, username: e.target.value })}
                            placeholder="nombre.usuario"
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label>Contraseña *</Label>
                          <Input
                            type="password"
                            value={newUserForm.password}
                            onChange={(e) => setNewUserForm({ ...newUserForm, password: e.target.value })}
                          />
                        </div>
                      </div>

                      <div className="grid gap-2">
                        <Label>Nombre Completo *</Label>
                        <Input
                          value={newUserForm.displayName}
                          onChange={(e) => setNewUserForm({ ...newUserForm, displayName: e.target.value })}
                          placeholder="Juan Pérez"
                        />
                      </div>

                      <div className="grid gap-2">
                        <Label>Cédula</Label>
                        <Input
                          value={newUserForm.cedula}
                          onChange={(e) => setNewUserForm({ ...newUserForm, cedula: e.target.value })}
                          placeholder="1234567890"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                          <Label>Email</Label>
                          <Input
                            type="email"
                            value={newUserForm.email}
                            onChange={(e) => setNewUserForm({ ...newUserForm, email: e.target.value })}
                            placeholder="correo@ejemplo.com"
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label>Teléfono</Label>
                          <Input
                            value={newUserForm.phone}
                            onChange={(e) => setNewUserForm({ ...newUserForm, phone: e.target.value })}
                            placeholder="0999999999"
                          />
                        </div>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)} disabled={isCreating}>
                        Cancelar
                      </Button>
                      <Button onClick={handleCreateUser} disabled={isCreating}>
                        {isCreating ? "Guardando..." : "Crear Usuario"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>

              <Card>
                <CardHeader>
                                    <CardTitle>Lista de Usuarios</CardTitle>
                  <CardDescription>Total: {users.length} usuarios registrados</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="mb-4">
                    <Input
                      placeholder="Buscar por nombre o usuario..."
                      value={searchFilter}
                      onChange={(e) => setSearchFilter(e.target.value)}
                      className="max-w-sm"
                    />
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Usuario</TableHead>
                        <TableHead>Nombre</TableHead>
                        <TableHead>Rol</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead>Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {users
                        .filter((u) => {
                          if (!searchFilter) return true
                          const q = searchFilter.toLowerCase()
                          return u.username.toLowerCase().includes(q) || u.displayName.toLowerCase().includes(q) || (u.email || "").toLowerCase().includes(q)
                        })
                        .map((user) => {
                          const isLeader = !!allLeaders[user.id]?.length
                          const leaderGroupNames = isLeader ? moduleGroups.filter((g) => allLeaders[user.id]?.includes(g.id)).map((g) => g.display_name) : []
                          return (
                        <TableRow key={user.id} className={isLeader ? "bg-amber-50/60 border-l-4 border-l-amber-400" : ""}>
                          <TableCell className="font-medium">{user.username}</TableCell>
                          <TableCell>{user.displayName}</TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {isLeader && leaderGroupNames.map((name) => (
                                <Badge key={name} className="bg-amber-500 hover:bg-amber-600 text-white text-[10px] px-1.5 py-0.5">Líder {name}</Badge>
                              ))}
                              {!isLeader && <span className="text-sm text-gray-400">—</span>}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={user.is_active ? "default" : "destructive"} className={user.is_active ? "bg-green-600 hover:bg-green-700" : ""}>
                              {user.is_active ? "Activo" : "Inactivo"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {canAdmin && (
                                <Button variant="outline" size="sm" onClick={() => handleOpenPermissions(user)}>
                                  Permisos
                                </Button>
                              )}
                              <Button variant="outline" size="sm" onClick={() => handleOpenEdit(user)} disabled={!canEdit}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => checkAndExecute(user.created_at || new Date().toISOString(), () => handleDeleteUser(user.id, user.username))}
                                disabled={!canEdit}
                              >
                                <Trash2 className="h-4 w-4 text-red-600" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                          )
                        })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="keys">
              <Card>
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <div>
                      <CardTitle>Claves de Seguridad</CardTitle>
                      <CardDescription>
                        Claves de un solo uso para autorizar ediciones después de 6 horas
                      </CardDescription>
                    </div>
                    <Button onClick={handleRegenerateKeys} variant="outline">
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Regenerar Todas
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                      <p className="text-sm text-yellow-800">
                        <strong>Importante:</strong> Estas claves son de un solo uso. Una vez utilizadas, se generará
                        automáticamente una nueva clave. Mantenga estas claves seguras y compártalas solo con personal
                        autorizado.
                      </p>
                    </div>

                    <div className="grid gap-4">
                      {securityKeys
                        .filter((key) => !key.is_used)
                        .map((key, index) => (
                          <Card key={key.id}>
                            <CardContent className="pt-6">
                              <div className="flex items-center justify-between">
                                <div className="flex-1">
                                  <div className="flex items-center gap-3">
                                    <div className="bg-blue-100 text-blue-700 rounded-full w-8 h-8 flex items-center justify-center font-semibold">
                                      {index + 1}
                                    </div>
                                    <div>
                                      <div className="text-2xl font-mono font-bold tracking-wider">{key.key_code}</div>
                                      <div className="text-sm text-gray-500">
                                        Creada: {new Date(key.created_at).toLocaleString("es-ES")}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleCopyKey(key.key_code)}
                                  className="ml-4"
                                >
                                  {copiedKey === key.key_code ? (
                                    <>
                                      <Check className="h-4 w-4 mr-2" />
                                      Copiado
                                    </>
                                  ) : (
                                    <>
                                      <Copy className="h-4 w-4 mr-2" />
                                      Copiar
                                    </>
                                  )}
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                    </div>

                    {securityKeys.filter((key) => key.is_used).length > 0 && (
                      <div className="mt-8">
                        <h3 className="text-lg font-semibold mb-4">Historial de Claves Usadas</h3>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Clave</TableHead>
                              <TableHead>Fecha de Uso</TableHead>
                              <TableHead>Estado</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {securityKeys
                              .filter((key) => key.is_used)
                              .slice(0, 10)
                              .map((key) => (
                                <TableRow key={key.id}>
                                  <TableCell className="font-mono">{key.key_code}</TableCell>
                                  <TableCell>
                                    {key.used_at ? new Date(key.used_at).toLocaleString("es-ES") : "-"}
                                  </TableCell>
                                  <TableCell>
                                    <Badge variant="secondary">Usada</Badge>
                                  </TableCell>
                                </TableRow>
                              ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="audit">
              <AuditLogTab />
            </TabsContent>

            <TabsContent value="whatsapp">
              <WhatsAppTab />
            </TabsContent>
          </Tabs>

          <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Editar Usuario</DialogTitle>
                <DialogDescription>Modifique los datos del usuario {selectedUser?.username}</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label>Nombre Completo *</Label>
                  <Input
                    value={editUserForm.displayName}
                    onChange={(e) => setEditUserForm({ ...editUserForm, displayName: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={editUserForm.email}
                    onChange={(e) => setEditUserForm({ ...editUserForm, email: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Teléfono</Label>
                  <Input
                    value={editUserForm.phone}
                    onChange={(e) => setEditUserForm({ ...editUserForm, phone: e.target.value })}
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="is_active"
                    checked={editUserForm.is_active}
                    onCheckedChange={(checked) => setEditUserForm({ ...editUserForm, is_active: checked as boolean })}
                  />
                  <Label htmlFor="is_active">Usuario activo</Label>
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsEditDialogOpen(false)
                    setSelectedUser(null)
                  }}
                  disabled={isUpdating}
                >
                  Cancelar
                </Button>
                <Button onClick={handleUpdateUser} disabled={isUpdating}>
                  {isUpdating ? "Guardando..." : "Guardar Cambios"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={isPermissionsDialogOpen} onOpenChange={setIsPermissionsDialogOpen}>
            <DialogContent className="w-[75vw] max-w-none max-h-[85vh] flex flex-col">
              <DialogHeader className="bg-gradient-to-r from-blue-600 to-indigo-600 -mx-6 -mt-6 px-6 py-5 rounded-t-lg">
                <DialogTitle className="text-white text-lg">Permisos de {selectedUser?.displayName}</DialogTitle>
                <DialogDescription className="text-blue-100">Configure los permisos de Vista, Edición y Líder por grupo para este usuario.</DialogDescription>
              </DialogHeader>
              <div className="py-4 overflow-y-auto flex-1 space-y-6">
                {/* Módulos sin grupo (ej. Administración panel) */}
                {ungroupedModules.length > 0 && (
                  <div className="border rounded-lg overflow-hidden">
                    <div className="bg-slate-700 px-4 py-2">
                      <span className="text-sm font-semibold text-white">Módulos Generales</span>
                    </div>
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50">
                          <TableHead>Módulo</TableHead>
                          <TableHead className="text-center w-20">Ver</TableHead>
                          <TableHead className="text-center w-20">Editar</TableHead>
                          <TableHead className="text-center w-20">Admin</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {ungroupedModules.map((module) => {
                          const permission = userPermissions.find((p: any) => p.module_id === module.id)
                          return (
                            <TableRow key={module.id}>
                              <TableCell>
                                <div className="flex items-center space-x-3">
                                  {module.icon?.startsWith("/") || module.icon?.startsWith("http") ? (
                                    <img src={module.icon} alt="" className="w-7 h-7 object-contain" />
                                  ) : (
                                    <span className="text-2xl">{module.icon}</span>
                                  )}
                                  <div>
                                    <div className="font-medium">{module.displayName || module.display_name}</div>
                                    <div className="text-sm text-gray-500">{module.description}</div>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell className="text-center">
                                <Checkbox
                                  checked={permission?.can_view || false}
                                  disabled={!canEdit}
                                  onCheckedChange={() => handleTogglePermission(module.id, permission?.can_view || false)}
                                />
                              </TableCell>
                              <TableCell className="text-center">
                                <Checkbox
                                  checked={permission?.can_edit || false}
                                  disabled={!canEdit || !permission?.can_view}
                                  onCheckedChange={() => {
                                    if (!permission?.can_view) return
                                    handleToggleEditPermission(module.id, permission?.can_view || false, permission?.can_edit || false)
                                  }}
                                />
                              </TableCell>
                              <TableCell className="text-center">
                                <Checkbox
                                  checked={permission?.can_admin || false}
                                  disabled={!canEdit || !permission?.can_view}
                                  onCheckedChange={async () => {
                                    if (!permission?.can_view || !selectedUser || !currentUser?.id) return
                                    const result = await setUserPermission({
                                      userId: selectedUser.id,
                                      moduleId: module.id,
                                      canView: true,
                                      canEdit: permission?.can_edit || false,
                                      canAdmin: !(permission?.can_admin || false),
                                      grantedBy: currentUser.id,
                                    })
                                    if (result.success) {
                                      toast.success("Permiso de administrador actualizado")
                                      const updatedResult = await getUserPermissions(selectedUser.id)
                                      if (updatedResult.success) {
                                        setUserPermissions(updatedResult.permissions || [])
                                      }
                                    }
                                  }}
                                />
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}

                {/* Módulos agrupados */}
                {moduleGroups.map((group) => {
                  // Calcular estado del checkbox padre
                  const groupModuleIds = group.modules.map((m: any) => m.id)
                  const groupPermissions = groupModuleIds.map((id: string) =>
                    userPermissions.find((p: any) => p.module_id === id)
                  )
                  const viewCount = groupPermissions.filter((p: any) => p?.can_view).length
                  const allChecked = viewCount === groupModuleIds.length
                  const noneChecked = viewCount === 0
                  const isIndeterminate = !allChecked && !noneChecked

                  return (
                    <div key={group.id} className="border rounded-lg overflow-hidden shadow-sm">
                      {/* Header del grupo con checkbox padre */}
                      <div className="bg-gradient-to-r from-slate-100 to-slate-50 px-4 py-3 flex items-center justify-between border-b">
                        <div className="flex items-center space-x-3">
                          <Checkbox
                            checked={isIndeterminate ? "indeterminate" : allChecked}
                            disabled={!canEdit}
                            onCheckedChange={async () => {
                              if (!selectedUser || !currentUser?.id) return
                              // Si todos están marcados o algunos (indeterminado), desmarcar todos
                              // Si ninguno está marcado, marcar todos
                              const newValue = noneChecked
                              const result = await setGroupPermissions(
                                selectedUser.id,
                                group.id,
                                newValue,
                                newValue,
                                currentUser.id
                              )
                              if (result.success) {
                                toast.success(
                                  newValue
                                    ? `Permisos activados para ${group.display_name}`
                                    : `Permisos desactivados para ${group.display_name}`
                                )
                                const updatedResult = await getUserPermissions(selectedUser.id)
                                if (updatedResult.success) {
                                  setUserPermissions(updatedResult.permissions || [])
                                }
                              } else {
                                toast.error("Error al actualizar permisos del grupo")
                              }
                            }}
                          />
                          {group.icon?.startsWith("/") || group.icon?.startsWith("http") ? (
                            <img src={group.icon} alt="" className="w-6 h-6 object-contain" />
                          ) : (
                            <span className="text-xl">{group.icon}</span>
                          )}
                          <div>
                            <div className="font-semibold text-gray-900">{group.display_name}</div>
                            <div className="text-xs text-gray-500">{group.description}</div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-3">
                          <Badge variant="outline" className="text-xs">
                            {viewCount}/{groupModuleIds.length} activos
                          </Badge>
                          <div className={`flex items-center space-x-2 px-3 py-1.5 rounded-full ${userLeaderGroups.includes(group.id) ? "bg-amber-100 border border-amber-400" : "bg-gray-50 border border-gray-200"}`}>
                            <Checkbox
                              id={`leader-${group.id}`}
                              checked={userLeaderGroups.includes(group.id)}
                              disabled={!canEdit}
                              onCheckedChange={async () => {
                                if (!selectedUser || !currentUser?.id) return
                                const isCurrentlyLeader = userLeaderGroups.includes(group.id)
                                const result = await setGroupLeader(
                                  selectedUser.id,
                                  group.id,
                                  !isCurrentlyLeader,
                                  currentUser.id
                                )
                                if (result.success) {
                                  toast.success(
                                    !isCurrentlyLeader
                                      ? `${selectedUser.displayName} es ahora Líder de ${group.display_name}`
                                      : `Líder removido de ${group.display_name}`
                                  )
                                  setUserLeaderGroups(prev =>
                                    !isCurrentlyLeader
                                      ? [...prev, group.id]
                                      : prev.filter(id => id !== group.id)
                                  )
                                  setAllLeaders(prev => {
                                    const current = prev[selectedUser.id] || []
                                    return {
                                      ...prev,
                                      [selectedUser.id]: !isCurrentlyLeader
                                        ? [...current, group.id]
                                        : current.filter(id => id !== group.id)
                                    }
                                  })
                                } else {
                                  toast.error("Error al actualizar líder de grupo")
                                }
                              }}
                            />
                            <Label htmlFor={`leader-${group.id}`} className={`text-xs font-semibold cursor-pointer ${userLeaderGroups.includes(group.id) ? "text-amber-700" : "text-gray-500"}`}>
                              {userLeaderGroups.includes(group.id) ? "★ Líder" : "Líder"}
                            </Label>
                          </div>
                        </div>
                      </div>

                      {/* Sub-módulos */}
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-slate-50/50">
                            <TableHead className="pl-12">Sub-módulo</TableHead>
                            <TableHead className="text-center w-20">Ver</TableHead>
                            <TableHead className="text-center w-20">Editar</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {group.modules.map((module: any) => {
                            const permission = userPermissions.find((p: any) => p.module_id === module.id)
                            return (
                              <TableRow key={module.id}>
                                <TableCell className="pl-12">
                                  <div className="flex items-center space-x-3">
                                    {module.icon?.startsWith("/") || module.icon?.startsWith("http") ? (
                                      <img src={module.icon} alt="" className="w-6 h-6 object-contain" />
                                    ) : (
                                      <span className="text-lg">{module.icon}</span>
                                    )}
                                    <div>
                                      <div className="font-medium">{module.display_name}</div>
                                      <div className="text-sm text-gray-500">{module.description}</div>
                                    </div>
                                  </div>
                                </TableCell>
                                <TableCell className="text-center">
                                  <Checkbox
                                    checked={permission?.can_view || false}
                                    disabled={!canEdit}
                                    onCheckedChange={() => handleTogglePermission(module.id, permission?.can_view || false)}
                                  />
                                </TableCell>
                                <TableCell className="text-center">
                                  <Checkbox
                                    checked={permission?.can_edit || false}
                                    disabled={!canEdit || !permission?.can_view}
                                    onCheckedChange={() => {
                                      if (!permission?.can_view) return
                                      handleToggleEditPermission(module.id, permission?.can_view || false, permission?.can_edit || false)
                                    }}
                                  />
                                </TableCell>
                              </TableRow>
                            )
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  )
                })}
              </div>
              <DialogFooter className="border-t pt-4">
                <Button onClick={() => setIsPermissionsDialogOpen(false)} className="bg-blue-600 hover:bg-blue-700">Cerrar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </main>
      </div>
  )
}

export default function AdministracionPage() {
  return (
    <PermissionsGuard moduleName="administracion">
      {(canEdit, canAdmin) => <AdministracionContent canEdit={canEdit} canAdmin={canAdmin} />}
    </PermissionsGuard>
  )
}

