-- Esquema da CuidarSaude. Os ids em texto acompanham o aplicativo de demonstração.
-- RLS ligado, sem política para anon: o Data API não devolve linha até o app autenticar.

create table public.clinics (
  id text primary key,
  name text not null,
  legal_name text not null,
  city text not null,
  address text not null,
  phone text not null,
  email text not null,
  created_at timestamptz not null default now()
);

create table public.professionals (
  id text primary key,
  name text not null,
  specialty text not null
    check (specialty in (
      'clinica-geral',
      'odontologia',
      'dermatologia',
      'cardiologia',
      'pediatria',
      'ginecologia',
      'fisioterapia'
    )),
  credential_label text not null,
  credential_code text not null unique,
  bio text not null default '',
  price numeric(12, 2) not null check (price >= 0),
  rating numeric(2, 1) not null default 0 check (rating >= 0 and rating <= 5),
  review_count integer not null default 0 check (review_count >= 0),
  work_days smallint[] not null default '{}',
  start_hour time not null,
  end_hour time not null,
  location text not null,
  active boolean not null default true,
  avatar_seed text not null,
  created_at timestamptz not null default now(),
  check (end_hour > start_hour)
);

create table public.professional_services (
  id text primary key,
  professional_id text not null references public.professionals (id) on delete cascade,
  name text not null,
  duration_min integer not null check (duration_min > 0),
  price numeric(12, 2) not null check (price >= 0),
  modality text not null check (modality in ('presencial', 'teleconsulta'))
);

create index professional_services_professional_id_idx
  on public.professional_services (professional_id);

create table public.professional_reviews (
  id text primary key,
  professional_id text not null references public.professionals (id) on delete cascade,
  author text not null,
  rating numeric(2, 1) not null check (rating >= 0 and rating <= 5),
  comment text not null,
  reviewed_on date not null,
  demonstrative boolean not null default true
);

create index professional_reviews_professional_id_idx
  on public.professional_reviews (professional_id);

