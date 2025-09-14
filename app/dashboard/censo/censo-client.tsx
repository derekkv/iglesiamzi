"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Settings, Edit, Trash2, User, Church } from "lucide-react"
import { toast } from "sonner"

import { 
  deleteDatosIglesia, 
  getDatosIglesia, 
  postDatosIglesia, 
  putDatosIglesia, 
  deleteDatosPersonales, 
  getDatosPersonales, 
  postDatosPersonales, 
  putDatosPersonales 
} from "@/lib/senso"

interface DatosPersonales {
  id?: number
  cedula: string
  apellidos_nombres: string
  fecha_nacimiento?: string
  edad?: number
  es_cristiano: boolean
  bautizo: boolean
  tipo_sangre?: string
  estado_civil?: string
  sexo?: string
  capacidad_especial?: string
  porcentaje_discapacidad?: number
  tipo_discapacidad?: string
  celular?: string
  telefono_convencional?: string
  telefono_familiar?: string
  conyuge?: string
  correo?: string
  nivel_estudio?: string
  curso?: string
  acumuladecimos?: string
  hoja_vida?: string
  estado?: string
  fecha_registro_saite?: string
  fecha_registro_iess?: string
  direccion?: string
  ciudad?: string
}

interface DatosIglesia {
  id?: number
  cedula: string
  jornada_trabajo?: string
  cargo?: string
  local?: string
  fecha_ingreso?: string
  fecha_reingreso?: string
  fecha_salida?: string
  dias_por_mes?: number
  horas_diarias?: number
  horas_semanales?: number
  sueldo?: number
  tipo_pago?: string
  banco?: string
  numero_cuenta?: string
  interseccion?: string
  redil?: string
  ninos?: string
  otros?: string
}

interface Configuraciones {
  tipos_sangre: string[]
  estados_civiles: string[]
  capacidades_especiales: string[]
  niveles_estudio: string[]
  jornadas_trabajo: string[]
  cargos: string[]
  locales: string[]
  tipos_pago: string[]
  bancos: string[]
}

interface CensoClientProps {
  initialDatosPersonales: DatosPersonales[]
  initialDatosIglesia: DatosIglesia[]
  configuraciones: Configuraciones
}

