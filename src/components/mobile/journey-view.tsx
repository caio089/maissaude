"use client"

import { useMemo, useState } from "react"
import { addDays } from "date-fns"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { AppointmentConfirmation } from "@/components/mobile/appointment-confirmation"
import { Portrait } from "@/components/shared/portrait"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { hashDemoPassword } from "@/lib/demo-password"
import { formatDate, formatMoney, toDateKey, WEEKDAY_SHORT } from "@/lib/format"
import { availableSlots } from "@/lib/schedule"
import { useDemoStore } from "@/lib/store"
import { SPECIALTIES, SPECIALTY_LABEL, type PaymentMethod, type Specialty } from "@/lib/types"
import { DEMO_CARD_HINT, hasErrors, validateDemoCard } from "@/lib/validation"

const CPF_PATTERN = /^900\.\d{3}\.\d{3}-\d{2}$/
type BookStep = "specialty" | "doctor" | "slot" | "pay"

export function MobileJourney() {
  const sessionId = useDemoStore((state) => state.mobileSessionPatientId)
  const lastCheckout = useDemoStore((state) => state.lastCheckout)
  const clearCheckout = useDemoStore((state) => state.clearCheckout)

  if (!sessionId) return <AccountStep />
  if (lastCheckout?.outcome === "approved" && lastCheckout.appointmentId) {
    return <AppointmentConfirmation onAnother={clearCheckout} />
  }
  return <BookingFlow />
}

function AccountStep() {
  const registerMobileAccount = useDemoStore((state) => state.registerMobileAccount)
  const loginMobileAccount = useDemoStore((state) => state.loginMobileAccount)
  const [mode, setMode] = useState<"create" | "login">("create")
  const [name, setName] = useState("")
  const [cpf, setCpf] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [pending, setPending] = useState(false)

  async function submit() {
    setError("")
    if (!CPF_PATTERN.test(cpf.trim())) {
      setError("Use um CPF fictício começando com 900, no formato 900.000.000-00.")
      return
    }
    if (password.trim().length < 4) {
      setError("A senha de demonstração precisa ter ao menos 4 caracteres.")
      return
    }
    if (mode === "create" && name.trim().length < 3) {
      setError("Informe o nome da conta de demonstração.")
      return
    }
    setPending(true)
    const passwordHash = await hashDemoPassword(password)
    const result = mode === "create"
      ? registerMobileAccount({ name, cpf, passwordHash })
      : loginMobileAccount({ cpf, passwordHash })
    setPending(false)
    if (!result.ok) setError(result.message)
  }

  return (
    <div className="px-5 pt-8 pb-8">
      <p className="text-xs font-medium tracking-wide text-teal">CuidarSaude</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">{mode === "create" ? "Crie sua conta" : "Entre na sua conta"}</h1>
      <p className="mt-2 text-sm text-muted-foreground">CPF e senha ficam só nesta demonstração, neste navegador. A senha não aparece no painel da clínica.</p>
      <div className="mt-5 space-y-3">
        {mode === "create" ? (
          <label className="block text-sm">Nome
            <Input className="mt-1 h-12" value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" />
          </label>
        ) : null}
        <label className="block text-sm">CPF fictício
          <Input className="mt-1 h-12" inputMode="numeric" placeholder="900.200.010-10" value={cpf} onChange={(event) => setCpf(event.target.value)} autoComplete="off" />
        </label>
        <label className="block text-sm">Senha
          <Input className="mt-1 h-12" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={mode === "create" ? "new-password" : "current-password"} />
        </label>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <Button type="button" className="h-12 w-full" disabled={pending} onClick={() => void submit()}>
          {pending ? <Loader2 className="animate-spin" /> : null}
          {mode === "create" ? "Criar conta e continuar" : "Entrar e continuar"}
        </Button>
        <button type="button" className="w-full text-sm text-teal" onClick={() => { setMode(mode === "create" ? "login" : "create"); setError("") }}>
          {mode === "create" ? "Já tenho conta" : "Criar uma conta"}
        </button>
      </div>
    </div>
  )
}

