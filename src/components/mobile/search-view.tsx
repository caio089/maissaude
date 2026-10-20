"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { Search, SlidersHorizontal } from "lucide-react"
import { EmptyState } from "@/components/shared/empty-state"
import { Portrait } from "@/components/shared/portrait"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Switch } from "@/components/ui/switch"
import { formatMoney } from "@/lib/format"
import { hasAvailabilitySoon } from "@/lib/schedule"
import { useDemoStore } from "@/lib/store"
import { CLINIC_NAME, SPECIALTIES, SPECIALTY_LABEL, type Specialty } from "@/lib/types"

export function MobileSearch() {
  const data = useDemoStore((state) => state.data)
  const filters = useDemoStore((state) => state.mobileFilters)
  const setFilters = useDemoStore((state) => state.setMobileFilters)
  const [open, setOpen] = useState(false)
  const now = useMemo(() => new Date(), [])

  const results = data.professionals.filter((professional) => {
    if (!professional.active) return false
    const query = filters.query.trim().toLowerCase()
    const haystack = `${professional.name} ${SPECIALTY_LABEL[professional.specialty]} ${data.clinic.name}`.toLowerCase()
    if (query && !haystack.includes(query)) return false
    if (filters.specialty !== "all" && professional.specialty !== filters.specialty) return false
    if (filters.modality !== "all" && !professional.services.some((service) => service.modality === filters.modality)) return false
    if (professional.price < filters.priceMin || professional.price > filters.priceMax) return false
    if (professional.rating < filters.minRating) return false
    if (filters.onlyAvailable && !hasAvailabilitySoon(professional, data.appointments, data.blockedSlots, now)) return false
    return true
  })

  return (
    <div className="px-4 pt-5 pb-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="section-kicker">Catálogo</p>
          <h1 className="mt-1 text-2xl font-semibold">Buscar</h1>
          <p className="text-sm text-muted-foreground">{results.length} {results.length === 1 ? "profissional" : "profissionais"} nesta demonstração</p>
        </div>
        <Button type="button" variant="outline" size="icon" aria-label="Filtros" onClick={() => setOpen(true)}>
          <SlidersHorizontal />
        </Button>
      </div>
      <div className="relative mt-4">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={filters.query} onChange={(event) => setFilters({ query: event.target.value })} placeholder="Profissional, especialidade ou clínica" aria-label="Busca" className="h-12 rounded-2xl bg-white pl-10" />
      </div>
      <div className="mt-3 flex gap-2 overflow-x-auto phone-scroll">
        <FilterChip active={filters.modality === "all"} onClick={() => setFilters({ modality: "all" })}>Todos</FilterChip>
        <FilterChip active={filters.modality === "presencial"} onClick={() => setFilters({ modality: "presencial" })}>Presencial</FilterChip>
        <FilterChip active={filters.modality === "teleconsulta"} onClick={() => setFilters({ modality: "teleconsulta" })}>Teleconsulta demo</FilterChip>
      </div>
      <div className="mt-4 space-y-3">
        {results.length === 0 ? (
          <EmptyState icon={Search} title="Nenhum profissional encontrado" description="Altere a especialidade, o preço ou a disponibilidade para ver o catálogo de demonstração." />
        ) : results.map((professional) => (
          <Link key={professional.id} href={`/mobile/profissional/${professional.id}`} className="surface-card flex gap-3 p-4">
            <Portrait seed={professional.avatarSeed} name={professional.name} className="size-16" />
            <span className="min-w-0">
              <span className="block font-medium">{professional.name}</span>
              <span className="block text-sm text-muted-foreground">{SPECIALTY_LABEL[professional.specialty]} · {CLINIC_NAME}</span>
              <span className="mt-1 block text-sm">{formatMoney(professional.price)} · nota {professional.rating.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</span>
              <span className="mt-1 block text-xs text-muted-foreground">{professional.startHour}–{professional.endHour} · {professional.location}</span>
            </span>
          </Link>
        ))}
      </div>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="rounded-t-3xl">
          <SheetHeader><SheetTitle>Filtros da demonstração</SheetTitle></SheetHeader>
          <div className="space-y-4 px-4 pb-6">
            <Select value={filters.specialty} onValueChange={(value) => setFilters({ specialty: value as Specialty | "all" })}>
              <SelectTrigger className="h-10 w-full" aria-label="Especialidade"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as especialidades</SelectItem>
                {SPECIALTIES.map((item) => <SelectItem key={item} value={item}>{SPECIALTY_LABEL[item]}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm">
                Preço mínimo
                <Input type="number" className="mt-1 h-10" value={filters.priceMin} onChange={(event) => setFilters({ priceMin: Number(event.target.value) })} />
              </label>
              <label className="text-sm">
                Preço máximo
                <Input type="number" className="mt-1 h-10" value={filters.priceMax} onChange={(event) => setFilters({ priceMax: Number(event.target.value) })} />
              </label>
            </div>
            <label className="block text-sm">
              Avaliação mínima de demonstração
              <Select value={String(filters.minRating)} onValueChange={(value) => setFilters({ minRating: Number(value) })}>
                <SelectTrigger className="mt-1 h-10 w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Qualquer</SelectItem>
                  <SelectItem value="4">4,0 ou mais</SelectItem>
                  <SelectItem value="4.5">4,5 ou mais</SelectItem>
                </SelectContent>
              </Select>
            </label>
            <label className="flex items-center justify-between text-sm">
              Somente com horário nos próximos dias
              <Switch checked={filters.onlyAvailable} onCheckedChange={(checked) => setFilters({ onlyAvailable: checked })} />
            </label>
            <Button type="button" className="w-full" onClick={() => setOpen(false)}>Ver resultados</Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}

function FilterChip({ active, children, onClick }: { active: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={`shrink-0 rounded-full px-3 py-1.5 text-xs ${active ? "bg-primary text-primary-foreground" : "bg-white ring-1 ring-border"}`}>
      {children}
    </button>
  )
}
