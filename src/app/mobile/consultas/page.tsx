import type { Metadata } from "next"
import { MobileAppointments } from "@/components/mobile/appointments-view"

export const metadata: Metadata = { title: "Consultas" }

export default function AppointmentsPage() {
  return <MobileAppointments />
}
