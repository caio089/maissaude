"use client"

import { useMemo, useState } from "react"
import { Receipt } from "lucide-react"
import { toast } from "sonner"
import { MonthlyBars, RevenueArea } from "@/components/desktop/charts"
import { FadeIn } from "@/components/shared/fade-in"
import { EmptyState } from "@/components/shared/empty-state"
import { PaymentBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatDate, formatMoney } from "@/lib/format"
import { computeDashboard, sumAmount } from "@/lib/metrics"
import { useDemoStore } from "@/lib/store"
import type { Payment, PaymentStatus } from "@/lib/types"

export function FinanceView() {
  const data = useDemoStore((state) => state.data)
  const settlePayment = useDemoStore((state) => state.settlePayment)
  const [filter, setFilter] = useState<PaymentStatus | "all">("all")
  const [receipt, setReceipt] = useState<Payment | null>(null)
  const now = useMemo(() => new Date(), [])
  const metrics = computeDashboard(data, "month", now)
  const received = sumAmount(data.payments.filter((item) => item.status === "paid"))
  const pending = sumAmount(data.payments.filter((item) => item.status === "pending"))
  const rows = data.payments.filter((item) => filter === "all" || item.status === filter)

  return (
    <FadeIn className="space-y-5">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-teal">Pagamentos simulados</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Financeiro</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Nenhum valor desta tela foi cobrado de verdade. Um pagamento aprovado no aplicativo do paciente aparece aqui na hora, na mesma origem do navegador.
        </p>
      </div>
      <section className="grid gap-4 md:grid-cols-3">
        <article className="rounded-3xl bg-brand p-5 text-white">
          <p className="text-sm text-white/70">Receita do mês</p>
          <p className="mt-2 text-3xl font-semibold">{formatMoney(metrics.revenue)}</p>
        </article>
        <article className="panel p-5">
          <p className="text-sm text-muted-foreground">Recebido na demonstração</p>
          <p className="mt-2 text-3xl font-semibold">{formatMoney(received)}</p>
        </article>
        <article className="panel p-5">
          <p className="text-sm text-muted-foreground">Pendente</p>
          <p className="mt-2 text-3xl font-semibold">{formatMoney(pending)}</p>
        </article>
      </section>
      <section className="grid gap-4 xl:grid-cols-2">
        <div className="panel p-5">
          <h2 className="mb-3 text-lg font-semibold">Receita diária do mês</h2>
          <RevenueArea data={metrics.series} />
        </div>
        <div className="panel p-5">
          <h2 className="mb-3 text-lg font-semibold">Comparativo mensal</h2>
          <MonthlyBars data={metrics.monthly} />
        </div>
      </section>
      <div className="panel overflow-hidden">
        <div className="flex items-center justify-between gap-3 p-4">
          <h2 className="text-lg font-semibold">Lançamentos</h2>
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
        {rows.length === 0 ? <EmptyState icon={Receipt} title="Nenhum lançamento" description="Os pagamentos simulados aparecem nesta tabela." /> : (
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
                        <Button type="button" size="sm" variant="outline" onClick={() => { settlePayment(payment.id, "pix"); toast.success("Pagamento simulado registrado.") }}>
                          Receber Pix simulado
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
    </FadeIn>
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
          <span className="-rotate-12 text-4xl font-semibold tracking-[0.3em] text-primary/10">DEMONSTRAÇÃO</span>
        </div>
        <DialogHeader>
          <DialogTitle>Comprovante fictício</DialogTitle>
          <DialogDescription>Sem valor fiscal. Este documento existe só para a apresentação.</DialogDescription>
        </DialogHeader>
        {payment ? (
          <dl className="relative space-y-2 text-sm">
            <Row term="Referência" value={payment.reference} />
            <Row term="Paciente" value={patient?.name ?? "—"} />
            <Row term="Profissional" value={professional?.name ?? "—"} />
            <Row term="Valor" value={formatMoney(payment.amount)} />
            <Row term="Forma" value={payment.method === "pix" ? "Pix simulado" : "Cartão simulado"} />
            <Row term="Situação" value={payment.status} />
            <Row term="Data" value={formatDate(payment.paidAt ?? payment.createdAt, "dd/MM/yyyy HH:mm")} />
          </dl>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function Row({ term, value }: { term: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted-foreground">{term}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  )
}
