import { NextResponse } from "next/server"
import { hasClinicSession } from "@/lib/clinic-session"
import { createSupabaseAdmin } from "@/lib/supabase/admin"
import { SPECIALTY_LABEL, type Specialty, DEFAULT_CLINIC_PROFILE } from "@/lib/types"
import type { AuthorizationGuideInput } from "@/lib/authorization-guide"

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
    db.from("appointments").select("id,patient_id,professional_id,service_id,starts_at,status,payment_id,notes").in("id", appointmentIds),
    db.from("payments").select("id,status,simulated,asaas_payment_id").in("id", paymentIds),
    db.from("clinics").select("id,name,phone,address,city").limit(100),
  ])
  if (appointments.error || payments.error) return NextResponse.json({ error: "Não foi possível carregar os detalhes das guias." }, { status: 500 })

  const defaultClinicData = clinicRes.data?.find((c: any) => c.id === "clinic-default") || clinicRes.data?.[0]
  const defaultClinic = {
    name: defaultClinicData?.name?.trim() || (defaultClinicData ? "" : DEFAULT_CLINIC_PROFILE.name),
    phone: defaultClinicData?.phone?.trim() || (defaultClinicData ? null : DEFAULT_CLINIC_PROFILE.phone),
    address: defaultClinicData?.address?.trim() || (defaultClinicData ? null : DEFAULT_CLINIC_PROFILE.address),
    city: defaultClinicData?.city?.trim() || (defaultClinicData ? null : DEFAULT_CLINIC_PROFILE.city),
  }

  const getClinicForAppointment = (notes?: string) => {
    if (notes && notes.includes("[Clínica:")) {
      const match = notes.match(/\[Clínica:\s*([^\]]+)\]/)
      if (match) {
        const clinicName = match[1].trim().toLowerCase()
        const found = clinicRes.data?.find((c: any) => c.name?.trim().toLowerCase() === clinicName)
        if (found) {
          return {
            name: found.name?.trim() || found.name,
            phone: found.phone?.trim() || defaultClinic.phone,
            address: found.address?.trim() || defaultClinic.address,
            city: found.city?.trim() || defaultClinic.city,
          }
        }
      }
    }
    return defaultClinic
  }

  const ids = (key: "patient_id" | "professional_id" | "service_id") => [...new Set(appointments.data.map((item) => item[key]).filter(Boolean))]
  const serviceIds = ids("service_id")
  const [patients, professionals, services] = await Promise.all([
    db.from("patients").select("id,name,cpf,birth_date").in("id", ids("patient_id")),
    db.from("professionals").select("id,name,specialty,credential_label,credential_code,location,start_hour,end_hour,photo_url").in("id", ids("professional_id")),
    db.from("professional_services").select("id,name,price").in("id", serviceIds),
  ])
  if (patients.error || professionals.error || services.error) return NextResponse.json({ error: "Não foi possível carregar os dados dos atendimentos." }, { status: 500 })

  const foundServiceIds = new Set((services.data || []).map((item) => item.id))
  const missingServiceIds = serviceIds.filter((id) => !foundServiceIds.has(id))
  let catalogOffers: Array<{ id: string; service_name: string; kind?: string }> = []
  if (missingServiceIds.length > 0) {
    const catalogRes = await db.from("catalog_offers").select("id,service_name,kind").in("id", missingServiceIds)
    if (catalogRes.error) return NextResponse.json({ error: "Não foi possível carregar os procedimentos da clínica." }, { status: 500 })
    catalogOffers = catalogRes.data || []
  }

  return NextResponse.json({
    guides: guides.map((guide) => {
      const appointment = appointments.data.find((item) => item.id === guide.appointment_id)
      const clinic = getClinicForAppointment(appointment?.notes)
      const payment = payments.data.find((item) => item.id === guide.payment_id)
      const patient = patients.data.find((item) => item.id === appointment?.patient_id)
      const professional = professionals.data.find((item) => item.id === appointment?.professional_id)
      const service = services.data.find((item) => item.id === appointment?.service_id)
      const catalogOffer = catalogOffers.find((item) => item.id === appointment?.service_id)
      const valid = Boolean(appointment && appointment.status !== "cancelled" && appointment.payment_id === guide.payment_id && payment?.status === "paid" && !payment.simulated && payment.asaas_payment_id)

      const isClinicIndependent = !appointment?.professional_id || !professional
      const specialty = (professional?.specialty && professional.specialty in SPECIALTY_LABEL ? professional.specialty : "clinica-geral") as Specialty
      const doctorSpecialtyLabel = SPECIALTY_LABEL[specialty] || "Clínica geral"

      const serviceName = service?.name || catalogOffer?.service_name || null

      const guideProfessional = isClinicIndependent
        ? {
            name: clinic.name || null,
            specialtyLabel: "Procedimento / Exame",
            credentialLabel: null,
            credentialCode: null,
            location: clinic.address,
            startHour: null,
            endHour: null,
            photoUrl: null,
          }
        : {
            name: professional.name,
            specialtyLabel: doctorSpecialtyLabel,
            credentialLabel: professional.credential_label || null,
            credentialCode: professional.credential_code || null,
            location: professional.location || clinic.address,
            startHour: professional.start_hour ? String(professional.start_hour).slice(0, 5) : null,
            endHour: professional.end_hour ? String(professional.end_hour).slice(0, 5) : null,
            photoUrl: professional.photo_url || null,
          }

      const guideInput: AuthorizationGuideInput = {
        reference: guide.id,
        authorizedAt: guide.issued_at,
        patient: {
          name: patient?.name || null,
          cpf: patient?.cpf || null,
          birthDate: patient?.birth_date || null,
        },
        clinic,
        appointmentAt: appointment?.starts_at || guide.issued_at,
        professional: guideProfessional,
          serviceName,
          ...(serviceName ? { procedures: [{
          code: "CS-CONSULTA",
          description: serviceName,
          doctor: guideProfessional.name,
          sector: guideProfessional.specialtyLabel,
          }] } : {}),
      }

      return {
        id: guide.id,
        issuedAt: guide.issued_at,
        valid,
        appointmentStatus: appointment?.status ?? null,
        startsAt: appointment?.starts_at ?? null,
        patient: patient ? { id: patient.id, name: patient.name, cpf: patient.cpf, birthDate: patient.birth_date } : null,
        professional: guideProfessional.name,
        photoUrl: guideProfessional.photoUrl,
        service: serviceName,
        paymentStatus: payment?.status || "indisponível",
        guideInput,
      }
    }),
  })
}
