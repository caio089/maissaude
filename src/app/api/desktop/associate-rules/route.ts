import { NextResponse } from "next/server"

import { associateRulesError } from "@/lib/associate-rules"
import { hasClinicSession } from "@/lib/clinic-session"
import { createSupabaseAdmin } from "@/lib/supabase/admin"
import type { AssociateRules } from "@/lib/types"

export async function GET() {
  if (!(await hasClinicSession())) return NextResponse.json({ error: "Entre no painel da clínica." }, { status: 401 })
  const admin = createSupabaseAdmin()
  if (!admin) return NextResponse.json({ error: "Banco de dados indisponível." }, { status: 503 })

  const { data, error } = await admin
    .from("associate_rules")
    .select("fee,consultation_discount_percent,transport_enabled,transport_rides_per_month,extra_benefits")
    .eq("id", true)
    .maybeSingle()
  if (error) return NextResponse.json({ error: "Não foi possível carregar as regras." }, { status: 500 })
  if (!data) return NextResponse.json({ error: "As regras ainda não foram configuradas." }, { status: 404 })

  return NextResponse.json({ rules: fromDatabase(data) })
}

export async function PUT(request: Request) {
  if (!(await hasClinicSession())) return NextResponse.json({ error: "Entre no painel da clínica." }, { status: 401 })
  const admin = createSupabaseAdmin()
  if (!admin) return NextResponse.json({ error: "Banco de dados indisponível." }, { status: 503 })

  try {
    const body = await request.json() as Partial<AssociateRules>
    const rules: AssociateRules = {
      fee: Number(body.fee),
      consultationDiscountPercent: Number(body.consultationDiscountPercent),
      transportEnabled: body.transportEnabled === true,
      transportRidesPerMonth: Number(body.transportRidesPerMonth),
      extraBenefits: Array.isArray(body.extraBenefits)
        ? body.extraBenefits.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean)
        : [],
    }
    const message = associateRulesError(rules)
    if (message) return NextResponse.json({ error: message }, { status: 422 })

    const { error } = await admin.from("associate_rules").upsert({
      id: true,
      fee: rules.fee,
      consultation_discount_percent: rules.consultationDiscountPercent,
      transport_enabled: rules.transportEnabled,
      transport_rides_per_month: rules.transportRidesPerMonth,
      extra_benefits: rules.extraBenefits,
    })
    if (error) return NextResponse.json({ error: "Não foi possível salvar as regras." }, { status: 422 })
    return NextResponse.json({ rules })
  } catch {
    return NextResponse.json({ error: "Revise os valores informados." }, { status: 422 })
  }
}

function fromDatabase(data: {
  fee: number | string
  consultation_discount_percent: number | string
  transport_enabled: boolean
  transport_rides_per_month: number | string
  extra_benefits: unknown
}): AssociateRules {
  return {
    fee: Number(data.fee),
    consultationDiscountPercent: Number(data.consultation_discount_percent),
    transportEnabled: data.transport_enabled,
    transportRidesPerMonth: Number(data.transport_rides_per_month),
    extraBenefits: Array.isArray(data.extra_benefits) ? data.extra_benefits.filter((item): item is string => typeof item === "string") : [],
  }
}
