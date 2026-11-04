import { addMinutes, formatISO } from "date-fns"
import { NextResponse } from "next/server"

import { AppointmentConflictError, isAppointmentConflictError } from "@/lib/appointments/conflicts"
import { createAsaasCharge } from "@/lib/asaas/charges"
import { minimumAsaasCharge, minimumAsaasChargeMessage } from "@/lib/asaas/minimums"
import {
  calculateAssociateQuote,
  DEFAULT_ASSOCIATE_RULES,
  evaluateAssociateStatus,
  normalizeAssociateRules,
} from "@/lib/associate-rules"
import { cpfDigits, formatCpf } from "@/lib/cpf"
import { combineDateAndTime, createId } from "@/lib/format"
import type { CartPaymentLineInput } from "@/lib/payments/cart-quote"
import { PaymentAuthorizationError, requireCurrentPatient } from "@/lib/payments/current-patient"
import { createSupabaseAdmin } from "@/lib/supabase/admin"
import type { Associate, AssociateRules, CatalogKind } from "@/lib/types"

type BillingType = "PIX" | "CREDIT_CARD"
type AssociateAnswer = "yes" | "no"

type CartRequestBody = {
  lines?: CartPaymentLineInput[]
  billingType?: BillingType
  associateAnswer?: AssociateAnswer
  settleAssociateFee?: boolean
}

