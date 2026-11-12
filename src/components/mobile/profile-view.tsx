"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { Lock, LogIn, UserCheck, Shield } from "lucide-react"
import { toast } from "sonner"
import { AssociateAccountPanel } from "@/components/mobile/associate-subscription"
import { Portrait } from "@/components/shared/portrait"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import {
  createPasswordForExistingPatient,
  identifyPatientAccount,
  loginPatientAccount,
  logoutPatientAccount,
} from "@/lib/auth/patient-actions"
import { buildNotifications } from "@/lib/metrics"
import { maskCpf } from "@/lib/privacy"
import { useDemoStore } from "@/lib/store"
import { DEMO_CITIES } from "@/lib/types"
import { hasErrors, validatePatientInput } from "@/lib/validation"
import { isValidCpf } from "@/lib/cpf"

export function MobileProfile() {
  const data = useDemoStore((state) => state.data)
  const city = useDemoStore((state) => state.mobileCity)
  const setCity = useDemoStore((state) => state.setMobileCity)
  const updateCurrentPatient = useDemoStore((state) => state.updateCurrentPatient)
  const logoutMobileAccount = useDemoStore((state) => state.logoutMobileAccount)
  const adoptPatientSession = useDemoStore((state) => state.adoptPatientSession)
  const sessionPatientId = useDemoStore((state) => state.mobileSessionPatientId)
  const patient = data.patients.find((item) => item.id === sessionPatientId)
  const [name, setName] = useState(patient?.name ?? "")
  const [phone, setPhone] = useState(patient?.phone ?? "")
  const [email, setEmail] = useState(patient?.email ?? "")

  useEffect(() => {
    queueMicrotask(() => {
      setName(patient?.name ?? "")
      setPhone(patient?.phone ?? "")
      setEmail(patient?.email ?? "")
    })
  }, [patient?.name, patient?.phone, patient?.email])

  if (!patient) {
    return <PatientMobileLogin onAdopt={adoptPatientSession} />
  }

  const notifications = buildNotifications(data, new Date()).slice(0, 3)
  const history = data.appointments.filter((item) => item.patientId === sessionPatientId).length

  return (
    <div className="space-y-5 px-5 pt-5 pb-8">
      <div className="rounded-[1.6rem] bg-brand p-4 text-white">
        <div className="flex items-center gap-3">
          <Portrait seed={patient.name} name={patient.name} className="size-16 ring-2 ring-white/30" />
          <div>
            <p className="text-xs text-white/70">Sua conta</p>
            <h1 className="text-2xl font-semibold">{patient.name}</h1>
            <p className="text-sm text-white/75">{patient.city}</p>
          </div>
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-2xl bg-white/10 px-3 py-2">
            <dt className="text-white/60">CPF protegido</dt>
            <dd className="mt-1 font-medium">{maskCpf(patient.cpf)}</dd>
          </div>
          <div className="rounded-2xl bg-white/10 px-3 py-2">
            <dt className="text-white/60">WhatsApp</dt>
            <dd className="mt-1 font-medium">{patient.phone}</dd>
          </div>
        </dl>
      </div>
      <AssociateAccountPanel />
      <section className="surface-card space-y-3 p-4">
        <p className="text-sm font-medium">Dados da conta</p>
        <label className="block text-sm">
          Nome
          <Input className="mt-1 h-10" value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        <label className="block text-sm">
          Telefone
          <Input className="mt-1 h-10" value={phone} onChange={(event) => setPhone(event.target.value)} />
        </label>
        <label className="block text-sm">
          E-mail
          <Input className="mt-1 h-10" value={email} onChange={(event) => setEmail(event.target.value)} />
        </label>
        <Button
          type="button"
          onClick={() => {
            const errors = validatePatientInput({
              name: name.trim(),
              phone: phone.trim(),
              email: email.trim(),
              city: patient.city,
              cpf: patient.cpf,
              birthDate: patient.birthDate,
              gender: patient.gender,
              address: patient.address,
              status: patient.status,
              notes: patient.notes,
            })
            if (hasErrors(errors)) {
              toast.error(errors.phone || errors.email || errors.name || "Revise os dados informados.")
              return
            }
            updateCurrentPatient({ name: name.trim(), phone: phone.trim(), email: email.trim() })
            toast.success("Perfil atualizado.")
          }}
        >
          Salvar dados
        </Button>
      </section>
      <section className="surface-card p-4">
        <p className="text-sm font-medium">Preferências</p>
        <label className="mt-3 flex items-center justify-between text-sm">
          Lembretes de consulta
          <Switch
            checked={patient.reminderEnabled}
            onCheckedChange={(checked) => updateCurrentPatient({ reminderEnabled: checked })}
          />
        </label>
        <label className="mt-3 block text-sm">
          Cidade de atendimento
          <select
            aria-label="Cidade de atendimento"
            className="mt-1 h-10 w-full rounded-lg border bg-white px-3"
            value={city}
            onChange={(event) => setCity(event.target.value)}
          >
            {DEMO_CITIES.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
      </section>
      <section className="surface-card p-4">
        <p className="text-sm font-medium">Histórico</p>
        <p className="mt-1 text-sm text-muted-foreground">{history} consultas registradas na sua conta.</p>
        <Button asChild variant="outline" className="mt-3">
          <Link href="/mobile/consultas">Abrir consultas</Link>
        </Button>
      </section>
      <section className="space-y-2">
        <p className="text-sm font-medium">Avisos da sua conta</p>
        {notifications.map((item) => (
          <article key={item.id} className="rounded-2xl bg-muted px-4 py-3 text-sm">
            <p className="font-medium">{item.title}</p>
            <p className="text-muted-foreground">{item.body}</p>
          </article>
        ))}
      </section>
      <Button
        type="button"
        variant="outline"
        className="w-full"
        onClick={() => {
          void logoutPatientAccount()
          logoutMobileAccount()
          toast.success("Sessão encerrada.")
        }}
      >
        Sair da conta
      </Button>
    </div>
  )
}

function PatientMobileLogin({ onAdopt }: { onAdopt: (patient: any) => void }) {
  const [cpf, setCpf] = useState("")
  const [password, setPassword] = useState("")
  const [email, setEmail] = useState("")
  const [step, setStep] = useState<"cpf" | "login" | "first_access">("cpf")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  async function handleCheckCpf(e: React.FormEvent) {
    e.preventDefault()
    if (!isValidCpf(cpf)) {
      setError("Informe um CPF válido.")
      return
    }
    setLoading(true)
    setError("")
    try {
      const res = await identifyPatientAccount(cpf)
      if (!res.ok) {
        setError(res.message)
        return
      }
      if (res.state === "login") {
        setStep("login")
      } else if (res.state === "password_required") {
        setStep("first_access")
      } else {
        setError("CPF não localizado no cadastro da clínica. Cadastre-se na recepção ou realize um agendamento.")
      }
    } catch {
      setError("Não foi possível verificar seu cadastro. Tente novamente.")
    } finally {
      setLoading(false)
    }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    if (!password) {
      setError("Digite sua senha de acesso.")
      return
    }
    setLoading(true)
    setError("")
    try {
      const res = await loginPatientAccount({ cpf, password })
      if (!res.ok) {
        setError(res.message)
        return
      }
      onAdopt(res.patient)
      toast.success("Bem-vindo(a), " + res.patient.name)
    } catch {
      setError("Não foi possível acessar a conta.")
    } finally {
      setLoading(false)
    }
  }

  async function handleFirstAccess(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 6) {
      setError("A senha precisa ter no mínimo 6 caracteres.")
      return
    }
    setLoading(true)
    setError("")
    try {
      const res = await createPasswordForExistingPatient({ cpf, password, email: email.trim() || undefined })
      if (!res.ok) {
        setError(res.message)
        return
      }
      onAdopt(res.patient)
      toast.success("Senha criada com sucesso! Bem-vindo(a), " + res.patient.name)
    } catch {
      setError("Não foi possível ativar sua senha.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-5 px-5 pt-6 pb-12">
      <div className="rounded-[1.6rem] bg-brand p-5 text-white shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-white/10 text-white">
            <Shield className="size-6" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">Área do Paciente</h1>
            <p className="text-xs text-white/70">Acesse suas consultas, exames e guias</p>
          </div>
        </div>
      </div>

      <div className="surface-card space-y-4 p-5 rounded-2xl border">
        {step === "cpf" && (
          <form onSubmit={handleCheckCpf} className="space-y-4">
            <div>
              <label htmlFor="login-cpf" className="block text-sm font-medium">
                Digite seu CPF
              </label>
              <Input
                id="login-cpf"
                type="tel"
                placeholder="000.000.000-00"
                value={cpf}
                onChange={(e) => {
                  setCpf(e.target.value)
                  setError("")
                }}
                className="mt-1.5 h-11"
                required
              />
              <p className="mt-1.5 text-xs text-muted-foreground">
                Informe o mesmo CPF cadastrado na recepção ou no agendamento.
              </p>
            </div>

            {error && <p className="text-xs text-destructive">{error}</p>}

            <Button type="submit" disabled={loading} className="w-full h-11 gap-2">
              <LogIn className="size-4" />
              {loading ? "Verificando..." : "Continuar com CPF"}
            </Button>
          </form>
        )}

        {step === "login" && (
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="rounded-xl bg-muted/50 p-3 text-xs text-muted-foreground">
              CPF identificado: <span className="font-semibold text-foreground">{cpf}</span>
            </div>
            <div>
              <label htmlFor="login-password" className="block text-sm font-medium">
                Senha da sua conta
              </label>
              <Input
                id="login-password"
                type="password"
                placeholder="Sua senha cadastrada"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value)
                  setError("")
                }}
                className="mt-1.5 h-11"
                required
              />
            </div>

            {error && <p className="text-xs text-destructive">{error}</p>}

            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setStep("cpf")} className="h-11">
                Trocar CPF
              </Button>
              <Button type="submit" disabled={loading} className="flex-1 h-11 gap-2">
                <LogIn className="size-4" />
                {loading ? "Entrando..." : "Acessar conta"}
              </Button>
            </div>
          </form>
        )}

        {step === "first_access" && (
          <form onSubmit={handleFirstAccess} className="space-y-4">
            <div className="rounded-xl bg-teal/10 p-3 text-xs text-teal">
              <p className="font-medium flex items-center gap-1.5">
                <UserCheck className="size-4" /> Cadastro localizado!
              </p>
              <p className="mt-1 text-teal/90">
                Identificamos seu cadastro feito na clínica. Crie uma senha para acessar o aplicativo móvel.
              </p>
            </div>

            <div>
              <label htmlFor="first-email" className="block text-sm font-medium">
                Seu e-mail
              </label>
              <Input
                id="first-email"
                type="email"
                placeholder="seuemail@exemplo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1.5 h-11"
              />
            </div>

            <div>
              <label htmlFor="first-password" className="block text-sm font-medium">
                Crie uma senha (mínimo 6 dígitos)
              </label>
              <Input
                id="first-password"
                type="password"
                placeholder="Crie sua nova senha"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value)
                  setError("")
                }}
                className="mt-1.5 h-11"
                required
              />
            </div>

            {error && <p className="text-xs text-destructive">{error}</p>}

            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setStep("cpf")} className="h-11">
                Voltar
              </Button>
              <Button type="submit" disabled={loading} className="flex-1 h-11 gap-2">
                <Lock className="size-4" />
                {loading ? "Criando senha..." : "Criar senha e entrar"}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
