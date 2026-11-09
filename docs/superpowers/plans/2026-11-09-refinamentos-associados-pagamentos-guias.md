# Refinamentos de Associados, Pagamentos e Guias

> **For agentic workers:** Execute this plan task-by-task. Use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consolidar o modal de associados, habilitar boleto em todos os fluxos, simplificar o checkout mobile/desktop e remover dados fictícios das Guias, além de adicionar Guias no aplicativo do paciente.

**Architecture:** A interface de associados passa a usar um único modal em etapas. As APIs de pagamento aceitam `PIX`, `CREDIT_CARD` e `BOLETO`, retornando os dados de boleto da Asaas. As Guias constroem `AuthorizationGuideInput` somente com dados reais e opções anuláveis. Uma nova API mobile recupera apenas as guias do paciente autenticado.

**Tech Stack:** Next.js 16, TypeScript, Supabase, Asaas, Vitest.

## Global Constraints

- Não introduzir dados fictícios ou simulações nos fluxos principais.
- Manter autorização paciente-scopada nas APIs mobile.
- Não confirmar consultas pagas com boleto antes da compensação.
- Não alterar `.kpaflow/`.

---

### Task 1: Boleto no banco e nas APIs

**Files:**
- Create: `supabase/migrations/20261109120000_allow_boleto_payment_method.sql`
- Modify: `src/app/api/payments/cart/route.ts`
- Modify: `src/app/api/payments/appointment/route.ts`
- Modify: `src/app/api/desktop/consultations/route.ts`

- [x] Criar migração para trocar a constraint de `payments.method` por `('pix','card','boleto')`.
- [x] Aceitar `BOLETO` nas três APIs e persistir `method = 'boleto'`.
- [x] Retornar `bankSlipUrl` e `identificationField` quando disponíveis.

### Task 2: Fluxos de pagamento e abas mobile

**Files:**
- Modify: `src/components/mobile/payment-view.tsx`
- Modify: `src/components/mobile/journey-view.tsx`
- Modify: `src/components/desktop/consultations-view.tsx`
- Modify: `src/components/mobile/appointments-view.tsx`
- Modify: `src/components/desktop/finance-view.tsx`

- [x] Unificar o seletor de método mobile e adicionar Boleto.
- [x] Exibir QR Code, link e linha digitável conforme o método.
- [x] Adicionar aviso de compensação de boleto.
- [x] Atualizar rótulos de método em listas desktop/mobile.

### Task 3: Modal único de associados

**Files:**
- Modify: `src/components/desktop/associates-view.tsx`

- [x] Criar etapas Dados, Cobrança e Pagamento no mesmo modal.
- [x] Reutilizar a geração de cobrança existente.
- [x] Manter edição e recebimento no balcão sem abrir um segundo diálogo.

### Task 4: Guias sem dados fictícios

**Files:**
- Modify: `src/app/api/desktop/guides/route.ts`
- Modify: `src/components/desktop/guide-export-dialog.tsx`
- Modify: `src/lib/authorization-guide.ts`
- Modify: `tests/unit/guides-api-extended.test.ts`

- [x] Remover `DEFAULT_CLINIC` e todos os valores de exemplo.
- [x] Tornar campos opcionais e omitir linhas sem dado real no canvas.
- [x] Bloquear exportação quando os dados reais não estiverem disponíveis.
- [x] Atualizar testes para verificar ausência de fallbacks fictícios.

### Task 5: Guias no aplicativo mobile

**Files:**
- Create: `src/app/api/mobile/guides/route.ts`
- Create: `src/app/mobile/guias/page.tsx`
- Modify: `src/components/mobile/shell.tsx`

- [x] Criar endpoint autenticado por paciente.
- [x] Criar página de Guias com filtro Todas/Válidas/Pendentes.
- [x] Adicionar aba Guias à navegação inferior mobile.

### Task 6: Validação e entrega

- [x] Executar `npx tsc --noEmit`.
- [ ] Executar `npm run lint`.
- [x] Executar `npm run test:unit`.
- [x] Executar `npm run build`.
- [ ] Commitar apenas os arquivos da frente e fazer push para o branch `codex/refinamentos-associados-pagamentos-guias`.

