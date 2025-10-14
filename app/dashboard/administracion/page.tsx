"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
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
  createUser,
  getUserPermissions,
  setUserPermission,
  updateUser,
  deleteUser,
} from "@/lib/admin"
import { toast } from "sonner"
import { useAuth } from "@/contexts/auth-context"
import { PermissionsGuard } from "@/lib/permissions-guard"
import { Pencil, Trash2, RefreshCw, Copy, Check } from "lucide-react"
import { getSecurityKeys, regenerateAllKeys} from "@/lib/security-keys"

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
  description: string
  icon: string
}

interface SecurityKey {
  id: string
  key_code: string
  is_used: boolean
  used_at?: string
  created_at: string
}

export default function AdministracionPage() {
  const [users, setUsers] = useState<User[]>([])
  const [modules, setModules] = useState<Module[]>([])
  const [securityKeys, setSecurityKeys] = useState<SecurityKey[]>([])
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [userPermissions, setUserPermissions] = useState<any[]>([])
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isPermissionsDialogOpen, setIsPermissionsDialogOpen] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const { user: currentUser, isLoading: authLoading } = useAuth()
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
    const keysResult = await getSecurityKeys()

    if (usersResult.success) {
      setUsers(usersResult.users || [])
    }

    if (modulesResult.success) {
      setModules(modulesResult.modules || [])
    }

    if (keysResult.success) {
      setSecurityKeys(keysResult.keys || [])
    }
  }

  const handleCreateUser = async () => {
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
    setSelectedUser(user)
    setEditUserForm({
      displayName: user.displayName,
      email: user.email || "",
      phone: user.phone || "",
      is_active: user.is_active,
    })
    setIsEditDialogOpen(true)
  }

  const handleUpdateUser = async () => {
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
      setIsEditDialogOpen(false)
      setSelectedUser(null)
      loadData()
    } else {
      toast.error(result.error || "Error al actualizar usuario")
    }
  }

  const handleDeleteUser = async (userId: string, username: string) => {
    if (!confirm(`¿Está seguro de eliminar al usuario "${username}"?`)) {
      return
    }

    const result = await deleteUser(userId)

    if (result.success) {
      toast.success("Usuario eliminado exitosamente")
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
    setIsPermissionsDialogOpen(true)
  }

  const handleTogglePermission = async (moduleId: string, currentValue: boolean) => {
    if (!selectedUser) return

    if (!currentUser?.id) {
      toast.error("Error: Usuario no autenticado")
      return
    }

    const permissionData = {
      userId: selectedUser.id,
      moduleId,
      canView: !currentValue,
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

  const handleCopyKey = (keyCode: string) => {
    navigator.clipboard.writeText(keyCode)
    setCopiedKey(keyCode)
    toast.success("Clave copiada al portapapeles")
    setTimeout(() => setCopiedKey(null), 2000)
  }

  const handleRegenerateKeys = async () => {
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
    <PermissionsGuard moduleName="administracion">
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center space-x-4">
                <Button variant="ghost" onClick={() => router.push("/dashboard")}>
                  ← Volver
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
              <TabsTrigger value="keys">Clave</TabsTrigger>
            </TabsList>

            <TabsContent value="users" className="space-y-4">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Gestión de Usuarios</h2>
                  <p className="text-gray-600">Administre cuentas personales y de ministerios</p>
                </div>
                <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                  <DialogTrigger asChild>
                    <Button>+ Crear Usuario</Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>Crear Nuevo Usuario</DialogTitle>
                      <DialogDescription>
                        Complete los datos para crear una cuenta personal o de ministerio
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="grid gap-2">
                        <Label>Tipo de Cuenta *</Label>
                        <Select
                          value={newUserForm.accountType}
                          onValueChange={(value: "personal" | "ministerio") =>
                            setNewUserForm({ ...newUserForm, accountType: value })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="personal">Personal</SelectItem>
                            <SelectItem value="ministerio">Ministerio</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

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

                      {newUserForm.accountType === "ministerio" && (
                        <div className="grid gap-2">
                          <Label>Nombre del Ministerio *</Label>
                          <Input
                            value={newUserForm.ministerioName}
                            onChange={(e) => setNewUserForm({ ...newUserForm, ministerioName: e.target.value })}
                            placeholder="Alabanza y Adoración"
                          />
                        </div>
                      )}

                      {newUserForm.accountType === "personal" && (
                        <div className="grid gap-2">
                          <Label>Cédula</Label>
                          <Input
                            value={newUserForm.cedula}
                            onChange={(e) => setNewUserForm({ ...newUserForm, cedula: e.target.value })}
                            placeholder="1234567890"
                          />
                        </div>
                      )}

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
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Usuario</TableHead>
                        <TableHead>Nombre</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Ministerio</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead>Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {users.map((user) => (
                        <TableRow key={user.id}>
                          <TableCell className="font-medium">{user.username}</TableCell>
                          <TableCell>{user.displayName}</TableCell>
                          <TableCell>
                            <Badge variant={user.account_type === "personal" ? "default" : "secondary"}>
                              {user.account_type === "personal" ? "Personal" : "Ministerio"}
                            </Badge>
                          </TableCell>
                          <TableCell>{user.ministerio_name || "-"}</TableCell>
                          <TableCell>
                            <Badge variant={user.is_active ? "default" : "destructive"}>
                              {user.is_active ? "Activo" : "Inactivo"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Button variant="outline" size="sm" onClick={() => handleOpenPermissions(user)}>
                                Permisos
                              </Button>
                              <Button variant="outline" size="sm" onClick={() => handleOpenEdit(user)}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDeleteUser(user.id, user.username)}
                              >
                                <Trash2 className="h-4 w-4 text-red-600" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
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
            <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
              <DialogHeader>
                <DialogTitle>Permisos de {selectedUser?.displayName}</DialogTitle>
                <DialogDescription>Configure los módulos que puede ver este usuario</DialogDescription>
              </DialogHeader>
              <div className="py-4 overflow-y-auto flex-1">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Módulo</TableHead>
                      <TableHead className="text-center">Acceso</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {modules.map((module) => {
                      const permission = userPermissions.find((p) => p.module_id === module.id)
                      return (
                        <TableRow key={module.id}>
                          <TableCell>
                            <div className="flex items-center space-x-3">
                              <span className="text-2xl">{module.icon}</span>
                              <div>
                                <div className="font-medium">{module.displayName}</div>
                                <div className="text-sm text-gray-500">{module.description}</div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <Checkbox
                              checked={permission?.can_view || false}
                              onCheckedChange={() => handleTogglePermission(module.id, permission?.can_view || false)}
                            />
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
              <DialogFooter>
                <Button onClick={() => setIsPermissionsDialogOpen(false)}>Cerrar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </main>
      </div>
    </PermissionsGuard>
  )
}