function BookingFlow() {
  const data = useDemoStore((state) => state.data)
  const booking = useDemoStore((state) => state.booking)
  const patchBooking = useDemoStore((state) => state.patchBooking)
  const [step, setStep] = useState<BookStep>("specialty")
  const [specialty, setSpecialty] = useState<Specialty | null>(null)
  const now = useMemo(() => new Date(), [])
  const professional = data.professionals.find((item) => item.id === booking.professionalId) ?? null
  const service = professional?.services.find((item) => item.modality === "presencial") ?? professional?.services[0] ?? null
  const doctors = data.professionals.filter((item) => item.active && item.specialty === specialty)
  const days = Array.from({ length: 14 }, (_, index) => addDays(now, index))
  const slots = professional && service && booking.date
    ? availableSlots({ professional, service, dateKey: booking.date, appointments: data.appointments, blockedSlots: data.blockedSlots, now })
    : []

  function chooseSpecialty(next: Specialty) {
    setSpecialty(next)
    patchBooking({ professionalId: null, serviceId: null, date: null, time: null })
    setStep("doctor")
  }

  function chooseDoctor(id: string) {
    const nextProfessional = data.professionals.find((item) => item.id === id)
    const nextService = nextProfessional?.services.find((item) => item.modality === "presencial") ?? nextProfessional?.services[0]
    patchBooking({ professionalId: id, serviceId: nextService?.id ?? null, date: null, time: null })
    setStep("slot")
  }

  return (
    <div className="px-5 pt-6 pb-8">
      <Progress step={step} />
      {step === "specialty" ? (
        <section>
          <h1 className="text-2xl font-semibold">Qual especialidade?</h1>
          <div className="mt-4 grid grid-cols-2 gap-2">
            {SPECIALTIES.map((item) => (
              <button key={item} type="button" onClick={() => chooseSpecialty(item)} className="rounded-2xl bg-white px-3 py-4 text-left text-sm font-medium ring-1 ring-border">
                {SPECIALTY_LABEL[item]}
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {step === "doctor" ? (
        <section>
          <StepBack label="Especialidade" onBack={() => setStep("specialty")} />
          <h1 className="text-2xl font-semibold">Escolha o médico</h1>
          <p className="mt-1 text-sm text-muted-foreground">{specialty ? SPECIALTY_LABEL[specialty] : ""}</p>
          <div className="mt-4 space-y-2">
            {doctors.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum profissional desta especialidade no roteiro.</p> : null}
            {doctors.map((item) => (
              <button key={item.id} type="button" onClick={() => chooseDoctor(item.id)} className="flex w-full items-center gap-3 rounded-2xl bg-white p-3 text-left ring-1 ring-border">
                <Portrait seed={item.avatarSeed} name={item.name} className="size-12" />
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{item.name}</span>
                  <span className="block text-xs text-muted-foreground">{item.credentialCode}</span>
                </span>
                <span className="text-sm font-medium">{formatMoney(item.price)}</span>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {step === "slot" && professional && service ? (
        <section>
          <StepBack label="Médico" onBack={() => setStep("doctor")} />
          <h1 className="text-2xl font-semibold">Dia e horário</h1>
          <p className="mt-1 text-sm text-muted-foreground">{professional.name} · {formatMoney(service.price)}</p>
          <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
            {days.map((day) => {
              const key = toDateKey(day)
              const open = availableSlots({ professional, service, dateKey: key, appointments: data.appointments, blockedSlots: data.blockedSlots, now }).length > 0
              return (
                <button key={key} type="button" disabled={!open} onClick={() => patchBooking({ date: key, time: null })} className={`min-w-16 rounded-2xl px-3 py-2 text-center text-xs ${booking.date === key ? "bg-primary text-primary-foreground" : "bg-white ring-1 ring-border"} disabled:opacity-40`}>
                  <span className="block">{WEEKDAY_SHORT[day.getDay()]}</span>
                  <span className="block text-sm font-medium">{formatDate(day, "d")}</span>
                </button>
              )
            })}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {booking.date && slots.length === 0 ? <p className="text-sm text-muted-foreground">Sem horários livres neste dia.</p> : null}
            {slots.map((slot) => (
              <button key={slot.time} type="button" onClick={() => patchBooking({ time: slot.time })} className={`rounded-full px-3 py-1.5 text-sm ring-1 ${booking.time === slot.time ? "bg-primary text-primary-foreground ring-primary" : "bg-white ring-border"}`}>
                {slot.time}
              </button>
            ))}
          </div>
          <Button type="button" className="mt-5 h-12 w-full" disabled={!booking.date || !booking.time} onClick={() => setStep("pay")}>
            Continuar para o pagamento
          </Button>
        </section>
      ) : null}

      {step === "pay" && professional && service && booking.date && booking.time ? (
        <PaymentStep professionalName={professional.name} serviceName={service.name} price={service.price} date={booking.date} time={booking.time} onBack={() => setStep("slot")} />
      ) : null}
    </div>
  )
}

function PaymentStep({
  professionalName,
  serviceName,
  price,
  date,
  time,
  onBack,
}: {
  professionalName: string
  serviceName: string
  price: number
  date: string
  time: string
  onBack: () => void
}) {
  const simulateCheckout = useDemoStore((state) => state.simulateCheckout)
  const [method, setMethod] = useState<PaymentMethod>("pix")
  const [processing, setProcessing] = useState(false)
  const [card, setCard] = useState({ number: "", name: "", expiry: "", cvv: "" })
  const [errors, setErrors] = useState<Partial<Record<keyof typeof card, string>>>({})

  async function pay(outcome: "approved" | "declined") {
    if (method === "card" && outcome === "approved") {
      const nextErrors = validateDemoCard(card)
      setErrors(nextErrors)
      if (hasErrors(nextErrors)) return
    }
    setProcessing(true)
    await new Promise((resolve) => window.setTimeout(resolve, 900))
    const result = simulateCheckout(method, outcome)
    setCard({ number: "", name: "", expiry: "", cvv: "" })
    setProcessing(false)
    if (!result.ok) toast.error(result.message)
  }

  return (
    <section>
      <StepBack label="Horário" onBack={onBack} />
      <h1 className="text-2xl font-semibold">Pagamento simulado</h1>
      <div className="mt-4 rounded-3xl bg-white p-4 ring-1 ring-border">
        <p className="text-sm text-muted-foreground">{professionalName}</p>
        <p className="font-medium">{serviceName}</p>
        <p className="text-sm">{formatDate(`${date}T12:00:00`, "d 'de' MMMM")} às {time}</p>
        <p className="mt-2 text-2xl font-semibold">{formatMoney(price)}</p>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <button type="button" onClick={() => setMethod("pix")} className={`rounded-2xl py-3 text-sm ${method === "pix" ? "bg-primary text-primary-foreground" : "bg-white ring-1 ring-border"}`}>Pix</button>
        <button type="button" onClick={() => setMethod("card")} className={`rounded-2xl py-3 text-sm ${method === "card" ? "bg-primary text-primary-foreground" : "bg-white ring-1 ring-border"}`}>Cartão</button>
      </div>
      {method === "pix" ? (
        <p className="mt-4 rounded-2xl bg-white px-4 py-3 text-sm text-muted-foreground ring-1 ring-border">Pix ilustrativo, sem chave de cobrança. O pagamento aprovado é só da demonstração.</p>
      ) : (
        <div className="mt-4 space-y-3 rounded-3xl bg-white p-4 ring-1 ring-border">
          <label className="block text-sm">Nome fictício
            <Input className="mt-1 h-10" value={card.name} onChange={(event) => setCard({ ...card, name: event.target.value })} />
            {errors.name ? <span className="text-xs text-destructive">{errors.name}</span> : null}
          </label>
          <label className="block text-sm">Número fictício
            <Input className="mt-1 h-10" inputMode="numeric" placeholder={DEMO_CARD_HINT} value={card.number} onChange={(event) => setCard({ ...card, number: event.target.value })} />
            {errors.number ? <span className="text-xs text-destructive">{errors.number}</span> : null}
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm">Validade
              <Input className="mt-1 h-10" placeholder="12/30" value={card.expiry} onChange={(event) => setCard({ ...card, expiry: event.target.value })} />
            </label>
            <label className="block text-sm">CVV
              <Input className="mt-1 h-10" placeholder="000" value={card.cvv} onChange={(event) => setCard({ ...card, cvv: event.target.value })} />
            </label>
          </div>
        </div>
      )}
      <Button type="button" className="mt-5 h-12 w-full" disabled={processing} onClick={() => void pay("approved")}>
        {processing ? <Loader2 className="animate-spin" /> : null}
        Simular pagamento aprovado
      </Button>
    </section>
  )
}

function Progress({ step }: { step: BookStep }) {
  const labels = ["Especialidade", "Médico", "Horário", "Pagamento"]
  const index = labels.findIndex((_, item) => ["specialty", "doctor", "slot", "pay"][item] === step)
  return (
    <ol className="mb-4 flex gap-1" aria-label="Etapas do agendamento">
      {labels.map((label, item) => (
        <li key={label} className={`h-1 flex-1 rounded-full ${item <= index ? "bg-teal" : "bg-border"}`} />
      ))}
    </ol>
  )
}

function StepBack({ label, onBack }: { label: string; onBack: () => void }) {
  return (
    <button type="button" onClick={onBack} className="mb-3 text-sm text-teal">
      Voltar para {label}
    </button>
  )
}
