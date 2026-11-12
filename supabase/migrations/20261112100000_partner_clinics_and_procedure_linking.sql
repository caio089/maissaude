-- Suporte a Clínicas Parceiras, Unidades e Vínculo de Procedimentos/Exames

-- Adiciona coluna de status ativo na tabela de clínicas caso não exista
alter table public.clinics add column if not exists active boolean not null default true;

-- Adiciona vínculo de clínica parceira em ofertas de catálogo (exames/procedimentos)
alter table public.catalog_offers add column if not exists clinic_id text references public.clinics(id) on delete set null;

-- Adiciona vínculo de clínica parceira no agendamento de consultas e exames
alter table public.appointments add column if not exists clinic_id text references public.clinics(id) on delete set null;

-- Permite pagamentos de procedimentos independentes ou exames de clínicas sem profissional vinculado
alter table public.payments alter column professional_id drop not null;

-- Índices de consulta rápida
create index if not exists catalog_offers_clinic_id_idx on public.catalog_offers(clinic_id);
create index if not exists appointments_clinic_id_idx on public.appointments(clinic_id);
