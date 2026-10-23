import { cookies } from "next/headers"
import { currentAuthRole } from "@/lib/auth/role"
import { CLINIC_COOKIE, verifyClinicToken } from "@/lib/clinic-token"

export async function hasClinicSession() {
  if ((await currentAuthRole()) === "clinic") return true
  const token = (await cookies()).get(CLINIC_COOKIE)?.value
  return verifyClinicToken(token, Date.now())
}
