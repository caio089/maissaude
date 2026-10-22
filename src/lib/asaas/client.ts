import "server-only"

import {
  asaasApiKey,
  asaasBaseUrl,
  asaasUserAgent,
  isAsaasConfigured,
} from "@/lib/asaas/config"

export class AsaasNotConfiguredError extends Error {
  constructor() {
    super("Asaas ainda não está configurada. Preencha ASAAS_API_KEY no .env.local.")
    this.name = "AsaasNotConfiguredError"
  }
}

export class AsaasRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message)
    this.name = "AsaasRequestError"
  }
}

type AsaasErrorBody = {
  errors?: Array<{ code?: string; description?: string }>
}

export async function asaasFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!isAsaasConfigured()) throw new AsaasNotConfiguredError()

  const headers = new Headers(init.headers)
  headers.set("access_token", asaasApiKey())
  headers.set("User-Agent", asaasUserAgent())
  headers.set("Accept", "application/json")
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json")
  }

  const response = await fetch(`${asaasBaseUrl()}/v3${path}`, {
    ...init,
    headers,
    cache: "no-store",
  })

  if (response.status === 204) return undefined as T

  const body = (await response.json().catch(() => null)) as T | AsaasErrorBody | null
  if (!response.ok) {
    const first = (body as AsaasErrorBody | null)?.errors?.[0]
    throw new AsaasRequestError(
      response.status,
      first?.code || "asaas_error",
      first?.description || `Asaas respondeu ${response.status}.`,
    )
  }

  return body as T
}
