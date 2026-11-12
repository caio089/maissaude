import { NextResponse } from "next/server"
import { APPOINTMENT_CONFLICT_MESSAGE, AppointmentConflictError, isAppointmentConflictError } from "@/lib/appointments/conflicts"
import { AsaasRequestError } from "@/lib/asaas/client"
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
  const [patients, professionals, services, appointments, payments, blockedSlots, clinicsRes, catalogOffersRes] = await Promise.all([
    db.from("patients").select("id,name,cpf,phone,email,status").eq("status", "active").order("name"),
    db.from("professionals").select("id,name,active").eq("active", true).order("name"),
    db.from("professional_services").select("id,professional_id,name,price,duration_min,modality"),
    db.from("appointments").select("id,patient_id,professional_id,service_id,starts_at,ends_at,status,modality,notes,origin,payment_id,created_at").order("starts_at", { ascending: false }).limit(200),
    db.from("payments").select("id,appointment_id,patient_id,professional_id,amount,method,status,reference,simulated,description,created_at,paid_at,invoice_url,pix_payload,metadata").order("created_at", { ascending: false }).limit(500),
    db.from("blocked_slots").select("id,professional_id,starts_at,ends_at,reason,origin").limit(200),
    db.from("clinics").select("id,name,city,address,phone").order("name"),
    db.from("catalog_offers").select("id,kind,service_name,price,duration_min,professional_id").order("service_name"),
  ])
  if ([patients, professionals, services, appointments, payments].some((result) => result.error)) {
    return NextResponse.json({ error: "Não foi possível carregar as consultas." }, { status: 500 })
  }
  return NextResponse.json({
    patients: patients.data,
    professionals: professionals.data,
    services: services.data,
    clinics: clinicsRes.data || [],
    catalogOffers: (catalogOffersRes.data || []).map((o: any) => {
      let rawName = String(o.service_name || "")
      let clinicName: string | null = null
      let clinicId: string | null = null
      const prefixMatch = rawName.match(/^\[(.*?)\]\s*(.*)$/)
      if (prefixMatch) {
        clinicName = prefixMatch[1]
        rawName = prefixMatch[2]
        const found = (clinicsRes.data || []).find((c: any) => c.name?.toLowerCase() === clinicName?.toLowerCase())
        if (found) clinicId = found.id
      }
      return {
        id: o.id,
        kind: o.kind,
        name: rawName,
        clinicName,
        clinicId,
        price: Number(o.price),
        duration_min: o.duration_min,
        professional_id: o.professional_id ?? null,
      }
    }),
    appointments: (appointments.data || []).map((row: any) => {
      let parsedClinicName: string | null = null
      let parsedClinicId: string | null = row.clinic_id ?? null
      if (row.notes && row.notes.includes("[Clínica:")) {
        const match = row.notes.match(/\[Clínica:\s*([^\]]+)\]/)
        if (match) {
          parsedClinicName = match[1].trim()
          if (!parsedClinicId) {
            const found = (clinicsRes.data || []).find((c: any) => c.name?.toLowerCase() === parsedClinicName?.toLowerCase())
            if (found) parsedClinicId = found.id
          }
        }
      }
      return {
        ...row,
        clinic_id: parsedClinicId,
        clinic_name: parsedClinicName,
      }
    }),
    payments: (payments.data || []).map((row: any) => ({
      ...row,
      bank_slip_url: row.bank_slip_url || row.metadata?.bankSlipUrl || row.metadata?.bank_slip_url || null,
      identification_field: row.identification_field || row.metadata?.identificationField || row.metadata?.identification_field || null,
    })),
    blockedSlots: blockedSlots.data || [],
  })
}

