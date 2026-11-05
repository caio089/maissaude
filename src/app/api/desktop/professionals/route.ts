import { NextResponse } from "next/server"
import { getClinicSession, hasClinicSession } from "@/lib/clinic-session"
import { createId } from "@/lib/format"
import { createSupabaseAdmin } from "@/lib/supabase/admin"
import { SPECIALTIES, type ProfessionalInput, type Service } from "@/lib/types"
import { hasErrors, validateProfessionalInput } from "@/lib/validation"
import { ASAAS_PIX_MINIMUM } from "@/lib/asaas/minimums"

export async function GET() {
  if (!(await hasClinicSession())) return NextResponse.json({ error: "Entre no painel da clínica." }, { status: 401 })
  const db = createSupabaseAdmin()
  if (!db) return NextResponse.json({ error: "Banco de dados indisponível." }, { status: 503 })
  const [professionals, services, offers] = await Promise.all([
    db.from("professionals").select("*").order("name"),
    db.from("professional_services").select("*"),
    db.from("catalog_offers").select("id,kind"),
  ])
  if (professionals.error || services.error || offers.error) return NextResponse.json({ error: "Não foi possível carregar os profissionais." }, { status: 500 })
  return NextResponse.json({ professionals: professionals.data.map((p) => ({
    id: p.id, name: p.name, specialty: p.specialty, credentialLabel: p.credential_label,
    credentialCode: p.credential_code, bio: p.bio, price: Number(p.price), rating: Number(p.rating),
    reviewCount: p.review_count, reviews: [], workDays: Array.isArray(p.work_days) ? p.work_days : [1, 2, 3, 4, 5], startHour: (p.start_hour || "08:00").slice(0, 5),
    endHour: (p.end_hour || "18:00").slice(0, 5), location: p.location, active: p.active, avatarSeed: p.avatar_seed,
    photoUrl: p.photo_url || null,
    services: services.data.filter((s) => s.professional_id === p.id).map((s) => ({ id: s.id, name: s.name, durationMin: s.duration_min, price: Number(s.price), modality: s.modality, kind: offers.data.find((o) => o.id === s.id)?.kind || "consulta" })),
  })) })
}

export async function POST(request: Request) {
  const session = await getClinicSession()
  if (!session.authenticated) {
    return NextResponse.json({ error: "Entre no painel da clínica." }, { status: 401 })
  }
  if (session.role === "attendant") {
    return NextResponse.json(
      { error: "Atendentes possuem acesso somente leitura aos profissionais." },
      { status: 403 }
    )
  }
  const db = createSupabaseAdmin()
  if (!db) return NextResponse.json({ error: "Banco de dados indisponível." }, { status: 503 })
  try {
    const body = await request.json() as { id?: string; form?: ProfessionalInput; services?: Service[] }
    const form = body.form
    const isSpecialtyValid =
      typeof form?.specialty === "string" &&
      form.specialty.trim().length >= 2 &&
      form.specialty.trim().length <= 60

    if (!form || !isSpecialtyValid || hasErrors(validateProfessionalInput(form)) || !Array.isArray(body.services) || body.services.length > 100 || !/^\d{2}:\d{2}$/.test(form.startHour) || !/^\d{2}:\d{2}$/.test(form.endHour) || form.endHour <= form.startHour) {
      return NextResponse.json({ error: "Confira os dados e horários do profissional." }, { status: 422 })
    }
    if (body.services.some((s) => !s.id || !s.name?.trim() || s.name.trim().length > 120 || !Number.isInteger(s.durationMin) || s.durationMin < 1 || s.durationMin > 1440 || !Number.isFinite(s.price) || s.price < ASAAS_PIX_MINIMUM || s.price > 50000 || !["presencial", "teleconsulta"].includes(s.modality) || !["consulta", "exame", "cirurgia"].includes(s.kind || "consulta"))) {
      return NextResponse.json({ error: "Confira nome, valor, duração e tipo de cada atendimento." }, { status: 422 })
    }
    const id = body.id || createId("pro")
    if (body.services.length) {
      const existingServices = await db.from("professional_services").select("id,professional_id").in("id", body.services.map((s) => s.id))
      if (existingServices.error) throw existingServices.error
      if (existingServices.data.some((s) => s.professional_id !== id)) return NextResponse.json({ error: "Um atendimento já pertence a outro profissional." }, { status: 409 })
    }
    const existing = await db.from("professionals").select("id,credential_label,location,avatar_seed,photo_url,rating,review_count").eq("id", id).maybeSingle()
    if (existing.error) throw existing.error
    const row = {
      id,
      name: form.name.trim(),
      specialty: form.specialty.trim(),
      credential_label: existing.data?.credential_label || "Registro profissional",
      credential_code: form.credentialCode.trim().toUpperCase(),
      bio: form.bio.trim(),
      price: form.price,
      work_days: form.workDays,
      start_hour: form.startHour,
      end_hour: form.endHour,
      active: form.active,
      location: existing.data?.location || "",
      avatar_seed: existing.data?.avatar_seed || form.name.trim(),
      photo_url: form.photoUrl !== undefined ? (form.photoUrl?.trim() || null) : (existing.data?.photo_url || null),
      rating: existing.data?.rating || 0,
      review_count: existing.data?.review_count || 0,
    }
    const saved = await db.from("professionals").upsert(row)
    if (saved.error) return NextResponse.json({ error: "Não foi possível salvar o profissional. Confira se o registro profissional já está em uso." }, { status: 409 })
    if (body.services.length) {
      const savedServices = await db.from("professional_services").upsert(body.services.map((s) => ({ id: s.id, professional_id: id, name: s.name.trim(), price: s.price, duration_min: s.durationMin, modality: s.modality })))
      if (savedServices.error) return NextResponse.json({ error: "Profissional salvo, mas os atendimentos não foram salvos. Confira antes de tentar novamente." }, { status: 500 })
      const savedOffers = await db.from("catalog_offers").upsert(body.services.map((s) => ({ id: s.id, kind: s.kind || "consulta", service_name: s.name.trim(), professional_id: id, price: s.price, duration_min: s.durationMin })))
      if (savedOffers.error) return NextResponse.json({ error: "Profissional e atendimentos salvos, mas o catálogo não foi atualizado. Confira antes de tentar novamente." }, { status: 500 })
    }
    return NextResponse.json({ id })
  } catch {
    return NextResponse.json({ error: "Não foi possível salvar os dados do profissional." }, { status: 422 })
  }
}

export async function PATCH(request: Request) {
  return POST(request)
}

export async function DELETE(request: Request) {
  const session = await getClinicSession()
  if (!session.authenticated) {
    return NextResponse.json({ error: "Entre no painel da clínica." }, { status: 401 })
  }
  if (session.role === "attendant") {
    return NextResponse.json(
      { error: "Atendentes possuem acesso somente leitura aos profissionais." },
      { status: 403 }
    )
  }
  return NextResponse.json({ ok: true })
}
