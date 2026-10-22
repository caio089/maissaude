export function digitsOnly(value: string) {
  return value.replace(/\D/g, "")
}

export function saoPauloDate(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(now)
}

export function moneyValue(value: number) {
  return Number(value.toFixed(2))
}

export function asaasBillingType(value?: string) {
  if (value === "PIX" || value === "CREDIT_CARD" || value === "BOLETO" || value === "UNDEFINED") {
    return value
  }
  return "UNDEFINED" as const
}
