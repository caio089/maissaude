import "server-only"

import { asaasFetch } from "@/lib/asaas/client"
import { asaasEnvironment } from "@/lib/asaas/config"
import { ensureAsaasCustomer, type EnsureAsaasCustomerInput } from "@/lib/asaas/customers"
import { asaasBillingType, moneyValue, saoPauloDate } from "@/lib/asaas/format"
import { minimumAsaasCharge, minimumAsaasChargeMessage } from "@/lib/asaas/minimums"
import type { AsaasBillingType, AsaasPayment, AsaasPaymentList, AsaasPixQrCode } from "@/lib/asaas/types"
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
  if (!Number.isFinite(input.value) || input.value < minimumAsaasCharge(input.billingType) || input.value > 50_000) {
    if (Number.isFinite(input.value) && input.value > 0) throw new Error(minimumAsaasChargeMessage(input.billingType))
    throw new Error("Informe um valor válido para a cobrança.")
  }

  const customer = await ensureAsaasCustomer(input)
  // CREDIT_CARD sem dados do cartão gera a Fatura (invoiceUrl). Não capturamos cartão.
  const externalReference = input.externalReference || input.paymentId || input.patientId
  let payment: AsaasPayment
  try {
    payment = await asaasFetch<AsaasPayment>("/payments", {
      method: "POST",
      body: JSON.stringify({
        customer: customer.id,
        billingType: input.billingType,
        value: moneyValue(input.value),
        dueDate: input.dueDate || saoPauloDate(),
        description: (input.description || "Cobrança CuidarSaude").slice(0, 500),
        externalReference,
      }),
    })
  } catch (error) {
    // A gateway may time out after Asaas accepted the request. Reconcile once
    // using our unique reference before exposing an error that could prompt a retry.
    const recovered = await findPaymentByReference(externalReference)
    if (!recovered) throw error
    payment = recovered
  }

  // A cobrança já existe na Asaas neste ponto. Registre e vincule-a antes de
  // buscar o QR Pix: uma instabilidade nessa consulta não pode induzir uma
  // nova tentativa e criar cobranças ou consultas duplicadas.
  await persistCharge(payment, {
    customerId: customer.id,
    patientId: input.patientId,
    paymentId: input.paymentId,
  })

  if (input.billingType !== "PIX" || !payment.id) return { customer, payment, pix: null, pixUnavailable: false }

  try {
    const pix = await asaasFetch<AsaasPixQrCode>(`/payments/${payment.id}/pixQrCode`)
    await persistCharge(payment, {
      customerId: customer.id,
      patientId: input.patientId,
      paymentId: input.paymentId,
      pixPayload: pix.payload,
    })
    return { customer, payment, pix, pixUnavailable: false }
  } catch {
    // The payment and its local link were successfully persisted. The user can
    // still use invoiceUrl or find the charge in Asaas while its QR is retried.
    return { customer, payment, pix: null, pixUnavailable: true }
  }
}

async function findPaymentByReference(externalReference?: string) {
  if (!externalReference) return null
  try {
    const list = await asaasFetch<AsaasPaymentList>(`/payments?externalReference=${encodeURIComponent(externalReference)}&limit=1`)
    return list.data?.find((payment) => payment.id && !payment.deleted) || null
  } catch {
    return null
  }
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
