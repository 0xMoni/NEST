-- Refuses to run once a later migration is applied: running an old
-- file again puts back what later ones fixed. See 20261119000000.
do $$
declare later boolean;
begin
  if to_regclass('private.applied_migrations') is not null then
    execute 'select exists (select 1 from private.applied_migrations where version > $1)'
       into later using '20261118000000';
    if later then
      raise exception 'A later migration is already applied; running 20261118000000 again would undo it.';
    end if;
  end if;
end $$;

-- ============================================================
-- New teachers and HODs were created as students.
--
-- Since 20261116000000_lock_down_access.sql, a profile's role,
-- USN, department and semester come only from app_metadata, which
-- only the secret key can set. But Supabase's admin createUser()
-- inserts the auth.users row first, with nothing in app_metadata
-- but the provider, and writes the app_metadata it was given in a
-- second step. handle_new_user() runs on the insert, sees no role,
-- and makes everyone a student.
--
-- So the profile also follows app_metadata when it changes. Only
-- the secret key can change app_metadata, so this is still the
-- office's channel and nobody else's. A key that is missing or
-- empty leaves the profile's value alone: the 510 accounts made
-- before lock-down, whose role was never in app_metadata, keep the
-- role they have.
--
-- Run after 20261117000000_attendance_export.sql. Safe to run more
-- than once.
-- ============================================================

create or replace function public.sync_profile_from_app_metadata()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  app jsonb := coalesce(new.raw_app_meta_data, '{}'::jsonb);
begin
  if new.raw_app_meta_data is not distinct from old.raw_app_meta_data then
    return new;
  end if;

  update public.profiles p
     set role        = coalesce((nullif(app ->> 'role', ''))::public.user_role, p.role),
         usn         = coalesce(nullif(upper(app ->> 'usn'), ''), p.usn),
         dept        = coalesce(nullif(upper(app ->> 'dept'), ''), p.dept),
         semester    = coalesce((nullif(app ->> 'semester', ''))::smallint, p.semester),
         full_name   = coalesce(nullif(app ->> 'full_name', ''), p.full_name),
         designation = coalesce(nullif(app ->> 'designation', ''), p.designation),
         phone       = coalesce(nullif(app ->> 'phone', ''), p.phone)
   where p.id = new.id;

  return new;
end;
$$;

drop trigger if exists on_auth_user_app_metadata_changed on auth.users;
create trigger on_auth_user_app_metadata_changed
  after update of raw_app_meta_data on auth.users
  for each row execute function public.sync_profile_from_app_metadata();
