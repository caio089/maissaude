# Design Document: Painel das Atendentes e Controle de Acesso por Papel (RBAC)

**Data:** 04/11/2026  
**Status:** Aprovado para Implementação  
**Escopo:** Frente 2 - Perfil de Atendente, Restrições de Módulo Financeiro, Visualização Somente Leitura de Profissionais, Painel Resumido Operacional e Gestão de Equipe

---

## 1. Visão Geral e Objetivos

Este documento especifica a implementação do controle de acesso baseado em papéis (Role-Based Access Control - RBAC) no Painel Desktop da Clínica MaisSaúde.

O objetivo é separar as permissões de **Administrador da Clínica** e **Atendente (Recepção)**, permitindo que a clínica contrate múltiplos atendentes com logins individuais e acesso focado no atendimento ao paciente, protegendo dados financeiros sensíveis e configurações médicas.

### Regras de Negócio e Restrições:
1. **Login Individual por Atendente:**
   - Cada atendente possui seu próprio e-mail e senha cadastrados no sistema pelo Administrador.
   - O campo de e-mail na tela de login da clínica (`/desktop/login`) passa a ser editável para permitir autenticação de qualquer membro da equipe.
2. **Módulo Financeiro Protegido:**
   - Atendentes **não possuem acesso** ao módulo financeiro: a aba "Financeiro" é ocultada do menu lateral, a rota `/desktop/financeiro` é bloqueada e as APIs de movimentação de caixa retornam `403 Forbidden`.
3. **Visão Geral Resumida (Sem Financeiro):**
   - Na página inicial do painel (`/desktop`), atendentes visualizam apenas métricas operacionais (consultas agendadas, atendimentos do dia, pacientes cadastrados e fila de espera), com todos os cards de faturamento, ticket médio e gráficos de receita ocultos.
4. **Profissionais Somente Leitura:**
   - Atendentes podem visualizar a lista de médicos, especialidades, biografias, valores de consulta e horários de trabalho para esclarecer dúvidas dos pacientes e agendar consultas.
   - Botões de "Novo Profissional", "Editar", "Alterar Horários" ou "Salvar" ficam totalmente ocultos e desabilitados para atendentes, com proteção no backend.
5. **Módulos Permitidos para Atendentes:**
   - **Agenda:** Marcação, confirmação, reagendamento e cancelamento de consultas.
   - **Consultas & Procedimentos:** Visualização e condução do fluxo de atendimento.
   - **Guias:** Emissão e impressão de guias de autorização com local e dados completos.
   - **Pacientes:** Cadastro, consulta e atualização de fichas cadastrais.
   - **Associados:** Consulta de status, emissão de cobranças de mensalidade (Pix, Boleto, Cartão) e registro de recebimento presencial no balcão.
6. **Gestão de Equipe (Admin):**
   - Nova aba no menu `/desktop/equipe` visível exclusivamente para Administradores, permitindo criar novas atendentes (nome, e-mail, senha inicial), listar membros e ativar/desativar acessos.

---

## 2. Arquitetura de Dados e Esquema

### 2.1. Tabela `clinic_team` (Supabase)
```sql
create table if not exists public.clinic_team (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid references auth.users(id) on delete set null,
  name text not null,
  email text not null unique,
  role text not null check (role in ('admin', 'attendant')) default 'attendant',
  status text not null check (status in ('active', 'inactive')) default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.clinic_team enable row level security;
```

### 2.2. Supabase Auth Claims (`app_metadata`)
Ao criar ou atualizar um membro da equipe:
- `role`: `"clinic"`
- `clinic_role`: `"admin"` | `"attendant"`
- `name`: string com o nome da atendente

---

## 3. Arquitetura de Sessão e Controle de Acesso (RBAC)

### 3.1. Helper de Sessão no Servidor (`src/lib/clinic-session.ts`)
```typescript
export type ClinicRole = "admin" | "attendant"

export interface ClinicSessionInfo {
  authenticated: boolean
  role: ClinicRole
  email: string
  name: string
  userId?: string
}

export async function getClinicSession(): Promise<ClinicSessionInfo> {
  // 1. Verifica autenticação Supabase Auth via getClaims()
  // 2. Extrai role ("clinic") e clinic_role ("admin" | "attendant")
  // 3. Fallback de desenvolvimento caso aplicável
}
```

