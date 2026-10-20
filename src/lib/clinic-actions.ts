"use server"

import { connection } from "next/server"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import {
  CLINIC_COOKIE,
  CLINIC_COOKIE_MAX_AGE,
  clinicCookieOptions,
  clinicCredentialsMatch,
  createClinicToken,
  verifyClinicToken,
} from "@/lib/clinic-token"

export type ClinicLoginState = { error?: string }

export async function loginClinic(_state: ClinicLoginState, formData: FormData): Promise<ClinicLoginState> {
  const email = String(formData.get("email") ?? "")
  const password = String(formData.get("password") ?? "")
  if (email.length > 120 || password.length === 0 || password.length > 128) {
    return { error: "E-mail ou senha da clínica não conferem." }
  }
  if (!(await clinicCredentialsMatch(email, password))) {
    return { error: "E-mail ou senha da clínica não conferem." }
  }

  const expiresAt = Date.now() + CLINIC_COOKIE_MAX_AGE * 1000
  const jar = await cookies()
  jar.set(CLINIC_COOKIE, await createClinicToken(expiresAt), clinicCookieOptions())
  redirect("/desktop")
}

export async function logoutClinic() {
  const jar = await cookies()
  jar.set(CLINIC_COOKIE, "", { ...clinicCookieOptions(), maxAge: 0 })
  redirect("/desktop/entrar")
}

export async function clinicGate() {
  await connection()
  const token = (await cookies()).get(CLINIC_COOKIE)?.value
  if (!(await verifyClinicToken(token, Date.now()))) redirect("/desktop/entrar")
}
