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
  return professionals.filter((item) => item.active).map((professional) => {
    const service = professional.services.find((item) => item.name.startsWith("Consulta")) ?? professional.services[0]
    return {
      kind: "consulta" as const,
      serviceId: service?.id ?? `${professional.id}-consulta`,
      serviceName: service?.name ?? "Consulta",
      professionalId: professional.id,
      price: service?.price ?? professional.price,
      durationMin: service?.durationMin ?? 40,
    }
  })
}

export function offersFor(kind: CatalogKind, professionals: Professional[]) {
  if (kind === "consulta") return consultationOffers(professionals)
  return []
}

export function cartLineKey(offer: Pick<CartLine, "serviceId" | "date" | "time">) {
  return `${offer.serviceId}-${offer.date}-${offer.time}`
}

export function catalogOfferFor(line: Pick<CartLine, "kind" | "professionalId" | "serviceId">, professionals: Professional[]) {
  return offersFor(line.kind, professionals).find(
    (offer) => offer.professionalId === line.professionalId && offer.serviceId === line.serviceId,
  ) ?? null
}
