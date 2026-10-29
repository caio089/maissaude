"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { BadgeCheck, CreditCard, Eye, EyeOff, Loader2, QrCode } from "lucide-react"
import { toast } from "sonner"
import { AppointmentConfirmation } from "@/components/mobile/appointment-confirmation"
import { AssociatePitch } from "@/components/mobile/associate-subscription"
import { CatalogPanel } from "@/components/mobile/catalog-panel"
import { FlowSteps } from "@/components/shared/flow-steps"
import { Logo } from "@/components/brand/logo"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { createPasswordForExistingPatient, identifyPatientAccount, loginPatientAccount, registerPatientAccount } from "@/lib/auth/patient-actions"
import { AUTH_PASSWORD_MIN } from "@/lib/auth/constants"
import { associateQuote, findActiveAssociate } from "@/lib/associate-rules"
import { formatDate, formatMoney } from "@/lib/format"
import { cpfDigits, formatCpf, isValidCpf } from "@/lib/cpf"
import { isValidPhone } from "@/lib/phone"
import { useDemoStore } from "@/lib/store"
import type { CartLine } from "@/lib/types"

type Stage = "catalog" | "confirm" | "pay"
type BillingType = "PIX" | "CREDIT_CARD"
type AssociateAnswer = "yes" | "no"
type PaymentQuote = {
  associate: { active: boolean; discountPercent: number; fee: number }
  lines: Array<{ serviceId: string; listPrice: number; amount: number }>
  listTotal: number
  total: number
  discount: number
}
type ChargeResult = {
  value: number
  billingType: BillingType
  invoiceUrl: string | null
  pix: { payload: string | null; encodedImage: string | null } | null
  pixUnavailable?: boolean
}

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
  const router = useRouter()
  const adoptPatientSession = useDemoStore((state) => state.adoptPatientSession)
  const city = useDemoStore((state) => state.mobileCity)
  const [mode, setMode] = useState<"create" | "login">("create")
  const [accountKind, setAccountKind] = useState<"identify" | "new" | "existing">("identify")
  const [stage, setStage] = useState<"form" | "offer">("form")
  const [name, setName] = useState("")
  const [cpf, setCpf] = useState("")
  const alreadyAssociate = useDemoStore((state) => findActiveAssociate(state.associates, cpfDigits(cpf)))
  const [phone, setPhone] = useState("")
  const [email, setEmail] = useState("")
  const [birthDate, setBirthDate] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")
  const [pending, setPending] = useState(false)

  function accountError() {
    if (!isValidCpf(cpf)) return "Informe um CPF válido. Você pode digitar só os números."
    if (mode === "create" && accountKind === "identify") return ""
    if (password.trim().length < AUTH_PASSWORD_MIN) return `A senha precisa ter ao menos ${AUTH_PASSWORD_MIN} caracteres.`
    if (mode === "login" || accountKind === "existing") return ""
    if (name.trim().length < 3) return "Informe o nome da conta."
    if (!isValidPhone(phone)) return "Informe um WhatsApp válido com DDD. Pode digitar só os números."
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return "Informe um e-mail válido. Ele é usado para recuperar a senha."
    if (!birthDate) return "Informe uma data de nascimento."
    return ""
  }

  async function createAccount(showAssociation = false) {
    const message = accountError()
    if (message) {
      setError(message)
      setStage("form")
      return
    }
    setPending(true)
    const result = mode === "login"
      ? await loginPatientAccount({ cpf, password })
      : accountKind === "existing"
        ? await createPasswordForExistingPatient({ cpf, password })
        : await registerPatientAccount({ name, cpf, phone, email, birthDate, password, city })
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
    if (showAssociation) router.push("/mobile/perfil?associar=1")
  }

  function continueForm() {
    const message = accountError()
    setError(message)
    if (message) return
    if (mode === "create" && accountKind === "identify") {
      setPending(true)
      void identifyPatientAccount(cpf).then((result) => {
        if (!result.ok) {
          setError(result.message)
          return
        }
        if (result.state === "login") {
          setMode("login")
          setAccountKind("identify")
          setError("Este CPF já tem senha. Digite-a para entrar.")
          return
        }
        setAccountKind(result.state === "password_required" ? "existing" : "new")
        setError("")
      }).finally(() => setPending(false))
      return
    }
    if (mode === "login" || accountKind === "existing" || alreadyAssociate) {
      void createAccount()
      return
    }
    setStage("offer")
  }

  if (stage === "offer") {
    return (
      <AssociatePitch
        title="Quer ser associado?"
        lead="Veja todos os benefícios e, se quiser continuar, informe o cartão somente na página segura da Asaas. A mensalidade não aceita Pix."
        stepsCurrent={1}
        primaryLabel="Criar conta e ver assinatura"
        onPrimary={() => void createAccount(true)}
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
      <h1 className="mt-5 text-3xl font-semibold tracking-tight">{mode === "login" ? "Entre na sua conta" : accountKind === "existing" ? "Crie sua senha" : accountKind === "new" ? "Crie sua conta" : "Acesse com seu CPF"}</h1>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{accountKind === "existing" && mode === "create" ? "Encontramos seu cadastro da clínica. Crie uma senha para usar a mesma ficha no aplicativo." : "Sua conta é protegida e a senha não aparece no painel da clínica."}</p>
      {mode === "create" && accountKind === "new" ? (
        <div className="mt-4">
          <FlowSteps steps={["Seus dados", "Associação"]} current={0} />
        </div>
      ) : null}
      <form className="surface-card mt-4 space-y-3 p-4" onSubmit={(event) => { event.preventDefault(); continueForm() }}>
        <label className="block text-sm">CPF
          <Input className="mt-1 h-12" inputMode="numeric" placeholder="Somente números" value={cpf} disabled={mode === "create" && accountKind !== "identify"} onChange={(event) => setCpf(formatCpf(event.target.value))} autoComplete="username" autoFocus />
        </label>
        {mode === "create" && accountKind !== "identify" ? <button type="button" className="w-full text-left text-sm text-teal" onClick={() => { setAccountKind("identify"); setPassword(""); setError("") }}>Usar outro CPF</button> : null}
        {mode === "create" && accountKind === "new" ? (
          <>
            <label className="block text-sm">Nome
              <Input className="mt-1 h-12" value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" />
            </label>
            <label className="block text-sm">WhatsApp
              <Input className="mt-1 h-12" inputMode="tel" placeholder="Ex.: 86990000000" value={phone} onChange={(event) => setPhone(event.target.value)} autoComplete="tel" />
            </label>
            <label className="block text-sm">Data de nascimento
              <Input className="mt-1 h-12" type="date" value={birthDate} onChange={(event) => setBirthDate(event.target.value)} />
            </label>
            <label className="block text-sm">E-mail
              <Input className="mt-1 h-12" type="email" placeholder="voce@email.com" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" />
            </label>
          </>
        ) : null}
        {mode === "login" || accountKind !== "identify" ? (
          <div className="block text-sm">
            <label htmlFor="mobile-password">{accountKind === "existing" && mode === "create" ? "Crie uma senha" : "Senha"}</label>
            <span className="relative mt-1 block">
              <Input id="mobile-password" className="h-12 pr-20" type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={mode === "create" ? "new-password" : "current-password"} />
              <button type="button" className="absolute inset-y-0 right-3 inline-flex items-center gap-1 text-xs text-teal" aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"} onClick={() => setShowPassword((current) => !current)}>
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                {showPassword ? "Ocultar" : "Mostrar"}
              </button>
            </span>
          </div>
        ) : null}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <Button type="submit" className="h-12 w-full" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : null}
          {mode === "login" ? "Entrar" : accountKind === "existing" ? "Criar senha e entrar" : "Continuar"}
        </Button>
        {mode === "login" ? <Link href="/auth/recuperar" className="block w-full text-center text-sm text-teal">Esqueci a senha</Link> : null}
        <button type="button" className="w-full text-sm text-teal" onClick={() => { setMode(mode === "create" ? "login" : "create"); setAccountKind("identify"); setPassword(""); setShowPassword(false); setError("") }}>
          {mode === "create" ? "Já tenho conta" : "Criar uma conta"}
        </button>
      </form>
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
  const [quote, setQuote] = useState<PaymentQuote | null>(null)
  const [quoteError, setQuoteError] = useState("")
  const [quoteLoading, setQuoteLoading] = useState(true)
  const [associateAnswer, setAssociateAnswer] = useState<AssociateAnswer | null>(null)
  const [billingType, setBillingType] = useState<BillingType | null>(null)
  const [processing, setProcessing] = useState(false)
  const [charges, setCharges] = useState<ChargeResult[] | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    void fetch("/api/payments/cart/quote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lines: paymentLines(cart) }),
      signal: controller.signal,
    }).then(async (response) => {
      const body = await response.json() as PaymentQuote & { error?: string }
      if (!response.ok) throw new Error(body.error || "Não foi possível conferir os valores.")
      setQuote(body)
    }).catch((error: unknown) => {
      if (controller.signal.aborted) return
      setQuoteError(error instanceof Error ? error.message : "Não foi possível conferir os valores.")
    }).finally(() => {
      if (!controller.signal.aborted) setQuoteLoading(false)
    })
    return () => controller.abort()
  }, [cart])

  async function pay() {
    if (!associateAnswer) {
      toast.error("Informe se você é associado.")
      return
    }
    if (associateAnswer === "yes" && !quote?.associate.active) {
      toast.error("Não encontramos uma associação ativa para este CPF.")
      return
    }
    if (!billingType) {
      toast.error("Escolha Pix ou cartão.")
      return
    }
    setProcessing(true)
    try {
      const response = await fetch("/api/payments/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lines: paymentLines(cart), billingType, associateAnswer }),
      })
      const body = await response.json() as { error?: string; charges?: ChargeResult[]; quote?: PaymentQuote }
      if (!response.ok || !body.charges) {
        toast.error(body.error || "Não foi possível gerar o pagamento.")
        return
      }
      if (body.quote) setQuote(body.quote)
      setCharges(body.charges)
    } catch {
      toast.error("Não foi possível falar com a Asaas agora. Tente novamente.")
    } finally {
      setProcessing(false)
    }
  }

  const blockedAssociate = associateAnswer === "yes" && quote && !quote.associate.active

  return (
    <section className="px-4 pt-6 pb-8">
      <button type="button" onClick={onBack} className="text-sm text-teal">Voltar para a confirmação</button>
      <div className="mt-3">
        <FlowSteps steps={["Carrinho", "Confirmar", "Pagar"]} current={2} />
      </div>
      <h1 className="mt-4 text-2xl font-semibold">Pagamento</h1>
      <p className="mt-1 text-sm text-muted-foreground">Confirme sua associação e escolha como deseja pagar no ambiente seguro da Asaas.</p>
      <div className="surface-card mt-4 p-4">
        <ul className="space-y-2 text-sm">
          {cart.map((item) => (
            <li key={item.key} className="flex items-start justify-between gap-3">
              <span className="min-w-0">
                <span className="block font-medium">{item.serviceName}</span>
                <span className="block text-xs text-muted-foreground">{formatDate(`${item.date}T12:00:00`, "dd/MM")} às {item.time}</span>
              </span>
              <span className="shrink-0 font-medium">{formatMoney(quotedLineAmount(item, quote))}</span>
            </li>
          ))}
        </ul>
        {quoteLoading ? <p className="mt-3 border-t pt-3 text-sm text-muted-foreground">Conferindo valores e associação...</p> : null}
        {quoteError ? <p className="mt-3 border-t pt-3 text-sm text-destructive">{quoteError}</p> : null}
        {quote ? (
          <div className="mt-3 border-t pt-3">
            {quote.discount > 0 ? <p className="text-xs text-muted-foreground">De <span className="line-through">{formatMoney(quote.listTotal)}</span> com desconto de associado</p> : null}
            <p className="text-2xl font-semibold">{formatMoney(quote.total)}</p>
          </div>
        ) : null}
      </div>

      {!charges ? (
        <section className="surface-card mt-4 p-4">
          <h2 className="font-semibold">Você é associado?</h2>
          <p className="mt-1 text-sm text-muted-foreground">A resposta é confirmada pelo CPF da conta. O desconto só vale para associação ativa e para consultas.</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button type="button" variant={associateAnswer === "yes" ? "default" : "outline"} onClick={() => setAssociateAnswer("yes")}>Sim, sou</Button>
            <Button type="button" variant={associateAnswer === "no" ? "default" : "outline"} onClick={() => setAssociateAnswer("no")}>Ainda não</Button>
          </div>
          {quote?.associate.active ? (
            <p className="mt-3 flex items-start gap-2 rounded-xl bg-[#e8f4f2] p-3 text-sm text-[#234f4c]"><BadgeCheck className="mt-0.5 size-4 shrink-0" /> Associação ativa confirmada. {quote.associate.discountPercent}% de desconto nas consultas.</p>
          ) : null}
          {blockedAssociate ? (
            <div className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
              <p>Não encontramos uma associação ativa para este CPF.</p>
              <div className="mt-2 flex flex-wrap gap-3">
                <button type="button" className="font-medium underline" onClick={() => setAssociateAnswer("no")}>Continuar sem desconto</button>
                <Link href="/mobile/perfil" className="font-medium underline">Quero me associar</Link>
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      {!charges && associateAnswer && !blockedAssociate ? (
        <section className="surface-card mt-4 p-4">
          <h2 className="font-semibold">Como deseja pagar?</h2>
          <div className="mt-3 grid gap-2">
            <button type="button" data-testid="payment-method-pix" aria-pressed={billingType === "PIX"} onClick={() => setBillingType("PIX")} className={`flex items-center gap-3 rounded-2xl p-3 text-left ring-1 ${billingType === "PIX" ? "bg-[#e8f4f2] ring-teal" : "bg-white ring-border"}`}>
              <span className="grid size-11 place-items-center rounded-xl bg-[#dff2ee] text-teal"><QrCode className="size-5" /></span>
              <span><span className="block font-medium">Pix</span><span className="block text-xs text-muted-foreground">QR Code e copia e cola</span></span>
            </button>
            <button type="button" data-testid="payment-method-card" aria-pressed={billingType === "CREDIT_CARD"} onClick={() => setBillingType("CREDIT_CARD")} className={`flex items-center gap-3 rounded-2xl p-3 text-left ring-1 ${billingType === "CREDIT_CARD" ? "bg-[#e9eef8] ring-[#365f8b]" : "bg-white ring-border"}`}>
              <span className="grid size-11 place-items-center rounded-xl bg-[#e9eef8] text-[#365f8b]"><CreditCard className="size-5" /></span>
              <span><span className="block font-medium">Cartão</span><span className="block text-xs text-muted-foreground">Dados preenchidos na página protegida da Asaas</span></span>
            </button>
          </div>
          <Button type="button" className="mt-4 h-12 w-full" disabled={processing || !billingType || !quote || cart.length === 0} onClick={() => void pay()}>
            {processing ? <Loader2 className="animate-spin" /> : null}
            {billingType === "PIX" ? "Gerar Pix" : billingType === "CREDIT_CARD" ? "Continuar para o cartão" : "Escolha a forma de pagamento"}
          </Button>
        </section>
      ) : null}

      {charges ? (
        <div className="mt-4 space-y-4">
          {charges.map((charge, index) => (
            <section key={index} className="surface-card p-4">
              <p className="font-medium">{charge.billingType === "PIX" ? "Pix" : "Cartão"} {charges.length > 1 ? `${index + 1} de ${charges.length}` : ""} · {formatMoney(charge.value)}</p>
              {charge.pix?.encodedImage ? <img className="mx-auto mt-3 size-52" src={`data:image/png;base64,${charge.pix.encodedImage}`} alt="QR Code Pix" /> : null}
              {charge.pix?.payload ? <Button type="button" variant="outline" className="mt-3 w-full" onClick={() => void navigator.clipboard.writeText(charge.pix?.payload || "").then(() => toast.success("Código Pix copiado."))}>Copiar código Pix</Button> : null}
              {charge.pixUnavailable ? <p className="mt-3 rounded-xl bg-muted p-3 text-sm">O QR Code não carregou agora. Use o link da cobrança abaixo.</p> : null}
              {charge.invoiceUrl ? <Button asChild className="mt-3 w-full"><a href={charge.invoiceUrl} target="_blank" rel="noreferrer">{charge.billingType === "CREDIT_CARD" ? "Pagar com cartão na Asaas" : "Abrir cobrança"}</a></Button> : null}
            </section>
          ))}
          <p className="text-center text-sm text-muted-foreground">Após o pagamento, a Asaas confirma automaticamente a cobrança.</p>
        </div>
      ) : null}
    </section>
  )
}

function paymentLines(cart: CartLine[]) {
  return cart.map(({ professionalId, serviceId, date, time }) => ({ professionalId, serviceId, date, time }))
}

function quotedLineAmount(line: CartLine, quote: PaymentQuote | null) {
  return quote?.lines.find((item) => item.serviceId === line.serviceId)?.amount ?? line.price
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
