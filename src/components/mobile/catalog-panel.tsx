"use client"

import { useMemo, useState } from "react"
import { addDays } from "date-fns"
import {
  ArrowLeft,
  CalendarDays,
  ChevronRight,
  Clock3,
  HeartPulse,
  MonitorSmartphone,
  Search,
  ShoppingBag,
  Stethoscope,
  Syringe,
  UserRoundSearch,
} from "lucide-react"
import { Portrait } from "@/components/shared/portrait"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { findActiveAssociate } from "@/lib/associate-rules"
import { cartLineKey, firstOfferForProfessional, offersFor, type CatalogOffer } from "@/lib/mobile-catalog"
import { formatDate, formatMoney, toDateKey, WEEKDAY_SHORT } from "@/lib/format"
import { availableSlots } from "@/lib/schedule"
import { useDemoStore } from "@/lib/store"
import { SPECIALTY_LABEL, type CartLine, type CatalogKind, type Modality, type Professional, type Service } from "@/lib/types"

type FlowScreen = "home" | "modality" | "offers" | "slot"

const KIND_COPY: Record<CatalogKind, { label: string; description: string; icon: typeof Stethoscope; tone: string }> = {
  consulta: {
    label: "Consulta",
    description: "Escolha a especialidade ou o médico",
    icon: Stethoscope,
    tone: "bg-[#dff2ee] text-[#0f766e]",
  },
  exame: {
    label: "Exames",
    description: "Encontre o exame e veja os horários",
    icon: Syringe,
    tone: "bg-[#e9eef8] text-[#365f8b]",
  },
  cirurgia: {
    label: "Cirurgias",
    description: "Consulte procedimentos disponíveis",
    icon: HeartPulse,
    tone: "bg-[#f7ebdf] text-[#9a6230]",
  },
}

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
  const [screen, setScreen] = useState<FlowScreen>("home")
  const [kind, setKind] = useState<CatalogKind>("consulta")
  const [modality, setModality] = useState<Modality | "all">("all")
  const [query, setQuery] = useState("")
  const [draft, setDraft] = useState<CatalogOffer | null>(null)
  const active = professionals.filter((item) => item.active)
  const firstName = patient?.name.split(" ")[0] ?? "você"

  const visibleOffers = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("pt-BR")
    return offersFor(kind, professionals).filter((offer) => {
      const professional = professionalFor(offer, professionals)
      const service = serviceForOffer(offer, professionals)
      if (!professional || !service) return false
      if (kind === "consulta" && modality !== "all" && service.modality !== modality) return false
      const haystack = `${offer.serviceName} ${professional.name} ${SPECIALTY_LABEL[professional.specialty]}`.toLocaleLowerCase("pt-BR")
      return !normalized || haystack.includes(normalized)
    })
  }, [kind, modality, professionals, query])

  function startKind(nextKind: CatalogKind) {
    setKind(nextKind)
    setQuery("")
    setDraft(null)
    if (nextKind === "consulta") {
      setModality("all")
      setScreen("modality")
    } else {
      setModality("all")
      setScreen("offers")
    }
  }

  function addLine(line: CartLine) {
    if (!cart.some((item) => item.key === line.key)) onChange([...cart, line])
    setDraft(null)
    setQuery("")
    setScreen("home")
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-4 pb-5">
        {screen === "home" ? (
          <StartScreen
            firstName={firstName}
            associate={Boolean(associate)}
            professionals={active}
            onKind={startKind}
            onProfessional={(offer) => {
              setKind(offer.kind)
              setModality("all")
              setDraft(offer)
              setScreen("slot")
            }}
          />
        ) : null}

        {screen === "modality" ? (
          <ModalityScreen
            onBack={() => setScreen("home")}
            onSelect={(nextModality) => {
              setModality(nextModality)
              setScreen("offers")
            }}
          />
        ) : null}

        {screen === "offers" ? (
          <OffersScreen
            kind={kind}
            modality={modality}
            query={query}
            offers={visibleOffers}
            professionals={professionals}
            onQuery={setQuery}
            onBack={() => setScreen(kind === "consulta" ? "modality" : "home")}
            onSelect={(offer) => {
              setDraft(offer)
              setScreen("slot")
            }}
          />
        ) : null}

        {screen === "slot" && draft ? (
          <SlotPicker
            offer={draft}
            professionals={professionals}
            onBack={() => {
              setDraft(null)
              setScreen("offers")
            }}
            onAdd={addLine}
          />
        ) : null}
      </div>
      <CartDock cart={cart} onRemove={(key) => onChange(cart.filter((item) => item.key !== key))} onReview={onReview} />
    </div>
  )
}

