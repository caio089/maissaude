import { describe, expect, it, vi, beforeEach } from "vitest"

vi.mock("server-only", () => ({}))

import * as clinicSessionModule from "@/lib/clinic-session"
import * as supabaseAdminModule from "@/lib/supabase/admin"
import {
  GET as getProfessionals,
  POST as postProfessionals,
  PATCH as patchProfessionals,
  DELETE as deleteProfessionals,
} from "@/app/api/desktop/professionals/route"
import {
  GET as getAssociateRules,
  PUT as putAssociateRules,
  POST as postAssociateRules,
} from "@/app/api/desktop/associate-rules/route"
import {
  GET as getCashEntries,
  POST as postCashEntries,
} from "@/app/api/desktop/cash-entries/route"
import { POST as postServices } from "@/app/api/desktop/services/route"

describe("Role Guards - Backend API Routes", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  describe("/api/desktop/professionals", () => {
    it("GET retorna 401 se não estiver autenticado", async () => {
      vi.spyOn(clinicSessionModule, "getClinicSession").mockResolvedValue({
        authenticated: false,
        role: "attendant",
        email: "",
        name: "",
      })
      vi.spyOn(clinicSessionModule, "hasClinicSession").mockResolvedValue(false)

      const response = await getProfessionals()
      expect(response.status).toBe(401)
      const data = await response.json()
      expect(data.error).toBe("Entre no painel da clínica.")
    })

    it("GET permite leitura para o papel attendant", async () => {
      vi.spyOn(clinicSessionModule, "getClinicSession").mockResolvedValue({
        authenticated: true,
        role: "attendant",
        email: "atendente@exemplo.com",
        name: "Atendente",
      })
      vi.spyOn(clinicSessionModule, "hasClinicSession").mockResolvedValue(true)

      const mockDb = {
        from: vi.fn((table: string) => {
          if (table === "professionals") {
            return {
              select: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({
                  data: [
                    {
                      id: "pro-1",
                      name: "Dra. Maria",
                      specialty: "Clínica Geral",
                      credential_label: "CRM",
                      credential_code: "12345-SP",
                      bio: "Médica experiente",
                      price: 150,
                      rating: 5,
                      review_count: 10,
                      work_days: [1, 2, 3, 4, 5],
                      start_hour: "08:00",
                      end_hour: "18:00",
                      location: "Sala 1",
                      active: true,
                      avatar_seed: "dra-maria",
                    },
                  ],
                  error: null,
                }),
              }),
            }
          }
          if (table === "professional_services") {
            return {
              select: vi.fn().mockResolvedValue({ data: [], error: null }),
            }
          }
          if (table === "catalog_offers") {
            return {
              select: vi.fn().mockResolvedValue({ data: [], error: null }),
            }
          }
          return {}
        }),
      }
      vi.spyOn(supabaseAdminModule, "createSupabaseAdmin").mockReturnValue(mockDb as any)

      const response = await getProfessionals()
      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.professionals).toBeDefined()
      expect(data.professionals.length).toBe(1)
      expect(data.professionals[0].name).toBe("Dra. Maria")
    })

    it("POST retorna 401 se não estiver autenticado", async () => {
      vi.spyOn(clinicSessionModule, "getClinicSession").mockResolvedValue({
        authenticated: false,
        role: "attendant",
        email: "",
        name: "",
      })

      const request = new Request("http://localhost/api/desktop/professionals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })

      const response = await postProfessionals(request)
      expect(response.status).toBe(401)
      const data = await response.json()
      expect(data.error).toBe("Entre no painel da clínica.")
    })

    it("POST retorna 403 Forbidden para papel attendant com mensagem clara de somente leitura", async () => {
      vi.spyOn(clinicSessionModule, "getClinicSession").mockResolvedValue({
        authenticated: true,
        role: "attendant",
        email: "atendente@exemplo.com",
        name: "Atendente",
      })

      const request = new Request("http://localhost/api/desktop/professionals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          form: {
            name: "Dr. Novo",
            specialty: "Clínica Geral",
            credentialCode: "CRM-9999",
            bio: "Novo médico",
            price: 200,
            workDays: [1, 2, 3],
            startHour: "08:00",
            endHour: "17:00",
            active: true,
          },
          services: [],
        }),
      })

      const response = await postProfessionals(request)
      expect(response.status).toBe(403)
      const data = await response.json()
      expect(data.error).toBe("Atendentes possuem acesso somente leitura aos profissionais.")
    })

    it("PATCH retorna 403 Forbidden para papel attendant", async () => {
      vi.spyOn(clinicSessionModule, "getClinicSession").mockResolvedValue({
        authenticated: true,
        role: "attendant",
        email: "atendente@exemplo.com",
        name: "Atendente",
      })

      const request = new Request("http://localhost/api/desktop/professionals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: "pro-1" }),
      })

      const response = await patchProfessionals(request)
      expect(response.status).toBe(403)
      const data = await response.json()
      expect(data.error).toBe("Atendentes possuem acesso somente leitura aos profissionais.")
    })

    it("DELETE retorna 403 Forbidden para papel attendant", async () => {
      vi.spyOn(clinicSessionModule, "getClinicSession").mockResolvedValue({
        authenticated: true,
        role: "attendant",
        email: "atendente@exemplo.com",
        name: "Atendente",
      })

      const request = new Request("http://localhost/api/desktop/professionals", {
        method: "DELETE",
      })

      const response = await deleteProfessionals(request)
      expect(response.status).toBe(403)
      const data = await response.json()
      expect(data.error).toBe("Atendentes possuem acesso somente leitura aos profissionais.")
    })

    it("POST permite mutação para o papel admin", async () => {
      vi.spyOn(clinicSessionModule, "getClinicSession").mockResolvedValue({
        authenticated: true,
        role: "admin",
        email: "admin@exemplo.com",
        name: "Admin",
      })

      const mockDb = {
        from: vi.fn((table: string) => {
          if (table === "professionals") {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: {
                      id: "pro-admin-test",
                      credential_label: "CRM",
                      location: "Consultório 1",
                      avatar_seed: "dr-admin",
                      rating: 5,
                      review_count: 1,
                    },
                    error: null,
                  }),
                }),
              }),
              upsert: vi.fn().mockResolvedValue({ error: null }),
            }
          }
          if (table === "professional_services") {
            return {
              select: vi.fn().mockReturnValue({
                in: vi.fn().mockResolvedValue({ data: [], error: null }),
              }),
              upsert: vi.fn().mockResolvedValue({ error: null }),
            }
          }
          if (table === "catalog_offers") {
            return {
              upsert: vi.fn().mockResolvedValue({ error: null }),
            }
          }
          return {}
        }),
      }
      vi.spyOn(supabaseAdminModule, "createSupabaseAdmin").mockReturnValue(mockDb as any)

      const request = new Request("http://localhost/api/desktop/professionals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: "pro-admin-test",
          form: {
            name: "Dr. Admin Test",
            specialty: "clinica-geral",
            credentialCode: "CRM-12345",
            bio: "Médico especialista com ampla experiência",
            price: 200,
            workDays: [1, 2, 3, 4, 5],
            startHour: "08:00",
            endHour: "18:00",
            active: true,
          },
          services: [],
        }),
      })

      const response = await postProfessionals(request)
      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.id).toBe("pro-admin-test")
    })
  })

  describe("/api/desktop/associate-rules", () => {
    it("PUT retorna 401 se não estiver autenticado", async () => {
      vi.spyOn(clinicSessionModule, "getClinicSession").mockResolvedValue({
        authenticated: false,
        role: "attendant",
        email: "",
        name: "",
      })

      const request = new Request("http://localhost/api/desktop/associate-rules", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })

      const response = await putAssociateRules(request)
      expect(response.status).toBe(401)
      const data = await response.json()
      expect(data.error).toBe("Entre no painel da clínica.")
    })

    it("PUT retorna 403 Forbidden para papel attendant", async () => {
      vi.spyOn(clinicSessionModule, "getClinicSession").mockResolvedValue({
        authenticated: true,
        role: "attendant",
        email: "atendente@exemplo.com",
        name: "Atendente",
      })

      const request = new Request("http://localhost/api/desktop/associate-rules", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fee: 65,
          consultationDiscountPercent: 25,
          transportEnabled: true,
          transportRidesPerMonth: 2,
          extraBenefits: [],
        }),
      })

      const response = await putAssociateRules(request)
      expect(response.status).toBe(403)
      const data = await response.json()
      expect(data.error).toBe("Apenas administradores podem alterar as regras de mensalidade.")
    })

    it("POST retorna 403 Forbidden para papel attendant", async () => {
      vi.spyOn(clinicSessionModule, "getClinicSession").mockResolvedValue({
        authenticated: true,
        role: "attendant",
        email: "atendente@exemplo.com",
        name: "Atendente",
      })

      const request = new Request("http://localhost/api/desktop/associate-rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fee: 65,
          consultationDiscountPercent: 25,
          transportEnabled: true,
          transportRidesPerMonth: 2,
          extraBenefits: [],
        }),
      })

      const response = await postAssociateRules(request)
      expect(response.status).toBe(403)
      const data = await response.json()
      expect(data.error).toBe("Apenas administradores podem alterar as regras de mensalidade.")
    })

    it("PUT permite mutação para o papel admin", async () => {
      vi.spyOn(clinicSessionModule, "getClinicSession").mockResolvedValue({
        authenticated: true,
        role: "admin",
        email: "admin@exemplo.com",
        name: "Admin",
      })

      const mockDb = {
        from: vi.fn((table: string) => {
          if (table === "associate_rules") {
            return {
              upsert: vi.fn().mockResolvedValue({ error: null }),
            }
          }
          return {}
        }),
      }
      vi.spyOn(supabaseAdminModule, "createSupabaseAdmin").mockReturnValue(mockDb as any)

      const request = new Request("http://localhost/api/desktop/associate-rules", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fee: 65,
          consultationDiscountPercent: 25,
          transportEnabled: true,
          transportRidesPerMonth: 2,
          extraBenefits: ["Desconto em exames"],
        }),
      })

      const response = await putAssociateRules(request)
      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.rules).toBeDefined()
      expect(data.rules.fee).toBe(65)
    })
  })

  describe("/api/desktop/cash-entries", () => {
    it("GET retorna 401 se não estiver autenticado", async () => {
      vi.spyOn(clinicSessionModule, "getClinicSession").mockResolvedValue({
        authenticated: false,
        role: "attendant",
        email: "",
        name: "",
      })

      const response = await getCashEntries()
      expect(response.status).toBe(401)
      const data = await response.json()
      expect(data.error).toBe("Entre no painel da clínica.")
    })

    it("GET retorna 403 Forbidden para papel attendant", async () => {
      vi.spyOn(clinicSessionModule, "getClinicSession").mockResolvedValue({
        authenticated: true,
        role: "attendant",
        email: "atendente@exemplo.com",
        name: "Atendente",
      })

      const response = await getCashEntries()
      expect(response.status).toBe(403)
      const data = await response.json()
      expect(data.error).toBe("Módulo financeiro restrito à administração.")
    })

    it("POST retorna 403 Forbidden para papel attendant", async () => {
      vi.spyOn(clinicSessionModule, "getClinicSession").mockResolvedValue({
        authenticated: true,
        role: "attendant",
        email: "atendente@exemplo.com",
        name: "Atendente",
      })

      const request = new Request("http://localhost/api/desktop/cash-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: 100 }),
      })

      const response = await postCashEntries(request)
      expect(response.status).toBe(403)
      const data = await response.json()
      expect(data.error).toBe("Módulo financeiro restrito à administração.")
    })

    it("GET permite acesso para papel admin", async () => {
      vi.spyOn(clinicSessionModule, "getClinicSession").mockResolvedValue({
        authenticated: true,
        role: "admin",
        email: "admin@exemplo.com",
        name: "Admin",
      })

      const response = await getCashEntries()
      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.entries).toBeDefined()
    })
  })

  describe("/api/desktop/services", () => {
    it("POST retorna 401 se não estiver autenticado", async () => {
      vi.spyOn(clinicSessionModule, "getClinicSession").mockResolvedValue({
        authenticated: false,
        role: "attendant",
        email: "",
        name: "",
      })

      const request = new Request("http://localhost/api/desktop/services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })

      const response = await postServices(request)
      expect(response.status).toBe(401)
      const data = await response.json()
      expect(data.error).toBe("Entre no painel da clínica.")
    })

    it("POST retorna 403 Forbidden para papel attendant", async () => {
      vi.spyOn(clinicSessionModule, "getClinicSession").mockResolvedValue({
        authenticated: true,
        role: "attendant",
        email: "atendente@exemplo.com",
        name: "Atendente",
      })

      const request = new Request("http://localhost/api/desktop/services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          professionalId: "pro-1",
          services: [
            {
              id: "srv-1",
              name: "Consulta",
              price: 100,
              durationMin: 30,
              modality: "presencial",
              kind: "consulta",
            },
          ],
        }),
      })

      const response = await postServices(request)
      expect(response.status).toBe(403)
      const data = await response.json()
      expect(data.error).toBe("Atendentes possuem acesso somente leitura aos atendimentos.")
    })

    it("POST permite prosseguimento para papel admin", async () => {
      vi.spyOn(clinicSessionModule, "getClinicSession").mockResolvedValue({
        authenticated: true,
        role: "admin",
        email: "admin@exemplo.com",
        name: "Admin",
      })

      // Sem banco configurado ou corpo incompleto, não retorna 401 nem 403
      const request = new Request("http://localhost/api/desktop/services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })

      const response = await postServices(request)
      expect(response.status).not.toBe(401)
      expect(response.status).not.toBe(403)
    })
  })
})
