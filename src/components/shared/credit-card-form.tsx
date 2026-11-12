"use client"

import { useId } from "react"
import { CreditCard, Lock, ShieldCheck } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export interface CreditCardFormData {
  number: string
  holderName: string
  expiryMonth: string
  expiryYear: string
  ccv: string
  postalCode: string
  addressNumber: string
  addressComplement?: string
}

export interface CreditCardFormErrors {
  number?: string
  holderName?: string
  expiry?: string
  ccv?: string
  postalCode?: string
  addressNumber?: string
}

export function formatCardNumber(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 19)
  return digits.replace(/(\d{4})(?=\d)/g, "$1 ")
}

export function formatCardExpiry(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 4)
  if (digits.length <= 2) return digits
  return `${digits.slice(0, 2)}/${digits.slice(2)}`
}

export function formatCep(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 8)
  if (digits.length <= 5) return digits
  return `${digits.slice(0, 5)}-${digits.slice(5)}`
}

export function validateCreditCardForm(data: CreditCardFormData): CreditCardFormErrors {
  const errors: CreditCardFormErrors = {}
  const rawNumber = data.number.replace(/\D/g, "")
  if (rawNumber.length < 13 || rawNumber.length > 19) {
    errors.number = "Informe um número de cartão válido (13 a 19 dígitos)."
  }
  if (!data.holderName.trim() || data.holderName.trim().length < 3) {
    errors.holderName = "Informe o nome completo impresso no cartão."
  }
  const month = parseInt(data.expiryMonth, 10)
  if (!month || month < 1 || month > 12) {
    errors.expiry = "Mês inválido (01 a 12)."
  } else {
    const rawYear = data.expiryYear.replace(/\D/g, "")
    const fullYear = rawYear.length === 2 ? 2000 + parseInt(rawYear, 10) : parseInt(rawYear, 10)
    const currentYear = new Date().getFullYear()
    const currentMonth = new Date().getMonth() + 1
    if (!fullYear || fullYear < currentYear || (fullYear === currentYear && month < currentMonth)) {
      errors.expiry = "Cartão com validade vencida."
    }
  }
  const rawCcv = data.ccv.replace(/\D/g, "")
  if (rawCcv.length < 3 || rawCcv.length > 4) {
    errors.ccv = "CVV deve ter 3 ou 4 dígitos."
  }
  const rawCep = data.postalCode.replace(/\D/g, "")
  if (rawCep.length !== 8) {
    errors.postalCode = "CEP obrigatório com 8 dígitos."
  }
  if (!data.addressNumber.trim()) {
    errors.addressNumber = "Número obrigatório (ou S/N)."
  }
  return errors
}

