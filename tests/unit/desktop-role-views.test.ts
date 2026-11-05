import { describe, expect, it, vi, beforeEach } from "vitest"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"

vi.mock("server-only", () => ({}))
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/desktop",
}))
vi.mock("@/components/desktop/charts", () => ({
  RevenueArea: () => React.createElement("div", { "data-testid": "mock-revenue-area" }, "Gráfico Receita"),
  AppointmentBars: () => React.createElement("div", { "data-testid": "mock-appointment-bars" }, "Gráfico Agendamentos"),
}))
vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() },
}))

// Global fetch mock to avoid unhandled rejections during render
beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      })
    )
  )
})

import {
  shouldShowRevenueKpi,
  getDashboardActiveChart,
  shouldShowRevenueToggle,
  filterOperationalAlerts,
  DashboardView,
  type DashboardViewProps,
} from "@/components/desktop/dashboard-view"

import {
  canManageProfessionals,
  getProfessionalsViewMode,
  ProfessionalsView,
  type ProfessionalsViewProps,
} from "@/components/desktop/professionals-view"
import { AssociateRulesCard, type AssociateRulesCardProps } from "@/components/desktop/associate-rules-card"

import type { OperationalAlert } from "@/lib/metrics"
import type { Professional } from "@/lib/types"

const mockProfessional: Professional = {
  id: "pro-1",
  name: "Dra. Beatriz Santos",
  specialty: "clinica-geral",
  credentialLabel: "CRM",
  credentialCode: "12345/SP",
  bio: "Médica geral e de família.",
  avatarSeed: "beatriz",
  location: "Consultório 1",
  price: 150,
  workDays: [1, 2, 3, 4, 5],
  startHour: "08:00",
  endHour: "18:00",
  rating: 4.9,
  reviewCount: 1,
  active: true,
  services: [],
  reviews: [],
}

describe("DashboardView Role Adaptations", () => {
  describe("Pure Logic / Rules", () => {
    it("shouldShowRevenueKpi retorna true apenas para admin (fail-closed)", () => {
      expect(shouldShowRevenueKpi("admin")).toBe(true)
      expect(shouldShowRevenueKpi("attendant")).toBe(false)
      expect(shouldShowRevenueKpi(null)).toBe(false)
      expect(shouldShowRevenueKpi(undefined)).toBe(false)
    })

    it("getDashboardActiveChart força appointments para attendant mesmo se revenue for solicitado", () => {
      expect(getDashboardActiveChart("revenue", "attendant")).toBe("appointments")
      expect(getDashboardActiveChart("appointments", "attendant")).toBe("appointments")
      expect(getDashboardActiveChart("revenue", "admin")).toBe("revenue")
      expect(getDashboardActiveChart("appointments", "admin")).toBe("appointments")
      expect(getDashboardActiveChart("revenue", undefined)).toBe("revenue")
    })

    it("shouldShowRevenueToggle oculta a alternância para attendant", () => {
      expect(shouldShowRevenueToggle("attendant")).toBe(false)
      expect(shouldShowRevenueToggle("admin")).toBe(true)
      expect(shouldShowRevenueToggle(undefined)).toBe(true)
    })

    it("filterOperationalAlerts remove alertas que apontam para /desktop/financeiro para atendentes", () => {
      const mockAlerts: OperationalAlert[] = [
        {
          id: "1",
          title: "Consulta próxima",
          body: "Paciente João às 14h",
          tone: "info",
          href: "/desktop/agenda",
        },
        {
          id: "2",
          title: "3 pagamentos em aberto",
          body: "Valores pendentes",
          tone: "warning",
          href: "/desktop/financeiro",
        },
      ]

      const attendantAlerts = filterOperationalAlerts(mockAlerts, "attendant")
      expect(attendantAlerts).toHaveLength(1)
      expect(attendantAlerts[0].href).toBe("/desktop/agenda")

      const adminAlerts = filterOperationalAlerts(mockAlerts, "admin")
      expect(adminAlerts).toHaveLength(2)
    })
  })

  describe("Markup Rendering", () => {
    it("para attendant: oculta o card de faturamento/receita, oculta botão de faturamento e renderiza agendamentos", () => {
      const html = renderToStaticMarkup(
        React.createElement<DashboardViewProps>(DashboardView, { initialRole: "attendant" }),
      )

      // Não deve exibir o card de Receita do período nem link para /desktop/financeiro
      expect(html).not.toContain("Receita do período")
      expect(html).not.toContain("/desktop/financeiro")
      expect(html).not.toContain('data-testid="mock-revenue-area"')

      // Deve renderizar o gráfico de agendamentos e métricas operacionais
      expect(html).toContain('data-testid="mock-appointment-bars"')
      expect(html).toContain("Consultas de hoje")
      expect(html).toContain("Total de agendamentos")
      expect(html).toContain("Pacientes atendidos")
    })

    it("para admin: exibe receita do período, botão de faturamento e gráfico financeiro", () => {
      const html = renderToStaticMarkup(
        React.createElement<DashboardViewProps>(DashboardView, { initialRole: "admin" }),
      )

      expect(html).toContain("Receita do período")
      expect(html).toContain("Faturamento")
      expect(html).toContain("/desktop/financeiro")
      expect(html).toContain('data-testid="mock-revenue-area"')
    })
  })
})

