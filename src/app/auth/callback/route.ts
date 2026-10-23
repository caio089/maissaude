import { NextResponse } from "next/server"

import { requestOrigin } from "@/lib/auth/origin"
import { safeAuthNext } from "@/lib/auth/redirect"
import { createServerSupabase } from "@/lib/supabase/server"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const origin = await requestOrigin()
  if (!origin) {
    return new NextResponse("NEXT_PUBLIC_SITE_URL precisa estar definida em produção.", { status: 503 })
  }
  const code = searchParams.get("code")
  const next = safeAuthNext(searchParams.get("next"))

  if (code) {
    const supabase = await createServerSupabase()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) return NextResponse.redirect(`${origin}${next}`)
  }

  return NextResponse.redirect(`${origin}/auth/erro`)
}
