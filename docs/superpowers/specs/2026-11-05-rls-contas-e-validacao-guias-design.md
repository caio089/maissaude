# Especificação de Design: Frente 4 — RLS de Contas e Validação/Emissão de Guias de Autorização

## 1. Visão Geral
Esta frente aprimora a segurança de acesso a dados (RLS) para pacientes no Supabase, resolve atritos no fluxo de criação de conta no aplicativo quando o paciente já possui pré-cadastro na clínica, e refina a geração visual, validação e impressão das Guias de Autorização de Consultas, Exames e Procedimentos.

---

## 2. Segurança e Políticas RLS (Supabase)

### 2.1. Problema Atual
Atualmente, as permissões para tabelas críticas (`public.patients`, `public.mobile_accounts`, `public.profiles`) foram revogadas para `anon` e `authenticated`. Todas as operações administrativas e de sessão do servidor ocorrem via service role (`createSupabaseAdmin`). No entanto:
1. Um paciente autenticado no app mobile ou portal não consegue consultar ou atualizar seu próprio cadastro diretamente pelo cliente Supabase.
2. A política `profiles_select_own` existe para `profiles`, mas `patients` não possui política permitindo leitura de seus próprios dados.

### 2.2. Solução RLS
Criar migração `supabase/migrations/20261105110000_patient_rls_and_guide_photos.sql`:
```sql
-- Garante permissões controladas para usuários autenticados
grant select, update on table public.patients to authenticated;

-- Permite ao paciente autenticado ler apenas seu próprio registro
create policy "patients_select_own"
  on public.patients
  for select
  to authenticated
  using (
    id = (
      select patient_id
      from public.profiles
      where id = (select auth.uid())
    )
  );

-- Permite ao paciente autenticado atualizar apenas seu próprio registro (dados de contato e endereço)
create policy "patients_update_own"
  on public.patients
  for update
  to authenticated
  using (
    id = (
      select patient_id
      from public.profiles
      where id = (select auth.uid())
    )
  );
```

---

## 3. Fluxo de Criação de Conta e Pré-Cadastro

### 3.1. Transição Suave (Balcão -> App Mobile)
Em `src/lib/auth/patient-actions.ts`:
- No método `registerPatientAccount`:
  - Se o CPF já existe na tabela `patients` (cadastrado previamente pela recepcionista no balcão desktop):
    - O sistema verifica se existe vínculo com `auth_user_id` em `mobile_accounts`.
    - Se **não existir** conta ativa no Auth para aquele paciente:
      - Em vez de rejeitar com `"Este CPF já está no cadastro da clínica"`, o sistema provisiona o usuário no Supabase Auth com o e-mail informado e a senha escolhida.
      - Vincula atômica e seguramente `mobile_accounts` e `profiles` ao registro existente de `patients`.
      - Executa login automático no app mobile.
    - Se **já existir** conta com senha configurada:
      - Retorna mensagem amigável: `"Este CPF já possui acesso cadastrado. Entre com sua senha ou utilize a recuperação de acesso."`

---

## 4. Guias de Autorização: Fotos, Endereço, Local e Validação

### 4.1. Atualização do Canvas da Guia (`src/lib/authorization-guide.ts`)
- **Foto do Profissional ou Logotipo:**
  - O objeto `AuthorizationGuideInput.professional` aceita `photoUrl?: string | null`.
  - O canvas carrega a imagem da foto do médico via `new Image()` (suportando HTTPS e data URIs com crossOrigin="anonymous").
  - A foto é desenhada em formato circular elegante (raio 36px, com borda sutil `#d0d7de`) ao lado da identificação do médico.
  - Caso o atendimento seja procedimento independente da clínica (`professionalId == null` ou `"Geral da Clínica"`):
    - Renderiza o selo oficial da clínica e a denominação `"Atendimento Geral da Clínica"`.
  - Caso a foto falhe no carregamento, utiliza um avatar de fallback gracioso.

- **Local, Endereço e Data/Hora com Destaque:**
  - Bloco "Local e data da realização":
    - **Data da agenda:** `dd/MM/yyyy 'às' HH:mm`.
    - **Endereço Completo:** Rua, número, complemento e sala/setor.
    - **Município:** Cidade/UF.
    - **Telefone:** Telefone formatado da unidade.

- **Selo de Validação e Autenticidade Digital:**
  - Bloco verde destacado no cabeçalho ou rodapé:
    - `"GUIA DE AUTORIZAÇÃO AUTÊNTICA"`
    - Código da autorização e data de emissão.
    - Código de barras ou credenciais para leitura rápida.

### 4.2. Integração na API (`src/app/api/desktop/guides/route.ts`)
- Inclui `photo_url` na seleção dos profissionais:
  ```typescript
  db.from("professionals").select("id,name,specialty,credential_label,credential_code,location,start_hour,end_hour,photo_url")
  ```
- Suporte a serviços independentes da clínica:
  - Se `appointment.professional_id` for nulo, busca a oferta em `catalog_offers`.
  - Preenche o `professional` na guia como:
    ```typescript
    {
      name: "Geral da Clínica",
      specialtyLabel: "Procedimento / Exame",
      credentialLabel: "Unidade",
      credentialCode: clinic.name,
      location: clinic.address,
      startHour: "08:00",
      endHour: "18:00",
      photoUrl: null,
    }
    ```

---

## 5. Estratégia de Testes

1. **Testes de RLS e Permissões:**
   - Validar sintaxe SQL e políticas de RLS no arquivo de migração.
2. **Testes do Fluxo de Cadastro e Transição:**
   - Teste unitário para `registerPatientAccount` com CPF já cadastrado pela clínica sem senha criada.
   - Teste unitário para `registerPatientAccount` com CPF e conta já existente.
3. **Testes de Emissão da Guia:**
   - Teste de `createAuthorizationGuide` recebendo foto de profissional e procedimento independente.
   - Teste de `GET /api/desktop/guides` retornando `photo_url` e lidando com `professional_id` nulo.
4. **Build & Regressão:**
   - `npm run test:unit`, `npx tsc --noEmit` e `npm run build`.
