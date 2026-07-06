"use client";

import type React from "react";
import { PermissionsGuard } from "@/lib/permissions-guard"
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useRealtimeMultiple } from "@/hooks/use-realtime";
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
import { Trash2, Edit, Settings, Plus, Lock, ArrowLeft, ArrowDown, ArrowUp } from "lucide-react";
import { useMonth } from "@/contexts/month-context";
import {
  getGlobalConfig,
  updateGlobalConfig,
  type GlobalConfig,
} from "@/lib/globalConfig";
import { storage } from "@/lib/storage";
import { useAuth } from "@/contexts/auth-context";
import { useSecurityCheck } from "@/contexts/security-context"
import { todayEcuador } from "@/lib/timezone"
import { getAlfoliMes } from "@/lib/mod/alfoli-service"
import { supabase } from "@/lib/supabase"

interface FinancialRecord {
  id: number;
  fecha: string;
  tipo: "Ingreso" | "Egreso";
  ministerio: string;
  categoria_principal: string;
  detalle: string;
  observacion: string;
  monto: string | number
  estado: "Procesado" | "Pendiente";
  metodo_pago: string;
  mes_id: string;
  created_at: string;
}

function IngresosEgresosContent({ canEdit }: { canEdit: boolean }) {
const { checkAndExecute } = useSecurityCheck()

  const router = useRouter();
  const { currentMonth, updateConfigurations } = useMonth();
  const [isLoadingB, setIsLoadingB] = useState(false);
 const { user} = useAuth()

  const [records, setRecords] = useState<FinancialRecord[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<FinancialRecord | null>(
    null
  );
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)

  const [error, setError] = useState("");
  const [deleteRecordId, setDeleteRecordId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sortDesc, setSortDesc] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("ingresos_sort_desc") !== "false"
    }
    return true
  });

  // Filtros
  const [filterTipo, setFilterTipo] = useState<string>("todos")
  const [filterCategoria, setFilterCategoria] = useState<string>("todas")
  const [filterDetalle, setFilterDetalle] = useState<string>("todos")
  const [filterEstado, setFilterEstado] = useState<string>("todos")
  const [filterMetodo, setFilterMetodo] = useState<string>("todos")
  const [filterText, setFilterText] = useState("")

const [globalConfig, setGlobalConfig] = useState<GlobalConfig>({
  ministerios: [],
  categorias_principales: [],
  detalles: [],
  ubicaciones: [],
  estados: [],
});

