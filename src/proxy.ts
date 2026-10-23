import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { CLINIC_COOKIE, verifyClinicToken } from "@/lib/clinic-token"
import { copyAuthCookies, updateAuthSession } from "@/lib/supabase/session"

const LOGIN_PATH = "/desktop/entrar"

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const { response, role } = await updateAuthSession(request)
  const hmacSession = await verifyClinicToken(request.cookies.get(CLINIC_COOKIE)?.value, Date.now())
  const clinicSession = role === "clinic" || hmacSession

  if (pathname === LOGIN_PATH) {
    if (clinicSession) {
      return copyAuthCookies(response, NextResponse.redirect(new URL("/desktop", request.url)))
    }
    return response
  }

  if (pathname.startsWith("/desktop")) {
    if (!clinicSession) {
      return copyAuthCookies(response, NextResponse.redirect(new URL(LOGIN_PATH, request.url)))
    }
  }

  if (pathname === "/api/asaas/status") {
    if (!clinicSession) {
      return copyAuthCookies(response, NextResponse.json({ error: "Não autorizado." }, { status: 401 }))
    }
  }

  if (pathname.startsWith("/auth/atualizar-senha")) {
    if (!role) {
      return copyAuthCookies(response, NextResponse.redirect(new URL("/auth/recuperar", request.url)))
    }
  }

  return response
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
}
