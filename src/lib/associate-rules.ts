import {
  ASSOCIATE_FEE,
  type Associate,
  type AssociateBenefitSnapshot,
  type AssociateRules,
} from "@/lib/types"
import { cpfDigits } from "@/lib/cpf"

export const DEFAULT_ASSOCIATE_RULES: AssociateRules = {
  fee: ASSOCIATE_FEE,
  consultationDiscountPercent: 20,
  transportEnabled: true,
  transportRidesPerMonth: 4,
  extraBenefits: [
    "Prioridade de encaixe na agenda",
    "Desconto em exames agendados pelo aplicativo",
  ],
}

export function normalizeAssociateRules(value: Partial<AssociateRules> | null | undefined): AssociateRules {
  return {
    fee: clamp(value?.fee, 0, 500, DEFAULT_ASSOCIATE_RULES.fee),
    consultationDiscountPercent: clamp(value?.consultationDiscountPercent, 0, 80, DEFAULT_ASSOCIATE_RULES.consultationDiscountPercent),
    transportEnabled: value?.transportEnabled ?? DEFAULT_ASSOCIATE_RULES.transportEnabled,
    transportRidesPerMonth: clamp(value?.transportRidesPerMonth, 0, 31, DEFAULT_ASSOCIATE_RULES.transportRidesPerMonth),
    extraBenefits: Array.isArray(value?.extraBenefits)
      ? value.extraBenefits.map((item) => item.trim()).filter(Boolean).slice(0, 6)
      : DEFAULT_ASSOCIATE_RULES.extraBenefits,
  }
}

export function associateRulesError(rules: AssociateRules) {
  if (!Number.isFinite(rules.fee) || rules.fee < 0 || rules.fee > 500) {
    return "A mensalidade fica entre R$ 0 e R$ 500."
  }
  if (!Number.isInteger(rules.consultationDiscountPercent) || rules.consultationDiscountPercent < 0 || rules.consultationDiscountPercent > 80) {
    return "O desconto da consulta fica entre 0% e 80%."
  }
  if (!Number.isInteger(rules.transportRidesPerMonth) || rules.transportRidesPerMonth < 0 || rules.transportRidesPerMonth > 31) {
    return "As passagens ficam entre 0 e 31 por mês."
  }
  if (rules.extraBenefits.length > 6) return "Cadastre no máximo 6 benefícios extras."
  return null
}

export function findActiveAssociate(associates: Associate[], cpf: string) {
  const normalized = cpfDigits(cpf)
  return associates.find((associate) => associate.status === "active" && cpfDigits(associate.cpf) === normalized) ?? null
}

export function associateQuote(listPrice: number, rules: AssociateRules, associate: Associate | null) {
  if (!associate) return { amount: listPrice, benefit: null as AssociateBenefitSnapshot | null }
  const safeRules = normalizeAssociateRules(rules)
  const discountPercent = safeRules.consultationDiscountPercent
  const amount = Math.round(listPrice * (100 - discountPercent)) / 100
  return {
    amount,
    benefit: {
      name: associate.name,
      discountPercent,
      listPrice,
      amount,
      transportRides: safeRules.transportEnabled ? safeRules.transportRidesPerMonth : 0,
      extras: safeRules.extraBenefits,
    },
  }
}

function clamp(value: number | undefined, min: number, max: number, fallback: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback
  return Math.min(max, Math.max(min, value))
}
