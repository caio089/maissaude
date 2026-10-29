import type { CartLine, CatalogKind, Professional } from "@/lib/types"

export interface CatalogOffer {
  kind: CatalogKind
  serviceId: string
  serviceName: string
  professionalId: string
  price: number
  durationMin: number
}

export function consultationOffers(professionals: Professional[]): CatalogOffer[] {
  return serviceOffers("consulta", professionals)
}

export function offersFor(kind: CatalogKind, professionals: Professional[]) {
  return serviceOffers(kind, professionals)
}

export function firstOfferForProfessional(professional: Professional): CatalogOffer | null {
  if (!professional.active) return null

  const preferredKinds: CatalogKind[] = ["consulta", "exame", "cirurgia"]
  for (const kind of preferredKinds) {
    const offer = serviceOffers(kind, [professional])[0]
    if (offer) return offer
  }

  return null
}

function serviceOffers(kind: CatalogKind, professionals: Professional[]): CatalogOffer[] {
  return professionals.filter((item) => item.active).flatMap((professional) =>
    professional.services
      .filter((service) => (service.kind ?? "consulta") === kind)
      .map((service) => ({
        kind,
        serviceId: service.id,
        serviceName: service.name,
        professionalId: professional.id,
        price: service.price,
        durationMin: service.durationMin,
      })),
  )
}

export function cartLineKey(offer: Pick<CartLine, "serviceId" | "date" | "time">) {
  return `${offer.serviceId}-${offer.date}-${offer.time}`
}

export function catalogOfferFor(line: Pick<CartLine, "kind" | "professionalId" | "serviceId">, professionals: Professional[]) {
  return offersFor(line.kind, professionals).find(
    (offer) => offer.professionalId === line.professionalId && offer.serviceId === line.serviceId,
  ) ?? null
}
