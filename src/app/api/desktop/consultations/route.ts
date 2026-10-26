import { NextResponse } from "next/server"
import { createAsaasCharge } from "@/lib/asaas/charges"
import { hasClinicSession } from "@/lib/clinic-session"
import { cpfDigits, formatCpf } from "@/lib/cpf"
import { createId } from "@/lib/format"
import { createSupabaseAdmin } from "@/lib/supabase/admin"
import type { Patient, Professional } from "@/lib/types"
import { hasErrors, validatePatientInput, validateProfessionalInput } from "@/lib/validation"

export async function GET() {
  if (!(await hasClinicSession())) return NextResponse.json({ error: "Entre no painel da clínica." }, { status: 401 })
  const db = createSupabaseAdmin()
  if (!db) return NextResponse.json({ error: "Banco de dados indisponível." }, { status: 503 })
  const [patients, professionals, services, appointments, payments] = await Promise.all([
    db.from("patients").select("id,name,cpf,phone,email,status").eq("status", "active").order("name"),
    db.from("professionals").select("id,name,active").eq("active", true).order("name"),
    db.from("professional_services").select("id,professional_id,name,price,duration_min,modality"),
    db.from("appointments").select("id,patient_id,professional_id,service_id,starts_at,status,payment_id").order("starts_at", { ascending: false }).limit(100),
    db.from("payments").select("id,status,amount,method,invoice_url,pix_payload").order("created_at", { ascending: false }).limit(500),
  ])
  if ([patients, professionals, services, appointments, payments].some((result) => result.error)) {
    return NextResponse.json({ error: "Não foi possível carregar as consultas." }, { status: 500 })
  }
  return NextResponse.json({ patients: patients.data, professionals: professionals.data, services: services.data, appointments: appointments.data, payments: payments.data })
}

