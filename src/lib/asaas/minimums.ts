export type SupportedAsaasBillingType = "PIX" | "CREDIT_CARD"

export const ASAAS_PIX_MINIMUM = 10
export const ASAAS_CARD_MINIMUM = 5

export function minimumAsaasCharge(billingType: SupportedAsaasBillingType) {
  return billingType === "PIX" ? ASAAS_PIX_MINIMUM : ASAAS_CARD_MINIMUM
}

export function minimumAsaasChargeMessage(billingType: SupportedAsaasBillingType) {
  return billingType === "PIX"
    ? "Para gerar Pix na Asaas, cada atendimento precisa ficar em pelo menos R$ 10 após os descontos."
    : "Para pagar com cartão na Asaas, cada atendimento precisa ficar em pelo menos R$ 5 após os descontos."
}
