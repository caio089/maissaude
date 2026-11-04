import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

import * as asaasClient from "@/lib/asaas/client"
import * as adminSupabase from "@/lib/supabase/admin"
import { persistAsaasWebhook } from "@/lib/asaas/webhooks"

const createChainableUpdate = (returnData: any[] = []) => ({
  eq: vi.fn().mockReturnValue({
    select: vi.fn().mockResolvedValue({ data: returnData, error: null }),
    is: vi.fn().mockReturnValue({
      select: vi.fn().mockResolvedValue({ data: returnData, error: null }),
    }),
  }),
  is: vi.fn().mockReturnValue({
    eq: vi.fn().mockReturnValue({
      select: vi.fn().mockResolvedValue({ data: returnData, error: null }),
    }),
  }),
})

describe("asaas webhooks associate autonomous activation", () => {
  let associatesUpdateSpy: any
  let appointmentsUpdateSpy: any
  let paymentsUpdateSpy: any
  let mockAdmin: any

  beforeEach(() => {
    vi.restoreAllMocks()

    associatesUpdateSpy = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
      in: vi.fn().mockResolvedValue({ error: null }),
    })

    appointmentsUpdateSpy = vi.fn().mockReturnValue({
      in: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
        in: vi.fn().mockResolvedValue({ error: null }),
      }),
    })

    paymentsUpdateSpy = vi.fn().mockImplementation(() => createChainableUpdate([]))

    mockAdmin = {
      from: vi.fn((table: string) => {
        if (table === "asaas_webhook_events") {
          return {
            insert: vi.fn().mockResolvedValue({ error: null }),
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null }),
            }),
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: null }),
              }),
            }),
          }
        }
        if (table === "asaas_charges") {
          return {
            upsert: vi.fn().mockResolvedValue({ error: null }),
          }
        }
        if (table === "asaas_subscriptions") {
          return {
            upsert: vi.fn().mockResolvedValue({ error: null }),
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { associate_id: "ass-sub-999" },
                }),
              }),
            }),
          }
        }
        if (table === "payments") {
          return {
            update: paymentsUpdateSpy,
          }
        }
        if (table === "appointments") {
          return {
            update: appointmentsUpdateSpy,
          }
        }
        if (table === "associates") {
          return {
            update: associatesUpdateSpy,
          }
        }
        return {}
      }),
    }

    vi.spyOn(adminSupabase, "createSupabaseAdmin").mockReturnValue(mockAdmin as any)
  })

  it("ativa associado de forma autônoma quando cobrança multicanal avulsa (externalReference = associate:<id>) for confirmada", async () => {
    vi.spyOn(asaasClient, "asaasFetch").mockImplementation(async (endpoint: string) => {
      if (endpoint === "/payments/pay_multichannel_1") {
        return {
          id: "pay_multichannel_1",
          status: "CONFIRMED",
          externalReference: "associate:ass-direct-100",
          value: 35,
          billingType: "PIX",
          invoiceUrl: "https://asaas.com/i/mc1",
        }
      }
      throw new Error(`Unexpected endpoint: ${endpoint}`)
    })

    await persistAsaasWebhook({
      id: "evt_associate_direct_1",
      event: "PAYMENT_CONFIRMED",
      payment: { id: "pay_multichannel_1" },
    })

    expect(associatesUpdateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "active",
        overdue_months: 0,
        last_paid_at: expect.any(String),
      }),
    )
  })

  it("ativa associado quando pagamento do carrinho quitando mensalidade (metadata) for confirmado", async () => {
    vi.spyOn(asaasClient, "asaasFetch").mockImplementation(async (endpoint: string) => {
      if (endpoint === "/payments/pay_cart_settled_1") {
        return {
          id: "pay_cart_settled_1",
          status: "RECEIVED",
          externalReference: "PG-CART123",
          value: 125,
          billingType: "PIX",
        }
      }
      throw new Error(`Unexpected endpoint: ${endpoint}`)
    })

    paymentsUpdateSpy.mockImplementation(() =>
      createChainableUpdate([
        {
          id: "pay_local_1",
          appointment_id: "apt_1",
          metadata: {
            settleAssociateFee: true,
            associateId: "ass-cart-200",
            settlementFee: 35,
          },
          description: "Consulta Geral · quitação de mensalidade associado",
        },
      ]),
    )

    await persistAsaasWebhook({
      id: "evt_cart_settlement_1",
      event: "PAYMENT_RECEIVED",
      payment: { id: "pay_cart_settled_1" },
    })

    expect(associatesUpdateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "active",
        overdue_months: 0,
        last_paid_at: expect.any(String),
      }),
    )
  })

  it("ativa associado quando pagamento de assinatura recorrente for confirmado", async () => {
    vi.spyOn(asaasClient, "asaasFetch").mockImplementation(async (endpoint: string) => {
      if (endpoint === "/payments/pay_sub_charge_1") {
        return {
          id: "pay_sub_charge_1",
          status: "CONFIRMED",
          subscription: "sub_100",
          value: 35,
          billingType: "CREDIT_CARD",
        }
      }
      throw new Error(`Unexpected endpoint: ${endpoint}`)
    })

    await persistAsaasWebhook({
      id: "evt_sub_payment_1",
      event: "PAYMENT_CONFIRMED",
      payment: { id: "pay_sub_charge_1" },
    })

    expect(associatesUpdateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "active",
        overdue_months: 0,
        last_paid_at: expect.any(String),
      }),
    )
  })

  it("não ativa associado se pagamento for estornado ou recusado", async () => {
    vi.spyOn(asaasClient, "asaasFetch").mockImplementation(async (endpoint: string) => {
      if (endpoint === "/payments/pay_refunded_1") {
        return {
          id: "pay_refunded_1",
          status: "REFUNDED",
          externalReference: "associate:ass-direct-100",
          value: 35,
        }
      }
      throw new Error(`Unexpected endpoint: ${endpoint}`)
    })

    await persistAsaasWebhook({
      id: "evt_payment_refunded_1",
      event: "PAYMENT_REFUNDED",
      payment: { id: "pay_refunded_1" },
    })

    expect(associatesUpdateSpy).not.toHaveBeenCalled()
  })
})
