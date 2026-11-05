import { describe, expect, it, vi, beforeEach } from "vitest"

vi.mock("server-only", () => ({}))

import { resolveClinicRole } from "@/lib/clinic-session"
import * as clinicSessionModule from "@/lib/clinic-session"
import * as supabaseAdminModule from "@/lib/supabase/admin"
import { GET, POST, PATCH } from "@/app/api/desktop/team/route"

describe("desktop team authorization", () => {
  it("apenas papel admin pode gerenciar equipe", () => {
    const admin = resolveClinicRole({ clinicRole: "admin" })
    const attendant = resolveClinicRole({ clinicRole: "attendant" })
    expect(admin === "admin").toBe(true)
    expect(attendant === "admin").toBe(false)
  })
})

describe("GET /api/desktop/team", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("retorna 401 se a clínica não estiver autenticada", async () => {
    vi.spyOn(clinicSessionModule, "getClinicSession").mockResolvedValue({
      authenticated: false,
      role: "attendant",
      email: "",
      name: "",
    })

    const response = await GET()
    expect(response.status).toBe(401)
    const json = await response.json()
    expect(json.error).toBe("Não autenticado.")
  })

  it("retorna 403 se o usuário autenticado for atendente e não admin", async () => {
    vi.spyOn(clinicSessionModule, "getClinicSession").mockResolvedValue({
      authenticated: true,
      role: "attendant",
      email: "atendente@exemplo.com",
      name: "Atendente",
    })

    const response = await GET()
    expect(response.status).toBe(403)
    const json = await response.json()
    expect(json.error).toBe("Apenas administradores podem gerenciar a equipe.")
  })

  it("retorna 503 se o banco de dados estiver indisponível", async () => {
    vi.spyOn(clinicSessionModule, "getClinicSession").mockResolvedValue({
      authenticated: true,
      role: "admin",
      email: "admin@exemplo.com",
      name: "Admin",
    })
    vi.spyOn(supabaseAdminModule, "createSupabaseAdmin").mockReturnValue(null)

    const response = await GET()
    expect(response.status).toBe(503)
    const json = await response.json()
    expect(json.error).toBe("Banco de dados indisponível.")
  })

  it("retorna lista de membros da equipe ordenada por data de criação decrescente", async () => {
    vi.spyOn(clinicSessionModule, "getClinicSession").mockResolvedValue({
      authenticated: true,
      role: "admin",
      email: "admin@exemplo.com",
      name: "Admin",
    })

    const mockTeamRows = [
      {
        id: "team-1",
        auth_user_id: "auth-1",
        name: "Ana Souza",
        email: "ana@exemplo.com",
        role: "attendant",
        status: "active",
        created_at: "2026-11-04T12:00:00Z",
      },
      {
        id: "team-2",
        auth_user_id: "auth-2",
        name: "Carlos Lima",
        email: "carlos@exemplo.com",
        role: "admin",
        status: "active",
        created_at: "2026-11-03T10:00:00Z",
      },
    ]

    const orderMock = vi.fn().mockResolvedValue({
      data: mockTeamRows,
      error: null,
    })
    const selectMock = vi.fn().mockReturnValue({ order: orderMock })
    const fromMock = vi.fn().mockReturnValue({ select: selectMock })

    vi.spyOn(supabaseAdminModule, "createSupabaseAdmin").mockReturnValue({
      from: fromMock,
    } as any)

    const response = await GET()
    expect(response.status).toBe(200)

    expect(fromMock).toHaveBeenCalledWith("clinic_team")
    expect(orderMock).toHaveBeenCalledWith("created_at", { ascending: false })

    const json = await response.json()
    expect(json).toEqual([
      {
        id: "team-1",
        authUserId: "auth-1",
        name: "Ana Souza",
        email: "ana@exemplo.com",
        role: "attendant",
        status: "active",
        createdAt: "2026-11-04T12:00:00Z",
      },
      {
        id: "team-2",
        authUserId: "auth-2",
        name: "Carlos Lima",
        email: "carlos@exemplo.com",
        role: "admin",
        status: "active",
        createdAt: "2026-11-03T10:00:00Z",
      },
    ])
  })

  it("retorna 500 se ocorrer erro ao buscar membros no banco", async () => {
    vi.spyOn(clinicSessionModule, "getClinicSession").mockResolvedValue({
      authenticated: true,
      role: "admin",
      email: "admin@exemplo.com",
      name: "Admin",
    })

    const orderMock = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "Erro de conexão com o banco" },
    })
    const selectMock = vi.fn().mockReturnValue({ order: orderMock })
    const fromMock = vi.fn().mockReturnValue({ select: selectMock })

    vi.spyOn(supabaseAdminModule, "createSupabaseAdmin").mockReturnValue({
      from: fromMock,
    } as any)

    const response = await GET()
    expect(response.status).toBe(500)
    const json = await response.json()
    expect(json.error).toBe("Não foi possível carregar a equipe.")
  })
})

