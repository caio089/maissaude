import { describe, expect, it } from "vitest"
import { calculateAssociateQuote, DEFAULT_ASSOCIATE_RULES, evaluateAssociateStatus } from "@/lib/associate-rules"

describe("mobile payment associate decisions", () => {
  const rules = { ...DEFAULT_ASSOCIATE_RULES, fee: 35, consultationDiscountPercent: 20 }

  it("calcula economia correta para o card 'Não sou associado'", () => {
    const listPrice = 150
    const quote = calculateAssociateQuote({ listPrice, rules, associate: null })
    expect(quote.potentialSavings).toBe(30) // 20% de 150 = 30
    expect(quote.totalAmount).toBe(150)
    expect(quote.discountApplied).toBe(false)
  })

  it("calcula opções para associado em carência (1 mês de atraso)", () => {
    const associate = {
      id: "a1",
      name: "Ana",
      cpf: "123",
      phone: "1",
      email: "a@a.com",
      status: "overdue" as const,
      overdueMonths: 1,
      createdAt: "2026-01-01",
    }
    const settleQuote = calculateAssociateQuote({ listPrice: 150, rules, associate, settleOverdue: true })
    expect(settleQuote.consultationPrice).toBe(120)
    expect(settleQuote.overdueSettlementFee).toBe(35)
    expect(settleQuote.totalAmount).toBe(120 + 35) // 155
    expect(settleQuote.discountApplied).toBe(true)

    const normalQuote = calculateAssociateQuote({ listPrice: 150, rules, associate, settleOverdue: false })
    expect(normalQuote.consultationPrice).toBe(150)
    expect(normalQuote.overdueSettlementFee).toBe(0)
    expect(normalQuote.totalAmount).toBe(150)
    expect(normalQuote.discountApplied).toBe(false)
  })

  it("calcula opções para associado em carência com múltiplos meses de atraso", () => {
    const associate = {
      id: "a2",
      name: "Carlos",
      cpf: "456",
      phone: "2",
      email: "c@c.com",
      status: "overdue" as const,
      overdueMonths: 2,
      createdAt: "2026-01-01",
    }
    const settleQuote = calculateAssociateQuote({ listPrice: 200, rules, associate, settleOverdue: true })
    expect(settleQuote.consultationPrice).toBe(160) // 200 * 0.8
    expect(settleQuote.overdueSettlementFee).toBe(70) // 2 * 35
    expect(settleQuote.totalAmount).toBe(230)
    expect(settleQuote.discountApplied).toBe(true)

    const normalQuote = calculateAssociateQuote({ listPrice: 200, rules, associate, settleOverdue: false })
    expect(normalQuote.consultationPrice).toBe(200)
    expect(normalQuote.overdueSettlementFee).toBe(0)
    expect(normalQuote.totalAmount).toBe(200)
  })

  it("aplica desconto automaticamente para associado ativo em dia", () => {
    const associate = {
      id: "a3",
      name: "Mariana",
      cpf: "789",
      phone: "3",
      email: "m@m.com",
      status: "active" as const,
      overdueMonths: 0,
      createdAt: "2026-01-01",
    }
    const quote = calculateAssociateQuote({ listPrice: 150, rules, associate })
    expect(quote.consultationPrice).toBe(120)
    expect(quote.overdueSettlementFee).toBe(0)
    expect(quote.totalAmount).toBe(120)
    expect(quote.discountApplied).toBe(true)
    expect(quote.savings).toBe(30)
  })

  it("não concede desconto para associado cancelado", () => {
    const associate = {
      id: "a4",
      name: "Pedro",
      cpf: "999",
      phone: "4",
      email: "p@p.com",
      status: "cancelled" as const,
      overdueMonths: 4,
      createdAt: "2026-01-01",
    }
    const quote = calculateAssociateQuote({ listPrice: 150, rules, associate })
    expect(quote.consultationPrice).toBe(150)
    expect(quote.overdueSettlementFee).toBe(0)
    expect(quote.totalAmount).toBe(150)
    expect(quote.discountApplied).toBe(false)
  })

  it("avalia status de carência corretamente conforme graceMonths", () => {
    const inGrace = evaluateAssociateStatus({ status: "overdue", overdueMonths: 2, graceMonths: 3 })
    expect(inGrace.status).toBe("overdue")
    expect(inGrace.graceEligible).toBe(true)
    expect(inGrace.canReceiveDiscount).toBe(false)

    const pastGrace = evaluateAssociateStatus({ status: "overdue", overdueMonths: 3, graceMonths: 3 })
    expect(pastGrace.status).toBe("cancelled")
    expect(pastGrace.graceEligible).toBe(false)
  })
})
