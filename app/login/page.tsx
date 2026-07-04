"use client"

import type React from "react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useRouter } from "next/navigation"
import { useAuth } from "@/contexts/auth-context"


export default function LoginPage() {
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()
  const { login: setAuthUser } = useAuth()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsLoading(true)

    if (!username.trim() || !password.trim()) {
      setError("Por favor complete todos los campos")
      setIsLoading(false)
      return
    }

    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: username, password }),
      })

      const data = await res.json() as { token?: string; user?: any; error?: string; remainingAttempts?: number }

      if (res.ok && data.token && data.user) {
        setAuthUser(data.user, data.token)
        router.push("/dashboard")
      } else if (res.status === 429) {
        setError(data.error || "Demasiados intentos. Intente más tarde.")
      } else {
        const remaining = data.remainingAttempts
        let msg = data.error || "Error al iniciar sesión"
        if (remaining !== undefined && remaining <= 2) {
          msg += ` (${remaining} intento${remaining !== 1 ? "s" : ""} restante${remaining !== 1 ? "s" : ""})`
        }
        setError(msg)
      }
    } catch (err) {
      setError("Error de conexión. Intente de nuevo.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center px-4 py-8">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center space-y-2 px-4 sm:px-6">
          <div className="mx-auto w-28 h-28 sm:w-44 sm:h-24 flex items-center justify-center mb-2 sm:mb-4 mt-2 sm:mt-4">
          <img src="/logo.png" alt="Logo" className="w-24 h-24 sm:w-35 sm:h-35" />
          </div>
          <CardTitle className="text-xl sm:text-2xl font-bold text-gray-900">Regalo de Dios</CardTitle>
          <CardDescription className="text-sm text-gray-600">Ingrese sus credenciales para acceder</CardDescription>
        </CardHeader>
        <CardContent className="px-4 sm:px-6">
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username" className="text-sm font-medium text-gray-700">
                Usuario, Correo o Teléfono
              </Label>
              <Input
                id="username"
                type="text"
                placeholder="Ingrese su usuario, correo o teléfono"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full"
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium text-gray-700">
                Contraseña
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="Ingrese su contraseña"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full"
                disabled={isLoading}
              />
            </div>

            {error && (
              <Alert className="border-red-200 bg-red-50">
                <AlertDescription className="text-red-700">{error}</AlertDescription>
              </Alert>
            )}

            <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white h-11 text-base" disabled={isLoading}>
              {isLoading ? "Ingresando..." : "Ingresar al Dashboard"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
