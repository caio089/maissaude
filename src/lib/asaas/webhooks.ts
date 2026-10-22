import "server-only"

import { asaasEnvironment, asaasWebhookToken, isAsaasWebhookConfigured } from "@/lib/asaas/config"
import { asaasBillingType } from "@/lib/asaas/format"
import type { AsaasWebhookPayload } from "@/lib/asaas/types"
import { createSupabaseAdmin } from "@/lib/supabase/admin"

const PAID_STATUSES = new Set(["CONFIRMED", "RECEIVED", "RECEIVED_IN_CASH", "ANTICIPATED"])
const REFUNDED_STATUSES = new Set(["REFUNDED", "PARTIALLY_REFUNDED"])
const DECLINED_STATUSES = new Set([
  "REPROVED_BY_RISK_ANALYSIS",
  "CREDIT_CARD_CAPTURE_REFUSED",
  "REFUND_DENIED",
])

export function webhookTokenMatches(headerValue: string | null) {
  if (!isAsaasWebhookConfigured() || !headerValue) return false
  return timingSafeEqual(headerValue, asaasWebhookToken())
}

export async function persistAsaasWebhook(payload: AsaasWebhookPayload) {
  const eventId = payload.id?.trim()
  const event = payload.event?.trim()
  if (!eventId || !event) {
    throw new Error("Evento da Asaas sem id.")
  }

  const admin = createSupabaseAdmin()
  if (!admin) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY ainda não está configurada para gravar o webhook.")
  }

  const { error } = await admin.from("asaas_webhook_events").insert({
    id: eventId,
    event,
    asaas_payment_id: payload.payment?.id || null,
    asaas_subscription_id: payload.subscription?.id || null,
    payload,
  })

  if (error?.code === "23505") {
    return { duplicate: true as const, eventId }
  }
  if (error) {
    throw new Error(error.message)
  }

  await applyWebhookSideEffects(payload)
  await admin
    .from("asaas_webhook_events")
    .update({ processed_at: new Date().toISOString() })
    .eq("id", eventId)

  return { duplicate: false as const, eventId }
}

async function applyWebhookSideEffects(payload: AsaasWebhookPayload) {
  const admin = createSupabaseAdmin()
  const payment = payload.payment
  if (!admin || !payment?.id) return

  await admin.from("asaas_charges").upsert({
    id: payment.id,
    customer_id: payment.customer || null,
    billing_type: asaasBillingType(payment.billingType),
    status: payment.status || payload.event || "PENDING",
    value: payment.value ?? 0,
    due_date: payment.dueDate || null,
    invoice_url: payment.invoiceUrl || null,
    external_reference: payment.externalReference || null,
    environment: asaasEnvironment(),
    raw: payment,
    updated_at: new Date().toISOString(),
  })

  const localStatus = mapPaymentStatus(payment.status)
  if (!localStatus) return

  await admin
    .from("payments")
    .update({
      status: localStatus,
      asaas_status: payment.status,
      invoice_url: payment.invoiceUrl || null,
      paid_at: localStatus === "paid" ? new Date().toISOString() : null,
    })
    .eq("asaas_payment_id", payment.id)
}

function mapPaymentStatus(status?: string) {
  if (!status) return null
  if (PAID_STATUSES.has(status)) return "paid"
  if (REFUNDED_STATUSES.has(status)) return "refunded"
  if (DECLINED_STATUSES.has(status)) return "declined"
  if (status === "OVERDUE" || status === "PENDING") return "pending"
  return null
}

function timingSafeEqual(left: string, right: string) {
  const length = Math.max(left.length, right.length)
  let diff = left.length ^ right.length
  for (let index = 0; index < length; index += 1) {
    diff |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0)
  }
  return diff === 0
}
