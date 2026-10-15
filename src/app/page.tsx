import type { Metadata } from "next"
import { LandingView } from "@/components/landing/landing-view"

export const metadata: Metadata = {
  title: "Saúde Prime",
  description: "Demonstração comercial de gestão de clínicas e agendamento de consultas.",
}

export default function HomePage() {
  return <LandingView />
}
