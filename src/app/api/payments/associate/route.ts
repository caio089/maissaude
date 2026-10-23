import { NextResponse } from "next/server"

import { createAsaasSubscription } from "@/lib/asaas/subscriptions"
import { cpfDigits, isValidCpf } from "@/lib/cpf"
import { createId } from "@/lib/format"
import { hasClinicSession } from "@/lib/clinic-session"
import { createSupabaseAdmin } from "@/lib/supabase/admin"

type RequestBody = {
  name?: string
  cpf?: string
  phone?: string
  email?: string
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

    const { data: rules } = await admin.from("associate_rules").select("fee").eq("id", true).maybeSingle()
    const fee = Number(rules?.fee)
    if (!Number.isFinite(fee) || fee <= 0) {
      return NextResponse.json({ error: "A mensalidade ainda não foi configurada." }, { status: 422 })
    }

    const { data: existing } = await admin.from("associates").select("id").eq("cpf", cpf).maybeSingle()
    const associateId = existing?.id || createId("ass")
    const { error: associateError } = await admin.from("associates").upsert({
      id: associateId,
      name,
      cpf,
      phone,
      email,
      status: "inactive",
    })
    if (associateError) return NextResponse.json({ error: associateError.message }, { status: 422 })

    const { data: activeSubscription } = await admin
      .from("asaas_subscriptions")
      .select("id")
      .eq("associate_id", associateId)
      .not("status", "in", '("DELETED","INACTIVE")')
      .maybeSingle()
    if (activeSubscription) {
      return NextResponse.json({ error: "Este associado já tem uma assinatura ativa." }, { status: 409 })
    }

    const result = await createAsaasSubscription({
      name,
      cpf,
      email,
      mobilePhone: phone,
      associateId,
      value: fee,
      billingType: "PIX",
      description: "Mensalidade de associado CuidarSaude",
      externalReference: associateId,
    })

    return NextResponse.json({
      associateId,
      subscriptionId: result.subscription.id,
      value: result.subscription.value,
      invoiceUrl: result.payment?.invoiceUrl || null,
      pix: result.pix ? { payload: result.pix.payload || null, encodedImage: result.pix.encodedImage || null } : null,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Não foi possível gerar a cobrança." },
      { status: 422 },
    )
  }
}
