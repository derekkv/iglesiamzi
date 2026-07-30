import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error(
    "Faltan variables de entorno de Supabase en el servidor: define SUPABASE_URL y SUPABASE_SERVICE_KEY en tu archivo .env.local",
  )
}

export const supabaseServer = createClient(supabaseUrl, supabaseServiceKey)
