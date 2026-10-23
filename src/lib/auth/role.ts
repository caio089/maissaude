import "server-only"

import { connection } from "next/server"
import { isClinicRole, isPatientRole, type AuthRole } from "@/lib/auth/constants"
import { isSupabaseBrowserConfigured } from "@/lib/supabase/env"
import type { AuthClaims } from "@/lib/supabase/session"

export async function currentAuthRole(): Promise<AuthRole | null> {
  await connection()
  if (!isSupabaseBrowserConfigured()) return null
  try {
    const { createServerSupabase } = await import("@/lib/supabase/server")
    const supabase = await createServerSupabase()
    const { data } = await supabase.auth.getClaims()
    const role = (data?.claims as AuthClaims | undefined)?.app_metadata?.role
    if (isClinicRole(role) || isPatientRole(role)) return role
  } catch {
    return null
  }
  return null
}
