import type { CartLine, CatalogKind, Professional } from "@/lib/types"

export interface CatalogOffer {
  kind: CatalogKind
  serviceId: string
  serviceName: string
  professionalId: string
  price: number
  durationMin: number
}

const EXAMS: CatalogOffer[] = [
  { kind: "exame", serviceId: "exam-hemograma", serviceName: "Hemograma de demonstração", professionalId: "pro-seed-01", price: 80, durationMin: 20 },
  { kind: "exame", serviceId: "exam-ecg", serviceName: "Eletrocardiograma de demonstração", professionalId: "pro-seed-02", price: 140, durationMin: 30 },
  { kind: "exame", serviceId: "exam-usg", serviceName: "Ultrassom de demonstração", professionalId: "pro-seed-06", price: 180, durationMin: 30 },
  { kind: "exame", serviceId: "exam-raio", serviceName: "Raio-X de demonstração", professionalId: "pro-seed-04", price: 120, durationMin: 20 },
]

const SURGERIES: CatalogOffer[] = [
  { kind: "cirurgia", serviceId: "surg-pele", serviceName: "Pequeno procedimento de pele", professionalId: "pro-seed-03", price: 900, durationMin: 60 },
  { kind: "cirurgia", serviceId: "surg-odonto", serviceName: "Cirurgia odontológica de demonstração", professionalId: "pro-seed-04", price: 750, durationMin: 60 },
  { kind: "cirurgia", serviceId: "surg-geral", serviceName: "Pequena cirurgia de demonstração", professionalId: "pro-seed-01", price: 1100, durationMin: 90 },
]

export function consultationOffers(professionals: Professional[]): CatalogOffer[] {
  return professionals.filter((item) => item.active).map((professional) => {
    const service = professional.services.find((item) => item.name.startsWith("Consulta")) ?? professional.services[0]
    return {
      kind: "consulta" as const,
      serviceId: service?.id ?? `${professional.id}-consulta`,
      serviceName: service?.name ?? "Consulta de demonstração",
      professionalId: professional.id,
      price: service?.price ?? professional.price,
      durationMin: service?.durationMin ?? 40,
    }
  })
}

export function offersFor(kind: CatalogKind, professionals: Professional[]) {
  if (kind === "consulta") return consultationOffers(professionals)
  const source = kind === "exame" ? EXAMS : SURGERIES
  const active = new Set(professionals.filter((item) => item.active).map((item) => item.id))
  return source.filter((item) => active.has(item.professionalId))
}

export function cartLineKey(offer: Pick<CartLine, "serviceId" | "date" | "time">) {
  return `${offer.serviceId}-${offer.date}-${offer.time}`
}
