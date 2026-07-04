"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"
import { useRouter } from "next/navigation"

export interface AuthUser {
  id: string
  username: string
  displayName: string
  accountType: "personal" | "ministerio"
  email?: string
  ministerioName?: string
  cedula?: string
}

interface AuthContextType {
  user: AuthUser | null
  login: (user: AuthUser, token: string) => void
  logout: () => void
  isLoading: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    validateSession()
  }, [])

  async function validateSession() {
    const token = localStorage.getItem("authToken")

    if (!token) {
      // Migración: si hay datos viejos sin token, limpiar
      localStorage.removeItem("authUser")
      setIsLoading(false)
      return
    }

    try {
      const res = await fetch("/api/verify-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      })

      if (res.ok) {
        const data = await res.json()
        if (data.valid && data.user) {
          setUser(data.user)
        } else {
          // Token inválido o expirado
          clearSession()
        }
      } else {
        clearSession()
      }
    } catch (error) {
      console.error("Error validando sesión:", error)
      // En caso de error de red, intentar usar datos locales como fallback temporal
      const storedUser = localStorage.getItem("authUser")
      if (storedUser) {
        try {
          setUser(JSON.parse(storedUser))
        } catch {
          clearSession()
        }
      }
    } finally {
      setIsLoading(false)
    }
  }

  function clearSession() {
    localStorage.removeItem("authToken")
    localStorage.removeItem("authUser")
    setUser(null)
  }

  const login = (userData: AuthUser, token: string) => {
    setUser(userData)
    localStorage.setItem("authToken", token)
    localStorage.setItem("authUser", JSON.stringify(userData))
  }

  const logout = () => {
    clearSession()
    router.push("/")
  }

  return <AuthContext.Provider value={{ user, login, logout, isLoading }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
