import "server-only"

import { asaasFetch } from "@/lib/asaas/client"
import { asaasEnvironment } from "@/lib/asaas/config"
import { digitsOnly } from "@/lib/asaas/format"
import type { AsaasCustomer, AsaasCustomerList } from "@/lib/asaas/types"
import { createSupabaseAdmin } from "@/lib/supabase/admin"

export type EnsureAsaasCustomerInput = {
  name: string
  cpf: string
  email?: string
  mobilePhone?: string
  patientId?: string
}

export async function ensureAsaasCustomer(input: EnsureAsaasCustomerInput) {
  const cpfCnpj = digitsOnly(input.cpf)
  if (cpfCnpj.length !== 11) {
    throw new Error("CPF inválido para cadastrar o pagador na Asaas.")
  }

  const storedId = await storedCustomerId(input.patientId, cpfCnpj)
  const fromStore = storedId ? await fetchCustomer(storedId) : null
  const fromSearch =
    fromStore ??
    (await asaasFetch<AsaasCustomerList>(`/customers?cpfCnpj=${encodeURIComponent(cpfCnpj)}&limit=1`)).data?.find(
      (customer) => customer.id && !customer.deleted,
    )
  const customer =
    fromSearch ??
    (await asaasFetch<AsaasCustomer>("/customers", {
      method: "POST",
      body: JSON.stringify({
        name: input.name.trim(),
        cpfCnpj,
        email: input.email?.trim() || undefined,
        mobilePhone: input.mobilePhone ? digitsOnly(input.mobilePhone) : undefined,
        externalReference: input.patientId,
        notificationDisabled: true,
      }),
    }))

  if (!customer?.id) throw new Error("A Asaas não devolveu o identificador do pagador.")
  await persistCustomer(customer, cpfCnpj, input.patientId)
  return customer
}

async function storedCustomerId(patientId: string | undefined, cpfDigits: string) {
  const admin = createSupabaseAdmin()
  if (!admin) return null
  if (patientId) {
    const { data: patient } = await admin.from("patients").select("asaas_customer_id").eq("id", patientId).maybeSingle()
    if (patient?.asaas_customer_id) return patient.asaas_customer_id as string
    const { data: byPatient } = await admin
      .from("asaas_customers")
      .select("id")
      .eq("patient_id", patientId)
      .eq("environment", asaasEnvironment())
      .maybeSingle()
    if (byPatient?.id) return byPatient.id as string
  }
  const { data } = await admin
    .from("asaas_customers")
    .select("id")
    .eq("cpf_digits", cpfDigits)
    .eq("environment", asaasEnvironment())
    .maybeSingle()
  return (data?.id as string | undefined) || null
}

async function fetchCustomer(id: string) {
  try {
    const customer = await asaasFetch<AsaasCustomer>(`/customers/${id}`)
    if (!customer?.id || customer.deleted) return null
    return customer
  } catch {
    return null
  }
}

async function persistCustomer(customer: AsaasCustomer, cpfDigits: string, patientId?: string) {
  const admin = createSupabaseAdmin()
  if (!admin || !customer.id) return

  const row = {
    id: customer.id,
    patient_id: patientId || null,
    cpf_digits: cpfDigits,
    environment: asaasEnvironment(),
    updated_at: new Date().toISOString(),
  }
  const { error } = await admin.from("asaas_customers").upsert(row)
  if (error && patientId) {
    await admin.from("asaas_customers").upsert({ ...row, patient_id: null })
  }

  if (patientId) {
    await admin.from("patients").update({ asaas_customer_id: customer.id }).eq("id", patientId)
  }
}
