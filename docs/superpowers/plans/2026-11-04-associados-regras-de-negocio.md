# Associados e Regras de Negócio Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement production-ready Associate Business Rules across Clinic Desktop and Patient Mobile: eliminating subscription false positives, enforcing 3-month grace period logic with overdue checkout decisions, multichannel billing (Pix, Boleto, Credit Card) on mobile and desktop, and removing all demo keywords.

**Architecture:** Pure Supabase & Asaas driven subscription and debt lifecycle. The database records `status`, `overdue_months`, `next_due_date`, and `last_paid_at`. The core calculation engine in `src/lib/associate-rules.ts` evaluates status (active, overdue, cancelled) and calculates combined cart quotes. Frontends consume rules from Supabase and generate multichannel charges (Pix QR code, Boleto barcode/slip, Credit Card link) via Asaas.

**Tech Stack:** Next.js 15 (App Router), TypeScript, Tailwind CSS, Supabase (PostgreSQL), Asaas Payment Gateway API, Vitest.

## Global Constraints

- Never use `localStorage` or `useDemoStore.associates` to determine if a patient has an active membership; status must come strictly from Supabase and Asaas.
- Grace period policy: 0 months overdue = `active` (automatic discount); 1-2 months overdue = `overdue` (grace period active, user decides to settle + discount or pay full); 3+ months overdue = `cancelled` (suspended).
- Multichannel payment support: Pix (QR Code + Copia e Cola), Boleto (código de barras + link do boleto), and Cartão de Crédito (Asaas invoice/payment link).
- No occurrences of words "simulado", "demonstrativo", or "demo" in patient-facing or clinic-facing production views.
- All code changes must pass `npx tsc --noEmit` and `npm run test:unit`.

---

### Task 1: Database Migration and TypeScript Types for Associate Grace Period and Overdue Status

**Files:**
- Create: `supabase/migrations/20261104170000_associate_grace_period_and_overdue.sql`
- Modify: `src/lib/types.ts`
- Modify: `src/lib/format.ts`

**Interfaces:**
- Consumes: Existing Supabase schema and `src/lib/types.ts`.
- Produces:
  - `export type AssociateStatus = "active" | "overdue" | "cancelled" | "inactive"`
  - `export type PaymentMethod = "pix" | "card" | "boleto"`
  - `METHOD_LABEL`: includes `boleto: "Boleto"`
  - Updated `Associate` and `AssociateInput` interfaces with `overdueMonths`, `nextDueDate`, `lastPaidAt`.

- [ ] **Step 1: Create Supabase migration for associate grace period and status**

Create file `supabase/migrations/20261104170000_associate_grace_period_and_overdue.sql`:
```sql
-- Atualiza restrição de status para incluir 'overdue' e 'cancelled'
alter table public.associates drop constraint if exists associates_status_check;
alter table public.associates add constraint associates_status_check check (status in ('active', 'inactive', 'overdue', 'cancelled'));

-- Adiciona colunas de controle de atraso e vencimento
alter table public.associates add column if not exists overdue_months integer not null default 0;
alter table public.associates add column if not exists next_due_date date;
alter table public.associates add column if not exists last_paid_at timestamptz;

-- Adiciona coluna de carência padrão na tabela de regras
alter table public.associate_rules add column if not exists grace_months integer not null default 3 check (grace_months >= 1 and grace_months <= 12);
```

- [ ] **Step 2: Update `src/lib/types.ts` with updated types**

In `src/lib/types.ts`:
```typescript
export type AssociateStatus = "active" | "overdue" | "cancelled" | "inactive"

export type PaymentMethod = "pix" | "card" | "boleto"
```
And update `AssociateRules`:
```typescript
export interface AssociateRules {
  fee: number
  consultationDiscountPercent: number
  transportEnabled: boolean
  transportRidesPerMonth: number
  extraBenefits: string[]
  graceMonths?: number
}
```
And update `Associate`:
```typescript
export interface Associate {
  id: string
  name: string
  cpf: string
  phone: string
  email: string
  status: AssociateStatus
  overdueMonths?: number
  nextDueDate?: string | null
  lastPaidAt?: string | null
  createdAt: string
}

export interface AssociateInput {
  name: string
  cpf: string
  phone: string
  email: string
  status: AssociateStatus
  overdueMonths?: number
  nextDueDate?: string | null
}
```