// Totales consolidados de otros módulos
const [totalCelulas, setTotalCelulas] = useState(0)
const [totalAlfoli, setTotalAlfoli] = useState(0)
const [totalDiezmosTransferencia, setTotalDiezmosTransferencia] = useState(0)
const [totalPrimicias, setTotalPrimicias] = useState(0)
const [totalDiezmoEspecial, setTotalDiezmoEspecial] = useState(0)
const handleDeleteClick = (record: FinancialRecord) => {
  if (!canEdit) {
    setError("No tiene permiso de edición en este módulo");
    return;
  }
  checkAndExecute(record.created_at, () => {
    setDeleteRecordId(record.id)
    setIsDeleteDialogOpen(true)
  })
}
  const [newMinisterio, setNewMinisterio] = useState("");
  const [newCategoria, setNewCategoria] = useState("");
  const [newDetalle, setNewDetalle] = useState("");



  const [formData, setFormData] = useState({
    fecha: todayEcuador(),
    tipo: "Ingreso" as "Ingreso" | "Egreso",
    ministerio: "",
    categoria_principal: "",
    detalle: "",
    observacion: "",
    monto: "",
    metodo_pago: "Efectivo" as string,
    estado: "Pendiente" as "Procesado" | "Pendiente",
  });

  useEffect(() => {
    const initializePage = async () => {
      try {

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

        // Cargar totales consolidados de otros módulos
        await loadConsolidatedTotals();
      } catch (error) {
        console.error("Error initializing page:", error);
      } finally {
        setIsLoading(false);
      }
    };

    initializePage();
  }, [router, currentMonth]);

  // Realtime: refrescar al detectar cambios en ingresos o egresos
  useRealtimeMultiple(["ingresos", "egresos"], () => {
    loadFinancialRecords()
  });

  const loadConsolidatedTotals = async () => {
    if (!currentMonth) return
    try {
      // Extraer mes y año del currentMonth (name es "Enero 2025", etc.)
      const monthNum = currentMonth.month
      const yearNum = currentMonth.year

      // Total Alfolí del mes (se suma todo)
      const alfoliRecords = await getAlfoliMes(monthNum, yearNum)
      const alfoliTotal = alfoliRecords.reduce((sum, r) => sum + Number(r.valor), 0)
      setTotalAlfoli(alfoliTotal)

      // Total Ofrendas de Células del mes (solo las marcadas como recibidas)
      const { data: celulasData } = await supabase
        .from("ofrendas_celulas")
        .select("valor")
        .eq("mes", monthNum)
        .eq("anio", yearNum)
        .eq("recibido", true)
      const celulasTotal = (celulasData || []).reduce((sum: number, r: any) => sum + Number(r.valor), 0)
      setTotalCelulas(celulasTotal)

      // Total Diezmos solo transferencia del mes (tipo_ofrenda = diezmo o null para compatibilidad)
      const { data: diezmosData } = await supabase
        .from("diezmos")
        .select("valor, tipo_ofrenda")
        .eq("mes_id", currentMonth.id)
        .eq("transaccion", "transferencia")
      const diezmosTotal = (diezmosData || []).filter((r: any) => !r.tipo_ofrenda || r.tipo_ofrenda === "diezmo").reduce((sum: number, r: any) => sum + Number(r.valor), 0)
      setTotalDiezmosTransferencia(diezmosTotal)

      // Total Primicias (transferencia) del mes
      const primiciasTotal = (diezmosData || []).filter((r: any) => r.tipo_ofrenda === "primicia").reduce((sum: number, r: any) => sum + Number(r.valor), 0)
      setTotalPrimicias(primiciasTotal)

      // Total Diezmo Especial (transferencia) del mes
      const especialTotal = (diezmosData || []).filter((r: any) => r.tipo_ofrenda === "diezmo_especial").reduce((sum: number, r: any) => sum + Number(r.valor), 0)
      setTotalDiezmoEspecial(especialTotal)
    } catch (error) {
      console.error("Error loading consolidated totals:", error)
    }
  }

  const loadFinancialRecords = async () => {
    if (!currentMonth) return;

    try {
      // Obtener ingresos y egresos desde Supabase
      let ingresos: FinancialRecord[] = [];
      let egresos: FinancialRecord[] = [];

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
          metodo_pago: ingreso.metodo_pago || "N/A",
          estado: ingreso.estado,
          mes_id: ingreso.mes_id,
          created_at: ingreso.created_at
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
          metodo_pago: egreso.metodo_pago || "N/A",
          estado: egreso.estado,
          mes_id: egreso.mes_id,
          created_at: egreso.created_at,
        })) || [];

      const allRecords: FinancialRecord[] = [
          ...incomeRecords,
          ...expenseRecords
            ];

          // Ordenar por fecha según preferencia (se re-ordena en render)
          allRecords.sort((a, b) => {
            const diff = new Date(a.fecha).getTime() - new Date(b.fecha).getTime();
            return -diff;
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
    if (!canEdit) {
      setError("No tiene permiso de edición en este módulo");
      return;
    }
   

    if (
      !formData.fecha ||
      !formData.tipo ||
      !formData.ministerio ||
      !formData.categoria_principal ||
      !formData.detalle ||
      !formData.monto
    ) {
      setError("Por favor complete todos los campos obligatorios");
      setIsLoadingB(false);
      return;
    }
// @ts-ignore
    if (formData.monto <= 0) {
      setError("El valor debe ser mayor a 0");
      setIsLoadingB(false);
      return;
    }

    if (!currentMonth) {
      setError("No hay un mes activo seleccionado");
      setIsLoadingB(false);
      return;
    }

    try {
       setIsLoadingB(true);
      const recordData = {
        mes_id: currentMonth.id,
        ministerio: formData.ministerio,
        categoria_principal: formData.categoria_principal,
        detalle: formData.detalle,
        observacion: formData.observacion,
        monto: formData.monto,
        fecha: formData.fecha,
        metodo_pago: formData.metodo_pago,
        estado: formData.estado,
      };

      if (formData.tipo === "Ingreso") {
        await storage.addIngreso(currentMonth.id, recordData, { user_id: user!.id, user_name: user!.username });
      } else {
        await storage.addEgreso(currentMonth.id, recordData, { user_id: user!.id, user_name: user!.username });
      }

      // Recargar registros
      await loadFinancialRecords();

      // Reset form
      setFormData({
        fecha: todayEcuador(),
        tipo: "Ingreso",
        ministerio: "",
        categoria_principal: "",
        detalle: "",
        observacion: "",
        // @ts-ignore
        monto: "",
        metodo_pago: "Efectivo",
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
    if (!canEdit) {
      setError("No tiene permiso de edición en este módulo");
      return;
    }
    setEditingRecord(record);
    setFormData({
      fecha: todayEcuador(),
      tipo: record.tipo,
      ministerio: record.ministerio,
      categoria_principal: record.categoria_principal,
      detalle: record.detalle,
      observacion: record.observacion,
      // @ts-ignore
      monto: record.monto,
      metodo_pago: record.metodo_pago || "N/A",
      estado: record.estado,
    });
    setIsEditModalOpen(true);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!canEdit) {
      setError("No tiene permiso de edición en este módulo");
      return;
    }
    

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
// @ts-ignore
    if (formData.monto <= 0) {
      setError("El valor debe ser mayor a 0");
      return;
    }

    try {
      setIsLoadingB(true);
      const updates = {
        ministerio: formData.ministerio,
        categoria_principal: formData.categoria_principal,
        detalle: formData.detalle,
        observacion: formData.observacion,
        monto: formData.monto,
        fecha: formData.fecha,
        metodo_pago: formData.metodo_pago,
        estado: formData.estado,
      };

      if (editingRecord.tipo === "Ingreso") {
        await storage.updateIngreso(editingRecord.id, updates, { user_id: user!.id, user_name: user!.username });
      } else {
        await storage.updateEgreso(editingRecord.id, updates, { user_id: user!.id, user_name: user!.username });
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
    if (!canEdit) {
      setError("No tiene permiso de edición en este módulo");
      return;
    }
    if (!deleteRecordId || !currentMonth) return;

    try {
      // Necesitamos saber el tipo para eliminar de la tabla correcta
      const recordToDelete = records.find((r) => r.id === deleteRecordId);

      if (recordToDelete) {
        if (recordToDelete.tipo === "Ingreso") {
          await storage.deleteIngreso(deleteRecordId, { user_id: user!.id, user_name: user!.username });
        } else {
          await storage.deleteEgreso(deleteRecordId, { user_id: user!.id, user_name: user!.username });
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
  if (!canEdit) {
    setError("No tiene permiso de edición en este módulo");
    return;
  }
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
    // @ts-ignore
    .reduce((sum, r) => sum + r.monto, 0);

  const totalEgresos = records
    .filter((r) => r.tipo === "Egreso")
    // @ts-ignore
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
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push("/dashboard")}
                className="flex items-center space-x-2"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Volver</span>
              </Button>
              <h1 className="text-xl font-semibold text-gray-900">
                Ingresos y Egresos
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              {!canEdit && (
                <span className="flex items-center gap-1 text-sm text-amber-600 bg-amber-50 border border-amber-200 px-3 py-1 rounded-full">
                  <Lock className="w-3 h-3" /> Solo lectura
                </span>
              )}
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
                  <Button variant="outline" size="sm" disabled={!canEdit}>
                    <Settings className="w-4 h-4 mr-2" />
                    Configurar
                  </Button>
                </DialogTrigger>
                <DialogContent className="w-[calc(100%-1rem)] sm:max-w-4xl max-h-[90vh] overflow-y-auto">
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
                  <Button className="bg-blue-600 hover:bg-blue-700" disabled={!canEdit}>
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
                              // @ts-ignore
                              monto: Number.parseFloat(e.target.value),
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
                      <Label htmlFor="metodo_pago">Método de Pago</Label>
                      <Select
                        value={formData.metodo_pago}
                        onValueChange={(value) =>
                          setFormData({ ...formData, metodo_pago: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Efectivo">Efectivo</SelectItem>
                          <SelectItem value="Transferencia">Transferencia</SelectItem>
                          <SelectItem value="N/A">N/A</SelectItem>
                        </SelectContent>
                      </Select>
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
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-4 mb-8">
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => router.push("/dashboard/ofrenda-celulas")}>
            <CardContent className="p-4">
              <div className="text-center">
                <p className="text-lg font-bold text-purple-600">${totalCelulas.toLocaleString()}</p>
                <p className="text-xs text-gray-600">Ingreso Células</p>
              </div>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => router.push("/dashboard/mes")}>
            <CardContent className="p-4">
              <div className="text-center">
                <p className="text-lg font-bold text-indigo-600">${totalAlfoli.toLocaleString()}</p>
                <p className="text-xs text-gray-600">Ingreso Alfolí</p>
              </div>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => router.push("/dashboard/diezmos")}>
            <CardContent className="p-4">
              <div className="text-center">
                <p className="text-lg font-bold text-teal-600">${totalDiezmosTransferencia.toLocaleString()}</p>
                <p className="text-xs text-gray-600">Diezmos</p>
                <p className="text-[10px] text-gray-400">Transferencia</p>
              </div>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => router.push("/dashboard/diezmos")}>
            <CardContent className="p-4">
              <div className="text-center">
                <p className="text-lg font-bold text-fuchsia-600">${totalPrimicias.toLocaleString()}</p>
                <p className="text-xs text-gray-600">Primicias</p>
                <p className="text-[10px] text-gray-400">Transferencia</p>
              </div>
            </CardContent>
          </Card>
          {totalDiezmoEspecial > 0 && (
            <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => router.push("/dashboard/diezmos")}>
              <CardContent className="p-4">
                <div className="text-center">
                  <p className="text-lg font-bold text-rose-600">${totalDiezmoEspecial.toLocaleString()}</p>
                  <p className="text-xs text-gray-600">Diezmo Especial</p>
                  <p className="text-[10px] text-gray-400">Transferencia</p>
                </div>
              </CardContent>
            </Card>
          )}
          <Card>
            <CardContent className="p-4">
              <div className="text-center">
                <p className="text-lg font-bold text-green-600">${totalIngresos.toLocaleString()}</p>
                <p className="text-xs text-gray-600">Ingreso Módulo</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-center">
                <p className="text-lg font-bold text-blue-600">${(totalIngresos + totalCelulas + totalAlfoli + totalDiezmosTransferencia + totalPrimicias + totalDiezmoEspecial).toLocaleString()}</p>
                <p className="text-xs text-gray-600">Total Ingresos</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-center">
                <p className="text-lg font-bold text-red-600">${totalEgresos.toLocaleString()}</p>
                <p className="text-xs text-gray-600">Total Egresos</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Registros Financieros</CardTitle>
                <CardDescription>
                  Lista completa de ingresos y egresos del mes actual
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const newVal = !sortDesc
                  setSortDesc(newVal)
                  localStorage.setItem("ingresos_sort_desc", String(newVal))
                }}
                title={sortDesc ? "Más recientes primero" : "Más antiguos primero"}
                className="flex items-center gap-1"
              >
                {sortDesc ? (
                  <><ArrowDown className="w-4 h-4" /> Recientes</>
                ) : (
                  <><ArrowUp className="w-4 h-4" /> Antiguos</>
                )}
              </Button>
            </div>
            {/* Filtros */}
            <div className="flex flex-wrap gap-3 mt-4 pt-4 border-t">
              <div className="flex-1 min-w-[180px]">
                <Input
                  placeholder="Buscar por observación, ministerio..."
                  value={filterText}
                  onChange={(e) => setFilterText(e.target.value)}
                  className="h-9"
                />
              </div>
              <select
                value={filterTipo}
                onChange={(e) => setFilterTipo(e.target.value)}
                className="h-9 px-3 rounded-md border border-gray-200 text-sm bg-white"
              >
                <option value="todos">Todos</option>
                <option value="Ingreso">Ingresos</option>
                <option value="Egreso">Egresos</option>
              </select>
              <select
                value={filterCategoria}
                onChange={(e) => setFilterCategoria(e.target.value)}
                className="h-9 px-3 rounded-md border border-gray-200 text-sm bg-white"
              >
                <option value="todas">Todas las categorías</option>
                {[...new Set(records.map((r) => r.categoria_principal).filter(Boolean))].sort().map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
              <select
                value={filterDetalle}
                onChange={(e) => setFilterDetalle(e.target.value)}
                className="h-9 px-3 rounded-md border border-gray-200 text-sm bg-white"
              >
                <option value="todos">Todos los detalles</option>
                {[...new Set(records.map((r) => r.detalle).filter(Boolean))].sort().map((det) => (
                  <option key={det} value={det}>{det}</option>
                ))}
              </select>
              <select
                value={filterEstado}
                onChange={(e) => setFilterEstado(e.target.value)}
                className="h-9 px-3 rounded-md border border-gray-200 text-sm bg-white"
              >
                <option value="todos">Todos los estados</option>
                <option value="Procesado">Procesado</option>
                <option value="Pendiente">Pendiente</option>
              </select>
              <select
                value={filterMetodo}
                onChange={(e) => setFilterMetodo(e.target.value)}
                className="h-9 px-3 rounded-md border border-gray-200 text-sm bg-white"
              >
                <option value="todos">Todos los métodos</option>
                <option value="Efectivo">Efectivo</option>
                <option value="Transferencia">Transferencia</option>
                <option value="N/A">N/A</option>
              </select>
              {(filterTipo !== "todos" || filterCategoria !== "todas" || filterDetalle !== "todos" || filterEstado !== "todos" || filterMetodo !== "todos" || filterText) && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-9"
                  onClick={() => { setFilterTipo("todos"); setFilterCategoria("todas"); setFilterDetalle("todos"); setFilterEstado("todos"); setFilterMetodo("todos"); setFilterText("") }}
                >
                  Limpiar
                </Button>
              )}
            </div>
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
                      <th className="text-left p-3 font-medium">Método de Pago</th>
                      <th className="text-left p-3 font-medium">Estado</th>
                      <th className="text-left p-3 font-medium">Observación</th>
                      <th className="text-left p-3 font-medium">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    
                    {[...records]
                    .filter((record) => {
                      if (filterTipo !== "todos" && record.tipo !== filterTipo) return false
                      if (filterCategoria !== "todas" && record.categoria_principal !== filterCategoria) return false
                      if (filterDetalle !== "todos" && record.detalle !== filterDetalle) return false
                      if (filterEstado !== "todos" && record.estado !== filterEstado) return false
                      if (filterMetodo !== "todos" && (record.metodo_pago || "N/A") !== filterMetodo) return false
                      if (filterText) {
                        const search = filterText.toLowerCase()
                        const matchesText =
                          (record.observacion || "").toLowerCase().includes(search) ||
                          (record.ministerio || "").toLowerCase().includes(search) ||
                          (record.categoria_principal || "").toLowerCase().includes(search)
                        if (!matchesText) return false
                      }
                      return true
                    })
                    .sort((a, b) => {
                      const diff = new Date(a.fecha).getTime() - new Date(b.fecha).getTime();
                      return sortDesc ? -diff : diff;
                    }).map((record) => (
                      <tr key={record.id + "-" + record.tipo} className="border-b hover:bg-gray-50">
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
                          <Badge variant="outline" className="text-xs">
                            {record.metodo_pago || "N/A"}
                          </Badge>
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
                        <td>{record.observacion}</td>
                        <td className="p-3">
                          <div className="flex space-x-2">
                            {/*MICHE*/}
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
  checkAndExecute(record.created_at, () => {
    handleEdit(record)
  })
}
                              disabled={!canEdit}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <AlertDialog
  open={isDeleteDialogOpen}
  onOpenChange={setIsDeleteDialogOpen}
>
  <Button
    size="sm"
    variant="outline"
    className="text-red-600 hover:text-red-700 bg-transparent"
    onClick={() => handleDeleteClick(record)}
    disabled={!canEdit}
  >
    <Trash2 className="w-4 h-4" />
  </Button>

  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>
        ¿Eliminar registro?
      </AlertDialogTitle>
      <AlertDialogDescription>
        Esta acción no se puede deshacer. El registro será eliminado permanentemente.
      </AlertDialogDescription>
    </AlertDialogHeader>

    <AlertDialogFooter>
      <AlertDialogCancel>
        Cancelar
      </AlertDialogCancel>

      <AlertDialogAction
        onClick={async () => {
          await confirmDelete()
          setIsDeleteDialogOpen(false)
        }}
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
                      // @ts-ignore
                      monto: Number.parseFloat(e.target.value),
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
              <Label htmlFor="edit-metodo_pago">Método de Pago</Label>
              <Select
                value={formData.metodo_pago}
                onValueChange={(value) =>
                  setFormData({ ...formData, metodo_pago: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Efectivo">Efectivo</SelectItem>
                  <SelectItem value="Transferencia">Transferencia</SelectItem>
                  <SelectItem value="N/A">N/A</SelectItem>
                </SelectContent>
              </Select>
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

export default function IngresosEgresosPage() {
  return (
    <PermissionsGuard moduleName="ingresos_egresos">
      {(canEdit) => <IngresosEgresosContent canEdit={canEdit} />}
    </PermissionsGuard>
  );
}
