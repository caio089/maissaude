import { formatDate, formatMoney } from "@/lib/format"
import type { AssociateBenefitSnapshot } from "@/lib/types"
import { isPhotoUrl, portraitUri } from "@/components/shared/portrait"

export { isPhotoUrl }

export const GUIDE_LOGO_SRC = "/brand/cuidarsaude-logo.png"

export interface AuthorizationGuideInput {
  reference: string
  authorizedAt: string
  patient: { name?: string | null; cpf?: string | null; birthDate?: string | null }
  clinic: { name: string; phone?: string | null; address?: string | null; city?: string | null }
  appointmentAt: string
  professional: {
    name?: string | null
    specialtyLabel?: string | null
    credentialLabel?: string | null
    credentialCode?: string | null
    location?: string | null
    startHour?: string | null
    endHour?: string | null
    photoUrl?: string | null
  }
  serviceName?: string | null
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

export function loadOptionalImage(url?: string | null): Promise<HTMLImageElement | null> {
  if (!url || typeof url !== "string" || !url.trim()) {
    return Promise.resolve(null)
  }

  return new Promise<HTMLImageElement | null>((resolve) => {
    try {
      const ImgConstructor =
        typeof Image !== "undefined"
          ? Image
          : typeof window !== "undefined" && window.Image
          ? window.Image
          : (globalThis as unknown as { Image?: new () => HTMLImageElement }).Image

      if (!ImgConstructor || typeof ImgConstructor !== "function") {
        resolve(null)
        return
      }

      const image = new ImgConstructor()
      if (!url.startsWith("data:")) {
        image.crossOrigin = "anonymous"
      }

      const timer = setTimeout(() => {
        resolve(null)
      }, 2000)

      image.onload = () => {
        clearTimeout(timer)
        resolve((image.naturalWidth || image.width || 0) > 0 ? image : null)
      }
      image.onerror = () => {
        clearTimeout(timer)
        resolve(null)
      }
      image.src = url
    } catch {
      resolve(null)
    }
  })
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

  const logo = await loadOptionalImage(GUIDE_LOGO_SRC)
  const credentials = guideCredentials(input.reference)
  drawHeader(context, logo, input.clinic.name, credentials.number, input.authorizedAt)
  drawCredentialBoxes(context, credentials.number, credentials.password)

  let y = 248
  y = drawSection(context, y, "Dados do paciente", [
    ...optionalRow("Matrícula", input.patient.cpf?.replace(/\D/g, "")),
    ...optionalRow("Nome", input.patient.name),
    ...optionalRow("Data de nascimento", input.patient.birthDate ? formatDay(input.patient.birthDate) : undefined),
  ])
  y += 18
  if (input.associateBenefit) {
    y = drawSection(context, y, "Benefícios do associado", associateBenefitRows(input.associateBenefit))
    y += 18
  }

  const professionalName = input.professional.name?.trim() || "Profissional não informado"
  const normalizedProName = professionalName
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
  const isGeneralClinic =
    normalizedProName === "geral da clinica" ||
    normalizedProName === "corpo clinico"

  let photoToLoad: string | null = null
  if (!isGeneralClinic) {
    if (input.professional.photoUrl && isPhotoUrl(input.professional.photoUrl)) {
      photoToLoad = input.professional.photoUrl
    } else if (isPhotoUrl(professionalName)) {
      photoToLoad = professionalName
    } else {
      photoToLoad = portraitUri(professionalName)
    }
  }

  const doctorPhoto = photoToLoad ? await loadOptionalImage(photoToLoad) : null

  const professionalRows: SectionRowItem[] = [
    ...optionalRow("Nome", professionalName),
    ...optionalRow("Especialidade", input.professional.specialtyLabel),
    ...optionalRow("Registro", joinPresent(input.professional.credentialLabel, input.professional.credentialCode)),
    ...optionalRow("Local", input.professional.location),
    ...optionalRow("Atendimento", joinHours(input.professional.startHour, input.professional.endHour)),
  ]
  if (professionalRows.length > 0) {
    y = drawDoctorSection(
      context,
      y,
      "Dados do médico",
      professionalRows.map(([label, value]) => [label, value]),
      doctorPhoto,
      isGeneralClinic,
      professionalName,
    )
    y += 18
  }

  const city = splitCity(input.clinic.city || "")
  const fullAddress = input.clinic.address
    ? input.clinic.address + (city.municipio ? ` - ${city.municipio}${city.uf ? `/${city.uf}` : ""}` : "")
    : ""
  const formattedAppointment = formatDate(input.appointmentAt, "dd/MM/yyyy 'às' HH:mm")
  const formattedPhone = input.clinic.phone ? formatPhone(input.clinic.phone) : ""

  y = drawSection(context, y, "Local e data da realização", [
    ...optionalRow("Unidade de atendimento", input.clinic.name),
    ...optionalRow("Telefone de contato", formattedPhone),
    ...optionalRow("Data e horário agendado", formattedAppointment, true),
    ...optionalRow("Endereço completo", fullAddress),
    ...optionalRow("Município / UF", city.uf ? `${city.municipio} · ${city.uf}` : city.municipio),
  ])
  if (!input.clinic.address && !input.clinic.phone && !input.clinic.city) {
    y -= 46
  }
  y += 18

  const procedures = input.procedures?.length
    ? input.procedures
    : [{
        code: "CS-CONSULTA",
        description: input.serviceName || "Serviço não informado",
        doctor: professionalName,
        sector: input.professional.specialtyLabel || "—",
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

function associateBenefitRows(benefit: AssociateBenefitSnapshot): Array<[string, string]> {
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

function drawHeader(
  context: CanvasRenderingContext2D,
  logo: HTMLImageElement | null,
  clinicName: string,
  guideNumber?: string,
  authorizedAt?: string,
) {
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

  drawHeaderAuthStamp(context, 516, 42, 230, 56, guideNumber, authorizedAt)

  context.fillStyle = "#0d3b4c"
  context.font = "700 28px system-ui, sans-serif"
  context.fillText("GUIA DE AUTORIZAÇÃO", 48, 150)
}

function drawHeaderAuthStamp(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  guideNumber?: string,
  authorizedAt?: string,
) {
  context.save()
  context.fillStyle = "#f0fdf4"
  context.beginPath()
  if (typeof context.roundRect === "function") {
    context.roundRect(x, y, width, height, 8)
  } else {
    context.rect(x, y, width, height)
  }
  context.fill()

  context.strokeStyle = "#0d5f47"
  context.lineWidth = 1.5
  context.stroke()

  context.strokeStyle = "#86efac"
  context.lineWidth = 1
  context.strokeRect(x + 3, y + 3, width - 6, height - 6)

  context.textAlign = "center"
  context.fillStyle = "#0d5f47"
  context.font = "700 13px system-ui, sans-serif"
  context.fillText("✓ GUIA AUTORIZADA", x + width / 2, y + 21)

  context.fillStyle = "#047857"
  context.font = "600 10px system-ui, sans-serif"
  const dateStr = authorizedAt ? formatDate(authorizedAt, "dd/MM/yyyy HH:mm") : ""
  const infoText = dateStr ? `AUTENTICADA · ${dateStr}` : "AUTENTICADA DIGITALMENTE"
  context.fillText(infoText, x + width / 2, y + 36)

  if (guideNumber) {
    context.fillStyle = "#65a30d"
    context.font = "500 9px system-ui, sans-serif"
    context.fillText(`CÓD: ${guideNumber}`, x + width / 2, y + 49)
  }
  context.restore()
}

function drawCredentialBoxes(context: CanvasRenderingContext2D, number: string, password: string) {
  drawBox(context, 48, 172, 222, 52, "Nº DA GUIA", number)
  drawBox(context, 282, 172, 222, 52, "SENHA DE ATENDIMENTO", password)
  drawAuthenticBadge(context, 516, 172, 230, 52)
}

function drawAuthenticBadge(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number) {
  context.save()
  context.fillStyle = "#0d5f47"
  context.beginPath()
  if (typeof context.roundRect === "function") {
    context.roundRect(x, y, width, height, 6)
  } else {
    context.rect(x, y, width, height)
  }
  context.fill()

  context.strokeStyle = "#34d399"
  context.lineWidth = 1
  context.strokeRect(x + 3, y + 3, width - 6, height - 6)

  context.textAlign = "center"
  context.fillStyle = "#ffffff"
  context.font = "700 13px system-ui, sans-serif"
  context.fillText("✓ GUIA AUTORIZADA", x + width / 2, y + 22)

  context.fillStyle = "#a7f3d0"
  context.font = "600 10px system-ui, sans-serif"
  context.fillText("AUTENTICADA NO SISTEMA", x + width / 2, y + 39)
  context.restore()
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

type SectionRowItem = [label: string, value: string, highlight?: boolean]

function drawSection(context: CanvasRenderingContext2D, y: number, title: string, rows: SectionRowItem[]) {
  context.fillStyle = "#0d3b4c"
  context.fillRect(48, y, 698, 28)
  context.fillStyle = "#ffffff"
  context.font = "600 13px system-ui, sans-serif"
  context.fillText(title, 60, y + 19)

  let cursor = y + 52
  for (const [label, value, highlight] of rows) {
    if (highlight) {
      context.save()
      context.fillStyle = "#f0fdf4"
      context.strokeStyle = "#86efac"
      context.lineWidth = 1.5
      context.beginPath()
      if (typeof context.roundRect === "function") {
        context.roundRect(54, cursor - 16, 686, 28, 6)
      } else {
        context.rect(54, cursor - 16, 686, 28)
      }
      context.fill()
      context.stroke()

      context.fillStyle = "#0d5f47"
      context.font = "700 13px system-ui, sans-serif"
      context.fillText(label, 64, cursor + 3)

      context.fillStyle = "#047857"
      context.font = "700 15px system-ui, sans-serif"
      context.fillText(value, 230, cursor + 3)
      context.restore()
      cursor += 36
    } else {
      context.fillStyle = "#5c6b73"
      context.font = "13px system-ui, sans-serif"
      context.fillText(label, 60, cursor)
      context.fillStyle = "#102027"
      context.font = "600 14px system-ui, sans-serif"
      cursor = fillWrapped(context, value, 230, cursor, 500, 20)
      cursor += 10
    }
  }
  return cursor
}

function drawDoctorSection(
  context: CanvasRenderingContext2D,
  y: number,
  title: string,
  rows: Array<[string, string]>,
  doctorPhoto: HTMLImageElement | null,
  isGeneralClinic: boolean,
  professionalName: string,
) {
  context.fillStyle = "#0d3b4c"
  context.fillRect(48, y, 698, 28)
  context.fillStyle = "#ffffff"
  context.font = "600 13px system-ui, sans-serif"
  context.fillText(title, 60, y + 19)

  const photoCenterX = 672
  const photoCenterY = y + 74
  const photoRadius = 32

  if (doctorPhoto) {
    drawCircularPhoto(context, doctorPhoto, photoCenterX, photoCenterY, photoRadius)
  } else if (isGeneralClinic) {
    drawClinicSeal(context, photoCenterX, photoCenterY, photoRadius)
  } else {
    drawInitialsAvatar(context, photoCenterX, photoCenterY, photoRadius, professionalName)
  }

  let cursor = y + 52
  for (const [label, value] of rows) {
    context.fillStyle = "#5c6b73"
    context.font = "13px system-ui, sans-serif"
    context.fillText(label, 60, cursor)
    context.fillStyle = "#102027"
    context.font = "600 14px system-ui, sans-serif"
    cursor = fillWrapped(context, value, 230, cursor, 390, 20)
    cursor += 10
  }

  return Math.max(cursor, y + 128)
}

function drawCircularPhoto(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  centerX: number,
  centerY: number,
  radius: number,
) {
  context.save()
  context.beginPath()
  context.arc(centerX, centerY, radius, 0, Math.PI * 2)
  context.closePath()
  context.clip()

  const size = radius * 2
  context.drawImage(image, centerX - radius, centerY - radius, size, size)
  context.restore()

  context.save()
  context.beginPath()
  context.arc(centerX, centerY, radius, 0, Math.PI * 2)
  context.strokeStyle = "#d0d7de"
  context.lineWidth = 2
  context.stroke()
  context.restore()
}

function drawClinicSeal(
  context: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  radius: number,
) {
  context.save()
  context.beginPath()
  context.arc(centerX, centerY, radius, 0, Math.PI * 2)
  context.fillStyle = "#e6f4f1"
  context.fill()
  context.strokeStyle = "#0d5f47"
  context.lineWidth = 2
  context.stroke()

  context.beginPath()
  context.arc(centerX, centerY, radius - 4, 0, Math.PI * 2)
  context.strokeStyle = "#a7f3d0"
  context.lineWidth = 1
  context.stroke()

  context.strokeStyle = "#0d5f47"
  context.lineWidth = 3.5
  context.lineCap = "round"
  const arm = radius * 0.42
  context.beginPath()
  context.moveTo(centerX, centerY - arm)
  context.lineTo(centerX, centerY + arm)
  context.moveTo(centerX - arm, centerY)
  context.lineTo(centerX + arm, centerY)
  context.stroke()

  context.fillStyle = "#0d5f47"
  context.font = "600 9px system-ui, sans-serif"
  context.textAlign = "center"
  context.fillText("CLÍNICA", centerX, centerY + radius + 13)
  context.restore()
}

function drawInitialsAvatar(
  context: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  radius: number,
  name: string,
) {
  context.save()
  context.beginPath()
  context.arc(centerX, centerY, radius, 0, Math.PI * 2)
  context.fillStyle = "#e6f4f1"
  context.fill()
  context.strokeStyle = "#0d5f47"
  context.lineWidth = 2
  context.stroke()

  const initials = name
    .replace(/^Dr\.\s*|^Dra\.\s*/i, "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || "")
    .join("") || "MD"

  context.fillStyle = "#0d5f47"
  context.font = "700 16px system-ui, sans-serif"
  context.textAlign = "center"
  context.textBaseline = "middle"
  context.fillText(initials, centerX, centerY)
  context.restore()
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
    input.clinic.phone
      ? `Qualquer cobrança adicional feita pela clínica, não aceite. Informe pelo telefone ${input.clinic.phone}.`
      : "Qualquer cobrança adicional feita pela clínica, não aceite.",
    48,
    y + 48,
    698,
    18,
  )
  context.fillStyle = "#8aa0a8"
  context.font = "11px system-ui, sans-serif"
  context.fillText("Guia oficial emitida pelo sistema CuidarSaude. Apresente este documento no atendimento.", 48, warningBottom + 16)
  return warningBottom + 28
}

function optionalRow(label: string, value?: string | null, highlight = false): Array<[string, string, boolean?]> {
  const normalized = value?.trim()
  return normalized ? [[label, normalized, highlight]] : []
}

function joinPresent(...values: Array<string | null | undefined>) {
  return values.filter((value) => value?.trim()).join(" ").trim() || undefined
}

function joinHours(startHour?: string | null, endHour?: string | null) {
  const start = startHour?.trim()
  const end = endHour?.trim()
  if (start && end) return `${start} às ${end}`
  return start || end || undefined
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
  if (typeof context.roundRect === "function") {
    context.roundRect(0, 0, size, size, 12)
  } else {
    context.rect(0, 0, size, size)
  }
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
  if (!city) return { municipio: "", uf: "" }
  const parts = city.split(/\s*[-/·]\s*/)
  if (parts.length >= 2) {
    return { municipio: parts[0]?.trim() || city, uf: parts[1]?.trim() || "" }
  }
  return { municipio: city.trim(), uf: "" }
}

function formatPhone(phone: string) {
  const digits = phone.replace(/\D/g, "")
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`
  }
  return phone
}

export function printAuthorizationGuide(blob: Blob, title = "Guia de Autorização"): Promise<void> {
  return new Promise((resolve) => {
    if (typeof document === "undefined" || typeof URL === "undefined") {
      resolve()
      return
    }

    const imageUrl = URL.createObjectURL(blob)
    const iframe = document.createElement("iframe")
    iframe.style.position = "fixed"
    iframe.style.right = "0"
    iframe.style.bottom = "0"
    iframe.style.width = "0"
    iframe.style.height = "0"
    iframe.style.border = "0"
    iframe.style.display = "none"

    let cleanedUp = false
    const cleanup = () => {
      if (cleanedUp) return
      cleanedUp = true
      URL.revokeObjectURL(imageUrl)
      if (iframe.parentNode) {
        iframe.parentNode.removeChild(iframe)
      }
      resolve()
    }

    iframe.onload = () => {
      try {
        const frameWindow = iframe.contentWindow
        if (!frameWindow) {
          cleanup()
          return
        }
        frameWindow.focus()
        frameWindow.print()
        setTimeout(cleanup, 1000)
      } catch {
        cleanup()
      }
    }

    document.body.appendChild(iframe)

    const frameDoc = iframe.contentDocument || iframe.contentWindow?.document
    if (!frameDoc) {
      cleanup()
      return
    }

    frameDoc.open()
    frameDoc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>${title}</title>
          <style>
            @page {
              size: A4 portrait;
              margin: 8mm;
            }
            body {
              margin: 0;
              padding: 0;
              display: flex;
              justify-content: center;
              align-items: flex-start;
              background: #fff;
            }
            img {
              width: 100%;
              max-width: 100%;
              height: auto;
              display: block;
            }
          </style>
        </head>
        <body>
          <img src="${imageUrl}" alt="${title}" />
        </body>
      </html>
    `)
    frameDoc.close()
  })
}
