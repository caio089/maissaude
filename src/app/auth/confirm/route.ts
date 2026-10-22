import { NextResponse } from "next/server"
import type { EmailOtpType } from "@supabase/supabase-js"

import { createServerSupabase } from "@/lib/supabase/server"

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const tokenHash = searchParams.get("token_hash")
  const type = searchParams.get("type") as EmailOtpType | null
  const next = safeNext(searchParams.get("next"))

  if (tokenHash && type) {
    const supabase = await createServerSupabase()
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
    if (!error) return NextResponse.redirect(`${origin}${next}`)
  }

  return NextResponse.redirect(`${origin}/auth/erro`)
}

function safeNext(value: string | null) {
  if (value && value.startsWith("/") && !value.startsWith("//")) return value
  return "/auth/atualizar-senha"
}