describe("POST /api/desktop/team", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("retorna 401 se a clínica não estiver autenticada", async () => {
    vi.spyOn(clinicSessionModule, "getClinicSession").mockResolvedValue({
      authenticated: false,
      role: "attendant",
      email: "",
      name: "",
    })

    const request = new Request("http://localhost/api/desktop/team", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Atendente 1",
        email: "atendente@exemplo.com",
        password: "password123",
        role: "attendant",
      }),
    })

    const response = await POST(request)
    expect(response.status).toBe(401)
  })

  it("retorna 403 se o usuário não for admin", async () => {
    vi.spyOn(clinicSessionModule, "getClinicSession").mockResolvedValue({
      authenticated: true,
      role: "attendant",
      email: "atendente@exemplo.com",
      name: "Atendente",
    })

    const request = new Request("http://localhost/api/desktop/team", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Nova Atendente",
        email: "nova@exemplo.com",
        password: "password123",
        role: "attendant",
      }),
    })

    const response = await POST(request)
    expect(response.status).toBe(403)
  })

  it("valida campos obrigatórios (nome, email, senha com min 6 chars, papel)", async () => {
    vi.spyOn(clinicSessionModule, "getClinicSession").mockResolvedValue({
      authenticated: true,
      role: "admin",
      email: "admin@exemplo.com",
      name: "Admin",
    })
    vi.spyOn(supabaseAdminModule, "createSupabaseAdmin").mockReturnValue({} as any)

    // Nome curto (< 3)
    const req1 = new Request("http://localhost/api/desktop/team", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Ab", email: "valido@exemplo.com", password: "123456", role: "attendant" }),
    })
    const res1 = await POST(req1)
    expect(res1.status).toBe(400)

    // Email inválido
    const req2 = new Request("http://localhost/api/desktop/team", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Nome Valido", email: "invalido", password: "123456", role: "attendant" }),
    })
    const res2 = await POST(req2)
    expect(res2.status).toBe(400)

    // Senha curta (< 6)
    const req3 = new Request("http://localhost/api/desktop/team", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Nome Valido", email: "valido@exemplo.com", password: "12345", role: "attendant" }),
    })
    const res3 = await POST(req3)
    expect(res3.status).toBe(400)

    // Papel inválido
    const req4 = new Request("http://localhost/api/desktop/team", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Nome Valido", email: "valido@exemplo.com", password: "123456", role: "superadmin" }),
    })
    const res4 = await POST(req4)
    expect(res4.status).toBe(400)
  })

  it("cria usuário no Supabase Auth e insere linha em clinic_team", async () => {
    vi.spyOn(clinicSessionModule, "getClinicSession").mockResolvedValue({
      authenticated: true,
      role: "admin",
      email: "admin@exemplo.com",
      name: "Admin",
    })

    const createUserMock = vi.fn().mockResolvedValue({
      data: { user: { id: "auth-user-99" } },
      error: null,
    })

    const singleMock = vi.fn().mockResolvedValue({
      data: {
        id: "team-99",
        auth_user_id: "auth-user-99",
        name: "Beatriz Santos",
        email: "beatriz@exemplo.com",
        role: "attendant",
        status: "active",
        created_at: "2026-11-05T01:00:00Z",
      },
      error: null,
    })
    const selectMock = vi.fn().mockReturnValue({ single: singleMock })
    const insertMock = vi.fn().mockReturnValue({ select: selectMock })
    const fromMock = vi.fn().mockReturnValue({ insert: insertMock })

    vi.spyOn(supabaseAdminModule, "createSupabaseAdmin").mockReturnValue({
      auth: { admin: { createUser: createUserMock } },
      from: fromMock,
    } as any)

    const request = new Request("http://localhost/api/desktop/team", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Beatriz Santos",
        email: "Beatriz@Exemplo.com",
        password: "segura123",
        role: "attendant",
      }),
    })

    const response = await POST(request)
    expect(response.status).toBe(201)

    expect(createUserMock).toHaveBeenCalledWith({
      email: "beatriz@exemplo.com",
      password: "segura123",
      email_confirm: true,
      app_metadata: { role: "clinic", clinic_role: "attendant" },
      user_metadata: { name: "Beatriz Santos" },
    })

    expect(fromMock).toHaveBeenCalledWith("clinic_team")
    expect(insertMock).toHaveBeenCalledWith({
      auth_user_id: "auth-user-99",
      name: "Beatriz Santos",
      email: "beatriz@exemplo.com",
      role: "attendant",
      status: "active",
    })

    const json = await response.json()
    expect(json.ok).toBe(true)
    expect(json.member).toEqual({
      id: "team-99",
      authUserId: "auth-user-99",
      name: "Beatriz Santos",
      email: "beatriz@exemplo.com",
      role: "attendant",
      status: "active",
      createdAt: "2026-11-05T01:00:00Z",
    })
  })

  it("retorna 400 se o Supabase Auth falhar ao criar o usuário", async () => {
    vi.spyOn(clinicSessionModule, "getClinicSession").mockResolvedValue({
      authenticated: true,
      role: "admin",
      email: "admin@exemplo.com",
      name: "Admin",
    })

    const createUserMock = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "A user with this email address has already been registered" },
    })

    vi.spyOn(supabaseAdminModule, "createSupabaseAdmin").mockReturnValue({
      auth: { admin: { createUser: createUserMock } },
      from: vi.fn(),
    } as any)

    const request = new Request("http://localhost/api/desktop/team", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Beatriz Santos",
        email: "beatriz@exemplo.com",
        password: "segura123",
        role: "attendant",
      }),
    })

    const response = await POST(request)
    expect(response.status).toBe(400)
    const json = await response.json()
    expect(json.error).toContain("already been registered")
  })
})

