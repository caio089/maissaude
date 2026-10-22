import { createBrowserClient } from "@supabase/ssr"

import { requireSupabasePublicEnv } from "@/lib/supabase/env"

export function createBrowserSupabase() {
  const { url, key } = requireSupabasePublicEnv()
  return createBrowserClient(url, key)
}
