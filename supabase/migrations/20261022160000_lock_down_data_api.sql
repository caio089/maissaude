-- Trava o Data API: anon/authenticated não leem PII nem prontuário.
-- Papel continua em app_metadata. A função definer não deixa search_path aberto.

revoke all on table public.clinics from anon, authenticated;
revoke all on table public.professionals from anon, authenticated;
revoke all on table public.professional_services from anon, authenticated;
revoke all on table public.professional_reviews from anon, authenticated;
revoke all on table public.patients from anon, authenticated;
revoke all on table public.mobile_accounts from anon, authenticated;
revoke all on table public.associates from anon, authenticated;
revoke all on table public.associate_rules from anon, authenticated;
revoke all on table public.catalog_offers from anon, authenticated;
revoke all on table public.appointments from anon, authenticated;
revoke all on table public.payments from anon, authenticated;
revoke all on table public.cash_entries from anon, authenticated;
revoke all on table public.blocked_slots from anon, authenticated;
revoke all on table public.medical_records from anon, authenticated;
revoke all on table public.record_prescriptions from anon, authenticated;
revoke all on table public.record_documents from anon, authenticated;

revoke insert, update, delete, truncate on table public.profiles from anon, authenticated;
grant select on table public.profiles to authenticated;

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, role, email)
  values (
    new.id,
    case
      when coalesce(new.raw_app_meta_data ->> 'role', '') = 'clinic' then 'clinic'
      when coalesce(new.raw_app_meta_data ->> 'role', '') = 'patient' then 'patient'
      else 'patient'
    end,
    coalesce(new.email, '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function private.handle_new_user() from public, anon, authenticated;
