import { createClient } from "@supabase/supabase-js"

const supabaseUrl = "https://backiglesia.mzipet.com"
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzgyOTU5NTM1LCJleHAiOjE5NDA2Mzk1MzV9.s_Np7AI-RtfyXZm279OO7mByV-CnNzWoNI8qcX8E0v8"

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
})
