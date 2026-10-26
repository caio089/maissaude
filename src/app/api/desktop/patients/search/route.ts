import { NextResponse } from "next/server"
import { hasClinicSession } from "@/lib/clinic-session"
import { createSupabaseAdmin } from "@/lib/supabase/admin"

export async function GET(request: Request) {
  if (!(await hasClinicSession())) return NextResponse.json({ error: "Entre no painel da clínica." }, { status: 401 })
  const db = createSupabaseAdmin()
  if (!db) return NextResponse.json({ error: "Banco de dados indisponível." }, { status: 503 })

  const term = new URL(request.url).searchParams.get("q")?.trim().slice(0, 100) || ""
  if (!term) return NextResponse.json({ patients: [] })

  // Use separate filters instead of interpolating user input into PostgREST's OR syntax.
  const literal = term.replace(/[\\%_]/g, "\\$&")
  const digits = term.replace(/\D/g, "")
  const columns = "id,name,cpf,phone,email,status"
  const queries = [
    db.from("patients").select(columns).eq("status", "active").ilike("name", `%${literal}%`).order("name").limit(20),
    db.from("patients").select(columns).eq("status", "active").ilike("email", `%${literal}%`).order("name").limit(20),
  ]
  if (digits.length >= 3) {
    const pattern = `%${digits.split("").join("%")}%`
    queries.push(db.from("patients").select(columns).eq("status", "active").ilike("cpf", pattern).order("name").limit(20))
    queries.push(db.from("patients").select(columns).eq("status", "active").ilike("phone", pattern).order("name").limit(20))
  }
  const results = await Promise.all(queries)
  if (results.some((result) => result.error)) return NextResponse.json({ error: "Não foi possível buscar pacientes." }, { status: 500 })
  const patients = new Map<string, NonNullable<(typeof results)[number]["data"]>[number]>()
  for (const result of results) for (const patient of result.data || []) patients.set(patient.id, patient)
  return NextResponse.json({ patients: [...patients.values()].sort((a, b) => a.name.localeCompare(b.name, "pt-BR")).slice(0, 20) })
}
