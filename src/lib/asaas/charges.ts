import "server-only"

import { asaasFetch } from "@/lib/asaas/client"
import { asaasEnvironment } from "@/lib/asaas/config"
import { ensureAsaasCustomer, type EnsureAsaasCustomerInput } from "@/lib/asaas/customers"
import { asaasBillingType, moneyValue, saoPauloDate } from "@/lib/asaas/format"
import type { AsaasBillingType, AsaasPayment, AsaasPixQrCode } from "@/lib/asaas/types"
import { createSupabaseAdmin } from "@/lib/supabase/admin"

export type CreateAsaasChargeInput = EnsureAsaasCustomerInput & {
  value: number
  billingType: Extract<AsaasBillingType, "PIX" | "CREDIT_CARD">
  dueDate?: string
  description?: string
  externalReference?: string
  paymentId?: string
}

export async function createAsaasCharge(input: CreateAsaasChargeInput) {
  if (!Number.isFinite(input.value) || input.value <= 0 || input.value > 50_000) {
    throw new Error("Informe um valor válido para a cobrança.")
  }

  const customer = await ensureAsaasCustomer(input)
  // CREDIT_CARD sem dados do cartão gera a Fatura (invoiceUrl). Não capturamos cartão.
  const payment = await asaasFetch<AsaasPayment>("/payments", {
    method: "POST",
    body: JSON.stringify({
      customer: customer.id,
      billingType: input.billingType,
      value: moneyValue(input.value),
      dueDate: input.dueDate || saoPauloDate(),
      description: (input.description || "Cobrança CuidarSaude").slice(0, 500),
      externalReference: input.externalReference || input.paymentId || input.patientId,
    }),
  })

  const pix =
    input.billingType === "PIX" && payment.id
      ? await asaasFetch<AsaasPixQrCode>(`/payments/${payment.id}/pixQrCode`)
      : null

  await persistCharge(payment, {
    customerId: customer.id,
    patientId: input.patientId,
    paymentId: input.paymentId,
    pixPayload: pix?.payload,
  })

  return { customer, payment, pix }
}

async function persistCharge(
  payment: AsaasPayment,
  extra: { customerId: string; patientId?: string; paymentId?: string; pixPayload?: string },
) {
  const admin = createSupabaseAdmin()
  if (!admin || !payment.id) return

  const row = {
    id: payment.id,
    payment_id: extra.paymentId || null,
    patient_id: extra.patientId || null,
    customer_id: extra.customerId,
    subscription_id: payment.subscription || null,
    billing_type: asaasBillingType(payment.billingType),
    status: payment.status || "PENDING",
    value: payment.value ?? 0,
    due_date: payment.dueDate || null,
    invoice_url: payment.invoiceUrl || null,
    pix_payload: extra.pixPayload || null,
    external_reference: payment.externalReference || null,
    environment: asaasEnvironment(),
    raw: payment,
    updated_at: new Date().toISOString(),
  }
  const { error } = await admin.from("asaas_charges").upsert(row)
  if (error && (extra.paymentId || extra.patientId)) {
    await admin.from("asaas_charges").upsert({
      ...row,
      payment_id: null,
      patient_id: null,
    })
  }

  if (extra.paymentId) {
    await admin
      .from("payments")
      .update({
        asaas_payment_id: payment.id,
        asaas_status: payment.status || "PENDING",
        invoice_url: payment.invoiceUrl || null,
        pix_payload: extra.pixPayload || null,
        simulated: false,
      })
      .eq("id", extra.paymentId)
  }
}
