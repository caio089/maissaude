import "server-only"

import { asaasFetch } from "@/lib/asaas/client"
import { moneyValue } from "@/lib/asaas/format"
import type { AsaasPaymentLink } from "@/lib/asaas/types"

export async function createAssociateCardPaymentLink(input: {
  associateId: string
  name: string
  value: number
}) {
  if (!Number.isFinite(input.value) || input.value <= 0 || input.value > 500) {
    throw new Error("Informe um valor válido para a mensalidade.")
  }

  const link = await asaasFetch<AsaasPaymentLink>("/paymentLinks", {
    method: "POST",
    body: JSON.stringify({
      name: `Assinatura CuidarSaude · ${input.name}`.slice(0, 255),
      description: "Mensalidade recorrente de associado CuidarSaude".slice(0, 500),
      billingType: "CREDIT_CARD",
      chargeType: "RECURRENT",
      subscriptionCycle: "MONTHLY",
      value: moneyValue(input.value),
      externalReference: `associate:${input.associateId}`,
      notificationEnabled: true,
      isAddressRequired: false,
    }),
  })

  if (!link.id || !link.url) throw new Error("A Asaas não retornou o link de pagamento.")
  return link
}
