import { describe, expect, it, vi, beforeEach } from "vitest"

vi.mock("server-only", () => ({}))

const mockGetClaims = vi.fn()
const mockCreateServerSupabase = vi.fn().mockImplementation(() =>
  Promise.resolve({
    auth: {
      getClaims: mockGetClaims,
    },
  })
)

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: () => mockCreateServerSupabase(),
}))

const mockCookieStore = {
  get: vi.fn(),
}
vi.mock("next/headers", () => ({
  cookies: vi.fn().mockImplementation(() => Promise.resolve(mockCookieStore)),
}))

vi.mock("@/lib/clinic-token", () => ({
  CLINIC_COOKIE: "clinic_token",
  verifyClinicToken: vi.fn(),
}))

import { resolveClinicRole, getClinicSession, hasClinicSession } from "@/lib/clinic-session"
import { verifyClinicToken } from "@/lib/clinic-token"
import { GET } from "@/app/api/desktop/session/route"

describe("resolveClinicRole", () => {
  it("retorna admin para email principal ou claims de admin", () => {
    expect(resolveClinicRole({ email: "cuidarsaude2026@gmail.com", clinicRole: undefined })).toBe("admin")
    expect(resolveClinicRole({ email: "gestor@clinica.com", clinicRole: "admin" })).toBe("admin")
  })

  it("retorna attendant quando o papel específico for attendant", () => {
    expect(resolveClinicRole({ email: "recepcao@clinica.com", clinicRole: "attendant" })).toBe("attendant")
  })

  it("retorna admin por padrão se o email for da clínica demo", () => {
    expect(resolveClinicRole({ email: "cuidarsaude2026@gmail.com", clinicRole: null })).toBe("admin")
  })

  it("trata email case-insensitive para o email demo", () => {
    expect(resolveClinicRole({ email: "CUIDARSAUDE2026@GMAIL.COM", clinicRole: null })).toBe("admin")
  })

  it("retorna attendant para email genérico sem claim específica", () => {
    expect(resolveClinicRole({ email: "outro@clinica.com", clinicRole: null })).toBe("attendant")
    expect(resolveClinicRole({ email: undefined, clinicRole: undefined })).toBe("attendant")
  })
})

describe("getClinicSession", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("retorna sessão de admin via Supabase claims", async () => {
    mockGetClaims.mockResolvedValue({
      data: {
        claims: {
          sub: "user-admin-123",
          email: "admin@clinica.com",
          name: "Dr. Admin",
          app_metadata: {
            role: "clinic",
            clinic_role: "admin",
          },
        },
      },
    })

    const session = await getClinicSession()
    expect(session).toEqual({
      authenticated: true,
      role: "admin",
      email: "admin@clinica.com",
      name: "Dr. Admin",
      userId: "user-admin-123",
    })
  })

  it("retorna sessão de atendente via Supabase claims", async () => {
    mockGetClaims.mockResolvedValue({
      data: {
        claims: {
          sub: "user-att-456",
          email: "atendente@clinica.com",
          user_metadata: { name: "Maria Atendente" },
          app_metadata: {
            role: "clinic",
            clinic_role: "attendant",
          },
        },
      },
    })

    const session = await getClinicSession()
    expect(session).toEqual({
      authenticated: true,
      role: "attendant",
      email: "atendente@clinica.com",
      name: "Maria Atendente",
      userId: "user-att-456",
    })
  })

  it("fallback para cookie de desenvolvimento se Supabase falhar mas cookie for válido", async () => {
    mockGetClaims.mockRejectedValue(new Error("Supabase indisponível"))
    mockCookieStore.get.mockReturnValue({ value: "valid-dev-token" })
    vi.mocked(verifyClinicToken).mockResolvedValue(true)

    const session = await getClinicSession()
    expect(session).toEqual({
      authenticated: true,
      role: "admin",
      email: "cuidarsaude2026@gmail.com",
      name: "Administrador da Clínica",
    })
  })

  it("retorna não autenticado se Supabase não tiver role clinic e cookie for inválido", async () => {
    mockGetClaims.mockResolvedValue({
      data: {
        claims: {
          sub: "user-patient-789",
          email: "paciente@email.com",
          app_metadata: { role: "patient" },
        },
      },
    })
    mockCookieStore.get.mockReturnValue({ value: "invalid-token" })
    vi.mocked(verifyClinicToken).mockResolvedValue(false)

    const session = await getClinicSession()
    expect(session).toEqual({
      authenticated: false,
      role: "attendant",
      email: "",
      name: "",
    })
  })
})

describe("hasClinicSession", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("retorna true se autenticado", async () => {
    mockGetClaims.mockResolvedValue({
      data: {
        claims: {
          app_metadata: { role: "clinic" },
          email: "cuidarsaude2026@gmail.com",
        },
      },
    })

    const has = await hasClinicSession()
    expect(has).toBe(true)
  })

  it("retorna false se não autenticado", async () => {
    mockGetClaims.mockRejectedValue(new Error("No session"))
    mockCookieStore.get.mockReturnValue(undefined)
    vi.mocked(verifyClinicToken).mockResolvedValue(false)

    const has = await hasClinicSession()
    expect(has).toBe(false)
  })
})

describe("GET /api/desktop/session", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("retorna 401 se clínica não estiver autenticada", async () => {
    mockGetClaims.mockRejectedValue(new Error("No session"))
    mockCookieStore.get.mockReturnValue(undefined)
    vi.mocked(verifyClinicToken).mockResolvedValue(false)

    const res = await GET()
    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json).toEqual({
      authenticated: false,
      error: "Não autenticado.",
    })
  })

  it("retorna 200 com os dados de sessão se autenticado", async () => {
    mockGetClaims.mockResolvedValue({
      data: {
        claims: {
          sub: "user-123",
          email: "admin@clinica.com",
          app_metadata: {
            role: "clinic",
            clinic_role: "admin",
          },
        },
      },
    })

    const res = await GET()
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.authenticated).toBe(true)
    expect(json.role).toBe("admin")
    expect(json.email).toBe("admin@clinica.com")
    expect(json.userId).toBe("user-123")
  })
})
