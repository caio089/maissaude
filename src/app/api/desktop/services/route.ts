import { NextResponse } from "next/server"
import { getClinicSession } from "@/lib/clinic-session"
import { createSupabaseAdmin } from "@/lib/supabase/admin"
import type { Service } from "@/lib/types"
import { ASAAS_PIX_MINIMUM } from "@/lib/asaas/minimums"

export async function GET(request?: Request) {
  const session = await getClinicSession()
  if (!session.authenticated) {
    return NextResponse.json({ error: "Entre no painel da clínica." }, { status: 401 })
  }
  const db = createSupabaseAdmin()
  if (!db) return NextResponse.json({ error: "Banco de dados indisponível." }, { status: 503 })

  try {
    const { data: clinicsData } = await db.from("clinics").select("id,name,address")
    const clinicMap = new Map((clinicsData || []).map((c) => [c.id, c]))

    const buildQuery = (withClinicId: boolean) => {
      let q = db
        .from("catalog_offers")
        .select(
          withClinicId
            ? "id,kind,service_name,professional_id,price,duration_min,clinic_id"
            : "id,kind,service_name,professional_id,price,duration_min"
        )
        .order("service_name")

      if (request?.url) {
        const { searchParams } = new URL(request.url)
        const kind = searchParams.get("kind")
        const professionalId = searchParams.get("professionalId")
        const clinicId = searchParams.get("clinicId")

        if (kind) {
          q = q.eq("kind", kind)
        }
        if (professionalId !== null && searchParams.has("professionalId")) {
          if (professionalId === "null" || professionalId === "") {
            q = q.is("professional_id", null)
          } else {
            q = q.eq("professional_id", professionalId)
          }
        }
        if (clinicId && withClinicId) {
          q = q.eq("clinic_id", clinicId)
        }
      }
      return q
    }

    let queryRes = await buildQuery(true)
    if (
      queryRes.error &&
      (queryRes.error.code === "42703" ||
        queryRes.error.code === "PGRST204" ||
        String(queryRes.error.message || "").toLowerCase().includes("clinic_id"))
    ) {
      // Coluna clinic_id ainda não adicionada
      queryRes = await buildQuery(false)
    }

    if (queryRes.error) {
      return NextResponse.json({ error: "Não foi possível carregar os atendimentos." }, { status: 500 })
    }

    const offers = (queryRes.data || []).map((row: any) => {
      let rawName = String(row.service_name || "")
      let parsedClinicName: string | null = null
      let parsedClinicId: string | null = row.clinic_id ?? null

      // Fallback: se o nome estiver prefixado com [Nome da Clínica]
      const prefixMatch = rawName.match(/^\[(.*?)\]\s*(.*)$/)
      if (prefixMatch) {
        parsedClinicName = prefixMatch[1]
        rawName = prefixMatch[2]
        if (!parsedClinicId) {
          for (const [cId, cData] of clinicMap.entries()) {
            if (cData.name.toLowerCase() === parsedClinicName.toLowerCase()) {
              parsedClinicId = cId
              break
            }
          }
        }
      } else if (parsedClinicId && clinicMap.has(parsedClinicId)) {
        parsedClinicName = clinicMap.get(parsedClinicId)!.name
      }

      const offerObj: Record<string, any> = {
        id: row.id,
        name: rawName,
        kind: row.kind,
        professionalId: row.professional_id ?? null,
        price: Number(row.price),
        durationMin: row.duration_min,
      }
      if (parsedClinicId) offerObj.clinicId = parsedClinicId
      if (parsedClinicName) offerObj.clinicName = parsedClinicName

      return offerObj
    })

    return NextResponse.json({ offers })
  } catch {
    return NextResponse.json({ error: "Não foi possível carregar os atendimentos." }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const session = await getClinicSession()
  if (!session.authenticated) {
    return NextResponse.json({ error: "Entre no painel da clínica." }, { status: 401 })
  }
  if (session.role === "attendant") {
    return NextResponse.json(
      { error: "Atendentes possuem acesso somente leitura aos atendimentos." },
      { status: 403 }
    )
  }
  const db = createSupabaseAdmin()
  if (!db) return NextResponse.json({ error: "Banco de dados indisponível." }, { status: 503 })
  try {
    const body = (await request.json()) as {
      professionalId?: string | null
      clinicId?: string | null
      services?: Service[]
    }
    if (
      !Array.isArray(body.services) ||
      !body.services.length ||
      body.services.length > 100 ||
      body.services.some(
        (s) =>
          !s.id ||
          !s.name?.trim() ||
          s.name.trim().length > 120 ||
          !Number.isInteger(s.durationMin) ||
          s.durationMin < 1 ||
          s.durationMin > 1440 ||
          !Number.isFinite(s.price) ||
          s.price < ASAAS_PIX_MINIMUM ||
          s.price > 50000 ||
          (s.modality && !["presencial", "teleconsulta"].includes(s.modality)) ||
          !["consulta", "exame", "cirurgia"].includes(s.kind || "consulta")
      )
    ) {
      return NextResponse.json(
        { error: "Confira o profissional e os dados de cada atendimento." },
        { status: 422 }
      )
    }

    const professionalId = typeof body.professionalId === "string" && body.professionalId.trim().length > 0
      ? body.professionalId.trim()
      : null

    const clinicId = typeof body.clinicId === "string" && body.clinicId.trim().length > 0
      ? body.clinicId.trim()
      : null

    let clinicName: string | null = null
    if (clinicId) {
      const { data: clinicRow } = await db.from("clinics").select("name").eq("id", clinicId).maybeSingle()
      if (clinicRow?.name) {
        clinicName = clinicRow.name.trim()
      }
    }

    if (!professionalId) {
      // Procedimentos/Exames da clínica ou de clínicas parceiras
      const offersPayload = body.services.map((s) => {
        const item: Record<string, any> = {
          id: s.id,
          kind: s.kind || "exame",
          service_name: s.name.trim(),
          professional_id: null,
          price: s.price,
          duration_min: s.durationMin,
        }
        if (clinicId) item.clinic_id = clinicId
        return item
      })
      let offers = await db.from("catalog_offers").upsert(offersPayload)

      if (
        offers.error &&
        (offers.error.code === "42703" ||
          offers.error.code === "PGRST204" ||
          String(offers.error.message || "").toLowerCase().includes("clinic_id"))
      ) {
        // Fallback: se a coluna clinic_id ainda não existe no Postgres
        offers = await db.from("catalog_offers").upsert(
          body.services.map((s) => ({
            id: s.id,
            kind: s.kind || "exame",
            service_name: clinicName ? `[${clinicName}] ${s.name.trim()}` : s.name.trim(),
            professional_id: null,
            price: s.price,
            duration_min: s.durationMin,
          }))
        )
      }

      if (offers.error) {
        return NextResponse.json(
          { error: "Não foi possível salvar os atendimentos no catálogo da clínica." },
          { status: 500 }
        )
      }
      return NextResponse.json({ ok: true })
    }

    const professional = await db
      .from("professionals")
      .select("id,active")
      .eq("id", professionalId)
      .maybeSingle()
    if (professional.error) throw professional.error
    if (!professional.data?.active) {
      return NextResponse.json(
        { error: "Selecione um profissional ativo cadastrado no banco." },
        { status: 422 }
      )
    }
    const existing = await db
      .from("professional_services")
      .select("id,professional_id")
      .in(
        "id",
        body.services.map((s) => s.id)
      )
    if (existing.error) throw existing.error
    if (existing.data.some((s) => s.professional_id !== professionalId)) {
      return NextResponse.json(
        { error: "Um atendimento já pertence a outro profissional." },
        { status: 409 }
      )
    }
    const services = body.services.map((s) => ({
      id: s.id,
      professional_id: professionalId,
      name: s.name.trim(),
      price: s.price,
      duration_min: s.durationMin,
      modality: s.modality || "presencial",
    }))
    const inserted = await db.from("professional_services").upsert(services)
    if (inserted.error) {
      return NextResponse.json(
        { error: "Não foi possível salvar os atendimentos. Confira se já foram cadastrados." },
        { status: 409 }
      )
    }

    const doctorOffersPayload = body.services.map((s) => {
      const item: Record<string, any> = {
        id: s.id,
        kind: s.kind || "consulta",
        service_name: s.name.trim(),
        professional_id: professionalId,
        price: s.price,
        duration_min: s.durationMin,
      }
      if (clinicId) item.clinic_id = clinicId
      return item
    })
    let offers = await db.from("catalog_offers").upsert(doctorOffersPayload)

    if (
      offers.error &&
      (offers.error.code === "42703" ||
        offers.error.code === "PGRST204" ||
        String(offers.error.message || "").toLowerCase().includes("clinic_id"))
    ) {
      offers = await db.from("catalog_offers").upsert(
        body.services.map((s) => ({
          id: s.id,
          kind: s.kind || "consulta",
          service_name: s.name.trim(),
          professional_id: professionalId,
          price: s.price,
          duration_min: s.durationMin,
        }))
      )
    }

    if (offers.error) {
      return NextResponse.json(
        { error: "Atendimentos salvos, mas o catálogo não foi atualizado. Confira antes de tentar novamente." },
        { status: 500 }
      )
    }
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: "Não foi possível salvar os atendimentos." }, { status: 422 })
  }
}