create table public.patients (
  id text primary key,
  name text not null,
  cpf text not null unique,
  phone text not null,
  email text not null unique,
  birth_date date not null,
  gender text not null default 'Não informado',
  address text not null default '',
  city text not null,
  status text not null check (status in ('active', 'inactive')),
  notes text not null default '',
  reminder_enabled boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.mobile_accounts (
  patient_id text primary key references public.patients (id) on delete cascade,
  cpf text not null unique,
  password_hash text not null,
  created_at timestamptz not null default now()
);

create table public.associates (
  id text primary key,
  name text not null,
  cpf text not null unique,
  phone text not null,
  email text not null,
  status text not null check (status in ('active', 'inactive')),
  created_at timestamptz not null default now()
);

create table public.associate_rules (
  id boolean primary key default true check (id),
  fee numeric(12, 2) not null check (fee >= 0 and fee <= 500),
  consultation_discount_percent integer not null
    check (consultation_discount_percent >= 0 and consultation_discount_percent <= 80),
  transport_enabled boolean not null default true,
  transport_rides_per_month integer not null
    check (transport_rides_per_month >= 0 and transport_rides_per_month <= 31),
  extra_benefits text[] not null default '{}'
);

create table public.catalog_offers (
  id text primary key,
  kind text not null check (kind in ('consulta', 'exame', 'cirurgia')),
  service_name text not null,
  professional_id text not null references public.professionals (id) on delete restrict,
  price numeric(12, 2) not null check (price >= 0),
  duration_min integer not null check (duration_min > 0)
);

create index catalog_offers_professional_id_idx
  on public.catalog_offers (professional_id);

create index catalog_offers_kind_idx
  on public.catalog_offers (kind);

create table public.appointments (
  id text primary key,
  patient_id text not null references public.patients (id) on delete restrict,
  professional_id text not null references public.professionals (id) on delete restrict,
  service_id text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null
    check (status in ('scheduled', 'confirmed', 'completed', 'cancelled', 'no-show')),
  modality text not null check (modality in ('presencial', 'teleconsulta')),
  notes text not null default '',
  origin text not null check (origin in ('seed', 'desktop', 'mobile')),
  payment_id text,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create index appointments_patient_id_idx on public.appointments (patient_id);
create index appointments_professional_id_idx on public.appointments (professional_id);
create index appointments_starts_at_idx on public.appointments (starts_at);

create table public.payments (
  id text primary key,
  appointment_id text references public.appointments (id) on delete set null,
  patient_id text not null references public.patients (id) on delete restrict,
  professional_id text not null references public.professionals (id) on delete restrict,
  amount numeric(12, 2) not null check (amount >= 0),
  method text not null check (method in ('pix', 'card')),
  status text not null check (status in ('pending', 'paid', 'refunded', 'declined')),
  reference text not null unique,
  simulated boolean not null default true,
  description text not null default '',
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

create index payments_patient_id_idx on public.payments (patient_id);
create index payments_appointment_id_idx on public.payments (appointment_id);

alter table public.appointments
  add constraint appointments_payment_id_fkey
  foreign key (payment_id) references public.payments (id) on delete set null;

create index appointments_payment_id_idx on public.appointments (payment_id);

create table public.cash_entries (
  id text primary key,
  kind text not null check (kind in ('income', 'expense')),
  category text not null
    check (category in (
      'consulta',
      'mensalidade',
      'exame',
      'aluguel',
      'salario',
      'material',
      'transporte',
      'outro'
    )),
  description text not null,
  amount numeric(12, 2) not null check (amount >= 0),
  occurred_on date not null,
  created_at timestamptz not null default now()
);

create index cash_entries_occurred_on_idx on public.cash_entries (occurred_on);

create table public.blocked_slots (
  id text primary key,
  professional_id text not null references public.professionals (id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text not null,
  origin text not null check (origin in ('seed', 'desktop', 'mobile')),
  check (ends_at > starts_at)
);

create index blocked_slots_professional_id_idx
  on public.blocked_slots (professional_id);

create table public.medical_records (
  id text primary key,
  patient_id text not null references public.patients (id) on delete cascade,
  professional_id text not null references public.professionals (id) on delete restrict,
  appointment_id text references public.appointments (id) on delete set null,
  recorded_on date not null,
  specialty text not null,
  complaint text not null default '',
  notes text not null default '',
  evolution text not null default '',
  dental_note text,
  created_at timestamptz not null default now()
);

create index medical_records_patient_id_idx on public.medical_records (patient_id);
create index medical_records_appointment_id_idx on public.medical_records (appointment_id);

create table public.record_prescriptions (
  id text primary key,
  record_id text not null references public.medical_records (id) on delete cascade,
  label text not null,
  instructions text not null,
  demonstrative boolean not null default true
);

create index record_prescriptions_record_id_idx
  on public.record_prescriptions (record_id);

create table public.record_documents (
  id text primary key,
  record_id text not null references public.medical_records (id) on delete cascade,
  title text not null,
  kind text not null,
  demonstrative boolean not null default true
);

create index record_documents_record_id_idx
  on public.record_documents (record_id);

alter table public.clinics enable row level security;
alter table public.professionals enable row level security;
alter table public.professional_services enable row level security;
alter table public.professional_reviews enable row level security;
alter table public.patients enable row level security;
alter table public.mobile_accounts enable row level security;
alter table public.associates enable row level security;
alter table public.associate_rules enable row level security;
alter table public.catalog_offers enable row level security;
alter table public.appointments enable row level security;
alter table public.payments enable row level security;
alter table public.cash_entries enable row level security;
alter table public.blocked_slots enable row level security;
alter table public.medical_records enable row level security;
alter table public.record_prescriptions enable row level security;
alter table public.record_documents enable row level security;
