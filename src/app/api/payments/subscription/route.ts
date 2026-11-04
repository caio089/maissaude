import { NextResponse } from "next/server"

import { createAsaasCharge } from "@/lib/asaas/charges"
import { createAssociateCardPaymentLink } from "@/lib/asaas/payment-links"
import { evaluateAssociateStatus } from "@/lib/associate-rules"
import { requestOrigin } from "@/lib/auth/origin"
import { cpfDigits, formatCpf } from "@/lib/cpf"
import { createId } from "@/lib/format"
import { PaymentAuthorizationError, requireCurrentPatient } from "@/lib/payments/current-patient"
import { createSupabaseAdmin } from "@/lib/supabase/admin"
import type { AssociateRules } from "@/lib/types"

export async function GET() {
  try {
    const patient = await requireCurrentPatient()
    const admin = createSupabaseAdmin()
    if (!admin) return NextResponse.json({ error: "Pagamentos ainda não foram configurados." }, { status: 503 })
    const cpf = cpfDigits(patient.cpf)
    const [{ data: associate }, { data: rules }] = await Promise.all([
      admin
        .from("associates")
        .select("id,status,overdue_months,next_due_date")
        .in("cpf", [cpf, formatCpf(cpf)])
        .limit(1)
        .maybeSingle(),
      admin
        .from("associate_rules")
        .select("fee,consultation_discount_percent,transport_enabled,transport_rides_per_month,extra_benefits,grace_months")
        .eq("id", true)
        .maybeSingle(),
    ])

    const normalizedRules: AssociateRules = {
      fee: Number(rules?.fee) || 35,
      consultationDiscountPercent: Number(rules?.consultation_discount_percent) || 20,
      transportEnabled: rules?.transport_enabled !== false,
      transportRidesPerMonth: Number(rules?.transport_rides_per_month) || 4,
      extraBenefits: Array.isArray(rules?.extra_benefits) ? rules.extra_benefits : [],
      graceMonths: Number(rules?.grace_months) || 3,
    }

    if (!associate) {
      return NextResponse.json({
        active: false,
        status: "none",
        overdueMonths: 0,
        pendingAmount: 0,
        rules: normalizedRules,
      })
    }

    const evaluation = evaluateAssociateStatus({
      status: associate.status,
      overdueMonths: associate.overdue_months,
      graceMonths: normalizedRules.graceMonths,
    })

    return NextResponse.json({
      active: evaluation.status === "active",
      status: evaluation.status,
      overdueMonths: evaluation.overdueMonths,
      pendingAmount: evaluation.overdueMonths * normalizedRules.fee,
      rules: normalizedRules,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Não foi possível conferir a associação." },
      { status: error instanceof PaymentAuthorizationError ? 401 : 422 },
    )
  }
}

type SubscriptionRequestBody = {
  billingType?: "PIX" | "BOLETO" | "CREDIT_CARD"
  monthsToPay?: number
}

export async function POST(request: Request) {
  try {
    const patient = await requireCurrentPatient()
    const admin = createSupabaseAdmin()
    if (!admin) return NextResponse.json({ error: "Pagamentos ainda não foram configurados." }, { status: 503 })

    const { data: rules } = await admin
      .from("associate_rules")
      .select("fee,grace_months")
      .eq("id", true)
      .maybeSingle()
    const fee = Number(rules?.fee)
    if (!Number.isFinite(fee) || fee <= 0) {
      return NextResponse.json({ error: "A mensalidade ainda não foi configurada pela clínica." }, { status: 422 })
    }

    const body = ((await request.json().catch(() => ({}))) || {}) as SubscriptionRequestBody
    const billingType = body.billingType || "CREDIT_CARD"
    if (!["PIX", "BOLETO", "CREDIT_CARD"].includes(billingType)) {
      return NextResponse.json({ error: "Forma de pagamento inválida." }, { status: 422 })
    }

    const cpf = cpfDigits(patient.cpf)
    const { data: existingAssociate } = await admin
      .from("associates")
      .select("id,status,overdue_months")
      .in("cpf", [cpf, formatCpf(cpf)])
      .limit(1)
      .maybeSingle()

    const evaluation = existingAssociate
      ? evaluateAssociateStatus({
          status: existingAssociate.status,
          overdueMonths: existingAssociate.overdue_months,
          graceMonths: Number(rules?.grace_months) || 3,
        })
      : null

    if (evaluation?.status === "active") {
      return NextResponse.json({ error: "Sua associação já está ativa." }, { status: 409 })
    }

    const associateId = existingAssociate?.id || createId("ass")
    const { error: associateError } = await admin.from("associates").upsert({
      id: associateId,
      name: patient.name,
      cpf,
      phone: patient.phone,
      email: patient.email,
      status: existingAssociate?.status || "inactive",
      overdue_months: existingAssociate?.overdue_months ?? 0,
    })
    if (associateError) return NextResponse.json({ error: associateError.message }, { status: 422 })

    if (billingType === "CREDIT_CARD") {
      const { data: currentSubscription } = await admin
        .from("asaas_subscriptions")
        .select("id,status")
        .or(`patient_id.eq.${patient.id},associate_id.eq.${associateId}`)
        .not("status", "in", '("DELETED","INACTIVE")')
        .limit(1)
        .maybeSingle()
      if (currentSubscription) {
        return NextResponse.json(
          { error: "Já existe uma assinatura em andamento.", subscriptionId: currentSubscription.id },
          { status: 409 },
        )
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
    }

    const months =
      typeof body.monthsToPay === "number" && body.monthsToPay > 0
        ? Math.max(1, Math.floor(body.monthsToPay))
        : (existingAssociate?.overdue_months && existingAssociate.overdue_months > 0 ? existingAssociate.overdue_months : 1)
    const chargeValue = fee * months

    const charge = await createAsaasCharge({
      patientId: patient.id,
      name: patient.name,
      cpf: patient.cpf,
      email: patient.email,
      mobilePhone: patient.phone,
      value: chargeValue,
      billingType,
      description: `Mensalidade CuidarSaude (${months} ${months === 1 ? "mês" : "meses"})`,
      externalReference: `associate:${associateId}`,
    })

    if (billingType === "PIX") {
      return NextResponse.json({
        associateId,
        value: chargeValue,
        billingType: "PIX",
        invoiceUrl: charge.payment.invoiceUrl,
        pix: charge.pix
          ? {
              payload: charge.pix.payload,
              encodedImage: charge.pix.encodedImage,
            }
          : null,
      })
    }

    return NextResponse.json({
      associateId,
      value: chargeValue,
      billingType: "BOLETO",
      invoiceUrl: charge.payment.invoiceUrl,
      bankSlipUrl: charge.bankSlipUrl || charge.payment.bankSlipUrl || charge.payment.invoiceUrl || null,
      bankSlipBarcode: charge.identificationField || null,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível criar a cobrança de assinatura."
    return NextResponse.json({ error: message }, { status: error instanceof PaymentAuthorizationError ? 401 : 422 })
  }
}
