import { cookies } from "next/headers"
import { CLINIC_AUTH_EMAIL, isClinicRole } from "@/lib/auth/constants"
import { CLINIC_COOKIE, verifyClinicToken } from "@/lib/clinic-token"
import type { ClinicRole } from "@/lib/types"

export interface ClinicSessionInfo {
  authenticated: boolean
  role: ClinicRole
  email: string
  name: string
  userId?: string
}

export function resolveClinicRole(params: { email?: string | null; clinicRole?: string | null }): ClinicRole {
  if (params.clinicRole === "attendant") return "attendant"
  if (params.clinicRole === "admin") return "admin"
  if (params.email?.toLowerCase() === CLINIC_AUTH_EMAIL.toLowerCase()) return "admin"
  return "attendant"
}

export async function hasClinicSession(): Promise<boolean> {
  const session = await getClinicSession()
  return session.authenticated
}

export async function getClinicSession(): Promise<ClinicSessionInfo> {
  try {
    const { createServerSupabase } = await import("@/lib/supabase/server")
    const supabase = await createServerSupabase()
    const { data: claimsData } = await supabase.auth.getClaims()
    const claims = claimsData?.claims as any
    const role = claims?.app_metadata?.role
    const clinicRoleClaim = claims?.app_metadata?.clinic_role
    const email = claims?.email || ""

    if (isClinicRole(role)) {
      const clinicRole = resolveClinicRole({ email, clinicRole: clinicRoleClaim })
      return {
        authenticated: true,
        role: clinicRole,
        email,
        name: claims?.user_metadata?.name || claims?.name || (clinicRole === "admin" ? "Administrador" : "Atendente"),
        userId: claims?.sub,
      }
    }
  } catch {
    // Continua para fallback de cookie de desenvolvimento
  }

  const token = (await cookies()).get(CLINIC_COOKIE)?.value
  const valid = await verifyClinicToken(token, Date.now())
  if (valid) {
    return {
      authenticated: true,
      role: "admin",
      email: CLINIC_AUTH_EMAIL,
      name: "Administrador da Clínica",
    }
  }

  return {
    authenticated: false,
    role: "attendant",
    email: "",
    name: "",
  }
}
