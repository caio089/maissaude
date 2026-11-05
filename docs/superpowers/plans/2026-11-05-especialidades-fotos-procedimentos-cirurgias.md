# Especialidades, Fotos, Procedimentos Independentes e Cirurgias Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement professional photo uploads, dynamic medical specialties, doctor-independent clinic procedures/exams, and a dedicated surgeries tab across Clinic Desktop and Patient Mobile.

**Architecture:** Database updates in Supabase make `professional_id` nullable in `catalog_offers` and `appointments` to support clinic-level procedures, add `photo_url` to `professionals`, and introduce a `clinic_specialties` table. Frontend updates in `Portrait` support real photo rendering with DiceBear fallback. The desktop dashboard gains a dedicated `/desktop/cirurgias` route, and `/desktop/atendimentos` gains tabbed views for doctor consultations vs clinic-level independent procedures.

**Tech Stack:** Next.js 15 (App Router), TypeScript, Supabase (PostgreSQL), Tailwind CSS, Vitest.

## Global Constraints

- Never break existing appointments or consultations when `professional_id` is null.
- `Portrait` must seamlessly render real photos (URL or base64) while keeping DiceBear avatar fallback when no photo is uploaded.
- Dedicated "Cirurgias" tab must be available in sidebar navigation for both admin and attendants (attendants in view/schedule mode, admin in management mode).
- All code changes must pass `npx tsc --noEmit` and `npm run test:unit`.
- No demo or simulation terms introduced.

---

### Task 1: Database Migration for Photos, Nullable Doctor Linking and Dynamic Specialties

**Files:**
- Create: `supabase/migrations/20261105100000_specialties_photos_independent_procedures.sql`
- Modify: `src/lib/types.ts`

**Interfaces:**
- Consumes: Existing Supabase schema and `src/lib/types.ts`.
- Produces:
  - `photo_url` column in `public.professionals`.
  - Nullable `professional_id` in `public.catalog_offers` and `public.appointments`.
  - `public.clinic_specialties` table with default medical specialties seed.
  - Updated `Professional`, `CatalogOffer`, and `Specialty` in `src/lib/types.ts`.

- [ ] **Step 1: Create Supabase migration**

Create `supabase/migrations/20261105100000_specialties_photos_independent_procedures.sql`:
```sql
-- Suporte a fotos de profissionais
alter table public.professionals add column if not exists photo_url text;

-- Vínculo opcional de médico para procedimentos independentes e exames
alter table public.catalog_offers alter column professional_id drop not null;
alter table public.appointments alter column professional_id drop not null;

-- Tabela de especialidades médicas dinâmicas
create table if not exists public.clinic_specialties (
  id text primary key,
  name text not null unique,
  created_at timestamptz not null default now()
);

alter table public.clinic_specialties enable row level security;

-- Seed inicial de especialidades médicas brasileiras
insert into public.clinic_specialties (id, name) values
  ('clinica-geral', 'Clínica geral'),
  ('cardiologia', 'Cardiologia'),
  ('cirurgia-geral', 'Cirurgia geral'),
  ('dermatologia', 'Dermatologia'),
  ('endocrinologia', 'Endocrinologia'),
  ('fisioterapia', 'Fisioterapia'),
  ('fonoaudiologia', 'Fonoaudiologia'),
  ('gastroenterologia', 'Gastroenterologia'),
  ('geriatria', 'Geriatria'),
  ('ginecologia-obstetricia', 'Ginecologia e obstetrícia'),
  ('neurologia', 'Neurologia'),
  ('nutricao', 'Nutrição'),
  ('odontologia', 'Odontologia'),
  ('oftalmologia', 'Oftalmologia'),
  ('ortopedia-traumatologia', 'Ortopedia e traumatologia'),
  ('otorrinolaringologia', 'Otorrinolaringologia'),
  ('pediatria', 'Pediatria'),
  ('pneumologia', 'Pneumologia'),
  ('psicologia', 'Psicologia'),
  ('psiquiatria', 'Psiquiatria'),
  ('radiologia', 'Radiologia'),
  ('reumatologia', 'Reumatologia'),
  ('urologia', 'Urologia')
on conflict (name) do nothing;
```

- [ ] **Step 2: Update `src/lib/types.ts`**

Update `Professional`:
```typescript
export interface Professional {
  id: string
  name: string
  specialty: string
  credentialLabel: string
  credentialCode: string
  bio: string
  price: number
  rating: number
  reviewCount: number
  reviews: Review[]
  workDays: number[]
  startHour: string
  endHour: string
  location: string
  active: boolean
  avatarSeed: string
  photoUrl?: string | null
  services: Service[]
}

export interface ProfessionalInput {
  name: string
  specialty: string
  credentialCode: string
  bio: string
  price: number
  workDays: number[]
  startHour: string
  endHour: string
  active: boolean
  photoUrl?: string | null
}
```
Update `Appointment` to allow `professionalId: string | null`.

