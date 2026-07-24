"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { PermissionsGuard } from "@/lib/permissions-guard"
import { useAuth } from "@/contexts/auth-context"
import { supabase } from "@/lib/secure-db"
import { currentMonthNameEcuador, currentMonthEcuador, currentYearEcuador, todayEcuador } from "@/lib/timezone"

import { ArrowLeft, TrendingUp, TrendingDown, Users, DollarSign, ChevronDown, ChevronRight, Heart, UserCheck, GraduationCap, Palette, AlertTriangle, Home, Cake, ClipboardCheck, CalendarDays } from "lucide-react"
import { censoService } from "@/lib/mod/censo-service"
import { censoMdgService } from "@/lib/mod/censo-mdg-service"
import { censoJovenesService } from "@/lib/mod/censo-jovenes-service"
import { censoNinosService } from "@/lib/mod/censo-ninos-service"
import { getLunesSemanaActual } from "@/lib/mod/gestion-celulas-service"
import { discipuladoCiclosService, CICLO_CONFIG, type CicloTipo } from "@/lib/mod/discipulado-ciclos-service"
import { proyectoMarioCiclosService, PROYECTO_MARIO_CICLO_CONFIG, type ProyectoMarioCicloTipo } from "@/lib/mod/proyecto-mario-ciclos-service"
import { getCumpleanerosMes, getHistorialEnvios } from "@/lib/mod/cumpleanos-service"
import { useMonth } from "@/contexts/month-context"
import { getAlfoliMes } from "@/lib/mod/alfoli-service"


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

