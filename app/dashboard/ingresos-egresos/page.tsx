"use client";

import type React from "react";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Trash2, Edit, Settings, Plus } from "lucide-react";
import { useMonth } from "@/contexts/month-context";
import {
  getGlobalConfig,
  updateGlobalConfig,
  type GlobalConfig,
} from "@/lib/globalConfig";
import { storage } from "@/lib/storage";

interface FinancialRecord {
  id: number;
  fecha: string;
  tipo: "Ingreso" | "Egreso";
  ministerio: string;
  categoria_principal: string;
  detalle: string;
  observacion: string;
  monto: number;
  estado: "Procesado" | "Pendiente";
  mes_id: string;
}

export default function IngresosEgresosPage() {
  const [user, setUser] = useState<any>(null);
  const router = useRouter();
  const { currentMonth, updateConfigurations } = useMonth();
  const [isLoadingB, setIsLoadingB] = useState(false);

  const [records, setRecords] = useState<FinancialRecord[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<FinancialRecord | null>(
    null
  );
  const [error, setError] = useState("");
  const [deleteRecordId, setDeleteRecordId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);

const [globalConfig, setGlobalConfig] = useState<GlobalConfig>({
  ministerios: [],
  categorias_principales: [],
  detalles: [],
  ubicaciones: [],
  estados: [],
});

  const [newMinisterio, setNewMinisterio] = useState("");
  const [newCategoria, setNewCategoria] = useState("");
  const [newDetalle, setNewDetalle] = useState("");



  const [formData, setFormData] = useState({
    fecha: new Date().toISOString().split("T")[0],
    tipo: "Ingreso" as "Ingreso" | "Egreso",
    ministerio: "",
    categoria_principal: "",
    detalle: "",
    observacion: "",
    monto: 0,
    estado: "Pendiente" as "Procesado" | "Pendiente",
  });

  useEffect(() => {
    const initializePage = async () => {
      try {
        const userData = localStorage.getItem("churchUser");
        if (!userData) {
          router.push("/");
          return;
        }
        setUser(JSON.parse(userData));

        if (!currentMonth) {
          router.push("/dashboard/control-mensual");
          return;
        }

        // Cargar configuración global
        const config = await getGlobalConfig();
        setGlobalConfig(config);

        // Cargar configuraciones del mes actual

        // Cargar registros financieros
        await loadFinancialRecords();
      } catch (error) {
        console.error("Error initializing page:", error);
      } finally {
        setIsLoading(false);
      }
    };

    initializePage();
  }, [router, currentMonth]);

  const loadFinancialRecords = async () => {
    if (!currentMonth) return;

    try {
      // Obtener ingresos y egresos desde Supabase
      let ingresos = [];
      let egresos = [];

      try {
        ingresos = await storage.getIngresosByMonth(currentMonth.id);
        egresos = await storage.getEgresosByMonth(currentMonth.id);
      } catch (error) {
        console.error("Error loading financial records:", error);
        // Opcional: puedes lanzar para detener la ejecución
        throw error;
      }

      // Combinar y formatear registros
      const incomeRecords: FinancialRecord[] =
        ingresos?.map((ingreso) => ({
          id: ingreso.id,
          fecha: ingreso.fecha,
          tipo: "Ingreso",
          ministerio: ingreso.ministerio,
          categoria_principal: ingreso.categoria_principal,
          detalle: ingreso.detalle,
          observacion: ingreso.observacion,
          monto: ingreso.monto,
          estado: ingreso.estado,
          mes_id: ingreso.mes_id,
        })) || [];

      const expenseRecords: FinancialRecord[] =
        egresos?.map((egreso) => ({
          id: egreso.id,
          fecha: egreso.fecha,
          tipo: "Egreso",
          ministerio: egreso.ministerio,
          categoria_principal: egreso.categoria_principal,
          detalle: egreso.detalle,
          observacion: egreso.observacion,
          monto: egreso.monto,
          estado: egreso.estado,
          mes_id: egreso.mes_id,
        })) || [];

      const allRecords: FinancialRecord[] = [
  ...incomeRecords,
  ...expenseRecords
];

// Ordenar por fecha ascendente
allRecords.sort((a, b) => {
  return new Date(a.fecha).getTime() - new Date(b.fecha).getTime();
});

setRecords(allRecords);
    } catch (error) {
      console.error("Error loading financial records:", error);
      setError("Error al cargar los registros financieros");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoadingB(true);

    if (
      !formData.fecha ||
      !formData.tipo ||
      !formData.ministerio ||
      !formData.categoria_principal ||
      !formData.detalle ||
      !formData.monto
    ) {
      setError("Por favor complete todos los campos obligatorios");
      return;
    }

    if (formData.monto <= 0) {
      setError("El valor debe ser mayor a 0");
      return;
    }

    if (!currentMonth) {
      setError("No hay un mes activo seleccionado");
      return;
    }

    try {
      const recordData = {
        mes_id: currentMonth.id,
        ministerio: formData.ministerio,
        categoria_principal: formData.categoria_principal,
        detalle: formData.detalle,
        observacion: formData.observacion,
        monto: formData.monto,
        fecha: formData.fecha,
        estado: formData.estado,
      };

      if (formData.tipo === "Ingreso") {
        await storage.addIngreso(currentMonth.id, recordData);
      } else {
        await storage.addEgreso(currentMonth.id, recordData);
      }

      // Recargar registros
      await loadFinancialRecords();

      // Reset form
      setFormData({
        fecha: new Date().toISOString().split("T")[0],
        tipo: "Ingreso",
        ministerio: "",
        categoria_principal: "",
        detalle: "",
        observacion: "",
        monto: 0,
        estado: "Pendiente",
      });
      setIsAddModalOpen(false);
    } catch (error: any) {
      console.error("Error saving record:", error);
      setError(`Error al guardar el registro: ${error.message}`);
    } finally {
      setIsLoadingB(false); // Desactivar loading
    }
  };


  function formatDateForInput(dateString: string) {
  if (!dateString) return "";
  const date = new Date(dateString);
  // Tomamos el año, mes y día como UTC
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0"); // meses empiezan en 0
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

  const handleEdit = (record: FinancialRecord) => {
    setEditingRecord(record);
    setFormData({
      fecha: formatDateForInput(record.fecha),
      tipo: record.tipo,
      ministerio: record.ministerio,
      categoria_principal: record.categoria_principal,
      detalle: record.detalle,
      observacion: record.observacion,
      monto: record.monto,
      estado: record.estado,
    });
    setIsEditModalOpen(true);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoadingB(true);

    if (!editingRecord) return;

    if (
      !formData.fecha ||
      !formData.tipo ||
      !formData.ministerio ||
      !formData.categoria_principal ||
      !formData.detalle ||
      !formData.monto
    ) {
      setError("Por favor complete todos los campos obligatorios");
      return;
    }

    if (formData.monto <= 0) {
      setError("El valor debe ser mayor a 0");
      return;
    }

    try {
      const updates = {
        ministerio: formData.ministerio,
        categoria_principal: formData.categoria_principal,
        detalle: formData.detalle,
        observacion: formData.observacion,
        monto: formData.monto,
        fecha: formData.fecha,
        estado: formData.estado,
      };

      if (editingRecord.tipo === "Ingreso") {
        await storage.updateIngreso(editingRecord.id, updates);
      } else {
        await storage.updateEgreso(editingRecord.id, updates);
      }

      // Recargar registros
      await loadFinancialRecords();

      setIsEditModalOpen(false);
      setEditingRecord(null);
    } catch (error: any) {
      console.error("Error updating record:", error);
      setError(`Error al actualizar el registro: ${error.message}`);
    } finally {
      setIsLoadingB(false); // Desactivar loading
    }
  };

  const handleDelete = (id: number) => {
    setDeleteRecordId(id);
  };

  const confirmDelete = async () => {
    if (!deleteRecordId || !currentMonth) return;

    try {
      // Necesitamos saber el tipo para eliminar de la tabla correcta
      const recordToDelete = records.find((r) => r.id === deleteRecordId);

      if (recordToDelete) {
        if (recordToDelete.tipo === "Ingreso") {
          await storage.deleteIngreso(deleteRecordId);
        } else {
          await storage.deleteEgreso(deleteRecordId);
        }

        // Recargar registros
        await loadFinancialRecords();
      }

      setDeleteRecordId(null);
    } catch (error: any) {
      console.error("Error deleting record:", error);
      setError(`Error al eliminar el registro: ${error.message}`);
    }
  };



const handleAddConfiguration = async (
  type: "ministerio" | "categoria" | "detalle"
) => {
  let newValue = "";
  switch (type) {
    case "ministerio": newValue = newMinisterio.trim(); break;
    case "categoria": newValue = newCategoria.trim(); break;
    case "detalle": newValue = newDetalle.trim(); break;
  }
  if (!newValue) return;

  const updatedConfig: GlobalConfig = { ...globalConfig };

  if (type === "ministerio" && !updatedConfig.ministerios.includes(newValue)) {
    updatedConfig.ministerios.push(newValue);
    setNewMinisterio("");
  }
  if (type === "categoria" && !updatedConfig.categorias_principales.includes(newValue)) {
    updatedConfig.categorias_principales.push(newValue);
    setNewCategoria("");
  }
  if (type === "detalle" && !updatedConfig.detalles.includes(newValue)) {
    updatedConfig.detalles.push(newValue);
    setNewDetalle("");
  }

  setGlobalConfig(updatedConfig);

  try {
    await updateGlobalConfig(updatedConfig); // llama al upsert de supabase
  } catch (err) {
    console.error("Error updating configuration:", err);
    setError("Error al actualizar la configuración");
  }
};

// Función para eliminar
const removeConfiguration = async (
  type: "ministerio" | "categoria" | "detalle",
  value: string
) => {
  if (!value) return;

  const updatedConfig: GlobalConfig = { ...globalConfig };

  if (type === "ministerio") {
    updatedConfig.ministerios = updatedConfig.ministerios.filter((i) => i !== value);
  } else if (type === "categoria") {
    updatedConfig.categorias_principales = updatedConfig.categorias_principales.filter((i) => i !== value);
  } else if (type === "detalle") {
    updatedConfig.detalles = updatedConfig.detalles.filter((i) => i !== value);
  }

  setGlobalConfig(updatedConfig);

  try {
    await updateGlobalConfig(updatedConfig); // llama al upsert de supabase
  } catch (err) {
    console.error("Error removing configuration:", err);
    setError("Error al eliminar la configuración");
  }
};



  const totalIngresos = records
    .filter((r) => r.tipo === "Ingreso")
    .reduce((sum, r) => sum + r.monto, 0);

  const totalEgresos = records
    .filter((r) => r.tipo === "Egreso")
    .reduce((sum, r) => sum + r.monto, 0);

  const balance = totalIngresos - totalEgresos;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando registros financieros...</p>
        </div>
      </div>
    );
  }

  if (!user || !currentMonth) {
    return (

           <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Redirigiendo...</p>
        </div>
      </div>
    );
  }

function formatDateForTable(dateString: string) {
  if (!dateString) return "";
  const date = new Date(dateString);
  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const year = date.getUTCFullYear();
  return `${day}/${month}/${year}`; // DD/MM/YYYY
}


  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <Button variant="ghost" onClick={() => router.push("/dashboard")}>
                ← Volver al Dashboard
              </Button>
              <h1 className="text-xl font-semibold text-gray-900">
                Ingresos y Egresos
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              <Badge
                variant="outline"
                className="text-blue-600 border-blue-200"
              >
                {currentMonth.name}
              </Badge>

              <Dialog
                open={isConfigModalOpen}
                onOpenChange={setIsConfigModalOpen}
              >
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Settings className="w-4 h-4 mr-2" />
                    Configurar
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Configurar Opciones</DialogTitle>
                    <DialogDescription>
                      Gestione las opciones disponibles para los campos de
                      selección
                    </DialogDescription>
                  </DialogHeader>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-3">
                      <Label className="text-base font-medium">
                        Ministerios
                      </Label>
                      <div className="flex space-x-2">
                        <Input
                          placeholder="Nuevo ministerio"
                          value={newMinisterio}
                          onChange={(e) => setNewMinisterio(e.target.value)}
                          className="text-sm"
                        />
                        <Button
                          size="sm"
                          onClick={() => handleAddConfiguration("ministerio")}
                        >
                          <Plus className="w-4 h-4" />
                        </Button>
                      </div>
                      <div className="space-y-1 max-h-32 overflow-y-auto">
                        {globalConfig.ministerios.map((ministerio) => (
                          <div
                            key={ministerio}
                            className="flex items-center justify-between p-2 bg-gray-50 rounded text-sm"
                          >
                            <span>{ministerio}</span>
                            <button
                              onClick={() =>
                                removeConfiguration("ministerio", ministerio)
                              }
                              className="text-red-500 hover:text-red-700 ml-2"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <Label className="text-base font-medium">
                        Categorías Principales
                      </Label>
                      <div className="flex space-x-2">
                        <Input
                          placeholder="Nueva categoría"
                          value={newCategoria}
                          onChange={(e) => setNewCategoria(e.target.value)}
                          className="text-sm"
                        />
                        <Button
                          size="sm"
                          onClick={() => handleAddConfiguration("categoria")}
                        >
                          <Plus className="w-4 h-4" />
                        </Button>
                      </div>
                      <div className="space-y-1 max-h-32 overflow-y-auto">
                        {globalConfig.categorias_principales.map((categoria) => (
                          <div
                            key={categoria}
                            className="flex items-center justify-between p-2 bg-gray-50 rounded text-sm"
                          >
                            <span>{categoria}</span>
                            <button
                              onClick={() =>
                                removeConfiguration("categoria", categoria)
                              }
                              className="text-red-500 hover:text-red-700 ml-2"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <Label className="text-base font-medium">Detalles</Label>
                      <div className="flex space-x-2">
                        <Input
                          placeholder="Nuevo detalle"
                          value={newDetalle}
                          onChange={(e) => setNewDetalle(e.target.value)}
                          className="text-sm"
                        />
                        <Button
                          size="sm"
                          onClick={() => handleAddConfiguration("detalle")}
                        >
                          <Plus className="w-4 h-4" />
                        </Button>
                      </div>
                      <div className="space-y-1 max-h-32 overflow-y-auto">
                        {globalConfig.detalles.map((detalle) => (
                          <div
                            key={detalle}
                            className="flex items-center justify-between p-2 bg-gray-50 rounded text-sm"
                          >
                            <span>{detalle}</span>
                            <button
                              onClick={() =>
                                removeConfiguration("detalle", detalle)
                              }
                              className="text-red-500 hover:text-red-700 ml-2"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <DialogFooter>
                    <Button onClick={() => setIsConfigModalOpen(false)}>
                      Cerrar
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-blue-600 hover:bg-blue-700">
                    <Plus className="w-4 h-4 mr-2" />
                    Agregar Registro
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Agregar Nuevo Registro</DialogTitle>
                    <DialogDescription>
                      Complete la información del ingreso o egreso
                    </DialogDescription>
                  </DialogHeader>

                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="fecha">Fecha *</Label>
                        <Input
                          id="fecha"
                          type="date"
                          value={formData.fecha}
                          onChange={(e) =>
                            setFormData({ ...formData, fecha: e.target.value })
                          }
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="tipo">Tipo *</Label>
                        <Select
                          value={formData.tipo}
                          onValueChange={(value) =>
                            setFormData({
                              ...formData,
                              tipo: value as "Ingreso" | "Egreso",
                            })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Ingreso">Ingreso</SelectItem>
                            <SelectItem value="Egreso">Egreso</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="ministerio">Ministerio *</Label>
                        <Select
                          value={formData.ministerio}
                          onValueChange={(value) =>
                            setFormData({ ...formData, ministerio: value })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccione ministerio" />
                          </SelectTrigger>
                          <SelectContent>
                            {globalConfig.ministerios.map((ministerio) => (
                              <SelectItem key={ministerio} value={ministerio}>
                                {ministerio}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="categoria">Categoría Principal *</Label>
                        <Select
                          value={formData.categoria_principal}
                          onValueChange={(value) =>
                            setFormData({
                              ...formData,
                              categoria_principal: value,
                            })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccione categoría" />
                          </SelectTrigger>
                          <SelectContent>
                            {globalConfig.categorias_principales.map((categoria) => (
                              <SelectItem key={categoria} value={categoria}>
                                {categoria}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="detalle">Detalle *</Label>
                        <Select
                          value={formData.detalle}
                          onValueChange={(value) =>
                            setFormData({ ...formData, detalle: value })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccione detalle" />
                          </SelectTrigger>
                          <SelectContent>
                            {globalConfig.detalles.map((detalle) => (
                              <SelectItem key={detalle} value={detalle}>
                                {detalle}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="monto">Valor *</Label>
                        <Input
                          id="monto"
                          type="number"
                          min="0"
                          step="0.01"
                          value={formData.monto}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              monto: Number.parseFloat(e.target.value) || 0,
                            })
                          }
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="observacion">Observación</Label>
                      <Textarea
                        id="observacion"
                        value={formData.observacion}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            observacion: e.target.value,
                          })
                        }
                        placeholder="Observaciones adicionales (opcional)"
                      />
                    </div>

                    <div>
                      <Label htmlFor="estado">Estado</Label>
                      <Select
                        value={formData.estado}
                        onValueChange={(value) =>
                          setFormData({
                            ...formData,
                            estado: value as "Procesado" | "Pendiente",
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Pendiente">Pendiente</SelectItem>
                          <SelectItem value="Procesado">Procesado</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {error && (
                      <Alert className="border-red-200 bg-red-50">
                        <AlertDescription className="text-red-700">
                          {error}
                        </AlertDescription>
                      </Alert>
                    )}

                    <DialogFooter>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setIsAddModalOpen(false)}
                      >
                        Cancelar
                      </Button>
                      <Button
                        type="submit"
                        className="bg-blue-600 hover:bg-blue-700"
                        disabled={isLoadingB}
                      >
                        {isLoadingB ? "Guardando..." : "Guardar Registro"}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600">
                  ${totalIngresos.toLocaleString()}
                </p>
                <p className="text-sm text-gray-600">Total Ingresos</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="text-center">
                <p className="text-2xl font-bold text-red-600">
                  ${totalEgresos.toLocaleString()}
                </p>
                <p className="text-sm text-gray-600">Total Egresos</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="text-center">
                <p
                  className={`text-2xl font-bold ${
                    balance >= 0 ? "text-blue-600" : "text-red-600"
                  }`}
                >
                  ${balance.toLocaleString()}
                </p>
                <p className="text-sm text-gray-600">Balance</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="text-center">
                <p className="text-2xl font-bold text-gray-600">
                  {records.length}
                </p>
                <p className="text-sm text-gray-600">Total Registros</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Registros Financieros</CardTitle>
            <CardDescription>
              Lista completa de ingresos y egresos del mes actual
            </CardDescription>
          </CardHeader>
          <CardContent>
            {records.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-3 font-medium">Fecha</th>
                      <th className="text-left p-3 font-medium">Tipo</th>
                      <th className="text-left p-3 font-medium">Ministerio</th>
                      <th className="text-left p-3 font-medium">Categoría</th>
                      <th className="text-left p-3 font-medium">Detalle</th>
                      <th className="text-left p-3 font-medium">Valor</th>
                      <th className="text-left p-3 font-medium">Estado</th>
                      <th className="text-left p-3 font-medium">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    
                    {records.map((record) => (
                      <tr key={record.id} className="border-b hover:bg-gray-50">
                        <td className="p-3">
                        {formatDateForTable(record.fecha)}
                     
                        </td>
                        <td className="p-3">
                          <Badge
                            className={
                              record.tipo === "Ingreso"
                                ? "bg-green-100 text-green-800"
                                : "bg-red-100 text-red-800"
                            }
                          >
                            {record.tipo}
                          </Badge>
                        </td>
                        <td className="p-3">{record.ministerio}</td>
                        <td className="p-3">{record.categoria_principal}</td>
                        <td className="p-3">{record.detalle}</td>
                        <td className="p-3 font-medium">
                          ${record.monto.toLocaleString()}
                        </td>
                        <td className="p-3">
                          <Badge
                            variant={
                              record.estado === "Procesado"
                                ? "default"
                                : "secondary"
                            }
                          >
                            {record.estado}
                          </Badge>
                        </td>
                        <td className="p-3">
                          <div className="flex space-x-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleEdit(record)}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-red-600 hover:text-red-700 bg-transparent"
                                  onClick={() => handleDelete(record.id)}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>
                                    ¿Eliminar registro?
                                  </AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Esta acción no se puede deshacer. El
                                    registro será eliminado permanentemente.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>
                                    Cancelar
                                  </AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={confirmDelete}
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
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-gray-500 mb-4">
                  No hay registros financieros para este mes
                </p>
                <Button
                  onClick={() => setIsAddModalOpen(true)}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  Agregar Primer Registro
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Registro</DialogTitle>
            <DialogDescription>
              Modifique la información del registro financiero
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleUpdate} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-fecha">Fecha *</Label>
                <Input
                  id="edit-fecha"
                  type="date"
                  value={formData.fecha}
                  onChange={(e) =>
                    setFormData({ ...formData, fecha: e.target.value })
                  }
                  required
                />
              </div>
              <div>
                <Label htmlFor="edit-tipo">Tipo *</Label>
                <Select
                disabled 
                  value={formData.tipo}
                  onValueChange={(value) =>
                    setFormData({
                      ...formData,
                      tipo: value as "Ingreso" | "Egreso",
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Ingreso">Ingreso</SelectItem>
                    <SelectItem value="Egreso">Egreso</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-ministerio">Ministerio *</Label>
                <Select
                  value={formData.ministerio}
                  onValueChange={(value) =>
                    setFormData({ ...formData, ministerio: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccione ministerio" />
                  </SelectTrigger>
                  <SelectContent>
                    {globalConfig.ministerios.map((ministerio) => (
                      <SelectItem key={ministerio} value={ministerio}>
                        {ministerio}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="edit-categoria">Categoría Principal *</Label>
                <Select
                  value={formData.categoria_principal}
                  onValueChange={(value) =>
                    setFormData({ ...formData, categoria_principal: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccione categoría" />
                  </SelectTrigger>
                  <SelectContent>
                    {globalConfig.categorias_principales.map((categoria) => (
                      <SelectItem key={categoria} value={categoria}>
                        {categoria}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-detalle">Detalle *</Label>
                <Select
                  value={formData.detalle}
                  onValueChange={(value) =>
                    setFormData({ ...formData, detalle: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccione detalle" />
                  </SelectTrigger>
                  <SelectContent>
                    {globalConfig.detalles.map((detalle) => (
                      <SelectItem key={detalle} value={detalle}>
                        {detalle}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="edit-monto">Valor *</Label>
                <Input
                  id="edit-monto"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.monto}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      monto: Number.parseFloat(e.target.value) || 0,
                    })
                  }
                  required
                />
              </div>
            </div>

            <div>
              <Label htmlFor="edit-observacion">Observación</Label>
              <Textarea
                id="edit-observacion"
                value={formData.observacion}
                onChange={(e) =>
                  setFormData({ ...formData, observacion: e.target.value })
                }
                placeholder="Observaciones adicionales (opcional)"
              />
            </div>

            <div>
              <Label htmlFor="edit-estado">Estado</Label>
              <Select
                value={formData.estado}
                onValueChange={(value) =>
                  setFormData({
                    ...formData,
                    estado: value as "Procesado" | "Pendiente",
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Pendiente">Pendiente</SelectItem>
                  <SelectItem value="Procesado">Procesado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {error && (
              <Alert className="border-red-200 bg-red-50">
                <AlertDescription className="text-red-700">
                  {error}
                </AlertDescription>
              </Alert>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEditModalOpen(false)}
              >
                Cancelar
              </Button>

              <Button
                type="submit"
                className="bg-blue-600 hover:bg-blue-700"
                disabled={isLoadingB}
              >
                {isLoadingB ? "Guardando..." : "Actualizar Registroo"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
