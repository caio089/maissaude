import { describe, expect, it, vi, beforeEach } from "vitest"

vi.mock("server-only", () => ({}))

import { evaluateAssociateStatus } from "@/lib/associate-rules"
import * as clinicSessionModule from "@/lib/clinic-session"
import * as supabaseAdminModule from "@/lib/supabase/admin"
import * as chargesModule from "@/lib/asaas/charges"
import * as paymentLinksModule from "@/lib/asaas/payment-links"
import * as subscriptionsModule from "@/lib/asaas/subscriptions"
import { GET, POST, PATCH } from "@/app/api/payments/associate/route"

describe("desktop associates status mapping", () => {
  it("mapeia status de associados com atraso de forma consistente", () => {
    const res = evaluateAssociateStatus({ status: "active", overdueMonths: 2 })
    expect(res.status).toBe("overdue")
    expect(res.graceEligible).toBe(true)
    expect(res.canReceiveDiscount).toBe(false)
  })

  it("mapeia status ativo sem atraso", () => {
    const res = evaluateAssociateStatus({ status: "active", overdueMonths: 0 })
    expect(res.status).toBe("active")
    expect(res.canReceiveDiscount).toBe(true)
  })

  it("mapeia status cancelado quando atraso ultrapassa carência", () => {
    const res = evaluateAssociateStatus({ status: "active", overdueMonths: 3, graceMonths: 3 })
    expect(res.status).toBe("cancelled")
    expect(res.graceEligible).toBe(false)
  })

  it("mapeia status inativo", () => {
    const res = evaluateAssociateStatus({ status: "inactive" })
    expect(res.status).toBe("inactive")
  })
})

describe("GET /api/payments/associate", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("retorna 401 se clínica não estiver autenticada", async () => {
    vi.spyOn(clinicSessionModule, "hasClinicSession").mockResolvedValue(false)
    const res = await GET()
    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.error).toContain("Entre no painel da clínica")
  })

  it("retorna 503 se banco estiver indisponível", async () => {
    vi.spyOn(clinicSessionModule, "hasClinicSession").mockResolvedValue(true)
    vi.spyOn(supabaseAdminModule, "createSupabaseAdmin").mockReturnValue(null as any)
    const res = await GET()
    expect(res.status).toBe(503)
  })

  it("retorna associados com campos de atraso serializados", async () => {
    vi.spyOn(clinicSessionModule, "hasClinicSession").mockResolvedValue(true)
    const mockAdmin = {
      from: vi.fn((table: string) => {
        if (table === "patients") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({
                  data: [{ id: "pat-1", name: "Paciente 1", cpf: "12345678901", phone: "11999999999", email: "p1@test.com", status: "active" }],
                  error: null,
                }),
              }),
            }),
          }
        }
        if (table === "associates") {
          return {
            select: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: [
                  {
                    id: "ass-1",
                    name: "Associado 1",
                    cpf: "12345678901",
                    phone: "11999999999",
                    email: "a1@test.com",
                    status: "overdue",
                    overdue_months: 2,
                    next_due_date: "2026-12-01",
                    last_paid_at: "2026-09-01T00:00:00Z",
                    created_at: "2026-01-01T00:00:00Z",
                  },
                ],
                error: null,
              }),
            }),
          }
        }
        if (table === "associate_rules") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { fee: 35, grace_months: 3 },
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

    const res = await GET()
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.associates).toHaveLength(1)
    expect(json.associates[0]).toEqual({
      id: "ass-1",
      name: "Associado 1",
      cpf: "12345678901",
      phone: "11999999999",
      email: "a1@test.com",
      status: "overdue",
      overdueMonths: 2,
      nextDueDate: "2026-12-01",
      lastPaidAt: "2026-09-01T00:00:00Z",
      createdAt: "2026-01-01T00:00:00Z",
    })
  })
})

