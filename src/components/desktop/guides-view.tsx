"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { formatDate } from "@/lib/format"
import { formatCpf } from "@/lib/cpf"
import { GuideExportDialog, type GuideDialogItem } from "@/components/desktop/guide-export-dialog"
import { guideCredentials } from "@/lib/authorization-guide"

type Patient = { id: string; name: string; cpf: string; birthDate?: string }
type Guide = GuideDialogItem
const date = (value?: string | null) => formatDate(value, "dd/MM/yyyy HH:mm")

export function GuidesView() {
  const [query, setQuery] = useState("")
  const [patients, setPatients] = useState<Patient[]>([])
  const [selected, setSelected] = useState<Patient | null>(null)
  const [guideNumber, setGuideNumber] = useState("")
  const [guides, setGuides] = useState<Guide[]>([])
  const [exportGuide, setExportGuide] = useState<GuideDialogItem | null>(null)
  const [error, setError] = useState("")
  const [patientError, setPatientError] = useState("")
  const [searchingPatients, setSearchingPatients] = useState(false)
  const [loading, setLoading] = useState(true)
  const activeRequest = useRef<AbortController | null>(null)

  const load = useCallback(async (params: URLSearchParams) => {
    activeRequest.current?.abort()
    const controller = new AbortController()
    activeRequest.current = controller
    const signal = controller.signal
    setLoading(true)
    setError("")
    try {
      const response = await fetch(`/api/desktop/guides?${params}`, { cache: "no-store", signal })
      const result = await response.json() as { guides?: Guide[]; error?: string }
      if (!response.ok) throw new Error(result.error || "Não foi possível buscar as guias.")
      if (!signal?.aborted) setGuides(result.guides || [])
    } catch (err) {
      if (!signal?.aborted) { setGuides([]); setError(err instanceof Error ? err.message : "Erro ao buscar guias.") }
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    activeRequest.current = controller
    fetch("/api/desktop/guides", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const result = await response.json() as { guides?: Guide[]; error?: string }
        if (!response.ok) throw new Error(result.error || "Não foi possível buscar as guias.")
        if (!controller.signal.aborted) setGuides(result.guides || [])
      }).catch((err: unknown) => {
        if (!controller.signal.aborted) setError(err instanceof Error ? err.message : "Erro ao buscar guias.")
      }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => { controller.abort(); activeRequest.current?.abort() }
  }, [])

  useEffect(() => {
    if (!query.trim() || selected) return
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      fetch(`/api/desktop/patients/search?includeInactive=true&q=${encodeURIComponent(query.trim())}`, { cache: "no-store", signal: controller.signal })
        .then(async (response) => {
          const result = await response.json() as { patients?: Patient[]; error?: string }
          if (!response.ok) throw new Error(result.error || "Não foi possível buscar pacientes.")
          if (!controller.signal.aborted) { setPatients(result.patients || []); setSearchingPatients(false) }
        }).catch((err: unknown) => {
          if (!controller.signal.aborted) { setPatientError(err instanceof Error ? err.message : "Erro na busca."); setSearchingPatients(false) }
        })
    }, 250)
    return () => { window.clearTimeout(timer); controller.abort() }
  }, [query, selected])

  return <div className="space-y-6">
    <div><h1 className="text-2xl font-semibold">Guias de autorização</h1><p className="mt-1 text-sm text-muted-foreground">Guias emitidas após a confirmação do pagamento. Consulte a situação atual antes do atendimento.</p></div>
    <section className="space-y-4 rounded-2xl border bg-card p-5">
      <div className="space-y-2"><label htmlFor="guide-patient-search" className="text-sm font-medium">Buscar paciente por nome, CPF, telefone ou e-mail</label>
        <Input id="guide-patient-search" value={query} placeholder="Digite para buscar" onChange={(event) => { setQuery(event.target.value); setSelected(null); setPatients([]); setPatientError(""); setSearchingPatients(Boolean(event.target.value.trim())) }} />
        {patientError && <p role="alert" className="text-sm text-destructive">{patientError}</p>}
        {!selected && searchingPatients && <p className="text-sm text-muted-foreground">Buscando pacientes...</p>}
        {!selected && query.trim() && !searchingPatients && !patientError && patients.length === 0 && <p className="text-sm text-muted-foreground">Nenhum paciente encontrado.</p>}
        {!selected && patients.map((patient) => <button type="button" key={patient.id} className="block w-full rounded-lg border p-3 text-left text-sm hover:bg-accent" onClick={() => { setSelected(patient); setQuery(patient.name); setPatients([]); setGuideNumber(""); void load(new URLSearchParams({ patientId: patient.id })) }}><span className="font-medium">{patient.name}</span><span className="ml-2 text-muted-foreground">CPF: {patient.cpf}</span></button>)}
      </div>
      <form className="flex flex-wrap items-end gap-3" onSubmit={(event) => { event.preventDefault(); setSelected(null); setQuery(""); setPatients([]); void load(new URLSearchParams({ guideId: guideNumber.trim() })) }}>
        <div className="min-w-64 flex-1 space-y-2"><label htmlFor="guide-number" className="text-sm font-medium">Número da guia</label><Input id="guide-number" value={guideNumber} onChange={(event) => setGuideNumber(event.target.value)} placeholder="Número completo da guia" /></div>
        <Button type="submit" disabled={!guideNumber.trim()}>Buscar guia</Button>
        <Button type="button" variant="outline" onClick={() => { setGuideNumber(""); setQuery(""); setSelected(null); setPatients([]); void load(new URLSearchParams()) }}>Todas as guias</Button>
      </form>
    </section>
    <section className="space-y-3 rounded-2xl border bg-card p-5">
      <h2 className="text-lg font-semibold">{selected ? `Guias de ${selected.name}` : "Guias"}</h2>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : !error && guides.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma guia encontrada.</p>
      ) : (
        guides.map((guide) => {
          const creds = guideCredentials(guide.id)
          return (
            <article key={guide.id} className="space-y-2 rounded-xl border bg-card p-4 text-sm shadow-sm hover:border-teal/50 transition-colors">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-semibold text-base text-foreground">
                    {guide.patient?.name || "Paciente indisponível"}
                  </p>
                  <p className="text-xs text-muted-foreground font-medium">
                    {guide.service}
                  </p>
                </div>
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                    guide.valid
                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                      : "bg-red-50 text-red-700 border border-red-200"
                  }`}
                >
                  {guide.valid ? "● Válida" : "● Não válida"}
                </span>
              </div>

              <div className="grid gap-1.5 sm:grid-cols-2 text-xs pt-1 text-muted-foreground">
                <p>
                  <span className="font-medium text-foreground">Guia nº:</span>{" "}
                  <span className="font-mono font-semibold text-foreground">{creds.number}</span>{" "}
                  <span className="text-[11px]">(senha: {creds.password})</span>
                </p>
                <p>
                  <span className="font-medium text-foreground">CPF:</span>{" "}
                  {guide.patient?.cpf ? formatCpf(guide.patient.cpf) : "indisponível"}
                </p>
                <p>
                  <span className="font-medium text-foreground">Médico / Especialista:</span>{" "}
                  {guide.professional || "Geral da clínica"}
                </p>
                <p>
                  <span className="font-medium text-foreground">Consulta:</span>{" "}
                  {guide.startsAt ? date(guide.startsAt) : "indisponível"} · Emitida: {date(guide.issuedAt)}
                </p>
              </div>

              {!guide.valid && (
                <p className="text-xs text-destructive bg-destructive/5 p-2 rounded-md">
                  Pagamento: {guide.paymentStatus} · Consulta: {guide.appointmentStatus || "indisponível"}
                </p>
              )}

              <div className="flex items-center justify-between border-t pt-2 mt-2">
                <span className="text-xs text-muted-foreground">
                  {guide.valid ? "✓ Guia liberada para atendimento presencial" : "Aguardando confirmação de pagamento"}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 text-xs font-medium border-teal/40 text-teal hover:bg-teal/10"
                  onClick={() => setExportGuide(guide)}
                >
                  <Download className="h-3.5 w-3.5 text-teal" />
                  Exportar guia
                </Button>
              </div>
            </article>
          )
        })
      )}
      {guides.length === 100 && <p className="text-xs text-muted-foreground">Exibindo as 100 guias mais recentes. Use a busca para refinar.</p>}
    </section>
    <GuideExportDialog
      open={Boolean(exportGuide)}
      onOpenChange={(open) => {
        if (!open) setExportGuide(null)
      }}
      guide={exportGuide}
    />
  </div>
}

