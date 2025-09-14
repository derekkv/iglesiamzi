import { notFound } from "next/navigation"
import {
  getMesById,
  getIngresosByMes,
  getEgresosByMes,
  getDiscipuladoData,
  getAsistenciaData,
  getDiezmosByMes,
} from "@/lib/database"
import { MesViewClient } from "./mes-view-client"

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function MesViewPage({ params }: PageProps) {
  const { id } = await params

  try {
    const [mes, ingresos, egresos, diezmos, discipuladoData, asistenciaData] = await Promise.all([
      getMesById(id),
      getIngresosByMes(id),
      getEgresosByMes(id),
      getDiezmosByMes(id),
      getDiscipuladoData(id),
      getAsistenciaData(id),
    ])

    // Transform data to match the expected format
    const monthData = {
      id: mes.id,
      name: mes.name,
      year: mes.year,
      month: mes.month,
      status: mes.status,
      data: {
        ingresos: ingresos.map((ingreso) => ({
          id: ingreso.id,
          tipo: "Ingreso",
          fecha: ingreso.fecha,
          valor: Number(ingreso.monto),
          ministerio: ingreso.ministerio || "",
          categoria: ingreso.categoria_principal || "",
          detalle: ingreso.detalle || "",
          observacion: ingreso.observacion || "",
          estado: ingreso.estado || "Procesado",
        })),
        egresos: egresos.map((egreso) => ({
          id: egreso.id,
          tipo: "Egreso",
          fecha: egreso.fecha,
          valor: Number(egreso.monto),
          ministerio: egreso.ministerio || "",
          categoria: egreso.categoria_principal || "",
          detalle: egreso.detalle || "",
          observacion: egreso.observacion || "",
          estado: egreso.estado || "Procesado",
        })),
        diezmos: diezmos.map((diezmo) => ({
          id: diezmo.id,
          numero: diezmo.numero,
          fecha: diezmo.fecha,
          donador: diezmo.donador,
          valor: Number(diezmo.valor),
        })),
        discipulado: {
          dates: discipuladoData.fechas.map((f) => f.fecha),
          participants: discipuladoData.participantes.map((p) => ({
            id: p.id,
            name: p.name,
          })),
          attendance: discipuladoData.asistencia.map((a) => ({
            participantId: a.participante_id,
            date: discipuladoData.fechas.find((f) => f.id === a.fecha_id)?.fecha || "",
            status: a.estado,
          })),
        },
        asistencia: {
          details: asistenciaData.detalles.map((d) => ({
            id: d.id,
            name: d.nombre,
          })),
          columns: asistenciaData.columnas.map((c) => ({
            id: c.id,
            name: c.nombre,
          })),
          data: asistenciaData.datos.map((d) => ({
            detailId: d.detalle_id,
            columnId: d.columna_id,
            value: d.valor,
          })),
        },
      },
    }

    return <MesViewClient selectedMonth={monthData} />
  } catch (error) {
    console.error("Error loading month data:", error)
    notFound()
  }
}
