import { addMinutes, formatISO } from "date-fns"
import { NextResponse } from "next/server"

import { AppointmentConflictError, isAppointmentConflictError } from "@/lib/appointments/conflicts"
import { createAsaasCharge } from "@/lib/asaas/charges"
import { cpfDigits } from "@/lib/cpf"
import { combineDateAndTime, createId } from "@/lib/format"
import { PaymentAuthorizationError, requireCurrentPatient } from "@/lib/payments/current-patient"
import { createSupabaseAdmin } from "@/lib/supabase/admin"

type CartLine = { professionalId?: string; serviceId?: string; date?: string; time?: string }

export async function POST(request: Request) {
  try {
    const patient = await requireCurrentPatient()
    const body = (await request.json()) as { lines?: CartLine[] }
    const lines = Array.isArray(body.lines) ? body.lines.slice(0, 5) : []
    if (lines.length === 0) return NextResponse.json({ error: "Inclua ao menos um atendimento." }, { status: 400 })

    const admin = createSupabaseAdmin()
    if (!admin) return NextResponse.json({ error: "Pagamentos ainda não foram configurados." }, { status: 503 })

    const { data: associate } = await admin.from("associates").select("status").eq("cpf", cpfDigits(patient.cpf)).maybeSingle()
    const { data: rules } = await admin.from("associate_rules").select("consultation_discount_percent").eq("id", true).maybeSingle()
    const discount = associate?.status === "active" ? Number(rules?.consultation_discount_percent) || 0 : 0
    const charges: Array<{ appointmentId: string; paymentId: string; value: number; invoiceUrl: string | null; pix: { payload: string | null; encodedImage: string | null } | null }> = []

    for (const line of lines) {
      const professionalId = line.professionalId?.trim()
      const serviceId = line.serviceId?.trim()
      const date = line.date?.trim()
      const time = line.time?.trim()
      if (!professionalId || !serviceId || !/^\d{4}-\d{2}-\d{2}$/.test(date || "") || !/^\d{2}:\d{2}$/.test(time || "")) {
        throw new Error("Um dos atendimentos está incompleto.")
      }

      const { data: professional } = await admin
        .from("professionals")
        .select("id, active, work_days, start_hour, end_hour")
        .eq("id", professionalId)
        .maybeSingle()
      const { data: service } = await admin
        .from("professional_services")
        .select("id, name, price, duration_min, modality")
        .eq("id", serviceId)
        .eq("professional_id", professionalId)
        .maybeSingle()
      if (!professional?.active || !service) throw new Error("Serviço ou profissional indisponível.")

      const startsAt = combineDateAndTime(date as string, time as string)
      const endsAt = addMinutes(startsAt, Number(service.duration_min))
      if (startsAt <= new Date() || !Array.isArray(professional.work_days) || !professional.work_days.includes(startsAt.getDay())) {
        throw new Error("Escolha um horário futuro dentro da agenda do profissional.")
      }
      const { data: conflicts } = await admin
        .from("appointments")
        .select("id, starts_at, ends_at")
        .eq("professional_id", professionalId)
        .in("status", ["scheduled", "confirmed"])
        .lt("starts_at", formatISO(endsAt))
        .gt("ends_at", formatISO(startsAt))
      const { data: blocks } = await admin
        .from("blocked_slots")
        .select("id")
        .eq("professional_id", professionalId)
        .lt("starts_at", formatISO(endsAt))
        .gt("ends_at", formatISO(startsAt))
      if ((conflicts?.length || 0) > 0 || (blocks?.length || 0) > 0) throw new Error("Este horário acabou de ser reservado. Escolha outro.")

      const appointmentId = createId("apt")
      const paymentId = createId("pay")
      const price = Math.round(Number(service.price) * (100 - discount)) / 100
      const reference = `PG-${crypto.randomUUID().replace(/-/g, "").slice(0, 10).toUpperCase()}`
      const { error: appointmentError } = await admin.from("appointments").insert({
        id: appointmentId,
        patient_id: patient.id,
        professional_id: professionalId,
        service_id: serviceId,
        starts_at: formatISO(startsAt),
        ends_at: formatISO(endsAt),
        status: "scheduled",
        modality: service.modality,
        notes: "Agendamento aguardando confirmação de pagamento.",
        origin: "mobile",
      })
      if (isAppointmentConflictError(appointmentError)) throw new AppointmentConflictError()
      if (appointmentError) throw new Error("Não foi possível reservar esse horário.")
      const { error: paymentError } = await admin.from("payments").insert({
        id: paymentId,
        appointment_id: appointmentId,
        patient_id: patient.id,
        professional_id: professionalId,
        amount: price,
        method: "pix",
        status: "pending",
        reference,
        simulated: false,
        description: `${service.name}${discount ? ` · desconto de associado ${discount}%` : ""}`,
      })
      if (paymentError) {
        await admin.from("appointments").delete().eq("id", appointmentId)
        throw new Error(paymentError.message)
      }
      try {
        const result = await createAsaasCharge({
          name: patient.name,
          cpf: patient.cpf,
          email: patient.email,
          mobilePhone: patient.phone,
          patientId: patient.id,
          paymentId,
          value: price,
          billingType: "PIX",
          description: `Agendamento: ${service.name}`,
          externalReference: reference,
        })
        await admin.from("appointments").update({ payment_id: paymentId }).eq("id", appointmentId)
        charges.push({
          appointmentId,
          paymentId,
          value: price,
          invoiceUrl: result.payment.invoiceUrl || null,
          pix: result.pix ? { payload: result.pix.payload || null, encodedImage: result.pix.encodedImage || null } : null,
        })
      } catch (error) {
        await admin.from("payments").delete().eq("id", paymentId)
        await admin.from("appointments").delete().eq("id", appointmentId)
        throw error
      }
    }
    return NextResponse.json({ charges })
  } catch (error) {
    const status = error instanceof PaymentAuthorizationError ? 401 : error instanceof AppointmentConflictError ? 409 : 422
    return NextResponse.json({ error: error instanceof Error ? error.message : "Não foi possível gerar as cobranças." }, { status })
  }
}
