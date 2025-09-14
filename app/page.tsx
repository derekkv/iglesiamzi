"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useRouter } from "next/navigation"

export default function LoginPage() {
  const [cedula, setCedula] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const users = [
    { cedula: "12345678", password: "pastor123", name: "Pastor Principal" },
    { cedula: "87654321", password: "admin123", name: "Administrador" },
  ]

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsLoading(true)

    if (!cedula.trim() || !password.trim()) {
      setError("Por favor complete todos los campos")
      setIsLoading(false)
      return
    }

    const user = users.find((u) => u.cedula === cedula && u.password === password)

    if (user) {
      localStorage.setItem("churchUser", JSON.stringify(user))
      router.push("/dashboard")
    } else {
      setError("Cédula o contraseña incorrecta")
    }

    setIsLoading(false)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
              />
            </svg>
          </div>
          <CardTitle className="text-2xl font-bold text-gray-900">Dashboard Iglesia</CardTitle>
          <CardDescription className="text-gray-600">Ingrese sus credenciales para acceder al sistema</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cedula" className="text-sm font-medium text-gray-700">
                Número de Cédula
              </Label>
              <Input
                id="cedula"
                type="text"
                placeholder="Ingrese su cédula"
                value={cedula}
                onChange={(e) => setCedula(e.target.value)}
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

            <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white" disabled={isLoading}>
              {isLoading ? "Ingresando..." : "Ingresar al Dashboard"}
            </Button>
          </form>

          <div className="mt-6 p-3 bg-gray-50 rounded-lg">
            <p className="text-xs text-gray-600 text-center">
              <strong>Usuarios de prueba:</strong>
              <br />
              Cédula: 12345678 - Contraseña: pastor123
              <br />
              Cédula: 87654321 - Contraseña: admin123
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