export async function POST(request: Request) {
  if (!(await hasClinicSession())) return NextResponse.json({ error: "Entre no painel da clínica." }, { status: 401 })
  const db = createSupabaseAdmin()
  if (!db) return NextResponse.json({ error: "Banco de dados indisponível." }, { status: 503 })
  try {
    const body = await request.json() as {
      patientId?: string
      patient?: Patient
      professionalId?: string | null
      clinicId?: string | null
      professional?: Professional
      serviceId?: string
      date?: string
      time?: string
      billingType?: string
    }

    const isClinicProcedure = !body.professionalId || body.professionalId === "__clinic__"

    if (!body.patientId || (!body.professionalId && !isClinicProcedure) || !body.serviceId || !body.date || !body.time || !/^\d{4}-\d{2}-\d{2}$/.test(body.date) || !/^\d{2}:\d{2}$/.test(body.time) || !["PIX", "CREDIT_CARD", "BOLETO"].includes(body.billingType || "")) {
      return NextResponse.json({ error: "Preencha paciente, procedimento, data, horário e forma de pagamento." }, { status: 422 })
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

    // Agendamento de Procedimento/Exame em Clínica / Parceiro
    if (isClinicProcedure) {
      const { data: foundOffer, error: offerError } = await db
        .from("catalog_offers")
        .select("id,kind,service_name,price,duration_min")
        .eq("id", body.serviceId)
        .maybeSingle()

      if (offerError || !foundOffer || Number(foundOffer.price) <= 0) {
        return NextResponse.json({ error: "Procedimento ou exame indisponível no catálogo da clínica." }, { status: 422 })
      }

      const targetClinicId = body.clinicId || "clinic-default"
      const { data: clinicRow } = await db
        .from("clinics")
        .select("id,name,address,city,phone")
        .eq("id", targetClinicId)
        .maybeSingle()

      const clinicName = clinicRow?.name || "CuidarSaude"
      const durationMin = Number(foundOffer.duration_min) || 30
      const start = new Date(`${body.date}T${body.time}:00-03:00`)
      const end = new Date(start.getTime() + durationMin * 60000)

      if (!Number.isFinite(start.getTime()) || start <= new Date()) {
        return NextResponse.json({ error: "Escolha uma data e horário futuros." }, { status: 422 })
      }

      const { data: associate, error: associateError } = await db.from("associates").select("status").in("cpf", [cpfDigits(patient.cpf), formatCpf(patient.cpf)]).maybeSingle()
      if (associateError) throw associateError
      const { data: rules, error: rulesError } = await db.from("associate_rules").select("consultation_discount_percent").eq("id", true).maybeSingle()
      if (rulesError) throw rulesError
      const discount = associate?.status === "active" ? Number(rules?.consultation_discount_percent) || 0 : 0
      const amount = Math.round(Number(foundOffer.price) * (100 - discount)) / 100
      const appointmentId = createId("apt")
      const paymentId = createId("pay")
      const reference = `PG-${crypto.randomUUID().replace(/-/g, "").slice(0, 10).toUpperCase()}`

      const appointmentPayload: Record<string, any> = {
        id: appointmentId,
        patient_id: patient.id,
        professional_id: null,
        service_id: foundOffer.id,
        starts_at: start.toISOString(),
        ends_at: end.toISOString(),
        status: "scheduled",
        modality: "presencial",
        notes: `[Clínica: ${clinicName}] Aguardando confirmação de pagamento.`,
        origin: "desktop",
        clinic_id: targetClinicId,
      }

      let { error: appointmentError } = await db.from("appointments").insert(appointmentPayload)
      if (
        appointmentError &&
        (appointmentError.code === "42703" ||
          appointmentError.code === "PGRST204" ||
          String(appointmentError.message || "").toLowerCase().includes("clinic_id"))
      ) {
        delete appointmentPayload.clinic_id
        const retry = await db.from("appointments").insert(appointmentPayload)
        appointmentError = retry.error
      }
      if (appointmentError) {
        console.error("Erro ao registrar agendamento de clínica parceira:", appointmentError)
        throw new Error(appointmentError.message || "Não foi possível agendar o exame/procedimento.")
      }

      // Procura profissional fallback caso payments.professional_id tenha constraint not null no banco
      const { data: fallbackPro } = await db.from("professionals").select("id").limit(1).maybeSingle()

      const paymentPayload: Record<string, any> = {
        id: paymentId,
        appointment_id: appointmentId,
        patient_id: patient.id,
        professional_id: null,
        amount,
        method: body.billingType === "PIX" ? "pix" : body.billingType === "BOLETO" ? "boleto" : "card",
        status: "pending",
        reference,
        simulated: false,
        description: `${foundOffer.service_name} · ${clinicName}${discount ? ` · desconto de associado ${discount}%` : ""}`,
      }

      let { error: paymentError } = await db.from("payments").insert(paymentPayload)
      if (paymentError && (paymentError.code === "23502" || paymentError.message?.includes("professional_id"))) {
        // Fallback para constraint de banco antigo
        paymentPayload.professional_id = fallbackPro?.id || null
        const retry = await db.from("payments").insert(paymentPayload)
        paymentError = retry.error
      }
      if (paymentError) return NextResponse.json({ error: "Agendamento realizado, mas não foi possível registrar a cobrança." }, { status: 409 })

      await db.from("appointments").update({ payment_id: paymentId }).eq("id", appointmentId)

      try {
        const result = await createAsaasCharge({
          name: patient.name,
          cpf: patient.cpf,
          email: patient.email,
          mobilePhone: patient.phone,
          patientId: patient.id,
          paymentId,
          value: amount,
          billingType: body.billingType as "PIX" | "CREDIT_CARD" | "BOLETO",
          description: `${foundOffer.service_name} - ${clinicName}`.slice(0, 50),
          externalReference: reference,
        })
        return NextResponse.json({
          appointmentId,
          paymentId,
          amount,
          invoiceUrl: result.payment.invoiceUrl || null,
          pix: result.pix ? { payload: result.pix.payload || null, encodedImage: result.pix.encodedImage || null } : null,
          pixUnavailable: result.pixUnavailable,
          bankSlipUrl: result.bankSlipUrl || null,
          identificationField: result.identificationField || null,
        })
      } catch (error) {
        console.error("Erro ao gerar cobrança no Asaas para exame:", error)
        return NextResponse.json(
          { error: error instanceof Error ? error.message : "Não foi possível criar a cobrança no Asaas. Confira as configurações da clínica." },
          { status: 502 }
        )
      }
    }

    // Agendamento tradicional com médico específico
    const { data: foundProfessional, error: professionalError } = await db.from("professionals").select("id,active,work_days,start_hour,end_hour").eq("id", body.professionalId!).maybeSingle()
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
    const workDays = Array.isArray(professional.work_days) ? professional.work_days : []
    const startHour = professional.start_hour || "08:00"
    const endHour = professional.end_hour || "18:00"
    if (!Number.isFinite(start.getTime()) || start <= new Date() || !workDays.includes(weekday) || minutes < timeMinutes(startHour) || minutes + Number(service.duration_min) > timeMinutes(endHour)) {
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
    if (isAppointmentConflictError(appointmentError)) {
      return NextResponse.json({ error: APPOINTMENT_CONFLICT_MESSAGE }, { status: 409 })
    }
    if (appointmentError) throw new Error("Não foi possível agendar a consulta.")
    const { error: paymentError } = await db.from("payments").insert({ id: paymentId, appointment_id: appointmentId, patient_id: patient.id, professional_id: professional.id, amount, method: body.billingType === "PIX" ? "pix" : body.billingType === "BOLETO" ? "boleto" : "card", status: "pending", reference, simulated: false, description: `${service.name}${discount ? ` · desconto de associado ${discount}%` : ""}` })
    if (paymentError) return NextResponse.json({ error: "Consulta agendada, mas não foi possível registrar a cobrança. Verifique a consulta antes de tentar novamente." }, { status: 409 })
    const { error: linkError } = await db.from("appointments").update({ payment_id: paymentId }).eq("id", appointmentId)
    if (linkError) return NextResponse.json({ error: "Consulta agendada, mas a cobrança não pôde ser vinculada. Verifique antes de tentar novamente." }, { status: 409 })
    try {
      const result = await createAsaasCharge({ name: patient.name, cpf: patient.cpf, email: patient.email, mobilePhone: patient.phone, patientId: patient.id, paymentId, value: amount, billingType: body.billingType as "PIX" | "CREDIT_CARD" | "BOLETO", description: `Consulta: ${service.name}`, externalReference: reference })
      const { data: linkedPayment, error: linkedError } = await db.from("payments").select("asaas_payment_id").eq("id", paymentId).maybeSingle()
      if (linkedError || linkedPayment?.asaas_payment_id !== result.payment.id) {
        return NextResponse.json({ error: "Cobrança criada no Asaas, mas não foi possível confirmar seu vínculo. Consulte o Asaas antes de tentar novamente." }, { status: 502 })
      }
      return NextResponse.json({ appointmentId, paymentId, amount, invoiceUrl: result.payment.invoiceUrl || null, pix: result.pix ? { payload: result.pix.payload || null, encodedImage: result.pix.encodedImage || null } : null, pixUnavailable: result.pixUnavailable, bankSlipUrl: result.bankSlipUrl || null, identificationField: result.identificationField || null })
    } catch (error) {
      console.error("Asaas charge creation failed", {
        appointmentId,
        paymentId,
        reference,
        error: error instanceof Error ? error.message : "unknown_error",
        code: error instanceof AsaasRequestError ? error.code : undefined,
        status: error instanceof AsaasRequestError ? error.status : undefined,
      })
      await db.from("appointments").update({ payment_id: null }).eq("id", appointmentId)
      await db.from("payments").delete().eq("id", paymentId)
      await db.from("appointments").delete().eq("id", appointmentId)
      return NextResponse.json({ error: "Cobrança não pôde ser gerada no Asaas. O agendamento foi cancelado para evitar inconsistência." }, { status: 502 })
    }
  } catch (error) {
    if (error instanceof AppointmentConflictError || isAppointmentConflictError(error as any)) {
      return NextResponse.json({ error: APPOINTMENT_CONFLICT_MESSAGE }, { status: 409 })
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : "Não foi possível criar a consulta." }, { status: 422 })
  }
}

export async function PATCH(request: Request) {
  if (!(await hasClinicSession())) return NextResponse.json({ error: "Entre no painel da clínica." }, { status: 401 })
  const db = createSupabaseAdmin()
  if (!db) return NextResponse.json({ error: "Banco de dados indisponível." }, { status: 503 })

  try {
    const body = (await request.json()) as {
      appointmentId?: string
      status?: string
      paymentId?: string
      settleMethod?: string
      date?: string
      time?: string
    }

    if (body.paymentId) {
      const updateResult = await db
        .from("payments")
        .update({ status: "paid", paid_at: new Date().toISOString(), simulated: false })
        .eq("id", body.paymentId)
        .select("id,appointment_id,status")
        .maybeSingle()

      if (updateResult.error) {
        return NextResponse.json({ error: "Não foi possível baixar o pagamento." }, { status: 500 })
      }

      if (updateResult.data?.appointment_id) {
        await db
          .from("appointments")
          .update({ status: "confirmed" })
          .eq("id", updateResult.data.appointment_id)
      }

      return NextResponse.json({ ok: true, status: "paid" })
    }

    if (body.appointmentId && body.date && body.time) {
      const { data: appointment, error: aptError } = await db
        .from("appointments")
        .select("id,professional_id,service_id,status")
        .eq("id", body.appointmentId)
        .maybeSingle()
      if (aptError || !appointment) {
        return NextResponse.json({ error: "Consulta não encontrada." }, { status: 404 })
      }
      if (appointment.status === "cancelled" || appointment.status === "completed") {
        return NextResponse.json({ error: "Esta consulta não pode ser reagendada." }, { status: 422 })
      }

      const { data: service } = await db
        .from("professional_services")
        .select("duration_min")
        .eq("id", appointment.service_id)
        .maybeSingle()
      const durationMin = Number(service?.duration_min) || 40

      const startsAt = new Date(`${body.date}T${body.time}:00-03:00`)
      const endsAt = new Date(startsAt.getTime() + durationMin * 60000)

      const [conflicts, blocks] = await Promise.all([
        db
          .from("appointments")
          .select("id")
          .eq("professional_id", appointment.professional_id)
          .neq("id", appointment.id)
          .in("status", ["scheduled", "confirmed"])
          .lt("starts_at", endsAt.toISOString())
          .gt("ends_at", startsAt.toISOString())
          .limit(1),
        db
          .from("blocked_slots")
          .select("id")
          .eq("professional_id", appointment.professional_id)
          .lt("starts_at", endsAt.toISOString())
          .gt("ends_at", startsAt.toISOString())
          .limit(1),
      ])
      if (conflicts.data?.length || blocks.data?.length) {
        return NextResponse.json({ error: "Esse horário está ocupado ou bloqueado." }, { status: 409 })
      }

      const { error: updateError } = await db
        .from("appointments")
        .update({ starts_at: startsAt.toISOString(), ends_at: endsAt.toISOString(), status: "scheduled" })
        .eq("id", appointment.id)
      if (updateError) {
        return NextResponse.json({ error: "Não foi possível reagendar a consulta." }, { status: 500 })
      }
      return NextResponse.json({
        ok: true,
        appointmentId: appointment.id,
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
      })
    }

    if (body.appointmentId && body.status) {
      if (!["scheduled", "confirmed", "completed", "cancelled"].includes(body.status)) {
        return NextResponse.json({ error: "Status inválido." }, { status: 422 })
      }
      const updatePayload: Record<string, string> = { status: body.status }
      if (body.status === "cancelled") {
        updatePayload.notes = "Cancelada pela clínica."
      }
      const { error: updateError } = await db
        .from("appointments")
        .update(updatePayload)
        .eq("id", body.appointmentId)
      if (updateError) {
        return NextResponse.json({ error: "Não foi possível atualizar o status da consulta." }, { status: 500 })
      }
      return NextResponse.json({ ok: true, appointmentId: body.appointmentId, status: body.status })
    }

    return NextResponse.json({ error: "Nenhuma ação informada." }, { status: 422 })
  } catch {
    return NextResponse.json({ error: "Erro ao processar alteração." }, { status: 500 })
  }
}
