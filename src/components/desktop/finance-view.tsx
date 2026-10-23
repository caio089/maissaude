"use client"

import { useMemo, useState } from "react"
import { IdCard, Plus, Receipt } from "lucide-react"
import { toast } from "sonner"
import { MonthlyBars, RevenueArea } from "@/components/desktop/charts"
import { Field } from "@/components/shared/field"
import { FadeIn } from "@/components/shared/fade-in"
import { EmptyState } from "@/components/shared/empty-state"
import { PaymentBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatDate, formatMoney, toDateKey } from "@/lib/format"
import { computeDashboard, sumAmount } from "@/lib/metrics"
import { useDemoStore } from "@/lib/store"
import type { Associate, CashCategory, CashEntry, CashKind, Payment, PaymentStatus } from "@/lib/types"

const INCOME_CATEGORIES: CashCategory[] = ["consulta", "mensalidade", "exame", "outro"]
const EXPENSE_CATEGORIES: CashCategory[] = ["aluguel", "salario", "material", "transporte", "outro"]
const CATEGORY_LABEL: Record<CashCategory, string> = {
  consulta: "Consulta",
  mensalidade: "Mensalidade",
  exame: "Exame",
  aluguel: "Aluguel",
  salario: "Salário",
  material: "Material",
  transporte: "Transporte",
  outro: "Outro",
}

