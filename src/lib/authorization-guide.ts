import { formatDate, formatMoney } from "@/lib/format"
import type { AssociateBenefitSnapshot } from "@/lib/types"

export const GUIDE_LOGO_SRC = "/brand/cuidarsaude-logo.png"

export interface AuthorizationGuideInput {
  reference: string
  authorizedAt: string
  patient: { name: string; cpf: string; birthDate: string }
  clinic: { name: string; phone: string; address: string; city: string }
  appointmentAt: string
  professional: {
    name: string
    specialtyLabel: string
    credentialLabel: string
    credentialCode: string
    location: string
    startHour: string
    endHour: string
  }
  serviceName: string
  procedures?: Array<{ code: string; description: string; doctor: string; sector: string }>
  associateBenefit?: AssociateBenefitSnapshot | null
}

const PAGE_WIDTH = 794
const PAGE_HEIGHT = 1900

export function guideCredentials(reference: string) {
  const compact = reference.replace(/[^a-zA-Z0-9]/g, "")
  const digits = compact.replace(/\D/g, "").padStart(6, "0").slice(-6)
  return {
    number: `${digits}.1`,
    password: compact.slice(-6).toLowerCase(),
  }
}

export async function createAuthorizationGuide(input: AuthorizationGuideInput) {
  const canvas = document.createElement("canvas")
  const scale = 2
  canvas.width = PAGE_WIDTH * scale
  canvas.height = PAGE_HEIGHT * scale
  const context = canvas.getContext("2d")
  if (!context) throw new Error("Não foi possível preparar a imagem da guia.")

  context.scale(scale, scale)
  context.fillStyle = "#ffffff"
  context.fillRect(0, 0, PAGE_WIDTH, PAGE_HEIGHT)

  const logo = await loadOptionalLogo(GUIDE_LOGO_SRC)
  drawHeader(context, logo, input.clinic.name)
  const credentials = guideCredentials(input.reference)
  drawCredentialBoxes(context, credentials.number, credentials.password)

  let y = 248
  y = drawSection(context, y, "Dados do paciente", [
    ["Matrícula", input.patient.cpf.replace(/\D/g, "")],
    ["Nome", input.patient.name],
    ["Data de nascimento", formatDay(input.patient.birthDate)],
  ])
  y += 18
  if (input.associateBenefit) {
    y = drawSection(context, y, "Benefícios do associado", associateBenefitRows(input.associateBenefit))
    y += 18
  }
  y = drawSection(context, y, "Dados do médico", [
    ["Nome", input.professional.name],
    ["Especialidade", input.professional.specialtyLabel],
    ["Registro", `${input.professional.credentialLabel} ${input.professional.credentialCode}`],
    ["Local", input.professional.location],
    ["Atendimento", `${input.professional.startHour} às ${input.professional.endHour}`],
  ])
  y += 18
  const city = splitCity(input.clinic.city)
  y = drawSection(context, y, "Local e data da realização", [
    ["Nome", input.clinic.name],
    ["Telefone", input.clinic.phone.replace(/\D/g, "")],
    ["Data da agenda", formatDate(input.appointmentAt, "dd/MM/yyyy 'às' HH:mm")],
    ["Endereço", input.clinic.address],
    ["Município", city.municipio],
    ["UF", city.uf],
  ])
  y += 18
  const procedures = input.procedures?.length
    ? input.procedures
    : [{
        code: "CS-CONSULTA",
        description: input.serviceName,
        doctor: input.professional.name,
        sector: input.professional.specialtyLabel,
      }]
  y = drawProcedureTable(context, y, procedures)
  const bottom = drawFooter(context, input, y + 28)
  const image = cropCanvas(canvas, scale, bottom + 40)

  const blob = await new Promise<Blob | null>((resolve) => image.toBlob(resolve, "image/png"))
  if (!blob) throw new Error("Não foi possível gerar a imagem da guia.")
  return blob
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

function associateBenefitRows(benefit: AssociateBenefitSnapshot) {
  const rows: Array<[string, string]> = [["Associado", benefit.name]]
  if (benefit.discountPercent > 0) {
    rows.push(["Desconto na consulta", `${benefit.discountPercent}% · de ${formatMoney(benefit.listPrice)} por ${formatMoney(benefit.amount)}`])
  }
  if (benefit.transportRides > 0) {
    rows.push(["Transporte", `${benefit.transportRides} passagens no mês`])
  }
  if (benefit.extras.length > 0) {
    rows.push(["Também", benefit.extras.join(" · ")])
  }
  return rows
}

function drawHeader(context: CanvasRenderingContext2D, logo: HTMLImageElement | null, clinicName: string) {
  if (logo) {
    context.drawImage(logo, 48, 42, 56, 56)
  } else {
    drawMark(context, 48, 42, 56)
  }
  context.fillStyle = "#0d3b4c"
  context.font = "700 22px system-ui, sans-serif"
  context.fillText(clinicName, 120, 66)
  context.fillStyle = "#5c6b73"
  context.font = "14px system-ui, sans-serif"
  context.fillText("Guia de autorização", 120, 88)
  context.fillStyle = "#0d3b4c"
  context.font = "700 28px system-ui, sans-serif"
  context.fillText("GUIA DE AUTORIZAÇÃO", 48, 150)
}

function drawCredentialBoxes(context: CanvasRenderingContext2D, number: string, password: string) {
  drawBox(context, 48, 172, 330, 52, "GUIA", number)
  drawBox(context, 394, 172, 352, 52, "SENHA", password)
}

function drawBox(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, label: string, value: string) {
  context.strokeStyle = "#d5e2e6"
  context.lineWidth = 1
  context.strokeRect(x, y, width, height)
  context.fillStyle = "#5c6b73"
  context.font = "12px system-ui, sans-serif"
  context.fillText(label, x + 14, y + 20)
  context.fillStyle = "#102027"
  context.font = "700 18px system-ui, sans-serif"
  context.fillText(value, x + 14, y + 40)
}

function drawSection(context: CanvasRenderingContext2D, y: number, title: string, rows: Array<[string, string]>) {
  context.fillStyle = "#0d3b4c"
  context.fillRect(48, y, 698, 28)
  context.fillStyle = "#ffffff"
  context.font = "600 13px system-ui, sans-serif"
  context.fillText(title, 60, y + 19)
  let cursor = y + 52
  for (const [label, value] of rows) {
    context.fillStyle = "#5c6b73"
    context.font = "13px system-ui, sans-serif"
    context.fillText(label, 60, cursor)
    context.fillStyle = "#102027"
    context.font = "600 14px system-ui, sans-serif"
    cursor = fillWrapped(context, value, 230, cursor, 500, 20)
    cursor += 10
  }
  return cursor
}

function drawProcedureTable(
  context: CanvasRenderingContext2D,
  y: number,
  rows: Array<{ code: string; description: string; doctor: string; sector: string }>,
) {
  context.fillStyle = "#0d3b4c"
  context.fillRect(48, y, 698, 28)
  context.fillStyle = "#ffffff"
  context.font = "600 13px system-ui, sans-serif"
  context.fillText("Dados dos procedimentos", 60, y + 19)

  const headers = [
    { label: "Código", x: 60 },
    { label: "Descrição", x: 170 },
    { label: "Qtd.", x: 360 },
    { label: "Médico executante", x: 410 },
    { label: "Setor", x: 610 },
  ]
  context.fillStyle = "#eef6f7"
  context.fillRect(48, y + 28, 698, 26)
  context.fillStyle = "#5c6b73"
  context.font = "12px system-ui, sans-serif"
  for (const header of headers) context.fillText(header.label, header.x, y + 46)

  let cursor = y + 74
  for (const row of rows) {
    context.fillStyle = "#102027"
    context.font = "13px system-ui, sans-serif"
    const columns = [
      { value: row.code, x: 60, width: 100 },
      { value: row.description, x: 170, width: 180 },
      { value: "1", x: 360, width: 40 },
      { value: row.doctor, x: 410, width: 190 },
      { value: row.sector, x: 610, width: 120 },
    ]
    let rowBottom = cursor
    for (const column of columns) {
      rowBottom = Math.max(rowBottom, fillWrapped(context, column.value, column.x, cursor, column.width, 16))
    }
    cursor = rowBottom + 8
  }
  return cursor
}

function drawFooter(context: CanvasRenderingContext2D, input: AuthorizationGuideInput, y: number) {
  const printedAt = formatDate(new Date(), "dd/MM/yyyy 'às' HH:mm")
  const authorizedAt = formatDate(input.authorizedAt, "dd/MM/yyyy HH:mm")
  context.fillStyle = "#5c6b73"
  context.font = "12px system-ui, sans-serif"
  context.fillText(`Impresso em ${printedAt}`, 48, y)
  context.fillText(`Data da autorização: ${authorizedAt}`, 48, y + 20)
  context.fillStyle = "#0d3b4c"
  context.font = "600 13px system-ui, sans-serif"
  const warningBottom = fillWrapped(
    context,
    `Qualquer cobrança adicional feita pela clínica, não aceite. Informe pelo telefone ${input.clinic.phone}.`,
    48,
    y + 48,
    698,
    18,
  )
  context.fillStyle = "#8aa0a8"
  context.font = "11px system-ui, sans-serif"
  context.fillText("Documento fictício da demonstração CuidarSaude. Não autoriza atendimento real.", 48, warningBottom + 16)
  return warningBottom + 28
}

function cropCanvas(source: HTMLCanvasElement, scale: number, bottom: number) {
  const height = Math.min(PAGE_HEIGHT, Math.ceil(bottom))
  const cropped = document.createElement("canvas")
  cropped.width = PAGE_WIDTH * scale
  cropped.height = height * scale
  const context = cropped.getContext("2d")
  if (!context) return source
  context.drawImage(source, 0, 0, cropped.width, cropped.height, 0, 0, cropped.width, cropped.height)
  return cropped
}

function drawMark(context: CanvasRenderingContext2D, x: number, y: number, size: number) {
  context.save()
  context.translate(x, y)
  context.fillStyle = "#0d3b4c"
  context.beginPath()
  context.roundRect(0, 0, size, size, 12)
  context.fill()
  context.strokeStyle = "#7ed9d2"
  context.lineWidth = 3
  context.lineCap = "round"
  context.beginPath()
  context.moveTo(size / 2, 12)
  context.lineTo(size / 2, size - 12)
  context.moveTo(12, size / 2)
  context.lineTo(size - 12, size / 2)
  context.stroke()
  context.fillStyle = "#f4fbfb"
  context.beginPath()
  context.arc(size / 2, size / 2, 5, 0, Math.PI * 2)
  context.fill()
  context.restore()
}

function fillWrapped(context: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number) {
  const words = text.split(" ")
  let line = ""
  let cursor = y
  for (const word of words) {
    const next = line ? `${line} ${word}` : word
    if (context.measureText(next).width > maxWidth && line) {
      context.fillText(line, x, cursor)
      line = word
      cursor += lineHeight
    } else {
      line = next
    }
  }
  if (line) context.fillText(line, x, cursor)
  return cursor + lineHeight
}

function formatDay(value: string) {
  const [year, month, day] = value.split("-")
  if (!year || !month || !day) return value
  return `${day}/${month}/${year}`
}

function splitCity(city: string) {
  const [municipio, uf] = city.split(" - ")
  return { municipio: municipio?.trim() || city, uf: uf?.trim() || "" }
}

function loadOptionalLogo(src: string) {
  return new Promise<HTMLImageElement | null>((resolve) => {
    const image = new Image()
    const timer = window.setTimeout(() => resolve(null), 1200)
    image.onload = () => {
      window.clearTimeout(timer)
      resolve(image.width > 0 ? image : null)
    }
    image.onerror = () => {
      window.clearTimeout(timer)
      resolve(null)
    }
    image.src = src
  })
}
