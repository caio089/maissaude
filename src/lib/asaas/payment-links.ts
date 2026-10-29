import "server-only"

import { asaasFetch } from "@/lib/asaas/client"
import { moneyValue } from "@/lib/asaas/format"
import { ASAAS_CARD_MINIMUM } from "@/lib/asaas/minimums"
import type { AsaasPaymentLink, AsaasPaymentLinkList } from "@/lib/asaas/types"

export async function createAssociateCardPaymentLink(input: {
  associateId: string
  name: string
  value: number
  successUrl?: string
}) {
  if (!Number.isFinite(input.value) || input.value < ASAAS_CARD_MINIMUM || input.value > 500) {
    throw new Error("Informe um valor válido para a mensalidade.")
  }

  const externalReference = `associate:${input.associateId}`
  const body = {
    name: `Assinatura CuidarSaude · ${input.name}`.slice(0, 255),
    description: "Mensalidade recorrente de associado CuidarSaude".slice(0, 500),
    billingType: "CREDIT_CARD",
    chargeType: "RECURRENT",
    subscriptionCycle: "MONTHLY",
    value: moneyValue(input.value),
    externalReference,
    notificationEnabled: true,
    isAddressRequired: false,
    ...(input.successUrl ? { callback: { successUrl: input.successUrl, autoRedirect: true } } : {}),
  }
  const existing = await findActivePaymentLink(externalReference)
  const link = await asaasFetch<AsaasPaymentLink>(existing?.id ? `/paymentLinks/${encodeURIComponent(existing.id)}` : "/paymentLinks", {
    method: existing?.id ? "PUT" : "POST",
    body: JSON.stringify(body),
  })

  if (!link.id || !link.url) throw new Error("A Asaas não retornou o link de pagamento.")
  return link
}

async function findActivePaymentLink(externalReference: string) {
  try {
    const result = await asaasFetch<AsaasPaymentLinkList>(
      `/paymentLinks?externalReference=${encodeURIComponent(externalReference)}&active=true&limit=1`,
    )
    return result.data?.find((link) => link.id && link.url && !link.deleted) || null
  } catch {
    return null
  }
}
