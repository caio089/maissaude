import { describe, expect, it } from "vitest"
import { cartLineKey, catalogOfferFor, offersFor } from "@/lib/mobile-catalog"
import { TEST_PROFESSIONALS } from "../fixtures/mobile"

describe("catálogo do agendamento mobile", () => {
  it("separa consulta, exame e cirurgia sem misturar serviços", () => {
    expect(offersFor("consulta", TEST_PROFESSIONALS)).toHaveLength(2)
    expect(offersFor("exame", TEST_PROFESSIONALS).map((offer) => offer.serviceName)).toEqual(["Avaliação clínica"])
    expect(offersFor("cirurgia", TEST_PROFESSIONALS).map((offer) => offer.serviceName)).toEqual(["Pequeno procedimento"])
  })

  it("não mostra serviços de profissional inativo", () => {
    const inactive = [{ ...TEST_PROFESSIONALS[0], active: false }]
    expect(offersFor("consulta", inactive)).toEqual([])
  })

  it("gera uma chave diferente para cada data e horário", () => {
    expect(cartLineKey({ serviceId: "consulta", date: "2026-10-29", time: "08:00" })).toBe("consulta-2026-10-29-08:00")
    expect(cartLineKey({ serviceId: "consulta", date: "2026-10-29", time: "08:40" })).not.toBe("consulta-2026-10-29-08:00")
  })

  it("recupera a oferta escolhida durante a revisão", () => {
    const offer = catalogOfferFor(
      { kind: "consulta", professionalId: "pro-test-mobile", serviceId: "svc-consulta-video" },
      TEST_PROFESSIONALS,
    )
    expect(offer).toMatchObject({ serviceName: "Teleconsulta", price: 100 })
  })
})
