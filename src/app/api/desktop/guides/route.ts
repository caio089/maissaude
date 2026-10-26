import { NextResponse } from "next/server"
import { hasClinicSession } from "@/lib/clinic-session"
import { createSupabaseAdmin } from "@/lib/supabase/admin"

export async function GET(request: Request) {
  if (!(await hasClinicSession())) return NextResponse.json({ error: "Entre no painel da clínica." }, { status: 401 })
  const db = createSupabaseAdmin()
  if (!db) return NextResponse.json({ error: "Banco de dados indisponível." }, { status: 503 })
  const params = new URL(request.url).searchParams
  const patientId = params.get("patientId")?.trim()
  const guideId = params.get("guideId")?.trim()
  if (patientId && patientId.length > 100) return NextResponse.json({ error: "Paciente inválido." }, { status: 400 })
  if (guideId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(guideId)) return NextResponse.json({ error: "Digite o número completo da guia." }, { status: 400 })

  let patientAppointments: string[] | undefined
  if (patientId) {
    const result = await db.from("appointments").select("id").eq("patient_id", patientId)
    if (result.error) return NextResponse.json({ error: "Não foi possível localizar as consultas." }, { status: 500 })
    patientAppointments = result.data.map((item) => item.id)
    if (!patientAppointments.length) return NextResponse.json({ guides: [] })
  }
  let query = db.from("authorization_guides").select("id,appointment_id,payment_id,issued_at").order("issued_at", { ascending: false }).limit(100)
  if (patientAppointments) query = query.in("appointment_id", patientAppointments)
  if (guideId) query = query.eq("id", guideId)
  const { data: guides, error } = await query
  if (error) return NextResponse.json({ error: "Não foi possível buscar as guias." }, { status: 500 })
  if (!guides.length) return NextResponse.json({ guides: [] })
  const appointmentIds = [...new Set(guides.map((item) => item.appointment_id))]
  const paymentIds = [...new Set(guides.map((item) => item.payment_id))]
  const [appointments, payments] = await Promise.all([
    db.from("appointments").select("id,patient_id,professional_id,service_id,starts_at,status,payment_id").in("id", appointmentIds),
    db.from("payments").select("id,status,simulated,asaas_payment_id").in("id", paymentIds),
  ])
  if (appointments.error || payments.error) return NextResponse.json({ error: "Não foi possível carregar os detalhes das guias." }, { status: 500 })
  const ids = (key: "patient_id" | "professional_id" | "service_id") => [...new Set(appointments.data.map((item) => item[key]).filter(Boolean))]
  const [patients, professionals, services] = await Promise.all([
    db.from("patients").select("id,name,cpf").in("id", ids("patient_id")),
    db.from("professionals").select("id,name").in("id", ids("professional_id")),
    db.from("professional_services").select("id,name").in("id", ids("service_id")),
  ])
  if (patients.error || professionals.error || services.error) return NextResponse.json({ error: "Não foi possível carregar os dados dos atendimentos." }, { status: 500 })
  return NextResponse.json({ guides: guides.map((guide) => {
    const appointment = appointments.data.find((item) => item.id === guide.appointment_id)
    const payment = payments.data.find((item) => item.id === guide.payment_id)
    const valid = Boolean(appointment && appointment.status !== "cancelled" && appointment.payment_id === guide.payment_id && payment?.status === "paid" && !payment.simulated && payment.asaas_payment_id)
    return { id: guide.id, issuedAt: guide.issued_at, valid, appointmentStatus: appointment?.status, startsAt: appointment?.starts_at, patient: patients.data.find((item) => item.id === appointment?.patient_id) || null, professional: professionals.data.find((item) => item.id === appointment?.professional_id)?.name || "Profissional", service: services.data.find((item) => item.id === appointment?.service_id)?.name || "Procedimento", paymentStatus: payment?.status || "indisponível" }
  }) })
}