function StartScreen({
  firstName,
  associate,
  professionals,
  onKind,
  onProfessional,
}: {
  firstName: string
  associate: boolean
  professionals: Professional[]
  onKind: (kind: CatalogKind) => void
  onProfessional: (offer: CatalogOffer) => void
}) {
  return (
    <>
      <header className="rounded-[1.8rem] bg-brand px-5 py-5 text-white shadow-[0_18px_38px_-28px_rgba(12,47,61,0.9)]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs text-white/70">Olá, {firstName}</p>
            <h1 className="mt-1 text-2xl font-semibold leading-tight">O que você quer agendar?</h1>
          </div>
          {associate ? <span className="rounded-full bg-white/15 px-2.5 py-1 text-[11px]">Associado</span> : null}
        </div>
        <p className="mt-2 text-sm leading-5 text-white/72">Escolha uma opção e veja somente o que precisa em cada etapa.</p>
      </header>

      <section className="mt-5">
        <p className="text-xs font-semibold tracking-[0.12em] text-muted-foreground uppercase">Agendamento rápido</p>
        <div className="mt-3 space-y-2.5">
          {(Object.keys(KIND_COPY) as CatalogKind[]).map((item) => {
            const copy = KIND_COPY[item]
            const Icon = copy.icon
            return (
              <button key={item} type="button" data-testid={`booking-kind-${item}`} onClick={() => onKind(item)} className="surface-card flex w-full items-center gap-3 p-3.5 text-left transition active:scale-[0.99]">
                <span className={`grid size-12 shrink-0 place-items-center rounded-2xl ${copy.tone}`}><Icon className="size-5" /></span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{copy.label}</span>
                  <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">{copy.description}</span>
                </span>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
              </button>
            )
          })}
        </div>
      </section>

      <section className="mt-6">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold tracking-[0.12em] text-muted-foreground uppercase">Já sabe quem quer?</p>
            <h2 className="mt-1 font-semibold">Escolha o médico direto</h2>
          </div>
          <UserRoundSearch className="size-5 text-teal" />
        </div>
        <div className="mt-3 flex gap-3 overflow-x-auto phone-scroll pb-1">
          {professionals.map((professional) => {
            const consultationOffers = offersFor("consulta", [professional])
            const offer = consultationOffers.find((item) => serviceForOffer(item, [professional])?.modality === "presencial")
              ?? consultationOffers[0]
              ?? firstOfferForProfessional(professional)
            if (!offer) return null
            return (
              <button key={professional.id} type="button" data-testid="direct-professional" onClick={() => onProfessional(offer)} className="w-40 shrink-0 rounded-[1.5rem] bg-white p-3 text-left ring-1 ring-border">
                <Portrait seed={professional.avatarSeed} name={professional.name} className="size-12" />
                <span className="mt-3 block truncate text-sm font-semibold">{professional.name}</span>
                <span className="mt-0.5 block truncate text-xs text-muted-foreground">{SPECIALTY_LABEL[professional.specialty]}</span>
                <span className="mt-2 block truncate text-xs font-medium text-teal">{offer.serviceName} · ver horários</span>
              </button>
            )
          })}
        </div>
      </section>
    </>
  )
}

