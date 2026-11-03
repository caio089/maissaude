import { describe, expect, it, vi, beforeEach } from "vitest"

vi.mock("server-only", () => ({}))
import { PATCH } from "@/app/api/desktop/consultations/route"
import * as clinicSession from "@/lib/clinic-session"
import * as adminSupabase from "@/lib/supabase/admin"

describe("PATCH /api/desktop/consultations", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("devolve 401 se a clínica não estiver autenticada", async () => {
    vi.spyOn(clinicSession, "hasClinicSession").mockResolvedValue(false)
    const request = new Request("http://localhost/api/desktop/consultations", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ appointmentId: "apt-1", status: "confirmed" }),
    })
    const response = await PATCH(request)
    expect(response.status).toBe(401)
  })

  it("atualiza status de agendamento com sucesso", async () => {
    vi.spyOn(clinicSession, "hasClinicSession").mockResolvedValue(true)
    const mockDb = {
      from: vi.fn((table: string) => {
        if (table === "appointments") {
          return {
            update: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({ error: null }),
          }
        }
        return {}
      }),
    }
    vi.spyOn(adminSupabase, "createSupabaseAdmin").mockReturnValue(mockDb as any)

    const request = new Request("http://localhost/api/desktop/consultations", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ appointmentId: "apt-1", status: "confirmed" }),
    })
    const response = await PATCH(request)
    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.ok).toBe(true)
    expect(json.status).toBe("confirmed")
  })

  it("registra pagamento de consulta (settlePayment) com sucesso", async () => {
    vi.spyOn(clinicSession, "hasClinicSession").mockResolvedValue(true)
    const mockDb = {
      from: vi.fn((table: string) => {
        if (table === "payments") {
          return {
            update: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            select: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: { id: "pay-1", appointment_id: "apt-1", status: "paid" },
              error: null,
            }),
          }
        }
        if (table === "appointments") {
          return {
            update: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
          }
        }
        return {}
      }),
    }
    vi.spyOn(adminSupabase, "createSupabaseAdmin").mockReturnValue(mockDb as any)

    const request = new Request("http://localhost/api/desktop/consultations", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentId: "pay-1", settleMethod: "pix" }),
    })
    const response = await PATCH(request)
    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.ok).toBe(true)
    expect(json.status).toBe("paid")
  })
})

