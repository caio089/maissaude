import type { Metadata } from "next"
import { MobileProfile } from "@/components/mobile/profile-view"

export const metadata: Metadata = { title: "Perfil" }

export default function ProfilePage() {
  return <MobileProfile />
}
