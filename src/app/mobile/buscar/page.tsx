import type { Metadata } from "next"
import { MobileSearch } from "@/components/mobile/search-view"

export const metadata: Metadata = { title: "Buscar" }

export default function SearchPage() {
  return <MobileSearch />
}
