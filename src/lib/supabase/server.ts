import "server-only"

import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

import { requireSupabasePublicEnv } from "@/lib/supabase/env"

export async function createServerSupabase() {
  const { url, key } = requireSupabasePublicEnv()
  const cookieStore = await cookies()

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet, headers) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options)
          })
          void headers
        } catch {
          // Server Components não gravam cookie; o proxy atualiza a sessão.
        }
      },
    },
  })
}
