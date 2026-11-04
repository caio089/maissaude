-- Adiciona coluna de metadados na tabela de pagamentos para rastreamento de quitação de associados e regras de negócio
alter table public.payments add column if not exists metadata jsonb default '{}'::jsonb;
