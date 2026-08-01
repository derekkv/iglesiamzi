"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import {
  ArrowLeft, TrendingUp, TrendingDown, Users, DollarSign,
  AlertTriangle, ClipboardCheck, Heart, Palette, Cake,
  CalendarDays, ChevronDown, ChevronRight, Home, GraduationCap, BookOpen, UserCheck,
} from "lucide-react"
import { supabase } from "@/lib/secure-db"
import { CHURCH } from "@/lib/branding"
import { getAlfoliMes } from "@/lib/mod/alfoli-service"
import { getCumpleanerosMes, getHistorialEnvios } from "@/lib/mod/cumpleanos-service"
import { censoService } from "@/lib/mod/censo-service"
import { censoMdgService } from "@/lib/mod/censo-mdg-service"
import { censoNinosService } from "@/lib/mod/censo-ninos-service"
import { censoJovenesService } from "@/lib/mod/censo-jovenes-service"
import { discipuladoCiclosService, CICLO_CONFIG, type CicloTipo } from "@/lib/mod/discipulado-ciclos-service"
import { proyectoMarioCiclosService, PROYECTO_MARIO_CICLO_CONFIG, type ProyectoMarioCicloTipo } from "@/lib/mod/proyecto-mario-ciclos-service"

const MINISTERIOS_SERVIDORES = [
  { key: "administracion", label: "Administración" },
  { key: "alabanza",       label: "Alabanza" },
  { key: "celulas",        label: "Células" },
  { key: "comunicacion",   label: "Comunicación" },
  { key: "discipulado",    label: "Discipulado" },
  { key: "herederos",      label: "Herederos" },
  { key: "hombres",        label: "Hombres" },
  { key: "intercesion",    label: "Intercesión" },
  { key: "jovenes",        label: "Jóvenes" },
  { key: "mdg",            label: "Mujeres de Gracia" },
  { key: "pastoral",       label: "Pastoral" },
  { key: "protocolo",      label: "Protocolo" },
  { key: "redil",          label: "Redil" },
]

const TIPOS_AYUDA_LABELS: Record<string, { label: string; icon: string }> = {
  canasta:         { label: "Canasta/Víveres", icon: "🧺" },
  medicinas:       { label: "Medicinas",        icon: "💊" },
  ropa:            { label: "Ropa",             icon: "🧥" },
  panales:         { label: "Pañales",          icon: "👶" },
  utiles_escolares:{ label: "Útiles",           icon: "📚" },
  ayuda_economica: { label: "Económica",        icon: "💰" },
  otro:            { label: "Otro",             icon: "📦" },
}

export interface SelectedMonth {
  id: string
  name: string
  year: number
  month: number
  status: string
  start_date?: string
  end_date?: string | null
}

interface Props { selectedMonth: SelectedMonth }


