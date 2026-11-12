import { describe, expect, it } from "vitest"
import {
  formatCardNumber,
  formatCardExpiry,
  formatCep,
  validateCreditCardForm,
} from "@/components/shared/credit-card-form"

describe("credit card form helpers and validation", () => {
  it("formata número de cartão com espaços a cada 4 dígitos", () => {
    expect(formatCardNumber("4111111111111111")).toBe("4111 1111 1111 1111")
    expect(formatCardNumber("4111 abc 1111")).toBe("4111 1111")
  })

  it("formata validade no padrão MM/AA", () => {
    expect(formatCardExpiry("12")).toBe("12")
    expect(formatCardExpiry("1228")).toBe("12/28")
  })

  it("formata CEP no padrão 00000-000", () => {
    expect(formatCep("64000000")).toBe("64000-000")
  })

  it("valida formulário de cartão completo e válido", () => {
    const currentYear = new Date().getFullYear() + 2
    const errors = validateCreditCardForm({
      number: "4111111111111111",
      holderName: "MARCELO SILVA",
      expiryMonth: "12",
      expiryYear: String(currentYear),
      ccv: "123",
      postalCode: "64000000",
      addressNumber: "123",
    })
    expect(Object.keys(errors)).toHaveLength(0)
  })

  it("identifica erros quando campos obrigatórios estão ausentes ou inválidos", () => {
    const errors = validateCreditCardForm({
      number: "123",
      holderName: "",
      expiryMonth: "13",
      expiryYear: "2020",
      ccv: "1",
      postalCode: "123",
      addressNumber: "",
    })
    expect(errors.number).toBeDefined()
    expect(errors.holderName).toBeDefined()
    expect(errors.expiry).toBeDefined()
    expect(errors.ccv).toBeDefined()
    expect(errors.postalCode).toBeDefined()
    expect(errors.addressNumber).toBeDefined()
  })
})
