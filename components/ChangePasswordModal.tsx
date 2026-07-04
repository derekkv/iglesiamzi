"use client"

import { useState, useEffect } from "react"
import bcrypt from "bcryptjs"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/contexts/auth-context"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
      const { data, error } = await supabase
        .from("users")
        .select("username, displayName, email, phone, cedula")
        .eq("id", userId)
        .single()

      if (error) throw error
      if (data) {
        setUsername(data.username || "")
        setDisplayName(data.displayName || "")
        setEmail(data.email || "")
        setPhone(data.phone || "")
        setCedula(data.cedula || "")
      }
    } catch (error) {
      console.error("Error cargando datos:", error)
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
      const { error } = await supabase
        .from("users")
        .update({
          displayName: displayName.trim(),
          email: email.trim() || null,
          phone: phone.trim() || null,
          cedula: cedula.trim() || null,
        })
        .eq("id", userId)

      if (error) throw error

      // Actualizar el contexto de auth con el nuevo displayName
      if (user) {
        setAuthUser({
          ...user,
          displayName: displayName.trim(),
          email: email.trim() || undefined,
          cedula: cedula.trim() || undefined,
        })
      }

      toast.success("Datos actualizados correctamente")
    } catch (error) {
      console.error("Error actualizando perfil:", error)
      toast.error("Error al actualizar datos")
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
      const { data: userData, error: selErr } = await supabase
        .from("users")
        .select("password_hash")
        .eq("id", userId)
        .single()

      if (selErr || !userData) {
        toast.error("Error cargando usuario")
        setLoading(false)
        return
      }

      const isValid = await bcrypt.compare(currentPass, userData.password_hash)
      if (!isValid) {
        toast.error("Contraseña actual incorrecta")
        setLoading(false)
        return
      }

      const newHash = await bcrypt.hash(newPass, 10)

      const { error: updErr } = await supabase
        .from("users")
        .update({ password_hash: newHash })
        .eq("id", userId)

      if (updErr) {
        toast.error("Error actualizando contraseña")
      } else {
        toast.success("Contraseña actualizada correctamente")
        setCurrentPass("")
        setNewPass("")
        setConfirmPass("")
      }
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
