# Exportar Guia de Consulta no Painel Desktop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar funcionalidade completa de exportação (impressão em formato A4/PDF e download de imagem PNG) para guias de consulta no painel de guias da clínica (`/desktop/guias`), com pré-visualização em modal interativo.

**Architecture:** A API `/api/desktop/guides` enriquece os dados retornados incluindo todos os detalhes clínicos necessários para construir a guia oficial (`AuthorizationGuideInput`). O utilitário `src/lib/authorization-guide.ts` ganha suporte a impressão sem cabeçalhos espúrios através de iframe estilizado para A4. O novo componente `GuideExportDialog` renderiza a pré-visualização em alta resolução e permite ao operador da clínica baixar o PNG oficial ou abrir o diálogo de impressão nativo (com suporte a salvar como PDF).

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, Supabase, Tailwind CSS, Lucide React, Vitest.

## Global Constraints

- O projeto usa Next.js 16 e React 19 com compilação estrita em TypeScript (`noImplicitAny`).
- Cores e design tokens devem manter consistência com o tema existente da clínica (tons de teal, slate e layout clean sem bordas excessivas).
- Nenhuma dependência externa pesada deve ser adicionada; a impressão e download devem usar o motor canvas existente e recursos nativos do navegador (`window.print`, `HTMLCanvasElement.toBlob`, `URL.createObjectURL`).
- Todos os testes unitários (`npm run test:unit`) devem passar sem warnings ou quebras.

---

### Task 1: Função Auxiliar de Impressão de Guia (`printAuthorizationGuide`)

**Files:**
- Modify: `src/lib/authorization-guide.ts`
- Create: `tests/unit/authorization-guide-print.test.ts`

**Interfaces:**
- Produces: `printAuthorizationGuide(blob: Blob, title?: string): Promise<void>` em `src/lib/authorization-guide.ts`.

- [ ] **Step 1: Escrever teste unitário para `printAuthorizationGuide`**

Criar `tests/unit/authorization-guide-print.test.ts`:
```ts
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest"
import { printAuthorizationGuide } from "@/lib/authorization-guide"

describe("printAuthorizationGuide", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("cria um iframe de impressão, carrega o blob da imagem e invoca print", async () => {
    const mockPrint = vi.fn()
    const mockRevoke = vi.fn()
    const mockCreateObjectURL = vi.fn(() => "blob:http://localhost/mock-guide-url")
    global.URL.createObjectURL = mockCreateObjectURL
    global.URL.revokeObjectURL = mockRevoke

    let iframeLoadCallback: (() => void) | null = null
    const appendSpy = vi.spyOn(document.body, "appendChild").mockImplementation((node) => {
      if (node instanceof HTMLIFrameElement) {
        Object.defineProperty(node, "contentWindow", {
          value: {
            print: mockPrint,
            focus: vi.fn(),
          },
          writable: true,
        })
        setTimeout(() => {
          if (iframeLoadCallback) iframeLoadCallback()
        }, 10)
      }
      return node
    })

    const removeSpy = vi.spyOn(document.body, "removeChild").mockImplementation((node) => node)

    const blob = new Blob(["fake-image-bytes"], { type: "image/png" })
    const printPromise = printAuthorizationGuide(blob, "Guia 123456.1")

    const addedIframe = appendSpy.mock.calls[0]?.[0] as HTMLIFrameElement
    expect(addedIframe).toBeDefined()
    expect(addedIframe.style.display).toBe("none")

    iframeLoadCallback = (addedIframe as unknown as { onload: () => void }).onload
    if (iframeLoadCallback) iframeLoadCallback()

    await printPromise
    expect(mockPrint).toHaveBeenCalled()
    expect(removeSpy).toHaveBeenCalledWith(addedIframe)
    expect(mockRevoke).toHaveBeenCalledWith("blob:http://localhost/mock-guide-url")
  })
})
```

- [ ] **Step 2: Executar teste para verificar que falha**

Run: `npx vitest run tests/unit/authorization-guide-print.test.ts`
Expected: FAIL informando que `printAuthorizationGuide` não foi exportada.

- [ ] **Step 3: Implementar `printAuthorizationGuide` em `src/lib/authorization-guide.ts`**

