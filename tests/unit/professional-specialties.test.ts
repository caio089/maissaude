import { describe, expect, it, vi, beforeEach } from "vitest"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"

vi.mock("server-only", () => ({}))
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/desktop/profissionais",
}))
vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() },
}))

import {
  buildAvailableSpecialties,
  buildSpecialtyLabelMap,
  createSpecialtyAction,
  processPhotoFileInput,
  MAX_PHOTO_BYTES,
  ProfessionalsView,
  type ProfessionalsViewProps,
  type SpecialtyOption,
} from "@/components/desktop/professionals-view"
import type { Professional } from "@/lib/types"

const mockProfessional: Professional = {
  id: "pro-1",
  name: "Dr. João Cardiologista",
  specialty: "cardiologia",
  credentialLabel: "CRM",
  credentialCode: "12345/SP",
  bio: "Especialista em saúde do coração.",
  avatarSeed: "joao",
  location: "Consultório 1",
  price: 250,
  workDays: [1, 2, 3, 4],
  startHour: "08:00",
  endHour: "17:00",
  active: true,
  rating: 4.9,
  reviewCount: 10,
  reviews: [],
  services: [
    {
      id: "srv-1",
      name: "Consulta Cardiológica",
      durationMin: 30,
      price: 250,
      modality: "presencial",
      kind: "consulta",
    },
  ],
}

describe("buildAvailableSpecialties helper", () => {
  it("retorna especialidades padrão com nomes amigáveis quando a lista da API for vazia", () => {
    const list = buildAvailableSpecialties([])
    expect(list.length).toBeGreaterThanOrEqual(7)
    const cardiologia = list.find((item) => item.id === "cardiologia")
    expect(cardiologia).toBeDefined()
    expect(cardiologia?.name).toBe("Cardiologia")

    const clinicaGeral = list.find((item) => item.id === "clinica-geral")
    expect(clinicaGeral?.name).toBe("Clínica geral")
  })

  it("mescla especialidades dinâmicas da API sem duplicar por id", () => {
    const apiSpecs: SpecialtyOption[] = [
      { id: "cardiologia", name: "Cardiologia Avançada" },
      { id: "ortopedia-traumatologia", name: "Ortopedia e traumatologia" },
      { id: "endocrinologia", name: "Endocrinologia" },
    ]

    const list = buildAvailableSpecialties(apiSpecs)
    const cardiologia = list.find((item) => item.id === "cardiologia")
    expect(cardiologia?.name).toBe("Cardiologia Avançada")

    const orto = list.find((item) => item.id === "ortopedia-traumatologia")
    expect(orto?.name).toBe("Ortopedia e traumatologia")

    const endo = list.find((item) => item.id === "endocrinologia")
    expect(endo?.name).toBe("Endocrinologia")

    // Certifica que não há duplicidade de ids
    const ids = list.map((item) => item.id)
    const uniqueIds = new Set(ids)
    expect(uniqueIds.size).toBe(ids.length)
  })

  it("inclui a especialidade do formulário atual caso ela ainda não esteja na lista", () => {
    const list = buildAvailableSpecialties([], "oncologia-pediatrica")
    const onco = list.find((item) => item.id === "oncologia-pediatrica")
    expect(onco).toBeDefined()
    expect(onco?.id).toBe("oncologia-pediatrica")
  })

  it("ordena a lista final alfabeticamente por nome", () => {
    const apiSpecs: SpecialtyOption[] = [
      { id: "urologia", name: "Urologia" },
      { id: "alergologia", name: "Alergologia" },
    ]
    const list = buildAvailableSpecialties(apiSpecs)
    const names = list.map((item) => item.name)
    const sorted = [...names].sort((a, b) => a.localeCompare(b, "pt-BR"))
    expect(names).toEqual(sorted)
  })
})

describe("buildSpecialtyLabelMap helper", () => {
  it("mapeia identificadores de especialidades para seus rótulos legíveis", () => {
    const dynamicSpecs: SpecialtyOption[] = [
      { id: "reumatologia", name: "Reumatologia" },
      { id: "oftalmologia", name: "Oftalmologia Clínica" },
    ]
    const map = buildSpecialtyLabelMap(dynamicSpecs)

    expect(map["clinica-geral"]).toBe("Clínica geral")
    expect(map["reumatologia"]).toBe("Reumatologia")
    expect(map["oftalmologia"]).toBe("Oftalmologia Clínica")
  })
})

