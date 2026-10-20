"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { addDays } from "date-fns"
import { Clock3, ShoppingBag, Star } from "lucide-react"
import { Portrait } from "@/components/shared/portrait"
import { Button } from "@/components/ui/button"
import { findActiveAssociate } from "@/lib/associate-rules"
import { cartLineKey, offersFor, type CatalogOffer } from "@/lib/mobile-catalog"
import { formatDate, formatMoney, toDateKey, WEEKDAY_SHORT } from "@/lib/format"
import { availableSlots } from "@/lib/schedule"
import { useDemoStore } from "@/lib/store"
import { SPECIALTY_LABEL, type CartLine, type CatalogKind, type Service } from "@/lib/types"

const KIND_LABEL: Record<CatalogKind, string> = {
  consulta: "Consulta",
  exame: "Exame",
  cirurgia: "Cirurgia",
}

const TABS: Array<{ id: CatalogKind | "medico"; label: string }> = [
  { id: "medico", label: "Médicos" },
  { id: "consulta", label: "Consultas" },
  { id: "exame", label: "Exames" },
  { id: "cirurgia", label: "Cirurgias" },
]

export function CatalogPanel({
  cart,
  onChange,
  onReview,
}: {
  cart: CartLine[]
  onChange: (cart: CartLine[]) => void
  onReview: () => void
}) {
  const professionals = useDemoStore((state) => state.data.professionals)
  const patientId = useDemoStore((state) => state.mobileSessionPatientId)
  const patient = useDemoStore((state) => state.data.patients.find((item) => item.id === patientId))
  const associates = useDemoStore((state) => state.associates)
  const associate = patient ? findActiveAssociate(associates, patient.cpf) : null
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("medico")
  const [draft, setDraft] = useState<CatalogOffer | null>(null)
  const active = professionals.filter((item) => item.active)
  const firstName = patient?.name.split(" ")[0] ?? "você"
  const counts = {
    medico: active.length,
    consulta: offersFor("consulta", professionals).length,
    exame: offersFor("exame", professionals).length,
    cirurgia: offersFor("cirurgia", professionals).length,
  }

  function addLine(line: CartLine) {
    if (cart.some((item) => item.key === line.key)) return
    onChange([...cart, line])
    setDraft(null)
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-4 pb-4">
        <header className="rounded-[1.6rem] bg-brand px-4 py-4 text-white">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] text-white/70">Olá, {firstName}</p>
              <h1 className="mt-1 text-xl font-semibold leading-tight">O que você precisa?</h1>
            </div>
            {associate ? <span className="rounded-full bg-white/15 px-2.5 py-1 text-[11px]">Associado</span> : null}
          </div>
          <p className="mt-2 text-sm text-white/75">Médicos, consultas, exames e cirurgias entram no carrinho abaixo.</p>
        </header>
        <div className="mt-3 grid grid-cols-4 gap-1 rounded-2xl bg-white p-1 ring-1 ring-border">
          {TABS.map((item) => (
            <button key={item.id} type="button" onClick={() => { setTab(item.id); setDraft(null) }} className={`rounded-xl px-1 py-2 text-center ${tab === item.id ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
              <span className="block text-xs font-medium">{item.label}</span>
              <span className="mt-0.5 block text-[10px] opacity-80">{counts[item.id]}</span>
            </button>
          ))}
        </div>
        {draft ? (
          <SlotPicker offer={draft} onCancel={() => setDraft(null)} onAdd={addLine} />
        ) : tab === "medico" ? (
          <ul className="mt-4 space-y-2">
            {active.map((professional) => {
              const offer = offersFor("consulta", [professional])[0]
              return (
                <li key={professional.id} className="surface-card p-3">
                  <div className="flex items-start gap-3">
                    <Portrait seed={professional.avatarSeed} name={professional.name} className="size-14" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{professional.name}</span>
                      <span className="block text-xs text-muted-foreground">{SPECIALTY_LABEL[professional.specialty]}</span>
                      <span className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                        <span className="inline-flex items-center gap-1"><Star className="size-3 text-teal" /> {professional.rating.toFixed(1)}</span>
                        <span className="inline-flex items-center gap-1"><Clock3 className="size-3" /> {professional.startHour}–{professional.endHour}</span>
                      </span>
                    </span>
                    {offer ? <span className="shrink-0 text-sm font-semibold">{formatMoney(offer.price)}</span> : null}
                  </div>
                  {offer ? <Button type="button" size="sm" className="mt-3 h-9 w-full" variant="outline" onClick={() => setDraft(offer)}>Adicionar consulta</Button> : null}
                </li>
              )
            })}
          </ul>
        ) : (
          <OfferList offers={offersFor(tab, professionals)} professionals={professionals} onAdd={setDraft} />
        )}
      </div>
      <CartDock cart={cart} onRemove={(key) => onChange(cart.filter((item) => item.key !== key))} onReview={onReview} />
    </div>
  )
}

function CartDock({
  cart,
  onRemove,
  onReview,
}: {
  cart: CartLine[]
  onRemove: (key: string) => void
  onReview: () => void
}) {
  const total = cart.reduce((sum, item) => sum + item.price, 0)

  return (
    <aside className="shrink-0 border-t bg-white px-4 py-2 shadow-[0_-16px_30px_-24px_rgba(12,47,61,0.7)]" aria-label="Carrinho">
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-sm font-medium"><ShoppingBag className="size-4 text-teal" /> Carrinho · {cart.length}</p>
        <p className="text-sm font-semibold">{formatMoney(total)}</p>
      </div>
      {cart.length === 0 ? null : (
        <ul className="mt-2 max-h-24 space-y-1.5 overflow-y-auto">
          {cart.map((item) => (
            <li key={item.key} className="flex items-center justify-between gap-3 rounded-xl bg-muted px-3 py-2 text-sm">
              <span className="min-w-0">
                <span className="block truncate font-medium">{item.serviceName}</span>
                <span className="block text-xs text-muted-foreground">{KIND_LABEL[item.kind]} · {formatDate(`${item.date}T12:00:00`, "dd/MM")} às {item.time}</span>
              </span>
              <span className="flex shrink-0 items-center gap-2">
                <span className="font-medium">{formatMoney(item.price)}</span>
                <button type="button" className="text-xs text-destructive" onClick={() => onRemove(item.key)}>Tirar</button>
              </span>
            </li>
          ))}
        </ul>
      )}
      <Button type="button" className="mt-2 h-10 w-full" disabled={cart.length === 0} onClick={onReview}>
        {cart.length === 0 ? "Carrinho vazio" : "Finalizar carrinho"}
      </Button>
    </aside>
  )
}

function OfferList({
  offers,
  professionals,
  onAdd,
}: {
  offers: CatalogOffer[]
  professionals: Array<{ id: string; name: string }>
  onAdd: (offer: CatalogOffer) => void
}) {
  return (
    <ul className="mt-4 space-y-2">
      {offers.map((offer) => {
        const professional = professionals.find((item) => item.id === offer.professionalId)
        return (
          <li key={offer.serviceId} className="surface-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-medium text-teal">{KIND_LABEL[offer.kind]} · {offer.durationMin} min</p>
                <p className="mt-1 font-medium">{offer.serviceName}</p>
                <p className="mt-1 text-sm text-muted-foreground">{professional?.name}</p>
              </div>
              <p className="shrink-0 text-sm font-semibold">{formatMoney(offer.price)}</p>
            </div>
            <Button type="button" size="sm" variant="outline" className="mt-3 h-9 w-full" onClick={() => onAdd(offer)}>Adicionar</Button>
          </li>
        )
      })}
    </ul>
  )
}

function SlotPicker({
  offer,
  onCancel,
  onAdd,
}: {
  offer: CatalogOffer
  onCancel: () => void
  onAdd: (line: CartLine) => void
}) {
  const data = useDemoStore((state) => state.data)
  const professional = data.professionals.find((item) => item.id === offer.professionalId)
  const sectionRef = useRef<HTMLElement>(null)
  const addRef = useRef<HTMLDivElement>(null)
  const [date, setDate] = useState<string | null>(null)
  const [time, setTime] = useState<string | null>(null)
  const now = useMemo(() => new Date(), [])
  useEffect(() => {
    const section = sectionRef.current
    const scroller = section?.parentElement
    if (!section || !scroller) return
    const align = () => {
      const delta = section.getBoundingClientRect().top - scroller.getBoundingClientRect().top
      if (Math.abs(delta) > 1) scroller.scrollTop += delta
    }
    align()
    const frame = window.requestAnimationFrame(align)
    return () => window.cancelAnimationFrame(frame)
  }, [])
  useEffect(() => {
    if (!date || !time) return
    const target = addRef.current
    const scroller = sectionRef.current?.parentElement
    if (!target || !scroller) return
    const frame = window.requestAnimationFrame(() => {
      const overflow = target.getBoundingClientRect().bottom - scroller.getBoundingClientRect().bottom
      if (overflow > 0) scroller.scrollTop += overflow + 8
    })
    return () => window.cancelAnimationFrame(frame)
  }, [date, time])
  const service = syntheticService(offer)
  const days = Array.from({ length: 14 }, (_, index) => addDays(now, index))
  const slots = professional && date
    ? availableSlots({ professional, service, dateKey: date, appointments: data.appointments, blockedSlots: data.blockedSlots, now })
    : []

  return (
    <section ref={sectionRef} className="surface-card mt-4 p-4">
      <button type="button" onClick={onCancel} className="text-sm text-teal">Voltar para a lista</button>
      <p className="mt-3 text-xs font-medium text-teal">{KIND_LABEL[offer.kind]} · {offer.durationMin} min</p>
      <h2 className="mt-1 text-xl font-semibold">{offer.serviceName}</h2>
      <p className="text-sm text-muted-foreground">{professional?.name} · {formatMoney(offer.price)}</p>
      {professional ? <p className="mt-1 text-xs text-muted-foreground">{professional.location} · {professional.startHour} às {professional.endHour}</p> : null}
      <p className="mt-4 text-xs font-medium tracking-wide text-muted-foreground">DIA</p>
      <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
        {professional ? days.map((day) => {
          const key = toDateKey(day)
          const open = availableSlots({ professional, service, dateKey: key, appointments: data.appointments, blockedSlots: data.blockedSlots, now }).length > 0
          return (
            <button key={key} type="button" disabled={!open} onClick={() => { setDate(key); setTime(null) }} className={`min-w-16 rounded-2xl px-3 py-2 text-center text-xs ${date === key ? "bg-primary text-primary-foreground" : "bg-muted"} disabled:opacity-40`}>
              <span className="block">{WEEKDAY_SHORT[day.getDay()]}</span>
              <span className="block text-sm font-medium">{formatDate(day, "d")}</span>
            </button>
          )
        }) : null}
      </div>
      <p className="mt-4 text-xs font-medium tracking-wide text-muted-foreground">HORÁRIO</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {date && slots.length === 0 ? <p className="text-sm text-muted-foreground">Este dia não tem horário livre.</p> : null}
        {!date ? <p className="text-sm text-muted-foreground">Escolha um dia para ver os horários.</p> : null}
        {slots.map((slot) => (
          <button key={slot.time} type="button" onClick={() => setTime(slot.time)} className={`rounded-full px-3 py-1.5 text-sm ${time === slot.time ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
            {slot.time}
          </button>
        ))}
      </div>
      <div ref={addRef}>
        <Button
          type="button"
          className="mt-5 h-12 w-full"
          disabled={!date || !time}
          onClick={() => {
            if (!date || !time) return
            onAdd({ ...offer, key: cartLineKey({ ...offer, date, time }), date, time })
          }}
        >
          Colocar no carrinho
        </Button>
      </div>
    </section>
  )
}

function syntheticService(offer: CatalogOffer): Service {
  return {
    id: offer.serviceId,
    name: offer.serviceName,
    durationMin: offer.durationMin,
    price: offer.price,
    modality: "presencial",
  }
}
