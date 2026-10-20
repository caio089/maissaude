import type { Metadata } from "next"
import { DashboardView } from "@/components/desktop/dashboard-view"

export const metadata: Metadata = { title: "Painel" }

export default function DesktopHomePage() {
  return <DashboardView />
}
