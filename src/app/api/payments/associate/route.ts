import { NextResponse } from "next/server"

import { createAssociateCardPaymentLink } from "@/lib/asaas/payment-links"
import { cpfDigits, formatCpf, isValidCpf } from "@/lib/cpf"
import { createId } from "@/lib/format"
import { hasClinicSession } from "@/lib/clinic-session"
import { createSupabaseAdmin } from "@/lib/supabase/admin"
import type { Patient } from "@/lib/types"
import { hasErrors, validatePatientInput } from "@/lib/validation"

type RequestBody = {
  name?: string
  cpf?: string
  phone?: string
  email?: string
  patientId?: string
  patient?: Patient
}

export async function GET() {
  if (!(await hasClinicSession())) return NextResponse.json({ error: "Entre no painel da clínica." }, { status: 401 })
  const admin = createSupabaseAdmin()
  if (!admin) return NextResponse.json({ error: "Banco de dados indisponível." }, { status: 503 })
  const [patientsResult, associatesResult, rulesResult] = await Promise.all([
    admin.from("patients").select("id,name,cpf,phone,email,status").eq("status", "active").order("name"),
    admin.from("associates").select("id,name,cpf,phone,email,status,created_at").order("name"),
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
    const body = (await request.json()) as RequestBody
    const name = body.name?.trim() || ""
    const cpf = cpfDigits(body.cpf || "")
    const phone = body.phone?.trim() || ""
    const email = body.email?.trim().toLowerCase() || ""
    if (name.length < 3 || !isValidCpf(cpf) || !/^\+?[\d\s().-]{10,20}$/.test(phone) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Revise nome, CPF, telefone e e-mail do associado." }, { status: 422 })
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

    const { data: existing, error: existingError } = await admin.from("associates").select("id,status").in("cpf", [cpf, formatCpf(cpf)]).maybeSingle()
    if (existingError) throw existingError
    if (existing?.status === "active") return NextResponse.json({ error: "Este CPF já está cadastrado como associado ativo." }, { status: 409 })
    const associateId = existing?.id || createId("ass")
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
    const { data: previousSubscription, error: previousError } = await admin
      .from("asaas_subscriptions").select("id").eq("associate_id", associateId).limit(1).maybeSingle()
    if (previousError) throw previousError
    if (previousSubscription) {
      return NextResponse.json({ error: "Este associado tem uma assinatura anterior. A renovação ainda precisa ser regularizada antes de gerar outra cobrança." }, { status: 409 })
    }
    if (patientId) {
      const { data: patientSubscription, error: patientSubscriptionError } = await admin
        .from("asaas_subscriptions").select("id").eq("patient_id", patientId)
        .not("status", "in", '("DELETED","INACTIVE")').limit(1).maybeSingle()
      if (patientSubscriptionError) throw patientSubscriptionError
      if (patientSubscription) return NextResponse.json({ error: "Este paciente já tem uma assinatura ativa." }, { status: 409 })
    }

    const { error: associateError } = await admin.from("associates").upsert({ id: associateId, name, cpf, phone, email, status: "inactive" })
    if (associateError) return NextResponse.json({ error: associateError.message }, { status: 422 })

    const paymentLink = await createAssociateCardPaymentLink({ associateId, name, value: fee })

    return NextResponse.json({
      associateId,
      value: fee,
      paymentUrl: paymentLink.url,
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
    const body = (await request.json()) as {
      id?: string
      name?: string
      cpf?: string
      phone?: string
      email?: string
      status?: "active" | "inactive"
    }

    if (!body.id) {
      return NextResponse.json({ error: "ID do associado é obrigatório." }, { status: 422 })
    }

    const updatePayload: Record<string, string> = {}
    if (body.name?.trim()) updatePayload.name = body.name.trim()
    if (body.phone?.trim()) updatePayload.phone = body.phone.trim()
    if (body.email?.trim()) updatePayload.email = body.email.trim().toLowerCase()
    if (body.status === "active" || body.status === "inactive") updatePayload.status = body.status

    const { data, error } = await admin
      .from("associates")
      .update(updatePayload)
      .eq("id", body.id)
      .select("id, name, cpf, phone, email, status")
      .maybeSingle()

    if (error) {
      return NextResponse.json({ error: "Não foi possível atualizar o associado." }, { status: 500 })
    }
    return NextResponse.json({ ok: true, associate: data })
  } catch {
    return NextResponse.json({ error: "Erro ao atualizar associado." }, { status: 500 })
  }
}
