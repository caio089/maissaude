import "server-only"

import { cpfDigits, formatCpf } from "@/lib/cpf"
import { createId } from "@/lib/format"
import { createSupabaseAdmin } from "@/lib/supabase/admin"
import type { Patient } from "@/lib/types"

type PatientRow = {
  id: string
  name: string
  cpf: string
  phone: string
  email: string
  birth_date: string
  gender: string
  address: string
  city: string
  status: "active" | "inactive"
  notes: string
  created_at: string
  reminder_enabled: boolean
}

export function mapPatientRow(row: PatientRow): Patient {
  return {
    id: row.id,
    name: row.name,
    cpf: row.cpf,
    phone: row.phone,
    email: row.email,
    birthDate: row.birth_date,
    gender: row.gender,
    address: row.address,
    city: row.city,
    status: row.status,
    notes: row.notes,
    createdAt: row.created_at,
    reminderEnabled: row.reminder_enabled,
  }
}

export async function persistPatientAccount(input: {
  authUserId: string
  name: string
  cpf: string
  phone: string
  email: string
  birthDate: string
  city: string
}) {
  const admin = createSupabaseAdmin()
  if (!admin) throw new Error("Service role do Supabase ainda não foi configurada.")

  const digits = cpfDigits(input.cpf)
  const cpfVariants = [digits, formatCpf(digits)]

  const { data: existingAccount } = await admin
    .from("mobile_accounts")
    .select("patient_id, auth_user_id")
    .in("cpf", cpfVariants)
    .limit(1)
    .maybeSingle()
  if (existingAccount?.auth_user_id) {
    throw new Error("Este CPF já tem conta. Entre com a senha ou recupere o acesso.")
  }

  const { data: existingPatient } = await admin
    .from("patients")
    .select("*")
    .in("cpf", cpfVariants)
    .limit(1)
    .maybeSingle()

  let patientId: string

  if (existingPatient?.id) {
    patientId = existingPatient.id
    const updates: Record<string, any> = {}
    if (input.phone) updates.phone = input.phone
    if (input.email) updates.email = input.email
    if (input.city) updates.city = input.city
    if (input.name && !existingPatient.name) updates.name = input.name
    if (input.birthDate && !existingPatient.birth_date) updates.birth_date = input.birthDate

    if (Object.keys(updates).length > 0) {
      const { error: updateError } = await admin.from("patients").update(updates).eq("id", patientId)
      if (updateError) throw new Error(updateError.message)
    }
  } else {
    patientId = createId("pat")
    const { error: patientError } = await admin.from("patients").insert({
      id: patientId,
      name: input.name,
      cpf: digits,
      phone: input.phone,
      email: input.email,
      birth_date: input.birthDate,
      gender: "Não informado",
      address: "Endereço informado no aplicativo",
      city: input.city,
      status: "active",
      notes: "Conta criada no aplicativo e gravada no Auth.",
      reminder_enabled: true,
    })
    if (patientError) throw new Error(patientError.message)
  }

  const { error: accountError } = await admin.from("mobile_accounts").upsert({
    patient_id: patientId,
    cpf: digits,
    email: input.email,
    auth_user_id: input.authUserId,
    password_hash: null,
  })
  if (accountError) throw new Error(accountError.message)

  const { error: profileError } = await admin.from("profiles").upsert({
    id: input.authUserId,
    role: "patient",
    patient_id: patientId,
    email: input.email,
    updated_at: new Date().toISOString(),
  })
  if (profileError) throw new Error(profileError.message)

  const { data, error } = await admin.from("patients").select("*").eq("id", patientId).single()
  if (error || !data) throw new Error(error?.message || "Não foi possível gravar o paciente.")
  return mapPatientRow(data as PatientRow)
}

export async function findPatientEmailByCpf(cpf: string) {
  const admin = createSupabaseAdmin()
  if (!admin) return null
  const digits = cpfDigits(cpf)
  const { data } = await admin
    .from("mobile_accounts")
    .select("email, auth_user_id")
    .in("cpf", [digits, formatCpf(digits)])
    .not("auth_user_id", "is", null)
    .limit(1)
    .maybeSingle()
  return data?.email?.trim() || null
}

export async function findPatientEmailByAccountEmail(email: string) {
  const admin = createSupabaseAdmin()
  if (!admin) return null
  const { data } = await admin
    .from("mobile_accounts")
    .select("email")
    .eq("email", email)
    .not("auth_user_id", "is", null)
    .maybeSingle()
  return data?.email?.trim() || null
}

export async function findPatientByAuthUser(authUserId: string) {
  const admin = createSupabaseAdmin()
  if (!admin) return null
  const { data: account } = await admin
    .from("mobile_accounts")
    .select("patient_id")
    .eq("auth_user_id", authUserId)
    .maybeSingle()
  if (!account?.patient_id) return null
  const { data } = await admin.from("patients").select("*").eq("id", account.patient_id).maybeSingle()
  return data ? mapPatientRow(data as PatientRow) : null
}

export async function findPatientByCpf(cpf: string) {
  const admin = createSupabaseAdmin()
  if (!admin) return null
  const digits = cpfDigits(cpf)
  const { data } = await admin
    .from("patients")
    .select("*")
    .in("cpf", [digits, formatCpf(digits)])
    .limit(1)
    .maybeSingle()
  return data ? mapPatientRow(data as PatientRow) : null
}
