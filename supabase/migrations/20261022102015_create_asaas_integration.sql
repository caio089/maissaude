-- Integração Asaas: clientes, cobranças e eventos de webhook.
-- RLS ligado e sem política para anon/authenticated: só a service role lê e grava.

alter table public.patients
  add column if not exists asaas_customer_id text unique;

alter table public.payments
  add column if not exists asaas_payment_id text unique,
  add column if not exists asaas_status text,
  add column if not exists invoice_url text,
  add column if not exists pix_payload text;

create table public.asaas_customers (
  id text primary key,
  patient_id text unique references public.patients (id) on delete set null,
  cpf_digits text not null,
  environment text not null check (environment in ('sandbox', 'production')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (cpf_digits, environment)
);

create table public.asaas_charges (
  id text primary key,
  payment_id text unique references public.payments (id) on delete set null,
  patient_id text references public.patients (id) on delete set null,
  customer_id text,
  billing_type text not null check (billing_type in ('PIX', 'CREDIT_CARD', 'BOLETO', 'UNDEFINED')),
  status text not null,
  value numeric(12, 2) not null check (value >= 0),
  due_date date,
  invoice_url text,
  pix_payload text,
  external_reference text,
  environment text not null check (environment in ('sandbox', 'production')),
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index asaas_charges_patient_id_idx on public.asaas_charges (patient_id);
create index asaas_charges_customer_id_idx on public.asaas_charges (customer_id);
create index asaas_charges_status_idx on public.asaas_charges (status);

create table public.asaas_subscriptions (
  id text primary key,
  associate_id text unique references public.associates (id) on delete set null,
  patient_id text references public.patients (id) on delete set null,
  customer_id text,
  billing_type text not null check (billing_type in ('PIX', 'CREDIT_CARD', 'BOLETO', 'UNDEFINED')),
  status text not null,
  value numeric(12, 2) not null check (value >= 0),
  cycle text not null default 'MONTHLY',
  next_due_date date,
  external_reference text,
  environment text not null check (environment in ('sandbox', 'production')),
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index asaas_subscriptions_patient_id_idx on public.asaas_subscriptions (patient_id);

create table public.asaas_webhook_events (
  id text primary key,
  event text not null,
  asaas_payment_id text,
  asaas_subscription_id text,
  payload jsonb not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);

create index asaas_webhook_events_event_idx on public.asaas_webhook_events (event);
create index asaas_webhook_events_payment_id_idx on public.asaas_webhook_events (asaas_payment_id);

alter table public.asaas_customers enable row level security;
alter table public.asaas_charges enable row level security;
alter table public.asaas_subscriptions enable row level security;
alter table public.asaas_webhook_events enable row level security;

revoke all on table public.asaas_customers from anon, authenticated;
revoke all on table public.asaas_charges from anon, authenticated;
revoke all on table public.asaas_subscriptions from anon, authenticated;
revoke all on table public.asaas_webhook_events from anon, authenticated;
