"use client"

import { useEffect, useMemo, useState } from "react"
import { ArrowLeft, Building2, Edit2, MapPin, Phone, Plus, Search, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import type { ClinicRole, PartnerClinic } from "@/lib/types"

export function ClinicsView() {
  const [clinics, setClinics] = useState<PartnerClinic[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [search, setSearch] = useState("")
  const [role, setRole] = useState<ClinicRole | null>(null)
  const isReadOnly = role === "attendant"

  // Dialog State
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingClinic, setEditingClinic] = useState<PartnerClinic | null>(null)
  const [saving, setSaving] = useState(false)

  // Form Fields
  const [formName, setFormName] = useState("")
  const [formLegalName, setFormLegalName] = useState("")
  const [formCity, setFormCity] = useState("Teresina - PI")
  const [formAddress, setFormAddress] = useState("")
  const [formPhone, setFormPhone] = useState("")
  const [formEmail, setFormEmail] = useState("")

  // Delete State
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deletingName, setDeletingName] = useState("")
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)

  async function loadClinics() {
    try {
      const response = await fetch("/api/desktop/clinics", { cache: "no-store" })
      const result = (await response.json()) as { clinics?: PartnerClinic[]; error?: string }
      if (!response.ok) throw new Error(result.error || "Não foi possível carregar as clínicas.")
      setClinics(result.clinics || [])
      setError("")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível carregar as clínicas.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetch("/api/desktop/session")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.authenticated) setRole(data.role)
      })
      .catch(() => {})

    void loadClinics()
  }, [])

  function openCreateDialog() {
    setEditingClinic(null)
    setFormName("")
    setFormLegalName("")
    setFormCity("Teresina - PI")
    setFormAddress("")
    setFormPhone("")
    setFormEmail("")
    setDialogOpen(true)
  }

  function openEditDialog(clinic: PartnerClinic) {
    setEditingClinic(clinic)
    setFormName(clinic.name)
    setFormLegalName(clinic.legalName || clinic.name)
    setFormCity(clinic.city)
    setFormAddress(clinic.address)
    setFormPhone(clinic.phone)
    setFormEmail(clinic.email || "")
    setDialogOpen(true)
  }

  async function handleSaveClinic(event: React.FormEvent) {
    event.preventDefault()
    if (isReadOnly) {
      toast.error("Atendentes possuem acesso somente leitura às clínicas.")
      return
    }

    if (!formName.trim() || !formCity.trim() || !formAddress.trim() || !formPhone.trim()) {
      toast.error("Preencha todos os campos obrigatórios (Nome, Cidade, Endereço e Telefone).")
      return
    }

    setSaving(true)
    try {
      const payload = {
        id: editingClinic ? editingClinic.id : undefined,
        name: formName.trim(),
        legalName: formLegalName.trim() || formName.trim(),
        city: formCity.trim(),
        address: formAddress.trim(),
        phone: formPhone.trim(),
        email: formEmail.trim() || undefined,
      }

      const response = await fetch("/api/desktop/clinics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      const result = (await response.json()) as { clinic?: PartnerClinic; error?: string }
      if (!response.ok) throw new Error(result.error || "Não foi possível salvar a clínica.")

      toast.success(editingClinic ? "Clínica atualizada com sucesso." : "Clínica cadastrada com sucesso.")
      setDialogOpen(false)
      await loadClinics()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível salvar a clínica.")
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteClinic() {
    if (!deletingId) return
    try {
      const response = await fetch(`/api/desktop/clinics?id=${encodeURIComponent(deletingId)}`, {
        method: "DELETE",
      })
      const result = (await response.json()) as { error?: string }
      if (!response.ok) throw new Error(result.error || "Não foi possível excluir a clínica.")

      toast.success("Clínica excluída.")
      setDeleteConfirmOpen(false)
      setDeletingId(null)
      await loadClinics()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível excluir a clínica.")
    }
  }

  const filteredClinics = useMemo(() => {
    if (!search.trim()) return clinics
    const query = search.toLowerCase()
    return clinics.filter(
      (c) =>
        c.name.toLowerCase().includes(query) ||
        (c.city && c.city.toLowerCase().includes(query)) ||
        (c.address && c.address.toLowerCase().includes(query))
    )
  }, [clinics, search])

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="gap-2 text-muted-foreground hover:text-foreground -ml-2 h-8"
          onClick={() => {
            if (typeof window !== "undefined" && window.history.length > 1) {
              window.history.back()
            } else {
              window.location.href = "/desktop/atendimentos"
            }
          }}
        >
          <ArrowLeft className="size-4" />
          <span>Voltar</span>
        </Button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <p className="section-kicker">Rede Credenciada</p>
            {isReadOnly && (
              <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground ring-1 ring-border">
                Modo somente leitura
              </span>
            )}
          </div>
          <h1 className="mt-1 text-3xl font-semibold">Clínicas e Laboratórios</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Gerencie as unidades da clínica e a rede de parceiros/laboratórios credenciados para exames e procedimentos.
          </p>
        </div>
        {!isReadOnly && (
          <Button onClick={openCreateDialog} className="shrink-0 gap-2">
            <Plus className="size-4" />
            Nova clínica parceira
          </Button>
        )}
      </div>

      {error ? (
        <div role="alert" className="flex items-center justify-between rounded-xl border border-destructive bg-destructive/10 p-4 text-sm text-destructive">
          <span>{error}</span>
          <Button variant="outline" size="sm" onClick={() => void loadClinics()}>
            Tentar novamente
          </Button>
        </div>
      ) : null}

      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome, cidade ou endereço..."
            className="pl-9 h-10"
          />
        </div>
      </div>

      {loading ? (
        <div className="rounded-2xl border bg-card p-8 text-center text-sm text-muted-foreground">
          Carregando clínicas...
        </div>
      ) : filteredClinics.length === 0 ? (
        <div className="rounded-2xl border bg-card p-12 text-center">
          <Building2 className="mx-auto size-10 text-muted-foreground/60" />
          <h3 className="mt-3 text-base font-semibold">Nenhuma clínica encontrada</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {search.trim() ? "Nenhum resultado com o termo pesquisado." : "Cadastre a primeira clínica parceira ou laboratório."}
          </p>
          {!isReadOnly && !search.trim() && (
            <Button onClick={openCreateDialog} className="mt-4 gap-2">
              <Plus className="size-4" /> Cadastrar agora
            </Button>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredClinics.map((clinic) => {
            const isMatriz = clinic.id === "clinic-default"
            return (
              <div
                key={clinic.id}
                className="flex flex-col justify-between rounded-2xl border bg-card p-5 shadow-xs transition hover:border-teal/40"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="flex size-9 items-center justify-center rounded-xl bg-teal/10 text-teal">
                        <Building2 className="size-5" />
                      </div>
                      <div>
                        <h2 className="font-semibold text-foreground text-base leading-snug">{clinic.name}</h2>
                        {isMatriz ? (
                          <span className="inline-flex rounded-full bg-teal/15 px-2 py-0.5 text-[11px] font-medium text-teal">
                            Matriz / Sede Principal
                          </span>
                        ) : (
                          <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                            Parceira Credenciada
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5 text-xs text-muted-foreground pt-1">
                    <p className="flex items-center gap-1.5">
                      <MapPin className="size-3.5 shrink-0 text-muted-foreground/70" />
                      <span>{clinic.address} — {clinic.city}</span>
                    </p>
                    <p className="flex items-center gap-1.5">
                      <Phone className="size-3.5 shrink-0 text-muted-foreground/70" />
                      <span>{clinic.phone}</span>
                    </p>
                    {clinic.email ? (
                      <p className="text-muted-foreground/75 truncate pl-5">
                        {clinic.email}
                      </p>
                    ) : null}
                  </div>
                </div>

                {!isReadOnly && (
                  <div className="mt-4 flex items-center justify-end gap-2 border-t pt-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEditDialog(clinic)}
                      className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                    >
                      <Edit2 className="size-3.5" /> Editar
                    </Button>
                    {!isMatriz && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setDeletingId(clinic.id)
                          setDeletingName(clinic.name)
                          setDeleteConfirmOpen(true)
                        }}
                        className="gap-1.5 text-xs text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="size-3.5" /> Excluir
                      </Button>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Dialog de Criação / Edição */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingClinic ? "Editar Clínica Parceira" : "Cadastrar Nova Clínica ou Laboratório"}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSaveClinic} className="space-y-4 py-2">
            <div className="space-y-1 text-sm">
              <label htmlFor="clinic-name" className="font-medium">
                Nome da Clínica / Laboratório *
              </label>
              <Input
                id="clinic-name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Ex: Laboratório Santa Maria, Clínica São Francisco"
                required
              />
            </div>

            <div className="space-y-1 text-sm">
              <label htmlFor="clinic-legal" className="font-medium">
                Razão Social (opcional)
              </label>
              <Input
                id="clinic-legal"
                value={formLegalName}
                onChange={(e) => setFormLegalName(e.target.value)}
                placeholder="Ex: Laboratório Santa Maria Análises Clínicas Ltda"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1 text-sm">
                <label htmlFor="clinic-city" className="font-medium">
                  Cidade / UF *
                </label>
                <Input
                  id="clinic-city"
                  value={formCity}
                  onChange={(e) => setFormCity(e.target.value)}
                  placeholder="Ex: Teresina - PI"
                  required
                />
              </div>

              <div className="space-y-1 text-sm">
                <label htmlFor="clinic-phone" className="font-medium">
                  Telefone / WhatsApp *
                </label>
                <Input
                  id="clinic-phone"
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                  placeholder="Ex: (86) 3222-1100"
                  required
                />
              </div>
            </div>

            <div className="space-y-1 text-sm">
              <label htmlFor="clinic-address" className="font-medium">
                Endereço completo *
              </label>
              <Input
                id="clinic-address"
                value={formAddress}
                onChange={(e) => setFormAddress(e.target.value)}
                placeholder="Ex: Rua Álvaro Mendes, 1020 - Centro"
                required
              />
            </div>

            <div className="space-y-1 text-sm">
              <label htmlFor="clinic-email" className="font-medium">
                E-mail (opcional)
              </label>
              <Input
                id="clinic-email"
                type="email"
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
                placeholder="contato@laboratoriosantamaria.com.br"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Salvando..." : editingClinic ? "Salvar alterações" : "Cadastrar clínica"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Confirmação de Exclusão */}
      <ConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title="Excluir clínica parceira?"
        description={`Tem certeza de que deseja excluir "${deletingName}"? Os procedimentos vinculados ficarão sem clínica associada.`}
        confirmLabel="Sim, excluir"
        destructive
        onConfirm={handleDeleteClinic}
      />
    </div>
  )
}
