# RLS de Contas e Validação/Emissão de Guias Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement patient-level RLS policies on `patients`, enable seamless transition/account creation for desk pre-registered patients in the mobile app, and upgrade the authorization guide canvas with doctor photos, clinic seal for independent procedures, highlighted address and appointment date/time, and digital authenticity credentials.

**Architecture:** A Supabase SQL migration grants `select` and `update` on `public.patients` to `authenticated` scoped by `profiles.patient_id = id`. In `patient-actions.ts`, `registerPatientAccount` detects patients already created in the clinic desk without passwords, creating their Auth user and linking `mobile_accounts` atomically instead of blocking. In `authorization-guide.ts` and `/api/desktop/guides`, the guide data pipeline accepts `photoUrl`, renders circular doctor photo or clinic seal, full formatted address, appointment time and authenticity status.

**Tech Stack:** Next.js 15 (App Router), TypeScript, Supabase (PostgreSQL RLS), HTML5 Canvas 2D, Vitest.

## Global Constraints

- Never expose PII or medical records to anonymous users (`anon`).
- Maintain atomic rollback: if Auth or profile linking fails during signup, delete orphaned users immediately.
- `createAuthorizationGuide` canvas rendering must handle both external URLs, data URIs, and fallback gracefully if image fails to load.
- Independent clinic procedures (`professional_id == null`) must render cleanly as "Geral da Clínica" with the clinic logo/seal.
- All code changes must pass `npx tsc --noEmit` and `npm run test:unit`.
- No demo or simulation terms introduced.

---

### Task 1: Supabase RLS Migration for Patients Table

**Files:**
- Create: `supabase/migrations/20261105110000_patient_rls_and_guide_photos.sql`

**Interfaces:**
- Consumes: `public.patients`, `public.profiles`.
- Produces: RLS policies `patients_select_own` and `patients_update_own` allowing authenticated patients to safely read and update their own patient records.

- [ ] **Step 1: Create Supabase SQL migration file**

Create `supabase/migrations/20261105110000_patient_rls_and_guide_photos.sql`:
```sql
-- Políticas de RLS para pacientes autenticados
grant select, update on table public.patients to authenticated;

-- Permite ao paciente autenticado ler apenas seu próprio registro
drop policy if exists "patients_select_own" on public.patients;
create policy "patients_select_own"
  on public.patients
  for select
  to authenticated
  using (
    id = (
      select p.patient_id
      from public.profiles p
      where p.id = (select auth.uid())
    )
  );

-- Permite ao paciente autenticado atualizar apenas seu próprio registro (dados cadastrais)
drop policy if exists "patients_update_own" on public.patients;
create policy "patients_update_own"
  on public.patients
  for update
  to authenticated
  using (
    id = (
      select p.patient_id
      from public.profiles p
      where p.id = (select auth.uid())
    )
  );
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/20261105110000_patient_rls_and_guide_photos.sql
git commit -m "feat(auth): add patient RLS select and update policies for own profile"
```

---

### Task 2: Seamless Account Creation & Transition for Pre-registered Desk Patients (TDD)

**Files:**
- Modify: `src/lib/auth/patients.ts`
- Modify: `src/lib/auth/patient-actions.ts`
- Create: `tests/unit/patient-registration-transition.test.ts`

**Interfaces:**
- Consumes: `persistPatientAccount`, `registerPatientAccount`, `identifyPatientAccount`.
- Produces:
  - When `registerPatientAccount` receives a CPF that already exists in `patients` but has **no** `auth_user_id` in `mobile_accounts`:
    - Automatically links the existing patient, provisions the auth user, sets up `mobile_accounts` and `profiles`, logs in and returns `{ ok: true, patient }`.
  - When the CPF already has an `auth_user_id`:
    - Returns `{ ok: false, message: "Este CPF já tem conta. Entre com a senha ou recupere o acesso." }`.

- [ ] **Step 1: Write unit tests for transition flow**

Create `tests/unit/patient-registration-transition.test.ts`:
```typescript
import { describe, expect, it, vi, beforeEach } from "vitest"
import { registerPatientAccount } from "@/lib/auth/patient-actions"

describe("registerPatientAccount - transição de pacientes pré-cadastrados", () => {
  it("vincula paciente existente da clínica que ainda não possui senha no aplicativo", async () => {
    // Test that pre-existing desk patient gets converted smoothly without 'CPF já existe' blocking error
  })

  it("rejeita cadastro se o CPF já possuir conta com senha ativa", async () => {
    // Test that accounts already having authUserId are informed to log in
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:unit -- tests/unit/patient-registration-transition.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement smooth transition in `patients.ts` and `patient-actions.ts`**

In `src/lib/auth/patients.ts`:
Update `persistPatientAccount` or add `linkExistingPatientToAuthUser`:
If `existingPatient` exists, check if `mobile_accounts` has an `auth_user_id`. If not, update `mobile_accounts` with `auth_user_id` and upsert `profiles`.

In `src/lib/auth/patient-actions.ts`:
In `registerPatientAccount`:
Detect when `existingPatient` is present but has no password/auth user; gracefully provision and link them.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:unit -- tests/unit/patient-registration-transition.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth/patients.ts src/lib/auth/patient-actions.ts tests/unit/patient-registration-transition.test.ts
git commit -m "feat(auth): enable smooth mobile signup transition for desk pre-registered patients"
```

