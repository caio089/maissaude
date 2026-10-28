-- The API checks availability before inserting, but two concurrent requests can
-- both pass that check. The database is the final, atomic guard.
create extension if not exists btree_gist with schema extensions;

alter table public.appointments
  add constraint appointments_no_overlapping_active_slots
  exclude using gist (
    professional_id with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  )
  where (status in ('scheduled', 'confirmed'));
