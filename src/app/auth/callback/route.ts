import { NextResponse } from "next/server"

import { createServerSupabase } from "@/lib/supabase/server"

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")
  const next = safeNext(searchParams.get("next"))

  if (code) {
    const supabase = await createServerSupabase()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) return NextResponse.redirect(`${origin}${next}`)
  }

  return NextResponse.redirect(`${origin}/auth/erro`)
}

function safeNext(value: string | null) {
  if (value && value.startsWith("/") && !value.startsWith("//")) return value
  return "/auth/atualizar-senha"
}
