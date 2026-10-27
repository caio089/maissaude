import { NextResponse } from "next/server"

import { PaymentAuthorizationError, requireCurrentPatient } from "@/lib/payments/current-patient"
import { createSupabaseAdmin } from "@/lib/supabase/admin"

export async function GET() {
  try {
    await requireCurrentPatient()
    const db = createSupabaseAdmin()
    if (!db) return NextResponse.json({ error: "Banco de dados indisponível." }, { status: 503 })

    const [professionals, services, offers] = await Promise.all([
      db.from("professionals").select("*").eq("active", true).order("name"),
      db.from("professional_services").select("*"),
      db.from("catalog_offers").select("id,kind"),
    ])
    if (professionals.error || services.error || offers.error) {
      return NextResponse.json({ error: "Não foi possível carregar médicos e procedimentos." }, { status: 500 })
    }

    return NextResponse.json({
      professionals: professionals.data.map((professional) => ({
        id: professional.id,
        name: professional.name,
        specialty: professional.specialty,
        credentialLabel: professional.credential_label,
        credentialCode: professional.credential_code,
        bio: professional.bio,
        price: Number(professional.price),
        rating: Number(professional.rating),
        reviewCount: professional.review_count,
        reviews: [],
        workDays: professional.work_days,
        startHour: professional.start_hour.slice(0, 5),
        endHour: professional.end_hour.slice(0, 5),
        location: professional.location,
        active: professional.active,
        avatarSeed: professional.avatar_seed,
        services: services.data
          .filter((service) => service.professional_id === professional.id)
          .map((service) => ({
            id: service.id,
            name: service.name,
            durationMin: service.duration_min,
            price: Number(service.price),
            modality: service.modality,
            kind: offers.data.find((offer) => offer.id === service.id)?.kind || "consulta",
          })),
      })),
    })
  } catch (error) {
    const status = error instanceof PaymentAuthorizationError ? 401 : 500
    return NextResponse.json({ error: error instanceof Error ? error.message : "Não foi possível carregar o catálogo." }, { status })
  }
}