describe("createSpecialtyAction client helper", () => {
  it("rejeita nomes vazios ou com apenas espaços em branco", async () => {
    const mockFetch = vi.fn()
    const result1 = await createSpecialtyAction("", mockFetch)
    expect(result1.success).toBe(false)
    if (!result1.success) {
      expect(result1.error).toContain("Informe o nome da especialidade")
    }

    const result2 = await createSpecialtyAction("   ", mockFetch)
    expect(result2.success).toBe(false)
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it("rejeita nomes com menos de 3 caracteres ou mais de 60 caracteres", async () => {
    const mockFetch = vi.fn()
    const resultShort = await createSpecialtyAction("ab", mockFetch)
    expect(resultShort.success).toBe(false)
    if (!resultShort.success) {
      expect(resultShort.error).toContain("entre 3 e 60 caracteres")
    }

    const resultLong = await createSpecialtyAction("a".repeat(61), mockFetch)
    expect(resultLong.success).toBe(false)
    if (!resultLong.success) {
      expect(resultLong.error).toContain("entre 3 e 60 caracteres")
    }
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it("cadastra com sucesso uma nova especialidade enviando POST para a API", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ id: "endocrinologia", name: "Endocrinologia" }),
    })

    const result = await createSpecialtyAction("Endocrinologia", mockFetch)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.specialty.id).toBe("endocrinologia")
      expect(result.specialty.name).toBe("Endocrinologia")
    }

    expect(mockFetch).toHaveBeenCalledWith("/api/desktop/specialties", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Endocrinologia" }),
    })
  })

  it("retorna erro com a mensagem do servidor se a API retornar erro (ex: 403 atendente)", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({ error: "Atendentes possuem acesso somente leitura às especialidades." }),
    })

    const result = await createSpecialtyAction("Geriatria", mockFetch)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toBe("Atendentes possuem acesso somente leitura às especialidades.")
    }
  })

  it("trata falhas de rede de forma segura", async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error("Falha na conexão"))

    const result = await createSpecialtyAction("Pneumologia", mockFetch)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toBe("Falha na conexão")
    }
  })
})

describe("ProfessionalsView dynamic specialties integration", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        if (url.includes("/api/desktop/specialties")) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve([
                { id: "clinica-geral", name: "Clínica geral" },
                { id: "cardiologia", name: "Cardiologia" },
                { id: "ortopedia-traumatologia", name: "Ortopedia e traumatologia" },
              ]),
          })
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ professionals: [mockProfessional] }),
        })
      })
    )
  })

  it("renderiza a tela exibindo os profissionais e suas especialidades legíveis", () => {
    const html = renderToStaticMarkup(
      React.createElement<ProfessionalsViewProps>(ProfessionalsView, {
        initialRole: "admin",
        initialProfessionals: [mockProfessional],
        initialSpecialties: [
          { id: "cardiologia", name: "Cardiologia" },
          { id: "ortopedia-traumatologia", name: "Ortopedia e traumatologia" },
        ],
      })
    )

    expect(html).toContain("Dr. João Cardiologista")
    expect(html).toContain("Cardiologia")
  })

  it("renderiza o botão de novo profissional para admin e esconde para atendente", () => {
    const adminHtml = renderToStaticMarkup(
      React.createElement<ProfessionalsViewProps>(ProfessionalsView, {
        initialRole: "admin",
        initialProfessionals: [mockProfessional],
      })
    )
    expect(adminHtml).toContain("Novo profissional")

    const attendantHtml = renderToStaticMarkup(
      React.createElement<ProfessionalsViewProps>(ProfessionalsView, {
        initialRole: "attendant",
        initialProfessionals: [mockProfessional],
      })
    )
    expect(attendantHtml).not.toContain("Novo profissional")
    expect(attendantHtml).toContain("Modo somente leitura")
  })
})

describe("processPhotoFileInput helper", () => {
  it("rejeita arquivos que excedem 1.5 MB e reseta o valor do input", () => {
    const inputElement = {
      files: [{ size: MAX_PHOTO_BYTES + 100 } as any],
      value: "C:\\fakepath\\foto-pesada.jpg",
    }
    const onSuccess = vi.fn()
    const onError = vi.fn()

    processPhotoFileInput(inputElement, onSuccess, onError)

    expect(onError).toHaveBeenCalledWith("A foto deve ter no máximo 1.5 MB.")
    expect(inputElement.value).toBe("")
    expect(onSuccess).not.toHaveBeenCalled()
  })

  it("lê arquivo válido, chama onSuccess e reseta o valor do input para permitir selecionar novamente o mesmo arquivo", () => {
    const inputElement = {
      files: [{ size: 500 * 1024 } as any],
      value: "C:\\fakepath\\foto.jpg",
    }
    const onSuccess = vi.fn()
    const onError = vi.fn()

    const mockReader = {
      onload: null as (() => void) | null,
      result: "data:image/jpeg;base64,mockbase64data",
      readAsDataURL: vi.fn(function (this: any) {
        if (this.onload) this.onload()
      }),
    }

    processPhotoFileInput(inputElement, onSuccess, onError, () => mockReader)

    expect(mockReader.readAsDataURL).toHaveBeenCalled()
    expect(onSuccess).toHaveBeenCalledWith("data:image/jpeg;base64,mockbase64data")
    expect(inputElement.value).toBe("")
    expect(onError).not.toHaveBeenCalled()
  })

  it("não faz nada se não houver arquivo selecionado", () => {
    const inputElement = {
      files: [] as any,
      value: "",
    }
    const onSuccess = vi.fn()
    const onError = vi.fn()

    processPhotoFileInput(inputElement, onSuccess, onError)

    expect(onSuccess).not.toHaveBeenCalled()
    expect(onError).not.toHaveBeenCalled()
  })
})
