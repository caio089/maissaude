-- Contas do Auth ligadas a pacientes e à equipe da clínica.
-- Papel fica em app_metadata (não em user_metadata). RLS impede leitura pública.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

alter table public.mobile_accounts
  add column if not exists auth_user_id uuid unique references auth.users (id) on delete cascade,
  add column if not exists email text,
  alter column password_hash drop not null;

create unique index if not exists mobile_accounts_email_idx
  on public.mobile_accounts (lower(email))
  where email is not null;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null check (role in ('clinic', 'patient')),
  patient_id text unique references public.patients (id) on delete set null,
  email text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index profiles_role_idx on public.profiles (role);

alter table public.profiles enable row level security;

create policy profiles_select_own
  on public.profiles
  for select
  to authenticated
  using ((select auth.uid()) = id);

grant select on table public.profiles to authenticated;

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, role, email)
  values (
    new.id,
    case
      when coalesce(new.raw_app_meta_data ->> 'role', '') = 'clinic' then 'clinic'
      else 'patient'
    end,
    coalesce(new.email, '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function private.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();
