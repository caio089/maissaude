import type { Metadata } from "next"
import { LandingView } from "@/components/landing/landing-view"

export const instant = false

export const metadata: Metadata = {
  title: { absolute: "CuidarSaude · Sua saúde na palma da mão" },
  description: "Encontre profissionais, agende consultas e acompanhe seus pagamentos pelo celular.",
}

export default function HomePage() {
  return <LandingView />
}
