export type SupportedAsaasBillingType = "PIX" | "CREDIT_CARD" | "BOLETO"

export const ASAAS_PIX_MINIMUM = 10
export const ASAAS_CARD_MINIMUM = 5
export const ASAAS_BOLETO_MINIMUM = 5

export function minimumAsaasCharge(billingType: SupportedAsaasBillingType) {
  if (billingType === "PIX") return ASAAS_PIX_MINIMUM
  if (billingType === "BOLETO") return ASAAS_BOLETO_MINIMUM
  return ASAAS_CARD_MINIMUM
}

export function minimumAsaasChargeMessage(billingType: SupportedAsaasBillingType) {
  if (billingType === "PIX") {
    return "Para gerar Pix na Asaas, cada atendimento precisa ficar em pelo menos R$ 10 após os descontos."
  }
  if (billingType === "BOLETO") {
    return "Para gerar boleto na Asaas, o valor mínimo é de R$ 5."
  }
  return "Para pagar com cartão na Asaas, cada atendimento precisa ficar em pelo menos R$ 5 após os descontos."
}
