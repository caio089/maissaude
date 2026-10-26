import type { Metadata } from "next"
import { ServicesView } from "@/components/desktop/services-view"

export const metadata: Metadata = { title: "Consultas e procedimentos" }

export default function ServicesPage() {
  return <ServicesView />
}
