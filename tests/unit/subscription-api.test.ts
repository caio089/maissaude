import { describe, expect, it, vi, beforeEach } from "vitest"

vi.mock("server-only", () => ({}))

import { evaluateAssociateStatus } from "@/lib/associate-rules"
import * as currentPatientModule from "@/lib/payments/current-patient"
import * as supabaseAdminModule from "@/lib/supabase/admin"
import * as chargesModule from "@/lib/asaas/charges"
import * as paymentLinksModule from "@/lib/asaas/payment-links"
import * as originModule from "@/lib/auth/origin"
import { GET, POST } from "@/app/api/payments/subscription/route"

describe("subscription api logic", () => {
  it("determina status e valor pendente corretamente", () => {
    const fee = 35
    const evaluation = evaluateAssociateStatus({ status: "overdue", overdueMonths: 2 })
    const pendingAmount = evaluation.overdueMonths * fee
    expect(evaluation.status).toBe("overdue")
    expect(pendingAmount).toBe(70)
  })

  it("determina status ativo e valor pendente zero para associado em dia", () => {
    const fee = 35
    const evaluation = evaluateAssociateStatus({ status: "active", overdueMonths: 0 })
    expect(evaluation.status).toBe("active")
    expect(evaluation.overdueMonths * fee).toBe(0)
  })

  it("determina status cancelado quando atraso atinge carência", () => {
    const evaluation = evaluateAssociateStatus({ status: "active", overdueMonths: 3, graceMonths: 3 })
    expect(evaluation.status).toBe("cancelled")
    expect(evaluation.canReceiveDiscount).toBe(false)
  })
})

describe("GET /api/payments/subscription", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("retorna 401 se não autenticado como paciente", async () => {
    vi.spyOn(currentPatientModule, "requireCurrentPatient").mockRejectedValue(
      new currentPatientModule.PaymentAuthorizationError(),
    )
    const response = await GET()
    expect(response.status).toBe(401)
    const body = await response.json()
    expect(body.error).toContain("Entre com uma conta de paciente")
  })

  it("retorna 503 se o cliente Supabase admin não estiver configurado", async () => {
    vi.spyOn(currentPatientModule, "requireCurrentPatient").mockResolvedValue({
      id: "pat-1",
      name: "João Silva",
      cpf: "123.456.789-00",
      phone: "11999999999",
      email: "joao@example.com",
      birthDate: "1990-01-01",
      gender: "M",
      address: "Rua A",
      city: "São Paulo",
      status: "active",
      notes: "",
      createdAt: "2026-01-01",
      reminderEnabled: true,
    })
    vi.spyOn(supabaseAdminModule, "createSupabaseAdmin").mockReturnValue(null as any)

    const response = await GET()
    expect(response.status).toBe(503)
  })

  it("retorna active: false e status 'none' quando paciente não possui registro de associado", async () => {
    vi.spyOn(currentPatientModule, "requireCurrentPatient").mockResolvedValue({
      id: "pat-1",
      name: "João Silva",
      cpf: "123.456.789-00",
      phone: "11999999999",
      email: "joao@example.com",
      birthDate: "1990-01-01",
      gender: "M",
      address: "Rua A",
      city: "São Paulo",
      status: "active",
      notes: "",
      createdAt: "2026-01-01",
      reminderEnabled: true,
    })

    const mockAdmin = {
      from: vi.fn((table: string) => {
        if (table === "associates") {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
                }),
              }),
            }),
          }
        }
        if (table === "associate_rules") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: {
                    fee: 40,
                    consultation_discount_percent: 25,
                    transport_enabled: true,
                    transport_rides_per_month: 4,
                    extra_benefits: ["Prioridade"],
                    grace_months: 3,
                  },
                  error: null,
                }),
              }),
            }),
          }
        }
        return {}
      }),
    }
    vi.spyOn(supabaseAdminModule, "createSupabaseAdmin").mockReturnValue(mockAdmin as any)

    const response = await GET()
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body).toEqual({
      active: false,
      status: "none",
      overdueMonths: 0,
      pendingAmount: 0,
      rules: {
        fee: 40,
        consultationDiscountPercent: 25,
        transportEnabled: true,
        transportRidesPerMonth: 4,
        extraBenefits: ["Prioridade"],
        graceMonths: 3,
      },
    })
  })

  it("retorna active: true e status 'active' para associado adimplente", async () => {
    vi.spyOn(currentPatientModule, "requireCurrentPatient").mockResolvedValue({
      id: "pat-1",
      name: "Maria Silva",
      cpf: "12345678900",
      phone: "11999999999",
      email: "maria@example.com",
      birthDate: "1990-01-01",
      gender: "F",
      address: "Rua B",
      city: "São Paulo",
      status: "active",
      notes: "",
      createdAt: "2026-01-01",
      reminderEnabled: true,
    })

    const mockAdmin = {
      from: vi.fn((table: string) => {
        if (table === "associates") {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: {
                      id: "ass-1",
                      status: "active",
                      overdue_months: 0,
                      next_due_date: "2026-12-01",
                    },
                    error: null,
                  }),
                }),
              }),
            }),
          }
        }
        if (table === "associate_rules") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: {
                    fee: 35,
                    consultation_discount_percent: 20,
                    transport_enabled: true,
                    transport_rides_per_month: 4,
                    extra_benefits: [],
                    grace_months: 3,
                  },
                  error: null,
                }),
              }),
            }),
          }
        }
        return {}
      }),
    }
    vi.spyOn(supabaseAdminModule, "createSupabaseAdmin").mockReturnValue(mockAdmin as any)

    const response = await GET()
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.active).toBe(true)
    expect(body.status).toBe("active")
    expect(body.overdueMonths).toBe(0)
    expect(body.pendingAmount).toBe(0)
  })

  it("retorna active: false e status 'overdue' com pendingAmount proporcional aos meses em atraso", async () => {
    vi.spyOn(currentPatientModule, "requireCurrentPatient").mockResolvedValue({
      id: "pat-1",
      name: "Maria Silva",
      cpf: "12345678900",
      phone: "11999999999",
      email: "maria@example.com",
      birthDate: "1990-01-01",
      gender: "F",
      address: "Rua B",
      city: "São Paulo",
      status: "active",
      notes: "",
      createdAt: "2026-01-01",
      reminderEnabled: true,
    })

    const mockAdmin = {
      from: vi.fn((table: string) => {
        if (table === "associates") {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: {
                      id: "ass-1",
                      status: "overdue",
                      overdue_months: 2,
                      next_due_date: "2026-10-01",
                    },
                    error: null,
                  }),
                }),
              }),
            }),
          }
        }
        if (table === "associate_rules") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: {
                    fee: 35,
                    consultation_discount_percent: 20,
                    transport_enabled: true,
                    transport_rides_per_month: 4,
                    extra_benefits: [],
                    grace_months: 3,
                  },
                  error: null,
                }),
              }),
            }),
          }
        }
        return {}
      }),
    }
    vi.spyOn(supabaseAdminModule, "createSupabaseAdmin").mockReturnValue(mockAdmin as any)

    const response = await GET()
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.active).toBe(false)
    expect(body.status).toBe("overdue")
    expect(body.overdueMonths).toBe(2)
    expect(body.pendingAmount).toBe(70)
  })
})

