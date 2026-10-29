import { expect, test } from "@playwright/test"
import { CLINIC_AUTH_EMAIL } from "../../src/lib/auth/constants"

test.describe("proteção de rotas e login", () => {
  test("rotas clínicas recusam acesso sem sessão", async ({ request }) => {
    const consultations = await request.get("/api/desktop/consultations")
    const patients = await request.get("/api/desktop/patients")
    const associate = await request.post("/api/payments/associate", { data: {} })

    expect(consultations.status()).toBe(401)
    expect(patients.status()).toBe(401)
    expect(associate.status()).toBe(401)
  })

  test("rotas do paciente recusam acesso sem sessão", async ({ request }) => {
    const catalog = await request.get("/api/mobile/catalog")
    const cart = await request.post("/api/payments/cart", { data: { lines: [] } })
    const quote = await request.post("/api/payments/cart/quote", { data: { lines: [] } })
    const subscription = await request.post("/api/payments/subscription")

    expect(catalog.status()).toBe(401)
    expect(cart.status()).toBe(401)
    expect(quote.status()).toBe(401)
    expect(subscription.status()).toBe(401)
  })

  test("painel redireciona para login simples", async ({ page }) => {
    await page.goto("/desktop/consultas")

    await expect(page).toHaveURL(/\/desktop\/entrar$/)
    await expect(page.getByLabel("E-mail da equipe")).toHaveValue(CLINIC_AUTH_EMAIL)
    await expect(page.getByLabel("E-mail da equipe")).toHaveAttribute("readonly", "")
    await expect(page.getByLabel("Senha")).toBeFocused()
  })

  test("login do paciente permite mostrar a senha", async ({ page }) => {
    await page.goto("/mobile")
    await expect(page.getByLabel("CPF")).toBeFocused()
    await page.getByRole("button", { name: "Já tenho conta" }).click()

    await page.getByLabel("CPF").fill("52998224725")
    await page.getByLabel("Senha", { exact: true }).fill("senha-segura")
    await page.getByRole("button", { name: "Mostrar senha" }).click()
    await expect(page.getByLabel("Senha", { exact: true })).toHaveAttribute("type", "text")
  })
})
