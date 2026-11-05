import { NextResponse } from "next/server"
import { getClinicSession } from "@/lib/clinic-session"
import { createSupabaseAdmin } from "@/lib/supabase/admin"
import { normalizeSpecialtyName, slugifySpecialty, validateSpecialtyName } from "@/lib/specialties"

export async function GET() {
  const session = await getClinicSession()
  if (!session.authenticated) {
    return NextResponse.json({ error: "Entre no painel da clínica." }, { status: 401 })
  }

  const db = createSupabaseAdmin()
  if (!db) {
    return NextResponse.json({ error: "Banco de dados indisponível." }, { status: 503 })
  }

  const { data, error } = await db
    .from("clinic_specialties")
    .select("id, name")
    .order("name", { ascending: true })

  if (error) {
    return NextResponse.json({ error: "Erro ao buscar especialidades." }, { status: 500 })
  }

  return NextResponse.json(data || [])
}

export async function POST(request: Request) {
  const session = await getClinicSession()
  if (!session.authenticated) {
    return NextResponse.json({ error: "Entre no painel da clínica." }, { status: 401 })
  }

  const db = createSupabaseAdmin()
  if (!db) {
    return NextResponse.json({ error: "Banco de dados indisponível." }, { status: 503 })
  }

  try {
    const body = await request.json()
    const validation = validateSpecialtyName(body?.name)
    if (!validation.valid || !validation.normalized) {
      return NextResponse.json({ error: validation.error || "Nome inválido." }, { status: 400 })
    }

    const normalizedName = validation.normalized
    const slugId = slugifySpecialty(normalizedName)
    if (!slugId) {
      return NextResponse.json({ error: "Nome de especialidade inválido." }, { status: 400 })
    }

    // Verifica se já existe especialidade com este id ou nome
    const existing = await db
      .from("clinic_specialties")
      .select("id, name")
      .or(`id.eq.${slugId},name.eq.${normalizedName}`)
      .maybeSingle()

    if (existing?.data) {
      return NextResponse.json(existing.data, { status: 200 })
    }

    const inserted = await db
      .from("clinic_specialties")
      .insert({ id: slugId, name: normalizedName })
      .select("id, name")
      .single()

    if (inserted.error) {
      // Caso de concorrência ou conflito
      const conflictExisting = await db
        .from("clinic_specialties")
        .select("id, name")
        .or(`id.eq.${slugId},name.eq.${normalizedName}`)
        .maybeSingle()

      if (conflictExisting?.data) {
        return NextResponse.json(conflictExisting.data, { status: 200 })
      }

      return NextResponse.json(
        { error: "Não foi possível cadastrar a especialidade." },
        { status: 500 }
      )
    }

    return NextResponse.json(inserted.data, { status: 201 })
  } catch {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400 })
  }
}
