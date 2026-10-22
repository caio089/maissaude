import { connection } from "next/server"
import { cookies } from "next/headers"
import { isClinicRole } from "@/lib/auth/constants"
import { CLINIC_COOKIE, verifyClinicToken } from "@/lib/clinic-token"
import { isSupabaseBrowserConfigured } from "@/lib/supabase/env"
import type { AuthClaims } from "@/lib/supabase/session"

export async function hasClinicSession() {
  await connection()
  if (isSupabaseBrowserConfigured()) {
    try {
      const { createServerSupabase } = await import("@/lib/supabase/server")
      const supabase = await createServerSupabase()
      const { data } = await supabase.auth.getClaims()
      if (isClinicRole((data?.claims as AuthClaims | undefined)?.app_metadata?.role)) return true
    } catch {
      // Continua no cookie HMAC da demonstração.
    }
  }
  const token = (await cookies()).get(CLINIC_COOKIE)?.value
  return verifyClinicToken(token, Date.now())
}
