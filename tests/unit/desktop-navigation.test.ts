import { describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))
vi.mock("next/navigation", () => ({
  usePathname: () => "/desktop",
  useRouter: () => ({ push: vi.fn() }),
}))
vi.mock("@/lib/clinic-actions", () => ({
  clinicGate: vi.fn(),
  logoutClinic: vi.fn(),
}))

import { getVisibleNav, NAV } from "@/components/desktop/shell"

describe("Desktop Navigation Role Adaptation (getVisibleNav)", () => {
  it("remove o módulo financeiro e não exibe equipe para o papel attendant", () => {
    const nav = getVisibleNav("attendant")

    const hasFinance = nav.some((item) => item.href === "/desktop/financeiro")
    const hasTeam = nav.some((item) => item.href === "/desktop/equipe")

    expect(hasFinance).toBe(false)
    expect(hasTeam).toBe(false)

    // Confere que manteve os itens operacionais permitidos
    expect(nav.some((item) => item.href === "/desktop/agenda")).toBe(true)
    expect(nav.some((item) => item.href === "/desktop/consultas")).toBe(true)
    expect(nav.some((item) => item.href === "/desktop/pacientes")).toBe(true)
    expect(nav.some((item) => item.href === "/desktop/guias")).toBe(true)
  })

  it("exibe tanto o módulo financeiro quanto o de equipe para o papel admin", () => {
    const nav = getVisibleNav("admin")

    const hasFinance = nav.some((item) => item.href === "/desktop/financeiro")
    const teamItem = nav.find((item) => item.href === "/desktop/equipe")

    expect(hasFinance).toBe(true)
    expect(teamItem).toBeDefined()
    expect(teamItem?.label).toBe("Equipe")
  })

  it("mantém a navegação padrão quando papel não estiver definido", () => {
    const nav = getVisibleNav(undefined)

    expect(nav.length).toBe(NAV.length)
    expect(nav.some((item) => item.href === "/desktop/financeiro")).toBe(true)
    expect(nav.some((item) => item.href === "/desktop/equipe")).toBe(false)
  })
})
