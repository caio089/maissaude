import { describe, expect, it, vi, beforeEach } from "vitest"

vi.mock("server-only", () => ({}))
import { GET, POST, DELETE } from "@/app/api/desktop/clinics/route"
import * as clinicSession from "@/lib/clinic-session"
import * as adminSupabase from "@/lib/supabase/admin"

describe("Partner Clinics API (/api/desktop/clinics)", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  describe("GET /api/desktop/clinics", () => {
    it("retorna 401 se a clínica não estiver autenticada", async () => {
      vi.spyOn(clinicSession, "getClinicSession").mockResolvedValue({
        authenticated: false,
        role: "attendant",
        email: "",
        name: "",
      })

      const response = await GET()
      expect(response.status).toBe(401)
    })

    it("retorna lista de clínicas para admin e atendente", async () => {
      vi.spyOn(clinicSession, "getClinicSession").mockResolvedValue({
        authenticated: true,
        role: "attendant",
        email: "atendente@cuidarsaude.com",
        name: "Atendente",
      })

      const mockDb = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({
            data: [
              {
                id: "clinic-default",
                name: "CuidarSaude",
                legal_name: "CuidarSaude Centro Médico Ltda",
                city: "Teresina - PI",
                address: "Rua Félix Pacheco, 2159 - Centro",
                phone: "(86) 3000-0000",
                email: "cuidarsaude2026@gmail.com",
              },
              {
                id: "cli-1",
                name: "Laboratório Santa Maria",
                legal_name: "Laboratório Santa Maria Ltda",
                city: "Teresina - PI",
                address: "Av. Frei Serafim, 1200",
                phone: "(86) 3222-1100",
                email: "contato@santamaria.com",
              },
            ],
            error: null,
          }),
        }),
      }
      vi.spyOn(adminSupabase, "createSupabaseAdmin").mockReturnValue(mockDb as any)

      const response = await GET()
      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.clinics).toHaveLength(2)
      expect(data.clinics[0].id).toBe("clinic-default")
      expect(data.clinics[1].name).toBe("Laboratório Santa Maria")
    })
  })

  describe("POST /api/desktop/clinics", () => {
    it("retorna 403 se o usuário for atendente", async () => {
      vi.spyOn(clinicSession, "getClinicSession").mockResolvedValue({
        authenticated: true,
        role: "attendant",
        email: "atendente@cuidarsaude.com",
        name: "Atendente",
      })

      const request = new Request("http://localhost/api/desktop/clinics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Clínica Teste" }),
      })
      const response = await POST(request)
      expect(response.status).toBe(403)
    })

    it("retorna 422 se faltar dados obrigatórios", async () => {
      vi.spyOn(clinicSession, "getClinicSession").mockResolvedValue({
        authenticated: true,
        role: "admin",
        email: "admin@cuidarsaude.com",
        name: "Admin",
      })
      vi.spyOn(adminSupabase, "createSupabaseAdmin").mockReturnValue({} as any)

      const request = new Request("http://localhost/api/desktop/clinics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Clínica Sem Endereço" }),
      })
      const response = await POST(request)
      expect(response.status).toBe(422)
    })

    it("salva clínica parceira com sucesso quando admin", async () => {
      vi.spyOn(clinicSession, "getClinicSession").mockResolvedValue({
        authenticated: true,
        role: "admin",
        email: "admin@cuidarsaude.com",
        name: "Admin",
      })

      const mockDb = {
        from: vi.fn().mockReturnValue({
          upsert: vi.fn().mockReturnThis(),
          select: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: {
              id: "cli-123",
              name: "Laboratório São Lucas",
              legal_name: "São Lucas Ltda",
              city: "Teresina - PI",
              address: "Rua Olavo Bilac, 500",
              phone: "(86) 3221-5000",
              email: "sac@saolucas.com",
              created_at: "2026-11-12T10:00:00Z",
            },
            error: null,
          }),
        }),
      }
      vi.spyOn(adminSupabase, "createSupabaseAdmin").mockReturnValue(mockDb as any)

      const request = new Request("http://localhost/api/desktop/clinics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Laboratório São Lucas",
          legalName: "São Lucas Ltda",
          city: "Teresina - PI",
          address: "Rua Olavo Bilac, 500",
          phone: "(86) 3221-5000",
          email: "sac@saolucas.com",
        }),
      })
      const response = await POST(request)
      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.clinic.name).toBe("Laboratório São Lucas")
      expect(data.clinic.id).toBe("cli-123")
    })
  })

  describe("DELETE /api/desktop/clinics", () => {
    it("não permite excluir a clínica matriz padrão clinic-default", async () => {
      vi.spyOn(clinicSession, "getClinicSession").mockResolvedValue({
        authenticated: true,
        role: "admin",
        email: "admin@cuidarsaude.com",
        name: "Admin",
      })
      vi.spyOn(adminSupabase, "createSupabaseAdmin").mockReturnValue({} as any)

      const request = new Request("http://localhost/api/desktop/clinics?id=clinic-default", {
        method: "DELETE",
      })
      const response = await DELETE(request)
      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toContain("matriz padrão")
    })

    it("permite excluir clínica parceira cadastrada", async () => {
      vi.spyOn(clinicSession, "getClinicSession").mockResolvedValue({
        authenticated: true,
        role: "admin",
        email: "admin@cuidarsaude.com",
        name: "Admin",
      })

      const mockDb = {
        from: vi.fn().mockReturnValue({
          delete: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      }
      vi.spyOn(adminSupabase, "createSupabaseAdmin").mockReturnValue(mockDb as any)

      const request = new Request("http://localhost/api/desktop/clinics?id=cli-parceira", {
        method: "DELETE",
      })
      const response = await DELETE(request)
      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.ok).toBe(true)
    })
  })

  describe("Fallback de compatibilidade PGRST204 em Serviços e Consultas", () => {
    it("POST /api/desktop/services faz fallback gracioso quando a coluna clinic_id não existe (PGRST204)", async () => {
      const { POST: postServices } = await import("@/app/api/desktop/services/route")

      vi.spyOn(clinicSession, "getClinicSession").mockResolvedValue({
        authenticated: true,
        role: "admin",
        email: "admin@cuidarsaude.com",
        name: "Admin",
      })

      let upsertAttempts = 0
      const mockDb = {
        from: vi.fn((table: string) => {
          if (table === "clinics") {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({
                data: { name: "Clinica Parceira ABC" },
                error: null,
              }),
            }
          }
          if (table === "catalog_offers") {
            return {
              upsert: vi.fn().mockImplementation((payload) => {
                upsertAttempts++
                if (upsertAttempts === 1) {
                  return Promise.resolve({
                    data: null,
                    error: {
                      code: "PGRST204",
                      message: "Could not find the 'clinic_id' column of 'catalog_offers' in the schema cache",
                    },
                  })
                }
                return Promise.resolve({ data: payload, error: null })
              }),
            }
          }
          return {}
        }),
      }
      vi.spyOn(adminSupabase, "createSupabaseAdmin").mockReturnValue(mockDb as any)

      const request = new Request("http://localhost/api/desktop/services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          professionalId: null,
          clinicId: "cli-abc",
          services: [
            {
              id: "srv-exame-1",
              name: "Ecocardiograma",
              price: 180,
              durationMin: 30,
              kind: "exame",
            },
          ],
        }),
      })

      const response = await postServices(request)
      expect(response.status).toBe(200)
      expect(upsertAttempts).toBe(2)
      const data = await response.json()
      expect(data.ok).toBe(true)
    })

    it("POST /api/desktop/consultations agenda exame de clínica parceira com fallback PGRST204", async () => {
      const { POST: postConsultations } = await import("@/app/api/desktop/consultations/route")
      const asaasCharges = await import("@/lib/asaas/charges")

      vi.spyOn(clinicSession, "hasClinicSession").mockResolvedValue(true)
      vi.spyOn(asaasCharges, "createAsaasCharge").mockResolvedValue({
        payment: { id: "pay_asaas_1", invoiceUrl: "https://asaas.com/i/1" } as any,
        pix: { payload: "pix_code_test", encodedImage: "base64img" } as any,
      } as any)

      let appointmentInsertAttempts = 0
      let paymentInsertAttempts = 0

      const mockDb = {
        from: vi.fn((table: string) => {
          if (table === "patients") {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({
                data: { id: "pat-1", name: "Nicolas Rodrigues", cpf: "09142820340", status: "active", email: "nicolas@teste.com", phone: "86999999999" },
                error: null,
              }),
            }
          }
          if (table === "catalog_offers") {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({
                data: { id: "svc-tc", service_name: "TC COLUNA LOMBAR", price: 220, duration_min: 40, kind: "exame" },
                error: null,
              }),
            }
          }
          if (table === "clinics") {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({
                data: { id: "cli-teste", name: "Clinica teste", city: "Teresina - PI", address: "Rua 1", phone: "86999999999" },
                error: null,
              }),
            }
          }
          if (table === "associates") {
            return {
              select: vi.fn().mockReturnThis(),
              in: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({ data: { status: "active" }, error: null }),
            }
          }
          if (table === "associate_rules") {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({ data: { consultation_discount_percent: 10 }, error: null }),
            }
          }
          if (table === "professionals") {
            return {
              select: vi.fn().mockReturnThis(),
              limit: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({ data: { id: "pro-fallback" }, error: null }),
            }
          }
          if (table === "appointments") {
            return {
              insert: vi.fn().mockImplementation((payload) => {
                appointmentInsertAttempts++
                if (appointmentInsertAttempts === 1) {
                  return Promise.resolve({
                    data: null,
                    error: {
                      code: "PGRST204",
                      message: "Could not find the 'clinic_id' column of 'appointments' in the schema cache",
                    },
                  })
                }
                return Promise.resolve({ data: payload, error: null })
              }),
              update: vi.fn().mockReturnThis(),
              eq: vi.fn().mockResolvedValue({ error: null }),
            }
          }
          if (table === "payments") {
            return {
              insert: vi.fn().mockImplementation((payload) => {
                paymentInsertAttempts++
                if (paymentInsertAttempts === 1) {
                  return Promise.resolve({
                    data: null,
                    error: {
                      code: "23502",
                      message: 'null value in column "professional_id" violates not-null constraint',
                    },
                  })
                }
                return Promise.resolve({ data: payload, error: null })
              }),
            }
          }
          return {}
        }),
      }
      vi.spyOn(adminSupabase, "createSupabaseAdmin").mockReturnValue(mockDb as any)

      const request = new Request("http://localhost/api/desktop/consultations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId: "pat-1",
          professionalId: null,
          clinicId: "cli-teste",
          serviceId: "svc-tc",
          date: "2026-11-20",
          time: "10:50",
          billingType: "PIX",
        }),
      })

      const response = await postConsultations(request)
      expect(response.status).toBe(200)
      expect(appointmentInsertAttempts).toBe(2) // Tentativa 1 com clinic_id falhou PGRST204, tentativa 2 sem clinic_id sucedeu
      expect(paymentInsertAttempts).toBe(2) // Tentativa 1 com null falhou 23502, tentativa 2 com fallback pro sucedeu
      const data = await response.json()
      expect(data.appointmentId).toBeDefined()
      expect(data.paymentId).toBeDefined()
      expect(data.pix.payload).toBe("pix_code_test")
    })
  })
})