export function MesViewClient({ selectedMonth }: Props) {
  const router  = useRouter()
  const mesId   = selectedMonth.id
  const mesNum  = selectedMonth.month
  const yearNum = selectedMonth.year

  // ── state datos ───────────────────────────────────────────────────────────
  const [ingresos,          setIngresos]          = useState<any[]>([])
  const [egresos,           setEgresos]           = useState<any[]>([])
  const [asistenciaColumns, setAsistenciaColumns] = useState<any[]>([])
  const [asistenciaDetails, setAsistenciaDetails] = useState<any[]>([])
  const [asistenciaData,    setAsistenciaData]    = useState<any[]>([])
  const [nominaRecords,     setNominaRecords]     = useState<any[]>([])
  const [pagoDiarioRecords, setPagoDiarioRecords] = useState<any[]>([])
  const [totalCelulas,      setTotalCelulas]      = useState(0)
  const [totalAlfoli,       setTotalAlfoli]       = useState(0)

  // stats del mes (filtrados por fecha/mes_id)
  const [statsBautizos,      setStatsBautizos]      = useState({ total:0, esteMes:0, censoBautizados:0 })
  const [statsMatrimonios,   setStatsMatrimonios]   = useState({ total:0, esteMes:0, censoMatrimonios:0 })
  const [statsPresentaciones,setStatsPresentaciones]= useState({ total:0, esteMes:0 })
  const [statsAtrasados,     setStatsAtrasados]     = useState({ total:0, sinGestionar:0 })
  const [statsServidores,    setStatsServidores]    = useState<Record<string,{total:number;asistieron:number;faltaron:number;justificaron:number;atrasados:number}>>({})
  const [statsRedil,         setStatsRedil]         = useState({ totalCasos:0, pendientes:0, entregadosSemana:0, entregadosMes:0, porTipo:{} as Record<string,number> })
  const [statsCumpleanos,    setStatsCumpleanos]    = useState({ totalMes:0, enviados:0, pendientesEnvio:0 })
  const [statsAsistCulto,    setStatsAsistCulto]    = useState({ asistieron:0, faltaron:0, enSeguimiento:0, sinGestionar:0 })
  const [statsEventos,       setStatsEventos]       = useState<Array<{id:number;nombre:string;inscritos:number;pagadosCompleto:number;pendientesPago:number;totalRecaudado:number;totalValor:number}>>([])

  // stats actuales (censos, discipulado, proyecto mario - no son históricos en BD)
  const [statsCenso,        setStatsCenso]       = useState({ total:0, miembros:0, activos:0 })
  const [statsCensoMdg,     setStatsCensoMdg]    = useState({ total:0, miembros:0, activos:0, nuevosCreyentes:0, nuevosMes:0 })
  const [statsCensoNinos,   setStatsCensoNinos]  = useState({ total:0, baby:0, kids:0, explores:0, champions:0 })
  const [statsCensoJovenes, setStatsCensoJovenes]= useState({ total:0, miembros:0, activos:0, nuevos:0, primeraVez:0, nuevosMes:0 })
  const [statsDiscipulado,  setStatsDiscipulado] = useState<Record<CicloTipo,{inscritos:number;aprobados:number;reprobados:number;enCurso:number}>>({ primeros_pasos:{inscritos:0,aprobados:0,reprobados:0,enCurso:0}, seguimos_avanzando:{inscritos:0,aprobados:0,reprobados:0,enCurso:0}, siendo_iglesia:{inscritos:0,aprobados:0,reprobados:0,enCurso:0} })
  const [statsProyectoMario,setStatsProyectoMario]=useState<Record<ProyectoMarioCicloTipo,{inscritos:number;ultimaClase:number;asistieron:number;faltaron:number}>>({ belleza_integral_sabados:{inscritos:0,ultimaClase:0,asistieron:0,faltaron:0},belleza_integral_viernes:{inscritos:0,ultimaClase:0,asistieron:0,faltaron:0},manualidades:{inscritos:0,ultimaClase:0,asistieron:0,faltaron:0},belleza_cejas:{inscritos:0,ultimaClase:0,asistieron:0,faltaron:0},gastronomia:{inscritos:0,ultimaClase:0,asistieron:0,faltaron:0} })
  const [statsCelulas,      setStatsCelulas]     = useState({ totalMiembros:0, asistieronMes:0 })

  const [loading,         setLoading]         = useState(true)
  const [loadingProgress, setLoadingProgress] = useState(0)

  // ── modales ───────────────────────────────────────────────────────────────
  const [modalIngresos,       setModalIngresos]       = useState(false)
  const [modalEgresos,        setModalEgresos]        = useState(false)
  const [modalNomina,         setModalNomina]         = useState(false)
  const [modalAsistencia,     setModalAsistencia]     = useState(false)
  const [modalTotalMiembros,  setModalTotalMiembros]  = useState(false)
  const [modalCensoNinos,     setModalCensoNinos]     = useState(false)
  const [modalCensoJovenes,   setModalCensoJovenes]   = useState(false)
  const [modalNuevosCreyentes,setModalNuevosCreyentes]= useState(false)
  const [modalDiscipulado,    setModalDiscipulado]    = useState(false)
  const [modalBautizos,       setModalBautizos]       = useState(false)
  const [modalMatrimonios,    setModalMatrimonios]    = useState(false)
  const [modalCelulas,        setModalCelulas]        = useState(false)
  const [modalAtrasados,      setModalAtrasados]      = useState(false)
  const [modalRedil,          setModalRedil]          = useState(false)
  const [modalProyectoMario,  setModalProyectoMario]  = useState(false)
  const [modalCumpleanos,     setModalCumpleanos]     = useState(false)
  const [modalEventos,        setModalEventos]        = useState(false)
  const [modalServidores,     setModalServidores]     = useState(false)

  // ── acordeones ────────────────────────────────────────────────────────────
  const [openIngresos,      setOpenIngresos]      = useState(false)
  const [openEgresos,       setOpenEgresos]       = useState(false)
  const [openAsistencia,    setOpenAsistencia]    = useState(false)
  const [openNomina,        setOpenNomina]        = useState(false)
  const [openServidores,    setOpenServidores]    = useState(false)
  const [openEstadisticas,  setOpenEstadisticas]  = useState(true)
  const [openRedil,         setOpenRedil]         = useState(false)
  const [openCumpleanos,    setOpenCumpleanos]    = useState(false)
  const [openEventos,       setOpenEventos]       = useState(false)
  const [openProyectoMario, setOpenProyectoMario] = useState(false)
  const [openAtrasados,     setOpenAtrasados]     = useState(false)
  const [openDiscipulado,   setOpenDiscipulado]   = useState(false)
  const [openBautizos,      setOpenBautizos]      = useState(false)
  const [openMatrimonios,   setOpenMatrimonios]   = useState(false)
  const [openCelulas,       setOpenCelulas]       = useState(false)
  const [openCensoProtocolo,setOpenCensoProtocolo]= useState(false)
  const [openCensoNinos,    setOpenCensoNinos]    = useState(false)
  const [openCensoMdg,      setOpenCensoMdg]      = useState(false)
  const [openCensoJovenes,  setOpenCensoJovenes]  = useState(false)


  // ── carga ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    const primerDia = `${yearNum}-${String(mesNum).padStart(2,"0")}-01`
    const ultimoDia = `${yearNum}-${String(mesNum).padStart(2,"0")}-${String(new Date(yearNum,mesNum,0).getDate()).padStart(2,"0")}`
    const mesStr    = `${yearNum}-${String(mesNum).padStart(2,"0")}`

    let done = 0; const total = 14
    const tick = () => { done++; setLoadingProgress(Math.round((done/total)*100)) }

    const run = async () => {
      setLoading(true); setLoadingProgress(0)

      // 1. Financiero mes-scoped
      const [ingR,egR,colR,detR,datR,nomR,pdR] = await Promise.all([
        supabase.from("ingresos").select("*").eq("mes_id",mesId),
        supabase.from("egresos").select("*").eq("mes_id",mesId),
        supabase.from("asistencia_columnas").select("*").eq("mes_id",mesId).order("orden"),
        supabase.from("asistencia_detalles").select("*").eq("mes_id",mesId).order("orden"),
        supabase.from("asistencia_datos").select("*").eq("mes_id",mesId),
        supabase.from("nomina").select("*").eq("mes_id",mesId),
        supabase.from("pago_diario").select("*").eq("mes_id",mesId),
      ])
      setIngresos(ingR.data||[]); setEgresos(egR.data||[])
      setAsistenciaColumns(colR.data||[]); setAsistenciaDetails(detR.data||[])
      setAsistenciaData(datR.data||[]); setNominaRecords(nomR.data||[])
      setPagoDiarioRecords(pdR.data||[]); tick()

      // 2. Alfolí + células ofrenda (por mes/año)
      const alfoliRecs = await getAlfoliMes(mesNum, yearNum)
      setTotalAlfoli(alfoliRecs.reduce((s,r)=>s+Number(r.valor),0))
      const {data:celD} = await supabase.from("ofrendas_celulas").select("valor").eq("mes",mesNum).eq("anio",yearNum).eq("recibido",true)
      setTotalCelulas((celD||[]).reduce((s:number,r:any)=>s+Number(r.valor),0)); tick()

      // 3. Bautizos / Matrimonios / Presentaciones (filtrados por fecha del mes)
      const [bauR,matR,preR] = await Promise.all([
        supabase.from("bautizos").select("id, fecha"),
        supabase.from("matrimonios").select("id, fecha"),
        supabase.from("presentacion_ninos").select("id, fecha"),
      ])
      const bD=bauR.data||[]; const mD=matR.data||[]; const pD=preR.data||[]
      setStatsPresentaciones({ total:pD.length, esteMes:pD.filter((p:any)=>p.fecha>=primerDia&&p.fecha<=ultimoDia).length })
      tick()

      // 4. Atrasados del mes
      const {data:atrD} = await supabase.from("gestion_atrasados").select("id,gestionado,fecha,modulo,user_name").gte("fecha",primerDia).lte("fecha",ultimoDia)
      setStatsAtrasados({ total:(atrD||[]).length, sinGestionar:(atrD||[]).filter((a:any)=>!a.gestionado).length }); tick()

      // 5. Asistencia servidores del mes
      const {data:servD} = await supabase.from("asistencia_servidores").select("modulo,estado,fecha").gte("fecha",primerDia).lte("fecha",ultimoDia)
      const sMap:Record<string,any>={}
      for (const min of MINISTERIOS_SERVIDORES) {
        const r=(servD||[]).filter((x:any)=>x.modulo===min.key)
        sMap[min.key]={ total:r.filter((x:any)=>x.estado&&x.estado!=="pendiente").length, asistieron:r.filter((x:any)=>x.estado==="asistio").length, faltaron:r.filter((x:any)=>x.estado==="falto").length, justificaron:r.filter((x:any)=>x.estado==="justifico").length, atrasados:r.filter((x:any)=>x.estado==="atrasado").length }
      }
      setStatsServidores(sMap); tick()

      // 6. Censos (estado actual — no son históricos en BD)
      const [cP,cM,cN,cJ] = await Promise.all([
        censoService.getAll().catch(()=>[] as any[]),
        censoMdgService.getAll().catch(()=>[] as any[]),
        censoNinosService.getAll().catch(()=>[] as any[]),
        censoJovenesService.getAll().catch(()=>[] as any[]),
      ])
      setStatsCenso({ total:cP.length, miembros:cP.filter((c:any)=>c.miembro).length, activos:cP.filter((c:any)=>c.miembro_activo).length })
      setStatsCensoMdg({ total:cM.length, miembros:cM.filter((c:any)=>c.miembro).length, activos:cM.filter((c:any)=>c.miembro_activo).length, nuevosCreyentes:cM.filter((c:any)=>c.nuevo_creyente).length, nuevosMes:cM.filter((c:any)=>c.nuevo_creyente&&c.created_at?.startsWith(mesStr)).length })
      setStatsCensoNinos({ total:cN.length, baby:cN.filter((c:any)=>c.grupo==="HEREDEROS BABY").length, kids:cN.filter((c:any)=>c.grupo==="HEREDEROS KIDS").length, explores:cN.filter((c:any)=>c.grupo==="HEREDEROS EXPLORES").length, champions:cN.filter((c:any)=>c.grupo==="HEREDEROS CHAMPIONS").length })
      setStatsCensoJovenes({ total:cJ.length, miembros:cJ.filter((c:any)=>c.miembro).length, activos:cJ.filter((c:any)=>c.miembro_activo).length, nuevos:cJ.filter((c:any)=>c.nuevo_creyente).length, primeraVez:cJ.filter((c:any)=>c.primera_vez_iglesia).length, nuevosMes:cJ.filter((c:any)=>(c.nuevo_creyente||c.primera_vez_iglesia)&&c.created_at?.startsWith(mesStr)).length })
      const censoBautizados   = cP.filter((c:any)=>c.bautizo_irdd).length   + cM.filter((c:any)=>c.bautizo_irdd).length
      const censoMatrimonios  = cP.filter((c:any)=>c.matrimonio_irdd).length + cM.filter((c:any)=>c.matrimonio_irdd).length
      const totalCelulasMiembros = cP.filter((c:any)=>c.celula_asiste).length + cM.filter((c:any)=>c.celula_asiste).length
      setStatsBautizos({ total:bD.length, esteMes:bD.filter((b:any)=>b.fecha>=primerDia&&b.fecha<=ultimoDia).length, censoBautizados })
      setStatsMatrimonios({ total:mD.length, esteMes:mD.filter((m:any)=>m.fecha>=primerDia&&m.fecha<=ultimoDia).length, censoMatrimonios }); tick()

      // 7. Células: asistencia del mes completo (no solo semana actual)
      const {data:gCelD} = await supabase.from("gestion_celulas").select("id,asistio,semana_inicio").gte("semana_inicio",primerDia).lte("semana_inicio",ultimoDia)
      setStatsCelulas({ totalMiembros:totalCelulasMiembros, asistieronMes:(gCelD||[]).filter((g:any)=>g.asistio).length }); tick()

      // 8. Discipulado ciclos activos (estado actual)
      const ciclosDisc = await Promise.all((Object.keys(CICLO_CONFIG) as CicloTipo[]).map(t=>discipuladoCiclosService.getCicloActivoCompleto(t).then(r=>({t,r})).catch(()=>({t,r:null}))))
      const dS:Record<CicloTipo,any>={ primeros_pasos:{inscritos:0,aprobados:0,reprobados:0,enCurso:0}, seguimos_avanzando:{inscritos:0,aprobados:0,reprobados:0,enCurso:0}, siendo_iglesia:{inscritos:0,aprobados:0,reprobados:0,enCurso:0} }
      for (const {t,r} of ciclosDisc) { if(r) dS[t]={ inscritos:r.participantes.length, aprobados:r.participantes.filter((p:any)=>p.estatus==="aprobado").length, reprobados:r.participantes.filter((p:any)=>p.estatus==="reprobado").length, enCurso:r.participantes.filter((p:any)=>p.estatus==="en_curso").length } }
      setStatsDiscipulado(dS); tick()

      // 9. Proyecto Mario ciclos activos (estado actual)
      const ciclosPM = await Promise.all((Object.keys(PROYECTO_MARIO_CICLO_CONFIG) as ProyectoMarioCicloTipo[]).map(t=>proyectoMarioCiclosService.getCicloActivoCompleto(t).then(r=>({t,r})).catch(()=>({t,r:null}))))
      const pmS:Record<ProyectoMarioCicloTipo,any>={ belleza_integral_sabados:{inscritos:0,ultimaClase:0,asistieron:0,faltaron:0},belleza_integral_viernes:{inscritos:0,ultimaClase:0,asistieron:0,faltaron:0},manualidades:{inscritos:0,ultimaClase:0,asistieron:0,faltaron:0},belleza_cejas:{inscritos:0,ultimaClase:0,asistieron:0,faltaron:0},gastronomia:{inscritos:0,ultimaClase:0,asistieron:0,faltaron:0} }
      for (const {t,r:c} of ciclosPM) { if(c){const ins=c.participantes.length;const hoy=new Date();hoy.setHours(0,0,0,0);const fp=c.fechas.filter((f:any)=>new Date(f.fecha+"T00:00:00")<=hoy);const uf=fp[fp.length-1];let a=0,fa=0;if(uf){a=c.asistencia.filter((x:any)=>x.fecha_id===uf.id&&x.status==="A").length;fa=ins-a}pmS[t]={inscritos:ins,ultimaClase:uf?uf.numero_clase:0,asistieron:a,faltaron:fa}} }
      setStatsProyectoMario(pmS); tick()

      // 10. Redil — entregas filtradas por fecha del mes
      const [cRed,sRed,eRed] = await Promise.all([
        supabase.from("casos_redil").select("id,estado,fecha_creacion"),
        supabase.from("solicitudes_redil").select("caso_id,tipo_ayuda"),
        supabase.from("entregas_redil").select("caso_id,fecha_entrega").gte("fecha_entrega",primerDia).lte("fecha_entrega",ultimoDia),
      ])
      const casosR=cRed.data||[]; const solsR=sRed.data||[]; const entsR=eRed.data||[]
      const pendR=casosR.filter((c:any)=>!["cerrado","rechazado","entregado"].includes(c.estado)).length
      const idsCerrados=new Set(casosR.filter((c:any)=>c.estado==="cerrado"||c.estado==="entregado").map((c:any)=>c.id))
      const ptR:Record<string,number>={}
      for (const s of solsR) { if(idsCerrados.has((s as any).caso_id)){for(const t of (s as any).tipo_ayuda||[]){ptR[t]=(ptR[t]||0)+1}} }
      setStatsRedil({ totalCasos:casosR.length, pendientes:pendR, entregadosSemana:0, entregadosMes:entsR.length, porTipo:ptR }); tick()

      // 11. Cumpleaños del mes
      const [cum,env] = await Promise.all([
        getCumpleanerosMes(mesNum,yearNum).catch(()=>[] as any[]),
        getHistorialEnvios(yearNum,mesNum).catch(()=>[] as any[]),
      ])
      const pendC=cum.length-env.length
      setStatsCumpleanos({ totalMes:cum.length, enviados:env.length, pendientesEnvio:pendC>0?pendC:0 }); tick()

      // 12. Eventos — participantes registrados durante el mes
      const {data:evts} = await supabase.from("eventos_tabs").select("id,nombre,valor_default,is_active").eq("is_active",true).order("sort_order",{ascending:true})
      if (evts&&evts.length>0) {
        const parts = await Promise.all(evts.map((ev:any)=>supabase.from("evento_participantes").select("id,valor,abono,created_at").eq("evento_id",ev.id).gte("created_at",`${primerDia}T00:00:00`).lte("created_at",`${ultimoDia}T23:59:59`).then(r=>({id:ev.id,nombre:ev.nombre,parts:r.data||[]}))))
        setStatsEventos(parts.map(({id,nombre,parts:pp})=>{const ins=pp.length;const pag=pp.filter((p:any)=>Number(p.valor)<=0||Number(p.abono)>=Number(p.valor)).length;return{id,nombre,inscritos:ins,pagadosCompleto:pag,pendientesPago:ins-pag,totalRecaudado:pp.reduce((s:number,p:any)=>s+Number(p.abono||0),0),totalValor:pp.reduce((s:number,p:any)=>s+Number(p.valor||0),0)}}))
      } else { setStatsEventos([]) }
      tick()

      // 13. Asistencia al culto del mes
      const [acR,segR] = await Promise.all([
        supabase.from("asistencia_culto").select("persona_id,fuente,asistio").eq("mes_id",mesId),
        supabase.from("asistencia_culto_seguimiento").select("id,gestionado").eq("mes_id",mesId),
      ])
      const regs=acR.data||[]; const seg=segR.data||[]
      const acAsistieron=new Set(regs.filter((r:any)=>r.asistio===true).map((r:any)=>`${r.persona_id}-${r.fuente}`)).size
      const acFaltaron  =new Set(regs.filter((r:any)=>r.asistio===false).map((r:any)=>`${r.persona_id}-${r.fuente}`)).size
      setStatsAsistCulto({ asistieron:acAsistieron, faltaron:acFaltaron, enSeguimiento:seg.length, sinGestionar:seg.filter((s:any)=>!s.gestionado).length }); tick()

      setLoadingProgress(100); setLoading(false)
    }

    run().catch(e=>{console.error("[mes-view]",e);setLoading(false)})
  }, [mesId,mesNum,yearNum])

  // ── helpers ───────────────────────────────────────────────────────────────
  const fmt = (d:string) => { if(!d)return""; const dt=new Date(d); return `${String(dt.getUTCDate()).padStart(2,"0")}/${String(dt.getUTCMonth()+1).padStart(2,"0")}/${dt.getUTCFullYear()}` }
  const totalIngMod    = ingresos.reduce((s,r)=>s+Number(r.monto||0),0)
  const totalIngresos  = totalIngMod+totalCelulas+totalAlfoli
  const totalEgresos   = egresos.reduce((s,r)=>s+Number(r.monto||0),0)
  const totalNomAPagar = nominaRecords.reduce((s:number,r:any)=>s+Number(r.valor_a_pagar||0),0)
  const totalNomPagado = nominaRecords.reduce((s:number,r:any)=>{let p=0;if(r.primera_quincena_pagada)p+=Number(r.primera_quincena_valor||0);if(r.segunda_quincena_pagada)p+=Number(r.segunda_quincena_valor||0);return s+p},0)
  const totalPagoDiario= pagoDiarioRecords.reduce((s:number,r:any)=>s+Number(r.valor||0),0)
  const totalAsistencia= asistenciaData.reduce((s:number,d:any)=>s+(d.cantidad||0),0)
  const colTotal=(id:number)=>asistenciaData.filter((d:any)=>d.columna_id===id).reduce((s:number,d:any)=>s+(d.cantidad||0),0)
  const ingresosCat=ingresos.reduce((a,r)=>{const c=r.categoria_principal||"Sin categoría";a[c]=(a[c]||0)+Number(r.monto||0);return a},{} as Record<string,number>)
  const egresosCat =egresos.reduce((a,r)=>{const c=r.categoria_principal||"Sin categoría";a[c]=(a[c]||0)+Number(r.monto||0);return a},{} as Record<string,number>)
  const L=(n:number)=>n.toLocaleString("es-CO",{minimumFractionDigits:2})


  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-between items-center h-16">
          <div className="flex items-center space-x-4">
            <Button variant="ghost" size="sm" onClick={()=>router.push("/dashboard/resumen-mensual")} className="flex items-center gap-2">
              <ArrowLeft className="w-4 h-4"/><span>Volver</span>
            </Button>
            <h1 className="text-xl font-semibold text-gray-900">Historial — {selectedMonth.name}</h1>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">Solo lectura</Badge>
            {selectedMonth.status==="closed"?<Badge className="bg-gray-100 text-gray-700">Cerrado</Badge>:<Badge className="bg-green-100 text-green-800">Activo</Badge>}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">

        {/* Aviso */}
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <p className="font-bold text-gray-900">{selectedMonth.name}</p>
            {selectedMonth.start_date && <p className="text-sm text-gray-500">Inicio: {fmt(selectedMonth.start_date)}{selectedMonth.end_date?` · Cierre: ${fmt(selectedMonth.end_date)}`:""}</p>}
          </div>
          <Badge className="bg-amber-100 text-amber-800 border-amber-300 text-xs shrink-0">⚠️ Censos, Discipulado y Proyecto Mario muestran estado actual de la BD (no histórico)</Badge>
        </div>

        {/* Barra carga */}
        {loading && (
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-center gap-3">
            <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin shrink-0"/>
            <div className="flex-1">
              <div className="flex justify-between text-sm mb-1"><span className="text-blue-800">Cargando datos del mes…</span><span className="font-bold text-blue-700">{loadingProgress}%</span></div>
              <div className="w-full bg-blue-200/50 rounded-full h-2"><div className="bg-blue-600 h-2 rounded-full transition-all duration-500" style={{width:`${loadingProgress}%`}}/></div>
            </div>
          </div>
        )}

        {/* ── FILA 1: Financiero ─────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="border-green-200 bg-green-50/50 cursor-pointer hover:shadow-md transition-shadow" onClick={()=>setModalIngresos(true)}>
            <CardContent className="pt-5 pb-4"><div className="flex items-center justify-between"><div><p className="text-xs text-green-700">Ingresos</p><p className="text-xl font-bold text-green-700">${L(totalIngresos)}</p><p className="text-[9px] text-green-600">{ingresos.length} registros · células + alfolí</p></div><TrendingUp className="w-6 h-6 text-green-400"/></div></CardContent>
          </Card>
          <Card className="border-red-200 bg-red-50/50 cursor-pointer hover:shadow-md transition-shadow" onClick={()=>setModalEgresos(true)}>
            <CardContent className="pt-5 pb-4"><div className="flex items-center justify-between"><div><p className="text-xs text-red-700">Egresos</p><p className="text-xl font-bold text-red-700">${L(totalEgresos)}</p><p className="text-[9px] text-red-600">{egresos.length} registros</p></div><TrendingDown className="w-6 h-6 text-red-400"/></div></CardContent>
          </Card>
          <Card className="border-amber-200 bg-amber-50/50 cursor-pointer hover:shadow-md transition-shadow" onClick={()=>setModalNomina(true)}>
            <CardContent className="pt-5 pb-4"><div className="flex items-center justify-between"><div><p className="text-xs text-amber-700">Nómina (a pagar)</p><p className="text-xl font-bold text-amber-700">${L(totalNomAPagar)}</p><p className="text-[9px] text-amber-600">{nominaRecords.length} personas · Pagado: ${L(totalNomPagado)}</p></div><DollarSign className="w-6 h-6 text-amber-400"/></div></CardContent>
          </Card>
          <Card className="border-purple-200 bg-purple-50/50 cursor-pointer hover:shadow-md transition-shadow" onClick={()=>setModalAsistencia(true)}>
            <CardContent className="pt-5 pb-4"><div className="flex items-center justify-between"><div><p className="text-xs text-purple-700">Asistencia Total</p><p className="text-xl font-bold text-purple-700">{totalAsistencia}</p><p className="text-[10px] text-purple-600">{asistenciaColumns.length} días · Prom: {asistenciaColumns.length>0?Math.round(totalAsistencia/asistenciaColumns.length):0}/día</p></div><Users className="w-6 h-6 text-purple-400"/></div></CardContent>
          </Card>
        </div>

        {/* ── FILA 2: Censos ─────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-indigo-200 bg-indigo-50/50 cursor-pointer hover:shadow-md transition-shadow" onClick={()=>setModalTotalMiembros(true)}>
            <CardContent className="pt-4 pb-3"><div className="flex items-center gap-1.5 mb-2"><img src={CHURCH.logoUrl} alt="" className="w-4 h-4 object-contain"/><p className="text-xs text-indigo-700 font-semibold">Total Miembros {CHURCH.initials}</p></div><p className="text-3xl font-bold text-indigo-800">{statsCenso.total+statsCensoMdg.total+statsCensoNinos.total+statsCensoJovenes.total}</p><p className="text-[9px] text-indigo-600 mt-1">Protocolo: {statsCenso.total} · Niños: {statsCensoNinos.total} · Jóvenes: {statsCensoJovenes.total} · MDG: {statsCensoMdg.total}</p></CardContent>
          </Card>
          <Card className="border-amber-200 bg-amber-50/50 cursor-pointer hover:shadow-md transition-shadow" onClick={()=>setModalCensoNinos(true)}>
            <CardContent className="pt-4 pb-3"><div className="flex items-center gap-1.5 mb-2"><span className="text-sm">👶</span><p className="text-xs text-amber-700 font-semibold">Censo Niños</p></div><p className="text-3xl font-bold text-amber-800">{statsCensoNinos.total}</p><div className="mt-2 space-y-1">{[["Baby (0-2)",statsCensoNinos.baby,"bg-pink-100 text-pink-800"],["Kids (3-5)",statsCensoNinos.kids,"bg-blue-100 text-blue-800"],["Explores (6-8)",statsCensoNinos.explores,"bg-green-100 text-green-800"],["Champions (9-11)",statsCensoNinos.champions,"bg-purple-100 text-purple-800"]].map(([l,v,c])=><div key={l as string} className="flex justify-between items-center"><span className="text-[10px] text-amber-600">{l}</span><Badge className={`${c} text-[10px] px-1.5 py-0`}>{v}</Badge></div>)}</div></CardContent>
          </Card>
          <Card className="border-pink-200 bg-pink-50/50 cursor-pointer hover:shadow-md transition-shadow" onClick={()=>setModalCensoJovenes(true)}>
            <CardContent className="pt-4 pb-3"><div className="flex items-center gap-1.5 mb-2"><span className="text-sm">🧑‍🤝‍🧑</span><p className="text-xs text-pink-700 font-semibold">Censo Jóvenes</p></div><p className="text-3xl font-bold text-pink-800">{statsCensoJovenes.total}</p><p className="text-[9px] text-pink-600 mt-1">Miembros: {statsCensoJovenes.miembros} · Activos: {statsCensoJovenes.activos}</p></CardContent>
          </Card>
          <Card className="border-violet-200 bg-violet-50/50 cursor-pointer hover:shadow-md transition-shadow" onClick={()=>setModalNuevosCreyentes(true)}>
            <CardContent className="pt-4 pb-3"><div className="flex items-center gap-1.5 mb-2"><span className="text-sm">✨</span><p className="text-xs text-violet-700 font-semibold">Nuevos Creyentes</p></div><p className="text-3xl font-bold text-violet-800">{statsCensoMdg.nuevosCreyentes}</p><p className="text-[9px] text-violet-600 mt-1">Registrados este mes: {statsCensoMdg.nuevosMes}</p></CardContent>
          </Card>
        </div>

        {/* ── FILA 3: Pastoral ───────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card className="border-sky-200 bg-sky-50/50 cursor-pointer hover:shadow-md transition-shadow" onClick={()=>setModalDiscipulado(true)}>
            <CardContent className="pt-4 pb-3"><p className="text-[10px] text-sky-600 font-medium">Discipulado</p><p className="text-2xl font-bold text-sky-800">{Object.values(statsDiscipulado).reduce((s,v)=>s+v.inscritos,0)}</p><p className="text-[9px] text-sky-500">{Object.values(statsDiscipulado).reduce((s,v)=>s+v.aprobados,0)} aprobados · {Object.values(statsDiscipulado).reduce((s,v)=>s+v.enCurso,0)} en curso</p></CardContent>
          </Card>
          <Card className="border-teal-200 bg-teal-50/50 cursor-pointer hover:shadow-md transition-shadow" onClick={()=>setModalBautizos(true)}>
            <CardContent className="pt-4 pb-3"><p className="text-[10px] text-teal-600 font-medium">Bautizos</p><p className="text-2xl font-bold text-teal-800">{statsBautizos.censoBautizados}</p><p className="text-[9px] text-teal-500">total censo · <span className="font-semibold text-teal-700">+{statsBautizos.esteMes} este mes</span></p></CardContent>
          </Card>
          <Card className="border-rose-200 bg-rose-50/50 cursor-pointer hover:shadow-md transition-shadow" onClick={()=>setModalMatrimonios(true)}>
            <CardContent className="pt-4 pb-3"><p className="text-[10px] text-rose-600 font-medium">Matrimonios</p><p className="text-2xl font-bold text-rose-800">{statsMatrimonios.censoMatrimonios}</p><p className="text-[9px] text-rose-500">total censo · <span className="font-semibold text-rose-700">+{statsMatrimonios.esteMes} este mes</span></p></CardContent>
          </Card>
          <Card className="border-emerald-200 bg-emerald-50/50 cursor-pointer hover:shadow-md transition-shadow" onClick={()=>setModalCelulas(true)}>
            <CardContent className="pt-4 pb-3"><div className="flex items-center gap-1"><Home className="w-3 h-3 text-emerald-600"/><p className="text-[10px] text-emerald-600 font-medium">Células</p></div><p className="text-2xl font-bold text-emerald-800">{statsCelulas.totalMiembros}</p><p className="text-[9px] text-emerald-500">miembros · {statsCelulas.asistieronMes} asistencias en el mes</p></CardContent>
          </Card>
        </div>

        {/* ── FILA 4: Social ─────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="border-lime-200 bg-lime-50/50 cursor-pointer hover:shadow-md transition-shadow" onClick={()=>setModalRedil(true)}>
            <CardContent className="pt-5 pb-4"><div className="flex items-center justify-between"><div><p className="text-xs text-lime-700">Redil - Ayuda Social</p><p className="text-xl font-bold text-lime-700">{statsRedil.entregadosMes}</p><p className="text-[9px] text-lime-600">entregados este mes · {statsRedil.pendientes} pendientes</p></div><Heart className="w-6 h-6 text-lime-400"/></div></CardContent>
          </Card>
          <Card className="border-orange-200 bg-orange-50/50 cursor-pointer hover:shadow-md transition-shadow" onClick={()=>setModalProyectoMario(true)}>
            <CardContent className="pt-5 pb-4"><div className="flex items-center justify-between"><div><p className="text-xs text-orange-700">Proyecto Mario</p><p className="text-xl font-bold text-orange-700">{Object.values(statsProyectoMario).reduce((s,v)=>s+v.inscritos,0)}</p><p className="text-[9px] text-orange-600">{Object.values(statsProyectoMario).filter(v=>v.inscritos>0).length} cursos activos</p></div><Palette className="w-6 h-6 text-orange-400"/></div></CardContent>
          </Card>
          <Card className="border-fuchsia-200 bg-fuchsia-50/50 cursor-pointer hover:shadow-md transition-shadow" onClick={()=>setModalCumpleanos(true)}>
            <CardContent className="pt-5 pb-4"><div className="flex items-center justify-between"><div><p className="text-xs text-fuchsia-700">Cumpleaños del Mes</p><p className="text-xl font-bold text-fuchsia-700">{statsCumpleanos.totalMes}</p><p className="text-[9px] text-fuchsia-600">{statsCumpleanos.enviados} felicitados · {statsCumpleanos.pendientesEnvio} pendientes</p></div><Cake className="w-6 h-6 text-fuchsia-400"/></div></CardContent>
          </Card>
          <Card className="border-violet-200 bg-violet-50/50 cursor-pointer hover:shadow-md transition-shadow" onClick={()=>setModalEventos(true)}>
            <CardContent className="pt-5 pb-4"><div className="flex items-center justify-between"><div><p className="text-xs text-violet-700">Eventos / Encuentro</p><p className="text-xl font-bold text-violet-700">{statsEventos.reduce((s,e)=>s+e.inscritos,0)}</p><p className="text-[9px] text-violet-600">{statsEventos.length} evento(s)</p></div><CalendarDays className="w-6 h-6 text-violet-400"/></div></CardContent>
          </Card>
        </div>

        {/* ── FILA 5: Operaciones ────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-4">
          <Card className="border-cyan-200 bg-cyan-50/50 cursor-pointer hover:shadow-md transition-shadow" onClick={()=>setModalServidores(true)}>
            <CardContent className="pt-5 pb-4"><div className="flex items-center justify-between"><div><p className="text-xs text-cyan-700">Asistencia Servidores</p><p className="text-xl font-bold text-cyan-700">{Object.values(statsServidores).reduce((s,v)=>s+v.asistieron,0)}</p><p className="text-[9px] text-cyan-600">asistieron · {Object.values(statsServidores).reduce((s,v)=>s+v.faltaron,0)} faltaron</p></div><ClipboardCheck className="w-6 h-6 text-cyan-400"/></div></CardContent>
          </Card>
          <Card className="border-amber-200 bg-amber-50/50 cursor-pointer hover:shadow-md transition-shadow" onClick={()=>setModalAtrasados(true)}>
            <CardContent className="pt-5 pb-4"><div className="flex items-center justify-between"><div><p className="text-xs text-amber-700">Atrasados</p><p className="text-xl font-bold text-amber-700">{statsAtrasados.total}</p><p className="text-[9px] text-red-600">{statsAtrasados.sinGestionar} sin gestionar · {statsAtrasados.total-statsAtrasados.sinGestionar} gestionados</p></div><AlertTriangle className="w-6 h-6 text-amber-400"/></div></CardContent>
          </Card>
          <Card className="border-purple-200 bg-purple-50/50">
            <CardContent className="pt-5 pb-4"><div className="flex items-center justify-between"><div><p className="text-xs text-purple-700">Asistencia al Culto</p><p className="text-xl font-bold text-purple-700">{statsAsistCulto.asistieron}</p><p className="text-[9px] text-purple-600">{statsAsistCulto.faltaron} faltaron · {statsAsistCulto.enSeguimiento} en seguimiento</p>{statsAsistCulto.sinGestionar>0&&<p className="text-[9px] text-red-600">{statsAsistCulto.sinGestionar} sin gestionar</p>}</div><ClipboardCheck className="w-6 h-6 text-purple-400"/></div></CardContent>
          </Card>
        </div>


        {/* ── ACORDEONES ─────────────────────────────────────────────────────── */}
        <div className="space-y-3">

          {/* Estadísticas detalladas */}
          <Card className="overflow-hidden border-indigo-200">
            <button className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors" onClick={()=>setOpenEstadisticas(!openEstadisticas)}>
              <div className="flex items-center gap-3">{openEstadisticas?<ChevronDown className="w-4 h-4 text-gray-500"/>:<ChevronRight className="w-4 h-4 text-gray-500"/>}<span className="text-xl">📊</span><span className="font-semibold text-gray-900">Estadísticas Detalladas</span></div>
            </button>
            {openEstadisticas && (
              <CardContent className="pt-0 pb-6 border-t space-y-6">
                {/* Censos */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2 mt-3"><Users className="w-4 h-4 text-indigo-600"/> Censos <span className="text-[10px] text-amber-600 font-normal">(estado actual de la BD)</span></h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="p-4 bg-indigo-50 rounded-lg border border-indigo-100"><div className="flex items-center gap-1.5 mb-2"><img src={CHURCH.logoUrl} alt="" className="w-4 h-4 object-contain"/><p className="text-xs text-indigo-700 font-semibold">Protocolo</p></div><p className="text-3xl font-bold text-indigo-800">{statsCenso.total}</p><div className="mt-1 space-y-0.5"><div className="flex justify-between text-[10px]"><span className="text-indigo-600">Miembros</span><span className="font-bold">{statsCenso.miembros}</span></div><div className="flex justify-between text-[10px]"><span className="text-indigo-600">Activos</span><span className="font-bold">{statsCenso.activos}</span></div></div></div>
                    <div className="p-4 bg-amber-50 rounded-lg border border-amber-100"><div className="flex items-center gap-1.5 mb-2"><span className="text-sm">👶</span><p className="text-xs text-amber-700 font-semibold">Niños</p></div><p className="text-3xl font-bold text-amber-800">{statsCensoNinos.total}</p><div className="mt-2 space-y-1">{[["Baby",statsCensoNinos.baby,"text-pink-700"],["Kids",statsCensoNinos.kids,"text-blue-700"],["Explores",statsCensoNinos.explores,"text-green-700"],["Champions",statsCensoNinos.champions,"text-purple-700"]].map(([l,v,c])=><div key={l as string} className="flex justify-between text-[10px]"><span className="text-amber-600">{l}</span><span className={`font-bold ${c}`}>{v}</span></div>)}</div></div>
                    <div className="p-4 bg-violet-50 rounded-lg border border-violet-100"><div className="flex items-center gap-1.5 mb-2"><span className="text-sm">👩</span><p className="text-xs text-violet-700 font-semibold">Nuevos Creyentes</p></div><p className="text-3xl font-bold text-violet-800">{statsCensoMdg.total}</p><div className="mt-1 space-y-0.5"><div className="flex justify-between text-[10px]"><span className="text-violet-600">Nuevos creyentes</span><span className="font-bold">{statsCensoMdg.nuevosCreyentes}</span></div><div className="flex justify-between text-[10px]"><span className="text-violet-600">Registr. este mes</span><span className="font-bold">{statsCensoMdg.nuevosMes}</span></div></div></div>
                    <div className="p-4 bg-pink-50 rounded-lg border border-pink-100"><div className="flex items-center gap-1.5 mb-2"><span className="text-sm">🧑‍🤝‍🧑</span><p className="text-xs text-pink-700 font-semibold">Jóvenes</p></div><p className="text-3xl font-bold text-pink-800">{statsCensoJovenes.total}</p><div className="mt-1 space-y-0.5"><div className="flex justify-between text-[10px]"><span className="text-pink-600">Miembros</span><span className="font-bold">{statsCensoJovenes.miembros}</span></div><div className="flex justify-between text-[10px]"><span className="text-pink-600">Nuevos este mes</span><span className="font-bold">{statsCensoJovenes.nuevosMes}</span></div></div></div>
                  </div>
                  <div className="mt-3 p-3 bg-gray-50 rounded-lg border border-gray-200 flex items-center justify-between"><div className="flex items-center gap-2"><img src={CHURCH.logoUrl} alt="" className="w-5 h-5 object-contain"/><span className="text-sm font-semibold text-gray-700">Total {CHURCH.initials}</span></div><span className="text-2xl font-bold text-gray-900">{statsCenso.total+statsCensoMdg.total+statsCensoNinos.total+statsCensoJovenes.total}</span></div>
                </div>

                {/* Registros pastorales */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2"><BookOpen className="w-4 h-4 text-teal-600"/> Registros del Mes</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="p-3 bg-teal-50 rounded-lg border border-teal-100"><p className="text-xs font-semibold text-teal-700 mb-2">Bautizos</p><div className="space-y-1"><div className="flex justify-between text-sm"><span className="text-gray-600">En censo</span><span className="font-bold text-teal-800">{statsBautizos.censoBautizados}</span></div><div className="flex justify-between text-sm"><span className="text-gray-600">Manual total</span><span className="font-bold text-teal-700">{statsBautizos.total}</span></div>{statsBautizos.esteMes>0&&<Badge className="bg-teal-100 text-teal-800 text-[10px]">+{statsBautizos.esteMes} este mes</Badge>}</div></div>
                    <div className="p-3 bg-rose-50 rounded-lg border border-rose-100"><p className="text-xs font-semibold text-rose-700 mb-2">Matrimonios</p><div className="space-y-1"><div className="flex justify-between text-sm"><span className="text-gray-600">En censo</span><span className="font-bold text-rose-800">{statsMatrimonios.censoMatrimonios}</span></div><div className="flex justify-between text-sm"><span className="text-gray-600">Manual total</span><span className="font-bold text-rose-700">{statsMatrimonios.total}</span></div>{statsMatrimonios.esteMes>0&&<Badge className="bg-rose-100 text-rose-800 text-[10px]">+{statsMatrimonios.esteMes} este mes</Badge>}</div></div>
                    <div className="p-3 bg-pink-50 rounded-lg border border-pink-100"><p className="text-xs font-semibold text-pink-700 mb-2 flex items-center gap-1"><UserCheck className="w-3 h-3"/>Presentación de Niños</p><div className="flex justify-between text-sm"><span className="text-gray-600">Total registrados</span><span className="font-bold text-pink-800">{statsPresentaciones.total}</span></div>{statsPresentaciones.esteMes>0&&<Badge className="bg-pink-100 text-pink-800 text-[10px] mt-1">+{statsPresentaciones.esteMes} este mes</Badge>}</div>
                  </div>
                </div>

                {/* Atrasados */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-amber-600"/> Atrasados del Mes</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[["Total",statsAtrasados.total,"bg-amber-50 border-amber-100 text-amber-800"],["Sin Gestionar",statsAtrasados.sinGestionar,"bg-red-50 border-red-100 text-red-800"],["Gestionados",statsAtrasados.total-statsAtrasados.sinGestionar,"bg-green-50 border-green-100 text-green-800"],["% Gestión",`${statsAtrasados.total>0?Math.round(((statsAtrasados.total-statsAtrasados.sinGestionar)/statsAtrasados.total)*100):0}%`,"bg-gray-50 border-gray-200 text-gray-800"]].map(([l,v,c])=>(
                      <div key={l as string} className={`text-center p-3 rounded-lg border ${c}`}><p className="text-[10px] font-medium">{l}</p><p className="text-2xl font-bold">{v}</p></div>
                    ))}
                  </div>
                </div>
              </CardContent>
            )}
          </Card>


          {/* Asistencia Servidores */}
          <Card className="overflow-hidden border-cyan-200">
            <button className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors" onClick={()=>setOpenServidores(!openServidores)}>
              <div className="flex items-center gap-3">{openServidores?<ChevronDown className="w-4 h-4 text-gray-500"/>:<ChevronRight className="w-4 h-4 text-gray-500"/>}<ClipboardCheck className="w-5 h-5 text-cyan-600"/><span className="font-semibold text-gray-900">Asistencia Servidores por Ministerio</span><Badge className="bg-cyan-100 text-cyan-800 text-xs">{Object.values(statsServidores).reduce((s,v)=>s+v.total,0)} registros</Badge></div>
              <div className="text-right text-sm"><span className="font-bold text-green-700">{Object.values(statsServidores).reduce((s,v)=>s+v.asistieron,0)} A</span><span className="mx-1 text-gray-400">·</span><span className="font-bold text-red-700">{Object.values(statsServidores).reduce((s,v)=>s+v.faltaron,0)} F</span></div>
            </button>
            {openServidores && (
              <CardContent className="pt-0 pb-6 border-t"><div className="overflow-x-auto mt-3"><table className="w-full text-xs"><thead><tr className="border-b border-gray-200"><th className="text-left py-2 px-2 text-gray-600">Ministerio</th><th className="text-center py-2 px-1 text-green-700">A</th><th className="text-center py-2 px-1 text-red-700">F</th><th className="text-center py-2 px-1 text-blue-700">J</th><th className="text-center py-2 px-1 text-amber-700">AT</th><th className="text-center py-2 px-1 text-gray-700">Total</th></tr></thead><tbody>{MINISTERIOS_SERVIDORES.map(min=>{const s=statsServidores[min.key]||{total:0,asistieron:0,faltaron:0,justificaron:0,atrasados:0};return(<tr key={min.key} className="border-b border-gray-100 hover:bg-gray-50"><td className="py-1.5 px-2 font-medium">{min.label}</td><td className="text-center py-1.5 px-1"><Badge className="bg-green-100 text-green-800 text-[10px]">{s.asistieron}</Badge></td><td className="text-center py-1.5 px-1"><Badge className="bg-red-100 text-red-800 text-[10px]">{s.faltaron}</Badge></td><td className="text-center py-1.5 px-1"><Badge className="bg-blue-100 text-blue-800 text-[10px]">{s.justificaron}</Badge></td><td className="text-center py-1.5 px-1"><Badge className="bg-amber-100 text-amber-800 text-[10px]">{s.atrasados}</Badge></td><td className="text-center py-1.5 px-1 font-semibold">{s.total}</td></tr>)})}<tr className="border-t-2 border-gray-300 bg-gray-50 font-bold"><td className="py-2 px-2">TOTAL</td><td className="text-center py-2 px-1 text-green-800">{Object.values(statsServidores).reduce((s,v)=>s+v.asistieron,0)}</td><td className="text-center py-2 px-1 text-red-800">{Object.values(statsServidores).reduce((s,v)=>s+v.faltaron,0)}</td><td className="text-center py-2 px-1 text-blue-800">{Object.values(statsServidores).reduce((s,v)=>s+v.justificaron,0)}</td><td className="text-center py-2 px-1 text-amber-800">{Object.values(statsServidores).reduce((s,v)=>s+v.atrasados,0)}</td><td className="text-center py-2 px-1">{Object.values(statsServidores).reduce((s,v)=>s+v.total,0)}</td></tr></tbody></table></div></CardContent>
            )}
          </Card>

          {/* Ingresos acordeón */}
          <Card className="overflow-hidden">
            <button className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors" onClick={()=>setOpenIngresos(!openIngresos)}>
              <div className="flex items-center gap-3">{openIngresos?<ChevronDown className="w-4 h-4 text-gray-500"/>:<ChevronRight className="w-4 h-4 text-gray-500"/>}<TrendingUp className="w-5 h-5 text-green-600"/><span className="font-semibold text-gray-900">Ingresos por Categoría</span><Badge className="bg-green-100 text-green-800 text-xs">{ingresos.length} registros</Badge></div>
              <span className="font-bold text-green-700">${L(totalIngresos)}</span>
            </button>
            {openIngresos && (
              <CardContent className="pt-0 pb-4 border-t"><div className="space-y-2 mt-3">{(Object.entries(ingresosCat) as [string,number][]).sort(([,a],[,b])=>b-a).map(([cat,monto])=><div key={cat} className="flex justify-between py-1.5 border-b border-gray-100 last:border-0"><span className="text-sm text-gray-700">{cat}</span><span className="text-sm font-semibold text-green-700">${L(monto)}</span></div>)}{ingresos.length===0&&<p className="text-sm text-gray-400 text-center py-4">Sin ingresos registrados</p>}</div></CardContent>
            )}
          </Card>

          {/* Egresos acordeón */}
          <Card className="overflow-hidden">
            <button className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors" onClick={()=>setOpenEgresos(!openEgresos)}>
              <div className="flex items-center gap-3">{openEgresos?<ChevronDown className="w-4 h-4 text-gray-500"/>:<ChevronRight className="w-4 h-4 text-gray-500"/>}<TrendingDown className="w-5 h-5 text-red-600"/><span className="font-semibold text-gray-900">Egresos por Categoría</span><Badge className="bg-red-100 text-red-800 text-xs">{egresos.length} registros</Badge></div>
              <span className="font-bold text-red-700">${L(totalEgresos)}</span>
            </button>
            {openEgresos && (
              <CardContent className="pt-0 pb-4 border-t"><div className="space-y-2 mt-3">{(Object.entries(egresosCat) as [string,number][]).sort(([,a],[,b])=>b-a).map(([cat,monto])=><div key={cat} className="flex justify-between py-1.5 border-b border-gray-100 last:border-0"><span className="text-sm text-gray-700">{cat}</span><span className="text-sm font-semibold text-red-700">${L(monto)}</span></div>)}{egresos.length===0&&<p className="text-sm text-gray-400 text-center py-4">Sin egresos registrados</p>}</div></CardContent>
            )}
          </Card>

          {/* Asistencia acordeón */}
          <Card className="overflow-hidden">
            <button className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors" onClick={()=>setOpenAsistencia(!openAsistencia)}>
              <div className="flex items-center gap-3">{openAsistencia?<ChevronDown className="w-4 h-4 text-gray-500"/>:<ChevronRight className="w-4 h-4 text-gray-500"/>}<Users className="w-5 h-5 text-purple-600"/><span className="font-semibold text-gray-900">Asistencia</span><Badge className="bg-purple-100 text-purple-800 text-xs">{asistenciaColumns.length} días</Badge></div>
              <span className="font-bold text-purple-700">{totalAsistencia} personas</span>
            </button>
            {openAsistencia && (
              <CardContent className="pt-0 pb-4 border-t">{asistenciaColumns.length>0?<div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2 mt-3">{asistenciaColumns.map((col:any)=><div key={col.id} className="text-center p-2 bg-purple-50 rounded-lg border border-purple-100"><p className="text-[10px] text-purple-600 font-medium">{col.nombre}</p><p className="text-lg font-bold text-purple-800">{colTotal(col.id)}</p></div>)}</div>:<p className="text-sm text-gray-400 text-center py-4 mt-3">Sin datos de asistencia</p>}</CardContent>
            )}
          </Card>

          {/* Nómina acordeón */}
          <Card className="overflow-hidden">
            <button className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors" onClick={()=>setOpenNomina(!openNomina)}>
              <div className="flex items-center gap-3">{openNomina?<ChevronDown className="w-4 h-4 text-gray-500"/>:<ChevronRight className="w-4 h-4 text-gray-500"/>}<span className="text-xl">💰</span><span className="font-semibold text-gray-900">Nómina</span><Badge className="bg-amber-100 text-amber-800 text-xs">{nominaRecords.length} personas</Badge></div>
              <div className="text-right"><span className="font-bold text-amber-700">${L(totalNomAPagar)}</span><p className="text-[10px] text-green-600">Pagado: ${L(totalNomPagado)}</p></div>
            </button>
            {openNomina && (
              <CardContent className="pt-0 pb-4 border-t">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">{[["Total a pagar",`$${L(totalNomAPagar)}`,"amber"],["Pagado",`$${L(totalNomPagado)}`,"green"],["Pago diario",`$${L(totalPagoDiario)}`,"purple"],["Pendiente",`$${L(totalNomAPagar-totalNomPagado)}`,"red"]].map(([l,v,c])=><div key={l as string} className={`text-center p-3 bg-${c}-50 rounded-lg border border-${c}-100`}><p className={`text-xs text-${c}-600`}>{l}</p><p className={`text-lg font-bold text-${c}-800`}>{v}</p></div>)}</div>
                <div className="mt-4 space-y-1">{nominaRecords.map((r:any,i:number)=><div key={i} className="flex justify-between items-center p-2 bg-amber-50 rounded text-sm"><span className="truncate mr-2">{r.nombre}</span><span className="font-semibold text-amber-700 shrink-0">${L(Number(r.valor_a_pagar||0))}</span></div>)}{nominaRecords.length===0&&<p className="text-sm text-gray-400 text-center py-4">Sin registros de nómina</p>}</div>
              </CardContent>
            )}
          </Card>

          {/* Redil acordeón */}
          <Card className="overflow-hidden border-lime-200">
            <button className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors" onClick={()=>setOpenRedil(!openRedil)}>
              <div className="flex items-center gap-3">{openRedil?<ChevronDown className="w-4 h-4 text-gray-500"/>:<ChevronRight className="w-4 h-4 text-gray-500"/>}<Heart className="w-5 h-5 text-lime-600"/><span className="font-semibold text-gray-900">Redil — Ayuda Social</span><Badge className="bg-lime-100 text-lime-800 text-xs">{statsRedil.totalCasos} casos</Badge></div>
            </button>
            {openRedil && (
              <CardContent className="pt-0 pb-6 border-t">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">{[["Entregados (mes)",statsRedil.entregadosMes,"lime"],["Pendientes",statsRedil.pendientes,"yellow"],["Total casos",statsRedil.totalCasos,"gray"],["Tipos ayuda",Object.keys(statsRedil.porTipo).length,"blue"]].map(([l,v,c])=><div key={l as string} className={`text-center p-3 bg-${c}-50 rounded-lg border border-${c}-100`}><p className={`text-[10px] text-${c}-600 font-medium`}>{l}</p><p className={`text-2xl font-bold text-${c}-800`}>{v}</p></div>)}</div>
                {Object.keys(statsRedil.porTipo).length>0&&<div className="mt-4"><p className="text-xs font-semibold text-gray-700 mb-2">Tipos de ayuda entregados:</p><div className="grid grid-cols-2 sm:grid-cols-4 gap-2">{Object.entries(statsRedil.porTipo).sort(([,a],[,b])=>b-a).map(([tipo,cantidad])=>{const ti=TIPOS_AYUDA_LABELS[tipo]||{label:tipo,icon:"📦"};return(<div key={tipo} className="flex items-center gap-2 p-2 bg-white rounded border border-gray-100"><span className="text-sm">{ti.icon}</span><div><p className="text-[10px] text-gray-600">{ti.label}</p><p className="text-sm font-bold text-gray-800">{cantidad}</p></div></div>)})}</div></div>}
              </CardContent>
            )}
          </Card>

          {/* Cumpleaños acordeón */}
          <Card className="overflow-hidden border-fuchsia-200">
            <button className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors" onClick={()=>setOpenCumpleanos(!openCumpleanos)}>
              <div className="flex items-center gap-3">{openCumpleanos?<ChevronDown className="w-4 h-4 text-gray-500"/>:<ChevronRight className="w-4 h-4 text-gray-500"/>}<Cake className="w-5 h-5 text-fuchsia-600"/><span className="font-semibold text-gray-900">Cumpleaños del Mes</span><Badge className="bg-fuchsia-100 text-fuchsia-800 text-xs">{statsCumpleanos.totalMes} personas</Badge></div>
            </button>
            {openCumpleanos && (
              <CardContent className="pt-0 pb-6 border-t">
                <div className="grid grid-cols-3 gap-3 mt-3">{[["Total",statsCumpleanos.totalMes,"fuchsia"],["Felicitados",statsCumpleanos.enviados,"green"],["Pendientes",statsCumpleanos.pendientesEnvio,"orange"]].map(([l,v,c])=><div key={l as string} className={`text-center p-3 bg-${c}-50 rounded-lg border border-${c}-100`}><p className={`text-[10px] text-${c}-600 font-medium`}>{l}</p><p className={`text-2xl font-bold text-${c}-800`}>{v}</p></div>)}</div>
                {statsCumpleanos.totalMes>0&&<div className="mt-4"><div className="flex justify-between text-[10px] text-gray-600 mb-1"><span>Progreso</span><span>{Math.round((statsCumpleanos.enviados/statsCumpleanos.totalMes)*100)}%</span></div><div className="w-full bg-gray-200 rounded-full h-2"><div className="bg-fuchsia-500 h-2 rounded-full" style={{width:`${(statsCumpleanos.enviados/statsCumpleanos.totalMes)*100}%`}}/></div></div>}
              </CardContent>
            )}
          </Card>

          {/* Eventos acordeón */}
          <Card className="overflow-hidden border-violet-200">
            <button className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors" onClick={()=>setOpenEventos(!openEventos)}>
              <div className="flex items-center gap-3">{openEventos?<ChevronDown className="w-4 h-4 text-gray-500"/>:<ChevronRight className="w-4 h-4 text-gray-500"/>}<CalendarDays className="w-5 h-5 text-violet-600"/><span className="font-semibold text-gray-900">Eventos / Encuentro</span><Badge className="bg-violet-100 text-violet-800 text-xs">{statsEventos.reduce((s,e)=>s+e.inscritos,0)} inscritos en el mes</Badge></div>
            </button>
            {openEventos && (
              <CardContent className="pt-0 pb-6 border-t">{statsEventos.length===0?<p className="text-sm text-gray-400 text-center py-4 mt-3">Sin participantes registrados en eventos este mes</p>:<div className="space-y-3 mt-3">{statsEventos.map(ev=><div key={ev.id} className="p-3 bg-violet-50 rounded-lg border border-violet-100"><div className="flex justify-between mb-2"><p className="text-xs font-semibold text-violet-700">{ev.nombre}</p><Badge className="bg-violet-200 text-violet-900 text-[10px]">{ev.inscritos} inscritos</Badge></div><div className="grid grid-cols-2 sm:grid-cols-4 gap-2">{[["Inscritos",ev.inscritos,"violet"],["Pagado",ev.pagadosCompleto,"green"],["Pendiente",ev.pendientesPago,"orange"],["Recaudado",`$${L(ev.totalRecaudado)}`,"emerald"]].map(([l,v,c])=><div key={l as string} className="text-center"><p className={`text-lg font-bold text-${c}-700`}>{v}</p><p className="text-[9px] text-gray-500">{l}</p></div>)}{ev.totalValor>0&&<div className="col-span-full mt-1"><div className="w-full bg-gray-200 rounded-full h-1.5"><div className="bg-violet-500 h-1.5 rounded-full" style={{width:`${Math.min((ev.totalRecaudado/ev.totalValor)*100,100)}%`}}/></div><p className="text-[9px] text-gray-400 text-right mt-0.5">{Math.round((ev.totalRecaudado/ev.totalValor)*100)}% recaudado</p></div>}</div></div>)}</div>}
              </CardContent>
            )}
          </Card>

          {/* Proyecto Mario acordeón */}
          <Card className="overflow-hidden border-orange-200">
            <button className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors" onClick={()=>setOpenProyectoMario(!openProyectoMario)}>
              <div className="flex items-center gap-3">{openProyectoMario?<ChevronDown className="w-4 h-4 text-gray-500"/>:<ChevronRight className="w-4 h-4 text-gray-500"/>}<Palette className="w-5 h-5 text-orange-600"/><span className="font-semibold text-gray-900">Proyecto Mario <span className="text-[10px] text-amber-600 font-normal">(ciclos activos actuales)</span></span><Badge className="bg-orange-100 text-orange-800 text-xs">{Object.values(statsProyectoMario).reduce((s,v)=>s+v.inscritos,0)} inscritos</Badge></div>
            </button>
            {openProyectoMario && (
              <CardContent className="pt-0 pb-6 border-t"><div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-3">{(Object.keys(PROYECTO_MARIO_CICLO_CONFIG) as ProyectoMarioCicloTipo[]).map(tipo=>{const s=statsProyectoMario[tipo];const cfg=PROYECTO_MARIO_CICLO_CONFIG[tipo];return(<div key={tipo} className="p-3 bg-orange-50 rounded-lg border border-orange-100"><p className="text-xs font-semibold text-orange-700 mb-2">{cfg.label}</p>{s.inscritos>0?<div className="space-y-1.5"><div className="flex justify-between"><span className="text-[10px] text-gray-600">Inscritos</span><span className="text-sm font-bold text-orange-800">{s.inscritos}</span></div><div className="flex justify-between"><span className="text-[10px] text-gray-600">Última clase</span><span className="text-sm font-medium">#{s.ultimaClase} de {cfg.totalClases}</span></div>{s.ultimaClase>0&&<><div className="flex justify-between"><span className="text-[10px] text-green-600">Asistieron</span><Badge className="bg-green-100 text-green-800 text-xs">{s.asistieron}</Badge></div><div className="flex justify-between"><span className="text-[10px] text-red-600">Faltaron</span><Badge className="bg-red-100 text-red-800 text-xs">{s.faltaron}</Badge></div><div className="w-full bg-gray-200 rounded-full h-1.5 mt-1"><div className="bg-orange-500 h-1.5 rounded-full" style={{width:`${(s.ultimaClase/cfg.totalClases)*100}%`}}/></div><p className="text-[9px] text-gray-400 text-right">{Math.round((s.ultimaClase/cfg.totalClases)*100)}% completado</p></>}</div>:<p className="text-xs text-gray-400 text-center py-3">Sin ciclo activo</p>}</div>)})}</div></CardContent>
            )}
          </Card>

        </div>{/* fin acordeones */}


        {/* ── MODALES ──────────────────────────────────────────────────────── */}

        {/* Modal Ingresos */}
        <Dialog open={modalIngresos} onOpenChange={setModalIngresos}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader><DialogTitle className="flex items-center gap-2 text-green-700"><TrendingUp className="w-5 h-5"/>Ingresos — {selectedMonth.name}</DialogTitle><DialogDescription>Total: ${L(totalIngresos)} · {ingresos.length} registros</DialogDescription></DialogHeader>
            <div className="space-y-3">{ingresos.map((ing,i)=><div key={i} className="p-3 bg-green-50 rounded border border-green-100"><div className="flex justify-between items-start"><div className="flex-1"><p className="text-sm font-semibold text-green-800">{ing.detalle||ing.categoria_principal||"Sin detalle"}</p><p className="text-xs text-green-600 mt-0.5">{ing.ministerio||"Sin ministerio"}</p>{ing.observacion&&<p className="text-xs text-gray-500 mt-1 italic">{ing.observacion}</p>}</div><div className="text-right ml-3"><p className="font-bold text-green-700">${L(Number(ing.monto||0))}</p><p className="text-xs text-gray-500">{ing.fecha}</p></div></div></div>)}{ingresos.length===0&&<p className="text-center text-gray-500 py-4">No hay ingresos registrados</p>}</div>
            <div className="mt-2 p-3 bg-green-50 rounded flex justify-between font-bold"><span>Células + Alfolí</span><span className="text-green-700">${L(totalCelulas+totalAlfoli)}</span></div>
          </DialogContent>
        </Dialog>

        {/* Modal Egresos */}
        <Dialog open={modalEgresos} onOpenChange={setModalEgresos}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader><DialogTitle className="flex items-center gap-2 text-red-700"><TrendingDown className="w-5 h-5"/>Egresos — {selectedMonth.name}</DialogTitle><DialogDescription>Total: ${L(totalEgresos)} · {egresos.length} registros</DialogDescription></DialogHeader>
            <div className="space-y-3">{egresos.map((eg,i)=><div key={i} className="p-3 bg-red-50 rounded border border-red-100"><div className="flex justify-between items-start"><div className="flex-1"><p className="text-sm font-semibold text-red-800">{eg.detalle||eg.categoria_principal||"Sin detalle"}</p><p className="text-xs text-red-600 mt-0.5">{eg.ministerio||"Sin ministerio"}</p>{eg.observacion&&<p className="text-xs text-gray-500 mt-1 italic">{eg.observacion}</p>}</div><div className="text-right ml-3"><p className="font-bold text-red-700">${L(Number(eg.monto||0))}</p><p className="text-xs text-gray-500">{eg.fecha}</p></div></div></div>)}{egresos.length===0&&<p className="text-center text-gray-500 py-4">No hay egresos registrados</p>}</div>
          </DialogContent>
        </Dialog>

        {/* Modal Nómina */}
        <Dialog open={modalNomina} onOpenChange={setModalNomina}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader><DialogTitle className="flex items-center gap-2 text-amber-700"><DollarSign className="w-5 h-5"/>Nómina — {selectedMonth.name}</DialogTitle><DialogDescription>A pagar: ${L(totalNomAPagar)} · Pagado: ${L(totalNomPagado)}</DialogDescription></DialogHeader>
            <div className="space-y-2">{nominaRecords.map((nom,i)=><div key={i} className="flex justify-between items-center p-3 bg-amber-50 rounded border border-amber-100"><div><p className="text-sm font-medium">{nom.nombre}</p><p className="text-xs text-gray-500">{nom.cargo||""}</p></div><div className="text-right"><p className="font-semibold text-amber-700">${L(Number(nom.valor_a_pagar||0))}</p><p className="text-xs text-gray-500">{nom.primera_quincena_pagada&&nom.segunda_quincena_pagada?"Pagado completo":nom.primera_quincena_pagada?"1ra pagada":nom.segunda_quincena_pagada?"2da pagada":"Pendiente"}</p></div></div>)}{nominaRecords.length===0&&<p className="text-center text-gray-500 py-4">Sin registros de nómina</p>}</div>
          </DialogContent>
        </Dialog>

        {/* Modal Asistencia */}
        <Dialog open={modalAsistencia} onOpenChange={setModalAsistencia}>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
            <DialogHeader><DialogTitle className="flex items-center gap-2 text-purple-700"><Users className="w-5 h-5"/>Asistencia — {selectedMonth.name}</DialogTitle><DialogDescription>Total: {totalAsistencia} · {asistenciaColumns.length} días · Prom: {asistenciaColumns.length>0?Math.round(totalAsistencia/asistenciaColumns.length):0}/día</DialogDescription></DialogHeader>
            {asistenciaDetails.length>0?<div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b"><th className="text-left p-2">Detalle</th>{asistenciaColumns.map((col:any)=><th key={col.id} className="text-center p-2">{col.nombre}</th>)}<th className="text-center p-2 bg-gray-50">Total</th></tr></thead><tbody>{asistenciaDetails.map((row:any)=>{const rowTotal=asistenciaColumns.reduce((s:number,col:any)=>{const v=asistenciaData.find((d:any)=>d.fila_id===row.id&&d.columna_id===col.id);return s+(v?.valor||0)},0);return(<tr key={row.id} className="border-b hover:bg-gray-50"><td className="p-2 font-medium">{row.nombre}</td>{asistenciaColumns.map((col:any)=>{const v=asistenciaData.find((d:any)=>d.fila_id===row.id&&d.columna_id===col.id);return(<td key={col.id} className="text-center p-2 font-semibold">{v?.valor||0}</td>)})}<td className="text-center p-2 font-bold bg-gray-50">{rowTotal}</td></tr>)})}</tbody></table></div>:<p className="text-center text-gray-500 py-4">Sin datos de asistencia</p>}
          </DialogContent>
        </Dialog>


        {/* Modal Total Miembros */}
        <Dialog open={modalTotalMiembros} onOpenChange={setModalTotalMiembros}>
          <DialogContent className="max-w-lg"><DialogHeader><DialogTitle className="flex items-center gap-2 text-indigo-700"><img src={CHURCH.logoUrl} alt="" className="w-5 h-5"/>Total Miembros {CHURCH.initials}</DialogTitle><DialogDescription>Suma de todos los censos (estado actual)</DialogDescription></DialogHeader>
          <div className="space-y-3">{[["Censo Protocolo",statsCenso.total,"indigo"],["Censo Niños",statsCensoNinos.total,"amber"],["Censo Jóvenes",statsCensoJovenes.total,"pink"],["Censo MDG / Nuevos Creyentes",statsCensoMdg.total,"violet"]].map(([l,v,c])=><div className={`flex justify-between p-3 bg-${c}-50 rounded`}><span>{l}</span><span className={`font-bold text-${c}-700`}>{v}</span></div>)}<div className="flex justify-between p-4 bg-indigo-100 rounded-lg border-2 border-indigo-300"><span className="font-bold">TOTAL {CHURCH.initials}</span><span className="font-bold text-xl text-indigo-800">{statsCenso.total+statsCensoMdg.total+statsCensoNinos.total+statsCensoJovenes.total}</span></div></div>
          </DialogContent>
        </Dialog>

        {/* Modal Censo Niños */}
        <Dialog open={modalCensoNinos} onOpenChange={setModalCensoNinos}>
          <DialogContent className="max-w-lg"><DialogHeader><DialogTitle className="flex items-center gap-2 text-amber-700">👶 Censo Niños</DialogTitle><DialogDescription>Total: {statsCensoNinos.total} niños (estado actual)</DialogDescription></DialogHeader>
          <div className="space-y-3">{[["Baby (0-2 años)",statsCensoNinos.baby,"pink"],["Kids (3-5 años)",statsCensoNinos.kids,"blue"],["Explores (6-8 años)",statsCensoNinos.explores,"green"],["Champions (9-11 años)",statsCensoNinos.champions,"purple"]].map(([l,v,c])=><div className={`flex justify-between p-3 bg-${c}-50 rounded`}><span>{l}</span><span className={`font-bold text-${c}-700`}>{v}</span></div>)}</div>
          </DialogContent>
        </Dialog>

        {/* Modal Censo Jóvenes */}
        <Dialog open={modalCensoJovenes} onOpenChange={setModalCensoJovenes}>
          <DialogContent className="max-w-lg"><DialogHeader><DialogTitle className="flex items-center gap-2 text-pink-700">🧑‍🤝‍🧑 Censo Jóvenes</DialogTitle><DialogDescription>Total: {statsCensoJovenes.total} jóvenes (estado actual)</DialogDescription></DialogHeader>
          <div className="space-y-3">{[["Total",statsCensoJovenes.total,"pink"],["Miembros",statsCensoJovenes.miembros,"pink"],["Activos",statsCensoJovenes.activos,"blue"],["Nuevos creyentes",statsCensoJovenes.nuevos,"green"],["Primera vez iglesia",statsCensoJovenes.primeraVez,"violet"],["Nuevos este mes",statsCensoJovenes.nuevosMes,"amber"]].map(([l,v,c])=><div className={`flex justify-between p-3 bg-${c}-50 rounded`}><span>{l}</span><span className={`font-bold text-${c}-700`}>{v}</span></div>)}</div>
          </DialogContent>
        </Dialog>

        {/* Modal Nuevos Creyentes */}
        <Dialog open={modalNuevosCreyentes} onOpenChange={setModalNuevosCreyentes}>
          <DialogContent className="max-w-lg"><DialogHeader><DialogTitle className="flex items-center gap-2 text-violet-700">✨ Nuevos Creyentes (MDG)</DialogTitle><DialogDescription>Total: {statsCensoMdg.total} personas (estado actual)</DialogDescription></DialogHeader>
          <div className="space-y-3">{[["Total personas",statsCensoMdg.total,"violet"],["Miembros",statsCensoMdg.miembros,"green"],["Activos",statsCensoMdg.activos,"blue"],["Nuevos creyentes",statsCensoMdg.nuevosCreyentes,"violet"],["Registrados este mes",statsCensoMdg.nuevosMes,"amber"]].map(([l,v,c])=><div className={`flex justify-between p-3 bg-${c}-50 rounded`}><span>{l}</span><span className={`font-bold text-${c}-700`}>{v}</span></div>)}</div>
          </DialogContent>
        </Dialog>

        {/* Modal Discipulado */}
        <Dialog open={modalDiscipulado} onOpenChange={setModalDiscipulado}>
          <DialogContent className="max-w-lg"><DialogHeader><DialogTitle className="flex items-center gap-2 text-sky-700"><GraduationCap className="w-5 h-5"/>Discipulado (ciclos activos)</DialogTitle><DialogDescription>Estado actual de los ciclos activos</DialogDescription></DialogHeader>
          <div className="space-y-3">{(Object.keys(CICLO_CONFIG) as CicloTipo[]).map(tipo=><div key={tipo} className="p-3 bg-sky-50 rounded-lg border border-sky-100"><p className="text-sm font-semibold text-sky-700 mb-2">{CICLO_CONFIG[tipo].label}</p>{statsDiscipulado[tipo].inscritos>0?<div className="grid grid-cols-2 gap-2">{[["Inscritos",statsDiscipulado[tipo].inscritos,"sky"],["Aprobados",statsDiscipulado[tipo].aprobados,"green"],["En curso",statsDiscipulado[tipo].enCurso,"gray"],["Reprobados",statsDiscipulado[tipo].reprobados,"red"]].map(([l,v,c])=><div key={l as string} className="text-center"><p className={`text-xl font-bold text-${c}-700`}>{v}</p><p className="text-[10px] text-gray-500">{l}</p></div>)}</div>:<p className="text-xs text-gray-400 text-center py-2">Sin ciclo activo</p>}</div>)}</div>
          </DialogContent>
        </Dialog>

        {/* Modal Bautizos */}
        <Dialog open={modalBautizos} onOpenChange={setModalBautizos}>
          <DialogContent className="max-w-lg"><DialogHeader><DialogTitle className="flex items-center gap-2 text-teal-700">Bautizos — {selectedMonth.name}</DialogTitle></DialogHeader>
          <div className="space-y-3"><div className="flex justify-between p-3 bg-teal-50 rounded"><span>En censos (P+MDG)</span><span className="font-bold text-teal-700">{statsBautizos.censoBautizados}</span></div><div className="flex justify-between p-3 bg-blue-50 rounded"><span>Registro manual total</span><span className="font-bold text-blue-700">{statsBautizos.total}</span></div><div className="flex justify-between p-3 bg-green-50 rounded"><span>Realizados este mes</span><span className="font-bold text-green-700">{statsBautizos.esteMes}</span></div></div>
          </DialogContent>
        </Dialog>

        {/* Modal Matrimonios */}
        <Dialog open={modalMatrimonios} onOpenChange={setModalMatrimonios}>
          <DialogContent className="max-w-lg"><DialogHeader><DialogTitle className="flex items-center gap-2 text-rose-700">Matrimonios — {selectedMonth.name}</DialogTitle></DialogHeader>
          <div className="space-y-3"><div className="flex justify-between p-3 bg-rose-50 rounded"><span>En censos (P+MDG)</span><span className="font-bold text-rose-700">{statsMatrimonios.censoMatrimonios}</span></div><div className="flex justify-between p-3 bg-blue-50 rounded"><span>Registro manual total</span><span className="font-bold text-blue-700">{statsMatrimonios.total}</span></div><div className="flex justify-between p-3 bg-green-50 rounded"><span>Realizados este mes</span><span className="font-bold text-green-700">{statsMatrimonios.esteMes}</span></div></div>
          </DialogContent>
        </Dialog>

        {/* Modal Células */}
        <Dialog open={modalCelulas} onOpenChange={setModalCelulas}>
          <DialogContent className="max-w-lg"><DialogHeader><DialogTitle className="flex items-center gap-2 text-emerald-700"><Home className="w-5 h-5"/>Células — {selectedMonth.name}</DialogTitle></DialogHeader>
          <div className="space-y-3"><div className="flex justify-between p-3 bg-emerald-50 rounded"><span>Miembros activos (censos)</span><span className="font-bold text-emerald-700">{statsCelulas.totalMiembros}</span></div><div className="flex justify-between p-3 bg-green-50 rounded"><span>Asistencias registradas en el mes</span><span className="font-bold text-green-700">{statsCelulas.asistieronMes}</span></div></div>
          </DialogContent>
        </Dialog>

        {/* Modal Atrasados */}
        <Dialog open={modalAtrasados} onOpenChange={setModalAtrasados}>
          <DialogContent className="max-w-lg"><DialogHeader><DialogTitle className="flex items-center gap-2 text-amber-700"><AlertTriangle className="w-5 h-5"/>Atrasados — {selectedMonth.name}</DialogTitle><DialogDescription>Registros de atrasos durante el mes</DialogDescription></DialogHeader>
          <div className="grid grid-cols-2 gap-3">{[["Total",statsAtrasados.total,"amber"],["Sin gestionar",statsAtrasados.sinGestionar,"red"],["Gestionados",statsAtrasados.total-statsAtrasados.sinGestionar,"green"],["% Gestión",`${statsAtrasados.total>0?Math.round(((statsAtrasados.total-statsAtrasados.sinGestionar)/statsAtrasados.total)*100):0}%`,"gray"]].map(([l,v,c])=><div key={l as string} className={`text-center p-3 bg-${c}-50 rounded-lg border border-${c}-100`}><p className={`text-[10px] text-${c}-600 font-medium`}>{l}</p><p className={`text-2xl font-bold text-${c}-800`}>{v}</p></div>)}</div>
          </DialogContent>
        </Dialog>

        {/* Modal Redil */}
        <Dialog open={modalRedil} onOpenChange={setModalRedil}>
          <DialogContent className="max-w-lg"><DialogHeader><DialogTitle className="flex items-center gap-2 text-lime-700"><Heart className="w-5 h-5"/>Redil — {selectedMonth.name}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3 mb-4">{[["Entregados (mes)",statsRedil.entregadosMes,"lime"],["Pendientes",statsRedil.pendientes,"yellow"],["Total casos",statsRedil.totalCasos,"gray"],["Tipos de ayuda",Object.keys(statsRedil.porTipo).length,"blue"]].map(([l,v,c])=><div key={l as string} className={`text-center p-3 bg-${c}-50 rounded-lg border border-${c}-100`}><p className={`text-[10px] text-${c}-600 font-medium`}>{l}</p><p className={`text-2xl font-bold text-${c}-800`}>{v}</p></div>)}</div>
          {Object.keys(statsRedil.porTipo).length>0&&<div><p className="text-xs font-semibold text-gray-700 mb-2">Tipos entregados este mes:</p><div className="space-y-1">{Object.entries(statsRedil.porTipo).sort(([,a],[,b])=>b-a).map(([tipo,cantidad])=>{const ti=TIPOS_AYUDA_LABELS[tipo]||{label:tipo,icon:"📦"};return(<div key={tipo} className="flex items-center justify-between p-2 bg-white rounded border border-gray-100"><div className="flex items-center gap-2"><span>{ti.icon}</span><span className="text-sm text-gray-700">{ti.label}</span></div><span className="font-bold text-gray-800">{cantidad}</span></div>)})}</div></div>}
          </DialogContent>
        </Dialog>

        {/* Modal Cumpleaños */}
        <Dialog open={modalCumpleanos} onOpenChange={setModalCumpleanos}>
          <DialogContent className="max-w-lg"><DialogHeader><DialogTitle className="flex items-center gap-2 text-fuchsia-700"><Cake className="w-5 h-5"/>Cumpleaños — {selectedMonth.name}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-3 gap-3">{[["Total",statsCumpleanos.totalMes,"fuchsia"],["Felicitados",statsCumpleanos.enviados,"green"],["Pendientes",statsCumpleanos.pendientesEnvio,"orange"]].map(([l,v,c])=><div key={l as string} className={`text-center p-3 bg-${c}-50 rounded-lg border border-${c}-100`}><p className={`text-[10px] text-${c}-600 font-medium`}>{l}</p><p className={`text-2xl font-bold text-${c}-800`}>{v}</p></div>)}</div>
          {statsCumpleanos.totalMes>0&&<div className="mt-4"><div className="flex justify-between text-[10px] text-gray-600 mb-1"><span>Progreso</span><span>{Math.round((statsCumpleanos.enviados/statsCumpleanos.totalMes)*100)}%</span></div><div className="w-full bg-gray-200 rounded-full h-2"><div className="bg-fuchsia-500 h-2 rounded-full" style={{width:`${(statsCumpleanos.enviados/statsCumpleanos.totalMes)*100}%`}}/></div></div>}
          </DialogContent>
        </Dialog>

        {/* Modal Eventos */}
        <Dialog open={modalEventos} onOpenChange={setModalEventos}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto"><DialogHeader><DialogTitle className="flex items-center gap-2 text-violet-700"><CalendarDays className="w-5 h-5"/>Eventos — {selectedMonth.name}</DialogTitle><DialogDescription>Participantes registrados durante el mes</DialogDescription></DialogHeader>
          {statsEventos.length===0?<p className="text-center text-gray-500 py-4">Sin participantes registrados en eventos este mes</p>:<div className="space-y-4">{statsEventos.map(ev=><div key={ev.id} className="p-3 bg-violet-50 rounded-lg border border-violet-100"><div className="flex justify-between mb-3"><p className="font-semibold text-violet-700">{ev.nombre}</p><Badge className="bg-violet-200 text-violet-900">{ev.inscritos} inscritos</Badge></div><div className="grid grid-cols-2 sm:grid-cols-4 gap-3">{[["Inscritos",ev.inscritos,"violet"],["Pagado",ev.pagadosCompleto,"green"],["Pendiente",ev.pendientesPago,"orange"],["Recaudado",`$${L(ev.totalRecaudado)}`,"emerald"]].map(([l,v,c])=><div key={l as string} className="text-center"><p className={`text-xl font-bold text-${c}-700`}>{v}</p><p className="text-[10px] text-gray-500">{l}</p></div>)}</div></div>)}</div>}
          </DialogContent>
        </Dialog>

        {/* Modal Servidores */}
        <Dialog open={modalServidores} onOpenChange={setModalServidores}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto"><DialogHeader><DialogTitle className="flex items-center gap-2 text-cyan-700"><ClipboardCheck className="w-5 h-5"/>Asistencia Servidores — {selectedMonth.name}</DialogTitle></DialogHeader>
          <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b"><th className="text-left p-2">Ministerio</th><th className="text-center p-2 text-green-700">A</th><th className="text-center p-2 text-red-700">F</th><th className="text-center p-2 text-blue-700">J</th><th className="text-center p-2 text-amber-700">AT</th><th className="text-center p-2">Total</th></tr></thead><tbody>{MINISTERIOS_SERVIDORES.map(min=>{const s=statsServidores[min.key]||{total:0,asistieron:0,faltaron:0,justificaron:0,atrasados:0};return(<tr key={min.key} className="border-b hover:bg-gray-50"><td className="p-2 font-medium">{min.label}</td><td className="text-center p-2"><Badge className="bg-green-100 text-green-800">{s.asistieron}</Badge></td><td className="text-center p-2"><Badge className="bg-red-100 text-red-800">{s.faltaron}</Badge></td><td className="text-center p-2"><Badge className="bg-blue-100 text-blue-800">{s.justificaron}</Badge></td><td className="text-center p-2"><Badge className="bg-amber-100 text-amber-800">{s.atrasados}</Badge></td><td className="text-center p-2 font-semibold">{s.total}</td></tr>)})}<tr className="border-t-2 border-gray-300 bg-gray-50 font-bold"><td className="p-2">TOTAL</td><td className="text-center p-2 text-green-800">{Object.values(statsServidores).reduce((s,v)=>s+v.asistieron,0)}</td><td className="text-center p-2 text-red-800">{Object.values(statsServidores).reduce((s,v)=>s+v.faltaron,0)}</td><td className="text-center p-2 text-blue-800">{Object.values(statsServidores).reduce((s,v)=>s+v.justificaron,0)}</td><td className="text-center p-2 text-amber-800">{Object.values(statsServidores).reduce((s,v)=>s+v.atrasados,0)}</td><td className="text-center p-2">{Object.values(statsServidores).reduce((s,v)=>s+v.total,0)}</td></tr></tbody></table></div>
          </DialogContent>
        </Dialog>

        {/* Modal Proyecto Mario */}
        <Dialog open={modalProyectoMario} onOpenChange={setModalProyectoMario}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto"><DialogHeader><DialogTitle className="flex items-center gap-2 text-orange-700"><Palette className="w-5 h-5"/>Proyecto Mario (ciclos activos)</DialogTitle></DialogHeader>
          <div className="space-y-3">{(Object.keys(PROYECTO_MARIO_CICLO_CONFIG) as ProyectoMarioCicloTipo[]).map(tipo=>{const s=statsProyectoMario[tipo];const cfg=PROYECTO_MARIO_CICLO_CONFIG[tipo];return(<div key={tipo} className="p-3 bg-orange-50 rounded-lg border border-orange-100"><p className="text-sm font-semibold text-orange-700 mb-2">{cfg.label}</p>{s.inscritos>0?<div className="grid grid-cols-2 sm:grid-cols-4 gap-2">{[["Inscritos",s.inscritos,"orange"],["Última clase",`#${s.ultimaClase}/${cfg.totalClases}`,"gray"],["Asistieron",s.asistieron,"green"],["Faltaron",s.faltaron,"red"]].map(([l,v,c])=><div key={l as string} className="text-center"><p className={`text-xl font-bold text-${c}-700`}>{v}</p><p className="text-[10px] text-gray-500">{l}</p></div>)}</div>:<p className="text-xs text-gray-400 text-center py-2">Sin ciclo activo</p>}</div>)})}</div>
          </DialogContent>
        </Dialog>

      </main>
    </div>
  )
}
