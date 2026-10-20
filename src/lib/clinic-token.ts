const text = new TextEncoder()

/** Cookie só da equipe. A conta do paciente não grava nem lê este valor. */
export const CLINIC_COOKIE = "cuidar_clinica"
export const CLINIC_COOKIE_MAX_AGE = 60 * 60 * 12

const CLINIC_EMAIL = "clinica@demonstracao.demo"
const CLINIC_PASSWORD_HASH = "204fbc1887a3fedc68cdc5f761984a196a26e9e3f0b1e6312d12dfee6938df9a"

function sessionSecret() {
  return process.env.CLINIC_SESSION_SECRET || "cuidar-saude-painel-demo-v1"
}

export function clinicCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/desktop",
    maxAge: CLINIC_COOKIE_MAX_AGE,
  }
}

export async function clinicCredentialsMatch(email: string, password: string) {
  const normalizedEmail = email.trim().toLowerCase()
  const emailMatches = safeEqual(normalizedEmail, CLINIC_EMAIL)
  const passwordHash = await sha256(`cuidar-saude-clinica|${password}`)
  const passwordMatches = safeEqual(passwordHash, CLINIC_PASSWORD_HASH)
  return emailMatches && passwordMatches
}

export async function createClinicToken(expiresAt: number) {
  const payload = `clinic:${expiresAt}`
  return `${payload}.${await sign(payload)}`
}

export async function verifyClinicToken(token: string | undefined, now: number) {
  if (!token) return false
  const splitAt = token.lastIndexOf(".")
  if (splitAt <= 0) return false
  const payload = token.slice(0, splitAt)
  const signature = token.slice(splitAt + 1)
  if (!payload.startsWith("clinic:")) return false
  const expiresAt = Number(payload.slice("clinic:".length))
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= now) return false
  if (expiresAt > now + CLINIC_COOKIE_MAX_AGE * 1000 + 60_000) return false
  return safeEqual(signature, await sign(payload))
}

async function sign(value: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    text.encode(sessionSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  )
  const signature = await crypto.subtle.sign("HMAC", key, text.encode(value))
  return toHex(signature)
}

async function sha256(value: string) {
  return toHex(await crypto.subtle.digest("SHA-256", text.encode(value)))
}

function toHex(buffer: ArrayBuffer) {
  return Array.from(new Uint8Array(buffer), (byte) => byte.toString(16).padStart(2, "0")).join("")
}

function safeEqual(left: string, right: string) {
  const length = Math.max(left.length, right.length)
  let diff = left.length ^ right.length
  for (let index = 0; index < length; index += 1) {
    diff |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0)
  }
  return diff === 0
}
