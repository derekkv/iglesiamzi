"use client"

import { useState, useEffect, useRef } from "react"
import bcrypt from "bcryptjs"
import { supabase } from "@/lib/supabase"

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
import { Loader2, Eye, EyeOff } from "lucide-react"
import { toast } from "sonner"

export function ChangePasswordModal({ userId }: { userId: string }) {
  const [currentPass, setCurrentPass] = useState("")
  const [newPass, setNewPass] = useState("")
  const [confirmPass, setConfirmPass] = useState("")
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(false)

  const [open, setOpen] = useState(false)
  const firstInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    // autofocus manual cuando se abre el modal
    if (open) {
      // pequeño timeout para asegurar que el input esté montado
      setTimeout(() => firstInputRef.current?.focus(), 50)
    }
  }, [open])

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
      const { data: user, error: selErr } = await supabase
        .from("users")
        .select("password_hash")
        .eq("id", userId)
        .single()

      if (selErr || !user) {
        toast.error("Error cargando usuario")
        setLoading(false)
        return
      }

      const isValid = await bcrypt.compare(currentPass, user.password_hash)
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
        toast.success("Contraseña actualizada con éxito ✨")
        // limpiar campos después del éxito
        setCurrentPass("")
        setNewPass("")
        setConfirmPass("")
        setOpen(false)
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
      {/* Botón que abre el modal — controlado por estado */}
      <Button variant="outline" onClick={() => setOpen(true)}>
        Cambiar contraseña
      </Button>

      <Dialog open={open} onOpenChange={(v) => !loading && setOpen(v)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Cambiar contraseña</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Contraseña actual */}
            <div className="space-y-1">
              <Label>Contraseña actual</Label>
              <div className="relative">
                <Input
                  ref={firstInputRef}
                  autoFocus={false} // usamos useEffect para focus controlado
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

            {/* Nueva contraseña */}
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

            {/* Confirmar nueva contraseña */}
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
          </div>

          <DialogFooter>
            <Button onClick={handleChangePassword} disabled={loading}>
              {loading ? <Loader2 className="animate-spin h-4 w-4" /> : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