- [ ] **Step 3: Update `src/lib/format.ts` to include Boleto label**

In `src/lib/format.ts`:
```typescript
export const METHOD_LABEL: Record<PaymentMethod, string> = {
  pix: "Pix",
  card: "Cartão",
  boleto: "Boleto",
}
```

- [ ] **Step 4: Verify TypeScript compilation**

Run: `npx tsc --noEmit`
Expected: PASS with 0 errors.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20261104170000_associate_grace_period_and_overdue.sql src/lib/types.ts src/lib/format.ts
git commit -m "feat(associates): add overdue and grace period schema and types"
```

---

### Task 2: Associate Business Rules Engine & Grace Period Evaluation (TDD)

**Files:**
- Test: `tests/unit/associate-rules.test.ts`
- Modify: `src/lib/associate-rules.ts`

**Interfaces:**
- Consumes: `Associate`, `AssociateRules`, `AssociateStatus` from `src/lib/types.ts`.
- Produces:
  - `evaluateAssociateStatus(params: { status?: AssociateStatus; overdueMonths?: number }): { status: AssociateStatus; overdueMonths: number; graceEligible: boolean; canReceiveDiscount: boolean }`
  - `calculateAssociateQuote(params: { listPrice: number; rules: AssociateRules; associate?: Associate | null; settleOverdue?: boolean }): { consultationPrice: number; overdueSettlementFee: number; totalAmount: number; discountApplied: boolean; savings: number }`
  - `findActiveAssociate(associates: Associate[], cpf: string): Associate | null` (returns active or overdue associate eligible for grace period).

- [ ] **Step 1: Write failing unit tests for overdue grace period and quote calculations**

In `tests/unit/associate-rules.test.ts`, add:
```typescript
import { describe, expect, it } from "vitest"
import {
  associateRulesError,
  DEFAULT_ASSOCIATE_RULES,
  evaluateAssociateStatus,
  calculateAssociateQuote,
  findActiveAssociate,
} from "@/lib/associate-rules"
import type { Associate } from "@/lib/types"

describe("associate-rules: avaliação de status e carência", () => {
  it("classifica associado com 0 meses de atraso como ativo", () => {
    const res = evaluateAssociateStatus({ status: "active", overdueMonths: 0 })
    expect(res.status).toBe("active")
    expect(res.graceEligible).toBe(true)
    expect(res.canReceiveDiscount).toBe(true)
  })

  it("classifica associado com 1 ou 2 meses de atraso como overdue (em carência)", () => {
    const res1 = evaluateAssociateStatus({ status: "active", overdueMonths: 1 })
    expect(res1.status).toBe("overdue")
    expect(res1.graceEligible).toBe(true)
    expect(res1.canReceiveDiscount).toBe(false) // Precisa quitar para liberar desconto

    const res2 = evaluateAssociateStatus({ status: "overdue", overdueMonths: 2 })
    expect(res2.status).toBe("overdue")
    expect(res2.graceEligible).toBe(true)
  })

  it("classifica associado com 3 ou mais meses de atraso como cancelado", () => {
    const res = evaluateAssociateStatus({ status: "active", overdueMonths: 3 })
    expect(res.status).toBe("cancelled")
    expect(res.graceEligible).toBe(false)
    expect(res.canReceiveDiscount).toBe(false)
  })
})

