import type { Metadata } from "next"
import { RecordsView } from "@/components/desktop/records-view"

export const metadata: Metadata = { title: "Prontuários" }

export default function RecordsPage() {
  return <RecordsView />
}
