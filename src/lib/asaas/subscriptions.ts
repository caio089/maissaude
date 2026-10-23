import "server-only"

import { asaasFetch } from "@/lib/asaas/client"
import { asaasEnvironment } from "@/lib/asaas/config"
import { ensureAsaasCustomer, type EnsureAsaasCustomerInput } from "@/lib/asaas/customers"
import { asaasBillingType, moneyValue, saoPauloDate } from "@/lib/asaas/format"
import type { AsaasBillingType, AsaasPaymentList, AsaasPixQrCode, AsaasSubscription } from "@/lib/asaas/types"
import { createSupabaseAdmin } from "@/lib/supabase/admin"

export type CreateAsaasSubscriptionInput = EnsureAsaasCustomerInput & {
  value: number
  billingType?: Extract<AsaasBillingType, "PIX" | "BOLETO">
  nextDueDate?: string
  associateId?: string
  externalReference?: string
  description?: string
}

export async function createAsaasSubscription(input: CreateAsaasSubscriptionInput) {
  if (!Number.isFinite(input.value) || input.value <= 0 || input.value > 500) {
    throw new Error("Informe um valor válido para a mensalidade.")
  }

  const billingType = input.billingType || "PIX"
  const customer = await ensureAsaasCustomer(input)
  const subscription = await asaasFetch<AsaasSubscription>("/subscriptions", {
    method: "POST",
    body: JSON.stringify({
      customer: customer.id,
      billingType,
      value: moneyValue(input.value),
      nextDueDate: input.nextDueDate || saoPauloDate(),
      cycle: "MONTHLY",
      description: (input.description || "Mensalidade de associado CuidarSaude").slice(0, 500),
      externalReference: input.externalReference || input.associateId || input.patientId,
    }),
  })

  await persistSubscription(subscription, {
    customerId: customer.id,
    patientId: input.patientId,
    associateId: input.associateId,
  })

  const payment = subscription.id
    ? (await asaasFetch<AsaasPaymentList>(`/payments?subscription=${encodeURIComponent(subscription.id)}&limit=1`)).data?.[0]
    : undefined
  const pix = billingType === "PIX" && payment?.id
    ? await asaasFetch<AsaasPixQrCode>(`/payments/${payment.id}/pixQrCode`)
    : null

  return { customer, subscription, payment, pix }
}

async function persistSubscription(
  subscription: AsaasSubscription,
  extra: { customerId: string; patientId?: string; associateId?: string },
) {
  const admin = createSupabaseAdmin()
  if (!admin || !subscription.id) return

  const row = {
    id: subscription.id,
    associate_id: extra.associateId || null,
    patient_id: extra.patientId || null,
    customer_id: extra.customerId,
    billing_type: asaasBillingType(subscription.billingType),
    status: subscription.status || "ACTIVE",
    value: subscription.value ?? 0,
    cycle: subscription.cycle || "MONTHLY",
    next_due_date: subscription.nextDueDate || null,
    external_reference: subscription.externalReference || null,
    environment: asaasEnvironment(),
    raw: subscription,
    updated_at: new Date().toISOString(),
  }
  const { error } = await admin.from("asaas_subscriptions").upsert(row)
  if (error && (extra.associateId || extra.patientId)) {
    await admin.from("asaas_subscriptions").upsert({
      ...row,
      associate_id: null,
      patient_id: null,
    })
  }
}
