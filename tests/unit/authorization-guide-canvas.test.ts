import { describe, expect, it, vi, beforeEach, afterEach } from "vitest"
import {
  loadOptionalImage,
  guideCredentials,
  createAuthorizationGuide,
  type AuthorizationGuideInput,
} from "@/lib/authorization-guide"

describe("Authorization Guide Canvas Rendering", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  describe("guideCredentials", () => {
    it("extrai número e senha com 6 dígitos formatados a partir da referência", () => {
      const res = guideCredentials("GUIDE-987654")
      expect(res.number).toBe("987654.1")
      expect(res.password).toBe("987654")
    })

    it("preenche com zeros à esquerda quando há menos de 6 dígitos", () => {
      const res = guideCredentials("REF-42")
      expect(res.number).toBe("000042.1")
      expect(res.password).toBe("ref42")
    })
  })

  describe("loadOptionalImage", () => {
    const originalImage = globalThis.Image

    afterEach(() => {
      globalThis.Image = originalImage
    })

    it("retorna null de forma graciosa se url for vazia, nula ou indefinida", async () => {
      expect(await loadOptionalImage(null)).toBeNull()
      expect(await loadOptionalImage(undefined)).toBeNull()
      expect(await loadOptionalImage("")).toBeNull()
      expect(await loadOptionalImage("   ")).toBeNull()
    })

    it("configura crossOrigin = 'anonymous' para URLs http/https e resolve imagem com sucesso", async () => {
      class MockImage {
        crossOrigin = ""
        src = ""
        width = 100
        onload: (() => void) | null = null
        onerror: (() => void) | null = null
        constructor() {
          setTimeout(() => {
            if (this.onload) this.onload()
          }, 5)
        }
      }
      // @ts-expect-error Mocking Image constructor in Node environment
      globalThis.Image = MockImage

      const result = await loadOptionalImage("https://example.com/doctor.jpg")
      expect(result).not.toBeNull()
      expect(result?.crossOrigin).toBe("anonymous")
      expect(result?.src).toBe("https://example.com/doctor.jpg")
    })

    it("não força crossOrigin para data URIs e resolve com sucesso", async () => {
      class MockDataImage {
        crossOrigin = ""
        src = ""
        width = 64
        onload: (() => void) | null = null
        onerror: (() => void) | null = null
        constructor() {
          setTimeout(() => {
            if (this.onload) this.onload()
          }, 5)
        }
      }
      // @ts-expect-error Mocking Image constructor in Node environment
      globalThis.Image = MockDataImage

      const dataUri = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
      const result = await loadOptionalImage(dataUri)
      expect(result).not.toBeNull()
      expect(result?.crossOrigin).toBe("")
      expect(result?.src).toBe(dataUri)
    })

    it("retorna null se o carregamento da imagem falhar", async () => {
      class FailingImage {
        crossOrigin = ""
        src = ""
        onload: (() => void) | null = null
        onerror: (() => void) | null = null
        constructor() {
          setTimeout(() => {
            if (this.onerror) this.onerror()
          }, 5)
        }
      }
      // @ts-expect-error Mocking Image constructor in Node environment
      globalThis.Image = FailingImage

      const result = await loadOptionalImage("https://invalid-domain.com/broken.png")
      expect(result).toBeNull()
    })
  })

  describe("createAuthorizationGuide", () => {
    const originalDocument = globalThis.document

    afterEach(() => {
      globalThis.document = originalDocument
    })

    it("renderiza guia oficial no canvas incluindo selo de autenticidade e foto do médico", async () => {
      const fillTextCalls: string[] = []
      const strokeCalls: string[] = []
      const drawImageCalls: any[] = []

      const mockContext = {
        scale: vi.fn(),
        fillRect: vi.fn(),
        strokeRect: vi.fn(),
        roundRect: vi.fn(),
        beginPath: vi.fn(),
        closePath: vi.fn(),
        arc: vi.fn(),
        clip: vi.fn(),
        save: vi.fn(),
        restore: vi.fn(),
        translate: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        stroke: vi.fn(() => strokeCalls.push("stroke")),
        fill: vi.fn(),
        measureText: vi.fn((text: string) => ({ width: text.length * 8 })),
        fillText: vi.fn((text: string) => fillTextCalls.push(text)),
        drawImage: vi.fn((...args: any[]) => drawImageCalls.push(args)),
        fillStyle: "#000",
        strokeStyle: "#000",
        lineWidth: 1,
        font: "12px sans-serif",
        textAlign: "left",
        textBaseline: "alphabetic",
        lineCap: "butt",
      }

      const mockCanvas = {
        width: 0,
        height: 0,
        getContext: vi.fn(() => mockContext),
        toBlob: vi.fn((cb: (blob: Blob | null) => void) => {
          cb(new Blob(["mock-canvas-png"], { type: "image/png" }))
        }),
      }

      // Mock document
      globalThis.document = {
        createElement: vi.fn((tag: string) => {
          if (tag === "canvas") return mockCanvas
          return {}
        }) as any,
      } as any

      const input: AuthorizationGuideInput = {
        reference: "AUTH-882200",
        authorizedAt: "2026-11-05T10:00:00.000Z",
        patient: {
          name: "Maria Silva",
          cpf: "123.456.789-00",
          birthDate: "1990-05-15",
        },
        clinic: {
          name: "Clínica Vida & Saúde",
          phone: "(85) 3456-7890",
          address: "Av. Santos Dumont, 2500, Aldeota",
          city: "Fortaleza - CE",
        },
        appointmentAt: "2026-11-10T14:30:00.000Z",
        professional: {
          name: "Dr. Roberto Albuquerque",
          specialtyLabel: "Cardiologia",
          credentialLabel: "CRM",
          credentialCode: "12345/CE",
          location: "Consultório 4B",
          startHour: "14:00",
          endHour: "18:00",
          photoUrl: "https://example.com/roberto.jpg",
        },
        serviceName: "Consulta Cardiológica",
      }

      const blob = await createAuthorizationGuide(input)
      expect(blob).toBeInstanceOf(Blob)

      // Verifica elementos de autenticidade desenhados
      const renderedTexts = fillTextCalls.join(" ")
      expect(renderedTexts).toContain("GUIA AUTORIZADA")
      expect(renderedTexts).toContain("AUTENTICADA")
      expect(renderedTexts).toContain("882200.1") // Número da guia
      expect(renderedTexts).toContain("Dr. Roberto Albuquerque")
      expect(renderedTexts).toContain("Cardiologia")
      expect(renderedTexts).toContain("Av. Santos Dumont, 2500, Aldeota")
      expect(renderedTexts).toContain("Fortaleza")
    })

    it("renderiza emblema da clínica quando o atendimento for 'Geral da Clínica'", async () => {
      const fillTextCalls: string[] = []

      const mockContext = {
        scale: vi.fn(),
        fillRect: vi.fn(),
        strokeRect: vi.fn(),
        roundRect: vi.fn(),
        beginPath: vi.fn(),
        closePath: vi.fn(),
        arc: vi.fn(),
        clip: vi.fn(),
        save: vi.fn(),
        restore: vi.fn(),
        translate: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        stroke: vi.fn(),
        fill: vi.fn(),
        measureText: vi.fn((text: string) => ({ width: text.length * 8 })),
        fillText: vi.fn((text: string) => fillTextCalls.push(text)),
        drawImage: vi.fn(),
        fillStyle: "#000",
        strokeStyle: "#000",
        lineWidth: 1,
        font: "12px sans-serif",
        textAlign: "left",
        textBaseline: "alphabetic",
        lineCap: "butt",
      }

      const mockCanvas = {
        width: 0,
        height: 0,
        getContext: vi.fn(() => mockContext),
        toBlob: vi.fn((cb: (blob: Blob | null) => void) => {
          cb(new Blob(["mock-canvas-png"], { type: "image/png" }))
        }),
      }

      // Mock document
      globalThis.document = {
        createElement: vi.fn((tag: string) => {
          if (tag === "canvas") return mockCanvas
          return {}
        }) as any,
      } as any

      const input: AuthorizationGuideInput = {
        reference: "AUTH-554433",
        authorizedAt: "2026-11-05T10:00:00.000Z",
        patient: {
          name: "João Santos",
          cpf: "987.654.321-99",
          birthDate: "1985-02-20",
        },
        clinic: {
          name: "Laboratório Central",
          phone: "(85) 3333-4444",
          address: "Rua das Flores, 100",
          city: "Fortaleza - CE",
        },
        appointmentAt: "2026-11-08T08:00:00.000Z",
        professional: {
          name: "Geral da Clínica",
          specialtyLabel: "Exames Laboratoriais",
          credentialLabel: "CRBM",
          credentialCode: "9999",
          location: "Sala de Coleta",
          startHour: "07:00",
          endHour: "11:00",
          photoUrl: null,
        },
        serviceName: "Hemograma Completo",
      }

      const blob = await createAuthorizationGuide(input)
      expect(blob).toBeInstanceOf(Blob)
      const renderedTexts = fillTextCalls.join(" ")
      expect(renderedTexts).toContain("Geral da Clínica")
      expect(renderedTexts).toContain("GUIA AUTORIZADA")
    })
  })
})
