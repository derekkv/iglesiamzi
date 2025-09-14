import { createClient } from "@supabase/supabase-js"

const supabaseUrl = "https://fuvheqqdprwnujitprsl.supabase.co"
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ1dmhlcXFkcHJ3bnVqaXRwcnNsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY3ODM5MzEsImV4cCI6MjA3MjM1OTkzMX0.TJKXqa5odMqXlhIqmWrQsaL8FRTMHz6kyDX3yDsAInQ"

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
