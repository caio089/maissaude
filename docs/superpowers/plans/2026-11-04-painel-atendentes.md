# Painel das Atendentes e Controle de Acesso Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement Role-Based Access Control (RBAC) in the Clinic Desktop, allowing administrators to provision individual attendant accounts with restricted permissions: hiding the financial module, masking revenue KPIs on the dashboard overview, and enforcing read-only access to professionals.

**Architecture:** Database table `clinic_team` links Supabase Auth accounts to clinic roles (`admin` vs `attendant`). A centralized session helper `getClinicSession()` extracts claims and enforces access at API and route levels. Frontend views consume session role via `/api/desktop/session` to adapt navigation in `DesktopShell`, remove editing capabilities in `ProfessionalsView`, and display operational-only KPIs in `DashboardView`.

**Tech Stack:** Next.js 15 (App Router), TypeScript, Supabase Auth & PostgreSQL, Tailwind CSS, Vitest.

## Global Constraints

- Financial module (`/desktop/financeiro`) and financial APIs (`/api/desktop/cash-entries`, `/api/desktop/finance`) must return `403 Forbidden` for attendants and remain hidden from their navigation.
- Attendants must never see revenue totals, average ticket, or revenue graphs on `/desktop`.
- Attendants can view professionals and their schedules for appointment booking, but all creation, editing, and deletion controls must be disabled and blocked on backend (`403 Forbidden`).
- All code changes must pass `npx tsc --noEmit` and `npm run test:unit`.
- No demo or simulation terms introduced.

---

### Task 1: Database Migration for Clinic Team Table and Types

**Files:**
- Create: `supabase/migrations/20261104210000_create_clinic_team.sql`
- Modify: `src/lib/types.ts`

**Interfaces:**
- Consumes: Existing Supabase schema.
- Produces:
  - `public.clinic_team` table with `auth_user_id`, `name`, `email`, `role`, `status`.
  - Types:
    ```typescript
    export type ClinicRole = "admin" | "attendant"
    export interface ClinicTeamMember {
      id: string
      authUserId?: string | null
      name: string
      email: string
      role: ClinicRole
      status: "active" | "inactive"
      createdAt: string
    }
    ```

- [ ] **Step 1: Create Supabase migration for clinic_team**

Create `supabase/migrations/20261104210000_create_clinic_team.sql`:
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

- [ ] **Step 2: Add ClinicRole and ClinicTeamMember to `src/lib/types.ts`**

In `src/lib/types.ts`:
```typescript
export type ClinicRole = "admin" | "attendant"

export interface ClinicTeamMember {
  id: string
  authUserId?: string | null
  name: string
  email: string
  role: ClinicRole
  status: "active" | "inactive"
  createdAt: string
}
```

- [ ] **Step 3: Run TypeScript compiler**

Run: `npx tsc --noEmit`
Expected: PASS with 0 errors.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20261104210000_create_clinic_team.sql src/lib/types.ts
git commit -m "feat(clinic-team): add database migration and types for clinic roles"
```

---

### Task 2: Clinic Session & Role Resolution Helper (TDD)

**Files:**
- Create: `tests/unit/clinic-session.test.ts`
- Modify: `src/lib/clinic-session.ts`
- Create: `src/app/api/desktop/session/route.ts`

**Interfaces:**
- Consumes: `createServerSupabase`, `cookies`, `CLINIC_COOKIE`.
- Produces:
  - `getClinicSession(): Promise<{ authenticated: boolean; role: ClinicRole; email: string; name: string; userId?: string }>`
  - `GET /api/desktop/session`: Returns `{ authenticated: boolean; role: ClinicRole; email: string; name: string }`

- [ ] **Step 1: Write failing unit test for clinic session role resolution**

Create `tests/unit/clinic-session.test.ts`:
```typescript
import { describe, expect, it } from "vitest"
import { resolveClinicRole } from "@/lib/clinic-session"

