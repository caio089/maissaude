import { describe, expect, it, vi, beforeEach } from "vitest"

vi.mock("server-only", () => ({}))

import { calculateAssociateQuote, DEFAULT_ASSOCIATE_RULES } from "@/lib/associate-rules"
import * as currentPatientModule from "@/lib/payments/current-patient"
import * as supabaseAdminModule from "@/lib/supabase/admin"
import * as chargesModule from "@/lib/asaas/charges"
import { POST } from "@/app/api/payments/cart/route"

describe("cart checkout associate logic", () => {
  it("combina valor da consulta com desconto e quitação de atraso", () => {
    const quote = calculateAssociateQuote({
      listPrice: 120,
      rules: { ...DEFAULT_ASSOCIATE_RULES, fee: 35, consultationDiscountPercent: 25 },
      associate: {
        id: "ass-1",
        name: "João",
        cpf: "111",
        phone: "11",
        email: "j@j.com",
        status: "overdue",
        overdueMonths: 1,
        createdAt: "2026-01-01",
      },
      settleOverdue: true,
    })
    // 120 * 0.75 = 90. 1 mês atraso = 35. Total = 125.
    expect(quote.consultationPrice).toBe(90)
    expect(quote.overdueSettlementFee).toBe(35)
    expect(quote.totalAmount).toBe(125)
  })

  it("não quita atraso quando settleOverdue é falso e cobra valor cheio sem desconto", () => {
    const quote = calculateAssociateQuote({
      listPrice: 120,
      rules: { ...DEFAULT_ASSOCIATE_RULES, fee: 35, consultationDiscountPercent: 25 },
      associate: {
        id: "ass-1",
        name: "João",
        cpf: "111",
        phone: "11",
        email: "j@j.com",
        status: "overdue",
        overdueMonths: 1,
        createdAt: "2026-01-01",
      },
      settleOverdue: false,
    })
    expect(quote.consultationPrice).toBe(120)
    expect(quote.overdueSettlementFee).toBe(0)
    expect(quote.totalAmount).toBe(120)
    expect(quote.discountApplied).toBe(false)
  })

  it("aplica desconto normal sem taxa de quitação para associado ativo", () => {
    const quote = calculateAssociateQuote({
      listPrice: 100,
      rules: { ...DEFAULT_ASSOCIATE_RULES, fee: 35, consultationDiscountPercent: 20 },
      associate: {
        id: "ass-2",
        name: "Maria",
        cpf: "222",
        phone: "22",
        email: "m@m.com",
        status: "active",
        overdueMonths: 0,
        createdAt: "2026-01-01",
      },
      settleOverdue: false,
    })
    expect(quote.consultationPrice).toBe(80)
    expect(quote.overdueSettlementFee).toBe(0)
    expect(quote.totalAmount).toBe(80)
    expect(quote.discountApplied).toBe(true)
  })
})

