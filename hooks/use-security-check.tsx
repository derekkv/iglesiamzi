"use client"

import type React from "react"

import { useState } from "react"
import { useAuth } from "@/contexts/auth-context"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { validateSecurityKey } from "@/lib/security-keys"

interface UseSecurityCheckReturn {
  checkAndExecute: (createdAt: string, callback: () => void) => void
  SecurityKeyDialog: React.FC
}

export function useSecurityCheck(): UseSecurityCheckReturn {
  const { user } = useAuth()
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [keyInput, setKeyInput] = useState("")
  const [isValidating, setIsValidating] = useState(false)
  const [pendingCallback, setPendingCallback] = useState<(() => void) | null>(null)

  // Verificar si pasaron 6 horas desde la creación
  const hasPassedSixHours = (createdAt: string): boolean => {
    const created = new Date(createdAt)
    const now = new Date()
    const diffInHours = (now.getTime() - created.getTime()) / (1000 * 60 * 60)
    return diffInHours >= 6
  }

  // Función principal que verifica y ejecuta
  const checkAndExecute = (createdAt: string, callback: () => void) => {
    // Si es admin, ejecutar directamente
    if (user?.username === "admin") {
      callback()
      return
    }

    // Si no pasaron 6 horas, ejecutar directamente
    if (!hasPassedSixHours(createdAt)) {
      callback()
      return
    }

    // Si pasaron 6 horas, pedir clave
    setPendingCallback(() => callback)
    setIsDialogOpen(true)
  }

  // Validar la clave ingresada
  const handleValidateKey = async () => {
    if (!keyInput.trim()) {
      toast.error("Ingrese una clave")
      return
    }

    if (!user?.id) {
      toast.error("Usuario no autenticado")
      return
    }

    setIsValidating(true)

    const result = await validateSecurityKey(keyInput, user.id)

    setIsValidating(false)

    if (result.success) {
      toast.success("Clave válida")
      setIsDialogOpen(false)
      setKeyInput("")

      // Ejecutar el callback pendiente
      if (pendingCallback) {
        pendingCallback()
        setPendingCallback(null)
      }
    } else {
      toast.error(result.error || "Clave inválida")
    }
  }

  // Componente del diálogo
  const SecurityKeyDialog: React.FC = () => (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Autorización Requerida</DialogTitle>
          <DialogDescription>
            Este registro tiene más de 6 horas. Ingrese una clave de seguridad para continuar con la edición.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="security-key">Clave de Seguridad</Label>
            <Input
              id="security-key"
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value.toUpperCase())}
              placeholder="Ingrese la clave"
              maxLength={6}
              className="uppercase"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleValidateKey()
                }
              }}
            />
            <p className="text-sm text-gray-500">Solicite la clave al administrador del sistema</p>
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              setIsDialogOpen(false)
              setKeyInput("")
              setPendingCallback(null)
            }}
            disabled={isValidating}
          >
            Cancelar
          </Button>
          <Button onClick={handleValidateKey} disabled={isValidating}>
            {isValidating ? "Validando..." : "Validar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )

  return {
    checkAndExecute,
    SecurityKeyDialog,
  }
}