describe("resolveClinicRole", () => {
  it("retorna admin para email principal ou claims de admin", () => {
    expect(resolveClinicRole({ email: "cuidarsaude2026@gmail.com", clinicRole: undefined })).toBe("admin")
    expect(resolveClinicRole({ email: "gestor@clinica.com", clinicRole: "admin" })).toBe("admin")
  })

  it("retorna attendant quando o papel específico for attendant", () => {
    expect(resolveClinicRole({ email: "recepcao@clinica.com", clinicRole: "attendant" })).toBe("attendant")
  })

  it("retorna admin por padrão se o email for da clínica demo", () => {
    expect(resolveClinicRole({ email: "cuidarsaude2026@gmail.com", clinicRole: null })).toBe("admin")
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:unit -- tests/unit/clinic-session.test.ts`
Expected: FAIL (resolveClinicRole is not exported).

- [ ] **Step 3: Implement `resolveClinicRole` and `getClinicSession` in `src/lib/clinic-session.ts`**

In `src/lib/clinic-session.ts`:
```typescript
import { cookies } from "next/headers"
import { CLINIC_AUTH_EMAIL, isClinicRole } from "@/lib/auth/constants"
import { CLINIC_COOKIE, verifyClinicToken } from "@/lib/clinic-token"
import type { ClinicRole } from "@/lib/types"

export interface ClinicSessionInfo {
  authenticated: boolean
  role: ClinicRole
  email: string
  name: string
  userId?: string
}

export function resolveClinicRole(params: { email?: string | null; clinicRole?: string | null }): ClinicRole {
  if (params.clinicRole === "attendant") return "attendant"
  if (params.clinicRole === "admin") return "admin"
  if (params.email?.toLowerCase() === CLINIC_AUTH_EMAIL.toLowerCase()) return "admin"
  return "attendant"
}

export async function hasClinicSession(): Promise<boolean> {
  const session = await getClinicSession()
  return session.authenticated
}

export async function getClinicSession(): Promise<ClinicSessionInfo> {
  try {
    const { createServerSupabase } = await import("@/lib/supabase/server")
    const supabase = await createServerSupabase()
    const { data: claimsData } = await supabase.auth.getClaims()
    const claims = claimsData?.claims as any
    const role = claims?.app_metadata?.role
    const clinicRoleClaim = claims?.app_metadata?.clinic_role
    const email = claims?.email || ""

    if (isClinicRole(role)) {
      const clinicRole = resolveClinicRole({ email, clinicRole: clinicRoleClaim })
      return {
        authenticated: true,
        role: clinicRole,
        email,
        name: claims?.user_metadata?.name || claims?.name || (clinicRole === "admin" ? "Administrador" : "Atendente"),
        userId: claims?.sub,
      }
    }
  } catch {
    // Continua para fallback de cookie de desenvolvimento
  }

  const token = (await cookies()).get(CLINIC_COOKIE)?.value
  const valid = verifyClinicToken(token, Date.now())
  if (valid) {
    return {
      authenticated: true,
      role: "admin",
      email: CLINIC_AUTH_EMAIL,
      name: "Administrador da Clínica",
    }
  }

  return {
    authenticated: false,
    role: "attendant",
    email: "",
    name: "",
  }
}
```

Create `src/app/api/desktop/session/route.ts`:
```typescript
import { NextResponse } from "next/server"
import { getClinicSession } from "@/lib/clinic-session"

export async function GET() {
  const session = await getClinicSession()
  if (!session.authenticated) {
    return NextResponse.json({ authenticated: false, error: "Não autenticado." }, { status: 401 })
  }
  return NextResponse.json(session)
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:unit -- tests/unit/clinic-session.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/clinic-session.ts src/app/api/desktop/session/route.ts tests/unit/clinic-session.test.ts
git commit -m "feat(clinic-session): implement clinic session role resolver and session endpoint"
```

---

### Task 3: Team Management API (`/api/desktop/team`)

**Files:**
- Create: `src/app/api/desktop/team/route.ts`
- Create: `tests/unit/desktop-team-api.test.ts`

**Interfaces:**
- Consumes: `getClinicSession`, `createSupabaseAdmin`.
- Produces:
  - `GET /api/desktop/team`: Only allowed for `admin`. Returns array of `ClinicTeamMember`.
  - `POST /api/desktop/team`: Only allowed for `admin`. Body: `{ name, email, password, role }`. Creates Auth user via `admin.auth.admin.createUser` with `app_metadata: { role: 'clinic', clinic_role: role }` and registers in `public.clinic_team`.
  - `PATCH /api/desktop/team`: Only allowed for `admin`. Body: `{ id, status, name }`. Updates member status in database.

- [ ] **Step 1: Write unit test for team API authorization checks**

Create `tests/unit/desktop-team-api.test.ts`:
```typescript
import { describe, expect, it } from "vitest"
import { resolveClinicRole } from "@/lib/clinic-session"

describe("desktop team authorization", () => {
  it("apenas papel admin pode gerenciar equipe", () => {
    const admin = resolveClinicRole({ clinicRole: "admin" })
    const attendant = resolveClinicRole({ clinicRole: "attendant" })
    expect(admin === "admin").toBe(true)
    expect(attendant === "admin").toBe(false)
  })
})
```

- [ ] **Step 2: Implement `src/app/api/desktop/team/route.ts`**

In `src/app/api/desktop/team/route.ts`:
- Validate `session.authenticated && session.role === "admin"`. If not, return `403 Forbidden` (`{ error: "Apenas administradores podem gerenciar a equipe." }`).
- Implement `GET`: query `clinic_team` ordered by `created_at desc`.
- Implement `POST`: validate `name >= 3`, valid email, `password >= 6`, `role in ("admin", "attendant")`. Provision Supabase Auth user and insert row in `clinic_team`.
- Implement `PATCH`: update status or name in `clinic_team`.

- [ ] **Step 3: Run unit tests and typecheck**

Run: `npm run test:unit -- tests/unit/desktop-team-api.test.ts`
Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/desktop/team/route.ts tests/unit/desktop-team-api.test.ts
git commit -m "feat(api): implement clinic team management endpoints with admin authorization"
```

---

### Task 4: Backend API Role Guards on Financial and Professional Mutation Routes

**Files:**
- Modify: `src/app/api/desktop/professionals/route.ts`
- Modify: `src/app/api/desktop/cash-entries/route.ts` (or finance routes)
- Create: `tests/unit/role-guards.test.ts`

**Interfaces:**
- Consumes: `getClinicSession`.
- Produces:
  - If `session.role === "attendant"`:
    - `POST`, `PATCH`, `DELETE` in `/api/desktop/professionals` returns `403 Forbidden` (`{ error: "Atendentes não têm permissão para editar profissionais." }`).
    - `GET`, `POST` in `/api/desktop/cash-entries` returns `403 Forbidden` (`{ error: "Módulo financeiro restrito à administração." }`).

- [ ] **Step 1: Write unit test for role guards**

Create `tests/unit/role-guards.test.ts` verifying that attendant role blocks mutation requests.

- [ ] **Step 2: Update `/api/desktop/professionals/route.ts`**

Check `const session = await getClinicSession()`:
In `POST`, `PATCH`, `DELETE`:
```typescript
if (session.role === "attendant") {
  return NextResponse.json({ error: "Atendentes possuem acesso somente leitura aos profissionais." }, { status: 403 })
}
```

- [ ] **Step 3: Update cash-entries and finance endpoints**

Block attendant role with `403 Forbidden`.

- [ ] **Step 4: Run unit tests and typecheck**

Run: `npm run test:unit`
Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/desktop/professionals/route.ts tests/unit/role-guards.test.ts
git commit -m "feat(security): guard financial and professional mutation routes against attendant role"
```

---

### Task 5: Desktop Shell Navigation & Team Management View

**Files:**
- Modify: `src/components/desktop/shell.tsx`
- Create: `src/components/desktop/team-view.tsx`
- Create: `src/app/desktop/equipe/page.tsx`
- Modify: `src/app/desktop/financeiro/page.tsx`

**Interfaces:**
- Consumes: `/api/desktop/session`, `/api/desktop/team`.
- Produces:
  - `DesktopShell`:
    - Queries `/api/desktop/session`.
    - If `role === "attendant"`: Removes `/desktop/financeiro` from `NAV`.
    - If `role === "admin"`: Adds `/desktop/equipe` (Equipe) to `NAV`.
    - Displays user badge in header: `[Nome da Atendente] (Recepção)` ou `[Nome] (Administrador)`.
  - `/desktop/financeiro/page.tsx`:
    - If attendant tries to access directly, displays alert message and button to return to `/desktop`.
  - `TeamView`:
    - List of members with name, email, role, status badge.
    - Modal "+ Novo membro da equipe" with name, email, role (Admin / Atendente), and initial password.
    - Status toggle (Ativar / Desativar).

- [ ] **Step 1: Update `src/components/desktop/shell.tsx`**

Fetch `/api/desktop/session` on mount.
Filter `NAV` list:
```typescript
const visibleNav = useMemo(() => {
  return NAV.filter((item) => {
    if (session?.role === "attendant" && item.href === "/desktop/financeiro") return false
    return true
  }).concat(session?.role === "admin" ? [{ href: "/desktop/equipe", label: "Equipe", icon: ShieldCheck }] : [])
}, [session?.role])
```

- [ ] **Step 2: Create `src/components/desktop/team-view.tsx` and `src/app/desktop/equipe/page.tsx`**

Implement member list, creation dialog, and status toggles.

- [ ] **Step 3: Guard `/desktop/financeiro/page.tsx`**

If session is attendant, render friendly access restriction view.

- [ ] **Step 4: Verify TypeScript compilation**

Run: `npx tsc --noEmit`
Expected: PASS with 0 errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/desktop/shell.tsx src/components/desktop/team-view.tsx src/app/desktop/equipe/page.tsx src/app/desktop/financeiro/page.tsx
git commit -m "feat(desktop): adapt sidebar navigation by role and add team management view"
```

---

### Task 6: Operational Overview (Dashboard) & Read-Only Professional View for Attendants

**Files:**
- Modify: `src/components/desktop/dashboard-view.tsx`
- Modify: `src/components/desktop/professionals-view.tsx`
- Create: `tests/unit/desktop-role-views.test.ts`

**Interfaces:**
- Consumes: `/api/desktop/session`.
- Produces:
  - `DashboardView`:
    - When `session.role === "attendant"`, hide revenue KPI card and `RevenueArea` chart. Default active chart to "appointments" (Agendamentos).
  - `ProfessionalsView`:
    - When `session.role === "attendant"`, hide "+ Novo profissional", hide "Editar" buttons, and display a discrete badge "Visualização de horários (Somente leitura)".

- [ ] **Step 1: Write unit test for role view adaptations**

Create `tests/unit/desktop-role-views.test.ts`:
Verify that attendant filter hides financial components and editing actions.

- [ ] **Step 2: Update `src/components/desktop/dashboard-view.tsx`**

Fetch `/api/desktop/session`.
If `session?.role === "attendant"`:
- Hide revenue card (`Faturamento`).
- Hide revenue toggle on chart; force chart to `appointments`.

- [ ] **Step 3: Update `src/components/desktop/professionals-view.tsx`**

Fetch `/api/desktop/session`.
If `session?.role === "attendant"`:
- Hide "+ Novo profissional" button.
- Hide edit button and prevent form dialog from opening.
- Show badge "Modo somente leitura".

- [ ] **Step 4: Run unit tests and typecheck**

Run: `npm run test:unit`
Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/desktop/dashboard-view.tsx src/components/desktop/professionals-view.tsx tests/unit/desktop-role-views.test.ts
git commit -m "feat(desktop): mask financial metrics on dashboard and enforce read-only professionals for attendants"
```

---

### Task 7: Login Form Upgrade for Individual Attendants

**Files:**
- Modify: `src/components/desktop/clinic-login-form.tsx`
- Modify: `src/lib/clinic-actions.ts`

**Interfaces:**
- Consumes: Supabase Auth credentials.
- Produces:
  - E-mail input in `ClinicLoginForm` is no longer `readOnly`, allowing any team member to enter their email and password.
  - Keeps demo helper text as an optional suggestion rather than forcing the input value.
  - On login, checks `app_metadata.role === "clinic"` (which applies to both Admin and Attendant).

- [ ] **Step 1: Update `src/components/desktop/clinic-login-form.tsx`**

Remove `readOnly` and `value={CLINIC_AUTH_EMAIL}`. Change to `defaultValue={CLINIC_AUTH_EMAIL}` and make it fully editable.

- [ ] **Step 2: Update `src/lib/clinic-actions.ts`**

Support login for any registered clinic team member in `loginClinic`.

- [ ] **Step 3: Run unit tests and typecheck**

Run: `npm run test:unit`
Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/desktop/clinic-login-form.tsx src/lib/clinic-actions.ts
git commit -m "feat(auth): enable individual email login for clinic attendants"
```

---

### Task 8: End-to-End Verification and Regression Suite

**Files:**
- All tests in `tests/unit/`

- [ ] **Step 1: Run all unit tests**

Run: `npm run test:unit`
Expected: All tests pass.

- [ ] **Step 2: Run full TypeScript check**

Run: `npx tsc --noEmit`
Expected: PASS with 0 errors.

- [ ] **Step 3: Run Next.js production build check**

Run: `npm run build`
Expected: PASS with all routes compiled.

- [ ] **Step 4: Clean status check**

Run: `git status`
Expected: Clean working tree.
