"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import {
  Bell,
  CalendarDays,
  ClipboardList,
  FileText,
  IdCard,
  LayoutDashboard,
  Menu,
  Search,
  Stethoscope,
  Users,
  Wallet,
} from "lucide-react"
import { toast } from "sonner"
import { Logo } from "@/components/brand/logo"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { Button } from "@/components/ui/button"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { clinicGate, logoutClinic } from "@/lib/clinic-actions"
import { buildNotifications } from "@/lib/metrics"
import { useDemoStore } from "@/lib/store"

const NAV = [
  { href: "/desktop", label: "Painel", icon: LayoutDashboard },
  { href: "/desktop/agenda", label: "Agenda", icon: CalendarDays },
  { href: "/desktop/consultas", label: "Consultas", icon: ClipboardList },
  { href: "/desktop/guias", label: "Guias", icon: FileText },
  { href: "/desktop/atendimentos", label: "Consultas e procedimentos", icon: Stethoscope },
  { href: "/desktop/pacientes", label: "Pacientes", icon: Users },
  { href: "/desktop/associados", label: "Associados", icon: IdCard },
  { href: "/desktop/financeiro", label: "Financeiro", icon: Wallet },
  { href: "/desktop/profissionais", label: "Profissionais", icon: Stethoscope },
]

function isActive(pathname: string, href: string) {
  if (href === "/desktop") return pathname === href
  return pathname.startsWith(href)
}

export function DesktopShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [menuOpen, setMenuOpen] = useState(false)
  const current = NAV.find((item) => isActive(pathname, item.href))

  useEffect(() => {
    void clinicGate()
  }, [pathname])

  return (
    <div className="min-h-dvh bg-background lg:grid lg:grid-cols-[252px_minmax(0,1fr)]">
      <aside className="sticky top-0 hidden h-dvh flex-col bg-sidebar text-sidebar-foreground lg:flex">
        <SidebarBody pathname={pathname} />
      </aside>
      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b bg-white/85 px-4 backdrop-blur lg:px-8">
          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger asChild>
              <Button type="button" variant="outline" size="icon" className="lg:hidden" aria-label="Abrir menu">
                <Menu />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[280px] bg-sidebar p-0 text-sidebar-foreground sm:max-w-none">
              <SheetHeader className="sr-only">
                <SheetTitle>Menu da clínica</SheetTitle>
              </SheetHeader>
              <SidebarBody pathname={pathname} onNavigate={() => setMenuOpen(false)} />
            </SheetContent>
          </Sheet>
          <Breadcrumb className="hidden min-w-0 sm:block">
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link href="/desktop">Clínica</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>{current?.label ?? "Painel"}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <HeaderSearch />
          <NotificationBell />
          <ClinicMenu />
        </header>
        <main className="min-w-0 flex-1 px-4 py-6 lg:px-8">{children}</main>
      </div>
    </div>
  )
}

function SidebarBody({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  const clinic = useDemoStore((state) => state.data.clinic)
  return (
    <div className="flex h-full flex-col">
      <div className="px-5 py-5">
        <Logo light />
        <p className="mt-4 text-sm font-medium text-white">{clinic.name}</p>
        <p className="text-xs text-sidebar-foreground/65">{clinic.city}</p>
      </div>
      <nav className="flex-1 space-y-1 px-3" aria-label="Painel da clínica">
        {NAV.map((item) => {
          const active = isActive(pathname, item.href)
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors ${
                active ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground/80 hover:bg-white/5"
              }`}
            >
              <Icon className="size-4" />
              {item.label}
            </Link>
          )
        })}
      </nav>
      <div className="px-5 py-4">
        <p className="text-xs font-medium text-sidebar-foreground/80">Acesso da equipe</p>
        <p className="mt-1 text-xs leading-5 text-sidebar-foreground/55">{clinic.phone}</p>
      </div>
    </div>
  )
}

function HeaderSearch() {
  const router = useRouter()
  const setPatientSearch = useDemoStore((state) => state.setPatientSearch)
  const [query, setQuery] = useState("")

  return (
    <form
      className="ml-auto hidden w-full max-w-xs items-center md:flex"
      onSubmit={(event) => {
        event.preventDefault()
        setPatientSearch(query.trim())
        router.push("/desktop/pacientes")
      }}
    >
      <div className="relative w-full">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar paciente"
          aria-label="Buscar paciente"
          className="h-10 pl-9"
        />
      </div>
    </form>
  )
}

function NotificationBell() {
  const data = useDemoStore((state) => state.data)
  const markNotificationsRead = useDemoStore((state) => state.markNotificationsRead)
  const [open, setOpen] = useState(false)
  const now = useMemo(() => new Date(), [])
  const items = buildNotifications(data, now)
  const unread = items.filter((item) => !data.readNotificationIds.includes(item.id)).length

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) markNotificationsRead()
      }}
    >
      <SheetTrigger asChild>
        <Button type="button" variant="outline" size="icon" className="relative" aria-label="Notificações">
          <Bell />
          {unread > 0 ? <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-teal" /> : null}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Central da clínica</SheetTitle>
        </SheetHeader>
        <div className="space-y-3 px-4 pb-6">
          <p className="text-xs text-muted-foreground">Alertas calculados a partir da agenda e dos pagamentos.</p>
          {items.map((item) => (
            <Link key={item.id} href={item.href} onClick={() => setOpen(false)} className="block rounded-2xl bg-muted/70 p-4 hover:bg-accent">
              <p className="text-sm font-medium">{item.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{item.body}</p>
            </Link>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  )
}

function ClinicMenu() {
  const clinic = useDemoStore((state) => state.data.clinic)
  const resetDemo = useDemoStore((state) => state.resetDemo)
  const [confirm, setConfirm] = useState(false)

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="outline" className="max-w-44">
            <span className="truncate">{clinic.name}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel>
            <span className="block">{clinic.name}</span>
            <span className="block font-normal text-muted-foreground">{clinic.city}</span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setConfirm(true)}>Limpar dados locais</DropdownMenuItem>
          <DropdownMenuItem
            onSelect={(event) => {
              event.preventDefault()
              void logoutClinic()
            }}
          >
            Sair do painel
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Limpar dados locais?"
        description="Todos os agendamentos, pagamentos e edições salvos neste navegador serão removidos."
        confirmLabel="Limpar dados"
        destructive
        onConfirm={() => {
          resetDemo()
          setConfirm(false)
          toast.success("Dados locais removidos.")
        }}
      />
    </>
  )
}