- [ ] **Step 3: Run TypeScript compiler**

Run: `npx tsc --noEmit`
Expected: PASS with 0 errors.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20261105100000_specialties_photos_independent_procedures.sql src/lib/types.ts
git commit -m "feat(catalog): schema migration for photo url, nullable doctor linking and dynamic specialties"
```

---

### Task 2: Dynamic Specialties API and Helper Engine (TDD)

**Files:**
- Create: `src/app/api/desktop/specialties/route.ts`
- Create: `tests/unit/specialties.test.ts`
- Modify: `src/lib/specialties.ts` (helper for normalizing & validating specialties)

**Interfaces:**
- Consumes: `createSupabaseAdmin`, `getClinicSession`.
- Produces:
  - `GET /api/desktop/specialties`: Returns array of `{ id: string, name: string }`.
  - `POST /api/desktop/specialties`: Accepts `{ name: string }`, validates length (3-60 chars), generates slug/id, inserts into `clinic_specialties`, returns created record.

- [ ] **Step 1: Write failing unit test for specialties normalization and API**

Create `tests/unit/specialties.test.ts`:
```typescript
import { describe, expect, it } from "vitest"
import { normalizeSpecialtyName, slugifySpecialty } from "@/lib/specialties"

describe("specialties helper", () => {
  it("normaliza nomes de especialidades médicas", () => {
    expect(normalizeSpecialtyName("  ortopedia e traumatologia ")).toBe("Ortopedia e traumatologia")
  })

  it("gera id em slug seguro", () => {
    expect(slugifySpecialty("Ginecologia e Obstetrícia")).toBe("ginecologia-obstetricia")
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:unit -- tests/unit/specialties.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `src/lib/specialties.ts` and `src/app/api/desktop/specialties/route.ts`**

In `src/lib/specialties.ts`:
```typescript
export function normalizeSpecialtyName(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) return ""
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1)
}

export function slugifySpecialty(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}
```

In `src/app/api/desktop/specialties/route.ts`:
Implement `GET` (returns all specialties ordered by name) and `POST` (validates name and creates in `clinic_specialties`).

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:unit -- tests/unit/specialties.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/specialties.ts src/app/api/desktop/specialties/route.ts tests/unit/specialties.test.ts
git commit -m "feat(specialties): implement dynamic specialties api and normalization helpers"
```

---

### Task 3: Professional Photo Upload & Portrait Component Upgrade (TDD)

**Files:**
- Modify: `src/components/shared/portrait.tsx`
- Modify: `src/app/api/desktop/professionals/route.ts`
- Modify: `src/components/desktop/professionals-view.tsx`
- Create: `tests/unit/portrait-photo.test.ts`

**Interfaces:**
- Consumes: `Portrait` component, `professionals` table.
- Produces:
  - `Portrait` accepts `photoUrl?: string | null` or inspects `seed`. If a URL (`http...`) or data URI (`data:image...`) is passed, renders the real image. Otherwise renders DiceBear avatar.
  - `ProfessionalsView` includes photo upload input with instant base64 client preview and URL fallback.
  - `/api/desktop/professionals` saves and returns `photo_url`.

- [ ] **Step 1: Write failing unit test for `Portrait` photo resolution**

Create `tests/unit/portrait-photo.test.ts`:
```typescript
import { describe, expect, it } from "vitest"
import { isPhotoUrl } from "@/components/shared/portrait"

describe("isPhotoUrl helper", () => {
  it("reconhece URLs http e data URIs como fotos reais", () => {
    expect(isPhotoUrl("https://example.com/foto.jpg")).toBe(true)
    expect(isPhotoUrl("data:image/jpeg;base64,12345")).toBe(true)
    expect(isPhotoUrl("dra-maria")).toBe(false)
    expect(isPhotoUrl(null)).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:unit -- tests/unit/portrait-photo.test.ts`
Expected: FAIL.

- [ ] **Step 3: Update `src/components/shared/portrait.tsx`**

Export `isPhotoUrl(value?: string | null): boolean`:
```typescript
export function isPhotoUrl(value?: string | null): boolean {
  if (!value || typeof value !== "string") return false
  return value.startsWith("http://") || value.startsWith("https://") || value.startsWith("data:image/")
}
```
In `Portrait({ seed, photoUrl, name, className })`:
If `photoUrl` or `seed` matches `isPhotoUrl`, render `<img src={photoUrl || seed} alt={...} />`.
Otherwise render DiceBear avatar `<img src={portraitUri(seed)} ... />`.

- [ ] **Step 4: Update `src/app/api/desktop/professionals/route.ts`**

In GET: return `photoUrl: p.photo_url || null`.
In POST: accept `form.photoUrl` and persist `photo_url: form.photoUrl || null`.

- [ ] **Step 5: Update `src/components/desktop/professionals-view.tsx` with photo upload**

Add file input with `FileReader.readAsDataURL` and preview.

- [ ] **Step 6: Run tests and typecheck**

Run: `npm run test:unit -- tests/unit/portrait-photo.test.ts`
Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/components/shared/portrait.tsx src/app/api/desktop/professionals/route.ts src/components/desktop/professionals-view.tsx tests/unit/portrait-photo.test.ts
git commit -m "feat(professionals): add real photo upload and display with avatar fallback"
```

---

### Task 4: Dynamic Specialties Selector in Professional Registration

**Files:**
- Modify: `src/components/desktop/professionals-view.tsx`
- Create: `tests/unit/professional-specialties.test.ts`

**Interfaces:**
- Consumes: `/api/desktop/specialties`.
- Produces:
  - Searchable specialty select with all available medical specialties.
  - Option to type a new custom specialty and save it immediately.

- [ ] **Step 1: Write unit test for specialty selection logic**

Create `tests/unit/professional-specialties.test.ts`.

- [ ] **Step 2: Update `src/components/desktop/professionals-view.tsx`**

Fetch specialties from `/api/desktop/specialties`.
Provide dropdown with list and inline "+ Cadastrar nova especialidade".

- [ ] **Step 3: Run unit tests and typecheck**

Run: `npm run test:unit`
Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/desktop/professionals-view.tsx tests/unit/professional-specialties.test.ts
git commit -m "feat(professionals): enable dynamic specialties selection and creation in desktop view"
```

---

### Task 5: Independent Procedures & Exames API & View

**Files:**
- Modify: `src/app/api/desktop/services/route.ts`
- Modify: `src/components/desktop/services-view.tsx`
- Create: `tests/unit/independent-procedures.test.ts`

**Interfaces:**
- Consumes: `catalog_offers`, `professional_services`.
- Produces:
  - `POST /api/desktop/services`: accepts `professionalId: string | null`. If `null`, saves as clinic-level independent procedure in `catalog_offers` (`professional_id = null`).
  - `GET /api/desktop/services`: supports returning all clinic procedures and doctor procedures.
  - `ServicesView`:
    - Shows tabs: [Consultas Médicas] e [Procedimentos & Exames da Clínica].
    - In procedure registration form, allows setting "Geral da Clínica (Sem médico específico)".

- [ ] **Step 1: Write unit test for independent procedures**

Create `tests/unit/independent-procedures.test.ts`.

- [ ] **Step 2: Update `src/app/api/desktop/services/route.ts`**

Allow `body.professionalId` to be null or empty string, inserting into `catalog_offers` with `professional_id: null`.

- [ ] **Step 3: Update `src/components/desktop/services-view.tsx`**

Implement tabs and doctor-independent creation mode.

- [ ] **Step 4: Run tests and typecheck**

Run: `npm run test:unit -- tests/unit/independent-procedures.test.ts`
Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/desktop/services/route.ts src/components/desktop/services-view.tsx tests/unit/independent-procedures.test.ts
git commit -m "feat(services): support clinic-level independent procedures and exams"
```

---

### Task 6: Dedicated Surgeries Tab (`/desktop/cirurgias`)

**Files:**
- Create: `src/app/desktop/(painel)/cirurgias/page.tsx`
- Create: `src/components/desktop/surgeries-view.tsx`
- Modify: `src/components/desktop/shell.tsx`
- Create: `tests/unit/surgeries-view.test.ts`

**Interfaces:**
- Consumes: `/api/desktop/services?kind=cirurgia`, `DesktopShell`.
- Produces:
  - `/desktop/cirurgias` route in navigation.
  - `SurgeriesView`: displays surgical procedures, durations, table price, associate discounted price, and surgical team / doctor.
  - Modal "+ Nova cirurgia" to quickly add surgical procedures.

- [ ] **Step 1: Write unit test for surgeries view filtering and calculations**

Create `tests/unit/surgeries-view.test.ts`.

- [ ] **Step 2: Add "Cirurgias" item in `DesktopShell` (`src/components/desktop/shell.tsx`)**

Add `{ href: "/desktop/cirurgias", label: "Cirurgias", icon: Activity }` to `NAV`.

- [ ] **Step 3: Create `src/components/desktop/surgeries-view.tsx` and `src/app/desktop/(painel)/cirurgias/page.tsx`**

Implement surgeries listing, metrics, and "+ Nova cirurgia" dialog.

- [ ] **Step 4: Run unit tests and typecheck**

Run: `npm run test:unit`
Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/desktop/shell.tsx src/app/desktop/(painel)/cirurgias/page.tsx src/components/desktop/surgeries-view.tsx tests/unit/surgeries-view.test.ts
git commit -m "feat(surgeries): implement dedicated surgeries view and sidebar navigation"
```

---

### Task 7: End-to-End Verification and Regression Suite

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
Expected: PASS with static and dynamic routes compiled.

- [ ] **Step 4: Confirm git status clean**

Run: `git status`
Expected: Clean working tree.
