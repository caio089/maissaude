"use client"

import { Button } from "@/components/ui/button"
import { formatDate, formatMoney } from "@/lib/format"
import { useDemoStore } from "@/lib/store"
import { whatsAppLink } from "@/lib/whatsapp"

export function AppointmentConfirmation({ onAnother }: { onAnother: () => void }) {
  const data = useDemoStore((state) => state.data)
  const receipt = useDemoStore((state) => state.lastCheckout)
  const appointment = data.appointments.find((item) => item.id === receipt?.appointmentId)
  const patient = data.patients.find((item) => item.id === appointment?.patientId)
  const professional = data.professionals.find((item) => item.id === appointment?.professionalId)
  const service = professional?.services.find((item) => item.id === appointment?.serviceId)

  if (!receipt || receipt.outcome !== "approved" || !appointment || !patient || !professional) {
    return null
  }

  const when = `${formatDate(appointment.startsAt, "EEEE, d 'de' MMMM")} às ${formatDate(appointment.startsAt, "HH:mm")}`
  const paymentLabel = receipt.method === "pix" ? "Pix simulado" : "Cartão simulado"
  const message = [
    `Olá, ${data.clinic.name}. Confirmação de demonstração.`,
    `Paciente: ${patient.name}`,
    `CPF fictício: ${patient.cpf}`,
    `Consulta: ${service?.name ?? "Consulta"} com ${professional.name}`,
    `Quando: ${when}`,
    `Pagamento: ${paymentLabel} · ${formatMoney(receipt.amount)}`,
    `Reserva: ${receipt.reference}`,
  ].join("\n")
  const whatsAppHref = whatsAppLink(data.clinic.phone, message)

  return (
    <div className="px-5 pt-8 pb-8">
      <p className="text-xs font-medium uppercase tracking-wide text-teal">Demonstração</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">Consulta e pagamento confirmados</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        A reserva e o valor já estão na agenda e no financeiro da clínica, neste navegador.
      </p>
      <div className="mt-5 space-y-2 rounded-3xl bg-brand p-5 text-white">
        <p className="text-xs text-white/70">Reserva {receipt.reference}</p>
        <p className="text-lg font-semibold">{patient.name}</p>
        <p className="text-sm text-white/80">{professional.name}</p>
        <p className="text-sm text-white/80">{when}</p>
        <p className="pt-2 text-sm">{formatMoney(receipt.amount)} · {paymentLabel}</p>
      </div>
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
        Agendar outra consulta
      </Button>
    </div>
  )
}
