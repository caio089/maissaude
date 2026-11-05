import { describe, expect, it, vi, beforeEach } from "vitest"

vi.mock("server-only", () => ({}))

const mockSignInWithPassword = vi.fn()

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: vi.fn().mockImplementation(() =>
    Promise.resolve({
      auth: {
        signInWithPassword: mockSignInWithPassword,
      },
    })
  ),
}))

vi.mock("@/lib/supabase/env", () => ({
  isSupabaseBrowserConfigured: vi.fn().mockReturnValue(true),
}))

const mockCreateUser = vi.fn()
const mockDeleteUser = vi.fn()

type MockPatient = {
  [key: string]: any
  id: string
  name: string
  cpf: string
  phone: string
  email: string
  birth_date: string
  gender: string
  address: string
  city: string
  status: "active" | "inactive"
  notes: string
  created_at: string
  reminder_enabled: boolean
}

type MockMobileAccount = {
  [key: string]: any
  patient_id: string
  cpf: string
  email: string
  auth_user_id: string | null
  password_hash: string | null
}

type MockProfile = {
  [key: string]: any
  id: string
  role: string
  patient_id: string
  email: string
  updated_at: string
}

let mockPatients: MockPatient[] = []
let mockMobileAccounts: MockMobileAccount[] = []
let mockProfiles: MockProfile[] = []
let shouldFailDatabaseOperation = false

function createMockSupabaseAdmin() {
  return {
    auth: {
      admin: {
        createUser: mockCreateUser,
        deleteUser: mockDeleteUser,
      },
    },
    from: (table: string) => {
      let filtered: any[] = []
      if (table === "patients") filtered = [...mockPatients]
      else if (table === "mobile_accounts") filtered = [...mockMobileAccounts]
      else if (table === "profiles") filtered = [...mockProfiles]

      const builder: any = {
        select: vi.fn().mockImplementation(() => builder),
        eq: vi.fn().mockImplementation((col: string, val: any) => {
          filtered = filtered.filter((item) => item[col] === val)
          return builder
        }),
        in: vi.fn().mockImplementation((col: string, vals: any[]) => {
          filtered = filtered.filter((item) => vals.includes(item[col]))
          return builder
        }),
        not: vi.fn().mockImplementation((col: string, op: string, val: any) => {
          if (op === "is" && val === null) {
            filtered = filtered.filter((item) => item[col] !== null && item[col] !== undefined)
          }
          return builder
        }),
        limit: vi.fn().mockImplementation(() => builder),
        order: vi.fn().mockImplementation(() => builder),
        maybeSingle: vi.fn().mockImplementation(async () => {
          return { data: filtered[0] || null, error: null }
        }),
        single: vi.fn().mockImplementation(async () => {
          if (filtered.length === 0) {
            return { data: null, error: { message: "Row not found" } }
          }
          return { data: filtered[0], error: null }
        }),
        insert: vi.fn().mockImplementation(async (record: any) => {
          if (shouldFailDatabaseOperation) {
            return { data: null, error: { message: "Database insert error" } }
          }
          if (table === "patients") {
            const row: MockPatient = {
              id: record.id,
              name: record.name,
              cpf: record.cpf,
              phone: record.phone,
              email: record.email,
              birth_date: record.birth_date,
              gender: record.gender || "Não informado",
              address: record.address || "",
              city: record.city || "",
              status: record.status || "active",
              notes: record.notes || "",
              created_at: new Date().toISOString(),
              reminder_enabled: record.reminder_enabled ?? true,
            }
            mockPatients.push(row)
            return {
              data: row,
              error: null,
              select: () => ({
                single: async () => ({ data: row, error: null }),
              }),
            }
          }
          return { data: record, error: null }
        }),
        update: vi.fn().mockImplementation((updates: any) => {
          return {
            eq: vi.fn().mockImplementation(async (col: string, val: any) => {
              if (shouldFailDatabaseOperation) {
                return { data: null, error: { message: "Database update error" } }
              }
              if (table === "patients") {
                const idx = mockPatients.findIndex((item) => item[col] === val)
                if (idx !== -1) {
                  mockPatients[idx] = { ...mockPatients[idx], ...updates }
                  return { data: mockPatients[idx], error: null }
                }
              }
              return { data: null, error: null }
            }),
          }
        }),
        upsert: vi.fn().mockImplementation(async (record: any) => {
          if (shouldFailDatabaseOperation) {
            return { data: null, error: { message: "Database upsert error" } }
          }
          if (table === "mobile_accounts") {
            const idx = mockMobileAccounts.findIndex(
              (item) => item.patient_id === record.patient_id || item.cpf === record.cpf
            )
            if (idx !== -1) {
              mockMobileAccounts[idx] = { ...mockMobileAccounts[idx], ...record }
            } else {
              mockMobileAccounts.push(record)
            }
            return { data: record, error: null }
          }
          if (table === "profiles") {
            const idx = mockProfiles.findIndex((item) => item.id === record.id)
            if (idx !== -1) {
              mockProfiles[idx] = { ...mockProfiles[idx], ...record }
            } else {
              mockProfiles.push(record)
            }
            return { data: record, error: null }
          }
          return { data: record, error: null }
        }),
      }
      return builder
    },
  }
}