function ModalityScreen({ onBack, onSelect }: { onBack: () => void; onSelect: (modality: Modality) => void }) {
  return (
    <section>
      <FlowHeader step="1 de 4" title="Como quer ser atendido?" description="Você poderá escolher o médico na próxima etapa." onBack={onBack} />
      <div className="mt-5 space-y-3">
        <button type="button" onClick={() => onSelect("presencial")} className="surface-card flex w-full items-center gap-4 p-4 text-left">
          <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-[#dff2ee] text-[#0f766e]"><Stethoscope className="size-6" /></span>
          <span className="flex-1">
            <span className="block font-semibold">Consulta presencial</span>
            <span className="mt-1 block text-sm leading-5 text-muted-foreground">Atendimento na unidade com o profissional.</span>
          </span>
          <ChevronRight className="size-5 text-muted-foreground" />
        </button>
        <button type="button" onClick={() => onSelect("teleconsulta")} className="surface-card flex w-full items-center gap-4 p-4 text-left">
          <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-[#e9eef8] text-[#365f8b]"><MonitorSmartphone className="size-6" /></span>
          <span className="flex-1">
            <span className="block font-semibold">Consulta por vídeo</span>
            <span className="mt-1 block text-sm leading-5 text-muted-foreground">Converse com o profissional pelo celular.</span>
          </span>
          <ChevronRight className="size-5 text-muted-foreground" />
        </button>
      </div>
      <div className="mt-6 rounded-2xl bg-[#edf6f4] px-4 py-3 text-sm leading-6 text-[#295e59]">
        Não sabe qual médico escolher? Pesquise pelo nome da especialidade na próxima tela.
      </div>
    </section>
  )
}

function OffersScreen({
  kind,
  modality,
  query,
  offers,
  professionals,
  onQuery,
  onBack,
  onSelect,
}: {
  kind: CatalogKind
  modality: Modality | "all"
  query: string
  offers: CatalogOffer[]
  professionals: Professional[]
  onQuery: (query: string) => void
  onBack: () => void
  onSelect: (offer: CatalogOffer) => void
}) {
  const heading = kind === "consulta" ? "Escolha o médico" : kind === "exame" ? "Escolha o exame" : "Escolha o procedimento"
  const placeholder = kind === "consulta" ? "Médico ou especialidade" : kind === "exame" ? "Nome do exame" : "Nome do procedimento"
  return (
    <section>
      <FlowHeader
        step={kind === "consulta" ? "2 de 4" : "1 de 3"}
        title={heading}
        description={kind === "consulta" ? (modality === "teleconsulta" ? "Consulta por vídeo" : "Consulta presencial") : "Toque em uma opção para ver datas e horários."}
        onBack={onBack}
      />
      <div className="relative mt-4">
        <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={query} onChange={(event) => onQuery(event.target.value)} placeholder={placeholder} className="h-12 rounded-2xl bg-white pl-10" />
      </div>
      <p className="mt-3 text-xs text-muted-foreground">{offers.length} {offers.length === 1 ? "opção disponível" : "opções disponíveis"}</p>
      <ul className="mt-3 space-y-2.5">
        {offers.map((offer) => {
          const professional = professionalFor(offer, professionals)
          if (!professional) return null
          return (
            <li key={`${offer.professionalId}-${offer.serviceId}`}>
              <button type="button" data-testid="booking-offer" onClick={() => onSelect(offer)} className="surface-card flex w-full items-center gap-3 p-3.5 text-left">
                <Portrait seed={professional.avatarSeed} name={professional.name} className="size-14 shrink-0" />
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-medium text-teal">{kind === "consulta" ? SPECIALTY_LABEL[professional.specialty] : offer.serviceName}</span>
                  <span className="mt-0.5 block truncate font-semibold">{professional.name}</span>
                  <span className="mt-1 block text-xs text-muted-foreground">{offer.durationMin} min · a partir de {formatMoney(offer.price)}</span>
                </span>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
              </button>
            </li>
          )
        })}
      </ul>
      {offers.length === 0 ? (
        <div className="mt-4 rounded-2xl bg-white p-4 text-center ring-1 ring-border">
          <p className="font-medium">Nenhuma opção encontrada</p>
          <p className="mt-1 text-sm text-muted-foreground">Tente outro nome ou volte para escolher outro tipo de atendimento.</p>
        </div>
      ) : null}
    </section>
  )
}

function SlotPicker({
  offer,
  professionals,
  onBack,
  onAdd,
}: {
  offer: CatalogOffer
  professionals: Professional[]
  onBack: () => void
  onAdd: (line: CartLine) => void
}) {
  const data = useDemoStore((state) => state.data)
  const professional = professionalFor(offer, professionals)
  const [date, setDate] = useState<string | null>(null)
  const [time, setTime] = useState<string | null>(null)
  const now = useMemo(() => new Date(), [])
  const service = serviceForOffer(offer, professionals) ?? syntheticService(offer)
  const days = Array.from({ length: 14 }, (_, index) => addDays(now, index))
  const slots = professional && date
    ? availableSlots({ professional, service, dateKey: date, appointments: data.appointments, blockedSlots: data.blockedSlots, now })
    : []

  if (!professional) return null

  return (
    <section>
      <FlowHeader step={offer.kind === "consulta" ? "3 de 4" : "2 de 3"} title="Escolha dia e horário" description="Mostramos apenas os horários livres." onBack={onBack} />
      <div className="surface-card mt-4 flex items-center gap-3 p-3.5">
        <Portrait seed={professional.avatarSeed} name={professional.name} className="size-14" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{professional.name}</p>
          <p className="text-xs text-muted-foreground">{offer.serviceName} · {formatMoney(offer.price)}</p>
          <p className="mt-1 text-xs text-muted-foreground">{professional.location}</p>
        </div>
      </div>

      <div className="mt-5 flex items-center gap-2 text-sm font-semibold"><CalendarDays className="size-4 text-teal" /> Escolha o dia</div>
      <div className="mt-3 flex gap-2 overflow-x-auto phone-scroll pb-1">
        {days.map((day) => {
          const key = toDateKey(day)
          const open = availableSlots({ professional, service, dateKey: key, appointments: data.appointments, blockedSlots: data.blockedSlots, now }).length > 0
          return (
            <button key={key} type="button" data-testid="booking-date" aria-label={`Agendar em ${formatDate(day, "d 'de' MMMM")}`} disabled={!open} onClick={() => { setDate(key); setTime(null) }} className={`w-16 shrink-0 rounded-2xl px-2 py-3 text-center ${date === key ? "bg-primary text-primary-foreground shadow-sm" : "bg-white ring-1 ring-border"} disabled:opacity-35`}>
              <span className="block text-[11px]">{WEEKDAY_SHORT[day.getDay()]}</span>
              <span className="mt-1 block text-lg font-semibold">{day.getDate()}</span>
              <span className="block text-[10px]">{formatDate(day, "MMM")}</span>
            </button>
          )
        })}
      </div>

      <div className="mt-5 flex items-center gap-2 text-sm font-semibold"><Clock3 className="size-4 text-teal" /> Escolha o horário</div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {!date ? <p className="col-span-3 rounded-2xl bg-white p-4 text-sm text-muted-foreground ring-1 ring-border">Primeiro escolha um dia disponível.</p> : null}
        {date && slots.length === 0 ? <p className="col-span-3 rounded-2xl bg-white p-4 text-sm text-muted-foreground ring-1 ring-border">Não há horários livres nesse dia.</p> : null}
        {slots.map((slot) => (
          <button key={slot.time} type="button" data-testid="booking-time" aria-label={`Horário ${slot.time}`} onClick={() => setTime(slot.time)} className={`rounded-2xl py-3 text-sm font-medium ${time === slot.time ? "bg-primary text-primary-foreground" : "bg-white ring-1 ring-border"}`}>
            {slot.time}
          </button>
        ))}
      </div>

      {date && time ? (
        <div className="mt-5 rounded-2xl bg-[#e8f4f2] p-4 text-sm text-[#234f4c]">
          <p className="font-semibold">Seu horário</p>
          <p className="mt-1">{formatDate(`${date}T12:00:00`, "EEEE, d 'de' MMMM")} às {time}</p>
        </div>
      ) : null}

      <Button
        type="button"
        className="mt-5 h-12 w-full rounded-2xl"
        disabled={!date || !time}
        onClick={() => {
          if (!date || !time) return
          onAdd({ ...offer, key: cartLineKey({ ...offer, date, time }), date, time })
        }}
      >
        Escolher este horário
      </Button>
    </section>
  )
}

function FlowHeader({ step, title, description, onBack }: { step: string; title: string; description: string; onBack: () => void }) {
  return (
    <header>
      <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 text-sm font-medium text-teal"><ArrowLeft className="size-4" /> Voltar</button>
      <p className="mt-5 text-xs font-semibold tracking-[0.12em] text-teal uppercase">Etapa {step}</p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p>
    </header>
  )
}

function CartDock({ cart, onRemove, onReview }: { cart: CartLine[]; onRemove: (key: string) => void; onReview: () => void }) {
  const total = cart.reduce((sum, item) => sum + item.price, 0)
  if (cart.length === 0) return null

  return (
    <aside className="shrink-0 border-t bg-white px-4 py-3 shadow-[0_-16px_30px_-24px_rgba(12,47,61,0.7)]" aria-label="Itens escolhidos">
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-sm font-medium"><ShoppingBag className="size-4 text-teal" /> {cart.length} {cart.length === 1 ? "agendamento" : "agendamentos"}</p>
        <p className="text-sm font-semibold">{formatMoney(total)}</p>
      </div>
      <div className="mt-2 flex gap-2">
        {cart.length === 1 ? <button type="button" onClick={() => onRemove(cart[0].key)} className="px-2 text-xs text-destructive">Remover</button> : null}
        <Button type="button" className="h-10 flex-1 rounded-xl" onClick={onReview}>Continuar</Button>
      </div>
    </aside>
  )
}

function professionalFor(offer: CatalogOffer, professionals: Professional[]) {
  return professionals.find((item) => item.id === offer.professionalId)
}

function serviceForOffer(offer: CatalogOffer, professionals: Professional[]) {
  return professionalFor(offer, professionals)?.services.find((item) => item.id === offer.serviceId)
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
