import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { CLINIC_COOKIE, verifyClinicToken } from "@/lib/clinic-token"

const LOGIN_PATH = "/desktop/entrar"

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const session = await verifyClinicToken(request.cookies.get(CLINIC_COOKIE)?.value, Date.now())

  if (pathname === LOGIN_PATH) {
    if (session) return NextResponse.redirect(new URL("/desktop", request.url))
    return NextResponse.next()
  }

  if (!session) return NextResponse.redirect(new URL(LOGIN_PATH, request.url))
  return NextResponse.next()
}

export const config = {
  matcher: ["/desktop", "/desktop/:path*"],
}
