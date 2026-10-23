import { NextResponse } from "next/server"
import type { EmailOtpType } from "@supabase/supabase-js"

import { requestOrigin } from "@/lib/auth/origin"
import { safeAuthNext } from "@/lib/auth/redirect"
import { createServerSupabase } from "@/lib/supabase/server"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const origin = await requestOrigin()
  if (!origin) {
    return new NextResponse("NEXT_PUBLIC_SITE_URL precisa estar definida em produção.", { status: 503 })
  }
  const tokenHash = searchParams.get("token_hash")
  const type = searchParams.get("type") as EmailOtpType | null
  const next = safeAuthNext(searchParams.get("next"))

  if (tokenHash && type) {
    const supabase = await createServerSupabase()
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
    if (!error) return NextResponse.redirect(`${origin}${next}`)
  }

  return NextResponse.redirect(`${origin}/auth/erro`)
}
