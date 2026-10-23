"use client"

import Link from "next/link"
import { useState } from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { AppointmentConfirmation } from "@/components/mobile/appointment-confirmation"
import { AssociatePitch } from "@/components/mobile/associate-subscription"
import { CatalogPanel } from "@/components/mobile/catalog-panel"
import { FlowSteps } from "@/components/shared/flow-steps"
import { Logo } from "@/components/brand/logo"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { loginPatientAccount, registerPatientAccount } from "@/lib/auth/patient-actions"
import { AUTH_PASSWORD_MIN } from "@/lib/auth/constants"
import { associateQuote, findActiveAssociate } from "@/lib/associate-rules"
import { formatDate, formatMoney } from "@/lib/format"
import { cpfDigits, formatCpf, isValidCpf } from "@/lib/cpf"
import { useDemoStore } from "@/lib/store"
import type { CartLine } from "@/lib/types"

const PHONE_PATTERN = /^\(\d{2}\) \d{5}-\d{4}$/
type Stage = "catalog" | "confirm" | "pay"

export function MobileJourney() {
  const sessionId = useDemoStore((state) => state.mobileSessionPatientId)
  const lastCheckout = useDemoStore((state) => state.lastCheckout)
  const clearCheckout = useDemoStore((state) => state.clearCheckout)

  if (!sessionId) return <AccountStep />
  if (lastCheckout?.outcome === "approved" && lastCheckout.appointmentId) {
    return <AppointmentConfirmation onAnother={clearCheckout} />
  }
  return <OrderFlow />
}

function AccountStep() {
  const adoptPatientSession = useDemoStore((state) => state.adoptPatientSession)
  const city = useDemoStore((state) => state.mobileCity)
  const [mode, setMode] = useState<"create" | "login">("create")
  const [stage, setStage] = useState<"form" | "offer">("form")
  const [name, setName] = useState("")
  const [cpf, setCpf] = useState("")
  const alreadyAssociate = useDemoStore((state) => findActiveAssociate(state.associates, cpfDigits(cpf)))
  const [phone, setPhone] = useState("")
  const [email, setEmail] = useState("")
  const [birthDate, setBirthDate] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [pending, setPending] = useState(false)

  function accountError() {
    if (!isValidCpf(cpf)) return "Informe um CPF válido. Você pode digitar só os números."
    if (password.trim().length < AUTH_PASSWORD_MIN) return `A senha precisa ter ao menos ${AUTH_PASSWORD_MIN} caracteres.`
    if (mode === "login") return ""
    if (name.trim().length < 3) return "Informe o nome da conta."
    if (!PHONE_PATTERN.test(phone.trim())) return "Use um WhatsApp válido no formato (00) 00000-0000."
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return "Informe um e-mail válido. Ele é usado para recuperar a senha."
    if (!birthDate) return "Informe uma data de nascimento."
    return ""
  }

  async function createAccount() {
    const message = accountError()
    if (message) {
      setError(message)
      setStage("form")
      return
    }
    setPending(true)
    const result = mode === "create"
      ? await registerPatientAccount({ name, cpf, phone, email, birthDate, password, city })
      : await loginPatientAccount({ cpf, password })
    if (!result.ok) {
      setPending(false)
      setError(result.message)
      setStage("form")
      return
    }
    adoptPatientSession(result.patient)
    if (alreadyAssociate) {
      toast.success("Este CPF já é associado. A assinatura continua valendo.")
    }
    setPending(false)
  }

  function continueForm() {
    const message = accountError()
    setError(message)
    if (message) return
    if (mode === "login" || alreadyAssociate) {
      void createAccount()
      return
    }
    setStage("offer")
  }

  if (stage === "offer") {
    return (
      <AssociatePitch
        title="Quer ser associado?"
        lead="A associação só começa com a assinatura mensal. Se preferir agora não, a conta é criada mesmo assim e a assinatura fica nas configurações."
        stepsCurrent={1}
        primaryLabel="Criar minha conta"
        onPrimary={() => void createAccount()}
        secondaryLabel="Agora não"
        onSecondary={() => void createAccount()}
        onBack={() => setStage("form")}
        pending={pending}
      />
    )
  }

  return (
    <div className="px-4 pt-6 pb-8">
      <Logo />
      <h1 className="mt-5 text-3xl font-semibold tracking-tight">{mode === "create" ? "Crie sua conta" : "Entre na sua conta"}</h1>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">Sua conta é protegida e a senha não aparece no painel da clínica.</p>
      {mode === "create" ? (
        <div className="mt-4">
          <FlowSteps steps={["Seus dados", "Associação"]} current={0} />
        </div>
      ) : null}
      <div className="surface-card mt-4 space-y-3 p-4">
        <label className="block text-sm">CPF
          <Input className="mt-1 h-12" inputMode="numeric" placeholder="Somente números" value={cpf} onChange={(event) => setCpf(formatCpf(event.target.value))} autoComplete="off" />
        </label>
        {mode === "create" ? (
          <>
            <label className="block text-sm">Nome
              <Input className="mt-1 h-12" value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" />
            </label>
            <label className="block text-sm">WhatsApp
              <Input className="mt-1 h-12" inputMode="tel" placeholder="(86) 99000-0000" value={phone} onChange={(event) => setPhone(event.target.value)} autoComplete="tel" />
            </label>
            <label className="block text-sm">Data de nascimento
              <Input className="mt-1 h-12" type="date" value={birthDate} onChange={(event) => setBirthDate(event.target.value)} />
            </label>
            <label className="block text-sm">E-mail
              <Input className="mt-1 h-12" type="email" placeholder="voce@email.com" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" />
            </label>
          </>
        ) : null}
        <label className="block text-sm">Senha
          <Input className="mt-1 h-12" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={mode === "create" ? "new-password" : "current-password"} />
        </label>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <Button type="button" className="h-12 w-full" disabled={pending} onClick={continueForm}>
          {pending ? <Loader2 className="animate-spin" /> : null}
          {mode === "create" ? "Continuar" : "Entrar"}
        </Button>
        <Link href="/auth/recuperar" className="block w-full text-center text-sm text-teal">Esqueci a senha</Link>
        <button type="button" className="w-full text-sm text-teal" onClick={() => { setMode(mode === "create" ? "login" : "create"); setError("") }}>
          {mode === "create" ? "Já tenho conta" : "Criar uma conta"}
        </button>
      </div>
    </div>
  )
}

