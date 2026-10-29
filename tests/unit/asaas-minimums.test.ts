import { describe, expect, it } from "vitest"

import { minimumAsaasCharge, minimumAsaasChargeMessage } from "@/lib/asaas/minimums"

describe("valores mínimos da Asaas", () => {
  it("usa R$ 10 para Pix e R$ 5 para cartão", () => {
    expect(minimumAsaasCharge("PIX")).toBe(10)
    expect(minimumAsaasCharge("CREDIT_CARD")).toBe(5)
  })

  it("explica o limite ao paciente", () => {
    expect(minimumAsaasChargeMessage("PIX")).toContain("R$ 10")
    expect(minimumAsaasChargeMessage("CREDIT_CARD")).toContain("R$ 5")
  })
})
