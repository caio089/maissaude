import type { AssociateInput, PatientInput, ProfessionalInput } from "@/lib/types"

export type FieldErrors<K extends string> = Partial<Record<K, string>>

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE_PATTERN = /^\(\d{2}\) \d{5}-\d{4}$/
const CPF_PATTERN = /^\d{3}\.\d{3}\.\d{3}-\d{2}$/

export function validatePatientInput(input: PatientInput) {
  const errors: FieldErrors<keyof PatientInput> = {}
  if (input.name.trim().length < 3) errors.name = "Informe um nome com ao menos 3 letras."
  if (!CPF_PATTERN.test(input.cpf.trim())) {
    errors.cpf = "Use o formato 000.000.000-00."
  }
  if (!PHONE_PATTERN.test(input.phone.trim())) {
    errors.phone = "Use o formato (00) 00000-0000."
  }
  if (!EMAIL_PATTERN.test(input.email.trim())) {
    errors.email = "Informe um e-mail válido."
  }
  if (!input.birthDate) errors.birthDate = "Informe uma data de nascimento."
  if (!input.city.trim()) errors.city = "Informe a cidade."
  return errors
}

export function validateAssociateInput(input: AssociateInput) {
  const errors: FieldErrors<keyof AssociateInput> = {}
  if (input.name.trim().length < 3) errors.name = "Informe um nome com ao menos 3 letras."
  if (!CPF_PATTERN.test(input.cpf.trim())) {
    errors.cpf = "Use o formato 000.000.000-00."
  }
  if (!PHONE_PATTERN.test(input.phone.trim())) {
    errors.phone = "Use o formato (00) 00000-0000."
  }
  if (!EMAIL_PATTERN.test(input.email.trim())) {
    errors.email = "Informe um e-mail válido."
  }
  return errors
}

export function hasErrors(errors: FieldErrors<string>) {
  return Object.keys(errors).length > 0
}

export function validateProfessionalInput(input: ProfessionalInput) {
  const errors: FieldErrors<keyof ProfessionalInput | "workDays"> = {}
  if (input.name.trim().length < 3) errors.name = "Informe o nome do profissional."
  if (input.credentialCode.trim().length < 3) {
    errors.credentialCode = "Informe o registro profissional."
  }
  if (!Number.isFinite(input.price) || input.price < 50 || input.price > 2000) {
    errors.price = "Informe um valor entre R$ 50 e R$ 2.000."
  }
  if (input.workDays.length === 0) errors.workDays = "Selecione ao menos um dia de atendimento."
  if (input.bio.trim().length < 12) errors.bio = "Escreva uma descrição curta do profissional."
  return errors
}

export function digitsOnly(value: string) {
  return value.replace(/\D/g, "")
}
