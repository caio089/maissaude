import type { Metadata } from "next"
import { SurgeriesView } from "@/components/desktop/surgeries-view"

export const metadata: Metadata = { title: "Cirurgias" }

export default function CirurgiasPage() {
  return <SurgeriesView />
}
