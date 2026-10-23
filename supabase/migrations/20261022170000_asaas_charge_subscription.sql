-- Liga a cobrança avulsa à assinatura de origem, como no campo payment.subscription da Asaas.

alter table public.asaas_charges
  add column if not exists subscription_id text;

create index if not exists asaas_charges_subscription_id_idx
  on public.asaas_charges (subscription_id);
