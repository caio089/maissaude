import "server-only"

export type AsaasEnvironment = "sandbox" | "production"

const SANDBOX_ORIGIN = "https://api-sandbox.asaas.com"
const PRODUCTION_ORIGIN = "https://api.asaas.com"

export function asaasEnvironment(): AsaasEnvironment {
  return process.env.ASAAS_ENV === "production" ? "production" : "sandbox"
}

export function asaasBaseUrl() {
  return asaasEnvironment() === "production" ? PRODUCTION_ORIGIN : SANDBOX_ORIGIN
}

export function asaasUserAgent() {
  const agent = process.env.ASAAS_USER_AGENT?.trim()
  return agent && agent.length > 0 ? agent : "CuidarSaude/1.0"
}

export function asaasApiKey() {
  return process.env.ASAAS_API_KEY?.trim() || ""
}

export function asaasWebhookToken() {
  return process.env.ASAAS_WEBHOOK_TOKEN?.trim() || ""
}

export function isAsaasConfigured() {
  const key = asaasApiKey()
  return key.startsWith("$aact_")
}

export function isAsaasWebhookConfigured() {
  const token = asaasWebhookToken()
  return token.length >= 32 && token.length <= 255
}
