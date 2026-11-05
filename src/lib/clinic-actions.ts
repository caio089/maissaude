"use server"

import { connection } from "next/server"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { ensureClinicAuthUser } from "@/lib/auth/clinic-user"
import { CLINIC_AUTH_EMAIL, isClinicRole } from "@/lib/auth/constants"
import { requestOrigin } from "@/lib/auth/origin"
import { hmacClinicFallbackEnabled } from "@/lib/runtime"
import {
  CLINIC_COOKIE,
  CLINIC_COOKIE_MAX_AGE,
  clinicCookieOptions,
  clinicCredentialsMatch,
  createClinicToken,
} from "@/lib/clinic-token"
import { hasClinicSession } from "@/lib/clinic-session"
import { createSupabaseAdmin, isSupabaseAdminConfigured } from "@/lib/supabase/admin"
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

  if (isSupabaseBrowserConfigured()) {
    if (isSupabaseAdminConfigured() && hmacClinicFallbackEnabled() && email === CLINIC_AUTH_EMAIL) {
      const seeded = await ensureClinicAuthUser()
      if (!seeded.ok) return { error: seeded.message }
    }
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

      const adminDb = (createSupabaseAdmin && createSupabaseAdmin()) ?? (typeof (supabase as any).from === "function" ? (supabase as any) : null)
      if (adminDb && typeof adminDb.from === "function") {
        const userId = (data?.claims as AuthClaims | undefined)?.sub
        const query = userId
          ? adminDb.from("clinic_team").select("status").or(`email.eq.${email},auth_user_id.eq.${userId}`)
          : adminDb.from("clinic_team").select("status").eq("email", email)
        const { data: member } = await query.maybeSingle()
        if (member && member.status === "inactive") {
          await supabase.auth.signOut()
          return { error: "Este acesso foi desativado pela administração da clínica." }
        }
      }

      redirect("/desktop")
    } catch (error) {
      if (isRedirect(error)) throw error
      return { error: error instanceof Error ? error.message : "Não foi possível entrar no painel." }
    }
  }

  if (process.env.NODE_ENV === "production") {
    return { error: "O painel da clínica exige Auth do Supabase. Configure as variáveis na Vercel." }
  }

  const demoPassword = process.env.CLINIC_DEMO_PASSWORD?.trim()
  const demoMatches = Boolean(demoPassword && password === demoPassword)
  const credentialsMatch =
    (await clinicCredentialsMatch(email, password)) ||
    (hmacClinicFallbackEnabled() &&
      (demoMatches || (await clinicCredentialsMatch(CLINIC_AUTH_EMAIL, password))) &&
      email.includes("@"))

  if (!credentialsMatch) {
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
  if (!(await hasClinicSession())) redirect("/desktop/entrar")
}

export async function recoverClinicPassword(email: string): Promise<ClinicLoginState> {
  const normalized = email.trim().toLowerCase()
  if (normalized !== CLINIC_AUTH_EMAIL) {
    return { error: "Informe o e-mail da equipe." }
  }
  if (!isSupabaseBrowserConfigured()) {
    return { error: "O Auth ainda não está configurado para recuperar senha." }
  }
  const origin = await requestOrigin()
  if (!origin) {
    return { error: "NEXT_PUBLIC_SITE_URL precisa estar definida para enviar o link de recuperação." }
  }
  const supabase = await createServerSupabase()
  const { error } = await supabase.auth.resetPasswordForEmail(CLINIC_AUTH_EMAIL, {
    redirectTo: `${origin}/auth/callback?next=/auth/atualizar-senha`,
  })
  if (error) return { error: error.message }
  return { notice: "Se o e-mail existir no Auth, enviamos o link para criar uma nova senha." }
}

function isRedirect(error: unknown) {
  return typeof error === "object" && error !== null && "digest" in error && String((error as { digest?: string }).digest).startsWith("NEXT_REDIRECT")
}
