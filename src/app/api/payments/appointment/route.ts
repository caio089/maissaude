import { NextResponse } from "next/server"

import { createAsaasCharge } from "@/lib/asaas/charges"
import { createId } from "@/lib/format"
import { PaymentAuthorizationError, requireCurrentPatient } from "@/lib/payments/current-patient"
import { createSupabaseAdmin } from "@/lib/supabase/admin"

type RequestBody = {
  appointmentId?: string
  billingType?: "PIX" | "CREDIT_CARD"
}

export async function POST(request: Request) {
  try {
    const patient = await requireCurrentPatient()
    const body = (await request.json()) as RequestBody
    const appointmentId = body.appointmentId?.trim()
    const billingType = body.billingType === "CREDIT_CARD" ? "CREDIT_CARD" : "PIX"
    if (!appointmentId) return NextResponse.json({ error: "Consulta inválida." }, { status: 400 })

    const admin = createSupabaseAdmin()
    if (!admin) return NextResponse.json({ error: "Pagamentos ainda não foram configurados." }, { status: 503 })

    const { data: appointment, error: appointmentError } = await admin
      .from("appointments")
      .select("id, patient_id, professional_id, service_id, status")
      .eq("id", appointmentId)
      .eq("patient_id", patient.id)
      .maybeSingle()
    if (appointmentError || !appointment || appointment.status === "cancelled") {
      return NextResponse.json({ error: "Consulta indisponível para pagamento." }, { status: 404 })
    }

    const { data: existing } = await admin
      .from("payments")
      .select("id, asaas_payment_id, invoice_url, pix_payload, status")
      .eq("appointment_id", appointmentId)
      .in("status", ["pending", "paid"])
      .maybeSingle()
    if (existing) {
      return NextResponse.json(
        { error: "Já existe uma cobrança ativa para esta consulta.", payment: existing },
        { status: 409 },
      )
    }

    const { data: service } = await admin
      .from("professional_services")
      .select("name, price")
      .eq("id", appointment.service_id)
      .maybeSingle()
    if (!service || Number(service.price) <= 0) {
      return NextResponse.json({ error: "Serviço sem valor configurado." }, { status: 422 })
    }

    const paymentId = createId("pay")
    const reference = `PG-${crypto.randomUUID().replace(/-/g, "").slice(0, 10).toUpperCase()}`
    const { error: paymentError } = await admin.from("payments").insert({
      id: paymentId,
      appointment_id: appointment.id,
      patient_id: patient.id,
      professional_id: appointment.professional_id,
      amount: Number(service.price),
      method: billingType === "PIX" ? "pix" : "card",
      status: "pending",
      reference,
      simulated: false,
      description: `Consulta: ${service.name}`,
    })
    if (paymentError) return NextResponse.json({ error: paymentError.message }, { status: 409 })

    try {
      const result = await createAsaasCharge({
        name: patient.name,
        cpf: patient.cpf,
        email: patient.email,
        mobilePhone: patient.phone,
        patientId: patient.id,
        paymentId,
        value: Number(service.price),
        billingType,
        description: `Consulta: ${service.name}`,
        externalReference: reference,
      })
      await admin.from("appointments").update({ payment_id: paymentId }).eq("id", appointment.id)
      return NextResponse.json({
        paymentId,
        reference,
        status: result.payment.status,
        invoiceUrl: result.payment.invoiceUrl,
        pix: result.pix ? { payload: result.pix.payload, encodedImage: result.pix.encodedImage } : null,
      })
    } catch (error) {
      await admin.from("payments").delete().eq("id", paymentId)
      throw error
    }
  } catch (error) {
    return paymentErrorResponse(error)
  }
}

function paymentErrorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "Não foi possível gerar a cobrança."
  const status = error instanceof PaymentAuthorizationError ? 401 : 422
  return NextResponse.json({ error: message }, { status })
}
