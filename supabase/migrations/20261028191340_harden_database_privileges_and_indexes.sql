-- Event-trigger helpers are internal database infrastructure, not Data API RPCs.
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;

-- Cover foreign keys used by joins and delete checks.
create index if not exists medical_records_professional_id_idx
  on public.medical_records (professional_id);

create index if not exists payments_professional_id_idx
  on public.payments (professional_id);
