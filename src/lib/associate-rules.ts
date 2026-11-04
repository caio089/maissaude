import {
  ASSOCIATE_FEE,
  type Associate,
  type AssociateBenefitSnapshot,
  type AssociateRules,
  type AssociateStatus,
} from "@/lib/types"
import { cpfDigits } from "@/lib/cpf"
import { ASAAS_CARD_MINIMUM } from "@/lib/asaas/minimums"

export const MIN_ASSOCIATE_FEE = ASAAS_CARD_MINIMUM
export const DEFAULT_GRACE_MONTHS = 3

export const DEFAULT_ASSOCIATE_RULES: AssociateRules = {
  fee: ASSOCIATE_FEE,
  consultationDiscountPercent: 20,
  transportEnabled: true,
  transportRidesPerMonth: 4,
  extraBenefits: [
    "Prioridade de encaixe na agenda",
    "Desconto em exames agendados pelo aplicativo",
  ],
  graceMonths: DEFAULT_GRACE_MONTHS,
}

export function normalizeAssociateRules(value: Partial<AssociateRules> | null | undefined): AssociateRules {
  return {
    fee: clamp(value?.fee, MIN_ASSOCIATE_FEE, 500, DEFAULT_ASSOCIATE_RULES.fee),
    consultationDiscountPercent: clamp(value?.consultationDiscountPercent, 0, 80, DEFAULT_ASSOCIATE_RULES.consultationDiscountPercent),
    transportEnabled: value?.transportEnabled ?? DEFAULT_ASSOCIATE_RULES.transportEnabled,
    transportRidesPerMonth: clamp(value?.transportRidesPerMonth, 0, 31, DEFAULT_ASSOCIATE_RULES.transportRidesPerMonth),
    extraBenefits: Array.isArray(value?.extraBenefits)
      ? value.extraBenefits.map((item) => item.trim()).filter(Boolean).slice(0, 6)
      : DEFAULT_ASSOCIATE_RULES.extraBenefits,
    graceMonths: clamp(value?.graceMonths, 1, 12, DEFAULT_ASSOCIATE_RULES.graceMonths ?? DEFAULT_GRACE_MONTHS),
  }
}

export function associateRulesError(rules: AssociateRules) {
  if (!Number.isFinite(rules.fee) || rules.fee < MIN_ASSOCIATE_FEE || rules.fee > 500) {
    return "A mensalidade fica entre R$ 5 e R$ 500."
  }
  if (!Number.isInteger(rules.consultationDiscountPercent) || rules.consultationDiscountPercent < 0 || rules.consultationDiscountPercent > 80) {
    return "O desconto da consulta fica entre 0% e 80%."
  }
  if (!Number.isInteger(rules.transportRidesPerMonth) || rules.transportRidesPerMonth < 0 || rules.transportRidesPerMonth > 31) {
    return "As passagens ficam entre 0 e 31 por mês."
  }
  if (rules.extraBenefits.length > 6) return "Cadastre no máximo 6 benefícios extras."
  if (rules.graceMonths !== undefined && (!Number.isInteger(rules.graceMonths) || rules.graceMonths < 1 || rules.graceMonths > 12)) {
    return "O período de tolerância deve ser entre 1 e 12 meses."
  }
  return null
}

export function evaluateAssociateStatus(params: {
  status?: AssociateStatus | string
  overdueMonths?: number
  graceMonths?: number
}): {
  status: AssociateStatus
  overdueMonths: number
  graceEligible: boolean
  canReceiveDiscount: boolean
} {
  const overdueMonths = Math.max(0, Number(params.overdueMonths) || 0)
  const graceLimit = params.graceMonths || DEFAULT_GRACE_MONTHS

  if (params.status === "cancelled" || overdueMonths >= graceLimit) {
    return {
      status: "cancelled",
      overdueMonths,
      graceEligible: false,
      canReceiveDiscount: false,
    }
  }

  if (overdueMonths > 0) {
    return {
      status: "overdue",
      overdueMonths,
      graceEligible: true,
      canReceiveDiscount: false,
    }
  }

  if (params.status === "inactive") {
    return {
      status: "inactive",
      overdueMonths: 0,
      graceEligible: false,
      canReceiveDiscount: false,
    }
  }

  return {
    status: "active",
    overdueMonths: 0,
    graceEligible: true,
    canReceiveDiscount: true,
  }
}

export function calculateAssociateQuote(params: {
  listPrice: number
  rules: AssociateRules
  associate?: Associate | null
  settleOverdue?: boolean
}): {
  consultationPrice: number
  overdueSettlementFee: number
  totalAmount: number
  discountApplied: boolean
  savings: number
  potentialSavings: number
} {
  const safeRules = normalizeAssociateRules(params.rules)
  const discountPercent = safeRules.consultationDiscountPercent
  const discountedPrice = Math.round(params.listPrice * (100 - discountPercent)) / 100
  const potentialSavings = Math.round((params.listPrice - discountedPrice) * 100) / 100

  if (!params.associate) {
    return {
      consultationPrice: params.listPrice,
      overdueSettlementFee: 0,
      totalAmount: params.listPrice,
      discountApplied: false,
      savings: potentialSavings,
      potentialSavings,
    }
  }

  const evaluation = evaluateAssociateStatus({
    status: params.associate.status,
    overdueMonths: params.associate.overdueMonths,
    graceMonths: safeRules.graceMonths,
  })

  // Ativo em dia
  if (evaluation.status === "active") {
    return {
      consultationPrice: discountedPrice,
      overdueSettlementFee: 0,
      totalAmount: discountedPrice,
      discountApplied: true,
      savings: potentialSavings,
      potentialSavings,
    }
  }

  // Em atraso (overdue)
  if (evaluation.status === "overdue") {
    const overdueFee = evaluation.overdueMonths * safeRules.fee
    if (params.settleOverdue) {
      return {
        consultationPrice: discountedPrice,
        overdueSettlementFee: overdueFee,
        totalAmount: discountedPrice + overdueFee,
        discountApplied: true,
        savings: potentialSavings,
        potentialSavings,
      }
    }
    // Não quer quitar agora: paga consulta cheia sem dívida adicional no momento
    return {
      consultationPrice: params.listPrice,
      overdueSettlementFee: 0,
      totalAmount: params.listPrice,
      discountApplied: false,
      savings: 0,
      potentialSavings,
    }
  }

  // Cancelado ou inativo
  return {
    consultationPrice: params.listPrice,
    overdueSettlementFee: 0,
    totalAmount: params.listPrice,
    discountApplied: false,
    savings: potentialSavings,
    potentialSavings,
  }
}

export function findActiveAssociate(associates: Associate[], cpf: string) {
  const normalized = cpfDigits(cpf)
  return (
    associates.find((associate) => {
      if (cpfDigits(associate.cpf) !== normalized) return false
      const evaluated = evaluateAssociateStatus({
        status: associate.status,
        overdueMonths: associate.overdueMonths,
      })
      return evaluated.graceEligible
    }) ?? null
  )
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
