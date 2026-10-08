-- ============================================================
-- A faculty member's designation.
--
-- The department's own list carries it beside every name —
-- Professor, Associate Professor, Assistant Professor, and the
-- one who is Professor & HOD — and a student looking up their
-- mentor is better served by "Associate Professor" than by
-- nothing at all.
--
-- Carried through handle_new_user for the same reason phone is:
-- enforce_profile_locks() refuses the UPDATE for the service key
-- the importer runs under, so it arrives with the account.
-- ============================================================

alter table public.profiles
  add column if not exists designation text;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role, usn, phone, designation)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce((new.raw_user_meta_data ->> 'role')::public.user_role, 'student'),
    nullif(new.raw_user_meta_data ->> 'usn', ''),
    nullif(new.raw_user_meta_data ->> 'phone', ''),
    nullif(new.raw_user_meta_data ->> 'designation', '')
  );
  return new;
end;
$$;