vi.mock("@/lib/supabase/admin", () => ({
  isSupabaseAdminConfigured: vi.fn().mockReturnValue(true),
  createSupabaseAdmin: vi.fn().mockImplementation(() => createMockSupabaseAdmin()),
}))

import { registerPatientAccount } from "@/lib/auth/patient-actions"

describe("registerPatientAccount - transição de pacientes pré-cadastrados", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCreateUser.mockReset()
    mockDeleteUser.mockReset()
    mockSignInWithPassword.mockReset()
    mockPatients = []
    mockMobileAccounts = []
    mockProfiles = []
    shouldFailDatabaseOperation = false
    mockSignInWithPassword.mockResolvedValue({ error: null })
  })

  it("vincula paciente existente da clínica que ainda não possui senha no aplicativo", async () => {
    // Pré-cadastro no balcão da clínica
    mockPatients.push({
      id: "pat-desk-123",
      name: "Maria Silva",
      cpf: "52998224725",
      phone: "86999990000",
      email: "maria.balcao@exemplo.com",
      birth_date: "1990-05-15",
      gender: "Feminino",
      address: "Rua das Flores, 123",
      city: "Teresina",
      status: "active",
      notes: "Cadastrada no balcão",
      created_at: "2026-01-01T10:00:00.000Z",
      reminder_enabled: true,
    })

    mockCreateUser.mockResolvedValueOnce({
      data: {
        user: {
          id: "auth-user-maria-1",
          email: "maria.nova@exemplo.com",
        },
      },
      error: null,
    })

    const result = await registerPatientAccount({
      name: "Maria Silva",
      cpf: "529.982.247-25",
      phone: "86988887777",
      email: "maria.nova@exemplo.com",
      birthDate: "1990-05-15",
      password: "Password123!",
      city: "Teresina",
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return

    // O id do paciente DEVE ser o mesmo id já pré-existente do balcão
    expect(result.patient.id).toBe("pat-desk-123")
    // Campos de contato foram atualizados com os dados informados
    expect(result.patient.phone).toBe("86988887777")
    expect(result.patient.email).toBe("maria.nova@exemplo.com")

    // mobile_accounts foi vinculado
    const mobileAccount = mockMobileAccounts.find((acc) => acc.patient_id === "pat-desk-123")
    expect(mobileAccount).toBeDefined()
    expect(mobileAccount?.auth_user_id).toBe("auth-user-maria-1")

    // profiles foi criado
    const profile = mockProfiles.find((p) => p.patient_id === "pat-desk-123")
    expect(profile).toBeDefined()
    expect(profile?.id).toBe("auth-user-maria-1")
    expect(profile?.role).toBe("patient")

    // Paciente foi autenticado
    expect(mockSignInWithPassword).toHaveBeenCalledWith({
      email: "maria.nova@exemplo.com",
      password: "Password123!",
    })
    expect(mockDeleteUser).not.toHaveBeenCalled()
  })

  it("vincula paciente quando já existe registro em mobile_accounts mas sem senha (auth_user_id null)", async () => {
    mockPatients.push({
      id: "pat-desk-456",
      name: "João Santos",
      cpf: "52998224725",
      phone: "86999990000",
      email: "joao.desk@exemplo.com",
      birth_date: "1985-03-20",
      gender: "Masculino",
      address: "Av Central, 456",
      city: "Teresina",
      status: "active",
      notes: "Criado pelo balcão",
      created_at: "2026-01-01T10:00:00.000Z",
      reminder_enabled: true,
    })

    mockMobileAccounts.push({
      patient_id: "pat-desk-456",
      cpf: "52998224725",
      email: "joao.desk@exemplo.com",
      auth_user_id: null,
      password_hash: null,
    })

    mockCreateUser.mockResolvedValueOnce({
      data: {
        user: {
          id: "auth-user-joao-2",
          email: "joao.app@exemplo.com",
        },
      },
      error: null,
    })

    const result = await registerPatientAccount({
      name: "João Santos",
      cpf: "52998224725",
      phone: "86988882222",
      email: "joao.app@exemplo.com",
      birthDate: "1985-03-20",
      password: "Password123!",
      city: "Teresina",
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.patient.id).toBe("pat-desk-456")
    expect(result.patient.phone).toBe("86988882222")
    expect(result.patient.email).toBe("joao.app@exemplo.com")

    const mobileAccount = mockMobileAccounts.find((acc) => acc.patient_id === "pat-desk-456")
    expect(mobileAccount?.auth_user_id).toBe("auth-user-joao-2")
    expect(mobileAccount?.email).toBe("joao.app@exemplo.com")
  })

  it("rejeita cadastro se o CPF já possuir conta com senha ativa", async () => {
    // Paciente já possui conta ativa no aplicativo
    mockMobileAccounts.push({
      patient_id: "pat-desk-123",
      cpf: "52998224725",
      email: "maria.ativa@exemplo.com",
      auth_user_id: "auth-existing-user-id",
      password_hash: null,
    })

    const result = await registerPatientAccount({
      name: "Maria Silva",
      cpf: "52998224725",
      phone: "86988887777",
      email: "maria.tentativa@exemplo.com",
      birthDate: "1990-05-15",
      password: "Password123!",
      city: "Teresina",
    })

    expect(result.ok).toBe(false)
    if (result.ok) return

    expect(result.message).toBe("Este CPF já tem conta. Entre com a senha ou recupere o acesso.")
    expect(mockCreateUser).not.toHaveBeenCalled()
  })

  it("cria um paciente novo quando o CPF não existe na clínica nem no aplicativo", async () => {
    mockCreateUser.mockResolvedValueOnce({
      data: {
        user: {
          id: "auth-user-brand-new",
          email: "novo@exemplo.com",
        },
      },
      error: null,
    })

    const result = await registerPatientAccount({
      name: "Novo Paciente",
      cpf: "52998224725",
      phone: "86999992222",
      email: "novo@exemplo.com",
      birthDate: "1995-01-01",
      password: "Password123!",
      city: "Teresina",
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.patient.cpf).toBe("52998224725")
    expect(result.patient.name).toBe("Novo Paciente")
    expect(mockPatients.length).toBe(1)
    expect(mockMobileAccounts.length).toBe(1)
    expect(mockProfiles.length).toBe(1)
    expect(mockSignInWithPassword).toHaveBeenCalled()
    expect(mockDeleteUser).not.toHaveBeenCalled()
  })

  it("executa rollback deletando usuário do Auth quando a persistência falha", async () => {
    mockPatients.push({
      id: "pat-desk-123",
      name: "Maria Silva",
      cpf: "52998224725",
      phone: "86999990000",
      email: "maria.balcao@exemplo.com",
      birth_date: "1990-05-15",
      gender: "Feminino",
      address: "Rua das Flores, 123",
      city: "Teresina",
      status: "active",
      notes: "Cadastrada no balcão",
      created_at: "2026-01-01T10:00:00.000Z",
      reminder_enabled: true,
    })

    mockCreateUser.mockResolvedValueOnce({
      data: {
        user: {
          id: "auth-user-rollback-test",
          email: "maria.fail@exemplo.com",
        },
      },
      error: null,
    })

    shouldFailDatabaseOperation = true

    const result = await registerPatientAccount({
      name: "Maria Silva",
      cpf: "52998224725",
      phone: "86988887777",
      email: "maria.fail@exemplo.com",
      birthDate: "1990-05-15",
      password: "Password123!",
      city: "Teresina",
    })

    expect(result.ok).toBe(false)
    expect(mockDeleteUser).toHaveBeenCalledWith("auth-user-rollback-test")
  })
})
