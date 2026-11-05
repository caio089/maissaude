# Design Document: Especialidades Dinâmicas, Fotos de Profissionais, Procedimentos Independentes e Aba de Cirurgias

**Data:** 05/11/2026  
**Status:** Aprovado para Implementação  
**Escopo:** Frente 3 - Fotos de Profissionais, Cadastro de Especialidades Dinâmicas, Procedimentos e Exames Independentes de Médicos e Aba Exclusiva de Cirurgias

---

## 1. Visão Geral e Objetivos

Este documento especifica a evolução da gestão de profissionais, procedimentos e cirurgias na plataforma MaisSaúde, atendendo às necessidades clínicas reais onde:
1. **Profissionais:** Necessitam de fotos reais (upload direto do computador/celular ou link externo com preview imediato) e suporte a uma lista abrangente de especialidades médicas brasileiras, além da possibilidade de cadastrar especialidades personalizadas livremente.
2. **Procedimentos & Exames Independentes:** Procedimentos ambulatoriais, exames laboratoriais e procedimentos de enfermagem podem ser realizados pela clínica em geral sem estarem atrelados a um médico específico (`professional_id: null`).
3. **Aba Exclusiva de Cirurgias (`/desktop/cirurgias`):** Uma seção dedicada no menu lateral da clínica e no painel para cadastrar, listar e gerenciar cirurgias de forma separada de consultas e procedimentos simples.

---

## 2. Arquitetura de Dados e Esquema (Supabase)

### 2.1. Alterações no Esquema
```sql
-- 1. Suporte a fotos de profissionais
alter table public.professionals add column if not exists photo_url text;

-- 2. Tornar o vínculo com médico opcional para procedimentos independentes e cirurgias
alter table public.catalog_offers alter column professional_id drop not null;
alter table public.appointments alter column professional_id drop not null;

-- 3. Tabela de especialidades médicas dinâmicas
create table if not exists public.clinic_specialties (
  id text primary key,
  name text not null unique,
  created_at timestamptz not null default now()
);

alter table public.clinic_specialties enable row level security;
```

### 2.2. Especialidades Médicas Padrão (Seed)
A tabela `clinic_specialties` é inicializada com:
- Clínica geral, Cardiologia, Cirurgia geral, Dermatologia, Endocrinologia, Fisioterapia, Fonoaudiologia, Gastroenterologia, Geriatria, Ginecologia e obstetrícia, Neurologia, Nutrição, Odontologia, Oftalmologia, Ortopedia e traumatologia, Otorrinolaringologia, Pediatria, Pneumologia, Psicologia, Psiquiatria, Radiologia, Reumatologia, Urologia.
- Administradores podem registrar qualquer outra especialidade digitando diretamente no formulário.

---

## 3. Componentes e Fluxo de Usuário

### 3.1. Fotos de Profissionais (`Portrait` e `ProfessionalsView`)
- **Visualizador `Portrait` (`src/components/shared/portrait.tsx`):**
  - Se receber uma imagem real (URL `http...` ou data URI `data:image...` via prop `photoUrl` ou `seed`), exibe a imagem real com `object-cover`.
  - Se não houver foto, utiliza o avatar ilustrado via DiceBear como fallback gracioso.
- **Formulário do Profissional (`src/components/desktop/professionals-view.tsx`):**
  - Componente de foto com preview circular interativo.
  - Botão de upload de arquivo (aceita PNG, JPG, WebP) com redimensionamento inteligente client-side (máx 800x800px em JPEG/PNG) para armazenamento rápido e leve.
  - Opção alternativa de colar link direto de foto externa.

### 3.2. Especialidades Dinâmicas
- O campo "Especialidade" passa a ser um seletor com busca e botão de adição:
  - Lista todas as especialidades cadastradas no banco (`/api/desktop/specialties`).
  - Ao digitar um nome não existente, oferece o botão `+ Cadastrar "[nome]"`.
  - Ao salvar, a nova especialidade é gravada na tabela `clinic_specialties` e fica disponível para todos os profissionais.

### 3.3. Procedimentos & Exames Independentes
- Na tela `/desktop/atendimentos`, o botão "+ Novo atendimento" apresenta o campo:
  - **Profissional responsável:** *"Geral da Clínica (Sem médico específico)"* ou seleção de um médico da lista.
  - **Tipo de atendimento:** Consulta, Exame, Procedimento ou Cirurgia.
  - **Valor (R$):** Valor de tabela.
  - **Duração (minutos):** Tempo estimado do atendimento.
- Os procedimentos independentes são listados na aba interna **"Procedimentos & Exames da Clínica"**.

### 3.4. Nova Aba Exclusiva: Cirurgias (`/desktop/cirurgias`)
- Novo item no menu `DesktopShell`:
  - Ícone cirúrgico (`Activity` ou `Scissors` ou `Stethoscope`).
  - Acessível para Administradores e Atendentes (com atendentes em modo leitura ou agendamento).
- Tela dedicada (`src/components/desktop/surgeries-view.tsx`):
  - KPIs: Total de cirurgias cadastradas, faixa de valores e modalidades.
  - Tabela com: Nome do procedimento cirúrgico, Cirurgião/Equipe (Médico vinculado ou Equipe da Clínica), Duração estimada, Preço de tabela e Desconto de associado.
  - Botão "+ Nova cirurgia" para cadastro ágil com tipo fixado em `kind: "cirurgia"`.

---

## 4. Endpoints de API

1. **`/api/desktop/specialties`:**
   - **GET:** Retorna a lista de especialidades cadastradas.
   - **POST:** Cadastra uma nova especialidade médica (Admin).
2. **`/api/desktop/services`:**
   - Suporte a `professionalId: null` para registrar atendimentos gerais da clínica.
   - Suporte a filtro por `kind` (`kind=cirurgia`, `kind=procedimento`, etc.).
3. **`/api/desktop/professionals`:**
   - Suporte a `photo_url` no payload de criação e edição.
   - Suporte a especialidades dinâmicas (strings customizadas).

---

## 5. Estratégia de Testes

1. **Testes Unitários:**
   - Suporte a especialidades dinâmicas e validação de nomes.
   - Componente `Portrait` renderizando fotos reais vs avatares de fallback.
   - Validação de procedimentos independentes (`professionalId === null`).
   - Filtro de cirurgias por `kind === "cirurgia"`.
2. **Testes de Integração & Build:**
   - Execução de migração SQL sem quebrar consultas existentes.
   - Teste de rotas de API com `npx tsc --noEmit` e `npm run test:unit`.
