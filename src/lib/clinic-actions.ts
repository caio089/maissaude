"use server"

import { connection } from "next/server"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { ensureClinicAuthUser } from "@/lib/auth/clinic-user"
import { CLINIC_AUTH_EMAIL, isClinicRole } from "@/lib/auth/constants"
import { requestOrigin } from "@/lib/auth/origin"
import {
  CLINIC_COOKIE,
  CLINIC_COOKIE_MAX_AGE,
  clinicCookieOptions,
  clinicCredentialsMatch,
  createClinicToken,
  verifyClinicToken,
} from "@/lib/clinic-token"
import { isSupabaseAdminConfigured } from "@/lib/supabase/admin"
import { isSupabaseBrowserConfigured } from "@/lib/supabase/env"
import { createServerSupabase } from "@/lib/supabase/server"
import type { AuthClaims } from "@/lib/supabase/session"

export type ClinicLoginState = { error?: string; notice?: string }

export async function loginClinic(_state: ClinicLoginState, formData: FormData): Promise<ClinicLoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase()
  const password = String(formData.get("password") ?? "")
  if (email.length > 120 || password.length === 0 || password.length > 128) {
    return { error: "E-mail ou senha da clínica não conferem." }
  }

  if (isSupabaseBrowserConfigured() && isSupabaseAdminConfigured()) {
    const seeded = await ensureClinicAuthUser()
    if (!seeded.ok) return { error: seeded.message }
    try {
      const supabase = await createServerSupabase()
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) return { error: "E-mail ou senha da clínica não conferem." }
      const { data } = await supabase.auth.getClaims()
      const role = (data?.claims as AuthClaims | undefined)?.app_metadata?.role
      if (!isClinicRole(role)) {
        await supabase.auth.signOut()
        return { error: "Esta conta não abre o painel da clínica." }
      }
      redirect("/desktop")
    } catch (error) {
      if (isRedirect(error)) throw error
      return { error: error instanceof Error ? error.message : "Não foi possível entrar no painel." }
    }
  }

  if (!(await clinicCredentialsMatch(email, password))) {
    return { error: "E-mail ou senha da clínica não conferem." }
  }
  const expiresAt = Date.now() + CLINIC_COOKIE_MAX_AGE * 1000
  const jar = await cookies()
  jar.set(CLINIC_COOKIE, await createClinicToken(expiresAt), clinicCookieOptions())
  redirect("/desktop")
}

export async function logoutClinic() {
  if (isSupabaseBrowserConfigured()) {
    try {
      const supabase = await createServerSupabase()
      await supabase.auth.signOut()
    } catch {
      // A sessão HMAC ainda é limpa abaixo.
    }
  }
  const jar = await cookies()
  jar.set(CLINIC_COOKIE, "", { ...clinicCookieOptions(), maxAge: 0 })
  redirect("/desktop/entrar")
}

export async function clinicGate() {
  await connection()
  if (!(await hasClinicAccess())) redirect("/desktop/entrar")
}

export async function recoverClinicPassword(email: string): Promise<ClinicLoginState> {
  const normalized = email.trim().toLowerCase()
  if (normalized !== CLINIC_AUTH_EMAIL && !normalized.includes("@")) {
    return { error: "Informe o e-mail da equipe." }
  }
  if (!isSupabaseBrowserConfigured()) {
    return { error: "O Auth ainda não está configurado para recuperar senha." }
  }
  const supabase = await createServerSupabase()
  const origin = await requestOrigin()
  const { error } = await supabase.auth.resetPasswordForEmail(normalized || CLINIC_AUTH_EMAIL, {
    redirectTo: `${origin}/auth/callback?next=/auth/atualizar-senha`,
  })
  if (error) return { error: error.message }
  return { notice: "Se o e-mail existir no Auth, enviamos o link para criar uma nova senha." }
}

async function hasClinicAccess() {
  if (isSupabaseBrowserConfigured()) {
    try {
      const supabase = await createServerSupabase()
      const { data } = await supabase.auth.getClaims()
      if (isClinicRole((data?.claims as AuthClaims | undefined)?.app_metadata?.role)) return true
    } catch {
      // Cai no cookie HMAC.
    }
  }
  const token = (await cookies()).get(CLINIC_COOKIE)?.value
  return verifyClinicToken(token, Date.now())
}

function isRedirect(error: unknown) {
  return typeof error === "object" && error !== null && "digest" in error && String((error as { digest?: string }).digest).startsWith("NEXT_REDIRECT")
}