function PastoralContent({ canEdit }: { canEdit: boolean }) {
  const router = useRouter()
  const { currentMonth } = useMonth()
  const { user } = useAuth()

  const [loadingStats, setLoadingStats] = useState(true)
  const [loadingProgress, setLoadingProgress] = useState(0)

  // Financiero
  const [totalIngresos, setTotalIngresos] = useState(0)
  const [totalEgresos, setTotalEgresos] = useState(0)
  const [totalAsistencia, setTotalAsistencia] = useState(0)
  const [asistenciaDias, setAsistenciaDias] = useState(0)
  const [totalNomina, setTotalNomina] = useState(0)
  const [nominaPersonas, setNominaPersonas] = useState(0)
  const [nominaPagado, setNominaPagado] = useState(0)


  // Estadísticas generales
  const [statsCenso, setStatsCenso] = useState({ total: 0, miembros: 0, activos: 0 })
  const [statsCensoMdg, setStatsCensoMdg] = useState({ total: 0, miembros: 0, activos: 0, nuevosCreyentes: 0, nuevosMes: 0, nuevosHoy: 0 })
  const [statsCensoNinos, setStatsCensoNinos] = useState({ total: 0, baby: 0, kids: 0, explores: 0, champions: 0 })
  const [statsCensoJovenes, setStatsCensoJovenes] = useState({ total: 0, miembros: 0, activos: 0, nuevos: 0, primeraVez: 0, nuevosMes: 0, nuevosHoy: 0 })
  const [statsDiscipulado, setStatsDiscipulado] = useState<Record<CicloTipo, { inscritos: number; aprobados: number; reprobados: number; enCurso: number }>>({ primeros_pasos: { inscritos: 0, aprobados: 0, reprobados: 0, enCurso: 0 }, seguimos_avanzando: { inscritos: 0, aprobados: 0, reprobados: 0, enCurso: 0 }, siendo_iglesia: { inscritos: 0, aprobados: 0, reprobados: 0, enCurso: 0 } })
  const [statsBautizos, setStatsBautizos] = useState({ total: 0, esteMes: 0, censoBautizados: 0 })
  const [statsMatrimonios, setStatsMatrimonios] = useState({ total: 0, esteMes: 0, censoMatrimonios: 0 })
  const [statsPresentaciones, setStatsPresentaciones] = useState({ total: 0, esteMes: 0 })
  const [statsAtrasados, setStatsAtrasados] = useState({ total: 0, sinGestionar: 0 })
  const [statsCelulas, setStatsCelulas] = useState({ totalMiembros: 0, asistieronSemana: 0 })
  const [statsProyectoMario, setStatsProyectoMario] = useState<Record<ProyectoMarioCicloTipo, { inscritos: number; ultimaClase: number; asistieron: number; faltaron: number }>>({ belleza_integral_sabados: { inscritos: 0, ultimaClase: 0, asistieron: 0, faltaron: 0 }, belleza_integral_viernes: { inscritos: 0, ultimaClase: 0, asistieron: 0, faltaron: 0 }, manualidades: { inscritos: 0, ultimaClase: 0, asistieron: 0, faltaron: 0 }, belleza_cejas: { inscritos: 0, ultimaClase: 0, asistieron: 0, faltaron: 0 }, gastronomia: { inscritos: 0, ultimaClase: 0, asistieron: 0, faltaron: 0 } })
  const [statsServidores, setStatsServidores] = useState<Record<string, { total: number; asistieron: number; faltaron: number; justificaron: number; atrasados: number }>>({})
  const [statsRedil, setStatsRedil] = useState({ totalCasos: 0, pendientes: 0, entregadosSemana: 0, entregadosMes: 0, porTipo: {} as Record<string, number> })
  const [statsCumpleanos, setStatsCumpleanos] = useState({ totalMes: 0, enviados: 0, pendientesEnvio: 0 })
  const [statsEventos, setStatsEventos] = useState<Array<{ id: number; nombre: string; inscritos: number; pagadosCompleto: number; pendientesPago: number; totalRecaudado: number; totalValor: number }>>([])
  const [openEstadisticas, setOpenEstadisticas] = useState(true)

  useEffect(() => { loadEstadisticas() }, [])
  useEffect(() => { if (currentMonth?.id) loadFinanciero() }, [currentMonth])


  const loadFinanciero = async () => {
    if (!currentMonth?.id) return
    const [ingRes, egRes, colRes, datRes, nomRes] = await Promise.all([
      supabase.from("ingresos").select("monto").eq("mes_id", currentMonth.id),
      supabase.from("egresos").select("monto").eq("mes_id", currentMonth.id),
      supabase.from("asistencia_columnas").select("id").eq("mes_id", currentMonth.id),
      supabase.from("asistencia_datos").select("cantidad").eq("mes_id", currentMonth.id),
      supabase.from("nomina").select("valor_a_pagar, primera_quincena_pagada, primera_quincena_valor, segunda_quincena_pagada, segunda_quincena_valor").eq("mes_id", currentMonth.id),
    ])
    const monthNum = currentMonth.month; const yearNum = currentMonth.year
    const [alfoliRecords, celulasRes] = await Promise.all([
      getAlfoliMes(monthNum, yearNum),
      supabase.from("ofrendas_celulas").select("valor").eq("mes", monthNum).eq("anio", yearNum).eq("recibido", true),
    ])
    const totalAlf = alfoliRecords.reduce((s, r) => s + Number(r.valor), 0)
    const totalCel = (celulasRes.data || []).reduce((s: number, r: any) => s + Number(r.valor), 0)
    setTotalIngresos((ingRes.data || []).reduce((s: number, r: any) => s + Number(r.monto || 0), 0) + totalAlf + totalCel)
    setTotalEgresos((egRes.data || []).reduce((s: number, r: any) => s + Number(r.monto || 0), 0))
    setAsistenciaDias((colRes.data || []).length)
    setTotalAsistencia((datRes.data || []).reduce((s: number, r: any) => s + Number(r.cantidad || 0), 0))
    const nomData = nomRes.data || []
    setNominaPersonas(nomData.length)
    setTotalNomina(nomData.reduce((s: number, r: any) => s + Number(r.valor_a_pagar || 0), 0))
    setNominaPagado(nomData.reduce((s: number, r: any) => { let p = 0; if (r.primera_quincena_pagada) p += Number(r.primera_quincena_valor || 0); if (r.segunda_quincena_pagada) p += Number(r.segunda_quincena_valor || 0); return s + p }, 0))
  }


  const loadEstadisticas = async () => {
    setLoadingStats(true); setLoadingProgress(0)
    const mesActual = currentMonthEcuador(); const anioActual = currentYearEcuador()
    const primerDiaMes = `${anioActual}-${String(mesActual).padStart(2, "0")}-01`
    const ultimoDiaMes = `${anioActual}-${String(mesActual).padStart(2, "0")}-31`
    const lunesSemana = getLunesSemanaActual()
    let completed = 0; const totalTasks = 13
    const tick = () => { completed++; setLoadingProgress(Math.round((completed / totalTasks) * 100)) }

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
      const casos=cR.data||[];const ents=eR.data||[];const pend=casos.filter((c:any)=>!["cerrado","rechazado","entregado"].includes(c.estado)).length;const eMes=ents.filter((e:any)=>e.fecha_entrega>=primerDiaMes&&e.fecha_entrega<=ultimoDiaMes).length;const h7=new Date();h7.setDate(h7.getDate()-7);const eSem=ents.filter((e:any)=>e.fecha_entrega>=h7.toISOString().split("T")[0]).length
      setStatsRedil({totalCasos:casos.length,pendientes:pend,entregadosSemana:eSem,entregadosMes:eMes,porTipo:{}}); tick()
    })
    const p11 = Promise.all([getCumpleanerosMes(mesActual,anioActual).catch(()=>[] as any[]),getHistorialEnvios(anioActual,mesActual).catch(()=>[] as any[])]).then(([cum,env])=>{
      const pend=cum.length-env.length;setStatsCumpleanos({totalMes:cum.length,enviados:env.length,pendientesEnvio:pend>0?pend:0}); tick()
    })
    const p12 = supabase.from("eventos_tabs").select("id, nombre").eq("is_active", true).order("sort_order", { ascending: true }).then(async(res)=>{
      const evts=res.data||[];if(evts.length>0){const parts=await Promise.all(evts.map((ev:any)=>supabase.from("evento_participantes").select("id, valor, abono").eq("evento_id",ev.id).then(r=>({id:ev.id,nombre:ev.nombre,parts:r.data||[]}))));setStatsEventos(parts.map(({id,nombre,parts:pp})=>{const ins=pp.length;const pag=pp.filter((p:any)=>Number(p.valor)<=0||Number(p.abono)>=Number(p.valor)).length;return{id,nombre,inscritos:ins,pagadosCompleto:pag,pendientesPago:ins-pag,totalRecaudado:pp.reduce((s:number,p:any)=>s+Number(p.abono||0),0),totalValor:pp.reduce((s:number,p:any)=>s+Number(p.valor||0),0)}}))}else{setStatsEventos([])}
      tick()
    })
    await Promise.allSettled([p1,p2,p3,p4,p5,p6,p7,p8,p9,p10,p11,p12])
    setLoadingProgress(100); setLoadingStats(false)
  }


  if (!user) return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div></div>

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard")} className="flex items-center space-x-2"><ArrowLeft className="w-4 h-4" /><span>Volver</span></Button>
              <h1 className="text-xl font-semibold text-gray-900">Módulo Pastoral</h1>
            </div>
            <Badge variant="outline" className="text-blue-600 border-blue-200">{currentMonthNameEcuador()}</Badge>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Indicador de carga */}
        {loadingStats && (
          <Card className="border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 animate-pulse">
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-5 h-5 border-3 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-sm font-medium text-blue-800">Cargando datos...</p>
                    <span className="text-xs font-bold text-blue-700">{loadingProgress}%</span>
                  </div>
                  <div className="w-full bg-blue-200/50 rounded-full h-2">
                    <div className="bg-blue-600 h-2 rounded-full transition-all duration-500 ease-out" style={{ width: `${loadingProgress}%` }}></div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Fila 1: Financiero */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="border-green-200 bg-green-50/50">
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center justify-between"><div><p className="text-xs text-green-700">Ingresos</p><p className="text-xl font-bold text-green-700">${totalIngresos.toLocaleString("es-CO", { minimumFractionDigits: 2 })}</p></div><TrendingUp className="w-6 h-6 text-green-400" /></div>
            </CardContent>
          </Card>
          <Card className="border-red-200 bg-red-50/50">
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center justify-between"><div><p className="text-xs text-red-700">Egresos</p><p className="text-xl font-bold text-red-700">${totalEgresos.toLocaleString("es-CO", { minimumFractionDigits: 2 })}</p></div><TrendingDown className="w-6 h-6 text-red-400" /></div>
            </CardContent>
          </Card>
          <Card className="border-amber-200 bg-amber-50/50">
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center justify-between"><div><p className="text-xs text-amber-700">Nómina</p><p className="text-xl font-bold text-amber-700">${totalNomina.toLocaleString("es-CO", { minimumFractionDigits: 2 })}</p><p className="text-[9px] text-amber-600">{nominaPersonas} personas · Pagado: ${nominaPagado.toLocaleString("es-CO", { minimumFractionDigits: 2 })}</p></div><DollarSign className="w-6 h-6 text-amber-400" /></div>
            </CardContent>
          </Card>
          <Card className="border-purple-200 bg-purple-50/50">
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center justify-between"><div><p className="text-xs text-purple-700">Asistencia Total</p><p className="text-xl font-bold text-purple-700">{totalAsistencia}</p><p className="text-[10px] text-purple-600">{asistenciaDias} días · Prom: {asistenciaDias > 0 ? Math.round(totalAsistencia / asistenciaDias) : 0}/día</p></div><Users className="w-6 h-6 text-purple-400" /></div>
            </CardContent>
          </Card>
        </div>


        {/* Fila 2: Censos detallados */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Censo Protocolo */}
          <Card className="border-indigo-200 bg-indigo-50/50">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-1.5 mb-2">
                <img src="/logo.png" alt="IRDD" className="w-4 h-4 object-contain" />
                <p className="text-xs text-indigo-700 font-semibold">Censo Protocolo</p>
              </div>
              <p className="text-3xl font-bold text-indigo-800">{statsCenso.total}</p>
            </CardContent>
          </Card>

          {/* Censo Niños */}
          <Card className="border-amber-200 bg-amber-50/50">
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
          <Card className="border-violet-200 bg-violet-50/50">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-1.5 mb-2">
                <span className="text-sm">👩</span>
                <p className="text-xs text-violet-700 font-semibold">Nuevos creyentes</p>
              </div>
              <p className="text-3xl font-bold text-violet-800">{statsCensoMdg.total}</p>
            </CardContent>
          </Card>

          {/* Censo Jóvenes */}
          <Card className="border-pink-200 bg-pink-50/50">
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
          <Card className="border-sky-200 bg-sky-50/50"><CardContent className="pt-4 pb-3"><p className="text-[10px] text-sky-600 font-medium">Discipulado</p><p className="text-2xl font-bold text-sky-800">{Object.values(statsDiscipulado).reduce((s, v) => s + v.inscritos, 0)}</p><p className="text-[9px] text-sky-500">{Object.values(statsDiscipulado).reduce((s, v) => s + v.aprobados, 0)} aprobados · {Object.values(statsDiscipulado).reduce((s, v) => s + v.enCurso, 0)} en curso</p></CardContent></Card>
          <Card className="border-teal-200 bg-teal-50/50"><CardContent className="pt-4 pb-3"><p className="text-[10px] text-teal-600 font-medium">Bautizos</p><p className="text-2xl font-bold text-teal-800">{statsBautizos.censoBautizados}</p><p className="text-[9px] text-teal-500">total · {statsBautizos.esteMes > 0 ? <span className="text-teal-700 font-semibold">+{statsBautizos.esteMes} este mes</span> : <span>0 este mes</span>}</p></CardContent></Card>
          <Card className="border-rose-200 bg-rose-50/50"><CardContent className="pt-4 pb-3"><p className="text-[10px] text-rose-600 font-medium">Matrimonios</p><p className="text-2xl font-bold text-rose-800">{statsMatrimonios.censoMatrimonios}</p><p className="text-[9px] text-rose-500">total · {statsMatrimonios.esteMes > 0 ? <span className="text-rose-700 font-semibold">+{statsMatrimonios.esteMes} este mes</span> : <span>0 este mes</span>}</p></CardContent></Card>
          <Card className="border-emerald-200 bg-emerald-50/50"><CardContent className="pt-4 pb-3"><div className="flex items-center gap-1"><Home className="w-3 h-3 text-emerald-600" /><p className="text-[10px] text-emerald-600 font-medium">Células</p></div><p className="text-2xl font-bold text-emerald-800">{statsCelulas.totalMiembros}</p><p className="text-[9px] text-emerald-500">miembros · {statsCelulas.asistieronSemana} esta semana</p></CardContent></Card>
        </div>

        {/* Fila 3: Servidores + Redil + Cumpleaños + Eventos */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="border-cyan-200 bg-cyan-50/50"><CardContent className="pt-5 pb-4"><div className="flex items-center justify-between"><div><p className="text-xs text-cyan-700">Asistencia Servidores</p><p className="text-xl font-bold text-cyan-700">{Object.values(statsServidores).reduce((s, v) => s + v.asistieron, 0)}</p><p className="text-[9px] text-cyan-600">asistieron · {Object.values(statsServidores).reduce((s, v) => s + v.faltaron, 0)} faltaron</p></div><ClipboardCheck className="w-6 h-6 text-cyan-400" /></div></CardContent></Card>
          <Card className="border-lime-200 bg-lime-50/50"><CardContent className="pt-5 pb-4"><div className="flex items-center justify-between"><div><p className="text-xs text-lime-700">Redil - Ayuda Social</p><p className="text-xl font-bold text-lime-700">{statsRedil.entregadosMes}</p><p className="text-[9px] text-lime-600">entregados este mes · {statsRedil.pendientes} pendientes</p></div><Heart className="w-6 h-6 text-lime-400" /></div></CardContent></Card>
          <Card className="border-fuchsia-200 bg-fuchsia-50/50"><CardContent className="pt-5 pb-4"><div className="flex items-center justify-between"><div><p className="text-xs text-fuchsia-700">Cumpleaños del Mes</p><p className="text-xl font-bold text-fuchsia-700">{statsCumpleanos.totalMes}</p><p className="text-[9px] text-fuchsia-600">{statsCumpleanos.enviados} felicitados · {statsCumpleanos.pendientesEnvio} pendientes</p></div><Cake className="w-6 h-6 text-fuchsia-400" /></div></CardContent></Card>
          <Card className="border-violet-200 bg-violet-50/50"><CardContent className="pt-5 pb-4"><div className="flex items-center justify-between"><div><p className="text-xs text-violet-700">Eventos / Encuentro</p><p className="text-xl font-bold text-violet-700">{statsEventos.reduce((s, e) => s + e.inscritos, 0)}</p><p className="text-[9px] text-violet-600">inscritos · {statsEventos.length} evento(s)</p></div><CalendarDays className="w-6 h-6 text-violet-400" /></div></CardContent></Card>
        </div>

        {/* Fila 4: Proyecto Mario + Atrasados */}
        <div className="grid grid-cols-2 md:grid-cols-2 gap-4">
          <Card className="border-orange-200 bg-orange-50/50"><CardContent className="pt-5 pb-4"><div className="flex items-center justify-between"><div><p className="text-xs text-orange-700">Proyecto Mario</p><p className="text-xl font-bold text-orange-700">{Object.values(statsProyectoMario).reduce((s, v) => s + v.inscritos, 0)}</p><p className="text-[9px] text-orange-600">inscritos · {Object.values(statsProyectoMario).filter(v => v.inscritos > 0).length} cursos activos</p></div><Palette className="w-6 h-6 text-orange-400" /></div></CardContent></Card>
          <Card className="border-amber-200 bg-amber-50/50"><CardContent className="pt-5 pb-4"><div className="flex items-center justify-between"><div><p className="text-xs text-amber-700">Atrasados</p><p className="text-xl font-bold text-amber-700">{statsAtrasados.total}</p><p className="text-[9px] text-red-600">{statsAtrasados.sinGestionar} sin gestionar · {statsAtrasados.total - statsAtrasados.sinGestionar} gestionados</p></div><AlertTriangle className="w-6 h-6 text-amber-400" /></div></CardContent></Card>
        </div>


        {/* Acordeón Estadísticas Detalladas */}
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
              {/* Censos */}
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
              {/* Discipulado */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2"><GraduationCap className="w-4 h-4 text-sky-600" /> Discipulado (Ciclos Activos)</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {(Object.keys(CICLO_CONFIG) as CicloTipo[]).map(tipo => (
                    <div key={tipo} className="p-3 bg-sky-50 rounded-lg border border-sky-100">
                      <p className="text-xs font-semibold text-sky-700 mb-2">{CICLO_CONFIG[tipo].label}</p>
                      {statsDiscipulado[tipo].inscritos > 0 ? (
                        <div className="grid grid-cols-2 gap-2">
                          <div className="text-center"><p className="text-lg font-bold text-sky-800">{statsDiscipulado[tipo].inscritos}</p><p className="text-[9px] text-sky-600">Inscritos</p></div>
                          <div className="text-center"><p className="text-lg font-bold text-green-700">{statsDiscipulado[tipo].aprobados}</p><p className="text-[9px] text-green-600">Aprobados</p></div>
                          <div className="text-center"><p className="text-lg font-bold text-gray-700">{statsDiscipulado[tipo].enCurso}</p><p className="text-[9px] text-gray-500">En curso</p></div>
                          <div className="text-center"><p className="text-lg font-bold text-red-700">{statsDiscipulado[tipo].reprobados}</p><p className="text-[9px] text-red-600">Reprobados</p></div>
                        </div>
                      ) : <p className="text-xs text-gray-400 text-center py-2">Sin ciclo activo</p>}
                    </div>
                  ))}
                </div>
              </div>
              {/* Servidores */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2"><ClipboardCheck className="w-4 h-4 text-cyan-600" /> Asistencia Servidores por Ministerio</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead><tr className="border-b border-gray-200"><th className="text-left py-2 px-2 text-gray-600">Ministerio</th><th className="text-center py-2 px-1 text-green-700">A</th><th className="text-center py-2 px-1 text-red-700">F</th><th className="text-center py-2 px-1 text-blue-700">J</th><th className="text-center py-2 px-1 text-amber-700">AT</th><th className="text-center py-2 px-1 text-gray-700">Total</th></tr></thead>
                    <tbody>
                      {MINISTERIOS_SERVIDORES.map(min => { const s = statsServidores[min.key] || { total: 0, asistieron: 0, faltaron: 0, justificaron: 0, atrasados: 0 }; return (
                        <tr key={min.key} className="border-b border-gray-100"><td className="py-1.5 px-2 text-gray-800">{min.label}</td><td className="text-center py-1.5"><Badge className="bg-green-100 text-green-800 text-[10px]">{s.asistieron}</Badge></td><td className="text-center py-1.5"><Badge className="bg-red-100 text-red-800 text-[10px]">{s.faltaron}</Badge></td><td className="text-center py-1.5"><Badge className="bg-blue-100 text-blue-800 text-[10px]">{s.justificaron}</Badge></td><td className="text-center py-1.5"><Badge className="bg-amber-100 text-amber-800 text-[10px]">{s.atrasados}</Badge></td><td className="text-center py-1.5 font-semibold">{s.total}</td></tr>
                      )})}
                      <tr className="border-t-2 border-gray-300 bg-gray-50 font-bold"><td className="py-2 px-2">TOTAL</td><td className="text-center py-2 text-green-800">{Object.values(statsServidores).reduce((s, v) => s + v.asistieron, 0)}</td><td className="text-center py-2 text-red-800">{Object.values(statsServidores).reduce((s, v) => s + v.faltaron, 0)}</td><td className="text-center py-2 text-blue-800">{Object.values(statsServidores).reduce((s, v) => s + v.justificaron, 0)}</td><td className="text-center py-2 text-amber-800">{Object.values(statsServidores).reduce((s, v) => s + v.atrasados, 0)}</td><td className="text-center py-2">{Object.values(statsServidores).reduce((s, v) => s + v.total, 0)}</td></tr>
                    </tbody>
                  </table>
                </div>
              </div>
              {/* Atrasados */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-amber-600" /> Atrasados (este mes)</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="text-center p-3 bg-amber-50 rounded-lg border border-amber-100"><p className="text-[10px] text-amber-600">Total</p><p className="text-2xl font-bold text-amber-800">{statsAtrasados.total}</p></div>
                  <div className="text-center p-3 bg-red-50 rounded-lg border border-red-100"><p className="text-[10px] text-red-600">Sin Gestionar</p><p className="text-2xl font-bold text-red-800">{statsAtrasados.sinGestionar}</p></div>
                  <div className="text-center p-3 bg-green-50 rounded-lg border border-green-100"><p className="text-[10px] text-green-600">Gestionados</p><p className="text-2xl font-bold text-green-800">{statsAtrasados.total - statsAtrasados.sinGestionar}</p></div>
                  <div className="text-center p-3 bg-gray-50 rounded-lg border border-gray-200"><p className="text-[10px] text-gray-600">% Gestión</p><p className="text-2xl font-bold text-gray-800">{statsAtrasados.total > 0 ? Math.round(((statsAtrasados.total - statsAtrasados.sinGestionar) / statsAtrasados.total) * 100) : 0}%</p></div>
                </div>
              </div>
            </CardContent>
          )}
        </Card>
      </main>
    </div>
  )
}

export default function PastoralPage() {
  return (
    <PermissionsGuard moduleName="resumen-pastoral">
      {(canEdit) => <PastoralContent canEdit={canEdit} />}
    </PermissionsGuard>
  )
}
