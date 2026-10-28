import Link from "next/link"
import {
  CalendarCheck2,
  CheckCircle2,
  ChevronRight,
  Clock3,
  CreditCard,
  HeartPulse,
  LockKeyhole,
  MapPin,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  Stethoscope,
  UserRound,
} from "lucide-react"

import { Logo } from "@/components/brand/logo"

const BENEFITS = [
  {
    icon: Search,
    title: "Encontre o cuidado certo",
    text: "Veja médicos, especialidades, exames e horários disponíveis em um só lugar.",
    tone: "bg-[#e7f4f1] text-[#0d736d]",
  },
  {
    icon: CalendarCheck2,
    title: "Agende sem complicação",
    text: "Escolha o profissional, o melhor horário e acompanhe tudo pelo celular.",
    tone: "bg-[#e9eff8] text-[#315f8c]",
  },
  {
    icon: CreditCard,
    title: "Pague com segurança",
    text: "Consulte valores antes de confirmar e encontre suas cobranças na própria conta.",
    tone: "bg-[#f6eee4] text-[#986330]",
  },
  {
    icon: UserRound,
    title: "Sua saúde organizada",
    text: "Consultas, guias e dados pessoais ficam reunidos e protegidos na sua conta.",
    tone: "bg-[#f1eaf5] text-[#76518a]",
  },
]

const STEPS = [
  { number: "01", title: "Entre com seu CPF", text: "Seu cadastro da clínica acompanha você." },
  { number: "02", title: "Escolha o atendimento", text: "Compare profissionais, valores e horários." },
  { number: "03", title: "Confirme pelo celular", text: "Agende e acompanhe cada etapa com clareza." },
]