### 3.2. Endpoint `/api/desktop/session`
- **GET:** Retorna as informações do usuário logado na clínica para o cliente React:
  ```json
  {
    "authenticated": true,
    "role": "attendant",
    "email": "maria.recepcao@cuidarsaude.com",
    "name": "Maria Silva"
  }
  ```

---

## 4. Endpoints de API e Proteções de Backend

| Endpoint | Método | Papel Mínimo | Descrição |
|---|---|---|---|
| `/api/desktop/team` | GET | Admin | Lista membros da equipe |
| `/api/desktop/team` | POST | Admin | Cria nova atendente no Auth e na tabela `clinic_team` |
| `/api/desktop/team` | PATCH | Admin | Altera status (`active`/`inactive`) ou nome da atendente |
| `/api/desktop/finance` | GET | Admin | Retorna fluxo de caixa e balanço (403 para Atendente) |
| `/api/desktop/cash-entries` | GET, POST | Admin | Movimentações de caixa (403 para Atendente) |
| `/api/desktop/professionals` | GET | Atendente / Admin | Consulta de médicos e horários |
| `/api/desktop/professionals` | POST, PATCH, DELETE | Admin | Criação e edição de médicos (403 para Atendente) |
| `/api/desktop/consultations` | GET, POST, PATCH | Atendente / Admin | Gestão de agendamentos e atendimentos |
| `/api/desktop/patients` | GET, POST, PATCH | Atendente / Admin | Gestão de pacientes |
| `/api/payments/associate` | GET, POST, PATCH | Atendente / Admin | Cobrança e baixa de mensalidades de associados |

---

## 5. Fluxo de Interface (UI/UX)

```mermaid
flowchart TD
    Login[Login da Clínica /desktop/login] --> AuthCheck{Autenticação}
    AuthCheck -- "Role: admin" --> AdminMenu[Menu Completo: Painel, Agenda, Consultas, Guias, Pacientes, Associados, Financeiro, Profissionais (Edição), Equipe]
    AuthCheck -- "Role: attendant" --> AttendantMenu[Menu Restrito: Painel (Resumido), Agenda, Consultas, Guias, Pacientes, Associados, Profissionais (Leitura)]
    
    AttendantMenu --> TryFinance{Tenta acessar /desktop/financeiro}
    TryFinance -- Bloqueado --> RedirectAlert[Aviso: Módulo restrito à administração da clínica]
    
    AdminMenu --> TeamView[Aba Equipe: Cadastrar / Desativar Atendentes]
```

### 5.1. Painel de Visão Geral (`/desktop`) para Atendentes
- Oculta:
  - Card "Faturamento do período"
  - Card "Ticket médio"
  - Gráfico "Evolução de faturamento" (`RevenueArea`)
- Mantém em destaque:
  - Card "Consultas hoje"
  - Card "Total de agendamentos no período"
  - Card "Pacientes ativos"
  - Gráfico "Agendamentos por período" (`AppointmentBars`)
  - Lista de próximos atendimentos do dia

### 5.2. Tela de Profissionais (`/desktop/profissionais`) para Atendentes
- Oculta o botão `+ Novo profissional`.
- Oculta o botão de edição `Editar dados` no rodapé da ficha do médico.
- Exibe tag de visualização `"Modo somente leitura"` de forma discreta para a atendente.

---

## 6. Estratégia de Testes

1. **Testes Unitários:**
   - Resolução correta de `ClinicRole` (`admin` vs `attendant`) com base nas claims.
   - Bloqueio de APIs financeiras com `403 Forbidden` quando o papel é `attendant`.
   - Bloqueio de mutação de profissionais com `403 Forbidden` para `attendant`.
   - Permissão de operações de agendamento e associados para `attendant`.
2. **Testes de Integração & Interface:**
   - Ocultação dos links no menu `DesktopShell`.
   - Ocultação dos cards de faturamento no `DashboardView`.
   - Desativação dos formulários de edição no `ProfessionalsView`.
