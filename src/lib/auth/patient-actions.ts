"use server"

import { AUTH_PASSWORD_MIN, CLINIC_AUTH_EMAIL, isClinicRole, isPatientRole } from "@/lib/auth/constants"
import { requestOrigin } from "@/lib/auth/origin"
import {
  findPatientByAuthUser,
  findPatientEmailByAccountEmail,
  findPatientEmailByCpf,
  mapPatientRow,
  persistPatientAccount,
} from "@/lib/auth/patients"
import { toDateKey } from "@/lib/format"
import { cpfDigits, formatCpf, isValidCpf } from "@/lib/cpf"
import { isValidPhone } from "@/lib/phone"
import { createSupabaseAdmin, isSupabaseAdminConfigured } from "@/lib/supabase/admin"
import { isSupabaseBrowserConfigured } from "@/lib/supabase/env"
import { createServerSupabase } from "@/lib/supabase/server"
import type { AuthClaims } from "@/lib/supabase/session"
import type { Patient } from "@/lib/types"

const CPF_PATTERN = /^\d{3}\.?(?:\d{3})\.?\d{3}-?\d{2}$/
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export type PatientAuthResult =
  | { ok: true; patient: Patient }
  | { ok: false; message: string }

export type PatientAccountLookupResult =
  | { ok: true; state: "new" | "password_required" | "login" }
  | { ok: false; message: string }

export type RecoverResult = { ok: true; notice: string; next?: string } | { ok: false; message: string }

export async function identifyPatientAccount(cpfInput: string): Promise<PatientAccountLookupResult> {
  const configError = authConfigError()
  if (configError) return configError
  const cpf = cpfDigits(cpfInput)
  if (!CPF_PATTERN.test(cpf) || !isValidCpf(cpf)) return { ok: false, message: "Informe um CPF válido." }

  const admin = createSupabaseAdmin()
  if (!admin) return { ok: false, message: "Service role do Supabase ainda não foi configurada." }

  const { data: account, error: accountError } = await admin
    .from("mobile_accounts")
    .select("auth_user_id,email")
    .in("cpf", [cpf, formatCpf(cpf)])
    .limit(1)
    .maybeSingle()
  if (accountError) return { ok: false, message: "Não foi possível verificar a conta agora." }
  if (account?.auth_user_id && account.email) return { ok: true, state: "login" }

  const { data: patient, error: patientError } = await admin
    .from("patients")
    .select("id,status")
    .in("cpf", [cpf, formatCpf(cpf)])
    .limit(1)
    .maybeSingle()
  if (patientError) return { ok: false, message: "Não foi possível verificar o cadastro agora." }
  if (patient?.status === "active") return { ok: true, state: "password_required" }
  return { ok: true, state: "new" }
}

export async function createPasswordForExistingPatient(input: {
  cpf: string
  password: string
}): Promise<PatientAuthResult> {
  const configError = authConfigError()
  if (configError) return configError
  const cpf = cpfDigits(input.cpf)
  const password = input.password
  if (!CPF_PATTERN.test(cpf) || !isValidCpf(cpf)) return { ok: false, message: "Informe um CPF válido." }
  if (password.length < AUTH_PASSWORD_MIN) {
    return { ok: false, message: `A senha precisa ter ao menos ${AUTH_PASSWORD_MIN} caracteres.` }
  }

  const admin = createSupabaseAdmin()
  if (!admin) return { ok: false, message: "Service role do Supabase ainda não foi configurada." }

  const { data: existingAccount, error: accountLookupError } = await admin
    .from("mobile_accounts")
    .select("auth_user_id")
    .in("cpf", [cpf, formatCpf(cpf)])
    .limit(1)
    .maybeSingle()
  if (accountLookupError) return { ok: false, message: "Não foi possível verificar a conta agora." }
  if (existingAccount?.auth_user_id) {
    return { ok: false, message: "Este CPF já tem senha. Entre na sua conta ou recupere o acesso." }
  }

  const { data: patientRow, error: patientError } = await admin
    .from("patients")
    .select("*")
    .in("cpf", [cpf, formatCpf(cpf)])
    .eq("status", "active")
    .limit(1)
    .maybeSingle()
  if (patientError || !patientRow) return { ok: false, message: "Paciente ativo não encontrado para este CPF." }
  const patient = mapPatientRow(patientRow as Parameters<typeof mapPatientRow>[0])
  const email = String(patient.email || "").trim().toLowerCase()
  if (!EMAIL_PATTERN.test(email) || email === CLINIC_AUTH_EMAIL) {
    return { ok: false, message: "O cadastro precisa de um e-mail válido antes de criar a senha do aplicativo." }
  }

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { role: "patient" },
  })
  if (error || !data.user) {
    return { ok: false, message: friendlyAuthError(error?.message || "Não foi possível criar a senha.") }
  }

  try {
    const { error: accountError } = await admin.from("mobile_accounts").upsert({
      patient_id: patient.id,
      cpf,
      email,
      auth_user_id: data.user.id,
      password_hash: null,
    })
    if (accountError) throw new Error(accountError.message)

    const { error: profileError } = await admin.from("profiles").upsert({
      id: data.user.id,
      role: "patient",
      patient_id: patient.id,
      email,
      updated_at: new Date().toISOString(),
    })
    if (profileError) throw new Error(profileError.message)

    const supabase = await createServerSupabase()
    const signed = await supabase.auth.signInWithPassword({ email, password })
    if (signed.error) throw signed.error
    return { ok: true, patient }
  } catch (linkError) {
    await admin.auth.admin.deleteUser(data.user.id)
    return { ok: false, message: linkError instanceof Error ? linkError.message : "Não foi possível vincular a conta." }
  }
}

