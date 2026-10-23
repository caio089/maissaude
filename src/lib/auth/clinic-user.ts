import "server-only"

import { CLINIC_AUTH_EMAIL } from "@/lib/auth/constants"
import { hmacClinicFallbackEnabled } from "@/lib/runtime"
import { createSupabaseAdmin, isSupabaseAdminConfigured } from "@/lib/supabase/admin"

export async function ensureClinicAuthUser() {
  if (!hmacClinicFallbackEnabled()) {
    return { ok: false as const, message: "O seed da clínica só roda em desenvolvimento." }
  }
  if (!isSupabaseAdminConfigured()) {
    return { ok: false as const, message: "Service role do Supabase ainda não foi configurada." }
  }
  const admin = createSupabaseAdmin()
  if (!admin) return { ok: false as const, message: "Service role do Supabase ainda não foi configurada." }

  const password = process.env.CLINIC_DEMO_PASSWORD?.trim() || "CuidarClinica900"
  if (password) {
    const { error } = await admin.auth.admin.createUser({
      email: CLINIC_AUTH_EMAIL,
      password,
      email_confirm: true,
      app_metadata: { role: "clinic" },
    })
    if (error && !isAlreadyRegistered(error.message)) {
      return { ok: false as const, message: error.message }
    }
  }

  const userId = await findUserIdByEmail(CLINIC_AUTH_EMAIL)
  if (userId) {
    await admin.auth.admin.updateUserById(userId, {
      app_metadata: { role: "clinic" },
      email_confirm: true,
    })
    await admin.from("profiles").upsert({
      id: userId,
      role: "clinic",
      email: CLINIC_AUTH_EMAIL,
      updated_at: new Date().toISOString(),
    })
    return { ok: true as const }
  }

  if (!password) {
    return {
      ok: false as const,
      message: "Defina CLINIC_DEMO_PASSWORD no .env.local para criar a conta da clínica em desenvolvimento.",
    }
  }
  return { ok: false as const, message: "Não foi possível localizar a conta da clínica no Auth." }
}

async function findUserIdByEmail(email: string) {
  const admin = createSupabaseAdmin()
  if (!admin) return null
  const target = email.toLowerCase()
  for (let page = 1; page <= 20; page += 1) {
    const { data } = await admin.auth.admin.listUsers({ page, perPage: 200 })
    const found = data.users.find((user) => user.email?.toLowerCase() === target)?.id
    if (found) return found
    if (data.users.length < 200) break
  }
  return null
}

function isAlreadyRegistered(message: string) {
  const text = message.toLowerCase()
  return text.includes("already") || text.includes("registered") || text.includes("exists")
}
