import type { Metadata } from "next"
import { MobileHome } from "@/components/mobile/home-view"

export const metadata: Metadata = { title: "Paciente" }

export default function MobileHomePage() {
  return <MobileHome />
}