export function CreditCardFormFields({
  value,
  onChange,
  errors = {},
  disabled = false,
}: {
  value: CreditCardFormData
  onChange: (updater: (prev: CreditCardFormData) => CreditCardFormData) => void
  errors?: CreditCardFormErrors
  disabled?: boolean
}) {
  const id = useId()
  const expiryDisplay = value.expiryMonth
    ? value.expiryYear
      ? `${value.expiryMonth.padStart(2, "0")}/${value.expiryYear.slice(-2)}`
      : value.expiryMonth
    : ""

  function handleExpiryChange(text: string) {
    const formatted = formatCardExpiry(text)
    const [month = "", year = ""] = formatted.split("/")
    onChange((prev) => ({
      ...prev,
      expiryMonth: month,
      expiryYear: year.length === 2 ? `20${year}` : year,
    }))
  }

  return (
    <div className="space-y-3.5">
      <div className="rounded-xl border bg-muted/30 p-3.5 space-y-3">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <CreditCard className="size-4 text-teal" /> Dados do Cartão
          </span>
          <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
            <Lock className="size-3" /> Criptografia ativa
          </span>
        </div>

        {/* Número do Cartão */}
        <div>
          <Label htmlFor={`${id}-number`} className="text-xs">
            Número do cartão
          </Label>
          <div className="relative mt-1">
            <Input
              id={`${id}-number`}
              name="payment_card_num"
              type="text"
              inputMode="numeric"
              autoComplete="new-password"
              data-lpignore="true"
              data-form-type="other"
              spellCheck={false}
              placeholder="0000 0000 0000 0000"
              disabled={disabled}
              value={formatCardNumber(value.number)}
              onChange={(e) =>
                onChange((prev) => ({
                  ...prev,
                  number: e.target.value.replace(/\D/g, "").slice(0, 19),
                }))
              }
              className={`h-10 pr-9 font-mono text-sm tracking-wider ${
                errors.number ? "border-destructive focus-visible:ring-destructive" : ""
              }`}
            />
            <CreditCard className="pointer-events-none absolute right-3 top-2.5 size-4 text-muted-foreground" />
          </div>
          {errors.number && <p className="mt-1 text-xs text-destructive">{errors.number}</p>}
        </div>

        {/* Nome do Titular */}
        <div>
          <Label htmlFor={`${id}-holder`} className="text-xs">
            Nome impresso no cartão
          </Label>
          <Input
            id={`${id}-holder`}
            name="payment_card_holder"
            type="text"
            autoComplete="new-password"
            data-lpignore="true"
            data-form-type="other"
            spellCheck={false}
            placeholder="NOME COMPLETO"
            disabled={disabled}
            value={value.holderName}
            onChange={(e) =>
              onChange((prev) => ({
                ...prev,
                holderName: e.target.value.toUpperCase(),
              }))
            }
            className={`mt-1 h-10 text-sm uppercase ${
              errors.holderName ? "border-destructive focus-visible:ring-destructive" : ""
            }`}
          />
          {errors.holderName && <p className="mt-1 text-xs text-destructive">{errors.holderName}</p>}
        </div>

        {/* Validade e CVV */}
        <div className="grid grid-cols-2 gap-2.5">
          <div>
            <Label htmlFor={`${id}-expiry`} className="text-xs">
              Validade (MM/AA)
            </Label>
            <Input
              id={`${id}-expiry`}
              name="payment_card_exp"
              type="text"
              inputMode="numeric"
              autoComplete="new-password"
              data-lpignore="true"
              data-form-type="other"
              spellCheck={false}
              placeholder="MM/AA"
              disabled={disabled}
              value={expiryDisplay}
              onChange={(e) => handleExpiryChange(e.target.value)}
              className={`mt-1 h-10 text-center font-mono text-sm ${
                errors.expiry ? "border-destructive focus-visible:ring-destructive" : ""
              }`}
            />
            {errors.expiry && <p className="mt-1 text-xs text-destructive">{errors.expiry}</p>}
          </div>

          <div>
            <Label htmlFor={`${id}-ccv`} className="text-xs">
              Código CVV
            </Label>
            <Input
              id={`${id}-ccv`}
              name="payment_card_cvv"
              type="password"
              inputMode="numeric"
              autoComplete="new-password"
              data-lpignore="true"
              data-form-type="other"
              spellCheck={false}
              placeholder="123"
              maxLength={4}
              disabled={disabled}
              value={value.ccv}
              onChange={(e) =>
                onChange((prev) => ({
                  ...prev,
                  ccv: e.target.value.replace(/\D/g, "").slice(0, 4),
                }))
              }
              className={`mt-1 h-10 text-center font-mono text-sm tracking-widest ${
                errors.ccv ? "border-destructive focus-visible:ring-destructive" : ""
              }`}
            />
            {errors.ccv && <p className="mt-1 text-xs text-destructive">{errors.ccv}</p>}
          </div>
        </div>
      </div>

      {/* Endereço do Titular exigido para anti-fraude */}
      <div className="rounded-xl border bg-muted/20 p-3 space-y-2.5">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Endereço da fatura do cartão
        </p>

        <div className="grid grid-cols-2 gap-2.5">
          <div>
            <Label htmlFor={`${id}-cep`} className="text-xs">
              CEP
            </Label>
            <Input
              id={`${id}-cep`}
              name="payment_card_cep"
              type="text"
              inputMode="numeric"
              autoComplete="new-password"
              data-lpignore="true"
              data-form-type="other"
              spellCheck={false}
              placeholder="00000-000"
              disabled={disabled}
              value={formatCep(value.postalCode)}
              onChange={(e) =>
                onChange((prev) => ({
                  ...prev,
                  postalCode: e.target.value.replace(/\D/g, "").slice(0, 8),
                }))
              }
              className={`mt-1 h-9 text-xs font-mono ${
                errors.postalCode ? "border-destructive focus-visible:ring-destructive" : ""
              }`}
            />
            {errors.postalCode && <p className="mt-1 text-[11px] text-destructive">{errors.postalCode}</p>}
          </div>

          <div>
            <Label htmlFor={`${id}-num`} className="text-xs">
              Número
            </Label>
            <Input
              id={`${id}-num`}
              type="text"
              placeholder="123 ou S/N"
              disabled={disabled}
              value={value.addressNumber}
              onChange={(e) =>
                onChange((prev) => ({
                  ...prev,
                  addressNumber: e.target.value,
                }))
              }
              className={`mt-1 h-9 text-xs ${
                errors.addressNumber ? "border-destructive focus-visible:ring-destructive" : ""
              }`}
            />
            {errors.addressNumber && <p className="mt-1 text-[11px] text-destructive">{errors.addressNumber}</p>}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 rounded-lg bg-teal/5 p-2.5 text-xs text-teal">
        <ShieldCheck className="size-4 shrink-0" />
        <span>Processamento transparente direto no domínio, sem redirecionamentos externos.</span>
      </div>
    </div>
  )
}
