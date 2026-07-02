"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/contexts/auth-context"

/**
 * Hook para verificar si el usuario actual tiene acceso a un módulo restringido.
 * Los módulos restringidos se controlan desde la tabla `acceso_restringido`.
 * 
 * Uso:
 *   const { hasAccess, loading } = useRestrictedAccess("nomina")
 *   if (!hasAccess) return null
 */
export function useRestrictedAccess(modulo: string) {
  const { user } = useAuth()
  const [hasAccess, setHasAccess] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const check = async () => {
      if (!user?.id) {
        setHasAccess(false)
        setLoading(false)
        return
      }

      try {
        const { data, error } = await supabase
          .from("acceso_restringido")
          .select("id")
          .eq("modulo", modulo)
          .eq("user_id", user.id)
          .maybeSingle()

        setHasAccess(!!data)
      } catch (error) {
        console.error("Error verificando acceso restringido:", error)
        setHasAccess(false)
      } finally {
        setLoading(false)
      }
    }

    check()
  }, [user?.id, modulo])

  return { hasAccess, loading }
}
