"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

type Patient = { id: string; name: string; cpf: string }
type Guide = { id: string; issuedAt: string; valid: boolean; appointmentStatus: string | null; startsAt: string | null; patient: Patient | null; professional: string; service: string; paymentStatus: string }
const date = (value: string) => new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Fortaleza" }).format(new Date(value))

export function GuidesView() {
  const [query, setQuery] = useState("")
  const [patients, setPatients] = useState<Patient[]>([])
  const [selected, setSelected] = useState<Patient | null>(null)
  const [guideNumber, setGuideNumber] = useState("")
  const [guides, setGuides] = useState<Guide[]>([])
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
      {loading ? <p className="text-sm text-muted-foreground">Carregando...</p> : !error && guides.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma guia encontrada.</p> : guides.map((guide) => <article key={guide.id} className="space-y-1 rounded-lg border p-4 text-sm">
        <div className="flex flex-wrap justify-between gap-2"><p className="font-semibold">{guide.patient?.name || "Paciente indisponível"} · {guide.service}</p><span className={guide.valid ? "font-medium text-emerald-700" : "font-medium text-red-700"}>{guide.valid ? "Válida" : "Não válida"}</span></div>
        <p>Número: <span className="font-mono">{guide.id}</span></p>
        <p className="text-muted-foreground">CPF: {guide.patient?.cpf || "indisponível"} · {guide.professional}</p>
        <p className="text-muted-foreground">Consulta: {guide.startsAt ? date(guide.startsAt) : "indisponível"} · Emitida: {date(guide.issuedAt)}</p>
        {!guide.valid && <p className="text-red-700">Pagamento: {guide.paymentStatus} · Consulta: {guide.appointmentStatus || "indisponível"}</p>}
      </article>)}
      {guides.length === 100 && <p className="text-xs text-muted-foreground">Exibindo as 100 guias mais recentes. Use a busca para refinar.</p>}
    </section>
  </div>
}
