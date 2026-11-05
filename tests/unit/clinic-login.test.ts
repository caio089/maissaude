import { describe, expect, it, vi, beforeEach } from "vitest"

vi.mock("server-only", () => ({}))

const mockRedirect = vi.fn().mockImplementation((url: string) => {
  const err = new Error("NEXT_REDIRECT")
  ;(err as any).digest = `NEXT_REDIRECT;replace;${url};307;;`
  throw err
})

vi.mock("next/navigation", () => ({
  redirect: (url: string) => mockRedirect(url),
}))

const mockCookieStore = {
  get: vi.fn(),
  set: vi.fn(),
}

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockImplementation(() => Promise.resolve(mockCookieStore)),
  connection: vi.fn().mockResolvedValue(undefined),
}))

const mockSignInWithPassword = vi.fn()
const mockGetClaims = vi.fn()
const mockSignOut = vi.fn()

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: vi.fn().mockImplementation(() =>
    Promise.resolve({
      auth: {
        signInWithPassword: mockSignInWithPassword,
        getClaims: mockGetClaims,
        signOut: mockSignOut,
      },
    })
  ),
}))

const mockIsSupabaseBrowserConfigured = vi.fn()
const mockIsSupabaseAdminConfigured = vi.fn()

vi.mock("@/lib/supabase/env", () => ({
  isSupabaseBrowserConfigured: () => mockIsSupabaseBrowserConfigured(),
}))

vi.mock("@/lib/supabase/admin", () => ({
  isSupabaseAdminConfigured: () => mockIsSupabaseAdminConfigured(),
}))

const mockEnsureClinicAuthUser = vi.fn()
vi.mock("@/lib/auth/clinic-user", () => ({
  ensureClinicAuthUser: () => mockEnsureClinicAuthUser(),
}))

const mockHmacClinicFallbackEnabled = vi.fn()
vi.mock("@/lib/runtime", () => ({
  hmacClinicFallbackEnabled: () => mockHmacClinicFallbackEnabled(),
}))

const mockClinicCredentialsMatch = vi.fn()
const mockCreateClinicToken = vi.fn().mockResolvedValue("mocked-clinic-token")
const mockClinicCookieOptions = vi.fn().mockReturnValue({ httpOnly: true })

vi.mock("@/lib/clinic-token", () => ({
  CLINIC_COOKIE: "cuidar_clinica",
  CLINIC_COOKIE_MAX_AGE: 43200,
  clinicCookieOptions: () => mockClinicCookieOptions(),
  clinicCredentialsMatch: (email: string, pass: string) => mockClinicCredentialsMatch(email, pass),
  createClinicToken: (exp: number) => mockCreateClinicToken(exp),
}))

import { loginClinic } from "@/lib/clinic-actions"

function createFormData(email: string, password: string): FormData {
  const fd = new FormData()
  fd.append("email", email)
  fd.append("password", password)
  return fd
}

