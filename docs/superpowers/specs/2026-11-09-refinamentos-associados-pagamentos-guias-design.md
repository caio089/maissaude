# Especificação de Design: Frente 5 — Associados, Pagamentos e Guias

## 1. Objetivo

Refinar os fluxos de associados, pagamentos e guias de autorização para que:

- o gerenciamento de associados use um único modal com etapas claras;
- Pix, cartão e boleto estejam disponíveis em todos os fluxos de pagamento;
- o pagamento do paciente tenha etapas simples e responsivas;
- as Guias deixem de exibir dados fictícios e passem a usar somente dados reais;
- o aplicativo do paciente tenha uma área de Guias com abas no mobile.

---

## 2. Escopo

### 2.1. Associados

Em `src/components/desktop/associates-view.tsx`, substituir os dois diálogos atuais por um único modal em três etapas:

1. **Dados**: cadastro ou edição do associado e seleção de paciente existente.
2. **Cobrança**: escolha entre Pix, Boleto e Cartão para novos associados.
3. **Pagamento**: resumo da cobrança, QR Code/linha digitável/link conforme o método e registro de recebimento no balcão.

O fluxo de edição de dados permanece disponível na mesma modal, sem duplicação de formulários.

### 2.2. Pagamentos

Adicionar `BOLETO` às rotas:

- `src/app/api/payments/cart/route.ts`
- `src/app/api/payments/appointment/route.ts`
- `src/app/api/desktop/consultations/route.ts`

Também atualizar os componentes de pagamento desktop/mobile para:

- exibir Pix, Cartão e Boleto como opções claras;
- retornar `bankSlipUrl`, linha digitável/código de barras e aviso de compensação;
- indicar que o boleto pode levar até três dias úteis para compensar;
- manter consultas pendentes até a compensação do boleto.

O backend Asaas já suporta `BOLETO`; a migração do banco será necessária para permitir `method = 'boleto'`.

### 2.3. Guias

Remover os fallbacks fictícios de:

- `src/app/api/desktop/guides/route.ts`
- `src/components/desktop/guide-export-dialog.tsx`
- `src/lib/authorization-guide.ts`

Os campos opcionais passam a ser anuláveis e o canvas omite linhas sem dado real. Quando não houver dado suficiente para exportar, o diálogo informa que a guia precisa ser reemitida.

### 2.4. Guias no aplicativo mobile

Adicionar ao app do paciente:

- aba **Guias** na navegação inferior;
- rota `src/app/mobile/guias/page.tsx`;
- API paciente-scopada `src/app/api/mobile/guides/route.ts`;
- filtro de status em abas (Todas, Válidas e Pendentes);
- geração/download da guia a partir dos dados reais retornados pela API.

---

## 3. Restrições

- Todos os textos visíveis permanecem em português.
- Não expor dados de pacientes para usuários anônimos.
- Não inventar telefone, endereço, registro profissional, horário, data de nascimento ou procedimento.
- Boleto permanece pendente até a compensação; o sistema não deve confirmar a consulta antecipadamente.
- Alterações de banco ficam em migrações SQL versionadas.
- `npx tsc --noEmit`, `npm run lint`, `npm run test:unit` e `npm run build` devem passar.

