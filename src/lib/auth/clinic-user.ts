import "server-only"

import { CLINIC_AUTH_EMAIL } from "@/lib/auth/constants"
import { createSupabaseAdmin, isSupabaseAdminConfigured } from "@/lib/supabase/admin"

const CLINIC_PASSWORD = "CuidarClinica900"

export async function ensureClinicAuthUser() {
  if (!isSupabaseAdminConfigured()) return { ok: false as const, message: "Service role do Supabase ainda não foi configurada." }
  const admin = createSupabaseAdmin()
  if (!admin) return { ok: false as const, message: "Service role do Supabase ainda não foi configurada." }

  const { error } = await admin.auth.admin.createUser({
    email: CLINIC_AUTH_EMAIL,
    password: CLINIC_PASSWORD,
    email_confirm: true,
    app_metadata: { role: "clinic" },
  })

  if (error && !isAlreadyRegistered(error.message)) {
    return { ok: false as const, message: error.message }
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
  }

  return { ok: true as const }
}

async function findUserIdByEmail(email: string) {
  const admin = createSupabaseAdmin()
  if (!admin) return null
  const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 })
  return data.users.find((user) => user.email?.toLowerCase() === email.toLowerCase())?.id ?? null
}

function isAlreadyRegistered(message: string) {
  const text = message.toLowerCase()
  return text.includes("already") || text.includes("registered") || text.includes("exists")
}
