import { describe, expect, it, vi, beforeEach } from "vitest"

vi.mock("server-only", () => ({}))
import { GET } from "@/app/api/desktop/guides/route"
import * as clinicSession from "@/lib/clinic-session"
import * as adminSupabase from "@/lib/supabase/admin"

describe("GET /api/desktop/guides - Extended (Doctor Photos & Independent Procedures)", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("retorna photoUrl do médico no item da guia e no guideInput quando disponível", async () => {
    vi.spyOn(clinicSession, "hasClinicSession").mockResolvedValue(true)

    const mockDb = {
      from: vi.fn((table: string) => {
        if (table === "authorization_guides") {
          return {
            select: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue({
              data: [
                {
                  id: "guide-doc-1",
                  appointment_id: "apt-doc-1",
                  payment_id: "pay-1",
                  issued_at: "2026-11-05T14:00:00Z",
                },
              ],
              error: null,
            }),
          }
        }
        if (table === "appointments") {
          return {
            select: vi.fn().mockReturnThis(),
            in: vi.fn().mockResolvedValue({
              data: [
                {
                  id: "apt-doc-1",
                  patient_id: "pat-1",
                  professional_id: "pro-1",
                  service_id: "srv-1",
                  starts_at: "2026-11-06T09:00:00Z",
                  status: "confirmed",
                  payment_id: "pay-1",
                },
              ],
              error: null,
            }),
          }
        }
        if (table === "payments") {
          return {
            select: vi.fn().mockReturnThis(),
            in: vi.fn().mockResolvedValue({
              data: [
                {
                  id: "pay-1",
                  status: "paid",
                  simulated: false,
                  asaas_payment_id: "pay_asaas_1",
                },
              ],
              error: null,
            }),
          }
        }
        if (table === "patients") {
          return {
            select: vi.fn().mockReturnThis(),
            in: vi.fn().mockResolvedValue({
              data: [
                {
                  id: "pat-1",
                  name: "Ana Silva",
                  cpf: "123.456.789-00",
                  birth_date: "1995-02-10",
                },
              ],
              error: null,
            }),
          }
        }
        if (table === "professionals") {
          return {
            select: vi.fn().mockReturnThis(),
            in: vi.fn().mockResolvedValue({
              data: [
                {
                  id: "pro-1",
                  name: "Dr. Roberto Carlos",
                  specialty: "cardiologia",
                  credential_label: "CRM",
                  credential_code: "54321/CE",
                  location: "Consultório 3",
                  start_hour: "08:00",
                  end_hour: "16:00",
                  photo_url: "https://example.com/roberto.jpg",
                },
              ],
              error: null,
            }),
          }
        }
        if (table === "professional_services") {
          return {
            select: vi.fn().mockReturnThis(),
            in: vi.fn().mockResolvedValue({
              data: [
                {
                  id: "srv-1",
                  name: "Consulta Cardiológica",
                  price: 250,
                },
              ],
              error: null,
            }),
          }
        }
        if (table === "clinics") {
          return {
            select: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue({
              data: [
                {
                  id: "clinic-1",
                  name: "CuidarSaude Aldeota",
                  phone: "(85) 3333-4444",
                  address: "Av. Dom Luís, 500",
                  city: "Fortaleza - CE",
                },
              ],
              error: null,
            }),
          }
        }
        return {
          select: vi.fn().mockReturnThis(),
          in: vi.fn().mockResolvedValue({ data: [], error: null }),
        }
      }),
    }

    vi.spyOn(adminSupabase, "createSupabaseAdmin").mockReturnValue(mockDb as any)

    const response = await GET(new Request("http://localhost/api/desktop/guides"))
    expect(response.status).toBe(200)

    const data = await response.json()
    expect(data.guides).toHaveLength(1)
    const guide = data.guides[0]

    expect(guide.professional).toBe("Dr. Roberto Carlos")
    expect(guide.photoUrl).toBe("https://example.com/roberto.jpg")
    expect(guide.service).toBe("Consulta Cardiológica")

    expect(guide.guideInput.professional.name).toBe("Dr. Roberto Carlos")
    expect(guide.guideInput.professional.photoUrl).toBe("https://example.com/roberto.jpg")
    expect(guide.guideInput.clinic.name).toBe("CuidarSaude Aldeota")
    expect(guide.guideInput.clinic.address).toBe("Av. Dom Luís, 500")
    expect(guide.guideInput.clinic.phone).toBe("(85) 3333-4444")
    expect(guide.guideInput.clinic.city).toBe("Fortaleza - CE")
  })

  it("suporta procedimentos e exames independentes da clínica com professional_id nulo buscando em catalog_offers", async () => {
    vi.spyOn(clinicSession, "hasClinicSession").mockResolvedValue(true)

    const mockDb = {
      from: vi.fn((table: string) => {
        if (table === "authorization_guides") {
          return {
            select: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue({
              data: [
                {
                  id: "guide-proc-1",
                  appointment_id: "apt-proc-1",
                  payment_id: "pay-2",
                  issued_at: "2026-11-05T15:00:00Z",
                },
              ],
              error: null,
            }),
          }
        }
        if (table === "appointments") {
          return {
            select: vi.fn().mockReturnThis(),
            in: vi.fn().mockResolvedValue({
              data: [
                {
                  id: "apt-proc-1",
                  patient_id: "pat-1",
                  professional_id: null,
                  service_id: "svc-exame-1",
                  starts_at: "2026-11-06T11:00:00Z",
                  status: "confirmed",
                  payment_id: "pay-2",
                },
              ],
              error: null,
            }),
          }
        }
        if (table === "payments") {
          return {
            select: vi.fn().mockReturnThis(),
            in: vi.fn().mockResolvedValue({
              data: [
                {
                  id: "pay-2",
                  status: "paid",
                  simulated: false,
                  asaas_payment_id: "pay_asaas_2",
                },
              ],
              error: null,
            }),
          }
        }
        if (table === "patients") {
          return {
            select: vi.fn().mockReturnThis(),
            in: vi.fn().mockResolvedValue({
              data: [
                {
                  id: "pat-1",
                  name: "Carlos Magno",
                  cpf: "987.654.321-99",
                  birth_date: "1988-11-20",
                },
              ],
              error: null,
            }),
          }
        }
        if (table === "professionals") {
          return {
            select: vi.fn().mockReturnThis(),
            in: vi.fn().mockResolvedValue({
              data: [],
              error: null,
            }),
          }
        }
        if (table === "professional_services") {
          return {
            select: vi.fn().mockReturnThis(),
            in: vi.fn().mockResolvedValue({
              data: [], // not found in professional_services
              error: null,
            }),
          }
        }
        if (table === "catalog_offers") {
          return {
            select: vi.fn().mockReturnThis(),
            in: vi.fn().mockResolvedValue({
              data: [
                {
                  id: "svc-exame-1",
                  service_name: "Eletrocardiograma",
                  kind: "exame",
                  price: 120,
                },
              ],
              error: null,
            }),
          }
        }
        if (table === "clinics") {
          return {
            select: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue({
              data: [
                {
                  id: "clinic-1",
                  name: "CuidarSaude Central",
                  phone: "(85) 99999-8888",
                  address: "Rua Floriano Peixoto, 200",
                  city: "Fortaleza/CE",
                },
              ],
              error: null,
            }),
          }
        }
        return {
          select: vi.fn().mockReturnThis(),
          in: vi.fn().mockResolvedValue({ data: [], error: null }),
        }
      }),
    }

    vi.spyOn(adminSupabase, "createSupabaseAdmin").mockReturnValue(mockDb as any)

    const response = await GET(new Request("http://localhost/api/desktop/guides"))
    expect(response.status).toBe(200)

    const data = await response.json()
    expect(data.guides).toHaveLength(1)
    const guide = data.guides[0]

    expect(guide.professional).toBe("CuidarSaude Central")
    expect(guide.photoUrl).toBeNull()
    expect(guide.service).toBe("Eletrocardiograma")

    expect(guide.guideInput.professional).toEqual({
      name: "CuidarSaude Central",
      specialtyLabel: "Procedimento / Exame",
      credentialLabel: null,
      credentialCode: null,
      location: "Rua Floriano Peixoto, 200",
      startHour: null,
      endHour: null,
      photoUrl: null,
    })

    expect(guide.guideInput.serviceName).toBe("Eletrocardiograma")
    expect(guide.guideInput.procedures[0]).toEqual({
      code: "CS-CONSULTA",
      description: "Eletrocardiograma",
      doctor: "CuidarSaude Central",
      sector: "Procedimento / Exame",
    })
  })

  it("garante fallback de endereço, cidade e telefone da clínica quando vazios no banco", async () => {
    vi.spyOn(clinicSession, "hasClinicSession").mockResolvedValue(true)

    const mockDb = {
      from: vi.fn((table: string) => {
        if (table === "authorization_guides") {
          return {
            select: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue({
              data: [
                {
                  id: "guide-empty-clinic",
                  appointment_id: "apt-1",
                  payment_id: "pay-1",
                  issued_at: "2026-11-05T14:00:00Z",
                },
              ],
              error: null,
            }),
          }
        }
        if (table === "appointments") {
          return {
            select: vi.fn().mockReturnThis(),
            in: vi.fn().mockResolvedValue({
              data: [
                {
                  id: "apt-1",
                  patient_id: "pat-1",
                  professional_id: null,
                  service_id: "srv-1",
                  starts_at: "2026-11-06T10:00:00Z",
                  status: "confirmed",
                  payment_id: "pay-1",
                },
              ],
              error: null,
            }),
          }
        }
        if (table === "payments") {
          return {
            select: vi.fn().mockReturnThis(),
            in: vi.fn().mockResolvedValue({
              data: [{ id: "pay-1", status: "paid", simulated: false, asaas_payment_id: "pay_1" }],
              error: null,
            }),
          }
        }
        if (table === "patients") {
          return {
            select: vi.fn().mockReturnThis(),
            in: vi.fn().mockResolvedValue({
              data: [{ id: "pat-1", name: "Paciente Teste", cpf: "111.222.333-44", birth_date: "2000-01-01" }],
              error: null,
            }),
          }
        }
        if (table === "professionals") {
          return {
            select: vi.fn().mockReturnThis(),
            in: vi.fn().mockResolvedValue({ data: [], error: null }),
          }
        }
        if (table === "professional_services") {
          return {
            select: vi.fn().mockReturnThis(),
            in: vi.fn().mockResolvedValue({ data: [], error: null }),
          }
        }
        if (table === "catalog_offers") {
          return {
            select: vi.fn().mockReturnThis(),
            in: vi.fn().mockResolvedValue({
              data: [{ id: "srv-1", service_name: "Raio-X", kind: "exame" }],
              error: null,
            }),
          }
        }
        if (table === "clinics") {
          return {
            select: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue({
              data: [
                {
                  id: "clinic-1",
                  name: "   ",
                  phone: null,
                  address: "",
                  city: undefined,
                },
              ],
              error: null,
            }),
          }
        }
        return { select: vi.fn().mockReturnThis(), in: vi.fn().mockResolvedValue({ data: [], error: null }) }
      }),
    }

    vi.spyOn(adminSupabase, "createSupabaseAdmin").mockReturnValue(mockDb as any)

    const response = await GET(new Request("http://localhost/api/desktop/guides"))
    expect(response.status).toBe(200)

    const data = await response.json()
    const guide = data.guides[0]

    expect(guide.guideInput.clinic.name).toBe("")
    expect(guide.guideInput.clinic.phone).toBeNull()
    expect(guide.guideInput.clinic.address).toBeNull()
    expect(guide.guideInput.clinic.city).toBeNull()
    expect(JSON.stringify(guide.guideInput)).not.toContain("Rua Exemplo")
    expect(JSON.stringify(guide.guideInput)).not.toContain("3000-0000")
  })
})