function OrderFlow() {
  const [stage, setStage] = useState<Stage>("catalog")
  const [cart, setCart] = useState<CartLine[]>([])

  if (stage === "confirm") {
    return <ConfirmStep cart={cart} onBack={() => setStage("catalog")} onRemove={(key) => setCart((current) => current.filter((item) => item.key !== key))} onContinue={() => setStage("pay")} />
  }
  if (stage === "pay") {
    return <PaymentStep cart={cart} onBack={() => setStage("confirm")} />
  }
  return <CatalogPanel cart={cart} onChange={setCart} onReview={() => setStage("confirm")} />
}

function ConfirmStep({
  cart,
  onBack,
  onRemove,
  onContinue,
}: {
  cart: CartLine[]
  onBack: () => void
  onRemove: (key: string) => void
  onContinue: () => void
}) {
  const quote = useAssociateContext()
  const professionals = useDemoStore((state) => state.data.professionals)
  const total = cart.reduce((sum, item) => sum + lineAmount(item, quote), 0)
  const listTotal = cart.reduce((sum, item) => sum + item.price, 0)
  const discount = listTotal - total

  return (
    <div className="px-4 pt-6 pb-8">
      <button type="button" onClick={onBack} className="text-sm text-teal">Voltar ao carrinho</button>
      <div className="mt-3">
        <FlowSteps steps={["Carrinho", "Confirmar", "Pagar"]} current={1} />
      </div>
      <h1 className="mt-4 text-2xl font-semibold">Confirme o pedido</h1>
      <p className="mt-1 text-sm text-muted-foreground">Revise cada item, o horário e o valor antes de pagar.</p>
      <ul className="mt-4 space-y-2">
        {cart.map((item) => {
          const professional = professionals.find((person) => person.id === item.professionalId)
          const charged = lineAmount(item, quote)
          return (
            <li key={item.key} className="surface-card p-4">
              <p className="text-xs font-medium text-teal">{item.kind === "exame" ? "Exame" : item.kind === "cirurgia" ? "Cirurgia" : "Consulta"} · {item.durationMin} min</p>
              <p className="mt-1 font-medium">{item.serviceName}</p>
              <p className="text-sm text-muted-foreground">{professional?.name}</p>
              <p className="text-sm text-muted-foreground">{formatDate(`${item.date}T12:00:00`, "EEEE, d 'de' MMMM")} às {item.time}</p>
              <div className="mt-3 flex items-center justify-between border-t pt-3">
                <span>
                  {charged !== item.price ? <span className="mr-2 text-xs text-muted-foreground line-through">{formatMoney(item.price)}</span> : null}
                  <span className="font-semibold">{formatMoney(charged)}</span>
                </span>
                <button type="button" className="text-sm text-destructive" onClick={() => onRemove(item.key)}>Tirar</button>
              </div>
            </li>
          )
        })}
      </ul>
      {cart.length === 0 ? <p className="surface-card mt-4 px-4 py-3 text-sm text-muted-foreground">O carrinho ficou vazio.</p> : null}
      <div className="mt-4 rounded-[1.6rem] bg-brand p-4 text-white">
        <p className="text-sm text-white/70">{discount > 0 ? `De ${formatMoney(listTotal)} com desconto de associado` : `${cart.length} ${cart.length === 1 ? "item" : "itens"}`}</p>
        <p className="text-2xl font-semibold">{formatMoney(total)}</p>
      </div>
      <Button type="button" className="mt-5 h-12 w-full" disabled={cart.length === 0} onClick={onContinue}>
        Confirmar e pagar
      </Button>
    </div>
  )
}