describe("PATCH /api/desktop/team", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("retorna 401 se a clínica não estiver autenticada", async () => {
    vi.spyOn(clinicSessionModule, "getClinicSession").mockResolvedValue({
      authenticated: false,
      role: "attendant",
      email: "",
      name: "",
    })

    const request = new Request("http://localhost/api/desktop/team", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: "team-1", status: "inactive" }),
    })

    const response = await PATCH(request)
    expect(response.status).toBe(401)
  })

  it("retorna 403 se o usuário não for admin", async () => {
    vi.spyOn(clinicSessionModule, "getClinicSession").mockResolvedValue({
      authenticated: true,
      role: "attendant",
      email: "atendente@exemplo.com",
      name: "Atendente",
    })

    const request = new Request("http://localhost/api/desktop/team", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: "team-1", status: "inactive" }),
    })

    const response = await PATCH(request)
    expect(response.status).toBe(403)
  })

  it("valida ID e campos a serem atualizados", async () => {
    vi.spyOn(clinicSessionModule, "getClinicSession").mockResolvedValue({
      authenticated: true,
      role: "admin",
      email: "admin@exemplo.com",
      name: "Admin",
    })
    vi.spyOn(supabaseAdminModule, "createSupabaseAdmin").mockReturnValue({} as any)

    // Sem ID
    const req1 = new Request("http://localhost/api/desktop/team", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "inactive" }),
    })
    expect((await PATCH(req1)).status).toBe(400)

    // Status inválido
    const req2 = new Request("http://localhost/api/desktop/team", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: "team-1", status: "pending" }),
    })
    expect((await PATCH(req2)).status).toBe(400)

    // Sem campos para atualizar
    const req3 = new Request("http://localhost/api/desktop/team", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: "team-1" }),
    })
    expect((await PATCH(req3)).status).toBe(400)

    // Nome curto
    const req4 = new Request("http://localhost/api/desktop/team", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: "team-1", name: "ab" }),
    })
    expect((await PATCH(req4)).status).toBe(400)
  })

  it("atualiza status de um membro da equipe com sucesso", async () => {
    vi.spyOn(clinicSessionModule, "getClinicSession").mockResolvedValue({
      authenticated: true,
      role: "admin",
      email: "admin@exemplo.com",
      name: "Admin",
    })

    const singleMock = vi.fn().mockResolvedValue({
      data: {
        id: "team-1",
        auth_user_id: "auth-1",
        name: "Ana Souza",
        email: "ana@exemplo.com",
        role: "attendant",
        status: "inactive",
        created_at: "2026-11-04T12:00:00Z",
      },
      error: null,
    })
    const selectMock = vi.fn().mockReturnValue({ single: singleMock })
    const eqMock = vi.fn().mockReturnValue({ select: selectMock })
    const updateMock = vi.fn().mockReturnValue({ eq: eqMock })
    const fromMock = vi.fn().mockReturnValue({ update: updateMock })

    vi.spyOn(supabaseAdminModule, "createSupabaseAdmin").mockReturnValue({
      from: fromMock,
    } as any)

    const request = new Request("http://localhost/api/desktop/team", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: "team-1", status: "inactive" }),
    })

    const response = await PATCH(request)
    expect(response.status).toBe(200)

    expect(fromMock).toHaveBeenCalledWith("clinic_team")
    expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({ status: "inactive" }))
    expect(eqMock).toHaveBeenCalledWith("id", "team-1")

    const json = await response.json()
    expect(json.ok).toBe(true)
    expect(json.member.status).toBe("inactive")
  })
})
