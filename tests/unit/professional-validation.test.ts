import { describe, expect, it } from "vitest"

import type { ProfessionalInput } from "@/lib/types"
import { validateProfessionalInput } from "@/lib/validation"

const professional: ProfessionalInput = {
  name: "Dra. Teste",
  specialty: "clinica-geral",
  credentialCode: "CRM123",
  bio: "Profissional criada para validar valores de teste.",
  price: 50,
  workDays: [1],
  startHour: "08:00",
  endHour: "12:00",
  active: true,
}

describe("valor de consulta em testes", () => {
  it("aceita valor abaixo de R$ 50", () => {
    expect(validateProfessionalInput({ ...professional, price: 10 }).price).toBeUndefined()
  })

  it("recusa valor abaixo do mínimo da Asaas ou acima do limite", () => {
    expect(validateProfessionalInput({ ...professional, price: 0 }).price).toBeTruthy()
    expect(validateProfessionalInput({ ...professional, price: 1 }).price).toBeTruthy()
    expect(validateProfessionalInput({ ...professional, price: 2000.01 }).price).toBeTruthy()
  })
})
