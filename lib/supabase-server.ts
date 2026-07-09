/**
 * Server-only Supabase client using service_role key.
 * Use ONLY in server actions ("use server") and API routes.
 * NEVER import this in client components.
 */
import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.SUPABASE_URL || "https://servidor.iglesiaregalodedios.com"
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!

export const supabaseServer = createClient(supabaseUrl, supabaseServiceKey)
