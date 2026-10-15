import { Suspense } from "react"
import type { Metadata } from "next"
import { ProfessionalView } from "@/components/mobile/professional-view"

export const metadata: Metadata = { title: "Profissional" }

export default function ProfessionalPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<p className="px-5 py-8 text-sm text-muted-foreground">Carregando perfil…</p>}>
      <Resolved params={params} />
    </Suspense>
  )
}

async function Resolved({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <ProfessionalView id={id} />
}
