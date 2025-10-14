import { createClient } from "@supabase/supabase-js"

const supabaseUrl = "http://31.97.99.102:8000"
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlhdCI6MTc2MDEzMDkzNCwiZXhwIjoyMDc1NzA2OTM0LCJpc3MiOiJzdXBhYmFzZS1kZW1vIn0.naTzXPohWMYyFR-3AjOty4U6pIi-CiD7KIbngMCyHDE"

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
