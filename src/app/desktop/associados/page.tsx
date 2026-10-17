import type { Metadata } from "next"
import { AssociatesView } from "@/components/desktop/associates-view"

export const metadata: Metadata = { title: "Associados" }

export default function AssociatesPage() {
  return <AssociatesView />
}
