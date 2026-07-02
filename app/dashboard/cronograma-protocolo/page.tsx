"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useRealtime } from "@/hooks/use-realtime"
import { PermissionsGuard } from "@/lib/permissions-guard"
import { useAuth } from "@/contexts/auth-context"
import { cronogramaService, LUGARES, type CronogramaEntry } from "@/lib/mod/cronograma-service"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

import { ArrowLeft, Plus, Trash2, Search, X } from "lucide-react"

const MODULE_NAME = "cronograma-protocolo"

function CronogramaContent({ canEdit }: { canEdit: boolean }) {
  const router = useRouter()
  const { user } = useAuth()

  const [entries, setEntries] = useState<CronogramaEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Form
  const [showForm, setShowForm] = useState(false)
  const [selectedUser, setSelectedUser] = useState<{ id: string; username: string; displayName: string } | null>(null)
  const [lugar, setLugar] = useState("")
  const [fecha, setFecha] = useState("")

  // User search
  const [userQuery, setUserQuery] = useState("")
  const [userResults, setUserResults] = useState<{ id: string; username: string; displayName: string }[]>([])
  const [searching, setSearching] = useState(false)
  const [showResults, setShowResults] = useState(false)

  // Delete
  const [pendingDelete, setPendingDelete] = useState<CronogramaEntry | null>(null)

  useEffect(() => {
    loadEntries()
  }, [])

  useRealtime({ table: "cronograma_servicio", onChange: () => loadEntries(true) })

  const loadEntries = async (silent = false) => {
    try {
      if (!silent) setLoading(true)
      const data = await cronogramaService.getAll("protocolo")
      setEntries(data)
    } catch (error) {
      console.error("Error loading cronograma:", error)
    } finally {
      if (!silent) setLoading(false)
    }
  }

  const handleSearchUsers = async (query: string) => {
    setUserQuery(query)
    if (query.trim().length < 2) {
      setUserResults([])
      setShowResults(false)
      return
    }
    setSearching(true)
    try {
      const results = await cronogramaService.searchUsersWithModuleAccess(query, MODULE_NAME)
      setUserResults(results)
      setShowResults(true)
    } catch (error) {
      console.error("Error searching users:", error)
    } finally {
      setSearching(false)
    }
  }

  const handleSelectUser = (u: { id: string; username: string; displayName: string }) => {
    setSelectedUser(u)
    setUserQuery(u.displayName)
    setShowResults(false)
  }

  const handleSave = async () => {
    if (!selectedUser || !lugar || !fecha) return
    setSaving(true)
    try {
      await cronogramaService.create(
        {
          user_id: selectedUser.id,
          user_name: selectedUser.displayName,
          lugar,
          fecha,
          modulo: "protocolo",
        },
        { user_id: user!.id, user_name: user!.username }
      )
      // Reset form
      setSelectedUser(null)
      setUserQuery("")
      setLugar("")
      setFecha("")
      setShowForm(false)
      loadEntries()
    } catch (error) {
      console.error("Error saving:", error)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!pendingDelete?.id) return
    try {
      await cronogramaService.delete(pendingDelete.id, { user_id: user!.id, user_name: user!.username })
      setPendingDelete(null)
      loadEntries()
    } catch (error) {
      console.error("Error deleting:", error)
    }
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + "T12:00:00")
    const days = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"]
    const day = String(date.getDate()).padStart(2, "0")
    const month = String(date.getMonth() + 1).padStart(2, "0")
    const year = date.getFullYear()
    return `${days[date.getDay()]} ${day}/${month}/${year}`
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando cronograma...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard")} className="flex items-center space-x-2">
                <ArrowLeft className="w-4 h-4" /><span>Volver</span>
              </Button>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">Cronograma de Servicio</h1>
                <p className="text-sm text-gray-600">Protocolo</p>
              </div>
            </div>
            {canEdit && (
              <Button size="sm" onClick={() => setShowForm(!showForm)} className="flex items-center space-x-2">
                <Plus className="w-4 h-4" /><span>Asignar Servicio</span>
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Formulario */}
        {showForm && canEdit && (
          <Card className="border-blue-200 bg-blue-50/30">
            <CardHeader>
              <CardTitle className="text-lg">Asignar Nuevo Servicio</CardTitle>
              <CardDescription>Seleccione la persona, lugar y fecha del servicio</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Búsqueda de usuario */}
                <div className="space-y-1.5 relative">
                  <Label>Persona</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      value={userQuery}
                      onChange={(e) => handleSearchUsers(e.target.value)}
                      placeholder="Buscar por nombre..."
                      className="pl-9"
                    />
                    {selectedUser && (
                      <button
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
                        onClick={() => { setSelectedUser(null); setUserQuery(""); setUserResults([]) }}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  {showResults && userResults.length > 0 && (
                    <div className="absolute z-50 top-full mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {userResults.map((u) => (
                        <button
                          key={u.id}
                          className="w-full text-left px-4 py-2 hover:bg-blue-50 text-sm border-b last:border-0"
                          onClick={() => handleSelectUser(u)}
                        >
                          <span className="font-medium">{u.displayName}</span>
                          <span className="text-gray-400 ml-2">@{u.username}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {showResults && userResults.length === 0 && userQuery.length >= 2 && !searching && (
                    <div className="absolute z-50 top-full mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-sm text-gray-500 text-center">
                      No se encontraron usuarios
                    </div>
                  )}
                </div>

                {/* Lugar */}
                <div className="space-y-1.5">
                  <Label>Lugar</Label>
                  <Select value={lugar} onValueChange={setLugar}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar lugar" />
                    </SelectTrigger>
                    <SelectContent>
                      {LUGARES.map((l) => (
                        <SelectItem key={l} value={l}>{l}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Fecha */}
                <div className="space-y-1.5">
                  <Label>Fecha</Label>
                  <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
                </div>
              </div>

              <div className="flex justify-end gap-2 mt-4">
                <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
                <Button onClick={handleSave} disabled={saving || !selectedUser || !lugar || !fecha}>
                  {saving ? "Guardando..." : "Guardar"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Listado */}
        <Card>
          <CardHeader>
            <CardTitle>Servicios Asignados</CardTitle>
            <CardDescription>{entries.length} servicio{entries.length !== 1 ? "s" : ""} registrado{entries.length !== 1 ? "s" : ""}</CardDescription>
          </CardHeader>
          <CardContent>
            {entries.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <p>No hay servicios asignados aún.</p>
                {canEdit && <p className="text-sm mt-1">Usa el botón "Asignar Servicio" para agregar.</p>}
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Persona</TableHead>
                      <TableHead>Lugar</TableHead>
                      <TableHead>Fecha</TableHead>
                      {canEdit && <TableHead className="text-right">Acciones</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entries.map((entry) => {
                      const isPast = new Date(entry.fecha + "T23:59:59") < new Date()
                      return (
                        <TableRow key={entry.id} className={isPast ? "opacity-50" : ""}>
                          <TableCell className="font-medium">{entry.user_name}</TableCell>
                          <TableCell>{entry.lugar}</TableCell>
                          <TableCell>{formatDate(entry.fecha)}</TableCell>
                          {canEdit && (
                            <TableCell className="text-right">
                              <Button variant="ghost" size="icon" onClick={() => setPendingDelete(entry)}>
                                <Trash2 className="h-4 w-4 text-red-500" />
                              </Button>
                            </TableCell>
                          )}
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Confirmar eliminación */}
      <AlertDialog open={!!pendingDelete} onOpenChange={(open) => { if (!open) setPendingDelete(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar servicio?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará la asignación de {pendingDelete?.user_name} del {pendingDelete?.fecha ? formatDate(pendingDelete.fecha) : ""}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={handleDelete}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export default function CronogramaProtocoloPage() {
  return (
    <PermissionsGuard moduleName="cronograma-protocolo">
      {(canEdit) => <CronogramaContent canEdit={canEdit} />}
    </PermissionsGuard>
  )
}
