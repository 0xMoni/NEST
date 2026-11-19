-- Refuses to run once a later migration is applied: running an old
-- file again puts back what later ones fixed. See 20261119000000.
do $$
declare later boolean;
begin
  if to_regclass('private.applied_migrations') is not null then
    execute 'select exists (select 1 from private.applied_migrations where version > $1)'
       into later using '20261008000000';
    if later then
      raise exception 'A later migration is already applied; running 20261008000000 again would undo it.';
    end if;
  end if;
end $$;

-- ============================================================
-- A faculty member's designation.
--
-- The department's own list carries it beside every name —
-- Professor, Associate Professor, Assistant Professor, and the
-- one who is Professor & HOD — and a student looking up their
-- mentor is better served by "Associate Professor" than by
-- nothing at all.
--
-- Both designation and phone are carried through handle_new_user
-- rather than written afterwards: enforce_profile_locks() refuses
-- an UPDATE to either unless is_admin(), and is_admin() reads
-- auth.uid(), which is null for the service key the importers run
-- under. The insert happens before that trigger applies.
--
-- This supersedes 20261007010000, which added phone to the same
-- function a day earlier and has been removed — running both only
-- redefined the function twice.
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
