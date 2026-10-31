import { NextResponse } from "next/server"
import { requireCurrentPatient, PaymentAuthorizationError } from "@/lib/payments/current-patient"
import { createSupabaseAdmin } from "@/lib/supabase/admin"
import type { Appointment, AppointmentStatus, Modality, Payment, PaymentMethod, PaymentStatus } from "@/lib/types"

export async function GET() {
  let patient
  try {
    patient = await requireCurrentPatient()
  } catch (error) {
    if (error instanceof PaymentAuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }
    return NextResponse.json({ error: "Sessão inválida." }, { status: 401 })
  }

  const db = createSupabaseAdmin()
  if (!db) return NextResponse.json({ error: "Banco de dados indisponível." }, { status: 503 })

  const [appointmentsResult, paymentsResult] = await Promise.all([
    db
      .from("appointments")
      .select("id,patient_id,professional_id,service_id,starts_at,ends_at,status,modality,notes,created_at,payment_id,origin")
      .eq("patient_id", patient.id)
      .order("starts_at", { ascending: false }),
    db
      .from("payments")
      .select("id,appointment_id,patient_id,professional_id,amount,method,status,created_at,paid_at,reference,simulated,description")
      .eq("patient_id", patient.id)
      .order("created_at", { ascending: false }),
  ])

  if (appointmentsResult.error || paymentsResult.error) {
    return NextResponse.json({ error: "Não foi possível carregar as consultas." }, { status: 500 })
  }

  const appointments: Appointment[] = (appointmentsResult.data || []).map((row) => ({
    id: row.id,
    patientId: row.patient_id,
    professionalId: row.professional_id,
    serviceId: row.service_id,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    status: row.status as AppointmentStatus,
    modality: row.modality as Modality,
    notes: row.notes || "",
    createdAt: row.created_at,
    origin: row.origin || "mobile",
    paymentId: row.payment_id || undefined,
  }))

  const payments: Payment[] = (paymentsResult.data || []).map((row) => ({
    id: row.id,
    appointmentId: row.appointment_id || null,
    patientId: row.patient_id,
    professionalId: row.professional_id,
    amount: Number(row.amount),
    method: row.method as PaymentMethod,
    status: row.status as PaymentStatus,
    createdAt: row.created_at,
    paidAt: row.paid_at || undefined,
    reference: row.reference,
    simulated: Boolean(row.simulated),
    description: row.description || "Consulta",
  }))

  return NextResponse.json({ appointments, payments })
}

export async function PATCH(request: Request) {
  let patient
  try {
    patient = await requireCurrentPatient()
  } catch (error) {
    if (error instanceof PaymentAuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }
    return NextResponse.json({ error: "Sessão inválida." }, { status: 401 })
  }

  const db = createSupabaseAdmin()
  if (!db) return NextResponse.json({ error: "Banco de dados indisponível." }, { status: 503 })

  try {
    const body = (await request.json()) as { appointmentId?: string }
    if (!body.appointmentId) {
      return NextResponse.json({ error: "ID da consulta é obrigatório." }, { status: 422 })
    }

    const { data: appointment, error: lookupError } = await db
      .from("appointments")
      .select("id,patient_id,status")
      .eq("id", body.appointmentId)
      .eq("patient_id", patient.id)
      .maybeSingle()

    if (lookupError || !appointment) {
      return NextResponse.json({ error: "Consulta não encontrada." }, { status: 404 })
    }

    if (appointment.status === "cancelled") {
      return NextResponse.json({ ok: true, status: "cancelled" })
    }

    const { error: updateError } = await db
      .from("appointments")
      .update({ status: "cancelled" })
      .eq("id", appointment.id)
      .eq("patient_id", patient.id)

    if (updateError) {
      return NextResponse.json({ error: "Não foi possível cancelar a consulta." }, { status: 500 })
    }

    return NextResponse.json({ ok: true, status: "cancelled" })
  } catch {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 422 })
  }
}
