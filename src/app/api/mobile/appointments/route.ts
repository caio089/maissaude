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
      .select(
        "id,appointment_id,patient_id,professional_id,amount,method,status,created_at,paid_at,reference,simulated,description,invoice_url,pix_payload,metadata",
      )
      .eq("patient_id", patient.id)
      .order("created_at", { ascending: false }),
  ])

  if (appointmentsResult.error || paymentsResult.error) {
    return NextResponse.json({ error: "Não foi possível carregar as consultas." }, { status: 500 })
  }

  const rawAppointments = appointmentsResult.data || []
  const professionalIds = [...new Set(rawAppointments.map((r) => r.professional_id).filter(Boolean))]
  const serviceIds = [...new Set(rawAppointments.map((r) => r.service_id).filter(Boolean))]

  const [professionalsResult, servicesResult, offersResult, clinicsResult] = await Promise.all([
    professionalIds.length > 0
      ? db.from("professionals").select("id,name,specialty,credential_code").in("id", professionalIds)
      : Promise.resolve({ data: [] }),
    serviceIds.length > 0
      ? db.from("professional_services").select("id,name,price,modality").in("id", serviceIds)
      : Promise.resolve({ data: [] }),
    serviceIds.length > 0
      ? db.from("catalog_offers").select("id,kind,service_name,price,duration_min").in("id", serviceIds)
      : Promise.resolve({ data: [] }),
    db.from("clinics").select("id,name,address,phone,city"),
  ])

  const professionalsMap = new Map((professionalsResult.data || []).map((p: any) => [p.id, p]))
  const servicesMap = new Map((servicesResult.data || []).map((s: any) => [s.id, s]))
  const offersMap = new Map((offersResult.data || []).map((o: any) => [o.id, o]))
  const clinicsList = clinicsResult.data || []
  const defaultClinic = clinicsList.find((c: any) => c.id === "clinic-default") || clinicsList[0]

  const appointments: Appointment[] = rawAppointments.map((row) => {
    const pro = row.professional_id ? professionalsMap.get(row.professional_id) : null
    const svc = servicesMap.get(row.service_id)
    const offer = offersMap.get(row.service_id)

    let clinicName = defaultClinic?.name || "CuidarSaude"
    let clinicAddress = defaultClinic?.address || null
    let clinicPhone = defaultClinic?.phone || null

    if (row.notes && row.notes.includes("[Clínica:")) {
      const match = row.notes.match(/\[Clínica:\s*([^\]]+)\]/)
      if (match) {
        const parsedName = match[1].trim()
        const foundClinic = clinicsList.find((c: any) => c.name?.toLowerCase() === parsedName.toLowerCase())
        if (foundClinic) {
          clinicName = foundClinic.name
          clinicAddress = foundClinic.address
          clinicPhone = foundClinic.phone
        } else {
          clinicName = parsedName
        }
      }
    }

    const professionalName = pro?.name || clinicName
    const serviceName = svc?.name || offer?.service_name || "Procedimento / Consulta"
    const kind = offer?.kind || (pro ? "consulta" : "exame")
    const price = svc?.price ? Number(svc.price) : offer?.price ? Number(offer.price) : undefined

    return {
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
      professionalName,
      serviceName,
      clinicName,
      clinicAddress,
      clinicPhone,
      kind,
      price,
    }
  })

  const payments: (Payment & { invoiceUrl?: string; pixPayload?: string; bankSlipUrl?: string | null; identificationField?: string | null })[] = (paymentsResult.data || []).map((row: any) => ({
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
    invoiceUrl: row.invoice_url || undefined,
    pixPayload: row.pix_payload || undefined,
    bankSlipUrl: row.bank_slip_url || row.metadata?.bankSlipUrl || row.metadata?.bank_slip_url || null,
    identificationField: row.identification_field || row.metadata?.identificationField || row.metadata?.identification_field || null,
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