export function CensoClient({
  initialDatosPersonales,
  initialDatosIglesia,
  configuraciones: initialConfiguraciones,
}: CensoClientProps) {
  const [datosPersonales, setDatosPersonales] = useState<DatosPersonales[]>(initialDatosPersonales)
  const [datosIglesia, setDatosIglesia] = useState<DatosIglesia[]>(initialDatosIglesia)
  const [configuraciones, setConfiguraciones] = useState<Configuraciones>(initialConfiguraciones)

  const [isPersonalModalOpen, setIsPersonalModalOpen] = useState(false)
  const [isIglesiaModalOpen, setIsIglesiaModalOpen] = useState(false)
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false)

  const [editingPersonal, setEditingPersonal] = useState<DatosPersonales | null>(null)
  const [editingIglesia, setEditingIglesia] = useState<DatosIglesia | null>(null)

  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState<number | null>(null)

  const [personalForm, setPersonalForm] = useState<DatosPersonales>({
    cedula: "",
    apellidos_nombres: "",
    es_cristiano: false,
    bautizo: false,
  })

  const [iglesiaForm, setIglesiaForm] = useState<DatosIglesia>({
    cedula: "",
  })

  const resetPersonalForm = () => {
    setPersonalForm({
      cedula: "",
      apellidos_nombres: "",
      es_cristiano: false,
      bautizo: false,
    })
    setEditingPersonal(null)
  }

  const resetIglesiaForm = () => {
    setIglesiaForm({
      cedula: "",
    })
    setEditingIglesia(null)
  }

  const handleSavePersonal = async () => {
    if (!personalForm.cedula || !personalForm.apellidos_nombres) {
      toast("Error", {
        description: "Cédula y nombres son campos obligatorios",
      })
      return
    }

    setIsSaving(true)
    try {
      let result
      if (editingPersonal) {
        result = await putDatosPersonales({ ...personalForm, id: editingPersonal.id })
      } else {
        result = await postDatosPersonales(personalForm)
      }

      if (result.error) throw result.error

      if (editingPersonal) {
        setDatosPersonales((prev) => prev.map((item) => (item.id === editingPersonal.id ? result.data : item)))
      } else {
        setDatosPersonales((prev) => [...prev, result.data])
      }

      toast("Exito", {
        description: `Datos personales ${editingPersonal ? "actualizados" : "guardados"} correctamente`,
      })

      setIsPersonalModalOpen(false)
      resetPersonalForm()
    } catch (error) {
      toast("Error", {
        description: "No se pudieron guardar los datos",
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleSaveIglesia = async () => {
    if (!iglesiaForm.cedula) {
      toast("Error", {
        description: "Cédula es campo obligatorio",
      })
      return
    }

    setIsSaving(true)
    try {
      let result
      if (editingIglesia) {
        result = await putDatosIglesia({ ...iglesiaForm, id: editingIglesia.id })
      } else {
        result = await postDatosIglesia(iglesiaForm)
      }

      if (result.error) throw result.error

      if (editingIglesia) {
        setDatosIglesia((prev) => prev.map((item) => (item.id === editingIglesia.id ? result.data : item)))
      } else {
        setDatosIglesia((prev) => [...prev, result.data])
      }

      toast("Exito", {
        description: `Datos de iglesia ${editingIglesia ? "actualizados" : "guardados"} correctamente`,
      })

      setIsIglesiaModalOpen(false)
      resetIglesiaForm()
    } catch (error) {
      toast("Error", {
        description: "No se pudieron guardar los datos",
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (type: "personal" | "iglesia", id: number) => {
    setIsDeleting(id)
    try {
      let result
      if (type === "personal") {
        result = await deleteDatosPersonales(id.toString())
      } else {
        result = await deleteDatosIglesia(id.toString())
      }

      if (result.error) throw result.error

      if (type === "personal") {
        setDatosPersonales((prev) => prev.filter((item) => item.id !== id))
      } else {
        setDatosIglesia((prev) => prev.filter((item) => item.id !== id))
      }

      toast("Éxito", {
        description: "Registro eliminado correctamente",
      })
    } catch (error) {
      toast("Error", {
        description: "No se pudo eliminar el registro",
      })
    } finally {
      setIsDeleting(null)
    }
  }

  const handleEditPersonal = (item: DatosPersonales) => {
    setEditingPersonal(item)
    setPersonalForm(item)
    setIsPersonalModalOpen(true)
  }

  const handleEditIglesia = (item: DatosIglesia) => {
    setEditingIglesia(item)
    setIglesiaForm(item)
    setIsIglesiaModalOpen(true)
  }

      if (!datosIglesia || !datosPersonales) {
    return (

           <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Redirigiendo...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header con botones principales */}
      <div className="flex flex-wrap gap-4 justify-between items-center">
        <div className="flex gap-4">
          <Dialog open={isPersonalModalOpen} onOpenChange={setIsPersonalModalOpen}>
            <DialogTrigger asChild>
              <Button onClick={resetPersonalForm} className="bg-green-600 hover:bg-green-700">
                <User className="w-4 h-4 mr-2" />
                Datos Personales
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="bg-green-500 text-white p-3 rounded-t">
                  {editingPersonal ? "Editar" : "Agregar"} Datos Personales
                </DialogTitle>
              </DialogHeader>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4">
                <div>
                  <Label htmlFor="cedula">Cédula *</Label>
                  <Input
                    id="cedula"
                    value={personalForm.cedula}
                    onChange={(e) => setPersonalForm((prev) => ({ ...prev, cedula: e.target.value }))}
                    placeholder="Número de cédula"
                  />
                </div>

                <div>
                  <Label htmlFor="apellidos_nombres">Apellidos y Nombres *</Label>
                  <Input
                    id="apellidos_nombres"
                    value={personalForm.apellidos_nombres}
                    onChange={(e) => setPersonalForm((prev) => ({ ...prev, apellidos_nombres: e.target.value }))}
                    placeholder="Apellidos y nombres completos"
                  />
                </div>

                <div>
                  <Label htmlFor="fecha_nacimiento">Fecha de Nacimiento</Label>
                  <Input
                    id="fecha_nacimiento"
                    type="date"
                    value={personalForm.fecha_nacimiento || ""}
                    onChange={(e) => setPersonalForm((prev) => ({ ...prev, fecha_nacimiento: e.target.value }))}
                  />
                </div>

                <div>
                  <Label htmlFor="edad">Edad</Label>
                  <Input
                    id="edad"
                    type="number"
                    value={personalForm.edad || ""}
                    onChange={(e) =>
                      setPersonalForm((prev) => ({ ...prev, edad: Number.parseInt(e.target.value) || undefined }))
                    }
                    placeholder="Edad en años"
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="es_cristiano"
                    checked={personalForm.es_cristiano}
                    onCheckedChange={(checked) =>
                      setPersonalForm((prev) => ({ ...prev, es_cristiano: checked as boolean }))
                    }
                  />
                  <Label htmlFor="es_cristiano">Es Cristiano</Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="bautizo"
                    checked={personalForm.bautizo}
                    onCheckedChange={(checked) => setPersonalForm((prev) => ({ ...prev, bautizo: checked as boolean }))}
                  />
                  <Label htmlFor="bautizo">Bautizado</Label>
                </div>

                <div>
                  <Label htmlFor="tipo_sangre">Tipo de Sangre</Label>
                  <Select
                    value={personalForm.tipo_sangre || ""}
                    onValueChange={(value) => setPersonalForm((prev) => ({ ...prev, tipo_sangre: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar tipo de sangre" />
                    </SelectTrigger>
                    <SelectContent>
                      {configuraciones.tipos_sangre.map((tipo) => (
                        <SelectItem key={tipo} value={tipo}>
                          {tipo}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="estado_civil">Estado Civil</Label>
                  <Select
                    value={personalForm.estado_civil || ""}
                    onValueChange={(value) => setPersonalForm((prev) => ({ ...prev, estado_civil: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar estado civil" />
                    </SelectTrigger>
                    <SelectContent>
                      {configuraciones.estados_civiles.map((estado) => (
                        <SelectItem key={estado} value={estado}>
                          {estado}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="sexo">Sexo</Label>
                  <Select
                    value={personalForm.sexo || ""}
                    onValueChange={(value) => setPersonalForm((prev) => ({ ...prev, sexo: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar sexo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Masculino">Masculino</SelectItem>
                      <SelectItem value="Femenino">Femenino</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="capacidad_especial">Capacidad Especial</Label>
                  <Select
                    value={personalForm.capacidad_especial || ""}
                    onValueChange={(value) => setPersonalForm((prev) => ({ ...prev, capacidad_especial: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar capacidad especial" />
                    </SelectTrigger>
                    <SelectContent>
                      {configuraciones.capacidades_especiales.map((capacidad) => (
                        <SelectItem key={capacidad} value={capacidad}>
                          {capacidad}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="porcentaje_discapacidad">Porcentaje Discapacidad</Label>
                  <Input
                    id="porcentaje_discapacidad"
                    type="number"
                    step="0.01"
                    value={personalForm.porcentaje_discapacidad || ""}
                    onChange={(e) =>
                      setPersonalForm((prev) => ({
                        ...prev,
                        porcentaje_discapacidad: Number.parseFloat(e.target.value) || undefined,
                      }))
                    }
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <Label htmlFor="celular">Celular</Label>
                  <Input
                    id="celular"
                    value={personalForm.celular || ""}
                    onChange={(e) => setPersonalForm((prev) => ({ ...prev, celular: e.target.value }))}
                    placeholder="Número de celular"
                  />
                </div>

                <div>
                  <Label htmlFor="telefono_convencional">Teléfono Convencional</Label>
                  <Input
                    id="telefono_convencional"
                    value={personalForm.telefono_convencional || ""}
                    onChange={(e) => setPersonalForm((prev) => ({ ...prev, telefono_convencional: e.target.value }))}
                    placeholder="Teléfono fijo"
                  />
                </div>

                <div>
                  <Label htmlFor="correo">Correo Electrónico</Label>
                  <Input
                    id="correo"
                    type="email"
                    value={personalForm.correo || ""}
                    onChange={(e) => setPersonalForm((prev) => ({ ...prev, correo: e.target.value }))}
                    placeholder="correo@ejemplo.com"
                  />
                </div>

                <div>
                  <Label htmlFor="nivel_estudio">Nivel de Estudio</Label>
                  <Select
                    value={personalForm.nivel_estudio || ""}
                    onValueChange={(value) => setPersonalForm((prev) => ({ ...prev, nivel_estudio: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar nivel de estudio" />
                    </SelectTrigger>
                    <SelectContent>
                      {configuraciones.niveles_estudio.map((nivel) => (
                        <SelectItem key={nivel} value={nivel}>
                          {nivel}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="md:col-span-2">
                  <Label htmlFor="direccion">Dirección</Label>
                  <Textarea
                    id="direccion"
                    value={personalForm.direccion || ""}
                    onChange={(e) => setPersonalForm((prev) => ({ ...prev, direccion: e.target.value }))}
                    placeholder="Dirección completa"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 p-4 border-t">
                <Button variant="outline" onClick={() => setIsPersonalModalOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleSavePersonal} disabled={isSaving} className="bg-green-600 hover:bg-green-700">
                  {isSaving ? "Guardando..." : editingPersonal ? "Actualizar" : "Guardar"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={isIglesiaModalOpen} onOpenChange={setIsIglesiaModalOpen}>
            <DialogTrigger asChild>
              <Button onClick={resetIglesiaForm} className="bg-orange-600 hover:bg-orange-700">
                <Church className="w-4 h-4 mr-2" />
                Datos Iglesia
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="bg-orange-500 text-white p-3 rounded-t">
                  {editingIglesia ? "Editar" : "Agregar"} Datos de Iglesia
                </DialogTitle>
              </DialogHeader>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4">
                <div>
                  <Label htmlFor="cedula_iglesia">Cédula *</Label>
                  <Input
                    id="cedula_iglesia"
                    value={iglesiaForm.cedula}
                    onChange={(e) => setIglesiaForm((prev) => ({ ...prev, cedula: e.target.value }))}
                    placeholder="Número de cédula"
                  />
                </div>

                <div>
                  <Label htmlFor="jornada_trabajo">Jornada de Trabajo</Label>
                  <Select
                    value={iglesiaForm.jornada_trabajo || ""}
                    onValueChange={(value) => setIglesiaForm((prev) => ({ ...prev, jornada_trabajo: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar jornada" />
                    </SelectTrigger>
                    <SelectContent>
                      {configuraciones.jornadas_trabajo.map((jornada) => (
                        <SelectItem key={jornada} value={jornada}>
                          {jornada}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="cargo">Cargo</Label>
                  <Select
                    value={iglesiaForm.cargo || ""}
                    onValueChange={(value) => setIglesiaForm((prev) => ({ ...prev, cargo: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar cargo" />
                    </SelectTrigger>
                    <SelectContent>
                      {configuraciones.cargos.map((cargo) => (
                        <SelectItem key={cargo} value={cargo}>
                          {cargo}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="local">Local</Label>
                  <Select
                    value={iglesiaForm.local || ""}
                    onValueChange={(value) => setIglesiaForm((prev) => ({ ...prev, local: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar local" />
                    </SelectTrigger>
                    <SelectContent>
                      {configuraciones.locales.map((local) => (
                        <SelectItem key={local} value={local}>
                          {local}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="fecha_ingreso">Fecha Ingreso</Label>
                  <Input
                    id="fecha_ingreso"
                    type="date"
                    value={iglesiaForm.fecha_ingreso || ""}
                    onChange={(e) => setIglesiaForm((prev) => ({ ...prev, fecha_ingreso: e.target.value }))}
                  />
                </div>

                <div>
                  <Label htmlFor="sueldo">Sueldo</Label>
                  <Input
                    id="sueldo"
                    type="number"
                    step="0.01"
                    value={iglesiaForm.sueldo || ""}
                    onChange={(e) =>
                      setIglesiaForm((prev) => ({ ...prev, sueldo: Number.parseFloat(e.target.value) || undefined }))
                    }
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <Label htmlFor="tipo_pago">Tipo de Pago</Label>
                  <Select
                    value={iglesiaForm.tipo_pago || ""}
                    onValueChange={(value) => setIglesiaForm((prev) => ({ ...prev, tipo_pago: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar tipo de pago" />
                    </SelectTrigger>
                    <SelectContent>
                      {configuraciones.tipos_pago.map((tipo) => (
                        <SelectItem key={tipo} value={tipo}>
                          {tipo}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="banco">Banco</Label>
                  <Select
                    value={iglesiaForm.banco || ""}
                    onValueChange={(value) => setIglesiaForm((prev) => ({ ...prev, banco: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar banco" />
                    </SelectTrigger>
                    <SelectContent>
                      {configuraciones.bancos.map((banco) => (
                        <SelectItem key={banco} value={banco}>
                          {banco}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="numero_cuenta">Número de Cuenta</Label>
                  <Input
                    id="numero_cuenta"
                    value={iglesiaForm.numero_cuenta || ""}
                    onChange={(e) => setIglesiaForm((prev) => ({ ...prev, numero_cuenta: e.target.value }))}
                    placeholder="Número de cuenta bancaria"
                  />
                </div>

                <div>
                  <Label htmlFor="horas_diarias">Horas Diarias</Label>
                  <Input
                    id="horas_diarias"
                    type="number"
                    step="0.5"
                    value={iglesiaForm.horas_diarias || ""}
                    onChange={(e) =>
                      setIglesiaForm((prev) => ({
                        ...prev,
                        horas_diarias: Number.parseFloat(e.target.value) || undefined,
                      }))
                    }
                    placeholder="8.0"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 p-4 border-t">
                <Button variant="outline" onClick={() => setIsIglesiaModalOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleSaveIglesia} disabled={isSaving} className="bg-orange-600 hover:bg-orange-700">
                  {isSaving ? "Guardando..." : editingIglesia ? "Actualizar" : "Guardar"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <Button variant="outline" onClick={() => setIsConfigModalOpen(true)}>
          <Settings className="w-4 h-4 mr-2" />
          Configuraciones
        </Button>
      </div>

      {/* Tablas de datos */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Tabla Datos Personales */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5" />
              Datos Personales ({datosPersonales.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cédula</TableHead>
                    <TableHead>Nombres</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {datosPersonales.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.cedula}</TableCell>
                      <TableCell>{item.apellidos_nombres}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {item.es_cristiano && <Badge variant="secondary">Cristiano</Badge>}
                          {item.bautizo && <Badge variant="outline">Bautizado</Badge>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => handleEditPersonal(item)}>
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleDelete("personal", item.id!)}
                            disabled={isDeleting === item.id}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Tabla Datos Iglesia */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Church className="w-5 h-5" />
              Datos de Iglesia ({datosIglesia.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cédula</TableHead>
                    <TableHead>Cargo</TableHead>
                    <TableHead>Local</TableHead>
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {datosIglesia.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.cedula}</TableCell>
                      <TableCell>{item.cargo || "N/A"}</TableCell>
                      <TableCell>{item.local || "N/A"}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => handleEditIglesia(item)}>
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleDelete("iglesia", item.id!)}
                            disabled={isDeleting === item.id}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Modal de Configuraciones */}
   <Dialog open={isConfigModalOpen} onOpenChange={setIsConfigModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Configuraciones del Sistema</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">Aquí puedes configurar las opciones disponibles en los formularios.</p>
            {/* Aquí se puede agregar la funcionalidad para editar las configuraciones */}
            <div className="text-center py-8 text-gray-500">Funcionalidad de configuración en desarrollo</div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
