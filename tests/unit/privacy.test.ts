import { describe, expect, it } from "vitest"
import { maskCpf } from "@/lib/privacy"

describe("minimização de dados pessoais", () => {
  it("mostra somente os dois últimos dígitos do CPF", () => {
    expect(maskCpf("529.982.247-25")).toBe("***.***.***-25")
  })

  it("não repete um CPF inválido", () => {
    expect(maskCpf("123")).toBe("CPF protegido")
  })
})