Adicionar ao final de `src/lib/authorization-guide.ts`:
```ts
export function printAuthorizationGuide(blob: Blob, title = "Guia de Autorização"): Promise<void> {
  return new Promise((resolve) => {
    const imageUrl = URL.createObjectURL(blob)
    const iframe = document.createElement("iframe")
    iframe.style.position = "fixed"
    iframe.style.right = "0"
    iframe.style.bottom = "0"
    iframe.style.width = "0"
    iframe.style.height = "0"
    iframe.style.border = "0"
    iframe.style.display = "none"

    const cleanup = () => {
      URL.revokeObjectURL(imageUrl)
      if (iframe.parentNode) {
        iframe.parentNode.removeChild(iframe)
      }
      resolve()
    }

    iframe.onload = () => {
      try {
        const frameWindow = iframe.contentWindow
        if (!frameWindow) {
          cleanup()
          return
        }
        frameWindow.focus()
        frameWindow.print()
        setTimeout(cleanup, 1000)
      } catch {
        cleanup()
      }
    }

    document.body.appendChild(iframe)

    const frameDoc = iframe.contentDocument || iframe.contentWindow?.document
    if (!frameDoc) {
      cleanup()
      return
    }

    frameDoc.open()
    frameDoc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>${title}</title>
          <style>
            @page {
              size: A4 portrait;
              margin: 8mm;
            }
            body {
              margin: 0;
              padding: 0;
              display: flex;
              justify-content: center;
              align-items: flex-start;
              background: #fff;
            }
            img {
              width: 100%;
              max-width: 100%;
              height: auto;
              display: block;
            }
          </style>
        </head>
        <body>
          <img src="${imageUrl}" alt="${title}" />
        </body>
      </html>
    `)
    frameDoc.close()
  })
}
```

- [ ] **Step 4: Executar teste para verificar que passa**

Run: `npx vitest run tests/unit/authorization-guide-print.test.ts`
Expected: PASS com 1 teste aprovado.

- [ ] **Step 5: Commit da Task 1**

```bash
git add src/lib/authorization-guide.ts tests/unit/authorization-guide-print.test.ts
git commit -m "feat(guides): add printAuthorizationGuide utility with unit test"
```

---

### Task 2: Enriquecer a API `/api/desktop/guides` com Dados Oficiais da Guia

**Files:**
- Modify: `src/app/api/desktop/guides/route.ts`
- Create: `tests/unit/desktop-guides-api.test.ts`

**Interfaces:**
- Produces: O endpoint `GET /api/desktop/guides` passa a incluir na propriedade `guideInput: AuthorizationGuideInput` para cada item retornado.

- [ ] **Step 1: Escrever teste unitário para `/api/desktop/guides`**

Criar `tests/unit/desktop-guides-api.test.ts`:
```ts
import { describe, expect, it, vi } from "vitest"
import { GET } from "@/app/api/desktop/guides/route"
import * as clinicSession from "@/lib/clinic-session"
import * as adminSupabase from "@/lib/supabase/admin"

