import type { Metadata } from "next"
import { AgendaView } from "@/components/desktop/agenda-view"

export const metadata: Metadata = { title: "Agenda" }

export default function AgendaPage() {
  return <AgendaView />
}