describe("POST /api/payments/subscription", () => {
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

  beforeEach(() => {
    vi.restoreAllMocks()
    vi.spyOn(currentPatientModule, "requireCurrentPatient").mockResolvedValue(patientData)
    vi.spyOn(originModule, "requestOrigin").mockResolvedValue("https://cuidarsaude.app")
  })

  function createMockAdmin(options?: {
    fee?: number
    associate?: any
    subscription?: any
  }) {
    const fee = options?.fee ?? 35
    const associate = options?.associate ?? null
    const subscription = options?.subscription ?? null

    return {
      from: vi.fn((table: string) => {
        if (table === "associate_rules") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { fee, grace_months: 3 },
                  error: null,
                }),
              }),
            }),
          }
        }
        if (table === "associates") {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: associate,
                    error: null,
                  }),
                }),
              }),
            }),
            upsert: vi.fn().mockResolvedValue({ error: null }),
          }
        }
        if (table === "asaas_subscriptions") {
          return {
            select: vi.fn().mockReturnValue({
              or: vi.fn().mockReturnValue({
                not: vi.fn().mockReturnValue({
                  limit: vi.fn().mockReturnValue({
                    maybeSingle: vi.fn().mockResolvedValue({
                      data: subscription,
                      error: null,
                    }),
                  }),
                }),
              }),
            }),
          }
        }
        return {}
      }),
    }
  }

  it("retorna 409 se a associação já estiver ativa e sem pendências", async () => {
    const mockAdmin = createMockAdmin({
      associate: {
        id: "ass-1",
        status: "active",
        overdue_months: 0,
      },
    })
    vi.spyOn(supabaseAdminModule, "createSupabaseAdmin").mockReturnValue(mockAdmin as any)

    const req = new Request("http://localhost/api/payments/subscription", {
      method: "POST",
      body: JSON.stringify({ billingType: "PIX" }),
    })
    const res = await POST(req)
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error).toContain("já está ativa")
  })

  it("gera cobrança PIX com sucesso e retorna qrCode e invoiceUrl", async () => {
    const mockAdmin = createMockAdmin({
      associate: null,
    })
    vi.spyOn(supabaseAdminModule, "createSupabaseAdmin").mockReturnValue(mockAdmin as any)
    vi.spyOn(chargesModule, "createAsaasCharge").mockResolvedValue({
      customer: { id: "cus_123" } as any,
      payment: { id: "pay_1", invoiceUrl: "https://asaas.com/i/123", billingType: "PIX" } as any,
      pix: { payload: "000201...pix", encodedImage: "base64image..." } as any,
      pixUnavailable: false,
      bankSlipUrl: null,
      identificationField: null,
    })

    const req = new Request("http://localhost/api/payments/subscription", {
      method: "POST",
      body: JSON.stringify({ billingType: "PIX", monthsToPay: 1 }),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.billingType).toBe("PIX")
    expect(body.value).toBe(35)
    expect(body.invoiceUrl).toBe("https://asaas.com/i/123")
    expect(body.pix).toEqual({
      payload: "000201...pix",
      encodedImage: "base64image...",
    })
    expect(chargesModule.createAsaasCharge).toHaveBeenCalledWith(
      expect.objectContaining({
        billingType: "PIX",
        value: 35,
        cpf: "987.654.321-11",
      }),
    )
  })

  it("calcula valor total proporcional quando monthsToPay é informado", async () => {
    const mockAdmin = createMockAdmin({
      associate: { id: "ass-1", status: "overdue", overdue_months: 2 },
    })
    vi.spyOn(supabaseAdminModule, "createSupabaseAdmin").mockReturnValue(mockAdmin as any)
    vi.spyOn(chargesModule, "createAsaasCharge").mockResolvedValue({
      customer: { id: "cus_123" } as any,
      payment: { id: "pay_2", invoiceUrl: "https://asaas.com/i/2", billingType: "PIX" } as any,
      pix: { payload: "pixcode", encodedImage: "img" } as any,
      pixUnavailable: false,
      bankSlipUrl: null,
      identificationField: null,
    })

    const req = new Request("http://localhost/api/payments/subscription", {
      method: "POST",
      body: JSON.stringify({ billingType: "PIX", monthsToPay: 2 }),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.value).toBe(70) // 35 * 2
    expect(chargesModule.createAsaasCharge).toHaveBeenCalledWith(
      expect.objectContaining({
        value: 70,
        billingType: "PIX",
      }),
    )
  })

  it("gera cobrança BOLETO com linha digitável e link", async () => {
    const mockAdmin = createMockAdmin({
      associate: null,
    })
    vi.spyOn(supabaseAdminModule, "createSupabaseAdmin").mockReturnValue(mockAdmin as any)
    vi.spyOn(chargesModule, "createAsaasCharge").mockResolvedValue({
      customer: { id: "cus_123" } as any,
      payment: { id: "pay_3", invoiceUrl: "https://asaas.com/i/3", bankSlipUrl: "https://asaas.com/b/3", billingType: "BOLETO" } as any,
      pix: null,
      pixUnavailable: false,
      bankSlipUrl: "https://asaas.com/b/3",
      identificationField: "23793.38128 60000.123456 12345.678901 1 90000000003500",
    })

    const req = new Request("http://localhost/api/payments/subscription", {
      method: "POST",
      body: JSON.stringify({ billingType: "BOLETO" }),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.billingType).toBe("BOLETO")
    expect(body.bankSlipUrl).toBe("https://asaas.com/b/3")
    expect(body.bankSlipBarcode).toBe("23793.38128 60000.123456 12345.678901 1 90000000003500")
  })

  it("gera link de cartão para CREDIT_CARD", async () => {
    const mockAdmin = createMockAdmin({
      associate: null,
    })
    vi.spyOn(supabaseAdminModule, "createSupabaseAdmin").mockReturnValue(mockAdmin as any)
    vi.spyOn(paymentLinksModule, "createAssociateCardPaymentLink").mockResolvedValue({
      id: "link_123",
      url: "https://asaas.com/c/link_123",
    } as any)

    const req = new Request("http://localhost/api/payments/subscription", {
      method: "POST",
      body: JSON.stringify({ billingType: "CREDIT_CARD" }),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.billingType).toBe("CREDIT_CARD")
    expect(body.paymentUrl).toBe("https://asaas.com/c/link_123")
    expect(paymentLinksModule.createAssociateCardPaymentLink).toHaveBeenCalledWith({
      associateId: expect.any(String),
      name: "Carlos Souza",
      value: 35,
      successUrl: "https://cuidarsaude.app/mobile/perfil",
    })
  })
})
