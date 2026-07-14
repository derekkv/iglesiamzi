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
import { ArrowLeft } from "lucide-react"


export default function LoginPage() {
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()
  const { login: setAuthUser } = useAuth()

  // Recuperación de contraseña
  const [recoveryMode, setRecoveryMode] = useState<"login" | "request" | "code" | "reset">("login")
  const [recoveryIdentifier, setRecoveryIdentifier] = useState("")
  const [recoveryCode, setRecoveryCode] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [recoveryMsg, setRecoveryMsg] = useState("")
  const [recoveryLoading, setRecoveryLoading] = useState(false)

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

  // Paso 1: Solicitar código
  const handleRequestCode = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setRecoveryMsg("")
    if (!recoveryIdentifier.trim()) { setError("Ingrese su usuario, correo o teléfono"); return }
    setRecoveryLoading(true)
    try {
      const res = await fetch("/api/recover-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "request", identifier: recoveryIdentifier }),
      })
      const data = await res.json()
      if (res.ok) {
        setRecoveryMsg("Se envió un código de 6 dígitos a tu correo registrado.")
        setRecoveryMode("code")
      } else {
        setError(data.error || "Error al solicitar recuperación")
      }
    } catch { setError("Error de conexión") }
    finally { setRecoveryLoading(false) }
  }

  // Paso 2: Verificar código
  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setRecoveryMsg("")
    if (!recoveryCode.trim()) { setError("Ingrese el código"); return }
    setRecoveryLoading(true)
    try {
      const res = await fetch("/api/recover-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "verify", code: recoveryCode }),
      })
      const data = await res.json()
      if (res.ok && data.valid) {
        setRecoveryMode("reset")
      } else {
        setError(data.error || "Código inválido")
      }
    } catch { setError("Error de conexión") }
    finally { setRecoveryLoading(false) }
  }

  // Paso 3: Cambiar contraseña
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setRecoveryMsg("")
    if (!newPassword || !confirmPassword) { setError("Complete ambos campos"); return }
    if (newPassword.length < 6) { setError("La contraseña debe tener al menos 6 caracteres"); return }
    if (newPassword !== confirmPassword) { setError("Las contraseñas no coinciden"); return }
    setRecoveryLoading(true)
    try {
      const res = await fetch("/api/recover-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reset", code: recoveryCode, newPassword }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setRecoveryMsg("Contraseña actualizada correctamente. Ya puede iniciar sesión.")
        setTimeout(() => {
          setRecoveryMode("login")
          setRecoveryMsg("")
          setRecoveryCode("")
          setNewPassword("")
          setConfirmPassword("")
          setRecoveryIdentifier("")
        }, 2000)
      } else {
        setError(data.error || "Error al cambiar contraseña")
      }
    } catch { setError("Error de conexión") }
    finally { setRecoveryLoading(false) }
  }

  const resetRecovery = () => {
    setRecoveryMode("login")
    setError("")
    setRecoveryMsg("")
    setRecoveryIdentifier("")
    setRecoveryCode("")
    setNewPassword("")
    setConfirmPassword("")
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center px-4 py-8">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center space-y-2 px-4 sm:px-6">
          <div className="mx-auto w-28 h-28 sm:w-44 sm:h-24 flex items-center justify-center mb-2 sm:mb-4 mt-2 sm:mt-4">
            <img src="/logo.png" alt="Logo" className="w-24 h-24 sm:w-35 sm:h-35" />
          </div>
          <CardTitle className="text-xl sm:text-2xl font-bold text-gray-900">Regalo de Dios</CardTitle>
          <CardDescription className="text-sm text-gray-600">
            {recoveryMode === "login" && "Ingrese sus credenciales para acceder"}
            {recoveryMode === "request" && "Recuperar contraseña"}
            {recoveryMode === "code" && "Ingrese el código enviado"}
            {recoveryMode === "reset" && "Nueva contraseña"}
          </CardDescription>
        </CardHeader>
        <CardContent className="px-4 sm:px-6">
          {/* LOGIN */}
          {recoveryMode === "login" && (
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
                  noUppercase
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

              <button
                type="button"
                onClick={() => { setRecoveryMode("request"); setError("") }}
                className="w-full text-center text-sm text-blue-600 hover:text-blue-800 hover:underline mt-2"
              >
                ¿Olvidaste tu contraseña?
              </button>
            </form>
          )}

          {/* RECUPERACIÓN - Paso 1: Solicitar código */}
          {recoveryMode === "request" && (
            <form onSubmit={handleRequestCode} className="space-y-4">
              <p className="text-sm text-gray-600">Ingresa tu usuario, correo o teléfono y te enviaremos un código de verificación al correo registrado.</p>
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700">Usuario, Correo o Teléfono</Label>
                <Input
                  type="text"
                  placeholder="Ingrese su usuario, correo o teléfono"
                  value={recoveryIdentifier}
                  onChange={(e) => setRecoveryIdentifier(e.target.value)}
                  disabled={recoveryLoading}
                  noUppercase
                />
              </div>

              {error && <Alert className="border-red-200 bg-red-50"><AlertDescription className="text-red-700">{error}</AlertDescription></Alert>}
              {recoveryMsg && <Alert className="border-green-200 bg-green-50"><AlertDescription className="text-green-700">{recoveryMsg}</AlertDescription></Alert>}

              <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white h-11" disabled={recoveryLoading}>
                {recoveryLoading ? "Enviando..." : "Enviar código"}
              </Button>
              <button type="button" onClick={resetRecovery} className="w-full flex items-center justify-center gap-1 text-sm text-gray-600 hover:text-gray-800">
                <ArrowLeft className="w-3 h-3" /> Volver al login
              </button>
            </form>
          )}

          {/* RECUPERACIÓN - Paso 2: Ingresar código */}
          {recoveryMode === "code" && (
            <form onSubmit={handleVerifyCode} className="space-y-4">
              <p className="text-sm text-gray-600">Revisa tu correo e ingresa el código de 6 dígitos que recibiste.</p>
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700">Código de verificación</Label>
                <Input
                  type="text"
                  placeholder="000000"
                  value={recoveryCode}
                  onChange={(e) => setRecoveryCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  className="text-center text-2xl tracking-widest font-bold"
                  maxLength={6}
                  disabled={recoveryLoading}
                />
              </div>

              {error && <Alert className="border-red-200 bg-red-50"><AlertDescription className="text-red-700">{error}</AlertDescription></Alert>}
              {recoveryMsg && <Alert className="border-green-200 bg-green-50"><AlertDescription className="text-green-700">{recoveryMsg}</AlertDescription></Alert>}

              <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white h-11" disabled={recoveryLoading || recoveryCode.length < 6}>
                {recoveryLoading ? "Verificando..." : "Verificar código"}
              </Button>
              <button type="button" onClick={resetRecovery} className="w-full flex items-center justify-center gap-1 text-sm text-gray-600 hover:text-gray-800">
                <ArrowLeft className="w-3 h-3" /> Volver al login
              </button>
            </form>
          )}

          {/* RECUPERACIÓN - Paso 3: Nueva contraseña */}
          {recoveryMode === "reset" && (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <p className="text-sm text-gray-600">Ingresa tu nueva contraseña.</p>
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700">Nueva contraseña</Label>
                <Input
                  type="password"
                  placeholder="Mínimo 6 caracteres"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  disabled={recoveryLoading}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700">Confirmar contraseña</Label>
                <Input
                  type="password"
                  placeholder="Repita la contraseña"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={recoveryLoading}
                />
              </div>

              {error && <Alert className="border-red-200 bg-red-50"><AlertDescription className="text-red-700">{error}</AlertDescription></Alert>}
              {recoveryMsg && <Alert className="border-green-200 bg-green-50"><AlertDescription className="text-green-700">{recoveryMsg}</AlertDescription></Alert>}

              <Button type="submit" className="w-full bg-green-600 hover:bg-green-700 text-white h-11" disabled={recoveryLoading}>
                {recoveryLoading ? "Guardando..." : "Cambiar contraseña"}
              </Button>
              <button type="button" onClick={resetRecovery} className="w-full flex items-center justify-center gap-1 text-sm text-gray-600 hover:text-gray-800">
                <ArrowLeft className="w-3 h-3" /> Volver al login
              </button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