describe("loginClinic", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockIsSupabaseBrowserConfigured.mockReturnValue(true)
    mockIsSupabaseAdminConfigured.mockReturnValue(true)
    mockHmacClinicFallbackEnabled.mockReturnValue(false)
  })

  it("rejeita e-mail em branco ou senha vazia", async () => {
    const res = await loginClinic({}, createFormData("", ""))
    expect(res).toEqual({ error: "E-mail ou senha da clínica não conferem." })
  })

  it("permite login de administrador da clínica via Supabase Auth", async () => {
    mockSignInWithPassword.mockResolvedValue({ error: null })
    mockGetClaims.mockResolvedValue({
      data: {
        claims: {
          sub: "user-admin",
          email: "admin@clinica.com",
          app_metadata: { role: "clinic", clinic_role: "admin" },
        },
      },
    })

    await expect(
      loginClinic({}, createFormData("admin@clinica.com", "senha123"))
    ).rejects.toThrow("NEXT_REDIRECT")

    expect(mockSignInWithPassword).toHaveBeenCalledWith({
      email: "admin@clinica.com",
      password: "senha123",
    })
    expect(mockRedirect).toHaveBeenCalledWith("/desktop")
  })

  it("permite login de atendente da clínica via Supabase Auth", async () => {
    mockSignInWithPassword.mockResolvedValue({ error: null })
    mockGetClaims.mockResolvedValue({
      data: {
        claims: {
          sub: "user-attendant",
          email: "atendente@clinica.com",
          app_metadata: { role: "clinic", clinic_role: "attendant" },
        },
      },
    })

    await expect(
      loginClinic({}, createFormData("atendente@clinica.com", "senhaAtendente123"))
    ).rejects.toThrow("NEXT_REDIRECT")

    expect(mockSignInWithPassword).toHaveBeenCalledWith({
      email: "atendente@clinica.com",
      password: "senhaAtendente123",
    })
    expect(mockRedirect).toHaveBeenCalledWith("/desktop")
    expect(mockSignOut).not.toHaveBeenCalled()
  })

  it("rejeita conta com role de paciente com a mensagem correta e executa signOut", async () => {
    mockSignInWithPassword.mockResolvedValue({ error: null })
    mockGetClaims.mockResolvedValue({
      data: {
        claims: {
          sub: "user-patient",
          email: "paciente@gmail.com",
          app_metadata: { role: "patient" },
        },
      },
    })

    const res = await loginClinic({}, createFormData("paciente@gmail.com", "senhaPaciente123"))
    expect(res).toEqual({ error: "Esta conta não abre o painel da clínica." })
    expect(mockSignOut).toHaveBeenCalled()
    expect(mockRedirect).not.toHaveBeenCalled()
  })

  it("rejeita credenciais incorretas no Supabase Auth", async () => {
    mockSignInWithPassword.mockResolvedValue({ error: { message: "Invalid login credentials" } })

    const res = await loginClinic({}, createFormData("atendente@clinica.com", "senhaErrada"))
    expect(res).toEqual({ error: "E-mail ou senha da clínica não conferem." })
    expect(mockRedirect).not.toHaveBeenCalled()
  })

  it("não executa ensureClinicAuthUser quando o login for de atendente", async () => {
    mockHmacClinicFallbackEnabled.mockReturnValue(true)
    mockSignInWithPassword.mockResolvedValue({ error: null })
    mockGetClaims.mockResolvedValue({
      data: {
        claims: {
          sub: "user-attendant-2",
          email: "maria.recepcao@clinica.com",
          app_metadata: { role: "clinic", clinic_role: "attendant" },
        },
      },
    })

    await expect(
      loginClinic({}, createFormData("maria.recepcao@clinica.com", "senha123"))
    ).rejects.toThrow("NEXT_REDIRECT")

    expect(mockEnsureClinicAuthUser).not.toHaveBeenCalled()
  })

  it("em fallback de desenvolvimento, suporta credenciais da clínica", async () => {
    mockIsSupabaseBrowserConfigured.mockReturnValue(false)
    mockHmacClinicFallbackEnabled.mockReturnValue(true)
    mockClinicCredentialsMatch.mockResolvedValue(true)

    await expect(
      loginClinic({}, createFormData("cuidarsaude2026@gmail.com", "clinica2026"))
    ).rejects.toThrow("NEXT_REDIRECT")

    expect(mockCookieStore.set).toHaveBeenCalledWith(
      "cuidar_clinica",
      "mocked-clinic-token",
      expect.anything()
    )
    expect(mockRedirect).toHaveBeenCalledWith("/desktop")
  })

  it("em fallback de desenvolvimento, suporta contas de equipe com CLINIC_DEMO_PASSWORD", async () => {
    mockIsSupabaseBrowserConfigured.mockReturnValue(false)
    mockHmacClinicFallbackEnabled.mockReturnValue(true)
    mockClinicCredentialsMatch.mockResolvedValue(false)
    const prevDemo = process.env.CLINIC_DEMO_PASSWORD
    process.env.CLINIC_DEMO_PASSWORD = "demo-team-pass"

    try {
      await expect(
        loginClinic({}, createFormData("atendente.dev@clinica.com", "demo-team-pass"))
      ).rejects.toThrow("NEXT_REDIRECT")

      expect(mockCookieStore.set).toHaveBeenCalledWith(
        "cuidar_clinica",
        "mocked-clinic-token",
        expect.anything()
      )
      expect(mockRedirect).toHaveBeenCalledWith("/desktop")
    } finally {
      process.env.CLINIC_DEMO_PASSWORD = prevDemo
    }
  })

  it("em fallback sem credenciais válidas, rejeita login", async () => {
    mockIsSupabaseBrowserConfigured.mockReturnValue(false)
    mockHmacClinicFallbackEnabled.mockReturnValue(true)
    mockClinicCredentialsMatch.mockResolvedValue(false)

    const res = await loginClinic({}, createFormData("atendente@clinica.com", "senhaInvalida"))
    expect(res).toEqual({ error: "E-mail ou senha da clínica não conferem." })
  })
})
