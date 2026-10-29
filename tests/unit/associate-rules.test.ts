import { describe, expect, it } from "vitest"

import { associateRulesError, DEFAULT_ASSOCIATE_RULES } from "@/lib/associate-rules"

describe("mensalidade de associado em testes", () => {
  it("aceita mensalidade abaixo de R$ 50", () => {
    expect(associateRulesError({ ...DEFAULT_ASSOCIATE_RULES, fee: 1 })).toBeNull()
    expect(associateRulesError({ ...DEFAULT_ASSOCIATE_RULES, fee: 10 })).toBeNull()
  })

  it("recusa mensalidade zerada", () => {
    expect(associateRulesError({ ...DEFAULT_ASSOCIATE_RULES, fee: 0 })).toBeTruthy()
  })
})
