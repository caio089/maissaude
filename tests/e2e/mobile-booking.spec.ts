import { expect, test, type Page } from "@playwright/test"
import { TEST_PATIENT, TEST_PROFESSIONALS, testData } from "../fixtures/mobile"

const STORAGE_KEY = "cuidar-saude-demo-v1"
const browserErrors = new WeakMap<Page, string[]>()

test.beforeEach(async ({ page }) => {
  const errors: string[] = []
  browserErrors.set(page, errors)
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text())
  })
  page.on("pageerror", (error) => errors.push(error.message))
})

test.afterEach(async ({ page }) => {
  expect(browserErrors.get(page) ?? []).toEqual([])
})

function localDateKey() {
  const now = new Date()
  const offset = now.getTimezoneOffset() * 60_000
  return new Date(now.getTime() - offset).toISOString().slice(0, 10)
}

async function openAsPatient(page: Page, professionals = TEST_PROFESSIONALS) {
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
      body: JSON.stringify({ professionals }),
    })
  })
  await page.goto("/mobile")
  await expect(page.getByRole("heading", { name: "O que você quer agendar?" })).toBeVisible()
}

test.describe("novo fluxo de agendamento mobile", () => {
  test("agenda consulta presencial até a revisão sem criar cobrança", async ({ page }) => {
    let paymentRequests = 0
    page.on("request", (request) => {
      if (request.url().includes("/api/payments/")) paymentRequests += 1
    })
    await openAsPatient(page)

    await page.getByTestId("booking-kind-consulta").click()
    await expect(page.getByRole("heading", { name: "Como quer ser atendido?" })).toBeVisible()
    await page.getByRole("button", { name: /Consulta presencial/ }).click()

    await expect(page.getByRole("heading", { name: "Escolha o médico" })).toBeVisible()
    await expect(page.getByText("1 opção disponível")).toBeVisible()
    await page.getByTestId("booking-offer").first().click()

    await expect(page.getByRole("heading", { name: "Escolha dia e horário" })).toBeVisible()
    await page.locator('[data-testid="booking-date"]:not([disabled])').first().click()
    await page.getByTestId("booking-time").first().click()
    await expect(page.getByText("Seu horário")).toBeVisible()
    await page.getByRole("button", { name: "Escolher este horário" }).click()

    await expect(page.getByText("1 agendamento")).toBeVisible()
    await page.getByRole("button", { name: "Continuar" }).click()
    await expect(page.getByRole("heading", { name: "Confirme o pedido" })).toBeVisible()
    await expect(page.getByRole("button", { name: "Confirmar e pagar" })).toBeEnabled()
    expect(paymentRequests).toBe(0)
  })

  test("mostra somente a teleconsulta ao escolher atendimento por vídeo", async ({ page }) => {
    await openAsPatient(page)

    await page.getByTestId("booking-kind-consulta").click()
    await page.getByRole("button", { name: /Consulta por vídeo/ }).click()

    await expect(page.getByRole("heading", { name: "Escolha o médico" })).toBeVisible()
    await expect(page.getByText("Consulta por vídeo")).toBeVisible()
    await expect(page.getByText("1 opção disponível")).toBeVisible()
    await expect(page.getByTestId("booking-offer")).toContainText("Dra. Ana Teste")
  })

  test("permite abrir os horários diretamente pelo médico", async ({ page }) => {
    await openAsPatient(page)

    await page.getByTestId("direct-professional").first().click()

    await expect(page.getByRole("heading", { name: "Escolha dia e horário" })).toBeVisible()
    await expect(page.getByText("Dra. Ana Teste")).toBeVisible()
    await expect(page.locator('[data-testid="booking-date"]:not([disabled])').first()).toBeVisible()
  })

  test("mostra no acesso direto o médico que possui somente exame", async ({ page }) => {
    const examOnly = [{
      ...TEST_PROFESSIONALS[0],
      name: "Dr. José Exames",
      services: [TEST_PROFESSIONALS[0].services.find((service) => service.kind === "exame")!],
    }]
    await openAsPatient(page, examOnly)

    await expect(page.getByTestId("direct-professional")).toContainText("Dr. José Exames")
    await expect(page.getByTestId("direct-professional")).toContainText("Avaliação clínica")
    await page.getByTestId("direct-professional").click()

    await expect(page.getByRole("heading", { name: "Escolha dia e horário" })).toBeVisible()
    await expect(page.getByText("Avaliação clínica")).toBeVisible()
  })

  test("confere associação e permite pagar com cartão pela Asaas", async ({ page }) => {
    let paymentBody: { billingType?: string; associateAnswer?: string } | null = null
    await page.route("**/api/payments/cart/quote", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          associate: { active: false, discountPercent: 0, fee: 49.9 },
          lines: [{ serviceId: "svc-consulta-presencial", listPrice: 120, amount: 120 }],
          listTotal: 120,
          total: 120,
          discount: 0,
        }),
      })
    })
    await page.route("**/api/payments/cart", async (route) => {
      paymentBody = route.request().postDataJSON() as { billingType?: string; associateAnswer?: string }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          charges: [{ value: 120, billingType: "CREDIT_CARD", invoiceUrl: "https://asaas.example/fatura", pix: null, pixUnavailable: false }],
        }),
      })
    })
    await openAsPatient(page)

    await page.getByTestId("booking-kind-consulta").click()
    await page.getByRole("button", { name: /Consulta presencial/ }).click()
    await page.getByTestId("booking-offer").first().click()
    await page.locator('[data-testid="booking-date"]:not([disabled])').first().click()
    await page.getByTestId("booking-time").first().click()
    await page.getByRole("button", { name: "Escolher este horário" }).click()
    await page.getByRole("button", { name: "Continuar" }).click()
    await page.getByRole("button", { name: "Confirmar e pagar" }).click()

    await expect(page.getByRole("heading", { name: "Você é associado?" })).toBeVisible()
    await page.getByRole("button", { name: "Ainda não" }).click()
    await expect(page.getByTestId("payment-method-pix")).toBeVisible()
    await page.getByTestId("payment-method-card").click()
    await page.getByRole("button", { name: "Continuar para o cartão" }).click()

    await expect(page.getByRole("link", { name: "Pagar com cartão na Asaas" })).toHaveAttribute("href", "https://asaas.example/fatura")
    expect(paymentBody).toMatchObject({ billingType: "CREDIT_CARD", associateAnswer: "no" })
  })
})
