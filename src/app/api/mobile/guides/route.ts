import { NextResponse } from "next/server"
import { SPECIALTY_LABEL, type Specialty, DEFAULT_CLINIC_PROFILE } from "@/lib/types"
import type { AuthorizationGuideInput } from "@/lib/authorization-guide"
import { PaymentAuthorizationError, requireCurrentPatient } from "@/lib/payments/current-patient"
import { createSupabaseAdmin } from "@/lib/supabase/admin"

export async function GET() {
  try {
    const patient = await requireCurrentPatient()
    const db = createSupabaseAdmin()
    if (!db) return NextResponse.json({ error: "Banco de dados indisponível." }, { status: 503 })

    const { data: appointmentRows, error: appointmentError } = await db
      .from("appointments")
      .select("id")
      .eq("patient_id", patient.id)
    if (appointmentError) return NextResponse.json({ error: "Não foi possível buscar as consultas." }, { status: 500 })
    const appointmentIds = (appointmentRows || []).map((item) => item.id)
    if (!appointmentIds.length) return NextResponse.json({ guides: [] })

    const { data: guideRows, error: guideError } = await db
      .from("authorization_guides")
      .select("id,appointment_id,payment_id,issued_at")
      .in("appointment_id", appointmentIds)
      .order("issued_at", { ascending: false })
      .limit(100)
    if (guideError) return NextResponse.json({ error: "Não foi possível buscar as guias." }, { status: 500 })
    if (!guideRows?.length) return NextResponse.json({ guides: [] })

    const paymentIds = [...new Set(guideRows.map((item) => item.payment_id))]
    const [appointmentsResult, paymentsResult, clinicResult] = await Promise.all([
      db.from("appointments").select("id,patient_id,professional_id,service_id,starts_at,status,payment_id,notes").in("id", appointmentIds),
      db.from("payments").select("id,status,simulated,asaas_payment_id").in("id", paymentIds),
      db.from("clinics").select("id,name,phone,address,city").limit(100),
    ])
    if (appointmentsResult.error || paymentsResult.error) {
      return NextResponse.json({ error: "Não foi possível carregar os dados das guias." }, { status: 500 })
    }

    const appointments = appointmentsResult.data || []
    const payments = paymentsResult.data || []
    const defaultClinicData = clinicResult.data?.find((c: any) => c.id === "clinic-default") || clinicResult.data?.[0]
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
          const found = clinicResult.data?.find((c: any) => c.name?.trim().toLowerCase() === clinicName)
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

    const professionalIds = [...new Set(appointments.map((item) => item.professional_id).filter(Boolean))]
    const serviceIds = [...new Set(appointments.map((item) => item.service_id).filter(Boolean))]
    const [professionalsResult, servicesResult, offersResult] = await Promise.all([
      db.from("professionals").select("id,name,specialty,credential_label,credential_code,location,start_hour,end_hour,photo_url").in("id", professionalIds),
      db.from("professional_services").select("id,name").in("id", serviceIds),
      db.from("catalog_offers").select("id,service_name,kind").in("id", serviceIds),
    ])
    if (professionalsResult.error || servicesResult.error || offersResult.error) {
      return NextResponse.json({ error: "Não foi possível carregar os atendimentos." }, { status: 500 })
    }
    const professionals = professionalsResult.data || []
    const services = servicesResult.data || []
    const offers = offersResult.data || []

    const guides = guideRows.map((guide) => {
      const appointment = appointments.find((item) => item.id === guide.appointment_id)
      const clinic = getClinicForAppointment(appointment?.notes)
      const payment = payments.find((item) => item.id === guide.payment_id)
      const professional = professionals.find((item) => item.id === appointment?.professional_id)
      const service = services.find((item) => item.id === appointment?.service_id)
      const offer = offers.find((item) => item.id === appointment?.service_id)
      const valid = Boolean(appointment && appointment.status !== "cancelled" && appointment.payment_id === guide.payment_id && payment?.status === "paid" && !payment.simulated && payment.asaas_payment_id)
      const serviceName = service?.name || offer?.service_name || null
      const specialty = (professional?.specialty && professional.specialty in SPECIALTY_LABEL ? professional.specialty : "clinica-geral") as Specialty
      const guideProfessional = professional
        ? {
            name: professional.name || null,
            specialtyLabel: SPECIALTY_LABEL[specialty] || null,
            credentialLabel: professional.credential_label || null,
            credentialCode: professional.credential_code || null,
            location: professional.location || clinic.address,
            startHour: professional.start_hour ? String(professional.start_hour).slice(0, 5) : null,
            endHour: professional.end_hour ? String(professional.end_hour).slice(0, 5) : null,
            photoUrl: professional.photo_url || null,
          }
        : {
            name: clinic.name || null,
            specialtyLabel: "Procedimento / Exame",
            credentialLabel: null,
            credentialCode: null,
            location: clinic.address,
            startHour: null,
            endHour: null,
            photoUrl: null,
          }

      const guideInput: AuthorizationGuideInput = {
        reference: guide.id,
        authorizedAt: guide.issued_at,
        patient: { name: patient.name || null, cpf: patient.cpf || null, birthDate: patient.birthDate || null },
        clinic,
        appointmentAt: appointment?.starts_at || guide.issued_at,
        professional: guideProfessional,
        serviceName,
        ...(serviceName ? { procedures: [{ code: "CS-CONSULTA", description: serviceName, doctor: guideProfessional.name || "—", sector: guideProfessional.specialtyLabel || "—" }] } : {}),
      }

      return {
        id: guide.id,
        issuedAt: guide.issued_at,
        valid,
        appointmentStatus: appointment?.status ?? null,
        startsAt: appointment?.starts_at ?? null,
        service: serviceName,
        professional: guideProfessional.name,
        photoUrl: guideProfessional.photoUrl,
        guideInput,
      }
    })

    return NextResponse.json({ guides })
  } catch (error) {
    if (error instanceof PaymentAuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }
    return NextResponse.json({ error: "Não foi possível carregar as guias." }, { status: 500 })
  }
}