export async function POST(request: Request) {
  try {
    const patient = await requireCurrentPatient()
    const body = (await request.json()) as CartRequestBody
    const lines = Array.isArray(body.lines) ? body.lines.slice(0, 5) : []
    if (lines.length === 0) return NextResponse.json({ error: "Inclua ao menos um atendimento." }, { status: 400 })
    if (body.billingType !== "PIX" && body.billingType !== "CREDIT_CARD") {
      return NextResponse.json({ error: "Escolha Pix ou cartão." }, { status: 400 })
    }
    if (body.associateAnswer !== "yes" && body.associateAnswer !== "no") {
      return NextResponse.json({ error: "Informe se você é associado." }, { status: 400 })
    }

    const admin = createSupabaseAdmin()
    if (!admin) return NextResponse.json({ error: "Pagamentos ainda não foram configurados." }, { status: 503 })

    const cpf = cpfDigits(patient.cpf)
    const [{ data: associateRow }, { data: rulesRow }] = await Promise.all([
      admin
        .from("associates")
        .select("id,name,cpf,phone,email,status,overdue_months,next_due_date,created_at")
        .in("cpf", [cpf, formatCpf(cpf)])
        .limit(1)
        .maybeSingle(),
      admin
        .from("associate_rules")
        .select("fee,consultation_discount_percent,transport_enabled,transport_rides_per_month,extra_benefits,grace_months")
        .eq("id", true)
        .maybeSingle(),
    ])

    const rules: AssociateRules = normalizeAssociateRules({
      fee: Number(rulesRow?.fee) || DEFAULT_ASSOCIATE_RULES.fee,
      consultationDiscountPercent:
        Number(rulesRow?.consultation_discount_percent) ?? DEFAULT_ASSOCIATE_RULES.consultationDiscountPercent,
      transportEnabled: rulesRow?.transport_enabled,
      transportRidesPerMonth: Number(rulesRow?.transport_rides_per_month),
      extraBenefits: rulesRow?.extra_benefits,
      graceMonths: Number(rulesRow?.grace_months),
    })

    const associate: Associate | null = associateRow
      ? {
          id: associateRow.id,
          name: associateRow.name,
          cpf: associateRow.cpf,
          phone: associateRow.phone,
          email: associateRow.email,
          status: associateRow.status,
          overdueMonths: associateRow.overdue_months ?? 0,
          nextDueDate: associateRow.next_due_date,
          createdAt: associateRow.created_at,
        }
      : null

    const evaluation = associate
      ? evaluateAssociateStatus({
          status: associate.status,
          overdueMonths: associate.overdueMonths,
          graceMonths: rules.graceMonths,
        })
      : null

    if (body.associateAnswer === "yes") {
      if (!associate || !evaluation || !evaluation.graceEligible) {
        return NextResponse.json(
          {
            error: "Não encontramos uma associação ativa para este CPF. Continue sem desconto ou assine o plano.",
            code: "ASSOCIATE_NOT_ACTIVE",
          },
          { status: 409 },
        )
      }
    }

    type PreparedCartLine = {
      index: number
      professionalId: string
      serviceId: string
      service: { name: string; modality: string; duration_min: number }
      startsAt: Date
      endsAt: Date
      price: number
      settlementFee: number
      totalAmount: number
      appliedDiscount: number
      kind: CatalogKind
      listPrice: number
    }

    const preparedLines: PreparedCartLine[] = []
    let settlementFeePending =
      body.associateAnswer === "yes" &&
      Boolean(body.settleAssociateFee) &&
      evaluation?.status === "overdue"

    for (const [index, line] of lines.entries()) {
      const professionalId = line.professionalId?.trim()
      const serviceId = line.serviceId?.trim()
      const date = line.date?.trim()
      const time = line.time?.trim()
      if (!professionalId || !serviceId || !/^\d{4}-\d{2}-\d{2}$/.test(date || "") || !/^\d{2}:\d{2}$/.test(time || "")) {
        throw new Error("Um dos atendimentos está incompleto.")
      }

      const { data: professional } = await admin
        .from("professionals")
        .select("id, active, work_days, start_hour, end_hour")
        .eq("id", professionalId)
        .maybeSingle()
      const { data: service } = await admin
        .from("professional_services")
        .select("id, name, price, duration_min, modality")
        .eq("id", serviceId)
        .eq("professional_id", professionalId)
        .maybeSingle()
      if (!professional?.active || !service) throw new Error("Serviço ou profissional indisponível.")

      const startsAt = combineDateAndTime(date as string, time as string)
      const endsAt = addMinutes(startsAt, Number(service.duration_min))
      const weekday = new Date(`${date}T12:00:00Z`).getUTCDay()
      if (startsAt <= new Date() || !Array.isArray(professional.work_days) || !professional.work_days.includes(weekday)) {
        throw new Error("Escolha um horário futuro dentro da agenda do profissional.")
      }

      const cartCollision = preparedLines.some(
        (prev) => prev.professionalId === professionalId && prev.startsAt < endsAt && prev.endsAt > startsAt,
      )
      if (cartCollision) {
        throw new Error("Conflito de horário entre itens do próprio carrinho.")
      }

      const { data: conflicts } = await admin
        .from("appointments")
        .select("id, starts_at, ends_at")
        .eq("professional_id", professionalId)
        .in("status", ["scheduled", "confirmed"])
        .lt("starts_at", formatISO(endsAt))
        .gt("ends_at", formatISO(startsAt))
      const { data: blocks } = await admin
        .from("blocked_slots")
        .select("id")
        .eq("professional_id", professionalId)
        .lt("starts_at", formatISO(endsAt))
        .gt("ends_at", formatISO(startsAt))
      if ((conflicts?.length || 0) > 0 || (blocks?.length || 0) > 0) {
        throw new Error("Este horário acabou de ser reservado. Escolha outro.")
      }

      const { data: offer } = await admin
        .from("catalog_offers")
        .select("id, kind")
        .eq("id", serviceId)
        .maybeSingle()
      const kind: CatalogKind = offer?.kind === "exame" || offer?.kind === "cirurgia" ? offer.kind : "consulta"
      const listPrice = Number(service.price)
      if (!Number.isFinite(listPrice) || listPrice <= 0) {
        throw new Error("O atendimento está sem valor válido.")
      }

      let consultationPrice = listPrice
      let settlementFee = 0

      if (body.associateAnswer === "yes" && associate && evaluation?.graceEligible) {
        if (kind === "consulta") {
          const effectiveAssociate =
            body.settleAssociateFee && !settlementFeePending
              ? { ...associate, status: "active" as const, overdueMonths: 0 }
              : associate
          const quote = calculateAssociateQuote({
            listPrice,
            rules,
            associate: effectiveAssociate,
            settleOverdue: settlementFeePending,
          })
          consultationPrice = quote.consultationPrice
          settlementFee = quote.overdueSettlementFee
          if (settlementFeePending && settlementFee > 0) {
            settlementFeePending = false
          }
        } else {
          consultationPrice = listPrice
          if (settlementFeePending) {
            settlementFee = evaluation.overdueMonths * rules.fee
            settlementFeePending = false
          }
        }
      }

      const totalAmount = money(consultationPrice + settlementFee)
      const appliedDiscount = money(listPrice - consultationPrice)

      preparedLines.push({
        index,
        professionalId,
        serviceId,
        service: { name: service.name, modality: service.modality, duration_min: service.duration_min },
        startsAt,
        endsAt,
        price: consultationPrice,
        settlementFee,
        totalAmount,
        appliedDiscount,
        kind,
        listPrice,
      })
    }

    const minimumCharge = minimumAsaasCharge(body.billingType)
    if (preparedLines.some((line) => line.totalAmount < minimumCharge)) {
      return NextResponse.json(
        {
          error: minimumAsaasChargeMessage(body.billingType),
          code: "PAYMENT_VALUE_BELOW_MINIMUM",
          minimumCharge,
        },
        { status: 422 },
      )
    }

    const charges: Array<{
      appointmentId: string
      paymentId: string
      value: number
      billingType: BillingType
      status?: string
      invoiceUrl: string | null
      pix: { payload: string | null; encodedImage: string | null } | null
      pixUnavailable: boolean
      settlementFee?: number
      consultationPrice?: number
    }> = []

    const createdAppointments: string[] = []
    const createdPayments: string[] = []

    try {
      for (const item of preparedLines) {
        const appointmentId = createId("apt")
        const paymentId = createId("pay")
        const reference = `PG-${crypto.randomUUID().replace(/-/g, "").slice(0, 10).toUpperCase()}`
        const { error: appointmentError } = await admin.from("appointments").insert({
          id: appointmentId,
          patient_id: patient.id,
          professional_id: item.professionalId,
          service_id: item.serviceId,
          starts_at: formatISO(item.startsAt),
          ends_at: formatISO(item.endsAt),
          status: "scheduled",
          modality: item.service.modality,
          notes: "Agendamento aguardando confirmação de pagamento.",
          origin: "mobile",
        })
        if (isAppointmentConflictError(appointmentError)) throw new AppointmentConflictError()
        if (appointmentError) throw new Error("Não foi possível reservar esse horário.")
        createdAppointments.push(appointmentId)

        const discountText =
          item.appliedDiscount > 0 ? ` · desconto de associado ${rules.consultationDiscountPercent}%` : ""
        const settlementText = item.settlementFee > 0 ? " · quitação de mensalidade associado" : ""
        const paymentDescription = `${item.service.name}${discountText}${settlementText}`

        const paymentMetadata =
          body.settleAssociateFee && associate && item.settlementFee > 0
            ? {
                settleAssociateFee: true,
                associateId: associate.id,
                settlementFee: item.settlementFee,
              }
            : null

        const { error: paymentError } = await admin.from("payments").insert({
          id: paymentId,
          appointment_id: appointmentId,
          patient_id: patient.id,
          professional_id: item.professionalId,
          amount: item.totalAmount,
          method: body.billingType === "PIX" ? "pix" : "card",
          status: "pending",
          reference,
          simulated: false,
          description: paymentDescription,
          ...(paymentMetadata ? { metadata: paymentMetadata } : {}),
        })
        if (paymentError) throw new Error(paymentError.message)
        createdPayments.push(paymentId)

        const chargeDescription =
          item.settlementFee > 0
            ? `Agendamento: ${item.service.name} + Quitação de mensalidade`
            : `Agendamento: ${item.service.name}`

        const result = await createAsaasCharge({
          name: patient.name,
          cpf: patient.cpf,
          email: patient.email,
          mobilePhone: patient.phone,
          patientId: patient.id,
          paymentId,
          value: item.totalAmount,
          billingType: body.billingType,
          description: chargeDescription,
          externalReference: reference,
        })
        await admin.from("appointments").update({ payment_id: paymentId }).eq("id", appointmentId)
        charges.push({
          appointmentId,
          paymentId,
          value: item.totalAmount,
          billingType: body.billingType,
          status: result.payment.status,
          invoiceUrl: result.payment.invoiceUrl || null,
          pix: result.pix ? { payload: result.pix.payload || null, encodedImage: result.pix.encodedImage || null } : null,
          pixUnavailable: result.pixUnavailable,
          ...(item.settlementFee > 0 ? { settlementFee: item.settlementFee, consultationPrice: item.price } : {}),
        })
      }

      const totalSettlementPaid = preparedLines.reduce((sum, line) => sum + line.settlementFee, 0)
      const isImmediatelySettled = charges.every(
        (c) =>
          c.status === "CONFIRMED" ||
          c.status === "RECEIVED" ||
          c.status === "RECEIVED_IN_CASH" ||
          (c as any).simulated === true ||
          c.status === undefined,
      )

      if (body.settleAssociateFee && associate && totalSettlementPaid > 0 && isImmediatelySettled) {
        await admin
          .from("associates")
          .update({
            status: "active",
            overdue_months: 0,
            last_paid_at: new Date().toISOString(),
          })
          .eq("id", associate.id)
      }
    } catch (error) {
      if (createdPayments.length > 0) {
        await admin.from("payments").delete().in("id", createdPayments)
      }
      if (createdAppointments.length > 0) {
        await admin.from("appointments").delete().in("id", createdAppointments)
      }
      throw error
    }

    const totalSettlementPaid = preparedLines.reduce((sum, line) => sum + line.settlementFee, 0)
    const listTotal = money(preparedLines.reduce((sum, line) => sum + line.listPrice, 0))
    const total = money(preparedLines.reduce((sum, line) => sum + line.totalAmount, 0))
    const discount = money(preparedLines.reduce((sum, line) => sum + line.appliedDiscount, 0))
    const isAssociateEffective =
      body.associateAnswer === "yes" &&
      Boolean(associate) &&
      (evaluation?.status === "active" || Boolean(body.settleAssociateFee))

    const quoteSummary = {
      associate: {
        active: isAssociateEffective,
        discountPercent: isAssociateEffective ? rules.consultationDiscountPercent : 0,
        fee: rules.fee,
      },
      lines: preparedLines.map((line) => ({
        professionalId: line.professionalId,
        serviceId: line.serviceId,
        kind: line.kind,
        listPrice: line.listPrice,
        amount: line.totalAmount,
      })),
      listTotal,
      total,
      discount,
      overdueSettlementFee: totalSettlementPaid,
    }

    return NextResponse.json({ charges, quote: quoteSummary })
  } catch (error) {
    const status = error instanceof PaymentAuthorizationError ? 401 : error instanceof AppointmentConflictError ? 409 : 422
    return NextResponse.json({ error: error instanceof Error ? error.message : "Não foi possível gerar as cobranças." }, { status })
  }
}

function money(value: number) {
  return Math.round(value * 100) / 100
}
