import { describe, expect, it, vi, beforeEach } from "vitest"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"

vi.mock("server-only", () => ({}))
vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() },
}))

import * as clinicSessionModule from "@/lib/clinic-session"
import * as supabaseAdminModule from "@/lib/supabase/admin"
import { GET, POST } from "@/app/api/desktop/services/route"
import {
  ServicesView,
  type ServicesViewProps,
  canManageServices,
  getServicesViewMode,
} from "@/components/desktop/services-view"

describe("Independent Procedures & Exames API (/api/desktop/services)", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  describe("GET /api/desktop/services", () => {
    it("retorna 401 se não estiver autenticado", async () => {
      vi.spyOn(clinicSessionModule, "getClinicSession").mockResolvedValue({
        authenticated: false,
        role: "attendant",
        email: "",
        name: "",
      })

      const response = await GET()
      expect(response.status).toBe(401)
      const data = await response.json()
      expect(data.error).toBe("Entre no painel da clínica.")
    })

    it("retorna 503 se o banco estiver indisponível", async () => {
      vi.spyOn(clinicSessionModule, "getClinicSession").mockResolvedValue({
        authenticated: true,
        role: "admin",
        email: "admin@exemplo.com",
        name: "Admin",
      })
      vi.spyOn(supabaseAdminModule, "createSupabaseAdmin").mockReturnValue(null)

      const response = await GET()
      expect(response.status).toBe(503)
      const data = await response.json()
      expect(data.error).toBe("Banco de dados indisponível.")
    })

    it("permite leitura para atendente e retorna ofertas ordenadas", async () => {
      vi.spyOn(clinicSessionModule, "getClinicSession").mockResolvedValue({
        authenticated: true,
        role: "attendant",
        email: "atendente@exemplo.com",
        name: "Atendente",
      })

      const mockOffers = [
        {
          id: "svc-1",
          service_name: "Eletrocardiograma",
          kind: "exame",
          professional_id: null,
          price: "120.00",
          duration_min: 20,
        },
        {
          id: "svc-2",
          service_name: "Consulta Pediátrica",
          kind: "consulta",
          professional_id: "pro-pediatra",
          price: 200,
          duration_min: 30,
        },
      ]

      const orderMock = vi.fn().mockResolvedValue({
        data: mockOffers,
        error: null,
      })
      const selectMock = vi.fn().mockReturnValue({ order: orderMock })
      const fromMock = vi.fn().mockReturnValue({ select: selectMock })

      vi.spyOn(supabaseAdminModule, "createSupabaseAdmin").mockReturnValue({
        from: fromMock,
      } as any)

      const response = await GET()
      expect(response.status).toBe(200)
      const data = await response.json()

      expect(fromMock).toHaveBeenCalledWith("catalog_offers")
      expect(orderMock).toHaveBeenCalledWith("service_name")
      expect(data.offers).toEqual([
        {
          id: "svc-1",
          name: "Eletrocardiograma",
          kind: "exame",
          professionalId: null,
          price: 120,
          durationMin: 20,
        },
        {
          id: "svc-2",
          name: "Consulta Pediátrica",
          kind: "consulta",
          professionalId: "pro-pediatra",
          price: 200,
          durationMin: 30,
        },
      ])
    })

    it("suporta filtro por kind e por professionalId nos parâmetros de busca", async () => {
      vi.spyOn(clinicSessionModule, "getClinicSession").mockResolvedValue({
        authenticated: true,
        role: "admin",
        email: "admin@exemplo.com",
        name: "Admin",
      })

      const isMock = vi.fn().mockResolvedValue({
        data: [
          {
            id: "svc-exame",
            service_name: "Hemograma",
            kind: "exame",
            professional_id: null,
            price: 50,
            duration_min: 15,
          },
        ],
        error: null,
      })
      const eqMock = vi.fn().mockReturnValue({ is: isMock })
      const orderMock = vi.fn().mockReturnValue({ eq: eqMock })
      const selectMock = vi.fn().mockReturnValue({ order: orderMock })
      const fromMock = vi.fn().mockReturnValue({ select: selectMock })

      vi.spyOn(supabaseAdminModule, "createSupabaseAdmin").mockReturnValue({
        from: fromMock,
      } as any)

      const req = new Request("http://localhost/api/desktop/services?kind=exame&professionalId=null")
      const response = await GET(req)
      expect(response.status).toBe(200)

      expect(eqMock).toHaveBeenCalledWith("kind", "exame")
      expect(isMock).toHaveBeenCalledWith("professional_id", null)

      const data = await response.json()
      expect(data.offers).toHaveLength(1)
      expect(data.offers[0].professionalId).toBeNull()
    })
  })

  describe("POST /api/desktop/services", () => {
    it("retorna 401 se não estiver autenticado", async () => {
      vi.spyOn(clinicSessionModule, "getClinicSession").mockResolvedValue({
        authenticated: false,
        role: "attendant",
        email: "",
        name: "",
      })

      const req = new Request("http://localhost/api/desktop/services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })

      const response = await POST(req)
      expect(response.status).toBe(401)
      const data = await response.json()
      expect(data.error).toBe("Entre no painel da clínica.")
    })

    it("retorna 403 se o usuário for atendente", async () => {
      vi.spyOn(clinicSessionModule, "getClinicSession").mockResolvedValue({
        authenticated: true,
        role: "attendant",
        email: "atendente@exemplo.com",
        name: "Atendente",
      })

      const req = new Request("http://localhost/api/desktop/services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          professionalId: null,
          services: [
            {
              id: "svc-exame",
              name: "Raio-X de Tórax",
              kind: "exame",
              price: 150,
              durationMin: 20,
              modality: "presencial",
            },
          ],
        }),
      })

      const response = await POST(req)
      expect(response.status).toBe(403)
      const data = await response.json()
      expect(data.error).toBe("Atendentes possuem acesso somente leitura aos atendimentos.")
    })

    it("retorna 422 se os serviços forem inválidos ou vazios", async () => {
      vi.spyOn(clinicSessionModule, "getClinicSession").mockResolvedValue({
        authenticated: true,
        role: "admin",
        email: "admin@exemplo.com",
        name: "Admin",
      })
      vi.spyOn(supabaseAdminModule, "createSupabaseAdmin").mockReturnValue({} as any)

      const req = new Request("http://localhost/api/desktop/services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          professionalId: null,
          services: [],
        }),
      })

      const response = await POST(req)
      expect(response.status).toBe(422)
    })

    it("retorna 422 se algum serviço tiver valor inferior ao mínimo do Pix (R$ 10)", async () => {
      vi.spyOn(clinicSessionModule, "getClinicSession").mockResolvedValue({
        authenticated: true,
        role: "admin",
        email: "admin@exemplo.com",
        name: "Admin",
      })
      vi.spyOn(supabaseAdminModule, "createSupabaseAdmin").mockReturnValue({} as any)

      const req = new Request("http://localhost/api/desktop/services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          professionalId: null,
          services: [
            {
              id: "svc-barato",
              name: "Curativo",
              price: 5,
              durationMin: 15,
            },
          ],
        }),
      })

      const response = await POST(req)
      expect(response.status).toBe(422)
    })

    it("salva procedimento independente da clínica em catalog_offers com professional_id nulo", async () => {
      vi.spyOn(clinicSessionModule, "getClinicSession").mockResolvedValue({
        authenticated: true,
        role: "admin",
        email: "admin@exemplo.com",
        name: "Admin",
      })

      const upsertMock = vi.fn().mockResolvedValue({ error: null })
      const fromMock = vi.fn().mockImplementation((table: string) => {
        if (table === "catalog_offers") {
          return { upsert: upsertMock }
        }
        throw new Error(`Tabela inesperada: ${table}`)
      })

      vi.spyOn(supabaseAdminModule, "createSupabaseAdmin").mockReturnValue({
        from: fromMock,
      } as any)

      const req = new Request("http://localhost/api/desktop/services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          professionalId: null,
          services: [
            {
              id: "svc-exame-1",
              name: "Eletrocardiograma",
              kind: "exame",
              price: 130,
              durationMin: 20,
            },
            {
              id: "svc-proc-2",
              name: "Lavagem Otológica",
              price: 80,
              durationMin: 25,
            },
          ],
        }),
      })

      const response = await POST(req)
      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.ok).toBe(true)

      expect(fromMock).toHaveBeenCalledTimes(1)
      expect(fromMock).toHaveBeenCalledWith("catalog_offers")
      expect(upsertMock).toHaveBeenCalledWith([
        {
          id: "svc-exame-1",
          kind: "exame",
          service_name: "Eletrocardiograma",
          professional_id: null,
          price: 130,
          duration_min: 20,
        },
        {
          id: "svc-proc-2",
          kind: "exame", // padrão para procedimentos da clínica se kind não for informado
          service_name: "Lavagem Otológica",
          professional_id: null,
          price: 80,
          duration_min: 25,
        },
      ])
    })

    it("continua suportando salvar atendimentos vinculados a um profissional", async () => {
      vi.spyOn(clinicSessionModule, "getClinicSession").mockResolvedValue({
        authenticated: true,
        role: "admin",
        email: "admin@exemplo.com",
        name: "Admin",
      })

      const selectProfMock = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: { id: "pro-1", active: true },
            error: null,
          }),
        }),
      })
      const selectExistingServicesMock = vi.fn().mockReturnValue({
        in: vi.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
      })
      const upsertProfServicesMock = vi.fn().mockResolvedValue({ error: null })
      const upsertCatalogOffersMock = vi.fn().mockResolvedValue({ error: null })

      const fromMock = vi.fn().mockImplementation((table: string) => {
        if (table === "professionals") {
          return { select: selectProfMock }
        }
        if (table === "professional_services") {
          return {
            select: selectExistingServicesMock,
            upsert: upsertProfServicesMock,
          }
        }
        if (table === "catalog_offers") {
          return { upsert: upsertCatalogOffersMock }
        }
        throw new Error(`Tabela inesperada: ${table}`)
      })

      vi.spyOn(supabaseAdminModule, "createSupabaseAdmin").mockReturnValue({
        from: fromMock,
      } as any)

      const req = new Request("http://localhost/api/desktop/services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          professionalId: "pro-1",
          services: [
            {
              id: "svc-doc-1",
              name: "Consulta Cardiológica",
              kind: "consulta",
              price: 250,
              durationMin: 30,
              modality: "presencial",
            },
          ],
        }),
      })

      const response = await POST(req)
      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.ok).toBe(true)

      expect(upsertProfServicesMock).toHaveBeenCalledWith([
        {
          id: "svc-doc-1",
          professional_id: "pro-1",
          name: "Consulta Cardiológica",
          price: 250,
          duration_min: 30,
          modality: "presencial",
        },
      ])
      expect(upsertCatalogOffersMock).toHaveBeenCalledWith([
        {
          id: "svc-doc-1",
          kind: "consulta",
          service_name: "Consulta Cardiológica",
          professional_id: "pro-1",
          price: 250,
          duration_min: 30,
        },
      ])
    })
  })

  describe("ServicesView Component", () => {
    it("renderiza a aba de Consultas Médicas e permite atalho para procedimentos gerais", () => {
      const originalFetch = global.fetch
      global.fetch = vi.fn().mockImplementation(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ professionals: [], offers: [] }),
        })
      ) as any

      try {
        const html = renderToStaticMarkup(React.createElement(ServicesView))
        expect(html).toContain("Consultas Médicas")
        expect(html).toContain("Procedimentos &amp; Exames da Clínica")
        expect(html).toContain("Geral da Clínica (Sem médico específico) →")
      } finally {
        global.fetch = originalFetch
      }
    })

    it("renderiza a aba de Procedimentos & Exames da Clínica com responsável geral e lista", () => {
      const originalFetch = global.fetch
      global.fetch = vi.fn().mockImplementation(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ professionals: [], offers: [] }),
        })
      ) as any

      try {
        const html = renderToStaticMarkup(
          React.createElement<ServicesViewProps>(ServicesView, { initialTab: "procedimentos" })
        )
        expect(html).toContain("Geral da Clínica (Sem médico específico)")
        expect(html).toContain("Procedimentos e exames da clínica cadastrados")
        expect(html).toContain("Salvar procedimentos da clínica")
      } finally {
        global.fetch = originalFetch
      }
    })

    it("gerencia regras e viewMode para atendente e admin", () => {
      expect(canManageServices("attendant")).toBe(false)
      expect(canManageServices("admin")).toBe(true)
      expect(canManageServices(null)).toBe(true)

      expect(getServicesViewMode("attendant")).toEqual({
        isReadOnly: true,
        badgeLabel: "Modo somente leitura",
      })
      expect(getServicesViewMode("admin")).toEqual({
        isReadOnly: false,
        badgeLabel: null,
      })
    })

    it("exibe badge de modo somente leitura e desabilita botões de salvar para atendente", () => {
      const originalFetch = global.fetch
      global.fetch = vi.fn().mockImplementation(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ professionals: [], offers: [] }),
        })
      ) as any

      try {
        const htmlConsultas = renderToStaticMarkup(
          React.createElement<ServicesViewProps>(ServicesView, { initialRole: "attendant" })
        )
        expect(htmlConsultas).toContain("Modo somente leitura")
        expect(htmlConsultas).toContain('title="Atendentes possuem acesso somente leitura"')

        const htmlProcedimentos = renderToStaticMarkup(
          React.createElement<ServicesViewProps>(ServicesView, {
            initialTab: "procedimentos",
            initialRole: "attendant",
          })
        )
        expect(htmlProcedimentos).toContain("Modo somente leitura")
        expect(htmlProcedimentos).toContain('title="Atendentes possuem acesso somente leitura"')
      } finally {
        global.fetch = originalFetch
      }
    })

    it("não exibe badge de somente leitura nem título de bloqueio para admin", () => {
      const originalFetch = global.fetch
      global.fetch = vi.fn().mockImplementation(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ professionals: [], offers: [] }),
        })
      ) as any

      try {
        const html = renderToStaticMarkup(
          React.createElement<ServicesViewProps>(ServicesView, { initialRole: "admin" })
        )
        expect(html).not.toContain("Modo somente leitura")
        expect(html).not.toContain('title="Atendentes possuem acesso somente leitura"')
      } finally {
        global.fetch = originalFetch
      }
    })
  })
})
