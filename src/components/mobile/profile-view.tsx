"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { Portrait } from "@/components/shared/portrait"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { buildNotifications } from "@/lib/metrics"
import { useDemoStore } from "@/lib/store"
import { DEMO_CITIES } from "@/lib/types"

export function MobileProfile() {
  const data = useDemoStore((state) => state.data)
  const city = useDemoStore((state) => state.mobileCity)
  const setCity = useDemoStore((state) => state.setMobileCity)
  const updateCurrentPatient = useDemoStore((state) => state.updateCurrentPatient)
  const resetDemo = useDemoStore((state) => state.resetDemo)
  const logoutMobileAccount = useDemoStore((state) => state.logoutMobileAccount)
  const patient = data.patients.find((item) => item.id === data.currentPatientId)
  const [name, setName] = useState(patient?.name ?? "")
  const [phone, setPhone] = useState(patient?.phone ?? "")
  const [email, setEmail] = useState(patient?.email ?? "")
  const [confirm, setConfirm] = useState(false)

  useEffect(() => {
    setName(patient?.name ?? "")
    setPhone(patient?.phone ?? "")
    setEmail(patient?.email ?? "")
  }, [patient?.name, patient?.phone, patient?.email])
  const notifications = buildNotifications(data, new Date()).slice(0, 3)
  const history = data.appointments.filter((item) => item.patientId === data.currentPatientId).length

  if (!patient) return null

  return (
    <div className="space-y-5 px-5 pt-5 pb-8">
      <div className="flex items-center gap-3">
        <Portrait seed={patient.name} name={patient.name} className="size-16" />
        <div>
          <p className="text-xs uppercase tracking-wide text-teal">Paciente de demonstração</p>
          <h1 className="text-2xl font-semibold">{patient.name}</h1>
        </div>
      </div>
      <section className="space-y-3 rounded-3xl bg-white p-4 ring-1 ring-border">
        <label className="block text-sm">Nome
          <Input className="mt-1 h-10" value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        <label className="block text-sm">Telefone fictício
          <Input className="mt-1 h-10" value={phone} onChange={(event) => setPhone(event.target.value)} />
        </label>
        <label className="block text-sm">E-mail de demonstração
          <Input className="mt-1 h-10" value={email} onChange={(event) => setEmail(event.target.value)} />
        </label>
        <Button
          type="button"
          onClick={() => {
            if (name.trim().length < 3 || !email.toLowerCase().includes("demo")) {
              toast.error("Mantenha um nome e um e-mail de demonstração.")
              return
            }
            updateCurrentPatient({ name: name.trim(), phone, email })
            toast.success("Perfil fictício atualizado.")
          }}
        >
          Salvar dados
        </Button>
      </section>
      <section className="rounded-3xl bg-white p-4 ring-1 ring-border">
        <p className="text-sm font-medium">Preferências</p>
        <label className="mt-3 flex items-center justify-between text-sm">
          Lembretes demonstrativos
          <Switch checked={patient.reminderEnabled} onCheckedChange={(checked) => updateCurrentPatient({ reminderEnabled: checked })} />
        </label>
        <label className="mt-3 block text-sm">
          Cidade fictícia
          <select className="mt-1 h-10 w-full rounded-lg border bg-white px-3" value={city} onChange={(event) => setCity(event.target.value)}>
            {DEMO_CITIES.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
      </section>
      <section className="rounded-3xl bg-white p-4 ring-1 ring-border">
        <p className="text-sm font-medium">Histórico</p>
        <p className="mt-1 text-sm text-muted-foreground">{history} consultas neste roteiro, incluindo as criadas agora.</p>
        <Button asChild variant="outline" className="mt-3"><Link href="/mobile/consultas">Abrir consultas</Link></Button>
      </section>
      <section className="space-y-2">
        <p className="text-sm font-medium">Notificações demonstrativas</p>
        {notifications.map((item) => (
          <article key={item.id} className="rounded-2xl bg-muted px-4 py-3 text-sm">
            <p className="font-medium">{item.title}</p>
            <p className="text-muted-foreground">{item.body}</p>
          </article>
        ))}
      </section>
      <Button type="button" variant="outline" className="w-full" onClick={() => { logoutMobileAccount(); toast.success("Conta encerrada nesta demonstração.") }}>Sair da conta</Button>
      <Button type="button" variant="destructive" className="w-full" onClick={() => setConfirm(true)}>Sair do modo demonstração</Button>
      <Button asChild variant="outline" className="w-full"><Link href="/desktop">Abrir painel da clínica</Link></Button>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Reiniciar a demonstração?"
        description="Agendamentos, pagamentos e edições feitos nesta apresentação voltam ao roteiro inicial."
        confirmLabel="Restaurar dados"
        destructive
        onConfirm={() => {
          resetDemo()
          setConfirm(false)
          toast.success("Demonstração restaurada.")
        }}
      />
    </div>
  )
}