describe("POST /api/payments/cart route", () => {
  const patientData = {
    id: "pat-1",
    name: "Carlos Souza",
    cpf: "987.654.321-11",
    phone: "11988887777",
    email: "carlos@example.com",
    birthDate: "1985-05-20",
    gender: "M",
    address: "Av Central",
    city: "São Paulo",
    status: "active" as const,
    notes: "",
    createdAt: "2026-01-01",
    reminderEnabled: true,
  }

  const sampleLine = {
    professionalId: "prof-1",
    serviceId: "srv-1",
    date: "2027-10-15",
    time: "14:00",
  }

  let associateUpdateSpy: any

  beforeEach(() => {
    vi.restoreAllMocks()
    vi.spyOn(currentPatientModule, "requireCurrentPatient").mockResolvedValue(patientData)
    associateUpdateSpy = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    })
  })

  function createMockAdmin(options?: {
    associate?: any
    rules?: any
    conflicts?: any[]
  }) {
    const associate = options?.associate ?? null
    const rules = options?.rules ?? {
      fee: 35,
      consultation_discount_percent: 25,
      transport_enabled: true,
      transport_rides_per_month: 4,
      extra_benefits: [],
      grace_months: 3,
    }
    const conflicts = options?.conflicts ?? []

    return {
      from: vi.fn((table: string) => {
        if (table === "associates") {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({ data: associate, error: null }),
                }),
              }),
            }),
            update: associateUpdateSpy,
          }
        }
        if (table === "associate_rules") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: rules, error: null }),
              }),
            }),
          }
        }
        if (table === "professionals") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: {
                    id: "prof-1",
                    active: true,
                    work_days: [0, 1, 2, 3, 4, 5, 6],
                    start_hour: "08:00",
                    end_hour: "18:00",
                  },
                  error: null,
                }),
              }),
            }),
          }
        }
        if (table === "professional_services") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: {
                      id: "srv-1",
                      name: "Consulta Geral",
                      price: 120,
                      duration_min: 30,
                      modality: "presencial",
                    },
                    error: null,
                  }),
                }),
              }),
            }),
          }
        }
        if (table === "catalog_offers") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { id: "srv-1", kind: "consulta" },
                  error: null,
                }),
              }),
            }),
          }
        }
        if (table === "appointments") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                in: vi.fn().mockReturnValue({
                  lt: vi.fn().mockReturnValue({
                    gt: vi.fn().mockResolvedValue({ data: conflicts, error: null }),
                  }),
                }),
              }),
            }),
            insert: vi.fn().mockResolvedValue({ error: null }),
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null }),
            }),
            delete: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({ error: null }),
            }),
          }
        }
        if (table === "blocked_slots") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                lt: vi.fn().mockReturnValue({
                  gt: vi.fn().mockResolvedValue({ data: [], error: null }),
                }),
              }),
            }),
          }
        }
        if (table === "payments") {
          return {
            insert: vi.fn().mockResolvedValue({ error: null }),
            delete: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({ error: null }),
            }),
          }
        }
        return {}
      }),
    }
  }

  it("retorna 401 se não autenticado", async () => {
    vi.spyOn(currentPatientModule, "requireCurrentPatient").mockRejectedValue(
      new currentPatientModule.PaymentAuthorizationError(),
    )
    const req = new Request("http://localhost/api/payments/cart", {
      method: "POST",
      body: JSON.stringify({ lines: [sampleLine], billingType: "PIX", associateAnswer: "no" }),
    })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it("retorna 400 se carrinho estiver vazio", async () => {
    const req = new Request("http://localhost/api/payments/cart", {
      method: "POST",
      body: JSON.stringify({ lines: [], billingType: "PIX", associateAnswer: "no" }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toContain("Inclua ao menos um atendimento")
  })

  it("retorna 400 se billingType for inválido", async () => {
    const req = new Request("http://localhost/api/payments/cart", {
      method: "POST",
      body: JSON.stringify({ lines: [sampleLine], billingType: "CASH", associateAnswer: "no" }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it("retorna 400 se associateAnswer não for informado", async () => {
    const req = new Request("http://localhost/api/payments/cart", {
      method: "POST",
      body: JSON.stringify({ lines: [sampleLine], billingType: "PIX" }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it("retorna 409 se associateAnswer for 'yes' e paciente não tiver registro de associado", async () => {
    const mockAdmin = createMockAdmin({ associate: null })
    vi.spyOn(supabaseAdminModule, "createSupabaseAdmin").mockReturnValue(mockAdmin as any)

    const req = new Request("http://localhost/api/payments/cart", {
      method: "POST",
      body: JSON.stringify({
        lines: [sampleLine],
        billingType: "PIX",
        associateAnswer: "yes",
      }),
    })
    const res = await POST(req)
    expect(res.status).toBe(409)
    const data = await res.json()
    expect(data.code).toBe("ASSOCIATE_NOT_ACTIVE")
  })

  it("retorna 409 se associateAnswer for 'yes' e associado estiver cancelado", async () => {
    const mockAdmin = createMockAdmin({
      associate: {
        id: "ass-1",
        status: "cancelled",
        overdue_months: 4,
      },
    })
    vi.spyOn(supabaseAdminModule, "createSupabaseAdmin").mockReturnValue(mockAdmin as any)

    const req = new Request("http://localhost/api/payments/cart", {
      method: "POST",
      body: JSON.stringify({
        lines: [sampleLine],
        billingType: "PIX",
        associateAnswer: "yes",
      }),
    })
    const res = await POST(req)
    expect(res.status).toBe(409)
    const data = await res.json()
    expect(data.code).toBe("ASSOCIATE_NOT_ACTIVE")
  })

  it("processa checkout com settleAssociateFee: true, quita pendência e reativa associado", async () => {
    const mockAdmin = createMockAdmin({
      associate: {
        id: "ass-1",
        name: "Carlos Souza",
        cpf: "98765432111",
        status: "overdue",
        overdue_months: 1,
      },
    })
    vi.spyOn(supabaseAdminModule, "createSupabaseAdmin").mockReturnValue(mockAdmin as any)
    vi.spyOn(chargesModule, "createAsaasCharge").mockResolvedValue({
      customer: { id: "cus_1" } as any,
      payment: { id: "pay_asaas_1", invoiceUrl: "https://asaas.com/i/1" } as any,
      pix: { payload: "pix_code", encodedImage: "pix_img" } as any,
      pixUnavailable: false,
      bankSlipUrl: null,
      identificationField: null,
    })

    const req = new Request("http://localhost/api/payments/cart", {
      method: "POST",
      body: JSON.stringify({
        lines: [sampleLine],
        billingType: "PIX",
        associateAnswer: "yes",
        settleAssociateFee: true,
      }),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const body = await res.json()

    // 120 * 0.75 = 90 (consulta com 25% desc). 1 mês atraso = 35. Total = 125.
    expect(chargesModule.createAsaasCharge).toHaveBeenCalledWith(
      expect.objectContaining({
        value: 125,
        billingType: "PIX",
        description: expect.stringContaining("Quitação de mensalidade"),
      }),
    )

    // Associado reativado para active e overdue_months resetado para 0
    expect(associateUpdateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "active",
        overdue_months: 0,
      }),
    )

    expect(body.charges).toHaveLength(1)
    expect(body.charges[0].value).toBe(125)
  })

  it("processa checkout com settleAssociateFee: false para associado em atraso sem quitar e sem desconto", async () => {
    const mockAdmin = createMockAdmin({
      associate: {
        id: "ass-1",
        name: "Carlos Souza",
        cpf: "98765432111",
        status: "overdue",
        overdue_months: 1,
      },
    })
    vi.spyOn(supabaseAdminModule, "createSupabaseAdmin").mockReturnValue(mockAdmin as any)
    vi.spyOn(chargesModule, "createAsaasCharge").mockResolvedValue({
      customer: { id: "cus_1" } as any,
      payment: { id: "pay_asaas_2", invoiceUrl: "https://asaas.com/i/2" } as any,
      pix: { payload: "pix_code", encodedImage: "pix_img" } as any,
      pixUnavailable: false,
      bankSlipUrl: null,
      identificationField: null,
    })

    const req = new Request("http://localhost/api/payments/cart", {
      method: "POST",
      body: JSON.stringify({
        lines: [sampleLine],
        billingType: "PIX",
        associateAnswer: "yes",
        settleAssociateFee: false,
      }),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)

    // Paga valor cheio (120) sem taxa de atraso (0) = 120
    expect(chargesModule.createAsaasCharge).toHaveBeenCalledWith(
      expect.objectContaining({
        value: 120,
        billingType: "PIX",
      }),
    )

    // Não deve atualizar status do associado
    expect(associateUpdateSpy).not.toHaveBeenCalled()
  })

  it("processa checkout de associado adimplente aplicando desconto de associado sem quitação de atraso", async () => {
    const mockAdmin = createMockAdmin({
      associate: {
        id: "ass-1",
        name: "Carlos Souza",
        cpf: "98765432111",
        status: "active",
        overdue_months: 0,
      },
    })
    vi.spyOn(supabaseAdminModule, "createSupabaseAdmin").mockReturnValue(mockAdmin as any)
    vi.spyOn(chargesModule, "createAsaasCharge").mockResolvedValue({
      customer: { id: "cus_1" } as any,
      payment: { id: "pay_asaas_3", invoiceUrl: "https://asaas.com/i/3" } as any,
      pix: { payload: "pix_code", encodedImage: "pix_img" } as any,
      pixUnavailable: false,
      bankSlipUrl: null,
      identificationField: null,
    })

    const req = new Request("http://localhost/api/payments/cart", {
      method: "POST",
      body: JSON.stringify({
        lines: [sampleLine],
        billingType: "PIX",
        associateAnswer: "yes",
      }),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)

    // 120 * 0.75 = 90
    expect(chargesModule.createAsaasCharge).toHaveBeenCalledWith(
      expect.objectContaining({
        value: 90,
        billingType: "PIX",
      }),
    )

    expect(associateUpdateSpy).not.toHaveBeenCalled()
  })

  it("reverte agendamento e pagamento se Asaas falhar", async () => {
    const mockAdmin = createMockAdmin({
      associate: {
        id: "ass-1",
        name: "Carlos Souza",
        cpf: "98765432111",
        status: "overdue",
        overdue_months: 1,
      },
    })
    vi.spyOn(supabaseAdminModule, "createSupabaseAdmin").mockReturnValue(mockAdmin as any)
    vi.spyOn(chargesModule, "createAsaasCharge").mockRejectedValue(new Error("Falha de conexão com Asaas"))

    const req = new Request("http://localhost/api/payments/cart", {
      method: "POST",
      body: JSON.stringify({
        lines: [sampleLine],
        billingType: "PIX",
        associateAnswer: "yes",
        settleAssociateFee: true,
      }),
    })
    const res = await POST(req)
    expect(res.status).toBe(422)
    const data = await res.json()
    expect(data.error).toContain("Falha de conexão com Asaas")

    // Não deve atualizar o associado
    expect(associateUpdateSpy).not.toHaveBeenCalled()
  })
})
