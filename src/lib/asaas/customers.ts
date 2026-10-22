import "server-only"

import { asaasFetch } from "@/lib/asaas/client"
import { digitsOnly } from "@/lib/asaas/format"
import type { AsaasCustomer, AsaasCustomerList } from "@/lib/asaas/types"
import { createSupabaseAdmin } from "@/lib/supabase/admin"
import { asaasEnvironment } from "@/lib/asaas/config"

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

  const existing = await asaasFetch<AsaasCustomerList>(
    `/customers?cpfCnpj=${encodeURIComponent(cpfCnpj)}&limit=1`,
  )
  const found = existing.data?.find((customer) => customer.id)
  const customer =
    found ??
    (await asaasFetch<AsaasCustomer>("/customers", {
      method: "POST",
      body: JSON.stringify({
        name: input.name.trim(),
        cpfCnpj,
        email: input.email?.trim() || undefined,
        mobilePhone: input.mobilePhone ? digitsOnly(input.mobilePhone) : undefined,
        externalReference: input.patientId,
        notificationDisabled: false,
      }),
    }))

  await persistCustomer(customer, cpfCnpj, input.patientId)
  return customer
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
