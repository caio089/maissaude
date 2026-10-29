import { NextResponse } from "next/server"

import { createAssociateCardPaymentLink } from "@/lib/asaas/payment-links"
import { requestOrigin } from "@/lib/auth/origin"
import { cpfDigits, formatCpf } from "@/lib/cpf"
import { createId } from "@/lib/format"
import { PaymentAuthorizationError, requireCurrentPatient } from "@/lib/payments/current-patient"
import { createSupabaseAdmin } from "@/lib/supabase/admin"

export async function GET() {
  try {
    const patient = await requireCurrentPatient()
    const admin = createSupabaseAdmin()
    if (!admin) return NextResponse.json({ error: "Pagamentos ainda não foram configurados." }, { status: 503 })
    const cpf = cpfDigits(patient.cpf)
    const [{ data: associate }, { data: rules }] = await Promise.all([
      admin.from("associates").select("id,status").in("cpf", [cpf, formatCpf(cpf)]).limit(1).maybeSingle(),
      admin.from("associate_rules").select("fee,consultation_discount_percent,transport_enabled,transport_rides_per_month,extra_benefits").eq("id", true).maybeSingle(),
    ])
    const { data: subscription } = associate?.id
      ? await admin.from("asaas_subscriptions").select("status").eq("associate_id", associate.id).not("status", "in", '("DELETED","INACTIVE")').limit(1).maybeSingle()
      : { data: null }
    return NextResponse.json({
      active: associate?.status === "active",
      subscriptionStatus: subscription?.status || null,
      rules: {
        fee: Number(rules?.fee) || 0,
        consultationDiscountPercent: Number(rules?.consultation_discount_percent) || 0,
        transportEnabled: rules?.transport_enabled !== false,
        transportRidesPerMonth: Number(rules?.transport_rides_per_month) || 0,
        extraBenefits: Array.isArray(rules?.extra_benefits) ? rules.extra_benefits : [],
      },
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Não foi possível conferir a associação." },
      { status: error instanceof PaymentAuthorizationError ? 401 : 422 },
    )
  }
}

export async function POST() {
  try {
    const patient = await requireCurrentPatient()
    const admin = createSupabaseAdmin()
    if (!admin) return NextResponse.json({ error: "Pagamentos ainda não foram configurados." }, { status: 503 })

    const { data: rules } = await admin
      .from("associate_rules")
      .select("fee")
      .eq("id", true)
      .maybeSingle()
    const fee = Number(rules?.fee)
    if (!Number.isFinite(fee) || fee <= 0) {
      return NextResponse.json({ error: "A mensalidade ainda não foi configurada pela clínica." }, { status: 422 })
    }

    const cpf = cpfDigits(patient.cpf)
    const { data: existingAssociate } = await admin
      .from("associates")
      .select("id,status")
      .in("cpf", [cpf, formatCpf(cpf)])
      .limit(1)
      .maybeSingle()
    if (existingAssociate?.status === "active") {
      return NextResponse.json({ error: "Sua associação já está ativa." }, { status: 409 })
    }
    const associateId = existingAssociate?.id || createId("ass")
    const { error: associateError } = await admin.from("associates").upsert({
      id: associateId,
      name: patient.name,
      cpf,
      phone: patient.phone,
      email: patient.email,
      status: "inactive",
    })
    if (associateError) return NextResponse.json({ error: associateError.message }, { status: 422 })

    const { data: currentSubscription } = await admin
      .from("asaas_subscriptions")
      .select("id,status")
      .or(`patient_id.eq.${patient.id},associate_id.eq.${associateId}`)
      .not("status", "in", '("DELETED","INACTIVE")')
      .limit(1)
      .maybeSingle()
    if (currentSubscription) {
      return NextResponse.json({ error: "Já existe uma assinatura em andamento.", subscriptionId: currentSubscription.id }, { status: 409 })
    }

    const origin = await requestOrigin()
    const paymentLink = await createAssociateCardPaymentLink({
      associateId,
      name: patient.name,
      value: fee,
      successUrl: origin ? `${origin}/mobile/perfil` : undefined,
    })
    return NextResponse.json({
      associateId,
      value: fee,
      billingType: "CREDIT_CARD",
      paymentUrl: paymentLink.url,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível criar a assinatura."
    return NextResponse.json({ error: message }, { status: error instanceof PaymentAuthorizationError ? 401 : 422 })
  }
}