describe("GET /api/desktop/guides", () => {
  it("devolve 401 se a clínica não estiver autenticada", async () => {
    vi.spyOn(clinicSession, "hasClinicSession").mockResolvedValue(false)
    const request = new Request("http://localhost/api/desktop/guides")
    const response = await GET(request)
    expect(response.status).toBe(401)
  })

  it("retorna guias com guideInput completo quando autenticado", async () => {
    vi.spyOn(clinicSession, "hasClinicSession").mockResolvedValue(true)
    const mockDb = {
      from: vi.fn((table: string) => {
        if (table === "authorization_guides") {
          return {
            select: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue({
              data: [{ id: "guide-123", appointment_id: "apt-1", payment_id: "pay-1", issued_at: "2026-10-31T14:00:00Z" }],
              error: null,
            }),
          }
        }
        if (table === "appointments") {
          return {
            select: vi.fn().mockReturnThis(),
            in: vi.fn().mockResolvedValue({
              data: [{ id: "apt-1", patient_id: "pat-1", professional_id: "pro-1", service_id: "srv-1", starts_at: "2026-11-01T10:00:00Z", status: "confirmed", payment_id: "pay-1" }],
              error: null,
            }),
          }
        }
        if (table === "payments") {
          return {
            select: vi.fn().mockReturnThis(),
            in: vi.fn().mockResolvedValue({
              data: [{ id: "pay-1", status: "paid", simulated: false, asaas_payment_id: "pay_asaas_1" }],
              error: null,
            }),
          }
        }
        if (table === "patients") {
          return {
            select: vi.fn().mockReturnThis(),
            in: vi.fn().mockResolvedValue({
              data: [{ id: "pat-1", name: "Maria Silva", cpf: "123.456.789-00", birth_date: "1990-05-15" }],
              error: null,
            }),
          }
        }
        if (table === "professionals") {
          return {
            select: vi.fn().mockReturnThis(),
            in: vi.fn().mockResolvedValue({
              data: [{ id: "pro-1", name: "Dr. Carlos Lima", specialty: "clinica-geral", credential_label: "CRM", credential_code: "12345/CE", location: "Sala 102", start_hour: "08:00", end_hour: "17:00" }],
              error: null,
            }),
          }
        }
        if (table === "professional_services") {
          return {
            select: vi.fn().mockReturnThis(),
            in: vi.fn().mockResolvedValue({
              data: [{ id: "srv-1", name: "Consulta Clínica", price: 150 }],
              error: null,
            }),
          }
        }
        if (table === "clinics") {
          return {
            select: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue({
              data: [{ id: "clinic-1", name: "CuidarSaude Central", phone: "(85) 99999-0000", address: "Av. Santos Dumont, 1000", city: "Fortaleza/CE" }],
              error: null,
            }),
          }
        }
        return { select: vi.fn().mockReturnThis(), in: vi.fn().mockResolvedValue({ data: [], error: null }) }
      }),
    }

    vi.spyOn(adminSupabase, "createSupabaseAdmin").mockReturnValue(mockDb as unknown as ReturnType<typeof adminSupabase.createSupabaseAdmin>)

    const request = new Request("http://localhost/api/desktop/guides")
    const response = await GET(request)
    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.guides).toHaveLength(1)
    expect(json.guides[0].guideInput).toBeDefined()
    expect(json.guides[0].guideInput.patient.name).toBe("Maria Silva")
    expect(json.guides[0].guideInput.professional.name).toBe("Dr. Carlos Lima")
  })
})
```

- [ ] **Step 2: Executar teste para verificar que falha**

Run: `npx vitest run tests/unit/desktop-guides-api.test.ts`
Expected: FAIL informando que `guideInput` é undefined.

- [ ] **Step 3: Atualizar `src/app/api/desktop/guides/route.ts`**

Substituir o conteúdo de `src/app/api/desktop/guides/route.ts` para carregar dados completos e montar `guideInput`:
```ts
import { NextResponse } from "next/server"
import { hasClinicSession } from "@/lib/clinic-session"
import { createSupabaseAdmin } from "@/lib/supabase/admin"
import { SPECIALTY_LABEL, type SpecialtyKey } from "@/lib/types"
import type { AuthorizationGuideInput } from "@/lib/authorization-guide"

const DEFAULT_CLINIC = {
  name: "CuidarSaude",
  phone: "(85) 3000-0000",
  address: "Rua Exemplo, 123",
  city: "Fortaleza/CE",
}

