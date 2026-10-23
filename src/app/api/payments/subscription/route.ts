import { NextResponse } from "next/server"

import { createAsaasSubscription } from "@/lib/asaas/subscriptions"
import { createId } from "@/lib/format"
import { PaymentAuthorizationError, requireCurrentPatient } from "@/lib/payments/current-patient"
import { createSupabaseAdmin } from "@/lib/supabase/admin"

export async function POST() {
  try {
    const patient = await requireCurrentPatient()
    const admin = createSupabaseAdmin()
    if (!admin) return NextResponse.json({ error: "Pagamentos ainda não foram configurados." }, { status: 503 })

    const { data: currentSubscription } = await admin
      .from("asaas_subscriptions")
      .select("id, status")
      .eq("patient_id", patient.id)
      .not("status", "in", '("DELETED","INACTIVE")')
      .maybeSingle()
    if (currentSubscription) {
      return NextResponse.json({ error: "Já existe uma assinatura ativa.", subscriptionId: currentSubscription.id }, { status: 409 })
    }

    const { data: rules } = await admin
      .from("associate_rules")
      .select("fee")
      .eq("id", true)
      .maybeSingle()
    const fee = Number(rules?.fee)
    if (!Number.isFinite(fee) || fee <= 0) {
      return NextResponse.json({ error: "A mensalidade ainda não foi configurada pela clínica." }, { status: 422 })
    }

    const { data: existingAssociate } = await admin
      .from("associates")
      .select("id")
      .eq("cpf", patient.cpf)
      .maybeSingle()
    const associateId = existingAssociate?.id || createId("ass")
    const { error: associateError } = await admin.from("associates").upsert({
      id: associateId,
      name: patient.name,
      cpf: patient.cpf,
      phone: patient.phone,
      email: patient.email,
      status: "inactive",
    })
    if (associateError) return NextResponse.json({ error: associateError.message }, { status: 422 })

    const result = await createAsaasSubscription({
      name: patient.name,
      cpf: patient.cpf,
      email: patient.email,
      mobilePhone: patient.phone,
      patientId: patient.id,
      associateId,
      value: fee,
      billingType: "PIX",
      description: "Mensalidade de associado",
      externalReference: associateId,
    })
    return NextResponse.json({
      subscriptionId: result.subscription.id,
      status: result.subscription.status,
      value: result.subscription.value,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível criar a assinatura."
    return NextResponse.json({ error: message }, { status: error instanceof PaymentAuthorizationError ? 401 : 422 })
  }
}
