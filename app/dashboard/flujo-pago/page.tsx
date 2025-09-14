"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { paymentFlowService, type PaymentTable, type PaymentRow } from "@/lib/mod/payment-flow-service"

export default function FlujoPagoPage() {
  const [tables, setTables] = useState<PaymentTable[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isCreateTableModalOpen, setIsCreateTableModalOpen] = useState(false)
  const [isEditTableModalOpen, setIsEditTableModalOpen] = useState(false)
  const [isAddRowModalOpen, setIsAddRowModalOpen] = useState(false)
  const [isEditRowModalOpen, setIsEditRowModalOpen] = useState(false)
  const [selectedTable, setSelectedTable] = useState<PaymentTable | null>(null)
  const [editingTable, setEditingTable] = useState<PaymentTable | null>(null)
  const [editingRow, setEditingRow] = useState<PaymentRow | null>(null)
  const [newTableName, setNewTableName] = useState("")
  const [editTableName, setEditTableName] = useState("")
  const [saving, setSaving] = useState(false)
  // Form states for rows
  const [rowFormData, setRowFormData] = useState({
    fecha: "",
    beneficiarios: "",
    detalle: "",
    valor: "",
  })

  useEffect(() => {
    loadTables()
  }, [])

  const loadTables = async () => {
    try {
      setIsLoading(true)
      const tablesData = await paymentFlowService.getAllTables()
      setTables(tablesData)
    } catch (error) {
      console.error("Error loading tables:", error)
      alert("Error al cargar las tablas. Por favor, intente de nuevo.")
    } finally {
      setIsLoading(false)
    }
  }

  const resetRowForm = () => {
    setRowFormData({
      fecha: "",
      beneficiarios: "",
      detalle: "",
      valor: "",
    })
  }

  // Table functions
  const handleCreateTable = async () => {
    if (!newTableName.trim()) {
      alert("Por favor ingrese un nombre para la tabla")
      return
    }
setSaving(true)
    try {
      const newTable = await paymentFlowService.createTable(newTableName)
      setTables((prev) => [newTable, ...prev])
      setNewTableName("")
      setIsCreateTableModalOpen(false)
    } catch (error) {
      console.error("Error creating table:", error)
      alert("Error al crear la tabla. Por favor, intente de nuevo.")
    }finally {
      setSaving(false)
    }
  }

  const handleEditTable = async () => {
    if (!editTableName.trim() || !editingTable) {
      alert("Por favor ingrese un nombre válido")
      return
    }
setSaving(true)
    try {
      await paymentFlowService.updateTable(editingTable.id, editTableName)

      const updatedTable = {
        ...editingTable,
        nombre: editTableName.trim(),
      }

      setTables((prev) => prev.map((table) => (table.id === editingTable.id ? updatedTable : table)))

      if (selectedTable?.id === editingTable.id) {
        setSelectedTable(updatedTable)
      }

      setEditingTable(null)
      setEditTableName("")
      setIsEditTableModalOpen(false)
    } catch (error) {
      console.error("Error updating table:", error)
      alert("Error al actualizar la tabla. Por favor, intente de nuevo.")
    }finally {
      setSaving(false)
    }
  }

  const handleDeleteTable = async (tableId: string) => {
    try {
      await paymentFlowService.deleteTable(tableId)
      setTables((prev) => prev.filter((table) => table.id !== tableId))

      if (selectedTable?.id === tableId) {
        setSelectedTable(null)
      }
    } catch (error) {
      console.error("Error deleting table:", error)
      alert("Error al eliminar la tabla. Por favor, intente de nuevo.")
    }
  }

  const openEditTableModal = (table: PaymentTable) => {
    setEditingTable(table)
    setEditTableName(table.nombre)
    setIsEditTableModalOpen(true)
  }

  // Row functions
  const handleAddRow = async () => {
    if (
      !selectedTable ||
      !rowFormData.fecha ||
      !rowFormData.beneficiarios ||
      !rowFormData.detalle ||
      !rowFormData.valor
    ) {
      alert("Por favor complete todos los campos")
      return
    }
setSaving(true)
    try {
      const newRow = await paymentFlowService.createRow(selectedTable.id, {
        fecha: rowFormData.fecha,
        beneficiarios: rowFormData.beneficiarios,
        detalle: rowFormData.detalle,
        valor: Number.parseFloat(rowFormData.valor),
      })

      const updatedTable = {
        ...selectedTable,
        rows: [...selectedTable.rows, newRow],
      }

      setTables((prev) => prev.map((table) => (table.id === selectedTable.id ? updatedTable : table)))
      setSelectedTable(updatedTable)
      resetRowForm()
      setIsAddRowModalOpen(false)
    } catch (error) {
      console.error("Error adding row:", error)
      alert("Error al agregar la fila. Por favor, intente de nuevo.")
    }finally {
      setSaving(false)
    }
  }

  const handleEditRow = async () => {
    if (
      !selectedTable ||
      !editingRow ||
      !rowFormData.fecha ||
      !rowFormData.beneficiarios ||
      !rowFormData.detalle ||
      !rowFormData.valor
    ) {
      alert("Por favor complete todos los campos")
      return
    }
setSaving(true)
    try {
      await paymentFlowService.updateRow(editingRow.id, {
        fecha: rowFormData.fecha,
        beneficiarios: rowFormData.beneficiarios,
        detalle: rowFormData.detalle,
        valor: Number.parseFloat(rowFormData.valor),
      })

      const updatedRow: PaymentRow = {
        ...editingRow,
        fecha: rowFormData.fecha,
        beneficiarios: rowFormData.beneficiarios,
        detalle: rowFormData.detalle,
        valor: Number.parseFloat(rowFormData.valor),
      }

      const updatedTable = {
        ...selectedTable,
        rows: selectedTable.rows.map((row) => (row.id === editingRow.id ? updatedRow : row)),
      }

      setTables((prev) => prev.map((table) => (table.id === selectedTable.id ? updatedTable : table)))
      setSelectedTable(updatedTable)
      setEditingRow(null)
      resetRowForm()
      setIsEditRowModalOpen(false)
    } catch (error) {
      console.error("Error updating row:", error)
      alert("Error al actualizar la fila. Por favor, intente de nuevo.")
    }finally {
      setSaving(false)
    }
  }

  const handleDeleteRow = async (rowId: string) => {
    if (!selectedTable) return

    try {
      await paymentFlowService.deleteRow(rowId)

      const updatedTable = {
        ...selectedTable,
        rows: selectedTable.rows.filter((row) => row.id !== rowId),
      }

      setTables((prev) => prev.map((table) => (table.id === selectedTable.id ? updatedTable : table)))
      setSelectedTable(updatedTable)
    } catch (error) {
      console.error("Error deleting row:", error)
      alert("Error al eliminar la fila. Por favor, intente de nuevo.")
    }
  }

  const openEditRowModal = (row: PaymentRow) => {
    setEditingRow(row)
    setRowFormData({
      fecha: row.fecha,
      beneficiarios: row.beneficiarios,
      detalle: row.detalle,
      valor: row.valor.toString(),
    })
    setIsEditRowModalOpen(true)
  }

  const getTotalValue = (table: PaymentTable) => {
    return table.rows.reduce((sum, row) => sum + row.valor, 0)
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      minimumFractionDigits: 0,
    }).format(value)
  }

  // Function to generate PDF
  const generatePDF = (table: PaymentTable) => {
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>${table.nombre}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          .header { text-align: center; margin-bottom: 30px; }
          .table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          .table th, .table td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          .table th { background-color: #f2f2f2; font-weight: bold; }
          .total-row { background-color: #f9f9f9; font-weight: bold; }
          .text-right { text-align: right; }
          .text-center { text-align: center; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>${table.nombre}</h1>
          <p>Fecha de creación: ${table.fechaCreacion}</p>
          <p>Total de filas: ${table.rows.length}</p>
        </div>
        <table class="table">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Beneficiarios</th>
              <th>Detalle</th>
              <th class="text-right">Valor</th>
            </tr>
          </thead>
          <tbody>
            ${table.rows.map((row) => ``).join("")}
            <tr class="total-row">
              <td colspan="3"><strong>TOTAL</strong></td>
              <td class="text-right"><strong>${formatCurrency(getTotalValue(table))}</strong></td>
            </tr>
          </tbody>
        </table>
      </body>
      </html>
    `

    const blob = new Blob([htmlContent], { type: "text/html" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `${table.nombre.replace(/[^a-z0-9]/gi, "_")}.html`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando tablas de pago...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center mb-6">
          <button
            onClick={() => window.history.back()}
            className="mr-4 px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
            style={{ color: "#374151" }}
          >
            ← Volver
          </button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-gray-900">Flujo de Pago</h1>
            <p className="text-gray-600">Gestión de tablas de pagos y beneficiarios</p>
          </div>
        </div>

        <div className="flex justify-between items-center mb-6">
          <div>
            {selectedTable && (
              <div>
                <h2 className="text-xl font-semibold text-gray-800">{selectedTable.nombre}</h2>
                <p className="text-sm text-gray-600">Creada el {selectedTable.fechaCreacion}</p>
              </div>
            )}
          </div>
          <div className="flex space-x-2">
            <Dialog open={isCreateTableModalOpen} onOpenChange={setIsCreateTableModalOpen}>
              <DialogTrigger asChild>
                <Button>➕ Nueva Tabla</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Crear Nueva Tabla de Pagos</DialogTitle>
                  <DialogDescription>Ingrese el nombre para la nueva tabla</DialogDescription>
                </DialogHeader>
                <div>
                  <Label htmlFor="tableName">Nombre de la tabla</Label>
                  <Input
                    id="tableName"
                    placeholder="Ej: Pagos Enero 2025"
                    value={newTableName}
                    onChange={(e) => setNewTableName(e.target.value)}
                    onKeyPress={(e) => e.key === "Enter" && handleCreateTable()}
                  />
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsCreateTableModalOpen(false)}>
                    Cancelar
                  </Button>
                
                  <Button onClick={handleCreateTable} disabled={saving}>
                    {saving ? "Guardando..." : "Crear Tabla"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {selectedTable && <Button onClick={() => setIsAddRowModalOpen(true)}>➕ Agregar Fila</Button>}
          </div>
        </div>

        {/* Tables List */}
        {!selectedTable && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            {[...tables].reverse().map((table) => (
              <Card key={table.id} className="cursor-pointer hover:shadow-lg transition-shadow">
                <CardHeader>
                  <CardTitle className="flex justify-between items-center">
                    <span>{table.nombre}</span>
                    <div className="flex space-x-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation()
                          generatePDF(table)
                        }}
                        title="Descargar PDF"
                      >
                        📄
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation()
                          openEditTableModal(table)
                        }}
                      >
                        ✏️
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="sm" variant="destructive" onClick={(e) => e.stopPropagation()}>
                            🗑️
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>¿Eliminar tabla?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Esta acción no se puede deshacer. Se eliminará permanentemente la tabla "{table.nombre}" y
                              todas sus filas.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDeleteTable(table.id)}
                              className="bg-red-600 hover:bg-red-700"
                            >
                              Eliminar
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent onClick={() => setSelectedTable(table)}>
                  <div className="space-y-2">
                    <p className="text-sm text-gray-600">Creada: {table.fechaCreacion}</p>
                    <p className="text-sm text-gray-600">Filas: {table.rows.length}</p>
                    <p className="text-lg font-semibold text-green-600">
                      Total: {formatCurrency(getTotalValue(table))}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
            {tables.length === 0 && (
              <div className="col-span-full text-center py-12 text-gray-500">
                <p className="text-lg mb-2">No hay tablas de pago creadas</p>
                <p>Haga clic en "Nueva Tabla" para comenzar</p>
              </div>
            )}
          </div>
        )}

        {/* Selected Table View */}
        {selectedTable && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <Button variant="outline" onClick={() => setSelectedTable(null)}>
                ← Volver a la lista
              </Button>
              <div className="flex space-x-2">
                <Button variant="outline" onClick={() => generatePDF(selectedTable)}>
                  📄 Descargar PDF
                </Button>
                <Button variant="outline" onClick={() => openEditTableModal(selectedTable)}>
                  ✏️ Editar Tabla
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive">🗑️ Eliminar Tabla</Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>¿Eliminar tabla?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Esta acción no se puede deshacer. Se eliminará permanentemente la tabla "{selectedTable.nombre}"
                        y todas sus filas.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => handleDeleteTable(selectedTable.id)}
                        className="bg-red-600 hover:bg-red-700"
                      >
                        Eliminar
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Filas de Pago</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-3 font-semibold">Fecha</th>
                        <th className="text-left p-3 font-semibold">Beneficiarios</th>
                        <th className="text-left p-3 font-semibold">Detalle</th>
                        <th className="text-right p-3 font-semibold">Valor</th>
                        <th className="text-center p-3 font-semibold">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedTable.rows.map((row) => (
                        <tr key={row.id} className="border-b hover:bg-gray-50">
                          <td className="p-3">{row.fecha}</td>
                          <td className="p-3">{row.beneficiarios}</td>
                          <td className="p-3">{row.detalle}</td>
                          <td className="p-3 text-right font-medium">{formatCurrency(row.valor)}</td>
                          <td className="p-3">
                            <div className="flex justify-center space-x-1">
                              <Button size="sm" variant="outline" onClick={() => openEditRowModal(row)}>
                                ✏️
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button size="sm" variant="destructive">
                                    🗑️
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>¿Eliminar fila?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Esta acción no se puede deshacer. Se eliminará permanentemente esta fila de pago.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => handleDeleteRow(row.id)}
                                      className="bg-red-600 hover:bg-red-700"
                                    >
                                      Eliminar
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {/* Total Row */}
                      <tr className="border-t-2 border-gray-300 bg-gray-50 font-semibold">
                        <td className="p-3" colSpan={3}>
                          <strong>TOTAL</strong>
                        </td>
                        <td className="p-3 text-right text-lg">
                          <strong>{formatCurrency(getTotalValue(selectedTable))}</strong>
                        </td>
                        <td className="p-3"></td>
                      </tr>
                    </tbody>
                  </table>
                  {selectedTable.rows.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      No hay filas en esta tabla. Haga clic en "Agregar Fila" para comenzar.
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Modals */}
        {/* Edit Table Modal */}
        <Dialog open={isEditTableModalOpen} onOpenChange={setIsEditTableModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar Tabla</DialogTitle>
              <DialogDescription>Modifique el nombre de la tabla</DialogDescription>
            </DialogHeader>
            <div>
              <Label htmlFor="editTableName">Nombre de la tabla</Label>
              <Input
                id="editTableName"
                value={editTableName}
                onChange={(e) => setEditTableName(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && handleEditTable()}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditTableModalOpen(false)}>
                Cancelar
              </Button>
     
                      <Button onClick={handleEditTable} disabled={saving}>
                    {saving ? "Guardando..." : "Guardar"}
                  </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Add Row Modal */}
        <Dialog open={isAddRowModalOpen} onOpenChange={setIsAddRowModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Agregar Nueva Fila</DialogTitle>
              <DialogDescription>Complete la información del pago</DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="fecha">Fecha</Label>
                <Input
                  id="fecha"
                  type="date"
                  value={rowFormData.fecha}
                  onChange={(e) => setRowFormData({ ...rowFormData, fecha: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="valor">Valor</Label>
                <Input
                  id="valor"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={rowFormData.valor}
                  onChange={(e) => setRowFormData({ ...rowFormData, valor: e.target.value })}
                />
              </div>
              <div className="col-span-2">
                <Label htmlFor="beneficiarios">Beneficiarios</Label>
                <Input
                  id="beneficiarios"
                  placeholder="Nombre de los beneficiarios"
                  value={rowFormData.beneficiarios}
                  onChange={(e) => setRowFormData({ ...rowFormData, beneficiarios: e.target.value })}
                />
              </div>
              <div className="col-span-2">
                <Label htmlFor="detalle">Detalle</Label>
                <Input
                  id="detalle"
                  placeholder="Descripción del pago"
                  value={rowFormData.detalle}
                  onChange={(e) => setRowFormData({ ...rowFormData, detalle: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddRowModalOpen(false)}>
                Cancelar
              </Button>
          
                      <Button onClick={handleAddRow} disabled={saving}>
                    {saving ? "Guardando..." : "Agregar Fila"}
                  </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Row Modal */}
        <Dialog open={isEditRowModalOpen} onOpenChange={setIsEditRowModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar Fila</DialogTitle>
              <DialogDescription>Modifique la información del pago</DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="editFecha">Fecha</Label>
                <Input
                  id="editFecha"
                  type="date"
                  value={rowFormData.fecha}
                  onChange={(e) => setRowFormData({ ...rowFormData, fecha: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="editValor">Valor</Label>
                <Input
                  id="editValor"
                  type="number"
                  step="0.01"
                  value={rowFormData.valor}
                  onChange={(e) => setRowFormData({ ...rowFormData, valor: e.target.value })}
                />
              </div>
              <div className="col-span-2">
                <Label htmlFor="editBeneficiarios">Beneficiarios</Label>
                <Input
                  id="editBeneficiarios"
                  value={rowFormData.beneficiarios}
                  onChange={(e) => setRowFormData({ ...rowFormData, beneficiarios: e.target.value })}
                />
              </div>
              <div className="col-span-2">
                <Label htmlFor="editDetalle">Detalle</Label>
                <Input
                  id="editDetalle"
                  value={rowFormData.detalle}
                  onChange={(e) => setRowFormData({ ...rowFormData, detalle: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditRowModalOpen(false)}>
                Cancelar
              </Button>
          
                      <Button onClick={handleEditRow} disabled={saving}>
                    {saving ? "Guardando..." : "Guardar"}
                  </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
