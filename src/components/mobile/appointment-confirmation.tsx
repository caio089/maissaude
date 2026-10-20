"use client"

import { useMemo } from "react"
import { AuthorizationGuideCard } from "@/components/mobile/authorization-guide-card"
import { Button } from "@/components/ui/button"
import { formatDate, formatMoney } from "@/lib/format"
import { useDemoStore } from "@/lib/store"
import { SPECIALTY_LABEL } from "@/lib/types"
import { whatsAppLink } from "@/lib/whatsapp"

export function AppointmentConfirmation({ onAnother }: { onAnother: () => void }) {
  const data = useDemoStore((state) => state.data)
  const receipt = useDemoStore((state) => state.lastCheckout)
  const appointment = data.appointments.find((item) => item.id === receipt?.appointmentId)
  const patient = data.patients.find((item) => item.id === appointment?.patientId)
  const professional = data.professionals.find((item) => item.id === appointment?.professionalId)
  const service = professional?.services.find((item) => item.id === appointment?.serviceId)
  const guide = useMemo(() => {
    if (!receipt || receipt.outcome !== "approved" || !appointment || !patient || !professional) return null
    return {
      reference: receipt.reference,
      authorizedAt: appointment.createdAt,
      patient: { name: patient.name, cpf: patient.cpf, birthDate: patient.birthDate },
      clinic: data.clinic,
      appointmentAt: appointment.startsAt,
      professional: {
        name: professional.name,
        specialtyLabel: SPECIALTY_LABEL[professional.specialty],
        credentialLabel: professional.credentialLabel,
        credentialCode: professional.credentialCode,
        location: professional.location,
        startHour: professional.startHour,
        endHour: professional.endHour,
      },
      serviceName: receipt.items?.[0]?.serviceName ?? service?.name ?? "Consulta",
      procedures: (receipt.items?.length ? receipt.items : [{
        serviceName: service?.name ?? "Consulta",
        professionalName: professional.name,
        specialtyLabel: SPECIALTY_LABEL[professional.specialty],
        kind: "consulta" as const,
      }]).map((item) => ({
        code: item.kind === "exame" ? "CS-EXAME" : item.kind === "cirurgia" ? "CS-CIRURGIA" : "CS-CONSULTA",
        description: item.serviceName,
        doctor: item.professionalName,
        sector: item.specialtyLabel,
      })),
      associateBenefit: receipt.associateBenefit ?? null,
    }
  }, [appointment, data.clinic, patient, professional, receipt, service?.name])

  if (!receipt || receipt.outcome !== "approved" || !appointment || !patient || !professional || !guide) {
    return null
  }

  const items = receipt.items?.length
    ? receipt.items
    : [{
        serviceName: service?.name ?? "Consulta",
        professionalName: professional.name,
        startsAt: appointment.startsAt,
        amount: receipt.amount,
        kind: "consulta" as const,
        specialtyLabel: SPECIALTY_LABEL[professional.specialty],
      }]
  const when = `${formatDate(appointment.startsAt, "EEEE, d 'de' MMMM")} às ${formatDate(appointment.startsAt, "HH:mm")}`
  const paymentLabel = receipt.method === "pix" ? "Pix simulado" : "Cartão simulado"
  const message = [
    `Olá, ${data.clinic.name}. Confirmação de demonstração.`,
    `Paciente: ${patient.name}`,
    `CPF fictício: ${patient.cpf}`,
    ...items.map((item) => `${item.serviceName} com ${item.professionalName} · ${formatDate(item.startsAt, "dd/MM/yyyy HH:mm")}`),
    receipt.associateBenefit
      ? `Pagamento: ${paymentLabel} · ${formatMoney(receipt.amount)} com desconto de associado ${receipt.associateBenefit.discountPercent}%`
      : `Pagamento: ${paymentLabel} · ${formatMoney(receipt.amount)}`,
    receipt.associateBenefit?.transportRides
      ? `Transporte: ${receipt.associateBenefit.transportRides} passagens no mês`
      : "",
    `Reserva: ${receipt.reference}`,
  ].filter(Boolean).join("\n")
  const whatsAppHref = whatsAppLink(data.clinic.phone, message)

  return (
    <div className="px-4 pt-6 pb-8">
      <p className="section-kicker">Pedido concluído</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">Pagamento confirmado</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        A reserva e o valor já estão na agenda e no financeiro da clínica, neste navegador.
      </p>
      <div className="mt-5 space-y-2 rounded-[1.6rem] bg-brand p-5 text-white">
        <p className="text-xs text-white/70">Reserva {receipt.reference}</p>
        <p className="text-lg font-semibold">{patient.name}</p>
        <ul className="mt-3 space-y-2 text-sm text-white/85">
          {items.map((item) => (
            <li key={`${item.serviceName}-${item.startsAt}`}>
              {item.serviceName} · {item.professionalName} · {formatDate(item.startsAt, "dd/MM HH:mm")}
            </li>
          ))}
        </ul>
        <p className="text-sm text-white/80">{when}</p>
        {receipt.associateBenefit ? (
          <p className="pt-2 text-sm">
            {formatMoney(receipt.amount)} · {paymentLabel} · desconto {receipt.associateBenefit.discountPercent}%
            {receipt.associateBenefit.transportRides > 0 ? ` · ${receipt.associateBenefit.transportRides} passagens` : ""}
          </p>
        ) : (
          <p className="pt-2 text-sm">{formatMoney(receipt.amount)} · {paymentLabel}</p>
        )}
      </div>
      <AuthorizationGuideCard input={guide} />
      <a
        href={whatsAppHref}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-4 flex h-12 items-center justify-center rounded-lg bg-[#128C7E] px-4 text-sm font-medium text-white"
      >
        Continuar no WhatsApp
      </a>
      <p className="mt-3 text-xs leading-5 text-muted-foreground">
        O botão abre o WhatsApp com a confirmação pronta. A mensagem só é enviada se a pessoa confirmar no aplicativo. O número da clínica é fictício.
      </p>
      <Button type="button" variant="outline" className="mt-4 h-12 w-full" onClick={onAnother}>
        Voltar para o começo
      </Button>
    </div>
  )
}
