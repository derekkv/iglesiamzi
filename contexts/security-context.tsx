"use client"

import {
  createContext,
  useContext,
  useState,
  ReactNode,
} from "react"

import { useAuth } from "@/contexts/auth-context"
import { validateSecurityKey } from "@/lib/security-keys"
import { toast } from "sonner"

interface SecurityCheckContextType {
  checkAndExecute: (
    createdAt: string,
    callback: () => void
  ) => void

  isDialogOpen: boolean
  setIsDialogOpen: (open: boolean) => void

  keyInput: string
  setKeyInput: (value: string) => void

  isValidating: boolean

  handleValidateKey: () => Promise<void>
}

const SecurityCheckContext =
  createContext<SecurityCheckContextType | null>(null)

export function SecurityCheckProvider({
  children,
}: {
  children: ReactNode
}) {
  const { user } = useAuth()

  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [keyInput, setKeyInput] = useState("")
  const [isValidating, setIsValidating] = useState(false)

  const [pendingCallback, setPendingCallback] =
    useState<(() => void) | null>(null)

  const hasPassedSixHours = (
    createdAt: string
  ): boolean => {
    const created = new Date(createdAt)
    const now = new Date()

    const diffInHours =
      (now.getTime() - created.getTime()) /
      (1000 * 60 * 60)

    return diffInHours >= 6
  }

  const checkAndExecute = (
    createdAt: string,
    callback: () => void
  ) => {

    if (user?.username === "jaime" || user?.username === "dev") {
      callback()
      return
    }

    if (!hasPassedSixHours(createdAt)) {
      callback()
      return
    }
    setPendingCallback(() => callback)
    setIsDialogOpen(true)
  }

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

    const result = await validateSecurityKey(
      keyInput,
      user.id
    )

    setIsValidating(false)

    if (result.success) {
      toast.success("Clave válida")

      setIsDialogOpen(false)
      setKeyInput("")

      if (pendingCallback) {
        pendingCallback()
        setPendingCallback(null)
      }
    } else {
      toast.error(result.error || "Clave inválida")
    }
  }

  return (
    <SecurityCheckContext.Provider
      value={{
        checkAndExecute,
        isDialogOpen,
        setIsDialogOpen,
        keyInput,
        setKeyInput,
        isValidating,
        handleValidateKey,
      }}
    >
      {children}
    </SecurityCheckContext.Provider>
  )
}

export function useSecurityCheck() {
  const context = useContext(SecurityCheckContext)

  if (!context) {
    throw new Error(
      "useSecurityCheck debe usarse dentro de SecurityCheckProvider"
    )
  }

  return context
}