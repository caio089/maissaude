import { describe, expect, it, vi, beforeEach } from "vitest"

vi.mock("server-only", () => ({}))
import { GET } from "@/app/api/desktop/guides/route"
import * as clinicSession from "@/lib/clinic-session"
import * as adminSupabase from "@/lib/supabase/admin"

describe("GET /api/desktop/guides", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("devolve 401 se a clínica não estiver autenticada", async () => {
    vi.spyOn(clinicSession, "hasClinicSession").mockResolvedValue(false)
    const request = new Request("http://localhost/api/desktop/guides")
    const response = await GET(request)
    expect(response.status).toBe(401)
  })

  it("retorna guias com guideInput completo quando autenticado", async () => {
    vi.spyOn(clinicSession, "hasClinicSession").mockResolvedValue(true)
    const mockDb = {
      from: vi.fn((table: string) => {
        if (table === "authorization_guides") {
          return {
            select: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue({
              data: [{ id: "guide-123", appointment_id: "apt-1", payment_id: "pay-1", issued_at: "2026-10-31T14:00:00Z" }],
              error: null,
            }),
          }
        }
        if (table === "appointments") {
          return {
            select: vi.fn().mockReturnThis(),
            in: vi.fn().mockResolvedValue({
              data: [{ id: "apt-1", patient_id: "pat-1", professional_id: "pro-1", service_id: "srv-1", starts_at: "2026-11-01T10:00:00Z", status: "confirmed", payment_id: "pay-1" }],
              error: null,
            }),
          }
        }
        if (table === "payments") {
          return {
            select: vi.fn().mockReturnThis(),
            in: vi.fn().mockResolvedValue({
              data: [{ id: "pay-1", status: "paid", simulated: false, asaas_payment_id: "pay_asaas_1" }],
              error: null,
            }),
          }
        }
        if (table === "patients") {
          return {
            select: vi.fn().mockReturnThis(),
            in: vi.fn().mockResolvedValue({
              data: [{ id: "pat-1", name: "Maria Silva", cpf: "123.456.789-00", birth_date: "1990-05-15" }],
              error: null,
            }),
          }
        }
        if (table === "professionals") {
          return {
            select: vi.fn().mockReturnThis(),
            in: vi.fn().mockResolvedValue({
              data: [{ id: "pro-1", name: "Dr. Carlos Lima", specialty: "clinica-geral", credential_label: "CRM", credential_code: "12345/CE", location: "Sala 102", start_hour: "08:00", end_hour: "17:00" }],
              error: null,
            }),
          }
        }
        if (table === "professional_services") {
          return {
            select: vi.fn().mockReturnThis(),
            in: vi.fn().mockResolvedValue({
              data: [{ id: "srv-1", name: "Consulta Clínica", price: 150 }],
              error: null,
            }),
          }
        }
        if (table === "clinics") {
          return {
            select: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue({
              data: [{ id: "clinic-1", name: "CuidarSaude Central", phone: "(85) 99999-0000", address: "Av. Santos Dumont, 1000", city: "Fortaleza/CE" }],
              error: null,
            }),
          }
        }
        return { select: vi.fn().mockReturnThis(), in: vi.fn().mockResolvedValue({ data: [], error: null }) }
      }),
    }

    vi.spyOn(adminSupabase, "createSupabaseAdmin").mockReturnValue(mockDb as unknown as ReturnType<typeof adminSupabase.createSupabaseAdmin>)

    const request = new Request("http://localhost/api/desktop/guides")
    const response = await GET(request)
    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.guides).toHaveLength(1)
    expect(json.guides[0].guideInput).toBeDefined()
    expect(json.guides[0].guideInput.patient.name).toBe("Maria Silva")
    expect(json.guides[0].guideInput.patient.birthDate).toBe("1990-05-15")
    expect(json.guides[0].guideInput.professional.name).toBe("Dr. Carlos Lima")
    expect(json.guides[0].guideInput.clinic.name).toBe("CuidarSaude Central")
  })
})
