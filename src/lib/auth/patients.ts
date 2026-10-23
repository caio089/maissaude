import "server-only"

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

  const { data: existingAccount } = await admin
    .from("mobile_accounts")
    .select("patient_id")
    .eq("cpf", input.cpf)
    .maybeSingle()
  if (existingAccount?.patient_id) {
    throw new Error("Este CPF já tem conta. Entre com a senha ou recupere o acesso.")
  }

  const { data: existingPatient } = await admin.from("patients").select("id").eq("cpf", input.cpf).maybeSingle()
  if (existingPatient?.id) {
    throw new Error("Este CPF já está no cadastro da clínica. A conta do aplicativo só nasce com CPF novo.")
  }

  const patientId = createId("pat")
  const { error: patientError } = await admin.from("patients").insert({
    id: patientId,
    name: input.name,
    cpf: input.cpf,
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

  const { error: accountError } = await admin.from("mobile_accounts").upsert({
    patient_id: patientId,
    cpf: input.cpf,
    email: input.email,
    auth_user_id: input.authUserId,
    password_hash: null,
  })
  if (accountError) throw new Error(accountError.message)

  await admin.from("profiles").upsert({
    id: input.authUserId,
    role: "patient",
    patient_id: patientId,
    email: input.email,
    updated_at: new Date().toISOString(),
  })

  const { data, error } = await admin.from("patients").select("*").eq("id", patientId).single()
  if (error || !data) throw new Error(error?.message || "Não foi possível gravar o paciente.")
  return mapPatientRow(data as PatientRow)
}

export async function findPatientEmailByCpf(cpf: string) {
  const admin = createSupabaseAdmin()
  if (!admin) return null
  const { data } = await admin.from("mobile_accounts").select("email").eq("cpf", cpf).maybeSingle()
  return data?.email?.trim() || null
}

export async function findPatientEmailByAccountEmail(email: string) {
  const admin = createSupabaseAdmin()
  if (!admin) return null
  const { data } = await admin.from("mobile_accounts").select("email").eq("email", email).maybeSingle()
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
  const { data } = await admin.from("patients").select("*").eq("cpf", cpf).maybeSingle()
  return data ? mapPatientRow(data as PatientRow) : null
}
