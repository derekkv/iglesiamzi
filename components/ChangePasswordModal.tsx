"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/contexts/auth-context"
import { authFetch } from "@/lib/auth-fetch"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Loader2, Eye, EyeOff, User, Lock } from "lucide-react"
import { toast } from "sonner"

export function ChangePasswordModal({ userId }: { userId: string }) {
  const { user, login: setAuthUser } = useAuth()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loadingData, setLoadingData] = useState(false)

  // Datos del perfil
  const [displayName, setDisplayName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [cedula, setCedula] = useState("")
  const [username, setUsername] = useState("")

  // Cambiar contraseña
  const [currentPass, setCurrentPass] = useState("")
  const [newPass, setNewPass] = useState("")
  const [confirmPass, setConfirmPass] = useState("")
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  useEffect(() => {
    if (open) loadUserData()
  }, [open])

  async function loadUserData() {
    setLoadingData(true)
    try {
      const res = await authFetch("/api/user-profile")
      if (!res.ok) throw new Error("Error cargando datos")

      const { user: data } = await res.json()
      if (data) {
        setUsername(data.username || "")
        setDisplayName(data.displayName || "")
        setEmail(data.email || "")
        setPhone(data.phone || "")
        setCedula(data.cedula || "")
      }
    } catch (error) {
      console.error("Error cargando datos:", error)
      toast.error("Error cargando datos del perfil")
    } finally {
      setLoadingData(false)
    }
  }

  async function handleSaveProfile() {
    if (!displayName.trim()) {
      return toast.error("El nombre es obligatorio")
    }

    setLoading(true)
    try {
      const res = await authFetch("/api/user-profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: displayName.trim(),
          email: email.trim() || null,
          phone: phone.trim() || null,
          cedula: cedula.trim() || null,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Error actualizando perfil")
      }

      // Actualizar el contexto de auth con el nuevo displayName
      if (user) {
        const existingToken = localStorage.getItem("authToken") || ""
        setAuthUser({
          ...user,
          displayName: displayName.trim(),
          email: email.trim() || undefined,
          cedula: cedula.trim() || undefined,
        }, existingToken)
      }

      toast.success("Datos actualizados correctamente")
    } catch (error: any) {
      console.error("Error actualizando perfil:", error)
      toast.error(error.message || "Error al actualizar datos")
    } finally {
      setLoading(false)
    }
  }

  async function handleChangePassword() {
    if (!currentPass || !newPass || !confirmPass) {
      return toast.error("Completa todos los campos")
    }
    if (newPass !== confirmPass) {
      return toast.error("Las contraseñas no coinciden")
    }
    if (newPass.length < 6) {
      return toast.error("La contraseña debe tener al menos 6 caracteres")
    }

    setLoading(true)
    try {
      const res = await authFetch("/api/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: currentPass,
          newPassword: newPass,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error || "Error cambiando contraseña")
        return
      }

      toast.success("Contraseña actualizada correctamente")
      setCurrentPass("")
      setNewPass("")
      setConfirmPass("")
    } catch (err) {
      console.error(err)
      toast.error("Ocurrió un error")
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)} className="text-xs sm:text-sm">
        Mi Perfil
      </Button>

      <Dialog open={open} onOpenChange={(v) => !loading && setOpen(v)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Mi Perfil</DialogTitle>
          </DialogHeader>

          {loadingData ? (
            <div className="flex justify-center py-8">
              <Loader2 className="animate-spin h-6 w-6 text-blue-600" />
            </div>
          ) : (
            <Tabs defaultValue="datos" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="datos">
                  <User className="w-3.5 h-3.5 mr-1" /> Datos
                </TabsTrigger>
                <TabsTrigger value="password">
                  <Lock className="w-3.5 h-3.5 mr-1" /> Contraseña
                </TabsTrigger>
              </TabsList>

              <TabsContent value="datos" className="space-y-4 mt-4">
                <div className="space-y-1">
                  <Label className="text-sm text-gray-500">Usuario</Label>
                  <Input value={username} disabled className="bg-gray-100" />
                </div>

                <div className="space-y-1">
                  <Label>Nombre *</Label>
                  <Input
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Nombre completo"
                  />
                </div>

                <div className="space-y-1">
                  <Label>Correo electrónico</Label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="correo@ejemplo.com"
                  />
                </div>

                <div className="space-y-1">
                  <Label>Teléfono</Label>
                  <Input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="0999999999"
                  />
                </div>

                <div className="space-y-1">
                  <Label>Cédula</Label>
                  <Input
                    value={cedula}
                    onChange={(e) => setCedula(e.target.value)}
                    placeholder="1234567890"
                  />
                </div>

                <div className="flex justify-end pt-2">
                  <Button onClick={handleSaveProfile} disabled={loading}>
                    {loading ? <Loader2 className="animate-spin h-4 w-4" /> : "Guardar cambios"}
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="password" className="space-y-4 mt-4">
                <div className="space-y-1">
                  <Label>Contraseña actual</Label>
                  <div className="relative">
                    <Input
                      type={showCurrent ? "text" : "password"}
                      value={currentPass}
                      onChange={(e) => setCurrentPass(e.target.value)}
                    />
                    <Button
                      type="button"
                      tabIndex={-1}
                      onMouseDown={(e) => e.preventDefault()}
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full px-2 hover:bg-transparent"
                      onClick={() => setShowCurrent((s) => !s)}
                    >
                      {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                <div className="space-y-1">
                  <Label>Nueva contraseña</Label>
                  <div className="relative">
                    <Input
                      type={showNew ? "text" : "password"}
                      value={newPass}
                      onChange={(e) => setNewPass(e.target.value)}
                    />
                    <Button
                      type="button"
                      tabIndex={-1}
                      onMouseDown={(e) => e.preventDefault()}
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full px-2 hover:bg-transparent"
                      onClick={() => setShowNew((s) => !s)}
                    >
                      {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                <div className="space-y-1">
                  <Label>Confirmar nueva contraseña</Label>
                  <div className="relative">
                    <Input
                      type={showConfirm ? "text" : "password"}
                      value={confirmPass}
                      onChange={(e) => setConfirmPass(e.target.value)}
                    />
                    <Button
                      type="button"
                      tabIndex={-1}
                      onMouseDown={(e) => e.preventDefault()}
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full px-2 hover:bg-transparent"
                      onClick={() => setShowConfirm((s) => !s)}
                    >
                      {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <Button onClick={handleChangePassword} disabled={loading}>
                    {loading ? <Loader2 className="animate-spin h-4 w-4" /> : "Cambiar contraseña"}
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
