-- ============================================================
-- Let an imported account arrive with its phone number.
--
-- enforce_profile_locks() refuses an UPDATE to profiles.phone
-- unless is_admin(), and is_admin() reads auth.uid() — which is
-- null for the service key the roster importer runs under. So the
-- importer cannot set a phone after creating the account.
--
-- The INSERT in handle_new_user() runs before that trigger
-- applies, so the number comes in with the account instead, from
-- the same user_metadata that already carries the name, role and
-- USN. Nothing else changes: a student still cannot edit it, and
-- their mentor still has to open the section first.
-- ============================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role, usn, phone)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce((new.raw_user_meta_data ->> 'role')::public.user_role, 'student'),
    nullif(new.raw_user_meta_data ->> 'usn', ''),
    nullif(new.raw_user_meta_data ->> 'phone', '')
  );
  return new;
end;
$$;
