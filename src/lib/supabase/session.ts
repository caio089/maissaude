import "server-only"

import { NextResponse, type NextRequest } from "next/server"
import { createServerClient } from "@supabase/ssr"

import type { AuthRole } from "@/lib/auth/constants"
import { isSupabaseBrowserConfigured, requireSupabasePublicEnv } from "@/lib/supabase/env"

export type AuthClaims = {
  sub?: string
  email?: string
  app_metadata?: { role?: string }
}

export async function updateAuthSession(request: NextRequest) {
  let response = NextResponse.next({ request })
  if (!isSupabaseBrowserConfigured()) {
    return { response, role: null as AuthRole | null }
  }

  const { url, key } = requireSupabasePublicEnv()
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value)
        })
        response = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options)
        })
        Object.entries(headers).forEach(([header, value]) => {
          response.headers.set(header, value)
        })
      },
    },
  })

  const { data } = await supabase.auth.getClaims()
  const role = (data?.claims as AuthClaims | undefined)?.app_metadata?.role
  return {
    response,
    role: role === "clinic" || role === "patient" ? (role as AuthRole) : null,
  }
}

export function copyAuthCookies(from: NextResponse, to: NextResponse) {
  from.cookies.getAll().forEach((cookie) => {
    to.cookies.set(cookie)
  })
  for (const header of ["cache-control", "expires", "pragma"]) {
    const value = from.headers.get(header)
    if (value) to.headers.set(header, value)
  }
  return to
}

