import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import { cpfDigits, formatCpf } from "@/lib/cpf"
import { paymentQuoteAmount } from "@/lib/payments/quote-rules"
import type { CatalogKind } from "@/lib/types"

export type CartPaymentLineInput = {
  professionalId?: string
  serviceId?: string
  date?: string
  time?: string
}

export type CartQuote = {
  associate: {
    active: boolean
    discountPercent: number
    fee: number
  }
  lines: Array<{
    professionalId: string
    serviceId: string
    kind: CatalogKind
    listPrice: number
    amount: number
  }>
  listTotal: number
  total: number
  discount: number
}

export async function getCartQuote(
  admin: SupabaseClient,
  patientCpf: string,
  inputLines: CartPaymentLineInput[] | undefined,
): Promise<CartQuote> {
  const lines = Array.isArray(inputLines) ? inputLines.slice(0, 5) : []
  if (lines.length === 0) throw new Error("Inclua ao menos um atendimento.")

  const normalized = lines.map((line) => {
    const professionalId = line.professionalId?.trim() || ""
    const serviceId = line.serviceId?.trim() || ""
    if (!professionalId || !serviceId) throw new Error("Um dos atendimentos está incompleto.")
    return { professionalId, serviceId }
  })
  const serviceIds = [...new Set(normalized.map((line) => line.serviceId))]
  const cpf = cpfDigits(patientCpf)

  const [servicesResult, offersResult, associateResult, rulesResult] = await Promise.all([
    admin.from("professional_services").select("id,professional_id,price").in("id", serviceIds),
    admin.from("catalog_offers").select("id,kind").in("id", serviceIds),
    admin.from("associates").select("status").in("cpf", [cpf, formatCpf(cpf)]).limit(1).maybeSingle(),
    admin.from("associate_rules").select("fee,consultation_discount_percent").eq("id", true).maybeSingle(),
  ])

  if (servicesResult.error || offersResult.error || associateResult.error || rulesResult.error) {
    throw new Error("Não foi possível conferir os valores e a associação.")
  }

  const associateActive = associateResult.data?.status === "active"
  const configuredDiscount = Number(rulesResult.data?.consultation_discount_percent) || 0
  const discountPercent = associateActive ? Math.min(80, Math.max(0, configuredDiscount)) : 0
  const fee = Number(rulesResult.data?.fee) || 0

  const quotedLines = normalized.map((line) => {
    const service = servicesResult.data.find((item) => item.id === line.serviceId && item.professional_id === line.professionalId)
    if (!service) throw new Error("Serviço ou profissional indisponível.")
    const offer = offersResult.data.find((item) => item.id === line.serviceId)
    const kind: CatalogKind = offer?.kind === "exame" || offer?.kind === "cirurgia" ? offer.kind : "consulta"
    const listPrice = Number(service.price)
    if (!Number.isFinite(listPrice) || listPrice <= 0) throw new Error("O atendimento está sem valor válido.")
    const amount = paymentQuoteAmount({ kind, listPrice, associateActive, discountPercent })
    return { ...line, kind, listPrice, amount }
  })

  const listTotal = money(quotedLines.reduce((sum, line) => sum + line.listPrice, 0))
  const total = money(quotedLines.reduce((sum, line) => sum + line.amount, 0))
  return {
    associate: { active: associateActive, discountPercent, fee },
    lines: quotedLines,
    listTotal,
    total,
    discount: money(listTotal - total),
  }
}

function money(value: number) {
  return Math.round(value * 100) / 100
}