describe("POST /api/payments/associate", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("retorna 401 se clínica não estiver autenticada", async () => {
    vi.spyOn(clinicSessionModule, "hasClinicSession").mockResolvedValue(false)
    const req = new Request("http://localhost/api/payments/associate", {
      method: "POST",
      body: JSON.stringify({}),
    })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it("retorna 422 se dados forem inválidos", async () => {
    vi.spyOn(clinicSessionModule, "hasClinicSession").mockResolvedValue(true)
    const req = new Request("http://localhost/api/payments/associate", {
      method: "POST",
      body: JSON.stringify({ name: "A", cpf: "123" }),
    })
    const res = await POST(req)
    expect(res.status).toBe(422)
  })

  it("retorna 409 se associado já estiver ativo", async () => {
    vi.spyOn(clinicSessionModule, "hasClinicSession").mockResolvedValue(true)
    const mockAdmin = {
      from: vi.fn((table: string) => {
        if (table === "associate_rules") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: { fee: 35 }, error: null }),
              }),
            }),
          }
        }
        if (table === "associates") {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: { id: "ass-1", status: "active" }, error: null }),
              }),
            }),
          }
        }
        return {}
      }),
    }
    vi.spyOn(supabaseAdminModule, "createSupabaseAdmin").mockReturnValue(mockAdmin as any)

    const req = new Request("http://localhost/api/payments/associate", {
      method: "POST",
      body: JSON.stringify({
        name: "Carlos Teste",
        cpf: "12345678909",
        phone: "11999999999",
        email: "carlos@test.com",
      }),
    })
    const res = await POST(req)
    expect(res.status).toBe(409)
    const json = await res.json()
    expect(json.error).toContain("já está cadastrado como associado ativo")
  })

  it("gera cobrança PIX com qr code e payload", async () => {
    vi.spyOn(clinicSessionModule, "hasClinicSession").mockResolvedValue(true)
    const upsertMock = vi.fn().mockResolvedValue({ error: null })
    const mockAdmin = {
      from: vi.fn((table: string) => {
        if (table === "associate_rules") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: { fee: 35 }, error: null }),
              }),
            }),
          }
        }
        if (table === "associates") {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
              }),
            }),
            upsert: upsertMock,
          }
        }
        return {}
      }),
    }
    vi.spyOn(supabaseAdminModule, "createSupabaseAdmin").mockReturnValue(mockAdmin as any)
    vi.spyOn(chargesModule, "createAsaasCharge").mockResolvedValue({
      customer: { id: "cus_123" } as any,
      payment: { id: "pay_123", invoiceUrl: "https://asaas.com/invoice/123" } as any,
      pix: { payload: "000201pixpayload", encodedImage: "base64image" },
      pixUnavailable: false,
      bankSlipUrl: null,
      identificationField: null,
    })

    const req = new Request("http://localhost/api/payments/associate", {
      method: "POST",
      body: JSON.stringify({
        name: "Carlos Teste",
        cpf: "12345678909",
        phone: "11999999999",
        email: "carlos@test.com",
        billingType: "PIX",
      }),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.billingType).toBe("PIX")
    expect(json.value).toBe(35)
    expect(json.pix.payload).toBe("000201pixpayload")
    expect(json.pix.encodedImage).toBe("base64image")
    expect(chargesModule.createAsaasCharge).toHaveBeenCalledWith(
      expect.objectContaining({
        billingType: "PIX",
        value: 35,
        cpf: "12345678909",
      }),
    )
  })

  it("gera cobrança BOLETO com bankSlipUrl e identificationField", async () => {
    vi.spyOn(clinicSessionModule, "hasClinicSession").mockResolvedValue(true)
    const upsertMock = vi.fn().mockResolvedValue({ error: null })
    const mockAdmin = {
      from: vi.fn((table: string) => {
        if (table === "associate_rules") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: { fee: 35 }, error: null }),
              }),
            }),
          }
        }
        if (table === "associates") {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
              }),
            }),
            upsert: upsertMock,
          }
        }
        return {}
      }),
    }
    vi.spyOn(supabaseAdminModule, "createSupabaseAdmin").mockReturnValue(mockAdmin as any)
    vi.spyOn(chargesModule, "createAsaasCharge").mockResolvedValue({
      customer: { id: "cus_123" } as any,
      payment: { id: "pay_456", invoiceUrl: "https://asaas.com/invoice/456" } as any,
      pix: null,
      pixUnavailable: false,
      bankSlipUrl: "https://asaas.com/slip/456.pdf",
      identificationField: "23793.38128 60083.013528 56006.333202 1 10000000003500",
    })

    const req = new Request("http://localhost/api/payments/associate", {
      method: "POST",
      body: JSON.stringify({
        name: "Carlos Teste",
        cpf: "12345678909",
        phone: "11999999999",
        email: "carlos@test.com",
        billingType: "BOLETO",
      }),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.billingType).toBe("BOLETO")
    expect(json.value).toBe(35)
    expect(json.bankSlipUrl).toBe("https://asaas.com/slip/456.pdf")
    expect(json.identificationField).toBe("23793.38128 60083.013528 56006.333202 1 10000000003500")
    expect(chargesModule.createAsaasCharge).toHaveBeenCalledWith(
      expect.objectContaining({
        billingType: "BOLETO",
        value: 35,
      }),
    )
  })

  it("gera link de cartão quando billingType é CREDIT_CARD", async () => {
    vi.spyOn(clinicSessionModule, "hasClinicSession").mockResolvedValue(true)
    const upsertMock = vi.fn().mockResolvedValue({ error: null })
    const mockAdmin = {
      from: vi.fn((table: string) => {
        if (table === "associate_rules") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: { fee: 35 }, error: null }),
              }),
            }),
          }
        }
        if (table === "associates") {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
              }),
            }),
            upsert: upsertMock,
          }
        }
        if (table === "asaas_subscriptions") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                not: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
                }),
              }),
            }),
          }
        }
        return {}
      }),
    }
    vi.spyOn(supabaseAdminModule, "createSupabaseAdmin").mockReturnValue(mockAdmin as any)
    vi.spyOn(paymentLinksModule, "createAssociateCardPaymentLink").mockResolvedValue({
      id: "link_123",
      url: "https://asaas.com/c/link_123",
    } as any)

    const req = new Request("http://localhost/api/payments/associate", {
      method: "POST",
      body: JSON.stringify({
        name: "Carlos Teste",
        cpf: "12345678909",
        phone: "11999999999",
        email: "carlos@test.com",
        billingType: "CREDIT_CARD",
      }),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.billingType).toBe("CREDIT_CARD")
    expect(json.paymentUrl).toBe("https://asaas.com/c/link_123")
  })

  it("processa cartão diretamente no domínio via checkout transparente", async () => {
    vi.spyOn(clinicSessionModule, "hasClinicSession").mockResolvedValue(true)
    let capturedAssociateUpdate: any = null
    const mockAdmin = {
      from: vi.fn((table: string) => {
        if (table === "associate_rules") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: { fee: 35 }, error: null }),
              }),
            }),
          }
        }
        if (table === "associates") {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
              }),
            }),
            upsert: vi.fn().mockResolvedValue({ error: null }),
            update: vi.fn((payload) => {
              capturedAssociateUpdate = payload
              return {
                eq: vi.fn().mockResolvedValue({ error: null }),
              }
            }),
          }
        }
        if (table === "asaas_subscriptions") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                not: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
                }),
              }),
            }),
          }
        }
        return {}
      }),
    }
    vi.spyOn(supabaseAdminModule, "createSupabaseAdmin").mockReturnValue(mockAdmin as any)
    const subSpy = vi.spyOn(subscriptionsModule, "createAsaasSubscription").mockResolvedValue({
      customer: { id: "cus_123" },
      subscription: { id: "sub_123", status: "ACTIVE" } as any,
      payment: { id: "pay_123" } as any,
      pix: null,
    })
    const linkSpy = vi.spyOn(paymentLinksModule, "createAssociateCardPaymentLink")

    const req = new Request("http://localhost/api/payments/associate", {
      method: "POST",
      body: JSON.stringify({
        name: "Carlos Teste",
        cpf: "12345678909",
        phone: "11999999999",
        email: "carlos@test.com",
        billingType: "CREDIT_CARD",
        creditCard: {
          holderName: "CARLOS TESTE",
          number: "4111111111111111",
          expiryMonth: "12",
          expiryYear: "2028",
          ccv: "123",
        },
        creditCardHolderInfo: {
          postalCode: "64000000",
          addressNumber: "100",
        },
      }),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(json.status).toBe("active")
    expect(json.billingType).toBe("CREDIT_CARD")
    expect(json.paymentUrl).toBeUndefined()
    expect(linkSpy).not.toHaveBeenCalled()
    expect(subSpy).toHaveBeenCalled()
    expect(capturedAssociateUpdate).toMatchObject({
      status: "active",
      overdue_months: 0,
    })
  })
})

