"use client"

import { useEffect, useState } from "react"
import { Download, Loader2 } from "lucide-react"
import { AuthorizationGuideCard } from "@/components/mobile/authorization-guide-card"
import { Button } from "@/components/ui/button"
import { formatDate } from "@/lib/format"
import type { AuthorizationGuideInput } from "@/lib/authorization-guide"

type MobileGuide = {
  id: string
  issuedAt: string
  valid: boolean
  appointmentStatus: string | null
  startsAt: string | null
  service: string | null
  professional: string | null
  photoUrl?: string | null
  guideInput: AuthorizationGuideInput
}

type GuideFilter = "all" | "valid" | "pending"

export default function MobileGuidesPage() {
  const [guides, setGuides] = useState<MobileGuide[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [filter, setFilter] = useState<GuideFilter>("all")
  const [selected, setSelected] = useState<MobileGuide | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    fetch("/api/mobile/guides", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const body = await response.json() as { guides?: MobileGuide[]; error?: string }
        if (!response.ok) throw new Error(body.error || "Não foi possível carregar as guias.")
        if (!controller.signal.aborted) setGuides(body.guides || [])
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Erro ao carregar as guias.")
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [])

  const filtered = guides.filter((guide) => filter === "all" || (filter === "valid" ? guide.valid : !guide.valid))

  return (
    <div className="space-y-5 px-4 pt-6 pb-8">
      <div>
        <p className="section-kicker">Atendimentos</p>
        <h1 className="mt-1 text-2xl font-semibold">Guias de autorização</h1>
        <p className="mt-1 text-sm text-muted-foreground">Consulte e baixe as guias emitidas para você.</p>
      </div>

      <div className="flex gap-2" role="tablist" aria-label="Filtrar guias">
        {([
          ["all", "Todas"],
          ["valid", "Válidas"],
          ["pending", "Pendentes"],
        ] as Array<[GuideFilter, string]>).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={filter === value}
            onClick={() => setFilter(value)}
            className={`rounded-full px-4 py-2 text-sm font-medium ${filter === value ? "bg-teal text-white" : "bg-white text-muted-foreground ring-1 ring-border"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground" role="status">
          <Loader2 className="size-5 animate-spin" /> Carregando guias...
        </div>
      ) : error ? (
        <p role="alert" className="rounded-2xl bg-red-50 p-4 text-sm text-red-800">{error}</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border bg-white p-5 text-center">
          <p className="font-medium">Nenhuma guia encontrada</p>
          <p className="mt-1 text-sm text-muted-foreground">Guias aparecem aqui após a confirmação do pagamento.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((guide) => (
            <article key={guide.id} className="rounded-2xl border bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{guide.service || "Atendimento"}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {guide.startsAt ? formatDate(guide.startsAt, "dd/MM/yyyy 'às' HH:mm") : "Data não informada"}
                    {guide.professional ? ` · ${guide.professional}` : ""}
                  </p>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${guide.valid ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800"}`}>
                  {guide.valid ? "Válida" : "Pendente"}
                </span>
              </div>
              <div className="mt-3 flex gap-2">
                <Button type="button" size="sm" variant="outline" className="flex-1" onClick={() => setSelected(guide)}>
                  <Download className="mr-1.5 size-4" /> Baixar guia
                </Button>
              </div>
              {selected?.id === guide.id ? <AuthorizationGuideCard input={guide.guideInput} /> : null}
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