function PaymentStep({ cart, onBack }: { cart: CartLine[]; onBack: () => void }) {
  const quote = useAssociateContext()
  const total = cart.reduce((sum, item) => sum + lineAmount(item, quote), 0)
  const [processing, setProcessing] = useState(false)
  const [charges, setCharges] = useState<Array<{ value: number; invoiceUrl: string | null; pix: { payload: string | null; encodedImage: string | null } | null }> | null>(null)

  async function pay() {
    setProcessing(true)
    try {
      const response = await fetch("/api/payments/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lines: cart.map(({ professionalId, serviceId, date, time }) => ({ professionalId, serviceId, date, time })) }),
      })
      const body = await response.json() as { error?: string; charges?: Array<{ value: number; invoiceUrl: string | null; pix: { payload: string | null; encodedImage: string | null } | null }> }
      if (!response.ok || !body.charges) {
        toast.error(body.error || "Não foi possível gerar o Pix.")
        return
      }
      setCharges(body.charges)
    } finally {
      setProcessing(false)
    }
  }

  return (
    <section className="px-4 pt-6 pb-8">
      <button type="button" onClick={onBack} className="text-sm text-teal">Voltar para a confirmação</button>
      <div className="mt-3">
        <FlowSteps steps={["Carrinho", "Confirmar", "Pagar"]} current={2} />
      </div>
      <h1 className="mt-4 text-2xl font-semibold">Pagamento</h1>
      <p className="mt-1 text-sm text-muted-foreground">O Pix é gerado pela Asaas. A consulta fica pendente até a confirmação do pagamento.</p>
      <div className="surface-card mt-4 p-4">
        <ul className="space-y-2 text-sm">
          {cart.map((item) => (
            <li key={item.key} className="flex items-start justify-between gap-3">
              <span className="min-w-0">
                <span className="block font-medium">{item.serviceName}</span>
                <span className="block text-xs text-muted-foreground">{formatDate(`${item.date}T12:00:00`, "dd/MM")} às {item.time}</span>
              </span>
              <span className="shrink-0 font-medium">{formatMoney(lineAmount(item, quote))}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 border-t pt-3 text-2xl font-semibold">{formatMoney(total)}</p>
      </div>
      {charges ? (
        <div className="mt-4 space-y-4">
          {charges.map((charge, index) => (
            <section key={index} className="surface-card p-4">
              <p className="font-medium">Pix {charges.length > 1 ? `${index + 1} de ${charges.length}` : ""} · {formatMoney(charge.value)}</p>
              {charge.pix?.encodedImage ? <img className="mx-auto mt-3 size-52" src={`data:image/png;base64,${charge.pix.encodedImage}`} alt="QR Code Pix" /> : null}
              {charge.pix?.payload ? <Button type="button" variant="outline" className="mt-3 w-full" onClick={() => void navigator.clipboard.writeText(charge.pix?.payload || "").then(() => toast.success("Código Pix copiado."))}>Copiar código Pix</Button> : null}
              {charge.invoiceUrl ? <Button asChild className="mt-3 w-full"><a href={charge.invoiceUrl} target="_blank" rel="noreferrer">Abrir cobrança</a></Button> : null}
            </section>
          ))}
          <p className="text-center text-sm text-muted-foreground">Após o pagamento, a Asaas confirma automaticamente a cobrança.</p>
        </div>
      ) : <Button type="button" className="mt-5 h-12 w-full" disabled={processing || cart.length === 0} onClick={() => void pay()}>
        {processing ? <Loader2 className="animate-spin" /> : null}
        Gerar Pix
      </Button>}
    </section>
  )
}

function useAssociateContext() {
  const associates = useDemoStore((state) => state.associates)
  const rules = useDemoStore((state) => state.associateRules)
  const patientId = useDemoStore((state) => state.mobileSessionPatientId)
  const patient = useDemoStore((state) => state.data.patients.find((item) => item.id === patientId))
  const associate = patient ? findActiveAssociate(associates, patient.cpf) : null
  return { rules, associate }
}

function lineAmount(line: CartLine, quote: ReturnType<typeof useAssociateContext>) {
  if (line.kind !== "consulta") return line.price
  return associateQuote(line.price, quote.rules, quote.associate).amount
}
