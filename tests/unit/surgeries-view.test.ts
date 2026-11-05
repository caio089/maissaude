import { describe, expect, it, vi, beforeEach } from "vitest"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"

vi.mock("server-only", () => ({}))
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/desktop/cirurgias",
}))
vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() },
}))

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ offers: [], professionals: [] }),
      })
    )
  )
})

import { getVisibleNav, NAV } from "@/components/desktop/shell"
import {
  canManageSurgeries,
  getSurgeriesViewMode,
  computeSurgeryMetrics,
  calculateAssociateSurgeryPrice,
  filterSurgeries,
  SurgeriesView,
  type SurgeryItem,
  type SurgeriesViewProps,
} from "@/components/desktop/surgeries-view"
import type { Professional } from "@/lib/types"

const mockProfessionals: Professional[] = [
  {
    id: "pro-cirurgiao",
    name: "Dr. Carlos Cirurgião",
    specialty: "clinica-geral",
    credentialLabel: "CRM",
    credentialCode: "54321/SP",
    bio: "Cirurgião geral.",
    avatarSeed: "carlos",
    location: "Centro Cirúrgico 1",
    price: 350,
    workDays: [1, 2, 3, 4, 5],
    startHour: "08:00",
    endHour: "18:00",
    rating: 5,
    reviewCount: 10,
    active: true,
    services: [],
    reviews: [],
  },
]

const mockSurgeries: SurgeryItem[] = [
  {
    id: "cir-1",
    name: "Apendicectomia Videolaparoscópica",
    kind: "cirurgia",
    professionalId: "pro-cirurgiao",
    price: 3500,
    durationMin: 90,
  },
  {
    id: "cir-2",
    name: "Colecistectomia",
    kind: "cirurgia",
    professionalId: "pro-cirurgiao",
    price: 4200,
    durationMin: 120,
  },
  {
    id: "cir-3",
    name: "Biópsia de Lesão Cutânea",
    kind: "cirurgia",
    professionalId: null,
    price: 450,
    durationMin: 30,
  },
]

