import { NextResponse } from "next/server"
import { getClinicSession } from "@/lib/clinic-session"
import { createSupabaseAdmin } from "@/lib/supabase/admin"
import { DEFAULT_CLINIC_PROFILE, type PartnerClinic } from "@/lib/types"
import { createId } from "@/lib/format"

export async function GET() {
  const session = await getClinicSession()
  if (!session.authenticated) {
    return NextResponse.json({ error: "Entre no painel da clínica." }, { status: 401 })
  }

  const db = createSupabaseAdmin()
  if (!db) return NextResponse.json({ error: "Banco de dados indisponível." }, { status: 503 })

  try {
    const { data, error } = await db
      .from("clinics")
      .select("id,name,legal_name,city,address,phone,email,created_at")
      .order("name", { ascending: true })

    if (error) {
      return NextResponse.json({ error: "Não foi possível carregar as clínicas." }, { status: 500 })
    }

    const clinics: PartnerClinic[] = (data || []).map((row) => ({
      id: row.id,
      name: row.name,
      legalName: row.legal_name || row.name,
      city: row.city,
      address: row.address,
      phone: row.phone,
      email: row.email || undefined,
      createdAt: row.created_at,
    }))

    // Se nenhuma clínica estiver salva, garante a clínica padrão
    if (clinics.length === 0) {
      clinics.push({
        id: "clinic-default",
        name: DEFAULT_CLINIC_PROFILE.name,
        legalName: DEFAULT_CLINIC_PROFILE.legalName,
        city: DEFAULT_CLINIC_PROFILE.city,
        address: DEFAULT_CLINIC_PROFILE.address,
        phone: DEFAULT_CLINIC_PROFILE.phone,
        email: DEFAULT_CLINIC_PROFILE.email,
      })
    }

    return NextResponse.json({ clinics })
  } catch {
    return NextResponse.json({ error: "Não foi possível carregar as clínicas." }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const session = await getClinicSession()
  if (!session.authenticated) {
    return NextResponse.json({ error: "Entre no painel da clínica." }, { status: 401 })
  }
  if (session.role === "attendant") {
    return NextResponse.json(
      { error: "Atendentes possuem acesso somente leitura às clínicas parceiras." },
      { status: 403 }
    )
  }

  const db = createSupabaseAdmin()
  if (!db) return NextResponse.json({ error: "Banco de dados indisponível." }, { status: 503 })

  try {
    const body = (await request.json()) as {
      id?: string
      name?: string
      legalName?: string
      city?: string
      address?: string
      phone?: string
      email?: string
    }

    const name = body.name?.trim()
    const city = body.city?.trim()
    const address = body.address?.trim()
    const phone = body.phone?.trim()
    const legalName = body.legalName?.trim() || name
    const email = body.email?.trim() || ""

    if (!name || name.length < 2 || name.length > 150) {
      return NextResponse.json({ error: "Informe um nome válido para a clínica." }, { status: 422 })
    }
    if (!city || city.length < 2) {
      return NextResponse.json({ error: "Informe a cidade da clínica." }, { status: 422 })
    }
    if (!address || address.length < 4) {
      return NextResponse.json({ error: "Informe o endereço completo da clínica." }, { status: 422 })
    }
    if (!phone || phone.length < 8) {
      return NextResponse.json({ error: "Informe o telefone de contato da clínica." }, { status: 422 })
    }

    const id = body.id?.trim() || createId("cli")

    const { data, error } = await db
      .from("clinics")
      .upsert({
        id,
        name,
        legal_name: legalName,
        city,
        address,
        phone,
        email,
      })
      .select("id,name,legal_name,city,address,phone,email,created_at")
      .single()

    if (error || !data) {
      return NextResponse.json({ error: "Não foi possível salvar a clínica." }, { status: 500 })
    }

    return NextResponse.json({
      clinic: {
        id: data.id,
        name: data.name,
        legalName: data.legal_name,
        city: data.city,
        address: data.address,
        phone: data.phone,
        email: data.email,
        createdAt: data.created_at,
      },
    })
  } catch {
    return NextResponse.json({ error: "Não foi possível salvar a clínica." }, { status: 422 })
  }
}

export async function DELETE(request: Request) {
  const session = await getClinicSession()
  if (!session.authenticated) {
    return NextResponse.json({ error: "Entre no painel da clínica." }, { status: 401 })
  }
  if (session.role === "attendant") {
    return NextResponse.json(
      { error: "Atendentes não têm permissão para excluir clínicas." },
      { status: 403 }
    )
  }

  const db = createSupabaseAdmin()
  if (!db) return NextResponse.json({ error: "Banco de dados indisponível." }, { status: 503 })

  const { searchParams } = new URL(request.url)
  const id = searchParams.get("id")?.trim()

  if (!id) {
    return NextResponse.json({ error: "ID da clínica é obrigatório." }, { status: 400 })
  }

  if (id === "clinic-default") {
    return NextResponse.json(
      { error: "A clínica matriz padrão não pode ser excluída." },
      { status: 400 }
    )
  }

  try {
    const { error } = await db.from("clinics").delete().eq("id", id)
    if (error) {
      return NextResponse.json(
        { error: "Não foi possível excluir a clínica. Verifique se há procedimentos vinculados." },
        { status: 409 }
      )
    }
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: "Não foi possível excluir a clínica." }, { status: 500 })
  }
}