describe("PATCH /api/payments/associate", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("retorna 401 se clínica não estiver autenticada", async () => {
    vi.spyOn(clinicSessionModule, "hasClinicSession").mockResolvedValue(false)
    const req = new Request("http://localhost/api/payments/associate", {
      method: "PATCH",
      body: JSON.stringify({ id: "ass-1" }),
    })
    const res = await PATCH(req)
    expect(res.status).toBe(401)
  })

  it("retorna 422 se id não for fornecido", async () => {
    vi.spyOn(clinicSessionModule, "hasClinicSession").mockResolvedValue(true)
    vi.spyOn(supabaseAdminModule, "createSupabaseAdmin").mockReturnValue({} as any)
    const req = new Request("http://localhost/api/payments/associate", {
      method: "PATCH",
      body: JSON.stringify({ status: "active" }),
    })
    const res = await PATCH(req)
    expect(res.status).toBe(422)
  })

  it("registra recebimento no balcão: reseta atraso para 0 e ativa associado", async () => {
    vi.spyOn(clinicSessionModule, "hasClinicSession").mockResolvedValue(true)
    let capturedUpdate: any = null
    const mockAdmin = {
      from: vi.fn((table: string) => {
        if (table === "associates") {
          return {
            update: vi.fn((payload) => {
              capturedUpdate = payload
              return {
                eq: vi.fn().mockReturnValue({
                  select: vi.fn().mockReturnValue({
                    maybeSingle: vi.fn().mockResolvedValue({
                      data: {
                        id: "ass-1",
                        name: "Associado Balcao",
                        cpf: "12345678901",
                        phone: "11999999999",
                        email: "balcao@test.com",
                        status: "active",
                        overdue_months: 0,
                        next_due_date: null,
                        last_paid_at: "2026-11-04T12:00:00Z",
                      },
                      error: null,
                    }),
                  }),
                }),
              }
            }),
          }
        }
        return {}
      }),
    }
    vi.spyOn(supabaseAdminModule, "createSupabaseAdmin").mockReturnValue(mockAdmin as any)

    const req = new Request("http://localhost/api/payments/associate", {
      method: "PATCH",
      body: JSON.stringify({
        id: "ass-1",
        status: "active",
        overdueMonths: 0,
      }),
    })
    const res = await PATCH(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(json.associate.status).toBe("active")
    expect(json.associate.overdueMonths).toBe(0)
    expect(capturedUpdate.status).toBe("active")
    expect(capturedUpdate.overdue_months).toBe(0)
    expect(capturedUpdate.last_paid_at).toBeDefined()
  })
})
