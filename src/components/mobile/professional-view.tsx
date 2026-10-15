"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMemo } from "react"
import { addDays } from "date-fns"
import { MapPin, Star } from "lucide-react"
import { EmptyState } from "@/components/shared/empty-state"
import { Portrait } from "@/components/shared/portrait"
import { Button } from "@/components/ui/button"
import { formatMoney, toDateKey, WEEKDAY_SHORT } from "@/lib/format"
import { availableSlots } from "@/lib/schedule"
import { useDemoStore } from "@/lib/store"
import { SPECIALTY_LABEL } from "@/lib/types"

export function ProfessionalView({ id }: { id: string }) {
  const router = useRouter()
  const data = useDemoStore((state) => state.data)
  const startBooking = useDemoStore((state) => state.startBooking)
  const professional = data.professionals.find((item) => item.id === id)
  const now = useMemo(() => new Date(), [])

  if (!professional) {
    return (
      <EmptyState
        icon={MapPin}
        title="Profissional não encontrado"
        description="Esse perfil não faz parte da demonstração atual."
        action={<Button asChild><Link href="/mobile/buscar">Voltar à busca</Link></Button>}
      />
    )
  }

  const service = professional.services[0]
  const upcoming = service
    ? Array.from({ length: 8 }, (_, index) => {
        const date = addDays(now, index)
        const slots = availableSlots({
          professional,
          service,
          dateKey: toDateKey(date),
          appointments: data.appointments,
          blockedSlots: data.blockedSlots,
          now,
        })
        return { date, slots: slots.slice(0, 3) }
      }).filter((item) => item.slots.length > 0).slice(0, 3)
    : []

  return (
    <div className="pb-4">
      <div className="bg-brand px-5 pt-6 pb-8 text-white">
        <Portrait seed={professional.avatarSeed} name={professional.name} className="size-20 ring-white/30" />
        <h1 className="mt-4 text-2xl font-semibold">{professional.name}</h1>
        <p className="text-sm text-white/75">{SPECIALTY_LABEL[professional.specialty]}</p>
        <p className="mt-3 text-xs text-white/80">{professional.credentialLabel}: {professional.credentialCode}</p>
      </div>
      <div className="-mt-4 space-y-4 px-5">
        <div className="rounded-3xl bg-white p-4 ring-1 ring-border">
          <div className="flex items-center justify-between">
            <p className="text-xl font-semibold">{formatMoney(professional.price)}</p>
            <p className="inline-flex items-center gap-1 text-sm">
              <Star className="size-4 fill-amber-400 text-amber-400" />
              {professional.rating.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
              <span className="text-xs text-muted-foreground">demo</span>
            </p>
          </div>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">{professional.bio}</p>
          <p className="mt-3 flex items-start gap-2 text-sm"><MapPin className="mt-0.5 size-4 shrink-0" /> {professional.location}</p>
          <p className="mt-2 text-xs text-muted-foreground">Atende {professional.workDays.map((day) => WEEKDAY_SHORT[day]).join(", ")}</p>
        </div>
        <section className="rounded-3xl bg-white p-4 ring-1 ring-border">
          <h2 className="font-semibold">Próximos horários</h2>
          <div className="mt-3 space-y-3">
            {upcoming.length === 0 ? <p className="text-sm text-muted-foreground">Sem horários livres nos próximos dias.</p> : null}
            {upcoming.map((item) => (
              <div key={toDateKey(item.date)}>
                <p className="text-xs text-muted-foreground">{WEEKDAY_SHORT[item.date.getDay()]} {item.date.getDate()}</p>
                <div className="mt-1 flex flex-wrap gap-2">
                  {item.slots.map((slot) => (
                    <span key={slot.time} className="rounded-full bg-accent px-3 py-1 text-xs text-primary">{slot.time}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
        <section className="space-y-2">
          {professional.reviews.map((review) => (
            <article key={review.id} className="rounded-2xl bg-white p-4 text-sm ring-1 ring-border">
              <p className="text-[11px] font-medium uppercase tracking-wide text-amber-700">Avaliação de demonstração</p>
              <p className="mt-2">{review.comment}</p>
            </article>
          ))}
        </section>
        <Button
          type="button"
          className="h-12 w-full rounded-2xl"
          onClick={() => {
            startBooking(professional.id)
            router.push("/mobile/agendamento")
          }}
        >
          Agendar consulta
        </Button>
      </div>
    </div>
  )
}