export async function registerPatientAccount(input: {
  name: string
  cpf: string
  phone: string
  email: string
  birthDate: string
  password: string
  city: string
}): Promise<PatientAuthResult> {
  const configError = authConfigError()
  if (configError) return configError
  const parsed = validateRegister(input)
  if (!parsed.ok) return parsed

  const admin = createSupabaseAdmin()
  if (!admin) return { ok: false, message: "Service role do Supabase ainda não foi configurada." }

  const existing = await findPatientEmailByCpf(parsed.cpf)
  if (existing) return { ok: false, message: "Este CPF já tem conta. Entre com a senha ou recupere o acesso." }

  const { data, error } = await admin.auth.admin.createUser({
    email: parsed.email,
    password: parsed.password,
    email_confirm: true,
    app_metadata: { role: "patient" },
  })
  if (error || !data.user) {
    return { ok: false, message: friendlyAuthError(error?.message || "Não foi possível criar a conta.") }
  }

  try {
    const patient = await persistPatientAccount({
      authUserId: data.user.id,
      name: parsed.name,
      cpf: parsed.cpf,
      phone: parsed.phone,
      email: parsed.email,
      birthDate: parsed.birthDate,
      city: parsed.city,
    })
    const supabase = await createServerSupabase()
    const signed = await supabase.auth.signInWithPassword({ email: parsed.email, password: parsed.password })
    if (signed.error) return { ok: false, message: signed.error.message }
    return { ok: true, patient }
  } catch (error) {
    await admin.auth.admin.deleteUser(data.user.id)
    return { ok: false, message: error instanceof Error ? error.message : "Não foi possível gravar a conta." }
  }
}

export async function loginPatientAccount(input: {
  cpf: string
  password: string
}): Promise<PatientAuthResult> {
  const configError = authConfigError()
  if (configError) return configError
  const cpf = cpfDigits(input.cpf)
  const password = input.password
  if (!CPF_PATTERN.test(cpf) || password.length < AUTH_PASSWORD_MIN) {
    return { ok: false, message: "CPF ou senha não conferem." }
  }

  const email = await findPatientEmailByCpf(cpf)
  if (!email) return { ok: false, message: "CPF ou senha não conferem." }

  try {
    const supabase = await createServerSupabase()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return { ok: false, message: "CPF ou senha não conferem." }
    const { data } = await supabase.auth.getClaims()
    const claims = data?.claims as AuthClaims | undefined
    if (isClinicRole(claims?.app_metadata?.role) || !isPatientRole(claims?.app_metadata?.role)) {
      await supabase.auth.signOut()
      return { ok: false, message: "A conta da clínica não entra no aplicativo do paciente." }
    }
    const patient = claims?.sub ? await findPatientByAuthUser(claims.sub) : null
    if (!patient) {
      await supabase.auth.signOut()
      return { ok: false, message: "Conta encontrada no Auth, mas o cadastro ainda não está no banco." }
    }
    return { ok: true, patient }
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Não foi possível entrar." }
  }
}