export async function GET(request: Request) {
  if (!(await hasClinicSession())) return NextResponse.json({ error: "Entre no painel da clínica." }, { status: 401 })
  const db = createSupabaseAdmin()
  if (!db) return NextResponse.json({ error: "Banco de dados indisponível." }, { status: 503 })
  const params = new URL(request.url).searchParams
  const patientId = params.get("patientId")?.trim()
  const guideId = params.get("guideId")?.trim()
  if (patientId && patientId.length > 100) return NextResponse.json({ error: "Paciente inválido." }, { status: 400 })
  if (guideId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(guideId)) return NextResponse.json({ error: "Digite o número completo da guia." }, { status: 400 })

  let patientAppointments: string[] | undefined
  if (patientId) {
    const result = await db.from("appointments").select("id").eq("patient_id", patientId)
    if (result.error) return NextResponse.json({ error: "Não foi possível localizar as consultas." }, { status: 500 })
    patientAppointments = result.data.map((item) => item.id)
    if (!patientAppointments.length) return NextResponse.json({ guides: [] })
  }
  let query = db.from("authorization_guides").select("id,appointment_id,payment_id,issued_at").order("issued_at", { ascending: false }).limit(100)
  if (patientAppointments) query = query.in("appointment_id", patientAppointments)
  if (guideId) query = query.eq("id", guideId)
  const { data: guides, error } = await query
  if (error) return NextResponse.json({ error: "Não foi possível buscar as guias." }, { status: 500 })
  if (!guides.length) return NextResponse.json({ guides: [] })
  const appointmentIds = [...new Set(guides.map((item) => item.appointment_id))]
  const paymentIds = [...new Set(guides.map((item) => item.payment_id))]
  const [appointments, payments, clinicRes] = await Promise.all([
    db.from("appointments").select("id,patient_id,professional_id,service_id,starts_at,status,payment_id").in("id", appointmentIds),
    db.from("payments").select("id,status,simulated,asaas_payment_id").in("id", paymentIds),
    db.from("clinics").select("id,name,phone,address,city").limit(1),
  ])
  if (appointments.error || payments.error) return NextResponse.json({ error: "Não foi possível carregar os detalhes das guias." }, { status: 500 })

  const clinicData = clinicRes.data?.[0]
  const clinic = {
    name: clinicData?.name || DEFAULT_CLINIC.name,
    phone: clinicData?.phone || DEFAULT_CLINIC.phone,
    address: clinicData?.address || DEFAULT_CLINIC.address,
    city: clinicData?.city || DEFAULT_CLINIC.city,
  }

  const ids = (key: "patient_id" | "professional_id" | "service_id") => [...new Set(appointments.data.map((item) => item[key]).filter(Boolean))]
  const [patients, professionals, services] = await Promise.all([
    db.from("patients").select("id,name,cpf,birth_date").in("id", ids("patient_id")),
    db.from("professionals").select("id,name,specialty,credential_label,credential_code,location,start_hour,end_hour").in("id", ids("professional_id")),
    db.from("professional_services").select("id,name,price").in("id", ids("service_id")),
  ])
  if (patients.error || professionals.error || services.error) return NextResponse.json({ error: "Não foi possível carregar os dados dos atendimentos." }, { status: 500 })

  return NextResponse.json({
    guides: guides.map((guide) => {
      const appointment = appointments.data.find((item) => item.id === guide.appointment_id)
      const payment = payments.data.find((item) => item.id === guide.payment_id)
      const patient = patients.data.find((item) => item.id === appointment?.patient_id)
      const professional = professionals.data.find((item) => item.id === appointment?.professional_id)
      const service = services.data.find((item) => item.id === appointment?.service_id)
      const valid = Boolean(appointment && appointment.status !== "cancelled" && appointment.payment_id === guide.payment_id && payment?.status === "paid" && !payment.simulated && payment.asaas_payment_id)

      const specialtyKey = (professional?.specialty || "clinica-geral") as SpecialtyKey
      const specialtyLabel = SPECIALTY_LABEL[specialtyKey] || "Clínica geral"

      const guideInput: AuthorizationGuideInput = {
        reference: guide.id,
        authorizedAt: guide.issued_at,
        patient: {
          name: patient?.name || "Paciente",
          cpf: patient?.cpf || "",
          birthDate: patient?.birth_date || "2000-01-01",
        },
        clinic,
        appointmentAt: appointment?.starts_at || guide.issued_at,
        professional: {
          name: professional?.name || "Profissional",
          specialtyLabel,
          credentialLabel: professional?.credential_label || "CRM",
          credentialCode: professional?.credential_code || "0000",
          location: professional?.location || clinic.address,
          startHour: professional?.start_hour ? String(professional.start_hour).slice(0, 5) : "08:00",
          endHour: professional?.end_hour ? String(professional.end_hour).slice(0, 5) : "18:00",
        },
        serviceName: service?.name || "Consulta",
        procedures: [{
          code: "CS-CONSULTA",
          description: service?.name || "Consulta",
          doctor: professional?.name || "Profissional",
          sector: specialtyLabel,
        }],
      }

      return {
        id: guide.id,
        issuedAt: guide.issued_at,
        valid,
        appointmentStatus: appointment?.status ?? null,
        startsAt: appointment?.starts_at ?? null,
        patient: patient ? { id: patient.id, name: patient.name, cpf: patient.cpf, birthDate: patient.birth_date } : null,
        professional: professional?.name || "Profissional",
        service: service?.name || "Procedimento",
        paymentStatus: payment?.status || "indisponível",
        guideInput,
      }
    }),
  })
}
```

- [ ] **Step 4: Executar teste para verificar que passa**

Run: `npx vitest run tests/unit/desktop-guides-api.test.ts`
Expected: PASS com todos os testes passando.

- [ ] **Step 5: Commit da Task 2**

```bash
git add src/app/api/desktop/guides/route.ts tests/unit/desktop-guides-api.test.ts
git commit -m "feat(api): enrich desktop guides route with complete AuthorizationGuideInput"
```

---

### Task 3: Componente `GuideExportDialog` para Pré-visualização e Exportação

**Files:**
- Create: `src/components/desktop/guide-export-dialog.tsx`
- Create: `tests/unit/guide-export-dialog.test.tsx`

**Interfaces:**
- Consumes: `createAuthorizationGuide`, `downloadBlob`, `printAuthorizationGuide`, `guideCredentials` de `@/lib/authorization-guide`.
- Produces: `GuideExportDialog({ open, onOpenChange, guide })`.

- [ ] **Step 1: Escrever teste unitário para `GuideExportDialog`**

Criar `tests/unit/guide-export-dialog.test.tsx`:
```tsx
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { GuideExportDialog } from "@/components/desktop/guide-export-dialog"
import * as authGuide from "@/lib/authorization-guide"