---

### Task 3: Guide API Upgrade with Doctor Photos, Address & Independent Clinic Procedures (TDD)

**Files:**
- Modify: `src/app/api/desktop/guides/route.ts`
- Modify: `src/lib/authorization-guide.ts`
- Create: `tests/unit/guides-api-extended.test.ts`

**Interfaces:**
- Consumes: `/api/desktop/guides`, `createSupabaseAdmin`.
- Produces:
  - `GET /api/desktop/guides` returns `photoUrl: professional.photo_url || null`.
  - If `appointment.professional_id` is null, fetches `service` from `catalog_offers` and formats `professional` as:
    `{ name: "Geral da Clínica", specialtyLabel: "Procedimento / Exame", credentialLabel: "Unidade", credentialCode: clinic.name, location: clinic.address, startHour: "08:00", endHour: "18:00", photoUrl: null }`.
  - Ensures `clinic.address`, `clinic.city`, and `clinic.phone` are always present.

- [ ] **Step 1: Write failing unit test for guides API**

Create `tests/unit/guides-api-extended.test.ts`:
Test `photo_url` extraction and null `professional_id` resolution.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:unit -- tests/unit/guides-api-extended.test.ts`
Expected: FAIL.

- [ ] **Step 3: Update `src/app/api/desktop/guides/route.ts`**

Update professional select to include `photo_url`:
`select("id,name,specialty,credential_label,credential_code,location,start_hour,end_hour,photo_url")`.
Handle independent clinic procedures when `appointment.professional_id` is null or missing.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:unit -- tests/unit/guides-api-extended.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/desktop/guides/route.ts tests/unit/guides-api-extended.test.ts
git commit -m "feat(guides): return doctor photo url and support clinic-level independent procedures"
```

---

### Task 4: Guide Canvas Rendering Upgrade with Doctor Photos, Clinic Seal, Highlighted Address/DateTime & Digital Authentication Stamp (TDD)

**Files:**
- Modify: `src/lib/authorization-guide.ts`
- Modify: `src/components/desktop/guide-export-dialog.tsx`
- Create: `tests/unit/authorization-guide-canvas.test.ts`

**Interfaces:**
- Consumes: `AuthorizationGuideInput`, `createAuthorizationGuide`.
- Produces:
  - Circular doctor photo (or clinic seal for independent procedures) rendered on Canvas beside the doctor credentials.
  - Highlighted "Local e data da realização" with clear appointment date & time and complete address.
  - Prominent "GUIA AUTORIZADA" authenticity badge with authorization code and issue timestamp.
  - Print dialog support with `printAuthorizationGuide`.

- [ ] **Step 1: Write unit test for guide canvas input and rendering helpers**

Create `tests/unit/authorization-guide-canvas.test.ts`.

- [ ] **Step 2: Update `src/lib/authorization-guide.ts`**

Add `photoUrl?: string | null` to `AuthorizationGuideInput.professional`.
Implement helper `loadOptionalImage(url: string)` to load doctor photo (or DiceBear avatar or clinic seal).
In `createAuthorizationGuide`:
- Render circular photo/avatar at section "Dados do médico".
- Render prominent "GUIA AUTORIZADA / AUTÊNTICA" header box.
- Clearly render date, time, and clinic address.

- [ ] **Step 3: Update `src/components/desktop/guide-export-dialog.tsx`**

Ensure `guideInput.professional.photoUrl` is passed through.
Provide clear feedback for Print and Download.

- [ ] **Step 4: Run tests and typecheck**

Run: `npm run test:unit -- tests/unit/authorization-guide-canvas.test.ts`
Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/authorization-guide.ts src/components/desktop/guide-export-dialog.tsx tests/unit/authorization-guide-canvas.test.ts
git commit -m "feat(guides): render doctor photo, clinic seal, full address and authenticity stamp on canvas"
```

---

### Task 5: End-to-End Verification and Regression Suite

**Files:**
- All tests in `tests/unit/`

- [ ] **Step 1: Run all unit tests**

Run: `npm run test:unit`
Expected: All test suites pass.

- [ ] **Step 2: Full TypeScript compilation check**

Run: `npx tsc --noEmit`
Expected: PASS with 0 errors.

- [ ] **Step 3: Next.js production build check**

Run: `npm run build`
Expected: PASS with all routes compiled.

- [ ] **Step 4: Confirm git status clean**

Run: `git status`
Expected: Clean working tree.
