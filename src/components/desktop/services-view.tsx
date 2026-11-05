"use client"

import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { ServiceFields } from "@/components/desktop/service-fields"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { formatMoney } from "@/lib/format"
import { ASAAS_PIX_MINIMUM } from "@/lib/asaas/minimums"
import { useDemoStore } from "@/lib/store"
import type { Professional, Service } from "@/lib/types"

export interface ClinicOffer {
  id: string
  name: string
  kind: string
  professionalId: string | null
  price: number
  durationMin: number
}

export interface ServicesViewProps {
  initialTab?: "consultas" | "procedimentos"
}

export function ServicesView({
  initialTab = "consultas",
}: ServicesViewProps = {}) {
  const localProfessionals = useDemoStore((state) => state.data.professionals)
  const [serverProfessionals, setServerProfessionals] = useState<Professional[]>([])
  const [professionalId, setProfessionalId] = useState("")
  const [services, setServices] = useState<Service[]>([])
  const [activeTab, setActiveTab] = useState<"consultas" | "procedimentos">(initialTab)

  // Procedimentos da clínica
  const [clinicOffers, setClinicOffers] = useState<ClinicOffer[]>([])
  const [clinicServices, setClinicServices] = useState<Service[]>([])
  const [loadingClinic, setLoadingClinic] = useState(true)
  const [savingClinic, setSavingClinic] = useState(false)
  const [clinicError, setClinicError] = useState("")

  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  async function refreshProfessionals() {
    const response = await fetch("/api/desktop/professionals", { cache: "no-store" })
    const result = (await response.json()) as { professionals?: Professional[]; error?: string }
    if (!response.ok) throw new Error(result.error || "Não foi possível carregar os profissionais.")
    setServerProfessionals(result.professionals || [])
    setError("")
  }

  async function refreshOffers() {
    const response = await fetch("/api/desktop/services", { cache: "no-store" })
    const result = (await response.json()) as { offers?: ClinicOffer[]; error?: string }
    if (!response.ok) throw new Error(result.error || "Não foi possível carregar os procedimentos da clínica.")
    const allOffers = result.offers || []
    setClinicOffers(allOffers.filter((o) => !o.professionalId))
    setClinicError("")
  }

  useEffect(() => {
    const controller = new AbortController()

    Promise.allSettled([
      fetch("/api/desktop/professionals", { cache: "no-store", signal: controller.signal })
        .then(async (res) => {
          const result = (await res.json()) as { professionals?: Professional[]; error?: string }
          if (!res.ok) throw new Error(result.error || "Não foi possível carregar os profissionais.")
          if (!controller.signal.aborted) setServerProfessionals(result.professionals || [])
        })
        .catch((err: unknown) => {
          if (!controller.signal.aborted) {
            setError(err instanceof Error ? err.message : "Não foi possível carregar os profissionais.")
          }
        }),

      fetch("/api/desktop/services", { cache: "no-store", signal: controller.signal })
        .then(async (res) => {
          const result = (await res.json()) as { offers?: ClinicOffer[]; error?: string }
          if (!res.ok) throw new Error(result.error || "Não foi possível carregar os procedimentos da clínica.")
          if (!controller.signal.aborted) {
            const allOffers = result.offers || []
            setClinicOffers(allOffers.filter((o) => !o.professionalId))
          }
        })
        .catch((err: unknown) => {
          if (!controller.signal.aborted) {
            setClinicError(err instanceof Error ? err.message : "Não foi possível carregar os procedimentos da clínica.")
          }
        }),
    ]).finally(() => {
      if (!controller.signal.aborted) {
        setLoading(false)
        setLoadingClinic(false)
      }
    })

    return () => controller.abort()
  }, [])

  const professionals = useMemo(() => {
    const items = new Map(localProfessionals.map((professional) => [professional.id, professional]))
    for (const professional of serverProfessionals) items.set(professional.id, professional)
    return [...items.values()]
  }, [localProfessionals, serverProfessionals])

  const selected = professionals.find((p) => p.id === professionalId)
  const needsImport = Boolean(selected && !serverProfessionals.some((p) => p.id === selected.id))

  async function saveDoctorServices() {
    if (
      !professionalId ||
      !services.length ||
      services.some((s) => !s.name.trim() || s.price < ASAAS_PIX_MINIMUM || !Number.isInteger(s.durationMin) || s.durationMin <= 0)
    ) {
      toast.error("Selecione o profissional e use pelo menos R$ 10 em cada atendimento.")
      return
    }
    setSaving(true)
    try {
      if (needsImport && selected) {
        const { name, specialty, credentialCode, bio, price, workDays, startHour, endHour, active } = selected
        const importResponse = await fetch("/api/desktop/professionals", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: selected.id,
            form: { name, specialty, credentialCode, bio, price, workDays, startHour, endHour, active },
            services: selected.services,
          }),
        })
        const imported = (await importResponse.json()) as { error?: string }
        if (!importResponse.ok) throw new Error(imported.error || "Não foi possível vincular o profissional ao banco.")
      }
      const response = await fetch("/api/desktop/services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ professionalId, services }),
      })
      const result = (await response.json()) as { error?: string }
      if (!response.ok) throw new Error(result.error || "Não foi possível salvar os atendimentos.")
      setServices([])
      try {
        await refreshProfessionals()
        await refreshOffers()
      } catch {
        toast.warning("Atendimentos salvos. Atualize a página para conferi-los.")
      }
      toast.success("Atendimentos vinculados ao profissional.")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível salvar os atendimentos.")
    } finally {
      setSaving(false)
    }
  }

  async function saveClinicProcedures() {
    if (
      !clinicServices.length ||
      clinicServices.some((s) => !s.name.trim() || s.price < ASAAS_PIX_MINIMUM || !Number.isInteger(s.durationMin) || s.durationMin <= 0)
    ) {
      toast.error("Adicione ao menos um procedimento com nome válido e valor mínimo de R$ 10.")
      return
    }
    setSavingClinic(true)
    try {
      const response = await fetch("/api/desktop/services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ professionalId: null, services: clinicServices }),
      })
      const result = (await response.json()) as { error?: string }
      if (!response.ok) throw new Error(result.error || "Não foi possível salvar os procedimentos da clínica.")
      setClinicServices([])
      await refreshOffers()
      toast.success("Procedimentos da clínica salvos com sucesso.")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível salvar os procedimentos da clínica.")
    } finally {
      setSavingClinic(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="section-kicker">Cadastro</p>
        <h1 className="mt-1 text-3xl font-semibold">Consultas e procedimentos</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Cadastre consultas por médico e procedimentos ambulatoriais ou exames gerais da clínica.
        </p>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(val) => setActiveTab(val as "consultas" | "procedimentos")}
        className="space-y-5"
      >
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="consultas">Consultas Médicas</TabsTrigger>
          <TabsTrigger value="procedimentos">Procedimentos & Exames da Clínica</TabsTrigger>
        </TabsList>

        <TabsContent value="consultas" className="space-y-4">
          {error ? (
            <div role="alert" className="text-sm text-destructive">
              {error}{" "}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  void refreshProfessionals().catch((err: unknown) =>
                    setError(err instanceof Error ? err.message : "Não foi possível carregar os profissionais.")
                  )
                }
              >
                Tentar novamente
              </Button>
            </div>
          ) : null}

          <div className="space-y-4 rounded-2xl border bg-card p-5">
            <label className="block space-y-1 text-sm font-medium">
              Profissional
              <select
                value={professionalId}
                onChange={(event) => {
                  const val = event.target.value
                  if (val === "__clinic__") {
                    setActiveTab("procedimentos")
                  } else {
                    setProfessionalId(val)
                    setServices([])
                  }
                }}
                className="h-10 w-full rounded-md border border-input bg-background px-3 font-normal"
              >
                <option value="">Selecione</option>
                <option value="__clinic__">Geral da Clínica (Sem médico específico) →</option>
                {professionals
                  .filter((p) => p.active)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
              </select>
            </label>

            {selected ? (
              <div>
                <h2 className="font-semibold">Atendimentos cadastrados</h2>
                {needsImport ? (
                  <p className="mt-1 text-sm text-muted-foreground">
                    Este profissional está neste navegador. Ao salvar, seu cadastro será vinculado ao banco.
                  </p>
                ) : null}
                {selected.services.length ? (
                  <ul className="mt-2 space-y-1 text-sm">
                    {selected.services.map((s) => (
                      <li key={s.id}>
                        {s.name} · {formatMoney(s.price)} · {s.durationMin} min
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-sm text-muted-foreground">Nenhum atendimento cadastrado.</p>
                )}
              </div>
            ) : null}

            <ServiceFields services={services} onChange={setServices} />

            <Button
              type="button"
              onClick={() => void saveDoctorServices()}
              disabled={saving || loading || Boolean(error) || !professionalId}
            >
              {saving ? "Salvando..." : "Salvar atendimentos"}
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="procedimentos" className="space-y-4">
          {clinicError ? (
            <div role="alert" className="text-sm text-destructive">
              {clinicError}{" "}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  void refreshOffers().catch((err: unknown) =>
                    setClinicError(
                      err instanceof Error ? err.message : "Não foi possível carregar os procedimentos da clínica."
                    )
                  )
                }
              >
                Tentar novamente
              </Button>
            </div>
          ) : null}

          <div className="space-y-5 rounded-2xl border bg-card p-5">
            <div className="space-y-1 text-sm">
              <label className="font-medium text-foreground">Profissional responsável</label>
              <div className="flex h-10 items-center justify-between rounded-md border border-input bg-muted/40 px-3 text-sm">
                <span className="font-medium text-foreground">Geral da Clínica (Sem médico específico)</span>
                <span className="rounded bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">Clínica</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Procedimentos ambulatoriais, exames e curativos realizados pela equipe da clínica sem necessidade de médico específico.
              </p>
            </div>

            <div className="space-y-2">
              <h2 className="font-semibold text-foreground">Procedimentos e exames da clínica cadastrados</h2>
              {loadingClinic ? (
                <p className="text-sm text-muted-foreground">Carregando procedimentos...</p>
              ) : clinicOffers.length > 0 ? (
                <div className="divide-y rounded-lg border bg-background/50">
                  {clinicOffers.map((offer) => (
                    <div key={offer.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{offer.name}</span>
                        <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground capitalize">
                          {offer.kind === "exame" ? "Procedimento / Exame" : offer.kind}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-muted-foreground">
                        <span>{formatMoney(offer.price)}</span>
                        <span>•</span>
                        <span>{offer.durationMin} min</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Nenhum procedimento ou exame independente cadastrado no momento.
                </p>
              )}
            </div>

            <div className="border-t pt-4">
              <ServiceFields services={clinicServices} onChange={setClinicServices} />
            </div>

            <Button
              type="button"
              onClick={() => void saveClinicProcedures()}
              disabled={savingClinic || loadingClinic || clinicServices.length === 0}
            >
              {savingClinic ? "Salvando..." : "Salvar procedimentos da clínica"}
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
