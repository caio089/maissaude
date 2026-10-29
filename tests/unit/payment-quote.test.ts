import { describe, expect, it } from "vitest"

import { paymentQuoteAmount } from "@/lib/payments/quote-rules"

describe("regras do valor para associado", () => {
  it("aplica o desconto somente em consulta de associado ativo", () => {
    expect(paymentQuoteAmount({ kind: "consulta", listPrice: 120, associateActive: true, discountPercent: 20 })).toBe(96)
  })

  it("não aplica desconto de consulta a exames ou cirurgias", () => {
    expect(paymentQuoteAmount({ kind: "exame", listPrice: 120, associateActive: true, discountPercent: 20 })).toBe(120)
    expect(paymentQuoteAmount({ kind: "cirurgia", listPrice: 500, associateActive: true, discountPercent: 20 })).toBe(500)
  })

  it("não aplica desconto quando a associação está inativa", () => {
    expect(paymentQuoteAmount({ kind: "consulta", listPrice: 120, associateActive: false, discountPercent: 20 })).toBe(120)
  })
})
