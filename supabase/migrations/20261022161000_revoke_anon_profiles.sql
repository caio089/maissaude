-- profiles só para quem está autenticado. Anon não precisa nem do GRANT.

revoke all on table public.profiles from anon;
revoke all on table public.profiles from authenticated;
grant select on table public.profiles to authenticated;
