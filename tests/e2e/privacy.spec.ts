import { expect, test } from "@playwright/test"
import { TEST_PATIENT, TEST_PROFESSIONALS, testData } from "../fixtures/mobile"

const STORAGE_KEY = "cuidar-saude-demo-v1"

function localDateKey() {
  const now = new Date()
  const offset = now.getTimezoneOffset() * 60_000
  return new Date(now.getTime() - offset).toISOString().slice(0, 10)
}

test("protege o CPF e limpa os dados pessoais ao sair do mobile", async ({ page }) => {
  const data = testData(localDateKey())
  await page.addInitScript(
    ({ key, persisted }) => localStorage.setItem(key, JSON.stringify(persisted)),
    {
      key: STORAGE_KEY,
      persisted: {
        state: {
          data,
          mobileSessionPatientId: TEST_PATIENT.id,
          mobileAccounts: [{ cpf: TEST_PATIENT.cpf, patientId: TEST_PATIENT.id, passwordHash: "legacy-test-only" }],
        },
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

  await page.goto("/mobile/perfil")
  await expect(page.getByText("***.***.***-25")).toBeVisible()
  await expect(page.getByText(TEST_PATIENT.cpf, { exact: true })).toHaveCount(0)

  await page.getByRole("button", { name: "Sair da conta" }).click()
  await expect(page.getByRole("heading", { name: "Crie sua conta para continuar" })).toBeVisible()

  const persisted = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) || "null"), STORAGE_KEY) as {
    state: { mobileSessionPatientId: string | null; mobileAccounts: unknown[]; data: { patients: Array<{ id: string }> } }
  }
  expect(persisted.state.mobileSessionPatientId).toBeNull()
  expect(persisted.state.mobileAccounts).toEqual([])
  expect(persisted.state.data.patients.some((patient) => patient.id === TEST_PATIENT.id)).toBe(false)
})
