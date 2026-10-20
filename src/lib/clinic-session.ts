import { connection } from "next/server"
import { cookies } from "next/headers"
import { CLINIC_COOKIE, verifyClinicToken } from "@/lib/clinic-token"

export async function hasClinicSession() {
  await connection()
  const token = (await cookies()).get(CLINIC_COOKIE)?.value
  return verifyClinicToken(token, Date.now())
}