describe("GuideExportDialog", () => {
  const mockGuide = {
    id: "f83b2a1a-463d-4c42-b065-ef7f225d3df1",
    issuedAt: "2026-10-31T14:00:00Z",
    valid: true,
    appointmentStatus: "confirmed",
    startsAt: "2026-11-01T10:00:00Z",
    patient: { id: "p1", name: "Maria Silva", cpf: "123.456.789-00", birthDate: "1990-05-15" },
    professional: "Dr. Carlos",
    service: "Consulta Clínica",
    paymentStatus: "paid",
    guideInput: {
      reference: "f83b2a1a-463d-4c42-b065-ef7f225d3df1",
      authorizedAt: "2026-10-31T14:00:00Z",
      patient: { name: "Maria Silva", cpf: "123.456.789-00", birthDate: "1990-05-15" },
      clinic: { name: "CuidarSaude", phone: "(85) 3000-0000", address: "Rua Teste, 1", city: "Fortaleza/CE" },
      appointmentAt: "2026-11-01T10:00:00Z",
      professional: {
        name: "Dr. Carlos",
        specialtyLabel: "Clínica geral",
        credentialLabel: "CRM",
        credentialCode: "12345",
        location: "Sala 1",
        startHour: "08:00",
        endHour: "18:00",
      },
      serviceName: "Consulta Clínica",
    },
  }

  it("renderiza modal fechado quando open for false", () => {
    const { container } = render(<GuideExportDialog open={false} onOpenChange={() => {}} guide={null} />)
    expect(container.firstChild).toBeNull()
  })

  it("gera pré-visualização e dispara download ao clicar no botão baixar", async () => {
    const fakeBlob = new Blob(["test"], { type: "image/png" })
    vi.spyOn(authGuide, "createAuthorizationGuide").mockResolvedValue(fakeBlob)
    const downloadSpy = vi.spyOn(authGuide, "downloadBlob").mockImplementation(() => {})
    global.URL.createObjectURL = vi.fn(() => "blob:http://localhost/mock-url")
    global.URL.revokeObjectURL = vi.fn()

    render(<GuideExportDialog open={true} onOpenChange={() => {}} guide={mockGuide} />)

    expect(screen.getByText(/Exportar Guia de Autorização/i)).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Baixar imagem \(PNG\)/i })).not.toBeDisabled()
    })

    const downloadBtn = screen.getByRole("button", { name: /Baixar imagem \(PNG\)/i })
    fireEvent.click(downloadBtn)
    expect(downloadSpy).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Executar teste para verificar que falha**

Run: `npx vitest run tests/unit/guide-export-dialog.test.tsx`
Expected: FAIL informando que `@/components/desktop/guide-export-dialog` não existe.

- [ ] **Step 3: Implementar `GuideExportDialog` em `src/components/desktop/guide-export-dialog.tsx`**

