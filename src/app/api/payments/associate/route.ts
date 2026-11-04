import { NextResponse } from "next/server"

import { createAsaasCharge } from "@/lib/asaas/charges"
import { createAssociateCardPaymentLink } from "@/lib/asaas/payment-links"
import { cpfDigits, formatCpf, isValidCpf } from "@/lib/cpf"
import { createId } from "@/lib/format"
import { hasClinicSession } from "@/lib/clinic-session"
import { createSupabaseAdmin } from "@/lib/supabase/admin"
import type { AssociateStatus, Patient } from "@/lib/types"
import { hasErrors, validatePatientInput } from "@/lib/validation"

type RequestBody = {
  name?: string
  cpf?: string
  phone?: string
  email?: string
  patientId?: string
  patient?: Patient
  billingType?: "PIX" | "BOLETO" | "CREDIT_CARD"
  monthsToPay?: number
}

export async function GET() {
  if (!(await hasClinicSession())) return NextResponse.json({ error: "Entre no painel da clínica." }, { status: 401 })
  const admin = createSupabaseAdmin()
  if (!admin) return NextResponse.json({ error: "Banco de dados indisponível." }, { status: 503 })
  const [patientsResult, associatesResult, rulesResult] = await Promise.all([
    admin.from("patients").select("id,name,cpf,phone,email,status").eq("status", "active").order("name"),
    admin.from("associates").select("id,name,cpf,phone,email,status,overdue_months,next_due_date,last_paid_at,created_at").order("name"),
    admin.from("associate_rules").select("*").eq("id", true).maybeSingle(),
  ])
  if (patientsResult.error) return NextResponse.json({ error: "Não foi possível carregar os pacientes." }, { status: 500 })
  return NextResponse.json({
    patients: patientsResult.data,
    associates: (associatesResult.data || []).map((row: any) => ({
      id: row.id,
      name: row.name,
      cpf: row.cpf,
      phone: row.phone,
      email: row.email,
      status: row.status,
      overdueMonths: row.overdue_months ?? 0,
      nextDueDate: row.next_due_date ?? null,
      lastPaidAt: row.last_paid_at ?? null,
      createdAt: row.created_at || row.createdAt || new Date().toISOString(),
    })),
    rules: rulesResult.data || null,
  })
}

