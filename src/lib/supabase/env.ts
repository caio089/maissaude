export function supabaseUrl() {
  return process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || ""
}

export function supabasePublishableKey() {
  return process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() || ""
}

export function isSupabaseBrowserConfigured() {
  return Boolean(supabaseUrl() && supabasePublishableKey())
}

export function requireSupabasePublicEnv() {
  const url = supabaseUrl()
  const key = supabasePublishableKey()
  if (!url || !key) {
    throw new Error("Supabase público não está configurado. Preencha NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.")
  }
  return { url, key }
}