Criar `src/components/desktop/guide-export-dialog.tsx`:
```tsx
"use client"

import { useEffect, useState } from "react"
import { Download, Printer, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  createAuthorizationGuide,
  downloadBlob,
  guideCredentials,
  printAuthorizationGuide,
  type AuthorizationGuideInput,
} from "@/lib/authorization-guide"

export type GuideDialogItem = {
  id: string
  issuedAt: string
  valid: boolean
  appointmentStatus: string | null
  startsAt: string | null
  patient: { id: string; name: string; cpf: string; birthDate?: string } | null
  professional: string
  service: string
  paymentStatus: string
  guideInput?: AuthorizationGuideInput
}

interface GuideExportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  guide: GuideDialogItem | null
}

export function GuideExportDialog({ open, onOpenChange, guide }: GuideExportDialogProps) {
  const [blob, setBlob] = useState<Blob | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [printing, setPrinting] = useState(false)

  const credentials = guide ? guideCredentials(guide.id) : null

  useEffect(() => {
    if (!open || !guide) {
      setBlob(null)
      setPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev)
        return null
      })
      return
    }

    let active = true
    let createdUrl: string | null = null
    setGenerating(true)

    const guideInput: AuthorizationGuideInput = guide.guideInput || {
      reference: guide.id,
      authorizedAt: guide.issuedAt,
      patient: {
        name: guide.patient?.name || "Paciente",
        cpf: guide.patient?.cpf || "",
        birthDate: guide.patient?.birthDate || "2000-01-01",
      },
      clinic: {
        name: "CuidarSaude",
        phone: "(85) 3000-0000",
        address: "Rua Exemplo, 123",
        city: "Fortaleza/CE",
      },
      appointmentAt: guide.startsAt || guide.issuedAt,
      professional: {
        name: guide.professional,
        specialtyLabel: "Clínica geral",
        credentialLabel: "CRM",
        credentialCode: "0000",
        location: "Clínica CuidarSaude",
        startHour: "08:00",
        endHour: "18:00",
      },
      serviceName: guide.service,
    }

    createAuthorizationGuide(guideInput)
      .then((generatedBlob) => {
        if (!active) return
        createdUrl = URL.createObjectURL(generatedBlob)
        setBlob(generatedBlob)
        setPreviewUrl(createdUrl)
      })
      .catch(() => {
        if (active) toast.error("Não foi possível gerar a imagem da guia.")
      })
      .finally(() => {
        if (active) setGenerating(false)
      })

    return () => {
      active = false
      if (createdUrl) URL.revokeObjectURL(createdUrl)
    }
  }, [open, guide])

  const handleDownload = () => {
    if (!blob || !credentials) return
    downloadBlob(blob, `guia-cuidarsaude-${credentials.number}.png`)
    toast.success("Download da guia iniciado.")
  }

  const handlePrint = async () => {
    if (!blob || !credentials) return
    setPrinting(true)
    try {
      await printAuthorizationGuide(blob, `Guia ${credentials.number} - CuidarSaude`)
    } catch {
      toast.error("Não foi possível acionar a impressão.")
    } finally {
      setPrinting(false)
    }
  }

  if (!guide) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <div className="flex flex-wrap items-center justify-between gap-2 pr-6">
            <DialogTitle className="text-xl">Exportar Guia de Autorização</DialogTitle>
            <span
              className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                guide.valid ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"
              }`}
            >
              {guide.valid ? "Guia Válida" : "Guia Não Válida"}
            </span>
          </div>
          <DialogDescription>
            {guide.patient?.name ? `Paciente: ${guide.patient.name} · ` : ""}
            {credentials ? `Guia nº ${credentials.number} (senha: ${credentials.password})` : `ID: ${guide.id}`}
          </DialogDescription>
        </DialogHeader>

        <div className="my-2 flex min-h-64 flex-col items-center justify-center rounded-xl border bg-muted/30 p-3">
          {generating ? (
            <div className="flex flex-col items-center gap-2 py-12 text-sm text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin text-teal" />
              <p>Gerando guia oficial em alta resolução...</p>
            </div>
          ) : previewUrl ? (
            <div className="w-full max-w-lg overflow-hidden rounded-lg border bg-white shadow-sm">
              <img
                src={previewUrl}
                alt={`Guia de autorização ${credentials?.number || guide.id}`}
                className="w-full object-contain"
              />
            </div>
          ) : (
            <p className="text-sm text-destructive">Falha ao carregar a pré-visualização.</p>
          )}
        </div>

        <DialogFooter className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={!blob || generating || printing}
            onClick={handlePrint}
            className="gap-1.5"
          >
            {printing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
            Imprimir / Salvar PDF
          </Button>
          <Button
            type="button"
            disabled={!blob || generating}
            onClick={handleDownload}
            className="gap-1.5 bg-teal text-white hover:bg-teal/90"
          >
            <Download className="h-4 w-4" />
            Baixar imagem (PNG)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 4: Executar teste para verificar que passa**

Run: `npx vitest run tests/unit/guide-export-dialog.test.tsx`
Expected: PASS com 2 testes aprovados.

- [ ] **Step 5: Commit da Task 3**

```bash
git add src/components/desktop/guide-export-dialog.tsx tests/unit/guide-export-dialog.test.tsx
git commit -m "feat(desktop): create GuideExportDialog for previewing, printing and downloading guides"
```

---

### Task 4: Integrar Botão de Exportação na Tela de Guias (`GuidesView`) e Validação Completa

**Files:**
- Modify: `src/components/desktop/guides-view.tsx`
- Create: `tests/unit/desktop-guides-view.test.tsx`

**Interfaces:**
- Consumes: `GuideExportDialog` e tipo `GuideDialogItem`.

- [ ] **Step 1: Escrever teste de integração de `GuidesView` com o botão de exportar**

Criar `tests/unit/desktop-guides-view.test.tsx`:
```tsx
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { describe, expect, it, vi, beforeEach } from "vitest"
import { GuidesView } from "@/components/desktop/guides-view"

describe("GuidesView Export Action", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("exibe o botão 'Exportar guia' em cada cartão e abre a modal ao clicar", async () => {
    const mockGuides = [
      {
        id: "guide-test-1",
        issuedAt: "2026-10-31T12:00:00Z",
        valid: true,
        appointmentStatus: "confirmed",
        startsAt: "2026-11-01T09:00:00Z",
        patient: { id: "p1", name: "João Paciente", cpf: "111.222.333-44" },
        professional: "Dra. Joana",
        service: "Consulta Cardiologia",
        paymentStatus: "paid",
      },
    ]

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ guides: mockGuides }),
    })

    render(<GuidesView />)

    await waitFor(() => {
      expect(screen.getByText(/João Paciente/i)).toBeInTheDocument()
    })

    const exportBtn = screen.getByRole("button", { name: /Exportar guia/i })
    expect(exportBtn).toBeInTheDocument()

    fireEvent.click(exportBtn)

    await waitFor(() => {
      expect(screen.getByText(/Exportar Guia de Autorização/i)).toBeInTheDocument()
    })
  })
})
```

- [ ] **Step 2: Executar teste para verificar que falha**

Run: `npx vitest run tests/unit/desktop-guides-view.test.tsx`
Expected: FAIL informando que o botão "Exportar guia" não existe no DOM.

- [ ] **Step 3: Modificar `src/components/desktop/guides-view.tsx`**

Integrar `GuideExportDialog` e o botão em cada artigo da listagem em `src/components/desktop/guides-view.tsx`:
- Importar `Download` de `lucide-react` e `GuideExportDialog, type GuideDialogItem` de `@/components/desktop/guide-export-dialog`.
- Adicionar estado `const [exportGuide, setExportGuide] = useState<GuideDialogItem | null>(null)`.
- Atualizar tipo `Guide` para estender `GuideDialogItem`.
- Adicionar no rodapé de cada `<article>`:
```tsx
<div className="pt-2 flex justify-end">
  <Button
    type="button"
    variant="outline"
    size="sm"
    className="gap-1.5 text-xs h-8"
    onClick={() => setExportGuide(guide)}
  >
    <Download className="h-3.5 w-3.5" />
    Exportar guia
  </Button>
</div>
```
- E logo antes do fechamento da `<div>` principal:
```tsx
<GuideExportDialog
  open={Boolean(exportGuide)}
  onOpenChange={(open) => { if (!open) setExportGuide(null) }}
  guide={exportGuide}
/>
```

- [ ] **Step 4: Executar os testes unitários para verificar que passam**

Run: `npx vitest run tests/unit/desktop-guides-view.test.tsx`
Expected: PASS.

- [ ] **Step 5: Executar a suíte completa de testes unitários e build de validação**

Run: `npm run test:unit`
Run: `npm run build`
Expected: Todos os testes passando e build Next.js 16 compilado com sucesso sem erros de tipagem.

- [ ] **Step 6: Commit da Task 4**

```bash
git add src/components/desktop/guides-view.tsx tests/unit/desktop-guides-view.test.tsx
git commit -m "feat(desktop): integrate guide export button and dialog into GuidesView"
```
