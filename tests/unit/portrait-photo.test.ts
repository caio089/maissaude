import { describe, expect, it, vi, beforeEach } from "vitest"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"

vi.mock("server-only", () => ({}))

import { isPhotoUrl, Portrait } from "@/components/shared/portrait"
import { GET, POST } from "@/app/api/desktop/professionals/route"
import * as clinicSession from "@/lib/clinic-session"
import * as adminSupabase from "@/lib/supabase/admin"

describe("isPhotoUrl helper", () => {
  it("reconhece URLs http e data URIs como fotos reais", () => {
    expect(isPhotoUrl("https://example.com/foto.jpg")).toBe(true)
    expect(isPhotoUrl("http://example.com/foto.png")).toBe(true)
    expect(isPhotoUrl("data:image/jpeg;base64,12345")).toBe(true)
    expect(isPhotoUrl("data:image/png;base64,iVBORw0KGgo=")).toBe(true)
  })

  it("recusa seeds simples, valores nulos, vazios ou protocolos não suportados", () => {
    expect(isPhotoUrl("dra-maria")).toBe(false)
    expect(isPhotoUrl("seed-avatar-123")).toBe(false)
    expect(isPhotoUrl(null)).toBe(false)
    expect(isPhotoUrl(undefined)).toBe(false)
    expect(isPhotoUrl("")).toBe(false)
    expect(isPhotoUrl("ftp://example.com/foto.jpg")).toBe(false)
    expect(isPhotoUrl(123 as any)).toBe(false)
  })
})

describe("Portrait component rendering", () => {
  it("renderiza imagem real quando photoUrl for fornecida", () => {
    const html = renderToStaticMarkup(
      React.createElement(Portrait, {
        seed: "dra-maria",
        photoUrl: "https://example.com/foto.jpg",
        name: "Dra. Maria",
      })
    )
    expect(html).toContain('src="https://example.com/foto.jpg"')
    expect(html).toContain('alt="Foto de Dra. Maria"')
  })

  it("renderiza imagem real quando seed for uma URL de foto e photoUrl não for passada", () => {
    const html = renderToStaticMarkup(
      React.createElement(Portrait, {
        seed: "https://example.com/medico.jpg",
        name: "Dr. Roberto",
      })
    )
    expect(html).toContain('src="https://example.com/medico.jpg"')
    expect(html).toContain('alt="Foto de Dr. Roberto"')
  })

  it("renderiza avatar gerado quando photoUrl for nula e seed for um identificador", () => {
    const html = renderToStaticMarkup(
      React.createElement(Portrait, {
        seed: "dra-maria",
        photoUrl: null,
        name: "Dra. Maria",
      })
    )
    expect(html).toContain('alt="Foto de Dra. Maria"')
    expect(html).toContain('data:image/svg+xml')
  })
})

describe("/api/desktop/professionals photo_url and dynamic specialties", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("GET mapeia photo_url do banco para photoUrl no payload", async () => {
    vi.spyOn(clinicSession, "hasClinicSession").mockResolvedValue(true)

    const mockProfessionals = [
      {
        id: "pro-1",
        name: "Dra. Ana",
        specialty: "clinica-geral",
        credential_label: "CRM",
        credential_code: "12345",
        bio: "Médica experiente",
        price: 150,
        rating: 5,
        review_count: 10,
        work_days: [1, 2, 3],
        start_hour: "08:00",
        end_hour: "18:00",
        location: "Sala 1",
        active: true,
        avatar_seed: "dra-ana",
        photo_url: "https://example.com/ana.jpg",
      },
    ]

    const mockDb = {
      from: vi.fn((table: string) => {
        if (table === "professionals") {
          return {
            select: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: mockProfessionals, error: null }),
            }),
          }
        }
        return {
          select: vi.fn().mockResolvedValue({ data: [], error: null }),
        }
      }),
    }
    vi.spyOn(adminSupabase, "createSupabaseAdmin").mockReturnValue(mockDb as any)

    const response = await GET()
    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.professionals[0].photoUrl).toBe("https://example.com/ana.jpg")
  })

  it("POST persiste photo_url e aceita especialidades customizadas", async () => {
    vi.spyOn(clinicSession, "getClinicSession").mockResolvedValue({
      authenticated: true,
      role: "admin",
      email: "admin@cuidarsaude.com",
      name: "Administrador",
    })

    let upsertedRow: any = null
    const mockDb = {
      from: vi.fn((table: string) => {
        if (table === "professionals") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
              }),
            }),
            upsert: vi.fn((row: any) => {
              upsertedRow = row
              return Promise.resolve({ error: null })
            }),
          }
        }
        if (table === "professional_services") {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
            upsert: vi.fn().mockResolvedValue({ error: null }),
          }
        }
        if (table === "catalog_offers") {
          return {
            upsert: vi.fn().mockResolvedValue({ error: null }),
          }
        }
        return {}
      }),
    }
    vi.spyOn(adminSupabase, "createSupabaseAdmin").mockReturnValue(mockDb as any)

    const payload = {
      id: "pro-custom-1",
      form: {
        name: "Dr. João Silva",
        specialty: "reumatologia", // Dynamic specialty not in hardcoded SPECIALTIES
        credentialCode: "CRM 99999",
        bio: "Especialista em reumatologia e doenças articulares.",
        price: 200,
        workDays: [1, 2, 3],
        startHour: "08:00",
        endHour: "18:00",
        active: true,
        photoUrl: "https://example.com/joao.jpg",
      },
      services: [],
    }

    const request = new Request("http://localhost/api/desktop/professionals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })

    const response = await POST(request)
    expect(response.status).toBe(200)
    expect(upsertedRow).toBeDefined()
    expect(upsertedRow.photo_url).toBe("https://example.com/joao.jpg")
    expect(upsertedRow.specialty).toBe("reumatologia")
  })
})