describe("Surgeries Module (/desktop/cirurgias)", () => {
  describe("Navigation Integration (shell.tsx)", () => {
    it("inclui a rota /desktop/cirurgias em NAV com label Cirurgias", () => {
      const surgeryNav = NAV.find((item) => item.href === "/desktop/cirurgias")
      expect(surgeryNav).toBeDefined()
      expect(surgeryNav?.label).toBe("Cirurgias")
    })

    it("mantém /desktop/cirurgias visível para atendente (role attendant tem acesso)", () => {
      const nav = getVisibleNav("attendant")
      const surgeryNav = nav.find((item) => item.href === "/desktop/cirurgias")
      expect(surgeryNav).toBeDefined()
      expect(surgeryNav?.label).toBe("Cirurgias")
    })

    it("mantém /desktop/cirurgias visível para administrador (role admin)", () => {
      const nav = getVisibleNav("admin")
      const surgeryNav = nav.find((item) => item.href === "/desktop/cirurgias")
      expect(surgeryNav).toBeDefined()
      expect(surgeryNav?.label).toBe("Cirurgias")
    })
  })

  describe("Pure Logic / Metrics & Pricing", () => {
    it("calcula métricas corretamente com lista de cirurgias", () => {
      const metrics = computeSurgeryMetrics(mockSurgeries)

      expect(metrics.total).toBe(3)
      // Duração média: (90 + 120 + 30) / 3 = 240 / 3 = 80 min
      expect(metrics.averageDurationMin).toBe(80)
      expect(metrics.withDoctorCount).toBe(2)
      expect(metrics.clinicCount).toBe(1)
    })

    it("retorna zeros quando a lista de cirurgias estiver vazia", () => {
      const metrics = computeSurgeryMetrics([])

      expect(metrics.total).toBe(0)
      expect(metrics.averageDurationMin).toBe(0)
      expect(metrics.withDoctorCount).toBe(0)
      expect(metrics.clinicCount).toBe(0)
    })

    it("calcula preço de associado com base no percentual de desconto", () => {
      // R$ 3.500 com 20% de desconto = R$ 2.800
      const discounted = calculateAssociateSurgeryPrice(3500, 20)
      expect(discounted).toBe(2800)

      // R$ 450 com 15% de desconto = R$ 382.50
      const discounted15 = calculateAssociateSurgeryPrice(450, 15)
      expect(discounted15).toBe(382.5)

      // Sem desconto (0% ou negativo) mantém preço original
      expect(calculateAssociateSurgeryPrice(1000, 0)).toBe(1000)
      expect(calculateAssociateSurgeryPrice(1000, -5)).toBe(1000)
    })

    it("avalia permissões de gerenciamento por papel", () => {
      expect(canManageSurgeries("admin")).toBe(true)
      expect(canManageSurgeries("attendant")).toBe(false)
      expect(canManageSurgeries(undefined)).toBe(true)
      expect(canManageSurgeries(null)).toBe(true)

      const attendantMode = getSurgeriesViewMode("attendant")
      expect(attendantMode.isReadOnly).toBe(true)
      expect(attendantMode.badgeLabel).toBe("Modo somente leitura")

      const adminMode = getSurgeriesViewMode("admin")
      expect(adminMode.isReadOnly).toBe(false)
      expect(adminMode.badgeLabel).toBeNull()
    })

    it("filtra cirurgias por termo de busca e responsável", () => {
      const profMap = new Map([["pro-cirurgiao", "Dr. Carlos Cirurgião"]])

      // Busca por nome da cirurgia
      const byName = filterSurgeries(mockSurgeries, "Apendice", "all", profMap)
      expect(byName.length).toBe(1)
      expect(byName[0]?.id).toBe("cir-1")

      // Busca por nome do médico
      const byDoctorName = filterSurgeries(mockSurgeries, "Carlos", "all", profMap)
      expect(byDoctorName.length).toBe(2)

      // Filtro por cirurgias da clínica
      const clinicOnly = filterSurgeries(mockSurgeries, "", "clinic", profMap)
      expect(clinicOnly.length).toBe(1)
      expect(clinicOnly[0]?.id).toBe("cir-3")

      // Filtro por cirurgias com médico
      const doctorOnly = filterSurgeries(mockSurgeries, "", "doctor", profMap)
      expect(doctorOnly.length).toBe(2)
    })
  })

  describe("SurgeriesView Markup Rendering", () => {
    it("para admin: exibe botão '+ Nova cirurgia' e KPIs sem badge somente leitura", () => {
      const html = renderToStaticMarkup(
        React.createElement<SurgeriesViewProps>(SurgeriesView, {
          initialRole: "admin",
          initialSurgeries: mockSurgeries,
          initialProfessionals: mockProfessionals,
          initialDiscountPercent: 20,
        })
      )

      expect(html).toContain("Nova cirurgia")
      expect(html).not.toContain("Modo somente leitura")
      expect(html).toContain("Total de cirurgias")
      expect(html).toContain("Duração média")
      expect(html).toContain("Cirurgias com médico")
      expect(html).toContain("Cirurgias da clínica")
      expect(html).toContain("Apendicectomia Videolaparoscópica")
      expect(html).toContain("Dr. Carlos Cirurgião")
      expect(html).toContain("Geral da clínica")
    })

    it("para attendant: oculta ou desabilita criação, e exibe badge de modo somente leitura", () => {
      const html = renderToStaticMarkup(
        React.createElement<SurgeriesViewProps>(SurgeriesView, {
          initialRole: "attendant",
          initialSurgeries: mockSurgeries,
          initialProfessionals: mockProfessionals,
          initialDiscountPercent: 20,
        })
      )

      expect(html).toContain("Modo somente leitura")
      expect(html).not.toContain("Nova cirurgia")
      expect(html).toContain("Apendicectomia Videolaparoscópica")
      expect(html).toContain("Tabela")
      expect(html).toContain("Associado")
    })
  })
})
