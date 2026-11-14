"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
  ArrowLeft,
  Database,
  FileSpreadsheet,
  FileText,
  Filter,
  Info,
  Loader2,
  Search,
  ShieldAlert,
  Table2,
} from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { PermissionsGuard } from "@/lib/permissions-guard"
import { useAuth } from "@/contexts/auth-context"
import { getUserPermissions } from "@/lib/auth"
import { useMonth } from "@/contexts/month-context"

import { ErrorConsulta, cargarMeses, opcionesDeAnios, opcionesDeMeses } from "@/lib/reportes/data"
import { descargarArchivo } from "@/lib/reportes/excel"
import { ErrorReporte, columnasPorDefecto, ejecutarReporte } from "@/lib/reportes/ejecutar"
import { buscarReporte, reportesPorGrupo } from "@/lib/reportes/registry"
import type {
  AccionReporte,
  ColumnaReporte,
  ContextoReporte,
  DefinicionReporte,
  FiltroReporte,
  MesRef,
  OpcionFiltro,
} from "@/lib/reportes/types"

import { SelectorColumnas } from "./SelectorColumnas"

/** Radix no admite un item con valor vacío, así que "sin filtrar" usa centinela. */
const TODOS = "__todos__"

function ListadosContent() {
  const router = useRouter()
  const { currentMonth, monthHistory } = useMonth()
  const { user } = useAuth()

  const [misModulos, setMisModulos] = useState<string[] | null>(null)
  const [meses, setMeses] = useState<MesRef[]>([])
  const [busqueda, setBusqueda] = useState("")
  const [reporteId, setReporteId] = useState<string | null>(null)
  const [filtros, setFiltros] = useState<Record<string, string>>({})
  const [fuentes, setFuentes] = useState<string[]>([])
  const [columnas, setColumnas] = useState<string[]>([])
  /** Columnas declaradas más las que se cargan de los datos (una por hijo). */
  const [columnasReporte, setColumnasReporte] = useState<ColumnaReporte<any>[]>([])
  const [cargandoColumnas, setCargandoColumnas] = useState(false)
  const [opcionesDinamicas, setOpcionesDinamicas] = useState<Record<string, OpcionFiltro[]>>({})
  const [mostrarColumnas, setMostrarColumnas] = useState(false)
  const [trabajando, setTrabajando] = useState<string | null>(null)

  const reporte = reporteId ? buscarReporte(reporteId) : undefined
  const grupos = useMemo(() => reportesPorGrupo(busqueda), [busqueda])

  /**
   * Módulos con `can_view` del usuario. Un reporte se ofrece solo si el usuario
   * tiene al menos uno de los módulos que lo habilitan; si no, `/api/db`
   * respondería 403 y el archivo saldría vacío sin explicación.
   */
  useEffect(() => {
    if (!user) return
    let vigente = true
    getUserPermissions(user.id)
      .then((filas) => {
        if (!vigente) return
        const nombres = (filas as Array<{ module?: { name?: string } | null }>)
          .map((f) => f.module?.name)
          .filter((n): n is string => !!n)
        setMisModulos(nombres)
      })
      .catch(() => {
        if (vigente) setMisModulos([])
      })
    return () => {
      vigente = false
    }
  }, [user])

  const puedeGenerar = useCallback(
    (def: DefinicionReporte<any>) => misModulos === null || def.modulos.some((m) => misModulos.includes(m)),
    [misModulos],
  )

  const modulosFaltantes = useCallback(
    (def: DefinicionReporte<any>) => def.modulos.filter((m) => !(misModulos ?? []).includes(m)),
    [misModulos],
  )

  // ── Meses de trabajo ──
  // Se toman del contexto cuando ya están cargados; si no, se consultan.
  useEffect(() => {
    const delContexto: MesRef[] = [
      ...(currentMonth ? [currentMonth] : []),
      ...monthHistory,
    ].map((m) => ({
      id: m.id,
      nombre: m.name,
      anio: m.year,
      mes: m.month,
      activo: m.status === "active",
    }))

    if (delContexto.length > 0) {
      setMeses(delContexto)
      return
    }

    let vigente = true
    cargarMeses()
      .then((lista) => {
        if (vigente) setMeses(lista)
      })
      .catch(() => {
        /* el reporte avisará si necesita un mes y no hay ninguno */
      })
    return () => {
      vigente = false
    }
  }, [currentMonth, monthHistory])

  const mesActivo = useMemo(() => meses.find((m) => m.activo) ?? meses[0] ?? null, [meses])

  // ── Selección de reporte ──

  const seleccionarReporte = useCallback(
    async (def: DefinicionReporte<any>) => {
      setReporteId(def.id)
      setColumnasReporte(def.columnas)
      setColumnas(columnasPorDefecto(def.columnas))
      setFuentes((def.fuentes ?? []).filter((f) => f.default !== false).map((f) => f.id))

      const iniciales: Record<string, string> = {}
      for (const filtro of def.filtros ?? []) {
        if (filtro.tipo === "rangoFechas" || filtro.tipo === "rangoNumeros") {
          iniciales[`${filtro.id}_desde`] = ""
          iniciales[`${filtro.id}_hasta`] = ""
        } else if (filtro.tipo === "mes") {
          iniciales[filtro.id] = filtro.valorInicial ?? mesActivo?.id ?? ""
        } else if (filtro.tipo === "anio") {
          iniciales[filtro.id] = filtro.valorInicial ?? String(new Date().getFullYear())
        } else {
          iniciales[filtro.id] = filtro.valorInicial ?? ""
        }
      }
      setFiltros(iniciales)

      const dinamicos = (def.filtros ?? []).filter((f) => f.cargarOpciones)
      setOpcionesDinamicas({})

      if (dinamicos.length === 0 && !def.cargarColumnas) return

      setCargandoColumnas(!!def.cargarColumnas)
      try {
        const [cargadas, columnasExtra] = await Promise.all([
          Promise.all(dinamicos.map(async (f) => [f.id, await f.cargarOpciones!()] as const)),
          def.cargarColumnas ? def.cargarColumnas() : Promise.resolve([]),
        ])

        setOpcionesDinamicas(Object.fromEntries(cargadas))

        if (columnasExtra.length > 0) {
          const todas = [...def.columnas, ...columnasExtra]
          setColumnasReporte(todas)
          setColumnas(columnasPorDefecto(todas))
        }
      } catch (error) {
        avisarError(error)
      } finally {
        setCargandoColumnas(false)
      }
    },
    [mesActivo],
  )

  // Si los meses llegan después de elegir el reporte, se completa el filtro.
  useEffect(() => {
    if (!reporte || !mesActivo) return
    const filtroMes = reporte.filtros?.find((f) => f.tipo === "mes")
    if (!filtroMes) return
    setFiltros((previos) =>
      previos[filtroMes.id] ? previos : { ...previos, [filtroMes.id]: mesActivo.id },
    )
  }, [reporte, mesActivo])

  // ── Ejecución ──

  const contexto: ContextoReporte = useMemo(
    () => ({
      filtros: Object.fromEntries(
        Object.entries(filtros).map(([clave, valor]) => [clave, valor === TODOS ? "" : valor]),
      ),
      fuentes,
      meses,
      mesActivo,
    }),
    [filtros, fuentes, meses, mesActivo],
  )

  function avisarError(error: unknown) {
    if (error instanceof ErrorConsulta) {
      toast.error(error.mensajeUsuario)
      console.error("[listados] consulta fallida", error)
      return
    }
    if (error instanceof ErrorReporte) {
      toast.error(error.message)
      return
    }
    console.error("[listados] error inesperado", error)
    toast.error(error instanceof Error ? error.message : "No se pudo generar el reporte")
  }

  async function exportarExcel() {
    if (!reporte) return
    setMostrarColumnas(false)
    setTrabajando("excel")
    try {
      const resultado = await ejecutarReporte(reporte, contexto, columnas, columnasReporte)
      descargarArchivo(resultado.archivo, resultado.nombre)
      toast.success(
        `${resultado.nombre} — ${resultado.filas} fila${resultado.filas === 1 ? "" : "s"} en ${resultado.hojas.length} hoja${resultado.hojas.length === 1 ? "" : "s"}.`,
      )
      for (const aviso of resultado.advertencias) toast.warning(aviso)
    } catch (error) {
      avisarError(error)
    } finally {
      setTrabajando(null)
    }
  }

  async function ejecutarAccion(accion: AccionReporte) {
    setTrabajando(accion.id)
    try {
      const { contenido, nombre, mensaje } = await accion.ejecutar(contexto)
      descargarArchivo(contenido, nombre)
      toast.success(mensaje ?? `${nombre} generado.`)
    } catch (error) {
      avisarError(error)
    } finally {
      setTrabajando(null)
    }
  }

  // ── Filtros ──

  function cambiarFiltro(clave: string, valor: string) {
    setFiltros((previos) => ({ ...previos, [clave]: valor }))
  }

  function opcionesDe(filtro: FiltroReporte): OpcionFiltro[] {
    if (filtro.tipo === "mes") return opcionesDeMeses(meses)
    if (filtro.tipo === "anio") return opcionesDeAnios(meses)
    return opcionesDinamicas[filtro.id] ?? filtro.opciones ?? []
  }

  function renderFiltro(filtro: FiltroReporte) {
    if (filtro.tipo === "rangoFechas") {
      return (
        <div key={filtro.id} className="space-y-1.5">
          <Label className="text-sm font-medium text-gray-700">{filtro.label}</Label>
          <div className="flex items-center gap-2">
            <Input
              type="date"
              className="max-w-[170px]"
              value={filtros[`${filtro.id}_desde`] ?? ""}
              onChange={(e) => cambiarFiltro(`${filtro.id}_desde`, e.target.value)}
            />
            <span className="text-sm text-gray-500">a</span>
            <Input
              type="date"
              className="max-w-[170px]"
              value={filtros[`${filtro.id}_hasta`] ?? ""}
              onChange={(e) => cambiarFiltro(`${filtro.id}_hasta`, e.target.value)}
            />
          </div>
          {filtro.ayuda && <p className="text-xs text-gray-500">{filtro.ayuda}</p>}
        </div>
      )
    }

    if (filtro.tipo === "rangoNumeros") {
      return (
        <div key={filtro.id} className="space-y-1.5">
          <Label className="text-sm font-medium text-gray-700">{filtro.label}</Label>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={0}
              placeholder="desde"
              className="max-w-[110px]"
              value={filtros[`${filtro.id}_desde`] ?? ""}
              onChange={(e) => cambiarFiltro(`${filtro.id}_desde`, e.target.value)}
            />
            <span className="text-sm text-gray-500">a</span>
            <Input
              type="number"
              min={0}
              placeholder="hasta"
              className="max-w-[110px]"
              value={filtros[`${filtro.id}_hasta`] ?? ""}
              onChange={(e) => cambiarFiltro(`${filtro.id}_hasta`, e.target.value)}
            />
          </div>
          {filtro.ayuda && <p className="text-xs text-gray-500 max-w-prose">{filtro.ayuda}</p>}
        </div>
      )
    }

    if (filtro.tipo === "texto") {
      return (
        <div key={filtro.id} className="space-y-1.5">
          <Label className="text-sm font-medium text-gray-700">{filtro.label}</Label>
          <Input
            className="max-w-xs"
            value={filtros[filtro.id] ?? ""}
            onChange={(e) => cambiarFiltro(filtro.id, e.target.value)}
          />
          {filtro.ayuda && <p className="text-xs text-gray-500">{filtro.ayuda}</p>}
        </div>
      )
    }

    const opciones = opcionesDe(filtro)
    const valor = filtros[filtro.id] ?? ""

    return (
      <div key={filtro.id} className="space-y-1.5">
        <Label className="text-sm font-medium text-gray-700">
          {filtro.label}
          {filtro.requerido && <span className="text-red-600"> *</span>}
        </Label>
        <Select value={valor === "" ? TODOS : valor} onValueChange={(v) => cambiarFiltro(filtro.id, v)}>
          <SelectTrigger className="max-w-xs">
            <SelectValue placeholder="Seleccione…" />
          </SelectTrigger>
          <SelectContent>
            {filtro.opcionTodos && <SelectItem value={TODOS}>{filtro.opcionTodos}</SelectItem>}
            {opciones.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {filtro.ayuda && <p className="text-xs text-gray-500 max-w-prose">{filtro.ayuda}</p>}
        {opciones.length === 0 && (
          <p className="text-xs text-amber-700">No hay opciones disponibles para este filtro.</p>
        )}
      </div>
    )
  }

  // ── Render ──

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center h-16 gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push("/dashboard")}
              className="flex items-center space-x-2"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Volver</span>
            </Button>
            <h1 className="text-xl font-semibold text-gray-900">Listados e informes</h1>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
          {/* Catálogo de reportes */}
          <Card className="h-fit lg:sticky lg:top-6">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Reportes disponibles</CardTitle>
              <CardDescription>Elija qué informe desea generar.</CardDescription>
              <div className="relative pt-2">
                <Search className="w-4 h-4 absolute left-3 top-1/2 translate-y-[2px] text-gray-400" />
                <Input
                  className="pl-9"
                  placeholder="Buscar reporte o tabla…"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                />
              </div>
            </CardHeader>
            <CardContent className="max-h-[70vh] overflow-y-auto space-y-4">
              {grupos.length === 0 && (
                <p className="text-sm text-gray-500">Ningún reporte coincide con la búsqueda.</p>
              )}
              {grupos.map(({ grupo, reportes }) => (
                <div key={grupo}>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1.5">
                    {grupo}
                  </p>
                  <div className="space-y-0.5">
                    {reportes.map((def) => {
                      const habilitado = puedeGenerar(def)
                      return (
                        <button
                          key={def.id}
                          onClick={() => seleccionarReporte(def)}
                          title={habilitado ? def.descripcion : "Requiere un permiso que su cuenta no tiene"}
                          className={`w-full text-left text-sm px-3 py-2 rounded transition-colors ${
                            def.id === reporteId
                              ? "bg-green-600 text-white font-medium"
                              : habilitado
                                ? "hover:bg-gray-100 text-gray-700"
                                : "hover:bg-gray-100 text-gray-400"
                          }`}
                        >
                          {def.titulo}
                          {!habilitado && <span className="ml-1.5 text-xs">(sin permiso)</span>}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Panel del reporte */}
          {!reporte ? (
            <Card>
              <CardContent className="py-16 text-center text-gray-500">
                <Table2 className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                <p className="font-medium text-gray-700">Seleccione un reporte</p>
                <p className="text-sm mt-1">
                  Cada informe permite elegir el periodo, las fuentes de datos y qué columnas incluir
                  antes de descargar el Excel.
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>{reporte.titulo}</CardTitle>
                <CardDescription>{reporte.descripcion}</CardDescription>
                <p className="text-xs text-gray-400 flex items-center gap-1.5 pt-1">
                  <Database className="w-3.5 h-3.5" />
                  {reporte.tablas.join(" · ")}
                </p>
              </CardHeader>

              <CardContent className="space-y-6">
                {!puedeGenerar(reporte) && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
                    <p className="text-sm text-amber-900 flex items-start gap-2">
                      <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>
                        Su cuenta no tiene permiso para los datos de este reporte. Pida acceso de
                        lectura a uno de estos módulos:{" "}
                        <strong>{modulosFaltantes(reporte).join(", ")}</strong>.
                      </span>
                    </p>
                  </div>
                )}

                {reporte.notas && reporte.notas.length > 0 && (
                  <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 space-y-1.5">
                    {reporte.notas.map((nota, i) => (
                      <p key={i} className="text-sm text-blue-900 flex items-start gap-2">
                        <Info className="w-4 h-4 shrink-0 mt-0.5" />
                        <span>{nota}</span>
                      </p>
                    ))}
                  </div>
                )}

                {reporte.fuentes && reporte.fuentes.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-gray-700">Fuentes a combinar</Label>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {reporte.fuentes.map((fuente) => (
                        <label
                          key={fuente.id}
                          className="flex items-start gap-2.5 rounded border px-3 py-2 cursor-pointer hover:bg-gray-50"
                        >
                          <Checkbox
                            className="mt-0.5"
                            checked={fuentes.includes(fuente.id)}
                            onCheckedChange={(marcada) =>
                              setFuentes((previas) =>
                                marcada === true
                                  ? [...new Set([...previas, fuente.id])]
                                  : previas.filter((f) => f !== fuente.id),
                              )
                            }
                          />
                          <span>
                            <span className="block text-sm font-medium">{fuente.label}</span>
                            {fuente.descripcion && (
                              <span className="block text-xs text-gray-500">{fuente.descripcion}</span>
                            )}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {reporte.filtros && reporte.filtros.length > 0 && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    {reporte.filtros.map(renderFiltro)}
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-3 border-t pt-5">
                  <Button
                    variant="outline"
                    onClick={() => setMostrarColumnas(true)}
                    className="border-gray-300"
                    disabled={cargandoColumnas}
                  >
                    {cargandoColumnas ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Cargando columnas…
                      </>
                    ) : (
                      <>
                        <Filter className="w-4 h-4 mr-2" />
                        Columnas ({columnas.length}/{columnasReporte.length})
                      </>
                    )}
                  </Button>

                  <Button
                    className="bg-green-600 hover:bg-green-700"
                    onClick={exportarExcel}
                    disabled={trabajando !== null || columnas.length === 0 || !puedeGenerar(reporte)}
                  >
                    {trabajando === "excel" ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Generando…
                      </>
                    ) : (
                      <>
                        <FileSpreadsheet className="w-4 h-4 mr-2" />
                        Descargar Excel
                      </>
                    )}
                  </Button>

                  {(reporte.acciones ?? []).map((accion) => (
                    <Button
                      key={accion.id}
                      variant="outline"
                      onClick={() => ejecutarAccion(accion)}
                      disabled={trabajando !== null || !puedeGenerar(reporte)}
                    >
                      {trabajando === accion.id ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Generando…
                        </>
                      ) : (
                        <>
                          {accion.icono === "pdf" ? (
                            <FileText className="w-4 h-4 mr-2" />
                          ) : (
                            <FileSpreadsheet className="w-4 h-4 mr-2" />
                          )}
                          {accion.label}
                        </>
                      )}
                    </Button>
                  ))}
                </div>

                {columnas.length === 0 && (
                  <p className="text-sm text-amber-700">
                    No hay columnas seleccionadas: elija al menos una para poder exportar.
                  </p>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {reporte && (
          <SelectorColumnas
            abierto={mostrarColumnas}
            onCambiarAbierto={setMostrarColumnas}
            titulo={reporte.titulo}
            columnas={columnasReporte}
            seleccionadas={columnas}
            onCambiarSeleccion={setColumnas}
            onConfirmar={exportarExcel}
            exportando={trabajando !== null}
          />
        )}
      </main>
    </div>
  )
}

export default function ListadosPage() {
  return (
    <PermissionsGuard moduleName="listados">
      {() => <ListadosContent />}
    </PermissionsGuard>
  )
}
