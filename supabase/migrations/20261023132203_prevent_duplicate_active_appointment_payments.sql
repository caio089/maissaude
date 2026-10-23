-- Impede que reenvios do cliente criem mais de uma cobrança ativa por consulta.
create unique index if not exists payments_one_open_charge_per_appointment_idx
  on public.payments (appointment_id)
  where appointment_id is not null and status in ('pending', 'paid');

-- Uma pessoa só pode ter uma assinatura Asaas em andamento por vez.
create unique index if not exists asaas_subscriptions_one_active_per_patient_idx
  on public.asaas_subscriptions (patient_id)
  where patient_id is not null and status not in ('DELETED', 'INACTIVE');
