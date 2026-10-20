"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { CalendarDays, House, Search, UserRound } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useDemoStore } from "@/lib/store"

const ITEMS = [
  { href: "/mobile", label: "Início", icon: House },
  { href: "/mobile/buscar", label: "Buscar", icon: Search },
  { href: "/mobile/consultas", label: "Consultas", icon: CalendarDays },
  { href: "/mobile/perfil", label: "Perfil", icon: UserRound },
]

export function MobileShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const sessionId = useDemoStore((state) => state.mobileSessionPatientId)
  const needsAccount = !sessionId && pathname !== "/mobile"

  return (
    <div className="min-h-dvh bg-[radial-gradient(circle_at_top,#e7f4f2,#d5e1e6)] md:grid md:place-items-center md:p-6">
      <div className="relative mx-auto flex h-dvh w-full flex-col overflow-hidden bg-[#f6fafa] md:h-[min(844px,calc(100dvh-3rem))] md:w-[390px] md:rounded-[2.2rem] md:shadow-[0_30px_80px_-28px_rgba(12,47,61,0.55)] md:ring-8 md:ring-white/80">
        <div className="pointer-events-none absolute top-2 left-1/2 z-20 hidden h-5 w-24 -translate-x-1/2 rounded-full bg-brand md:block" />
        <div className="phone-scroll min-h-0 flex-1 overflow-y-auto pt-0 md:pt-7">
          {needsAccount ? <AccountGate /> : children}
        </div>
        <BottomNav />
      </div>
    </div>
  )
}

function AccountGate() {
  return (
    <div className="px-5 pt-10">
      <p className="section-kicker">Aplicativo do paciente</p>
      <h1 className="mt-2 text-2xl font-semibold">Crie sua conta para continuar</h1>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">O pedido começa com CPF, nome, WhatsApp, nascimento e senha de demonstração.</p>
      <Button asChild className="mt-5 h-12 w-full"><Link href="/mobile">Criar conta</Link></Button>
    </div>
  )
}

function BottomNav() {
  const pathname = usePathname()
  return (
    <nav className="grid grid-cols-4 border-t bg-white/95 px-2 py-2 backdrop-blur" aria-label="Aplicativo do paciente">
      {ITEMS.map((item) => {
        const active = item.href === "/mobile" ? pathname === item.href : pathname.startsWith(item.href)
        const Icon = item.icon
        return (
          <Link key={item.href} href={item.href} className={`flex flex-col items-center gap-1 rounded-xl py-1.5 text-[11px] ${active ? "bg-accent font-medium text-teal" : "text-muted-foreground"}`}>
            <Icon className="size-5" />
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
