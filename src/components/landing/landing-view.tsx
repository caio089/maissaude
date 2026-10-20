"use client"

import Link from "next/link"
import { ArrowRight, CalendarDays, IdCard, ShieldCheck, Smartphone, Stethoscope, Wallet } from "lucide-react"
import { Logo } from "@/components/brand/logo"
import { FadeIn } from "@/components/shared/fade-in"
import { Button } from "@/components/ui/button"

const STEPS = [
  { n: "01", title: "Conta do paciente", text: "CPF, nome, WhatsApp, nascimento e senha. Depois, se quiser, assina a associação." },
  { n: "02", title: "Catálogo e carrinho", text: "Médicos, consultas, exames e cirurgias entram no pedido com dia e horário." },
  { n: "03", title: "Pagamento e guia", text: "A pessoa confirma, paga na simulação e baixa a guia de autorização." },
  { n: "04", title: "A clínica vê na hora", text: "A reserva entra na agenda e o valor, no financeiro deste navegador." },
]

const FEATURES = [
  { icon: CalendarDays, title: "Agenda da unidade", text: "O dia, a semana e o cadastro na hora do agendamento." },
  { icon: Wallet, title: "Financeiro", text: "Pagamentos do app, mensalidades de associados e lançamentos manuais." },
  { icon: IdCard, title: "Associados", text: "Assinatura mensal, desconto na consulta e direitos do pacote." },
  { icon: Stethoscope, title: "Equipe", text: "Profissionais, especialidades e horários da demonstração." },
]

export function LandingView() {
  return (
    <div className="min-h-dvh bg-[#f3f6f7] text-foreground">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <Logo />
        <nav className="flex items-center gap-2 text-sm">
          <Link href="/demo" className="hidden rounded-full px-3 py-2 text-muted-foreground hover:text-foreground sm:inline">Roteiro</Link>
          <Button asChild><Link href="/desktop/entrar">Entrar no painel</Link></Button>
        </nav>
      </header>
      <FadeIn>
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-6 pt-8 pb-16 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <p className="section-kicker">Healthtech para clínicas</p>
            <h1 className="mt-4 max-w-xl text-5xl leading-[1.05] font-semibold tracking-tight text-brand sm:text-6xl">
              A clínica organizada. O paciente no centro.
            </h1>
            <p className="mt-5 max-w-lg text-lg leading-8 text-muted-foreground">
              CuidarSaude é uma demonstração navegável de gestão e agendamento. Os dados e pagamentos são fictícios e ficam só neste navegador.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild className="h-12 px-5">
                <Link href="/desktop/entrar">Entrar no painel da clínica <ArrowRight /></Link>
              </Button>
              <Button asChild variant="outline" className="h-12 bg-white px-5">
                <Link href="/demo">Ver o roteiro</Link>
              </Button>
            </div>
            <div className="mt-8 flex flex-wrap gap-2 text-xs text-muted-foreground">
              <span className="rounded-full bg-white px-3 py-1 ring-1 ring-border">Agenda</span>
              <span className="rounded-full bg-white px-3 py-1 ring-1 ring-border">Carrinho do paciente</span>
              <span className="rounded-full bg-white px-3 py-1 ring-1 ring-border">Guia de autorização</span>
              <span className="rounded-full bg-white px-3 py-1 ring-1 ring-border">Associados</span>
            </div>
          </div>
          <div className="relative">
            <div className="rounded-[2rem] bg-brand p-6 text-white shadow-[0_30px_80px_-40px_rgba(13,59,76,0.8)]">
              <div className="flex items-center justify-between text-sm text-white/70">
                <span>Hoje na unidade</span>
                <span>Teresina</span>
              </div>
              <p className="mt-8 text-sm text-white/70">Receita simulada</p>
              <p className="mt-1 text-4xl font-semibold">R$ 18.640</p>
              <div className="mt-8 space-y-3">
                {["08:00 Helena Duarte", "09:20 Lívia Campos", "14:00 Beatriz Lemos"].map((item) => (
                  <div key={item} className="flex items-center justify-between rounded-2xl bg-white/8 px-4 py-3">
                    <span>{item}</span>
                    <span className="text-xs text-teal-100">confirmada</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="absolute -bottom-6 -left-4 hidden w-56 rounded-3xl bg-white p-4 shadow-xl ring-1 ring-foreground/10 sm:block">
              <Smartphone className="size-4 text-teal" />
              <p className="mt-2 text-sm font-medium">App do paciente</p>
              <p className="text-xs text-muted-foreground">Conta, catálogo, carrinho, pagamento e guia.</p>
            </div>
          </div>
        </section>
        <section className="mx-auto grid max-w-6xl gap-px overflow-hidden rounded-[2rem] bg-border sm:grid-cols-4">
          {STEPS.map((step) => (
            <article key={step.n} className="bg-[#f7fafb] p-6">
              <p className="text-xs font-medium text-teal">{step.n}</p>
              <h2 className="mt-3 text-lg font-semibold">{step.title}</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{step.text}</p>
            </article>
          ))}
        </section>
        <section className="mx-auto grid max-w-6xl gap-4 px-6 py-16 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((item) => {
            const Icon = item.icon
            return (
              <article key={item.title} className="surface-card p-5">
                <Icon className="size-5 text-teal" />
                <h2 className="mt-3 text-base font-semibold">{item.title}</h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.text}</p>
              </article>
            )
          })}
        </section>
        <section className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 pb-16">
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <ShieldCheck className="size-4" />
            Paciente e clínica ficam em rotas separadas. Nenhum valor real é cobrado.
          </div>
          <Button asChild variant="outline" className="bg-white">
            <Link href="/demo">Ver roteiro de 6 passos</Link>
          </Button>
        </section>
      </FadeIn>
    </div>
  )
}
