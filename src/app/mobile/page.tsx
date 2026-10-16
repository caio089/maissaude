import type { Metadata } from "next"
import { MobileJourney } from "@/components/mobile/journey-view"

export const metadata: Metadata = { title: "Agendar" }

export default function MobileHomePage() {
  return <MobileJourney />
}