export async function logoutPatientAccount() {
  if (!isSupabaseBrowserConfigured()) return
  try {
    const supabase = await createServerSupabase()
    await supabase.auth.signOut()
  } catch {
    // A sessão local ainda é limpa no aplicativo.
  }
}

export async function recoverPatientPassword(identity: string): Promise<RecoverResult> {
  const configError = authConfigError()
  if (configError) return { ok: false, message: configError.message }
  const value = identity.trim()
  const lookedUp = CPF_PATTERN.test(value)
    ? await findPatientEmailByCpf(value)
    : EMAIL_PATTERN.test(value)
      ? await findPatientEmailByAccountEmail(value.toLowerCase())
      : null
  const email = lookedUp && lookedUp !== CLINIC_AUTH_EMAIL ? lookedUp : null
  if (email) {
    const origin = await requestOrigin()
    if (!origin) return { ok: false, message: "NEXT_PUBLIC_SITE_URL precisa estar definida para enviar o link." }
    const supabase = await createServerSupabase()
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${origin}/auth/callback?next=/auth/atualizar-senha`,
    })
  }
  return { ok: true, notice: "Se a conta existir, enviamos um e-mail para criar uma nova senha." }
}

export async function updateAccountPassword(password: string): Promise<RecoverResult> {
  if (password.trim().length < AUTH_PASSWORD_MIN) {
    return { ok: false, message: `A nova senha precisa ter ao menos ${AUTH_PASSWORD_MIN} caracteres.` }
  }
  if (!isSupabaseBrowserConfigured()) return { ok: false, message: "Auth ainda não está configurado." }
  const supabase = await createServerSupabase()
  const { data: claimsData } = await supabase.auth.getClaims()
  const claims = claimsData?.claims as AuthClaims | undefined
  if (!claims?.sub) return { ok: false, message: "Entre novamente para alterar a senha." }
  const { error } = await supabase.auth.updateUser({ password: password.trim() })
  if (error) return { ok: false, message: error.message }
  const role = claims.app_metadata?.role
  return {
    ok: true,
    notice: "Senha atualizada.",
    next: isPatientRole(role) ? "/mobile" : isClinicRole(role) ? "/desktop" : "/",
  }
}

function authConfigError(): { ok: false; message: string } | null {
  if (!isSupabaseBrowserConfigured() || !isSupabaseAdminConfigured()) {
    return { ok: false, message: "O Auth ainda não está configurado. Preencha as chaves do Supabase." }
  }
  return null
}

function validateRegister(input: {
  name: string
  cpf: string
  phone: string
  email: string
  birthDate: string
  password: string
  city: string
}): { ok: false; message: string } | {
  ok: true
  name: string
  cpf: string
  phone: string
  email: string
  birthDate: string
  password: string
  city: string
} {
  const name = input.name.trim()
  const cpf = cpfDigits(input.cpf)
  const phone = input.phone.trim()
  const email = input.email.trim().toLowerCase()
  const birthDate = input.birthDate.trim()
  const password = input.password
  const city = input.city.trim() || "Teresina"
  if (!CPF_PATTERN.test(cpf) || !isValidCpf(cpf)) return { ok: false, message: "Informe um CPF válido." }
  if (name.length < 3) return { ok: false, message: "Informe o nome da conta." }
  if (!isValidPhone(phone)) return { ok: false, message: "Informe um WhatsApp válido, com DDD." }
  if (!EMAIL_PATTERN.test(email)) return { ok: false, message: "Informe um e-mail válido." }
  if (email === CLINIC_AUTH_EMAIL) return { ok: false, message: "Este e-mail pertence à equipe da clínica." }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate) || birthDate > toDateKey(new Date())) {
    return { ok: false, message: "Informe uma data de nascimento que já tenha ocorrido." }
  }
  if (password.length < AUTH_PASSWORD_MIN) {
    return { ok: false, message: `A senha precisa ter ao menos ${AUTH_PASSWORD_MIN} caracteres.` }
  }
  return { ok: true, name, cpf, phone, email, birthDate, password, city }
}

function friendlyAuthError(message: string) {
  const text = message.toLowerCase()
  if (text.includes("already") || text.includes("registered") || text.includes("exists")) {
    return "Este e-mail já tem conta. Entre ou recupere a senha."
  }
  return message
}
