import "server-only"

import { isPatientRole } from "@/lib/auth/constants"
import { findPatientByAuthUser } from "@/lib/auth/patients"
import { createServerSupabase } from "@/lib/supabase/server"
import type { AuthClaims } from "@/lib/supabase/session"

export async function requireCurrentPatient() {
  const supabase = await createServerSupabase()
  const { data, error } = await supabase.auth.getClaims()
  const claims = data?.claims as AuthClaims | undefined
  if (error || !claims?.sub || !isPatientRole(claims.app_metadata?.role)) {
    throw new PaymentAuthorizationError()
  }

  const patient = await findPatientByAuthUser(claims.sub)
  if (!patient) throw new PaymentAuthorizationError()
  return patient
}

export class PaymentAuthorizationError extends Error {
  constructor() {
    super("Entre com uma conta de paciente para continuar.")
    this.name = "PaymentAuthorizationError"
  }
}
