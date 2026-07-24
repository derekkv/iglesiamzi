"use client"

import { useEffect, useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useMonth } from "@/contexts/month-context"
import { PermissionsGuard } from "@/lib/permissions-guard"
import { useAuth } from "@/contexts/auth-context"
import { supabase } from "@/lib/secure-db"
import { useRealtimeMultiple } from "@/hooks/use-realtime"
import { useRestrictedAccess } from "@/hooks/use-restricted-access"
import { currentMonthNameEcuador, todayEcuador, currentMonthEcuador, currentYearEcuador } from "@/lib/timezone"
import { getAlfoliMes } from "@/lib/mod/alfoli-service"

import { Lock, ArrowLeft, TrendingUp, TrendingDown, Users, DollarSign, ChevronDown, ChevronRight, ExternalLink, BookOpen, Heart, UserCheck, GraduationCap, Palette, AlertTriangle, Home, Cake, ClipboardCheck, CalendarDays } from "lucide-react"
import { censoService } from "@/lib/mod/censo-service"
import { censoMdgService } from "@/lib/mod/censo-mdg-service"
import { censoJovenesService } from "@/lib/mod/censo-jovenes-service"
import { censoNinosService } from "@/lib/mod/censo-ninos-service"
import { getLunesSemanaActual } from "@/lib/mod/gestion-celulas-service"
import { discipuladoCiclosService, CICLO_CONFIG, type CicloTipo } from "@/lib/mod/discipulado-ciclos-service"
import { proyectoMarioCiclosService, PROYECTO_MARIO_CICLO_CONFIG, type ProyectoMarioCicloTipo } from "@/lib/mod/proyecto-mario-ciclos-service"
import { getCumpleanerosMes, getHistorialEnvios } from "@/lib/mod/cumpleanos-service"

// Ministerios para asistencia de servidores
const MINISTERIOS_SERVIDORES: { key: string; label: string }[] = [
  { key: "administracion", label: "Administración" },
  { key: "alabanza", label: "Alabanza" },
  { key: "celulas", label: "Células" },
  { key: "comunicacion", label: "Comunicación" },
  { key: "discipulado", label: "Discipulado" },
  { key: "herederos", label: "Herederos" },
  { key: "hombres", label: "Hombres" },
  { key: "intercesion", label: "Intercesión" },
  { key: "jovenes", label: "Jóvenes" },
  { key: "mdg", label: "Mujeres de Gracia" },
  { key: "pastoral", label: "Pastoral" },
  { key: "protocolo", label: "Protocolo" },
  { key: "redil", label: "Redil" },
]