export async function POST(request: Request) {
  if (!(await hasClinicSession())) {
    return NextResponse.json({ error: "Entre no painel da clínica para gerar a cobrança." }, { status: 401 })
  }

  try {
    const body = (await request.json().catch(() => ({}))) as RequestBody
    const name = body.name?.trim() || ""
    const cpf = cpfDigits(body.cpf || "")
    const phone = body.phone?.trim() || ""
    const email = body.email?.trim().toLowerCase() || ""
    if (name.length < 3 || !isValidCpf(cpf) || !/^\+?[\d\s().-]{10,20}$/.test(phone) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Revise nome, CPF, telefone e e-mail do associado." }, { status: 422 })
    }

    const billingType = body.billingType || "CREDIT_CARD"
    if (!["PIX", "BOLETO", "CREDIT_CARD"].includes(billingType)) {
      return NextResponse.json({ error: "Forma de pagamento inválida." }, { status: 422 })
    }

    const admin = createSupabaseAdmin()
    if (!admin) return NextResponse.json({ error: "Pagamentos ainda não foram configurados." }, { status: 503 })

    let patientId: string | undefined
    if (body.patientId) {
      const { data: byId, error: patientError } = await admin.from("patients").select("id,cpf,status").eq("id", body.patientId).maybeSingle()
      if (patientError) throw patientError
      let patient = byId
      if (!patient) {
        const { data: byCpf, error: cpfError } = await admin.from("patients").select("id,cpf,status").in("cpf", [cpf, formatCpf(cpf)]).maybeSingle()
        if (cpfError) throw cpfError
        patient = byCpf
      }
      if (patient && (patient.status !== "active" || cpfDigits(patient.cpf) !== cpf)) {
        return NextResponse.json({ error: "Selecione um paciente ativo com o mesmo CPF." }, { status: 422 })
      }
      if (!patient) {
        const snapshot = body.patient
        if (!snapshot || snapshot.id !== body.patientId || snapshot.status !== "active" || cpfDigits(snapshot.cpf) !== cpf || hasErrors(validatePatientInput(snapshot))) {
          return NextResponse.json({ error: "Não foi possível confirmar o cadastro do paciente. Atualize a seleção." }, { status: 422 })
        }
        const { error: insertError } = await admin.from("patients").insert({
          id: snapshot.id, name: snapshot.name.trim(), cpf, phone: snapshot.phone.trim(), email: snapshot.email.trim().toLowerCase(),
          birth_date: snapshot.birthDate, gender: snapshot.gender, address: snapshot.address, city: snapshot.city,
          status: "active", notes: snapshot.notes, reminder_enabled: snapshot.reminderEnabled,
        })
        if (insertError) return NextResponse.json({ error: "Não foi possível vincular o paciente ao banco. Confira o cadastro e tente novamente." }, { status: 422 })
        patientId = snapshot.id
      } else {
        patientId = patient.id
      }
    }

    const { data: rules } = await admin.from("associate_rules").select("fee").eq("id", true).maybeSingle()
    const fee = Number(rules?.fee)
    if (!Number.isFinite(fee) || fee <= 0) {
      return NextResponse.json({ error: "A mensalidade ainda não foi configurada." }, { status: 422 })
    }

    const { data: existing, error: existingError } = await admin.from("associates").select("id,status,overdue_months").in("cpf", [cpf, formatCpf(cpf)]).maybeSingle()
    if (existingError) throw existingError
    if (existing?.status === "active") return NextResponse.json({ error: "Este CPF já está cadastrado como associado ativo." }, { status: 409 })
    const associateId = existing?.id || createId("ass")

    if (billingType === "CREDIT_CARD") {
      const { data: activeSubscription, error: subscriptionError } = await admin
        .from("asaas_subscriptions")
        .select("id")
        .eq("associate_id", associateId)
        .not("status", "in", '("DELETED","INACTIVE")')
        .maybeSingle()
      if (subscriptionError) throw subscriptionError
      if (activeSubscription) {
        return NextResponse.json({ error: "Este associado já tem uma assinatura ativa." }, { status: 409 })
      }
      if (patientId) {
        const { data: patientSubscription, error: patientSubscriptionError } = await admin
          .from("asaas_subscriptions").select("id").eq("patient_id", patientId)
          .not("status", "in", '("DELETED","INACTIVE")').limit(1).maybeSingle()
        if (patientSubscriptionError) throw patientSubscriptionError
        if (patientSubscription) return NextResponse.json({ error: "Este paciente já tem uma assinatura ativa." }, { status: 409 })
      }
    }

    const { error: associateError } = await admin.from("associates").upsert({
      id: associateId,
      name,
      cpf,
      phone,
      email,
      status: existing?.status || "inactive",
      overdue_months: existing?.overdue_months ?? 0,
    })
    if (associateError) return NextResponse.json({ error: associateError.message }, { status: 422 })

    if (billingType === "CREDIT_CARD") {
      const paymentLink = await createAssociateCardPaymentLink({ associateId, name, value: fee })
      return NextResponse.json({
        associateId,
        value: fee,
        billingType: "CREDIT_CARD",
        paymentUrl: paymentLink.url,
        url: paymentLink.url,
      })
    }

    const months =
      typeof body.monthsToPay === "number" && body.monthsToPay > 0
        ? Math.max(1, Math.floor(body.monthsToPay))
        : (existing?.overdue_months && existing.overdue_months > 0 ? existing.overdue_months : 1)
    const chargeValue = fee * months

    const charge = await createAsaasCharge({
      patientId,
      name,
      cpf,
      email,
      mobilePhone: phone,
      value: chargeValue,
      billingType,
      description: `Mensalidade de associado CuidarSaude${months > 1 ? ` (${months} meses)` : ""}`,
      externalReference: `associate:${associateId}`,
    })

    if (billingType === "PIX") {
      return NextResponse.json({
        associateId,
        value: chargeValue,
        billingType: "PIX",
        paymentId: charge.payment?.id,
        invoiceUrl: charge.payment?.invoiceUrl,
        pix: charge.pix
          ? {
              payload: charge.pix.payload,
              encodedImage: charge.pix.encodedImage,
            }
          : null,
      })
    }

    return NextResponse.json({
      associateId,
      value: chargeValue,
      billingType: "BOLETO",
      paymentId: charge.payment?.id,
      invoiceUrl: charge.payment?.invoiceUrl,
      bankSlipUrl: charge.bankSlipUrl || charge.payment?.bankSlipUrl || charge.payment?.invoiceUrl || null,
      bankSlipBarcode: charge.identificationField || null,
      identificationField: charge.identificationField || null,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Não foi possível gerar a cobrança." },
      { status: 422 },
    )
  }
}

export async function PATCH(request: Request) {
  if (!(await hasClinicSession())) {
    return NextResponse.json({ error: "Entre no painel da clínica." }, { status: 401 })
  }
  const admin = createSupabaseAdmin()
  if (!admin) return NextResponse.json({ error: "Banco de dados indisponível." }, { status: 503 })

  try {
    const body = (await request.json().catch(() => ({}))) as {
      id?: string
      name?: string
      cpf?: string
      phone?: string
      email?: string
      status?: AssociateStatus
      overdueMonths?: number
    }

    if (!body.id) {
      return NextResponse.json({ error: "ID do associado é obrigatório." }, { status: 422 })
    }

    const updatePayload: Record<string, any> = {}
    if (body.name?.trim()) updatePayload.name = body.name.trim()
    if (body.phone?.trim()) updatePayload.phone = body.phone.trim()
    if (body.email?.trim()) updatePayload.email = body.email.trim().toLowerCase()
    
    const validStatuses = ["active", "inactive", "overdue", "cancelled"]
    if (body.status && validStatuses.includes(body.status)) {
      updatePayload.status = body.status
      if (body.status === "active") {
        updatePayload.last_paid_at = new Date().toISOString()
      }
    }

    if (body.overdueMonths !== undefined) {
      updatePayload.overdue_months = Math.max(0, Number(body.overdueMonths) || 0)
    }

    const { data, error } = await admin
      .from("associates")
      .update(updatePayload)
      .eq("id", body.id)
      .select("id, name, cpf, phone, email, status, overdue_months, next_due_date, last_paid_at")
      .maybeSingle()

    if (error || !data) {
      return NextResponse.json({ error: "Não foi possível atualizar o associado." }, { status: 500 })
    }
    return NextResponse.json({
      ok: true,
      associate: {
        id: data.id,
        name: data.name,
        cpf: data.cpf,
        phone: data.phone,
        email: data.email,
        status: data.status,
        overdueMonths: data.overdue_months ?? 0,
        nextDueDate: data.next_due_date ?? null,
        lastPaidAt: data.last_paid_at ?? null,
      },
    })
  } catch {
    return NextResponse.json({ error: "Erro ao atualizar associado." }, { status: 500 })
  }
}
