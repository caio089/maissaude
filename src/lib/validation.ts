import type { AssociateInput, PatientInput, ProfessionalInput } from "@/lib/types"

export type FieldErrors<K extends string> = Partial<Record<K, string>>

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE_PATTERN = /^\(\d{2}\) \d{5}-\d{4}$/
const CPF_PATTERN = /^900\.\d{3}\.\d{3}-\d{2}$/
const DEMO_CARD = "0000000000000000"

export function validatePatientInput(input: PatientInput) {
  const errors: FieldErrors<keyof PatientInput> = {}
  if (input.name.trim().length < 3) errors.name = "Informe um nome fictício com ao menos 3 letras."
  if (!CPF_PATTERN.test(input.cpf.trim())) {
    errors.cpf = "Use um CPF fictício começando com 900, no formato 900.000.000-00."
  }
  if (!PHONE_PATTERN.test(input.phone.trim())) {
    errors.phone = "Use um telefone fictício no formato (86) 99000-0000."
  }
  if (!EMAIL_PATTERN.test(input.email.trim()) || !input.email.toLowerCase().includes("demo")) {
    errors.email = "Use um e-mail de demonstração, por exemplo nome@demonstracao.demo."
  }
  if (!input.birthDate) errors.birthDate = "Informe uma data de nascimento fictícia."
  if (!input.city.trim()) errors.city = "Informe a cidade da demonstração."
  return errors
}

export function validateAssociateInput(input: AssociateInput) {
  const errors: FieldErrors<keyof AssociateInput> = {}
  if (input.name.trim().length < 3) errors.name = "Informe um nome fictício com ao menos 3 letras."
  if (!CPF_PATTERN.test(input.cpf.trim())) {
    errors.cpf = "Use um CPF fictício começando com 900, no formato 900.000.000-00."
  }
  if (!PHONE_PATTERN.test(input.phone.trim())) {
    errors.phone = "Use um telefone fictício no formato (86) 99000-0000."
  }
  if (!EMAIL_PATTERN.test(input.email.trim()) || !input.email.toLowerCase().includes("demo")) {
    errors.email = "Use um e-mail de demonstração, por exemplo nome@demonstracao.demo."
  }
  return errors
}

export function hasErrors(errors: FieldErrors<string>) {
  return Object.keys(errors).length > 0
}

export function validateProfessionalInput(input: ProfessionalInput) {
  const errors: FieldErrors<keyof ProfessionalInput | "workDays"> = {}
  if (input.name.trim().length < 3) errors.name = "Informe o nome do profissional fictício."
  if (!input.credentialCode.trim().toUpperCase().startsWith("DEMO-")) {
    errors.credentialCode = "O registro precisa ser fictício e começar com DEMO-."
  }
  if (!Number.isFinite(input.price) || input.price < 50 || input.price > 2000) {
    errors.price = "Informe um valor de demonstração entre R$ 50 e R$ 2.000."
  }
  if (input.workDays.length === 0) errors.workDays = "Selecione ao menos um dia de atendimento."
  if (input.bio.trim().length < 12) errors.bio = "Escreva uma descrição curta e claramente fictícia."
  return errors
}

export function digitsOnly(value: string) {
  return value.replace(/\D/g, "")
}

export function validateDemoCard(input: { number: string; name: string; expiry: string; cvv: string }) {
  const errors: FieldErrors<"number" | "name" | "expiry" | "cvv"> = {}
  if (digitsOnly(input.number) !== DEMO_CARD) {
    errors.number = "Use apenas o cartão fictício 0000 0000 0000 0000. Nenhum número real é aceito."
  }
  if (input.name.trim().length < 3) errors.name = "Informe um nome fictício impresso no cartão."
  if (input.expiry.trim() !== "12/30") errors.expiry = "Na demonstração, use a validade 12/30."
  if (input.cvv.trim() !== "000") errors.cvv = "Na demonstração, use o CVV 000."
  return errors
}

export const DEMO_CARD_HINT = "0000 0000 0000 0000"