describe("associate-rules: cálculo de checkout e opções de inadimplência", () => {
  const rules = { ...DEFAULT_ASSOCIATE_RULES, fee: 35, consultationDiscountPercent: 20 }
  const activeAssociate: Associate = {
    id: "ass-1",
    name: "Maria Silva",
    cpf: "123.456.789-00",
    phone: "11999999999",
    email: "maria@example.com",
    status: "active",
    overdueMonths: 0,
    createdAt: "2026-01-01T00:00:00Z",
  }
  const overdueAssociate: Associate = {
    ...activeAssociate,
    id: "ass-2",
    status: "overdue",
    overdueMonths: 2,
  }

  it("calcula desconto automático para associado ativo", () => {
    const quote = calculateAssociateQuote({ listPrice: 100, rules, associate: activeAssociate })
    expect(quote.consultationPrice).toBe(80)
    expect(quote.overdueSettlementFee).toBe(0)
    expect(quote.totalAmount).toBe(80)
    expect(quote.discountApplied).toBe(true)
    expect(quote.savings).toBe(20)
  })

  it("permite associado em atraso quitar mensalidades pendentes e obter desconto", () => {
    const quote = calculateAssociateQuote({
      listPrice: 100,
      rules,
      associate: overdueAssociate,
      settleOverdue: true,
    })
    // 2 meses de atraso: 2 * 35 = 70. Consulta com 20% desconto = 80. Total = 150.
    expect(quote.consultationPrice).toBe(80)
    expect(quote.overdueSettlementFee).toBe(70)
    expect(quote.totalAmount).toBe(150)
    expect(quote.discountApplied).toBe(true)
    expect(quote.savings).toBe(20)
  })

  it("permite associado em atraso pagar consulta cheia sem quitar mensalidade naquele momento", () => {
    const quote = calculateAssociateQuote({
      listPrice: 100,
      rules,
      associate: overdueAssociate,
      settleOverdue: false,
    })
    expect(quote.consultationPrice).toBe(100)
    expect(quote.overdueSettlementFee).toBe(0)
    expect(quote.totalAmount).toBe(100)
    expect(quote.discountApplied).toBe(false)
    expect(quote.savings).toBe(0)
  })

  it("calcula valor cheio para não associado e indica potencial de economia", () => {
    const quote = calculateAssociateQuote({ listPrice: 100, rules, associate: null })
    expect(quote.consultationPrice).toBe(100)
    expect(quote.overdueSettlementFee).toBe(0)
    expect(quote.totalAmount).toBe(100)
    expect(quote.discountApplied).toBe(false)
    expect(quote.savings).toBe(20) // Mostra quanto economizaria
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:unit -- tests/unit/associate-rules.test.ts`
Expected: FAIL with "evaluateAssociateStatus is not a function"

- [ ] **Step 3: Implement functions in `src/lib/associate-rules.ts`**

In `src/lib/associate-rules.ts`:
```typescript
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
```
Keep `findActiveAssociate` matching `cpfDigits(cpf)` and respecting `status !== "cancelled"`.

- [ ] **Step 4: Run unit tests to verify they pass**

Run: `npm run test:unit -- tests/unit/associate-rules.test.ts`
Expected: PASS (all tests green).

- [ ] **Step 5: Commit**

```bash
git add tests/unit/associate-rules.test.ts src/lib/associate-rules.ts
git commit -m "feat(associates): add grace period evaluation and quote calculation logic"
```

---

### Task 3: Asaas Service Extension for Multichannel Billing (Pix, Boleto, Credit Card)

**Files:**
- Modify: `src/lib/asaas/minimums.ts`
- Modify: `src/lib/asaas/charges.ts`
- Modify: `src/lib/asaas/subscriptions.ts`
- Create: `tests/unit/asaas-multichannel.test.ts`

**Interfaces:**
- Consumes: `AsaasBillingType` from `src/lib/asaas/types.ts`.
- Produces:
  - `createAsaasCharge` supports `billingType: "PIX" | "CREDIT_CARD" | "BOLETO"`.
  - For `BOLETO`: returns `bankSlipUrl` and `identificationField` (barcode linha digitável).
  - `createAsaasSubscription` supports `billingType: "PIX" | "BOLETO" | "CREDIT_CARD"`.
  - `minimumAsaasCharge` returns `5` for Boleto.

- [ ] **Step 1: Write failing test for multichannel billing in Asaas helpers**

Create `tests/unit/asaas-multichannel.test.ts`:
```typescript
import { describe, expect, it } from "vitest"
import { minimumAsaasCharge, minimumAsaasChargeMessage } from "@/lib/asaas/minimums"

describe("asaas multichannel minimums", () => {
  it("valida mínimo de cobrança para Boleto (R$ 5)", () => {
    expect(minimumAsaasCharge("BOLETO")).toBe(5)
    expect(minimumAsaasChargeMessage("BOLETO")).toContain("boleto")
  })

  it("mantém mínimo para PIX (R$ 10) e CREDIT_CARD (R$ 5)", () => {
    expect(minimumAsaasCharge("PIX")).toBe(10)
    expect(minimumAsaasCharge("CREDIT_CARD")).toBe(5)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:unit -- tests/unit/asaas-multichannel.test.ts`
Expected: FAIL (type or behavior mismatch for "BOLETO").

- [ ] **Step 3: Update `src/lib/asaas/minimums.ts` and `charges.ts`**

In `src/lib/asaas/minimums.ts`:
```typescript
export type SupportedAsaasBillingType = "PIX" | "CREDIT_CARD" | "BOLETO"

export const ASAAS_PIX_MINIMUM = 10
export const ASAAS_CARD_MINIMUM = 5
export const ASAAS_BOLETO_MINIMUM = 5

export function minimumAsaasCharge(billingType: SupportedAsaasBillingType) {
  if (billingType === "PIX") return ASAAS_PIX_MINIMUM
  return ASAAS_CARD_MINIMUM
}

export function minimumAsaasChargeMessage(billingType: SupportedAsaasBillingType) {
  if (billingType === "PIX") {
    return "Para gerar Pix na Asaas, cada atendimento precisa ficar em pelo menos R$ 10 após os descontos."
  }
  if (billingType === "BOLETO") {
    return "Para gerar boleto na Asaas, o valor mínimo é de R$ 5."
  }
  return "Para pagar com cartão na Asaas, cada atendimento precisa ficar em pelo menos R$ 5 após os descontos."
}
```

In `src/lib/asaas/charges.ts`:
Update `CreateAsaasChargeInput`:
```typescript
export type CreateAsaasChargeInput = EnsureAsaasCustomerInput & {
  value: number
  billingType: Extract<AsaasBillingType, "PIX" | "CREDIT_CARD" | "BOLETO">
  dueDate?: string
  description?: string
  externalReference?: string
  paymentId?: string
}
```
And in `createAsaasCharge`:
If `billingType === "BOLETO"`, fetch identification field from Asaas `/payments/${payment.id}/identificationField`:
```typescript
let identificationField: string | null = null
if (input.billingType === "BOLETO" && payment.id) {
  try {
    const slipInfo = await asaasFetch<{ identificationField?: string }>(`/payments/${payment.id}/identificationField`)
    identificationField = slipInfo.identificationField || null
  } catch {
    // Continua com bankSlipUrl se a linha digitável falhar
  }
}
```
Return `identificationField` and `bankSlipUrl: payment.bankSlipUrl || payment.invoiceUrl`.

In `src/lib/asaas/subscriptions.ts`:
Allow `billingType?: Extract<AsaasBillingType, "PIX" | "BOLETO" | "CREDIT_CARD">`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:unit -- tests/unit/asaas-multichannel.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/asaas/minimums.ts src/lib/asaas/charges.ts src/lib/asaas/subscriptions.ts tests/unit/asaas-multichannel.test.ts
git commit -m "feat(asaas): add boleto support and multichannel billing types"
```

---

### Task 4: Subscription API Route (`/api/payments/subscription`) Upgrade

**Files:**
- Modify: `src/app/api/payments/subscription/route.ts`
- Create: `tests/unit/subscription-api.test.ts`

**Interfaces:**
- Consumes: `requireCurrentPatient`, `createSupabaseAdmin`, `evaluateAssociateStatus`, `createAsaasCharge`, `createAsaasSubscription`.
- Produces:
  - `GET /api/payments/subscription`:
    Returns:
    ```typescript
    {
      active: boolean
      status: "active" | "overdue" | "cancelled" | "inactive" | "none"
      overdueMonths: number
      pendingAmount: number
      rules: AssociateRules
    }
    ```
  - `POST /api/payments/subscription`:
    Body:
    ```typescript
    {
      billingType: "PIX" | "BOLETO" | "CREDIT_CARD"
      monthsToPay?: number
    }
    ```
    Generates charge or subscription, returns:
    ```typescript
    {
      associateId: string
      value: number
      billingType: "PIX" | "BOLETO" | "CREDIT_CARD"
      paymentUrl?: string
      invoiceUrl?: string
      pix?: { payload: string; encodedImage: string } | null
      bankSlipUrl?: string | null
      bankSlipBarcode?: string | null
    }
    ```

- [ ] **Step 1: Write unit test for subscription status mapping**

Create `tests/unit/subscription-api.test.ts`:
```typescript
import { describe, expect, it } from "vitest"
import { evaluateAssociateStatus } from "@/lib/associate-rules"

describe("subscription api logic", () => {
  it("determina status e valor pendente corretamente", () => {
    const fee = 35
    const evaluation = evaluateAssociateStatus({ status: "overdue", overdueMonths: 2 })
    const pendingAmount = evaluation.overdueMonths * fee
    expect(evaluation.status).toBe("overdue")
    expect(pendingAmount).toBe(70)
  })
})
```

- [ ] **Step 2: Update `src/app/api/payments/subscription/route.ts`**

Update `GET`:
```typescript
export async function GET() {
  try {
    const patient = await requireCurrentPatient()
    const admin = createSupabaseAdmin()
    if (!admin) return NextResponse.json({ error: "Pagamentos ainda não foram configurados." }, { status: 503 })
    const cpf = cpfDigits(patient.cpf)
    const [{ data: associate }, { data: rules }] = await Promise.all([
      admin.from("associates").select("id,status,overdue_months,next_due_date").in("cpf", [cpf, formatCpf(cpf)]).limit(1).maybeSingle(),
      admin.from("associate_rules").select("fee,consultation_discount_percent,transport_enabled,transport_rides_per_month,extra_benefits,grace_months").eq("id", true).maybeSingle(),
    ])

    const normalizedRules: AssociateRules = {
      fee: Number(rules?.fee) || 35,
      consultationDiscountPercent: Number(rules?.consultation_discount_percent) || 20,
      transportEnabled: rules?.transport_enabled !== false,
      transportRidesPerMonth: Number(rules?.transport_rides_per_month) || 4,
      extraBenefits: Array.isArray(rules?.extra_benefits) ? rules.extra_benefits : [],
      graceMonths: Number(rules?.grace_months) || 3,
    }

    if (!associate) {
      return NextResponse.json({
        active: false,
        status: "none",
        overdueMonths: 0,
        pendingAmount: 0,
        rules: normalizedRules,
      })
    }

    const evaluation = evaluateAssociateStatus({
      status: associate.status,
      overdueMonths: associate.overdue_months,
      graceMonths: normalizedRules.graceMonths,
    })

    return NextResponse.json({
      active: evaluation.status === "active",
      status: evaluation.status,
      overdueMonths: evaluation.overdueMonths,
      pendingAmount: evaluation.overdueMonths * normalizedRules.fee,
      rules: normalizedRules,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Não foi possível conferir a associação." },
      { status: error instanceof PaymentAuthorizationError ? 401 : 422 },
    )
  }
}
```

Update `POST`:
Accept `billingType` and optional `monthsToPay`.
If `billingType === "PIX"`, create Asaas charge with PIX and return QR code payload and encodedImage.
If `billingType === "BOLETO"`, create Asaas charge with BOLETO and return bank slip barcode and link.
If `billingType === "CREDIT_CARD"`, create Asaas card payment link.

- [ ] **Step 3: Run unit tests**

Run: `npm run test:unit -- tests/unit/subscription-api.test.ts`
Expected: PASS.

- [ ] **Step 4: Verify TypeScript compilation**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/payments/subscription/route.ts tests/unit/subscription-api.test.ts
git commit -m "feat(api): upgrade subscription endpoint with multichannel billing and status evaluation"
```

---

### Task 5: Cart Checkout API Route (`/api/payments/cart`) with Overdue Settlement

**Files:**
- Modify: `src/app/api/payments/cart/route.ts`
- Create: `tests/unit/cart-associate-checkout.test.ts`

**Interfaces:**
- Consumes: `requireCurrentPatient`, `calculateAssociateQuote`, `createAsaasCharge`.
- Produces:
  - Handles `settleAssociateFee: boolean` in payload.
  - Combines consultation price and overdue settlement fee into a single Asaas charge or returns clear itemized receipt.
  - On charge creation with `settleAssociateFee`, marks associate as `active` (`overdue_months: 0`) in Supabase.

- [ ] **Step 1: Write unit test for cart associate quote calculation**

Create `tests/unit/cart-associate-checkout.test.ts`:
```typescript
import { describe, expect, it } from "vitest"
import { calculateAssociateQuote, DEFAULT_ASSOCIATE_RULES } from "@/lib/associate-rules"

describe("cart checkout associate logic", () => {
  it("combina valor da consulta com desconto e quitação de atraso", () => {
    const quote = calculateAssociateQuote({
      listPrice: 120,
      rules: { ...DEFAULT_ASSOCIATE_RULES, fee: 35, consultationDiscountPercent: 25 },
      associate: {
        id: "ass-1",
        name: "João",
        cpf: "111",
        phone: "11",
        email: "j@j.com",
        status: "overdue",
        overdueMonths: 1,
        createdAt: "2026-01-01",
      },
      settleOverdue: true,
    })
    // 120 * 0.75 = 90. 1 mês atraso = 35. Total = 125.
    expect(quote.consultationPrice).toBe(90)
    expect(quote.overdueSettlementFee).toBe(35)
    expect(quote.totalAmount).toBe(125)
  })
})
```

- [ ] **Step 2: Update `src/app/api/payments/cart/route.ts`**

Update `src/app/api/payments/cart/route.ts` to accept `settleAssociateFee?: boolean` in `CartRequestBody`.
When calculating pricing:
1. Lookup associate in `associates` table by patient's CPF.
2. Apply `calculateAssociateQuote({ listPrice, rules, associate, settleOverdue: body.settleAssociateFee })`.
3. If `settleAssociateFee` is true and payment charge is created, record payment with item metadata `associateSettlement: true` and reset associate `overdue_months: 0, status: 'active'`.

- [ ] **Step 3: Run unit tests**

Run: `npm run test:unit -- tests/unit/cart-associate-checkout.test.ts`
Expected: PASS.

- [ ] **Step 4: Verify TypeScript compilation**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/payments/cart/route.ts tests/unit/cart-associate-checkout.test.ts
git commit -m "feat(payments): support associate overdue fee settlement in cart checkout"
```

---

### Task 6: Desktop Associate Management & Payments (`associates-view.tsx` & `/api/payments/associate`)

**Files:**
- Modify: `src/app/api/payments/associate/route.ts`
- Modify: `src/components/desktop/associates-view.tsx`
- Create: `tests/unit/desktop-associates-api.test.ts`

**Interfaces:**
- Consumes: Supabase `associates` table and Asaas multichannel charge helpers.
- Produces:
  - `GET /api/payments/associate`: returns associates with `overdue_months`, `next_due_date`, `status`.
  - `POST /api/payments/associate`: accepts `{ billingType: "PIX" | "BOLETO" | "CREDIT_CARD", ... }` and generates appropriate Asaas payment (Pix QR Code, Boleto barcode, or Card link).
  - `PATCH /api/payments/associate`: updates associate record (including status and overdue_months).
  - `AssociatesView`:
    - Shows status badges: "Em dia" (green), "1 mês atraso" (amber), "2 meses atraso" (amber), "Cancelado" (red).
    - Multi-option payment modal: Generate Pix, Boleto, or Card link with copy buttons, plus "Registrar pagamento no balcão" (counter payment).

- [ ] **Step 1: Write unit test for desktop associate API serialization**

Create `tests/unit/desktop-associates-api.test.ts`:
```typescript
import { describe, expect, it } from "vitest"
import { evaluateAssociateStatus } from "@/lib/associate-rules"

describe("desktop associates status mapping", () => {
  it("mapeia status de associados com atraso de forma consistente", () => {
    const res = evaluateAssociateStatus({ status: "active", overdueMonths: 2 })
    expect(res.status).toBe("overdue")
  })
})
```

- [ ] **Step 2: Update `src/app/api/payments/associate/route.ts`**

In `src/app/api/payments/associate/route.ts`:
- Include `overdue_months`, `next_due_date`, `last_paid_at` in SELECT query.
- In `POST`, accept `billingType?: "PIX" | "BOLETO" | "CREDIT_CARD"`.
- If `PIX`, call `createAsaasCharge({ billingType: "PIX", value: fee, ... })` and return `pix: { payload, encodedImage }`.
- If `BOLETO`, call `createAsaasCharge({ billingType: "BOLETO", value: fee, ... })` and return `bankSlipUrl, identificationField`.
- If `CREDIT_CARD`, return payment link.
- In `PATCH`, support `overdueMonths` and `status` in payload.

- [ ] **Step 3: Update `src/components/desktop/associates-view.tsx`**

In `src/components/desktop/associates-view.tsx`:
- Render overdue status badges:
  ```tsx
  {associate.status === "active" && <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">Em dia</span>}
  {associate.status === "overdue" && <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">{associate.overdueMonths || 1} mês(es) em atraso</span>}
  {associate.status === "cancelled" && <span className="inline-flex items-center rounded-full bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-700">Cancelado</span>}
  {associate.status === "inactive" && <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">Aguardando</span>}
  ```
- In Payment Dialog, provide selector for `Pix`, `Boleto`, `Cartão`, and a button for `Registrar recebimento no balcão` (which calls PATCH to reset overdue and mark active).

- [ ] **Step 4: Verify compilation and tests**

Run: `npx tsc --noEmit`
Run: `npm run test:unit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/payments/associate/route.ts src/components/desktop/associates-view.tsx tests/unit/desktop-associates-api.test.ts
git commit -m "feat(desktop): multichannel associate payment and overdue badges"
```

---

### Task 7: Mobile Checkout & Conversion UX (`payment-view.tsx` & `associate-subscription.tsx`)

**Files:**
- Modify: `src/components/mobile/payment-view.tsx`
- Modify: `src/components/mobile/associate-subscription.tsx`
- Create: `tests/unit/mobile-payment-associate.test.ts`

**Interfaces:**
- Consumes: `/api/payments/subscription` GET and POST, `calculateAssociateQuote`.
- Produces:
  - Eliminates `useDemoStore.associates` fallback (fixes "Assinatura ativa" false positive).
  - If user selects "Não sou associado": renders attractive savings card with calculated savings ("Economize R$ X tornando-se associado") and CTA button "Quero ser associado agora" triggering the subscription modal.
  - If user selects "Sim, sou associado":
    - If status is `overdue`: shows the two options:
      1. "Quitar pendência de R$ X e aplicar desconto nesta consulta" (Selected by default)
      2. "Pagar consulta valor normal (R$ Y) sem quitar agora"
    - If status is `cancelled` or `none`: alerts patient and offers to associate.
  - Subscription Modal in mobile supports Pix (with QR Code and Copia e Cola), Boleto (barcode and link), and Cartão.

- [ ] **Step 1: Write unit test for mobile payment associate decision logic**

Create `tests/unit/mobile-payment-associate.test.ts`:
```typescript
import { describe, expect, it } from "vitest"
import { calculateAssociateQuote, DEFAULT_ASSOCIATE_RULES } from "@/lib/associate-rules"

describe("mobile payment associate decisions", () => {
  const rules = { ...DEFAULT_ASSOCIATE_RULES, fee: 35, consultationDiscountPercent: 20 }

  it("calcula economia correta para o card 'Não sou associado'", () => {
    const listPrice = 150
    const quote = calculateAssociateQuote({ listPrice, rules, associate: null })
    expect(quote.potentialSavings).toBe(30) // 20% de 150 = 30
  })

  it("calcula opções para associado em carência", () => {
    const associate = {
      id: "a1", name: "Ana", cpf: "123", phone: "1", email: "a@a.com",
      status: "overdue" as const, overdueMonths: 1, createdAt: "2026-01-01"
    }
    const settleQuote = calculateAssociateQuote({ listPrice: 150, rules, associate, settleOverdue: true })
    expect(settleQuote.totalAmount).toBe(120 + 35) // 155

    const normalQuote = calculateAssociateQuote({ listPrice: 150, rules, associate, settleOverdue: false })
    expect(normalQuote.totalAmount).toBe(150)
  })
})
```

- [ ] **Step 2: Update `src/components/mobile/associate-subscription.tsx`**

- Remove line 147 fallback:
  ```typescript
  // ANTES (Causa do falso positivo):
  // const active = membership?.active ?? associate?.status === "active"
  
  // DEPOIS (100% derivado da API do servidor):
  const active = Boolean(membership?.active)
  const status = membership?.status || (membership ? "none" : "loading")
  ```
- Add Pix, Boleto, and Cartão tabs in `AssociatePayForm`.
- Allow generating Pix QR code and copy-paste key directly inside the modal.

- [ ] **Step 3: Update `src/components/mobile/payment-view.tsx`**

- When fetching membership on mount:
  ```typescript
  useEffect(() => {
    fetch("/api/payments/subscription")
      .then((res) => res.json())
      .then((data) => {
        if (data && !data.error) setMembership(data)
      })
      .catch(() => {})
  }, [])
  ```
- In "Você é associado?":
  - "Não sou associado": Show CTA:
    ```tsx
    <div className="rounded-2xl border border-teal/20 bg-teal/5 p-4 mt-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-semibold text-teal text-sm">Economize {formatMoney(potentialSavings)} nesta consulta!</p>
          <p className="text-xs text-muted-foreground mt-0.5">Associe-se por apenas {formatMoney(rules.fee)}/mês e ganhe descontos em todas as consultas e exames.</p>
        </div>
        <Button size="sm" type="button" onClick={() => setShowSubscribeModal(true)}>Quero me associar</Button>
      </div>
    </div>
    ```
  - "Sim, sou associado":
    - If `membership.status === "overdue"`:
      Show radio choice between:
      (A) Quitar R$ {pendingAmount} pendente + Consulta com desconto ({formatMoney(discountedPrice)})
      (B) Fazer consulta com valor normal ({formatMoney(service.price)}) sem quitar agora
    - If `membership.status === "none"` or `cancelled`:
      Show message: "Não encontramos uma assinatura ativa para o seu CPF. Deseja se associar agora?" with button "Associar agora".

- [ ] **Step 4: Run unit tests**

Run: `npm run test:unit -- tests/unit/mobile-payment-associate.test.ts`
Expected: PASS.

- [ ] **Step 5: Verify TypeScript compilation**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/mobile/associate-subscription.tsx src/components/mobile/payment-view.tsx tests/unit/mobile-payment-associate.test.ts
git commit -m "feat(mobile): dynamic associate conversion, grace period decision flow and false positive removal"
```

---

### Task 8: Production Polish: Clean Up "Simulado" / "Demonstrativo" / "Demo" Terms

**Files:**
- Modify: `src/components/mobile/profile-view.tsx`
- Modify: `src/components/mobile/professional-view.tsx`
- Modify: `src/components/desktop/finance-view.tsx`
- Modify: `src/components/desktop/consultations-view.tsx`

**Interfaces:**
- Consumes: UI components in desktop and mobile.
- Produces: Clean, production-grade Portuguese terminology without "simulado", "demonstrativo", or "demo".

- [ ] **Step 1: Search for occurrences of "simulado", "demonstrativo", "demo" in targeted files**

Review:
- `src/components/mobile/profile-view.tsx`
- `src/components/mobile/professional-view.tsx`
- `src/components/desktop/finance-view.tsx`
- `src/components/desktop/consultations-view.tsx`

- [ ] **Step 2: Replace demonstrative terms with production copy**

- Replace "Avaliação demonstrativa" with "Avaliação de paciente".
- Replace "Pagamento simulado" with "Pagamento registrado".
- Replace "Valores demonstrativos" with "Valores em tempo real".
- Remove badges indicating simulation or testing.

- [ ] **Step 3: Run TypeScript compiler and unit tests**

Run: `npx tsc --noEmit`
Run: `npm run test:unit`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/mobile/profile-view.tsx src/components/mobile/professional-view.tsx src/components/desktop/finance-view.tsx src/components/desktop/consultations-view.tsx
git commit -m "chore: remove demo and simulation labels for production readiness"
```

---

### Task 9: End-to-End Verification and Regression Suite

**Files:**
- Test: All tests in `tests/unit/`

- [ ] **Step 1: Run all unit tests**

Run: `npm run test:unit`
Expected: All test suites PASS.

- [ ] **Step 2: Run full TypeScript check**

Run: `npx tsc --noEmit`
Expected: PASS with 0 errors.

- [ ] **Step 3: Run Next.js production build check**

Run: `npm run build`
Expected: Next.js build succeeds with static and dynamic routes compiled.

- [ ] **Step 4: Final commit and status confirmation**

```bash
git status
```
Expected: Clean working tree.
