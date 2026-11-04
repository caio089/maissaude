import { beforeEach, describe, expect, it, vi } from "vitest"
import { minimumAsaasCharge, minimumAsaasChargeMessage } from "@/lib/asaas/minimums"

vi.mock("server-only", () => ({}))

import * as asaasClient from "@/lib/asaas/client"
import * as asaasCustomers from "@/lib/asaas/customers"
import * as adminSupabase from "@/lib/supabase/admin"
import { createAsaasCharge } from "@/lib/asaas/charges"
import { createAsaasSubscription } from "@/lib/asaas/subscriptions"

describe("asaas multichannel minimums", () => {
  it("valida mínimo de cobrança para Boleto (R$ 5)", () => {
    expect(minimumAsaasCharge("BOLETO")).toBe(5)
    expect(minimumAsaasChargeMessage("BOLETO")).toContain("boleto")
  })

  it("mantém mínimo para PIX (R$ 10) e CREDIT_CARD (R$ 5)", () => {
    expect(minimumAsaasCharge("PIX")).toBe(10)
    expect(minimumAsaasCharge("CREDIT_CARD")).toBe(5)
  })
})

describe("asaas multichannel charges (BOLETO)", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.spyOn(adminSupabase, "createSupabaseAdmin").mockReturnValue({
      from: vi.fn(() => ({
        upsert: vi.fn().mockResolvedValue({ error: null }),
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ error: null }),
      })),
    } as any)
    vi.spyOn(asaasCustomers, "ensureAsaasCustomer").mockResolvedValue({
      id: "cus_123",
      name: "João Silva",
    })
  })

  it("gera cobrança BOLETO e busca linha digitável (identificationField)", async () => {
    const fetchSpy = vi.spyOn(asaasClient, "asaasFetch").mockImplementation(async (endpoint: string) => {
      if (endpoint === "/payments") {
        return {
          id: "pay_boleto_1",
          customer: "cus_123",
          billingType: "BOLETO",
          value: 30,
          bankSlipUrl: "https://asaas.com/b/123",
          invoiceUrl: "https://asaas.com/i/123",
          status: "PENDING",
        }
      }
      if (endpoint === "/payments/pay_boleto_1/identificationField") {
        return {
          identificationField: "00190.00009 01234.567890 12345.678901 1 12340000003000",
        }
      }
      throw new Error(`Unexpected endpoint: ${endpoint}`)
    })

    const result = await createAsaasCharge({
      name: "João Silva",
      cpf: "12345678901",
      value: 30,
      billingType: "BOLETO",
      paymentId: "pay-local-1",
    })

    expect(fetchSpy).toHaveBeenCalledWith("/payments", expect.objectContaining({
      method: "POST",
      body: expect.stringContaining('"billingType":"BOLETO"'),
    }))
    expect(fetchSpy).toHaveBeenCalledWith("/payments/pay_boleto_1/identificationField")
    expect(result.bankSlipUrl).toBe("https://asaas.com/b/123")
    expect(result.identificationField).toBe("00190.00009 01234.567890 12345.678901 1 12340000003000")
    expect(result.pix).toBeNull()
  })

  it("continua com bankSlipUrl se a consulta de identificationField falhar", async () => {
    vi.spyOn(asaasClient, "asaasFetch").mockImplementation(async (endpoint: string) => {
      if (endpoint === "/payments") {
        return {
          id: "pay_boleto_2",
          customer: "cus_123",
          billingType: "BOLETO",
          value: 25,
          invoiceUrl: "https://asaas.com/i/fallback",
          status: "PENDING",
        }
      }
      if (endpoint === "/payments/pay_boleto_2/identificationField") {
        throw new Error("Asaas service temporarily unavailable")
      }
      throw new Error(`Unexpected endpoint: ${endpoint}`)
    })

    const result = await createAsaasCharge({
      name: "João Silva",
      cpf: "12345678901",
      value: 25,
      billingType: "BOLETO",
    })

    expect(result.bankSlipUrl).toBe("https://asaas.com/i/fallback")
    expect(result.identificationField).toBeNull()
  })

  it("permite assinatura com billingType BOLETO ou CREDIT_CARD", async () => {
    const fetchSpy = vi.spyOn(asaasClient, "asaasFetch").mockImplementation(async (endpoint: string) => {
      if (endpoint === "/subscriptions") {
        return {
          id: "sub_123",
          customer: "cus_123",
          billingType: "BOLETO",
          value: 39.9,
          status: "ACTIVE",
        }
      }
      if (endpoint.startsWith("/payments?subscription=")) {
        return {
          data: [{ id: "pay_sub_1", bankSlipUrl: "https://asaas.com/b/sub1" }],
        }
      }
      throw new Error(`Unexpected endpoint: ${endpoint}`)
    })

    const result = await createAsaasSubscription({
      name: "João Silva",
      cpf: "12345678901",
      value: 39.9,
      billingType: "BOLETO",
    })

    expect(result.subscription.id).toBe("sub_123")
    expect(fetchSpy).toHaveBeenCalledWith("/subscriptions", expect.objectContaining({
      body: expect.stringContaining('"billingType":"BOLETO"'),
    }))
  })
})
