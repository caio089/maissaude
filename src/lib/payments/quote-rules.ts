import type { CatalogKind } from "@/lib/types"

export function paymentQuoteAmount(input: {
  kind: CatalogKind
  listPrice: number
  associateActive: boolean
  discountPercent: number
}) {
  if (input.kind !== "consulta" || !input.associateActive) return money(input.listPrice)
  const discount = Math.min(80, Math.max(0, input.discountPercent))
  return money(input.listPrice * (100 - discount) / 100)
}

function money(value: number) {
  return Math.round(value * 100) / 100
}
