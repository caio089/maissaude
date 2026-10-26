-- Each authorization belongs to one verified payment and one appointment.
create table public.authorization_guides (
  id uuid primary key default gen_random_uuid(),
  appointment_id text not null references public.appointments(id) on delete restrict,
  payment_id text not null references public.payments(id) on delete restrict,
  issued_at timestamptz not null default now(),
  unique (appointment_id, payment_id)
);
create index authorization_guides_payment_idx on public.authorization_guides(payment_id);
alter table public.authorization_guides enable row level security;
revoke all on public.authorization_guides from public, anon, authenticated;
grant select, insert on public.authorization_guides to service_role;

-- Invoker privileges: only trusted server-side writers can create a guide.
create function private.issue_guide_on_payment()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  insert into public.authorization_guides (appointment_id, payment_id)
  select a.id, new.id
  from public.appointments a
  where a.id = new.appointment_id and a.payment_id = new.id
    and a.patient_id = new.patient_id and a.status <> 'cancelled'
    and new.status = 'paid' and new.simulated = false and new.asaas_payment_id is not null
  on conflict (appointment_id, payment_id) do nothing;
  return new;
end;
$$;
revoke all on function private.issue_guide_on_payment() from public, anon, authenticated;

create function private.issue_guide_on_appointment()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  insert into public.authorization_guides (appointment_id, payment_id)
  select new.id, p.id
  from public.payments p
  where p.id = new.payment_id and p.appointment_id = new.id
    and p.patient_id = new.patient_id and new.status <> 'cancelled'
    and p.status = 'paid' and p.simulated = false and p.asaas_payment_id is not null
  on conflict (appointment_id, payment_id) do nothing;
  return new;
end;
$$;
revoke all on function private.issue_guide_on_appointment() from public, anon, authenticated;

create trigger issue_guide_after_payment
after insert or update of status, simulated, asaas_payment_id, appointment_id, patient_id on public.payments
for each row execute function private.issue_guide_on_payment();
create trigger issue_guide_after_appointment
after insert or update of payment_id, status, patient_id on public.appointments
for each row execute function private.issue_guide_on_appointment();

-- Recover existing confirmed, linked payments without duplicating guides.
insert into public.authorization_guides (appointment_id, payment_id)
select a.id, p.id from public.appointments a
join public.payments p on p.id = a.payment_id and p.appointment_id = a.id and p.patient_id = a.patient_id
where p.status = 'paid' and p.simulated = false and p.asaas_payment_id is not null and a.status <> 'cancelled'
on conflict (appointment_id, payment_id) do nothing;