function ControlMensualContent({ canEdit }: { canEdit: boolean }) {
  const router = useRouter()
  const { currentMonth, monthHistory, startNewMonth, closeCurrentMonth } = useMonth()
  const { user } = useAuth()

  // Resumen financiero y asistencia
  const [ingresos, setIngresos] = useState<any[]>([])
  const [egresos, setEgresos] = useState<any[]>([])
  const [asistenciaColumns, setAsistenciaColumns] = useState<any[]>([])
  const [asistenciaDetails, setAsistenciaDetails] = useState<any[]>([])
  const [asistenciaData, setAsistenciaData] = useState<any[]>([])
  const [nominaRecords, setNominaRecords] = useState<any[]>([])
  const [pagoDiarioRecords, setPagoDiarioRecords] = useState<any[]>([])
  const [totalCelulas, setTotalCelulas] = useState(0)
  const [totalAlfoli, setTotalAlfoli] = useState(0)
  const { hasAccess: hasNominaAccess } = useRestrictedAccess("nomina")

  // Acordeones
  const [openIngresos, setOpenIngresos] = useState(false)
  const [openEgresos, setOpenEgresos] = useState(false)
  const [openAsistencia, setOpenAsistencia] = useState(false)
  const [openNomina, setOpenNomina] = useState(false)
  const [openEstadisticas, setOpenEstadisticas] = useState(true)
  const [openProyectoMario, setOpenProyectoMario] = useState(false)

  // Estadísticas generales
  const [statsCenso, setStatsCenso] = useState({ total: 0, miembros: 0, activos: 0 })
  const [statsCensoMdg, setStatsCensoMdg] = useState({ total: 0, miembros: 0, activos: 0, nuevosCreyentes: 0, nuevosMes: 0, nuevosHoy: 0 })
  const [statsCensoNinos, setStatsCensoNinos] = useState({ total: 0, baby: 0, kids: 0, explores: 0, champions: 0 })
  const [statsCensoJovenes, setStatsCensoJovenes] = useState({ total: 0, miembros: 0, activos: 0, nuevos: 0, primeraVez: 0, nuevosMes: 0, nuevosHoy: 0 })
  const [statsDiscipulado, setStatsDiscipulado] = useState<Record<CicloTipo, { inscritos: number; aprobados: number; reprobados: number; enCurso: number }>>({
    primeros_pasos: { inscritos: 0, aprobados: 0, reprobados: 0, enCurso: 0 },
    seguimos_avanzando: { inscritos: 0, aprobados: 0, reprobados: 0, enCurso: 0 },
    siendo_iglesia: { inscritos: 0, aprobados: 0, reprobados: 0, enCurso: 0 },
  })
  const [statsBautizos, setStatsBautizos] = useState({ total: 0, esteMes: 0, censoBautizados: 0 })
  const [statsMatrimonios, setStatsMatrimonios] = useState({ total: 0, esteMes: 0, censoMatrimonios: 0 })
  const [statsPresentaciones, setStatsPresentaciones] = useState({ total: 0, esteMes: 0 })
  const [statsAtrasados, setStatsAtrasados] = useState({ total: 0, sinGestionar: 0 })
  const [statsCelulas, setStatsCelulas] = useState({ totalMiembros: 0, asistieronSemana: 0 })
  const [statsProyectoMario, setStatsProyectoMario] = useState<Record<ProyectoMarioCicloTipo, { inscritos: number; ultimaClase: number; asistieron: number; faltaron: number }>>({
    belleza_integral_sabados: { inscritos: 0, ultimaClase: 0, asistieron: 0, faltaron: 0 },
    belleza_integral_viernes: { inscritos: 0, ultimaClase: 0, asistieron: 0, faltaron: 0 },
    manualidades: { inscritos: 0, ultimaClase: 0, asistieron: 0, faltaron: 0 },
    belleza_cejas: { inscritos: 0, ultimaClase: 0, asistieron: 0, faltaron: 0 },
    gastronomia: { inscritos: 0, ultimaClase: 0, asistieron: 0, faltaron: 0 },
  })
  const [loadingStats, setLoadingStats] = useState(true)
  const [loadingProgress, setLoadingProgress] = useState(0)

  // === NUEVAS SECCIONES ===
  // Asistencia de Servidores
  const [statsServidores, setStatsServidores] = useState<Record<string, { total: number; asistieron: number; faltaron: number; justificaron: number; atrasados: number }>>({})
  const [openServidores, setOpenServidores] = useState(false)

  // Redil - Ayuda Social
  const [statsRedil, setStatsRedil] = useState({
    totalCasos: 0,
    pendientes: 0,
    entregadosSemana: 0,
    entregadosMes: 0,
    porTipo: {} as Record<string, number>,
  })
  const [openRedil, setOpenRedil] = useState(false)

  // Cumpleaños
  const [statsCumpleanos, setStatsCumpleanos] = useState({
    totalMes: 0,
    enviados: 0,
    pendientesEnvio: 0,
  })
  const [openCumpleanos, setOpenCumpleanos] = useState(false)

  // Eventos / Encuentro
  const [statsEventos, setStatsEventos] = useState<Array<{ id: number; nombre: string; inscritos: number; pagadosCompleto: number; pendientesPago: number; totalRecaudado: number; totalValor: number }>>([])
  const [openEventos, setOpenEventos] = useState(false)

  // Auto apertura/cierre de mes
  const autoManageRef = useRef(false)
  const hasAutoManagedRef = useRef(false)

  useEffect(() => {
    // Solo ejecutar una vez cuando se monta y hay datos cargados
    if (!canEdit || !user) return
    // Solo ejecutar una vez por montaje del componente
    if (hasAutoManagedRef.current) return
    autoManageMonth()
  }, [currentMonth, canEdit, user])

  const autoManageMonth = async () => {
    // Prevenir ejecuciones simultáneas
    if (autoManageRef.current) return
    if (!canEdit) return

    const mesActual = currentMonthEcuador()
    const anioActual = currentYearEcuador()

    // Si hay mes activo y es el mes correcto, no hacer nada
    if (currentMonth && currentMonth.month === mesActual && currentMonth.year === anioActual) {
      hasAutoManagedRef.current = true
      return
    }

    // Si hay mes activo pero es de otro mes, cerrarlo
    if (currentMonth && (currentMonth.month !== mesActual || currentMonth.year !== anioActual)) {
      autoManageRef.current = true
      hasAutoManagedRef.current = true
      try {
        await closeCurrentMonth(todayEcuador())
      } catch (e) { console.error("Error auto-cerrando mes:", e) }
      finally { autoManageRef.current = false }
    }
    // No crear automáticamente — dejar que el usuario lo haga desde el dashboard
  }

  // Cargar resumen del mes
  useEffect(() => {
    if (currentMonth?.id) loadSummary()
  }, [currentMonth])

  // Cargar estadísticas generales (independiente del mes)
  useEffect(() => {
    loadEstadisticas()
  }, [])

  const loadEstadisticas = async () => {
    setLoadingStats(true)
    setLoadingProgress(0)

    const mesActual = currentMonthEcuador()
    const anioActual = currentYearEcuador()
    const primerDiaMes = `${anioActual}-${String(mesActual).padStart(2, "0")}-01`
    const ultimoDiaMes = `${anioActual}-${String(mesActual).padStart(2, "0")}-31`
    const lunesSemana = getLunesSemanaActual()

    let completed = 0
    const totalTasks = 13
    const tick = () => { completed++; setLoadingProgress(Math.round((completed / totalTasks) * 100)) }

    // Cada sección se lanza en paralelo y actualiza su estado apenas resuelve
    const p1 = Promise.all([censoService.getAll().catch(() => []), censoMdgService.getAll().catch(() => []), censoNinosService.getAll().catch(() => []), censoJovenesService.getAll().catch(() => [])]).then(([censoData, censoMdgData, censoNinosData, censoJovenesData]) => {
      const mesActualStr = `${anioActual}-${String(mesActual).padStart(2, "0")}`
      const hoyStr = todayEcuador()
      setStatsCenso({
        total: censoData.length,
        miembros: censoData.filter(c => c.miembro).length,
        activos: censoData.filter(c => c.miembro_activo).length,
      })
      setStatsCensoMdg({
        total: censoMdgData.length,
        miembros: censoMdgData.filter(c => c.miembro).length,
        activos: censoMdgData.filter(c => c.miembro_activo).length,
        nuevosCreyentes: censoMdgData.filter((c: any) => c.nuevo_creyente).length,
        nuevosMes: censoMdgData.filter((c: any) => c.nuevo_creyente && c.created_at && c.created_at.startsWith(mesActualStr)).length,
        nuevosHoy: censoMdgData.filter((c: any) => c.nuevo_creyente && c.created_at && c.created_at.startsWith(hoyStr)).length,
      })
      setStatsCensoNinos({
        total: censoNinosData.length,
        baby: censoNinosData.filter((c: any) => c.grupo === "HEREDEROS BABY").length,
        kids: censoNinosData.filter((c: any) => c.grupo === "HEREDEROS KIDS").length,
        explores: censoNinosData.filter((c: any) => c.grupo === "HEREDEROS EXPLORES").length,
        champions: censoNinosData.filter((c: any) => c.grupo === "HEREDEROS CHAMPIONS").length,
      })
      setStatsCensoJovenes({
        total: censoJovenesData.length,
        miembros: censoJovenesData.filter(c => c.miembro).length,
        activos: censoJovenesData.filter(c => c.miembro_activo).length,
        nuevos: censoJovenesData.filter(c => c.nuevo_creyente).length,
        primeraVez: censoJovenesData.filter((c: any) => c.primera_vez_iglesia).length,
        nuevosMes: censoJovenesData.filter((c: any) => (c.nuevo_creyente || c.primera_vez_iglesia) && c.created_at && c.created_at.startsWith(mesActualStr)).length,
        nuevosHoy: censoJovenesData.filter((c: any) => (c.nuevo_creyente || c.primera_vez_iglesia) && c.created_at && c.created_at.startsWith(hoyStr)).length,
      })
      tick()
      return { censoBautizados: censoData.filter(c => c.bautizo_irdd).length + censoMdgData.filter(c => c.bautizo_irdd).length, censoMatrimonios: censoData.filter(c => c.matrimonio_irdd).length + censoMdgData.filter(c => c.matrimonio_irdd).length, totalCelulasMiembros: censoData.filter(c => c.celula_asiste).length + censoMdgData.filter((c: any) => c.celula_asiste).length }
    })
    const p2 = Promise.all((Object.keys(CICLO_CONFIG) as CicloTipo[]).map(tipo => discipuladoCiclosService.getCicloActivoCompleto(tipo).then(r => ({ tipo, data: r })).catch(() => ({ tipo, data: null })))).then(results => {
      const stats: Record<CicloTipo, { inscritos: number; aprobados: number; reprobados: number; enCurso: number }> = { primeros_pasos: { inscritos: 0, aprobados: 0, reprobados: 0, enCurso: 0 }, seguimos_avanzando: { inscritos: 0, aprobados: 0, reprobados: 0, enCurso: 0 }, siendo_iglesia: { inscritos: 0, aprobados: 0, reprobados: 0, enCurso: 0 } }
      for (const { tipo, data: ciclo } of results) { if (ciclo) { stats[tipo] = { inscritos: ciclo.participantes.length, aprobados: ciclo.participantes.filter(p => p.estatus === "aprobado").length, reprobados: ciclo.participantes.filter(p => p.estatus === "reprobado").length, enCurso: ciclo.participantes.filter(p => p.estatus === "en_curso").length } } }
      setStatsDiscipulado(stats); tick()
    })
    const p3 = supabase.from("bautizos").select("id, fecha").then(res => { const d = res.data||[]; p1.then(({censoBautizados})=>{setStatsBautizos({total:d.length,esteMes:d.filter(b=>b.fecha>=primerDiaMes&&b.fecha<=ultimoDiaMes).length,censoBautizados})}); tick() })
    const p4 = supabase.from("matrimonios").select("id, fecha").then(res => { const d = res.data||[]; p1.then(({censoMatrimonios})=>{setStatsMatrimonios({total:d.length,esteMes:d.filter(m=>m.fecha>=primerDiaMes&&m.fecha<=ultimoDiaMes).length,censoMatrimonios})}); tick() })
    const p5 = supabase.from("presentacion_ninos").select("id, fecha").then(res => { const d = res.data||[]; setStatsPresentaciones({total:d.length,esteMes:d.filter(p=>p.fecha>=primerDiaMes&&p.fecha<=ultimoDiaMes).length}); tick() })
    const p6 = supabase.from("gestion_atrasados").select("id, gestionado, fecha").gte("fecha", primerDiaMes).lte("fecha", ultimoDiaMes).then(res => { const d = res.data||[]; setStatsAtrasados({total:d.length,sinGestionar:d.filter(a=>!a.gestionado).length}); tick() })
    const p7 = supabase.from("gestion_celulas").select("id, asistio").eq("semana_inicio", lunesSemana).then(res => { const d = res.data||[]; p1.then(({totalCelulasMiembros})=>{setStatsCelulas({totalMiembros:totalCelulasMiembros,asistieronSemana:d.filter(g=>g.asistio).length})}); tick() })
    const p8 = Promise.all((Object.keys(PROYECTO_MARIO_CICLO_CONFIG) as ProyectoMarioCicloTipo[]).map(tipo => proyectoMarioCiclosService.getCicloActivoCompleto(tipo).then(r => ({ tipo, data: r })).catch(() => ({ tipo, data: null })))).then(results => {
      const pm: Record<ProyectoMarioCicloTipo, { inscritos: number; ultimaClase: number; asistieron: number; faltaron: number }> = { belleza_integral_sabados:{inscritos:0,ultimaClase:0,asistieron:0,faltaron:0}, belleza_integral_viernes:{inscritos:0,ultimaClase:0,asistieron:0,faltaron:0}, manualidades:{inscritos:0,ultimaClase:0,asistieron:0,faltaron:0}, belleza_cejas:{inscritos:0,ultimaClase:0,asistieron:0,faltaron:0}, gastronomia:{inscritos:0,ultimaClase:0,asistieron:0,faltaron:0} }
      for (const {tipo,data:ciclo} of results) { if(ciclo){const ins=ciclo.participantes.length;const hoy=new Date();hoy.setHours(0,0,0,0);const fp=ciclo.fechas.filter(f=>new Date(f.fecha+"T00:00:00")<=hoy);const uf=fp[fp.length-1];let a=0,fa=0;if(uf){a=ciclo.asistencia.filter(x=>x.fecha_id===uf.id&&x.status==="A").length;fa=ins-a};pm[tipo]={inscritos:ins,ultimaClase:uf?uf.numero_clase:0,asistieron:a,faltaron:fa}} }
      setStatsProyectoMario(pm); tick()
    })
    const p9 = supabase.from("asistencia_servidores").select("modulo, estado").gte("fecha", primerDiaMes).lte("fecha", ultimoDiaMes).then(res => {
      const data = res.data||[]; const s: Record<string,{total:number;asistieron:number;faltaron:number;justificaron:number;atrasados:number}> = {}
      for (const min of MINISTERIOS_SERVIDORES){const r=data.filter((x:any)=>x.modulo===min.key);s[min.key]={total:r.filter((x:any)=>x.estado&&x.estado!=="pendiente").length,asistieron:r.filter((x:any)=>x.estado==="asistio").length,faltaron:r.filter((x:any)=>x.estado==="falto").length,justificaron:r.filter((x:any)=>x.estado==="justifico").length,atrasados:r.filter((x:any)=>x.estado==="atrasado").length}}
      setStatsServidores(s); tick()
    })
    const p10 = Promise.all([supabase.from("casos_redil").select("id, estado, fecha_creacion"),supabase.from("solicitudes_redil").select("caso_id, tipo_ayuda"),supabase.from("entregas_redil").select("caso_id, fecha_entrega")]).then(([cR,sR,eR])=>{
      const casos=cR.data||[];const sols=sR.data||[];const ents=eR.data||[];const pend=casos.filter((c:any)=>!["cerrado","rechazado","entregado"].includes(c.estado)).length;const eMes=ents.filter((e:any)=>e.fecha_entrega>=primerDiaMes&&e.fecha_entrega<=ultimoDiaMes).length;const h7=new Date();h7.setDate(h7.getDate()-7);const eSem=ents.filter((e:any)=>e.fecha_entrega>=h7.toISOString().split("T")[0]).length
      const ids=new Set(casos.filter((c:any)=>c.estado==="cerrado"||c.estado==="entregado").map((c:any)=>c.id));const pt:Record<string,number>={};for(const s of sols){if(ids.has((s as any).caso_id)){for(const t of (s as any).tipo_ayuda||[]){pt[t]=(pt[t]||0)+1}}}
      setStatsRedil({totalCasos:casos.length,pendientes:pend,entregadosSemana:eSem,entregadosMes:eMes,porTipo:pt}); tick()
    })
    const p11 = Promise.all([getCumpleanerosMes(mesActual,anioActual).catch(()=>[] as any[]),getHistorialEnvios(anioActual,mesActual).catch(()=>[] as any[])]).then(([cum,env])=>{
      const pend=cum.length-env.length;setStatsCumpleanos({totalMes:cum.length,enviados:env.length,pendientesEnvio:pend>0?pend:0}); tick()
    })
    const p12 = supabase.from("eventos_tabs").select("id, nombre, valor_default, is_active").eq("is_active", true).order("sort_order", { ascending: true }).then(async(res)=>{
      const evts=res.data||[];if(evts.length>0){const parts=await Promise.all(evts.map((ev:any)=>supabase.from("evento_participantes").select("id, valor, abono").eq("evento_id",ev.id).then(r=>({id:ev.id,nombre:ev.nombre,parts:r.data||[]}))));setStatsEventos(parts.map(({id,nombre,parts:pp})=>{const ins=pp.length;const pag=pp.filter((p:any)=>Number(p.valor)<=0||Number(p.abono)>=Number(p.valor)).length;return{id,nombre,inscritos:ins,pagadosCompleto:pag,pendientesPago:ins-pag,totalRecaudado:pp.reduce((s:number,p:any)=>s+Number(p.abono||0),0),totalValor:pp.reduce((s:number,p:any)=>s+Number(p.valor||0),0)}}))}else{setStatsEventos([])}
      tick()
    })

    await Promise.allSettled([p1,p2,p3,p4,p5,p6,p7,p8,p9,p10,p11,p12])
    setLoadingProgress(100)
    setLoadingStats(false)
  }

  const loadSummary = async () => {
    if (!currentMonth?.id) return
    try {
      const [ingRes, egRes, colRes, detRes, datRes, nomRes, pdRes] = await Promise.all([
        supabase.from("ingresos").select("*").eq("mes_id", currentMonth.id),
        supabase.from("egresos").select("*").eq("mes_id", currentMonth.id),
        supabase.from("asistencia_columnas").select("*").eq("mes_id", currentMonth.id).order("orden"),
        supabase.from("asistencia_detalles").select("*").eq("mes_id", currentMonth.id).order("orden"),
        supabase.from("asistencia_datos").select("*").eq("mes_id", currentMonth.id),
        supabase.from("nomina").select("*").eq("mes_id", currentMonth.id),
        supabase.from("pago_diario").select("*").eq("mes_id", currentMonth.id),
      ])
      setIngresos(ingRes.data || [])
      setEgresos(egRes.data || [])
      setAsistenciaColumns(colRes.data || [])
      setAsistenciaDetails(detRes.data || [])
      setAsistenciaData(datRes.data || [])
      setNominaRecords(nomRes.data || [])
      setPagoDiarioRecords(pdRes.data || [])

      // Cargar totales consolidados (células + alfolí)
      const monthNum = currentMonth.month
      const yearNum = currentMonth.year

      const alfoliRecords = await getAlfoliMes(monthNum, yearNum)
      setTotalAlfoli(alfoliRecords.reduce((sum, r) => sum + Number(r.valor), 0))

      const { data: celulasData } = await supabase
        .from("ofrendas_celulas")
        .select("valor")
        .eq("mes", monthNum)
        .eq("anio", yearNum)
        .eq("recibido", true)
      setTotalCelulas((celulasData || []).reduce((sum: number, r: any) => sum + Number(r.valor), 0))
    } catch (error) {
      console.error("Error cargando resumen:", error)
    }
  }

  useRealtimeMultiple(["ingresos", "egresos", "asistencia_columnas", "asistencia_datos", "nomina", "pago_diario"], () => loadSummary())

  // Cálculos
  const totalIngresosModulo = ingresos.reduce((sum, r) => sum + Number(r.monto || 0), 0)
  const totalIngresos = totalIngresosModulo + totalCelulas + totalAlfoli
  const totalEgresos = egresos.reduce((sum, r) => sum + Number(r.monto || 0), 0)
  const totalPagoDiario = pagoDiarioRecords.reduce((sum: number, r: any) => sum + Number(r.valor || 0), 0)
  const totalNominaAPagar = nominaRecords.reduce((s: number, r: any) => s + Number(r.valor_a_pagar || 0), 0)
  const totalNominaPagado = nominaRecords.reduce((s: number, r: any) => {
    let pagado = 0
    if (r.primera_quincena_pagada) pagado += Number(r.primera_quincena_valor || 0)
    if (r.segunda_quincena_pagada) pagado += Number(r.segunda_quincena_valor || 0)
    return s + pagado
  }, 0)
  const totalTodoPagado = totalEgresos + totalPagoDiario

  // Ingresos por categoría
  const ingresosPorCategoria = ingresos.reduce((acc, r) => {
    const cat = r.categoria_principal || "Sin categoría"
    acc[cat] = (acc[cat] || 0) + Number(r.monto || 0)
    return acc
  }, {} as Record<string, number>)

  // Egresos por categoría
  const egresosPorCategoria = egresos.reduce((acc, r) => {
    const cat = r.categoria_principal || "Sin categoría"
    acc[cat] = (acc[cat] || 0) + Number(r.monto || 0)
    return acc
  }, {} as Record<string, number>)

  // Asistencia
  const getColumnTotal = (colId: number) => asistenciaData.filter((d: any) => d.columna_id === colId).reduce((sum: number, d: any) => sum + (d.cantidad || 0), 0)
  const totalAsistencia = asistenciaData.reduce((s: number, d: any) => s + (d.cantidad || 0), 0)

  function formatDateForTable(dateString: string) {
    if (!dateString) return ""
    const date = new Date(dateString)
    return `${String(date.getUTCDate()).padStart(2, "0")}/${String(date.getUTCMonth() + 1).padStart(2, "0")}/${date.getUTCFullYear()}`
  }

  if (!user) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div></div>
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard")} className="flex items-center space-x-2">
                <ArrowLeft className="w-4 h-4" /><span>Volver</span>
              </Button>
              <h1 className="text-xl font-semibold text-gray-900">Control Mensual</h1>
            </div>
            <div className="flex items-center space-x-3">
              {!canEdit && <span className="flex items-center gap-1 text-sm text-amber-600 bg-amber-50 border border-amber-200 px-3 py-1 rounded-full"><Lock className="w-3 h-3" /> Solo lectura</span>}
              <Badge variant="outline" className="text-blue-600 border-blue-200">{currentMonthNameEcuador()}</Badge>
              {currentMonth && <Badge className="bg-green-100 text-green-800 border-green-200">Activo</Badge>}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Info del mes */}
        {currentMonth && (
          <Card className="border-blue-200 bg-blue-50/30">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">{currentMonth.name}</h2>
                  <p className="text-sm text-gray-600">Inicio: {formatDateForTable(currentMonth.start_date)} · El mes se gestiona automáticamente</p>
                </div>
                <Badge className="bg-green-600 text-white">Activo</Badge>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Indicador de carga */}
        {loadingStats && (
          <Card className="border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 animate-pulse">
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-5 h-5 border-3 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-sm font-medium text-blue-800">Cargando datos del panel...</p>
                    <span className="text-xs font-bold text-blue-700">{loadingProgress}%</span>
                  </div>
                  <div className="w-full bg-blue-200/50 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all duration-500 ease-out"
                      style={{ width: `${loadingProgress}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tarjetas de resumen superiores */}
            {/* Fila 1: Financiero */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="border-green-200 bg-green-50/50 cursor-pointer hover:shadow-md transition-shadow" onClick={() => router.push("/dashboard/ingresos-egresos")}>
                <CardContent className="pt-5 pb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-green-700">Ingresos</p>
                      <p className="text-xl font-bold text-green-700">${totalIngresos.toLocaleString("es-CO", { minimumFractionDigits: 2 })}</p>
                      <p className="text-[9px] text-green-600 mt-0.5">{ingresos.length} registros · células + alfolí + diezmos</p>
                    </div>
                    <TrendingUp className="w-6 h-6 text-green-400" />
                  </div>
                </CardContent>
              </Card>

              <Card className="border-red-200 bg-red-50/50 cursor-pointer hover:shadow-md transition-shadow" onClick={() => router.push("/dashboard/ingresos-egresos")}>
                <CardContent className="pt-5 pb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-red-700">Egresos</p>
                      <p className="text-xl font-bold text-red-700">${totalEgresos.toLocaleString("es-CO", { minimumFractionDigits: 2 })}</p>
                      <p className="text-[9px] text-red-600 mt-0.5">{egresos.length} registros</p>
                    </div>
                    <TrendingDown className="w-6 h-6 text-red-400" />
                  </div>
                </CardContent>
              </Card>

              <Card className="border-amber-200 bg-amber-50/50 cursor-pointer hover:shadow-md transition-shadow" onClick={() => router.push("/dashboard/flujo-pago")}>
                <CardContent className="pt-5 pb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-amber-700">Nómina (a pagar)</p>
                      <p className="text-xl font-bold text-amber-700">${totalNominaAPagar.toLocaleString("es-CO", { minimumFractionDigits: 2 })}</p>
                      <p className="text-[9px] text-amber-600 mt-0.5">{nominaRecords.length} personas · Pagado: ${totalNominaPagado.toLocaleString("es-CO", { minimumFractionDigits: 2 })}</p>
                    </div>
                    <DollarSign className="w-6 h-6 text-amber-400" />
                  </div>
                </CardContent>
              </Card>

              <Card className="border-purple-200 bg-purple-50/50 cursor-pointer hover:shadow-md transition-shadow" onClick={() => router.push("/dashboard/asistencia")}>
                <CardContent className="pt-5 pb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-purple-700">Asistencia Total</p>
                      <p className="text-xl font-bold text-purple-700">{totalAsistencia}</p>
                      <p className="text-[10px] text-purple-600">{asistenciaColumns.length} días · Prom: {asistenciaColumns.length > 0 ? Math.round(totalAsistencia / asistenciaColumns.length) : 0}/día</p>
                    </div>
                    <Users className="w-6 h-6 text-purple-400" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Fila 2: Censos detallados */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Censo Protocolo */}
              <Card className="border-indigo-200 bg-indigo-50/50 cursor-pointer hover:shadow-md transition-shadow" onClick={() => router.push("/dashboard/censo")}>
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-center gap-1.5 mb-2">
                    <img src="/logo.png" alt="IRDD" className="w-4 h-4 object-contain" />
                    <p className="text-xs text-indigo-700 font-semibold">Censo Protocolo</p>
                  </div>
                  <p className="text-3xl font-bold text-indigo-800">{statsCenso.total}</p>
                </CardContent>
              </Card>

              {/* Censo Niños */}
              <Card className="border-amber-200 bg-amber-50/50 cursor-pointer hover:shadow-md transition-shadow" onClick={() => router.push("/dashboard/censo-ninos")}>
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-center gap-1.5 mb-2">
                    <span className="text-sm">👶</span>
                    <p className="text-xs text-amber-700 font-semibold">Censo Niños</p>
                  </div>
                  <p className="text-3xl font-bold text-amber-800">{statsCensoNinos.total}</p>
                  <div className="mt-2 space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] text-amber-600">Baby (0-2)</span>
                      <Badge className="bg-pink-100 text-pink-800 text-[10px] px-1.5 py-0">{statsCensoNinos.baby}</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] text-amber-600">Kids (3-5)</span>
                      <Badge className="bg-blue-100 text-blue-800 text-[10px] px-1.5 py-0">{statsCensoNinos.kids}</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] text-amber-600">Explores (6-8)</span>
                      <Badge className="bg-green-100 text-green-800 text-[10px] px-1.5 py-0">{statsCensoNinos.explores}</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] text-amber-600">Champions (9-11)</span>
                      <Badge className="bg-purple-100 text-purple-800 text-[10px] px-1.5 py-0">{statsCensoNinos.champions}</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Nuevos creyentes */}
              <Card className="border-violet-200 bg-violet-50/50 cursor-pointer hover:shadow-md transition-shadow" onClick={() => router.push("/dashboard/censo-mdg")}>
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-center gap-1.5 mb-2">
                    <span className="text-sm">👩</span>
                    <p className="text-xs text-violet-700 font-semibold">Nuevos creyentes</p>
                  </div>
                  <p className="text-3xl font-bold text-violet-800">{statsCensoMdg.total}</p>
                </CardContent>
              </Card>

              {/* Censo Jóvenes */}
              <Card className="border-pink-200 bg-pink-50/50 cursor-pointer hover:shadow-md transition-shadow" onClick={() => router.push("/dashboard/censo-jovenes")}>
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-center gap-1.5 mb-2">
                    <span className="text-sm">🧑‍🤝‍🧑</span>
                    <p className="text-xs text-pink-700 font-semibold">Censo Jóvenes</p>
                  </div>
                  <p className="text-3xl font-bold text-pink-800">{statsCensoJovenes.total}</p>
                </CardContent>
              </Card>
            </div>

            {/* Fila 2b: Resumen total + Datos de iglesia */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
              <Card className="border-indigo-200 bg-indigo-50/30">
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-center gap-1">
                    <img src="/logo.png" alt="IRDD" className="w-4 h-4 object-contain" />
                    <p className="text-[10px] text-indigo-600 font-medium">Total IRDD</p>
                  </div>
                  <p className="text-2xl font-bold text-indigo-800">{statsCenso.total + statsCensoMdg.total + statsCensoNinos.total + statsCensoJovenes.total}</p>
                </CardContent>
              </Card>
              <Card className="border-sky-200 bg-sky-50/50 cursor-pointer hover:shadow-md transition-shadow" onClick={() => router.push("/dashboard/discipulado-primeros-pasos")}>
                <CardContent className="pt-4 pb-3">
                  <p className="text-[10px] text-sky-600 font-medium">Discipulado</p>
                  <p className="text-2xl font-bold text-sky-800">{Object.values(statsDiscipulado).reduce((s, v) => s + v.inscritos, 0)}</p>
                  <p className="text-[9px] text-sky-500">{Object.values(statsDiscipulado).reduce((s, v) => s + v.aprobados, 0)} aprobados · {Object.values(statsDiscipulado).reduce((s, v) => s + v.enCurso, 0)} en curso</p>
                </CardContent>
              </Card>
              <Card className="border-teal-200 bg-teal-50/50 cursor-pointer hover:shadow-md transition-shadow" onClick={() => router.push("/dashboard/bautizo")}>
                <CardContent className="pt-4 pb-3">
                  <p className="text-[10px] text-teal-600 font-medium">Bautizos</p>
                  <p className="text-2xl font-bold text-teal-800">{statsBautizos.censoBautizados}</p>
                  <p className="text-[9px] text-teal-500">total · {statsBautizos.esteMes > 0 ? <span className="text-teal-700 font-semibold">+{statsBautizos.esteMes} este mes</span> : <span>0 este mes</span>}</p>
                </CardContent>
              </Card>
              <Card className="border-rose-200 bg-rose-50/50 cursor-pointer hover:shadow-md transition-shadow" onClick={() => router.push("/dashboard/matrimonio")}>
                <CardContent className="pt-4 pb-3">
                  <p className="text-[10px] text-rose-600 font-medium">Matrimonios</p>
                  <p className="text-2xl font-bold text-rose-800">{statsMatrimonios.censoMatrimonios}</p>
                  <p className="text-[9px] text-rose-500">total · {statsMatrimonios.esteMes > 0 ? <span className="text-rose-700 font-semibold">+{statsMatrimonios.esteMes} este mes</span> : <span>0 este mes</span>}</p>
                </CardContent>
              </Card>
              <Card className="border-emerald-200 bg-emerald-50/50">
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-center gap-1">
                    <Home className="w-3 h-3 text-emerald-600" />
                    <p className="text-[10px] text-emerald-600 font-medium">Células</p>
                  </div>
                  <p className="text-2xl font-bold text-emerald-800">{statsCelulas.totalMiembros}</p>
                  <p className="text-[9px] text-emerald-500">miembros activos · {statsCelulas.asistieronSemana} asistieron esta semana</p>
                </CardContent>
              </Card>
            </div>

            {/* Fila 3: Servidores + Redil + Cumpleaños + Eventos */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {/* Asistencia Servidores */}
              <Card className="border-cyan-200 bg-cyan-50/50 cursor-pointer hover:shadow-md transition-shadow" onClick={() => setOpenServidores(!openServidores)}>
                <CardContent className="pt-5 pb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-cyan-700">Asistencia Servidores</p>
                      <p className="text-xl font-bold text-cyan-700">
                        {Object.values(statsServidores).reduce((s, v) => s + v.asistieron, 0)}
                      </p>
                      <p className="text-[9px] text-cyan-600">
                        asistieron · {Object.values(statsServidores).reduce((s, v) => s + v.faltaron, 0)} faltaron
                      </p>
                    </div>
                    <ClipboardCheck className="w-6 h-6 text-cyan-400" />
                  </div>
                </CardContent>
              </Card>

              {/* Redil */}
              <Card className="border-lime-200 bg-lime-50/50 cursor-pointer hover:shadow-md transition-shadow" onClick={() => setOpenRedil(!openRedil)}>
                <CardContent className="pt-5 pb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-lime-700">Redil - Ayuda Social</p>
                      <p className="text-xl font-bold text-lime-700">{statsRedil.entregadosMes}</p>
                      <p className="text-[9px] text-lime-600">
                        entregados este mes · {statsRedil.pendientes} pendientes
                      </p>
                    </div>
                    <Heart className="w-6 h-6 text-lime-400" />
                  </div>
                </CardContent>
              </Card>

              {/* Cumpleaños */}
              <Card className="border-fuchsia-200 bg-fuchsia-50/50 cursor-pointer hover:shadow-md transition-shadow" onClick={() => setOpenCumpleanos(!openCumpleanos)}>
                <CardContent className="pt-5 pb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-fuchsia-700">Cumpleaños del Mes</p>
                      <p className="text-xl font-bold text-fuchsia-700">{statsCumpleanos.totalMes}</p>
                      <p className="text-[9px] text-fuchsia-600">
                        {statsCumpleanos.enviados} felicitados · {statsCumpleanos.pendientesEnvio} pendientes
                      </p>
                    </div>
                    <Cake className="w-6 h-6 text-fuchsia-400" />
                  </div>
                </CardContent>
              </Card>

              {/* Eventos / Encuentro */}
              <Card className="border-violet-200 bg-violet-50/50 cursor-pointer hover:shadow-md transition-shadow" onClick={() => setOpenEventos(!openEventos)}>
                <CardContent className="pt-5 pb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-violet-700">Eventos / Encuentro</p>
                      <p className="text-xl font-bold text-violet-700">
                        {statsEventos.reduce((s, e) => s + e.inscritos, 0)}
                      </p>
                      <p className="text-[9px] text-violet-600">
                        inscritos · {statsEventos.length} evento(s) activo(s)
                      </p>
                    </div>
                    <CalendarDays className="w-6 h-6 text-violet-400" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Fila 4: Proyecto Mario + Atrasados */}
            <div className="grid grid-cols-2 md:grid-cols-2 gap-4">
              <Card className="border-orange-200 bg-orange-50/50 cursor-pointer hover:shadow-md transition-shadow" onClick={() => setOpenProyectoMario(!openProyectoMario)}>
                <CardContent className="pt-5 pb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-orange-700">Proyecto Mario</p>
                      <p className="text-xl font-bold text-orange-700">{Object.values(statsProyectoMario).reduce((s, v) => s + v.inscritos, 0)}</p>
                      <p className="text-[9px] text-orange-600">inscritos · {Object.values(statsProyectoMario).filter(v => v.inscritos > 0).length} cursos activos</p>
                    </div>
                    <Palette className="w-6 h-6 text-orange-400" />
                  </div>
                  <div className="mt-2 pt-2 border-t border-orange-200 space-y-0.5">
                    {(Object.keys(PROYECTO_MARIO_CICLO_CONFIG) as ProyectoMarioCicloTipo[]).map(tipo => {
                      const stats = statsProyectoMario[tipo]
                      const config = PROYECTO_MARIO_CICLO_CONFIG[tipo]
                      return (
                        <div key={tipo} className="flex justify-between items-center">
                          <span className="text-[9px] text-orange-600 truncate">{config.label}</span>
                          <span className="text-[10px] font-semibold text-orange-800">{stats.inscritos}</span>
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
              <Card className="border-amber-200 bg-amber-50/50">
                <CardContent className="pt-5 pb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-amber-700">Atrasados</p>
                      <p className="text-xl font-bold text-amber-700">{statsAtrasados.total}</p>
                      <p className="text-[9px] text-red-600">{statsAtrasados.sinGestionar} sin gestionar · {statsAtrasados.total - statsAtrasados.sinGestionar} gestionados</p>
                    </div>
                    <AlertTriangle className="w-6 h-6 text-amber-400" />
                  </div>
                </CardContent>
              </Card>

            </div>

            {/* Acordeones */}
            <div className="space-y-3">
              {/* ESTADÍSTICAS DETALLADAS (primero) */}
              <Card className="overflow-hidden border-indigo-200">
                <button className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors" onClick={() => setOpenEstadisticas(!openEstadisticas)}>
                  <div className="flex items-center gap-3">
                    {openEstadisticas ? <ChevronDown className="w-4 h-4 text-gray-500" /> : <ChevronRight className="w-4 h-4 text-gray-500" />}
                    <span className="text-xl">📊</span>
                    <span className="font-semibold text-gray-900">Estadísticas Detalladas</span>
                  </div>
                </button>
                {openEstadisticas && (
                  <CardContent className="pt-0 pb-6 border-t space-y-6">
                    {loadingStats ? (
                      <div className="flex justify-center py-8"><div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div></div>
                    ) : (
                      <>
                        {/* CENSOS */}
                        <div>
                          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2 mt-3"><Users className="w-4 h-4 text-indigo-600" /> Censos</h3>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            {/* Protocolo */}
                            <div className="p-4 bg-indigo-50 rounded-lg border border-indigo-100">
                              <div className="flex items-center gap-1.5 mb-2">
                                <img src="/logo.png" alt="IRDD" className="w-4 h-4 object-contain" />
                                <p className="text-xs text-indigo-700 font-semibold">Censo Protocolo</p>
                              </div>
                              <p className="text-3xl font-bold text-indigo-800">{statsCenso.total}</p>
                            </div>
                            {/* Niños */}
                            <div className="p-4 bg-amber-50 rounded-lg border border-amber-100">
                              <div className="flex items-center gap-1.5 mb-2">
                                <span className="text-sm">👶</span>
                                <p className="text-xs text-amber-700 font-semibold">Censo Niños</p>
                              </div>
                              <p className="text-3xl font-bold text-amber-800">{statsCensoNinos.total}</p>
                              <div className="mt-2 space-y-1.5">
                                <div className="flex justify-between items-center">
                                  <span className="text-[10px] text-amber-600">Baby (0-2)</span>
                                  <span className="text-sm font-bold text-pink-700">{statsCensoNinos.baby}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                  <span className="text-[10px] text-amber-600">Kids (3-5)</span>
                                  <span className="text-sm font-bold text-blue-700">{statsCensoNinos.kids}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                  <span className="text-[10px] text-amber-600">Explores (6-8)</span>
                                  <span className="text-sm font-bold text-green-700">{statsCensoNinos.explores}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                  <span className="text-[10px] text-amber-600">Champions (9-11)</span>
                                  <span className="text-sm font-bold text-purple-700">{statsCensoNinos.champions}</span>
                                </div>
                              </div>
                            </div>
                            {/* Nuevos creyentes */}
                            <div className="p-4 bg-violet-50 rounded-lg border border-violet-100">
                              <div className="flex items-center gap-1.5 mb-2">
                                <span className="text-sm">👩</span>
                                <p className="text-xs text-violet-700 font-semibold">Nuevos creyentes</p>
                              </div>
                              <p className="text-3xl font-bold text-violet-800">{statsCensoMdg.total}</p>
                            </div>
                            {/* Jóvenes */}
                            <div className="p-4 bg-pink-50 rounded-lg border border-pink-100">
                              <div className="flex items-center gap-1.5 mb-2">
                                <span className="text-sm">🧑‍🤝‍🧑</span>
                                <p className="text-xs text-pink-700 font-semibold">Censo Jóvenes</p>
                              </div>
                              <p className="text-3xl font-bold text-pink-800">{statsCensoJovenes.total}</p>
                            </div>
                          </div>
                          {/* Total consolidado */}
                          <div className="mt-3 p-3 bg-gray-50 rounded-lg border border-gray-200 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <img src="/logo.png" alt="IRDD" className="w-5 h-5 object-contain" />
                              <span className="text-sm font-semibold text-gray-700">Total Censados IRDD</span>
                            </div>
                            <div className="text-right">
                              <span className="text-2xl font-bold text-gray-900">{statsCenso.total + statsCensoMdg.total + statsCensoNinos.total + statsCensoJovenes.total}</span>
                            </div>
                          </div>
                        </div>

                        {/* DISCIPULADO */}
                        <div>
                          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2"><GraduationCap className="w-4 h-4 text-sky-600" /> Discipulado (Ciclos Activos)</h3>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            {(Object.keys(CICLO_CONFIG) as CicloTipo[]).map(tipo => (
                              <div key={tipo} className="p-3 bg-sky-50 rounded-lg border border-sky-100">
                                <p className="text-xs font-semibold text-sky-700 mb-2">{CICLO_CONFIG[tipo].label}</p>
                                {statsDiscipulado[tipo].inscritos > 0 ? (
                                  <div className="grid grid-cols-2 gap-2">
                                    <div className="text-center">
                                      <p className="text-lg font-bold text-sky-800">{statsDiscipulado[tipo].inscritos}</p>
                                      <p className="text-[9px] text-sky-600">Inscritos</p>
                                    </div>
                                    <div className="text-center">
                                      <p className="text-lg font-bold text-green-700">{statsDiscipulado[tipo].aprobados}</p>
                                      <p className="text-[9px] text-green-600">Aprobados</p>
                                    </div>
                                    <div className="text-center">
                                      <p className="text-lg font-bold text-gray-700">{statsDiscipulado[tipo].enCurso}</p>
                                      <p className="text-[9px] text-gray-500">En curso</p>
                                    </div>
                                    <div className="text-center">
                                      <p className="text-lg font-bold text-red-700">{statsDiscipulado[tipo].reprobados}</p>
                                      <p className="text-[9px] text-red-600">Reprobados</p>
                                    </div>
                                  </div>
                                ) : (
                                  <p className="text-xs text-gray-400 text-center py-2">Sin ciclo activo</p>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* BAUTIZOS, MATRIMONIOS, PRESENTACIÓN */}
                        <div>
                          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2"><BookOpen className="w-4 h-4 text-teal-600" /> Registros Pastorales (Censos + Libro)</h3>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div className="p-3 bg-teal-50 rounded-lg border border-teal-100 cursor-pointer hover:shadow-md transition-shadow" onClick={() => router.push("/dashboard/bautizo")}>
                              <p className="text-xs font-semibold text-teal-700 mb-2 flex items-center gap-1"><Heart className="w-3 h-3" /> Bautizos</p>
                              <div className="space-y-1">
                                <div className="flex justify-between"><span className="text-[10px] text-gray-600">En censos (P+MDG)</span><span className="text-sm font-bold text-teal-800">{statsBautizos.censoBautizados}</span></div>
                                <div className="flex justify-between"><span className="text-[10px] text-gray-600">Manual</span><span className="text-sm font-bold text-teal-700">{statsBautizos.total}</span></div>
                                {statsBautizos.esteMes > 0 && <Badge className="bg-teal-100 text-teal-800 text-[10px]">+{statsBautizos.esteMes} este mes</Badge>}
                              </div>
                            </div>
                            <div className="p-3 bg-rose-50 rounded-lg border border-rose-100 cursor-pointer hover:shadow-md transition-shadow" onClick={() => router.push("/dashboard/matrimonio")}>
                              <p className="text-xs font-semibold text-rose-700 mb-2 flex items-center gap-1"><Heart className="w-3 h-3" /> Matrimonios</p>
                              <div className="space-y-1">
                                <div className="flex justify-between"><span className="text-[10px] text-gray-600">En censos (P+MDG)</span><span className="text-sm font-bold text-rose-800">{statsMatrimonios.censoMatrimonios}</span></div>
                                <div className="flex justify-between"><span className="text-[10px] text-gray-600">Manual</span><span className="text-sm font-bold text-rose-700">{statsMatrimonios.total}</span></div>
                                {statsMatrimonios.esteMes > 0 && <Badge className="bg-rose-100 text-rose-800 text-[10px]">+{statsMatrimonios.esteMes} este mes</Badge>}
                              </div>
                            </div>
                            <div className="p-3 bg-pink-50 rounded-lg border border-pink-100 cursor-pointer hover:shadow-md transition-shadow" onClick={() => router.push("/dashboard/presentacion-ninos")}>
                              <p className="text-xs font-semibold text-pink-700 mb-2 flex items-center gap-1"><UserCheck className="w-3 h-3" /> Presentación de Niños</p>
                              <div className="space-y-1">
                                <div className="flex justify-between"><span className="text-[10px] text-gray-600">Total registrados</span><span className="text-sm font-bold text-pink-800">{statsPresentaciones.total}</span></div>
                                {statsPresentaciones.esteMes > 0 && <Badge className="bg-pink-100 text-pink-800 text-[10px]">+{statsPresentaciones.esteMes} este mes</Badge>}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* ATRASADOS */}
                        <div>
                          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-amber-600" /> Atrasados (este mes)</h3>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <div className="text-center p-3 bg-amber-50 rounded-lg border border-amber-100">
                              <p className="text-[10px] text-amber-600 font-medium">Total</p>
                              <p className="text-2xl font-bold text-amber-800">{statsAtrasados.total}</p>
                            </div>
                            <div className="text-center p-3 bg-red-50 rounded-lg border border-red-100">
                              <p className="text-[10px] text-red-600 font-medium">Sin Gestionar</p>
                              <p className="text-2xl font-bold text-red-800">{statsAtrasados.sinGestionar}</p>
                            </div>
                            <div className="text-center p-3 bg-green-50 rounded-lg border border-green-100">
                              <p className="text-[10px] text-green-600 font-medium">Gestionados</p>
                              <p className="text-2xl font-bold text-green-800">{statsAtrasados.total - statsAtrasados.sinGestionar}</p>
                            </div>
                            <div className="text-center p-3 bg-gray-50 rounded-lg border border-gray-200">
                              <p className="text-[10px] text-gray-600 font-medium">% Gestión</p>
                              <p className="text-2xl font-bold text-gray-800">{statsAtrasados.total > 0 ? Math.round(((statsAtrasados.total - statsAtrasados.sinGestionar) / statsAtrasados.total) * 100) : 0}%</p>
                            </div>
                          </div>
                        </div>
                      </>
                    )}
                  </CardContent>
                )}
              </Card>

              {/* PROYECTO MARIO */}
              <Card className="overflow-hidden border-orange-200">
                <button className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors" onClick={() => setOpenProyectoMario(!openProyectoMario)}>
                  <div className="flex items-center gap-3">
                    {openProyectoMario ? <ChevronDown className="w-4 h-4 text-gray-500" /> : <ChevronRight className="w-4 h-4 text-gray-500" />}
                    <Palette className="w-5 h-5 text-orange-600" />
                    <span className="font-semibold text-gray-900">Proyecto Mario (Detalle)</span>
                    <Badge className="bg-orange-100 text-orange-800 text-xs">{Object.values(statsProyectoMario).reduce((s, v) => s + v.inscritos, 0)} inscritos</Badge>
                  </div>
                </button>
                {openProyectoMario && (
                  <CardContent className="pt-0 pb-6 border-t">
                    {loadingStats ? (
                      <div className="flex justify-center py-8"><div className="w-8 h-8 border-4 border-orange-600 border-t-transparent rounded-full animate-spin"></div></div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-3">
                        {(Object.keys(PROYECTO_MARIO_CICLO_CONFIG) as ProyectoMarioCicloTipo[]).map(tipo => {
                          const stats = statsProyectoMario[tipo]
                          const config = PROYECTO_MARIO_CICLO_CONFIG[tipo]
                          return (
                            <div key={tipo} className="p-3 bg-orange-50 rounded-lg border border-orange-100">
                              <p className="text-xs font-semibold text-orange-700 mb-2">{config.label}</p>
                              {stats.inscritos > 0 ? (
                                <div className="space-y-2">
                                  <div className="flex justify-between items-center">
                                    <span className="text-[10px] text-gray-600">Inscritos</span>
                                    <span className="text-sm font-bold text-orange-800">{stats.inscritos}</span>
                                  </div>
                                  <div className="flex justify-between items-center">
                                    <span className="text-[10px] text-gray-600">Última clase</span>
                                    <span className="text-sm font-medium text-gray-700">#{stats.ultimaClase} de {config.totalClases}</span>
                                  </div>
                                  {stats.ultimaClase > 0 && (
                                    <>
                                      <div className="flex justify-between items-center">
                                        <span className="text-[10px] text-green-600">Asistieron</span>
                                        <Badge className="bg-green-100 text-green-800 text-xs">{stats.asistieron}</Badge>
                                      </div>
                                      <div className="flex justify-between items-center">
                                        <span className="text-[10px] text-red-600">Faltaron</span>
                                        <Badge className="bg-red-100 text-red-800 text-xs">{stats.faltaron}</Badge>
                                      </div>
                                      <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
                                        <div className="bg-orange-500 h-1.5 rounded-full" style={{ width: `${(stats.ultimaClase / config.totalClases) * 100}%` }}></div>
                                      </div>
                                      <p className="text-[9px] text-gray-400 text-right">{Math.round((stats.ultimaClase / config.totalClases) * 100)}% completado</p>
                                    </>
                                  )}
                                </div>
                              ) : (
                                <p className="text-xs text-gray-400 text-center py-3">Sin ciclo activo</p>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </CardContent>
                )}
              </Card>

              {/* ASISTENCIA SERVIDORES */}
              <Card className="overflow-hidden border-cyan-200">
                <button className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors" onClick={() => setOpenServidores(!openServidores)}>
                  <div className="flex items-center gap-3">
                    {openServidores ? <ChevronDown className="w-4 h-4 text-gray-500" /> : <ChevronRight className="w-4 h-4 text-gray-500" />}
                    <ClipboardCheck className="w-5 h-5 text-cyan-600" />
                    <span className="font-semibold text-gray-900">Asistencia Servidores por Ministerio</span>
                    <Badge className="bg-cyan-100 text-cyan-800 text-xs">
                      {Object.values(statsServidores).reduce((s, v) => s + v.total, 0)} registros
                    </Badge>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-green-700">{Object.values(statsServidores).reduce((s, v) => s + v.asistieron, 0)} A</span>
                    <span className="mx-1 text-gray-400">·</span>
                    <span className="font-bold text-red-700">{Object.values(statsServidores).reduce((s, v) => s + v.faltaron, 0)} F</span>
                  </div>
                </button>
                {openServidores && (
                  <CardContent className="pt-0 pb-6 border-t">
                    {loadingStats ? (
                      <div className="flex justify-center py-8"><div className="w-8 h-8 border-4 border-cyan-600 border-t-transparent rounded-full animate-spin"></div></div>
                    ) : (
                      <div className="mt-3 space-y-1">
                        {/* Tabla resumen */}
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="border-b border-gray-200">
                                <th className="text-left py-2 px-2 text-gray-600 font-medium">Ministerio</th>
                                <th className="text-center py-2 px-1 text-green-700 font-medium">Asistieron</th>
                                <th className="text-center py-2 px-1 text-red-700 font-medium">Faltaron</th>
                                <th className="text-center py-2 px-1 text-blue-700 font-medium">Justificaron</th>
                                <th className="text-center py-2 px-1 text-amber-700 font-medium">Atrasados</th>
                                <th className="text-center py-2 px-1 text-gray-700 font-medium">Total</th>
                              </tr>
                            </thead>
                            <tbody>
                              {MINISTERIOS_SERVIDORES.map(min => {
                                const s = statsServidores[min.key] || { total: 0, asistieron: 0, faltaron: 0, justificaron: 0, atrasados: 0 }
                                return (
                                  <tr key={min.key} className="border-b border-gray-100 hover:bg-gray-50">
                                    <td className="py-1.5 px-2 text-gray-800 font-medium">{min.label}</td>
                                    <td className="text-center py-1.5 px-1">
                                      <Badge className="bg-green-100 text-green-800 text-[10px]">{s.asistieron}</Badge>
                                    </td>
                                    <td className="text-center py-1.5 px-1">
                                      <Badge className="bg-red-100 text-red-800 text-[10px]">{s.faltaron}</Badge>
                                    </td>
                                    <td className="text-center py-1.5 px-1">
                                      <Badge className="bg-blue-100 text-blue-800 text-[10px]">{s.justificaron}</Badge>
                                    </td>
                                    <td className="text-center py-1.5 px-1">
                                      <Badge className="bg-amber-100 text-amber-800 text-[10px]">{s.atrasados}</Badge>
                                    </td>
                                    <td className="text-center py-1.5 px-1 font-semibold text-gray-700">{s.total}</td>
                                  </tr>
                                )
                              })}
                              {/* Fila totales */}
                              <tr className="border-t-2 border-gray-300 bg-gray-50 font-bold">
                                <td className="py-2 px-2 text-gray-900">TOTAL</td>
                                <td className="text-center py-2 px-1 text-green-800">{Object.values(statsServidores).reduce((s, v) => s + v.asistieron, 0)}</td>
                                <td className="text-center py-2 px-1 text-red-800">{Object.values(statsServidores).reduce((s, v) => s + v.faltaron, 0)}</td>
                                <td className="text-center py-2 px-1 text-blue-800">{Object.values(statsServidores).reduce((s, v) => s + v.justificaron, 0)}</td>
                                <td className="text-center py-2 px-1 text-amber-800">{Object.values(statsServidores).reduce((s, v) => s + v.atrasados, 0)}</td>
                                <td className="text-center py-2 px-1 text-gray-900">{Object.values(statsServidores).reduce((s, v) => s + v.total, 0)}</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </CardContent>
                )}
              </Card>

              {/* REDIL - AYUDA SOCIAL */}
              <Card className="overflow-hidden border-lime-200">
                <button className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors" onClick={() => setOpenRedil(!openRedil)}>
                  <div className="flex items-center gap-3">
                    {openRedil ? <ChevronDown className="w-4 h-4 text-gray-500" /> : <ChevronRight className="w-4 h-4 text-gray-500" />}
                    <Heart className="w-5 h-5 text-lime-600" />
                    <span className="font-semibold text-gray-900">Redil — Ayuda Social</span>
                    <Badge className="bg-lime-100 text-lime-800 text-xs">{statsRedil.totalCasos} casos</Badge>
                  </div>
                </button>
                {openRedil && (
                  <CardContent className="pt-0 pb-6 border-t">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
                      <div className="text-center p-3 bg-lime-50 rounded-lg border border-lime-100">
                        <p className="text-[10px] text-lime-600 font-medium">Entregados (semana)</p>
                        <p className="text-2xl font-bold text-lime-800">{statsRedil.entregadosSemana}</p>
                      </div>
                      <div className="text-center p-3 bg-green-50 rounded-lg border border-green-100">
                        <p className="text-[10px] text-green-600 font-medium">Entregados (mes)</p>
                        <p className="text-2xl font-bold text-green-800">{statsRedil.entregadosMes}</p>
                      </div>
                      <div className="text-center p-3 bg-yellow-50 rounded-lg border border-yellow-100">
                        <p className="text-[10px] text-yellow-600 font-medium">Solicitudes Pendientes</p>
                        <p className="text-2xl font-bold text-yellow-800">{statsRedil.pendientes}</p>
                      </div>
                      <div className="text-center p-3 bg-gray-50 rounded-lg border border-gray-200">
                        <p className="text-[10px] text-gray-600 font-medium">Total Histórico</p>
                        <p className="text-2xl font-bold text-gray-800">{statsRedil.totalCasos}</p>
                      </div>
                    </div>
                    {/* Desglose por tipo de ayuda */}
                    {Object.keys(statsRedil.porTipo).length > 0 && (
                      <div className="mt-4">
                        <p className="text-xs font-semibold text-gray-700 mb-2">Ayudas entregadas por tipo (histórico cerrados):</p>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          {Object.entries(statsRedil.porTipo).sort(([, a], [, b]) => b - a).map(([tipo, cantidad]) => {
                            const tipoInfo = [
                              { value: "canasta", label: "Canasta/Víveres", icon: "🧺" },
                              { value: "medicinas", label: "Medicinas", icon: "💊" },
                              { value: "ropa", label: "Ropa", icon: "🧥" },
                              { value: "panales", label: "Pañales", icon: "👶" },
                              { value: "utiles_escolares", label: "Útiles", icon: "📚" },
                              { value: "ayuda_economica", label: "Económica", icon: "💰" },
                              { value: "otro", label: "Otro", icon: "📦" },
                            ].find(t => t.value === tipo)
                            return (
                              <div key={tipo} className="flex items-center gap-2 p-2 bg-white rounded border border-gray-100">
                                <span className="text-sm">{tipoInfo?.icon || "📦"}</span>
                                <div>
                                  <p className="text-[10px] text-gray-600">{tipoInfo?.label || tipo}</p>
                                  <p className="text-sm font-bold text-gray-800">{cantidad}</p>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}
                    <Button variant="ghost" size="sm" className="mt-3 text-lime-700" onClick={() => router.push("/dashboard/redil-ayuda-social")}>
                      <ExternalLink className="w-3 h-3 mr-1" /> Ir a Redil
                    </Button>
                  </CardContent>
                )}
              </Card>

              {/* CUMPLEAÑOS DEL MES */}
              <Card className="overflow-hidden border-fuchsia-200">
                <button className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors" onClick={() => setOpenCumpleanos(!openCumpleanos)}>
                  <div className="flex items-center gap-3">
                    {openCumpleanos ? <ChevronDown className="w-4 h-4 text-gray-500" /> : <ChevronRight className="w-4 h-4 text-gray-500" />}
                    <Cake className="w-5 h-5 text-fuchsia-600" />
                    <span className="font-semibold text-gray-900">Cumpleaños del Mes</span>
                    <Badge className="bg-fuchsia-100 text-fuchsia-800 text-xs">{statsCumpleanos.totalMes} personas</Badge>
                  </div>
                </button>
                {openCumpleanos && (
                  <CardContent className="pt-0 pb-6 border-t">
                    <div className="grid grid-cols-3 gap-3 mt-3">
                      <div className="text-center p-3 bg-fuchsia-50 rounded-lg border border-fuchsia-100">
                        <p className="text-[10px] text-fuchsia-600 font-medium">Total Cumpleañeros</p>
                        <p className="text-2xl font-bold text-fuchsia-800">{statsCumpleanos.totalMes}</p>
                        <p className="text-[9px] text-fuchsia-500">este mes</p>
                      </div>
                      <div className="text-center p-3 bg-green-50 rounded-lg border border-green-100">
                        <p className="text-[10px] text-green-600 font-medium">Felicitados</p>
                        <p className="text-2xl font-bold text-green-800">{statsCumpleanos.enviados}</p>
                        <p className="text-[9px] text-green-500">ya enviados</p>
                      </div>
                      <div className="text-center p-3 bg-orange-50 rounded-lg border border-orange-100">
                        <p className="text-[10px] text-orange-600 font-medium">Pendientes</p>
                        <p className="text-2xl font-bold text-orange-800">{statsCumpleanos.pendientesEnvio}</p>
                        <p className="text-[9px] text-orange-500">sin felicitar</p>
                      </div>
                    </div>
                    {/* Barra de progreso */}
                    {statsCumpleanos.totalMes > 0 && (
                      <div className="mt-4">
                        <div className="flex justify-between text-[10px] text-gray-600 mb-1">
                          <span>Progreso de felicitaciones</span>
                          <span>{Math.round((statsCumpleanos.enviados / statsCumpleanos.totalMes) * 100)}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-fuchsia-500 h-2 rounded-full transition-all"
                            style={{ width: `${(statsCumpleanos.enviados / statsCumpleanos.totalMes) * 100}%` }}
                          ></div>
                        </div>
                      </div>
                    )}
                    <Button variant="ghost" size="sm" className="mt-3 text-fuchsia-700" onClick={() => router.push("/dashboard/cumpleanos")}>
                      <ExternalLink className="w-3 h-3 mr-1" /> Ir a Cumpleaños
                    </Button>
                  </CardContent>
                )}
              </Card>

              {/* EVENTOS / ENCUENTRO */}
              <Card className="overflow-hidden border-violet-200">
                <button className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors" onClick={() => setOpenEventos(!openEventos)}>
                  <div className="flex items-center gap-3">
                    {openEventos ? <ChevronDown className="w-4 h-4 text-gray-500" /> : <ChevronRight className="w-4 h-4 text-gray-500" />}
                    <CalendarDays className="w-5 h-5 text-violet-600" />
                    <span className="font-semibold text-gray-900">Eventos / Encuentro</span>
                    <Badge className="bg-violet-100 text-violet-800 text-xs">
                      {statsEventos.reduce((s, e) => s + e.inscritos, 0)} inscritos
                    </Badge>
                  </div>
                </button>
                {openEventos && (
                  <CardContent className="pt-0 pb-6 border-t">
                    {loadingStats ? (
                      <div className="flex justify-center py-8"><div className="w-8 h-8 border-4 border-violet-600 border-t-transparent rounded-full animate-spin"></div></div>
                    ) : statsEventos.length === 0 ? (
                      <p className="text-sm text-gray-400 text-center py-4 mt-3">No hay eventos activos</p>
                    ) : (
                      <div className="space-y-3 mt-3">
                        {statsEventos.map(evento => (
                          <div key={evento.id} className="p-3 bg-violet-50 rounded-lg border border-violet-100">
                            <div className="flex items-center justify-between mb-2">
                              <p className="text-xs font-semibold text-violet-700">{evento.nombre}</p>
                              <Badge className="bg-violet-200 text-violet-900 text-[10px]">{evento.inscritos} inscritos</Badge>
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                              <div className="text-center">
                                <p className="text-lg font-bold text-violet-800">{evento.inscritos}</p>
                                <p className="text-[9px] text-violet-600">Inscritos</p>
                              </div>
                              <div className="text-center">
                                <p className="text-lg font-bold text-green-700">{evento.pagadosCompleto}</p>
                                <p className="text-[9px] text-green-600">Pagado completo</p>
                              </div>
                              <div className="text-center">
                                <p className="text-lg font-bold text-orange-700">{evento.pendientesPago}</p>
                                <p className="text-[9px] text-orange-600">Pendiente pago</p>
                              </div>
                              <div className="text-center">
                                <p className="text-lg font-bold text-emerald-700">${evento.totalRecaudado.toLocaleString("es-CO", { minimumFractionDigits: 2 })}</p>
                                <p className="text-[9px] text-emerald-600">Recaudado / ${evento.totalValor.toLocaleString("es-CO", { minimumFractionDigits: 2 })}</p>
                              </div>
                            </div>
                            {/* Barra progreso recaudación */}
                            {evento.totalValor > 0 && (
                              <div className="mt-2">
                                <div className="w-full bg-gray-200 rounded-full h-1.5">
                                  <div
                                    className="bg-violet-500 h-1.5 rounded-full transition-all"
                                    style={{ width: `${Math.min((evento.totalRecaudado / evento.totalValor) * 100, 100)}%` }}
                                  ></div>
                                </div>
                                <p className="text-[9px] text-gray-400 text-right mt-0.5">
                                  {Math.round((evento.totalRecaudado / evento.totalValor) * 100)}% recaudado
                                </p>
                              </div>
                            )}
                          </div>
                        ))}
                        <Button variant="ghost" size="sm" className="text-violet-700" onClick={() => router.push("/dashboard/eventos")}>
                          <ExternalLink className="w-3 h-3 mr-1" /> Ir a Eventos
                        </Button>
                      </div>
                    )}
                  </CardContent>
                )}
              </Card>

              {/* INGRESOS */}
              <Card className="overflow-hidden">
                <button className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors" onClick={() => setOpenIngresos(!openIngresos)}>
                  <div className="flex items-center gap-3">
                    {openIngresos ? <ChevronDown className="w-4 h-4 text-gray-500" /> : <ChevronRight className="w-4 h-4 text-gray-500" />}
                    <TrendingUp className="w-5 h-5 text-green-600" />
                    <span className="font-semibold text-gray-900">Ingresos por Categoría</span>
                    <Badge className="bg-green-100 text-green-800 text-xs">{ingresos.length} registros</Badge>
                  </div>
                  <span className="font-bold text-green-700">${totalIngresos.toLocaleString("es-CO", { minimumFractionDigits: 2 })}</span>
                </button>
                {openIngresos && (
                  <CardContent className="pt-0 pb-4 border-t">
                    <div className="space-y-2 mt-3">
                      {(Object.entries(ingresosPorCategoria) as [string, number][]).sort(([, a], [, b]) => b - a).map(([cat, monto]) => (
                        <div key={cat} className="flex items-center justify-between py-1.5 border-b border-gray-100 last:border-0">
                          <span className="text-sm text-gray-700">{cat}</span>
                          <span className="text-sm font-semibold text-green-700">${monto.toLocaleString("es-CO", { minimumFractionDigits: 2 })}</span>
                        </div>
                      ))}
                    </div>
                    <Button variant="ghost" size="sm" className="mt-3 text-green-700" onClick={() => router.push("/dashboard/ingresos-egresos")}>
                      <ExternalLink className="w-3 h-3 mr-1" /> Ir a Ingresos y Egresos
                    </Button>
                  </CardContent>
                )}
              </Card>

              {/* EGRESOS */}
              <Card className="overflow-hidden">
                <button className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors" onClick={() => setOpenEgresos(!openEgresos)}>
                  <div className="flex items-center gap-3">
                    {openEgresos ? <ChevronDown className="w-4 h-4 text-gray-500" /> : <ChevronRight className="w-4 h-4 text-gray-500" />}
                    <TrendingDown className="w-5 h-5 text-red-600" />
                    <span className="font-semibold text-gray-900">Egresos por Categoría</span>
                    <Badge className="bg-red-100 text-red-800 text-xs">{egresos.length} registros</Badge>
                  </div>
                  <span className="font-bold text-red-700">${totalEgresos.toLocaleString("es-CO", { minimumFractionDigits: 2 })}</span>
                </button>
                {openEgresos && (
                  <CardContent className="pt-0 pb-4 border-t">
                    <div className="space-y-2 mt-3">
                      {(Object.entries(egresosPorCategoria) as [string, number][]).sort(([, a], [, b]) => b - a).map(([cat, monto]) => (
                        <div key={cat} className="flex items-center justify-between py-1.5 border-b border-gray-100 last:border-0">
                          <span className="text-sm text-gray-700">{cat}</span>
                          <span className="text-sm font-semibold text-red-700">${monto.toLocaleString("es-CO", { minimumFractionDigits: 2 })}</span>
                        </div>
                      ))}
                    </div>
                    <Button variant="ghost" size="sm" className="mt-3 text-red-700" onClick={() => router.push("/dashboard/ingresos-egresos")}>
                      <ExternalLink className="w-3 h-3 mr-1" /> Ir a Ingresos y Egresos
                    </Button>
                  </CardContent>
                )}
              </Card>

              {/* ASISTENCIA */}
              <Card className="overflow-hidden">
                <button className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors" onClick={() => setOpenAsistencia(!openAsistencia)}>
                  <div className="flex items-center gap-3">
                    {openAsistencia ? <ChevronDown className="w-4 h-4 text-gray-500" /> : <ChevronRight className="w-4 h-4 text-gray-500" />}
                    <Users className="w-5 h-5 text-purple-600" />
                    <span className="font-semibold text-gray-900">Asistencia</span>
                    <Badge className="bg-purple-100 text-purple-800 text-xs">{asistenciaColumns.length} días</Badge>
                  </div>
                  <span className="font-bold text-purple-700">{totalAsistencia} personas</span>
                </button>
                {openAsistencia && (
                  <CardContent className="pt-0 pb-4 border-t">
                    {asistenciaColumns.length > 0 ? (
                      <>
                        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2 mt-3">
                          {asistenciaColumns.map((col: any) => (
                            <div key={col.id} className="text-center p-2 bg-purple-50 rounded-lg border border-purple-100">
                              <p className="text-[10px] text-purple-600 font-medium">{col.nombre}</p>
                              <p className="text-lg font-bold text-purple-800">{getColumnTotal(col.id)}</p>
                            </div>
                          ))}
                        </div>
                        <Button variant="ghost" size="sm" className="mt-3 text-purple-700" onClick={() => router.push("/dashboard/asistencia")}>
                          <ExternalLink className="w-3 h-3 mr-1" /> Ir a Asistencia
                        </Button>
                      </>
                    ) : (
                      <p className="text-sm text-gray-400 text-center py-4 mt-3">Sin datos de asistencia</p>
                    )}
                  </CardContent>
                )}
              </Card>

              {/* NÓMINA */}
              {hasNominaAccess && (
                <Card className="overflow-hidden">
                  <button className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors" onClick={() => setOpenNomina(!openNomina)}>
                    <div className="flex items-center gap-3">
                      {openNomina ? <ChevronDown className="w-4 h-4 text-gray-500" /> : <ChevronRight className="w-4 h-4 text-gray-500" />}
                      <span className="text-xl">💰</span>
                      <span className="font-semibold text-gray-900">Nómina</span>
                      <Badge className="bg-amber-100 text-amber-800 text-xs">{nominaRecords.length} personas</Badge>
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-amber-700">${totalNominaAPagar.toLocaleString("es-CO", { minimumFractionDigits: 2 })}</span>
                      <p className="text-[10px] text-green-600">Pagado: ${totalNominaPagado.toLocaleString("es-CO", { minimumFractionDigits: 2 })}</p>
                    </div>
                  </button>
                  {openNomina && (
                    <CardContent className="pt-0 pb-4 border-t">
                      {(() => {
                        const pendientes1ra = nominaRecords.filter((r: any) => !r.primera_quincena_pagada && !(Number(r.movilizacion_valor || 0) > 0 && !r.movilizacion_con_quincenas))
                        const pendientes2da = nominaRecords.filter((r: any) => !r.segunda_quincena_pagada && !(Number(r.movilizacion_valor || 0) > 0 && !r.movilizacion_con_quincenas))
                        const pendientesTransporte = nominaRecords.filter((r: any) => (Number(r.movilizacion_valor || 0) > 0 || r.movilizacion_pagada) && !r.movilizacion_pagada)
                        const totalTransportePagado = nominaRecords.reduce((s: number, r: any) => s + (r.movilizacion_pagada ? Number(r.movilizacion_valor || 0) : 0) + (r.movilizacion_segunda_pagada ? Number(r.movilizacion_segunda_valor || 0) : 0), 0)
                        return (
                          <>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
                              <div className="text-center p-3 bg-amber-50 rounded-lg border border-amber-100">
                                <p className="text-xs text-amber-600">Total a Pagar</p>
                                <p className="text-lg font-bold text-amber-800">${totalNominaAPagar.toLocaleString("es-CO", { minimumFractionDigits: 2 })}</p>
                              </div>
                              <div className="text-center p-3 bg-green-50 rounded-lg border border-green-100">
                                <p className="text-xs text-green-600">Pagado Quincenas</p>
                                <p className="text-lg font-bold text-green-800">${totalNominaPagado.toLocaleString("es-CO", { minimumFractionDigits: 2 })}</p>
                              </div>
                              <div className="text-center p-3 bg-purple-50 rounded-lg border border-purple-100">
                                <p className="text-xs text-purple-600">Transporte Pagado</p>
                                <p className="text-lg font-bold text-purple-800">${totalTransportePagado.toLocaleString("es-CO", { minimumFractionDigits: 2 })}</p>
                              </div>
                              <div className="text-center p-3 bg-red-50 rounded-lg border border-red-100">
                                <p className="text-xs text-red-600">Pendiente Total</p>
                                <p className="text-lg font-bold text-red-800">${(totalNominaAPagar - totalNominaPagado).toLocaleString("es-CO", { minimumFractionDigits: 2 })}</p>
                              </div>
                            </div>

                            {/* Pendientes por categoría */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
                              {pendientes1ra.length > 0 && (
                                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                                  <p className="text-xs font-semibold text-blue-700 mb-2">Falta 1ra Quincena ({pendientes1ra.length})</p>
                                  <div className="space-y-1">
                                    {pendientes1ra.map((r: any) => (
                                      <div key={r.id} className="flex justify-between text-xs">
                                        <span className="text-gray-700 truncate">{r.nombre}</span>
                                        <span className="text-blue-700 font-medium">${(Number(r.valor_a_pagar || 0) / 2).toFixed(2)}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {pendientes2da.length > 0 && (
                                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                                  <p className="text-xs font-semibold text-green-700 mb-2">Falta 2da Quincena ({pendientes2da.length})</p>
                                  <div className="space-y-1">
                                    {pendientes2da.map((r: any) => (
                                      <div key={r.id} className="flex justify-between text-xs">
                                        <span className="text-gray-700 truncate">{r.nombre}</span>
                                        <span className="text-green-700 font-medium">${(Number(r.valor_a_pagar || 0) / 2).toFixed(2)}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {pendientesTransporte.length > 0 && (
                                <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                                  <p className="text-xs font-semibold text-purple-700 mb-2">Falta Transporte ({pendientesTransporte.length})</p>
                                  <div className="space-y-1">
                                    {pendientesTransporte.map((r: any) => (
                                      <div key={r.id} className="flex justify-between text-xs">
                                        <span className="text-gray-700 truncate">{r.nombre}</span>
                                        <span className="text-purple-700 font-medium">${Number(r.movilizacion_valor || 0).toFixed(2)}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>

                            {pendientes1ra.length === 0 && pendientes2da.length === 0 && pendientesTransporte.length === 0 && (
                              <p className="text-sm text-green-600 text-center mt-4 font-medium">Toda la nómina está al día</p>
                            )}

                            <Button variant="ghost" size="sm" className="mt-3 text-amber-700" onClick={() => router.push("/dashboard/flujo-pago")}>
                              <ExternalLink className="w-3 h-3 mr-1" /> Ir a Flujo de Pago
                            </Button>
                          </>
                        )
                      })()}
                    </CardContent>
                  )}
                </Card>
              )}
            </div>

            {/* Historial */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">📚 Historial de Meses</CardTitle>
              </CardHeader>
              <CardContent>
                {monthHistory.length > 0 ? (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {monthHistory.map((month) => (
                      <div key={month.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50">
                        <div>
                          <p className="font-medium text-sm">{month.name}</p>
                          <p className="text-xs text-gray-500">{formatDateForTable(month.start_date)} - {month.end_date ? formatDateForTable(month.end_date) : "Activo"}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-xs">{month.status === "closed" ? "Cerrado" : "Activo"}</Badge>
                          <Button size="sm" variant="outline" onClick={() => router.push(`/dashboard/mes/${month.id}`)}>Ver</Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400 text-center py-6">Sin historial</p>
                )}
              </CardContent>
            </Card>

      </main>
    </div>
  )
}

export default function ControlMensualPage() {
  return (
    <PermissionsGuard moduleName="control_mensual">
      {(canEdit) => <ControlMensualContent canEdit={canEdit} />}
    </PermissionsGuard>
  )
}
