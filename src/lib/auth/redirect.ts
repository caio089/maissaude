import "server-only"

const FALLBACK = "/auth/atualizar-senha"
const ALLOWED = new Set(["/auth/atualizar-senha", "/mobile", "/desktop"])

export function safeAuthNext(value: string | null) {
  if (!value) return FALLBACK
  let decoded = value
  try {
    decoded = decodeURIComponent(value)
  } catch {
    return FALLBACK
  }
  if (decoded !== decoded.trim()) return FALLBACK
  if (!ALLOWED.has(decoded)) return FALLBACK
  return decoded
}
