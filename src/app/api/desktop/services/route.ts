import { NextResponse } from "next/server"
import { hasClinicSession } from "@/lib/clinic-session"
import { createSupabaseAdmin } from "@/lib/supabase/admin"
import type { Service } from "@/lib/types"

export async function POST(request: Request) {
  if (!(await hasClinicSession())) return NextResponse.json({ error: "Entre no painel da clínica." }, { status: 401 })
  const db = createSupabaseAdmin()
  if (!db) return NextResponse.json({ error: "Banco de dados indisponível." }, { status: 503 })
  try {
    const body = await request.json() as { professionalId?: string; services?: Service[] }
    if (!body.professionalId || !Array.isArray(body.services) || !body.services.length || body.services.length > 100 || body.services.some((s) => !s.id || !s.name?.trim() || s.name.trim().length > 120 || !Number.isInteger(s.durationMin) || s.durationMin < 1 || s.durationMin > 1440 || !Number.isFinite(s.price) || s.price <= 0 || s.price > 50000 || !["presencial", "teleconsulta"].includes(s.modality) || !["consulta", "exame", "cirurgia"].includes(s.kind || "consulta"))) {
      return NextResponse.json({ error: "Confira o profissional e os dados de cada atendimento." }, { status: 422 })
    }
    const professional = await db.from("professionals").select("id,active").eq("id", body.professionalId).maybeSingle()
    if (professional.error) throw professional.error
    if (!professional.data?.active) return NextResponse.json({ error: "Selecione um profissional ativo cadastrado no banco." }, { status: 422 })
    const existing = await db.from("professional_services").select("id,professional_id").in("id", body.services.map((s) => s.id))
    if (existing.error) throw existing.error
    if (existing.data.some((s) => s.professional_id !== body.professionalId)) return NextResponse.json({ error: "Um atendimento já pertence a outro profissional." }, { status: 409 })
    const services = body.services.map((s) => ({ id: s.id, professional_id: body.professionalId, name: s.name.trim(), price: s.price, duration_min: s.durationMin, modality: s.modality }))
    const inserted = await db.from("professional_services").upsert(services)
    if (inserted.error) return NextResponse.json({ error: "Não foi possível salvar os atendimentos. Confira se já foram cadastrados." }, { status: 409 })
    const offers = await db.from("catalog_offers").upsert(body.services.map((s) => ({ id: s.id, kind: s.kind || "consulta", service_name: s.name.trim(), professional_id: body.professionalId, price: s.price, duration_min: s.durationMin })))
    if (offers.error) return NextResponse.json({ error: "Atendimentos salvos, mas o catálogo não foi atualizado. Confira antes de tentar novamente." }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: "Não foi possível salvar os atendimentos." }, { status: 422 })
  }
}
