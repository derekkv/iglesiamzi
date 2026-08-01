import { notFound } from "next/navigation"
import { createClient } from "@supabase/supabase-js"
import { MesViewClient } from "./mes-view-client"

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function MesViewPage({ params }: PageProps) {
  const { id } = await params

  const { data: mes, error } = await supabase
    .from("meses")
    .select("id, name, year, month, status, start_date, end_date")
    .eq("id", id)
    .maybeSingle()

  if (error || !mes) notFound()

  return (
    <MesViewClient
      selectedMonth={{
        id:         mes.id,
        name:       mes.name,
        year:       mes.year,
        month:      mes.month,
        status:     mes.status,
        start_date: mes.start_date,
        end_date:   mes.end_date,
      }}
    />
  )
}