export function LandingView() {
  return (
    <main className="min-h-dvh overflow-hidden bg-[#f7faf9] text-[#102c34]">
      <section className="relative isolate overflow-hidden bg-[#082f3a] text-white">
        <div className="absolute inset-0 -z-20 bg-[radial-gradient(circle_at_72%_24%,rgba(74,180,166,0.34),transparent_30%),radial-gradient(circle_at_10%_90%,rgba(126,217,210,0.17),transparent_30%)]" />
        <div className="absolute top-24 right-[5%] -z-10 size-72 rounded-full border border-white/10 sm:size-[28rem]" />
        <div className="absolute top-40 right-[11%] -z-10 size-48 rounded-full border border-white/10 sm:size-72" />

        <header className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8 lg:px-10">
          <Logo light />
          <Link
            href="/mobile"
            className="inline-flex h-11 items-center gap-2 rounded-full bg-white px-5 text-sm font-semibold text-[#0b3944] shadow-[0_12px_32px_-16px_rgba(255,255,255,0.8)] transition hover:-translate-y-0.5 hover:bg-[#effaf8] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
          >
            Entrar <ChevronRight className="size-4" />
          </Link>
        </header>

        <div className="mx-auto grid max-w-7xl items-center gap-12 px-5 pt-12 pb-20 sm:px-8 sm:pt-16 lg:grid-cols-[1.03fr_0.97fr] lg:px-10 lg:pt-20 lg:pb-28">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/8 px-3.5 py-2 text-xs font-medium text-[#aee9e3] backdrop-blur">
              <Sparkles className="size-3.5" /> Cuidado simples, próximo e seguro
            </div>
            <h1 className="mt-6 text-[clamp(3rem,8vw,6.5rem)] leading-[0.93] font-semibold tracking-[-0.06em]">
              Sua saúde na palma da mão.
            </h1>
            <p className="mt-7 max-w-xl text-base leading-7 text-white/70 sm:text-lg sm:leading-8">
              Encontre profissionais, marque consultas, acompanhe pagamentos e cuide da sua conta em um único aplicativo.
            </p>
            <div className="mt-8 flex flex-wrap gap-x-5 gap-y-3 text-sm text-white/75">
              <span className="inline-flex items-center gap-2"><CheckCircle2 className="size-4 text-[#7ed9d2]" /> Médicos e especialidades</span>
              <span className="inline-flex items-center gap-2"><CheckCircle2 className="size-4 text-[#7ed9d2]" /> Agendamento fácil</span>
              <span className="inline-flex items-center gap-2"><CheckCircle2 className="size-4 text-[#7ed9d2]" /> Conta protegida</span>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-[430px] lg:mr-0">
            <div className="absolute -top-5 -left-6 z-10 hidden items-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-medium text-[#12343d] shadow-xl sm:flex">
              <span className="grid size-8 place-items-center rounded-full bg-[#e7f4f1] text-[#127e7a]"><ShieldCheck className="size-4" /></span>
              Pagamento protegido
            </div>
            <div className="rounded-[2.7rem] border-[7px] border-white/90 bg-[#eef5f4] p-3 shadow-[0_40px_100px_-38px_rgba(0,0,0,0.75)]">
              <div className="overflow-hidden rounded-[2.05rem] bg-[#f8fbfa] text-[#16333b]">
                <div className="bg-[#0e4b57] px-5 pt-8 pb-6 text-white">
                  <div className="flex items-center justify-between text-xs text-white/65">
                    <span>Olá, tudo bem?</span>
                    <span className="grid size-8 place-items-center rounded-full bg-white/10"><HeartPulse className="size-4" /></span>
                  </div>
                  <p className="mt-5 text-2xl font-semibold tracking-tight">Como podemos cuidar de você hoje?</p>
                  <div className="mt-5 flex items-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm text-[#6b7f85] shadow-sm">
                    <Search className="size-4" /> Médico, exame ou especialidade
                  </div>
                </div>

                <div className="space-y-4 p-4">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold">Profissionais próximos</p>
                    <span className="text-xs font-medium text-[#127e7a]">Ver todos</span>
                  </div>
                  <article className="rounded-3xl border border-[#dce8e6] bg-white p-4 shadow-[0_16px_30px_-26px_rgba(8,47,58,0.6)]">
                    <div className="flex items-start gap-3">
                      <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[#dcefeb] text-[#0f746e]"><Stethoscope className="size-5" /></div>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold">Cuidado para você</p>
                        <p className="mt-0.5 text-xs text-[#6e8288]">Profissionais da unidade</p>
                        <div className="mt-2 flex gap-3 text-[11px] text-[#698087]">
                          <span className="inline-flex items-center gap-1"><Star className="size-3 fill-[#e4ac54] text-[#e4ac54]" /> Bem avaliados</span>
                          <span className="inline-flex items-center gap-1"><MapPin className="size-3" /> Perto de você</span>
                        </div>
                      </div>
                    </div>
                  </article>
                  <article className="rounded-3xl bg-[#e5f3f1] p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-medium text-[#127e7a]">PRÓXIMO PASSO</p>
                        <p className="mt-1 font-semibold">Escolha o melhor horário</p>
                      </div>
                      <span className="grid size-10 place-items-center rounded-2xl bg-white text-[#127e7a]"><Clock3 className="size-5" /></span>
                    </div>
                  </article>
                </div>
              </div>
            </div>
            <div className="absolute -right-5 -bottom-6 z-10 hidden w-52 rounded-2xl bg-[#f6e9d9] p-4 text-[#70451d] shadow-xl sm:block">
              <div className="flex items-center gap-2 text-sm font-semibold"><CreditCard className="size-4" /> Tudo organizado</div>
              <p className="mt-1 text-xs leading-5 text-[#8a623c]">Consultas e pagamentos na sua conta.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-28 lg:px-10">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold tracking-[0.18em] text-[#127e7a] uppercase">Tudo em um só lugar</p>
          <h2 className="mt-4 text-3xl leading-tight font-semibold tracking-[-0.035em] text-[#0b3540] sm:text-5xl">
            Mais tempo para você. Menos tempo resolvendo coisas.
          </h2>
        </div>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {BENEFITS.map((benefit) => {
            const Icon = benefit.icon
            return (
              <article key={benefit.title} className="group rounded-[1.8rem] border border-[#dce7e5] bg-white p-6 shadow-[0_20px_45px_-38px_rgba(8,47,58,0.55)] transition hover:-translate-y-1 hover:shadow-[0_26px_55px_-38px_rgba(8,47,58,0.7)]">
                <span className={`grid size-11 place-items-center rounded-2xl ${benefit.tone}`}><Icon className="size-5" /></span>
                <h3 className="mt-5 text-lg font-semibold tracking-tight">{benefit.title}</h3>
                <p className="mt-2 text-sm leading-6 text-[#657980]">{benefit.text}</p>
              </article>
            )
          })}
        </div>
      </section>

      <section className="border-y border-[#dce7e5] bg-white">
        <div className="mx-auto grid max-w-7xl gap-12 px-5 py-20 sm:px-8 sm:py-24 lg:grid-cols-[0.8fr_1.2fr] lg:px-10">
          <div>
            <span className="grid size-12 place-items-center rounded-2xl bg-[#0d3b4c] text-[#7ed9d2]"><LockKeyhole className="size-5" /></span>
            <h2 className="mt-6 text-3xl font-semibold tracking-[-0.035em] text-[#0b3540] sm:text-4xl">Começar é simples.</h2>
            <p className="mt-3 max-w-md text-sm leading-7 text-[#657980]">Seu CPF identifica sua ficha e mantém cada informação no lugar certo.</p>
          </div>
          <ol className="grid gap-3 sm:grid-cols-3">
            {STEPS.map((step) => (
              <li key={step.number} className="rounded-[1.7rem] bg-[#f3f7f6] p-5">
                <span className="text-xs font-semibold text-[#127e7a]">{step.number}</span>
                <h3 className="mt-8 font-semibold">{step.title}</h3>
                <p className="mt-2 text-sm leading-6 text-[#657980]">{step.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <footer className="bg-[#082f3a] px-5 py-9 text-white sm:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <Logo light />
          <p className="text-xs leading-5 text-white/55">Cuidado conectado, informações protegidas e mais tranquilidade para você.</p>
        </div>
      </footer>
    </main>
  )
}
