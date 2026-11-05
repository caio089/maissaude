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
