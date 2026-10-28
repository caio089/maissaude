import { createHmac } from "node:crypto"
import { expect, test, type Page } from "@playwright/test"
import { TEST_PATIENT, TEST_PROFESSIONALS, testData } from "../fixtures/mobile"

const STORAGE_KEY = "cuidar-saude-demo-v1"
const CLINIC_COOKIE = "cuidar_clinica"
const CLINIC_SECRET = "cuidarsaude-integration-tests-only"

function localDateKey() {
  const now = new Date()
  const offset = now.getTimezoneOffset() * 60_000
  return new Date(now.getTime() - offset).toISOString().slice(0, 10)
}

async function prepareMobile(page: Page) {
  const data = testData(localDateKey())
  await page.addInitScript(
    ({ key, persisted }) => localStorage.setItem(key, JSON.stringify(persisted)),
    {
      key: STORAGE_KEY,
      persisted: {
        state: { data, mobileSessionPatientId: TEST_PATIENT.id },
        version: 2,
      },
    },
  )
  await page.route("**/api/mobile/catalog", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ professionals: TEST_PROFESSIONALS }),
    })
  })
}

async function addClinicSession(page: Page) {
  const expiresAt = Date.now() + 60 * 60 * 1000
  const payload = `clinic:${expiresAt}`
  const signature = createHmac("sha256", CLINIC_SECRET).update(payload).digest("hex")
  await page.context().addCookies([
    {
      name: CLINIC_COOKIE,
      value: `${payload}.${signature}`,
      domain: "127.0.0.1",
      path: "/desktop",
      httpOnly: true,
      sameSite: "Lax",
    },
  ])
}

test("consulta criada no mobile aparece na lista do desktop", async ({ page }) => {
  const consoleErrors: string[] = []
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text())
  })
  page.on("pageerror", (error) => consoleErrors.push(error.message))

  await prepareMobile(page)

  let appointment: {
    id: string
    patient_id: string
    professional_id: string
    service_id: string
    starts_at: string
    status: string
    payment_id: string
    origin: "mobile"
  } | null = null

  await page.route("**/api/payments/cart", async (route) => {
    const request = route.request()
    const body = request.postDataJSON() as {
      lines: Array<{ professionalId: string; serviceId: string; date: string; time: string }>
    }
    const line = body.lines[0]
    appointment = {
      id: "apt-integration-mobile-desktop",
      patient_id: TEST_PATIENT.id,
      professional_id: line.professionalId,
      service_id: line.serviceId,
      starts_at: new Date(`${line.date}T${line.time}:00-03:00`).toISOString(),
      status: "scheduled",
      payment_id: "pay-integration-mobile-desktop",
      origin: "mobile",
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        charges: [{
          appointmentId: appointment.id,
          paymentId: appointment.payment_id,
          value: 120,
          invoiceUrl: null,
          pix: { payload: "PIX-TESTE-SEM-COBRANCA", encodedImage: null },
        }],
      }),
    })
  })

  await page.goto("/mobile")
  await page.getByTestId("booking-kind-consulta").click()
  await page.getByRole("button", { name: /Consulta presencial/ }).click()
  await page.getByTestId("booking-offer").click()
  await page.locator('[data-testid="booking-date"]:not([disabled])').first().click()
  await page.getByTestId("booking-time").first().click()
  await page.getByRole("button", { name: "Escolher este horário" }).click()
  await page.getByRole("button", { name: "Continuar" }).click()
  await page.getByRole("button", { name: "Confirmar e pagar" }).click()
  await page.getByRole("button", { name: "Gerar Pix" }).click()

  await expect(page.getByRole("button", { name: "Copiar código Pix" })).toBeVisible()
  await expect.poll(() => appointment).not.toBeNull()
  expect(appointment).toMatchObject({
    patient_id: TEST_PATIENT.id,
    professional_id: TEST_PROFESSIONALS[0].id,
    service_id: "svc-consulta-presencial",
    status: "scheduled",
    origin: "mobile",
  })

  await page.route("**/api/desktop/consultations", async (route) => {
    if (!appointment) throw new Error("O mobile não criou o agendamento de teste.")
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        patients: [{
          id: TEST_PATIENT.id,
          name: TEST_PATIENT.name,
          cpf: TEST_PATIENT.cpf,
          phone: TEST_PATIENT.phone,
          email: TEST_PATIENT.email,
          status: TEST_PATIENT.status,
        }],
        professionals: TEST_PROFESSIONALS.map(({ id, name, active }) => ({ id, name, active })),
        services: TEST_PROFESSIONALS.flatMap((professional) => professional.services.map((service) => ({
          id: service.id,
          professional_id: professional.id,
          name: service.name,
          price: service.price,
          duration_min: service.durationMin,
          modality: service.modality,
        }))),
        appointments: [{
          id: appointment.id,
          patient_id: appointment.patient_id,
          professional_id: appointment.professional_id,
          service_id: appointment.service_id,
          starts_at: appointment.starts_at,
          status: appointment.status,
          payment_id: appointment.payment_id,
        }],
        payments: [{
          id: appointment.payment_id,
          status: "pending",
          amount: 120,
          method: "pix",
          invoice_url: null,
          pix_payload: "PIX-TESTE-SEM-COBRANCA",
        }],
      }),
    })
  })

  await addClinicSession(page)
  await page.goto("/desktop/consultas")

  await expect(page.getByRole("heading", { name: "Consultas", exact: true })).toBeVisible()
  const registered = page.getByRole("heading", { name: "Consultas registradas" }).locator("xpath=ancestor::section")
  await expect(registered).toContainText("Maria Teste · Dra. Ana Teste")
  await expect(registered).toContainText("Consulta")
  await expect(registered).toContainText("Pagamento: pendente")
  expect(consoleErrors).toEqual([])
})