export function FinanceView() {
  const data = useDemoStore((state) => state.data)
  const cashEntries = useDemoStore((state) => state.cashEntries)
  const associates = useDemoStore((state) => state.associates)
  const associateFee = useDemoStore((state) => state.associateRules.fee)
  const settlePayment = useDemoStore((state) => state.settlePayment)
  const removeCashEntry = useDemoStore((state) => state.removeCashEntry)
  const [filter, setFilter] = useState<PaymentStatus | "all">("all")
  const [receipt, setReceipt] = useState<Payment | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const now = useMemo(() => new Date(), [])
  const metrics = computeDashboard(data, "month", now)
  const month = monthKey(now)
  const manualIncome = sumEntries(cashEntries, "income", month)
  const manualExpense = sumEntries(cashEntries, "expense", month)
  const membershipIncome = membershipForMonth(associates, associateFee, month)
  const monthRevenue = metrics.revenue + manualIncome + membershipIncome
  const balance = monthRevenue - manualExpense
  const pending = sumAmount(data.payments.filter((item) => item.status === "pending"))
  const rows = data.payments.filter((item) => filter === "all" || item.status === filter)
  const series = withManualIncome(metrics.series, cashEntries, associates, associateFee, now)
  const monthly = withManualMonthly(metrics.monthly, cashEntries, associates, associateFee, now)

  return (
    <FadeIn className="space-y-5">
      <div>
        <p className="section-kicker">Financeiro</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Financeiro</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Acompanhe recebimentos, mensalidades de associados, receitas e saídas da clínica.
        </p>
      </div>
      <div className="flex justify-end">
        <Button type="button" onClick={() => setFormOpen(true)}><Plus /> Lançar receita ou saída</Button>
      </div>
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-3xl bg-brand p-5 text-white">
          <p className="text-sm text-white/70">Receita do mês</p>
          <p className="mt-2 text-3xl font-semibold">{formatMoney(monthRevenue)}</p>
          <p className="mt-1 text-xs text-white/70">Consultas, mensalidades dos associados e receitas lançadas. {formatMoney(membershipIncome)} vêm dos associados ativos.</p>
        </article>
        <article className="panel p-5">
          <p className="text-sm text-muted-foreground">Saídas do mês</p>
          <p className="mt-2 text-3xl font-semibold">{formatMoney(manualExpense)}</p>
        </article>
        <article className="panel p-5">
          <p className="text-sm text-muted-foreground">Saldo do mês</p>
          <p className="mt-2 text-3xl font-semibold">{formatMoney(balance)}</p>
        </article>
        <article className="panel p-5">
          <p className="text-sm text-muted-foreground">Pendente</p>
          <p className="mt-2 text-3xl font-semibold">{formatMoney(pending)}</p>
        </article>
      </section>
      <section className="grid gap-4 xl:grid-cols-2">
        <div className="panel p-5">
          <h2 className="mb-3 text-lg font-semibold">Receita diária do mês</h2>
          <RevenueArea data={series} />
        </div>
        <div className="panel p-5">
          <h2 className="mb-3 text-lg font-semibold">Comparativo mensal</h2>
          <MonthlyBars data={monthly} />
        </div>
      </section>
      <AssociateMemberships associates={associates} fee={associateFee} />
      <CashLedger entries={cashEntries} onRemove={(id) => { removeCashEntry(id); toast.success("Lançamento removido.") }} />
      <div className="panel overflow-hidden">
        <div className="flex items-center justify-between gap-3 p-4">
          <h2 className="text-lg font-semibold">Pagamentos das consultas</h2>
          <Select value={filter} onValueChange={(value) => setFilter(value as PaymentStatus | "all")}>
            <SelectTrigger className="h-10 w-44" aria-label="Filtrar lançamentos"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="paid">Recebidos</SelectItem>
              <SelectItem value="pending">Pendentes</SelectItem>
              <SelectItem value="refunded">Estornados</SelectItem>
              <SelectItem value="declined">Recusados</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {rows.length === 0 ? <EmptyState icon={Receipt} title="Nenhum lançamento" description="Os pagamentos e lançamentos aparecerão nesta tabela." /> : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Referência</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Paciente</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((payment) => {
                const patient = data.patients.find((item) => item.id === payment.patientId)
                return (
                  <TableRow key={payment.id}>
                    <TableCell className="font-medium">{payment.reference}</TableCell>
                    <TableCell>{payment.description}</TableCell>
                    <TableCell>{patient?.name}</TableCell>
                    <TableCell>{formatMoney(payment.amount)}</TableCell>
                    <TableCell><PaymentBadge status={payment.status} /></TableCell>
                    <TableCell className="space-x-2 text-right">
                      {payment.status === "pending" ? (
                        <Button type="button" size="sm" variant="outline" onClick={() => { settlePayment(payment.id, "pix"); toast.success("Pagamento registrado.") }}>
                          Registrar Pix
                        </Button>
                      ) : null}
                      <Button type="button" size="sm" variant="ghost" onClick={() => setReceipt(payment)}>Comprovante</Button>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </div>
      <ReceiptDialog payment={receipt} onOpenChange={(open) => !open && setReceipt(null)} />
      <CashEntryDialog open={formOpen} onOpenChange={setFormOpen} />
    </FadeIn>
  )
}

function AssociateMemberships({ associates, fee }: { associates: Associate[]; fee: number }) {
  const activeCount = associates.filter((associate) => associate.status === "active").length
  return (
    <div className="panel overflow-hidden">
      <div className="p-4">
        <h2 className="text-lg font-semibold">Mensalidades dos associados</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Puxado do cadastro de associados. Cada ativo entra com {formatMoney(fee)} neste mês. Total: {formatMoney(activeCount * fee)}.
        </p>
      </div>
      {associates.length === 0 ? (
        <EmptyState icon={IdCard} title="Nenhum associado cadastrado" description="Quando a clínica cadastrar um associado ativo, a mensalidade aparece aqui e soma na receita." />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Associado</TableHead>
              <TableHead>CPF</TableHead>
              <TableHead>Situação</TableHead>
              <TableHead>Mensalidade</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {associates.map((associate) => (
              <TableRow key={associate.id}>
                <TableCell className="font-medium">{associate.name}</TableCell>
                <TableCell>{associate.cpf}</TableCell>
                <TableCell>{associate.status === "active" ? "Ativo" : "Inativo"}</TableCell>
                <TableCell>{formatMoney(associate.status === "active" ? fee : 0)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}

function CashLedger({ entries, onRemove }: { entries: CashEntry[]; onRemove: (id: string) => void }) {
  return (
    <div className="panel overflow-hidden">
      <div className="p-4">
        <h2 className="text-lg font-semibold">Receitas e saídas lançadas</h2>
        <p className="mt-1 text-sm text-muted-foreground">Lançamentos feitos pelo dono, além dos pagamentos das consultas.</p>
      </div>
      {entries.length === 0 ? (
        <EmptyState icon={Receipt} title="Nenhuma receita ou saída lançada" description="Use o botão acima para registrar aluguel, material, mensalidade ou outra movimentação." />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map((entry) => (
              <TableRow key={entry.id}>
                <TableCell>{formatDay(entry.occurredOn)}</TableCell>
                <TableCell>{entry.kind === "income" ? "Receita" : "Saída"}</TableCell>
                <TableCell>{CATEGORY_LABEL[entry.category]}</TableCell>
                <TableCell>{entry.description}</TableCell>
                <TableCell className={entry.kind === "expense" ? "text-destructive" : ""}>
                  {entry.kind === "expense" ? "− " : ""}{formatMoney(entry.amount)}
                </TableCell>
                <TableCell className="text-right">
                  <Button type="button" size="sm" variant="ghost" onClick={() => onRemove(entry.id)}>Remover</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}

function CashEntryDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const createCashEntry = useDemoStore((state) => state.createCashEntry)
  const [kind, setKind] = useState<CashKind>("income")
  const [category, setCategory] = useState<CashCategory>("outro")
  const [description, setDescription] = useState("")
  const [amount, setAmount] = useState("")
  const [occurredOn, setOccurredOn] = useState(() => toDateKey(new Date()))
  const [error, setError] = useState("")
  const categories = kind === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES

  function changeKind(next: CashKind) {
    setKind(next)
    setCategory("outro")
  }

  function save() {
    const parsed = Number(amount.trim().replace(",", "."))
    const result = createCashEntry({ kind, category, description, amount: parsed, occurredOn })
    if (!result.ok) {
      setError(result.message)
      return
    }
    setDescription("")
    setAmount("")
    setError("")
    onOpenChange(false)
    toast.success(kind === "income" ? "Receita lançada." : "Saída lançada.")
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Lançar receita ou saída</DialogTitle>
          <DialogDescription>Registre uma receita ou saída administrativa da clínica.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => changeKind("income")} className={`rounded-2xl py-3 text-sm ${kind === "income" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>Receita</button>
          <button type="button" onClick={() => changeKind("expense")} className={`rounded-2xl py-3 text-sm ${kind === "expense" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>Saída</button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Categoria">
            <Select value={category} onValueChange={(value) => setCategory(value as CashCategory)}>
              <SelectTrigger className="h-10 w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {categories.map((item) => <SelectItem key={item} value={item}>{CATEGORY_LABEL[item]}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Data" htmlFor="cash-date">
            <Input id="cash-date" type="date" className="h-10" value={occurredOn} onChange={(event) => setOccurredOn(event.target.value)} />
          </Field>
          <Field label="Descrição" htmlFor="cash-description">
            <Input id="cash-description" className="h-10" value={description} onChange={(event) => setDescription(event.target.value)} />
          </Field>
          <Field label="Valor" htmlFor="cash-amount" hint="Exemplo: 150 ou 150,50">
            <Input id="cash-amount" inputMode="decimal" className="h-10" value={amount} onChange={(event) => setAmount(event.target.value)} />
          </Field>
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <DialogFooter>
          <Button type="button" onClick={save}>Salvar lançamento</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ReceiptDialog({ payment, onOpenChange }: { payment: Payment | null; onOpenChange: (open: boolean) => void }) {
  const data = useDemoStore((state) => state.data)
  const patient = data.patients.find((item) => item.id === payment?.patientId)
  const professional = data.professionals.find((item) => item.id === payment?.professionalId)
  return (
    <Dialog open={Boolean(payment)} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden sm:max-w-md">
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
        </div>
        <DialogHeader>
          <DialogTitle>Comprovante</DialogTitle>
          <DialogDescription>Sem valor fiscal. Este documento existe só para a apresentação.</DialogDescription>
        </DialogHeader>
        {payment ? (
          <dl className="relative space-y-2 text-sm">
            <Row term="Referência" value={payment.reference} />
            <Row term="Paciente" value={patient?.name ?? "—"} />
            <Row term="Profissional" value={professional?.name ?? "—"} />
            <Row term="Valor" value={formatMoney(payment.amount)} />
            <Row term="Forma" value={payment.method === "pix" ? "Pix" : "Cartão"} />
            <Row term="Situação" value={payment.status} />
            <Row term="Data" value={formatDate(payment.paidAt ?? payment.createdAt, "dd/MM/yyyy HH:mm")} />
          </dl>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function sumEntries(entries: CashEntry[], kind: CashKind, month: string) {
  return entries.reduce((total, entry) => (entry.kind === kind && entry.occurredOn.startsWith(month) ? total + entry.amount : total), 0)
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
}

function withManualIncome(
  series: Array<{ label: string; revenue: number; appointments: number }>,
  entries: CashEntry[],
  associates: Associate[],
  fee: number,
  now: Date,
) {
  const year = now.getFullYear()
  const monthIndex = now.getMonth()
  return series.map((point) => {
    const [day, month] = point.label.split("/")
    const key = `${year}-${month}-${day}`
    const extra = entries.reduce((total, entry) => (entry.kind === "income" && entry.occurredOn === key ? total + entry.amount : total), 0)
    const membership = membershipOnDay(associates, fee, key, year, monthIndex)
    return { ...point, revenue: point.revenue + extra + membership }
  })
}

function withManualMonthly(
  monthly: Array<{ label: string; revenue: number }>,
  entries: CashEntry[],
  associates: Associate[],
  fee: number,
  now: Date,
) {
  return monthly.map((point, index) => {
    const start = new Date(now.getFullYear(), now.getMonth() - (monthly.length - 1 - index), 1)
    const key = monthKey(start)
    const extra = sumEntries(entries, "income", key)
    return { ...point, revenue: point.revenue + extra + membershipForMonth(associates, fee, key) }
  })
}

function membershipForMonth(associates: Associate[], fee: number, month: string) {
  if (fee <= 0) return 0
  return associates.reduce((total, associate) => {
    if (associate.status !== "active") return total
    return associate.createdAt.slice(0, 7) <= month ? total + fee : total
  }, 0)
}

function membershipOnDay(associates: Associate[], fee: number, dayKey: string, year: number, monthIndex: number) {
  if (fee <= 0) return 0
  return associates.reduce((total, associate) => {
    if (associate.status !== "active") return total
    return billingDay(associate.createdAt, year, monthIndex) === dayKey ? total + fee : total
  }, 0)
}

function billingDay(createdAt: string, year: number, monthIndex: number) {
  const [createdYear, createdMonth, createdDay] = createdAt.slice(0, 10).split("-").map(Number)
  const month = `${year}-${String(monthIndex + 1).padStart(2, "0")}`
  const createdMonthKey = `${createdYear}-${String(createdMonth).padStart(2, "0")}`
  if (createdMonthKey > month) return ""
  if (createdMonthKey === month) return createdAt.slice(0, 10)
  const lastDay = new Date(year, monthIndex + 1, 0).getDate()
  const day = Math.min(createdDay || 1, lastDay)
  return `${month}-${String(day).padStart(2, "0")}`
}

function formatDay(value: string) {
  const [year, month, day] = value.split("-")
  if (!year || !month || !day) return value
  return `${day}/${month}/${year}`
}

function Row({ term, value }: { term: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted-foreground">{term}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  )
}
