-- Suporte a fotos de profissionais
alter table public.professionals add column if not exists photo_url text;

-- Remove restrição fixa de especialidades para suportar especialidades dinâmicas
alter table public.professionals drop constraint if exists professionals_specialty_check;

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