export async function POST(request: Request) {
  if (!(await hasClinicSession())) return NextResponse.json({ error: "Entre no painel da clínica." }, { status: 401 })
  const db = createSupabaseAdmin()
  if (!db) return NextResponse.json({ error: "Banco de dados indisponível." }, { status: 503 })
  try {
    const body = await request.json() as { patientId?: string; patient?: Patient; professionalId?: string; professional?: Professional; serviceId?: string; date?: string; time?: string; billingType?: string }
    if (!body.patientId || !body.professionalId || !body.serviceId || !body.date || !body.time || !/^\d{4}-\d{2}-\d{2}$/.test(body.date) || !/^\d{2}:\d{2}$/.test(body.time) || !["PIX", "CREDIT_CARD"].includes(body.billingType || "")) {
      return NextResponse.json({ error: "Preencha paciente, profissional, procedimento, data, horário e forma de pagamento." }, { status: 422 })
    }
    const { data: foundPatient, error: patientError } = await db.from("patients").select("id,name,cpf,phone,email,status").eq("id", body.patientId).maybeSingle()
    let patient = foundPatient
    if (patientError) throw patientError
    if (!patient && body.patient && body.patient.id === body.patientId && body.patient.status === "active" && !hasErrors(validatePatientInput(body.patient))) {
      const local = body.patient
      const { data: existing, error } = await db.from("patients").select("id,name,cpf,phone,email,status").in("cpf", [cpfDigits(local.cpf), formatCpf(local.cpf)]).maybeSingle()
      if (error) throw error
      patient = existing
      if (!patient) {
        const result = await db.from("patients").insert({ id: local.id, name: local.name.trim(), cpf: cpfDigits(local.cpf), phone: local.phone.trim(), email: local.email.trim().toLowerCase(), birth_date: local.birthDate, gender: local.gender, address: local.address, city: local.city, status: local.status, notes: local.notes, reminder_enabled: local.reminderEnabled }).select("id,name,cpf,phone,email,status").single()
        if (result.error) throw new Error("Não foi possível vincular o paciente ao banco. Confira o cadastro.")
        patient = result.data
      }
    }
    if (!patient || patient.status !== "active") return NextResponse.json({ error: "Paciente ativo não encontrado." }, { status: 422 })

    const { data: foundProfessional, error: professionalError } = await db.from("professionals").select("id,active,work_days,start_hour,end_hour").eq("id", body.professionalId).maybeSingle()
    let professional = foundProfessional
    if (professionalError) throw professionalError
    if (!professional && body.professional && body.professional.id === body.professionalId && body.professional.active && !hasErrors(validateProfessionalInput(body.professional))) {
      const local = body.professional
      const result = await db.from("professionals").insert({ id: local.id, name: local.name, specialty: local.specialty, credential_label: local.credentialLabel, credential_code: local.credentialCode, bio: local.bio, price: local.price, rating: local.rating, review_count: local.reviewCount, work_days: local.workDays, start_hour: local.startHour, end_hour: local.endHour, location: local.location, active: true, avatar_seed: local.avatarSeed }).select("id,active,work_days,start_hour,end_hour").single()
      if (result.error) throw new Error("Não foi possível vincular o profissional ao banco. Confira o cadastro.")
      professional = result.data
      const services = local.services.map((service) => ({ id: service.id, professional_id: local.id, name: service.name, duration_min: service.durationMin, price: service.price, modality: service.modality }))
      if (services.length) {
        const { error } = await db.from("professional_services").insert(services)
        if (error) throw new Error("Não foi possível vincular os procedimentos do profissional.")
      }
    }
    if (!professional?.active) return NextResponse.json({ error: "Profissional indisponível." }, { status: 422 })
    const { data: service, error: serviceError } = await db.from("professional_services").select("id,name,price,duration_min,modality").eq("id", body.serviceId).eq("professional_id", professional.id).maybeSingle()
    if (serviceError) throw serviceError
    if (!service || Number(service.price) <= 0) return NextResponse.json({ error: "Procedimento indisponível ou sem valor configurado." }, { status: 422 })

    const start = new Date(`${body.date}T${body.time}:00-03:00`)
    const end = new Date(start.getTime() + Number(service.duration_min) * 60000)
    const minutes = Number(body.time.slice(0, 2)) * 60 + Number(body.time.slice(3))
    const timeMinutes = (value: string) => Number(value.slice(0, 2)) * 60 + Number(value.slice(3, 5))
    const weekday = new Date(`${body.date}T12:00:00Z`).getUTCDay()
    if (!Number.isFinite(start.getTime()) || start <= new Date() || !professional.work_days.includes(weekday) || minutes < timeMinutes(professional.start_hour) || minutes + Number(service.duration_min) > timeMinutes(professional.end_hour)) {
      return NextResponse.json({ error: "Escolha um horário futuro dentro da agenda do profissional." }, { status: 422 })
    }
    const [conflicts, blocks] = await Promise.all([
      db.from("appointments").select("id").eq("professional_id", professional.id).in("status", ["scheduled", "confirmed"]).lt("starts_at", end.toISOString()).gt("ends_at", start.toISOString()).limit(1),
      db.from("blocked_slots").select("id").eq("professional_id", professional.id).lt("starts_at", end.toISOString()).gt("ends_at", start.toISOString()).limit(1),
    ])
    if (conflicts.error || blocks.error) throw new Error("Não foi possível verificar a agenda.")
    if (conflicts.data.length || blocks.data.length) return NextResponse.json({ error: "Esse horário está ocupado ou bloqueado." }, { status: 409 })
    const { data: associate, error: associateError } = await db.from("associates").select("status").in("cpf", [cpfDigits(patient.cpf), formatCpf(patient.cpf)]).maybeSingle()
    if (associateError) throw associateError
    const { data: rules, error: rulesError } = await db.from("associate_rules").select("consultation_discount_percent").eq("id", true).maybeSingle()
    if (rulesError) throw rulesError
    const discount = associate?.status === "active" ? Number(rules?.consultation_discount_percent) || 0 : 0
    const amount = Math.round(Number(service.price) * (100 - discount)) / 100
    const appointmentId = createId("apt")
    const paymentId = createId("pay")
    const reference = `PG-${crypto.randomUUID().replace(/-/g, "").slice(0, 10).toUpperCase()}`
    const { error: appointmentError } = await db.from("appointments").insert({ id: appointmentId, patient_id: patient.id, professional_id: professional.id, service_id: service.id, starts_at: start.toISOString(), ends_at: end.toISOString(), status: "scheduled", modality: service.modality, notes: "Aguardando confirmação de pagamento.", origin: "desktop" })
    if (appointmentError) throw new Error("Não foi possível agendar a consulta.")
    const { error: paymentError } = await db.from("payments").insert({ id: paymentId, appointment_id: appointmentId, patient_id: patient.id, professional_id: professional.id, amount, method: body.billingType === "PIX" ? "pix" : "card", status: "pending", reference, simulated: false, description: `${service.name}${discount ? ` · desconto de associado ${discount}%` : ""}` })
    if (paymentError) return NextResponse.json({ error: "Consulta agendada, mas não foi possível registrar a cobrança. Verifique a consulta antes de tentar novamente." }, { status: 409 })
    const { error: linkError } = await db.from("appointments").update({ payment_id: paymentId }).eq("id", appointmentId)
    if (linkError) return NextResponse.json({ error: "Consulta agendada, mas a cobrança não pôde ser vinculada. Verifique antes de tentar novamente." }, { status: 409 })
    try {
      const result = await createAsaasCharge({ name: patient.name, cpf: patient.cpf, email: patient.email, mobilePhone: patient.phone, patientId: patient.id, paymentId, value: amount, billingType: body.billingType as "PIX" | "CREDIT_CARD", description: `Consulta: ${service.name}`, externalReference: reference })
      const { data: linkedPayment, error: linkedError } = await db.from("payments").select("asaas_payment_id").eq("id", paymentId).maybeSingle()
      if (linkedError || linkedPayment?.asaas_payment_id !== result.payment.id) {
        return NextResponse.json({ error: "Cobrança criada no Asaas, mas não foi possível confirmar seu vínculo. Consulte o Asaas antes de tentar novamente." }, { status: 502 })
      }
      return NextResponse.json({ appointmentId, paymentId, amount, invoiceUrl: result.payment.invoiceUrl || null, pix: result.pix ? { payload: result.pix.payload || null, encodedImage: result.pix.encodedImage || null } : null })
    } catch {
      return NextResponse.json({ error: "Consulta registrada, mas não foi possível confirmar a cobrança. Confira no Asaas antes de tentar novamente para evitar duplicidade." }, { status: 502 })
    }
  } catch {
    return NextResponse.json({ error: "Não foi possível concluir o agendamento. Confira os dados e a agenda." }, { status: 422 })
  }
}
