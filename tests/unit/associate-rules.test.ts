import { describe, expect, it } from "vitest"
import {
  associateRulesError,
  DEFAULT_ASSOCIATE_RULES,
  evaluateAssociateStatus,
  calculateAssociateQuote,
  findActiveAssociate,
} from "@/lib/associate-rules"
import type { Associate } from "@/lib/types"

describe("mensalidade de associado em testes", () => {
  it("aceita mensalidade abaixo de R$ 50", () => {
    expect(associateRulesError({ ...DEFAULT_ASSOCIATE_RULES, fee: 5 })).toBeNull()
    expect(associateRulesError({ ...DEFAULT_ASSOCIATE_RULES, fee: 10 })).toBeNull()
  })

  it("recusa mensalidade abaixo do mínimo do cartão", () => {
    expect(associateRulesError({ ...DEFAULT_ASSOCIATE_RULES, fee: 0 })).toBeTruthy()
    expect(associateRulesError({ ...DEFAULT_ASSOCIATE_RULES, fee: 1 })).toBeTruthy()
  })
})

describe("associate-rules: avaliação de status e carência", () => {
  it("classifica associado com 0 meses de atraso como ativo", () => {
    const res = evaluateAssociateStatus({ status: "active", overdueMonths: 0 })
    expect(res.status).toBe("active")
    expect(res.graceEligible).toBe(true)
    expect(res.canReceiveDiscount).toBe(true)
  })

  it("classifica associado com 1 ou 2 meses de atraso como overdue (em carência)", () => {
    const res1 = evaluateAssociateStatus({ status: "active", overdueMonths: 1 })
    expect(res1.status).toBe("overdue")
    expect(res1.graceEligible).toBe(true)
    expect(res1.canReceiveDiscount).toBe(false) // Precisa quitar para liberar desconto

    const res2 = evaluateAssociateStatus({ status: "overdue", overdueMonths: 2 })
    expect(res2.status).toBe("overdue")
    expect(res2.graceEligible).toBe(true)
  })

  it("classifica associado com 3 ou mais meses de atraso como cancelado", () => {
    const res = evaluateAssociateStatus({ status: "active", overdueMonths: 3 })
    expect(res.status).toBe("cancelled")
    expect(res.graceEligible).toBe(false)
    expect(res.canReceiveDiscount).toBe(false)
  })
})

describe("associate-rules: cálculo de checkout e opções de inadimplência", () => {
  const rules = { ...DEFAULT_ASSOCIATE_RULES, fee: 35, consultationDiscountPercent: 20 }
  const activeAssociate: Associate = {
    id: "ass-1",
    name: "Maria Silva",
    cpf: "123.456.789-00",
    phone: "11999999999",
    email: "maria@example.com",
    status: "active",
    overdueMonths: 0,
    createdAt: "2026-01-01T00:00:00Z",
  }
  const overdueAssociate: Associate = {
    ...activeAssociate,
    id: "ass-2",
    status: "overdue",
    overdueMonths: 2,
  }

  it("calcula desconto automático para associado ativo", () => {
    const quote = calculateAssociateQuote({ listPrice: 100, rules, associate: activeAssociate })
    expect(quote.consultationPrice).toBe(80)
    expect(quote.overdueSettlementFee).toBe(0)
    expect(quote.totalAmount).toBe(80)
    expect(quote.discountApplied).toBe(true)
    expect(quote.savings).toBe(20)
  })

  it("permite associado em atraso quitar mensalidades pendentes e obter desconto", () => {
    const quote = calculateAssociateQuote({
      listPrice: 100,
      rules,
      associate: overdueAssociate,
      settleOverdue: true,
    })
    // 2 meses de atraso: 2 * 35 = 70. Consulta com 20% desconto = 80. Total = 150.
    expect(quote.consultationPrice).toBe(80)
    expect(quote.overdueSettlementFee).toBe(70)
    expect(quote.totalAmount).toBe(150)
    expect(quote.discountApplied).toBe(true)
    expect(quote.savings).toBe(20)
  })

  it("permite associado em atraso pagar consulta cheia sem quitar mensalidade naquele momento", () => {
    const quote = calculateAssociateQuote({
      listPrice: 100,
      rules,
      associate: overdueAssociate,
      settleOverdue: false,
    })
    expect(quote.consultationPrice).toBe(100)
    expect(quote.overdueSettlementFee).toBe(0)
    expect(quote.totalAmount).toBe(100)
    expect(quote.discountApplied).toBe(false)
    expect(quote.savings).toBe(0)
  })

  it("calcula valor cheio para não associado e indica potencial de economia", () => {
    const quote = calculateAssociateQuote({ listPrice: 100, rules, associate: null })
    expect(quote.consultationPrice).toBe(100)
    expect(quote.overdueSettlementFee).toBe(0)
    expect(quote.totalAmount).toBe(100)
    expect(quote.discountApplied).toBe(false)
    expect(quote.savings).toBe(20) // Mostra quanto economizaria
  })
})

describe("associate-rules: busca de associado ativo ou em carência", () => {
  const associates: Associate[] = [
    {
      id: "ass-1",
      name: "Maria Silva",
      cpf: "123.456.789-00",
      phone: "11999999999",
      email: "maria@example.com",
      status: "active",
      overdueMonths: 0,
      createdAt: "2026-01-01T00:00:00Z",
    },
    {
      id: "ass-2",
      name: "João Santos",
      cpf: "234.567.890-11",
      phone: "11988888888",
      email: "joao@example.com",
      status: "overdue",
      overdueMonths: 2,
      createdAt: "2026-01-01T00:00:00Z",
    },
    {
      id: "ass-3",
      name: "Ana Costa",
      cpf: "345.678.901-22",
      phone: "11977777777",
      email: "ana@example.com",
      status: "cancelled",
      overdueMonths: 4,
      createdAt: "2026-01-01T00:00:00Z",
    },
  ]

  it("encontra associado ativo por CPF formatado ou numérico", () => {
    expect(findActiveAssociate(associates, "123.456.789-00")?.id).toBe("ass-1")
    expect(findActiveAssociate(associates, "12345678900")?.id).toBe("ass-1")
  })

  it("encontra associado em atraso que ainda está em carência", () => {
    expect(findActiveAssociate(associates, "234.567.890-11")?.id).toBe("ass-2")
  })

  it("não retorna associado cancelado", () => {
    expect(findActiveAssociate(associates, "345.678.901-22")).toBeNull()
  })
})