describe("ProfessionalsView Role Adaptations", () => {
  describe("Pure Logic / Rules", () => {
    it("canManageProfessionals retorna false para attendant e true para admin/default", () => {
      expect(canManageProfessionals("attendant")).toBe(false)
      expect(canManageProfessionals("admin")).toBe(true)
      expect(canManageProfessionals(null)).toBe(true)
      expect(canManageProfessionals(undefined)).toBe(true)
    })

    it("getProfessionalsViewMode retorna modo somente leitura para attendant", () => {
      expect(getProfessionalsViewMode("attendant")).toEqual({
        isReadOnly: true,
        badgeLabel: "Modo somente leitura",
      })
      expect(getProfessionalsViewMode("admin")).toEqual({
        isReadOnly: false,
        badgeLabel: null,
      })
      expect(getProfessionalsViewMode(undefined)).toEqual({
        isReadOnly: false,
        badgeLabel: null,
      })
    })
  })

  describe("Markup Rendering", () => {
    it("para attendant: oculta '+ Novo profissional', oculta 'Editar dados' e exibe badge de modo somente leitura", () => {
      const html = renderToStaticMarkup(
        React.createElement<ProfessionalsViewProps>(ProfessionalsView, {
          initialRole: "attendant",
          initialProfessionals: [mockProfessional],
        }),
      )

      expect(html).toContain("Modo somente leitura")
      expect(html).not.toContain("Novo profissional")
      expect(html).not.toContain("Editar dados")
      expect(html).toContain("Abrir agenda individual")
    })

    it("para admin: exibe botão '+ Novo profissional' e botão 'Editar dados' e não exibe badge somente leitura", () => {
      const html = renderToStaticMarkup(
        React.createElement<ProfessionalsViewProps>(ProfessionalsView, {
          initialRole: "admin",
          initialProfessionals: [mockProfessional],
        }),
      )

      expect(html).not.toContain("Modo somente leitura")
      expect(html).toContain("Novo profissional")
      expect(html).toContain("Editar dados")
      expect(html).toContain("Abrir agenda individual")
    })
  })
})

describe("AssociateRulesCard Role Adaptations", () => {
  it("oculta o botão 'Salvar regras' para atendente", () => {
    const html = renderToStaticMarkup(
      React.createElement<AssociateRulesCardProps>(AssociateRulesCard, { role: "attendant" }),
    )
    expect(html).not.toContain("Salvar regras")
  })

  it("exibe o botão 'Salvar regras' para admin", () => {
    const html = renderToStaticMarkup(
      React.createElement<AssociateRulesCardProps>(AssociateRulesCard, { role: "admin" }),
    )
    expect(html).toContain("Salvar regras")
  })
})
