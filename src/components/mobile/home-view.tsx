"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"
import { isAfter } from "date-fns"
import { MapPin, Search, Stethoscope } from "lucide-react"
import { Portrait } from "@/components/shared/portrait"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { firstName, formatDate, formatMoney, greeting } from "@/lib/format"
import { useDemoStore } from "@/lib/store"
import { DEMO_CITIES, SPECIALTIES, SPECIALTY_LABEL } from "@/lib/types"

export function MobileHome() {
  const router = useRouter()
  const data = useDemoStore((state) => state.data)
  const city = useDemoStore((state) => state.mobileCity)
  const setCity = useDemoStore((state) => state.setMobileCity)
  const setFilters = useDemoStore((state) => state.setMobileFilters)
  const [query, setQuery] = useState("")
  const [cityOpen, setCityOpen] = useState(false)
  const now = useMemo(() => new Date(), [])
  const patient = data.patients.find((item) => item.id === data.currentPatientId)
  const next = data.appointments
    .filter((item) => item.patientId === data.currentPatientId && (item.status === "scheduled" || item.status === "confirmed") && isAfter(new Date(item.startsAt), now))
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())[0]
  const nextProfessional = data.professionals.find((item) => item.id === next?.professionalId)
  const featured = data.professionals.filter((item) => item.active).slice(0, 4)

  return (
    <div className="space-y-6 px-5 pt-5 pb-6">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium tracking-wide text-teal">{data.clinic.name} · demo</p>
        <button type="button" onClick={() => setCityOpen(true)} className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 text-xs ring-1 ring-border">
          <MapPin className="size-3" /> {city}
        </button>
      </div>
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">{greeting(now)}, {firstName(patient?.name ?? "Helena")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">Encontre um horário na unidade demonstrativa.</p>
      </div>
      <form
        onSubmit={(event) => {
          event.preventDefault()
          setFilters({ query })
          router.push("/mobile/buscar")
        }}
      >
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Profissional, especialidade ou clínica" aria-label="Buscar atendimento" className="h-12 rounded-2xl bg-white pl-10" />
        </div>
      </form>
      <div className="flex gap-2 overflow-x-auto phone-scroll pb-1">
        {SPECIALTIES.map((specialty) => (
          <button
            key={specialty}
            type="button"
            onClick={() => {
              setFilters({ specialty, query: "" })
              router.push("/mobile/buscar")
            }}
            className="shrink-0 rounded-full bg-white px-3 py-2 text-xs ring-1 ring-border"
          >
            {SPECIALTY_LABEL[specialty]}
          </button>
        ))}
      </div>
      {next && nextProfessional ? (
        <Link href="/mobile/consultas" className="block rounded-3xl bg-brand p-5 text-white">
          <p className="text-xs text-white/70">Próxima consulta</p>
          <p className="mt-2 text-lg font-semibold">{nextProfessional.name}</p>
          <p className="text-sm text-white/80">{formatDate(next.startsAt, "EEEE, d 'de' MMMM 'às' HH:mm")}</p>
        </Link>
      ) : (
        <div className="rounded-3xl bg-white p-5 ring-1 ring-border">
          <p className="text-sm font-medium">Nenhuma consulta futura</p>
          <p className="mt-1 text-sm text-muted-foreground">Escolha um profissional e simule um agendamento.</p>
        </div>
      )}
      <Button asChild className="h-12 w-full rounded-2xl">
        <Link href="/mobile/buscar"><Stethoscope /> Agendamento rápido</Link>
      </Button>
      <section>
        <h2 className="text-lg font-semibold">Em destaque</h2>
        <div className="mt-3 flex gap-3 overflow-x-auto phone-scroll">
          {featured.map((professional) => (
            <Link key={professional.id} href={`/mobile/profissional/${professional.id}`} className="w-44 shrink-0 rounded-3xl bg-white p-4 ring-1 ring-border">
              <Portrait seed={professional.avatarSeed} name={professional.name} className="size-14" />
              <p className="mt-3 text-sm font-medium">{professional.name}</p>
              <p className="text-xs text-muted-foreground">{SPECIALTY_LABEL[professional.specialty]}</p>
              <p className="mt-2 text-sm">{formatMoney(professional.price)}</p>
            </Link>
          ))}
        </div>
      </section>
      {city !== "Teresina - PI" ? (
        <p className="rounded-2xl bg-amber-50 px-4 py-3 text-xs text-amber-900">A unidade demonstrativa continua em Teresina - PI. A cidade selecionada só muda o contexto da simulação.</p>
      ) : null}
      <CitySheet open={cityOpen} city={city} onOpenChange={setCityOpen} onSelect={setCity} />
    </div>
  )
}

export function CitySheet({
  open,
  city,
  onOpenChange,
  onSelect,
}: {
  open: boolean
  city: string
  onOpenChange: (open: boolean) => void
  onSelect: (city: string) => void
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-3xl">
        <SheetHeader><SheetTitle>Cidade fictícia</SheetTitle></SheetHeader>
        <div className="space-y-2 px-4 pb-6">
          {DEMO_CITIES.map((item) => (
            <button key={item} type="button" onClick={() => { onSelect(item); onOpenChange(false) }} className={`block w-full rounded-2xl px-4 py-3 text-left text-sm ${item === city ? "bg-accent" : "bg-muted"}`}>
              {item}
            </button>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  )
}
