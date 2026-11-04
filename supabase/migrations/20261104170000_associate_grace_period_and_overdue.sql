-- Atualiza restrição de status para incluir 'overdue' e 'cancelled'
alter table public.associates drop constraint if exists associates_status_check;
alter table public.associates add constraint associates_status_check check (status in ('active', 'inactive', 'overdue', 'cancelled'));

-- Adiciona colunas de controle de atraso e vencimento
alter table public.associates add column if not exists overdue_months integer not null default 0;
alter table public.associates add column if not exists next_due_date date;
alter table public.associates add column if not exists last_paid_at timestamptz;

-- Adiciona coluna de carência padrão na tabela de regras
alter table public.associate_rules add column if not exists grace_months integer not null default 3 check (grace_months >= 1 and grace_months <= 12);
