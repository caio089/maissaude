import "server-only"

import { asaasFetch } from "@/lib/asaas/client"
import { asaasEnvironment, asaasWebhookToken, isAsaasWebhookConfigured } from "@/lib/asaas/config"
import { asaasBillingType } from "@/lib/asaas/format"
import type { AsaasPayment, AsaasSubscription, AsaasWebhookPayload } from "@/lib/asaas/types"
import { createSupabaseAdmin } from "@/lib/supabase/admin"

const EVENT_PATTERN = /^[A-Z][A-Z0-9_]{2,79}$/
const RESOURCE_ID_PATTERN = /^[A-Za-z0-9_-]{8,80}$/

const PAID_STATUSES = new Set(["CONFIRMED", "RECEIVED", "RECEIVED_IN_CASH", "ANTICIPATED"])
const REFUNDED_STATUSES = new Set(["REFUNDED"])
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
  if (!eventId || !RESOURCE_ID_PATTERN.test(eventId) || !event || !EVENT_PATTERN.test(event)) {
    throw new Error("Evento da Asaas sem id ou tipo válido.")
  }

  const admin = createSupabaseAdmin()
  if (!admin) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY ainda não está configurada para gravar o webhook.")
  }

  const { error } = await admin.from("asaas_webhook_events").insert({
    id: eventId,
    event,
    asaas_payment_id: payload.payment?.id || null,
    asaas_subscription_id: payload.subscription?.id || payload.payment?.subscription || null,
    payload,
  })

  if (error?.code === "23505") {
    const { data: existing } = await admin
      .from("asaas_webhook_events")
      .select("processed_at")
      .eq("id", eventId)
      .maybeSingle()
    if (existing?.processed_at) return { duplicate: true as const, eventId }
    await applyWebhookSideEffects(payload)
    await markProcessed(eventId)
    return { duplicate: true as const, eventId }
  }
  if (error) {
    throw new Error(error.message)
  }

  await applyWebhookSideEffects(payload)
  await markProcessed(eventId)
  return { duplicate: false as const, eventId }
}

async function markProcessed(eventId: string) {
  const admin = createSupabaseAdmin()
  if (!admin) return
  await admin.from("asaas_webhook_events").update({ processed_at: new Date().toISOString() }).eq("id", eventId)
}

async function applyWebhookSideEffects(payload: AsaasWebhookPayload) {
  const admin = createSupabaseAdmin()
  if (!admin) return

  const subscriptionId = payload.subscription?.id?.trim()
  if (subscriptionId && RESOURCE_ID_PATTERN.test(subscriptionId)) {
    const subscription = await fetchVerifiedSubscription(subscriptionId)
    if (subscription) {
      await admin.from("asaas_subscriptions").upsert({
        id: subscription.id,
        customer_id: subscription.customer || null,
        billing_type: asaasBillingType(subscription.billingType),
        status: subscriptionStatus(payload.event, subscription.status, subscription.deleted),
        value: subscription.value ?? 0,
        cycle: subscription.cycle || "MONTHLY",
        next_due_date: subscription.nextDueDate || null,
        external_reference: subscription.externalReference || null,
        environment: asaasEnvironment(),
        raw: subscription,
        updated_at: new Date().toISOString(),
      })
    }
  }

  const paymentId = payload.payment?.id?.trim()
  if (!paymentId || !RESOURCE_ID_PATTERN.test(paymentId)) return
  const payment = await fetchVerifiedPayment(paymentId)
  if (!payment) return

  await admin.from("asaas_charges").upsert({
    id: payment.id,
    customer_id: payment.customer || null,
    subscription_id: payment.subscription || null,
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

  const localStatus = mapPaymentStatus(payment.status, payload.event)
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

  if (payment.subscription && localStatus === "paid") {
    const { data: subscription } = await admin
      .from("asaas_subscriptions")
      .select("associate_id")
      .eq("id", payment.subscription)
      .maybeSingle()
    if (subscription?.associate_id) {
      await admin.from("associates").update({ status: "active" }).eq("id", subscription.associate_id)
    }
  }
}

async function fetchVerifiedPayment(id: string) {
  const payment = await asaasFetch<AsaasPayment>(`/payments/${id}`)
  if (!payment?.id || payment.deleted) return null
  return payment
}

async function fetchVerifiedSubscription(id: string) {
  const subscription = await asaasFetch<AsaasSubscription>(`/subscriptions/${id}`)
  if (!subscription?.id || subscription.deleted) return null
  return subscription
}

function subscriptionStatus(event?: string, status?: string, deleted?: boolean) {
  if (event === "SUBSCRIPTION_DELETED" || deleted) return "DELETED"
  if (event === "SUBSCRIPTION_INACTIVATED") return "INACTIVE"
  return status || "ACTIVE"
}

function mapPaymentStatus(status?: string, event?: string) {
  if (event === "PAYMENT_CHARGEBACK_REQUESTED" || event === "PAYMENT_CHARGEBACK_DISPUTE") return "declined"
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
