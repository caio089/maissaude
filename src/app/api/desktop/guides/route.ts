import { NextResponse } from "next/server"
import { hasClinicSession } from "@/lib/clinic-session"
import { createSupabaseAdmin } from "@/lib/supabase/admin"
import { SPECIALTY_LABEL, type Specialty } from "@/lib/types"
import type { AuthorizationGuideInput } from "@/lib/authorization-guide"

const DEFAULT_CLINIC = {
  name: "CuidarSaude",
  phone: "(85) 3000-0000",
  address: "Rua Exemplo, 123",
  city: "Fortaleza/CE",
}

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
  const [appointments, payments, clinicRes] = await Promise.all([
    db.from("appointments").select("id,patient_id,professional_id,service_id,starts_at,status,payment_id").in("id", appointmentIds),
    db.from("payments").select("id,status,simulated,asaas_payment_id").in("id", paymentIds),
    db.from("clinics").select("id,name,phone,address,city").limit(1),
  ])
  if (appointments.error || payments.error) return NextResponse.json({ error: "Não foi possível carregar os detalhes das guias." }, { status: 500 })

  const clinicData = clinicRes.data?.[0]
  const clinic = {
    name: clinicData?.name || DEFAULT_CLINIC.name,
    phone: clinicData?.phone || DEFAULT_CLINIC.phone,
    address: clinicData?.address || DEFAULT_CLINIC.address,
    city: clinicData?.city || DEFAULT_CLINIC.city,
  }

  const ids = (key: "patient_id" | "professional_id" | "service_id") => [...new Set(appointments.data.map((item) => item[key]).filter(Boolean))]
  const [patients, professionals, services] = await Promise.all([
    db.from("patients").select("id,name,cpf,birth_date").in("id", ids("patient_id")),
    db.from("professionals").select("id,name,specialty,credential_label,credential_code,location,start_hour,end_hour").in("id", ids("professional_id")),
    db.from("professional_services").select("id,name,price").in("id", ids("service_id")),
  ])
  if (patients.error || professionals.error || services.error) return NextResponse.json({ error: "Não foi possível carregar os dados dos atendimentos." }, { status: 500 })

  return NextResponse.json({
    guides: guides.map((guide) => {
      const appointment = appointments.data.find((item) => item.id === guide.appointment_id)
      const payment = payments.data.find((item) => item.id === guide.payment_id)
      const patient = patients.data.find((item) => item.id === appointment?.patient_id)
      const professional = professionals.data.find((item) => item.id === appointment?.professional_id)
      const service = services.data.find((item) => item.id === appointment?.service_id)
      const valid = Boolean(appointment && appointment.status !== "cancelled" && appointment.payment_id === guide.payment_id && payment?.status === "paid" && !payment.simulated && payment.asaas_payment_id)

      const specialty = (professional?.specialty && professional.specialty in SPECIALTY_LABEL ? professional.specialty : "clinica-geral") as Specialty
      const specialtyLabel = SPECIALTY_LABEL[specialty] || "Clínica geral"


      const guideInput: AuthorizationGuideInput = {
        reference: guide.id,
        authorizedAt: guide.issued_at,
        patient: {
          name: patient?.name || "Paciente",
          cpf: patient?.cpf || "",
          birthDate: patient?.birth_date || "2000-01-01",
        },
        clinic,
        appointmentAt: appointment?.starts_at || guide.issued_at,
        professional: {
          name: professional?.name || "Profissional",
          specialtyLabel,
          credentialLabel: professional?.credential_label || "CRM",
          credentialCode: professional?.credential_code || "0000",
          location: professional?.location || clinic.address,
          startHour: professional?.start_hour ? String(professional.start_hour).slice(0, 5) : "08:00",
          endHour: professional?.end_hour ? String(professional.end_hour).slice(0, 5) : "18:00",
        },
        serviceName: service?.name || "Consulta",
        procedures: [{
          code: "CS-CONSULTA",
          description: service?.name || "Consulta",
          doctor: professional?.name || "Profissional",
          sector: specialtyLabel,
        }],
      }

      return {
        id: guide.id,
        issuedAt: guide.issued_at,
        valid,
        appointmentStatus: appointment?.status ?? null,
        startsAt: appointment?.starts_at ?? null,
        patient: patient ? { id: patient.id, name: patient.name, cpf: patient.cpf, birthDate: patient.birth_date } : null,
        professional: professional?.name || "Profissional",
        service: service?.name || "Procedimento",
        paymentStatus: payment?.status || "indisponível",
        guideInput,
      }
    }),
  })
}

