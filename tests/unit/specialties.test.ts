import { describe, expect, it, vi, beforeEach } from "vitest"

vi.mock("server-only", () => ({}))

import { normalizeSpecialtyName, slugifySpecialty, validateSpecialtyName } from "@/lib/specialties"
import { GET, POST } from "@/app/api/desktop/specialties/route"
import * as clinicSession from "@/lib/clinic-session"
import * as adminSupabase from "@/lib/supabase/admin"

describe("specialties helper engine", () => {
  it("normaliza nomes de especialidades médicas", () => {
    expect(normalizeSpecialtyName("  ortopedia e traumatologia ")).toBe("Ortopedia e traumatologia")
    expect(normalizeSpecialtyName("PEDIATRIA")).toBe("Pediatria")
    expect(normalizeSpecialtyName("oftalmologia")).toBe("Oftalmologia")
    expect(normalizeSpecialtyName("")).toBe("")
    expect(normalizeSpecialtyName("   ")).toBe("")
  })

  it("gera id em slug seguro", () => {
    expect(slugifySpecialty("Ginecologia e Obstetrícia")).toBe("ginecologia-obstetricia")
    expect(slugifySpecialty("Clínica Geral")).toBe("clinica-geral")
    expect(slugifySpecialty("Ortopedia e Traumatologia")).toBe("ortopedia-traumatologia")
    expect(slugifySpecialty("Cardiologia & Hemodinâmica")).toBe("cardiologia-hemodinamica")
  })

  it("valida o tamanho e formato do nome da especialidade", () => {
    expect(validateSpecialtyName("Cardiologia").valid).toBe(true)
    expect(validateSpecialtyName("Ca").valid).toBe(false)
    expect(validateSpecialtyName("").valid).toBe(false)
    expect(validateSpecialtyName(null).valid).toBe(false)
    expect(validateSpecialtyName(123).valid).toBe(false)
    expect(validateSpecialtyName("a".repeat(61)).valid).toBe(false)
  })
})

describe("GET /api/desktop/specialties", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("devolve 401 se a clínica não estiver autenticada", async () => {
    vi.spyOn(clinicSession, "getClinicSession").mockResolvedValue({
      authenticated: false,
      role: "attendant",
      email: "",
      name: "",
    })

    const response = await GET()
    expect(response.status).toBe(401)
  })

  it("devolve 503 se o banco de dados não estiver disponível", async () => {
    vi.spyOn(clinicSession, "getClinicSession").mockResolvedValue({
      authenticated: true,
      role: "admin",
      email: "admin@cuidarsaude.com",
      name: "Administrador",
    })
    vi.spyOn(adminSupabase, "createSupabaseAdmin").mockReturnValue(null)

    const response = await GET()
    expect(response.status).toBe(503)
  })

  it("retorna lista de especialidades ordenadas por nome", async () => {
    vi.spyOn(clinicSession, "getClinicSession").mockResolvedValue({
      authenticated: true,
      role: "admin",
      email: "admin@cuidarsaude.com",
      name: "Administrador",
    })

    const mockSpecialties = [
      { id: "cardiologia", name: "Cardiologia" },
      { id: "dermatologia", name: "Dermatologia" },
    ]

    const mockDb = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: mockSpecialties, error: null }),
        }),
      }),
    }
    vi.spyOn(adminSupabase, "createSupabaseAdmin").mockReturnValue(mockDb as any)

    const response = await GET()
    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json).toEqual(mockSpecialties)
    expect(mockDb.from).toHaveBeenCalledWith("clinic_specialties")
  })
})

describe("POST /api/desktop/specialties", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("devolve 401 se a clínica não estiver autenticada", async () => {
    vi.spyOn(clinicSession, "getClinicSession").mockResolvedValue({
      authenticated: false,
      role: "attendant",
      email: "",
      name: "",
    })

    const request = new Request("http://localhost/api/desktop/specialties", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Endocrinologia" }),
    })

    const response = await POST(request)
    expect(response.status).toBe(401)
  })

  it("devolve 403 se o usuário for atendente", async () => {
    vi.spyOn(clinicSession, "getClinicSession").mockResolvedValue({
      authenticated: true,
      role: "attendant",
      email: "atendente@cuidarsaude.com",
      name: "Atendente",
    })

    const request = new Request("http://localhost/api/desktop/specialties", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Endocrinologia" }),
    })

    const response = await POST(request)
    expect(response.status).toBe(403)
    const json = await response.json()
    expect(json.error).toMatch(/somente leitura/i)
  })

  it("devolve 400 se o nome for inválido ou muito curto", async () => {
    vi.spyOn(clinicSession, "getClinicSession").mockResolvedValue({
      authenticated: true,
      role: "admin",
      email: "admin@cuidarsaude.com",
      name: "Administrador",
    })
    vi.spyOn(adminSupabase, "createSupabaseAdmin").mockReturnValue({} as any)

    const request = new Request("http://localhost/api/desktop/specialties", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Oi" }),
    })

    const response = await POST(request)
    expect(response.status).toBe(400)
  })

  it("cria nova especialidade médica e retorna 201 com id e name", async () => {
    vi.spyOn(clinicSession, "getClinicSession").mockResolvedValue({
      authenticated: true,
      role: "admin",
      email: "admin@cuidarsaude.com",
      name: "Administrador",
    })

    const createdRecord = { id: "reumatologia", name: "Reumatologia" }
    const mockDb = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          or: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: createdRecord, error: null }),
          }),
        }),
      }),
    }
    vi.spyOn(adminSupabase, "createSupabaseAdmin").mockReturnValue(mockDb as any)

    const request = new Request("http://localhost/api/desktop/specialties", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "  reumatologia " }),
    })

    const response = await POST(request)
    expect(response.status).toBe(201)
    const json = await response.json()
    expect(json).toEqual(createdRecord)
  })

  it("retorna registro existente se especialidade já estiver cadastrada", async () => {
    vi.spyOn(clinicSession, "getClinicSession").mockResolvedValue({
      authenticated: true,
      role: "admin",
      email: "admin@cuidarsaude.com",
      name: "Administrador",
    })

    const existingRecord = { id: "cardiologia", name: "Cardiologia" }
    const mockDb = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          or: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: existingRecord, error: null }),
          }),
        }),
      }),
    }
    vi.spyOn(adminSupabase, "createSupabaseAdmin").mockReturnValue(mockDb as any)

    const request = new Request("http://localhost/api/desktop/specialties", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Cardiologia" }),
    })

    const response = await POST(request)
    expect([200, 201]).toContain(response.status)
    const json = await response.json()
    expect(json).toEqual(existingRecord)
  })
})
