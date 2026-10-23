-- Keep the associate registration flow chargeable from its first use.
-- The primary-key boolean makes this a singleton configuration row.
insert into public.associate_rules (
  id,
  fee,
  consultation_discount_percent,
  transport_enabled,
  transport_rides_per_month,
  extra_benefits
)
values (
  true,
  30,
  20,
  true,
  4,
  array[
    'Prioridade de encaixe na agenda',
    'Desconto em exames agendados pelo aplicativo'
  ]
)
on conflict (id) do nothing;
